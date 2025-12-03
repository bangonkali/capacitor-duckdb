import { CapacitorDuckDb, type QueryResult, type ExportResult, type PickDirectoryResult, type ListTablesResult } from '@bangonkali/capacitor-duckdb';

// Database names
// Note: DEMO_DB is pre-populated with spatial data and taxi data from build/demo.duckdb
// It gets copied from assets/databases/demo.duckdb on first launch
export const DEMO_DB = 'demo';
export const TODO_DB = 'todos';
export const TAXI_DB = DEMO_DB; // Use pre-populated demo database

// Compression types for Parquet export
export type ParquetCompression = 'snappy' | 'gzip' | 'zstd' | 'uncompressed';

// DuckDB service singleton
class DuckDBService {
  private initialized: Map<string, boolean> = new Map();
  private version: string = '';

  async getVersion(): Promise<string> {
    if (!this.version) {
      const result = await CapacitorDuckDb.getVersion();
      this.version = result.version;
    }
    return this.version;
  }

  async openDatabase(dbName: string): Promise<void> {
    if (this.initialized.get(dbName)) {
      return;
    }
    try {
      await CapacitorDuckDb.open({ database: dbName });
    } catch (error) {
      // Check if already open to be robust against restarts/reloads
      try {
        const status = await CapacitorDuckDb.isDBOpen({ database: dbName });
        if (status.result) {
          this.initialized.set(dbName, true);
          return;
        }
      } catch (_e) {
        // Ignore check error, throw original
      }
      throw error;
    }
    this.initialized.set(dbName, true);
  }

  async closeDatabase(dbName: string): Promise<void> {
    if (!this.initialized.get(dbName)) {
      return;
    }
    await CapacitorDuckDb.close({ database: dbName });
    this.initialized.set(dbName, false);
  }

  async execute(dbName: string, statements: string): Promise<number> {
    await this.openDatabase(dbName);
    const result = await CapacitorDuckDb.execute({
      database: dbName,
      statements,
    });
    return result.changes;
  }

  async query<T = Record<string, unknown>>(
    dbName: string,
    statement: string,
    values?: unknown[]
  ): Promise<{ values: T[]; queryTime: number }> {
    await this.openDatabase(dbName);
    const startTime = performance.now();
    
    const result: QueryResult = await CapacitorDuckDb.query({
      database: dbName,
      statement,
      values,
    });
    
    const queryTime = performance.now() - startTime;
    return {
      values: result.values as T[],
      queryTime,
    };
  }

  async run(
    dbName: string,
    statement: string,
    values?: unknown[]
  ): Promise<number> {
    await this.openDatabase(dbName);
    const result = await CapacitorDuckDb.run({
      database: dbName,
      statement,
      values,
    });
    return result.changes;
  }

  async deleteDatabase(dbName: string): Promise<void> {
    await CapacitorDuckDb.deleteDatabase({ database: dbName });
    this.initialized.set(dbName, false);
  }

  async isDBExists(dbName: string): Promise<boolean> {
    const result = await CapacitorDuckDb.isDBExists({ database: dbName });
    return result.result;
  }

  async isDBOpen(dbName: string): Promise<boolean> {
    const result = await CapacitorDuckDb.isDBOpen({ database: dbName });
    return result.result;
  }

  /**
   * Open a directory picker for the user to select an export destination.
   * Uses Android's Storage Access Framework (SAF).
   */
  async pickDirectory(): Promise<PickDirectoryResult> {
    return CapacitorDuckDb.pickDirectory();
  }

  /**
   * Export a table to Parquet format.
   * @param dbName Database name
   * @param tableName Table to export
   * @param directoryUri URI from pickDirectory()
   * @param options Optional: fileName and compression
   */
  async exportToParquet(
    dbName: string,
    tableName: string,
    directoryUri: string,
    options?: { fileName?: string; compression?: ParquetCompression }
  ): Promise<ExportResult> {
    await this.openDatabase(dbName);
    return CapacitorDuckDb.exportToParquet({
      database: dbName,
      tableName,
      directoryUri,
      fileName: options?.fileName,
      compression: options?.compression,
    });
  }

  /**
   * List all tables in a database.
   */
  async listTables(dbName: string): Promise<string[]> {
    await this.openDatabase(dbName);
    const result: ListTablesResult = await CapacitorDuckDb.listTables({ database: dbName });
    return result.tables;
  }
}

export const duckdb = new DuckDBService();
