/**
 * ProcessingDemo - Geometry Processing Functions
 * 
 * Demonstrates functions for transforming and combining geometries:
 * ST_Buffer, ST_Union, ST_Intersection, ST_Difference, ST_ConvexHull
 */

import { colorWandOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_Buffer',
    category: 'Processing',
    signature: 'ST_Buffer(geom GEOMETRY, distance DOUBLE) → GEOMETRY',
    description: 'Returns a geometry that represents all points within a given distance of the input geometry.',
    returnType: 'GEOMETRY (Polygon)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
      { name: 'distance', type: 'DOUBLE', description: 'Buffer distance' },
      { name: 'segments', type: 'INTEGER', description: 'Number of segments for curve approximation', optional: true },
    ],
    examples: [
      {
        description: 'Buffer around a point (creates a circle)',
        sql: `SELECT ST_AsText(
  ST_Buffer(ST_Point(0, 0), 1, 8)
) AS circle;`,
        expectedResult: 'Polygon approximating a circle',
      },
      {
        description: 'Buffer around a line (creates a corridor)',
        sql: `SELECT ST_Area(
  ST_Buffer(
    ST_GeomFromText('LINESTRING(0 0, 10 0)'),
    1
  )
) AS corridor_area;`,
        expectedResult: 'Area of the buffered line',
      },
      {
        description: 'Create a 50km buffer around New York (in degrees)',
        sql: `SELECT ST_AsText(
  ST_Buffer(ST_Point(-74.006, 40.7128), 0.5, 16)
) AS nyc_buffer;`,
        expectedResult: 'Polygon around NYC (~0.5 degrees ≈ 50km)',
      },
    ],
    notes: [
      'Negative buffer shrinks the geometry (for polygons)',
      'More segments = smoother curves but larger geometry',
      'Distance is in coordinate system units (degrees for WGS84)',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_buffer',
  },
  {
    name: 'ST_Union',
    category: 'Processing',
    signature: 'ST_Union(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Returns a geometry that represents the union of two geometries.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Union of two overlapping squares',
        sql: `SELECT ST_AsText(
  ST_Union(
    ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))'),
    ST_GeomFromText('POLYGON((3 3, 8 3, 8 8, 3 8, 3 3))')
  )
) AS merged;`,
        expectedResult: 'L-shaped polygon',
      },
      {
        description: 'Union creates MultiPolygon for non-overlapping',
        sql: `SELECT ST_GeometryType(
  ST_Union(
    ST_GeomFromText('POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))'),
    ST_GeomFromText('POLYGON((5 5, 7 5, 7 7, 5 7, 5 5))')
  )
) AS geom_type;`,
        expectedResult: 'MULTIPOLYGON',
      },
    ],
    notes: [
      'Overlapping areas are merged, not doubled',
      'Non-overlapping geometries create Multi* geometries',
      'Use ST_Union_Agg to union many geometries',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_union',
  },
  {
    name: 'ST_Intersection',
    category: 'Processing',
    signature: 'ST_Intersection(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Returns a geometry representing the shared portion of two geometries.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Intersection of two overlapping squares',
        sql: `SELECT ST_AsText(
  ST_Intersection(
    ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))'),
    ST_GeomFromText('POLYGON((3 3, 8 3, 8 8, 3 8, 3 3))')
  )
) AS overlap;`,
        expectedResult: 'POLYGON ((3 3, 5 3, 5 5, 3 5, 3 3))',
      },
      {
        description: 'Calculate overlap area',
        sql: `SELECT ST_Area(
  ST_Intersection(
    ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
    ST_GeomFromText('POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))')
  )
) AS overlap_area;`,
        expectedResult: '25.0',
      },
    ],
    notes: [
      'Returns empty geometry if no intersection',
      'Can result in lower-dimensional geometry (area→line)',
      'Useful for clipping geometries to regions',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_intersection',
  },
  {
    name: 'ST_Difference',
    category: 'Processing',
    signature: 'ST_Difference(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Returns a geometry representing the portion of geom1 that does not intersect geom2.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'Geometry to subtract from' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Geometry to subtract' },
    ],
    examples: [
      {
        description: 'Cut a hole in a square',
        sql: `SELECT ST_AsText(
  ST_Difference(
    ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
    ST_GeomFromText('POLYGON((3 3, 7 3, 7 7, 3 7, 3 3))')
  )
) AS with_hole;`,
        expectedResult: 'Polygon with a hole',
      },
      {
        description: 'Area after subtraction',
        sql: `SELECT 
  ST_Area(big) AS original,
  ST_Area(small) AS hole,
  ST_Area(ST_Difference(big, small)) AS remaining
FROM (
  SELECT 
    ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS big,
    ST_GeomFromText('POLYGON((3 3, 7 3, 7 7, 3 7, 3 3))') AS small
);`,
        expectedResult: '100 - 16 = 84',
      },
    ],
    notes: [
      'Order matters: ST_Difference(A, B) ≠ ST_Difference(B, A)',
      'Returns geom1 unchanged if no intersection',
      'May create MultiPolygon if result is disconnected',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_difference',
  },
  {
    name: 'ST_ConvexHull',
    category: 'Processing',
    signature: 'ST_ConvexHull(geom GEOMETRY) → GEOMETRY',
    description: 'Returns the smallest convex polygon that contains the input geometry.',
    returnType: 'GEOMETRY (Polygon)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Convex hull of scattered points',
        sql: `SELECT ST_AsText(ST_ConvexHull(
  ST_GeomFromText('MULTIPOINT(0 0, 5 8, 10 0, 5 2)')
)) AS hull;`,
        expectedResult: 'POLYGON ((0 0, 5 8, 10 0, 0 0))',
      },
      {
        description: 'Convex hull of a concave polygon',
        sql: `SELECT ST_AsText(ST_ConvexHull(
  ST_GeomFromText('POLYGON((0 0, 5 5, 10 0, 10 10, 0 10, 0 0))')
)) AS hull;`,
        expectedResult: 'The concave part is filled in',
      },
    ],
    notes: [
      'Like shrink-wrapping around the geometry',
      'Result is always convex (no inward curves)',
      'Useful for simplification and collision detection',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_convexhull',
  },
  {
    name: 'ST_SymDifference',
    category: 'Processing',
    signature: 'ST_SymDifference(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Returns portions of geometries that do not overlap (exclusive OR).',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'XOR of two overlapping squares',
        sql: `SELECT ST_Area(
  ST_SymDifference(
    ST_GeomFromText('POLYGON((0 0, 5 0, 5 5, 0 5, 0 0))'),
    ST_GeomFromText('POLYGON((3 3, 8 3, 8 8, 3 8, 3 8, 3 3))')
  )
) AS xor_area;`,
        expectedResult: 'Area not shared by both',
      },
    ],
    notes: [
      'ST_SymDifference(A, B) = ST_Union(ST_Difference(A,B), ST_Difference(B,A))',
      'Returns the "exclusive or" of two geometries',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_symdifference',
  },
  {
    name: 'ST_Voronoi',
    category: 'Processing',
    signature: 'ST_VoronoiPolygons(geom GEOMETRY) → GEOMETRY',
    description: 'Creates Voronoi diagram polygons from input points.',
    returnType: 'GEOMETRY (GeometryCollection)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'MultiPoint or GeometryCollection of points' },
      { name: 'tolerance', type: 'DOUBLE', description: 'Snapping tolerance', optional: true },
      { name: 'envelope', type: 'GEOMETRY', description: 'Clipping envelope', optional: true },
    ],
    examples: [
      {
        description: 'Voronoi diagram from points',
        sql: `SELECT ST_NumGeometries(
  ST_VoronoiPolygons(
    ST_GeomFromText('MULTIPOINT(0 0, 10 0, 5 10)')
  )
) AS num_cells;`,
        expectedResult: '3 (one cell per point)',
      },
    ],
    notes: [
      'Each cell contains all points closest to its input point',
      'Useful for spatial partitioning and nearest-neighbor analysis',
      'Output cells extend to infinity without envelope',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_voronoipolygons',
  },
];

// ============================================================================
// Component
// ============================================================================

const ProcessingDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Processing"
      icon={colorWandOutline}
      color="success"
      description="Transform, combine, and process geometries with powerful spatial operations."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default ProcessingDemo;
