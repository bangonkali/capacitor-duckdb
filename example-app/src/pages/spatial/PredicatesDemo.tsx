/**
 * PredicatesDemo - Spatial Relationship Functions
 * 
 * Demonstrates functions for testing spatial relationships:
 * ST_Contains, ST_Intersects, ST_Within, ST_DWithin, ST_Covers, ST_Touches
 */

import { gitCompareOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_Intersects',
    category: 'Predicates',
    signature: 'ST_Intersects(geom1 GEOMETRY, geom2 GEOMETRY) → BOOLEAN',
    description: 'Returns TRUE if the geometries share any portion of space (touch or overlap).',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Check if two polygons intersect',
        sql: `SELECT ST_Intersects(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
  ST_GeomFromText('POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))')
) AS do_intersect;`,
        expectedResult: 'true (they overlap)',
      },
      {
        description: 'Find cities in a bounding box',
        sql: `SELECT name FROM cities 
WHERE ST_Intersects(
  geom, 
  ST_MakeEnvelope(-80, 35, -70, 45)
) LIMIT 5;`,
        expectedResult: 'Cities in the northeastern US',
      },
    ],
    notes: [
      'Most commonly used spatial predicate',
      'Returns TRUE for overlapping, touching, or contained geometries',
      'Optimized for use with spatial indexes',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_intersects',
  },
  {
    name: 'ST_Contains',
    category: 'Predicates',
    signature: 'ST_Contains(geomA GEOMETRY, geomB GEOMETRY) → BOOLEAN',
    description: 'Returns TRUE if geometry A completely contains geometry B.',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geomA', type: 'GEOMETRY', description: 'Container geometry' },
      { name: 'geomB', type: 'GEOMETRY', description: 'Contained geometry' },
    ],
    examples: [
      {
        description: 'Check if a point is inside a polygon',
        sql: `SELECT ST_Contains(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
  ST_Point(5, 5)
) AS point_inside;`,
        expectedResult: 'true',
      },
      {
        description: 'Check if a point is on the boundary',
        sql: `SELECT ST_Contains(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
  ST_Point(0, 0)  -- On the corner
) AS point_on_boundary;`,
        expectedResult: 'false (boundary points not contained)',
      },
    ],
    notes: [
      'ST_Contains(A, B) is TRUE if no points of B are outside A',
      'Points on the boundary are NOT considered contained',
      'Use ST_Covers if you want boundary points included',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_contains',
  },
  {
    name: 'ST_Within',
    category: 'Predicates',
    signature: 'ST_Within(geomA GEOMETRY, geomB GEOMETRY) → BOOLEAN',
    description: 'Returns TRUE if geometry A is completely within geometry B.',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geomA', type: 'GEOMETRY', description: 'Inner geometry' },
      { name: 'geomB', type: 'GEOMETRY', description: 'Outer geometry' },
    ],
    examples: [
      {
        description: 'Check if a point is within a circle (approximated)',
        sql: `SELECT ST_Within(
  ST_Point(0, 0),
  ST_Buffer(ST_Point(0, 0), 5)
) AS within_circle;`,
        expectedResult: 'true',
      },
      {
        description: 'Inverse relationship with ST_Contains',
        sql: `SELECT 
  ST_Contains(A.geom, B.geom) AS a_contains_b,
  ST_Within(B.geom, A.geom) AS b_within_a
FROM (
  SELECT ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS geom
) A, (
  SELECT ST_Point(5, 5) AS geom
) B;`,
        expectedResult: 'Both should be true',
      },
    ],
    notes: [
      'ST_Within(A, B) = ST_Contains(B, A)',
      'Useful for "find all X in region Y" queries',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_within',
  },
  {
    name: 'ST_DWithin',
    category: 'Predicates',
    signature: 'ST_DWithin(geom1 GEOMETRY, geom2 GEOMETRY, distance DOUBLE) → BOOLEAN',
    description: 'Returns TRUE if geometries are within the specified distance.',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
      { name: 'distance', type: 'DOUBLE', description: 'Maximum distance' },
    ],
    examples: [
      {
        description: 'Check if two points are within 5 units',
        sql: `SELECT ST_DWithin(
  ST_Point(0, 0),
  ST_Point(3, 4),
  5.0
) AS within_5_units;`,
        expectedResult: 'true (distance is 5)',
      },
      {
        description: 'Find nearby points (degrees)',
        sql: `SELECT ST_DWithin(
  ST_Point(-74.006, 40.7128),   -- New York
  ST_Point(-73.9866, 40.7484),  -- Times Square
  0.1
) AS within_0_1_deg;`,
        expectedResult: 'true',
      },
    ],
    notes: [
      'Distance is in the units of the coordinate system',
      'For geographic data, distance is in degrees (not meters)',
      'Use ST_Distance_Spheroid for accurate earth distances',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_dwithin',
  },
  {
    name: 'ST_Covers',
    category: 'Predicates',
    signature: 'ST_Covers(geomA GEOMETRY, geomB GEOMETRY) → BOOLEAN',
    description: 'Returns TRUE if no point of B is outside A (includes boundary).',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geomA', type: 'GEOMETRY', description: 'Covering geometry' },
      { name: 'geomB', type: 'GEOMETRY', description: 'Covered geometry' },
    ],
    examples: [
      {
        description: 'Compare ST_Covers vs ST_Contains with boundary point',
        sql: `SELECT 
  ST_Contains(poly, pt) AS contains,
  ST_Covers(poly, pt) AS covers
FROM (
  SELECT 
    ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS poly,
    ST_Point(0, 0) AS pt  -- On corner
);`,
        expectedResult: 'contains=false, covers=true',
      },
    ],
    notes: [
      'ST_Covers is more inclusive than ST_Contains',
      'Points on the boundary ARE considered covered',
      'Preferred for most "is inside" checks',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_covers',
  },
  {
    name: 'ST_Touches',
    category: 'Predicates',
    signature: 'ST_Touches(geom1 GEOMETRY, geom2 GEOMETRY) → BOOLEAN',
    description: 'Returns TRUE if geometries touch at their boundaries but don\'t overlap.',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Two adjacent polygons',
        sql: `SELECT ST_Touches(
  ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))'),
  ST_GeomFromText('POLYGON((5 0, 10 0, 10 5, 5 5, 5 0))')
) AS do_touch;`,
        expectedResult: 'true (share an edge)',
      },
      {
        description: 'Point on polygon boundary',
        sql: `SELECT ST_Touches(
  ST_Point(5, 0),
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')
) AS point_touches;`,
        expectedResult: 'true',
      },
    ],
    notes: [
      'Interiors must not intersect',
      'At least one boundary must intersect',
      'Useful for finding adjacent regions',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_touches',
  },
  {
    name: 'ST_Disjoint',
    category: 'Predicates',
    signature: 'ST_Disjoint(geom1 GEOMETRY, geom2 GEOMETRY) → BOOLEAN',
    description: 'Returns TRUE if geometries share no points (don\'t intersect at all).',
    returnType: 'BOOLEAN',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Two separate polygons',
        sql: `SELECT ST_Disjoint(
  ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))'),
  ST_GeomFromText('POLYGON((10 10, 15 10, 15 15, 10 15, 10 10))')
) AS are_disjoint;`,
        expectedResult: 'true',
      },
      {
        description: 'NOT ST_Intersects equivalence',
        sql: `SELECT 
  ST_Disjoint(a, b) AS disjoint,
  NOT ST_Intersects(a, b) AS not_intersects
FROM (
  SELECT 
    ST_Point(0, 0) AS a,
    ST_Point(10, 10) AS b
);`,
        expectedResult: 'Both should be true',
      },
    ],
    notes: [
      'ST_Disjoint(A, B) = NOT ST_Intersects(A, B)',
      'Geometries that touch are NOT disjoint',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_disjoint',
  },
];

// ============================================================================
// Component
// ============================================================================

const PredicatesDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Predicates"
      icon={gitCompareOutline}
      color="secondary"
      description="Test spatial relationships between geometries."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default PredicatesDemo;
