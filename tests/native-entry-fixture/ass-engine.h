#pragma once
#include <ass/ass.h>
#include <cstddef>
#include <vector>

// Controls/observations for direct, same-thread core tests. No production budget logic.
namespace ass_fixture {
struct CacheCall { ASS_Renderer *renderer; int glyphEntries; int bitmapMiB; };
void SetImageCount(std::size_t count);
std::size_t RenderCalls();
void ResetCacheCalls();
const std::vector<CacheCall> &CacheCalls();
}
