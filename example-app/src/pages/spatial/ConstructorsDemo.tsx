/**
 * ConstructorsDemo - Geometry Constructor Functions
 * 
 * Demonstrates functions for creating geometries from coordinates:
 * ST_Point, ST_MakeLine, ST_MakePolygon, ST_Collect, ST_MakeEnvelope
 */

import { constructOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_Point',
    category: 'Constructors',
    signature: 'ST_Point(x DOUBLE, y DOUBLE) → GEOMETRY',
    description: 'Creates a Point geometry from X and Y coordinates.',
    returnType: 'GEOMETRY (Point)',
    parameters: [
      { name: 'x', type: 'DOUBLE', description: 'X coordinate (longitude)' },
      { name: 'y', type: 'DOUBLE', description: 'Y coordinate (latitude)' },
    ],
    examples: [
      {
        description: 'Create a point for New York City',
        sql: `SELECT ST_AsText(ST_Point(-74.006, 40.7128)) AS nyc_point;`,
        expectedResult: 'POINT (-74.006 40.7128)',
      },
      {
        description: 'Create points for multiple cities',
        sql: `SELECT city, ST_AsText(ST_Point(lon, lat)) AS geom
FROM (VALUES 
  ('New York', -74.006, 40.7128),
  ('London', -0.1276, 51.5074),
  ('Tokyo', 139.6917, 35.6895)
) AS t(city, lon, lat);`,
        expectedResult: 'Three points for major cities',
      },
      {
        description: 'Calculate distance between two points',
        sql: `SELECT ST_Distance(
  ST_Point(-74.006, 40.7128),
  ST_Point(-0.1276, 51.5074)
) AS distance_degrees;`,
        expectedResult: 'Distance in degrees (approximately 62)',
      },
    ],
    notes: [
      'Coordinates are typically in WGS84 (EPSG:4326) - longitude, latitude order',
      'For geodetic calculations, consider using ST_Distance_Spheroid',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_point',
  },
  {
    name: 'ST_MakeLine',
    category: 'Constructors',
    signature: 'ST_MakeLine(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Creates a LineString from two or more points.',
    returnType: 'GEOMETRY (LineString)',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First point' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second point' },
    ],
    examples: [
      {
        description: 'Create a line between two cities',
        sql: `SELECT ST_AsText(
  ST_MakeLine(
    ST_Point(-74.006, 40.7128),  -- New York
    ST_Point(-0.1276, 51.5074)   -- London
  )
) AS transatlantic_route;`,
        expectedResult: 'LINESTRING (-74.006 40.7128, -0.1276 51.5074)',
      },
      {
        description: 'Calculate length of the line',
        sql: `SELECT ST_Length(
  ST_MakeLine(
    ST_Point(-122.4194, 37.7749),  -- San Francisco
    ST_Point(-118.2437, 34.0522)   -- Los Angeles
  )
) AS length_degrees;`,
        expectedResult: 'Length in degrees (approximately 5.5)',
      },
    ],
    notes: [
      'Can also accept an array of points: ST_MakeLine(ARRAY[pt1, pt2, pt3])',
      'Points are connected in the order they are provided',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_makeline',
  },
  {
    name: 'ST_MakePolygon',
    category: 'Constructors',
    signature: 'ST_MakePolygon(linestring GEOMETRY) → GEOMETRY',
    description: 'Creates a Polygon from a closed LineString (ring).',
    returnType: 'GEOMETRY (Polygon)',
    parameters: [
      { name: 'linestring', type: 'GEOMETRY', description: 'Closed LineString forming the exterior ring' },
    ],
    examples: [
      {
        description: 'Create a triangular polygon',
        sql: `SELECT ST_AsText(
  ST_MakePolygon(
    ST_GeomFromText('LINESTRING(0 0, 10 0, 5 10, 0 0)')
  )
) AS triangle;`,
        expectedResult: 'POLYGON ((0 0, 10 0, 5 10, 0 0))',
      },
      {
        description: 'Create a polygon and calculate its area',
        sql: `SELECT ST_Area(
  ST_MakePolygon(
    ST_GeomFromText('LINESTRING(0 0, 10 0, 10 10, 0 10, 0 0)')
  )
) AS area;`,
        expectedResult: 'Area = 100',
      },
    ],
    notes: [
      'The LineString must be closed (first and last point identical)',
      'For polygons with holes, use ST_MakePolygon(outer_ring, [hole1, hole2])',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_makepolygon',
  },
  {
    name: 'ST_Collect',
    category: 'Constructors',
    signature: 'ST_Collect(geom1 GEOMETRY, geom2 GEOMETRY) → GEOMETRY',
    description: 'Collects geometries into a GeometryCollection or Multi geometry.',
    returnType: 'GEOMETRY (Collection)',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Collect two points into a MultiPoint',
        sql: `SELECT ST_AsText(
  ST_Collect(
    ST_Point(0, 0),
    ST_Point(10, 10)
  )
) AS multipoint;`,
        expectedResult: 'MULTIPOINT (0 0, 10 10)',
      },
      {
        description: 'Collect different geometry types',
        sql: `SELECT ST_AsText(
  ST_Collect(
    ST_Point(0, 0),
    ST_GeomFromText('LINESTRING(0 0, 10 10)')
  )
) AS collection;`,
        expectedResult: 'GEOMETRYCOLLECTION (POINT (0 0), LINESTRING (0 0, 10 10))',
      },
    ],
    notes: [
      'If all geometries are the same type, creates Multi* geometry',
      'Mixed types create GeometryCollection',
      'Use ST_Collect_Agg for aggregating many geometries',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_collect',
  },
  {
    name: 'ST_MakeEnvelope',
    category: 'Constructors',
    signature: 'ST_MakeEnvelope(xmin, ymin, xmax, ymax) → GEOMETRY',
    description: 'Creates a rectangular Polygon from bounding box coordinates.',
    returnType: 'GEOMETRY (Polygon)',
    parameters: [
      { name: 'xmin', type: 'DOUBLE', description: 'Minimum X (left)' },
      { name: 'ymin', type: 'DOUBLE', description: 'Minimum Y (bottom)' },
      { name: 'xmax', type: 'DOUBLE', description: 'Maximum X (right)' },
      { name: 'ymax', type: 'DOUBLE', description: 'Maximum Y (top)' },
    ],
    examples: [
      {
        description: 'Create a bounding box for the continental US',
        sql: `SELECT ST_AsText(
  ST_MakeEnvelope(-124.7, 24.5, -66.9, 49.4)
) AS us_bounds;`,
        expectedResult: 'POLYGON ((-124.7 24.5, -124.7 49.4, -66.9 49.4, -66.9 24.5, -124.7 24.5))',
      },
      {
        description: 'Check if a point is within an envelope',
        sql: `SELECT ST_Within(
  ST_Point(-74.006, 40.7128),  -- New York
  ST_MakeEnvelope(-124.7, 24.5, -66.9, 49.4)  -- US bounds
) AS is_in_us;`,
        expectedResult: 'true',
      },
    ],
    notes: [
      'Useful for creating spatial filters and bounding boxes',
      'Can be used with ST_Intersects for efficient spatial queries',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_makeenvelope',
  },
  {
    name: 'ST_GeomFromText',
    category: 'Constructors',
    signature: 'ST_GeomFromText(wkt VARCHAR) → GEOMETRY',
    description: 'Creates a geometry from Well-Known Text (WKT) representation.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'wkt', type: 'VARCHAR', description: 'Well-Known Text string' },
    ],
    examples: [
      {
        description: 'Parse a point from WKT',
        sql: `SELECT ST_AsText(
  ST_GeomFromText('POINT(-74.006 40.7128)')
) AS point;`,
        expectedResult: 'POINT (-74.006 40.7128)',
      },
      {
        description: 'Parse a polygon from WKT',
        sql: `SELECT ST_Area(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')
) AS area;`,
        expectedResult: 'Area = 100',
      },
      {
        description: 'Parse a complex MultiPolygon',
        sql: `SELECT ST_NumGeometries(
  ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)),((2 2, 3 2, 3 3, 2 3, 2 2)))')
) AS num_polygons;`,
        expectedResult: '2',
      },
    ],
    notes: [
      'WKT is a text markup language for vector geometry objects',
      'Common formats: POINT, LINESTRING, POLYGON, MULTIPOINT, etc.',
      'For GeoJSON input, use ST_GeomFromGeoJSON',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_geomfromtext',
  },
];

// ============================================================================
// Component
// ============================================================================

const ConstructorsDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Constructors"
      icon={constructOutline}
      color="primary"
      description="Create geometries from coordinates, WKT, and other representations."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default ConstructorsDemo;
