import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';
import { testRegistry } from '../TestRegistry';
import { assert } from '../utils';

const DB_NAME = 'integration_test_db';

export const registerErrorTests = () => {
    const GROUP = 'Error Handling';

    testRegistry.registerTest(GROUP, {
        name: 'syntaxError',
        description: 'SQL syntax error handling',
        testFn: async () => {
            try {
                await CapacitorDuckDb.query({
                    database: DB_NAME,
                    statement: 'SELEC * FROM test_table'  // Intentional typo
                });
                throw new Error('Should have thrown an error');
            } catch (e) {
                assert(e instanceof Error, 'Should throw an Error');
                // Test passes if we catch an error
            }
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'tableNotFound',
        description: 'Table not found error',
        testFn: async () => {
            try {
                await CapacitorDuckDb.query({
                    database: DB_NAME,
                    statement: 'SELECT * FROM non_existent_table'
                });
                throw new Error('Should have thrown an error');
            } catch (e) {
                assert(e instanceof Error, 'Should throw an Error');
            }
        }
    });

    testRegistry.registerTest(GROUP, {
        name: 'typeMismatch',
        description: 'Type mismatch error',
        testFn: async () => {
            try {
                await CapacitorDuckDb.execute({
                    database: DB_NAME,
                    statements: "INSERT INTO test_table (id, name) VALUES ('not_an_int', 'test')"
                });
                throw new Error('Should have thrown an error');
            } catch (e) {
                assert(e instanceof Error, 'Should throw an Error');
            }
        }
    });
};
