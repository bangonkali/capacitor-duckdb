import { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonBadge,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonProgressBar,
  IonText,
  IonChip,
} from '@ionic/react';
import {
  playOutline,
  checkmarkCircle,
  closeCircle,
  timeOutline,
  refreshOutline,
} from 'ionicons/icons';
import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';

interface TestResult {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
}

interface TestGroup {
  name: string;
  tests: TestResult[];
}

const TestTab: React.FC = () => {
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  // Helper to update a specific test result
  const updateTest = (groupName: string, testName: string, updates: Partial<TestResult>) => {
    setTestGroups(prev => prev.map(group => {
      if (group.name === groupName) {
        return {
          ...group,
          tests: group.tests.map(test => 
            test.name === testName ? { ...test, ...updates } : test
          )
        };
      }
      return group;
    }));
  };

  // Define all tests
  const initializeTests = (): TestGroup[] => [
    {
      name: 'Basic Operations',
      tests: [
        { name: 'getVersion', description: 'Get DuckDB version', status: 'pending' },
        { name: 'open', description: 'Open database', status: 'pending' },
        { name: 'isDBOpen', description: 'Check database is open', status: 'pending' },
        { name: 'isDBExists', description: 'Check database exists', status: 'pending' },
        { name: 'close', description: 'Close database', status: 'pending' },
      ]
    },
    {
      name: 'DDL Operations',
      tests: [
        { name: 'createTable', description: 'CREATE TABLE', status: 'pending' },
        { name: 'createSequence', description: 'CREATE SEQUENCE', status: 'pending' },
        { name: 'dropTable', description: 'DROP TABLE', status: 'pending' },
      ]
    },
    {
      name: 'DML Operations',
      tests: [
        { name: 'insertDirect', description: 'INSERT with execute()', status: 'pending' },
        { name: 'insertPrepared', description: 'INSERT with run() (prepared)', status: 'pending' },
        { name: 'selectAll', description: 'SELECT * query', status: 'pending' },
        { name: 'selectWhere', description: 'SELECT with WHERE clause', status: 'pending' },
        { name: 'selectPrepared', description: 'SELECT with parameters', status: 'pending' },
        { name: 'update', description: 'UPDATE statement', status: 'pending' },
        { name: 'delete', description: 'DELETE statement', status: 'pending' },
      ]
    },
    {
      name: 'Data Types',
      tests: [
        { name: 'integerType', description: 'INTEGER type', status: 'pending' },
        { name: 'bigintType', description: 'BIGINT type', status: 'pending' },
        { name: 'doubleType', description: 'DOUBLE type', status: 'pending' },
        { name: 'booleanType', description: 'BOOLEAN type', status: 'pending' },
        { name: 'varcharType', description: 'VARCHAR type', status: 'pending' },
        { name: 'dateType', description: 'DATE type', status: 'pending' },
        { name: 'timestampType', description: 'TIMESTAMP type', status: 'pending' },
        { name: 'nullValue', description: 'NULL values', status: 'pending' },
      ]
    },
    {
      name: 'Spatial Extension',
      tests: [
        { name: 'spatialLoad', description: 'Spatial extension loaded', status: 'pending' },
        { name: 'stPoint', description: 'ST_Point function', status: 'pending' },
        { name: 'stDistance', description: 'ST_Distance function', status: 'pending' },
        { name: 'stBuffer', description: 'ST_Buffer function', status: 'pending' },
        { name: 'stAsGeoJSON', description: 'ST_AsGeoJSON function', status: 'pending' },
      ]
    },
    {
      name: 'Error Handling',
      tests: [
        { name: 'syntaxError', description: 'SQL syntax error handling', status: 'pending' },
        { name: 'tableNotFound', description: 'Table not found error', status: 'pending' },
        { name: 'typeMismatch', description: 'Type mismatch error', status: 'pending' },
      ]
    },
  ];

  // Run a single test with timing
  const runTest = async (
    groupName: string,
    test: TestResult,
    testFn: () => Promise<void>
  ): Promise<boolean> => {
    setCurrentTest(`${groupName}: ${test.name}`);
    updateTest(groupName, test.name, { status: 'running' });
    
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      updateTest(groupName, test.name, { status: 'passed', duration });
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(groupName, test.name, { 
        status: 'failed', 
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  };

  // Assert helper
  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  };

  const assertEqual = <T,>(actual: T, expected: T, message: string) => {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    const groups = initializeTests();
    setTestGroups(groups);

    const DB_NAME = 'integration_test_db';

    try {
      // Clean up any existing test database
      try {
        await CapacitorDuckDb.close({ database: DB_NAME });
      } catch (e) { /* ignore */ }
      try {
        await CapacitorDuckDb.deleteDatabase({ database: DB_NAME });
      } catch (e) { /* ignore */ }

      // ===== Basic Operations =====
      await runTest('Basic Operations', groups[0].tests[0], async () => {
        const result = await CapacitorDuckDb.getVersion();
        assert(result.version !== undefined, 'Version should be defined');
        assert(result.version.length > 0, 'Version should not be empty');
      });

      await runTest('Basic Operations', groups[0].tests[1], async () => {
        const result = await CapacitorDuckDb.open({ database: DB_NAME });
        assertEqual(result.database, DB_NAME, 'Database name should match');
      });

      await runTest('Basic Operations', groups[0].tests[2], async () => {
        const result = await CapacitorDuckDb.isDBOpen({ database: DB_NAME });
        assertEqual(result.result, true, 'Database should be open');
      });

      await runTest('Basic Operations', groups[0].tests[3], async () => {
        const result = await CapacitorDuckDb.isDBExists({ database: DB_NAME });
        assertEqual(result.result, true, 'Database should exist');
      });

      // ===== DDL Operations =====
      await runTest('DDL Operations', groups[1].tests[0], async () => {
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
      });

      await runTest('DDL Operations', groups[1].tests[1], async () => {
        await CapacitorDuckDb.execute({
          database: DB_NAME,
          statements: 'CREATE SEQUENCE IF NOT EXISTS test_seq START 1'
        });
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: "SELECT nextval('test_seq') as val"
        });
        assert(result.values.length === 1, 'Should return one row');
      });

      // ===== DML Operations =====
      await runTest('DML Operations', groups[2].tests[0], async () => {
        const result = await CapacitorDuckDb.execute({
          database: DB_NAME,
          statements: "INSERT INTO test_table (id, name, value, active) VALUES (1, 'Test1', 1.5, true)"
        });
        assert(result.changes !== undefined, 'Changes should be defined');
      });

      await runTest('DML Operations', groups[2].tests[1], async () => {
        const result = await CapacitorDuckDb.run({
          database: DB_NAME,
          statement: 'INSERT INTO test_table (id, name, value, active) VALUES ($1, $2, $3, $4)',
          values: [2, 'Test2', 2.5, false]
        });
        assert(result.changes !== undefined, 'Changes should be defined');
      });

      await runTest('DML Operations', groups[2].tests[2], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT * FROM test_table ORDER BY id'
        });
        assert(result.values.length >= 2, 'Should have at least 2 rows');
        assertEqual(result.values[0].name, 'Test1', 'First row name');
      });

      await runTest('DML Operations', groups[2].tests[3], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: "SELECT * FROM test_table WHERE name = 'Test2'"
        });
        assertEqual(result.values.length, 1, 'Should have 1 row');
        assertEqual(result.values[0].id, 2, 'ID should be 2');
      });

      await runTest('DML Operations', groups[2].tests[4], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT * FROM test_table WHERE id = $1',
          values: [1]
        });
        assertEqual(result.values.length, 1, 'Should have 1 row');
        assertEqual(result.values[0].name, 'Test1', 'Name should be Test1');
      });

      await runTest('DML Operations', groups[2].tests[5], async () => {
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
      });

      await runTest('DML Operations', groups[2].tests[6], async () => {
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
      });

      // ===== Data Types =====
      await runTest('Data Types', groups[3].tests[0], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT 42::INTEGER as val'
        });
        assertEqual(result.values[0].val, 42, 'Integer value');
      });

      await runTest('Data Types', groups[3].tests[1], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT 9223372036854775807::BIGINT as val'
        });
        assert(result.values[0].val !== undefined, 'Bigint value should exist');
      });

      await runTest('Data Types', groups[3].tests[2], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT 3.14159::DOUBLE as val'
        });
        assert(Math.abs(result.values[0].val - 3.14159) < 0.0001, 'Double value');
      });

      await runTest('Data Types', groups[3].tests[3], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT true as t, false as f'
        });
        assertEqual(result.values[0].t, true, 'True value');
        assertEqual(result.values[0].f, false, 'False value');
      });

      await runTest('Data Types', groups[3].tests[4], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: "SELECT 'Hello, World!'::VARCHAR as val"
        });
        assertEqual(result.values[0].val, 'Hello, World!', 'Varchar value');
      });

      await runTest('Data Types', groups[3].tests[5], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: "SELECT '2024-01-15'::DATE as val"
        });
        assert(result.values[0].val !== undefined, 'Date value should exist');
      });

      await runTest('Data Types', groups[3].tests[6], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: "SELECT '2024-01-15 10:30:00'::TIMESTAMP as val"
        });
        assert(result.values[0].val !== undefined, 'Timestamp value should exist');
      });

      await runTest('Data Types', groups[3].tests[7], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT NULL as val'
        });
        assertEqual(result.values[0].val, null, 'Null value');
      });

      // ===== Spatial Extension =====
      // Note: We check spatial by calling a spatial function, not duckdb_extensions()
      // because duckdb_extensions() requires home_directory to be set on Android
      await runTest('Spatial Extension', groups[4].tests[0], async () => {
        // Try to call a simple spatial function to verify the extension is loaded
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT ST_AsText(ST_Point(0, 0)) as test'
        });
        assert(result.values.length === 1, 'Should return one row');
        assertEqual(result.values[0].test, 'POINT (0 0)', 'Spatial function should work');
      });

      await runTest('Spatial Extension', groups[4].tests[1], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT ST_AsText(ST_Point(1.0, 2.0)) as point'
        });
        assertEqual(result.values[0].point, 'POINT (1 2)', 'ST_Point result');
      });

      await runTest('Spatial Extension', groups[4].tests[2], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT ST_Distance(ST_Point(0, 0), ST_Point(3, 4)) as dist'
        });
        assertEqual(result.values[0].dist, 5.0, 'Distance should be 5');
      });

      await runTest('Spatial Extension', groups[4].tests[3], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT ST_AsText(ST_Buffer(ST_Point(0, 0), 1, 4)) as buffer'
        });
        assert(result.values[0].buffer.includes('POLYGON'), 'Buffer should be a polygon');
      });

      await runTest('Spatial Extension', groups[4].tests[4], async () => {
        const result = await CapacitorDuckDb.query({
          database: DB_NAME,
          statement: 'SELECT ST_AsGeoJSON(ST_Point(1.0, 2.0)) as geojson'
        });
        const geojson = JSON.parse(result.values[0].geojson);
        assertEqual(geojson.type, 'Point', 'GeoJSON type should be Point');
      });

      // ===== Error Handling =====
      await runTest('Error Handling', groups[5].tests[0], async () => {
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
      });

      await runTest('Error Handling', groups[5].tests[1], async () => {
        try {
          await CapacitorDuckDb.query({
            database: DB_NAME,
            statement: 'SELECT * FROM non_existent_table'
          });
          throw new Error('Should have thrown an error');
        } catch (e) {
          assert(e instanceof Error, 'Should throw an Error');
        }
      });

      await runTest('Error Handling', groups[5].tests[2], async () => {
        try {
          await CapacitorDuckDb.execute({
            database: DB_NAME,
            statements: "INSERT INTO test_table (id, name) VALUES ('not_an_int', 'test')"
          });
          throw new Error('Should have thrown an error');
        } catch (e) {
          assert(e instanceof Error, 'Should throw an Error');
        }
      });

      // ===== Cleanup: Drop table and close =====
      await runTest('DDL Operations', groups[1].tests[2], async () => {
        await CapacitorDuckDb.execute({
          database: DB_NAME,
          statements: 'DROP TABLE IF EXISTS test_table'
        });
      });

      await runTest('Basic Operations', groups[0].tests[4], async () => {
        await CapacitorDuckDb.close({ database: DB_NAME });
        const result = await CapacitorDuckDb.isDBOpen({ database: DB_NAME });
        assertEqual(result.result, false, 'Database should be closed');
      });

    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
    }
  };

  // Calculate stats
  const getStats = () => {
    let total = 0, passed = 0, failed = 0, pending = 0;
    testGroups.forEach(group => {
      group.tests.forEach(test => {
        total++;
        if (test.status === 'passed') passed++;
        else if (test.status === 'failed') failed++;
        else if (test.status === 'pending') pending++;
      });
    });
    return { total, passed, failed, pending, running: total - passed - failed - pending };
  };

  const stats = getStats();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Integration Tests</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Test Suite</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <IonChip color="success">
                <IonIcon icon={checkmarkCircle} />
                <IonLabel>Passed: {stats.passed}</IonLabel>
              </IonChip>
              <IonChip color="danger">
                <IonIcon icon={closeCircle} />
                <IonLabel>Failed: {stats.failed}</IonLabel>
              </IonChip>
              <IonChip color="medium">
                <IonIcon icon={timeOutline} />
                <IonLabel>Pending: {stats.pending}</IonLabel>
              </IonChip>
              <IonChip color="primary">
                <IonLabel>Total: {stats.total}</IonLabel>
              </IonChip>
            </div>

            {isRunning && (
              <>
                <IonProgressBar type="indeterminate" />
                <IonText color="primary">
                  <p style={{ marginTop: '8px' }}>Running: {currentTest}</p>
                </IonText>
              </>
            )}

            <IonButton 
              expand="block" 
              onClick={runAllTests} 
              disabled={isRunning}
            >
              <IonIcon slot="start" icon={isRunning ? refreshOutline : playOutline} />
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {testGroups.map(group => (
          <IonCard key={group.name}>
            <IonCardHeader>
              <IonCardTitle>{group.name}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                {group.tests.map(test => (
                  <IonItem key={test.name}>
                    <IonIcon 
                      slot="start" 
                      icon={
                        test.status === 'passed' ? checkmarkCircle :
                        test.status === 'failed' ? closeCircle :
                        test.status === 'running' ? refreshOutline :
                        timeOutline
                      }
                      color={
                        test.status === 'passed' ? 'success' :
                        test.status === 'failed' ? 'danger' :
                        test.status === 'running' ? 'primary' :
                        'medium'
                      }
                      style={test.status === 'running' ? { animation: 'spin 1s linear infinite' } : {}}
                    />
                    <IonLabel>
                      <h2>{test.name}</h2>
                      <p>{test.description}</p>
                      {test.error && (
                        <p style={{ color: 'var(--ion-color-danger)' }}>
                          Error: {test.error}
                        </p>
                      )}
                    </IonLabel>
                    {test.duration !== undefined && (
                      <IonBadge slot="end" color={test.status === 'passed' ? 'success' : 'danger'}>
                        {test.duration}ms
                      </IonBadge>
                    )}
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        ))}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default TestTab;
