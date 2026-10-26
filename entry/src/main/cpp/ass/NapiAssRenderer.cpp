#include "../caption/SubtitleLimits.h"
#include "AssRenderer.h"
#include "../caption/NapiCaptionRenderer.h"
#include <napi/native_api.h>
#include <atomic>
#include <cmath>
#include <cstring>
#include <limits>
#include <memory>
#include <stdexcept>

namespace {
namespace limits = cineisle::subtitle_limits;
constexpr size_t kErrorCodeUtf8BytesLimit = 64;
constexpr napi_type_tag HANDLE_TAG{0x44713cd7b8e9a065ULL, 0x83a512cb09e46f27ULL};
struct Context {
    std::atomic<bool> closed{false};
    std::shared_ptr<cineisle::AssRenderer> renderer;
};
struct Handle { std::shared_ptr<Context> context; };
enum class Kind { Create, Render };
struct Work {
    Kind kind;
    std::shared_ptr<Context> context;
    std::string document, font, family, configuration, error;
    int64_t time = 0;
    uint32_t width = 0, height = 0, videoWidth = 0, videoHeight = 0;
    cineisle::AssFrame frame;
    napi_deferred deferred = nullptr;
    napi_async_work task = nullptr;
};
void Check(napi_status status)
{
    if (status != napi_ok) { throw std::runtime_error("ass_binding_failed"); }
}
std::string String(napi_env env, napi_value value, size_t maximum)
{
    size_t length = 0;
    if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok || length > maximum) {
        throw std::invalid_argument("ass_argument_invalid");
    }
    std::vector<char> buffer(length + 1);
    Check(napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &length));
    return std::string(buffer.data(), length);
}
uint64_t Integer(napi_env env, napi_value value, uint64_t maximum)
{
    double number = 0;
    if (napi_get_value_double(env, value, &number) != napi_ok || !std::isfinite(number) ||
        number < 0 || std::floor(number) != number || number > double(maximum)) {
        throw std::invalid_argument("ass_argument_invalid");
    }
    return uint64_t(number);
}
Handle *Unwrap(napi_env env, napi_value value)
{
    bool tagged = false;
    if (napi_check_object_type_tag(env, value, &HANDLE_TAG, &tagged) != napi_ok || !tagged) {
        throw std::invalid_argument("ass_handle_invalid");
    }
    void *pointer = nullptr;
    Check(napi_unwrap(env, value, &pointer));
    if (!pointer) { throw std::invalid_argument("ass_handle_invalid"); }
    return static_cast<Handle *>(pointer);
}
void Finalize(napi_env, void *pointer, void *) { delete static_cast<Handle *>(pointer); }
napi_value Error(napi_env env, const char *code)
{
    napi_value message = nullptr, error = nullptr;
    napi_create_string_utf8(env, code, NAPI_AUTO_LENGTH, &message);
    napi_create_error(env, nullptr, message, &error);
    return error;
}
std::string ErrorCode(const std::exception &error)
{
    const std::string value = error.what();
    if (value.size() < kErrorCodeUtf8BytesLimit && value.rfind("ass_", 0) == 0 &&
        value.find_first_not_of("abcdefghijklmnopqrstuvwxyz_") == std::string::npos) { return value; }
    return "ass_native_failed";
}
void Execute(napi_env, void *pointer)
{
    auto &work = *static_cast<Work *>(pointer);
    try {
        if (work.context->closed.load()) { throw std::runtime_error("ass_renderer_closed"); }
        if (work.kind == Kind::Create) {
            work.context->renderer = cineisle::AssRenderer::Create(work.document, work.font, work.family, work.configuration);
        } else {
            work.frame = work.context->renderer->Render(work.time, work.width, work.height, work.videoWidth, work.videoHeight);
        }
        if (work.context->closed.load()) { throw std::runtime_error("ass_renderer_closed"); }
    } catch (const std::bad_alloc &) { work.error = "ass_memory_unavailable"; }
    catch (const std::exception &error) { work.error = ErrorCode(error); }
    catch (...) { work.error = "ass_native_failed"; }
}
void Boolean(napi_env env, napi_value object, const char *key, bool value)
{
    napi_value field = nullptr; Check(napi_get_boolean(env, value, &field));
    Check(napi_set_named_property(env, object, key, field));
}
void Number(napi_env env, napi_value object, const char *key, uint32_t value)
{
    napi_value field = nullptr; Check(napi_create_uint32(env, value, &field));
    Check(napi_set_named_property(env, object, key, field));
}
napi_value Result(napi_env env, Work &work)
{
    napi_value object = nullptr; Check(napi_create_object(env, &object));
    if (work.kind == Kind::Create) {
        auto handle = std::make_unique<Handle>(); handle->context = work.context;
        Check(napi_type_tag_object(env, object, &HANDLE_TAG));
        Boolean(env, object, "native", true);
        Check(napi_wrap(env, object, handle.get(), Finalize, nullptr, nullptr));
        handle.release();
        return object;
    }
    const auto &frame = work.frame;
    Boolean(env, object, "changed", frame.changed); Boolean(env, object, "present", frame.present);
    Number(env, object, "canvasWidth", frame.canvasWidth); Number(env, object, "canvasHeight", frame.canvasHeight);
    Number(env, object, "left", frame.left); Number(env, object, "top", frame.top);
    Number(env, object, "width", frame.width); Number(env, object, "height", frame.height);
    napi_value bytes = nullptr; void *destination = nullptr;
    Check(napi_create_arraybuffer(env, frame.pixels.size(), &destination, &bytes));
    if (!frame.pixels.empty()) { std::memcpy(destination, frame.pixels.data(), frame.pixels.size()); }
    Check(napi_set_named_property(env, object, "rgba", bytes));
    return object;
}
void Complete(napi_env env, napi_status status, void *pointer)
{
    std::unique_ptr<Work> work(static_cast<Work *>(pointer));
    if (status != napi_ok) { work->error = "ass_native_cancelled"; }
    if (work->context->closed.load()) { work->error = "ass_renderer_closed"; }
    try {
        if (work->error.empty()) { Check(napi_resolve_deferred(env, work->deferred, Result(env, *work))); }
        else { napi_reject_deferred(env, work->deferred, Error(env, work->error.c_str())); }
    } catch (const std::exception &) {
        napi_reject_deferred(env, work->deferred, Error(env, "ass_binding_failed"));
    }
    napi_delete_async_work(env, work->task);
}
napi_value Queue(napi_env env, std::unique_ptr<Work> work)
{
    napi_value promise = nullptr, resource = nullptr;
    Check(napi_create_string_utf8(env, "CineIsleASS", NAPI_AUTO_LENGTH, &resource));
    Check(napi_create_promise(env, &work->deferred, &promise));
    const auto created = napi_create_async_work(env, nullptr, resource, Execute, Complete, work.get(), &work->task);
    if (created != napi_ok || napi_queue_async_work(env, work->task) != napi_ok) {
        if (work->task) { napi_delete_async_work(env, work->task); }
        napi_reject_deferred(env, work->deferred, Error(env, "ass_native_unavailable"));
        return promise;
    }
    work.release(); return promise;
}
napi_value Create(napi_env env, napi_callback_info info)
{
    try {
        size_t count = 4; napi_value args[4]{};
        Check(napi_get_cb_info(env, info, &count, args, nullptr, nullptr));
        if (count < 3) { throw std::invalid_argument("ass_argument_invalid"); }
        auto work = std::make_unique<Work>(); work->kind = Kind::Create; work->context = std::make_shared<Context>();
        work->document = String(env, args[0], limits::kMaxAssDocumentUtf8Bytes);
        work->font = String(env, args[1], limits::kMaxAssFontPathBytes); work->family = String(env, args[2], limits::kMaxAssFamilyBytes);
        if (count == 4) {
            napi_valuetype type; Check(napi_typeof(env, args[3], &type));
            if (type != napi_undefined) { work->configuration = String(env, args[3], limits::kMaxAssConfigPathBytes); }
        }
        return Queue(env, std::move(work));
    } catch (const std::exception &error) { napi_throw_error(env, nullptr, ErrorCode(error).c_str()); return nullptr; }
}
napi_value Render(napi_env env, napi_callback_info info)
{
    try {
        size_t count = 6; napi_value args[6]{};
        Check(napi_get_cb_info(env, info, &count, args, nullptr, nullptr));
        if (count != 6) { throw std::invalid_argument("ass_argument_invalid"); }
        auto context = Unwrap(env, args[0])->context;
        if (!context || context->closed.load()) { throw std::runtime_error("ass_renderer_closed"); }
        auto work = std::make_unique<Work>(); work->kind = Kind::Render; work->context = context;
        work->time = int64_t(Integer(env, args[1], 9007199254740991ULL));
        work->width = uint32_t(Integer(env, args[2], limits::kMaxAssCanvasDimensionPx)); work->height = uint32_t(Integer(env, args[3], limits::kMaxAssCanvasDimensionPx));
        work->videoWidth = uint32_t(Integer(env, args[4], limits::kMaxVideoDimensionPx)); work->videoHeight = uint32_t(Integer(env, args[5], limits::kMaxVideoDimensionPx));
        return Queue(env, std::move(work));
    } catch (const std::exception &error) { napi_throw_error(env, nullptr, ErrorCode(error).c_str()); return nullptr; }
}
napi_value Close(napi_env env, napi_callback_info info)
{
    try {
        size_t count = 1; napi_value args[1]{};
        Check(napi_get_cb_info(env, info, &count, args, nullptr, nullptr));
        if (count != 1) { throw std::invalid_argument("ass_argument_invalid"); }
        auto *handle = Unwrap(env, args[0]);
        if (handle->context) { handle->context->closed.store(true); handle->context.reset(); }
        napi_value result = nullptr; Check(napi_get_undefined(env, &result)); return result;
    } catch (const std::exception &error) { napi_throw_error(env, nullptr, ErrorCode(error).c_str()); return nullptr; }
}
napi_value Init(napi_env env, napi_value exports)
{
    const napi_property_descriptor methods[] = {
        {"create", nullptr, Create, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"render", nullptr, Render, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"close", nullptr, Close, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"renderCaption", nullptr, RenderCineIsleCaption, nullptr, nullptr, nullptr, napi_default, nullptr}
    };
    napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);
    return exports;
}
napi_module MODULE = {1, 0, nullptr, Init, "cineisle_ass", nullptr, {nullptr, nullptr, nullptr, nullptr}};
}
extern "C" __attribute__((constructor)) void RegisterCineIsleAss() { napi_module_register(&MODULE); }
