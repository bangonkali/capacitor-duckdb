# End-to-End Testing Architecture

This document outlines the architecture for the end-to-end (E2E) testing infrastructure of `capacitor-duckdb` within the `example-app`.

## Goals

1.  **Scalability**: Support a growing number of tests organized by functionality (Core, Plugins).
2.  **Platform Agnostic**: Run on Android, iOS, and Web (where applicable).
3.  **Usability**: Provide a UI to control test execution and view detailed results.
4.  ** comprehensiveness**: Cover Core, VSS, Spatial, and other plugin functions.

## Architecture

The testing infrastructure consists of three main components:

1.  **Test Registry**: A central repository where test cases are registered.
2.  **Test Runner**: A service responsible for executing tests, managing state, and reporting results.
3.  **Test UI**: A React component (`TestTab`) that interacts with the Runner to display progress and results.

### Directory Structure

Tests will be moved out of `TestTab.tsx` and into a dedicated `src/tests` directory:

```
src/tests/
├── index.ts          # Exports the TestRegistry and initializes tests
├── runner.ts         # TestRunner implementation
├── types.ts          # Type definitions for Test, TestGroup, TestResult
├── core/             # Core DuckDB functionality tests
│   ├── basic.ts
│   ├── ddl.ts
│   ├── dml.ts
│   ├── types.ts
│   └── error.ts
└── plugins/          # Plugin specific tests
    ├── spatial.ts
    ├── vss.ts
    └── encodings.ts
```

### Test Case Definition

Each test file will export a function to register its tests. A test case is defined by:

```typescript
interface TestCase {
  name: string;
  description: string;
  testFn: () => Promise<void>;
  expectedOutput?: any; // Optional, for documentation/UI
}
```

### Test Runner

The `TestRunner` will:
- Maintain a queue of tests.
- Execute tests sequentially.
- Handle success/failure/timeout.
- Emit events or update a reactive state store (e.g., React Context or simple Observable) for the UI.

## UI/UX

The `TestTab` will be refactored to:
- Subscribe to the `TestRunner` state.
- Display a list of Test Groups (e.g., "Core - Basic", "Plugin - Spatial").
- Allow running all tests, a specific group, or a single test.
- Show a detailed view for each test (logs, error message, duration).

## Required Test Coverage

### Core
- **Connection**: `open`, `close`, `isDBOpen`, `isDBExists`
- **DDL**: `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, `CREATE INDEX`
- **DML**: `INSERT`, `UPDATE`, `DELETE`, `SELECT` (Simple, Where, Join, Aggregates)
- **Types**: `INTEGER`, `BIGINT`, `DOUBLE`, `BOOLEAN`, `VARCHAR`, `DATE`, `TIMESTAMP`, `BLOB`, `NULL`
- **Prepared Statements**: `run` with parameters, `query` with parameters.
- **Error Handling**: Syntax errors, constraint violations, missing tables.

### Plugins

#### Spatial
- **Functions**: `ST_Point`, `ST_MakePoint`, `ST_PointX`, `ST_PointY`
- **Predicates**: `ST_Within`, `ST_Intersects`, `ST_Contains`
- **Measurements**: `ST_Distance`, `ST_Area`, `ST_Length`
- **Conversion**: `ST_AsText`, `ST_AsGeoJSON`, `ST_GeomFromText`
- **Ops**: `ST_Buffer`, `ST_Union`, `ST_Intersection`

#### VSS (Vector Similarity Search)
- **Functions**: `HNSW Index creation`, `array_distance`, `knn_search`
- **Types**: `FLOAT[]` (Array type support)

#### Encodings
- **Functions**: `snappy`, `zstd` compression tests (implicit via storage)

## Implementation Steps

1.  **Scaffold**: Create `src/tests` directory and base files.
2.  **Migrate**: Move existing tests from `TestTab.tsx` to `src/tests/core/*.ts`.
3.  **Refactor UI**: Update `TestTab.tsx` to use `TestRegistry` and `TestRunner`.
4.  **Expand**: Add placeholders for Spatial and VSS tests.
