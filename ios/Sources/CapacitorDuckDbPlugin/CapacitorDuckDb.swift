import Foundation
import DuckDBiOS

/**
 * DuckDB wrapper for iOS using C++ backend with static extension support.
 * 
 * This implementation uses the duckdb_ios C++ wrapper which properly loads
 * statically linked extensions (like spatial) using C++ template methods.
 * 
 * The C API (CDuckDB) does not support LoadStaticExtension<T>, which is why
 * this C++ wrapper is necessary for spatial extension functionality.
 */
@objc public class CapacitorDuckDb: NSObject {
    
    // MARK: - Properties
    
    /// Map of database name to C++ wrapper handle
    private var databases: [String: DuckDBDatabaseHandle] = [:]
    
    /// Map of database name to connection handle
    private var connections: [String: DuckDBConnectionHandle] = [:]
    
    /// Serial queue for thread-safe database access
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
        print("[DuckDB iOS] echo: \(value)")
        return value
    }
    
    @objc public func getVersion() -> String {
        guard let version = duckdb_ios_get_version() else {
            return "unknown"
        }
        return String(cString: version)
    }
    
    @objc public func open(_ database: String) -> String? {
        return queue.sync {
            // Check if already open
            if databases[database] != nil {
                print("[DuckDB iOS] Database already open: \(database)")
                return nil // Already open, not an error
            }
            
            // Try to copy pre-built database from bundle if available
            copyDatabaseFromBundleIfNeeded(database)
            
            let dbPath = databasePath(for: database)
            print("[DuckDB iOS] Opening database at: \(dbPath)")
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            
            // Open database using C++ wrapper (this loads spatial extension!)
            let db = duckdb_ios_open_database(dbPath, &errorPtr)
            
            // Check for error
            if db == nil {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown error opening database"
                }
                print("[DuckDB iOS] Failed to open database: \(errorMsg)")
                return "Failed to open database: \(errorMsg)"
            }
            
            // Create connection
            let conn = duckdb_ios_connect(db, &errorPtr)
            
            if conn == nil {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown error connecting"
                }
                duckdb_ios_close_database(db)
                print("[DuckDB iOS] Failed to connect: \(errorMsg)")
                return "Failed to connect to database: \(errorMsg)"
            }
            
            // Enable HNSW experimental persistence by default
            var rowsChanged: Int64 = 0
            _ = duckdb_ios_execute(conn, "SET hnsw_enable_experimental_persistence=true;", &rowsChanged, &errorPtr)
            
            databases[database] = db
            connections[database] = conn
            
            // Check if spatial extension loaded
            if duckdb_ios_has_spatial_extension(db) {
                print("[DuckDB iOS] ✅ Spatial extension is available!")
            } else {
                print("[DuckDB iOS] ⚠️ Spatial extension NOT loaded")
            }
            
            print("[DuckDB iOS] Database opened successfully: \(database)")
            return nil
        }
    }
    
    @objc public func close(_ database: String) -> String? {
        return queue.sync {
            guard let conn = connections[database] else {
                return "Database not open: \(database)"
            }
            
            // Disconnect
            duckdb_ios_disconnect(conn)
            connections.removeValue(forKey: database)
            
            // Close database
            if let db = databases[database] {
                duckdb_ios_close_database(db)
                databases.removeValue(forKey: database)
            }
            
            print("[DuckDB iOS] Database closed: \(database)")
            return nil
        }
    }
    
    @objc public func execute(_ database: String, statements: String) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            var rowsChanged: Int64 = 0
            
            let success = duckdb_ios_execute(conn, statements, &rowsChanged, &errorPtr)
            
            if !success {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown execution error"
                }
                return ["error": errorMsg]
            }
            
            return ["changes": Int(rowsChanged)]
        }
    }
    
    @objc public func query(_ database: String, statement: String) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            
            guard let jsonResult = duckdb_ios_query(conn, statement, &errorPtr) else {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown query error"
                }
                return ["error": errorMsg]
            }
            
            let jsonString = String(cString: jsonResult)
            duckdb_ios_free_string(jsonResult)
            
            // Parse JSON string to Swift array
            guard let data = jsonString.data(using: .utf8),
                  let values = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                return ["error": "Failed to parse query results"]
            }
            
            return ["values": values]
        }
    }
    
    @objc public func queryWithParams(_ database: String, statement: String, values: [Any]) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            
            // Prepare statement
            guard let stmt = duckdb_ios_prepare(conn, statement, &errorPtr) else {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown prepare error"
                }
                return ["error": errorMsg]
            }
            
            defer {
                duckdb_ios_destroy_prepared(stmt)
            }
            
            // Bind parameters
            for (index, value) in values.enumerated() {
                let paramIndex = Int32(index + 1)
                
                if value is NSNull {
                    _ = duckdb_ios_bind_null(stmt, paramIndex)
                } else if let intValue = value as? Int {
                    _ = duckdb_ios_bind_int64(stmt, paramIndex, Int64(intValue))
                } else if let int64Value = value as? Int64 {
                    _ = duckdb_ios_bind_int64(stmt, paramIndex, int64Value)
                } else if let doubleValue = value as? Double {
                    _ = duckdb_ios_bind_double(stmt, paramIndex, doubleValue)
                } else if let floatValue = value as? Float {
                    _ = duckdb_ios_bind_double(stmt, paramIndex, Double(floatValue))
                } else if let boolValue = value as? Bool {
                    _ = duckdb_ios_bind_bool(stmt, paramIndex, boolValue)
                } else if let stringValue = value as? String {
                    _ = duckdb_ios_bind_string(stmt, paramIndex, stringValue)
                } else {
                    // Convert to string as fallback
                    let strValue = String(describing: value)
                    _ = duckdb_ios_bind_string(stmt, paramIndex, strValue)
                }
            }
            
            // Execute prepared statement
            guard let jsonResult = duckdb_ios_execute_prepared(stmt, &errorPtr) else {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown prepared execution error"
                }
                return ["error": errorMsg]
            }
            
            let jsonString = String(cString: jsonResult)
            duckdb_ios_free_string(jsonResult)
            
            guard let data = jsonString.data(using: .utf8),
                  let resultValues = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                return ["error": "Failed to parse query results"]
            }
            
            return ["values": resultValues]
        }
    }
    
    @objc public func run(_ database: String, statement: String, values: [Any]?) -> [String: Any] {
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            
            // If no parameters, use simple execute
            guard let paramValues = values, !paramValues.isEmpty else {
                var rowsChanged: Int64 = 0
                let success = duckdb_ios_execute(conn, statement, &rowsChanged, &errorPtr)
                
                if !success {
                    let errorMsg: String
                    if let errPtr = errorPtr {
                        errorMsg = String(cString: errPtr)
                        duckdb_ios_free_string(errPtr)
                    } else {
                        errorMsg = "Unknown execution error"
                    }
                    return ["error": errorMsg]
                }
                
                return ["changes": Int(rowsChanged)]
            }
            
            // Prepare statement with parameters
            guard let stmt = duckdb_ios_prepare(conn, statement, &errorPtr) else {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown prepare error"
                }
                return ["error": errorMsg]
            }
            
            defer {
                duckdb_ios_destroy_prepared(stmt)
            }
            
            // Bind parameters
            for (index, value) in paramValues.enumerated() {
                let paramIndex = Int32(index + 1)
                
                if value is NSNull {
                    _ = duckdb_ios_bind_null(stmt, paramIndex)
                } else if let intValue = value as? Int {
                    _ = duckdb_ios_bind_int64(stmt, paramIndex, Int64(intValue))
                } else if let int64Value = value as? Int64 {
                    _ = duckdb_ios_bind_int64(stmt, paramIndex, int64Value)
                } else if let doubleValue = value as? Double {
                    _ = duckdb_ios_bind_double(stmt, paramIndex, doubleValue)
                } else if let floatValue = value as? Float {
                    _ = duckdb_ios_bind_double(stmt, paramIndex, Double(floatValue))
                } else if let boolValue = value as? Bool {
                    _ = duckdb_ios_bind_bool(stmt, paramIndex, boolValue)
                } else if let stringValue = value as? String {
                    _ = duckdb_ios_bind_string(stmt, paramIndex, stringValue)
                } else {
                    let strValue = String(describing: value)
                    _ = duckdb_ios_bind_string(stmt, paramIndex, strValue)
                }
            }
            
            // Execute
            guard let jsonResult = duckdb_ios_execute_prepared(stmt, &errorPtr) else {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown prepared execution error"
                }
                return ["error": errorMsg]
            }
            
            duckdb_ios_free_string(jsonResult)
            
            // For run(), we just return changes = 0 (actual count is harder to get)
            return ["changes": 0]
        }
    }
    
    @objc public func deleteDatabase(_ database: String) -> String? {
        return queue.sync {
            // Close if open
            if connections[database] != nil {
                if let error = close(database) {
                    return error
                }
            }
            
            let dbPath = databasePath(for: database)
            let walPath = dbPath + ".wal"
            
            do {
                let fm = FileManager.default
                if fm.fileExists(atPath: dbPath) {
                    try fm.removeItem(atPath: dbPath)
                }
                if fm.fileExists(atPath: walPath) {
                    try fm.removeItem(atPath: walPath)
                }
                print("[DuckDB iOS] Database deleted: \(database)")
                return nil
            } catch {
                return "Failed to delete database: \(error.localizedDescription)"
            }
        }
    }
    
    @objc public func databaseExists(_ database: String) -> Bool {
        let dbPath = databasePath(for: database)
        return FileManager.default.fileExists(atPath: dbPath)
    }
    
    @objc public func isOpen(_ database: String) -> Bool {
        return databases[database] != nil
    }
    
    @objc public func listTables(_ database: String) -> [String: Any] {
        return query(database, statement: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'")
    }
    
    @objc public func exportToParquet(_ database: String, tableName: String, filePath: String) -> [String: Any] {
        let sql = "COPY \(tableName) TO '\(filePath)' (FORMAT PARQUET)"
        
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            var rowsChanged: Int64 = 0
            
            let success = duckdb_ios_execute(conn, sql, &rowsChanged, &errorPtr)
            
            if !success {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown export error"
                }
                return ["error": errorMsg]
            }
            
            // Get file size and row count
            var fileSize: Int64 = 0
            if let attrs = try? FileManager.default.attributesOfItem(atPath: filePath) {
                fileSize = attrs[.size] as? Int64 ?? 0
            }
            
            // Get row count from table
            let countResult = query(database, statement: "SELECT COUNT(*) as cnt FROM \(tableName)")
            var rowCount: Int64 = 0
            if let values = countResult["values"] as? [[String: Any]],
               let first = values.first,
               let cnt = first["cnt"] as? Int64 {
                rowCount = cnt
            }
            
            return [
                "tableName": tableName,
                "tempFilePath": filePath,
                "rowCount": rowCount
            ]
        }
    }
    
    /// Export table to Parquet file in temp directory
    /// This is used by the plugin to first export to temp, then move to user-selected directory
    @objc public func exportToParquetTemp(_ database: String, tableName: String, compression: String) -> [String: Any] {
        // Create temp file path
        let tempDir = FileManager.default.temporaryDirectory
        let tempFileName = "\(tableName)_\(UUID().uuidString).parquet"
        let tempFilePath = tempDir.appendingPathComponent(tempFileName).path
        
        // Build SQL with compression
        let sql = "COPY \(tableName) TO '\(tempFilePath)' (FORMAT PARQUET, COMPRESSION '\(compression)')"
        
        return queue.sync {
            guard let conn = connections[database] else {
                return ["error": "Database not open: \(database)"]
            }
            
            var errorPtr: UnsafeMutablePointer<CChar>? = nil
            var rowsChanged: Int64 = 0
            
            let success = duckdb_ios_execute(conn, sql, &rowsChanged, &errorPtr)
            
            if !success {
                let errorMsg: String
                if let errPtr = errorPtr {
                    errorMsg = String(cString: errPtr)
                    duckdb_ios_free_string(errPtr)
                } else {
                    errorMsg = "Unknown export error"
                }
                return ["error": errorMsg]
            }
            
            // Get row count from table
            var rowCount: Int64 = 0
            
            // Use a separate query execution to avoid deadlock
            var countErrorPtr: UnsafeMutablePointer<CChar>? = nil
            if let jsonResult = duckdb_ios_query(conn, "SELECT COUNT(*) as cnt FROM \(tableName)", &countErrorPtr) {
                let jsonString = String(cString: jsonResult)
                duckdb_ios_free_string(jsonResult)
                
                if let data = jsonString.data(using: .utf8),
                   let values = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                   let first = values.first {
                    // Try different ways to extract count
                    if let cnt = first["cnt"] as? Int64 {
                        rowCount = cnt
                    } else if let cnt = first["cnt"] as? Int {
                        rowCount = Int64(cnt)
                    } else if let cnt = first["cnt"] as? NSNumber {
                        rowCount = cnt.int64Value
                    }
                }
            }
            if let errPtr = countErrorPtr {
                duckdb_ios_free_string(errPtr)
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
            print("[DuckDB iOS] Database already exists at: \(destPath)")
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
            print("[DuckDB iOS] No pre-built database in bundle for: \(database) (will create new)")
            return
        }
        
        print("[DuckDB iOS] Copying database from bundle: \(sourcePath)")
        
        do {
            try FileManager.default.copyItem(atPath: sourcePath, toPath: destPath)
            
            // Get file size for logging
            let attrs = try FileManager.default.attributesOfItem(atPath: destPath)
            let fileSize = attrs[.size] as? Int64 ?? 0
            print("[DuckDB iOS] Database copied successfully: \(fileSize) bytes")
        } catch {
            print("[DuckDB iOS] Failed to copy database: \(error.localizedDescription)")
        }
    }
}
