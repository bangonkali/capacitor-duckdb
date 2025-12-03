import { TestGroup, TestCase } from './types';

class TestRegistry {
    private groups: Map<string, TestCase[]> = new Map();
    private static instance: TestRegistry;

    private constructor() { }

    static getInstance(): TestRegistry {
        if (!TestRegistry.instance) {
            TestRegistry.instance = new TestRegistry();
        }
        return TestRegistry.instance;
    }

    registerTest(groupName: string, test: TestCase) {
        if (!this.groups.has(groupName)) {
            this.groups.set(groupName, []);
        }
        this.groups.get(groupName)?.push(test);
    }

    getGroups(): TestGroup[] {
        const result: TestGroup[] = [];
        for (const [name, tests] of this.groups.entries()) {
            result.push({ name, tests });
        }
        return result;
    }

    clear() {
        this.groups.clear();
    }
}

export const testRegistry = TestRegistry.getInstance();
