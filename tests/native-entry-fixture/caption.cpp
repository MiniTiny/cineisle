// Compile the actual callback and Read() against host Node N-API and the Harmony drawing declarations.
// Accepted requests stop before asynchronous drawing. Any unexpected drawing call aborts the test.
#include <node_api.h>
static napi_status FixtureAsync(napi_env, napi_value, napi_value, napi_async_execute_callback,
    napi_async_complete_callback, void *, napi_async_work *result)
{
    *result = nullptr;
    return napi_generic_failure;
}
#define napi_create_async_work FixtureAsync
#include "../../entry/src/main/cpp/caption/NapiCaptionRenderer.cpp"
