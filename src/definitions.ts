/**
 * Options for opening a database
 */
export interface OpenOptions {
  /** Database name (will be stored in app's internal storage) */
  database: string;
}

/**
 * Options for executing SQL statements
 */
export interface ExecuteOptions {
  /** Database name */
  database: string;
  /** SQL statements to execute (can be multiple statements separated by ;) */
  statements: string;
}

/**
 * Options for querying data
 */
export interface QueryOptions {
  /** Database name */
  database: string;
  /** SQL query statement */
  statement: string;
  /** Parameter values for prepared statements (use $1, $2, etc. as placeholders) */
  values?: any[];
}

/**
 * Options for running a statement with parameters
 */
export interface RunOptions {
  /** Database name */
  database: string;
  /** SQL statement (INSERT, UPDATE, DELETE) */
  statement: string;
  /** Parameter values for prepared statements (use $1, $2, etc. as placeholders) */
  values?: any[];
}

/**
 * Options for database operations
 */
export interface DatabaseOptions {
  /** Database name */
  database: string;
}

/**
 * Result of execute operation
 */
export interface ExecuteResult {
  /** Number of rows changed */
  changes: number;
}

/**
 * Result of query operation
 */
export interface QueryResult {
  /** Array of row objects (column-name keyed) */
  values: Record<string, any>[];
}

/**
 * Result of run operation
 */
export interface RunResult {
  /** Number of rows changed */
  changes: number;
}

/**
 * Result of version check
 */
export interface VersionResult {
  /** DuckDB library version */
  version: string;
}

/**
 * Result of boolean check operations
 */
export interface BooleanResult {
  /** Result of the check */
  result: boolean;
}

/**
 * Options for exporting a table to Parquet format
 */
export interface ExportParquetOptions {
  /** Database name */
  database: string;
  /** Table name to export */
  tableName: string;
  /** Directory URI (from pickDirectory) where to save the file */
  directoryUri: string;
  /** Optional filename (defaults to tableName.parquet) */
  fileName?: string;
  /** Optional compression type: 'snappy' (default), 'gzip', 'zstd', 'uncompressed' */
  compression?: 'snappy' | 'gzip' | 'zstd' | 'uncompressed';
}

/**
 * Result of export operation
 */
export interface ExportResult {
  /** Whether the export was successful */
  success: boolean;
  /** Path or URI where the file was saved */
  path: string;
  /** Number of rows exported */
  rowCount: number;
  /** File size in bytes */
  fileSize: number;
}

/**
 * Result of pick directory operation
 */
export interface PickDirectoryResult {
  /** Directory URI that can be used for export operations */
  uri: string;
  /** Display name of the directory */
  name: string;
}

/**
 * Options for listing tables
 */
export interface ListTablesOptions {
  /** Database name */
  database: string;
}

/**
 * Result of listing tables
 */
export interface ListTablesResult {
  /** Array of table names */
  tables: string[];
}

/**
 * Capacitor plugin for DuckDB database operations.
 * 
 * DuckDB is an in-process SQL OLAP database management system.
 * This plugin provides native DuckDB support for Capacitor-based
 * Android and iOS applications.
 */
export interface CapacitorDuckDbPlugin {
  /**
   * Get the DuckDB library version.
   * @returns Promise with version string
   */
  getVersion(): Promise<VersionResult>;

  /**
   * Open a database. Creates the database file if it doesn't exist.
   * The database file is stored in the app's internal storage directory.
   * 
   * @param options - Database name
   * @returns Promise that resolves when database is opened
   * 
   * @example
   * ```typescript
   * await CapacitorDuckDb.open({ database: 'mydb' });
   * ```
   */
  open(options: OpenOptions): Promise<{ database: string }>;

  /**
   * Close a database connection.
   * 
   * @param options - Database name
   * @returns Promise that resolves when database is closed
   */
  close(options: DatabaseOptions): Promise<{ database: string }>;

  /**
   * Execute SQL statements (CREATE, INSERT, UPDATE, DELETE, etc.).
   * Can execute multiple statements separated by semicolons.
   * 
   * @param options - Database and SQL statements
   * @returns Promise with number of rows changed
   * 
   * @example
   * ```typescript
   * await CapacitorDuckDb.execute({
   *   database: 'mydb',
   *   statements: `
   *     CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);
   *     INSERT INTO users (id, name) VALUES (1, 'Alice');
   *   `
   * });
   * ```
   */
  execute(options: ExecuteOptions): Promise<ExecuteResult>;

  /**
   * Execute a query and return results.
   * Results are returned as an array of objects with column names as keys.
   * 
   * @param options - Database, SQL query, and optional parameter values
   * @returns Promise with array of row objects
   * 
   * @example
   * ```typescript
   * // Simple query
   * const result = await CapacitorDuckDb.query({
   *   database: 'mydb',
   *   statement: 'SELECT * FROM users'
   * });
   * console.log(result.values); // [{id: 1, name: 'Alice'}, ...]
   * 
   * // Query with parameters
   * const result = await CapacitorDuckDb.query({
   *   database: 'mydb',
   *   statement: 'SELECT * FROM users WHERE id = $1',
   *   values: [1]
   * });
   * ```
   */
  query(options: QueryOptions): Promise<QueryResult>;

  /**
   * Execute a statement with parameters (INSERT, UPDATE, DELETE).
   * Use $1, $2, etc. as parameter placeholders.
   * 
   * @param options - Database, SQL statement, and parameter values
   * @returns Promise with number of rows changed
   * 
   * @example
   * ```typescript
   * await CapacitorDuckDb.run({
   *   database: 'mydb',
   *   statement: 'INSERT INTO users (id, name) VALUES ($1, $2)',
   *   values: [1, 'Alice']
   * });
   * ```
   */
  run(options: RunOptions): Promise<RunResult>;

  /**
   * Delete a database file.
   * Closes the database if it's open before deleting.
   * 
   * @param options - Database name
   * @returns Promise that resolves when database is deleted
   */
  deleteDatabase(options: DatabaseOptions): Promise<{ database: string }>;

  /**
   * Check if a database file exists.
   * 
   * @param options - Database name
   * @returns Promise with boolean result
   */
  isDBExists(options: DatabaseOptions): Promise<BooleanResult>;

  /**
   * Check if a database is currently open.
   * 
   * @param options - Database name
   * @returns Promise with boolean result
   */
  isDBOpen(options: DatabaseOptions): Promise<BooleanResult>;

  /**
   * Echo test method for verifying plugin communication.
   * 
   * @param options - Value to echo
   * @returns Promise with the same value
   */
  echo(options: { value: string }): Promise<{ value: string }>;

  /**
   * Open a directory picker for the user to select an export destination.
   * Uses Android's Storage Access Framework (SAF) to get persistent access.
   * 
   * @returns Promise with directory URI and name
   * 
   * @example
   * ```typescript
   * const dir = await CapacitorDuckDb.pickDirectory();
   * console.log('Selected:', dir.name, dir.uri);
   * ```
   */
  pickDirectory(): Promise<PickDirectoryResult>;

  /**
   * Export a table to Parquet format.
   * Use pickDirectory() first to get a valid directoryUri.
   * 
   * @param options - Export options including database, table, and destination
   * @returns Promise with export result including path and row count
   * 
   * @example
   * ```typescript
   * const dir = await CapacitorDuckDb.pickDirectory();
   * const result = await CapacitorDuckDb.exportToParquet({
   *   database: 'mydb',
   *   tableName: 'users',
   *   directoryUri: dir.uri,
   *   compression: 'snappy'
   * });
   * console.log(`Exported ${result.rowCount} rows to ${result.path}`);
   * ```
   */
  exportToParquet(options: ExportParquetOptions): Promise<ExportResult>;

  /**
   * List all tables in a database.
   * 
   * @param options - Database name
   * @returns Promise with array of table names
   * 
   * @example
   * ```typescript
   * const result = await CapacitorDuckDb.listTables({ database: 'mydb' });
   * console.log('Tables:', result.tables);
   * ```
   */
  listTables(options: ListTablesOptions): Promise<ListTablesResult>;
}
