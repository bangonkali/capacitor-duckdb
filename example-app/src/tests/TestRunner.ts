import { TestResult } from './types';
import { testRegistry } from './TestRegistry';

type TestListener = (result: TestResult) => void;

export class TestRunner {
    private listeners: TestListener[] = [];
    private isRunning = false;
    private shouldStop = false;

    addListener(listener: TestListener) {
        this.listeners.push(listener);
    }

    removeListener(listener: TestListener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    private notify(result: TestResult) {
        this.listeners.forEach(l => l(result));
    }

    stop() {
        this.shouldStop = true;
    }

    async runAll() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.shouldStop = false;

        const groups = testRegistry.getGroups();

        for (const group of groups) {
            for (const test of group.tests) {
                if (this.shouldStop) break;
                await this.runSingleTest(group.name, test);
            }
            if (this.shouldStop) break;
        }

        this.isRunning = false;
    }

    async runGroup(groupName: string) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.shouldStop = false;

        const groups = testRegistry.getGroups().filter(g => g.name === groupName);

        for (const group of groups) {
            for (const test of group.tests) {
                if (this.shouldStop) break;
                await this.runSingleTest(group.name, test);
            }
        }

        this.isRunning = false;
    }

    async runTest(groupName: string, testName: string) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.shouldStop = false;

        const groups = testRegistry.getGroups();
        const group = groups.find(g => g.name === groupName);
        const test = group?.tests.find(t => t.name === testName);

        if (group && test) {
            await this.runSingleTest(groupName, test);
        }

        this.isRunning = false;
    }

    private async runSingleTest(groupName: string, test: any) {
        this.notify({
            groupName,
            testName: test.name,
            status: 'running'
        });

        const startTime = Date.now();
        try {
            await test.testFn();
            const duration = Date.now() - startTime;
            this.notify({
                groupName,
                testName: test.name,
                status: 'passed',
                duration
            });
        } catch (error) {
            const duration = Date.now() - startTime;
            this.notify({
                groupName,
                testName: test.name,
                status: 'failed',
                duration,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

export const testRunner = new TestRunner();
