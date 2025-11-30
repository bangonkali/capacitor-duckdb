package ph.com.regalado.capacitor.duckdb;

/**
 * JNI bridge to native DuckDB library.
 * All methods are static and communicate via native pointers (as long values).
 */
public class DuckDBNative {

    static {
        System.loadLibrary("capacitor_duckdb_jni");
    }

    /**
     * Get DuckDB library version
     * @return Version string
     */
    public static native String getVersion();

    /**
     * Open a DuckDB database
     * @param path Database file path (null or empty for in-memory)
     * @return Database handle pointer, or 0 on failure
     */
    public static native long openDatabase(String path);

    /**
     * Close a DuckDB database
     * @param dbPtr Database handle pointer
     */
    public static native void closeDatabase(long dbPtr);

    /**
     * Create a connection to a database
     * @param dbPtr Database handle pointer
     * @return Connection handle pointer, or 0 on failure
     */
    public static native long connect(long dbPtr);

    /**
     * Disconnect from a database
     * @param connPtr Connection handle pointer
     */
    public static native void disconnect(long connPtr);

    /**
     * Execute a SQL query and return results as JSON
     * @param connPtr Connection handle pointer
     * @param sql SQL query string
     * @return JSON string with results, or error message prefixed with "ERROR:"
     */
    public static native String query(long connPtr, String sql);

    /**
     * Execute a SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)
     * @param connPtr Connection handle pointer
     * @param sql SQL statement string
     * @return JSON string with changes count, or error message prefixed with "ERROR:"
     */
    public static native String execute(long connPtr, String sql);

    /**
     * Prepare a SQL statement
     * @param connPtr Connection handle pointer
     * @param sql SQL statement string
     * @return Prepared statement handle pointer, or 0 on failure
     */
    public static native long prepare(long connPtr, String sql);

    /**
     * Destroy a prepared statement
     * @param stmtPtr Prepared statement handle pointer
     */
    public static native void destroyPrepared(long stmtPtr);

    /**
     * Bind a string parameter to a prepared statement
     * @param stmtPtr Prepared statement handle pointer
     * @param index Parameter index (1-based)
     * @param value Parameter value
     * @return true on success
     */
    public static native boolean bindString(long stmtPtr, int index, String value);

    /**
     * Bind a long parameter to a prepared statement
     * @param stmtPtr Prepared statement handle pointer
     * @param index Parameter index (1-based)
     * @param value Parameter value
     * @return true on success
     */
    public static native boolean bindLong(long stmtPtr, int index, long value);

    /**
     * Bind a double parameter to a prepared statement
     * @param stmtPtr Prepared statement handle pointer
     * @param index Parameter index (1-based)
     * @param value Parameter value
     * @return true on success
     */
    public static native boolean bindDouble(long stmtPtr, int index, double value);

    /**
     * Bind a boolean parameter to a prepared statement
     * @param stmtPtr Prepared statement handle pointer
     * @param index Parameter index (1-based)
     * @param value Parameter value
     * @return true on success
     */
    public static native boolean bindBoolean(long stmtPtr, int index, boolean value);

    /**
     * Bind a null parameter to a prepared statement
     * @param stmtPtr Prepared statement handle pointer
     * @param index Parameter index (1-based)
     * @return true on success
     */
    public static native boolean bindNull(long stmtPtr, int index);

    /**
     * Execute a prepared statement and return results as JSON
     * @param stmtPtr Prepared statement handle pointer
     * @return JSON string with results, or error message prefixed with "ERROR:"
     */
    public static native String executePrepared(long stmtPtr);

    /**
     * Clear bindings on a prepared statement for reuse
     * @param stmtPtr Prepared statement handle pointer
     * @return true on success
     */
    public static native boolean clearBindings(long stmtPtr);
}
