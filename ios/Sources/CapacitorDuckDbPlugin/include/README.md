# DuckDB C API Header Directory

This directory contains the DuckDB C API header file (`duckdb.h`) used for Swift interop.

## Building

The header is automatically copied by the iOS build script:

```bash
./scripts/build-ios.sh
```

## Usage in Swift

The header is exposed via the podspec and can be imported in Swift using a bridging header
or module map. The DuckDB C API provides functions like:

```c
// Database lifecycle
duckdb_open()
duckdb_close()

// Connections
duckdb_connect()
duckdb_disconnect()

// Query execution  
duckdb_query()
duckdb_prepare()
duckdb_execute_prepared()

// Results
duckdb_fetch_chunk()
duckdb_result_column_count()
duckdb_result_column_name()
```

## Note

The actual `duckdb.h` file is git-ignored as it's generated during the build process.
