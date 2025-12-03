import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';
import { testRegistry } from '../TestRegistry';
import { assert, assertEqual } from '../utils';

const DB_NAME = 'integration_test_db';

export const registerBasicTests = () => {
    const GROUP = 'Basic Operations';

    testRegistry.registerTest(GROUP, {
        name: 'getVersion',
        description: 'Get DuckDB version',
        testFn: async () => {
            const result = await CapacitorDuckDb.getVersion();
            assert(result.version !== undefined, 'Version should be defined');
            assert(result.version.length > 0, 'Version should not be empty');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'open',
        description: 'Open database',
        testFn: async () => {
            // Ensure clean state
            try { await CapacitorDuckDb.close({ database: DB_NAME }); } catch (e) { }
            try { await CapacitorDuckDb.deleteDatabase({ database: DB_NAME }); } catch (e) { }

            const result = await CapacitorDuckDb.open({ database: DB_NAME });
            assertEqual(result.database, DB_NAME, 'Database name should match');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'isDBOpen',
        description: 'Check database is open',
        testFn: async () => {
            const result = await CapacitorDuckDb.isDBOpen({ database: DB_NAME });
            assertEqual(result.result, true, 'Database should be open');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'isDBExists',
        description: 'Check database exists',
        testFn: async () => {
            const result = await CapacitorDuckDb.isDBExists({ database: DB_NAME });
            assertEqual(result.result, true, 'Database should exist');
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'close',
        description: 'Close database',
        testFn: async () => {
            await CapacitorDuckDb.close({ database: DB_NAME });
            const result = await CapacitorDuckDb.isDBOpen({ database: DB_NAME });
            assertEqual(result.result, false, 'Database should be closed');
        }
    });
};
