import { WebPlugin } from '@capacitor/core';

import type {
  CapacitorDuckDbPlugin,
  OpenOptions,
  DatabaseOptions,
  ExecuteOptions,
  QueryOptions,
  RunOptions,
  ExecuteResult,
  QueryResult,
  RunResult,
  VersionResult,
  BooleanResult,
  ExportParquetOptions,
  ExportResult,
  PickDirectoryResult,
  ListTablesOptions,
  ListTablesResult,
} from './definitions';

/**
 * Web implementation of CapacitorDuckDb.
 * 
 * Note: DuckDB native bindings are not available on web.
 * For web support, consider using DuckDB-WASM directly.
 * This stub throws errors for all database operations.
 */
export class CapacitorDuckDbWeb extends WebPlugin implements CapacitorDuckDbPlugin {
  private notSupported(): never {
    throw this.unavailable('DuckDB native bindings are not available on web. Consider using DuckDB-WASM for web support.');
  }

  async getVersion(): Promise<VersionResult> {
    this.notSupported();
  }

  async open(_options: OpenOptions): Promise<{ database: string }> {
    this.notSupported();
  }

  async close(_options: DatabaseOptions): Promise<{ database: string }> {
    this.notSupported();
  }

  async execute(_options: ExecuteOptions): Promise<ExecuteResult> {
    this.notSupported();
  }

  async query(_options: QueryOptions): Promise<QueryResult> {
    this.notSupported();
  }

  async run(_options: RunOptions): Promise<RunResult> {
    this.notSupported();
  }

  async deleteDatabase(_options: DatabaseOptions): Promise<{ database: string }> {
    this.notSupported();
  }

  async isDBExists(_options: DatabaseOptions): Promise<BooleanResult> {
    this.notSupported();
  }

  async isDBOpen(_options: DatabaseOptions): Promise<BooleanResult> {
    this.notSupported();
  }

  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }

  async pickDirectory(): Promise<PickDirectoryResult> {
    this.notSupported();
  }

  async exportToParquet(_options: ExportParquetOptions): Promise<ExportResult> {
    this.notSupported();
  }

  async listTables(_options: ListTablesOptions): Promise<ListTablesResult> {
    this.notSupported();
  }
}
