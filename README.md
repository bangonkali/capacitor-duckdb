# @bangonkali/capacitor-duckdb

> This project is entirely AI Vibe Coded at the moment with a little bit of insanity mixed with autism from the original author.

A native DuckDB plugin for Capacitor-based Android and iOS applications. (see [Tauri DuckDB: WIP 🔄️](https://github.com/bangonkali/TAURI-duckdb))

See Youtube reference of example-app demo below:

<a href="http://www.youtube.com/watch?feature=player_embedded&v=XxHog1q0LbE" target="_blank">
 <img src="http://img.youtube.com/vi/XxHog1q0LbE/mqdefault.jpg" alt="Watch the video" width="240" />
</a>

## Features

- Persistent storage using DuckDB on Android and iOS
- DuckDB Plugins in the works:
  - icu
  - json
  - parquet
  - inet
  - tpch
  - tpcds
  - vss - partially tested 😂
  - spatial - partially tested 😂
  - [pgq](https://duckpgq.org/) - seems not working at the moment 😅

## Documentation

- [**Building Native Libraries**](docs/BUILDING.md) - Instructions for building DuckDB for Android and iOS.
- [**Architecture**](docs/ARCHITECTURE.md) - Deep dive into how the plugin works internally.
- [**Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and fixes.

## References

- https://duckdb.org/docs/stable/dev/building/android
- https://capacitorjs.com/docs/plugins/creating-plugins
- https://capacitorjs.com/docs/plugins/android
- https://capacitorjs.com/docs/plugins/ios
- https://capacitorjs.com/docs/plugins/workflow
- https://github.com/capacitor-community/sqlite as inspiration

## Example App in the Repo

1. 

## Install

```bash
npm install @bangonkali/capacitor-duckdb # This is not full tested yet! But this repo provides an example app
npx cap sync
```

> **Note**: This package downloads platform-specific native binaries (~100MB) from GitHub Releases during installation. Ensure you have internet access and `unzip` installed.


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

**macOS / Linux:**

```bash
# 1. Build DuckDB (all extensions are included by default)
./scripts/build-android.sh

# 2. Install example app dependencies
cd example-app
npm install

# 3. Run on Android
npm run build
npx cap sync android
npx cap run android
```

**Windows:**

```powershell
# 1. Build DuckDB (all extensions are included by default)
.\scripts\build-android.ps1

# 2. Build Example App (prepares DB, builds plugin & web assets, syncs Capacitor)
.\scripts\build-example-android.ps1

# 3. Run on Android
cd example-app
npx cap run android
# Or select a specific device:
# npx cap run android --target <device-id>
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

<code>{
 [P in K]: T;
 }</code>

</docgen-api>

## License

MIT
