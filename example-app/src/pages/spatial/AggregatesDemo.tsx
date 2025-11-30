/**
 * AggregatesDemo - Spatial Aggregate Functions
 * 
 * Demonstrates functions for combining multiple geometries:
 * ST_Union_Agg, ST_Extent_Agg, ST_Intersection_Agg, ST_Collect_Agg
 */

import { statsChartOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_Union_Agg',
    category: 'Aggregates',
    signature: 'ST_Union_Agg(geom GEOMETRY) → GEOMETRY',
    description: 'Aggregates geometries into a single geometry by computing their union.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Column of geometries to union' },
    ],
    examples: [
      {
        description: 'Union all cities into a MultiPoint',
        sql: `SELECT ST_GeometryType(
  ST_Union_Agg(geom)
) AS merged_type
FROM cities
LIMIT 1;`,
        expectedResult: 'MULTIPOINT or GEOMETRYCOLLECTION',
      },
      {
        description: 'Create a single polygon from country regions',
        sql: `SELECT ST_AsText(
  ST_Union_Agg(geom)
) AS merged
FROM (
  SELECT ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))') AS geom
  UNION ALL
  SELECT ST_GeomFromText('POLYGON((3 3, 8 3, 8 8, 3 8, 3 3))') AS geom
);`,
        expectedResult: 'Single merged polygon',
      },
    ],
    notes: [
      'Dissolves overlapping areas',
      'Can be slow for many complex geometries',
      'Consider using ST_Collect_Agg if you don\'t need overlap removal',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_union_agg',
  },
  {
    name: 'ST_Collect_Agg',
    category: 'Aggregates',
    signature: 'ST_Collect_Agg(geom GEOMETRY) → GEOMETRY',
    description: 'Collects geometries into a GeometryCollection without processing overlaps.',
    returnType: 'GEOMETRY (Collection)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Column of geometries to collect' },
    ],
    examples: [
      {
        description: 'Collect all airport points',
        sql: `SELECT 
  ST_GeometryType(ST_Collect_Agg(geom)) AS type,
  ST_NumGeometries(ST_Collect_Agg(geom)) AS count
FROM airports;`,
        expectedResult: 'MULTIPOINT with airport count',
      },
      {
        description: 'Compare Collect vs Union performance',
        sql: `SELECT 
  ST_NumGeometries(ST_Collect_Agg(geom)) AS collected,
  ST_NumGeometries(ST_Union_Agg(geom)) AS unioned
FROM (
  SELECT ST_Buffer(ST_Point(x, 0), 0.5) AS geom
  FROM generate_series(1, 10) AS t(x)
);`,
        expectedResult: 'Collected: 10, Unioned: 1 (merged)',
      },
    ],
    notes: [
      'Much faster than ST_Union_Agg',
      'Does not dissolve overlaps',
      'Creates Multi* geometry if all inputs are same type',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_collect_agg',
  },
  {
    name: 'ST_Extent_Agg',
    category: 'Aggregates',
    signature: 'ST_Extent_Agg(geom GEOMETRY) → BOX_2D',
    description: 'Returns the bounding box that contains all input geometries.',
    returnType: 'BOX_2D',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Column of geometries' },
    ],
    examples: [
      {
        description: 'Bounding box of all cities',
        sql: `SELECT ST_Extent_Agg(geom) AS world_extent
FROM cities;`,
        expectedResult: 'BOX covering all cities',
      },
      {
        description: 'Convert extent to polygon',
        sql: `WITH extent AS (
  SELECT ST_Extent_Agg(geom) AS bbox
  FROM countries
)
SELECT ST_AsText(
  ST_MakeEnvelope(
    ST_XMin(bbox), ST_YMin(bbox),
    ST_XMax(bbox), ST_YMax(bbox)
  )
) AS envelope
FROM extent;`,
        expectedResult: 'Polygon covering all countries',
      },
    ],
    notes: [
      'Returns BOX_2D, not a geometry',
      'Use ST_Envelope to convert to polygon',
      'Useful for calculating map bounds',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_extent_agg',
  },
  {
    name: 'ST_Intersection_Agg',
    category: 'Aggregates',
    signature: 'ST_Intersection_Agg(geom GEOMETRY) → GEOMETRY',
    description: 'Returns the geometry representing the intersection of all input geometries.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Column of geometries' },
    ],
    examples: [
      {
        description: 'Common area of overlapping polygons',
        sql: `SELECT ST_AsText(ST_Intersection_Agg(geom)) AS common_area
FROM (
  SELECT ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS geom
  UNION ALL
  SELECT ST_GeomFromText('POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))') AS geom
  UNION ALL
  SELECT ST_GeomFromText('POLYGON((3 3, 12 3, 12 12, 3 12, 3 3))') AS geom
);`,
        expectedResult: 'Area common to all three polygons',
      },
    ],
    notes: [
      'Returns empty geometry if no common intersection',
      'Order doesn\'t matter',
      'Useful for finding overlap regions',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_intersection_agg',
  },
  {
    name: 'ST_Centroid (with GROUP BY)',
    category: 'Aggregates',
    signature: 'ST_Centroid(ST_Collect_Agg(geom)) → GEOMETRY',
    description: 'Calculate the centroid of collected geometries per group.',
    returnType: 'GEOMETRY (Point)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Column of geometries' },
    ],
    examples: [
      {
        description: 'Center of all airports per country (hypothetical)',
        sql: `SELECT 
  ST_AsText(ST_Centroid(ST_Collect_Agg(geom))) AS center
FROM airports
LIMIT 1;`,
        expectedResult: 'Center point of airports',
      },
    ],
    notes: [
      'Combine with GROUP BY for per-group centroids',
      'Use ST_Collect_Agg to gather points first',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_centroid',
  },
  {
    name: 'Aggregate with Window Functions',
    category: 'Aggregates',
    signature: 'ST_Union_Agg(geom) OVER (PARTITION BY ...)',
    description: 'Use spatial aggregates with window functions for advanced analysis.',
    returnType: 'GEOMETRY',
    parameters: [],
    examples: [
      {
        description: 'Running union with window function',
        sql: `SELECT id,
  ST_AsText(
    ST_Union_Agg(geom) OVER (ORDER BY id ROWS UNBOUNDED PRECEDING)
  ) AS cumulative_union
FROM (
  SELECT 1 AS id, ST_Point(0, 0) AS geom
  UNION ALL SELECT 2, ST_Point(5, 5)
  UNION ALL SELECT 3, ST_Point(10, 0)
);`,
        expectedResult: 'Cumulative union as rows are added',
      },
    ],
    notes: [
      'Combines power of window functions with spatial aggregation',
      'Useful for incremental processing',
      'Can be computationally expensive',
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

const AggregatesDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Aggregates"
      icon={statsChartOutline}
      color="danger"
      description="Combine multiple geometries using aggregate functions."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default AggregatesDemo;
