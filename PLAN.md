# Capacitor DuckDB Android Plugin - Implementation Plan

## Overview

Build a Capacitor plugin using JNI to wrap DuckDB's C++ API for Android, with:
- Local `build.sh` script for building native libraries
- Support for arm64-v8a and x86_64 ABIs
- Single connection model per database
- JSON result serialization (column-name keyed arrays)
- Persistent storage using `getFilesDir()`
- **Static extension loading via C++ API** (required for spatial extension)

## Current Status ✅

**All core functionality is implemented and working:**
- ✅ DuckDB native library builds for Android (arm64-v8a, x86_64)
- ✅ DuckDB native library builds for iOS (arm64, x86_64 simulator)
- ✅ Spatial extension builds with vcpkg dependencies (GDAL, GEOS, PROJ)
- ✅ JNI bridge using DuckDB C++ API (Android)
- ✅ C++ Wrapper using DuckDB C++ API (iOS)
- ✅ Static extension loading (`LoadStaticExtension<SpatialExtension>()`)
- ✅ Prepared statements with proper parameter binding
- ✅ Export to Parquet with directory picker
- ✅ Integration test suite in example app

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    JavaScript Layer                         │
│  CapacitorDuckDb.open() / .query() / .execute() / .close() │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  TypeScript Definitions                     │
│                    src/definitions.ts                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Capacitor Plugin Bridge                       │
│              CapacitorDuckDbPlugin.java                     │
│           @PluginMethod annotations                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Implementation Layer                         │
│                  CapacitorDuckDb.java                       │
│         Connection management, path handling                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   JNI Native Bridge                         │
│                   DuckDBNative.java                         │
│            System.loadLibrary("capacitor_duckdb_jni")       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  C++ JNI Implementation                     │
│                     duckdb_jni.cpp                          │
│    DuckDB C++ API + LoadStaticExtension<SpatialExtension>   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   DuckDB Native Library                     │
│        libduckdb.so (with spatial extension linked)         │
│              (arm64-v8a / x86_64)                           │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Create PLAN.md ✅
Write implementation plan for reference.

### 2. Create build-android.sh script ✅
**File:** `scripts/build-android.sh`
- Clone DuckDB source from GitHub
- Build for arm64-v8a and x86_64 using NDK/CMake
- Copy `libduckdb.so` to `android/src/main/jniLibs/{abi}/`
- Copy DuckDB headers to `android/src/main/cpp/include/`
- Support `DUCKDB_EXTENSIONS` variable for custom extensions

### 3. Update android/build.gradle ✅
- Add `externalNativeBuild.cmake` block
- Set `ndk.abiFilters` for arm64-v8a, x86_64
- Configure `jniLibs.srcDirs`
- Set C++ standard to c++17

### 4. Create CMakeLists.txt ✅
**File:** `android/src/main/cpp/CMakeLists.txt`
- Define `capacitor_duckdb_jni` shared library
- Link against prebuilt `libduckdb.so`
- Include DuckDB C headers
- Link Android log library

### 5. Implement JNI wrapper ✅
**File:** `android/src/main/cpp/duckdb_jni.cpp`
- JNI functions: `openDatabase`, `closeDatabase`, `connect`, `disconnect`, `query`, `execute`
- **Use DuckDB C++ API** (not C API) for database/connection management
- **Explicitly call `LoadStaticExtension<SpatialExtension>()`** after database open
- Use `PreparedStatementWrapper` to store bindings between bind calls and execute
- Convert results to JSON using C++ result API (`result->names`, `result->types`)
- Return column-name keyed JSON arrays

**Key Implementation Details:**
```cpp
// Use C++ API to open database
duckdb::DuckDB db(path, &config);

// Explicitly load statically-linked spatial extension
db.LoadStaticExtension<duckdb::SpatialExtension>();

// Create C++ connection
duckdb::Connection conn(db);

// Execute queries using C++ API
auto result = conn.Query(sql);

// For prepared statements, use wrapper to store bindings
struct PreparedStatementWrapper {
    duckdb::unique_ptr<duckdb::PreparedStatement> stmt;
    duckdb::vector<duckdb::Value> bindings;
};

// Bind values (1-based index converted to 0-based)
wrapper->bindings[idx] = duckdb::Value::BIGINT(value);

// Execute with bindings
auto result = wrapper->stmt->Execute(wrapper->bindings, false);
```

**DuckDB C++ API Notes (as of late 2024/2025):**
- Use `result->names` and `result->types` (public members, not methods)
- Use `stmt->named_param_map.size()` to get parameter count (no `n_param`)
- Use `duckdb::vector<duckdb::Value>` for bindings (not `std::vector`)
- Use `Value::BIGINT()`, `Value::DOUBLE()`, `Value::BOOLEAN()` factory methods

### 6. Create Java native bridge ✅
**File:** `android/src/main/java/ph/com/regalado/capacitor/duckdb/DuckDBNative.java`
- Static block to load `capacitor_duckdb_jni` library
- Native method declarations with `long` handles for pointers
- Methods: `openDatabase`, `closeDatabase`, `connect`, `disconnect`, `query`, `execute`

### 7. Implement CapacitorDuckDb.java ✅
**File:** `android/src/main/java/ph/com/regalado/capacitor/duckdb/CapacitorDuckDb.java`
- `Map<String, Long>` for database handles
- `Map<String, Long>` for connection handles
- Use `context.getFilesDir() + "/duckdb/"` for database path
- Single connection per database (DuckDB supports multiple, but keeping simple for mobile)

### 8. Update CapacitorDuckDbPlugin.java ✅
**File:** `android/src/main/java/ph/com/regalado/capacitor/duckdb/CapacitorDuckDbPlugin.java`
- `@PluginMethod` for: `open`, `close`, `execute`, `query`, `getVersion`
- Initialize implementation with context in `load()`
- Parse JSON results to `JSObject`/`JSArray`

### 9. Update TypeScript definitions ✅
**File:** `src/definitions.ts`
```typescript
export interface CapacitorDuckDbPlugin {
  open(options: { database: string; readOnly?: boolean }): Promise<void>;
  close(options: { database: string }): Promise<void>;
  execute(options: { database: string; statements: string }): Promise<{ changes: number }>;
  query(options: { database: string; statement: string; values?: any[] }): Promise<{ values: Record<string, any>[] }>;
  getVersion(): Promise<{ version: string }>;
  echo(options: { value: string }): Promise<{ value: string }>;
}
```

### 10. Update web.ts stub ✅
**File:** `src/web.ts`
- Implement stub methods that throw "Not supported on web" errors

### 11. Build todo example app ✅
**Files:** `example-app/src/pages/Tab1.tsx`, etc.
- Ionic React todo list UI
- CRUD operations using DuckDB:
  - CREATE TABLE todos
  - INSERT INTO todos
  - SELECT * FROM todos
  - UPDATE todos SET completed
  - DELETE FROM todos

### 12. Create Integration Test Tab ✅
**File:** `example-app/src/pages/TestTab.tsx`
- Comprehensive test suite accessible via flask icon in bottom navigation
- Tests all functionality from TypeScript through JNI layer:
  - **Basic Operations** - open, close, getVersion
  - **DDL Operations** - CREATE TABLE, DROP TABLE
  - **DML Operations** - INSERT, SELECT, UPDATE, DELETE with prepared statements
  - **Data Types** - INTEGER, BIGINT, DOUBLE, BOOLEAN, VARCHAR, DATE, TIMESTAMP, NULL
  - **Spatial Extension** - Verified by calling ST_Point (not duckdb_extensions() which requires home_directory)
  - **Error Handling** - syntax errors, table not found
- Visual pass/fail indicators with timing
- Useful for verifying builds and debugging issues

### 13. Update README.md ✅
- Document `build-android.sh` usage
- NDK requirements and setup
- Environment variables (`ANDROID_NDK`, `DUCKDB_EXTENSIONS`)
- API documentation
- Extension support section
- Integration test documentation

## DuckDB Concurrency Notes

DuckDB supports:
- Multiple connections on one database
- Multiple readers OR single writer with readers
- For mobile simplicity: use single connection per database

## File Structure After Implementation

```
capacitor-duckdb/
├── PLAN.md
├── README.md
├── scripts/
│   └── build-android.sh
├── android/
│   ├── build.gradle
│   └── src/main/
│       ├── cpp/
│       │   ├── CMakeLists.txt
│       │   ├── duckdb_jni.cpp
│       │   └── include/
│       │       └── duckdb.h (copied by build script)
│       ├── jniLibs/
│       │   ├── arm64-v8a/
│       │   │   └── libduckdb.so
│       │   └── x86_64/
│       │       └── libduckdb.so
│       └── java/ph/com/regalado/capacitor/duckdb/
│           ├── CapacitorDuckDb.java
│           ├── CapacitorDuckDbPlugin.java
│           └── DuckDBNative.java
├── src/
│   ├── definitions.ts
│   ├── index.ts
│   └── web.ts
└── example-app/
    └── src/
        ├── index.html
        └── js/
            └── example.js
```

## Dependencies

- Android NDK (side-by-side install via Android Studio)
- CMake 3.22.1+
- Ninja build system
- Git (to clone DuckDB source)

## Notes on Extensions

### In-Tree vs Out-of-Tree Extensions

DuckDB has two types of extensions:

1. **In-tree extensions** - Live in DuckDB's `extension/` folder, can be enabled via `DUCKDB_EXTENSIONS`
2. **Out-of-tree extensions** - Live in separate repos, require special handling

To build with **in-tree** extensions, set `DUCKDB_EXTENSIONS`:
```bash
# These are IN-TREE and work with DUCKDB_EXTENSIONS variable
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh
```

### Why `DUCKDB_EXTENSIONS="spatial"` Doesn't Work

The spatial extension is an **out-of-tree extension** that:
1. Lives in a separate repo (`github.com/duckdb/duckdb-spatial`)
2. Requires vcpkg dependencies (GDAL, GEOS, PROJ) that must be cross-compiled
3. Is currently commented out in DuckDB's CI due to ongoing geometry refactor

Therefore, use `--spatial` flag instead:
```bash
./scripts/build-android.sh --spatial
```

### Android-Compatible In-Tree Extensions

| Extension | Description | Status |
|-----------|-------------|--------|
| `icu` | Unicode support, date/time formatting | ✅ Works |
| `json` | JSON parsing and generation | ✅ Works |
| `parquet` | Parquet file format | ✅ Works |
| `inet` | Network address types | ✅ Works |
| `tpch` | TPC-H benchmark generator | ✅ Works |
| `tpcds` | TPC-DS benchmark generator | ✅ Works |
| `vss` | Vector similarity search | ✅ Works (API 28+) |

### Out-of-Tree Extensions (require special handling)

| Extension | Reason | Solution |
|-----------|--------|----------|
| `spatial` | Out-of-tree, requires GDAL/GEOS/PROJ | **✅ Use `--spatial` flag** |
| `azure` | Requires Azure SDK C++ (vcpkg) | N/A for mobile |
| `aws` | Requires AWS SDK C++ | N/A for mobile |
| `postgres` | Requires libpq | N/A for mobile |
| `mysql` | Requires MySQL client library | N/A for mobile |
| `sqlite` | Requires SQLite library | N/A for mobile |
| `excel` | Requires EXPAT library | N/A for mobile |
| `fts` | Requires Snowball stemmer library | N/A for mobile |

### Spatial Extension for Android 🌍

The spatial extension CAN be built for Android using vcpkg to cross-compile GDAL, GEOS, and PROJ:

```bash
# Build DuckDB with spatial extension for Android
./scripts/build-android.sh --spatial
```

**Requirements:**
- vcpkg installed: `git clone https://github.com/Microsoft/vcpkg.git && ./vcpkg/bootstrap-vcpkg.sh`
- Android NDK (auto-detected from Android Studio)
- ~5-10GB disk space
- 30-60 minutes build time (first build)

**What gets built:**
- **GEOS 3.13.0** - Geometry Engine Open Source
- **PROJ 9.1.1** - Cartographic projection library
- **GDAL 3.8.5** - Geospatial Data Abstraction Library
- **duckdb-spatial** - DuckDB spatial extension

**Size impact:**
- Base DuckDB: ~20MB per ABI
- With Spatial: ~50-80MB per ABI (includes GDAL, GEOS, PROJ)

**Available spatial functions:**
- Geometry types: `GEOMETRY`, `POINT`, `LINESTRING`, `POLYGON`, etc.
- Spatial operations: `ST_Intersects`, `ST_Contains`, `ST_Distance`, `ST_Buffer`, etc.
- Coordinate transforms: `ST_Transform` (with PROJ support)
- File I/O: GeoJSON, Shapefile, GeoParquet, etc.

**Verifying Spatial is Loaded:**

⚠️ **Important:** `duckdb_extensions()` does NOT work on Android because it requires `home_directory` to be set. Verify spatial by calling a spatial function instead:

```sql
-- ✅ This works - call a spatial function directly
SELECT ST_AsText(ST_Point(0, 0)) as test;
-- Returns: "POINT (0 0)"

-- ❌ This fails on Android with "home_directory" error
SELECT * FROM duckdb_extensions() WHERE extension_name = 'spatial';
```

**Note:** `ST_Version()` and `ST_GEOSVersion()` functions do NOT exist in the DuckDB spatial extension. Use `DuckDB_PROJ_Compiled_Version()` to check PROJ version if needed.

**Warning:** Extensions increase library size significantly. Base DuckDB is ~20MB per ABI.

## Spatial Demo App 🌍

The example app includes a comprehensive spatial demo that showcases all major DuckDB spatial functions:

### Features

- **Interactive Map** - OpenLayers with OpenStreetMap tiles
- **Natural Earth Data** - 1:110m scale sample data (countries, cities, airports, rivers, lakes)
- **Drawing Tools** - Touch-friendly toolbar for creating points, lines, and polygons
- **8 Demo Categories** - 50+ spatial functions organized by type:
  1. **Constructors** - ST_Point, ST_MakeLine, ST_MakePolygon, ST_GeomFromText
  2. **Predicates** - ST_Intersects, ST_Contains, ST_Within, ST_DWithin
  3. **Measurements** - ST_Distance, ST_Distance_Spheroid, ST_Area, ST_Length
  4. **Processing** - ST_Buffer, ST_Union, ST_Intersection, ST_ConvexHull
  5. **Transforms** - ST_Transform, ST_Simplify, ST_SetSRID
  6. **Aggregates** - ST_Union_Agg, ST_Collect_Agg, ST_Extent_Agg
  7. **Line Operations** - ST_LineInterpolatePoint, ST_LineSubstring
  8. **I/O Formats** - ST_AsGeoJSON, ST_AsText, ST_AsWKB

### Natural Earth Data Flow (Latest)

- GeoJSON source files live under `example-app/src/data/geojson`. They are no longer imported directly by the map component.
- `spatialService.initialize()` seeds each dataset into DuckDB tables (`ne_countries`, `ne_cities`, etc.) using `ST_GeomFromText`/`ST_GeomFromGeoJSON`.
- `spatialService.getLayerGeoJSON(layer)` now queries DuckDB (`ST_AsGeoJSON(geometry)`) and assembles FeatureCollections.
- `MapView` pulls every visible layer through this service so OpenLayers always renders the same data DuckDB uses for queries.
- This keeps the Natural Earth data path consistent: **GeoJSON → DuckDB tables → Map rendering**.

### Running the Spatial Demo

```bash
# 1. Build DuckDB with spatial extension
DUCKDB_EXTENSIONS="icu;json;parquet" ./scripts/build-android.sh --spatial

# 2. Install example app dependencies
cd example-app
npm install

# 3. Run on Android
npm run build
npx cap sync android
npx cap run android
```

### Data Sources

- **Natural Earth** - Public domain map data from [naturalearthdata.com](https://naturalearthdata.com)
- **OpenStreetMap** - Map tiles via OpenLayers

### Vite Configuration Note

⚠️ **GeoJSON files must use `.json` extension** for Vite to parse them correctly. Using `.geojson` with `assetsInclude` causes Vite to return file URLs instead of parsed JSON objects, breaking the spatial demo data loading.

```typescript
// ✅ Correct - use .json extension
import countriesData from './geojson/countries.json';

// ❌ Wrong - Vite returns URL string, not parsed JSON
import countriesData from './geojson/countries.geojson';
```

### Dependencies

- **OpenLayers 10.2.1** - Map rendering
- **proj4 2.12.1** - Coordinate transforms
- **@capacitor/haptics** - Touch feedback

## Future Work

### iOS Support 🍎
iOS support is now implemented! ✅
- [x] Create `ios/Sources/CapacitorDuckDbPlugin/` Swift implementation
- [x] Build DuckDB for iOS arm64 using CMake
- [x] Create Swift JNI-equivalent native bridge
- [x] Support static extension loading for spatial
- [x] Test on iOS Simulator and physical devices

### Additional Features
- [ ] Transaction support (BEGIN, COMMIT, ROLLBACK)
- [ ] Streaming large result sets
- [ ] Import from Parquet/CSV files
- [ ] Multiple concurrent connections
- [ ] Attach external databases
