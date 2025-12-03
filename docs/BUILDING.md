# Building Native Libraries

This guide covers how to build the native DuckDB libraries for Android and iOS. This is a prerequisite for using the plugin, as the native binaries are not distributed with the npm package to keep it lightweight and allow for custom extension selection.

## Prerequisites

### General
*   **Node.js** & **npm**
*   **Git**

### Android
1.  **Android NDK**: Install via Android Studio.
    *   Open Android Studio → Tools → SDK Manager → SDK Tools tab.
    *   Check "NDK (Side by side)".
    *   Recommended: NDK 28.0.12433566 or later.
2.  **CMake**: `brew install cmake` (macOS) or via package manager.
3.  **Ninja**: `brew install ninja` (macOS) or via package manager.

### iOS
1.  **Xcode**: Install via Mac App Store.
2.  **CocoaPods**: `sudo gem install cocoapods`.

### Spatial Extension Requirements
If you plan to build with the Spatial extension (enabled by default in build scripts), you need **vcpkg** to cross-compile dependencies (GDAL, GEOS, PROJ).

```bash
git clone https://github.com/Microsoft/vcpkg.git ~/vcpkg
~/vcpkg/bootstrap-vcpkg.sh
export VCPKG_ROOT=$HOME/vcpkg
# Add to ~/.zshrc or ~/.bashrc for persistence
echo 'export VCPKG_ROOT=$HOME/vcpkg' >> ~/.zshrc
```

## Building for Android

The `scripts/build-android.sh` script handles the complex process of cross-compiling DuckDB and its dependencies for Android (`arm64-v8a` and `x86_64`).

### Quick Start

```bash
# Build with spatial + common in-tree extensions (Recommended)
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh --spatial
```

### Build Options

```bash
# Build with default settings (main branch, no extensions)
./scripts/build-android.sh

# Build specific version
./scripts/build-android.sh --version v1.1.3

# Build with in-tree extensions only
DUCKDB_EXTENSIONS="icu;json;parquet" ./scripts/build-android.sh

# Build with spatial extension only
./scripts/build-android.sh --spatial

# Build native libs AND the example app in one step
./scripts/build-android.sh --build-app
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANDROID_NDK` | Path to Android NDK | Auto-detected from Android Studio |
| `DUCKDB_VERSION` | DuckDB version/branch | `main` |
| `DUCKDB_EXTENSIONS` | Semicolon-separated in-tree extensions | None |
| `VCPKG_ROOT` | Path to vcpkg | `~/vcpkg` |

### Output Artifacts

```
android/src/main/jniLibs/
├── arm64-v8a/
│   └── libduckdb.so          # ~50-80MB with spatial
└── x86_64/
    └── libduckdb.so

android/src/main/cpp/include/
└── duckdb.h                   # C API header
```

## Building for iOS

The `scripts/build-ios.sh` script compiles DuckDB as a static library, creates an XCFramework, and copies the necessary C/C++ headers to the plugin source directory.

### Quick Start

```bash
# Build DuckDB for iOS (Device + Simulator) with spatial extension
./scripts/build-ios.sh --spatial
```

**Note:** The build script automatically populates `ios/Sources/CapacitorDuckDbPlugin/include/` with the required headers (`duckdb.h`, `duckdb.hpp`, etc.). These files should be git-ignored as they are build artifacts.

## DuckDB Extensions

DuckDB has two types of extensions:

1.  **In-tree extensions**: Live in DuckDB's `extension/` folder. Enabled via `DUCKDB_EXTENSIONS`.
    *   Examples: `icu`, `json`, `parquet`, `inet`, `tpch`, `tpcds`, `vss`.
2.  **Out-of-tree extensions**: Live in separate repos. Require special handling.
    *   Example: `spatial`.

### Spatial Extension (Out-of-Tree) 🌍

The spatial extension requires **vcpkg** to build dependencies (GDAL, GEOS, PROJ).

**`DUCKDB_EXTENSIONS="spatial"` will NOT work**. You must use the `--spatial` flag with the build scripts.

**Impact:**
*   **Build Time**: 30-60 minutes for the first build (cached afterwards).
*   **Size**: Adds ~30-40MB per ABI.

### Custom Extension Build

For advanced configuration, you can modify the build scripts or run CMake manually. See the `scripts/` folder for the implementation details.
