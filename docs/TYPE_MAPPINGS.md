# DuckDB Type Mappings

This document details how DuckDB data types are mapped across the different layers of the Capacitor DuckDB plugin: from the core DuckDB C++ engine, through the native Android (Java/JNI) and iOS (Swift/C++) layers, to the final JavaScript/TypeScript layer.

## Overview

The plugin executes queries in the native DuckDB engine and serializes the results into JSON for consumption by the JavaScript layer.

*   **Primitive Types** (Integers, Floats, Booleans) are mapped to their native JSON equivalents.
*   **Complex Types** (Date, Timestamp, Blob, HugeInt, Decimal, etc.) are currently converted to their **String** representation by the native layer before being sent to JavaScript. This ensures precision is preserved (e.g., for HugeInt) and simplifies parsing.

## Type Mapping Table

| DuckDB Type | Android (Java/JNI) | iOS (Swift) | JavaScript (JSON) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **BOOLEAN** | `Boolean` | `Bool` | `boolean` | |
| **TINYINT** | `Long` | `Int64` | `number` | |
| **SMALLINT** | `Long` | `Int64` | `number` | |
| **INTEGER** | `Long` | `Int64` | `number` | |
| **BIGINT** | `Long` | `Int64` | `number` | ⚠️ JS `number` (double) has a max safe integer of 2^53 - 1. Values larger than this may lose precision. |
| **UTINYINT** | `Long` | `Int64` | `number` | |
| **USMALLINT** | `Long` | `Int64` | `number` | |
| **UINTEGER** | `Long` | `Int64` | `number` | |
| **UBIGINT** | `Long` | `Int64` | `number` | ⚠️ See BIGINT warning. |
| **FLOAT** | `Float` | `Double` | `number` | |
| **DOUBLE** | `Double` | `Double` | `number` | |
| **VARCHAR** | `String` | `String` | `string` | |
| **BLOB** | `String` | `String` | `string` | Returned as a string representation (e.g., `\x00...`). |
| **DATE** | `String` | `String` | `string` | Format: `YYYY-MM-DD` |
| **TIME** | `String` | `String` | `string` | Format: `HH:MM:SS` |
| **TIMESTAMP** | `String` | `String` | `string` | Format: `YYYY-MM-DD HH:MM:SS` |
| **INTERVAL** | `String` | `String` | `string` | e.g., `1 day` |
| **HUGEINT** | `String` | `String` | `string` | Preserved as string to avoid overflow. |
| **DECIMAL** | `String` | `String` | `string` | Preserved as string to avoid precision loss. |
| **UUID** | `String` | `String` | `string` | |
| **LIST** | `String` | `String` | `string` | Returned as stringified list (e.g., `[1, 2, 3]`). |
| **STRUCT** | `String` | `String` | `string` | Returned as stringified struct (e.g., `{'a': 1}`). |
| **MAP** | `String` | `String` | `string` | Returned as stringified map (e.g., `{key=value}`). |
| **NULL** | `null` | `NSNull` | `null` | |

## Parameter Binding

When passing parameters to `query` or `run` (e.g., `VALUES ($1, $2)`), the following mappings apply:

| JavaScript Type | DuckDB Type |
| :--- | :--- |
| `string` | `VARCHAR` |
| `number` (integer) | `BIGINT` |
| `number` (float) | `DOUBLE` |
| `boolean` | `BOOLEAN` |
| `null` | `NULL` |

> **Note**: To pass other types (like `DATE` or `BLOB`) as parameters, pass them as strings and cast them in SQL (e.g., `$1::DATE`).
