#!/bin/bash
# Build DuckDB native libraries for Android
# Supports arm64-v8a and x86_64 ABIs
#
# This script builds a MONOLITHIC DuckDB library with ALL extensions statically linked:
#   - spatial (GIS/geometry functions via GDAL, GEOS, PROJ)
#   - vss (Vector Similarity Search with HNSW indexes)
#   - icu (International Components for Unicode)
#   - json (JSON parsing and generation)
#   - parquet (Parquet file format support)
#   - inet (IP address functions)
#   - tpch (TPC-H benchmark queries)
#   - tpcds (TPC-DS benchmark queries)
#
# Why monolithic? Mobile platforms (Android/iOS) discourage dynamic loading.
# All functionality is available offline immediately after app install.
#
# Prerequisites:
#   - Android NDK (via Android Studio)
#   - vcpkg: git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh
#   - cmake, ninja, git
#
# Usage:
#   ./scripts/build-android.sh              # Build native libraries
#   ./scripts/build-android.sh --build-app  # Also build example app

set -e

# Configuration
DUCKDB_VERSION="${DUCKDB_VERSION:-main}"
# All extensions - always included, statically linked
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds"
BUILD_APP=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/android/src/main"

# vcpkg settings (required for spatial extension)
VCPKG_ROOT="${VCPKG_ROOT:-$HOME/vcpkg}"
# API level 28+ required for posix_spawn and getrandom used by GDAL
ANDROID_API_LEVEL="${ANDROID_API_LEVEL:-28}"

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

# Check for vcpkg (required)
check_vcpkg() {
    if [ ! -f "$VCPKG_ROOT/vcpkg" ]; then
        log_error "vcpkg not found at $VCPKG_ROOT"
        log_error "vcpkg is REQUIRED for building DuckDB with spatial extension"
        log_error ""
        log_error "Install vcpkg:"
        log_error "  git clone https://github.com/Microsoft/vcpkg.git ~/vcpkg"
        log_error "  ~/vcpkg/bootstrap-vcpkg.sh"
        log_error "  export VCPKG_ROOT=\$HOME/vcpkg"
        exit 1
    fi
    log_info "Using vcpkg: $VCPKG_ROOT"
}

# Check for Android NDK
check_ndk() {
    if [ -z "$ANDROID_NDK" ]; then
        # Try to find NDK in common locations
        if [ -n "$ANDROID_HOME" ]; then
            NDK_DIR="$ANDROID_HOME/ndk"
            if [ -d "$NDK_DIR" ]; then
                ANDROID_NDK=$(ls -d "$NDK_DIR"/*/ 2>/dev/null | sort -V | tail -1)
                ANDROID_NDK="${ANDROID_NDK%/}"
            fi
        fi
        
        # Try macOS default location
        if [ -z "$ANDROID_NDK" ] && [ -d "$HOME/Library/Android/sdk/ndk" ]; then
            ANDROID_NDK=$(ls -d "$HOME/Library/Android/sdk/ndk"/*/ 2>/dev/null | sort -V | tail -1)
            ANDROID_NDK="${ANDROID_NDK%/}"
        fi
    fi

    if [ -z "$ANDROID_NDK" ] || [ ! -d "$ANDROID_NDK" ]; then
        log_error "Android NDK not found!"
        log_error "Please set ANDROID_NDK environment variable or install NDK via Android Studio"
        log_error "  Android Studio -> Tools -> SDK Manager -> SDK Tools -> NDK (Side by side)"
        exit 1
    fi

    log_info "Using Android NDK: $ANDROID_NDK"
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

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install them: brew install cmake ninja git"
        exit 1
    fi
}

# Clone or update duckdb-spatial source
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
    
    # Use the duckdb submodule from spatial for consistency
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

# Clone or update duckpgq-extension source
get_duckpgq_source() {
    local duckpgq_dir="${PROJECT_ROOT}/build/duckpgq/duckpgq-extension"
    
    log_step "Getting duckpgq-extension source..."
    
    mkdir -p "${PROJECT_ROOT}/build/duckpgq"
    
    if [ -d "$duckpgq_dir" ]; then
        log_info "Using existing duckpgq-extension source..."
        cd "$duckpgq_dir"
        git fetch origin
        git checkout v1.4-andium
        git pull origin v1.4-andium
    else
        log_info "Cloning duckpgq-extension repository..."
        git clone --recurse-submodules -b v1.4-andium https://github.com/cwida/duckpgq-extension "$duckpgq_dir"
    fi
    
    # Initialize duckpgq's duckdb submodule (the fork)
    cd "$duckpgq_dir"
    git submodule update --init --recursive
}

# Create custom VSS extension config for static linking
# The default DuckDB config for VSS uses DONT_LINK which prevents static linking
create_vss_extension_config() {
    local config_dir="${PROJECT_ROOT}/build/vss"
    local config_file="${config_dir}/vss_extension_config.cmake"
    local vss_dir="${PROJECT_ROOT}/build/vss/duckdb-vss"
    
    log_info "Creating custom VSS extension config for static linking..."
    
    mkdir -p "$config_dir"
    
    cat > "$config_file" << EOF
# Custom VSS extension config for static linking
# This overrides the default config which has DONT_LINK

duckdb_extension_load(vss
    SOURCE_DIR ${vss_dir}
    LOAD_TESTS
)
EOF
    
    log_info "VSS extension config created at: $config_file"
}

# Create custom DuckPGQ extension config for static linking
create_duckpgq_extension_config() {
    local config_dir="${PROJECT_ROOT}/build/duckpgq"
    local config_file="${config_dir}/duckpgq_extension_config.cmake"
    local duckpgq_dir="${PROJECT_ROOT}/build/duckpgq/duckpgq-extension"
    
    log_info "Creating custom DuckPGQ extension config for static linking..."
    
    mkdir -p "$config_dir"
    
    cat > "$config_file" << EOF
# Custom DuckPGQ extension config for static linking

duckdb_extension_load(duckpgq
    SOURCE_DIR ${duckpgq_dir}
    LOAD_TESTS
)
EOF
    
    log_info "DuckPGQ extension config created at: $config_file"
}

# Install vcpkg dependencies for Android
install_vcpkg_deps() {
    local triplet=$1
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local host_triplet
    
    # Detect host triplet for cross-compilation tools
    if [[ "$(uname)" == "Darwin" ]]; then
        if [[ "$(uname -m)" == "arm64" ]]; then
            host_triplet="arm64-osx"
        else
            host_triplet="x64-osx"
        fi
    else
        host_triplet="x64-linux"
    fi
    
    log_step "Installing vcpkg dependencies for $triplet (host: $host_triplet)..."
    log_info "This may take 30-60 minutes on first run (building GDAL, GEOS, PROJ from source)..."
    
    cd "$spatial_dir"
    
    # Backup original vcpkg.json
    if [ ! -f "$spatial_dir/vcpkg.json.original" ]; then
        cp "$spatial_dir/vcpkg.json" "$spatial_dir/vcpkg.json.original"
    fi
    
    # Create modified vcpkg.json with curl enabled for Android
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
        "network",
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
    
    # Set environment for Android NDK
    export ANDROID_NDK_HOME="$ANDROID_NDK"
    
    # Create custom triplets with correct API level
    local custom_triplets_dir="$spatial_dir/custom-triplets"
    mkdir -p "$custom_triplets_dir"
    
    cat > "$custom_triplets_dir/arm64-android.cmake" << EOF
set(VCPKG_TARGET_ARCHITECTURE arm64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Android)
set(VCPKG_CMAKE_SYSTEM_VERSION $ANDROID_API_LEVEL)
set(VCPKG_MAKE_BUILD_TRIPLET "--host=aarch64-linux-android")
set(VCPKG_CMAKE_CONFIGURE_OPTIONS -DANDROID_ABI=arm64-v8a)
EOF

    cat > "$custom_triplets_dir/x64-android.cmake" << EOF
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Android)
set(VCPKG_CMAKE_SYSTEM_VERSION $ANDROID_API_LEVEL)
set(VCPKG_MAKE_BUILD_TRIPLET "--host=x86_64-linux-android")
set(VCPKG_CMAKE_CONFIGURE_OPTIONS -DANDROID_ABI=x86_64)
EOF

    log_info "Created custom triplets with Android API level $ANDROID_API_LEVEL"
    
    # Check if we need to rebuild due to API level change
    local api_marker="$spatial_dir/vcpkg_installed/.api_level_$ANDROID_API_LEVEL"
    if [ -d "$spatial_dir/vcpkg_installed/$triplet" ] && [ ! -f "$api_marker" ]; then
        log_warn "Removing old vcpkg installation (different API level)..."
        rm -rf "$spatial_dir/vcpkg_installed"
    fi
    
    # Install dependencies
    "$VCPKG_ROOT/vcpkg" install \
        --triplet="$triplet" \
        --host-triplet="$host_triplet" \
        --x-install-root="$spatial_dir/vcpkg_installed" \
        --overlay-triplets="$custom_triplets_dir"
    
    touch "$api_marker"
    log_info "vcpkg dependencies installed for $triplet"
}

# Build DuckDB with all extensions for a specific ABI
build_for_abi() {
    local abi=$1
    local triplet=$2
    local platform_name="android_${abi}"
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local duckpgq_dir="${PROJECT_ROOT}/build/duckpgq/duckpgq-extension"
    local build_path="$spatial_dir/build/${platform_name}"
    local vss_config="${PROJECT_ROOT}/build/vss/vss_extension_config.cmake"
    local duckpgq_config="${PROJECT_ROOT}/build/duckpgq/duckpgq_extension_config.cmake"
    
    log_step "Building DuckDB with all extensions for $abi..."
    
    # Install vcpkg dependencies (GDAL, GEOS, PROJ)
    install_vcpkg_deps "$triplet"
    
    cd "$spatial_dir"
    
    local vcpkg_installed="$spatial_dir/vcpkg_installed/$triplet"
    
    if [ ! -d "$vcpkg_installed" ]; then
        log_error "vcpkg installation not found at $vcpkg_installed"
        exit 1
    fi
    
    log_info "Using vcpkg libraries from: $vcpkg_installed"
    
    # Detect host triplet
    local host_triplet
    if [[ "$(uname)" == "Darwin" ]]; then
        if [[ "$(uname -m)" == "arm64" ]]; then
            host_triplet="arm64-osx"
        else
            host_triplet="x64-osx"
        fi
    else
        host_triplet="x64-linux"
    fi
    
    # Clean previous build
    rm -rf "$build_path"
    mkdir -p "$build_path"
    
    log_info "Running CMake configuration..."
    log_info "  Source: $duckpgq_dir/duckdb (Forked for DuckPGQ)"
    log_info "  Extension configs: spatial + vss + duckpgq"
    log_info "  In-tree extensions: $DUCKDB_EXTENSIONS"
    
    local num_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
    local custom_triplets_dir="$spatial_dir/custom-triplets"
    
    # Build with vcpkg toolchain + Android NDK
    cmake -G "Ninja" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" \
        -DVCPKG_CHAINLOAD_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" \
        -DVCPKG_TARGET_TRIPLET="$triplet" \
        -DVCPKG_HOST_TRIPLET="$host_triplet" \
        -DVCPKG_INSTALLED_DIR="$spatial_dir/vcpkg_installed" \
        -DVCPKG_OVERLAY_PORTS="$spatial_dir/vcpkg_ports" \
        -DVCPKG_OVERLAY_TRIPLETS="$custom_triplets_dir" \
        -DANDROID_ABI="$abi" \
        -DANDROID_PLATFORM="android-$ANDROID_API_LEVEL" \
        -DEXTENSION_STATIC_BUILD=ON \
        -DDUCKDB_EXTENSION_CONFIGS="$spatial_dir/extension_config.cmake;$vss_config;$duckpgq_config" \
        -DSPATIAL_USE_NETWORK=ON \
        -DBUILD_SHELL=OFF \
        -DBUILD_UNITTESTS=OFF \
        -DENABLE_EXTENSION_AUTOLOADING=ON \
        -DENABLE_EXTENSION_AUTOINSTALL=OFF \
        -DDUCKDB_EXTRA_LINK_FLAGS="-llog -Wl,-z,max-page-size=16384" \
        -DDUCKDB_EXPLICIT_PLATFORM="$platform_name" \
        -DLOCAL_EXTENSION_REPO="" \
        -DOVERRIDE_GIT_DESCRIBE="" \
        -DBUILD_EXTENSIONS="$DUCKDB_EXTENSIONS" \
        -S "$duckpgq_dir/duckdb" \
        -B "$build_path"
    
    log_info "Building DuckDB (this may take a while)..."
    cmake --build "$build_path" --config Release -- -j$num_cores
    
    # Copy the built library
    local output_abi_dir="${OUTPUT_DIR}/jniLibs/${abi}"
    mkdir -p "$output_abi_dir"
    
    if [ -f "$build_path/src/libduckdb.so" ]; then
        cp "$build_path/src/libduckdb.so" "$output_abi_dir/"
        log_info "Copied libduckdb.so to $output_abi_dir"
    else
        log_error "libduckdb.so not found!"
        find "$build_path" -name "*.so" -type f 2>/dev/null | head -10
        exit 1
    fi
}

# Copy DuckDB headers
copy_headers() {
    local duckpgq_dir="${PROJECT_ROOT}/build/duckpgq/duckpgq-extension"
    local include_dir="${OUTPUT_DIR}/cpp/include"
    
    log_info "Copying DuckDB headers..."
    mkdir -p "$include_dir"
    cp "$duckpgq_dir/duckdb/src/include/duckdb.h" "$include_dir/"
    log_info "Headers copied to $include_dir"
}

# Build the example app
build_example_app() {
    log_info "Building plugin and example app..."
    
    cd "$PROJECT_ROOT"
    if [ -f "package.json" ]; then
        npm install
        npm run build
    fi
    
    cd "$PROJECT_ROOT/example-app"
    if [ -f "package.json" ]; then
        npm install
        npm run build
        npx cap sync android
    fi
    
    cd "$PROJECT_ROOT/example-app/android"
    if [ -f "gradlew" ]; then
        ./gradlew bundleRelease
        log_info "Build complete: $PROJECT_ROOT/example-app/android/app/build/outputs/bundle/release/"
    fi
}

# Main build process
main() {
    log_info "=== DuckDB Android Build Script (Monolithic) ==="
    log_info ""
    log_info "Building DuckDB with ALL extensions statically linked:"
    log_info "  - spatial (GIS: ST_Point, ST_Distance, ST_Buffer, etc.)"
    log_info "  - vss (Vector Search: HNSW indexes, vss_join, vss_match)"
    log_info "  - duckpgq (Graph: Property Graph Queries, SQL/PGQ)"
    log_info "  - icu (Unicode support)"
    log_info "  - json (JSON functions)"
    log_info "  - parquet (Parquet file format)"
    log_info "  - inet (IP address functions)"
    log_info "  - tpch, tpcds (Benchmark queries)"
    log_info ""
    
    check_tools
    check_ndk
    check_vcpkg
    
    # Get extension sources
    get_spatial_source
    get_vss_source
    get_duckpgq_source
    create_vss_extension_config
    create_duckpgq_extension_config
    
    log_warn "⚠️  First build takes 30-60 minutes (compiling GDAL, GEOS, PROJ)"
    log_warn "   Subsequent builds are much faster (cached)"
    log_info ""
    
    # Build for both ABIs
    build_for_abi "arm64-v8a" "arm64-android"
    build_for_abi "x86_64" "x64-android"
    
    # Copy headers
    copy_headers
    
    log_info ""
    log_info "=== Build complete! ==="
    log_info "Output: ${OUTPUT_DIR}/jniLibs/"
    log_info ""
    log_info "All extensions are statically linked and available offline."
    
    if [ "$BUILD_APP" = true ]; then
        build_example_app
    else
        log_info ""
        log_info "To build the example app: ./scripts/build-android.sh --build-app"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            DUCKDB_VERSION="$2"
            shift 2
            ;;
        --build-app)
            BUILD_APP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Builds a monolithic DuckDB library with ALL extensions statically linked."
            echo ""
            echo "Options:"
            echo "  --version VERSION    DuckDB version/branch (default: main)"
            echo "  --build-app          Also build the example app"
            echo "  --help               Show this help"
            echo ""
            echo "Environment variables:"
            echo "  ANDROID_NDK          Path to Android NDK (auto-detected)"
            echo "  VCPKG_ROOT           Path to vcpkg (default: ~/vcpkg)"
            echo "  DUCKDB_VERSION       DuckDB version to build"
            echo ""
            echo "Included extensions (always):"
            echo "  spatial, vss, duckpgq, icu, json, parquet, inet, tpch, tpcds"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            log_error "Use --help for usage information"
            exit 1
            ;;
    esac
done

main
