// Call the real public C++ renderer API directly, without the outer N-API guards.
#include "../../entry/src/main/cpp/ass/AssRenderer.h"
#include "ass-engine.h"
#include <array>
#include <cstdio>
#include <functional>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>

namespace {
int count = 0;
void Expect(const std::string &name, const std::string &error, const std::function<void()> &operation)
{
    std::string actual;
    try { operation(); } catch (const std::exception &e) { actual = e.what(); }
    if (actual != error) { throw std::runtime_error(name + ": expected " + error + ", got " + actual); }
    ++count; std::cout << "PASS " << name << '\n';
}
std::string Utf8(size_t bytes)
{
    std::string result, chunk = "中😀";
    while (result.size() + chunk.size() <= bytes) { result += chunk; }
    result.append(bytes - result.size(), 'x'); return result;
}
}
int main(int argc, char **argv)
{
    try {
        if (argc != 2) { throw std::runtime_error("a fixture font path is required"); }
        const std::string font = argv[1];
        using cineisle::AssRenderer;
        for (size_t size : {4194303, 4194304, 4194305}) {
            Expect("core document bytes " + std::to_string(size), size > 4194304 ? "ass_input_invalid" : "", [&] {
                AssRenderer::Create(Utf8(size), font, "");
            });
        }
        for (size_t field = 0; field < 3; ++field) {
            const size_t maximum = field == 1 ? 512 : 4096;
            for (size_t size : {maximum - 1, maximum, maximum + 1}) {
                Expect("core string field " + std::to_string(field) + " bytes " + std::to_string(size),
                    size > maximum ? "ass_input_invalid" : field == 0 ? "ass_font_unavailable" : field == 2 ? "ass_font_configuration_unavailable" : "", [&] {
                        auto value = Utf8(size);
                        AssRenderer::Create("doc", field == 0 ? value : font, field == 1 ? value : "", field == 2 ? value : "");
                    });
            }
        }
        for (size_t field = 0; field < 4; ++field) {
            Expect("core embedded NUL field " + std::to_string(field), "ass_input_invalid", [&] {
                const std::string value("a\0b", 3);
                AssRenderer::Create(field == 0 ? value : "doc", field == 1 ? value : font,
                    field == 2 ? value : "", field == 3 ? value : "");
            });
        }
        Expect("core empty document", "ass_input_invalid", [&] { AssRenderer::Create("", font, ""); });
        Expect("core empty font", "ass_input_invalid", [&] { AssRenderer::Create("doc", "", ""); });
        auto renderer = AssRenderer::Create("doc", font, "");
        for (size_t axis = 0; axis < 4; ++axis) {
            const uint32_t maximum = axis < 2 ? 4096 : 32768;
            for (uint32_t value : {uint32_t(0), maximum - 1, maximum, maximum + 1, UINT32_MAX}) {
                Expect("core axis " + std::to_string(axis) + " value " + std::to_string(value),
                    !value || value > maximum ? "ass_frame_invalid" : "", [&] {
                        std::array<uint32_t, 4> dimensions{1, 1, 1, 1}; dimensions[axis] = value;
                        auto frame = renderer->Render(0, dimensions[0], dimensions[1], dimensions[2], dimensions[3]);
                        if (frame.canvasWidth != dimensions[0] || frame.canvasHeight != dimensions[1]) { throw std::runtime_error("core frame dimensions changed"); }
                    });
            }
        }
        for (uint32_t height : {1079, 1080, 1081}) {
            Expect("core pixel budget height " + std::to_string(height), height > 1080 ? "ass_frame_invalid" : "", [&] {
                renderer->Render(0, 1920, height, 1, 1);
            });
        }
        Expect("core negative clock", "ass_frame_invalid", [&] { renderer->Render(-1, 1, 1, 1, 1); });
        for (size_t images : {99999, 100000, 100001}) {
            ass_fixture::SetImageCount(images);
            const auto before = ass_fixture::RenderCalls();
            Expect("core image chain " + std::to_string(images), images > 100000 ? "ass_frame_too_complex" : "", [&] {
                const auto frame = renderer->Render(0, 1, 1, 1, 1);
                if (!frame.changed || frame.present || !frame.pixels.empty() || frame.canvasWidth != 1 || frame.canvasHeight != 1) {
                    throw std::runtime_error("invisible image chain changed the empty frame contract");
                }
            });
            if (ass_fixture::RenderCalls() != before + 1) { throw std::runtime_error("core image chain did not reach libass"); }
        }
        ass_fixture::SetImageCount(0);
        Expect("core cache quotas applied once to each renderer", "", [&] {
            ass_fixture::ResetCacheCalls();
            auto first = AssRenderer::Create("doc", font, "");
            auto second = AssRenderer::Create("doc", font, "");
            const auto &calls = ass_fixture::CacheCalls();
            if (calls.size() != 2 || !calls[0].renderer || !calls[1].renderer || calls[0].renderer == calls[1].renderer) {
                throw std::runtime_error("core cache call count or renderer identity changed");
            }
            for (const auto &call : calls) {
                if (call.glyphEntries != 1000 || call.bitmapMiB != 16) {
                    throw std::runtime_error("core cache quota changed: glyphs=" + std::to_string(call.glyphEntries) +
                        ", bitmapMiB=" + std::to_string(call.bitmapMiB));
                }
            }
            first->Render(0, 1, 1, 1, 1); second->Render(0, 1, 1, 1, 1);
            first->Close(); second->Close();
            if (calls.size() != 2) { throw std::runtime_error("core cache quotas reapplied during render/close"); }
        });
        renderer->Close();
        Expect("core closed renderer", "ass_renderer_closed", [&] { renderer->Render(0, 1, 1, 1, 1); });
        std::cout << count << " native ASS core tests passed. Production core API with explicit libass fixture; no rendering claim.\n";
        return 0;
    } catch (const std::exception &error) { std::cerr << error.what() << '\n'; return 1; }
}
