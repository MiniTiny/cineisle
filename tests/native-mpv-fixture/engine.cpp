// Only libmpv's external API is simulated. The production bridge loads this library
// through its unchanged dlopen/dlsym path and owns its sessions, guards and queues.
#include "engine.h"
#include <mpv/client.h>
#include <condition_variable>
#include <cstring>
#include <mutex>
#include <stdexcept>

struct mpv_handle { bool paused = true; double speed = 1, volume = 100; };
namespace {
std::mutex mutex;
std::condition_variable wake;
mpv_fixture::Configuration config;
mpv_fixture::Inspection inspection;
void Barrier(std::unique_lock<std::mutex> &lock, const std::string &operation) {
    if (config.block != operation) return;
    ++inspection.blocked;
    wake.notify_all();
    wake.wait(lock, [&] { return config.block != operation; });
    --inspection.blocked;
}
char *Copy(const std::string &s) {
    auto *out = new char[s.size() + 1]; std::memcpy(out, s.c_str(), s.size() + 1); return out;
}
void Text(mpv_node &out, const std::string &s) { out.format = MPV_FORMAT_STRING; out.u.string = Copy(s); }
void Tracks(mpv_node &out) {
    out.format = MPV_FORMAT_NODE_ARRAY;
    out.u.list = new mpv_node_list{config.trackCount, new mpv_node[config.trackCount > 0 ? config.trackCount : 0]{}, nullptr};
    for (int i = 0; i < config.trackCount; ++i) {
        auto &track = out.u.list->values[i]; track.format = MPV_FORMAT_NODE_MAP;
        auto *list = track.u.list = new mpv_node_list{6, new mpv_node[6]{}, new char *[6]{}};
        const char *keys[] = {"type", "id", "lang", "title", "codec", "selected"};
        for (int k = 0; k < 6; ++k) list->keys[k] = Copy(keys[k]);
        Text(list->values[0], "audio"); list->values[1].format = MPV_FORMAT_INT64; list->values[1].u.int64 = config.firstTrackId + (config.repeatTrackId ? 0 : i);
        Text(list->values[2], config.language); Text(list->values[3], config.title); Text(list->values[4], config.codec);
        list->values[5].format = MPV_FORMAT_FLAG; list->values[5].u.flag = i == 0;
    }
}
void Free(mpv_node &value) {
    if (value.format == MPV_FORMAT_STRING) delete[] value.u.string;
    else if ((value.format == MPV_FORMAT_NODE_MAP || value.format == MPV_FORMAT_NODE_ARRAY) && value.u.list) {
        auto *list = value.u.list;
        for (int i = 0; i < list->num; ++i) { Free(list->values[i]); if (list->keys) delete[] list->keys[i]; }
        delete[] list->values; delete[] list->keys; delete list;
    }
    value = {};
}
}
namespace mpv_fixture {
void Configure(const Configuration &value) { std::lock_guard<std::mutex> lock(mutex); config = value; wake.notify_all(); }
void Reset() {
    std::lock_guard<std::mutex> lock(mutex);
    if (inspection.live || inspection.blocked) throw std::runtime_error("fixture reset with live work");
    config = {}; inspection = {};
}
void Unblock() { std::lock_guard<std::mutex> lock(mutex); config.block.clear(); wake.notify_all(); }
Inspection Inspect() { std::lock_guard<std::mutex> lock(mutex); return inspection; }
}
extern "C" {
unsigned long mpv_client_api_version() { std::lock_guard<std::mutex> lock(mutex); ++inspection.versionCalls; return config.version; }
mpv_handle *mpv_create() { std::lock_guard<std::mutex> lock(mutex); ++inspection.created; ++inspection.live; return new mpv_handle; }
int mpv_initialize(mpv_handle *) {
    std::unique_lock<std::mutex> lock(mutex);
    // Fail one real open before the concurrency barrier; later opens still block.
    if (config.failInitializeOnce) { config.failInitializeOnce = false; return MPV_ERROR_GENERIC; }
    Barrier(lock, "initialize");
    return config.failInitialize ? MPV_ERROR_GENERIC : 0;
}
void mpv_terminate_destroy(mpv_handle *handle) { std::lock_guard<std::mutex> lock(mutex); ++inspection.destroyed; --inspection.live; delete handle; }
int mpv_set_option_string(mpv_handle *, const char *name, const char *value) {
    std::lock_guard<std::mutex> lock(mutex); inspection.options[name] = value; return 0;
}
int mpv_set_option(mpv_handle *, const char *name, mpv_format format, void *data) {
    std::lock_guard<std::mutex> lock(mutex);
    if (format != MPV_FORMAT_INT64) std::abort();
    inspection.options[name] = std::to_string(*static_cast<int64_t *>(data)); return 0;
}
int mpv_command(mpv_handle *, const char **args) {
    std::unique_lock<std::mutex> lock(mutex); Barrier(lock, std::string("command:") + args[0]);
    inspection.commands.emplace_back(args[0], args[1] ? args[1] : "");
    return config.failSeekCommand && std::strcmp(args[0], "seek") == 0 ? MPV_ERROR_GENERIC : 0;
}
int mpv_set_property(mpv_handle *handle, const char *name, mpv_format format, void *data) {
    std::unique_lock<std::mutex> lock(mutex); Barrier(lock, std::string("set:") + name);
    if (config.failProperty) return MPV_ERROR_GENERIC;
    std::string value;
    if (format == MPV_FORMAT_STRING) value = *static_cast<char **>(data);
    else if (format == MPV_FORMAT_DOUBLE) {
        auto amount = *static_cast<double *>(data); value = std::to_string(amount);
        if (std::strcmp(name, "speed") == 0) handle->speed = amount;
        if (std::strcmp(name, "volume") == 0) handle->volume = amount;
    } else if (format == MPV_FORMAT_FLAG) { auto flag = *static_cast<int *>(data); value = std::to_string(flag); if (std::strcmp(name, "pause") == 0) handle->paused = flag; }
    else if (format == MPV_FORMAT_INT64) value = std::to_string(*static_cast<int64_t *>(data));
    else std::abort();
    inspection.properties.emplace_back(name, value); return 0;
}
int mpv_get_property(mpv_handle *handle, const char *name, mpv_format format, void *data) {
    std::lock_guard<std::mutex> lock(mutex); const std::string key(name);
    inspection.propertyReads.push_back(key);
    if (format == MPV_FORMAT_DOUBLE) {
        double value = 0;
        if (key == "duration") value = 10;
        else if (key == "time-pos") value = config.positionSeconds;
        else if (key == "width") value = 640;
        else if (key == "height") value = 360;
        else if (key == "speed") value = handle->speed;
        else if (key == "volume") value = handle->volume;
        else if (key == "sub-start/full" || key == "sub-end/full") value = -1;
        else if (key == "sub-font-size") value = 55;
        *static_cast<double *>(data) = value;
    } else if (format == MPV_FORMAT_FLAG) *static_cast<int *>(data) = key == "pause" ? handle->paused : 0;
    else if (format == MPV_FORMAT_NODE) {
        auto &out = *static_cast<mpv_node *>(data);
        if (key == "track-list") Tracks(out);
        else if (key == "sub-text") Text(out, config.plain);
        else if (key == "sub-text/ass") Text(out, config.styled);
        else if (key == "sub-text/ass-full") Text(out, config.full);
        else if (key == "hwdec-current") Text(out, inspection.options["hwdec"]);
        else if (key == "current-vo") Text(out, inspection.options["vo"]);
        else if (key == "current-ao") Text(out, inspection.options["ao"]);
        else return MPV_ERROR_PROPERTY_NOT_FOUND;
    } else std::abort();
    return 0;
}
mpv_event *mpv_wait_event(mpv_handle *, double) {
    std::lock_guard<std::mutex> lock(mutex); ++inspection.eventCalls;
    static thread_local mpv_event event; event = {};
    if (!config.eventIds.empty()) { event.event_id = mpv_event_id(config.eventIds.front()); config.eventIds.erase(config.eventIds.begin()); }
    else {
        event.event_id = config.events > 0 ? MPV_EVENT_FILE_LOADED : MPV_EVENT_NONE;
        if (config.events > 0) --config.events;
    }
    inspection.deliveredEvents.push_back(int(event.event_id));
    return &event;
}
void mpv_free_node_contents(mpv_node *node) { Free(*node); }
}
