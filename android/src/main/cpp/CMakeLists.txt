cmake_minimum_required(VERSION 3.22.1)

project("capacitor_duckdb")

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Android 15+ requires 16KB page alignment for native libraries
# This adds the necessary linker flags for compatibility
if(ANDROID)
    # Use max-page-size=16384 for 16KB page alignment (Android 15+ requirement)
    set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -Wl,-z,max-page-size=16384")
endif()

# Paths to DuckDB and Spatial extension sources
set(DUCKDB_SPATIAL_PATH "${CMAKE_SOURCE_DIR}/../../../../build/spatial/duckdb-spatial")
set(DUCKDB_PATH "${DUCKDB_SPATIAL_PATH}/duckdb")

# Define the prebuilt DuckDB library
add_library(duckdb SHARED IMPORTED)
set_target_properties(duckdb PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libduckdb.so
)

# Define the prebuilt DuckPGQ extension library
add_library(duckpgq_extension STATIC IMPORTED)
set_target_properties(duckpgq_extension PROPERTIES
    IMPORTED_LOCATION "${DUCKDB_SPATIAL_PATH}/build/android_${ANDROID_ABI}/extension/duckpgq/libduckpgq_extension.a"
)

# Create the JNI shared library
add_library(capacitor_duckdb_jni SHARED
    duckdb_jni.cpp
)

# Include directories for both C API (local) and C++ API (from build)
target_include_directories(capacitor_duckdb_jni PRIVATE
    ${CMAKE_SOURCE_DIR}/include
    ${DUCKDB_PATH}/src/include
    ${DUCKDB_SPATIAL_PATH}/src
    ${CMAKE_SOURCE_DIR}/../../../../build/duckpgq/duckpgq-extension/src/include
)

# Link libraries
target_link_libraries(capacitor_duckdb_jni
    duckdb
    duckpgq_extension
    log
    android
)

# Set library properties
set_target_properties(capacitor_duckdb_jni PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_LIBRARY_OUTPUT_DIRECTORY}"
)
