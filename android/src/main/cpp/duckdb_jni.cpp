/**
 * DuckDB JNI Wrapper for Capacitor
 * 
 * This file provides JNI bindings between Java and DuckDB.
 * It uses C++ API to properly load statically linked extensions (like spatial),
 * then uses C API for query execution.
 * Results are returned as JSON strings for easy parsing in Java/JavaScript.
 */

#include <jni.h>
#include <string>
#include <sstream>
#include <iomanip>
#include <vector>
#include <map>
#include <android/log.h>

// C++ API for database and extension loading
#include "duckdb.hpp"
#include "duckdb/main/extension_helper.hpp"
#include "spatial/spatial_extension.hpp"

// C API for query execution (more stable ABI)
#include "duckdb.h"

#define LOG_TAG "DuckDBJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// Wrapper to hold both C++ database object and C API handle
struct DatabaseWrapper {
    std::shared_ptr<duckdb::DuckDB> cpp_db;
    duckdb_database c_db;  // This will be set from cpp_db
    
    ~DatabaseWrapper() {
        // Don't close c_db - it's managed by cpp_db
    }
};

// Wrapper for prepared statement with bindings
struct PreparedStatementWrapper {
    duckdb::unique_ptr<duckdb::PreparedStatement> stmt;
    duckdb::vector<duckdb::Value> bindings;
    
    PreparedStatementWrapper(duckdb::unique_ptr<duckdb::PreparedStatement> s) 
        : stmt(std::move(s)) {}
};

// Helper to escape JSON strings
static std::string escapeJsonString(const std::string& str) {
    std::ostringstream ss;
    ss << '"';
    for (char c : str) {
        switch (c) {
            case '"': ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\b': ss << "\\b"; break;
            case '\f': ss << "\\f"; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if ('\x00' <= c && c <= '\x1f') {
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    ss << c;
                }
        }
    }
    ss << '"';
    return ss.str();
}

// Convert DuckDB C++ result to JSON array of objects (column-name keyed)
// This version works with QueryResult base class (e.g., from PreparedStatement::Execute)
static std::string queryResultToJson(duckdb::unique_ptr<duckdb::QueryResult>& result) {
    std::ostringstream json;
    json << "[";
    
    size_t column_count = result->ColumnCount();
    
    // Get column names and types from public member variables
    const std::vector<std::string>& column_names = result->names;
    const std::vector<duckdb::LogicalType>& column_types = result->types;
    
    // Fetch data chunks and iterate
    bool first_row = true;
    duckdb::unique_ptr<duckdb::DataChunk> chunk;
    
    while ((chunk = result->Fetch()) != nullptr && chunk->size() > 0) {
        for (size_t row = 0; row < chunk->size(); row++) {
            if (!first_row) {
                json << ",";
            }
            first_row = false;
            json << "{";
            
            for (size_t col = 0; col < column_count; col++) {
                if (col > 0) {
                    json << ",";
                }
                
                json << escapeJsonString(column_names[col]) << ":";
                
                duckdb::Value val = chunk->GetValue(col, row);
                
                if (val.IsNull()) {
                    json << "null";
                } else {
                    const auto& type = column_types[col];
                    
                    switch (type.id()) {
                        case duckdb::LogicalTypeId::BOOLEAN:
                            json << (val.GetValue<bool>() ? "true" : "false");
                            break;
                        case duckdb::LogicalTypeId::TINYINT:
                        case duckdb::LogicalTypeId::SMALLINT:
                        case duckdb::LogicalTypeId::INTEGER:
                        case duckdb::LogicalTypeId::BIGINT:
                            json << val.GetValue<int64_t>();
                            break;
                        case duckdb::LogicalTypeId::UTINYINT:
                        case duckdb::LogicalTypeId::USMALLINT:
                        case duckdb::LogicalTypeId::UINTEGER:
                        case duckdb::LogicalTypeId::UBIGINT:
                            json << val.GetValue<uint64_t>();
                            break;
                        case duckdb::LogicalTypeId::FLOAT:
                            json << val.GetValue<float>();
                            break;
                        case duckdb::LogicalTypeId::DOUBLE:
                            json << val.GetValue<double>();
                            break;
                        default:
                            // For all other types, convert to string
                            json << escapeJsonString(val.ToString());
                            break;
                    }
                }
            }
            
            json << "}";
        }
    }
    
    json << "]";
    return json.str();
}

// Convert DuckDB C++ result to JSON array of objects (column-name keyed)
// This version works with MaterializedQueryResult (from Connection::Query)
static std::string resultToJson(duckdb::unique_ptr<duckdb::MaterializedQueryResult>& result) {
    std::ostringstream json;
    json << "[";
    
    size_t column_count = result->ColumnCount();
    size_t row_count = result->RowCount();
    
    // Get column names and types from public member variables
    const std::vector<std::string>& column_names = result->names;
    const std::vector<duckdb::LogicalType>& column_types = result->types;
    
    // Iterate through rows
    for (size_t row = 0; row < row_count; row++) {
        if (row > 0) {
            json << ",";
        }
        json << "{";
        
        for (size_t col = 0; col < column_count; col++) {
            if (col > 0) {
                json << ",";
            }
            
            json << escapeJsonString(column_names[col]) << ":";
            
            duckdb::Value val = result->GetValue(col, row);
            
            if (val.IsNull()) {
                json << "null";
            } else {
                const auto& type = column_types[col];
                
                switch (type.id()) {
                    case duckdb::LogicalTypeId::BOOLEAN:
                        json << (val.GetValue<bool>() ? "true" : "false");
                        break;
                    case duckdb::LogicalTypeId::TINYINT:
                    case duckdb::LogicalTypeId::SMALLINT:
                    case duckdb::LogicalTypeId::INTEGER:
                    case duckdb::LogicalTypeId::BIGINT:
                        json << val.GetValue<int64_t>();
                        break;
                    case duckdb::LogicalTypeId::UTINYINT:
                    case duckdb::LogicalTypeId::USMALLINT:
                    case duckdb::LogicalTypeId::UINTEGER:
                    case duckdb::LogicalTypeId::UBIGINT:
                        json << val.GetValue<uint64_t>();
                        break;
                    case duckdb::LogicalTypeId::FLOAT:
                        json << val.GetValue<float>();
                        break;
                    case duckdb::LogicalTypeId::DOUBLE:
                        json << val.GetValue<double>();
                        break;
                    default:
                        // For all other types, convert to string
                        json << escapeJsonString(val.ToString());
                        break;
                }
            }
        }
        
        json << "}";
    }
    
    json << "]";
    return json.str();
}

extern "C" {

/**
 * Get DuckDB library version
 */
JNIEXPORT jstring JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_getVersion(JNIEnv *env, jclass clazz) {
    const char* version = duckdb_library_version();
    return env->NewStringUTF(version ? version : "unknown");
}

/**
 * Open a DuckDB database
 * @param path Database file path (empty string or null for in-memory)
 * @return Database handle pointer as long, or 0 on failure
 */
JNIEXPORT jlong JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_openDatabase(JNIEnv *env, jclass clazz, jstring path) {
    std::string pathStr = "";
    
    if (path != nullptr) {
        const char* pathCStr = env->GetStringUTFChars(path, nullptr);
        if (pathCStr != nullptr) {
            pathStr = pathCStr;
            env->ReleaseStringUTFChars(path, pathCStr);
        }
    }
    
    LOGI("Opening database with C++ API: %s", pathStr.empty() ? ":memory:" : pathStr.c_str());
    
    try {
        // Create config using C++ API
        duckdb::DBConfig config;
        config.SetOptionByName("allow_unsigned_extensions", duckdb::Value(true));
        
        // Open database with C++ API
        auto wrapper = new DatabaseWrapper();
        wrapper->cpp_db = std::make_shared<duckdb::DuckDB>(pathStr.empty() ? nullptr : pathStr.c_str(), &config);
        
        LOGI("Database opened successfully with C++ API");
        
        // Load the spatial extension using C++ template method
        LOGI("Loading spatial extension...");
        try {
            wrapper->cpp_db->LoadStaticExtension<duckdb::SpatialExtension>();
            LOGI("Spatial extension loaded successfully!");
        } catch (std::exception& e) {
            LOGE("Failed to load spatial extension: %s", e.what());
            // Continue anyway - database still usable
        }
        
        // Get the internal C database handle for compatibility with C API queries
        // The DuckDB class holds a shared_ptr to DatabaseInstance
        // We need to create a C API compatible handle
        wrapper->c_db = reinterpret_cast<duckdb_database>(wrapper->cpp_db.get());
        
        LOGI("Database wrapper created, handle: %p", wrapper);
        return reinterpret_cast<jlong>(wrapper);
        
    } catch (std::exception& e) {
        LOGE("Failed to open database: %s", e.what());
        return 0;
    }
}

/**
 * Close a DuckDB database
 * @param dbPtr Database handle pointer
 */
JNIEXPORT void JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_closeDatabase(JNIEnv *env, jclass clazz, jlong dbPtr) {
    if (dbPtr == 0) {
        LOGE("Invalid database handle");
        return;
    }
    
    DatabaseWrapper* wrapper = reinterpret_cast<DatabaseWrapper*>(dbPtr);
    LOGI("Closing database, handle: %p", wrapper);
    
    delete wrapper;
}

/**
 * Create a connection to a database
 * @param dbPtr Database handle pointer
 * @return Connection handle pointer as long, or 0 on failure
 */
JNIEXPORT jlong JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_connect(JNIEnv *env, jclass clazz, jlong dbPtr) {
    if (dbPtr == 0) {
        LOGE("Invalid database handle");
        return 0;
    }
    
    DatabaseWrapper* wrapper = reinterpret_cast<DatabaseWrapper*>(dbPtr);
    
    try {
        // Create connection using C++ API
        auto conn = new duckdb::Connection(*wrapper->cpp_db);
        
        LOGI("Connection created with C++ API, handle: %p", conn);
        return reinterpret_cast<jlong>(conn);
    } catch (std::exception& e) {
        LOGE("Failed to create connection: %s", e.what());
        return 0;
    }
}

/**
 * Disconnect from a database
 * @param connPtr Connection handle pointer
 */
JNIEXPORT void JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_disconnect(JNIEnv *env, jclass clazz, jlong connPtr) {
    if (connPtr == 0) {
        LOGE("Invalid connection handle");
        return;
    }
    
    duckdb::Connection* conn = reinterpret_cast<duckdb::Connection*>(connPtr);
    LOGI("Disconnecting, handle: %p", conn);
    
    delete conn;
}

/**
 * Execute a SQL query and return results as JSON
 * @param connPtr Connection handle pointer
 * @param sql SQL query string
 * @return JSON string with results, or error message prefixed with "ERROR:"
 */
JNIEXPORT jstring JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_query(JNIEnv *env, jclass clazz, jlong connPtr, jstring sql) {
    if (connPtr == 0) {
        return env->NewStringUTF("ERROR:Invalid connection handle");
    }
    
    const char* sqlStr = env->GetStringUTFChars(sql, nullptr);
    if (sqlStr == nullptr) {
        return env->NewStringUTF("ERROR:Invalid SQL string");
    }
    
    LOGI("Executing query: %s", sqlStr);
    
    duckdb::Connection* conn = reinterpret_cast<duckdb::Connection*>(connPtr);
    
    try {
        auto result = conn->Query(sqlStr);
        env->ReleaseStringUTFChars(sql, sqlStr);
        
        if (result->HasError()) {
            std::string errorMsg = "ERROR:" + result->GetError();
            LOGE("Query failed: %s", errorMsg.c_str());
            return env->NewStringUTF(errorMsg.c_str());
        }
        
        std::string jsonResult = resultToJson(result);
        
        LOGI("Query returned %zu characters of JSON", jsonResult.length());
        return env->NewStringUTF(jsonResult.c_str());
        
    } catch (std::exception& e) {
        env->ReleaseStringUTFChars(sql, sqlStr);
        std::string errorMsg = "ERROR:" + std::string(e.what());
        LOGE("Query exception: %s", errorMsg.c_str());
        return env->NewStringUTF(errorMsg.c_str());
    }
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)
 * @param connPtr Connection handle pointer
 * @param sql SQL statement string
 * @return JSON string with changes count, or error message prefixed with "ERROR:"
 */
JNIEXPORT jstring JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_execute(JNIEnv *env, jclass clazz, jlong connPtr, jstring sql) {
    if (connPtr == 0) {
        return env->NewStringUTF("ERROR:Invalid connection handle");
    }
    
    const char* sqlStr = env->GetStringUTFChars(sql, nullptr);
    if (sqlStr == nullptr) {
        return env->NewStringUTF("ERROR:Invalid SQL string");
    }
    
    LOGI("Executing statement: %s", sqlStr);
    
    duckdb::Connection* conn = reinterpret_cast<duckdb::Connection*>(connPtr);
    
    try {
        auto result = conn->Query(sqlStr);
        env->ReleaseStringUTFChars(sql, sqlStr);
        
        if (result->HasError()) {
            std::string errorMsg = "ERROR:" + result->GetError();
            LOGE("Statement failed: %s", errorMsg.c_str());
            return env->NewStringUTF(errorMsg.c_str());
        }
        
        // Get rows changed (for INSERT/UPDATE/DELETE)
        int64_t rows_changed = result->RowCount();
        
        std::ostringstream json;
        json << "{\"changes\":" << rows_changed << "}";
        
        LOGI("Statement executed, %lld rows changed", (long long)rows_changed);
        return env->NewStringUTF(json.str().c_str());
        
    } catch (std::exception& e) {
        env->ReleaseStringUTFChars(sql, sqlStr);
        std::string errorMsg = "ERROR:" + std::string(e.what());
        LOGE("Statement exception: %s", errorMsg.c_str());
        return env->NewStringUTF(errorMsg.c_str());
    }
}

/**
 * Prepare a SQL statement
 * @param connPtr Connection handle pointer
 * @param sql SQL statement string
 * @return Prepared statement handle pointer as long, or 0 on failure
 */
JNIEXPORT jlong JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_prepare(JNIEnv *env, jclass clazz, jlong connPtr, jstring sql) {
    if (connPtr == 0) {
        LOGE("Invalid connection handle");
        return 0;
    }
    
    const char* sqlStr = env->GetStringUTFChars(sql, nullptr);
    if (sqlStr == nullptr) {
        LOGE("Invalid SQL string");
        return 0;
    }
    
    LOGI("Preparing statement: %s", sqlStr);
    
    duckdb::Connection* conn = reinterpret_cast<duckdb::Connection*>(connPtr);
    
    try {
        auto stmt = conn->Prepare(sqlStr);
        env->ReleaseStringUTFChars(sql, sqlStr);
        
        if (stmt->HasError()) {
            LOGE("Prepare failed: %s", stmt->GetError().c_str());
            return 0;
        }
        
        // Get the number of parameters from the named_param_map
        // For positional params like $1, $2, the map contains entries like "1" -> 0, "2" -> 1
        auto n_params = stmt->named_param_map.size();
        LOGI("Statement has %zu parameters from named_param_map", (size_t)n_params);
        
        // Log the parameter names for debugging
        for (auto& pair : stmt->named_param_map) {
            LOGI("  Param: '%s' -> index %llu", pair.first.c_str(), (unsigned long long)pair.second);
        }
        
        // Create wrapper with bindings vector
        auto* wrapper = new PreparedStatementWrapper(std::move(stmt));
        wrapper->bindings.resize(n_params);
        
        LOGI("Statement prepared, handle: %p, bindings size: %zu", wrapper, wrapper->bindings.size());
        return reinterpret_cast<jlong>(wrapper);
        
    } catch (std::exception& e) {
        env->ReleaseStringUTFChars(sql, sqlStr);
        LOGE("Prepare exception: %s", e.what());
        return 0;
    }
}

/**
 * Destroy a prepared statement
 * @param stmtPtr Prepared statement handle pointer
 */
JNIEXPORT void JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_destroyPrepared(JNIEnv *env, jclass clazz, jlong stmtPtr) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    LOGI("Destroying prepared statement, handle: %p", wrapper);
    
    delete wrapper;
}

/**
 * Bind a string parameter to a prepared statement
 * @param stmtPtr Prepared statement handle pointer
 * @param index Parameter index (1-based)
 * @param value Parameter value
 * @return true on success, false on failure
 */
JNIEXPORT jboolean JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_bindString(JNIEnv *env, jclass clazz, jlong stmtPtr, jint index, jstring value) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return JNI_FALSE;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    // Convert 1-based index to 0-based
    int idx = index - 1;
    if (idx < 0) {
        LOGE("Parameter index %d is invalid (must be >= 1)", index);
        return JNI_FALSE;
    }
    
    // Dynamically resize bindings if needed
    if (idx >= (int)wrapper->bindings.size()) {
        LOGI("Resizing bindings from %zu to %d for index %d", wrapper->bindings.size(), idx + 1, index);
        wrapper->bindings.resize(idx + 1);
    }
    
    const char* str = env->GetStringUTFChars(value, nullptr);
    if (str == nullptr) {
        LOGI("bindString: index=%d, value is NULL (Java null string)", index);
        wrapper->bindings[idx] = duckdb::Value();  // null
    } else {
        std::string strVal(str);
        LOGI("bindString: index=%d, value='%s' (len=%zu)", index, strVal.c_str(), strVal.length());
        wrapper->bindings[idx] = duckdb::Value(strVal);
        env->ReleaseStringUTFChars(value, str);
    }
    
    return JNI_TRUE;
}

/**
 * Bind an integer parameter to a prepared statement
 * @param stmtPtr Prepared statement handle pointer
 * @param index Parameter index (1-based)
 * @param value Parameter value
 * @return true on success, false on failure
 */
JNIEXPORT jboolean JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_bindLong(JNIEnv *env, jclass clazz, jlong stmtPtr, jint index, jlong value) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return JNI_FALSE;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    // Convert 1-based index to 0-based
    int idx = index - 1;
    if (idx < 0) {
        LOGE("Parameter index %d is invalid (must be >= 1)", index);
        return JNI_FALSE;
    }
    
    // Dynamically resize bindings if needed
    if (idx >= (int)wrapper->bindings.size()) {
        LOGI("Resizing bindings from %zu to %d for index %d", wrapper->bindings.size(), idx + 1, index);
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value::BIGINT(value);
    
    LOGI("bindLong: index=%d, value=%lld", index, (long long)value);
    return JNI_TRUE;
}

/**
 * Bind a double parameter to a prepared statement
 * @param stmtPtr Prepared statement handle pointer
 * @param index Parameter index (1-based)
 * @param value Parameter value
 * @return true on success, false on failure
 */
JNIEXPORT jboolean JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_bindDouble(JNIEnv *env, jclass clazz, jlong stmtPtr, jint index, jdouble value) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return JNI_FALSE;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    // Convert 1-based index to 0-based
    int idx = index - 1;
    if (idx < 0) {
        LOGE("Parameter index %d is invalid (must be >= 1)", index);
        return JNI_FALSE;
    }
    
    // Dynamically resize bindings if needed
    if (idx >= (int)wrapper->bindings.size()) {
        LOGI("Resizing bindings from %zu to %d for index %d", wrapper->bindings.size(), idx + 1, index);
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value::DOUBLE(value);
    
    LOGI("bindDouble: index=%d, value=%f", index, value);
    return JNI_TRUE;
}

/**
 * Bind a boolean parameter to a prepared statement
 * @param stmtPtr Prepared statement handle pointer
 * @param index Parameter index (1-based)
 * @param value Parameter value
 * @return true on success, false on failure
 */
JNIEXPORT jboolean JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_bindBoolean(JNIEnv *env, jclass clazz, jlong stmtPtr, jint index, jboolean value) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return JNI_FALSE;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    // Convert 1-based index to 0-based
    int idx = index - 1;
    if (idx < 0) {
        LOGE("Parameter index %d is invalid (must be >= 1)", index);
        return JNI_FALSE;
    }
    
    // Dynamically resize bindings if needed
    if (idx >= (int)wrapper->bindings.size()) {
        LOGI("Resizing bindings from %zu to %d for index %d", wrapper->bindings.size(), idx + 1, index);
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value::BOOLEAN(value == JNI_TRUE);
    
    LOGI("bindBoolean: index=%d, value=%s", index, value ? "true" : "false");
    return JNI_TRUE;
}

/**
 * Bind a null parameter to a prepared statement
 * @param stmtPtr Prepared statement handle pointer
 * @param index Parameter index (1-based)
 * @return true on success, false on failure
 */
JNIEXPORT jboolean JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_bindNull(JNIEnv *env, jclass clazz, jlong stmtPtr, jint index) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return JNI_FALSE;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    // Convert 1-based index to 0-based
    int idx = index - 1;
    if (idx < 0) {
        LOGE("Parameter index %d is invalid (must be >= 1)", index);
        return JNI_FALSE;
    }
    
    // Dynamically resize bindings if needed
    if (idx >= (int)wrapper->bindings.size()) {
        LOGI("Resizing bindings from %zu to %d for index %d", wrapper->bindings.size(), idx + 1, index);
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value();  // null value
    
    LOGI("bindNull: index=%d", index);
    return JNI_TRUE;
}

/**
 * Execute a prepared statement and return results as JSON
 * @param stmtPtr Prepared statement handle pointer
 * @return JSON string with results, or error message prefixed with "ERROR:"
 */
JNIEXPORT jstring JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_executePrepared(JNIEnv *env, jclass clazz, jlong stmtPtr) {
    if (stmtPtr == 0) {
        return env->NewStringUTF("ERROR:Invalid statement handle");
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    LOGI("Executing prepared statement with %zu bindings, handle: %p", wrapper->bindings.size(), wrapper);
    
    try {
        // Execute with the stored bindings - use explicit non-template version
        duckdb::vector<duckdb::Value>& values_ref = wrapper->bindings;
        auto result = wrapper->stmt->Execute(values_ref, false);
        
        if (result->HasError()) {
            std::string errorMsg = "ERROR:" + result->GetError();
            LOGE("Prepared execution failed: %s", errorMsg.c_str());
            return env->NewStringUTF(errorMsg.c_str());
        }
        
        // Use queryResultToJson for QueryResult (base class)
        std::string jsonResult = queryResultToJson(result);
        
        LOGI("Prepared execution returned %zu characters of JSON", jsonResult.length());
        return env->NewStringUTF(jsonResult.c_str());
        
    } catch (std::exception& e) {
        std::string errorMsg = "ERROR:" + std::string(e.what());
        LOGE("Prepared execution exception: %s", errorMsg.c_str());
        return env->NewStringUTF(errorMsg.c_str());
    }
}

/**
 * Clear bindings on a prepared statement for reuse
 * @param stmtPtr Prepared statement handle pointer
 * @return true on success, false on failure
 */
JNIEXPORT jboolean JNICALL
Java_ph_com_regalado_capacitor_duckdb_DuckDBNative_clearBindings(JNIEnv *env, jclass clazz, jlong stmtPtr) {
    if (stmtPtr == 0) {
        LOGE("Invalid statement handle");
        return JNI_FALSE;
    }
    
    auto* wrapper = reinterpret_cast<PreparedStatementWrapper*>(stmtPtr);
    
    // Clear all bindings (reset to null values)
    for (auto& binding : wrapper->bindings) {
        binding = duckdb::Value();
    }
    
    LOGI("clearBindings: cleared %zu bindings", wrapper->bindings.size());
    return JNI_TRUE;
}

} // extern "C"
