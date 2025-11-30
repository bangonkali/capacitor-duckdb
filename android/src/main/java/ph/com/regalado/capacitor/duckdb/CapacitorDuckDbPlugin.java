package ph.com.regalado.capacitor.duckdb;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.Logger;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

/**
 * Capacitor plugin for DuckDB database operations.
 */
@CapacitorPlugin(name = "CapacitorDuckDb")
public class CapacitorDuckDbPlugin extends Plugin {

    private static final String TAG = "CapacitorDuckDbPlugin";
    private CapacitorDuckDb implementation;

    @Override
    public void load() {
        implementation = new CapacitorDuckDb();
        implementation.setContext(getContext());
        Logger.info(TAG, "CapacitorDuckDb plugin loaded");
    }

    @Override
    protected void handleOnDestroy() {
        if (implementation != null) {
            implementation.closeAll();
        }
        super.handleOnDestroy();
    }

    /**
     * Get DuckDB version
     */
    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            String version = implementation.getVersion();
            JSObject ret = new JSObject();
            ret.put("version", version);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get version", e);
        }
    }

    /**
     * Open a database
     * Options: { database: string }
     */
    @PluginMethod
    public void open(PluginCall call) {
        String database = call.getString("database");
        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        try {
            String error = implementation.open(database);
            if (error != null) {
                call.reject(error);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("database", database);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open database", e);
        }
    }

    /**
     * Close a database
     * Options: { database: string }
     */
    @PluginMethod
    public void close(PluginCall call) {
        String database = call.getString("database");
        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        try {
            String error = implementation.close(database);
            if (error != null) {
                call.reject(error);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("database", database);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to close database", e);
        }
    }

    /**
     * Execute SQL statements (CREATE, INSERT, UPDATE, DELETE, etc.)
     * Options: { database: string, statements: string }
     */
    @PluginMethod
    public void execute(PluginCall call) {
        String database = call.getString("database");
        String statements = call.getString("statements");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        if (statements == null || statements.isEmpty()) {
            call.reject("SQL statements are required");
            return;
        }

        try {
            JSONObject result = implementation.execute(database, statements);

            if (result.has("error")) {
                call.reject(result.getString("error"));
                return;
            }

            JSObject ret = new JSObject();
            if (result.has("changes")) {
                ret.put("changes", result.getInt("changes"));
            } else {
                ret.put("changes", 0);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to execute statements", e);
        }
    }

    /**
     * Execute a query and return results
     * Options: { database: string, statement: string, values?: any[] }
     */
    @PluginMethod
    public void query(PluginCall call) {
        String database = call.getString("database");
        String statement = call.getString("statement");
        JSArray values = call.getArray("values");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        if (statement == null || statement.isEmpty()) {
            call.reject("SQL statement is required");
            return;
        }

        try {
            JSONObject result;

            if (values != null && values.length() > 0) {
                result = implementation.queryWithParams(database, statement, values.toList() != null ? new JSONArray(values.toList()) : null);
            } else {
                result = implementation.query(database, statement);
            }

            if (result.has("error")) {
                call.reject(result.getString("error"));
                return;
            }

            JSObject ret = new JSObject();
            ret.put("values", new JSArray(result.getJSONArray("values").toString()));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to execute query", e);
        }
    }

    /**
     * Execute a statement with parameters (INSERT, UPDATE, DELETE)
     * Options: { database: string, statement: string, values?: any[] }
     */
    @PluginMethod
    public void run(PluginCall call) {
        String database = call.getString("database");
        String statement = call.getString("statement");
        JSArray values = call.getArray("values");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        if (statement == null || statement.isEmpty()) {
            call.reject("SQL statement is required");
            return;
        }

        try {
            JSONArray valuesArray = null;
            if (values != null && values.length() > 0) {
                valuesArray = new JSONArray(values.toList());
            }

            JSONObject result = implementation.run(database, statement, valuesArray);

            if (result.has("error")) {
                call.reject(result.getString("error"));
                return;
            }

            JSObject ret = new JSObject();
            ret.put("changes", result.optInt("changes", 0));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to run statement", e);
        }
    }

    /**
     * Delete a database file
     * Options: { database: string }
     */
    @PluginMethod
    public void deleteDatabase(PluginCall call) {
        String database = call.getString("database");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        try {
            String error = implementation.deleteDatabase(database);
            if (error != null) {
                call.reject(error);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("database", database);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to delete database", e);
        }
    }

    /**
     * Check if a database exists
     * Options: { database: string }
     */
    @PluginMethod
    public void isDBExists(PluginCall call) {
        String database = call.getString("database");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        try {
            boolean exists = implementation.databaseExists(database);
            JSObject ret = new JSObject();
            ret.put("result", exists);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check database existence", e);
        }
    }

    /**
     * Check if a database is open
     * Options: { database: string }
     */
    @PluginMethod
    public void isDBOpen(PluginCall call) {
        String database = call.getString("database");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        try {
            boolean isOpen = implementation.isOpen(database);
            JSObject ret = new JSObject();
            ret.put("result", isOpen);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check if database is open", e);
        }
    }

    /**
     * Echo test method (for compatibility/testing)
     */
    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");

        JSObject ret = new JSObject();
        ret.put("value", implementation.echo(value));
        call.resolve(ret);
    }

    /**
     * Open a directory picker using Storage Access Framework.
     * Returns a URI that can be used for export operations.
     */
    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        startActivityForResult(call, intent, "handleDirectoryPickerResult");
    }

    /**
     * Handle the result from directory picker
     */
    @ActivityCallback
    private void handleDirectoryPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Directory selection cancelled");
            return;
        }

        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            call.reject("No directory selected");
            return;
        }

        Uri treeUri = data.getData();

        // Take persistable permission
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (SecurityException e) {
            Logger.warn(TAG, "Could not take persistable permission: " + e.getMessage());
        }

        // Get the display name
        String displayName = "Selected Folder";
        DocumentFile documentFile = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (documentFile != null && documentFile.getName() != null) {
            displayName = documentFile.getName();
        }

        JSObject ret = new JSObject();
        ret.put("uri", treeUri.toString());
        ret.put("name", displayName);
        call.resolve(ret);
    }

    /**
     * Export a table to Parquet format to the specified directory.
     * Options: { database: string, tableName: string, directoryUri: string, fileName?: string, compression?: string }
     */
    @PluginMethod
    public void exportToParquet(PluginCall call) {
        String database = call.getString("database");
        String tableName = call.getString("tableName");
        String directoryUri = call.getString("directoryUri");
        String fileName = call.getString("fileName");
        String compression = call.getString("compression", "snappy");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        if (tableName == null || tableName.isEmpty()) {
            call.reject("Table name is required");
            return;
        }

        if (directoryUri == null || directoryUri.isEmpty()) {
            call.reject("Directory URI is required. Use pickDirectory() first.");
            return;
        }

        // Default filename
        if (fileName == null || fileName.isEmpty()) {
            fileName = tableName + ".parquet";
        }
        if (!fileName.endsWith(".parquet")) {
            fileName = fileName + ".parquet";
        }

        try {
            // First, export to temp file
            JSONObject exportResult = implementation.exportToParquetTemp(database, tableName, compression);

            if (exportResult.has("error")) {
                call.reject(exportResult.getString("error"));
                return;
            }

            String tempFilePath = exportResult.getString("tempFilePath");
            long rowCount = exportResult.optLong("rowCount", 0);
            File tempFile = new File(tempFilePath);

            if (!tempFile.exists()) {
                call.reject("Export failed: temp file not created");
                return;
            }

            // Copy temp file to the selected directory using SAF
            Uri treeUri = Uri.parse(directoryUri);
            DocumentFile directory = DocumentFile.fromTreeUri(getContext(), treeUri);

            if (directory == null || !directory.canWrite()) {
                tempFile.delete();
                call.reject("Cannot write to selected directory");
                return;
            }

            // Check if file already exists and delete it
            DocumentFile existingFile = directory.findFile(fileName);
            if (existingFile != null) {
                existingFile.delete();
            }

            // Create new file
            DocumentFile newFile = directory.createFile("application/octet-stream", fileName);
            if (newFile == null) {
                tempFile.delete();
                call.reject("Failed to create file in selected directory");
                return;
            }

            // Copy content
            try (FileInputStream fis = new FileInputStream(tempFile);
                 OutputStream os = getContext().getContentResolver().openOutputStream(newFile.getUri())) {
                
                if (os == null) {
                    tempFile.delete();
                    call.reject("Failed to open output stream");
                    return;
                }

                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = fis.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                }
                os.flush();
            }

            long fileSize = tempFile.length();

            // Clean up temp file
            tempFile.delete();

            // Return success
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", newFile.getUri().toString());
            ret.put("rowCount", rowCount);
            ret.put("fileSize", fileSize);
            call.resolve(ret);

        } catch (Exception e) {
            Logger.error(TAG, "Export failed", e);
            call.reject("Export failed: " + e.getMessage(), e);
        }
    }

    /**
     * List all tables in a database
     * Options: { database: string }
     */
    @PluginMethod
    public void listTables(PluginCall call) {
        String database = call.getString("database");

        if (database == null || database.isEmpty()) {
            call.reject("Database name is required");
            return;
        }

        try {
            JSONObject result = implementation.listTables(database);

            if (result.has("error")) {
                call.reject(result.getString("error"));
                return;
            }

            JSObject ret = new JSObject();
            ret.put("tables", new JSArray(result.getJSONArray("tables").toString()));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to list tables", e);
        }
    }
}
