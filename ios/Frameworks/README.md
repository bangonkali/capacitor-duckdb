# DuckDB XCFramework Directory

This directory contains the DuckDB XCFramework for iOS.

## Building

Run the build script to generate the XCFramework:

```bash
./scripts/build-ios.sh
```

This will create `DuckDB.xcframework` with:
- `ios-arm64/` - Physical iOS devices (iPhone, iPad)
- `ios-arm64_x86_64-simulator/` - iOS Simulator (universal binary for Apple Silicon and Intel Macs)

## Static Library Approach

The XCFramework contains **static libraries** (`.a` files), not dynamic frameworks.
This approach is preferred for iOS because:

1. **No code signing issues** - Dynamic frameworks require special signing for distribution
2. **Smaller app size** - Dead code elimination removes unused DuckDB features
3. **Faster startup** - No dynamic library loading at launch time
4. **Consistency** - Matches the Android build approach (static extensions linked into shared library)

## Contents (after build)

```
DuckDB.xcframework/
├── Info.plist
├── ios-arm64/
│   └── libduckdb_static.a
└── ios-arm64_x86_64-simulator/
    └── libduckdb_static.a
```

## Extensions Included

By default, the build includes:
- **Spatial** (GDAL, GEOS, PROJ) - Geographic data processing
- **VSS** - Vector Similarity Search for AI/ML embeddings
- **Parquet** - Column-oriented file format
- **JSON** - JSON parsing and generation
- **ICU** - International Components for Unicode

## Note

The actual `.xcframework` contents are git-ignored to keep the repository size manageable.
You must run the build script to generate it locally.
