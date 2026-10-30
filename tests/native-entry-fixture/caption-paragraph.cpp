// Production splitting and range classification only. SDK drawing remains fail-fast on the host.
#include "../../entry/src/main/cpp/caption/NapiCaptionRenderer.cpp"
napi_value InspectCaptionParagraphs(napi_env env, napi_callback_info info) {
    try {
        size_t count = 1; napi_value value, out;
        Check(napi_get_cb_info(env, info, &count, &value, nullptr, nullptr));
        const auto request = Read(env, value); auto parts = SplitParagraphs(request);
        Check(napi_create_array_with_length(env, parts.size(), &out));
        for (size_t i = 0; i < parts.size(); ++i) {
            const auto &part = parts[i]; napi_value object, runs;
            Check(napi_create_object(env, &object)); SetNumber(env, object, "start", uint32_t(part.start));
            SetNumber(env, object, "run", uint32_t(part.run)); SetNumber(env, object, "byte", uint32_t(part.byte));
            Check(napi_create_array_with_length(env, part.request.runs.size(), &runs));
            for (size_t j = 0; j < part.request.runs.size(); ++j) {
                const auto &run = part.request.runs[j]; napi_value r, text, size, color, flag;
                Check(napi_create_object(env, &r)); Check(napi_create_string_utf8(env, run.text.data(), run.text.size(), &text));
                Check(napi_set_named_property(env, r, "text", text)); SetNumber(env, r, "units", uint32_t(run.units));
                Check(napi_create_double(env, run.size, &size)); Check(napi_set_named_property(env, r, "size", size));
                Check(napi_create_uint32(env, run.color, &color)); Check(napi_set_named_property(env, r, "color", color));
                Check(napi_get_boolean(env, run.underline, &flag)); Check(napi_set_named_property(env, r, "underline", flag));
                Check(napi_set_element(env, runs, j, r));
            }
            Check(napi_set_named_property(env, object, "runs", runs)); Check(napi_set_element(env, out, i, object));
        }
        return out;
    } catch (const std::exception &e) { napi_throw_error(env, nullptr, e.what()); return nullptr; }
}
napi_value InspectTerminalParagraphRow(napi_env env, napi_callback_info info) {
    try {
        size_t count = 1; napi_value value, out;
        Check(napi_get_cb_info(env, info, &count, &value, nullptr, nullptr));
        OH_Drawing_LineMetrics line{};
        line.startIndex = Integer(env, Field(env, value, "start"), 0, UINT32_MAX);
        line.endIndex = Integer(env, Field(env, value, "end"), 0, UINT32_MAX);
        line.width = Number(env, Field(env, value, "width"), 0, 8192);
        const auto units = Integer(env, Field(env, value, "units"), 0, UINT32_MAX);
        Check(napi_get_boolean(env, TerminalParagraphRow(line, units), &out)); return out;
    } catch (const std::exception &e) { napi_throw_error(env, nullptr, e.what()); return nullptr; }
}
