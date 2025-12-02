# @bangonkali/capacitor-duckdb

This project is entirely AI Vibe Coded at the moment!

A native DuckDB plugin for Capacitor-based Android and iOS applications. Uses JNI to directly wrap DuckDB's C++ API for maximum performance and proper extension support.

## Features

- 🦆 Native DuckDB integration via JNI with C++ API
- 📱 Android support (arm64-v8a, x86_64)
- 📁 Persistent storage using app's internal storage
- 🔄 Full SQL support (CREATE, SELECT, INSERT, UPDATE, DELETE)
- 📊 JSON result format with column-name keys
- ⚡ Prepared statements with parameter binding
- 🌍 **Spatial Extension** - Full GIS support with GDAL, GEOS, PROJ
- 📤 **Export to Parquet** - Export tables to Parquet format with compression options
- 📂 **Directory picker** - Native Android file picker using Storage Access Framework
- 🧪 **Integration Tests** - Built-in test suite for verifying all functionality

## References

- https://duckdb.org/docs/stable/dev/building/android
- https://capacitorjs.com/docs/plugins/creating-plugins
- https://capacitorjs.com/docs/plugins/android
- https://capacitorjs.com/docs/plugins/ios
- https://capacitorjs.com/docs/plugins/workflow
- https://github.com/capacitor-community/sqlite as inspiration

## Install

```bash
npm install @bangonkali/capacitor-duckdb
npx cap sync
```

## Building Native Libraries

Before using the plugin, you need to build the native DuckDB libraries.

### Prerequisites

1. **Android NDK** - Install via Android Studio:
   - Open Android Studio → Tools → SDK Manager → SDK Tools tab
   - Check "NDK (Side by side)" and click OK
   - Recommended: NDK 28.0.12433566 or later

2. **CMake** - Install via Homebrew (macOS):
   ```bash
   brew install cmake
   ```

3. **Ninja** - Install via Homebrew (macOS):
   ```bash
   brew install ninja
   ```

4. **DuckDB CLI** - Required for building pre-populated demo database:
   ```bash
   brew install duckdb
   ```

5. **vcpkg** (required for spatial extension):
   ```bash
   git clone https://github.com/Microsoft/vcpkg.git ~/vcpkg
   ~/vcpkg/bootstrap-vcpkg.sh
   export VCPKG_ROOT=$HOME/vcpkg
   # Add to ~/.zshrc for persistence
   echo 'export VCPKG_ROOT=$HOME/vcpkg' >> ~/.zshrc
   ```

### Complete Build From Scratch

Follow these steps to build everything from a fresh checkout:

#### Step 1: Clone the Repository

```bash
git clone https://github.com/bangonkali/capacitor-duckdb.git
cd capacitor-duckdb
```

#### Step 2: Build DuckDB with Spatial Extension

This builds DuckDB and all spatial dependencies (GEOS, PROJ, GDAL) for Android:

```bash
# Full build with spatial + common in-tree extensions
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh --spatial
```

**What this does:**
1. Clones duckdb-spatial repo (includes embedded DuckDB source)
2. Cross-compiles vcpkg dependencies for Android (GEOS, PROJ, GDAL)
3. Builds DuckDB with spatial extension statically linked
4. Builds `libduckdb.so` for `arm64-v8a` and `x86_64` ABIs
5. Copies libraries to `android/src/main/jniLibs/`
6. Copies headers to `android/src/main/cpp/include/` and `build/spatial/duckdb-spatial/`

**⏱️ Build time:** 30-60 minutes (first build), subsequent builds use cache  
**💾 Disk space:** ~10GB for all build artifacts

#### Step 3: Build the TypeScript Plugin

```bash
npm install
npm run build
```

#### Step 4: Build the Example App

```bash
cd example-app
npm install
npm run build
npx cap sync android
```

#### Step 5: Build and Run on Android

```bash
# Open in Android Studio
npx cap open android

# Or build from command line
cd android
./gradlew assembleDebug

# Run on connected device
npx cap run android
```

### Quick Reference: Build Commands

```bash
# Build with default settings (main branch, no extensions)
./scripts/build-android.sh

# Build specific version
./scripts/build-android.sh --version v1.1.3

# Build with in-tree extensions only
DUCKDB_EXTENSIONS="icu;json;parquet" ./scripts/build-android.sh

# Build with spatial extension only
./scripts/build-android.sh --spatial

# Build with spatial + in-tree extensions (RECOMMENDED)
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh --spatial

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

### Build Script Output

The script produces these artifacts:

```
android/src/main/jniLibs/
├── arm64-v8a/
│   └── libduckdb.so          # ~50-80MB with spatial
└── x86_64/
    └── libduckdb.so

android/src/main/cpp/include/
└── duckdb.h                   # C API header

build/spatial/duckdb-spatial/
├── duckdb/src/include/        # C++ API headers
└── src/spatial/               # Spatial extension headers
```

## Usage

### Basic Example

```typescript
import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';

// Open database
await CapacitorDuckDb.open({ database: 'mydb' });

// Create table
await CapacitorDuckDb.execute({
  database: 'mydb',
  statements: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR
    )
  `
});

// Insert data with parameters
await CapacitorDuckDb.run({
  database: 'mydb',
  statement: 'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
  values: [1, 'Alice', 'alice@example.com']
});

// Query data
const result = await CapacitorDuckDb.query({
  database: 'mydb',
  statement: 'SELECT * FROM users WHERE name LIKE $1',
  values: ['%Alice%']
});

console.log(result.values);
// [{id: 1, name: 'Alice', email: 'alice@example.com'}]

// Close database
await CapacitorDuckDb.close({ database: 'mydb' });
```

### Export to Parquet

Export tables to Parquet format for analytics, sharing, or backup. Uses Android's Storage Access Framework (SAF) to let users choose the destination folder.

```typescript
import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';

// Step 1: Let user pick a directory
const directory = await CapacitorDuckDb.pickDirectory();
console.log('Selected:', directory.name); // e.g., "Downloads"

// Step 2: List available tables
const tables = await CapacitorDuckDb.listTables({ database: 'mydb' });
console.log('Tables:', tables.tables); // ['users', 'orders', ...]

// Step 3: Export a table
const result = await CapacitorDuckDb.exportToParquet({
  database: 'mydb',
  tableName: 'users',
  directoryUri: directory.uri,
  fileName: 'users_backup.parquet', // Optional, defaults to tableName.parquet
  compression: 'snappy', // 'snappy' | 'gzip' | 'zstd' | 'uncompressed'
});

console.log(`Exported ${result.rowCount} rows (${result.fileSize} bytes)`);
console.log('Saved to:', result.path);
```

#### Compression Options

| Compression | Speed | Ratio | Best For |
|-------------|-------|-------|----------|
| `snappy` | Fastest | Good | General use (default) |
| `zstd` | Fast | Better | Balance of speed & size |
| `gzip` | Slower | Best | Maximum compression |
| `uncompressed` | N/A | None | Maximum compatibility |

#### Parquet File Usage

Exported Parquet files can be opened with:
- **DuckDB**: `SELECT * FROM 'file.parquet'`
- **Python/Pandas**: `pd.read_parquet('file.parquet')`
- **Apache Spark**: `spark.read.parquet('file.parquet')`
- **R/Arrow**: `arrow::read_parquet('file.parquet')`

### Todo App Example

See `example-app/` for a complete todo list application demonstrating:
- Database initialization
- CRUD operations
- Prepared statements with parameters
- Error handling

### Integration Tests Tab 🧪

The example app includes a comprehensive **Integration Tests** tab (flask icon in the bottom navigation) that verifies all plugin functionality works correctly from TypeScript through the native JNI layer:

| Category | Tests |
|----------|-------|
| **Basic Operations** | open, close, getVersion |
| **DDL Operations** | CREATE TABLE, DROP TABLE |
| **DML Operations** | INSERT, SELECT, UPDATE, DELETE with prepared statements |
| **Data Types** | INTEGER, BIGINT, DOUBLE, BOOLEAN, VARCHAR, DATE, TIMESTAMP, NULL |
| **Spatial Extension** | Verified via ST_Point, ST_Distance, ST_Buffer, ST_AsGeoJSON (not duckdb_extensions()) |
| **Error Handling** | Syntax errors, table not found |

This is useful for:
- Verifying your build works correctly
- Testing after upgrading DuckDB
- Debugging parameter binding issues
- Confirming spatial extension is loaded

### Spatial Demo App 🌍

The example app includes a comprehensive **Spatial Demo** that showcases all major DuckDB spatial functions with an interactive map interface:

![Spatial Demo Screenshot](docs/spatial-demo.png)

#### Features

- **Interactive Map** - OpenLayers with OpenStreetMap tiles
- **Natural Earth Data** - 1:110m scale sample data (countries, cities, airports, rivers, lakes)
- **Drawing Tools** - Touch-friendly toolbar for creating points, lines, and polygons on the map
- **8 Demo Categories** - 50+ spatial functions organized by type:

| Category | Functions | Description |
|----------|-----------|-------------|
| **Constructors** | ST_Point, ST_MakeLine, ST_MakePolygon | Create geometries from coordinates |
| **Predicates** | ST_Intersects, ST_Contains, ST_Within, ST_DWithin | Test spatial relationships |
| **Measurements** | ST_Distance, ST_Distance_Spheroid, ST_Area, ST_Length | Calculate distances and areas |
| **Processing** | ST_Buffer, ST_Union, ST_Intersection, ST_ConvexHull | Transform and combine geometries |
| **Transforms** | ST_Transform, ST_Simplify, ST_SetSRID | Coordinate systems and simplification |
| **Aggregates** | ST_Union_Agg, ST_Collect_Agg, ST_Extent_Agg | Combine multiple geometries |
| **Line Ops** | ST_LineInterpolatePoint, ST_LineSubstring | Work with paths and routes |
| **I/O Formats** | ST_AsGeoJSON, ST_AsText, ST_AsWKB | Convert between formats |

#### Natural Earth Data Flow (Updated)

- GeoJSON assets stay under `example-app/src/data/geojson`, but they now seed DuckDB tables via `spatialService.initialize()` instead of being fetched directly by the map.
- Each dataset loads into its own table (`ne_countries`, `ne_cities`, etc.) using `ST_GeomFromText`/`ST_GeomFromGeoJSON` so spatial queries and rendering share one source of truth.
- `spatialService.getLayerGeoJSON(layer)` issues `ST_AsGeoJSON(geometry)` queries and returns ready-to-render FeatureCollections.
- `MapView` requests layers through this service when toggled on, ensuring the display recycles the data already managed inside DuckDB.
- The resulting pipeline is **GeoJSON ➜ DuckDB ➜ OpenLayers**, which keeps Natural Earth data synchronized between analytics SQL and the interactive map.

#### Running the Spatial Demo

```bash
# 1. Build DuckDB with spatial extension
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh --spatial

# 2. Install example app dependencies
cd example-app
npm install

# 3. Run on Android
npm run build
npx cap sync android
npx cap run android
```

#### Data Sources

- **Natural Earth** - Public domain map data from [naturalearthdata.com](https://naturalearthdata.com) (CC0 license)
- **OpenStreetMap** - Map tiles via OpenLayers

## API

<docgen-index>

* [`getVersion()`](#getversion)
* [`open(...)`](#open)
* [`close(...)`](#close)
* [`execute(...)`](#execute)
* [`query(...)`](#query)
* [`run(...)`](#run)
* [`deleteDatabase(...)`](#deletedatabase)
* [`isDBExists(...)`](#isdbexists)
* [`isDBOpen(...)`](#isdbopen)
* [`echo(...)`](#echo)
* [`pickDirectory()`](#pickdirectory)
* [`exportToParquet(...)`](#exporttoparquet)
* [`listTables(...)`](#listtables)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

Capacitor plugin for DuckDB database operations.

DuckDB is an in-process SQL OLAP database management system.
This plugin provides native DuckDB support for Capacitor-based
Android and iOS applications.

### getVersion()

```typescript
getVersion() => Promise<VersionResult>
```

Get the DuckDB library version.

**Returns:** <code>Promise&lt;<a href="#versionresult">VersionResult</a>&gt;</code>

--------------------


### open(...)

```typescript
open(options: OpenOptions) => Promise<{ database: string; }>
```

Open a database. Creates the database file if it doesn't exist.
The database file is stored in the app's internal storage directory.

| Param         | Type                                                | Description     |
| ------------- | --------------------------------------------------- | --------------- |
| **`options`** | <code><a href="#openoptions">OpenOptions</a></code> | - Database name |

**Returns:** <code>Promise&lt;{ database: string; }&gt;</code>

--------------------


### close(...)

```typescript
close(options: DatabaseOptions) => Promise<{ database: string; }>
```

Close a database connection.

| Param         | Type                                                        | Description     |
| ------------- | ----------------------------------------------------------- | --------------- |
| **`options`** | <code><a href="#databaseoptions">DatabaseOptions</a></code> | - Database name |

**Returns:** <code>Promise&lt;{ database: string; }&gt;</code>

--------------------


### execute(...)

```typescript
execute(options: ExecuteOptions) => Promise<ExecuteResult>
```

Execute SQL statements (CREATE, INSERT, UPDATE, DELETE, etc.).
Can execute multiple statements separated by semicolons.

| Param         | Type                                                      | Description                   |
| ------------- | --------------------------------------------------------- | ----------------------------- |
| **`options`** | <code><a href="#executeoptions">ExecuteOptions</a></code> | - Database and SQL statements |

**Returns:** <code>Promise&lt;<a href="#executeresult">ExecuteResult</a>&gt;</code>

--------------------


### query(...)

```typescript
query(options: QueryOptions) => Promise<QueryResult>
```

Execute a query and return results.
Results are returned as an array of objects with column names as keys.

| Param         | Type                                                  | Description                                          |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **`options`** | <code><a href="#queryoptions">QueryOptions</a></code> | - Database, SQL query, and optional parameter values |

**Returns:** <code>Promise&lt;<a href="#queryresult">QueryResult</a>&gt;</code>

--------------------


### run(...)

```typescript
run(options: RunOptions) => Promise<RunResult>
```

Execute a statement with parameters (INSERT, UPDATE, DELETE).
Use $1, $2, etc. as parameter placeholders.

| Param         | Type                                              | Description                                     |
| ------------- | ------------------------------------------------- | ----------------------------------------------- |
| **`options`** | <code><a href="#runoptions">RunOptions</a></code> | - Database, SQL statement, and parameter values |

**Returns:** <code>Promise&lt;<a href="#runresult">RunResult</a>&gt;</code>

--------------------


### deleteDatabase(...)

```typescript
deleteDatabase(options: DatabaseOptions) => Promise<{ database: string; }>
```

Delete a database file.
Closes the database if it's open before deleting.

| Param         | Type                                                        | Description     |
| ------------- | ----------------------------------------------------------- | --------------- |
| **`options`** | <code><a href="#databaseoptions">DatabaseOptions</a></code> | - Database name |

**Returns:** <code>Promise&lt;{ database: string; }&gt;</code>

--------------------


### isDBExists(...)

```typescript
isDBExists(options: DatabaseOptions) => Promise<BooleanResult>
```

Check if a database file exists.

| Param         | Type                                                        | Description     |
| ------------- | ----------------------------------------------------------- | --------------- |
| **`options`** | <code><a href="#databaseoptions">DatabaseOptions</a></code> | - Database name |

**Returns:** <code>Promise&lt;<a href="#booleanresult">BooleanResult</a>&gt;</code>

--------------------


### isDBOpen(...)

```typescript
isDBOpen(options: DatabaseOptions) => Promise<BooleanResult>
```

Check if a database is currently open.

| Param         | Type                                                        | Description     |
| ------------- | ----------------------------------------------------------- | --------------- |
| **`options`** | <code><a href="#databaseoptions">DatabaseOptions</a></code> | - Database name |

**Returns:** <code>Promise&lt;<a href="#booleanresult">BooleanResult</a>&gt;</code>

--------------------


### echo(...)

```typescript
echo(options: { value: string; }) => Promise<{ value: string; }>
```

Echo test method for verifying plugin communication.

| Param         | Type                            | Description     |
| ------------- | ------------------------------- | --------------- |
| **`options`** | <code>{ value: string; }</code> | - Value to echo |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------


### pickDirectory()

```typescript
pickDirectory() => Promise<PickDirectoryResult>
```

Open a directory picker for the user to select an export destination.
Uses Android's Storage Access Framework (SAF) to get persistent access.

**Returns:** <code>Promise&lt;<a href="#pickdirectoryresult">PickDirectoryResult</a>&gt;</code>

--------------------


### exportToParquet(...)

```typescript
exportToParquet(options: ExportParquetOptions) => Promise<ExportResult>
```

Export a table to Parquet format.
Use pickDirectory() first to get a valid directoryUri.

| Param         | Type                                                                  | Description                                                 |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| **`options`** | <code><a href="#exportparquetoptions">ExportParquetOptions</a></code> | - Export options including database, table, and destination |

**Returns:** <code>Promise&lt;<a href="#exportresult">ExportResult</a>&gt;</code>

--------------------


### listTables(...)

```typescript
listTables(options: ListTablesOptions) => Promise<ListTablesResult>
```

List all tables in a database.

| Param         | Type                                                            | Description     |
| ------------- | --------------------------------------------------------------- | --------------- |
| **`options`** | <code><a href="#listtablesoptions">ListTablesOptions</a></code> | - Database name |

**Returns:** <code>Promise&lt;<a href="#listtablesresult">ListTablesResult</a>&gt;</code>

--------------------


### Interfaces


#### VersionResult

Result of version check

| Prop          | Type                | Description            |
| ------------- | ------------------- | ---------------------- |
| **`version`** | <code>string</code> | DuckDB library version |


#### OpenOptions

Options for opening a database

| Prop           | Type                | Description                                              |
| -------------- | ------------------- | -------------------------------------------------------- |
| **`database`** | <code>string</code> | Database name (will be stored in app's internal storage) |


#### DatabaseOptions

Options for database operations

| Prop           | Type                | Description   |
| -------------- | ------------------- | ------------- |
| **`database`** | <code>string</code> | Database name |


#### ExecuteResult

Result of execute operation

| Prop          | Type                | Description            |
| ------------- | ------------------- | ---------------------- |
| **`changes`** | <code>number</code> | Number of rows changed |


#### ExecuteOptions

Options for executing SQL statements

| Prop             | Type                | Description                                                           |
| ---------------- | ------------------- | --------------------------------------------------------------------- |
| **`database`**   | <code>string</code> | Database name                                                         |
| **`statements`** | <code>string</code> | SQL statements to execute (can be multiple statements separated by ;) |


#### QueryResult

Result of query operation

| Prop         | Type                                                           | Description                              |
| ------------ | -------------------------------------------------------------- | ---------------------------------------- |
| **`values`** | <code><a href="#record">Record</a>&lt;string, any&gt;[]</code> | Array of row objects (column-name keyed) |


#### QueryOptions

Options for querying data

| Prop            | Type                | Description                                                                 |
| --------------- | ------------------- | --------------------------------------------------------------------------- |
| **`database`**  | <code>string</code> | Database name                                                               |
| **`statement`** | <code>string</code> | SQL query statement                                                         |
| **`values`**    | <code>any[]</code>  | Parameter values for prepared statements (use $1, $2, etc. as placeholders) |


#### RunResult

Result of run operation

| Prop          | Type                | Description            |
| ------------- | ------------------- | ---------------------- |
| **`changes`** | <code>number</code> | Number of rows changed |


#### RunOptions

Options for running a statement with parameters

| Prop            | Type                | Description                                                                 |
| --------------- | ------------------- | --------------------------------------------------------------------------- |
| **`database`**  | <code>string</code> | Database name                                                               |
| **`statement`** | <code>string</code> | SQL statement (INSERT, UPDATE, DELETE)                                      |
| **`values`**    | <code>any[]</code>  | Parameter values for prepared statements (use $1, $2, etc. as placeholders) |


#### BooleanResult

Result of boolean check operations

| Prop         | Type                 | Description         |
| ------------ | -------------------- | ------------------- |
| **`result`** | <code>boolean</code> | Result of the check |


#### PickDirectoryResult

Result of pick directory operation

| Prop       | Type                | Description                                          |
| ---------- | ------------------- | ---------------------------------------------------- |
| **`uri`**  | <code>string</code> | Directory URI that can be used for export operations |
| **`name`** | <code>string</code> | Display name of the directory                        |


#### ExportResult

Result of export operation

| Prop           | Type                 | Description                          |
| -------------- | -------------------- | ------------------------------------ |
| **`success`**  | <code>boolean</code> | Whether the export was successful    |
| **`path`**     | <code>string</code>  | Path or URI where the file was saved |
| **`rowCount`** | <code>number</code>  | Number of rows exported              |
| **`fileSize`** | <code>number</code>  | File size in bytes                   |


#### ExportParquetOptions

Options for exporting a table to Parquet format

| Prop               | Type                                                        | Description                                                                   |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **`database`**     | <code>string</code>                                         | Database name                                                                 |
| **`tableName`**    | <code>string</code>                                         | Table name to export                                                          |
| **`directoryUri`** | <code>string</code>                                         | Directory URI (from pickDirectory) where to save the file                     |
| **`fileName`**     | <code>string</code>                                         | Optional filename (defaults to tableName.parquet)                             |
| **`compression`**  | <code>'snappy' \| 'gzip' \| 'zstd' \| 'uncompressed'</code> | Optional compression type: 'snappy' (default), 'gzip', 'zstd', 'uncompressed' |


#### ListTablesResult

Result of listing tables

| Prop         | Type                  | Description          |
| ------------ | --------------------- | -------------------- |
| **`tables`** | <code>string[]</code> | Array of table names |


#### ListTablesOptions

Options for listing tables

| Prop           | Type                | Description   |
| -------------- | ------------------- | ------------- |
| **`database`** | <code>string</code> | Database name |


### Type Aliases


#### Record

Construct a type with a set of properties K of type T

<code>{ [P in K]: T; }</code>

</docgen-api>

## Building with DuckDB Extensions

DuckDB has two types of extensions:

1. **In-tree extensions** - Live in DuckDB's `extension/` folder, can be enabled via `DUCKDB_EXTENSIONS`
2. **Out-of-tree extensions** - Live in separate repos, require special handling (e.g., spatial)

### In-Tree Extensions

These extensions are bundled with DuckDB and work with `DUCKDB_EXTENSIONS`:

```bash
# Build with in-tree extensions
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh
```

| Extension | Description | Status |
|-----------|-------------|--------|
| `icu` | Unicode support, date/time formatting, collations | ✅ Works |
| `json` | JSON parsing and generation functions | ✅ Works |
| `parquet` | Parquet file format support | ✅ Works |
| `inet` | Network address types | ✅ Works |
| `tpch` | TPC-H benchmark data generator | ✅ Works |
| `tpcds` | TPC-DS benchmark data generator | ✅ Works |
| `vss` | Vector similarity search (HNSW indexes) | ✅ Works (API 28+) |

### Spatial Extension (Out-of-Tree) 🌍

The spatial extension is an **out-of-tree extension** that:
1. Lives in a separate repo (`github.com/duckdb/duckdb-spatial`)
2. Requires vcpkg dependencies (GDAL, GEOS, PROJ) that must be cross-compiled

**`DUCKDB_EXTENSIONS="spatial"` will NOT work** - use the `--spatial` flag instead:

```bash
# Build with spatial extension only
./scripts/build-android.sh --spatial

# Build with spatial + in-tree extensions
DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds" ./scripts/build-android.sh --spatial
```

#### Spatial Prerequisites

- **vcpkg** - Required for cross-compiling GDAL, GEOS, PROJ:
  ```bash
  git clone https://github.com/Microsoft/vcpkg.git
  ./vcpkg/bootstrap-vcpkg.sh
  export VCPKG_ROOT=$HOME/vcpkg
  ```
- **Android NDK** - Auto-detected from Android Studio
- **Disk space** - ~5-10GB
- **Build time** - 30-60 minutes (first build, subsequent builds are cached)

#### What Gets Built

- **GEOS 3.13.0** - Geometry Engine Open Source
- **PROJ 9.1.1** - Cartographic projection library  
- **GDAL 3.8.5** - Geospatial Data Abstraction Library
- **duckdb-spatial** - DuckDB spatial extension

#### Available Spatial Functions

- Geometry types: `GEOMETRY`, `POINT`, `LINESTRING`, `POLYGON`, etc.
- Spatial operations: `ST_Intersects`, `ST_Contains`, `ST_Distance`, `ST_Buffer`, etc.
- Coordinate transforms: `ST_Transform` (with PROJ support)
- File I/O: GeoJSON, Shapefile, GeoParquet, etc.

### Extension Size Impact

⚠️ **Warning:** Extensions significantly increase library size:
- Base DuckDB: ~20MB per ABI
- With `icu;json;parquet`: ~40MB per ABI
- With Spatial: ~50-80MB per ABI (includes GDAL, GEOS, PROJ)

For mobile apps, include only the extensions you actually need.

### Out-of-Tree Extensions NOT Supported

These extensions require external libraries that aren't practical for mobile:

| Extension | Reason |
|-----------|--------|
| `azure` | Requires Azure SDK C++ |
| `aws` | Requires AWS SDK C++ |
| `postgres` | Requires libpq |
| `mysql` | Requires MySQL client library |
| `sqlite` | Requires SQLite library |
| `excel` | Requires EXPAT library |
| `fts` | Requires Snowball stemmer library |

### Custom Extension Build

For advanced extension configuration, modify the build script or build DuckDB manually:

```bash
# Clone DuckDB
git clone https://github.com/duckdb/duckdb.git
cd duckdb

# Set environment
export ANDROID_NDK=~/Library/Android/sdk/ndk/28.0.12433566
export ANDROID_ABI=arm64-v8a

# Build with custom options
mkdir -p build/android_${ANDROID_ABI}
cd build/android_${ANDROID_ABI}

cmake \
    -G "Ninja" \
    -DEXTENSION_STATIC_BUILD=1 \
    -DDUCKDB_EXTRA_LINK_FLAGS="-llog" \
    -DBUILD_EXTENSIONS="icu;json" \
    -DENABLE_EXTENSION_AUTOLOADING=0 \
    -DENABLE_EXTENSION_AUTOINSTALL=0 \
    -DANDROID_PLATFORM=android-23 \
    -DDUCKDB_EXPLICIT_PLATFORM="android_${ANDROID_ABI}" \
    -DBUILD_UNITTESTS=0 \
    -DBUILD_SHELL=0 \
    -DANDROID_ABI=${ANDROID_ABI} \
    -DCMAKE_TOOLCHAIN_FILE=${ANDROID_NDK}/build/cmake/android.toolchain.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    ../..

cmake --build . --config Release
```

## Architecture

```
┌─────────────────────────────────────────┐
│           JavaScript Layer              │
│    CapacitorDuckDb.open/query/etc.      │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│        Capacitor Plugin Bridge          │
│       CapacitorDuckDbPlugin.java        │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│        Implementation Layer             │
│         CapacitorDuckDb.java            │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│           JNI Bridge                    │
│         DuckDBNative.java               │
│    System.loadLibrary("capacitor_duckdb_jni")
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│        C++ JNI Implementation           │
│           duckdb_jni.cpp                │
│   Uses DuckDB C++ API for static        │
│   extension loading                     │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│        DuckDB Native Library            │
│            libduckdb.so                 │
│   (with spatial extension statically    │
│    linked - no runtime loading)         │
└─────────────────────────────────────────┘
```

### Extension Loading Architecture

DuckDB extensions on Android work differently than desktop:

**Desktop/Server:**
- Extensions are `.duckdb_extension` files loaded at runtime
- `INSTALL spatial; LOAD spatial;` downloads and loads dynamically

**Android (this plugin):**
- Android is NOT officially supported for extension distribution
- Extensions must be **statically linked** into `libduckdb.so` at compile time
- JNI code uses **C++ API** to explicitly call `LoadStaticExtension<SpatialExtension>()`
- `LOAD spatial;` returns "already loaded" (extension is pre-loaded)

```cpp
// In duckdb_jni.cpp - how static extensions are loaded
duckdb::DuckDB db(path, &config);
db.LoadStaticExtension<duckdb::SpatialExtension>();  // Explicit load
```

This approach ensures spatial functions are available immediately when the database opens.

## Storage Location

Database files are stored in the app's internal storage:
- Android: `context.getFilesDir()/duckdb/<database>.duckdb`

This location:
- Is private to the app
- Persists across app restarts
- Is deleted when the app is uninstalled
- Does not require storage permissions

## Concurrency

DuckDB supports multiple connections to a single database. This plugin uses a single connection per database for simplicity, which is appropriate for mobile apps where there's typically one user at a time.

## Troubleshooting

### Checking if Spatial Extension is Loaded

**Important:** On Android, `duckdb_extensions()` does NOT work because it requires `home_directory` to be set, which isn't supported for statically-linked extensions. Instead, verify spatial by calling a spatial function:

```typescript
// ✅ Correct way to check spatial availability
try {
  const result = await CapacitorDuckDb.query({
    database: 'mydb',
    statement: 'SELECT ST_AsText(ST_Point(0, 0)) as test'
  });
  console.log('Spatial is available:', result.values[0].test); // "POINT (0 0)"
} catch (e) {
  console.log('Spatial is NOT available');
}

// ❌ This will fail on Android with "home_directory" error
// SELECT * FROM duckdb_extensions() WHERE extension_name = 'spatial'
```

### "Spatial Extension Not Available"

If spatial functions like `ST_Point()` return errors:

1. **Verify build included spatial:**
   ```bash
   # Check libduckdb.so size (should be 50-80MB with spatial)
   ls -lh android/src/main/jniLibs/arm64-v8a/libduckdb.so
   
   # Check for spatial symbols
   nm -gC android/src/main/jniLibs/arm64-v8a/libduckdb.so | grep -i spatial
   ```

2. **Rebuild with spatial flag:**
   ```bash
   DUCKDB_EXTENSIONS="icu;json;parquet" ./scripts/build-android.sh --spatial
   ```

### Spatial Demo Shows "Cannot read properties of undefined"

If the spatial demo fails with `TypeError: Cannot read properties of undefined (reading 'length')`:

This is caused by GeoJSON files not being parsed correctly by Vite. The fix:

1. **Use `.json` extension** instead of `.geojson` for data files
2. **Remove `assetsInclude`** from vite.config.ts (it causes Vite to return URLs instead of parsed JSON)
3. **Use `as unknown as` type casting** for GeoJSON imports to handle BBox type differences

```typescript
// vite.config.ts - DO NOT use assetsInclude for GeoJSON
export default defineConfig({
  plugins: [react()],
  // Don't add: assetsInclude: ['**/*.geojson']
});

// Import .json files, not .geojson
import countriesData from './geojson/countries.json';
export function getCountries() {
  return countriesData as unknown as CountriesCollection;
}
```

### ST_Version() or ST_GEOSVersion() Not Found

These functions do NOT exist in DuckDB's spatial extension. This is normal - spatial is still loaded correctly if `ST_Point()` works.

```typescript
// ✅ Use this to verify spatial works
SELECT ST_AsText(ST_Point(0, 0)) as test;

// ✅ PROJ version is available
SELECT DuckDB_PROJ_Compiled_Version() as version;

// ❌ These don't exist
// ST_Version(), ST_GEOSVersion()
```

3. **Clean and rebuild:**
   ```bash
   rm -rf build/spatial
   rm -rf android/src/main/jniLibs/*
   DUCKDB_EXTENSIONS="icu;json;parquet;inet;tpch;tpcds;vss" ./scripts/build-android.sh --spatial
   ```

### Build Fails: vcpkg Dependencies

If vcpkg cross-compilation fails:

1. **Ensure vcpkg is bootstrapped:**
   ```bash
   cd ~/vcpkg
   ./bootstrap-vcpkg.sh
   ```

2. **Clear vcpkg cache and retry:**
   ```bash
   rm -rf ~/vcpkg/buildtrees/*
   rm -rf build/spatial
   ./scripts/build-android.sh --spatial
   ```

### JNI Library Not Found

If the app crashes with "couldn't find libcapacitor_duckdb_jni.so":

1. **Ensure Android build completes:**
   ```bash
   cd example-app/android
   ./gradlew assembleDebug --info
   ```

2. **Check JNI libs are in place:**
   ```bash
   ls android/src/main/jniLibs/*/libduckdb.so
   ```

### Query Returns Empty Results

Verify the database path is correct and the table exists:

```typescript
// Check what tables exist
const tables = await CapacitorDuckDb.listTables({ database: 'mydb' });
console.log('Tables:', tables.tables);

// Check database file location
const version = await CapacitorDuckDb.getVersion();
console.log('DuckDB version:', version.version);
```

## iOS Support

iOS support is planned but not yet implemented. See `PLAN.md` for the roadmap.

## Contributing

See `CONTRIBUTING.md` for development setup and guidelines.

## License

MIT
