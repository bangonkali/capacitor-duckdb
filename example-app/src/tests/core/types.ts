import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';
import { testRegistry } from '../TestRegistry';
import { assert, assertEqual } from '../utils';

const DB_NAME = 'integration_test_db';

export const registerTypeTests = () => {
    const GROUP = 'Data Types';

    // Integers
    testRegistry.registerTest(GROUP, {
        name: 'Integer Types',
        description: 'TINYINT, SMALLINT, INTEGER, BIGINT',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
                    SELECT 
                        1::TINYINT as t,
                        100::SMALLINT as s,
                        100000::INTEGER as i,
                        10000000000::BIGINT as b
                `
            });
            const row = result.values[0];
            assertEqual(row.t, 1, 'TINYINT');
            assertEqual(row.s, 100, 'SMALLINT');
            assertEqual(row.i, 100000, 'INTEGER');
            assertEqual(row.b, 10000000000, 'BIGINT');
        }
    });

    // Unsigned Integers
    testRegistry.registerTest(GROUP, {
        name: 'Unsigned Integer Types',
        description: 'UTINYINT, USMALLINT, UINTEGER, UBIGINT',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
                    SELECT 
                        255::UTINYINT as ut,
                        65535::USMALLINT as us,
                        4000000000::UINTEGER as ui,
                        10000000000::UBIGINT as ub
                `
            });
            const row = result.values[0];
            assertEqual(row.ut, 255, 'UTINYINT');
            assertEqual(row.us, 65535, 'USMALLINT');
            assertEqual(row.ui, 4000000000, 'UINTEGER');
            assertEqual(row.ub, 10000000000, 'UBIGINT');
        }
    });

    // Floating Point
    testRegistry.registerTest(GROUP, {
        name: 'Floating Point Types',
        description: 'FLOAT, DOUBLE',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
                    SELECT 
                        1.5::FLOAT as f,
                        3.14159::DOUBLE as d
                `
            });
            const row = result.values[0];
            assert(Math.abs(row.f - 1.5) < 0.0001, 'FLOAT');
            assert(Math.abs(row.d - 3.14159) < 0.0001, 'DOUBLE');
        }
    });

    // Boolean
    testRegistry.registerTest(GROUP, {
        name: 'Boolean Type',
        description: 'BOOLEAN',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT true as t, false as f'
            });
            assertEqual(result.values[0].t, true, 'True value');
            assertEqual(result.values[0].f, false, 'False value');
        }
    });

    // Strings
    testRegistry.registerTest(GROUP, {
        name: 'String Types',
        description: 'VARCHAR, CHAR',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: "SELECT 'Hello'::VARCHAR as v, 'A'::CHAR as c"
            });
            assertEqual(result.values[0].v, 'Hello', 'VARCHAR');
            assertEqual(result.values[0].c, 'A', 'CHAR');
        }
    });

    // Date & Time
    testRegistry.registerTest(GROUP, {
        name: 'Date & Time Types',
        description: 'DATE, TIME, TIMESTAMP, INTERVAL',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
                    SELECT 
                        '2024-01-15'::DATE as d,
                        '12:30:00'::TIME as t,
                        '2024-01-15 12:30:00'::TIMESTAMP as ts,
                        INTERVAL 1 DAY as inv
                `
            });
            const row = result.values[0];
            // These are returned as strings
            assertEqual(typeof row.d, 'string', 'DATE type');
            assertEqual(row.d, '2024-01-15', 'DATE value');

            assertEqual(typeof row.t, 'string', 'TIME type');
            assertEqual(row.t, '12:30:00', 'TIME value');

            assertEqual(typeof row.ts, 'string', 'TIMESTAMP type');
            assertEqual(row.ts, '2024-01-15 12:30:00', 'TIMESTAMP value');

            assertEqual(typeof row.inv, 'string', 'INTERVAL type');
            // Interval string representation might vary slightly but usually "1 day"
            assert(row.inv.toLowerCase().includes('1 day'), 'INTERVAL value');
        }
    });

    // Complex/Other Types
    testRegistry.registerTest(GROUP, {
        name: 'Complex Types',
        description: 'BLOB, UUID, HUGEINT, DECIMAL',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
                    SELECT 
                        '\\xAA\\xBB'::BLOB as b,
                        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID as u,
                        123456789012345678901234567890::HUGEINT as h,
                        123.456::DECIMAL(10,3) as dec
                `
            });
            const row = result.values[0];

            assertEqual(typeof row.b, 'string', 'BLOB type');
            // Blob string representation check (implementation dependent, usually hex or escaped)
            assert(row.b !== null, 'BLOB value');

            assertEqual(typeof row.u, 'string', 'UUID type');
            assertEqual(row.u, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'UUID value');

            assertEqual(typeof row.h, 'string', 'HUGEINT type');
            assertEqual(row.h, '123456789012345678901234567890', 'HUGEINT value');

            assertEqual(typeof row.dec, 'string', 'DECIMAL type');
            assertEqual(row.dec, '123.456', 'DECIMAL value');
        }
    });

    // Nested Types
    testRegistry.registerTest(GROUP, {
        name: 'Nested Types',
        description: 'LIST, STRUCT, MAP',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
                    SELECT 
                        [1, 2, 3] as l,
                        {'a': 1, 'b': 2} as s,
                        MAP(['key1', 'key2'], ['val1', 'val2']) as m
                `
            });
            const row = result.values[0];

            // Currently returned as string representations
            assertEqual(typeof row.l, 'string', 'LIST type');
            assert(row.l.includes('[1, 2, 3]'), 'LIST value');

            assertEqual(typeof row.s, 'string', 'STRUCT type');
            assert(row.s.includes("{'a': 1, 'b': 2}"), 'STRUCT value');

            assertEqual(typeof row.m, 'string', 'MAP type');
            assert(row.m.includes('key1=val1'), 'MAP value');
        }
    });

    // Null
    testRegistry.registerTest(GROUP, {
        name: 'NULL Values',
        description: 'NULL handling',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT NULL as val'
            });
            assertEqual(result.values[0].val, null, 'NULL value');
        }
    });
};
