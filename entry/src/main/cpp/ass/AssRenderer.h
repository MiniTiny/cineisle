#pragma once

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

struct ass_library;
struct ass_renderer;
struct ass_track;

namespace cineisle {

// Premultiplied RGBA, cropped to the union of visible libass images.
// When changed is false, pixels are omitted and the caller retains its previous image.
struct AssFrame {
    bool changed = false;
    bool present = false;
    uint32_t canvasWidth = 0;
    uint32_t canvasHeight = 0;
    uint32_t left = 0;
    uint32_t top = 0;
    uint32_t width = 0;
    uint32_t height = 0;
    std::vector<uint8_t> pixels;
};

class AssRenderer final {
public:
    static std::shared_ptr<AssRenderer> Create(const std::string &document,
        const std::string &defaultFont, const std::string &defaultFamily,
        const std::string &fontConfiguration = "");
    ~AssRenderer();
    AssFrame Render(int64_t milliseconds, uint32_t width, uint32_t height,
        uint32_t videoWidth, uint32_t videoHeight);
    void Close();
    AssRenderer(const AssRenderer &) = delete;
    AssRenderer &operator=(const AssRenderer &) = delete;

private:
    AssRenderer() = default;
    void Initialize(const std::string &, const std::string &, const std::string &, const std::string &);
    std::mutex mutex_;
    ass_library *library_ = nullptr;
    ass_renderer *renderer_ = nullptr;
    ass_track *track_ = nullptr;
    uint32_t width_ = 0;
    uint32_t height_ = 0;
    uint32_t videoWidth_ = 0;
    uint32_t videoHeight_ = 0;
};

}
