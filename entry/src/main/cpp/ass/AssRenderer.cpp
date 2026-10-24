#include "../caption/SubtitleLimits.h"
#include "AssRenderer.h"

#include <ass/ass.h>
#include <algorithm>
#include <cstdarg>
#include <cstdio>
#include <stdexcept>

namespace cineisle {
namespace {
constexpr uint64_t MAX_PIXELS = subtitle_limits::kMaxAssFramePixels;
constexpr size_t MAX_DOCUMENT = subtitle_limits::kMaxAssDocumentUtf8Bytes;
// Library diagnostics can contain subtitle/font names; never forward asset text to app logs.
void IgnoreLibraryLog(int, const char *, va_list, void *) {}

struct Bounds { int64_t left; int64_t top; int64_t right; int64_t bottom; };
Bounds Clip(const ASS_Image &image, uint32_t width, uint32_t height)
{
    return {std::max<int64_t>(0, image.dst_x), std::max<int64_t>(0, image.dst_y),
        std::min<int64_t>(width, int64_t(image.dst_x) + image.w),
        std::min<int64_t>(height, int64_t(image.dst_y) + image.h)};
}
bool Visible(const ASS_Image &image, const Bounds &b)
{
    return image.bitmap && image.w > 0 && image.h > 0 && image.stride >= image.w &&
        (image.color & 255) != 255 && b.left < b.right && b.top < b.bottom;
}
}

std::shared_ptr<AssRenderer> AssRenderer::Create(const std::string &document,
    const std::string &defaultFont, const std::string &defaultFamily, const std::string &configuration)
{
    auto result = std::shared_ptr<AssRenderer>(new AssRenderer());
    result->Initialize(document, defaultFont, defaultFamily, configuration);
    return result;
}

void AssRenderer::Initialize(const std::string &document, const std::string &font,
    const std::string &family, const std::string &configuration)
{
    if (document.empty() || document.size() > MAX_DOCUMENT || document.find('\0') != std::string::npos ||
        font.empty() || font.size() > subtitle_limits::kMaxAssFontPathBytes || font.find('\0') != std::string::npos ||
        family.size() > subtitle_limits::kMaxAssFamilyBytes || family.find('\0') != std::string::npos ||
        configuration.size() > subtitle_limits::kMaxAssConfigPathBytes || configuration.find('\0') != std::string::npos) {
        throw std::invalid_argument("ass_input_invalid");
    }
    FILE *file = std::fopen(font.c_str(), "rb");
    if (!file) { throw std::runtime_error("ass_font_unavailable"); }
    std::fclose(file);
    library_ = ass_library_init();
    if (!library_) { throw std::bad_alloc(); }
    ass_set_message_cb(library_, IgnoreLibraryLog, nullptr);
    renderer_ = ass_renderer_init(library_);
    if (!renderer_) { throw std::bad_alloc(); }
    // Inline ASS fonts share the document bound. The fallback comes from the platform font API.
    ass_set_extract_fonts(library_, 1);
    // libass 0.17.5 still declares a mutable input; never cast away the caller's constness.
    std::string buffer = document;
    track_ = ass_read_memory(library_, buffer.data(), buffer.size(), "UTF-8");
    if (!track_ || !track_->n_events) { throw std::invalid_argument("ass_document_invalid"); }
    if (!configuration.empty()) {
        FILE *config = std::fopen(configuration.c_str(), "rb");
        if (!config) { throw std::runtime_error("ass_font_configuration_unavailable"); }
        std::fclose(config);
    }
    ass_set_fonts(renderer_, font.c_str(), family.c_str(),
        configuration.empty() ? ASS_FONTPROVIDER_NONE : ASS_FONTPROVIDER_FONTCONFIG,
        configuration.empty() ? nullptr : configuration.c_str(), 0);
    ass_set_cache_limits(renderer_, subtitle_limits::kMaxAssGlyphCacheEntries, subtitle_limits::kMaxAssBitmapCacheMiB);
    ass_set_shaper(renderer_, ASS_SHAPING_COMPLEX);
}

AssRenderer::~AssRenderer() { Close(); }
void AssRenderer::Close()
{
    std::lock_guard<std::mutex> guard(mutex_);
    if (track_) { ass_free_track(track_); track_ = nullptr; }
    if (renderer_) { ass_renderer_done(renderer_); renderer_ = nullptr; }
    if (library_) { ass_library_done(library_); library_ = nullptr; }
}

AssFrame AssRenderer::Render(int64_t milliseconds, uint32_t width, uint32_t height,
    uint32_t videoWidth, uint32_t videoHeight)
{
    std::lock_guard<std::mutex> guard(mutex_);
    if (!renderer_ || !track_) { throw std::runtime_error("ass_renderer_closed"); }
    if (milliseconds < 0 || !width || !height || width > subtitle_limits::kMaxAssCanvasDimensionPx || height > subtitle_limits::kMaxAssCanvasDimensionPx ||
        uint64_t(width) * height > MAX_PIXELS || !videoWidth || !videoHeight ||
        videoWidth > subtitle_limits::kMaxVideoDimensionPx || videoHeight > subtitle_limits::kMaxVideoDimensionPx) { throw std::invalid_argument("ass_frame_invalid"); }
    const bool resized = width != width_ || height != height_ || videoWidth != videoWidth_ || videoHeight != videoHeight_;
    if (resized) {
        ass_set_frame_size(renderer_, width, height);
        ass_set_storage_size(renderer_, videoWidth, videoHeight);
        width_ = width; height_ = height; videoWidth_ = videoWidth; videoHeight_ = videoHeight;
    }
    int changed = 0;
    ASS_Image *images = ass_render_frame(renderer_, track_, milliseconds, &changed);
    AssFrame frame;
    frame.changed = resized || changed != 0;
    frame.canvasWidth = width; frame.canvasHeight = height;
    if (!images || !frame.changed) { return frame; }
    Bounds area{width, height, 0, 0};
    size_t count = 0;
    for (ASS_Image *image = images; image; image = image->next) {
        if (++count > subtitle_limits::kMaxAssImages) { throw std::runtime_error("ass_frame_too_complex"); }
        const Bounds clipped = Clip(*image, width, height);
        if (!Visible(*image, clipped)) { continue; }
        area.left = std::min(area.left, clipped.left); area.top = std::min(area.top, clipped.top);
        area.right = std::max(area.right, clipped.right); area.bottom = std::max(area.bottom, clipped.bottom);
    }
    if (area.left >= area.right || area.top >= area.bottom) { return frame; }
    frame.left = uint32_t(area.left); frame.top = uint32_t(area.top);
    frame.width = uint32_t(area.right - area.left); frame.height = uint32_t(area.bottom - area.top);
    frame.pixels.resize(size_t(frame.width) * frame.height * 4);
    for (ASS_Image *image = images; image; image = image->next) {
        const Bounds clipped = Clip(*image, width, height);
        if (!Visible(*image, clipped)) { continue; }
        const uint32_t color[] = {image->color >> 24, (image->color >> 16) & 255, (image->color >> 8) & 255};
        const uint32_t opacity = 255 - (image->color & 255);
        for (int64_t y = clipped.top; y < clipped.bottom; ++y) {
            const auto *source = image->bitmap + size_t(y - image->dst_y) * image->stride;
            auto *destination = frame.pixels.data() + (size_t(y - area.top) * frame.width + size_t(clipped.left - area.left)) * 4;
            for (int64_t x = clipped.left; x < clipped.right; ++x, destination += 4) {
                const uint32_t alpha = (source[x - image->dst_x] * opacity + 127) / 255;
                const uint32_t inverse = 255 - alpha;
                for (size_t c = 0; c < 3; ++c) { destination[c] = uint8_t((color[c] * alpha + destination[c] * inverse + 127) / 255); }
                destination[3] = uint8_t(alpha + (destination[3] * inverse + 127) / 255);
            }
        }
    }
    frame.present = true;
    return frame;
}
}
