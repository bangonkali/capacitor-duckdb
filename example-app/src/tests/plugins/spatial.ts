import { CapacitorDuckDb } from '@bangonkali/capacitor-duckdb';
import { testRegistry } from '../TestRegistry';
import { assert, assertEqual } from '../utils';

const DB_NAME = 'integration_test_db';

export const registerSpatialTests = () => {
    const GROUP = 'Spatial Extension';

    // 1. Geometry Construction & Parsing
    testRegistry.registerTest(GROUP, {
        name: 'Construction & Parsing',
        description: 'Test ST_Point, ST_MakePoint, ST_GeomFromText, ST_GeomFromGeoJSON, etc.',
        testFn: async () => {
            await CapacitorDuckDb.execute({
                database: DB_NAME,
                statements: `
          CREATE OR REPLACE TABLE test_construction AS SELECT 
            ST_Point(1, 2) as p1,
            ST_MakePoint(3, 4) as p2,
            ST_Point2D(5, 6) as p2d,
            ST_Point3D(1, 2, 3) as p3d,
            ST_Point4D(1, 2, 3, 4) as p4d,
            ST_GeomFromText('POINT(10 20)') as from_text,
            ST_GeomFromGeoJSON('{"type":"Point","coordinates":[30,40]}') as from_json,
            ST_MakeEnvelope(0, 0, 10, 10) as envelope,
            ST_TileEnvelope(2, 3, 1) as tile_env
        `
            });

            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: 'SELECT * FROM test_construction'
            });

            const row = result.values[0];
            assert(row.p1 !== null, 'ST_Point');
            assert(row.p2 !== null, 'ST_MakePoint');
            assert(row.p2d !== null, 'ST_Point2D');
            assert(row.p3d !== null, 'ST_Point3D');
            assert(row.p4d !== null, 'ST_Point4D');
            assert(row.from_text !== null, 'ST_GeomFromText');
            assert(row.from_json !== null, 'ST_GeomFromGeoJSON');
            assert(row.envelope !== null, 'ST_MakeEnvelope');
            assert(row.tile_env !== null, 'ST_TileEnvelope');
        }
    });

    // 2. Conversion & Export
    testRegistry.registerTest(GROUP, {
        name: 'Conversion & Export',
        description: 'Test ST_AsText, ST_AsGeoJSON, ST_AsWKB, ST_AsHEXWKB, ST_AsSVG',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
          SELECT 
            ST_AsText(ST_Point(1, 2)) as wkt,
            ST_AsGeoJSON(ST_Point(1, 2)) as geojson,
            ST_AsHEXWKB(ST_Point(1, 2)) as hexwkb,
            ST_AsSVG(ST_Point(1, 2), false, 0) as svg
        `
            });

            const row = result.values[0];
            assertEqual(row.wkt, 'POINT (1 2)', 'ST_AsText');
            assert(row.geojson.includes('"type":"Point"'), 'ST_AsGeoJSON');
            assert(typeof row.hexwkb === 'string', 'ST_AsHEXWKB');
            assert(row.svg.includes('cx="1" cy="-2"'), 'ST_AsSVG');
        }
    });

    // 3. Properties
    testRegistry.registerTest(GROUP, {
        name: 'Geometry Properties',
        description: 'Test dimensions, validity, emptiness, coordinates, etc.',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
          SELECT 
            ST_Dimension(ST_Point(0,0)) as dim_point,
            ST_Dimension(ST_MakeLine(ST_Point(0,0), ST_Point(1,1))) as dim_line,
            ST_GeometryType(ST_Point(0,0)) as type,
            ST_IsEmpty(ST_GeomFromText('POINT EMPTY')) as is_empty,
            ST_IsSimple(ST_Point(0,0)) as is_simple,
            ST_IsValid(ST_Point(0,0)) as is_valid,
            ST_IsClosed(ST_MakeLine([ST_Point(0,0), ST_Point(1,0), ST_Point(0,0)])) as is_closed,
            ST_IsRing(ST_MakeLine([ST_Point(0,0), ST_Point(1,0), ST_Point(0,0)])) as is_ring,
            ST_NPoints(ST_MakeLine(ST_Point(0,0), ST_Point(1,1))) as n_points,
            ST_X(ST_Point(1, 2)) as x,
            ST_Y(ST_Point(1, 2)) as y,
            ST_Z(ST_Point3D(1, 2, 3)) as z,
            ST_M(ST_Point4D(1, 2, 3, 4)) as m,
            ST_HasZ(ST_Point3D(1, 2, 3)) as has_z,
            ST_HasM(ST_Point4D(1, 2, 3, 4)) as has_m
        `
            });

            const row = result.values[0];
            assertEqual(row.dim_point, 0, 'Dimension Point');
            assertEqual(row.dim_line, 1, 'Dimension Line');
            assertEqual(row.type, 'POINT', 'Geometry Type');
            assertEqual(row.is_empty, true, 'Is Empty');
            assertEqual(row.is_simple, true, 'Is Simple');
            assertEqual(row.is_valid, true, 'Is Valid');
            assertEqual(row.is_closed, true, 'Is Closed');
            assertEqual(row.is_ring, true, 'Is Ring');
            assertEqual(row.n_points, 2, 'N Points');
            assertEqual(row.x, 1, 'X');
            assertEqual(row.y, 2, 'Y');
            assertEqual(row.z, 3, 'Z');
            assertEqual(row.m, 4, 'M');
            assertEqual(row.has_z, true, 'Has Z');
            assertEqual(row.has_m, true, 'Has M');
        }
    });

    // 4. Predicates
    testRegistry.registerTest(GROUP, {
        name: 'Spatial Predicates',
        description: 'Test Contains, Intersects, Disjoint, etc.',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
          SELECT 
            ST_Contains(ST_Buffer(ST_Point(0,0), 2), ST_Point(0,0)) as contains,
            ST_ContainsProperly(ST_Buffer(ST_Point(0,0), 2), ST_Point(0,0)) as contains_properly,
            ST_Covers(ST_Buffer(ST_Point(0,0), 2), ST_Point(0,0)) as covers,
            ST_CoveredBy(ST_Point(0,0), ST_Buffer(ST_Point(0,0), 2)) as covered_by,
            ST_Crosses(ST_GeomFromText('LINESTRING(0 0, 2 2)'), ST_GeomFromText('LINESTRING(0 2, 2 0)')) as crosses,
            ST_Disjoint(ST_Point(0,0), ST_Point(10,10)) as disjoint,
            ST_Equals(ST_Point(1,1), ST_Point(1,1)) as equals,
            ST_Intersects(ST_Point(0,0), ST_Buffer(ST_Point(0,0), 1)) as intersects,
            ST_Overlaps(ST_GeomFromText('POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))'), ST_GeomFromText('POLYGON((1 1, 3 1, 3 3, 1 3, 1 1))')) as overlaps,
            ST_Touches(ST_GeomFromText('POINT(1 1)'), ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))')) as touches,
            ST_Within(ST_Point(0,0), ST_Buffer(ST_Point(0,0), 2)) as within,
            ST_DWithin(ST_Point(0,0), ST_Point(0,1), 2) as dwithin
        `
            });

            const row = result.values[0];
            assertEqual(row.contains, true, 'Contains');
            assertEqual(row.contains_properly, true, 'Contains Properly');
            assertEqual(row.covers, true, 'Covers');
            assertEqual(row.covered_by, true, 'Covered By');
            assertEqual(row.crosses, true, 'Crosses');
            assertEqual(row.disjoint, true, 'Disjoint');
            assertEqual(row.equals, true, 'Equals');
            assertEqual(row.intersects, true, 'Intersects');
            assertEqual(row.overlaps, true, 'Overlaps');
            assertEqual(row.touches, true, 'Touches');
            assertEqual(row.within, true, 'Within');
            assertEqual(row.dwithin, true, 'DWithin');
        }
    });

    // 5. Measurements
    testRegistry.registerTest(GROUP, {
        name: 'Measurements',
        description: 'Test Area, Length, Distance, Perimeter',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
          SELECT 
            ST_Area(ST_MakeEnvelope(0,0,10,10)) as area,
            ST_Length(ST_MakeLine(ST_Point(0,0), ST_Point(0,10))) as length,
            ST_Perimeter(ST_MakeEnvelope(0,0,10,10)) as perimeter,
            ST_Distance(ST_Point(0,0), ST_Point(3,4)) as distance
        `
            });

            const row = result.values[0];
            assertEqual(row.area, 100.0, 'Area');
            assertEqual(row.length, 10.0, 'Length');
            assertEqual(row.perimeter, 40.0, 'Perimeter');
            assertEqual(row.distance, 5.0, 'Distance');
        }
    });

    // 6. Operations & Transformations
    testRegistry.registerTest(GROUP, {
        name: 'Operations & Transformations',
        description: 'Test Buffer, Centroid, Union, Intersection, Transform, etc.',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
          SELECT 
            ST_GeometryType(ST_Buffer(ST_Point(0,0), 1)) as buffer_type,
            ST_AsText(ST_Centroid(ST_MakeEnvelope(0,0,10,10))) as centroid,
            ST_AsText(ST_Boundary(ST_MakeEnvelope(0,0,10,10))) as boundary,
            ST_AsText(ST_ConvexHull(ST_Collect([ST_Point(0,0), ST_Point(0,10), ST_Point(10,0)]))) as convex_hull,
            ST_AsText(ST_Envelope(ST_MakeLine(ST_Point(0,0), ST_Point(10,10)))) as envelope,
            ST_AsText(ST_Intersection(ST_MakeEnvelope(0,0,5,5), ST_MakeEnvelope(2,2,7,7))) as intersection,
            ST_AsText(ST_Union(ST_Point(0,0), ST_Point(1,1))) as union_geom,
            ST_AsText(ST_Difference(ST_MakeEnvelope(0,0,10,10), ST_MakeEnvelope(2,2,8,8))) as difference,
            ST_AsText(ST_FlipCoordinates(ST_Point(1,2))) as flipped,
            ST_AsText(ST_Reverse(ST_MakeLine(ST_Point(0,0), ST_Point(1,1)))) as reversed,
            ST_AsText(ST_Simplify(ST_MakeLine([ST_Point(0,0), ST_Point(1,0.1), ST_Point(2,0)]), 0.5)) as simplified
        `
            });

            const row = result.values[0];
            assertEqual(row.buffer_type, 'POLYGON', 'Buffer Type');
            assertEqual(row.centroid, 'POINT (5 5)', 'Centroid');
            assert(row.boundary.startsWith('POLYGON'), 'Boundary');
            assert(row.convex_hull.startsWith('POLYGON'), 'Convex Hull');
            assert(row.envelope.startsWith('POLYGON'), 'Envelope');
            assert(row.intersection.startsWith('POLYGON'), 'Intersection');
            assert(row.union_geom.startsWith('MULTIPOINT'), 'Union');
            assert(row.difference.startsWith('POLYGON'), 'Difference');
            assertEqual(row.flipped, 'POINT (2 1)', 'Flip Coordinates');
            assertEqual(row.reversed, 'LINESTRING (1 1, 0 0)', 'Reverse');
            assertEqual(row.simplified, 'LINESTRING (0 0, 2 0)', 'Simplify');
        }
    });

    // 7. Misc Functions
    testRegistry.registerTest(GROUP, {
        name: 'Misc Functions',
        description: 'Test Hilbert, QuadKey, etc.',
        testFn: async () => {
            const result = await CapacitorDuckDb.query({
                database: DB_NAME,
                statement: `
          SELECT 
            ST_QuadKey(ST_Point(11.08, 49.45), 10) as quadkey,
            ST_Extent(ST_Point(1,1)) as extent
        `
            });

            const row = result.values[0];
            assert(typeof row.quadkey === 'string', 'QuadKey');
            assert(row.extent !== null, 'Extent');
        }
    });
};
