#pragma once
#include <map>
#include <string>
#include <utility>
#include <vector>

// Controlled libmpv dependency, not a replacement for Session or N-API validation.
namespace mpv_fixture {
struct Configuration {
    unsigned version = (2U << 16) | 5;
    int trackCount = 0, firstTrackId = 1, events = 0;
    double positionSeconds = 0;
    std::vector<int> eventIds;
    bool failInitialize = false, failInitializeOnce = false, failProperty = false, repeatTrackId = false, failSeekCommand = false;
    std::string block, plain, styled, full, language, title, codec;
};
struct Inspection {
    int created = 0, destroyed = 0, live = 0, blocked = 0, versionCalls = 0, eventCalls = 0;
    std::map<std::string, std::string> options;
    std::vector<std::pair<std::string, std::string>> properties, commands;
    std::vector<std::string> propertyReads;
    std::vector<int> deliveredEvents;
};
void Configure(const Configuration &value);
void Reset();
void Unblock();
Inspection Inspect();
}
