/**
 * DuckDB iOS C++ Wrapper Implementation
 * 
 * This file provides a C-linkage wrapper for DuckDB operations.
 * It uses DuckDB's C++ API for all operations to ensure consistency
 * and proper support for statically linked extensions.
 */

#include "duckdb_ios.hpp"

// Include C++ API headers
#include "duckdb.hpp"
#include "duckdb/main/extension_helper.hpp"
#include "spatial/spatial_extension.hpp"

#include <string>
#include <sstream>
#include <iomanip>
#include <vector>
#include <cmath>
#include <cstring>
#include <cstdlib>
#include <memory>

// Use os_log for iOS logging
#include <os/log.h>
#define LOG_INFO(msg) os_log_info(OS_LOG_DEFAULT, "[DuckDB iOS] %{public}s", msg)
#define LOG_ERROR(msg) os_log_error(OS_LOG_DEFAULT, "[DuckDB iOS] %{public}s", msg)

// Wrapper structures
struct DatabaseWrapper {
    std::shared_ptr<duckdb::DuckDB> db;
    bool spatial_loaded;
    
    DatabaseWrapper() : spatial_loaded(false) {}
};

struct ConnectionWrapper {
    std::unique_ptr<duckdb::Connection> conn;
    DatabaseWrapper* db_wrapper; // Non-owning reference
};

struct PreparedWrapper {
    std::unique_ptr<duckdb::PreparedStatement> stmt;
    duckdb::vector<duckdb::Value> bindings;
};

// Helper to duplicate a C string (caller must free)
static char* duplicate_string(const std::string& str) {
    char* result = static_cast<char*>(malloc(str.length() + 1));
    if (result) {
        strcpy(result, str.c_str());
    }
    return result;
}

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
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(static_cast<unsigned char>(c));
                } else {
                    ss << c;
                }
        }
    }
    ss << '"';
    return ss.str();
}

// Convert DuckDB C++ result to JSON array of objects
// This version works with QueryResult base class
static std::string resultToJson(duckdb::QueryResult& result) {
    std::ostringstream json;
    json << "[";
    
    size_t column_count = result.ColumnCount();
    
    // Get column names and types
    const std::vector<std::string>& column_names = result.names;
    const std::vector<duckdb::LogicalType>& column_types = result.types;
    
    // Fetch data chunks and iterate
    bool first_row = true;
    duckdb::unique_ptr<duckdb::DataChunk> chunk;
    
    while ((chunk = result.Fetch()) != nullptr && chunk->size() > 0) {
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

extern "C" {

const char* duckdb_ios_get_version(void) {
    return duckdb::DuckDB::LibraryVersion();
}

DuckDBDatabaseHandle duckdb_ios_open_database(const char* path, char** error_out) {
    std::string pathStr = path ? path : "";
    LOG_INFO(pathStr.empty() ? "Opening in-memory database" : ("Opening database: " + pathStr).c_str());
    
    try {
        auto wrapper = new DatabaseWrapper();
        
        duckdb::DBConfig config;
        config.SetOptionByName("allow_unsigned_extensions", duckdb::Value(true));
        
        wrapper->db = std::make_shared<duckdb::DuckDB>(pathStr.empty() ? nullptr : pathStr.c_str(), &config);
        
        // Load spatial extension
        try {
            wrapper->db->LoadStaticExtension<duckdb::SpatialExtension>();
            wrapper->spatial_loaded = true;
            LOG_INFO("Spatial extension loaded successfully!");
        } catch (std::exception& e) {
            std::string msg = "Failed to load spatial extension: ";
            msg += e.what();
            LOG_ERROR(msg.c_str());
            // Continue anyway
        }
        
        return static_cast<DuckDBDatabaseHandle>(wrapper);
        
    } catch (std::exception& e) {
        if (error_out) {
            *error_out = duplicate_string(e.what());
        }
        return nullptr;
    }
}

void duckdb_ios_close_database(DuckDBDatabaseHandle db) {
    if (db) {
        auto wrapper = static_cast<DatabaseWrapper*>(db);
        LOG_INFO("Closing database");
        delete wrapper;
    }
}

DuckDBConnectionHandle duckdb_ios_connect(DuckDBDatabaseHandle db, char** error_out) {
    if (!db) {
        if (error_out) {
            *error_out = duplicate_string("Invalid database handle");
        }
        return nullptr;
    }
    
    auto db_wrapper = static_cast<DatabaseWrapper*>(db);
    
    try {
        auto conn_wrapper = new ConnectionWrapper();
        conn_wrapper->db_wrapper = db_wrapper;
        conn_wrapper->conn = std::make_unique<duckdb::Connection>(*db_wrapper->db);
        
        LOG_INFO("Connection created");
        return static_cast<DuckDBConnectionHandle>(conn_wrapper);
    } catch (std::exception& e) {
        if (error_out) {
            *error_out = duplicate_string(e.what());
        }
        return nullptr;
    }
}

void duckdb_ios_disconnect(DuckDBConnectionHandle conn) {
    if (conn) {
        auto wrapper = static_cast<ConnectionWrapper*>(conn);
        LOG_INFO("Disconnecting");
        delete wrapper;
    }
}

char* duckdb_ios_query(DuckDBConnectionHandle conn, const char* sql, char** error_out) {
    if (!conn || !sql) {
        if (error_out) {
            *error_out = duplicate_string(conn ? "Invalid SQL" : "Invalid connection");
        }
        return nullptr;
    }
    
    auto wrapper = static_cast<ConnectionWrapper*>(conn);
    
    try {
        auto result = wrapper->conn->Query(sql);
        
        if (result->HasError()) {
            if (error_out) {
                *error_out = duplicate_string(result->GetError());
            }
            return nullptr;
        }
        
        std::string json = resultToJson(*result);
        return duplicate_string(json);
        
    } catch (std::exception& e) {
        if (error_out) {
            *error_out = duplicate_string(e.what());
        }
        return nullptr;
    }
}

bool duckdb_ios_execute(DuckDBConnectionHandle conn, const char* sql, int64_t* rows_changed_out, char** error_out) {
    if (!conn || !sql) {
        if (error_out) {
            *error_out = duplicate_string(conn ? "Invalid SQL" : "Invalid connection");
        }
        return false;
    }
    
    auto wrapper = static_cast<ConnectionWrapper*>(conn);
    
    try {
        auto result = wrapper->conn->Query(sql);
        
        if (result->HasError()) {
            if (error_out) {
                *error_out = duplicate_string(result->GetError());
            }
            return false;
        }
        
        if (rows_changed_out) {
            // For MaterializedQueryResult (which Query returns by default for success), we can get RowCount
            // But for simple execution, we might want to check if it's a valid property
            // The C++ API doesn't have a direct "rows changed" for all query types, but RowCount works for INSERT/UPDATE
            // if it returns a MaterializedQueryResult.
            // However, Query() returns unique_ptr<QueryResult>.
            // We need to check the type or just use RowCount() if available.
            // QueryResult has RowCount() but it might be 0 for some operations.
            // Actually, for INSERT/UPDATE, DuckDB returns the count.
            // Let's assume RowCount() is what we want, similar to Android impl.
            *rows_changed_out = (int64_t)result->RowCount();
            
            // Note: Android impl uses result->RowCount()
        }
        
        return true;
        
    } catch (std::exception& e) {
        if (error_out) {
            *error_out = duplicate_string(e.what());
        }
        return false;
    }
}

DuckDBPreparedHandle duckdb_ios_prepare(DuckDBConnectionHandle conn, const char* sql, char** error_out) {
    if (!conn || !sql) {
        if (error_out) {
            *error_out = duplicate_string(conn ? "Invalid SQL" : "Invalid connection");
        }
        return nullptr;
    }
    
    auto conn_wrapper = static_cast<ConnectionWrapper*>(conn);
    
    try {
        auto stmt = conn_wrapper->conn->Prepare(sql);
        
        if (stmt->HasError()) {
            if (error_out) {
                *error_out = duplicate_string(stmt->GetError());
            }
            return nullptr;
        }
        
        auto prep_wrapper = new PreparedWrapper();
        prep_wrapper->stmt = std::move(stmt);
        prep_wrapper->bindings.resize(prep_wrapper->stmt->named_param_map.size());
        
        return static_cast<DuckDBPreparedHandle>(prep_wrapper);
        
    } catch (std::exception& e) {
        if (error_out) {
            *error_out = duplicate_string(e.what());
        }
        return nullptr;
    }
}

void duckdb_ios_destroy_prepared(DuckDBPreparedHandle stmt) {
    if (stmt) {
        auto wrapper = static_cast<PreparedWrapper*>(stmt);
        delete wrapper;
    }
}

bool duckdb_ios_bind_string(DuckDBPreparedHandle stmt, int index, const char* value) {
    if (!stmt || index < 1) return false;
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    int idx = index - 1;
    
    if (idx >= wrapper->bindings.size()) {
        wrapper->bindings.resize(idx + 1);
    }
    
    if (value) {
        wrapper->bindings[idx] = duckdb::Value(value);
    } else {
        wrapper->bindings[idx] = duckdb::Value();
    }
    
    return true;
}

bool duckdb_ios_bind_int64(DuckDBPreparedHandle stmt, int index, int64_t value) {
    if (!stmt || index < 1) return false;
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    int idx = index - 1;
    
    if (idx >= wrapper->bindings.size()) {
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value::BIGINT(value);
    return true;
}

bool duckdb_ios_bind_double(DuckDBPreparedHandle stmt, int index, double value) {
    if (!stmt || index < 1) return false;
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    int idx = index - 1;
    
    if (idx >= wrapper->bindings.size()) {
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value::DOUBLE(value);
    return true;
}

bool duckdb_ios_bind_bool(DuckDBPreparedHandle stmt, int index, bool value) {
    if (!stmt || index < 1) return false;
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    int idx = index - 1;
    
    if (idx >= wrapper->bindings.size()) {
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value::BOOLEAN(value);
    return true;
}

bool duckdb_ios_bind_null(DuckDBPreparedHandle stmt, int index) {
    if (!stmt || index < 1) return false;
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    int idx = index - 1;
    
    if (idx >= wrapper->bindings.size()) {
        wrapper->bindings.resize(idx + 1);
    }
    
    wrapper->bindings[idx] = duckdb::Value();
    return true;
}

void duckdb_ios_clear_bindings(DuckDBPreparedHandle stmt) {
    if (!stmt) return;
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    for (auto& val : wrapper->bindings) {
        val = duckdb::Value();
    }
}

char* duckdb_ios_execute_prepared(DuckDBPreparedHandle stmt, char** error_out) {
    if (!stmt) {
        if (error_out) {
            *error_out = duplicate_string("Invalid statement handle");
        }
        return nullptr;
    }
    
    auto wrapper = static_cast<PreparedWrapper*>(stmt);
    
    try {
        auto result = wrapper->stmt->Execute(wrapper->bindings);
        
        if (result->HasError()) {
            if (error_out) {
                *error_out = duplicate_string(result->GetError());
            }
            return nullptr;
        }
        
        std::string json = resultToJson(*result);
        return duplicate_string(json);
        
    } catch (std::exception& e) {
        if (error_out) {
            *error_out = duplicate_string(e.what());
        }
        return nullptr;
    }
}

void duckdb_ios_free_string(char* str) {
    if (str) {
        free(str);
    }
}

bool duckdb_ios_has_spatial_extension(DuckDBDatabaseHandle db) {
    if (!db) return false;
    
    auto wrapper = static_cast<DatabaseWrapper*>(db);
    return wrapper->spatial_loaded;
}

} // extern "C"
