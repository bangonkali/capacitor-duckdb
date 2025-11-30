/**
 * IODemo - Input/Output Format Functions
 * 
 * Demonstrates functions for converting between geometry formats:
 * ST_AsGeoJSON, ST_AsText, ST_AsWKB, ST_GeomFromText, ST_GeomFromGeoJSON
 */

import { codeSlashOutline } from 'ionicons/icons';
import DemoPageTemplate from '../../components/spatial/DemoPageTemplate';
import type { FunctionDef } from '../../components/spatial/FunctionCard';

// ============================================================================
// Function Definitions
// ============================================================================

const FUNCTIONS: FunctionDef[] = [
  {
    name: 'ST_AsText',
    category: 'I/O Formats',
    signature: 'ST_AsText(geom GEOMETRY) → VARCHAR',
    description: 'Returns the Well-Known Text (WKT) representation of a geometry.',
    returnType: 'VARCHAR',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Point to WKT',
        sql: `SELECT ST_AsText(ST_Point(-74.006, 40.7128)) AS wkt;`,
        expectedResult: 'POINT (-74.006 40.7128)',
      },
      {
        description: 'Polygon to WKT',
        sql: `SELECT ST_AsText(
  ST_MakeEnvelope(0, 0, 10, 10)
) AS wkt;`,
        expectedResult: 'POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))',
      },
      {
        description: 'Complex geometry',
        sql: `SELECT ST_AsText(
  ST_Buffer(ST_Point(0, 0), 1, 4)
) AS circle_wkt;`,
        expectedResult: 'Polygon approximating circle',
      },
    ],
    notes: [
      'Most human-readable format',
      'Can be parsed back with ST_GeomFromText',
      'WKT = Well-Known Text (OGC standard)',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_astext',
  },
  {
    name: 'ST_GeomFromText',
    category: 'I/O Formats',
    signature: 'ST_GeomFromText(wkt VARCHAR) → GEOMETRY',
    description: 'Creates a geometry from Well-Known Text representation.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'wkt', type: 'VARCHAR', description: 'WKT string' },
    ],
    examples: [
      {
        description: 'Parse a point',
        sql: `SELECT ST_GeomFromText('POINT(-74.006 40.7128)') AS geom;`,
        expectedResult: 'GEOMETRY object',
      },
      {
        description: 'Parse a polygon',
        sql: `SELECT ST_Area(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')
) AS area;`,
        expectedResult: '100.0',
      },
      {
        description: 'Parse MultiPolygon',
        sql: `SELECT ST_NumGeometries(
  ST_GeomFromText('MULTIPOLYGON(((0 0, 5 0, 5 5, 0 5, 0 0)), ((10 10, 15 10, 15 15, 10 15, 10 10)))')
) AS num_polys;`,
        expectedResult: '2',
      },
    ],
    notes: [
      'Throws error on invalid WKT',
      'Supports all OGC geometry types',
      'Case-insensitive for type names',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_geomfromtext',
  },
  {
    name: 'ST_AsGeoJSON',
    category: 'I/O Formats',
    signature: 'ST_AsGeoJSON(geom GEOMETRY) → VARCHAR',
    description: 'Returns the GeoJSON representation of a geometry.',
    returnType: 'VARCHAR (JSON)',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Point to GeoJSON',
        sql: `SELECT ST_AsGeoJSON(ST_Point(-74.006, 40.7128)) AS geojson;`,
        expectedResult: '{"type":"Point","coordinates":[-74.006,40.7128]}',
      },
      {
        description: 'Polygon to GeoJSON',
        sql: `SELECT ST_AsGeoJSON(
  ST_MakeEnvelope(0, 0, 10, 10)
) AS geojson;`,
        expectedResult: 'GeoJSON Polygon object',
      },
      {
        description: 'Get country boundaries as GeoJSON',
        sql: `SELECT name, ST_AsGeoJSON(geom) AS boundary
FROM countries
WHERE name = 'France'
LIMIT 1;`,
        expectedResult: 'France GeoJSON geometry',
      },
    ],
    notes: [
      'Standard format for web mapping libraries',
      'Coordinates in [longitude, latitude] order',
      'Used by Leaflet, MapLibre, OpenLayers, etc.',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_asgeojson',
  },
  {
    name: 'ST_GeomFromGeoJSON',
    category: 'I/O Formats',
    signature: 'ST_GeomFromGeoJSON(json VARCHAR) → GEOMETRY',
    description: 'Creates a geometry from GeoJSON representation.',
    returnType: 'GEOMETRY',
    parameters: [
      { name: 'json', type: 'VARCHAR', description: 'GeoJSON string' },
    ],
    examples: [
      {
        description: 'Parse GeoJSON point',
        sql: `SELECT ST_AsText(
  ST_GeomFromGeoJSON('{"type":"Point","coordinates":[-74.006,40.7128]}')
) AS wkt;`,
        expectedResult: 'POINT (-74.006 40.7128)',
      },
      {
        description: 'Parse GeoJSON polygon',
        sql: `SELECT ST_Area(
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}')
) AS area;`,
        expectedResult: '100.0',
      },
    ],
    notes: [
      'Accepts geometry objects, not full FeatureCollections',
      'Use for importing web map data',
      'Coordinates must be [lon, lat] order',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_geomfromgeojson',
  },
  {
    name: 'ST_AsWKB / ST_GeomFromWKB',
    category: 'I/O Formats',
    signature: 'ST_AsWKB(geom GEOMETRY) → BLOB',
    description: 'Converts geometry to/from Well-Known Binary format.',
    returnType: 'BLOB / GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Round-trip through WKB',
        sql: `SELECT ST_AsText(
  ST_GeomFromWKB(
    ST_AsWKB(ST_Point(-74.006, 40.7128))
  )
) AS round_trip;`,
        expectedResult: 'POINT (-74.006 40.7128)',
      },
      {
        description: 'WKB size vs WKT size',
        sql: `SELECT 
  octet_length(ST_AsWKB(geom)) AS wkb_bytes,
  length(ST_AsText(geom)) AS wkt_chars
FROM (
  SELECT ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))') AS geom
);`,
        expectedResult: 'WKB is typically more compact',
      },
    ],
    notes: [
      'Binary format - compact and precise',
      'Common for database storage and transfer',
      'Preserves full double precision',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_aswkb',
  },
  {
    name: 'ST_AsHEXWKB',
    category: 'I/O Formats',
    signature: 'ST_AsHEXWKB(geom GEOMETRY) → VARCHAR',
    description: 'Returns geometry as hexadecimal-encoded WKB.',
    returnType: 'VARCHAR',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Hex encoding of a point',
        sql: `SELECT ST_AsHEXWKB(ST_Point(0, 0)) AS hex_wkb;`,
        expectedResult: 'Hexadecimal string',
      },
      {
        description: 'Parse hex WKB',
        sql: `SELECT ST_AsText(
  ST_GeomFromHEXWKB('0101000000000000000000000000000000000000000')
) AS parsed;`,
        expectedResult: 'POINT (0 0)',
      },
    ],
    notes: [
      'Text-safe representation of WKB',
      'Used by some databases (PostGIS default)',
      'Twice the size of binary WKB',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_ashexwkb',
  },
  {
    name: 'ST_GeometryType',
    category: 'I/O Formats',
    signature: 'ST_GeometryType(geom GEOMETRY) → VARCHAR',
    description: 'Returns the type of a geometry as a string.',
    returnType: 'VARCHAR',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Input geometry' },
    ],
    examples: [
      {
        description: 'Get type of various geometries',
        sql: `SELECT 
  ST_GeometryType(ST_Point(0, 0)) AS point_type,
  ST_GeometryType(ST_MakeLine(ST_Point(0,0), ST_Point(1,1))) AS line_type,
  ST_GeometryType(ST_MakeEnvelope(0,0,10,10)) AS poly_type;`,
        expectedResult: 'POINT, LINESTRING, POLYGON',
      },
      {
        description: 'Count geometries by type',
        sql: `SELECT ST_GeometryType(geom) AS type, COUNT(*) AS count
FROM countries
GROUP BY 1;`,
        expectedResult: 'Type distribution',
      },
    ],
    notes: [
      'Returns: POINT, LINESTRING, POLYGON, MULTIPOINT, etc.',
      'Useful for filtering by geometry type',
      'Case may vary by implementation',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_geometrytype',
  },
  {
    name: 'ST_IsValid / ST_MakeValid',
    category: 'I/O Formats',
    signature: 'ST_IsValid(geom GEOMETRY) → BOOLEAN',
    description: 'Checks if geometry is valid or repairs invalid geometry.',
    returnType: 'BOOLEAN / GEOMETRY',
    parameters: [
      { name: 'geom', type: 'GEOMETRY', description: 'Geometry to check/fix' },
    ],
    examples: [
      {
        description: 'Check validity',
        sql: `SELECT 
  ST_IsValid(ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))')) AS valid_poly,
  ST_IsValid(ST_GeomFromText('POLYGON((0 0, 10 10, 10 0, 0 10, 0 0))')) AS bowtie;`,
        expectedResult: 'true, false',
      },
      {
        description: 'Fix invalid geometry',
        sql: `SELECT ST_AsText(
  ST_MakeValid(
    ST_GeomFromText('POLYGON((0 0, 10 10, 10 0, 0 10, 0 0))')
  )
) AS fixed;`,
        expectedResult: 'Valid MultiPolygon',
      },
    ],
    notes: [
      'Invalid geometries can cause errors in operations',
      'Common issues: self-intersection, wrong winding order',
      'Always validate imported data',
    ],
    docsUrl: 'https://duckdb.org/docs/stable/core_extensions/spatial/functions#st_isvalid',
  },
];

// ============================================================================
// Component
// ============================================================================

const IODemo: React.FC = () => {
  return (
    <DemoPageTemplate
      title="I/O Formats"
      icon={codeSlashOutline}
      color="dark"
      description="Convert between geometry formats: WKT, GeoJSON, WKB, and more."
      functions={FUNCTIONS}
      docsUrl="https://duckdb.org/docs/stable/core_extensions/spatial/functions"
    />
  );
};

export default IODemo;
