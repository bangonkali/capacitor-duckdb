import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';
import { testRegistry } from '../TestRegistry';
import { assert, assertEqual } from '../utils';

const DB_NAME = 'integration_test_db';

export const registerDMLTests = () => {
    const GROUP = 'DML Operations';

    testRegistry.registerTest(GROUP, {
        name: 'insertDirect',
        description: 'INSERT with execute()',
        testFn: async () => {
            // Re-create table if needed (since DDL tests might have dropped it)
            await CapacitorDuckDb.execute({
                database: DB_NAME,
                statements: `
          CREATE TABLE IF NOT EXISTS test_table (
            id INTEGER PRIMARY KEY,
            name VARCHAR NOT NULL,
            value DOUBLE,
            active BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
            });

            const result = await CapacitorDuckDb.execute({
                database: DB_NAME,
                statements: "INSERT INTO test_table (id, name, value, active) VALUES (1, 'Test1', 1.5, true)"
            });
            assert(result.changes !== undefined, 'Changes should be defined');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'insertPrepared',
        description: 'INSERT with run() (prepared)',
        testFn: async () => {
            const result = await CapacitorDuckDb.run({
                database: DB_NAME,
                statement: 'INSERT INTO test_table (id, name, value, active) VALUES ($1, $2, $3, $4)',
                values: [2, 'Test2', 2.5, false]
            });
            assert(result.changes !== undefined, 'Changes should be defined');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'selectAll',
        description: 'SELECT * query',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT * FROM test_table ORDER BY id'
            });
            assert(result.values.length >= 2, 'Should have at least 2 rows');
            assertEqual(result.values[0].name, 'Test1', 'First row name');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'selectWhere',
        description: 'SELECT with WHERE clause',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: "SELECT * FROM test_table WHERE name = 'Test2'"
            });
            assertEqual(result.values.length, 1, 'Should have 1 row');
            assertEqual(result.values[0].id, 2, 'ID should be 2');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'selectPrepared',
        description: 'SELECT with parameters',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT * FROM test_table WHERE id = $1',
                values: [1]
            });
            assertEqual(result.values.length, 1, 'Should have 1 row');
            assertEqual(result.values[0].name, 'Test1', 'Name should be Test1');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'update',
        description: 'UPDATE statement',
        testFn: async () => {
            await CapacitorDuckDb.run({
                database: DB_NAME,
                statement: 'UPDATE test_table SET value = $1 WHERE id = $2',
                values: [10.0, 1]
            });
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT value FROM test_table WHERE id = 1'
            });
            assertEqual(result.values[0].value, 10.0, 'Value should be updated');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'delete',
        description: 'DELETE statement',
        testFn: async () => {
            await CapacitorDuckDb.run({
                database: DB_NAME,
                statement: 'DELETE FROM test_table WHERE id = $1',
                values: [2]
            });
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT * FROM test_table WHERE id = 2'
            });
            assertEqual(result.values.length, 0, 'Row should be deleted');
        }
    });
};
