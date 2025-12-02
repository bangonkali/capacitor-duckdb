import Foundation
import Capacitor
import UniformTypeIdentifiers
import UIKit

/**
 * Capacitor plugin for DuckDB database operations on iOS.
 */
@objc(CapacitorDuckDbPlugin)
public class CapacitorDuckDbPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "CapacitorDuckDbPlugin"
    public let jsName = "CapacitorDuckDb"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVersion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "execute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "run", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteDatabase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isDBExists", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isDBOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listTables", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickDirectory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportToParquet", returnType: CAPPluginReturnPromise)
    ]
    
    private let implementation = CapacitorDuckDb()
    private var pickDirectoryCall: CAPPluginCall?

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
    
    @objc func getVersion(_ call: CAPPluginCall) {
        let version = implementation.getVersion()
        call.resolve([
            "version": version
        ])
    }
    
    @objc func open(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        if let error = implementation.open(database) {
            call.reject(error)
        } else {
            call.resolve([
                "database": database
            ])
        }
    }
    
    @objc func close(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        if let error = implementation.close(database) {
            call.reject(error)
        } else {
            call.resolve([
                "database": database
            ])
        }
    }
    
    @objc func execute(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        guard let statements = call.getString("statements") else {
            call.reject("Missing statements parameter")
            return
        }
        
        let result = implementation.execute(database, statements: statements)
        
        if let error = result["error"] as? String {
            call.reject(error)
        } else {
            call.resolve([
                "changes": result["changes"] ?? 0
            ])
        }
    }
    
    @objc func query(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        guard let statement = call.getString("statement") else {
            call.reject("Missing statement parameter")
            return
        }
        
        let values = call.getArray("values") ?? []
        
        let result: [String: Any]
        if values.isEmpty {
            result = implementation.query(database, statement: statement)
        } else {
            result = implementation.queryWithParams(database, statement: statement, values: values)
        }
        
        if let error = result["error"] as? String {
            call.reject(error)
        } else {
            call.resolve([
                "values": result["values"] ?? []
            ])
        }
    }
    
    @objc func run(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        guard let statement = call.getString("statement") else {
            call.reject("Missing statement parameter")
            return
        }
        
        let values = call.getArray("values") ?? []
        
        let result = implementation.run(database, statement: statement, values: values.isEmpty ? nil : values)
        
        if let error = result["error"] as? String {
            call.reject(error)
        } else {
            call.resolve([
                "changes": result["changes"] ?? 0
            ])
        }
    }
    
    @objc func deleteDatabase(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        if let error = implementation.deleteDatabase(database) {
            call.reject(error)
        } else {
            call.resolve([
                "database": database
            ])
        }
    }
    
    @objc func isDBExists(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        let exists = implementation.databaseExists(database)
        call.resolve([
            "result": exists
        ])
    }
    
    @objc func isDBOpen(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        let isOpen = implementation.isOpen(database)
        call.resolve([
            "result": isOpen
        ])
    }
    
    @objc func listTables(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        let result = implementation.listTables(database)
        
        if let error = result["error"] as? String {
            call.reject(error)
        } else {
            call.resolve([
                "tables": result["tables"] ?? []
            ])
        }
    }
    
    @objc func pickDirectory(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.pickDirectoryCall = call
            
            let documentPicker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
            documentPicker.delegate = self
            documentPicker.allowsMultipleSelection = false
            
            if let viewController = self.bridge?.viewController {
                viewController.present(documentPicker, animated: true)
            } else {
                call.reject("Unable to present document picker")
            }
        }
    }
    
    @objc func exportToParquet(_ call: CAPPluginCall) {
        guard let database = call.getString("database") else {
            call.reject("Missing database parameter")
            return
        }
        
        guard let tableName = call.getString("tableName") else {
            call.reject("Missing tableName parameter")
            return
        }
        
        guard let directoryUri = call.getString("directoryUri") else {
            call.reject("Missing directoryUri parameter")
            return
        }
        
        let fileName = call.getString("fileName") ?? "\(tableName).parquet"
        let compression = call.getString("compression") ?? "zstd"
        
        // First export to temp location
        let tempResult = implementation.exportToParquetTemp(database, tableName: tableName, compression: compression)
        
        if let error = tempResult["error"] as? String {
            call.reject(error)
            return
        }
        
        guard let tempFilePath = tempResult["tempFilePath"] as? String else {
            call.reject("Failed to get temp file path")
            return
        }
        
        let rowCount = tempResult["rowCount"] as? Int64 ?? 0
        
        // Move from temp to target directory
        DispatchQueue.main.async { [weak self] in
            guard self != nil else { return }
            
            do {
                let tempFileURL = URL(fileURLWithPath: tempFilePath)
                let tempData = try Data(contentsOf: tempFileURL)
                
                // Parse directory URI (could be file:// or app-scoped URL)
                guard var directoryURL = URL(string: directoryUri) else {
                    call.reject("Invalid directory URI")
                    return
                }
                
                // Start accessing security-scoped resource if needed
                let needsSecurityScope = directoryURL.startAccessingSecurityScopedResource()
                
                defer {
                    if needsSecurityScope {
                        directoryURL.stopAccessingSecurityScopedResource()
                    }
                    // Clean up temp file
                    try? FileManager.default.removeItem(at: tempFileURL)
                }
                
                let targetURL = directoryURL.appendingPathComponent(fileName)
                try tempData.write(to: targetURL)
                
                // Get file size
                let attributes = try FileManager.default.attributesOfItem(atPath: targetURL.path)
                let fileSize = attributes[.size] as? Int64 ?? 0
                
                call.resolve([
                    "uri": targetURL.absoluteString,
                    "rowCount": rowCount,
                    "fileSize": fileSize
                ])
            } catch {
                call.reject("Failed to export: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - UIDocumentPickerDelegate
    
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickDirectoryCall, let url = urls.first else {
            pickDirectoryCall?.reject("No directory selected")
            pickDirectoryCall = nil
            return
        }
        
        // Start accessing security-scoped resource
        let didStart = url.startAccessingSecurityScopedResource()
        
        // Store bookmark for later access
        do {
            let bookmarkData = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
            
            // Store bookmark in UserDefaults for persistence
            UserDefaults.standard.set(bookmarkData, forKey: "duckdb_directory_bookmark")
            
            call.resolve([
                "uri": url.absoluteString,
                "name": url.lastPathComponent
            ])
        } catch {
            if didStart {
                url.stopAccessingSecurityScopedResource()
            }
            call.reject("Failed to create bookmark: \(error.localizedDescription)")
        }
        
        pickDirectoryCall = nil
    }
    
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickDirectoryCall?.reject("User cancelled directory picker")
        pickDirectoryCall = nil
    }
}
