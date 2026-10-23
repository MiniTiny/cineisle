#include "NapiCaptionRenderer.h"
#include <native_drawing/drawing_text_typography.h>
#include <native_drawing/drawing_font_collection.h>
#include <native_drawing/drawing_bitmap.h>
#include <native_drawing/drawing_brush.h>
#include <native_drawing/drawing_canvas.h>
#include <native_drawing/drawing_pen.h>
#include <native_drawing/drawing_filter.h>
#include <native_drawing/drawing_mask_filter.h>
#include <native_drawing/drawing_point.h>
#include <fribidi/fribidi.h>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>

namespace {
constexpr size_t MAX_TEXT = 4 * 1024 * 1024;
constexpr uint64_t MAX_PIXELS = 1920ULL * 1080ULL;
template<class T, void (*D)(T*)> using Own = std::unique_ptr<T, decltype(D)>;
struct Run {
    std::string text, family;
    size_t units = 0;
    double size = 20, baseline = 0;
    uint32_t color = 0xFFFFFFFF, background = 0;
    bool bold = false, italic = false, underline = false, strike = false;
};
struct Shadow { uint32_t color; double x, y, radius; };
struct Request { double width = 1; uint32_t lines = 1000; bool intrinsic = false; std::vector<Run> runs; std::vector<Shadow> shadows; };
struct Frame { uint32_t width = 0, height = 0, layoutWidth = 0, layoutHeight = 0, halo = 0; std::vector<uint8_t> rgba; };
void Check(napi_status status) { if (status != napi_ok) { throw std::invalid_argument("caption_argument_invalid"); } }
napi_value Field(napi_env env, napi_value object, const char *key) {
    napi_value result; Check(napi_get_named_property(env, object, key, &result)); return result;
}
double Number(napi_env env, napi_value value, double minimum, double maximum) {
    double result; Check(napi_get_value_double(env, value, &result));
    if (!std::isfinite(result) || result < minimum || result > maximum) { throw std::invalid_argument("caption_argument_invalid"); }
    return result;
}
uint32_t Integer(napi_env env, napi_value value, uint32_t minimum, uint32_t maximum) {
    const double result = Number(env, value, minimum, maximum);
    if (std::floor(result) != result) { throw std::invalid_argument("caption_argument_invalid"); }
    return uint32_t(result);
}
bool Boolean(napi_env env, napi_value value) { bool result; Check(napi_get_value_bool(env, value, &result)); return result; }
std::string String(napi_env env, napi_value value, size_t maximum, size_t *units = nullptr) {
    size_t length; Check(napi_get_value_string_utf8(env, value, nullptr, 0, &length));
    if (length > maximum) { throw std::invalid_argument("caption_text_too_large"); }
    std::vector<char> buffer(length + 1); Check(napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &length));
    std::string result(buffer.data(), length);
    if (result.find('\0') != std::string::npos) { throw std::invalid_argument("caption_text_invalid"); }
    if (units) { Check(napi_get_value_string_utf16(env, value, nullptr, 0, units)); }
    return result;
}
Request Read(napi_env env, napi_value value) {
    Request out; out.width = Number(env, Field(env, value, "width"), 1, 8192);
    out.lines = Integer(env, Field(env, value, "maxLines"), 1, 1000);
    out.intrinsic = Boolean(env, Field(env, value, "intrinsic"));
    auto array = Field(env, value, "runs"); bool isArray; Check(napi_is_array(env, array, &isArray));
    uint32_t count; Check(napi_get_array_length(env, array, &count));
    if (!isArray || !count || count > 4096) { throw std::invalid_argument("caption_runs_invalid"); }
    size_t bytes = 0;
    for (uint32_t i = 0; i < count; ++i) {
        napi_value entry; Check(napi_get_element(env, array, i, &entry)); Run run;
        run.text = String(env, Field(env, entry, "text"), MAX_TEXT, &run.units); bytes += run.text.size();
        if (bytes > MAX_TEXT) { throw std::invalid_argument("caption_text_too_large"); }
        run.family = String(env, Field(env, entry, "family"), 128);
        run.size = Number(env, Field(env, entry, "size"), 0.01, 8192);
        run.baseline = Number(env, Field(env, entry, "baseline"), -1000000, 1000000);
        run.color = Integer(env, Field(env, entry, "color"), 0, UINT32_MAX);
        bool hasBackground; Check(napi_has_named_property(env, entry, "background", &hasBackground));
        if (hasBackground) { run.background = Integer(env, Field(env, entry, "background"), 0, UINT32_MAX); }
        run.bold = Boolean(env, Field(env, entry, "bold")); run.italic = Boolean(env, Field(env, entry, "italic"));
        run.underline = Boolean(env, Field(env, entry, "underline")); run.strike = Boolean(env, Field(env, entry, "strike"));
        out.runs.push_back(std::move(run));
    }
    if (!bytes) { throw std::invalid_argument("caption_text_empty"); }
    array = Field(env, value, "shadows"); Check(napi_is_array(env, array, &isArray)); Check(napi_get_array_length(env, array, &count));
    if (!isArray || count > 4) { throw std::invalid_argument("caption_shadows_invalid"); }
    for (uint32_t i = 0; i < count; ++i) {
        napi_value entry; Check(napi_get_element(env, array, i, &entry));
        out.shadows.push_back({Integer(env, Field(env, entry, "color"), 0, UINT32_MAX),
            Number(env, Field(env, entry, "x"), -128, 128), Number(env, Field(env, entry, "y"), -128, 128),
            Number(env, Field(env, entry, "radius"), 0, 128)});
    }
    return out;
}
std::vector<std::string> Families(const std::string &value) {
    std::vector<std::string> result; size_t start = 0;
    while (start < value.size()) {
        const size_t end = value.find(',', start); auto part = value.substr(start, end == std::string::npos ? end : end - start);
        const auto first = part.find_first_not_of(" \t"); const auto last = part.find_last_not_of(" \t");
        if (first != std::string::npos) { result.push_back(part.substr(first, last - first + 1)); }
        if (end == std::string::npos) { break; } start = end + 1;
    }
    if (result.empty()) { result.push_back("sans-serif"); } return result;
}
int Direction(const Request &request) {
    std::string text; for (const auto &run : request.runs) { text += run.text; }
    std::vector<FriBidiChar> unicode(text.size());
    const auto count = fribidi_charset_to_unicode(FRIBIDI_CHAR_SET_UTF8, text.data(), FriBidiStrIndex(text.size()), unicode.data());
    std::vector<FriBidiCharType> types(size_t(std::max(0, count)));
    fribidi_get_bidi_types(unicode.data(), count, types.data());
    return FRIBIDI_IS_RTL(fribidi_get_par_direction(types.data(), count)) ? TEXT_DIRECTION_RTL : TEXT_DIRECTION_LTR;
}
struct Paragraph {
    Own<OH_Drawing_FontCollection, OH_Drawing_DestroyFontCollection> fonts{OH_Drawing_CreateFontCollection(), OH_Drawing_DestroyFontCollection};
    Own<OH_Drawing_TypographyStyle, OH_Drawing_DestroyTypographyStyle> style{OH_Drawing_CreateTypographyStyle(), OH_Drawing_DestroyTypographyStyle};
    std::vector<Own<OH_Drawing_Brush, OH_Drawing_BrushDestroy>> backgrounds;
    Own<OH_Drawing_TypographyCreate, OH_Drawing_DestroyTypographyHandler> builder{nullptr, OH_Drawing_DestroyTypographyHandler};
    Own<OH_Drawing_Typography, OH_Drawing_DestroyTypography> text{nullptr, OH_Drawing_DestroyTypography};
    std::vector<size_t> starts, ends;
    Paragraph(const Request &request, int orientation, bool ellipsis = true) {
        if (!fonts || !style) { throw std::bad_alloc(); }
        OH_Drawing_SetTypographyTextAlign(style.get(), TEXT_ALIGN_CENTER);
        OH_Drawing_SetTypographyTextDirection(style.get(), Direction(request));
        OH_Drawing_SetTypographyTextMaxLines(style.get(), request.lines);
        OH_Drawing_SetTypographyTextEllipsis(style.get(), ellipsis ? "\xE2\x80\xA6" : "");
        builder.reset(OH_Drawing_CreateTypographyHandler(style.get(), fonts.get())); if (!builder) { throw std::bad_alloc(); }
        size_t index = 0;
        for (const auto &run : request.runs) {
            Own<OH_Drawing_TextStyle, OH_Drawing_DestroyTextStyle> s(OH_Drawing_CreateTextStyle(), OH_Drawing_DestroyTextStyle);
            if (!s) { throw std::bad_alloc(); }
            auto names = Families(run.family); std::vector<const char *> pointers;
            for (const auto &name : names) { pointers.push_back(name.c_str()); }
            OH_Drawing_SetTextStyleFontFamilies(s.get(), int(pointers.size()), pointers.data());
            OH_Drawing_SetTextStyleFontSize(s.get(), run.size);
            OH_Drawing_SetTextStyleFontWeight(s.get(), run.bold ? FONT_WEIGHT_700 : FONT_WEIGHT_400);
            OH_Drawing_SetTextStyleFontStyle(s.get(), run.italic ? FONT_STYLE_ITALIC : FONT_STYLE_NORMAL);
            OH_Drawing_SetTextStyleColor(s.get(), run.color);
            if ((run.background >> 24) != 0) {
                Own<OH_Drawing_Brush, OH_Drawing_BrushDestroy> brush(OH_Drawing_BrushCreate(), OH_Drawing_BrushDestroy);
                if (!brush) { throw std::bad_alloc(); }
                OH_Drawing_BrushSetColor(brush.get(), run.background);
                OH_Drawing_SetTextStyleBackgroundBrush(s.get(), brush.get());
                backgrounds.push_back(std::move(brush));
            }
            OH_Drawing_TextStyleSetBaselineShift(s.get(), run.baseline * orientation);
            if (run.strike) { OH_Drawing_SetTextStyleDecoration(s.get(), TEXT_DECORATION_LINE_THROUGH); OH_Drawing_SetTextStyleDecorationColor(s.get(), run.color); }
            for (const auto &shadow : request.shadows) {
                Own<OH_Drawing_TextShadow, OH_Drawing_DestroyTextShadow> sh(OH_Drawing_CreateTextShadow(), OH_Drawing_DestroyTextShadow);
                Own<OH_Drawing_Point, OH_Drawing_PointDestroy> pt(OH_Drawing_PointCreate(shadow.x, shadow.y), OH_Drawing_PointDestroy);
                if (!sh || !pt) { throw std::bad_alloc(); }
                OH_Drawing_SetTextShadow(sh.get(), shadow.color, pt.get(), shadow.radius); OH_Drawing_TextStyleAddShadow(s.get(), sh.get());
            }
            starts.push_back(index); index += run.units; ends.push_back(index);
            OH_Drawing_TypographyHandlerPushTextStyle(builder.get(), s.get());
            OH_Drawing_TypographyHandlerAddText(builder.get(), run.text.c_str()); OH_Drawing_TypographyHandlerPopTextStyle(builder.get());
        }
        text.reset(OH_Drawing_CreateTypography(builder.get())); if (!text) { throw std::bad_alloc(); }
        OH_Drawing_TypographyLayout(text.get(), request.width);
    }
};
Own<OH_Drawing_TextBox, OH_Drawing_TypographyDestroyTextBox> Boxes(Paragraph &paragraph, size_t start, size_t end) {
    auto *raw = OH_Drawing_TypographyGetRectsForRange(paragraph.text.get(), start, end, RECT_HEIGHT_STYLE_TIGHT, RECT_WIDTH_STYLE_TIGHT);
    if (!raw) { throw std::runtime_error("caption_layout_failed"); }
    return {raw, OH_Drawing_TypographyDestroyTextBox};
}
int Orientation() {
    static std::once_flag once; static int result = 0;
    std::call_once(once, [] {
        Request request; request.width = 1000; request.lines = 1; Run high, base;
        high.text = "M"; high.units = 1; high.family = "monospace"; high.size = 70; high.baseline = 37;
        base = high; base.baseline = 0; request.runs = {high, base}; Paragraph paragraph(request, 1);
        auto a = Boxes(paragraph, 0, 1), b = Boxes(paragraph, 1, 2);
        if (OH_Drawing_GetSizeOfTextBox(a.get()) != 1 || OH_Drawing_GetSizeOfTextBox(b.get()) != 1) { throw std::runtime_error("caption_baseline_unavailable"); }
        const float delta = OH_Drawing_GetTopFromTextBox(a.get(), 0) - OH_Drawing_GetTopFromTextBox(b.get(), 0);
        if (std::abs(delta - 37) < 1) { result = -1; }
        else if (std::abs(delta + 37) < 1) { result = 1; }
        else { throw std::runtime_error("caption_baseline_unavailable"); }
    }); return result;
}
OH_Drawing_Font_Metrics FontMetrics(const Run &run) {
    Request request; request.width = 100000; request.lines = 1;
    Run measured = run; measured.text = "M"; measured.units = 1; measured.baseline = 0; measured.strike = false; measured.underline = false;
    request.runs = {measured}; Paragraph paragraph(request, 1); OH_Drawing_LineMetrics line{};
    if (!OH_Drawing_TypographyGetLineMetricsAt(paragraph.text.get(), 0, &line) ||
        !std::isfinite(line.firstCharMetrics.descent) || !std::isfinite(line.firstCharMetrics.underlinePosition) ||
        !std::isfinite(line.firstCharMetrics.underlineThickness) || line.firstCharMetrics.underlineThickness <= 0) {
        throw std::runtime_error("caption_font_metrics_unavailable");
    }
    return line.firstCharMetrics;
}
struct Underline { float left, right, y, thickness; uint32_t color; };
void Line(OH_Drawing_Canvas *canvas, const Underline &line, const Shadow &shadow) {
    Own<OH_Drawing_Pen, OH_Drawing_PenDestroy> pen(OH_Drawing_PenCreate(), OH_Drawing_PenDestroy);
    if (!pen) { throw std::bad_alloc(); }
    OH_Drawing_PenSetAntiAlias(pen.get(), true); OH_Drawing_PenSetColor(pen.get(), shadow.color);
    OH_Drawing_PenSetWidth(pen.get(), line.thickness);
    Own<OH_Drawing_Filter, OH_Drawing_FilterDestroy> filter(nullptr, OH_Drawing_FilterDestroy);
    Own<OH_Drawing_MaskFilter, OH_Drawing_MaskFilterDestroy> mask(nullptr, OH_Drawing_MaskFilterDestroy);
    if (shadow.radius > 0) {
        filter.reset(OH_Drawing_FilterCreate()); mask.reset(OH_Drawing_MaskFilterCreateBlur(NORMAL, shadow.radius, true));
        if (!filter || !mask) { throw std::bad_alloc(); }
        OH_Drawing_FilterSetMaskFilter(filter.get(), mask.get()); OH_Drawing_PenSetFilter(pen.get(), filter.get());
    }
    OH_Drawing_CanvasAttachPen(canvas, pen.get());
    OH_Drawing_CanvasDrawLine(canvas, line.left + shadow.x, line.y + shadow.y, line.right + shadow.x, line.y + shadow.y);
    OH_Drawing_CanvasDetachPen(canvas);
}
void KeepVisibleTail(const Request &request, int orientation, double width, std::unique_ptr<Paragraph> &paragraph) {
    if (!OH_Drawing_TypographyDidExceedMaxLines(paragraph->text.get())) { return; }
    size_t total = 0; for (const auto &run : request.runs) { total += run.units; }
    size_t visible = total;
    for (auto run = request.runs.rbegin(); run != request.runs.rend(); ++run) {
        auto character = run->text.rbegin();
        while (character != run->text.rend() && *character == '\n') { --visible; ++character; }
        if (character != run->text.rend()) { break; }
    }
    if (visible == total) { return; }
    // One extra line, without ellipsis, exposes the full ranges of the original visible lines.
    // The painted paragraph retains the original limit; only terminal empty lines may be clipped silently.
    Request probeRequest = request; probeRequest.lines = request.lines + 1;
    Paragraph probe(probeRequest, orientation, false); OH_Drawing_TypographyLayout(probe.text.get(), width);
    const size_t count = std::min<size_t>(request.lines, OH_Drawing_TypographyGetLineCount(probe.text.get()));
    size_t end = 0;
    for (size_t i = 0; i < count; ++i) {
        OH_Drawing_LineMetrics line{};
        if (!OH_Drawing_TypographyGetLineMetricsAt(probe.text.get(), int(i), &line)) { throw std::runtime_error("caption_layout_failed"); }
        end = std::max(end, line.endIndex);
    }
    if (end < visible) { return; } // Real content overflow keeps the normal ellipsis.
    auto complete = std::make_unique<Paragraph>(request, orientation, false);
    OH_Drawing_TypographyLayout(complete->text.get(), width);
    paragraph.swap(complete); // Destroy each old typography before its owned fonts and brushes.
}
Frame Rasterize(const Request &request) {
    const int orientation = Orientation();
    auto owner = std::make_unique<Paragraph>(request, orientation);
    double width = request.width;
    if (request.intrinsic) {
        width = std::min(width, std::max(1.0, std::ceil(OH_Drawing_TypographyGetLongestLine(owner->text.get()))));
        OH_Drawing_TypographyLayout(owner->text.get(), width);
    }
    KeepVisibleTail(request, orientation, width, owner);
    Paragraph &paragraph = *owner;
    const double height = std::ceil(OH_Drawing_TypographyGetHeight(paragraph.text.get()));
    double halo = 2;
    for (const auto &shadow : request.shadows) { halo = std::max(halo, std::ceil(shadow.radius * 3 + std::max(std::abs(shadow.x), std::abs(shadow.y))) + 2); }
    if (!std::isfinite(height) || height < 1 || height > 32768) { throw std::runtime_error("caption_frame_too_large"); }
    Frame out; out.layoutWidth = uint32_t(std::ceil(width)); out.layoutHeight = uint32_t(height); out.halo = uint32_t(halo);
    out.width = out.layoutWidth + out.halo * 2; out.height = out.layoutHeight + out.halo * 2;
    if (uint64_t(out.width) * out.height > MAX_PIXELS) { throw std::runtime_error("caption_frame_too_large"); }
    std::vector<Underline> lines;
    std::map<std::tuple<std::string, double, bool, bool>, OH_Drawing_Font_Metrics> metrics;
    for (size_t i = 0; i < request.runs.size(); ++i) {
        const auto &run = request.runs[i]; if (!run.underline || !run.units) { continue; }
        const auto key = std::make_tuple(run.family, run.size, run.bold, run.italic);
        auto found = metrics.find(key); if (found == metrics.end()) { found = metrics.emplace(key, FontMetrics(run)).first; }
        const auto &font = found->second; auto boxes = Boxes(paragraph, paragraph.starts[i], paragraph.ends[i]);
        const size_t count = OH_Drawing_GetSizeOfTextBox(boxes.get());
        if (lines.size() + count > 16384) { throw std::runtime_error("caption_frame_too_complex"); }
        for (size_t j = 0; j < count; ++j) {
            const float left = OH_Drawing_GetLeftFromTextBox(boxes.get(), int(j)), right = OH_Drawing_GetRightFromTextBox(boxes.get(), int(j));
            if (right <= left) { continue; }
            const float y = OH_Drawing_GetBottomFromTextBox(boxes.get(), int(j)) - font.descent + font.underlinePosition + font.underlineThickness / 2;
            lines.push_back({left + out.halo, right + out.halo, y + out.halo, font.underlineThickness, run.color});
        }
    }
    Own<OH_Drawing_Bitmap, OH_Drawing_BitmapDestroy> bitmap(OH_Drawing_BitmapCreate(), OH_Drawing_BitmapDestroy);
    Own<OH_Drawing_Canvas, OH_Drawing_CanvasDestroy> canvas(OH_Drawing_CanvasCreate(), OH_Drawing_CanvasDestroy);
    if (!bitmap || !canvas) { throw std::bad_alloc(); }
    OH_Drawing_BitmapFormat format{COLOR_FORMAT_RGBA_8888, ALPHA_FORMAT_PREMUL};
    OH_Drawing_BitmapBuild(bitmap.get(), out.width, out.height, &format);
    if (!OH_Drawing_BitmapGetPixels(bitmap.get())) { throw std::bad_alloc(); }
    OH_Drawing_CanvasBind(canvas.get(), bitmap.get()); OH_Drawing_CanvasClear(canvas.get(), 0);
    for (const auto &line : lines) { for (const auto &shadow : request.shadows) { Line(canvas.get(), line, shadow); } }
    OH_Drawing_TypographyPaint(paragraph.text.get(), canvas.get(), out.halo, out.halo);
    for (const auto &line : lines) { Line(canvas.get(), line, {line.color, 0, 0, 0}); }
    OH_Drawing_Image_Info info{}; OH_Drawing_BitmapGetImageInfo(bitmap.get(), &info);
    out.rgba.resize(size_t(out.width) * out.height * 4);
    if (!OH_Drawing_BitmapReadPixels(bitmap.get(), &info, out.rgba.data(), size_t(out.width) * 4, 0, 0)) { throw std::runtime_error("caption_pixels_unavailable"); }
    return out;
}
struct Work { Request request; Frame frame; std::string error; napi_deferred deferred = nullptr; napi_async_work task = nullptr; };
napi_value Error(napi_env env, const char *message) {
    napi_value text, error; napi_create_string_utf8(env, message, NAPI_AUTO_LENGTH, &text); napi_create_error(env, nullptr, text, &error); return error;
}
void Execute(napi_env, void *pointer) {
    auto &work = *static_cast<Work *>(pointer);
    try { work.frame = Rasterize(work.request); }
    catch (const std::bad_alloc &) { work.error = "caption_memory_unavailable"; }
    catch (const std::exception &e) {
        const std::string code = e.what(); work.error = code.rfind("caption_", 0) == 0 ? code : "caption_native_failed";
    } catch (...) { work.error = "caption_native_failed"; }
}
void SetNumber(napi_env env, napi_value object, const char *key, uint32_t value) {
    napi_value field; Check(napi_create_uint32(env, value, &field)); Check(napi_set_named_property(env, object, key, field));
}
void Complete(napi_env env, napi_status status, void *pointer) {
    std::unique_ptr<Work> work(static_cast<Work *>(pointer));
    try {
        if (status != napi_ok) { work->error = "caption_native_cancelled"; }
        if (!work->error.empty()) { napi_reject_deferred(env, work->deferred, Error(env, work->error.c_str())); }
        else {
            napi_value object, bytes; void *destination; Check(napi_create_object(env, &object));
            const auto &f = work->frame; SetNumber(env, object, "width", f.width); SetNumber(env, object, "height", f.height);
            SetNumber(env, object, "layoutWidth", f.layoutWidth); SetNumber(env, object, "layoutHeight", f.layoutHeight); SetNumber(env, object, "halo", f.halo);
            Check(napi_create_arraybuffer(env, f.rgba.size(), &destination, &bytes)); std::memcpy(destination, f.rgba.data(), f.rgba.size());
            Check(napi_set_named_property(env, object, "rgba", bytes)); Check(napi_resolve_deferred(env, work->deferred, object));
        }
    } catch (...) { napi_reject_deferred(env, work->deferred, Error(env, "caption_binding_failed")); }
    napi_delete_async_work(env, work->task);
}
}
napi_value RenderCineIsleCaption(napi_env env, napi_callback_info info) {
    try {
        size_t count = 1; napi_value value; Check(napi_get_cb_info(env, info, &count, &value, nullptr, nullptr));
        if (count != 1) { throw std::invalid_argument("caption_argument_invalid"); }
        auto work = std::make_unique<Work>(); work->request = Read(env, value); napi_value promise, resource;
        Check(napi_create_promise(env, &work->deferred, &promise)); Check(napi_create_string_utf8(env, "CineIsleCaption", NAPI_AUTO_LENGTH, &resource));
        const auto created = napi_create_async_work(env, nullptr, resource, Execute, Complete, work.get(), &work->task);
        if (created != napi_ok || napi_queue_async_work(env, work->task) != napi_ok) {
            if (work->task) { napi_delete_async_work(env, work->task); }
            napi_reject_deferred(env, work->deferred, Error(env, "caption_native_unavailable")); return promise;
        }
        work.release(); return promise;
    } catch (...) { napi_throw_error(env, nullptr, "caption_argument_invalid"); return nullptr; }
}
