// Include the unchanged production translation unit to expose its lower entrypoints
// to tests. Redirect only module registration; all five exported callbacks are real.
#include <node_api.h>
#include "engine.h"
static napi_value FixtureInit(napi_env, napi_value);
static void FixtureRegister(napi_module *original) {
    static napi_module fixture = *original;
    fixture.nm_register_func = FixtureInit;
    napi_module_register(&fixture);
}
#define napi_module_register FixtureRegister
#include "../../entry/src/main/cpp/mpv/NapiMpv.cpp"
#undef napi_module_register

namespace {
napi_value Undefined(napi_env e) { napi_value out; Check(napi_get_undefined(e, &out)); return out; }
bool Has(napi_env e, napi_value object, const char *key) { bool out; Check(napi_has_named_property(e, object, key, &out)); return out; }
napi_value Configure(napi_env e, napi_callback_info info) {
    size_t count = 1; napi_value object; Check(napi_get_cb_info(e, info, &count, &object, nullptr, nullptr));
    mpv_fixture::Configuration value;
    auto number = [&](const char *key, int &target) { if (Has(e, object, key)) { int32_t n; Check(napi_get_value_int32(e, Field(e, object, key), &n)); target = n; } };
    number("trackCount", value.trackCount); number("firstTrackId", value.firstTrackId); number("events", value.events);
    if (Has(e, object, "version")) Check(napi_get_value_uint32(e, Field(e, object, "version"), &value.version));
    auto flag = [&](const char *key, bool &target) { if (Has(e, object, key)) Check(napi_get_value_bool(e, Field(e, object, key), &target)); };
    flag("failInitialize", value.failInitialize); flag("failProperty", value.failProperty); flag("repeatTrackId", value.repeatTrackId);
    auto text = [&](const char *key, std::string &target) {
        if (!Has(e, object, key)) return;
        size_t length; auto field = Field(e, object, key); Check(napi_get_value_string_utf8(e, field, nullptr, 0, &length));
        target.resize(length + 1); Check(napi_get_value_string_utf8(e, field, target.data(), target.size(), &length)); target.resize(length);
    };
    text("block", value.block); text("plain", value.plain); text("styled", value.styled); text("full", value.full);
    text("language", value.language); text("title", value.title); text("codec", value.codec);
    mpv_fixture::Configure(value); return Undefined(e);
}
napi_value Reset(napi_env e, napi_callback_info) { mpv_fixture::Reset(); return Undefined(e); }
napi_value Unblock(napi_env e, napi_callback_info) { mpv_fixture::Unblock(); return Undefined(e); }
napi_value Inspect(napi_env e, napi_callback_info) {
    auto value = mpv_fixture::Inspect(); napi_value out, options, properties, commands;
    Check(napi_create_object(e, &out)); Check(napi_create_object(e, &options));
    Set(e, out, "created", double(value.created)); Set(e, out, "destroyed", double(value.destroyed)); Set(e, out, "live", double(value.live));
    Set(e, out, "blocked", double(value.blocked)); Set(e, out, "versionCalls", double(value.versionCalls)); Set(e, out, "eventCalls", double(value.eventCalls));
    Set(e, out, "active", double(active.load()));
    for (const auto &option : value.options) Set(e, options, option.first.c_str(), option.second);
    auto pairs = [&](const auto &list, napi_value &array) {
        Check(napi_create_array_with_length(e, list.size(), &array));
        for (size_t i = 0; i < list.size(); ++i) { napi_value pair; Check(napi_create_object(e, &pair)); Set(e, pair, "name", list[i].first); Set(e, pair, "value", list[i].second); Check(napi_set_element(e, array, i, pair)); }
    };
    pairs(value.properties, properties); pairs(value.commands, commands);
    Check(napi_set_named_property(e, out, "options", options)); Check(napi_set_named_property(e, out, "properties", properties)); Check(napi_set_named_property(e, out, "commands", commands));
    return out;
}
// Intentionally bypass Number() and the N-API command wrapper. The production
// Session::Set must independently reject each non-finite/fractional/oversized axis.
napi_value CoreSurface(napi_env e, napi_callback_info info) {
    try {
        size_t count = 3; napi_value values[3]; Check(napi_get_cb_info(e, info, &count, values, nullptr, nullptr));
        Command command; command.type = "surface-size";
        Check(napi_get_value_double(e, values[1], &command.value)); Check(napi_get_value_double(e, values[2], &command.height));
        Handle(e, values[0])->Set(command); return Undefined(e);
    } catch (const std::exception &error) { napi_throw_error(e, nullptr, error.what()); return nullptr; }
}
napi_value QueueSize(napi_env e, napi_callback_info info) {
    size_t count = 1; napi_value value; Check(napi_get_cb_info(e, info, &count, &value, nullptr, nullptr));
    auto session = Handle(e, value); std::lock_guard<std::mutex> lock(session->mutex);
    napi_value out; Check(napi_create_double(e, session->tasks.size(), &out)); return out;
}
napi_value CoreEnqueue(napi_env e, napi_callback_info info) {
    try {
        size_t count = 2; napi_value values[2]; Check(napi_get_cb_info(e, info, &count, values, nullptr, nullptr));
        auto session = Handle(e, values[0]); bool release; Check(napi_get_value_bool(e, values[1], &release));
        session->Enqueue<void>([session, release] { if (release) session->Shutdown(); }, release);
        return Undefined(e);
    } catch (const std::exception &error) { napi_throw_error(e, nullptr, error.what()); return nullptr; }
}
}
static napi_value FixtureInit(napi_env e, napi_value exports) {
    Init(e, exports);
    napi_property_descriptor descriptors[] = {
        {"configure", nullptr, Configure, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"reset", nullptr, Reset, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"unblock", nullptr, Unblock, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"inspect", nullptr, Inspect, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"coreSurface", nullptr, CoreSurface, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"queueSize", nullptr, QueueSize, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"coreEnqueue", nullptr, CoreEnqueue, nullptr, nullptr, nullptr, napi_default, nullptr}};
    Check(napi_define_properties(e, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors)); return exports;
}
