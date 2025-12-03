export interface TestCase {
    name: string;
    description: string;
    testFn: () => Promise<void>;
}

export interface TestGroup {
    name: string;
    tests: TestCase[];
}

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface TestResult {
    groupName: string;
    testName: string;
    status: TestStatus;
    duration?: number;
    error?: string;
}

export interface TestSuiteStats {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    running: number;
}
