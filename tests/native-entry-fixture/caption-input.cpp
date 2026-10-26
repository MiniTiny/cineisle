#include <node_api.h>
#include <vector>
namespace drawing_layout_fixture { void Configure(bool, bool); unsigned Calls(); unsigned Failures(); unsigned StyleCalls(); unsigned StyleFailures(); }
static bool failRead = false;
static unsigned invalidReads = 0;
static std::vector<double> readValues;
static napi_status ObserveCaptionNumber(napi_env env, napi_value value, double *number) {
    if (failRead) napi_get_undefined(env, &value);
    const auto status = napi_get_value_double(env, value, number);
    if (status == napi_number_expected) ++invalidReads;
    if (status == napi_ok) readValues.push_back(*number);
    return status;
}
#define napi_get_value_double ObserveCaptionNumber
#include "../../entry/src/main/cpp/caption/NapiCaptionRenderer.cpp"
#undef napi_get_value_double
napi_value ConfigureCaptionInput(napi_env env, napi_callback_info info) {
    size_t count = 3; napi_value args[3], out; bool failFont = false, failStyle = false;
    Check(napi_get_cb_info(env, info, &count, args, nullptr, nullptr));
    Check(napi_get_value_bool(env, args[0], &failRead));
    if (count > 1) Check(napi_get_value_bool(env, args[1], &failFont));
    if (count > 2) Check(napi_get_value_bool(env, args[2], &failStyle));
    drawing_layout_fixture::Configure(failFont, failStyle);
    invalidReads = 0; readValues.clear(); Check(napi_get_undefined(env, &out)); return out;
}
napi_value ReadCaptionInput(napi_env env, napi_callback_info info) {
    try {
        size_t count = 1; napi_value arg, out; Check(napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr));
        const auto request = Read(env, arg); Check(napi_create_double(env, request.runs.at(0).size, &out)); return out;
    } catch (const std::exception &error) { napi_throw_error(env, nullptr, error.what()); return nullptr; }
}
napi_value CaptionInputState(napi_env env, napi_callback_info) {
    napi_value out, failed; Check(napi_create_object(env, &out)); Check(napi_create_uint32(env, invalidReads, &failed)); Check(napi_set_named_property(env, out, "invalidReads", failed));
    napi_value values; Check(napi_create_array_with_length(env, readValues.size(), &values));
    for (size_t i = 0; i < readValues.size(); ++i) { napi_value value; Check(napi_create_double(env, readValues[i], &value)); Check(napi_set_element(env, values, i, value)); }
    Check(napi_set_named_property(env, out, "readValues", values));
    napi_value calls, failures;
    Check(napi_create_uint32(env, drawing_layout_fixture::Calls(), &calls)); Check(napi_set_named_property(env, out, "fontCalls", calls));
    Check(napi_create_uint32(env, drawing_layout_fixture::Failures(), &failures)); Check(napi_set_named_property(env, out, "fontFailures", failures));
    Check(napi_create_uint32(env, drawing_layout_fixture::StyleCalls(), &calls)); Check(napi_set_named_property(env, out, "styleCalls", calls));
    Check(napi_create_uint32(env, drawing_layout_fixture::StyleFailures(), &failures)); Check(napi_set_named_property(env, out, "styleFailures", failures)); return out;
}
