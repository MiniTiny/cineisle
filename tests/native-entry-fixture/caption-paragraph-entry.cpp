#include <node_api.h>
napi_value InspectCaptionParagraphs(napi_env, napi_callback_info);
napi_value InspectTerminalParagraphRow(napi_env, napi_callback_info);
static napi_value FixtureInit(napi_env, napi_value);
static void FixtureRegister(napi_module *original) {
    static napi_module module = *original; module.nm_register_func = FixtureInit; napi_module_register(&module);
}
#define napi_module_register FixtureRegister
#include "../../entry/src/main/cpp/ass/NapiAssRenderer.cpp"
#undef napi_module_register
static napi_value FixtureInit(napi_env env, napi_value exports) {
    Init(env, exports);
    napi_property_descriptor methods[] = {
        {"inspectCaptionParagraphs", nullptr, InspectCaptionParagraphs, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"inspectTerminalParagraphRow", nullptr, InspectTerminalParagraphRow, nullptr, nullptr, nullptr, napi_default, nullptr}
    };
    Check(napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods)); return exports;
}
