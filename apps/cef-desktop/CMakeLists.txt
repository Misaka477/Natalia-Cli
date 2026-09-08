cmake_minimum_required(VERSION 3.16)
project(natalia-cef-desktop CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# CEF SDK root. Default to the local CEF test bundle under .cef-test.
set(CEF_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../.cef-test" CACHE PATH "CEF SDK root")
set(CEF_INCLUDE_DIR "${CEF_ROOT}/include")
set(CEF_BINARY_DIR "${CEF_ROOT}/bin")
set(CEF_WRAPPER_LIB "${CEF_ROOT}/lib/libcef_dll_wrapper.a")
set(CEF_LIB "${CEF_BINARY_DIR}/libcef.so")

file(GLOB NATALIA_CEF_SRCS
  "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cc"
)

add_executable(natalia-cef-desktop ${NATALIA_CEF_SRCS})

target_include_directories(natalia-cef-desktop PRIVATE
  "${CEF_INCLUDE_DIR}" "${CEF_ROOT}"
  "${CMAKE_CURRENT_SOURCE_DIR}/src"
)

target_link_libraries(natalia-cef-desktop PRIVATE
  "${CEF_WRAPPER_LIB}"
  "${CEF_LIB}"
  dl
  pthread
  X11
)

set_target_properties(natalia-cef-desktop PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/output"
)

# Copy CEF runtime dependencies next to the executable.
add_custom_command(TARGET natalia-cef-desktop POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          "${CEF_BINARY_DIR}" "$<TARGET_FILE_DIR:natalia-cef-desktop>"
  VERBATIM
)

target_compile_definitions(natalia-cef-desktop PRIVATE
  CEF_USE_SANDBOX
  _FILE_OFFSET_BITS=64
  __STDC_CONSTANT_MACROS
  __STDC_FORMAT_MACROS
)

target_compile_options(natalia-cef-desktop PRIVATE
  -fno-exceptions
  -fno-rtti
  -fno-threadsafe-statics
  -fvisibility=hidden
  -fvisibility-inlines-hidden
)
