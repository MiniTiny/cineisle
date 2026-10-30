#include "SubtitleLimits.h"
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
#include <native_drawing/drawing_rect.h>
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
namespace limits = cineisle::subtitle_limits;
constexpr double kMinCaptionFontSizePx = 0.01;
constexpr size_t MAX_TEXT = limits::kMaxCaptionTextUtf8Bytes;
constexpr uint64_t MAX_PIXELS = limits::kMaxCaptionFramePixels;
template<class T, void (*D)(T*)> using Own = std::unique_ptr<T, decltype(D)>;
struct Run {
    std::string text, family;
    size_t units = 0;
    double size = 20, baseline = 0;
    uint32_t color = 0xFFFFFFFF, background = 0;
    bool bold = false, italic = false, underline = false, strike = false;
};
struct Shadow { uint32_t color; double x, y, radius; };
enum class ParagraphKind { Start, Center, End, Bullet, Quote };
struct ParagraphDirective { uint32_t start, end; ParagraphKind kind; };
struct Request {
    double width = 1; uint32_t lines = limits::kMaxCaptionLines; bool intrinsic = false;
    std::vector<Run> runs; std::vector<Shadow> shadows;
    std::vector<ParagraphDirective> paragraphs; std::u16string paragraphText;
    double paragraphSize = 0; uint32_t paragraphColor = 0;
    // Internal layout choices; absent paragraph metadata keeps the original centered path.
    int alignment = TEXT_ALIGN_CENTER, direction = -1;
};
struct Frame { uint32_t width = 0, height = 0, layoutWidth = 0, layoutHeight = 0, halo = 0; std::vector<uint8_t> rgba; };
void Check(napi_status status) { if (status != napi_ok) { throw std::invalid_argument("caption_argument_invalid"); } }
napi_value Field(napi_env env, napi_value object, const char *key) {
    napi_value result; Check(napi_get_named_property(env, object, key, &result)); return result;
}
void RequireObject(napi_env env, napi_value value) {
    napi_valuetype type; Check(napi_typeof(env, value, &type));
    napi_value nil; Check(napi_get_null(env, &nil)); bool isNull;
    Check(napi_strict_equals(env, value, nil, &isNull));
    if (type != napi_object || isNull) { throw std::invalid_argument("caption_argument_invalid"); }
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
    Request out; out.width = Number(env, Field(env, value, "width"), 1, limits::kMaxCaptionLayoutWidthPx);
    out.lines = Integer(env, Field(env, value, "maxLines"), 1, limits::kMaxCaptionLines);
    out.intrinsic = Boolean(env, Field(env, value, "intrinsic"));
    bool hasParagraphs; Check(napi_has_named_property(env, value, "paragraphs", &hasParagraphs));
    napi_value paragraphArray = nullptr; uint32_t paragraphCount = 0;
    if (hasParagraphs) {
        paragraphArray = Field(env, value, "paragraphs"); bool array;
        Check(napi_is_array(env, paragraphArray, &array));
        if (!array) { throw std::invalid_argument("caption_paragraphs_invalid"); }
        Check(napi_get_array_length(env, paragraphArray, &paragraphCount));
        if (paragraphCount > limits::kMaxCaptionParagraphSpans) { throw std::invalid_argument("caption_paragraphs_invalid"); }
    }
    auto array = Field(env, value, "runs"); bool isArray; Check(napi_is_array(env, array, &isArray));
    uint32_t count; Check(napi_get_array_length(env, array, &count));
    if (!isArray || !count || count > limits::kMaxCaptionRuns) { throw std::invalid_argument("caption_runs_invalid"); }
    size_t bytes = 0;
    for (uint32_t i = 0; i < count; ++i) {
        napi_value entry; Check(napi_get_element(env, array, i, &entry)); Run run;
        const auto text = Field(env, entry, "text");
        run.text = String(env, text, MAX_TEXT, &run.units); bytes += run.text.size();
        if (bytes > MAX_TEXT) { throw std::invalid_argument("caption_text_too_large"); }
        if (paragraphCount) {
            std::vector<char16_t> units(run.units + 1); size_t length;
            Check(napi_get_value_string_utf16(env, text, units.data(), units.size(), &length));
            out.paragraphText.append(units.data(), length);
        }
        run.family = String(env, Field(env, entry, "family"), limits::kMaxCaptionFamilyBytes);
        run.size = Number(env, Field(env, entry, "size"), kMinCaptionFontSizePx, limits::kMaxCaptionFontSizePx);
        run.baseline = Number(env, Field(env, entry, "baseline"), -limits::kMaxCaptionBaselineOffsetPx, limits::kMaxCaptionBaselineOffsetPx);
        run.color = Integer(env, Field(env, entry, "color"), 0, UINT32_MAX);
        bool hasBackground; Check(napi_has_named_property(env, entry, "background", &hasBackground));
        if (hasBackground) { run.background = Integer(env, Field(env, entry, "background"), 0, UINT32_MAX); }
        run.bold = Boolean(env, Field(env, entry, "bold")); run.italic = Boolean(env, Field(env, entry, "italic"));
        run.underline = Boolean(env, Field(env, entry, "underline")); run.strike = Boolean(env, Field(env, entry, "strike"));
        out.runs.push_back(std::move(run));
    }
    if (!bytes) { throw std::invalid_argument("caption_text_empty"); }
    if (paragraphCount) {
        const auto style = Field(env, value, "paragraphStyle");
        RequireObject(env, style);
        out.paragraphSize = Number(env, Field(env, style, "size"), kMinCaptionFontSizePx, limits::kMaxCaptionFontSizePx);
        out.paragraphColor = Integer(env, Field(env, style, "color"), 0, UINT32_MAX);
        for (uint32_t i = 0; i < paragraphCount; ++i) {
            napi_value span; Check(napi_get_element(env, paragraphArray, i, &span));
            RequireObject(env, span);
            const auto start = Integer(env, Field(env, span, "start"), 0, uint32_t(out.paragraphText.size()));
            const auto end = Integer(env, Field(env, span, "end"), 0, uint32_t(out.paragraphText.size()));
            if (end <= start || (start && out.paragraphText[start - 1] != u'\n') ||
                (end < out.paragraphText.size() && out.paragraphText[end - 1] != u'\n')) {
                throw std::invalid_argument("caption_paragraph_range_invalid");
            }
            const auto kind = String(env, Field(env, span, "kind"), 6); ParagraphKind parsed;
            if (kind == "start") { parsed = ParagraphKind::Start; }
            else if (kind == "center") { parsed = ParagraphKind::Center; }
            else if (kind == "end") { parsed = ParagraphKind::End; }
            else if (kind == "bullet") { parsed = ParagraphKind::Bullet; }
            else if (kind == "quote") { parsed = ParagraphKind::Quote; }
            else { throw std::invalid_argument("caption_paragraph_kind_invalid"); }
            out.paragraphs.push_back({start, end, parsed});
        }
    }
    array = Field(env, value, "shadows"); Check(napi_is_array(env, array, &isArray)); Check(napi_get_array_length(env, array, &count));
    if (!isArray || count > limits::kMaxCaptionShadows) { throw std::invalid_argument("caption_shadows_invalid"); }
    for (uint32_t i = 0; i < count; ++i) {
        napi_value entry; Check(napi_get_element(env, array, i, &entry));
        out.shadows.push_back({Integer(env, Field(env, entry, "color"), 0, UINT32_MAX),
            Number(env, Field(env, entry, "x"), -limits::kMaxShadowOffsetPx, limits::kMaxShadowOffsetPx), Number(env, Field(env, entry, "y"), -limits::kMaxShadowOffsetPx, limits::kMaxShadowOffsetPx),
            Number(env, Field(env, entry, "radius"), 0, limits::kMaxShadowRadiusPx)});
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
        OH_Drawing_SetTypographyTextAlign(style.get(), request.alignment);
        OH_Drawing_SetTypographyTextDirection(style.get(), request.direction < 0 ? Direction(request) : request.direction);
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
// Android API34 BulletSpan/QuoteSpan defaults are physical pixels, independent of font size.
constexpr double kBulletRadiusPx = 4, kBulletGapPx = 2;
constexpr double kQuoteStripePx = 2, kQuoteGapPx = 2;
constexpr uint32_t kQuoteColor = 0xFF0000FF;
constexpr double kCuePaddingFraction = 0.125; // Media3 1.2.1 SubtitlePainter.
size_t Utf16Units(const std::string &text, size_t start, size_t end) {
    size_t units = 0;
    for (size_t i = start; i < end; ++i) {
        const auto byte = static_cast<unsigned char>(text[i]);
        if ((byte & 0xC0) != 0x80) { units += byte >= 0xF0 ? 2 : 1; }
    }
    return units;
}
Request Fragment(const Request &source) {
    Request out; out.width = source.width; out.lines = source.lines; out.shadows = source.shadows;
    return out;
}
Run RunStyle(const Run &source) {
    Run out; out.family = source.family; out.size = source.size; out.baseline = source.baseline;
    out.color = source.color; out.background = source.background;
    out.bold = source.bold; out.italic = source.italic; out.underline = source.underline; out.strike = source.strike;
    return out;
}
struct ParagraphPart {
    Request request;
    size_t start = 0, run = 0, byte = 0;
    double margin = 0, x = 0, y = 0, height = 0;
    std::vector<ParagraphDirective> markers;
    std::unique_ptr<Paragraph> owner;
};
std::vector<ParagraphPart> SplitParagraphs(const Request &source) {
    std::vector<ParagraphPart> parts;
    ParagraphPart current; current.request = Fragment(source);
    size_t position = 0;
    Run lastNewline;
    // One forward pass over UTF8. At most maxLines logical paragraphs can be visible.
    for (size_t i = 0; i < source.runs.size(); ++i) {
        const auto &run = source.runs[i]; size_t start = 0;
        while (start < run.text.size()) {
            if (current.request.runs.empty()) { current.run = i; current.byte = start; current.start = position; }
            const auto newline = run.text.find('\n', start);
            const size_t end = newline == std::string::npos ? run.text.size() : newline + 1;
            Run slice = RunStyle(run); slice.text = run.text.substr(start, end - start); slice.units = Utf16Units(run.text, start, end);
            position += slice.units; current.request.runs.push_back(std::move(slice)); start = end;
            if (newline != std::string::npos) {
                lastNewline = RunStyle(run); lastNewline.text = "\n"; lastNewline.units = 1;
                parts.push_back(std::move(current));
                if (parts.size() == source.lines) { return parts; }
                current = ParagraphPart{}; current.request = Fragment(source); current.start = position;
            }
        }
    }
    if (current.request.runs.empty()) {
        // Raw empty typography ignores the requested font. A styled newline with a one-line
        // cap retains the actual blank paragraph's metrics without painting a placeholder.
        current.request.runs.push_back(std::move(lastNewline));
        current.run = source.runs.size(); current.byte = 0;
    }
    parts.push_back(std::move(current));
    return parts;
}
Request ParagraphTail(const Request &source, const ParagraphPart &part) {
    Request out = Fragment(source);
    for (size_t i = part.run; i < source.runs.size(); ++i) {
        Run run = source.runs[i];
        if (i == part.run) { run.text = run.text.substr(part.byte); run.units = Utf16Units(run.text, 0, run.text.size()); }
        if (!run.text.empty()) { out.runs.push_back(std::move(run)); }
    }
    return out;
}
OH_Drawing_LineMetrics ParagraphLine(Paragraph &paragraph, size_t index) {
    OH_Drawing_LineMetrics line{};
    if (!OH_Drawing_TypographyGetLineMetricsAt(paragraph.text.get(), int(index), &line) ||
        !std::isfinite(line.width) || !std::isfinite(line.height) || !std::isfinite(line.y) || line.height < 0) {
        throw std::runtime_error("caption_layout_failed");
    }
    return line;
}
bool TerminalParagraphRow(const OH_Drawing_LineMetrics &line, size_t units) {
    return line.width == 0 && line.endIndex == units && (line.startIndex == units || (units && line.startIndex == units - 1));
}
size_t BodyLines(Paragraph &paragraph, const Request &request) {
    size_t count = OH_Drawing_TypographyGetLineCount(paragraph.text.get());
    size_t units = 0; for (const auto &run : request.runs) { units += run.units; }
    if (count > 1 && !request.runs.empty() && !request.runs.back().text.empty() && request.runs.back().text.back() == '\n') {
        const auto last = ParagraphLine(paragraph, count - 1);
        // API26 reports the terminal empty row over the final newline itself, rather than
        // the following UTF16 position. Both forms identify the same unpainted extra row.
        if (TerminalParagraphRow(last, units)) { --count; }
    }
    return std::max<size_t>(1, count);
}
void ConfigureParagraph(const Request &source, ParagraphPart &part) {
    for (const auto &span : source.paragraphs) {
        if (span.start > part.start || span.end <= part.start) { continue; }
        switch (span.kind) {
            case ParagraphKind::Start: part.request.alignment = TEXT_ALIGN_START; break;
            case ParagraphKind::Center: part.request.alignment = TEXT_ALIGN_CENTER; break;
            case ParagraphKind::End: part.request.alignment = TEXT_ALIGN_END; break;
            case ParagraphKind::Bullet:
                part.margin += kBulletRadiusPx * 2 + kBulletGapPx; part.markers.push_back(span); break;
            case ParagraphKind::Quote:
                part.margin += kQuoteStripePx + kQuoteGapPx; part.markers.push_back(span); break;
        }
    }
    if (part.margin >= source.width) { throw std::runtime_error("caption_frame_too_large"); }
    part.request.direction = Direction(part.request);
}
struct ParagraphMarker { bool bullet; double x, top, bottom; uint32_t color; };
void PaintMarker(OH_Drawing_Canvas *canvas, const ParagraphMarker &marker, const Shadow &shadow) {
    Own<OH_Drawing_Brush, OH_Drawing_BrushDestroy> brush(OH_Drawing_BrushCreate(), OH_Drawing_BrushDestroy);
    if (!brush) { throw std::bad_alloc(); }
    OH_Drawing_BrushSetAntiAlias(brush.get(), true); OH_Drawing_BrushSetColor(brush.get(), shadow.color);
    Own<OH_Drawing_Filter, OH_Drawing_FilterDestroy> filter(nullptr, OH_Drawing_FilterDestroy);
    Own<OH_Drawing_MaskFilter, OH_Drawing_MaskFilterDestroy> mask(nullptr, OH_Drawing_MaskFilterDestroy);
    if (shadow.radius > 0) {
        filter.reset(OH_Drawing_FilterCreate()); mask.reset(OH_Drawing_MaskFilterCreateBlur(NORMAL, shadow.radius, true));
        if (!filter || !mask) { throw std::bad_alloc(); }
        OH_Drawing_FilterSetMaskFilter(filter.get(), mask.get()); OH_Drawing_BrushSetFilter(brush.get(), filter.get());
    }
    if (marker.bullet) {
        Own<OH_Drawing_Point, OH_Drawing_PointDestroy> point(
            OH_Drawing_PointCreate(marker.x + shadow.x, (marker.top + marker.bottom) / 2 + shadow.y), OH_Drawing_PointDestroy);
        if (!point) { throw std::bad_alloc(); }
        OH_Drawing_CanvasAttachBrush(canvas, brush.get());
        OH_Drawing_CanvasDrawCircle(canvas, point.get(), kBulletRadiusPx);
    } else {
        Own<OH_Drawing_Rect, OH_Drawing_RectDestroy> rect(OH_Drawing_RectCreate(marker.x + shadow.x,
            marker.top + shadow.y, marker.x + kQuoteStripePx + shadow.x, marker.bottom + shadow.y), OH_Drawing_RectDestroy);
        if (!rect) { throw std::bad_alloc(); }
        OH_Drawing_CanvasAttachBrush(canvas, brush.get()); OH_Drawing_CanvasDrawRect(canvas, rect.get());
    }
    OH_Drawing_CanvasDetachBrush(canvas);
}
Frame RasterizeParagraphs(const Request &request, int orientation) {
    auto parts = SplitParagraphs(request);
    const double padding = std::floor(request.paragraphSize * kCuePaddingFraction + 0.5);
    double blockWidth = 1;
    for (auto &part : parts) {
        ConfigureParagraph(request, part);
        part.request.width = std::max(1.0, request.width - padding * 2 - part.margin);
        part.request.lines = request.lines + 1;
        Paragraph probe(part.request, orientation, false);
        const double longest = OH_Drawing_TypographyGetLongestLine(probe.text.get());
        if (!std::isfinite(longest) || longest < 0) { throw std::runtime_error("caption_layout_failed"); }
        blockWidth = std::max(blockWidth, std::ceil(longest) + part.margin + padding * 2);
    }
    blockWidth = std::min(request.width, blockWidth);
    const double width = request.intrinsic ? blockWidth : request.width;
    const double blockLeft = (width - blockWidth) / 2;
    size_t remaining = request.lines, painted = 0;
    double height = 0;
    const size_t visibleEnd = request.paragraphText.find_last_not_of(u'\n') == std::u16string::npos ? 0 :
        request.paragraphText.find_last_not_of(u'\n') + 1;
    for (auto &part : parts) {
        part.request.width = std::max(1.0, blockWidth - part.margin); part.request.lines = uint32_t(remaining + 1);
        part.owner = std::make_unique<Paragraph>(part.request, orientation, false);
        const size_t body = BodyLines(*part.owner, part.request);
        const size_t used = std::min(remaining, body);
        size_t units = 0; for (const auto &run : part.request.runs) { units += run.units; }
        const bool overflow = body > remaining || (used == remaining && part.start + units < visibleEnd);
        if (overflow) {
            auto tail = ParagraphTail(request, part); tail.width = part.request.width; tail.lines = uint32_t(used);
            tail.alignment = part.request.alignment; tail.direction = part.request.direction;
            part.request = std::move(tail); part.owner = std::make_unique<Paragraph>(part.request, orientation);
            KeepVisibleTail(part.request, orientation, part.request.width, part.owner);
        } else {
            part.request.lines = uint32_t(used); part.owner = std::make_unique<Paragraph>(part.request, orientation, false);
        }
        part.x = blockLeft + (part.request.direction == TEXT_DIRECTION_RTL ? 0 : part.margin); part.y = height;
        part.height = std::ceil(OH_Drawing_TypographyGetHeight(part.owner->text.get()));
        if (!std::isfinite(part.height) || part.height < 1) { throw std::runtime_error("caption_layout_failed"); }
        height += part.height;
        if (height > limits::kMaxCaptionFrameHeightPx) { throw std::runtime_error("caption_frame_too_large"); }
        ++painted; remaining -= used; if (!remaining) { break; }
    }
    parts.resize(painted);
    double halo = 2;
    for (const auto &shadow : request.shadows) { halo = std::max(halo, std::ceil(shadow.radius * 3 + std::max(std::abs(shadow.x), std::abs(shadow.y))) + 2); }
    Frame out; out.layoutWidth = uint32_t(std::ceil(width)); out.layoutHeight = uint32_t(height); out.halo = uint32_t(halo);
    out.width = out.layoutWidth + out.halo * 2; out.height = out.layoutHeight + out.halo * 2;
    if (uint64_t(out.width) * out.height > MAX_PIXELS) { throw std::runtime_error("caption_frame_too_large"); }
    std::vector<Underline> lines; std::vector<ParagraphMarker> markers;
    std::map<std::tuple<std::string, double, bool, bool>, OH_Drawing_Font_Metrics> metrics;
    for (auto &part : parts) {
        auto &paragraph = *part.owner;
        for (size_t i = 0; i < part.request.runs.size(); ++i) {
            const auto &run = part.request.runs[i]; if (!run.underline || !run.units) { continue; }
            const auto key = std::make_tuple(run.family, run.size, run.bold, run.italic);
            auto found = metrics.find(key); if (found == metrics.end()) { found = metrics.emplace(key, FontMetrics(run)).first; }
            const auto &font = found->second; auto boxes = Boxes(paragraph, paragraph.starts[i], paragraph.ends[i]);
            const auto count = OH_Drawing_GetSizeOfTextBox(boxes.get());
            if (lines.size() + markers.size() + count > limits::kMaxCaptionLineBoxes) { throw std::runtime_error("caption_frame_too_complex"); }
            for (size_t j = 0; j < count; ++j) {
                const float left = OH_Drawing_GetLeftFromTextBox(boxes.get(), int(j)), right = OH_Drawing_GetRightFromTextBox(boxes.get(), int(j));
                if (right <= left) { continue; }
                const float y = OH_Drawing_GetBottomFromTextBox(boxes.get(), int(j)) - font.descent + font.underlinePosition + font.underlineThickness / 2;
                lines.push_back({float(left + part.x + out.halo), float(right + part.x + out.halo), float(y + part.y + out.halo), font.underlineThickness, run.color});
            }
        }
        double margin = 0;
        const bool rtl = part.request.direction == TEXT_DIRECTION_RTL;
        for (const auto &span : part.markers) {
            const bool bullet = span.kind == ParagraphKind::Bullet;
            const double extent = bullet ? kBulletRadiusPx * 2 + kBulletGapPx : kQuoteStripePx + kQuoteGapPx;
            const auto count = OH_Drawing_TypographyGetLineCount(paragraph.text.get());
            for (size_t i = 0; i < count; ++i) {
                if (bullet && (i || span.start != part.start)) { continue; }
                if (lines.size() + markers.size() >= limits::kMaxCaptionLineBoxes) { throw std::runtime_error("caption_frame_too_complex"); }
                const auto line = ParagraphLine(paragraph, i);
                double x = rtl ? blockLeft + blockWidth - margin : blockLeft + margin;
                x += bullet ? (rtl ? -kBulletRadiusPx : kBulletRadiusPx) : (rtl ? -kQuoteStripePx : 0);
                markers.push_back({bullet, x + out.halo, part.y + line.y + out.halo,
                    part.y + line.y + line.height + out.halo, bullet ? request.paragraphColor : kQuoteColor});
            }
            margin += extent;
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
    for (const auto &marker : markers) {
        for (const auto &shadow : request.shadows) { PaintMarker(canvas.get(), marker, shadow); }
        PaintMarker(canvas.get(), marker, {marker.color, 0, 0, 0});
    }
    for (const auto &part : parts) { OH_Drawing_TypographyPaint(part.owner->text.get(), canvas.get(), part.x + out.halo, part.y + out.halo); }
    for (const auto &line : lines) { Line(canvas.get(), line, {line.color, 0, 0, 0}); }
    OH_Drawing_Image_Info info{}; OH_Drawing_BitmapGetImageInfo(bitmap.get(), &info);
    out.rgba.resize(size_t(out.width) * out.height * 4);
    if (!OH_Drawing_BitmapReadPixels(bitmap.get(), &info, out.rgba.data(), size_t(out.width) * 4, 0, 0)) { throw std::runtime_error("caption_pixels_unavailable"); }
    return out;
}
Frame Rasterize(const Request &request) {
    const int orientation = Orientation();
    if (!request.paragraphs.empty()) { return RasterizeParagraphs(request, orientation); }
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
    if (!std::isfinite(height) || height < 1 || height > limits::kMaxCaptionFrameHeightPx) { throw std::runtime_error("caption_frame_too_large"); }
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
        if (lines.size() + count > limits::kMaxCaptionLineBoxes) { throw std::runtime_error("caption_frame_too_complex"); }
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
