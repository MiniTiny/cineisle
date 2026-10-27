#pragma once
#include <string>
#include <cstddef>

// Explicit exceptions at dependency boundaries; no production error filtering.
namespace ass_error_fixture {
void Configure(const std::string &phase, const std::string &message, bool failInitialize);
struct Inspection { std::size_t creates, renders, libraryFailures; };
Inspection Inspect();
}
