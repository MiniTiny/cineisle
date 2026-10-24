// Explicit libass fixture. Production N-API and AssRenderer input/geometry checks remain real.
// Default: no images. Direct core tests may supply an invisible image chain and observe cache calls.
// This fixture cannot prove libass parsing, fonts, cache eviction or rendering.
#include "ass-engine.h"
#include <cstdarg>
struct ass_library {};
struct ass_renderer {};
namespace {
// N-API workers retain independent default fixtures; the standalone core controls its own thread.
thread_local std::vector<ASS_Image> images;
thread_local std::vector<ass_fixture::CacheCall> cacheCalls;
thread_local std::size_t renderCalls = 0;
}
namespace ass_fixture {
void SetImageCount(std::size_t count)
{
    images.assign(count, ASS_Image{});
    for (std::size_t i = 1; i < images.size(); ++i) { images[i - 1].next = &images[i]; }
}
std::size_t RenderCalls() { return renderCalls; }
void ResetCacheCalls() { cacheCalls.clear(); }
const std::vector<CacheCall> &CacheCalls() { return cacheCalls; }
}
extern "C" {
ASS_Library *ass_library_init(void) { return new ass_library; }
void ass_library_done(ASS_Library *value) { delete value; }
ASS_Renderer *ass_renderer_init(ASS_Library *) { return new ass_renderer; }
void ass_renderer_done(ASS_Renderer *value) { delete value; }
void ass_set_message_cb(ASS_Library *, void (*)(int, const char *, va_list, void *), void *) {}
void ass_set_extract_fonts(ASS_Library *, int) {}
ASS_Track *ass_read_memory(ASS_Library *, char *, size_t, const char *)
{
    auto *value = new ASS_Track{};
    value->n_events = 1;
    return value;
}
void ass_free_track(ASS_Track *value) { delete value; }
void ass_set_fonts(ASS_Renderer *, const char *, const char *, int, const char *, int) {}
void ass_set_cache_limits(ASS_Renderer *renderer, int glyphEntries, int bitmapMiB)
{
    cacheCalls.push_back({renderer, glyphEntries, bitmapMiB});
}
void ass_set_shaper(ASS_Renderer *, ASS_ShapingLevel) {}
void ass_set_frame_size(ASS_Renderer *, int, int) {}
void ass_set_storage_size(ASS_Renderer *, int, int) {}
ASS_Image *ass_render_frame(ASS_Renderer *, ASS_Track *, long long, int *changed)
{
    ++renderCalls;
    *changed = 1;
    return images.empty() ? nullptr : images.data();
}
}
