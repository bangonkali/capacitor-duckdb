#!/bin/bash
# Build DuckDB native libraries for iOS
# Creates a universal XCFramework for devices and simulators
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
# Why monolithic? Mobile platforms (iOS) discourage dynamic loading.
# All functionality is available offline immediately after app install.
#
# Prerequisites:
#   - Xcode with command line tools
#   - vcpkg: git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh
#   - cmake, ninja, git
#
# Usage:
#   ./scripts/build-ios.sh              # Build XCFramework
#   ./scripts/build-ios.sh --build-app  # Also build example app

set -e

# Configuration
DUCKDB_VERSION="${DUCKDB_VERSION:-main}"
# All extensions - always included, statically linked
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds"
BUILD_APP=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/ios/Frameworks"

# vcpkg settings (required for spatial extension)
VCPKG_ROOT="${VCPKG_ROOT:-$HOME/vcpkg}"

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
    
    if ! command -v xcodebuild &> /dev/null; then
        missing_tools+=("xcode-select")
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

# Install vcpkg dependencies for iOS
install_vcpkg_deps() {
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
    log_info "This may take 30-60 minutes on first run (building GDAL, GEOS, PROJ from source)..."
    
    cd "$spatial_dir"
    
    # Backup original vcpkg.json
    if [ ! -f "$spatial_dir/vcpkg.json.original" ]; then
        cp "$spatial_dir/vcpkg.json" "$spatial_dir/vcpkg.json.original"
    fi
    
    # Restore original vcpkg.json for iOS (curl not needed on iOS)
    cp "$spatial_dir/vcpkg.json.original" "$spatial_dir/vcpkg.json"
    
    # Install dependencies
    "$VCPKG_ROOT/vcpkg" install \
        --triplet="$triplet" \
        --host-triplet="$host_triplet" \
        --x-install-root="$spatial_dir/vcpkg_installed"
    
    log_info "vcpkg dependencies installed for $triplet"
}

# Build DuckDB for a specific iOS platform
build_for_platform() {
    local platform=$1        # iphoneos or iphonesimulator
    local arch=$2            # arm64 or x86_64
    local triplet=$3         # vcpkg triplet
    local platform_name=$4   # for output naming
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local build_path="$spatial_dir/build/${platform_name}"
    local vss_config="${PROJECT_ROOT}/build/vss/vss_extension_config.cmake"
    
    log_step "Building DuckDB for ${platform} (${arch})..."
    
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
    if [[ "$(uname -m)" == "arm64" ]]; then
        host_triplet="arm64-osx"
    else
        host_triplet="x64-osx"
    fi
    
    # Clean previous build
    rm -rf "$build_path"
    mkdir -p "$build_path"
    
    # Get SDK path
    local sdk_path=$(xcrun --sdk "${platform}" --show-sdk-path)
    local deployment_target="13.0"
    
    log_info "Running CMake configuration..."
    log_info "  Platform: $platform"
    log_info "  Architecture: $arch"
    log_info "  SDK: $sdk_path"
    log_info "  Extension configs: spatial + vss"
    log_info "  In-tree extensions: $DUCKDB_EXTENSIONS"
    
    local num_cores=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
    
    # iOS platform settings
    local system_name="iOS"
    if [[ "$platform" == "iphonesimulator" ]]; then
        system_name="iOS"
    fi
    
    # Build with vcpkg toolchain
    cmake -G "Ninja" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" \
        -DVCPKG_TARGET_TRIPLET="$triplet" \
        -DVCPKG_HOST_TRIPLET="$host_triplet" \
        -DVCPKG_INSTALLED_DIR="$spatial_dir/vcpkg_installed" \
        -DVCPKG_OVERLAY_PORTS="$spatial_dir/vcpkg_ports" \
        -DCMAKE_SYSTEM_NAME="$system_name" \
        -DCMAKE_OSX_ARCHITECTURES="$arch" \
        -DCMAKE_OSX_SYSROOT="$sdk_path" \
        -DCMAKE_OSX_DEPLOYMENT_TARGET="$deployment_target" \
        -DEXTENSION_STATIC_BUILD=ON \
        -DDUCKDB_EXTENSION_CONFIGS="$spatial_dir/extension_config.cmake;$vss_config" \
        -DSPATIAL_USE_NETWORK=OFF \
        -DBUILD_SHELL=OFF \
        -DBUILD_UNITTESTS=OFF \
        -DENABLE_EXTENSION_AUTOLOADING=ON \
        -DENABLE_EXTENSION_AUTOINSTALL=OFF \
        -DDUCKDB_EXPLICIT_PLATFORM="$platform_name" \
        -DLOCAL_EXTENSION_REPO="" \
        -DOVERRIDE_GIT_DESCRIBE="" \
        -DBUILD_EXTENSIONS="$DUCKDB_EXTENSIONS" \
        -S "$spatial_dir/duckdb" \
        -B "$build_path"
    
    log_info "Building DuckDB (this may take a while)..."
    cmake --build "$build_path" --config Release -- -j$num_cores
    
    # Verify the build output
    if [ -f "$build_path/src/libduckdb.a" ]; then
        log_info "Built: $build_path/src/libduckdb.a"
        log_info "Size: $(du -h "$build_path/src/libduckdb.a" | cut -f1)"
    else
        log_error "Build failed - libduckdb.a not found!"
        find "$build_path" -name "*.a" -type f 2>/dev/null | head -10
        exit 1
    fi
}

# Create fat library for multiple architectures
create_fat_library() {
    local output=$1
    shift
    local inputs=("$@")
    
    log_info "Creating fat library at $output from ${#inputs[@]} inputs..."
    
    mkdir -p "$(dirname "$output")"
    lipo -create "${inputs[@]}" -output "$output"
    
    log_info "Fat library created: $(du -h "$output" | cut -f1)"
}

# Create XCFramework
create_xcframework() {
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local xcframework_path="${OUTPUT_DIR}/DuckDB.xcframework"
    
    log_step "Creating XCFramework..."
    
    # Remove old xcframework
    rm -rf "$xcframework_path"
    
    # Create library directories
    mkdir -p "$spatial_dir/build/lib-device"
    mkdir -p "$spatial_dir/build/lib-simulator"
    
    # Device library (arm64 only)
    local device_lib="$spatial_dir/build/ios_arm64/src/libduckdb.a"
    
    # Simulator fat library (arm64 + x86_64)
    local sim_arm64="$spatial_dir/build/ios_arm64_simulator/src/libduckdb.a"
    local sim_x64="$spatial_dir/build/ios_x64_simulator/src/libduckdb.a"
    local sim_fat="$spatial_dir/build/lib-simulator/libduckdb.a"
    
    create_fat_library "$sim_fat" "$sim_arm64" "$sim_x64"
    
    # Create XCFramework
    xcodebuild -create-xcframework \
        -library "$device_lib" \
        -library "$sim_fat" \
        -output "$xcframework_path"
    
    log_info "XCFramework created at: $xcframework_path"
    
    # Show contents
    log_info "XCFramework contents:"
    find "$xcframework_path" -name "*.a" -exec du -h {} \;
}

# Copy DuckDB headers to XCFramework
copy_headers() {
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local xcframework_path="${OUTPUT_DIR}/DuckDB.xcframework"
    
    log_info "Copying DuckDB headers..."
    
    # Find the platform directories in the xcframework
    for platform_dir in "$xcframework_path"/*; do
        if [ -d "$platform_dir" ]; then
            local headers_dir="$platform_dir/Headers"
            mkdir -p "$headers_dir"
            cp "$spatial_dir/duckdb/src/include/duckdb.h" "$headers_dir/"
            log_info "Headers copied to $headers_dir"
        fi
    done
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
        npx cap sync ios
    fi
    
    cd "$PROJECT_ROOT/example-app/ios/App"
    if [ -f "App.xcworkspace" ]; then
        xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -destination 'generic/platform=iOS' \
            -derivedDataPath "$PROJECT_ROOT/example-app/ios/build" \
            build
        log_info "Build complete: $PROJECT_ROOT/example-app/ios/build"
    fi
}

# Verify extensions are statically linked
verify_extensions() {
    local spatial_dir="${PROJECT_ROOT}/build/spatial/duckdb-spatial"
    local lib_path="$spatial_dir/build/ios_arm64/src/libduckdb.a"
    
    log_step "Verifying extensions are statically linked..."
    
    if [ ! -f "$lib_path" ]; then
        log_warn "Library not found for verification"
        return
    fi
    
    log_info "Checking for extension symbols..."
    
    local missing=()
    
    if nm "$lib_path" 2>/dev/null | grep -q "SpatialExtension"; then
        log_info "  ✓ Spatial extension found"
    else
        missing+=("spatial")
    fi
    
    if nm "$lib_path" 2>/dev/null | grep -q "VssExtension"; then
        log_info "  ✓ VSS extension found"
    else
        missing+=("vss")
    fi
    
    if nm "$lib_path" 2>/dev/null | grep -q "IcuExtension"; then
        log_info "  ✓ ICU extension found"
    else
        missing+=("icu")
    fi
    
    if nm "$lib_path" 2>/dev/null | grep -q "JsonExtension"; then
        log_info "  ✓ JSON extension found"
    else
        missing+=("json")
    fi
    
    if nm "$lib_path" 2>/dev/null | grep -q "ParquetExtension"; then
        log_info "  ✓ Parquet extension found"
    else
        missing+=("parquet")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_warn "Some extensions may be missing symbols: ${missing[*]}"
        log_warn "This might be okay if the extension uses a different naming convention"
    else
        log_info "All major extensions appear to be linked!"
    fi
}

# Main build process
main() {
    log_info "=== DuckDB iOS Build Script (Monolithic) ==="
    log_info ""
    log_info "Building DuckDB with ALL extensions statically linked:"
    log_info "  - spatial (GIS: ST_Point, ST_Distance, ST_Buffer, etc.)"
    log_info "  - vss (Vector Search: HNSW indexes, vss_join, vss_match)"
    log_info "  - icu (Unicode support)"
    log_info "  - json (JSON functions)"
    log_info "  - parquet (Parquet file format)"
    log_info "  - inet (IP address functions)"
    log_info "  - tpch, tpcds (Benchmark queries)"
    log_info ""
    
    check_tools
    check_vcpkg
    
    # Get extension sources
    get_spatial_source
    get_vss_source
    create_vss_extension_config
    
    log_warn "⚠️  First build takes 30-60 minutes (compiling GDAL, GEOS, PROJ)"
    log_warn "   Subsequent builds are much faster (cached)"
    log_info ""
    
    # Build for all iOS platforms
    # Device (arm64)
    build_for_platform "iphoneos" "arm64" "arm64-ios" "ios_arm64"
    
    # Simulator (arm64 for Apple Silicon Macs)
    build_for_platform "iphonesimulator" "arm64" "arm64-ios-simulator" "ios_arm64_simulator"
    
    # Simulator (x86_64 for Intel Macs)
    build_for_platform "iphonesimulator" "x86_64" "x64-ios-simulator" "ios_x64_simulator"
    
    # Create XCFramework
    create_xcframework
    
    # Copy headers
    copy_headers
    
    # Verify extensions
    verify_extensions
    
    log_info ""
    log_info "=== Build complete! ==="
    log_info "Output: ${OUTPUT_DIR}/DuckDB.xcframework"
    log_info ""
    log_info "All extensions are statically linked and available offline."
    
    if [ "$BUILD_APP" = true ]; then
        build_example_app
    else
        log_info ""
        log_info "To build the example app: ./scripts/build-ios.sh --build-app"
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
            echo "Builds a monolithic DuckDB XCFramework with ALL extensions statically linked."
            echo ""
            echo "Options:"
            echo "  --version VERSION    DuckDB version/branch (default: main)"
            echo "  --build-app          Also build the example app"
            echo "  --help               Show this help"
            echo ""
            echo "Environment variables:"
            echo "  VCPKG_ROOT           Path to vcpkg (default: ~/vcpkg)"
            echo "  DUCKDB_VERSION       DuckDB version to build"
            echo ""
            echo "Included extensions (always):"
            echo "  spatial, vss, icu, json, parquet, inet, tpch, tpcds"
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
