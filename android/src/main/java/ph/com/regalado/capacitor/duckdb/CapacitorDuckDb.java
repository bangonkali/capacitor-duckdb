package ph.com.regalado.capacitor.duckdb;

import android.content.Context;
import android.content.res.AssetManager;
import com.getcapacitor.Logger;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * DuckDB implementation for Capacitor.
 * Manages database connections and provides query execution.
 */
public class CapacitorDuckDb {

    private static final String TAG = "CapacitorDuckDb";
    private static final String DB_DIR = "duckdb";
    private static final String ASSETS_DB_DIR = "databases";

    private Context context;

    // Database handle storage: dbName -> dbPtr
    private final Map<String, Long> databases = new HashMap<>();

    // Connection handle storage: dbName -> connPtr
    private final Map<String, Long> connections = new HashMap<>();

    /**
     * Set the Android context for file operations.
     */
    public void setContext(Context context) {
        this.context = context;
    }

    /**
     * Get the directory for storing DuckDB database files.
     */
    private File getDatabaseDirectory() {
        File dbDir = new File(context.getFilesDir(), DB_DIR);
        if (!dbDir.exists()) {
            dbDir.mkdirs();
        }
        return dbDir;
    }

    /**
     * Get the full path for a database file.
     * @param dbName Database name (without path)
     * @return Full path to database file
     */
    private String getDatabasePath(String dbName) {
        if (dbName == null || dbName.isEmpty() || dbName.equals(":memory:")) {
            return null; // In-memory database
        }

        // Ensure .duckdb extension
        if (!dbName.endsWith(".duckdb") && !dbName.endsWith(".db")) {
            dbName = dbName + ".duckdb";
        }

        return new File(getDatabaseDirectory(), dbName).getAbsolutePath();
    }

    /**
     * Copy a database from assets if it exists and hasn't been copied yet.
     * @param dbName Database name
     * @return true if database was copied or already exists, false on error
     */
    private boolean copyDatabaseFromAssetsIfNeeded(String dbName) {
        String dbFileName = dbName;
        if (!dbFileName.endsWith(".duckdb") && !dbFileName.endsWith(".db")) {
            dbFileName = dbFileName + ".duckdb";
        }

        File destFile = new File(getDatabaseDirectory(), dbFileName);
        
        // If database already exists, don't overwrite
        if (destFile.exists()) {
            Logger.info(TAG, "Database already exists at: " + destFile.getAbsolutePath());
            return true;
        }

        // Check if database exists in assets
        String assetPath = ASSETS_DB_DIR + "/" + dbFileName;
        AssetManager assetManager = context.getAssets();
        
        try {
            // Try to open the asset to check if it exists
            InputStream inputStream = assetManager.open(assetPath);
            
            Logger.info(TAG, "Copying database from assets: " + assetPath);
            
            // Copy to destination
            OutputStream outputStream = new FileOutputStream(destFile);
            byte[] buffer = new byte[8192];
            int length;
            long totalBytes = 0;
            
            while ((length = inputStream.read(buffer)) > 0) {
                outputStream.write(buffer, 0, length);
                totalBytes += length;
            }
            
            outputStream.flush();
            outputStream.close();
            inputStream.close();
            
            Logger.info(TAG, "Database copied successfully: " + totalBytes + " bytes");
            return true;
            
        } catch (IOException e) {
            // Asset doesn't exist or copy failed - that's OK, database will be created fresh
            Logger.info(TAG, "No pre-built database in assets for: " + dbName + " (will create new)");
            return true;
        }
    }

    /**
     * Get DuckDB library version.
     */
    public String getVersion() {
        return DuckDBNative.getVersion();
    }

    /**
     * Open a database and create a connection.
     * @param dbName Database name
     * @return null on success, error message on failure
     */
    public String open(String dbName) {
        if (databases.containsKey(dbName)) {
            Logger.info(TAG, "Database already open: " + dbName);
            return null; // Already open
        }

        // Try to copy pre-built database from assets if available
        copyDatabaseFromAssetsIfNeeded(dbName);

        String path = getDatabasePath(dbName);
        Logger.info(TAG, "Opening database: " + dbName + " at path: " + path);

        // Open database
        long dbPtr = DuckDBNative.openDatabase(path);
        if (dbPtr == 0) {
            return "Failed to open database: " + dbName;
        }

        // Create connection
        long connPtr = DuckDBNative.connect(dbPtr);
        if (connPtr == 0) {
            DuckDBNative.closeDatabase(dbPtr);
            return "Failed to create connection for database: " + dbName;
        }

        databases.put(dbName, dbPtr);
        connections.put(dbName, connPtr);

        Logger.info(TAG, "Database opened successfully: " + dbName);
        return null;
    }

    /**
     * Close a database and its connection.
     * @param dbName Database name
     * @return null on success, error message on failure
     */
    public String close(String dbName) {
        if (!databases.containsKey(dbName)) {
            return "Database not open: " + dbName;
        }

        Logger.info(TAG, "Closing database: " + dbName);

        // Close connection first
        Long connPtr = connections.remove(dbName);
        if (connPtr != null && connPtr != 0) {
            DuckDBNative.disconnect(connPtr);
        }

        // Close database
        Long dbPtr = databases.remove(dbName);
        if (dbPtr != null && dbPtr != 0) {
            DuckDBNative.closeDatabase(dbPtr);
        }

        Logger.info(TAG, "Database closed: " + dbName);
        return null;
    }

    /**
     * Execute SQL statements (INSERT, UPDATE, DELETE, CREATE, etc.)
     * @param dbName Database name
     * @param sql SQL statements to execute
     * @return JSON object with changes count or error
     */
    public JSONObject execute(String dbName, String sql) throws JSONException {
        Long connPtr = connections.get(dbName);
        if (connPtr == null || connPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Database not open: " + dbName);
            return error;
        }

        String result = DuckDBNative.execute(connPtr, sql);

        if (result.startsWith("ERROR:")) {
            JSONObject error = new JSONObject();
            error.put("error", result.substring(6));
            return error;
        }

        return new JSONObject(result);
    }

    /**
     * Execute a query and return results.
     * @param dbName Database name
     * @param sql SQL query
     * @return JSON object with values array or error
     */
    public JSONObject query(String dbName, String sql) throws JSONException {
        Long connPtr = connections.get(dbName);
        if (connPtr == null || connPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Database not open: " + dbName);
            return error;
        }

        String result = DuckDBNative.query(connPtr, sql);

        if (result.startsWith("ERROR:")) {
            JSONObject error = new JSONObject();
            error.put("error", result.substring(6));
            return error;
        }

        JSONObject response = new JSONObject();
        response.put("values", new JSONArray(result));
        return response;
    }

    /**
     * Execute a query with bound parameters.
     * @param dbName Database name
     * @param sql SQL query with placeholders ($1, $2, etc.)
     * @param values Parameter values
     * @return JSON object with values array or error
     */
    public JSONObject queryWithParams(String dbName, String sql, JSONArray values) throws JSONException {
        Long connPtr = connections.get(dbName);
        if (connPtr == null || connPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Database not open: " + dbName);
            return error;
        }

        // Prepare statement
        long stmtPtr = DuckDBNative.prepare(connPtr, sql);
        if (stmtPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Failed to prepare statement");
            return error;
        }

        try {
            // Bind parameters
            if (values != null) {
                for (int i = 0; i < values.length(); i++) {
                    Object value = values.get(i);
                    int paramIndex = i + 1; // 1-based indexing

                    if (value == null || value == JSONObject.NULL) {
                        DuckDBNative.bindNull(stmtPtr, paramIndex);
                    } else if (value instanceof String) {
                        DuckDBNative.bindString(stmtPtr, paramIndex, (String) value);
                    } else if (value instanceof Integer) {
                        DuckDBNative.bindLong(stmtPtr, paramIndex, ((Integer) value).longValue());
                    } else if (value instanceof Long) {
                        DuckDBNative.bindLong(stmtPtr, paramIndex, (Long) value);
                    } else if (value instanceof Double) {
                        DuckDBNative.bindDouble(stmtPtr, paramIndex, (Double) value);
                    } else if (value instanceof Float) {
                        DuckDBNative.bindDouble(stmtPtr, paramIndex, ((Float) value).doubleValue());
                    } else if (value instanceof Boolean) {
                        DuckDBNative.bindBoolean(stmtPtr, paramIndex, (Boolean) value);
                    } else {
                        // Fallback: convert to string
                        DuckDBNative.bindString(stmtPtr, paramIndex, value.toString());
                    }
                }
            }

            // Execute
            String result = DuckDBNative.executePrepared(stmtPtr);

            if (result.startsWith("ERROR:")) {
                JSONObject error = new JSONObject();
                error.put("error", result.substring(6));
                return error;
            }

            JSONObject response = new JSONObject();
            response.put("values", new JSONArray(result));
            return response;

        } finally {
            DuckDBNative.destroyPrepared(stmtPtr);
        }
    }

    /**
     * Execute a statement with bound parameters (INSERT, UPDATE, DELETE).
     * @param dbName Database name
     * @param sql SQL statement with placeholders ($1, $2, etc.)
     * @param values Parameter values
     * @return JSON object with changes count or error
     */
    public JSONObject run(String dbName, String sql, JSONArray values) throws JSONException {
        Long connPtr = connections.get(dbName);
        if (connPtr == null || connPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Database not open: " + dbName);
            return error;
        }

        // Prepare statement
        long stmtPtr = DuckDBNative.prepare(connPtr, sql);
        if (stmtPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Failed to prepare statement");
            return error;
        }

        try {
            // Bind parameters
            if (values != null) {
                for (int i = 0; i < values.length(); i++) {
                    Object value = values.get(i);
                    int paramIndex = i + 1; // 1-based indexing

                    if (value == null || value == JSONObject.NULL) {
                        DuckDBNative.bindNull(stmtPtr, paramIndex);
                    } else if (value instanceof String) {
                        DuckDBNative.bindString(stmtPtr, paramIndex, (String) value);
                    } else if (value instanceof Integer) {
                        DuckDBNative.bindLong(stmtPtr, paramIndex, ((Integer) value).longValue());
                    } else if (value instanceof Long) {
                        DuckDBNative.bindLong(stmtPtr, paramIndex, (Long) value);
                    } else if (value instanceof Double) {
                        DuckDBNative.bindDouble(stmtPtr, paramIndex, (Double) value);
                    } else if (value instanceof Float) {
                        DuckDBNative.bindDouble(stmtPtr, paramIndex, ((Float) value).doubleValue());
                    } else if (value instanceof Boolean) {
                        DuckDBNative.bindBoolean(stmtPtr, paramIndex, (Boolean) value);
                    } else {
                        // Fallback: convert to string
                        DuckDBNative.bindString(stmtPtr, paramIndex, value.toString());
                    }
                }
            }

            // Execute
            String result = DuckDBNative.executePrepared(stmtPtr);

            if (result.startsWith("ERROR:")) {
                JSONObject error = new JSONObject();
                error.put("error", result.substring(6));
                return error;
            }

            // Parse result to extract changes count
            JSONArray resultArray = new JSONArray(result);
            JSONObject response = new JSONObject();

            // For DML statements, the result may be empty or contain change info
            // We'll return changes: 1 for successful operations
            response.put("changes", resultArray.length() > 0 ? resultArray.length() : 1);
            return response;

        } finally {
            DuckDBNative.destroyPrepared(stmtPtr);
        }
    }

    /**
     * Delete a database file.
     * @param dbName Database name
     * @return null on success, error message on failure
     */
    public String deleteDatabase(String dbName) {
        // Close if open
        if (databases.containsKey(dbName)) {
            close(dbName);
        }

        String path = getDatabasePath(dbName);
        if (path == null) {
            return "Cannot delete in-memory database";
        }

        File dbFile = new File(path);
        if (dbFile.exists()) {
            if (dbFile.delete()) {
                Logger.info(TAG, "Database deleted: " + dbName);

                // Also try to delete WAL file if exists
                File walFile = new File(path + ".wal");
                if (walFile.exists()) {
                    walFile.delete();
                }

                return null;
            } else {
                return "Failed to delete database file: " + dbName;
            }
        }

        return null; // File doesn't exist, consider success
    }

    /**
     * Check if a database exists.
     * @param dbName Database name
     * @return true if database file exists
     */
    public boolean databaseExists(String dbName) {
        String path = getDatabasePath(dbName);
        if (path == null) {
            return false; // In-memory doesn't "exist" on disk
        }
        return new File(path).exists();
    }

    /**
     * Check if a database is currently open.
     * @param dbName Database name
     * @return true if database is open
     */
    public boolean isOpen(String dbName) {
        return databases.containsKey(dbName) && databases.get(dbName) != 0;
    }

    /**
     * Echo test method (for compatibility with original plugin).
     */
    public String echo(String value) {
        Logger.info(TAG, "Echo: " + value);
        return value;
    }

    /**
     * Close all open databases. Call this when the plugin is destroyed.
     */
    public void closeAll() {
        for (String dbName : databases.keySet().toArray(new String[0])) {
            close(dbName);
        }
    }

    /**
     * Export a table to Parquet format.
     * First exports to a temp file in app's cache, then the plugin will copy to the destination.
     * 
     * @param dbName Database name
     * @param tableName Table to export
     * @param compression Compression type (snappy, gzip, zstd, uncompressed)
     * @return JSON object with tempFilePath and rowCount, or error
     */
    public JSONObject exportToParquetTemp(String dbName, String tableName, String compression) throws JSONException {
        Long connPtr = connections.get(dbName);
        if (connPtr == null || connPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Database not open: " + dbName);
            return error;
        }

        // Validate table exists
        String checkSql = "SELECT COUNT(*) as cnt FROM duckdb_tables() WHERE table_name = '" + tableName.replace("'", "''") + "'";
        String checkResult = DuckDBNative.query(connPtr, checkSql);
        if (checkResult.startsWith("ERROR:")) {
            JSONObject error = new JSONObject();
            error.put("error", "Failed to check table existence: " + checkResult.substring(6));
            return error;
        }

        try {
            JSONArray checkArray = new JSONArray(checkResult);
            if (checkArray.length() == 0 || checkArray.getJSONObject(0).getInt("cnt") == 0) {
                JSONObject error = new JSONObject();
                error.put("error", "Table not found: " + tableName);
                return error;
            }
        } catch (Exception e) {
            JSONObject error = new JSONObject();
            error.put("error", "Failed to parse table check result: " + e.getMessage());
            return error;
        }

        // Get row count first
        String countSql = "SELECT COUNT(*) as cnt FROM " + tableName;
        String countResult = DuckDBNative.query(connPtr, countSql);
        long rowCount = 0;
        if (!countResult.startsWith("ERROR:")) {
            try {
                JSONArray countArray = new JSONArray(countResult);
                if (countArray.length() > 0) {
                    rowCount = countArray.getJSONObject(0).getLong("cnt");
                }
            } catch (Exception e) {
                Logger.warn(TAG, "Could not get row count: " + e.getMessage());
            }
        }

        // Create temp file path
        File cacheDir = context.getCacheDir();
        String fileName = tableName + "_" + System.currentTimeMillis() + ".parquet";
        File tempFile = new File(cacheDir, fileName);
        String tempPath = tempFile.getAbsolutePath();

        // Build COPY command
        String compressionOption = "snappy";
        if (compression != null && !compression.isEmpty()) {
            compressionOption = compression.toLowerCase();
        }

        String copySql = "COPY " + tableName + " TO '" + tempPath.replace("'", "''") + "' (FORMAT PARQUET, COMPRESSION '" + compressionOption + "')";
        
        Logger.info(TAG, "Exporting table with: " + copySql);

        String result = DuckDBNative.execute(connPtr, copySql);

        if (result.startsWith("ERROR:")) {
            JSONObject error = new JSONObject();
            error.put("error", result.substring(6));
            return error;
        }

        // Return success with temp path
        JSONObject response = new JSONObject();
        response.put("tempFilePath", tempPath);
        response.put("rowCount", rowCount);
        return response;
    }

    /**
     * List all tables in a database.
     * @param dbName Database name
     * @return JSON object with tables array or error
     */
    public JSONObject listTables(String dbName) throws JSONException {
        Long connPtr = connections.get(dbName);
        if (connPtr == null || connPtr == 0) {
            JSONObject error = new JSONObject();
            error.put("error", "Database not open: " + dbName);
            return error;
        }

        String sql = "SELECT table_name FROM duckdb_tables() ORDER BY table_name";
        String result = DuckDBNative.query(connPtr, sql);

        if (result.startsWith("ERROR:")) {
            JSONObject error = new JSONObject();
            error.put("error", result.substring(6));
            return error;
        }

        JSONArray tables = new JSONArray();
        try {
            JSONArray resultArray = new JSONArray(result);
            for (int i = 0; i < resultArray.length(); i++) {
                tables.put(resultArray.getJSONObject(i).getString("table_name"));
            }
        } catch (Exception e) {
            JSONObject error = new JSONObject();
            error.put("error", "Failed to parse table list: " + e.getMessage());
            return error;
        }

        JSONObject response = new JSONObject();
        response.put("tables", tables);
        return response;
    }
}

