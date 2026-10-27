// Reuse the ordinary external libass fixture; only the two selected calls can fail.
#include <ass/ass.h>
#define ass_library_init FixtureLibraryInit
#define ass_render_frame FixtureRenderFrame
#include "ass-engine.cpp"
#undef ass_library_init
#undef ass_render_frame
#include "ass-errors.h"
#include <mutex>
#include <stdexcept>

namespace {
std::mutex errorMutex;
std::string errorPhase, errorMessage;
bool initializeFailure = false;
ass_error_fixture::Inspection inspection{};
ASS_Library *LibraryInitBody() {
    if (initializeFailure) return nullptr;
    if (errorPhase == "async-create") throw std::runtime_error(errorMessage);
    return FixtureLibraryInit();
}
}
namespace ass_error_fixture {
void Configure(const std::string &phase, const std::string &message, bool failInitialize) {
    std::lock_guard<std::mutex> guard(errorMutex);
    errorPhase = phase; errorMessage = message; initializeFailure = failInitialize; inspection = {};
}
Inspection Inspect() { std::lock_guard<std::mutex> guard(errorMutex); return inspection; }
}
extern "C" {
ASS_Library *ass_library_init(void) {
    std::lock_guard<std::mutex> guard(errorMutex); ++inspection.creates;
    auto *library = LibraryInitBody();
    if (!library) ++inspection.libraryFailures;
    return library;
}
ASS_Image *ass_render_frame(ASS_Renderer *renderer, ASS_Track *track, long long time, int *changed) {
    std::lock_guard<std::mutex> guard(errorMutex); ++inspection.renders;
    if (errorPhase == "async-render") throw std::runtime_error(errorMessage);
    return FixtureRenderFrame(renderer, track, time, changed);
}
}
