#!/bin/bash
# Verify spatial extension build for Android
# This script checks if the vcpkg dependencies and libraries were built correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_ROOT}/build/spatial"
VCPKG_INSTALLED="${BUILD_DIR}/duckdb-spatial/vcpkg_installed"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo "=== Verifying Spatial Extension Build ==="
echo ""

# Check arm64-android
echo "Checking arm64-android libraries..."
ARM64_DIR="${VCPKG_INSTALLED}/arm64-android"

if [ -d "$ARM64_DIR" ]; then
    log_info "arm64-android directory exists"
    
    # Check for key libraries
    for lib in libgeos.a libgeos_c.a libproj.a libgdal.a; do
        if [ -f "$ARM64_DIR/lib/$lib" ]; then
            size=$(ls -lh "$ARM64_DIR/lib/$lib" | awk '{print $5}')
            log_info "$lib ($size)"
        else
            log_error "$lib not found!"
        fi
    done
    
    # Check headers
    if [ -d "$ARM64_DIR/include" ]; then
        log_info "Headers directory exists"
        for header in geos_c.h proj.h gdal.h; do
            if [ -f "$ARM64_DIR/include/$header" ]; then
                log_info "  $header found"
            else
                log_warn "  $header not found"
            fi
        done
    fi
else
    log_error "arm64-android directory not found at $ARM64_DIR"
fi

echo ""

# Check x64-android
echo "Checking x64-android libraries..."
X64_DIR="${VCPKG_INSTALLED}/x64-android"

if [ -d "$X64_DIR" ]; then
    log_info "x64-android directory exists"
    
    for lib in libgeos.a libgeos_c.a libproj.a libgdal.a; do
        if [ -f "$X64_DIR/lib/$lib" ]; then
            size=$(ls -lh "$X64_DIR/lib/$lib" | awk '{print $5}')
            log_info "$lib ($size)"
        else
            log_error "$lib not found!"
        fi
    done
else
    log_warn "x64-android directory not found (run build for x64-android)"
fi

echo ""

# Check jniLibs output
echo "Checking jniLibs output..."
JNILIBS_DIR="${PROJECT_ROOT}/android/src/main/jniLibs"

for abi in arm64-v8a x86_64; do
    if [ -d "$JNILIBS_DIR/$abi" ]; then
        log_info "$abi directory exists"
        ls -lh "$JNILIBS_DIR/$abi/"*.so 2>/dev/null || log_warn "  No .so files found"
    else
        log_warn "$abi jniLibs directory not found"
    fi
done

echo ""
echo "=== Verification Complete ==="
