#!/bin/bash
# Build DuckDB native libraries for iOS
# Supports arm64 (device) and arm64+x86_64 (simulator) architectures
#
# This script builds DuckDB as a STATIC library and packages it as an XCFramework.
# Static linking is preferred for iOS because:
# 1. No code signing issues with embedded frameworks
# 2. Smaller app size (dead code elimination)
# 3. Faster app launch (no dynamic library loading)
# 4. Matches Android approach (static .a linked into .so)
#
# For standard extensions (icu, json, parquet, etc.):
#   DUCKDB_EXTENSIONS="icu;json;parquet" ./scripts/build-ios.sh
#
# For spatial + vss extensions (default, requires vcpkg):
#   ./scripts/build-ios.sh
#
# Prerequisites:
#   - Xcode with command line tools: xcode-select --install
#   - vcpkg installed: git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh
#   - First build takes 30-60 minutes (builds GDAL, GEOS, PROJ from source)
#
# Output:
#   - ios/Frameworks/DuckDB.xcframework (static framework)
#   - ios/Sources/CapacitorDuckDbPlugin/include/duckdb.h (C API header)

set -e

# Configuration
DUCKDB_VERSION="${DUCKDB_VERSION:-main}"
# Default extensions
# Spatial is handled via BUILD_SPATIAL flag
DUCKDB_EXTENSIONS="${DUCKDB_EXTENSIONS:-icu;json;parquet;inet;tpch;tpcds;vss}"
BUILD_APP=false
# Always build with spatial by default (can be disabled with --no-spatial)
BUILD_SPATIAL=true
BUILD_VSS=true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/build/duckdb-ios"
OUTPUT_DIR="${PROJECT_ROOT}/ios"
FRAMEWORK_DIR="${OUTPUT_DIR}/Frameworks"
HEADER_DIR="${OUTPUT_DIR}/Sources/CapacitorDuckDbPlugin/include"

# vcpkg settings (for spatial/vss extensions)
VCPKG_ROOT="${VCPKG_ROOT:-$HOME/vcpkg}"
# iOS deployment target - must match podspec
IOS_DEPLOYMENT_TARGET="${IOS_DEPLOYMENT_TARGET:-14.0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check for vcpkg (required for spatial/vss extensions)
check_vcpkg() {
    if [ ! -f "$VCPKG_ROOT/vcpkg" ]; then
        log_error "vcpkg not found at $VCPKG_ROOT"
        log_error "Please install vcpkg or set VCPKG_ROOT environment variable"
        log_error "  git clone https://github.com/Microsoft/vcpkg.git"
        log_error "  ./vcpkg/bootstrap-vcpkg.sh"
        exit 1
    fi
    log_info "Using vcpkg: $VCPKG_ROOT"
}

# Check for Xcode and iOS SDKs
check_xcode() {
    if ! command -v xcodebuild &> /dev/null; then
        log_error "Xcode command line tools not found!"
        log_error "Please install Xcode and run: xcode-select --install"
        exit 1
    fi
    
    # Get SDK paths
    IPHONEOS_SDK=$(xcrun --sdk iphoneos --show-sdk-path 2>/dev/null)
    IPHONESIMULATOR_SDK=$(xcrun --sdk iphonesimulator --show-sdk-path 2>/dev/null)
    
    if [ -z "$IPHONEOS_SDK" ]; then
        log_error "iOS SDK (iphoneos) not found!"
        log_error "Please install Xcode with iOS platform support"
        exit 1
    fi
    
    if [ -z "$IPHONESIMULATOR_SDK" ]; then
        log_error "iOS Simulator SDK not found!"
        log_error "Please install Xcode with iOS Simulator support"
        exit 1
    fi
    
    log_info "Using iOS SDK: $IPHONEOS_SDK"
    log_info "Using iOS Simulator SDK: $IPHONESIMULATOR_SDK"
}

# Check for required tools
check_tools() {
    local missing_tools=()

    if ! command -v cmake &> /dev/null; then
        missing_tools+=("cmake")
    fi

    if ! command -v ninja &> /dev/null; then
        missing_tools+=("ninja")
    fi

    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi

    if ! command -v lipo &> /dev/null; then
        missing_tools+=("lipo (should come with Xcode)")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install them before running this script"
        log_error "  brew install cmake ninja"
        exit 1
    fi
}

# Clone or update DuckDB source
get_duckdb_source() {
    log_info "Getting DuckDB source (version: $DUCKDB_VERSION)..."
    
    mkdir -p "$BUILD_DIR"
    
    if [ -d "$BUILD_DIR/duckdb" ]; then
        log_info "Updating existing DuckDB source..."
        cd "$BUILD_DIR/duckdb"
        git fetch origin
        git checkout "$DUCKDB_VERSION"
        if [ "$DUCKDB_VERSION" = "main" ]; then
            git pull origin main
        fi
    else
        log_info "Cloning DuckDB repository..."
        git clone --depth 1 --branch "$DUCKDB_VERSION" https://github.com/duckdb/duckdb.git "$BUILD_DIR/duckdb" || \
        git clone https://github.com/duckdb/duckdb.git "$BUILD_DIR/duckdb"
        cd "$BUILD_DIR/duckdb"
        git checkout "$DUCKDB_VERSION"
    fi
}

# Clone or update duckdb-spatial source (for spatial extension)
get_spatial_source() {
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    
    log_step "Getting duckdb-spatial source..."
    
    mkdir -p "${PROJECT_ROOT}/build/spatial"
    
    if [ -d "$spatial_dir" ]; then
        log_info "Using existing duckdb-spatial source..."
    else
        log_info "Cloning duckdb-spatial repository..."
        git clone --recurse-submodules https://github.com/duckdb/duckdb-spatial.git "$spatial_dir"
    fi
    
    # We'll use the duckdb submodule from spatial for consistency
    cd "$spatial_dir"
    git submodule update --init --recursive
}

# Clone or update duckdb-vss source
get_vss_source() {
    local vss_dir="${PROJECT_ROOT}/build/vss/duckdb-vss"
    
    log_step "Getting duckdb-vss source..."
    
    mkdir -p "${PROJECT_ROOT}/build/vss"
    
    if [ -d "$vss_dir" ]; then
        log_info "Using existing duckdb-vss source..."
        cd "$vss_dir"
        git fetch origin
        git pull
    else
        log_info "Cloning duckdb-vss repository..."
        git clone --recurse-submodules https://github.com/duckdb/duckdb-vss "$vss_dir"
    fi
}

# Install vcpkg dependencies for iOS (spatial extension)
# 
# iOS vcpkg triplets:
#   - arm64-ios: Physical iOS devices (iPhone, iPad)
#   - arm64-ios-simulator: Apple Silicon Mac simulators
#   - x64-ios-simulator: Intel Mac simulators
#
# We build all three and combine simulator builds into universal binary
install_vcpkg_deps_ios() {
    local triplet=$1
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local host_triplet
    
    # Detect host triplet for cross-compilation tools
    if [[ "$(uname -m)" == "arm64" ]]; then
        host_triplet="arm64-osx"
    else
        host_triplet="x64-osx"
    fi
    
    log_step "Installing vcpkg dependencies for $triplet (host: $host_triplet)..."
    log_info "This may take a while on first run (building GDAL, GEOS, PROJ, CURL from source)..."
    log_info "Expected time: 30-60 minutes for first build"
    
    cd "$spatial_dir"
    
    # Backup original vcpkg.json and create a modified one with curl enabled for iOS
    if [ ! -f "$spatial_dir/vcpkg.json.original" ]; then
        log_info "Backing up original vcpkg.json..."
        cp "$spatial_dir/vcpkg.json" "$spatial_dir/vcpkg.json.original"
    fi
    
    log_info "Creating modified vcpkg.json with curl enabled for iOS..."
    cat > "$spatial_dir/vcpkg.json" << 'EOF'
{
  "dependencies": [
    "vcpkg-cmake",
    "openssl",
    "zlib",
    "geos",
    "expat",
    {
      "name": "sqlite3",
      "features": ["rtree"],
      "default-features": false
    },
    {
      "name": "proj",
      "default-features": false,
      "version>=": "9.1.1"
    },
    {
      "name": "curl",
      "features": ["openssl"],
      "default-features": false
    },
    {
      "name": "gdal",
      "version>=": "3.8.5",
      "features": [
        "geos"
      ]
    }
  ],
  "vcpkg-configuration": {
    "overlay-ports": [
      "./vcpkg_ports"
    ],
    "registries": [
      {
        "kind": "git",
        "repository": "https://github.com/duckdb/vcpkg-duckdb-ports",
        "baseline": "3c7b96fa186c27eae2226a1b5b292f2b2dd3cf8f",
        "packages": [ "vcpkg-cmake" ]
      }
    ]
  },
  "builtin-baseline" : "ce613c41372b23b1f51333815feb3edd87ef8a8b"
}
EOF
    
    # Create custom iOS triplets with correct deployment target
    local custom_triplets_dir="$spatial_dir/custom-triplets"
    mkdir -p "$custom_triplets_dir"
    
    # arm64-ios (physical devices)
    cat > "$custom_triplets_dir/arm64-ios.cmake" << EOF
set(VCPKG_TARGET_ARCHITECTURE arm64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME iOS)
set(VCPKG_OSX_ARCHITECTURES arm64)
set(VCPKG_OSX_DEPLOYMENT_TARGET $IOS_DEPLOYMENT_TARGET)
set(VCPKG_OSX_SYSROOT iphoneos)
EOF

    # arm64-ios-simulator (Apple Silicon simulators)
    cat > "$custom_triplets_dir/arm64-ios-simulator.cmake" << EOF
set(VCPKG_TARGET_ARCHITECTURE arm64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME iOS)
set(VCPKG_OSX_ARCHITECTURES arm64)
set(VCPKG_OSX_DEPLOYMENT_TARGET $IOS_DEPLOYMENT_TARGET)
set(VCPKG_OSX_SYSROOT iphonesimulator)
EOF

    # x64-ios-simulator (Intel Mac simulators)
    cat > "$custom_triplets_dir/x64-ios-simulator.cmake" << EOF
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME iOS)
set(VCPKG_OSX_ARCHITECTURES x86_64)
set(VCPKG_OSX_DEPLOYMENT_TARGET $IOS_DEPLOYMENT_TARGET)
set(VCPKG_OSX_SYSROOT iphonesimulator)
EOF

    log_info "Created custom iOS triplets with deployment target $IOS_DEPLOYMENT_TARGET"
    
    # Determine install root based on triplet (so we can keep all triplets installed)
    local install_root
    case "$triplet" in
        arm64-ios)
            install_root="$spatial_dir/vcpkg_arm64_ios"
            ;;
        arm64-ios-simulator)
            install_root="$spatial_dir/vcpkg_arm64_sim"
            ;;
        x64-ios-simulator)
            install_root="$spatial_dir/vcpkg_x64_sim"
            ;;
        *)
            install_root="$spatial_dir/vcpkg_installed"
            ;;
    esac
    
    # Install dependencies using manifest mode with custom triplets
    "$VCPKG_ROOT/vcpkg" install \
        --triplet="$triplet" \
        --host-triplet="$host_triplet" \
        --x-install-root="$install_root" \
        --overlay-triplets="$custom_triplets_dir"
    
    log_info "vcpkg dependencies installed for $triplet at $install_root"
}

# Build DuckDB for a specific iOS architecture (standard build without spatial)
#
# iOS CMake cross-compilation key points:
# - CMAKE_SYSTEM_NAME=iOS tells CMake we're cross-compiling for iOS
# - CMAKE_OSX_ARCHITECTURES specifies target arch (arm64 or x86_64)
# - CMAKE_OSX_SYSROOT specifies SDK (iphoneos or iphonesimulator)
# - CMAKE_OSX_DEPLOYMENT_TARGET sets minimum iOS version
# - We build STATIC libraries (-DBUILD_SHARED_LIBS=OFF, library type static)
build_for_arch() {
    local arch=$1
    local sdk=$2
    local platform_name="ios_${arch}_${sdk}"
    local build_path="$BUILD_DIR/duckdb/build/${platform_name}"
    local vss_dir="${PROJECT_ROOT}/build/vss/duckdb-vss"
    
    log_step "Building DuckDB for $arch ($sdk)..."
    
    # Get the SDK path
    local sdk_path
    if [ "$sdk" = "iphoneos" ]; then
        sdk_path=$(xcrun --sdk iphoneos --show-sdk-path)
    else
        sdk_path=$(xcrun --sdk iphonesimulator --show-sdk-path)
    fi
    
    mkdir -p "$build_path"
    cd "$build_path"
    
    local cmake_args=(
        -G "Ninja"
        -DCMAKE_BUILD_TYPE=Release
        -DCMAKE_SYSTEM_NAME=iOS
        -DCMAKE_OSX_ARCHITECTURES="${arch}"
        -DCMAKE_OSX_SYSROOT="${sdk}"
        -DCMAKE_OSX_DEPLOYMENT_TARGET="${IOS_DEPLOYMENT_TARGET}"
        # Static library build - this is key for iOS!
        # Unlike Android where we build a shared .so, iOS apps prefer static linking
        # This produces libduckdb_static.a which we wrap in an XCFramework
        -DBUILD_SHARED_LIBS=OFF
        -DEXTENSION_STATIC_BUILD=ON
        -DENABLE_EXTENSION_AUTOLOADING=ON
        -DENABLE_EXTENSION_AUTOINSTALL=OFF
        -DCMAKE_VERBOSE_MAKEFILE=ON
        -DLOCAL_EXTENSION_REPO=""
        -DOVERRIDE_GIT_DESCRIBE=""
        -DDUCKDB_EXPLICIT_PLATFORM="${platform_name}"
        -DBUILD_UNITTESTS=OFF
        -DBUILD_SHELL=OFF
        # iOS-specific: disable features that don't work on iOS
        -DBUILD_PYTHON=OFF
        -DBUILD_R=OFF
        -DBUILD_NODEJS=OFF
    )
    
    # Add extensions if specified
    if [ -n "$DUCKDB_EXTENSIONS" ]; then
        cmake_args+=(-DBUILD_EXTENSIONS="${DUCKDB_EXTENSIONS}")
        # Add external extension directories (for VSS)
        cmake_args+=(-DEXTERNAL_EXTENSION_DIRECTORIES="$vss_dir")
        log_info "Building with extensions: $DUCKDB_EXTENSIONS"
    fi
    
    cmake "${cmake_args[@]}" ../..
    cmake --build . --config Release
    
    log_info "Built DuckDB for $arch ($sdk)"
}

# Build DuckDB with spatial extension for a specific iOS architecture
#
# Why spatial requires special handling (same as Android):
# 1. Spatial is an OUT-OF-TREE extension (separate repo)
# 2. It requires vcpkg dependencies (GDAL, GEOS, PROJ) cross-compiled for iOS
# 3. Uses duckdb_extension_load() mechanism to build DuckDB + spatial together
build_spatial_for_arch() {
    local arch=$1
    local sdk=$2
    local triplet=$3
    local platform_name="ios_${arch}_${sdk}"
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local build_path="$spatial_dir/build/${platform_name}"
    local vss_dir="${PROJECT_ROOT}/build/vss/duckdb-vss"
    
    log_step "Building DuckDB with spatial extension for $arch ($sdk)..."
    
    # Install vcpkg dependencies first (GDAL, GEOS, PROJ for iOS)
    install_vcpkg_deps_ios "$triplet"
    
    cd "$spatial_dir"
    
    # Determine vcpkg install root based on triplet
    local vcpkg_install_root
    case "$triplet" in
        arm64-ios)
            vcpkg_install_root="$spatial_dir/vcpkg_arm64_ios"
            ;;
        arm64-ios-simulator)
            vcpkg_install_root="$spatial_dir/vcpkg_arm64_sim"
            ;;
        x64-ios-simulator)
            vcpkg_install_root="$spatial_dir/vcpkg_x64_sim"
            ;;
        *)
            vcpkg_install_root="$spatial_dir/vcpkg_installed"
            ;;
    esac
    
    local vcpkg_installed="$vcpkg_install_root/$triplet"
    
    # Verify vcpkg installation
    if [ ! -d "$vcpkg_installed" ]; then
        log_error "vcpkg installation not found at $vcpkg_installed"
        exit 1
    fi
    
    log_info "Using vcpkg libraries from: $vcpkg_installed"
    
    # Detect host triplet
    local host_triplet
    if [[ "$(uname -m)" == "arm64" ]]; then
        host_triplet="arm64-osx"
    else
        host_triplet="x64-osx"
    fi
    
    # Clean previous build for this platform
    rm -rf "$build_path"
    mkdir -p "$build_path"
    
    log_info "Running CMake configuration..."
    log_info "  Source: $spatial_dir/duckdb"
    log_info "  Extension config: $spatial_dir/extension_config.cmake"
    log_info "  vcpkg installed: $vcpkg_installed"
    
    local num_cores=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
    local custom_triplets_dir="$spatial_dir/custom-triplets"
    
    # Determine CMAKE_SYSTEM_PROCESSOR for the target architecture
    # PROJ's config checks for this exact value: "aarch64" for arm64, "x86_64" for x64
    local system_processor
    if [ "$arch" = "arm64" ]; then
        system_processor="aarch64"
    else
        system_processor="x86_64"
    fi
    
    # Use vcpkg toolchain - it handles iOS cross-compilation when properly configured
    # Key points for iOS cross-compilation with vcpkg:
    # 1. CMAKE_SYSTEM_NAME=iOS - tells CMake we're targeting iOS
    # 2. CMAKE_SYSTEM_PROCESSOR - must match what vcpkg packages expect (aarch64/x86_64)
    # 3. CMAKE_CROSSCOMPILING=ON - ensures find_package checks pass for cross-compiled libs
    # 4. VCPKG_TARGET_TRIPLET - tells vcpkg which prebuilt packages to use
    cmake -G "Ninja" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" \
        -DVCPKG_TARGET_TRIPLET="$triplet" \
        -DVCPKG_HOST_TRIPLET="$host_triplet" \
        -DVCPKG_INSTALLED_DIR="$vcpkg_install_root" \
        -DVCPKG_OVERLAY_PORTS="$spatial_dir/vcpkg_ports" \
        -DVCPKG_OVERLAY_TRIPLETS="$custom_triplets_dir" \
        -DCMAKE_SYSTEM_NAME=iOS \
        -DCMAKE_SYSTEM_PROCESSOR="${system_processor}" \
        -DCMAKE_CROSSCOMPILING=ON \
        -DCMAKE_OSX_ARCHITECTURES="${arch}" \
        -DCMAKE_OSX_SYSROOT="${sdk}" \
        -DCMAKE_OSX_DEPLOYMENT_TARGET="${IOS_DEPLOYMENT_TARGET}" \
        -DBUILD_SHARED_LIBS=OFF \
        -DEXTENSION_STATIC_BUILD=ON \
        -DDUCKDB_EXTENSION_CONFIGS="$spatial_dir/extension_config.cmake" \
        -DSPATIAL_USE_NETWORK=OFF \
        -DBUILD_SHELL=OFF \
        -DBUILD_UNITTESTS=OFF \
        -DBUILD_PYTHON=OFF \
        -DBUILD_R=OFF \
        -DBUILD_NODEJS=OFF \
        -DENABLE_EXTENSION_AUTOLOADING=ON \
        -DENABLE_EXTENSION_AUTOINSTALL=OFF \
        -DDUCKDB_EXPLICIT_PLATFORM="$platform_name" \
        -DLOCAL_EXTENSION_REPO="" \
        -DOVERRIDE_GIT_DESCRIBE="" \
        ${DUCKDB_EXTENSIONS:+-DBUILD_EXTENSIONS="$DUCKDB_EXTENSIONS"} \
        -DEXTERNAL_EXTENSION_DIRECTORIES="$vss_dir" \
        -S "$spatial_dir/duckdb" \
        -B "$build_path"
    
    log_info "Building DuckDB with spatial extension..."
    cmake --build "$build_path" --config Release -- -j$num_cores
    
    log_info "Built DuckDB with spatial for $arch ($sdk)"
}

# Create universal (fat) binary for simulator (arm64 + x86_64)
create_universal_simulator_lib() {
    local lib_name=$1
    local arm64_lib=$2
    local x86_64_lib=$3
    local output_lib=$4
    
    log_info "Creating universal simulator library: $lib_name"
    
    mkdir -p "$(dirname "$output_lib")"
    
    lipo -create \
        "$arm64_lib" \
        "$x86_64_lib" \
        -output "$output_lib"
    
    log_info "Created universal library at $output_lib"
    lipo -info "$output_lib"
}

# Create XCFramework from device and simulator builds
#
# XCFramework structure:
#   DuckDB.xcframework/
#   ├── Info.plist
#   ├── ios-arm64/                      (device)
#   │   └── libduckdb_static.a
#   └── ios-arm64_x86_64-simulator/     (simulator universal)
#       └── libduckdb_static.a
#
# For static frameworks, we include the .a file directly
# The header is provided separately in the plugin sources

# Merge all DuckDB static libraries into a single library
# This is necessary because DuckDB static build creates many separate .a files
# Also includes vcpkg libraries (PROJ, GEOS, GDAL, etc.) for spatial extension
merge_static_libraries() {
    local build_dir=$1
    local output_lib=$2
    local vcpkg_lib_dir=$3  # Optional: vcpkg libraries to include
    
    log_info "Merging all static libraries in $build_dir..."
    
    # Find all .a files in the build directory
    local libs=$(find "$build_dir" -name "*.a" -type f 2>/dev/null | sort | uniq)
    
    if [ -z "$libs" ]; then
        log_error "No static libraries found in $build_dir"
        return 1
    fi
    
    # Create output directory
    mkdir -p "$(dirname "$output_lib")"
    
    # Count libraries
    local lib_count=$(echo "$libs" | wc -l | tr -d ' ')
    log_info "Found $lib_count DuckDB static libraries to merge"
    
    # On macOS, use libtool to combine static libraries
    # libtool -static merges all object files from input .a files
    log_info "Merging with libtool..."
    
    # Convert newline-separated list to space-separated for libtool
    local lib_array=()
    while IFS= read -r lib; do
        if [ -f "$lib" ]; then
            lib_array+=("$lib")
            log_info "  Adding: $(basename "$lib")"
        fi
    done <<< "$libs"
    
    # Add vcpkg libraries if provided
    if [ -n "$vcpkg_lib_dir" ] && [ -d "$vcpkg_lib_dir" ]; then
        log_info "Adding vcpkg libraries from $vcpkg_lib_dir..."
        
        # List of vcpkg libraries to include (order matters for dependencies)
        # These are the spatial extension dependencies
        # NOTE: Some libraries are EXCLUDED because GDAL embeds them internally:
        #   - libjson-c.a (embedded in GDAL)
        #   - libgeotiff.a (embedded in GDAL)  
        #   - libturbojpeg.a (same as libjpeg.a)
        #   - libz.a (use system zlib)
        local vcpkg_libs=(
            "libproj.a"
            "libgeos.a"
            "libgeos_c.a"
            "libgdal.a"
            "libsqlite3.a"
            "libcurl.a"
            "libssl.a"
            "libcrypto.a"
            "libtiff.a"
            "libjpeg.a"
            "libexpat.a"
            "liblzma.a"
        )
        
        for vcpkg_lib in "${vcpkg_libs[@]}"; do
            local vcpkg_lib_path="$vcpkg_lib_dir/$vcpkg_lib"
            if [ -f "$vcpkg_lib_path" ]; then
                lib_array+=("$vcpkg_lib_path")
                log_info "  Adding vcpkg: $vcpkg_lib"
            fi
        done
    fi
    
    if [ ${#lib_array[@]} -eq 0 ]; then
        log_error "No valid libraries found"
        return 1
    fi
    
    log_info "Total libraries to merge: ${#lib_array[@]}"
    
    # Run libtool to merge
    libtool -static -o "$output_lib" "${lib_array[@]}"
    
    if [ -f "$output_lib" ]; then
        local size=$(du -h "$output_lib" | cut -f1)
        log_info "Created merged library: $output_lib ($size)"
        return 0
    else
        log_error "Failed to create merged library"
        return 1
    fi
}

create_xcframework() {
    local device_lib=$1
    local simulator_lib=$2
    local framework_name="DuckDB"
    local xcframework_path="${FRAMEWORK_DIR}/${framework_name}.xcframework"
    
    log_step "Creating XCFramework..."
    
    # Remove existing xcframework
    rm -rf "$xcframework_path"
    mkdir -p "$FRAMEWORK_DIR"
    
    # Create XCFramework with static libraries
    # -library flag is used for static libraries (.a files)
    # For each library, we specify the headers location
    xcodebuild -create-xcframework \
        -library "$device_lib" \
        -library "$simulator_lib" \
        -output "$xcframework_path"
    
    log_info "Created XCFramework at $xcframework_path"
    
    # Show structure
    log_info "XCFramework structure:"
    find "$xcframework_path" -type f | head -20
}

# Copy DuckDB headers (both C and C++)
copy_headers() {
    local source_dir=$1
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    
    log_info "Copying DuckDB headers..."
    
    mkdir -p "$HEADER_DIR"
    mkdir -p "$HEADER_DIR/duckdb"
    mkdir -p "$HEADER_DIR/spatial"
    
    # Copy the main C header
    if [ -f "$source_dir/src/include/duckdb.h" ]; then
        cp "$source_dir/src/include/duckdb.h" "$HEADER_DIR/"
        log_info "C header copied to $HEADER_DIR/duckdb.h"
    else
        log_error "duckdb.h not found in $source_dir/src/include/"
        exit 1
    fi
    
    # Copy C++ headers for the iOS C++ wrapper
    # This enables LoadStaticExtension<SpatialExtension>() to work
    log_info "Copying C++ headers for static extension support..."
    
    # Copy main duckdb.hpp and its dependencies
    if [ -d "$source_dir/src/include/duckdb" ]; then
        cp -R "$source_dir/src/include/duckdb" "$HEADER_DIR/"
        log_info "C++ headers copied to $HEADER_DIR/duckdb/"
    fi
    
    # Copy duckdb.hpp main include
    if [ -f "$source_dir/src/include/duckdb.hpp" ]; then
        cp "$source_dir/src/include/duckdb.hpp" "$HEADER_DIR/"
        log_info "duckdb.hpp copied"
    fi
    
    # Copy spatial extension header
    if [ -f "$spatial_dir/src/spatial/spatial_extension.hpp" ]; then
        cp "$spatial_dir/src/spatial/spatial_extension.hpp" "$HEADER_DIR/spatial/"
        log_info "spatial_extension.hpp copied"
    else
        log_warn "spatial_extension.hpp not found - spatial extension may not compile"
    fi
    
    log_info "All headers copied successfully"
}

# Build the plugin and example app
build_example_app() {
    log_info "Building plugin and example app..."
    
    # Build the TypeScript plugin
    cd "$PROJECT_ROOT"
    if [ -f "package.json" ]; then
        log_info "Installing plugin dependencies..."
        npm install
        log_info "Building TypeScript plugin..."
        npm run build
    fi
    
    # Build the example app
    cd "$PROJECT_ROOT/example-app"
    if [ -f "package.json" ]; then
        log_info "Installing example app dependencies..."
        npm install
        log_info "Building example app..."
        npm run build
        log_info "Syncing Capacitor..."
        npx cap sync ios
    fi
    
    # Build iOS app
    cd "$PROJECT_ROOT/example-app/ios/App"
    if [ -f "Podfile" ]; then
        log_info "Installing CocoaPods dependencies..."
        pod install
        log_info "Building iOS app..."
        xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -destination 'generic/platform=iOS Simulator' \
            -configuration Release \
            build
        log_info "iOS build complete!"
    else
        log_error "Podfile not found in example-app/ios/App"
        exit 1
    fi
}

# Main build process
main() {
    log_info "=== DuckDB iOS Build Script ==="
    log_info "Project root: $PROJECT_ROOT"
    log_info ""
    log_info "Build configuration:"
    log_info "  - Static library: YES (iOS best practice)"
    log_info "  - Spatial extension: $BUILD_SPATIAL"
    log_info "  - VSS extension: $BUILD_VSS"
    log_info "  - iOS deployment target: $IOS_DEPLOYMENT_TARGET"
    log_info ""
    
    check_tools
    check_xcode
    
    # Get VSS source if VSS is in extensions
    if [[ "$DUCKDB_EXTENSIONS" == *"vss"* ]]; then
        get_vss_source
    fi
    
    if [ "$BUILD_SPATIAL" = true ]; then
        # Spatial extension build (uses vcpkg + duckdb-spatial)
        log_info ""
        log_warn "⚠️  Building with SPATIAL extension requires significant time and disk space!"
        log_warn "   - GDAL, GEOS, PROJ will be compiled from source via vcpkg"
        log_warn "   - First build may take 30-60 minutes per architecture"
        log_warn "   - Requires ~5-10GB disk space"
        log_info ""
        
        check_vcpkg
        get_spatial_source
        
        local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
        
        # Build for device (arm64)
        build_spatial_for_arch "arm64" "iphoneos" "arm64-ios"
        
        # Build for simulators
        build_spatial_for_arch "arm64" "iphonesimulator" "arm64-ios-simulator"
        build_spatial_for_arch "x86_64" "iphonesimulator" "x64-ios-simulator"
        
        # Find the static library - location depends on build
        local device_lib="$spatial_dir/build/ios_arm64_iphoneos/src/libduckdb_static.a"
        local sim_arm64_lib="$spatial_dir/build/ios_arm64_iphonesimulator/src/libduckdb_static.a"
        local sim_x86_64_lib="$spatial_dir/build/ios_x86_64_iphonesimulator/src/libduckdb_static.a"
        
        # Check if libraries exist, try alternative locations
        if [ ! -f "$device_lib" ]; then
            device_lib=$(find "$spatial_dir/build/ios_arm64_iphoneos" -name "libduckdb_static.a" -o -name "libduckdb.a" | head -1)
        fi
        if [ ! -f "$sim_arm64_lib" ]; then
            sim_arm64_lib=$(find "$spatial_dir/build/ios_arm64_iphonesimulator" -name "libduckdb_static.a" -o -name "libduckdb.a" | head -1)
        fi
        if [ ! -f "$sim_x86_64_lib" ]; then
            sim_x86_64_lib=$(find "$spatial_dir/build/ios_x86_64_iphonesimulator" -name "libduckdb_static.a" -o -name "libduckdb.a" | head -1)
        fi
        
        log_info "Found libraries:"
        log_info "  Device: $device_lib"
        log_info "  Sim arm64: $sim_arm64_lib"
        log_info "  Sim x86_64: $sim_x86_64_lib"
        
        # vcpkg libraries are installed to separate directories per triplet
        local vcpkg_device_libs="$spatial_dir/vcpkg_arm64_ios/arm64-ios/lib"
        local vcpkg_sim_arm64_libs="$spatial_dir/vcpkg_arm64_sim/arm64-ios-simulator/lib"
        local vcpkg_sim_x64_libs="$spatial_dir/vcpkg_x64_sim/x64-ios-simulator/lib"
        
        # Check if vcpkg libs exist, fall back to vcpkg_installed if they don't
        if [ ! -d "$vcpkg_device_libs" ]; then
            vcpkg_device_libs="$spatial_dir/vcpkg_installed/arm64-ios/lib"
        fi
        if [ ! -d "$vcpkg_sim_arm64_libs" ]; then
            vcpkg_sim_arm64_libs="$spatial_dir/vcpkg_installed/arm64-ios-simulator/lib"
        fi
        if [ ! -d "$vcpkg_sim_x64_libs" ]; then
            vcpkg_sim_x64_libs="$spatial_dir/vcpkg_installed/x64-ios-simulator/lib"
        fi
        
        log_info "vcpkg library directories:"
        log_info "  Device: $vcpkg_device_libs"
        log_info "  Sim arm64: $vcpkg_sim_arm64_libs"
        log_info "  Sim x64: $vcpkg_sim_x64_libs"
        
        # Merge all static libraries for each architecture
        # DuckDB static build creates many separate .a files that must be combined
        # Also include vcpkg libraries (PROJ, GEOS, GDAL, etc.)
        local merged_device_lib="$spatial_dir/build/ios_arm64_iphoneos/merged/libduckdb_merged.a"
        local merged_sim_arm64_lib="$spatial_dir/build/ios_arm64_iphonesimulator/merged/libduckdb_merged.a"
        local merged_sim_x86_64_lib="$spatial_dir/build/ios_x86_64_iphonesimulator/merged/libduckdb_merged.a"
        
        log_step "Merging static libraries for each architecture (including vcpkg deps)..."
        merge_static_libraries "$spatial_dir/build/ios_arm64_iphoneos" "$merged_device_lib" "$vcpkg_device_libs"
        merge_static_libraries "$spatial_dir/build/ios_arm64_iphonesimulator" "$merged_sim_arm64_lib" "$vcpkg_sim_arm64_libs"
        merge_static_libraries "$spatial_dir/build/ios_x86_64_iphonesimulator" "$merged_sim_x86_64_lib" "$vcpkg_sim_x64_libs"
        
        # Create universal simulator library from merged libs
        local universal_sim_lib="$spatial_dir/build/ios_universal_simulator/libduckdb_merged.a"
        create_universal_simulator_lib "libduckdb_merged.a" "$merged_sim_arm64_lib" "$merged_sim_x86_64_lib" "$universal_sim_lib"
        
        # Create XCFramework with merged libraries
        create_xcframework "$merged_device_lib" "$universal_sim_lib"
        
        # Copy headers from duckdb-spatial's duckdb submodule
        copy_headers "$spatial_dir/duckdb"
    else
        # Standard DuckDB build (no spatial)
        get_duckdb_source
        
        # Build for device (arm64)
        build_for_arch "arm64" "iphoneos"
        
        # Build for simulators
        build_for_arch "arm64" "iphonesimulator"
        build_for_arch "x86_64" "iphonesimulator"
        
        # Merge all static libraries for each architecture
        local merged_device_lib="$BUILD_DIR/duckdb/build/ios_arm64_iphoneos/merged/libduckdb_merged.a"
        local merged_sim_arm64_lib="$BUILD_DIR/duckdb/build/ios_arm64_iphonesimulator/merged/libduckdb_merged.a"
        local merged_sim_x86_64_lib="$BUILD_DIR/duckdb/build/ios_x86_64_iphonesimulator/merged/libduckdb_merged.a"
        
        log_step "Merging static libraries for each architecture..."
        merge_static_libraries "$BUILD_DIR/duckdb/build/ios_arm64_iphoneos" "$merged_device_lib"
        merge_static_libraries "$BUILD_DIR/duckdb/build/ios_arm64_iphonesimulator" "$merged_sim_arm64_lib"
        merge_static_libraries "$BUILD_DIR/duckdb/build/ios_x86_64_iphonesimulator" "$merged_sim_x86_64_lib"
        
        # Create universal simulator library from merged libs
        local universal_sim_lib="$BUILD_DIR/duckdb/build/ios_universal_simulator/libduckdb_merged.a"
        create_universal_simulator_lib "libduckdb_merged.a" "$merged_sim_arm64_lib" "$merged_sim_x86_64_lib" "$universal_sim_lib"
        
        # Create XCFramework with merged libraries
        create_xcframework "$merged_device_lib" "$universal_sim_lib"
        
        # Copy headers
        copy_headers "$BUILD_DIR/duckdb"
    fi
    
    log_info "=== iOS native build complete! ==="
    log_info ""
    log_info "Output files:"
    log_info "  XCFramework: ${FRAMEWORK_DIR}/DuckDB.xcframework"
    log_info "  Header: ${HEADER_DIR}/duckdb.h"
    log_info ""
    
    if [ "$BUILD_SPATIAL" = true ]; then
        log_info "Spatial extension included! Available functions:"
        log_info "  - ST_Point, ST_LineString, ST_Polygon, etc."
        log_info "  - ST_Intersects, ST_Contains, ST_Distance, ST_Buffer, etc."
        log_info "  - ST_Transform (coordinate transformations)"
        log_info "  - ST_Read (GeoJSON, Shapefile, GeoParquet, etc.)"
    fi
    
    log_info ""
    log_info "Next steps:"
    log_info "  1. Update your podspec to include the XCFramework"
    log_info "  2. Implement DuckDB bindings in Swift using the C API"
    log_info "  3. Run 'pod install' in example-app/ios/App"
    
    # Optionally build the example app
    if [ "$BUILD_APP" = true ]; then
        build_example_app
    else
        log_info ""
        log_info "To also build the example app, run with --build-app flag"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            DUCKDB_VERSION="$2"
            shift 2
            ;;
        --extensions)
            DUCKDB_EXTENSIONS="$2"
            shift 2
            ;;
        --spatial)
            BUILD_SPATIAL=true
            shift
            ;;
        --no-spatial)
            BUILD_SPATIAL=false
            shift
            ;;
        --no-vss)
            BUILD_VSS=false
            shift
            ;;
        --build-app)
            BUILD_APP=true
            shift
            ;;
        --ios-target)
            IOS_DEPLOYMENT_TARGET="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --version VERSION    DuckDB version/branch to build (default: main)"
            echo "  --extensions LIST    Semicolon-separated list of extensions (e.g., 'icu;json;parquet')"
            echo "  --no-spatial         Disable spatial extension (enabled by default)"
            echo "  --no-vss             Disable VSS extension (enabled by default)"
            echo "  --ios-target VER     iOS deployment target (default: 14.0)"
            echo "  --build-app          Also build the plugin and example app after native libs"
            echo "  --help               Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DUCKDB_VERSION       DuckDB version to build"
            echo "  DUCKDB_EXTENSIONS    Extensions to include"
            echo "  VCPKG_ROOT           Path to vcpkg (default: ~/vcpkg)"
            echo "  IOS_DEPLOYMENT_TARGET  Minimum iOS version (default: 14.0)"
            echo ""
            echo "Examples:"
            echo "  # Build with spatial + all extensions (default)"
            echo "  ./scripts/build-ios.sh"
            echo ""
            echo "  # Build without spatial (faster, smaller)"
            echo "  ./scripts/build-ios.sh --no-spatial"
            echo ""
            echo "  # Build with specific extensions only"
            echo "  ./scripts/build-ios.sh --no-spatial --extensions 'icu;json;parquet'"
            echo ""
            echo "Note: Spatial extension requires vcpkg to be installed:"
            echo "      git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh"
            echo ""
            echo "Static Library Note:"
            echo "  iOS builds produce STATIC libraries (.a files) wrapped in an XCFramework."
            echo "  This is the recommended approach for iOS because:"
            echo "    1. No code signing complications with dynamic frameworks"
            echo "    2. Dead code elimination reduces final app size"
            echo "    3. Faster app startup (no dylib loading)"
            echo "    4. Consistent with the Android build (static extensions in shared lib)"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
