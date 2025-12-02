import Foundation
import CDuckDB

@objc public class CapacitorDuckDb: NSObject {
    
    // MARK: - Properties
    
    private var databases: [String: duckdb_database] = [:]
    private var connections: [String: duckdb_connection] = [:]
    private let queue = DispatchQueue(label: "com.capacitor.duckdb", qos: .userInitiated)
    
    // Constants
    private static let databasesSubfolder = "databases"
    
    // Get the documents directory for database storage
    private var documentsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    // Get the databases directory within documents
    private var databasesDirectory: URL {
        let dir = documentsDirectory.appendingPathComponent("duckdb")
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }
    
    // MARK: - Public Methods
    
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
    
    @objc public func getVersion() -> String {
        return String(cString: duckdb_library_version())
    }
    
    @objc public func open(_ database: String) -> String? {
        return queue.sync {
            // Check if already open
            if databases[database] != nil {
                return nil // Already open, not an error
            }
            
            // Try to copy pre-built database from bundle if available
            copyDatabaseFromBundleIfNeeded(database)
            
            let dbPath = databasePath(for: database)
            
            var db: duckdb_database? = nil
            var conn: duckdb_connection? = nil
            
            // Open database
            let openResult = duckdb_open(dbPath, &db)
            if openResult != DuckDBSuccess {
                return "Failed to open database: \(database)"
            }
            
            guard let openedDb = db else {
                return "Failed to open database: \(database)"
            }
            
            // Create connection
            let connectResult = duckdb_connect(openedDb, &conn)
            if connectResult != DuckDBSuccess {
                var mutableDb = db
                duckdb_close(&mutableDb)
                return "Failed to connect to database: \(database)"
            }
            
            guard let openedConn = conn else {
                var mutableDb = db
                duckdb_close(&mutableDb)
                return "Failed to connect to database: \(database)"
            }
            
            databases[database] = openedDb
            connections[database] = openedConn
            
            // Load statically linked extensions
            // These are built into the DuckDB library via EXTENSION_STATIC_BUILD
            loadStaticExtensions(conn: openedConn)
            
            return nil
        }
    }
    
    // MARK: - Extension Loading
    
    /// Load statically linked extensions after database open
    /// On iOS, extensions are statically compiled into the DuckDB library.
    /// We need to explicitly load them to register the functions.
    private func loadStaticExtensions(conn: duckdb_connection) {
        // List of extensions that are statically linked
        // These must match what was compiled in build-ios.sh
        let staticExtensions = [
            "spatial",  // Spatial functions (ST_Point, ST_Distance, etc.)
            "parquet",  // Parquet file format
            "json",     // JSON functions
            "icu"       // Unicode support
        ]
        
        for ext in staticExtensions {
            var result = duckdb_result()
            // LOAD will activate a statically linked extension
            let loadQuery = "LOAD \(ext)"
            let loadResult = duckdb_query(conn, loadQuery, &result)
            
            if loadResult == DuckDBSuccess {
                print("[DuckDB] Loaded extension: \(ext)")
            } else {
                // Not an error if extension wasn't compiled in
                let errorPtr = duckdb_result_error(&result)
                if let errorPtr = errorPtr {
                    let error = String(cString: errorPtr)
                    // Only log if it's not a "not found" error
                    if !error.contains("not found") && !error.contains("not installed") {
                        print("[DuckDB] Failed to load \(ext): \(error)")
                    }
                }
            }
            duckdb_destroy_result(&result)
        }
    }
    
    @objc public func close(_ database: String) -> String? {
        return queue.sync {
            guard var db: duckdb_database? = databases[database], var conn: duckdb_connection? = connections[database] else {
                return "Database not open: \(database)"
            }
            
            duckdb_disconnect(&conn)
            duckdb_close(&db)
            
            databases.removeValue(forKey: database)
            connections.removeValue(forKey: database)
            
            return nil
        }
    }
    
    @objc public func closeAll() {
        queue.sync {
            for (name, _) in databases {
                _ = close(name)
            }
        }
    }
    
    @objc public func execute(_ database: String, statements: String) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var result = duckdb_result()
            let queryResult = duckdb_query(conn, statements, &result)
            
            defer {
                duckdb_destroy_result(&result)
            }
            
            if queryResult != DuckDBSuccess {
                let errorPtr = duckdb_result_error(&result)
                let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Unknown error"
                return ["error": errorMsg]
            }
            
            let rowsChanged = duckdb_rows_changed(&result)
            return ["changes": Int(rowsChanged)]
        }
    }
    
    @objc public func query(_ database: String, statement: String) -> [String: Any] {
        return queryWithParams(database, statement: statement, values: nil)
    }
    
    @objc public func queryWithParams(_ database: String, statement: String, values: [Any]?) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var result = duckdb_result()
            var queryResult: duckdb_state
            
            if let params = values, !params.isEmpty {
                // Prepared statement with parameters
                var stmt: duckdb_prepared_statement? = nil
                let prepareResult = duckdb_prepare(conn, statement, &stmt)
                
                if prepareResult != DuckDBSuccess || stmt == nil {
                    let errorPtr = stmt != nil ? duckdb_prepare_error(stmt) : nil
                    let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Prepare failed"
                    if stmt != nil {
                        var mutableStmt = stmt
                        duckdb_destroy_prepare(&mutableStmt)
                    }
                    return ["error": errorMsg]
                }
                
                // Bind parameters
                for (index, value) in params.enumerated() {
                    let paramIndex = idx_t(index + 1)
                    let bindResult = bindValue(stmt: stmt!, index: paramIndex, value: value)
                    if bindResult != DuckDBSuccess {
                        var mutableStmt = stmt
                        duckdb_destroy_prepare(&mutableStmt)
                        return ["error": "Failed to bind parameter at index \(index + 1)"]
                    }
                }
                
                queryResult = duckdb_execute_prepared(stmt, &result)
                var mutableStmt = stmt
                duckdb_destroy_prepare(&mutableStmt)
            } else {
                queryResult = duckdb_query(conn, statement, &result)
            }
            
            defer {
                duckdb_destroy_result(&result)
            }
            
            if queryResult != DuckDBSuccess {
                let errorPtr = duckdb_result_error(&result)
                let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Unknown error"
                return ["error": errorMsg]
            }
            
            // Convert result to array of dictionaries
            let rows = resultToArray(&result)
            return ["values": rows]
        }
    }
    
    @objc public func run(_ database: String, statement: String, values: [Any]?) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var result = duckdb_result()
            var queryResult: duckdb_state
            
            if let params = values, !params.isEmpty {
                // Prepared statement with parameters
                var stmt: duckdb_prepared_statement? = nil
                let prepareResult = duckdb_prepare(conn, statement, &stmt)
                
                if prepareResult != DuckDBSuccess || stmt == nil {
                    let errorPtr = stmt != nil ? duckdb_prepare_error(stmt) : nil
                    let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Prepare failed"
                    if stmt != nil {
                        var mutableStmt = stmt
                        duckdb_destroy_prepare(&mutableStmt)
                    }
                    return ["error": errorMsg]
                }
                
                // Bind parameters
                for (index, value) in params.enumerated() {
                    let paramIndex = idx_t(index + 1)
                    let bindResult = bindValue(stmt: stmt!, index: paramIndex, value: value)
                    if bindResult != DuckDBSuccess {
                        var mutableStmt = stmt
                        duckdb_destroy_prepare(&mutableStmt)
                        return ["error": "Failed to bind parameter at index \(index + 1)"]
                    }
                }
                
                queryResult = duckdb_execute_prepared(stmt, &result)
                var mutableStmt = stmt
                duckdb_destroy_prepare(&mutableStmt)
            } else {
                queryResult = duckdb_query(conn, statement, &result)
            }
            
            defer {
                duckdb_destroy_result(&result)
            }
            
            if queryResult != DuckDBSuccess {
                let errorPtr = duckdb_result_error(&result)
                let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Unknown error"
                return ["error": errorMsg]
            }
            
            let rowsChanged = duckdb_rows_changed(&result)
            return ["changes": Int(rowsChanged)]
        }
    }
    
    @objc public func deleteDatabase(_ database: String) -> String? {
        return queue.sync {
            // Close if open
            if databases[database] != nil {
                if let error = close(database) {
                    return error
                }
            }
            
            let dbPath = databasePath(for: database)
            let fileManager = FileManager.default
            
            // Delete main database file
            if fileManager.fileExists(atPath: dbPath) {
                do {
                    try fileManager.removeItem(atPath: dbPath)
                } catch {
                    return "Failed to delete database: \(error.localizedDescription)"
                }
            }
            
            // Delete WAL file if exists
            let walPath = dbPath + ".wal"
            if fileManager.fileExists(atPath: walPath) {
                try? fileManager.removeItem(atPath: walPath)
            }
            
            return nil
        }
    }
    
    @objc public func databaseExists(_ database: String) -> Bool {
        let dbPath = databasePath(for: database)
        return FileManager.default.fileExists(atPath: dbPath)
    }
    
    @objc public func isOpen(_ database: String) -> Bool {
        return queue.sync {
            return databases[database] != nil
        }
    }
    
    @objc public func listTables(_ database: String) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var result = duckdb_result()
            let queryResult = duckdb_query(conn, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'", &result)
            
            defer {
                duckdb_destroy_result(&result)
            }
            
            if queryResult != DuckDBSuccess {
                let errorPtr = duckdb_result_error(&result)
                let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Unknown error"
                return ["error": errorMsg]
            }
            
            var tables: [String] = []
            let rowCount = duckdb_row_count(&result)
            
            for row in 0..<rowCount {
                let value = duckdb_value_varchar(&result, 0, row)
                if let value = value {
                    tables.append(String(cString: value))
                    duckdb_free(UnsafeMutableRawPointer(mutating: value))
                }
            }
            
            return ["tables": tables]
        }
    }
    
    @objc public func exportToParquetTemp(_ database: String, tableName: String, compression: String) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            // Create temp file path
            let tempDir = FileManager.default.temporaryDirectory
            let tempFileName = "\(tableName)_\(UUID().uuidString).parquet"
            let tempFilePath = tempDir.appendingPathComponent(tempFileName).path
            
            // First get row count
            var countResult = duckdb_result()
            let countQuery = "SELECT COUNT(*) FROM \"\(tableName)\""
            let countQueryResult = duckdb_query(conn, countQuery, &countResult)
            
            var rowCount: Int64 = 0
            if countQueryResult == DuckDBSuccess {
                rowCount = duckdb_value_int64(&countResult, 0, 0)
                duckdb_destroy_result(&countResult)
            }
            
            // Export to parquet
            let exportQuery = "COPY \"\(tableName)\" TO '\(tempFilePath)' (FORMAT PARQUET, COMPRESSION '\(compression)')"
            
            var result = duckdb_result()
            let queryResult = duckdb_query(conn, exportQuery, &result)
            
            defer {
                duckdb_destroy_result(&result)
            }
            
            if queryResult != DuckDBSuccess {
                let errorPtr = duckdb_result_error(&result)
                let errorMsg = errorPtr != nil ? String(cString: errorPtr!) : "Unknown error"
                return ["error": errorMsg]
            }
            
            return [
                "tempFilePath": tempFilePath,
                "rowCount": rowCount
            ]
        }
    }
    
    // MARK: - Private Helpers
    
    private func databasePath(for database: String) -> String {
        var dbName = database
        if !dbName.hasSuffix(".duckdb") && !dbName.hasSuffix(".db") {
            dbName += ".duckdb"
        }
        return databasesDirectory.appendingPathComponent(dbName).path
    }
    
    /// Copy a pre-built database from the app bundle if it exists and hasn't been copied yet.
    /// This allows bundling pre-populated databases (e.g., demo.duckdb with spatial data).
    /// The database should be placed in the app's bundle under "databases/" folder.
    private func copyDatabaseFromBundleIfNeeded(_ database: String) {
        var dbFileName = database
        if !dbFileName.hasSuffix(".duckdb") && !dbFileName.hasSuffix(".db") {
            dbFileName += ".duckdb"
        }
        
        let destPath = databasePath(for: database)
        let destURL = URL(fileURLWithPath: destPath)
        
        // If database already exists, don't overwrite
        if FileManager.default.fileExists(atPath: destPath) {
            print("[DuckDB] Database already exists at: \(destPath)")
            return
        }
        
        // Try to find the database in various bundle locations
        let bundle = Bundle.main
        
        // Try different locations where the database might be bundled
        let searchPaths = [
            // Capacitor app bundle structure: databases/demo.duckdb
            bundle.path(forResource: dbFileName.replacingOccurrences(of: ".duckdb", with: ""), 
                       ofType: "duckdb", 
                       inDirectory: Self.databasesSubfolder),
            // Direct in bundle: demo.duckdb
            bundle.path(forResource: dbFileName.replacingOccurrences(of: ".duckdb", with: ""), 
                       ofType: "duckdb"),
            // Try under public/databases (Capacitor web assets)
            bundle.path(forResource: dbFileName.replacingOccurrences(of: ".duckdb", with: ""), 
                       ofType: "duckdb", 
                       inDirectory: "public/\(Self.databasesSubfolder)")
        ]
        
        // Find the first existing source path
        guard let sourcePath = searchPaths.compactMap({ $0 }).first else {
            print("[DuckDB] No pre-built database in bundle for: \(database) (will create new)")
            return
        }
        
        print("[DuckDB] Copying database from bundle: \(sourcePath)")
        
        do {
            try FileManager.default.copyItem(atPath: sourcePath, toPath: destPath)
            
            // Get file size for logging
            let attrs = try FileManager.default.attributesOfItem(atPath: destPath)
            let fileSize = attrs[.size] as? Int64 ?? 0
            print("[DuckDB] Database copied successfully: \(fileSize) bytes")
        } catch {
            print("[DuckDB] Failed to copy database: \(error.localizedDescription)")
        }
    }
    
    private func bindValue(stmt: duckdb_prepared_statement, index: idx_t, value: Any) -> duckdb_state {
        if value is NSNull {
            return duckdb_bind_null(stmt, index)
        } else if let intValue = value as? Int {
            return duckdb_bind_int64(stmt, index, Int64(intValue))
        } else if let int64Value = value as? Int64 {
            return duckdb_bind_int64(stmt, index, int64Value)
        } else if let doubleValue = value as? Double {
            return duckdb_bind_double(stmt, index, doubleValue)
        } else if let floatValue = value as? Float {
            return duckdb_bind_double(stmt, index, Double(floatValue))
        } else if let boolValue = value as? Bool {
            return duckdb_bind_boolean(stmt, index, boolValue)
        } else if let stringValue = value as? String {
            return duckdb_bind_varchar(stmt, index, stringValue)
        } else {
            // Convert to string as fallback
            return duckdb_bind_varchar(stmt, index, String(describing: value))
        }
    }
    
    private func resultToArray(_ result: inout duckdb_result) -> [[String: Any]] {
        var rows: [[String: Any]] = []
        
        let columnCount = duckdb_column_count(&result)
        let rowCount = duckdb_row_count(&result)
        
        // Get column names
        var columnNames: [String] = []
        for col in 0..<columnCount {
            let name = duckdb_column_name(&result, col)
            columnNames.append(name != nil ? String(cString: name!) : "column_\(col)")
        }
        
        // Get column types
        var columnTypes: [duckdb_type] = []
        for col in 0..<columnCount {
            columnTypes.append(duckdb_column_type(&result, col))
        }
        
        // Extract rows
        for row in 0..<rowCount {
            var rowDict: [String: Any] = [:]
            
            for col in 0..<columnCount {
                let columnName = columnNames[Int(col)]
                
                // Check for NULL
                if duckdb_value_is_null(&result, col, row) {
                    rowDict[columnName] = NSNull()
                    continue
                }
                
                let type = columnTypes[Int(col)]
                let value = extractValue(result: &result, column: col, row: row, type: type)
                rowDict[columnName] = value
            }
            
            rows.append(rowDict)
        }
        
        return rows
    }
    
    private func extractValue(result: inout duckdb_result, column: idx_t, row: idx_t, type: duckdb_type) -> Any {
        switch type {
        case DUCKDB_TYPE_BOOLEAN:
            return duckdb_value_boolean(&result, column, row)
            
        case DUCKDB_TYPE_TINYINT:
            return Int(duckdb_value_int8(&result, column, row))
            
        case DUCKDB_TYPE_SMALLINT:
            return Int(duckdb_value_int16(&result, column, row))
            
        case DUCKDB_TYPE_INTEGER:
            return Int(duckdb_value_int32(&result, column, row))
            
        case DUCKDB_TYPE_BIGINT:
            return duckdb_value_int64(&result, column, row)
            
        case DUCKDB_TYPE_UTINYINT:
            return Int(duckdb_value_uint8(&result, column, row))
            
        case DUCKDB_TYPE_USMALLINT:
            return Int(duckdb_value_uint16(&result, column, row))
            
        case DUCKDB_TYPE_UINTEGER:
            return UInt32(duckdb_value_uint32(&result, column, row))
            
        case DUCKDB_TYPE_UBIGINT:
            return duckdb_value_uint64(&result, column, row)
            
        case DUCKDB_TYPE_FLOAT:
            return duckdb_value_float(&result, column, row)
            
        case DUCKDB_TYPE_DOUBLE:
            return duckdb_value_double(&result, column, row)
            
        case DUCKDB_TYPE_VARCHAR:
            let value = duckdb_value_varchar(&result, column, row)
            if let value = value {
                let str = String(cString: value)
                duckdb_free(UnsafeMutableRawPointer(mutating: value))
                return str
            }
            return ""
            
        case DUCKDB_TYPE_BLOB:
            let blob = duckdb_value_blob(&result, column, row)
            if blob.data != nil && blob.size > 0 {
                return Data(bytes: blob.data, count: Int(blob.size))
            }
            return Data()
            
        case DUCKDB_TYPE_TIMESTAMP, DUCKDB_TYPE_TIMESTAMP_S, DUCKDB_TYPE_TIMESTAMP_MS, DUCKDB_TYPE_TIMESTAMP_NS:
            // Return as ISO string
            let value = duckdb_value_varchar(&result, column, row)
            if let value = value {
                let str = String(cString: value)
                duckdb_free(UnsafeMutableRawPointer(mutating: value))
                return str
            }
            return ""
            
        case DUCKDB_TYPE_DATE:
            let value = duckdb_value_varchar(&result, column, row)
            if let value = value {
                let str = String(cString: value)
                duckdb_free(UnsafeMutableRawPointer(mutating: value))
                return str
            }
            return ""
            
        case DUCKDB_TYPE_TIME:
            let value = duckdb_value_varchar(&result, column, row)
            if let value = value {
                let str = String(cString: value)
                duckdb_free(UnsafeMutableRawPointer(mutating: value))
                return str
            }
            return ""
            
        case DUCKDB_TYPE_INTERVAL:
            let value = duckdb_value_varchar(&result, column, row)
            if let value = value {
                let str = String(cString: value)
                duckdb_free(UnsafeMutableRawPointer(mutating: value))
                return str
            }
            return ""
            
        default:
            // For complex types (LIST, STRUCT, MAP, etc.), convert to string
            let value = duckdb_value_varchar(&result, column, row)
            if let value = value {
                let str = String(cString: value)
                duckdb_free(UnsafeMutableRawPointer(mutating: value))
                return str
            }
            return ""
        }
    }
}
