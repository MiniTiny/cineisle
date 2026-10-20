cmake_minimum_required(VERSION 3.16)
project(cineisle_ass LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(CINEISLE_ASS_DEPS "" CACHE PATH "Prepared and verified native ASS dependency prefix")
if(NOT CINEISLE_ASS_DEPS)
    get_filename_component(project_root "${CMAKE_CURRENT_SOURCE_DIR}/../../../.." ABSOLUTE)
    if(EXISTS "${project_root}/.local/native-ass/active-prefix.txt")
        set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
            "${project_root}/.local/native-ass/active-prefix.txt")
        file(READ "${project_root}/.local/native-ass/active-prefix.txt" CINEISLE_ASS_DEPS)
        string(STRIP "${CINEISLE_ASS_DEPS}" CINEISLE_ASS_DEPS)
    endif()
endif()
foreach(ass_library ass harfbuzz freetype fribidi fontconfig expat)
    if(NOT EXISTS "${CINEISLE_ASS_DEPS}/lib/lib${ass_library}.a")
        message(FATAL_ERROR "CINEISLE_ASS_DEPS must point to a prepared native dependency prefix")
    endif()
endforeach()
if(NOT EXISTS "${CINEISLE_ASS_DEPS}/include/ass/ass.h")
    message(FATAL_ERROR "The native ASS dependency headers are missing")
endif()

add_library(cineisle_ass SHARED ass/AssRenderer.cpp ass/NapiAssRenderer.cpp)
target_include_directories(cineisle_ass PRIVATE "${CINEISLE_ASS_DEPS}/include")
target_compile_options(cineisle_ass PRIVATE -Wall -Wextra)
target_link_libraries(cineisle_ass PRIVATE
    "${CINEISLE_ASS_DEPS}/lib/libass.a"
    "${CINEISLE_ASS_DEPS}/lib/libharfbuzz.a"
    "${CINEISLE_ASS_DEPS}/lib/libfontconfig.a"
    "${CINEISLE_ASS_DEPS}/lib/libfreetype.a"
    "${CINEISLE_ASS_DEPS}/lib/libfribidi.a"
    "${CINEISLE_ASS_DEPS}/lib/libexpat.a"
    ace_napi.z m)
