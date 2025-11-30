/**
 * TransformsDemo - Coordinate Transformation Functions
 * 
 * Demonstrates functions for coordinate systems and simplification:
 * ST_Transform, ST_Simplify, ST_SimplifyPreserveTopology, ST_ReducePrecision
 */

import { swapHorizontalOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_Transform',
    category: 'Transforms',
    signature: 'ST_Transform(geom GEOMETRY, srid INTEGER) → GEOMETRY',
    description: 'Transforms geometry from one coordinate reference system to another.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry with source CRS' },
      { name: 'srid', type: 'INTEGER', description: 'Target SRID (coordinate reference system)' },
    ],
    examples: [
      {
        description: 'Transform WGS84 to Web Mercator',
        sql: `SELECT ST_AsText(
  ST_Transform(
    ST_SetSRID(ST_Point(-74.006, 40.7128), 4326),
    3857
  )
) AS web_mercator;`,
        expectedResult: 'Point in meters (Web Mercator)',
      },
      {
        description: 'Check SRID of geometry',
        sql: `SELECT ST_SRID(
  ST_Transform(
    ST_SetSRID(ST_Point(0, 0), 4326),
    3857
  )
) AS srid;`,
        expectedResult: '3857',
      },
    ],
    notes: [
      'EPSG:4326 = WGS84 (GPS coordinates, lon/lat in degrees)',
      'EPSG:3857 = Web Mercator (used by web maps, units in meters)',
      'Requires PROJ support in the spatial extension',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_transform',
  },
  {
    name: 'ST_SetSRID',
    category: 'Transforms',
    signature: 'ST_SetSRID(geom GEOMETRY, srid INTEGER) → GEOMETRY',
    description: 'Sets the SRID (Spatial Reference ID) of a geometry without transforming it.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
      { name: 'srid', type: 'INTEGER', description: 'SRID to assign' },
    ],
    examples: [
      {
        description: 'Assign SRID to a point',
        sql: `SELECT ST_SRID(
  ST_SetSRID(ST_Point(-74.006, 40.7128), 4326)
) AS srid;`,
        expectedResult: '4326',
      },
      {
        description: 'Pipeline: Set SRID then transform',
        sql: `SELECT ST_AsText(
  ST_Transform(
    ST_SetSRID(
      ST_Point(-122.4194, 37.7749),  -- San Francisco
      4326  -- This is WGS84
    ),
    32610  -- UTM Zone 10N
  )
) AS utm_coords;`,
        expectedResult: 'Point in UTM meters',
      },
    ],
    notes: [
      'Does NOT transform coordinates, only sets metadata',
      'Use before ST_Transform to specify source CRS',
      'SRID 0 means no CRS defined',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_setsrid',
  },
  {
    name: 'ST_Simplify',
    category: 'Transforms',
    signature: 'ST_Simplify(geom GEOMETRY, tolerance DOUBLE) → GEOMETRY',
    description: 'Simplifies geometry using the Douglas-Peucker algorithm.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
      { name: 'tolerance', type: 'DOUBLE', description: 'Maximum deviation allowed' },
    ],
    examples: [
      {
        description: 'Simplify a complex line',
        sql: `SELECT 
  ST_NPoints(geom) AS original_points,
  ST_NPoints(ST_Simplify(geom, 0.01)) AS simplified_points
FROM (
  SELECT ST_GeomFromText(
    'LINESTRING(0 0, 1 0.1, 2 0, 3 0.1, 4 0, 5 0.1, 6 0, 7 0.1, 8 0, 9 0.1, 10 0)'
  ) AS geom
);`,
        expectedResult: 'Original: 11, Simplified: ~3',
      },
      {
        description: 'Simplify country boundaries',
        sql: `SELECT name,
  ST_NPoints(geom) AS original,
  ST_NPoints(ST_Simplify(geom, 0.1)) AS simplified
FROM countries
WHERE name = 'Italy'
LIMIT 1;`,
        expectedResult: 'Significant reduction in points',
      },
    ],
    notes: [
      'Larger tolerance = more simplification',
      'May create invalid geometries (self-intersections)',
      'Use ST_SimplifyPreserveTopology to prevent invalid results',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_simplify',
  },
  {
    name: 'ST_SimplifyPreserveTopology',
    category: 'Transforms',
    signature: 'ST_SimplifyPreserveTopology(geom GEOMETRY, tolerance DOUBLE) → GEOMETRY',
    description: 'Simplifies geometry while ensuring the result is still valid.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
      { name: 'tolerance', type: 'DOUBLE', description: 'Maximum deviation allowed' },
    ],
    examples: [
      {
        description: 'Safe simplification of a polygon',
        sql: `SELECT 
  ST_IsValid(ST_Simplify(geom, 0.5)) AS simple_valid,
  ST_IsValid(ST_SimplifyPreserveTopology(geom, 0.5)) AS preserve_valid
FROM (
  SELECT ST_GeomFromText(
    'POLYGON((0 0, 10 0, 10 10, 5 5, 0 10, 0 0))'
  ) AS geom
);`,
        expectedResult: 'Both should be valid, but preserve is safer',
      },
    ],
    notes: [
      'Slower than ST_Simplify but always produces valid geometry',
      'Recommended for polygons and display purposes',
      'Will not reduce beyond minimum valid configuration',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_simplifypreservetopology',
  },
  {
    name: 'ST_FlipCoordinates',
    category: 'Transforms',
    signature: 'ST_FlipCoordinates(geom GEOMETRY) → GEOMETRY',
    description: 'Swaps X and Y coordinates (useful for fixing lat/lon order).',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Fix lat/lon vs lon/lat confusion',
        sql: `SELECT 
  ST_AsText(ST_Point(40.7128, -74.006)) AS wrong_order,
  ST_AsText(ST_FlipCoordinates(ST_Point(40.7128, -74.006))) AS correct;`,
        expectedResult: 'Swapped coordinates',
      },
    ],
    notes: [
      'Useful when data has coordinates in wrong order',
      'Common issue: GeoJSON uses [lon, lat] but some systems use [lat, lon]',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_flipcoordinates',
  },
  {
    name: 'ST_ReducePrecision',
    category: 'Transforms',
    signature: 'ST_ReducePrecision(geom GEOMETRY, gridSize DOUBLE) → GEOMETRY',
    description: 'Reduces coordinate precision by snapping to a grid.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
      { name: 'gridSize', type: 'DOUBLE', description: 'Grid cell size for snapping' },
    ],
    examples: [
      {
        description: 'Reduce coordinate precision',
        sql: `SELECT ST_AsText(
  ST_ReducePrecision(
    ST_Point(-74.0060123456, 40.7128987654),
    0.001
  )
) AS reduced;`,
        expectedResult: 'POINT (-74.006 40.713)',
      },
    ],
    notes: [
      'Useful for reducing file size and eliminating precision artifacts',
      'Can make geometries invalid; consider ST_MakeValid after',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_reduceprecision',
  },
  {
    name: 'ST_Reverse',
    category: 'Transforms',
    signature: 'ST_Reverse(geom GEOMETRY) → GEOMETRY',
    description: 'Reverses the order of vertices in a geometry.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Reverse a linestring',
        sql: `SELECT ST_AsText(
  ST_Reverse(
    ST_GeomFromText('LINESTRING(0 0, 5 5, 10 0)')
  )
) AS reversed;`,
        expectedResult: 'LINESTRING (10 0, 5 5, 0 0)',
      },
      {
        description: 'Fix polygon winding order',
        sql: `SELECT 
  ST_IsPolygonCW(geom) AS is_cw,
  ST_IsPolygonCW(ST_Reverse(geom)) AS reversed_cw
FROM (
  SELECT ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS geom
);`,
        expectedResult: 'Winding order flipped',
      },
    ],
    notes: [
      'Useful for fixing polygon winding order',
      'LineString direction affects some operations',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_reverse',
  },
];

// ============================================================================
// Component
// ============================================================================

const TransformsDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Transforms"
      icon={swapHorizontalOutline}
      color="warning"
      description="Transform coordinate systems, simplify geometries, and adjust precision."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default TransformsDemo;
