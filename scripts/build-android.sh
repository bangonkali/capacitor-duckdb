#!/bin/bash
# Build DuckDB native libraries for Android
# Supports arm64-v8a and x86_64 ABIs
#
# For standard extensions (icu, json, parquet, etc.):
#   DUCKDB_EXTENSIONS="icu;json;parquet" ./scripts/build-android.sh
#
# For spatial extension (requires vcpkg):
#   ./scripts/build-android.sh --spatial
#
# Prerequisites for spatial:
#   - vcpkg installed: git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh
#   - First build takes 30-60 minutes (builds GDAL, GEOS, PROJ from source)

set -e

# Configuration
DUCKDB_VERSION="${DUCKDB_VERSION:-main}"
DUCKDB_EXTENSIONS="${DUCKDB_EXTENSIONS:-}"
BUILD_APP=false
BUILD_SPATIAL=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/build/duckdb"
OUTPUT_DIR="${PROJECT_ROOT}/android/src/main"

# vcpkg settings (for spatial extension)
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

# Check for vcpkg (required for spatial extension)
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

# Check for Android NDK
check_ndk() {
    if [ -z "$ANDROID_NDK" ]; then
        # Try to find NDK in common locations
        if [ -n "$ANDROID_HOME" ]; then
            # Find the latest NDK version
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
        log_error "Please install them before running this script"
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

# Install vcpkg dependencies for Android (spatial extension)
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
    log_info "This may take a while on first run (building GDAL, GEOS, PROJ, CURL from source)..."
    log_info "Expected time: 30-60 minutes for first build"
    
    cd "$spatial_dir"
    
    # Backup original vcpkg.json and create a modified one with curl enabled for Android
    # The original excludes curl for android/ios/wasm, but we want it for network support
    if [ ! -f "$spatial_dir/vcpkg.json.original" ]; then
        log_info "Backing up original vcpkg.json..."
        cp "$spatial_dir/vcpkg.json" "$spatial_dir/vcpkg.json.original"
    fi
    
    log_info "Creating modified vcpkg.json with curl enabled for Android..."
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
    
    # Create custom triplet with correct API level (posix_spawn/getrandom require API 28+)
    # vcpkg's default triplets use API 24, which is too low for GDAL
    local custom_triplets_dir="$spatial_dir/custom-triplets"
    mkdir -p "$custom_triplets_dir"
    
    # Create custom arm64-android triplet
    cat > "$custom_triplets_dir/arm64-android.cmake" << EOF
set(VCPKG_TARGET_ARCHITECTURE arm64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Android)
set(VCPKG_CMAKE_SYSTEM_VERSION $ANDROID_API_LEVEL)
set(VCPKG_MAKE_BUILD_TRIPLET "--host=aarch64-linux-android")
set(VCPKG_CMAKE_CONFIGURE_OPTIONS -DANDROID_ABI=arm64-v8a)
EOF

    # Create custom x64-android triplet
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
        log_warn "Removing old vcpkg installation (was built with different API level)..."
        rm -rf "$spatial_dir/vcpkg_installed"
    fi
    
    # Install dependencies using manifest mode with custom triplets
    "$VCPKG_ROOT/vcpkg" install \
        --triplet="$triplet" \
        --host-triplet="$host_triplet" \
        --x-install-root="$spatial_dir/vcpkg_installed" \
        --overlay-triplets="$custom_triplets_dir"
    
    # Mark the API level used
    touch "$api_marker"
    
    log_info "vcpkg dependencies installed for $triplet"
}

# Build DuckDB for a specific ABI
build_for_abi() {
    local abi=$1
    local platform_name="android_${abi}"
    local build_path="$BUILD_DIR/duckdb/build/${platform_name}"
    
    log_step "Building DuckDB for $abi..."
    
    mkdir -p "$build_path"
    cd "$build_path"
    
    local cmake_args=(
        -G "Ninja"
        -DEXTENSION_STATIC_BUILD=1
        -DDUCKDB_EXTRA_LINK_FLAGS="-llog -Wl,-z,max-page-size=16384"
        -DENABLE_EXTENSION_AUTOLOADING=1
        -DENABLE_EXTENSION_AUTOINSTALL=0
        -DCMAKE_VERBOSE_MAKEFILE=on
        -DANDROID_PLATFORM=android-${ANDROID_API_LEVEL}
        -DLOCAL_EXTENSION_REPO=""
        -DOVERRIDE_GIT_DESCRIBE=""
        -DDUCKDB_EXPLICIT_PLATFORM="${platform_name}"
        -DBUILD_UNITTESTS=0
        -DBUILD_SHELL=0
        -DANDROID_ABI="${abi}"
        -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake"
        -DCMAKE_BUILD_TYPE=Release
    )
    
    # Add extensions if specified
    if [ -n "$DUCKDB_EXTENSIONS" ]; then
        cmake_args+=(-DBUILD_EXTENSIONS="${DUCKDB_EXTENSIONS}")
        log_info "Building with extensions: $DUCKDB_EXTENSIONS"
    fi
    
    cmake "${cmake_args[@]}" ../..
    cmake --build . --config Release
    
    # Copy the built library
    local output_abi_dir="${OUTPUT_DIR}/jniLibs/${abi}"
    mkdir -p "$output_abi_dir"
    
    if [ -f "src/libduckdb.so" ]; then
        cp "src/libduckdb.so" "$output_abi_dir/"
        log_info "Copied libduckdb.so to $output_abi_dir"
    else
        log_error "libduckdb.so not found for $abi!"
        exit 1
    fi
}

# Build DuckDB with spatial extension for a specific ABI
# 
# Why we can't just use DUCKDB_EXTENSIONS="spatial":
# 1. Spatial is an OUT-OF-TREE extension (separate repo: github.com/duckdb/duckdb-spatial)
# 2. It requires vcpkg dependencies (GDAL, GEOS, PROJ) that must be cross-compiled for Android
# 3. These aren't in DuckDB's repo and can't be auto-fetched like in-tree extensions
#
# This function uses duckdb_extension_load() mechanism to build DuckDB + spatial together
build_spatial_for_abi() {
    local abi=$1
    local triplet=$2
    local platform_name="android_${abi}"
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local build_path="$spatial_dir/build/${platform_name}"
    
    log_step "Building DuckDB with spatial extension for $abi..."
    
    # Install vcpkg dependencies first (GDAL, GEOS, PROJ for Android)
    install_vcpkg_deps "$triplet"
    
    cd "$spatial_dir"
    
    local vcpkg_installed="$spatial_dir/vcpkg_installed/$triplet"
    
    # Verify vcpkg installation
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
    
    # Clean previous build for this platform
    rm -rf "$build_path"
    mkdir -p "$build_path"
    
    # The key insight: DuckDB's CMake uses DUCKDB_EXTENSION_CONFIGS to load extensions
    # The spatial extension's extension_config.cmake tells DuckDB how to build it
    # We point CMake at duckdb/ submodule as source, with spatial's config
    
    log_info "Running CMake configuration..."
    log_info "  Source: $spatial_dir/duckdb"
    log_info "  Extension config: $spatial_dir/extension_config.cmake"
    log_info "  vcpkg installed: $vcpkg_installed"
    
    local num_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
    local custom_triplets_dir="$spatial_dir/custom-triplets"
    
    # Use vcpkg toolchain with Android NDK chainloaded
    # This allows vcpkg to find packages while using Android NDK for compilation
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
        -DDUCKDB_EXTENSION_CONFIGS="$spatial_dir/extension_config.cmake" \
        -DSPATIAL_USE_NETWORK=ON \
        -DBUILD_SHELL=OFF \
        -DBUILD_UNITTESTS=OFF \
        -DENABLE_EXTENSION_AUTOLOADING=ON \
        -DENABLE_EXTENSION_AUTOINSTALL=OFF \
        -DDUCKDB_EXTRA_LINK_FLAGS="-llog -Wl,-z,max-page-size=16384" \
        -DDUCKDB_EXPLICIT_PLATFORM="$platform_name" \
        -DLOCAL_EXTENSION_REPO="" \
        -DOVERRIDE_GIT_DESCRIBE="" \
        ${DUCKDB_EXTENSIONS:+-DBUILD_EXTENSIONS="$DUCKDB_EXTENSIONS"} \
        -S "$spatial_dir/duckdb" \
        -B "$build_path"
    
    log_info "Building DuckDB with spatial extension..."
    cmake --build "$build_path" --config Release -- -j$num_cores
    
    # Copy the built library
    local output_abi_dir="${OUTPUT_DIR}/jniLibs/${abi}"
    mkdir -p "$output_abi_dir"
    
    if [ -f "$build_path/src/libduckdb.so" ]; then
        cp "$build_path/src/libduckdb.so" "$output_abi_dir/"
        log_info "Copied libduckdb.so to $output_abi_dir"
    else
        log_warn "libduckdb.so not found at expected location"
        log_info "Searching for .so files..."
        find "$build_path" -name "*.so" -type f 2>/dev/null | head -10
    fi
}

# Copy DuckDB headers
copy_headers() {
    log_info "Copying DuckDB headers..."
    
    local include_dir="${OUTPUT_DIR}/cpp/include"
    mkdir -p "$include_dir"
    
    # Copy the main C header
    cp "$BUILD_DIR/duckdb/src/include/duckdb.h" "$include_dir/"
    
    log_info "Headers copied to $include_dir"
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
        npx cap sync android
    fi
    
    # Build Android APK/Bundle
    cd "$PROJECT_ROOT/example-app/android"
    if [ -f "gradlew" ]; then
        log_info "Building Android release bundle..."
        ./gradlew bundleRelease
        log_info "Android build complete!"
        log_info "Bundle location: $PROJECT_ROOT/example-app/android/app/build/outputs/bundle/release/"
    else
        log_error "gradlew not found in example-app/android"
        exit 1
    fi
}

# Main build process
main() {
    log_info "=== DuckDB Android Build Script ==="
    log_info "Project root: $PROJECT_ROOT"
    
    check_tools
    check_ndk
    
    if [ "$BUILD_SPATIAL" = true ]; then
        # Spatial extension build (uses vcpkg + duckdb-spatial)
        log_info ""
        log_warn "⚠️  Building with SPATIAL extension requires significant time and disk space!"
        log_warn "   - GDAL, GEOS, PROJ will be compiled from source via vcpkg"
        log_warn "   - First build may take 30-60 minutes"
        log_warn "   - Requires ~5-10GB disk space"
        log_info ""
        
        check_vcpkg
        get_spatial_source
        
        # Build for both ABIs using vcpkg Android triplets
        build_spatial_for_abi "arm64-v8a" "arm64-android"
        build_spatial_for_abi "x86_64" "x64-android"
        
        # Copy headers from duckdb-spatial's duckdb submodule
        local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
        local include_dir="${OUTPUT_DIR}/cpp/include"
        mkdir -p "$include_dir"
        cp "$spatial_dir/duckdb/src/include/duckdb.h" "$include_dir/"
        log_info "Headers copied to $include_dir"
    else
        # Standard DuckDB build
        get_duckdb_source
        
        # Build for both ABIs
        build_for_abi "arm64-v8a"
        build_for_abi "x86_64"
        
        # Copy headers
        copy_headers
    fi
    
    log_info "=== Native build complete! ==="
    log_info "Native libraries are in: ${OUTPUT_DIR}/jniLibs/"
    log_info "Headers are in: ${OUTPUT_DIR}/cpp/include/"
    
    if [ "$BUILD_SPATIAL" = true ]; then
        log_info ""
        log_info "Spatial extension included! Available functions:"
        log_info "  - ST_Point, ST_LineString, ST_Polygon, etc."
        log_info "  - ST_Intersects, ST_Contains, ST_Distance, ST_Buffer, etc."
        log_info "  - ST_Transform (coordinate transformations)"
        log_info "  - ST_Read (GeoJSON, Shapefile, GeoParquet, etc.)"
    fi
    
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
        --build-app)
            BUILD_APP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --version VERSION    DuckDB version/branch to build (default: main)"
            echo "  --extensions LIST    Semicolon-separated list of extensions (e.g., 'icu;json;parquet')"
            echo "  --spatial            Build with spatial extension (GDAL, GEOS, PROJ via vcpkg)"
            echo "  --build-app          Also build the plugin and example app after native libs"
            echo "  --help               Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  ANDROID_NDK         Path to Android NDK (auto-detected if not set)"
            echo "  DUCKDB_VERSION      DuckDB version to build"
            echo "  DUCKDB_EXTENSIONS   Extensions to include"
            echo "  VCPKG_ROOT          Path to vcpkg (default: ~/vcpkg, required for --spatial)"
            echo ""
            echo "Examples:"
            echo "  # Build basic DuckDB"
            echo "  ./scripts/build-android.sh"
            echo ""
            echo "  # Build with common extensions"
            echo "  ./scripts/build-android.sh --extensions 'icu;json;parquet'"
            echo ""
            echo "  # Build with spatial extension (requires vcpkg)"
            echo "  ./scripts/build-android.sh --spatial"
            echo ""
            echo "Note: Spatial extension requires vcpkg to be installed:"
            echo "      git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
