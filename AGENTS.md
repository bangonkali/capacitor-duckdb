# Agent Guidelines

Capacitor plugin wrapping DuckDB for Android/iOS. Native libraries built from source with **all extensions statically linked**.

## ⚠️ CRITICAL: Static Linking Required

**Mobile platforms CANNOT dynamically load extensions.** All must be compiled into the binary.

### Included Extensions (Always Built)

| Extension | Type | Description |
|-----------|------|-------------|
| **vss** | Out-of-tree | Vector Similarity Search (HNSW indexes, vss_join, vss_match) |
| **duckpgq** | Out-of-tree | Graph Property Graph Queries (SQL/PGQ) |
| **spatial** | Out-of-tree | GIS/geometry (ST_Point, ST_Distance, GDAL/GEOS/PROJ) |
| **icu** | In-tree | Unicode support |
| **json** | In-tree | JSON parsing |
| **parquet** | In-tree | Parquet format |
| **inet** | In-tree | IP address functions |
| **tpch** | In-tree | TPC-H benchmarks |
| **tpcds** | In-tree | TPC-DS benchmarks |

## Extension Types

**In-tree** (in DuckDB's `extension/`): Enable via `-DBUILD_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds"`

**Out-of-tree** (separate repos): Enable via `-DDUCKDB_EXTENSION_CONFIGS="config1.cmake;config2.cmake"`

### The DONT_LINK Problem

Some extensions (e.g., VSS) have `DONT_LINK` in default config—builds but doesn't link. Causes:
```
Catalog Error: Table Function 'vss_join' not in catalog, but exists in vss extension
```

**Fix**: Create custom config WITHOUT `DONT_LINK`:
```cmake
duckdb_extension_load(vss SOURCE_DIR /path/to/duckdb-vss LOAD_TESTS)
```

### Verify Static Linking
```bash
nm -gC android/src/main/jniLibs/arm64-v8a/libduckdb.so | grep -E "(Spatial|Vss)Extension"
```
Should show `duckdb::VssExtension::Load()`, `duckdb::SpatialExtension::Load()`.

## Adding Extensions

**In-tree**: Add to `DUCKDB_EXTENSIONS` in build scripts.

**Out-of-tree**:
1. Clone repo to `build/{name}/`
2. Create config file WITHOUT `DONT_LINK`
3. Add to `DUCKDB_EXTENSION_CONFIGS`
4. Add vcpkg deps if needed

## vcpkg

Required for spatial (GDAL, GEOS, PROJ). Android API 28+ needed (`posix_spawn`, `getrandom`).

## File Locations

- Build scripts: `scripts/build-android.sh`, `scripts/build-ios.sh`
- VSS config: `build/vss/vss_extension_config.cmake`
- Sources: `build/spatial/duckdb-spatial/`, `build/vss/duckdb-vss/`
- Output: `android/src/main/jniLibs/{abi}/libduckdb.so`, `ios/Frameworks/DuckDB.xcframework/`
