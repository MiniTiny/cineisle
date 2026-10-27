// Compile the actual binding unchanged. Only its external callback-info API can
// throw a controlled exception; the direct helper also calls its real ErrorCode.
#include <node_api.h>
#include "ass-errors.h"
#include <stdexcept>
static bool callbackFailure = false;
static std::string callbackMessage;
static napi_status CallbackInfo(napi_env e, napi_callback_info info, size_t *count, napi_value *args, napi_value *receiver, void **data) {
    const auto status = napi_get_cb_info(e, info, count, args, receiver, data);
    if (callbackFailure) throw std::runtime_error(callbackMessage);
    return status;
}
static napi_value FixtureInit(napi_env, napi_value);
static void FixtureRegister(napi_module *original) {
    static napi_module module = *original; module.nm_register_func = FixtureInit; napi_module_register(&module);
}
#define napi_module_register FixtureRegister
#define napi_get_cb_info CallbackInfo
#include "../../entry/src/main/cpp/ass/NapiAssRenderer.cpp"
#undef napi_get_cb_info
#undef napi_module_register
namespace {
std::string Input(napi_env e, napi_value value) {
    size_t length; Check(napi_get_value_string_utf8(e, value, nullptr, 0, &length));
    std::string out(length + 1, '\0'); Check(napi_get_value_string_utf8(e, value, out.data(), out.size(), &length)); out.resize(length); return out;
}
napi_value ConfigureError(napi_env e, napi_callback_info info) {
    size_t count = 3; napi_value args[3]; Check(napi_get_cb_info(e, info, &count, args, nullptr, nullptr));
    const auto phase = Input(e, args[0]), message = Input(e, args[1]); bool failure; Check(napi_get_value_bool(e, args[2], &failure));
    callbackFailure = phase.rfind("sync-", 0) == 0; callbackMessage = message;
    ass_error_fixture::Configure(phase, message, failure); napi_value out; Check(napi_get_undefined(e, &out)); return out;
}
napi_value CoreCode(napi_env e, napi_callback_info info) {
    size_t count = 1; napi_value value; Check(napi_get_cb_info(e, info, &count, &value, nullptr, nullptr));
    const auto result = ErrorCode(std::runtime_error(Input(e, value))); napi_value out;
    Check(napi_create_string_utf8(e, result.data(), result.size(), &out)); return out;
}
napi_value InspectError(napi_env e, napi_callback_info) {
    const auto value = ass_error_fixture::Inspect(); napi_value out; Check(napi_create_object(e, &out));
    Number(e, out, "creates", uint32_t(value.creates)); Number(e, out, "renders", uint32_t(value.renders));
    Number(e, out, "libraryFailures", uint32_t(value.libraryFailures)); return out;
}
}
static napi_value FixtureInit(napi_env e, napi_value exports) {
    Init(e, exports);
    napi_property_descriptor methods[] = {
        {"configureError", nullptr, ConfigureError, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"coreErrorCode", nullptr, CoreCode, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"inspectError", nullptr, InspectError, nullptr, nullptr, nullptr, napi_default, nullptr}
    };
    Check(napi_define_properties(e, exports, sizeof(methods) / sizeof(methods[0]), methods)); return exports;
}
