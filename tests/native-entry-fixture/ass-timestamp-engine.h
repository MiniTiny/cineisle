#pragma once
#include <vector>
namespace ass_timestamp_fixture {
void Configure(bool failLibrary);
std::vector<long long> Times();
unsigned LibraryFailures();
}
