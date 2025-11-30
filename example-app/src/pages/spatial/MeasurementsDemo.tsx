/**
 * MeasurementsDemo - Distance and Area Functions
 * 
 * Demonstrates functions for calculating distances, areas, lengths:
 * ST_Distance, ST_Distance_Spheroid, ST_Area, ST_Length, ST_Perimeter
 */

import { analyticsOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_Distance',
    category: 'Measurements',
    signature: 'ST_Distance(geom1 GEOMETRY, geom2 GEOMETRY) → DOUBLE',
    description: 'Returns the minimum Cartesian distance between two geometries.',
    returnType: 'DOUBLE',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First geometry' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second geometry' },
    ],
    examples: [
      {
        description: 'Distance between two points',
        sql: `SELECT ST_Distance(
  ST_Point(0, 0),
  ST_Point(3, 4)
) AS distance;`,
        expectedResult: '5.0 (Pythagorean theorem)',
      },
      {
        description: 'Distance from point to line',
        sql: `SELECT ST_Distance(
  ST_Point(5, 5),
  ST_GeomFromText('LINESTRING(0 0, 10 0)')
) AS dist_to_line;`,
        expectedResult: '5.0 (perpendicular distance)',
      },
      {
        description: 'Distance between New York and London (in degrees)',
        sql: `SELECT ST_Distance(
  ST_Point(-74.006, 40.7128),   -- New York
  ST_Point(-0.1276, 51.5074)    -- London
) AS degrees;`,
        expectedResult: '~62.5 degrees (not useful for real distance!)',
      },
    ],
    notes: [
      'Returns distance in the coordinate system units',
      'For geographic coordinates, this returns degrees (not meters)',
      'Use ST_Distance_Spheroid for accurate earth distances',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_distance',
  },
  {
    name: 'ST_Distance_Spheroid',
    category: 'Measurements',
    signature: 'ST_Distance_Spheroid(geom1 GEOMETRY, geom2 GEOMETRY) → DOUBLE',
    description: 'Returns the geodetic distance between two points on the Earth\'s surface in meters.',
    returnType: 'DOUBLE (meters)',
    parameters: [
      { name: 'geom1', type: 'GEOMETRY', description: 'First point (lon, lat)' },
      { name: 'geom2', type: 'GEOMETRY', description: 'Second point (lon, lat)' },
    ],
    examples: [
      {
        description: 'Distance from New York to London',
        sql: `SELECT 
  ST_Distance_Spheroid(
    ST_Point(-74.006, 40.7128),   -- New York
    ST_Point(-0.1276, 51.5074)    -- London
  ) / 1000 AS km;`,
        expectedResult: '~5,570 km',
      },
      {
        description: 'Distance from San Francisco to Tokyo',
        sql: `SELECT 
  ST_Distance_Spheroid(
    ST_Point(-122.4194, 37.7749),  -- San Francisco
    ST_Point(139.6917, 35.6895)    -- Tokyo
  ) / 1000 AS km;`,
        expectedResult: '~8,280 km',
      },
      {
        description: 'Find closest airport',
        sql: `SELECT name,
  ST_Distance_Spheroid(
    geom,
    ST_Point(-74.006, 40.7128)  -- New York City center
  ) / 1000 AS dist_km
FROM airports
ORDER BY dist_km
LIMIT 3;`,
        expectedResult: 'Nearest airports to NYC',
      },
    ],
    notes: [
      'Uses the WGS84 spheroid for accurate calculations',
      'Input must be in longitude, latitude (EPSG:4326)',
      'Returns distance in meters',
      'Accounts for the Earth\'s ellipsoidal shape',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_distance_spheroid',
  },
  {
    name: 'ST_Area',
    category: 'Measurements',
    signature: 'ST_Area(geom GEOMETRY) → DOUBLE',
    description: 'Returns the area of a polygon geometry.',
    returnType: 'DOUBLE',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Polygon or MultiPolygon geometry' },
    ],
    examples: [
      {
        description: 'Area of a simple square',
        sql: `SELECT ST_Area(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')
) AS area;`,
        expectedResult: '100.0',
      },
      {
        description: 'Area of a circle approximation',
        sql: `SELECT ST_Area(
  ST_Buffer(ST_Point(0, 0), 10, 32)
) AS circle_area;`,
        expectedResult: '~314.16 (π × r²)',
      },
      {
        description: 'Largest countries by area (in square degrees)',
        sql: `SELECT name, ST_Area(geom) AS area_sq_deg
FROM countries
ORDER BY area_sq_deg DESC
LIMIT 5;`,
        expectedResult: 'Russia, Canada, USA, China, Brazil',
      },
    ],
    notes: [
      'Returns area in the square of the coordinate system units',
      'For geographic coordinates (degrees), result is in square degrees',
      'For accurate area, transform to a suitable projection first',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_area',
  },
  {
    name: 'ST_Length',
    category: 'Measurements',
    signature: 'ST_Length(geom GEOMETRY) → DOUBLE',
    description: 'Returns the length of a LineString geometry.',
    returnType: 'DOUBLE',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'LineString or MultiLineString geometry' },
    ],
    examples: [
      {
        description: 'Length of a simple line',
        sql: `SELECT ST_Length(
  ST_GeomFromText('LINESTRING(0 0, 3 4)')
) AS length;`,
        expectedResult: '5.0',
      },
      {
        description: 'Length of a multi-segment path',
        sql: `SELECT ST_Length(
  ST_GeomFromText('LINESTRING(0 0, 3 0, 3 4)')
) AS path_length;`,
        expectedResult: '7.0 (3 + 4)',
      },
      {
        description: 'Total length of rivers',
        sql: `SELECT SUM(ST_Length(geom)) AS total_length
FROM rivers;`,
        expectedResult: 'Sum of all river lengths (in degrees)',
      },
    ],
    notes: [
      'Returns 0 for Point and Polygon geometries',
      'For polygons, use ST_Perimeter instead',
      'Returns length in coordinate system units',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_length',
  },
  {
    name: 'ST_Perimeter',
    category: 'Measurements',
    signature: 'ST_Perimeter(geom GEOMETRY) → DOUBLE',
    description: 'Returns the perimeter of a polygon geometry.',
    returnType: 'DOUBLE',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Polygon geometry' },
    ],
    examples: [
      {
        description: 'Perimeter of a square',
        sql: `SELECT ST_Perimeter(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')
) AS perimeter;`,
        expectedResult: '40.0',
      },
      {
        description: 'Perimeter vs Length',
        sql: `SELECT 
  ST_Perimeter(geom) AS perimeter,
  ST_Length(ST_Boundary(geom)) AS boundary_length
FROM (
  SELECT ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS geom
);`,
        expectedResult: 'Both should be 40.0',
      },
    ],
    notes: [
      'Returns the total length of all rings (exterior + holes)',
      'Equivalent to ST_Length(ST_Boundary(geom))',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_perimeter',
  },
  {
    name: 'ST_Centroid',
    category: 'Measurements',
    signature: 'ST_Centroid(geom GEOMETRY) → GEOMETRY',
    description: 'Returns the geometric center (centroid) of a geometry.',
    returnType: 'GEOMETRY (Point)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Any geometry' },
    ],
    examples: [
      {
        description: 'Center of a square',
        sql: `SELECT ST_AsText(ST_Centroid(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')
)) AS center;`,
        expectedResult: 'POINT (5 5)',
      },
      {
        description: 'Centroid of country',
        sql: `SELECT name, ST_AsText(ST_Centroid(geom)) AS center
FROM countries
WHERE name = 'France'
LIMIT 1;`,
        expectedResult: 'Approximate center of France',
      },
    ],
    notes: [
      'Centroid may be outside the geometry for concave shapes',
      'For a guaranteed point inside, use ST_PointOnSurface',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_centroid',
  },
  {
    name: 'ST_Extent',
    category: 'Measurements',
    signature: 'ST_Extent(geom GEOMETRY) → BOX_2D',
    description: 'Returns the bounding box of a geometry.',
    returnType: 'BOX_2D',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Any geometry' },
    ],
    examples: [
      {
        description: 'Bounding box of a triangle',
        sql: `SELECT ST_Extent(
  ST_GeomFromText('POLYGON((0 0, 10 0, 5 8, 0 0))')
) AS bbox;`,
        expectedResult: 'BOX(0 0, 10 8)',
      },
      {
        description: 'Convert box to polygon',
        sql: `SELECT ST_AsText(
  ST_Envelope(
    ST_GeomFromText('POLYGON((0 0, 10 0, 5 8, 0 0))')
  )
) AS bbox_polygon;`,
        expectedResult: 'POLYGON ((0 0, 10 0, 10 8, 0 8, 0 0))',
      },
    ],
    notes: [
      'Returns a BOX_2D type, not a geometry',
      'Use ST_Envelope to get the bounding box as a polygon',
      'Useful for spatial indexing and quick filtering',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_extent',
  },
];

// ============================================================================
// Component
// ============================================================================

const MeasurementsDemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="Measurements"
      icon={analyticsOutline}
      color="tertiary"
      description="Calculate distances, areas, lengths, and other spatial measurements."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default MeasurementsDemo;
