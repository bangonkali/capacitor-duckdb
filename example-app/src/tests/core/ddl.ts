import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';
import { testRegistry } from '../TestRegistry';
import { assert } from '../utils';

const DB_NAME = 'integration_test_db';

export const registerDDLTests = () => {
    const GROUP = 'DDL Operations';

    testRegistry.registerTest(GROUP, {
        name: 'createTable',
        description: 'CREATE TABLE',
        testFn: async () => {
            // Ensure DB is open (dependency on Basic tests running first, or we ensure it here)
            // For robustness, we can try to open if not open, but ideally tests run in order or are independent.
            // Here we assume the DB is open from previous tests or we re-open.
            // Let's ensure it's open.
            try { await CapacitorDuckDb.open({ database: DB_NAME }); } catch (e) { }

            await CapacitorDuckDb.execute({
                database: DB_NAME,
                statements: `
          CREATE TABLE IF NOT EXISTS test_table(
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    value DOUBLE,
    active BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
    `
            });
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'createSequence',
        description: 'CREATE SEQUENCE',
        testFn: async () => {
            await CapacitorDuckDb.execute({
                database: DB_NAME,
                statements: 'CREATE SEQUENCE IF NOT EXISTS test_seq START 1'
            });
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: "SELECT nextval('test_seq') as val"
            });
            assert(result.values.length === 1, 'Should return one row');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'dropTable',
        description: 'DROP TABLE',
        testFn: async () => {
            await CapacitorDuckDb.execute({
                database: DB_NAME,
                statements: 'DROP TABLE IF EXISTS test_table'
            });
        }
    });
};
