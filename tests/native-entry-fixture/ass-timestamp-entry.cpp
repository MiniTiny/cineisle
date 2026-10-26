#include <node_api.h>
#include <algorithm>
#include <vector>
#include "ass-timestamp-engine.h"
static bool readFailure = false;
static std::vector<napi_status> doubleReads;
static napi_status ObserveDouble(napi_env env, napi_value value, double *number) {
    // Execute a real N-API type failure inside the dependency body. Production
    // still receives/handles the status through its unchanged Integer function.
    if (readFailure) napi_get_undefined(env, &value);
    const auto status = napi_get_value_double(env, value, number);
    doubleReads.push_back(status); return status;
}
static napi_value FixtureInit(napi_env, napi_value);
static void FixtureRegister(napi_module *original) {
    static napi_module module = *original; module.nm_register_func = FixtureInit; napi_module_register(&module);
}
#define napi_module_register FixtureRegister
#define napi_get_value_double ObserveDouble
#include "../../entry/src/main/cpp/ass/NapiAssRenderer.cpp"
#undef napi_get_value_double
#undef napi_module_register
namespace {
napi_value ConfigureTimestamp(napi_env env, napi_callback_info info) {
    size_t count = 2; napi_value args[2], out; bool library = false;
    Check(napi_get_cb_info(env, info, &count, args, nullptr, nullptr));
    Check(napi_get_value_bool(env, args[0], &library)); Check(napi_get_value_bool(env, args[1], &readFailure));
    doubleReads.clear(); ass_timestamp_fixture::Configure(library); Check(napi_get_undefined(env, &out)); return out;
}
napi_value CoreTimestamp(napi_env env, napi_callback_info info) {
    try {
        size_t count = 1; napi_value value, out; Check(napi_get_cb_info(env, info, &count, &value, nullptr, nullptr));
        // Independent test maximum; do not read the production Render constant.
        const auto number = Integer(env, value, 9007199254740991ULL);
        Check(napi_create_double(env, double(number), &out)); return out;
    } catch (const std::exception &error) { napi_throw_error(env, nullptr, ErrorCode(error).c_str()); return nullptr; }
}
napi_value TimestampState(napi_env env, napi_callback_info) {
    napi_value out, times; Check(napi_create_object(env, &out)); const auto values = ass_timestamp_fixture::Times();
    Check(napi_create_array_with_length(env, values.size(), &times));
    for (size_t i = 0; i < values.size(); ++i) { napi_value item; Check(napi_create_double(env, double(values[i]), &item)); Check(napi_set_element(env, times, i, item)); }
    Check(napi_set_named_property(env, out, "times", times));
    Number(env, out, "libraryFailures", ass_timestamp_fixture::LibraryFailures());
    Number(env, out, "reads", uint32_t(doubleReads.size()));
    Number(env, out, "numberFailures", uint32_t(std::count(doubleReads.begin(), doubleReads.end(), napi_number_expected)));
    return out;
}
}
static napi_value FixtureInit(napi_env env, napi_value exports) {
    Init(env, exports);
    napi_property_descriptor methods[] = {
        {"configureTimestamp", nullptr, ConfigureTimestamp, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"coreTimestamp", nullptr, CoreTimestamp, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"timestampState", nullptr, TimestampState, nullptr, nullptr, nullptr, napi_default, nullptr}
    };
    Check(napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods)); return exports;
}
