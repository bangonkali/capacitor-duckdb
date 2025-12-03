export const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
};

export const assertEqual = <T>(actual: T, expected: T, message: string) => {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
};
