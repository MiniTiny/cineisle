#pragma once
#include <cstddef>

// MPV-only bridge and resource boundaries. The ArkTS adapter mirrors only its
// own guards in MpvLimits.ts; both layers retain independent input validation.
namespace cineisle::mpv_limits {
inline constexpr int kMinPlatformApi = 15;
inline constexpr int kMaxApiArgument = 1000;
inline constexpr unsigned kClientApiMajor = 2;
inline constexpr unsigned kMinClientApiMinor = 5;
inline constexpr int kMaxSurfaceDimensionPx = 8192;
inline constexpr std::size_t kMaxSourceUtf8Bytes = 16384;
inline constexpr std::size_t kMaxSurfaceIdUtf8Bytes = 24;
inline constexpr std::size_t kMaxFontConfigPathUtf8Bytes = 4096;
inline constexpr std::size_t kMaxBackendOptionUtf8Bytes = 32;
inline constexpr std::size_t kMaxCommandTypeUtf8Bytes = 32;
inline constexpr double kMinNativeSpeed = 0.25;
inline constexpr double kMaxNativeSpeed = 4;
inline constexpr double kMaxSeekMs = 1e12;
inline constexpr double kSeekConfirmationToleranceMs = 1000;

// These native budgets are not user preferences or global network/cache policy.
inline constexpr unsigned kMaxActiveSessions = 4;
inline constexpr std::size_t kMaxQueuedTasks = 64;
inline constexpr std::size_t kMaxTracks = 256;
inline constexpr int kMaxEventsPerSnapshot = 128;
inline constexpr std::size_t kMaxShortTextUtf8Bytes = 256;
inline constexpr std::size_t kMaxTrackLanguageUtf8Bytes = 63;
inline constexpr std::size_t kMaxTrackCodecUtf8Bytes = 63;
inline constexpr std::size_t kMaxSubtitleTextUtf8Bytes = 16384;
inline constexpr std::size_t kMaxSubtitleAssUtf8Bytes = 32768;
inline constexpr std::size_t kMaxSubtitleEventsUtf8Bytes = 65536;

// libmpv option syntax carries units. Forward and backward caches remain separate
// consumers even though both currently use the fixed Android backend's 32 MiB.
inline constexpr const char *kNetworkTimeoutSeconds = "15";
inline constexpr const char *kDemuxerForwardCache = "32MiB";
inline constexpr const char *kDemuxerBackwardCache = "32MiB";
}
