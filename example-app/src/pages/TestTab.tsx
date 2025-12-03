import { useState, useEffect } from 'react';
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
import {
  initializeTests,
  testRunner,
  testRegistry,
  TestGroup,
  TestResult,
  TestSuiteStats
} from '../tests';

const TestTab: React.FC = () => {
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());

  // Initialize tests on mount
  useEffect(() => {
    initializeTests();
    setTestGroups(testRegistry.getGroups());
  }, []);

  // Subscribe to test runner events
  useEffect(() => {
    const handleResult = (result: TestResult) => {
      setResults(prev => {
        const next = new Map(prev);
        next.set(`${result.groupName}:${result.testName}`, result);
        return next;
      });

      if (result.status === 'running') {
        setCurrentTest(`${result.groupName}: ${result.testName}`);
      } else {
        // If it was the last running test, this might clear too early, 
        // but the runner's runAll() promise resolution handles the final isRunning state.
        // We just update the current test text here.
      }
    };

    testRunner.addListener(handleResult);
    return () => testRunner.removeListener(handleResult);
  }, []);

  const runAllTests = async () => {
    setIsRunning(true);
    setResults(new Map()); // Clear previous results
    try {
      await testRunner.runAll();
    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
    }
  };

  const getTestStatus = (groupName: string, testName: string) => {
    const key = `${groupName}:${testName}`;
    return results.get(key) || { groupName, testName, status: 'pending' };
  };

  const getStats = (): TestSuiteStats => {
    let total = 0, passed = 0, failed = 0, pending = 0, running = 0;

    testGroups.forEach(group => {
      group.tests.forEach(test => {
        total++;
        const status = getTestStatus(group.name, test.name).status;
        if (status === 'passed') passed++;
        else if (status === 'failed') failed++;
        else if (status === 'running') running++;
        else pending++;
      });
    });

    return { total, passed, failed, pending, running };
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
                {group.tests.map(test => {
                  const result = getTestStatus(group.name, test.name);
                  return (
                    <IonItem key={test.name}>
                      <IonIcon
                        slot="start"
                        icon={
                          result.status === 'passed' ? checkmarkCircle :
                            result.status === 'failed' ? closeCircle :
                              result.status === 'running' ? refreshOutline :
                                timeOutline
                        }
                        color={
                          result.status === 'passed' ? 'success' :
                            result.status === 'failed' ? 'danger' :
                              result.status === 'running' ? 'primary' :
                                'medium'
                        }
                        style={result.status === 'running' ? { animation: 'spin 1s linear infinite' } : {}}
                      />
                      <IonLabel>
                        <h2>{test.name}</h2>
                        <p>{test.description}</p>
                        {result.error && (
                          <p style={{ color: 'var(--ion-color-danger)' }}>
                            Error: {result.error}
                          </p>
                        )}
                      </IonLabel>
                      {result.duration !== undefined && (
                        <IonBadge slot="end" color={result.status === 'passed' ? 'success' : 'danger'}>
                          {result.duration}ms
                        </IonBadge>
                      )}
                    </IonItem>
                  );
                })}
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
