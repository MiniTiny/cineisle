#include <napi/native_api.h>
#include <mpv/client.h>
#include <dlfcn.h>
#include <atomic>
#include <algorithm>
#include <type_traits>
#include <unordered_set>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <deque>
#include <future>
#include <functional>
#include <memory>
#include <mutex>
#include <map>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {
constexpr int MIN_API = 15;
constexpr size_t MAX_QUEUE = 64, MAX_TRACKS = 256;
std::atomic<unsigned> active{0};
void Require(bool value, const char *code) { if (!value) throw std::runtime_error(code); }
void Check(napi_status value) { Require(value == napi_ok, "mpv_argument_invalid"); }
struct Api {
    void *library = nullptr;
#define ENTRY(name) decltype(&mpv_##name) name = nullptr;
    ENTRY(client_api_version) ENTRY(create) ENTRY(initialize) ENTRY(terminate_destroy) ENTRY(set_option_string)
    ENTRY(set_option) ENTRY(command) ENTRY(set_property) ENTRY(get_property) ENTRY(wait_event) ENTRY(free_node_contents)
#undef ENTRY
    Api() {
        library = dlopen("libmpv.so", RTLD_NOW | RTLD_LOCAL);
        Require(library != nullptr, "mpv_unavailable");
        try {
#define LOAD(name) name = reinterpret_cast<decltype(name)>(dlsym(library, "mpv_" #name)); Require(name != nullptr, "mpv_unavailable");
            LOAD(client_api_version) LOAD(create) LOAD(initialize) LOAD(terminate_destroy) LOAD(set_option_string)
            LOAD(set_option) LOAD(command) LOAD(set_property) LOAD(get_property) LOAD(wait_event) LOAD(free_node_contents)
#undef LOAD
            const auto version = client_api_version();
            Require((version >> 16) == 2 && (version & 0xffff) >= 5, "mpv_unavailable");
        } catch (...) { dlclose(library); library = nullptr; throw; }
    }
    // Keep the successfully loaded API alive for all sessions and library-owned caches until process exit.
};
std::mutex apiMutex;
Api *api = nullptr;
Api &Load(int level) {
    Require(level >= MIN_API, "mpv_unavailable");
    std::lock_guard<std::mutex> lock(apiMutex);
    if (!api) api = new Api();
    return *api;
}
struct Track { int index = 0; int64_t id = 0; std::string kind, language, title, codec; bool selected = false; };
struct State {
    bool loaded = false, rendered = false, paused = true, ended = false, seeking = false;
    int error = 0;
    double duration = 0, position = 0, width = 0, height = 0, speed = 1, volume = 1;
    uint32_t seekRevision = 0, seekDone = 0;
    std::string subtitleText, subtitleAss, subtitleEvents;
    double subtitleStart = -1, subtitleEnd = -1;
    double subtitleFontSize = 55;
    double surfaceWidth = 0, surfaceHeight = 0;
    bool subtitleOverflow = false;
    std::vector<Track> tracks;
};
struct Node {
    Api &api; mpv_node value{};
    explicit Node(Api &api) : api(api) {}
    ~Node() { api.free_node_contents(&value); }
};
std::string Text(const mpv_node &value, size_t maximum = 256) {
    if (value.format != MPV_FORMAT_STRING || !value.u.string) return {};
    std::string result = value.u.string;
    if (result.size() > maximum) {
        size_t end = maximum;
        while (end && (static_cast<unsigned char>(result[end]) & 0xc0) == 0x80) --end;
        result.resize(end);
    }
    return result;
}
const mpv_node *Field(const mpv_node &value, const char *name) {
    if (value.format != MPV_FORMAT_NODE_MAP || !value.u.list) return nullptr;
    for (int i = 0; i < value.u.list->num; ++i) {
        if (value.u.list->keys && value.u.list->keys[i] && std::strcmp(value.u.list->keys[i], name) == 0)
            return &value.u.list->values[i];
    }
    return nullptr;
}
struct Request { int api = 0; std::string source, surface, fontConfiguration; };
struct Command { std::string type; double value = 0, height = 0; };
struct Session : std::enable_shared_from_this<Session> {
    Api &api;
    mpv_handle *handle = nullptr;
    State state;
    std::map<std::pair<std::string, int64_t>, int> trackIndices;
    int nextTrackIndex = 0;
    std::mutex mutex;
    std::condition_variable wake;
    std::deque<std::function<void()>> tasks;
    bool closing = false, exit = false;
    bool seekObserved = false, restartedAfterSeek = false;
    double seekTarget = 0;
    std::promise<void> closedSignal;
    std::shared_future<void> closed = closedSignal.get_future().share();
    explicit Session(Api &api) : api(api) {}
    ~Session() { if (handle) api.terminate_destroy(handle); }
    void Start() {
        auto self = shared_from_this();
        std::thread([self] {
            while (true) {
                std::function<void()> task;
                { std::unique_lock<std::mutex> lock(self->mutex); self->wake.wait(lock, [&] { return !self->tasks.empty(); });
                  task = std::move(self->tasks.front()); self->tasks.pop_front(); }
                task();
                if (self->exit) break;
            }
        }).detach();
    }
    template<class T> std::future<T> Enqueue(std::function<T()> operation, bool release = false) {
        auto result = std::make_shared<std::promise<T>>();
        auto future = result->get_future();
        {
            std::lock_guard<std::mutex> lock(mutex);
            Require(!closing, "mpv_closed");
            Require(release || tasks.size() < MAX_QUEUE, "mpv_busy");
            if (release) closing = true;
            tasks.emplace_back([result, operation = std::move(operation)] {
                try {
                    if constexpr (std::is_void_v<T>) { operation(); result->set_value(); }
                    else result->set_value(operation());
                } catch (...) { result->set_exception(std::current_exception()); }
            });
        }
        wake.notify_one(); return future;
    }
    void Shutdown() {
        if (handle) { api.terminate_destroy(handle); handle = nullptr; }
        exit = true; --active; closedSignal.set_value();
    }
    void Abandon() {
        std::lock_guard<std::mutex> lock(mutex);
        if (closing) return;
        closing = true;
        auto self = shared_from_this(); tasks.emplace_back([self] { self->Shutdown(); }); wake.notify_one();
    }
    void Option(const char *name, const char *value) {
        Require(api.set_option_string(handle, name, value) >= 0, "mpv_option_failed");
    }
    void Open(const Request &request) {
        handle = api.create(); Require(handle != nullptr, "mpv_create_failed");
        Option("config", "no"); Option("load-scripts", "no"); Option("osc", "no"); Option("osd-level", "0");
        Option("terminal", "no"); Option("msg-level", "all=no"); Option("idle", "yes"); Option("keep-open", "yes");
        Option("pause", "yes"); Option("vo", "gpu-next"); Option("gpu-context", "ohos"); Option("opengl-es", "yes");
        Option("hwdec", "no"); Option("sub-auto", "no"); Option("audio-file-auto", "no");
        Option("network-timeout", "15");
        if (!request.fontConfiguration.empty()) {
            Option("sub-fonts-config", request.fontConfiguration.c_str());
            Option("sub-font-provider", "fontconfig");
        }
        // Match the fixed Android backend for local and network streams. Auto caching
        // leaves local subtitle packets outside the seekable cache after a seek.
        Option("cache", "yes"); Option("cache-pause-initial", "yes");
        Option("demuxer-max-bytes", "32MiB"); Option("demuxer-max-back-bytes", "32MiB");
        uint64_t surface = 0;
        for (const auto c : request.surface) {
            Require(c >= '0' && c <= '9' && surface <= (UINT64_MAX - unsigned(c - '0')) / 10, "mpv_argument_invalid");
            surface = surface * 10 + unsigned(c - '0');
        }
        Require(surface != 0, "mpv_argument_invalid"); int64_t id; std::memcpy(&id, &surface, sizeof(id));
        Require(api.set_option(handle, "wid", MPV_FORMAT_INT64, &id) >= 0, "mpv_surface_failed");
        Require(api.initialize(handle) >= 0, "mpv_initialize_failed");
        const char *args[] = {"loadfile", request.source.c_str(), nullptr};
        Require(api.command(handle, args) >= 0, "mpv_load_failed");
    }
    double Number(const char *name, double fallback = 0) {
        double value = fallback;
        if (api.get_property(handle, name, MPV_FORMAT_DOUBLE, &value) < 0 || !std::isfinite(value)) return fallback;
        return value;
    }
    bool Flag(const char *name, bool fallback) {
        int value = fallback ? 1 : 0;
        return api.get_property(handle, name, MPV_FORMAT_FLAG, &value) >= 0 ? value != 0 : fallback;
    }
    State Snapshot() {
        Require(handle != nullptr, "mpv_closed");
        for (int i = 0; i < 128; ++i) {
            auto *event = api.wait_event(handle, 0); if (event->event_id == MPV_EVENT_NONE) break;
            if (event->event_id == MPV_EVENT_FILE_LOADED) state.loaded = true;
            if (event->event_id == MPV_EVENT_SEEK) { state.seeking = true; seekObserved = true; }
            if (event->event_id == MPV_EVENT_PLAYBACK_RESTART) {
                state.rendered = true; state.ended = false;
                if (seekObserved) restartedAfterSeek = true;
            }
            if (event->event_id == MPV_EVENT_END_FILE && event->data) {
                const auto &end = *static_cast<mpv_event_end_file *>(event->data);
                if (end.reason == MPV_END_FILE_REASON_ERROR) { state.error = end.error; state.rendered = false; }
                else if (end.reason == MPV_END_FILE_REASON_EOF) state.ended = true;
            }
            if (event->event_id == MPV_EVENT_SHUTDOWN) { state.error = MPV_ERROR_UNINITIALIZED; state.rendered = false; }
        }
        state.duration = std::max(0.0, Number("duration") * 1000); state.position = std::max(0.0, Number("time-pos") * 1000);
        state.width = Number("width"); state.height = Number("height"); state.speed = Number("speed", 1);
        state.volume = Number("volume", 100) / 100; state.paused = Flag("pause", true);
        state.surfaceWidth = std::max(0.0, Number("osd-width")); state.surfaceHeight = std::max(0.0, Number("osd-height"));
        state.ended = Flag("eof-reached", state.ended);
        if (restartedAfterSeek && std::abs(state.position - seekTarget) <= 1000) {
            state.seekDone = state.seekRevision; state.seeking = false; seekObserved = false; restartedAfterSeek = false;
        }
        Node node(api);
        if (api.get_property(handle, "track-list", MPV_FORMAT_NODE, &node.value) >= 0 && node.value.format == MPV_FORMAT_NODE_ARRAY && node.value.u.list) {
            Require(node.value.u.list->num >= 0 && node.value.u.list->num <= int(MAX_TRACKS), "mpv_tracks_invalid");
            state.tracks.clear();
            for (int i = 0; i < node.value.u.list->num; ++i) {
                const auto &item = node.value.u.list->values[i]; auto *type = Field(item, "type"), *id = Field(item, "id");
                if (!type || !id || id->format != MPV_FORMAT_INT64) continue;
                const auto kind = Text(*type);
                if (kind != "audio" && kind != "sub") continue;
                const auto key = std::make_pair(kind, id->u.int64);
                auto known = trackIndices.find(key);
                if (known == trackIndices.end()) { Require(trackIndices.size() < MAX_TRACKS, "mpv_tracks_invalid"); known = trackIndices.emplace(key, nextTrackIndex++).first; }
                Track track; track.index = known->second; track.id = id->u.int64; track.kind = kind;
                if (auto *language = Field(item, "lang")) track.language = Text(*language, 63);
                if (auto *title = Field(item, "title")) track.title = Text(*title);
                if (auto *codec = Field(item, "codec")) track.codec = Text(*codec, 63);
                if (auto *selected = Field(item, "selected")) track.selected = selected->format == MPV_FORMAT_FLAG && selected->u.flag;
                state.tracks.push_back(std::move(track));
            }
        }
        Node plain(api), styled(api), events(api);
        state.subtitleText = api.get_property(handle, "sub-text", MPV_FORMAT_NODE, &plain.value) >= 0 ? Text(plain.value, 16384) : "";
        state.subtitleAss = api.get_property(handle, "sub-text/ass", MPV_FORMAT_NODE, &styled.value) >= 0 ? Text(styled.value, 32768) : "";
        state.subtitleStart = Number("sub-start/full", -1) * 1000;
        state.subtitleEnd = Number("sub-end/full", -1) * 1000;
        state.subtitleFontSize = Number("sub-font-size", 55);
        state.subtitleEvents.clear(); state.subtitleOverflow = false;
        if (api.get_property(handle, "sub-text/ass-full", MPV_FORMAT_NODE, &events.value) >= 0) {
            state.subtitleOverflow = events.value.format == MPV_FORMAT_STRING && events.value.u.string && std::strlen(events.value.u.string) > 65536;
            if (!state.subtitleOverflow) state.subtitleEvents = Text(events.value, 65536);
        }
        return state;
    }
    void Set(const Command &command) {
        Require(handle != nullptr, "mpv_closed");
        const auto &op = command.type; const auto value = command.value;
        int code = MPV_ERROR_INVALID_PARAMETER;
        if (op == "pause" || op == "subtitle-visible") {
            Require(value == 0 || value == 1, "mpv_argument_invalid"); int flag = value == 1;
            code = api.set_property(handle, op == "pause" ? "pause" : "sub-visibility", MPV_FORMAT_FLAG, &flag);
        } else if (op == "surface-size") {
            Require(value >= 1 && value <= 8192 && std::floor(value) == value &&
                command.height >= 1 && command.height <= 8192 && std::floor(command.height) == command.height, "mpv_argument_invalid");
            const auto size = std::to_string(int(value)) + "x" + std::to_string(int(command.height));
            const char *text = size.c_str();
            code = api.set_property(handle, "ohos-surface-size", MPV_FORMAT_STRING, &text);
        } else if (op == "speed" || op == "volume") {
            Require(op == "speed" ? value >= 0.25 && value <= 4 : value >= 0 && value <= 1, "mpv_argument_invalid");
            double amount = op == "volume" ? value * 100 : value;
            code = api.set_property(handle, op.c_str(), MPV_FORMAT_DOUBLE, &amount);
        } else if (op == "seek") {
            Require(value >= 0 && value <= 1e12, "mpv_argument_invalid");
            Snapshot(); const auto seconds = std::to_string(value / 1000);
            const char *args[] = {"seek", seconds.c_str(), "absolute+exact", nullptr}; code = api.command(handle, args);
            if (code >= 0) { ++state.seekRevision; state.seeking = true; state.ended = false; seekObserved = false; restartedAfterSeek = false; seekTarget = value; }
        } else if (op == "audio" || op == "subtitle") {
            Require(std::floor(value) == value, "mpv_argument_invalid"); Snapshot();
            for (const auto &track : state.tracks) {
                if (track.index == value && track.kind == (op == "audio" ? "audio" : "sub")) {
                    int64_t id = track.id; code = api.set_property(handle, op == "audio" ? "aid" : "sid", MPV_FORMAT_INT64, &id); break;
                }
            }
        }
        Require(code >= 0, "mpv_command_failed");
    }
};
struct Holder { std::shared_ptr<Session> session; };
std::mutex holdersMutex;
std::unordered_set<Holder *> holders;
void Finalize(napi_env, void *pointer, void *) {
    std::unique_ptr<Holder> holder(static_cast<Holder *>(pointer));
    { std::lock_guard<std::mutex> lock(holdersMutex); holders.erase(holder.get()); }
    holder->session->Abandon();
}
napi_value Field(napi_env e, napi_value value, const char *name) {
    napi_value result; Check(napi_get_named_property(e, value, name, &result)); return result;
}
std::string String(napi_env e, napi_value value, size_t maximum) {
    size_t length; Check(napi_get_value_string_utf8(e, value, nullptr, 0, &length));
    Require(length <= maximum, "mpv_argument_invalid"); std::string result(length + 1, '\0');
    Check(napi_get_value_string_utf8(e, value, result.data(), result.size(), &length)); result.resize(length);
    Require(result.find('\0') == std::string::npos && result.find('\r') == std::string::npos && result.find('\n') == std::string::npos, "mpv_argument_invalid"); return result;
}
double Number(napi_env e, napi_value value) { double out; Check(napi_get_value_double(e, value, &out)); Require(std::isfinite(out), "mpv_argument_invalid"); return out; }
std::shared_ptr<Session> Handle(napi_env e, napi_value value) {
    void *pointer; Check(napi_get_value_external(e, value, &pointer)); Require(pointer != nullptr, "mpv_argument_invalid");
    std::lock_guard<std::mutex> lock(holdersMutex);
    auto *holder = static_cast<Holder *>(pointer); Require(holders.count(holder) != 0, "mpv_argument_invalid"); return holder->session;
}
struct Work {
    napi_async_work task = nullptr; napi_deferred deferred = nullptr;
    enum Kind { CAPABILITY, CREATE, SNAPSHOT, COMMAND, RELEASE } kind;
    int level = 0; Request request; Command command; State state;
    std::shared_ptr<Session> session;
    std::future<State> reading; std::future<void> operation;
    bool supported = false, loaded = false; unsigned version = 0;
    std::string error;
};
void Execute(napi_env, void *pointer) {
    auto &work = *static_cast<Work *>(pointer);
    try {
        if (work.kind == Work::CAPABILITY) {
            try { work.version = Load(work.level).client_api_version(); work.supported = true; } catch (...) {}
            std::lock_guard<std::mutex> lock(apiMutex); work.loaded = api != nullptr;
        } else if (work.kind == Work::CREATE) {
            auto &api = Load(work.request.api);
            const auto prior = active.fetch_add(1);
            if (prior >= 4) { --active; throw std::runtime_error("mpv_busy"); }
            try { work.session = std::make_shared<Session>(api); work.session->Start(); }
            catch (...) { work.session.reset(); --active; throw; }
            auto session = work.session; auto request = work.request;
            try { session->Enqueue<void>([session, request] { session->Open(request); }).get(); }
            catch (...) {
                // A failed open may already own a demuxer using the caller's FD.
                // Reject creation only after teardown, so the caller can safely close its source.
                session->Abandon(); session->closed.get(); throw;
            }
        } else if (work.kind == Work::SNAPSHOT) work.state = work.reading.get();
        else if (work.kind == Work::RELEASE) work.session->closed.get();
        else work.operation.get();
    } catch (const std::exception &e) {
        const std::string code = e.what(); work.error = code.rfind("mpv_", 0) == 0 ? code : "mpv_native_failed";
    } catch (...) { work.error = "mpv_native_failed"; }
}
void Set(napi_env e, napi_value object, const char *key, double value) { napi_value v; Check(napi_create_double(e, value, &v)); Check(napi_set_named_property(e, object, key, v)); }
void Set(napi_env e, napi_value object, const char *key, bool value) { napi_value v; Check(napi_get_boolean(e, value, &v)); Check(napi_set_named_property(e, object, key, v)); }
void Set(napi_env e, napi_value object, const char *key, const std::string &value) { napi_value v; Check(napi_create_string_utf8(e, value.c_str(), value.size(), &v)); Check(napi_set_named_property(e, object, key, v)); }
napi_value Encode(napi_env e, const State &s) {
    napi_value object; Check(napi_create_object(e, &object));
    Set(e, object, "loaded", s.loaded); Set(e, object, "rendered", s.rendered); Set(e, object, "paused", s.paused); Set(e, object, "ended", s.ended); Set(e, object, "seeking", s.seeking); Set(e, object, "error", double(s.error));
    Set(e, object, "duration", s.duration); Set(e, object, "position", s.position); Set(e, object, "width", s.width); Set(e, object, "height", s.height); Set(e, object, "speed", s.speed); Set(e, object, "volume", s.volume);
    Set(e, object, "seekRevision", double(s.seekRevision)); Set(e, object, "seekDone", double(s.seekDone));
    Set(e, object, "subtitleText", s.subtitleText); Set(e, object, "subtitleAss", s.subtitleAss);
    Set(e, object, "subtitleStart", s.subtitleStart); Set(e, object, "subtitleEnd", s.subtitleEnd);
    Set(e, object, "subtitleEvents", s.subtitleEvents); Set(e, object, "subtitleFontSize", s.subtitleFontSize); Set(e, object, "subtitleOverflow", s.subtitleOverflow);
    Set(e, object, "surfaceWidth", s.surfaceWidth); Set(e, object, "surfaceHeight", s.surfaceHeight);
    napi_value tracks; Check(napi_create_array_with_length(e, s.tracks.size(), &tracks));
    for (size_t i = 0; i < s.tracks.size(); ++i) {
        const auto &track = s.tracks[i]; napi_value item; Check(napi_create_object(e, &item));
        Set(e, item, "index", double(track.index)); Set(e, item, "id", double(track.id)); Set(e, item, "kind", track.kind);
        Set(e, item, "language", track.language); Set(e, item, "title", track.title); Set(e, item, "codec", track.codec); Set(e, item, "selected", track.selected);
        Check(napi_set_element(e, tracks, i, item));
    }
    Check(napi_set_named_property(e, object, "tracks", tracks)); return object;
}
napi_value Error(napi_env e, const char *code) { napi_value value, error; napi_create_string_utf8(e, code, NAPI_AUTO_LENGTH, &value); napi_create_error(e, nullptr, value, &error); return error; }
void Complete(napi_env e, napi_status status, void *pointer) {
    std::unique_ptr<Work> work(static_cast<Work *>(pointer));
    try {
        if (status != napi_ok) work->error = "mpv_cancelled";
        if (!work->error.empty()) { if (work->kind == Work::CREATE && work->session) work->session->Abandon(); napi_reject_deferred(e, work->deferred, Error(e, work->error.c_str())); }
        else {
            napi_value value;
            if (work->kind == Work::CAPABILITY) {
                Check(napi_create_object(e, &value)); Set(e, value, "supported", work->supported); Set(e, value, "loaded", work->loaded); Set(e, value, "apiVersion", double(work->version)); Set(e, value, "active", double(active.load()));
            } else if (work->kind == Work::CREATE) {
                auto holder = std::make_unique<Holder>(); holder->session = work->session;
                Check(napi_create_external(e, holder.get(), Finalize, nullptr, &value));
                { std::lock_guard<std::mutex> lock(holdersMutex); holders.insert(holder.get()); }
                holder.release();
            } else if (work->kind == Work::SNAPSHOT) value = Encode(e, work->state);
            else Check(napi_get_undefined(e, &value));
            Check(napi_resolve_deferred(e, work->deferred, value));
        }
    } catch (...) { if (work->kind == Work::CREATE && work->session) work->session->Abandon(); napi_reject_deferred(e, work->deferred, Error(e, "mpv_binding_failed")); }
    napi_delete_async_work(e, work->task);
}
napi_value Submit(napi_env e, std::unique_ptr<Work> work) {
    napi_value promise, name; Check(napi_create_promise(e, &work->deferred, &promise));
    Check(napi_create_string_utf8(e, "CineIsleMpv", NAPI_AUTO_LENGTH, &name));
    const auto status = napi_create_async_work(e, nullptr, name, Execute, Complete, work.get(), &work->task);
    if (status != napi_ok || napi_queue_async_work(e, work->task) != napi_ok) {
        if (work->task) napi_delete_async_work(e, work->task);
        napi_reject_deferred(e, work->deferred, Error(e, "mpv_native_unavailable")); return promise;
    }
    work.release(); return promise;
}
napi_value Capability(napi_env e, napi_callback_info info) {
    try { size_t count = 1; napi_value value; Check(napi_get_cb_info(e, info, &count, &value, nullptr, nullptr)); Require(count == 1, "mpv_argument_invalid"); auto work = std::make_unique<Work>(); work->kind = Work::CAPABILITY; const auto level = Number(e, value); Require(level >= 0 && level <= 1000 && std::floor(level) == level, "mpv_argument_invalid"); work->level = int(level); return Submit(e, std::move(work)); }
    catch (...) { napi_throw_error(e, nullptr, "mpv_argument_invalid"); return nullptr; }
}
napi_value Create(napi_env e, napi_callback_info info) {
    try { size_t count = 1; napi_value value; Check(napi_get_cb_info(e, info, &count, &value, nullptr, nullptr)); Require(count == 1, "mpv_argument_invalid"); auto work = std::make_unique<Work>(); work->kind = Work::CREATE;
        const auto level = Number(e, Field(e, value, "api")); Require(level >= 0 && level <= 1000 && std::floor(level) == level, "mpv_argument_invalid"); work->request.api = int(level);
        work->request.source = String(e, Field(e, value, "source"), 16384); work->request.surface = String(e, Field(e, value, "surface"), 24);
        bool hasFonts = false; Check(napi_has_named_property(e, value, "fontConfiguration", &hasFonts));
        if (hasFonts) {
            work->request.fontConfiguration = String(e, Field(e, value, "fontConfiguration"), 4096);
            Require(!work->request.fontConfiguration.empty() && work->request.fontConfiguration.front() == '/', "mpv_argument_invalid");
        }
        Require(!work->request.source.empty() && !work->request.surface.empty(), "mpv_argument_invalid"); return Submit(e, std::move(work)); }
    catch (...) { napi_throw_error(e, nullptr, "mpv_argument_invalid"); return nullptr; }
}
napi_value Operate(napi_env e, napi_callback_info info, Work::Kind kind) {
    try { size_t count = 2; napi_value values[2]; Check(napi_get_cb_info(e, info, &count, values, nullptr, nullptr)); Require(count >= 1 && (kind != Work::COMMAND || count == 2), "mpv_argument_invalid");
        auto work = std::make_unique<Work>(); work->kind = kind; work->session = Handle(e, values[0]); auto session = work->session;
        if (kind == Work::SNAPSHOT) work->reading = session->Enqueue<State>([session] { return session->Snapshot(); });
        else if (kind == Work::RELEASE) {
            session->Abandon();
        } else {
            work->command.type = String(e, Field(e, values[1], "type"), 32); work->command.value = Number(e, Field(e, values[1], "value"));
            if (work->command.type == "surface-size") work->command.height = Number(e, Field(e, values[1], "height"));
            auto command = work->command;
            work->operation = session->Enqueue<void>([session, command] { session->Set(command); });
        }
        return Submit(e, std::move(work));
    } catch (...) { napi_throw_error(e, nullptr, "mpv_closed"); return nullptr; }
}
napi_value Snapshot(napi_env e, napi_callback_info info) { return Operate(e, info, Work::SNAPSHOT); }
napi_value CommandCall(napi_env e, napi_callback_info info) { return Operate(e, info, Work::COMMAND); }
napi_value Release(napi_env e, napi_callback_info info) { return Operate(e, info, Work::RELEASE); }
napi_value Init(napi_env e, napi_value exports) {
    napi_property_descriptor descriptors[] = {
        {"capability", nullptr, Capability, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"create", nullptr, Create, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"snapshot", nullptr, Snapshot, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"command", nullptr, CommandCall, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"release", nullptr, Release, nullptr, nullptr, nullptr, napi_default, nullptr}};
    napi_define_properties(e, exports, 5, descriptors); return exports;
}
napi_module module = {1, 0, nullptr, Init, "cineisle_mpv", nullptr, {0}};
__attribute__((constructor)) void Register() { napi_module_register(&module); }
}
