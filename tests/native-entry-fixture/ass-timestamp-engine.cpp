// Capture the actual dependency call across N-API worker threads. No quota logic.
#define ass_library_init OriginalAssLibraryInit
#define ass_render_frame OriginalAssRenderFrame
#include "ass-engine.cpp"
#undef ass_library_init
#undef ass_render_frame
#include "ass-timestamp-engine.h"
#include <mutex>
namespace {
std::mutex timestampMutex;
bool failLibrary = false;
unsigned libraryFailures = 0;
std::vector<long long> renderTimes;
ASS_Library *LibraryInitBody() {
    if (failLibrary) return nullptr;
    return OriginalAssLibraryInit();
}
}
namespace ass_timestamp_fixture {
void Configure(bool fail) { std::lock_guard<std::mutex> lock(timestampMutex); failLibrary = fail; libraryFailures = 0; renderTimes.clear(); }
std::vector<long long> Times() { std::lock_guard<std::mutex> lock(timestampMutex); return renderTimes; }
unsigned LibraryFailures() { std::lock_guard<std::mutex> lock(timestampMutex); return libraryFailures; }
}
extern "C" {
ASS_Library *ass_library_init(void) {
    std::lock_guard<std::mutex> lock(timestampMutex);
    auto *library = LibraryInitBody();
    if (!library) ++libraryFailures;
    return library;
}
ASS_Image *ass_render_frame(ASS_Renderer *renderer, ASS_Track *track, long long time, int *changed) {
    { std::lock_guard<std::mutex> lock(timestampMutex); renderTimes.push_back(time); }
    return OriginalAssRenderFrame(renderer, track, time, changed);
}
}
