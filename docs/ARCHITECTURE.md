# Architecture

This document details the internal architecture of the `@bangonkali/capacitor-duckdb` plugin, explaining how it bridges JavaScript/TypeScript to the native DuckDB C++ library on Android and iOS.

## High-Level Overview

The plugin follows a layered architecture to provide a consistent API across platforms while leveraging the native performance of DuckDB.

```mermaid
graph TD
    JS[JavaScript / TypeScript Layer] -->|Capacitor Bridge| Native[Native Platform Layer]
    
    subgraph "Android (Java/C++)"
        Native -->|JNI| JNI[JNI Wrapper (duckdb_jni.cpp)]
        JNI -->|C++ API| DuckDB_Android[libduckdb.so]
    end
    
    subgraph "iOS (Swift/C++)"
        Native -->|C-Interop| IOS_Cpp[iOS C++ Wrapper (duckdb_ios.cpp)]
        IOS_Cpp -->|C++ API| DuckDB_iOS[DuckDB.xcframework]
    end
```

1.  **JavaScript Layer**: The public API used by the application (`CapacitorDuckDb.open`, `.query`, etc.).
2.  **Capacitor Plugin Bridge**:
    *   **Android**: `CapacitorDuckDbPlugin.java` handles the Capacitor method calls and delegates to `CapacitorDuckDb.java`.
    *   **iOS**: `CapacitorDuckDbPlugin.swift` handles the Capacitor method calls.
3.  **Implementation Layer**:
    *   **Android**: `DuckDBNative.java` declares `native` methods.
    *   **iOS**: `CapacitorDuckDb.swift` calls the C-exposed functions from the C++ wrapper.
4.  **Native Wrappers (C++)**:
    *   **Android**: `duckdb_jni.cpp` implements the JNI methods.
    *   **iOS**: `duckdb_ios.cpp` exposes C-linkage functions (`extern "C"`) to be callable from Swift.
5.  **DuckDB Core**: The compiled DuckDB library with statically linked extensions.

## Native Wrappers Comparison

The Android and iOS implementations are **functionally equivalent**. Both wrappers serve the same purpose: to translate platform-specific calls into DuckDB C++ API calls.

| Feature | Android (`duckdb_jni.cpp`) | iOS (`duckdb_ios.cpp`) |
| :--- | :--- | :--- |
| **Interface** | JNI (`JNIEXPORT ... JNICALL`) | C Linkage (`extern "C"`) |
| **String Handling** | `jstring` <-> `std::string` | `char*` <-> `std::string` |
| **Object Management** | Casts pointers to `jlong` handles | Casts pointers to opaque handles |
| **Result Format** | JSON String | JSON String |
| **Extension Loading** | `LoadStaticExtension<SpatialExtension>()` | `LoadStaticExtension<SpatialExtension>()` |

### Why C++ API?

We use the DuckDB **C++ API** (instead of the C API) inside the wrappers because:
1.  **Static Extension Loading**: The C++ API allows us to explicitly load statically linked extensions (like Spatial) using `LoadStaticExtension<T>()`. This is crucial for mobile where dynamic loading (`LOAD spatial`) is restricted or complex.
2.  **Direct Control**: It gives finer control over configuration and database lifecycle.

### JSON Serialization

To simplify the bridge between C++ and the platform languages (Java/Swift/JS), query results are serialized to **JSON strings** directly within the C++ layer.

*   **Pros**: Minimizes the number of JNI/C-interop calls (one big string vs. thousands of small calls for each cell).
*   **Cons**: String allocation overhead.
*   **Format**: Array of objects, where keys are column names.
    ```json
    [
      {"id": 1, "name": "Alice", "score": 95.5},
      {"id": 2, "name": "Bob", "score": 88.0}
    ]
    ```

## Extension Loading Architecture

DuckDB extensions on mobile work differently than on desktop/server environments.

**Desktop/Server:**
*   Extensions are `.duckdb_extension` files.
*   Loaded dynamically at runtime via `INSTALL spatial; LOAD spatial;`.
*   Downloaded from the internet if not present.

**Mobile (Android/iOS):**
*   Dynamic loading is problematic (sandboxing, code signing, network restrictions).
*   **Solution**: Extensions are **statically linked** into the main library binary (`libduckdb.so` or `DuckDB.xcframework`) at compile time.
*   **Loading**: The C++ wrappers explicitly call `db.LoadStaticExtension<duckdb::SpatialExtension>()` immediately after opening the database.
*   **SQL Usage**: Users can use spatial functions immediately (`ST_Point`, etc.) without running `LOAD spatial`.

## Storage Location

Database files are stored in the app's private internal storage.

*   **Android**: `context.getFilesDir()/duckdb/<database>.duckdb`
*   **iOS**: `FileManager.default.urls(for: .documentDirectory, ...)`

This ensures:
*   Data persistence across app restarts.
*   Data privacy (sandboxed).
*   Cleanup on app uninstall.

## Concurrency

The plugin currently uses a **single connection per database**.
*   DuckDB supports multiple concurrent connections.
*   For simplicity in this mobile plugin context, we maintain one connection instance per open database.
*   This is generally sufficient for mobile apps which are typically single-user.
