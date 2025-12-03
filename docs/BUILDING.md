# Building Native Libraries

This guide covers how to build the native DuckDB libraries for Android and iOS. This is a prerequisite for using the plugin, as the native binaries are not distributed with the npm package to keep it lightweight.

## Monolithic Build Philosophy

This project builds **monolithic** DuckDB binaries with **all extensions statically linked**:

- **spatial** - GIS/geometry functions (ST_Point, ST_Distance, ST_Buffer, etc.)
- **vss** - Vector Similarity Search (HNSW indexes, vss_join, vss_match)
- **icu** - International Components for Unicode
- **json** - JSON parsing and generation
- **parquet** - Parquet file format support
- **inet** - IP address functions
- **tpch** - TPC-H benchmark queries
- **tpcds** - TPC-DS benchmark queries

### Why Monolithic?

Mobile platforms (Android/iOS) discourage dynamic library loading:
- No reliable extension download mechanism on mobile
- All functionality available offline immediately after app install
- Simplified deployment - single binary, no extension management
- Ideal for offline-first applications (RAG systems, embedded databases)

## Prerequisites

### General
- **Node.js** & **npm**
- **Git**
- **CMake**: `brew install cmake`
- **Ninja**: `brew install ninja`

### vcpkg (Required)

The spatial extension requires vcpkg to build GDAL, GEOS, and PROJ dependencies:

```bash
git clone https://github.com/Microsoft/vcpkg.git ~/vcpkg
~/vcpkg/bootstrap-vcpkg.sh
export VCPKG_ROOT=$HOME/vcpkg

# Add to ~/.zshrc for persistence
echo 'export VCPKG_ROOT=$HOME/vcpkg' >> ~/.zshrc
```

### Android-specific
1. **Android NDK**: Install via Android Studio.
   - Open Android Studio → Tools → SDK Manager → SDK Tools tab.
   - Check "NDK (Side by side)".
   - Recommended: NDK 28.x or later.

### iOS-specific
1. **Xcode**: Install via Mac App Store.
2. **CocoaPods**: `sudo gem install cocoapods`

## Building for Android

```bash
# Build native libraries
./scripts/build-android.sh

# Build native libraries AND the example app
./scripts/build-android.sh --build-app

# Specify a DuckDB version/branch
./scripts/build-android.sh --version v1.3.0
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANDROID_NDK` | Path to Android NDK | Auto-detected |
| `VCPKG_ROOT` | Path to vcpkg | `~/vcpkg` |
| `DUCKDB_VERSION` | DuckDB version/branch | `main` |
| `ANDROID_API_LEVEL` | Minimum Android API | `28` |

### Output Artifacts

```
android/src/main/jniLibs/
├── arm64-v8a/
│   └── libduckdb.so          # ~80-100MB
└── x86_64/
    └── libduckdb.so

android/src/main/cpp/include/
└── duckdb.h                   # C API header
```

## Building for iOS

```bash
# Build XCFramework
./scripts/build-ios.sh

# Build XCFramework AND the example app
./scripts/build-ios.sh --build-app

# Specify a DuckDB version/branch
./scripts/build-ios.sh --version v1.3.0
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VCPKG_ROOT` | Path to vcpkg | `~/vcpkg` |
| `DUCKDB_VERSION` | DuckDB version/branch | `main` |

### Output Artifacts

```
ios/Frameworks/
└── DuckDB.xcframework/
    ├── ios-arm64/              # Device (arm64)
    │   └── libduckdb.a
    └── ios-arm64_x86_64-simulator/  # Simulator (fat)
        └── libduckdb.a
```

## Build Times

| Phase | First Build | Subsequent |
|-------|-------------|------------|
| vcpkg deps (GDAL, GEOS, PROJ) | 30-60 min | cached |
| DuckDB + extensions | 10-20 min | 5-10 min |
| **Total** | **40-80 min** | **5-10 min** |

The vcpkg dependencies are cached per triplet (arm64-android, x64-android, arm64-ios, etc.), so subsequent builds are much faster.

## Verifying Extensions

After building, verify that extensions are statically linked:

```bash
# Android (check for extension symbols)
nm -gC android/src/main/jniLibs/arm64-v8a/libduckdb.so | grep -E "(Spatial|Vss|Icu|Json|Parquet)Extension"

# iOS
nm ios/Frameworks/DuckDB.xcframework/ios-arm64/libduckdb.a 2>/dev/null | grep -E "(Spatial|Vss|Icu)Extension"
```

Expected output includes:
- `SpatialExtension::Load`
- `VssExtension::Load`
- `IcuExtension::Load`
- etc.

## Troubleshooting

### vcpkg not found
```
Error: vcpkg not found at /Users/xxx/vcpkg
```
**Solution**: Install vcpkg as described in Prerequisites.

### Android NDK not found
```
Error: Android NDK not found!
```
**Solution**: Install NDK via Android Studio or set `ANDROID_NDK` environment variable.

### VSS functions not working
```
Catalog Error: Table Function with name 'vss_join' is not in the catalog
```
**Solution**: The build scripts now automatically create a custom VSS extension config that forces static linking. Re-run the build script.

### Out of disk space
The build requires ~10-20GB of disk space for:
- vcpkg dependencies and build cache
- DuckDB source and build artifacts
- Multiple architecture builds

### Build failures with API level errors
```
error: posix_spawn was not declared in this scope
```
**Solution**: Ensure `ANDROID_API_LEVEL=28` or higher (default is 28).

## CI/CD

For CI builds, ensure vcpkg is installed and cached:

```yaml
# GitHub Actions example
- name: Setup vcpkg
  run: |
    git clone https://github.com/Microsoft/vcpkg.git ~/vcpkg
    ~/vcpkg/bootstrap-vcpkg.sh
    echo "VCPKG_ROOT=$HOME/vcpkg" >> $GITHUB_ENV

- name: Build Android
  run: ./scripts/build-android.sh
```

Consider caching `~/vcpkg/installed` and `build/spatial/duckdb-spatial/vcpkg_installed` directories to speed up CI builds.
