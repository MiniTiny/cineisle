#pragma once
#include <cstddef>
#include <cstdint>

// Fixed native boundary contract. tests/subtitle-limits.test.cjs compiles independent
// golden assertions; ArkTS guards remain in utils/SubtitleLimits.ts where applicable.
namespace cineisle::subtitle_limits {
inline constexpr std::size_t kMaxAssDocumentUtf8Bytes = 4 * 1024 * 1024;
inline constexpr std::size_t kMaxCaptionTextUtf8Bytes = 4 * 1024 * 1024;
inline constexpr uint32_t kMaxAssCanvasDimensionPx = 4096;
inline constexpr uint32_t kMaxVideoDimensionPx = 32768;
inline constexpr uint64_t kMaxAssFramePixels = 1920ULL * 1080ULL;
inline constexpr uint64_t kMaxCaptionFramePixels = 1920ULL * 1080ULL;
inline constexpr std::size_t kMaxAssImages = 100000;
inline constexpr int kMaxAssGlyphCacheEntries = 1000;
inline constexpr int kMaxAssBitmapCacheMiB = 16;
inline constexpr std::size_t kMaxAssFontPathBytes = 4096;
inline constexpr std::size_t kMaxAssFamilyBytes = 512;
inline constexpr std::size_t kMaxAssConfigPathBytes = 4096;
inline constexpr uint32_t kMaxCaptionRuns = 4096;
inline constexpr uint32_t kMaxCaptionLines = 1000;
inline constexpr uint32_t kMaxCaptionLayoutWidthPx = 8192;
inline constexpr uint32_t kMaxCaptionFontSizePx = 8192;
inline constexpr uint32_t kMaxCaptionFrameHeightPx = 32768;
inline constexpr std::size_t kMaxCaptionLineBoxes = 16384;
inline constexpr std::size_t kMaxCaptionFamilyBytes = 128;
inline constexpr uint32_t kMaxCaptionShadows = 4;
inline constexpr double kMaxCaptionBaselineOffsetPx = 1000000;
inline constexpr double kMaxShadowOffsetPx = 128;
inline constexpr double kMaxShadowRadiusPx = 128;
}
