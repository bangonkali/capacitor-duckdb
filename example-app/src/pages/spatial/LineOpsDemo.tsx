/**
 * LineOpsDemo - Line and Path Operations
 * 
 * Demonstrates functions for working with linestrings and paths:
 * ST_LineInterpolatePoint, ST_LineSubstring, ST_ShortestLine, ST_LineMerge
 */

import { gitBranchOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_LineInterpolatePoint',
    category: 'Line Operations',
    signature: 'ST_LineInterpolatePoint(line GEOMETRY, fraction DOUBLE) → GEOMETRY',
    description: 'Returns a point at a specified fraction along a LineString.',
    returnType: 'GEOMETRY (Point)',
    parameters: [
      { name: 'line', type: 'GEOMETRY', description: 'Input LineString' },
      { name: 'fraction', type: 'DOUBLE', description: 'Fraction along line (0.0 to 1.0)' },
    ],
    examples: [
      {
        description: 'Point at the midpoint of a line',
        sql: `SELECT ST_AsText(
  ST_LineInterpolatePoint(
    ST_GeomFromText('LINESTRING(0 0, 10 0)'),
    0.5
  )
) AS midpoint;`,
        expectedResult: 'POINT (5 0)',
      },
      {
        description: 'Points at various fractions',
        sql: `SELECT 
  fraction,
  ST_AsText(ST_LineInterpolatePoint(line, fraction)) AS point
FROM (
  SELECT ST_GeomFromText('LINESTRING(0 0, 10 10)') AS line
), (
  SELECT unnest([0.0, 0.25, 0.5, 0.75, 1.0]) AS fraction
);`,
        expectedResult: 'Points at 0%, 25%, 50%, 75%, 100%',
      },
      {
        description: 'Animate along a route (10 points)',
        sql: `SELECT 
  i AS frame,
  ST_AsText(
    ST_LineInterpolatePoint(route, i::DOUBLE / 10)
  ) AS position
FROM (
  SELECT ST_GeomFromText('LINESTRING(-122.4 37.8, -74 40.7)') AS route
), generate_series(0, 10) AS t(i);`,
        expectedResult: 'Animation frames along SF to NYC route',
      },
    ],
    notes: [
      '0.0 = start point, 1.0 = end point',
      'Useful for animation, progress indicators, sampling',
      'Works with complex multi-segment lines',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_lineinterpolatepoint',
  },
  {
    name: 'ST_LineLocatePoint',
    category: 'Line Operations',
    signature: 'ST_LineLocatePoint(line GEOMETRY, point GEOMETRY) → DOUBLE',
    description: 'Returns the fraction of line length where a point projects onto the line.',
    returnType: 'DOUBLE (0.0 to 1.0)',
    parameters: [
      { name: 'line', type: 'GEOMETRY', description: 'Reference LineString' },
      { name: 'point', type: 'GEOMETRY', description: 'Point to locate' },
    ],
    examples: [
      {
        description: 'Where does a point fall on a line?',
        sql: `SELECT ST_LineLocatePoint(
  ST_GeomFromText('LINESTRING(0 0, 10 0)'),
  ST_Point(3, 2)  -- 2 units away from line
) AS fraction;`,
        expectedResult: '0.3 (projects to x=3)',
      },
      {
        description: 'Inverse of ST_LineInterpolatePoint',
        sql: `WITH line AS (
  SELECT ST_GeomFromText('LINESTRING(0 0, 100 0)') AS geom
), point_at_40 AS (
  SELECT ST_LineInterpolatePoint(geom, 0.4) AS pt
  FROM line
)
SELECT ST_LineLocatePoint(line.geom, point_at_40.pt) AS recovered_fraction
FROM line, point_at_40;`,
        expectedResult: '0.4',
      },
    ],
    notes: [
      'Point doesn\'t need to be on the line',
      'Uses perpendicular projection to line',
      'Returns 0 if point projects before start, 1 if after end',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_linelocatepoint',
  },
  {
    name: 'ST_LineSubstring',
    category: 'Line Operations',
    signature: 'ST_LineSubstring(line GEOMETRY, startFrac DOUBLE, endFrac DOUBLE) → GEOMETRY',
    description: 'Returns a substring of a LineString between two fractions.',
    returnType: 'GEOMETRY (LineString)',
    parameters: [
      { name: 'line', type: 'GEOMETRY', description: 'Input LineString' },
      { name: 'startFrac', type: 'DOUBLE', description: 'Start fraction (0.0 to 1.0)' },
      { name: 'endFrac', type: 'DOUBLE', description: 'End fraction (0.0 to 1.0)' },
    ],
    examples: [
      {
        description: 'Get the middle third of a line',
        sql: `SELECT ST_AsText(
  ST_LineSubstring(
    ST_GeomFromText('LINESTRING(0 0, 30 0)'),
    0.333,
    0.666
  )
) AS middle_third;`,
        expectedResult: 'LINESTRING (~10 0, ~20 0)',
      },
      {
        description: 'First half of a route',
        sql: `SELECT 
  ST_Length(line) AS full_length,
  ST_Length(ST_LineSubstring(line, 0, 0.5)) AS half_length
FROM (
  SELECT ST_GeomFromText('LINESTRING(0 0, 10 0, 10 10)') AS line
);`,
        expectedResult: 'Half length should be ~10',
      },
    ],
    notes: [
      'startFrac must be less than endFrac',
      'Useful for splitting routes into segments',
      'Works with multi-segment lines',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_linesubstring',
  },
  {
    name: 'ST_ShortestLine',
    category: 'Line Operations',
    signature: 'ST_ShortestLine(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Returns the shortest line between two geometries.',
    returnType: 'GEOMETRY (LineString)',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Shortest line between two polygons',
        sql: `SELECT ST_AsText(
  ST_ShortestLine(
    ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))'),
    ST_GeomFromText('POLYGON((10 10, 15 10, 15 15, 10 15, 10 10))')
  )
) AS connector;`,
        expectedResult: 'Line from corner to corner',
      },
      {
        description: 'Distance via shortest line',
        sql: `SELECT ST_Length(
  ST_ShortestLine(
    ST_Point(0, 0),
    ST_GeomFromText('LINESTRING(5 5, 10 0)')
  )
) AS distance;`,
        expectedResult: 'Distance to nearest point on line',
      },
    ],
    notes: [
      'Useful for finding connection points',
      'ST_Length(ST_ShortestLine(A, B)) = ST_Distance(A, B)',
      'Can help visualize spatial relationships',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_shortestline',
  },
  {
    name: 'ST_LineMerge',
    category: 'Line Operations',
    signature: 'ST_LineMerge(geom GEOMETRY) → GEOMETRY',
    description: 'Merges a collection of LineStrings into minimal connected LineStrings.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'MultiLineString or GeometryCollection' },
    ],
    examples: [
      {
        description: 'Merge connected line segments',
        sql: `SELECT ST_AsText(
  ST_LineMerge(
    ST_GeomFromText('MULTILINESTRING((0 0, 5 0), (5 0, 10 0))')
  )
) AS merged;`,
        expectedResult: 'LINESTRING (0 0, 5 0, 10 0)',
      },
      {
        description: 'Non-connected lines stay separate',
        sql: `SELECT ST_GeometryType(
  ST_LineMerge(
    ST_GeomFromText('MULTILINESTRING((0 0, 5 0), (10 0, 15 0))')
  )
) AS type;`,
        expectedResult: 'MULTILINESTRING (can\'t merge)',
      },
    ],
    notes: [
      'Only merges lines that share endpoints',
      'Useful for cleaning fragmented data',
      'Input must be linework only',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_linemerge',
  },
  {
    name: 'ST_StartPoint / ST_EndPoint',
    category: 'Line Operations',
    signature: 'ST_StartPoint(line GEOMETRY) → GEOMETRY',
    description: 'Returns the first or last point of a LineString.',
    returnType: 'GEOMETRY (Point)',
    parameters: [
      { name: 'line', type: 'GEOMETRY', description: 'Input LineString' },
    ],
    examples: [
      {
        description: 'Get endpoints of a line',
        sql: `SELECT 
  ST_AsText(ST_StartPoint(line)) AS start,
  ST_AsText(ST_EndPoint(line)) AS end
FROM (
  SELECT ST_GeomFromText('LINESTRING(-122 37, -74 40, 0 51)') AS line
);`,
        expectedResult: 'Start: SF, End: London',
      },
      {
        description: 'Check if line is closed',
        sql: `SELECT ST_Equals(
  ST_StartPoint(ring),
  ST_EndPoint(ring)
) AS is_closed
FROM (
  SELECT ST_GeomFromText('LINESTRING(0 0, 10 0, 10 10, 0 0)') AS ring
);`,
        expectedResult: 'true',
      },
    ],
    notes: [
      'ST_PointN(line, 1) = ST_StartPoint(line)',
      'ST_PointN(line, -1) = ST_EndPoint(line)',
      'Returns NULL for non-linestring geometries',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_startpoint',
  },
  {
    name: 'ST_PointN',
    category: 'Line Operations',
    signature: 'ST_PointN(line GEOMETRY, n INTEGER) → GEOMETRY',
    description: 'Returns the Nth point of a LineString.',
    returnType: 'GEOMETRY (Point)',
    parameters: [
      { name: 'line', type: 'GEOMETRY', description: 'Input LineString' },
      { name: 'n', type: 'INTEGER', description: 'Point index (1-based, or negative from end)' },
    ],
    examples: [
      {
        description: 'Get specific points',
        sql: `SELECT 
  ST_AsText(ST_PointN(line, 1)) AS first,
  ST_AsText(ST_PointN(line, 2)) AS second,
  ST_AsText(ST_PointN(line, -1)) AS last
FROM (
  SELECT ST_GeomFromText('LINESTRING(0 0, 5 5, 10 0, 15 5)') AS line
);`,
        expectedResult: 'First, second, and last points',
      },
      {
        description: 'Iterate through all points',
        sql: `SELECT 
  n,
  ST_AsText(ST_PointN(line, n)) AS point
FROM (
  SELECT ST_GeomFromText('LINESTRING(0 0, 5 5, 10 0)') AS line
), generate_series(1, 3) AS t(n);`,
        expectedResult: 'All three points',
      },
    ],
    notes: [
      'Index is 1-based (first point is 1, not 0)',
      'Negative indices count from the end (-1 = last)',
      'Use ST_NPoints to get total point count',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_pointn',
  },
];

// ============================================================================
// Component
// ============================================================================

const LineOpsDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Line Operations"
      icon={gitBranchOutline}
      color="medium"
      description="Work with linestrings, paths, and linear referencing."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default LineOpsDemo;
