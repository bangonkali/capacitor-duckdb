/**
 * DuckDB iOS C++ Wrapper Header
 * 
 * This header defines C-linkage functions that can be called from Swift.
 * The implementation uses DuckDB's C++ API to properly load statically
 * linked extensions like the spatial extension.
 * 
 * Swift cannot directly use C++ classes, so we expose a C interface
 * that wraps the C++ functionality.
 */

#ifndef DUCKDB_IOS_HPP
#define DUCKDB_IOS_HPP

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Opaque handle types for Swift
typedef void* DuckDBDatabaseHandle;
typedef void* DuckDBConnectionHandle;
typedef void* DuckDBPreparedHandle;
typedef void* DuckDBResultHandle;

/**
 * Get DuckDB library version string
 * @return Version string (caller must NOT free)
 */
const char* duckdb_ios_get_version(void);

/**
 * Open a DuckDB database with C++ API and load extensions
 * @param path Database file path (NULL for in-memory)
 * @param error_out Pointer to receive error message (caller must free if not NULL)
 * @return Database handle, or NULL on failure
 */
DuckDBDatabaseHandle duckdb_ios_open_database(const char* path, char** error_out);

/**
 * Close a DuckDB database
 * @param db Database handle
 */
void duckdb_ios_close_database(DuckDBDatabaseHandle db);

/**
 * Create a connection to a database
 * @param db Database handle
 * @param error_out Pointer to receive error message (caller must free if not NULL)
 * @return Connection handle, or NULL on failure
 */
DuckDBConnectionHandle duckdb_ios_connect(DuckDBDatabaseHandle db, char** error_out);

/**
 * Close a connection
 * @param conn Connection handle
 */
void duckdb_ios_disconnect(DuckDBConnectionHandle conn);

/**
 * Execute a SQL query and return results as JSON string
 * @param conn Connection handle
 * @param sql SQL query string
 * @param error_out Pointer to receive error message (caller must free if not NULL)
 * @return JSON array string of results (caller must free), or NULL on error
 */
char* duckdb_ios_query(DuckDBConnectionHandle conn, const char* sql, char** error_out);

/**
 * Execute SQL statements (INSERT, UPDATE, DELETE, CREATE, etc.)
 * @param conn Connection handle
 * @param sql SQL statements string
 * @param rows_changed_out Pointer to receive number of rows changed
 * @param error_out Pointer to receive error message (caller must free if not NULL)
 * @return true on success, false on failure
 */
bool duckdb_ios_execute(DuckDBConnectionHandle conn, const char* sql, int64_t* rows_changed_out, char** error_out);

/**
 * Prepare a SQL statement
 * @param conn Connection handle
 * @param sql SQL statement string
 * @param error_out Pointer to receive error message (caller must free if not NULL)
 * @return Prepared statement handle, or NULL on failure
 */
DuckDBPreparedHandle duckdb_ios_prepare(DuckDBConnectionHandle conn, const char* sql, char** error_out);

/**
 * Destroy a prepared statement
 * @param stmt Prepared statement handle
 */
void duckdb_ios_destroy_prepared(DuckDBPreparedHandle stmt);

/**
 * Bind a string value to a prepared statement
 * @param stmt Prepared statement handle
 * @param index Parameter index (1-based)
 * @param value String value (NULL to bind NULL)
 * @return true on success
 */
bool duckdb_ios_bind_string(DuckDBPreparedHandle stmt, int index, const char* value);

/**
 * Bind an integer value to a prepared statement
 * @param stmt Prepared statement handle
 * @param index Parameter index (1-based)
 * @param value Integer value
 * @return true on success
 */
bool duckdb_ios_bind_int64(DuckDBPreparedHandle stmt, int index, int64_t value);

/**
 * Bind a double value to a prepared statement
 * @param stmt Prepared statement handle
 * @param index Parameter index (1-based)
 * @param value Double value
 * @return true on success
 */
bool duckdb_ios_bind_double(DuckDBPreparedHandle stmt, int index, double value);

/**
 * Bind a boolean value to a prepared statement
 * @param stmt Prepared statement handle
 * @param index Parameter index (1-based)
 * @param value Boolean value
 * @return true on success
 */
bool duckdb_ios_bind_bool(DuckDBPreparedHandle stmt, int index, bool value);

/**
 * Bind a NULL value to a prepared statement
 * @param stmt Prepared statement handle
 * @param index Parameter index (1-based)
 * @return true on success
 */
bool duckdb_ios_bind_null(DuckDBPreparedHandle stmt, int index);

/**
 * Clear all bindings on a prepared statement
 * @param stmt Prepared statement handle
 */
void duckdb_ios_clear_bindings(DuckDBPreparedHandle stmt);

/**
 * Execute a prepared statement and return results as JSON string
 * @param stmt Prepared statement handle
 * @param error_out Pointer to receive error message (caller must free if not NULL)
 * @return JSON array string of results (caller must free), or NULL on error
 */
char* duckdb_ios_execute_prepared(DuckDBPreparedHandle stmt, char** error_out);

/**
 * Free a string returned by the wrapper functions
 * @param str String to free (may be NULL)
 */
void duckdb_ios_free_string(char* str);

/**
 * Check if the spatial extension is loaded
 * @param db Database handle
 * @return true if spatial extension is available
 */
bool duckdb_ios_has_spatial_extension(DuckDBDatabaseHandle db);

#ifdef __cplusplus
}
#endif

#endif // DUCKDB_IOS_HPP
