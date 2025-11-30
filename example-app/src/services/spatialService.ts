/**
 * Spatial Demo Service
 * 
 * Manages DuckDB spatial extension verification, table creation,
 * and seeding with Natural Earth data for demos.
 * 
 * When using the pre-populated demo database (demo.duckdb), data is already
 * seeded at build time and copied from assets on first launch.
 */

import type { FeatureCollection, Geometry } from 'geojson';

import { duckdb, DEMO_DB } from './duckdb';
import settingsService from './settingsService';
import naturalEarth, { 
  geometryToWkt, 
  type CountryFeature,
  type CityFeature,
  type RiverFeature,
  type LakeFeature,
  type AirportFeature,
} from '../data/naturalEarth';

// Database name for spatial demo - use unified demo database
export const SPATIAL_DB = DEMO_DB;

// ============================================================================
// Types
// ============================================================================

export interface SpatialVersion {
  version: string;
  geos: string;
  proj: string;
  loaded: boolean;
}

export interface UserDrawing {
  id: number;
  name: string;
  geometry_type: string;
  geometry_wkt: string;
  created_at: string;
  properties?: Record<string, unknown>;
}

export interface SpatialStats {
  version: SpatialVersion;
  userDrawings: number;
  countries: number;
  cities: number;
  airports: number;
  rivers: number;
  lakes: number;
  dataSeeded: boolean;
}

export type LayerName = 'countries' | 'cities' | 'airports' | 'rivers' | 'lakes';

// New comprehensive layer types for 10m data
export interface LayerInfo {
  id: number;
  name: string;
  tableName: string;
  displayName: string;
  category: string;
  geometryType: string;
  description: string;
  featureCount: number;
  enabledByDefault: boolean;
  styleColor: string;
  styleWeight: number;
  styleOpacity: number;
  minZoom: number;
  maxZoom: number;
}

export interface LayerQueryOptions {
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  maxFeatures?: number;
}

// ============================================================================
// Spatial Extension Verification
// ============================================================================

/**
 * Check if the spatial extension is loaded and get version info
 * 
 * Note: We cannot use duckdb_extensions() on Android because it requires
 * home_directory to be set. Instead, we verify spatial by calling actual
 * spatial functions which work independently.
 */
export async function checkSpatialExtension(): Promise<SpatialVersion> {
  try {
    console.log('[SpatialService] Checking spatial extension availability...');
    
    // First, try to explicitly load the spatial extension
    // For statically-linked extensions, LOAD should work without needing to download
    try {
      console.log('[SpatialService] Attempting to LOAD spatial extension...');
      await duckdb.execute(SPATIAL_DB, `LOAD spatial;`);
      console.log('[SpatialService] LOAD spatial succeeded');
    } catch (loadError) {
      // This is expected if spatial is already loaded or if it's statically linked
      // The important thing is that spatial functions work
      console.log('[SpatialService] LOAD spatial note:', loadError);
    }
    
    // Verify spatial is available by calling a simple function
    // This is more reliable than checking duckdb_extensions() which requires home_directory
    console.log('[SpatialService] Trying ST_Point() to verify spatial is available...');
    const testResult = await duckdb.query<{ test: string }>(
      SPATIAL_DB,
      `SELECT ST_AsText(ST_Point(0, 0)) as test;`
    );
    console.log('[SpatialService] ST_Point test result:', JSON.stringify(testResult.values));
    
    if (!testResult.values[0] || testResult.values[0].test !== 'POINT (0 0)') {
      throw new Error('Spatial function did not return expected result');
    }
    
    // Try to get the core DuckDB version since ST_Version() is not available
    let version = 'available';
    try {
      const versionResult = await duckdb.query<{ version: string }>(
        SPATIAL_DB,
        `SELECT version() as version;`
      );
      version = versionResult.values[0]?.version || 'available';
      console.log('[SpatialService] DuckDB version result:', version);
    } catch (versionError) {
      console.log('[SpatialService] version() not available, using default', versionError);
    }
    
    // Try to get GEOS and PROJ versions (may not always be available)
    // DuckDB's spatial extension currently does not expose ST_GEOSVersion(), so we
    // skip querying it to avoid noisy errors in native logs.
    const geos = 'not exposed';
    let proj = 'unknown';
    
    try {
      const projResult = await duckdb.query<{ version: string }>(
        SPATIAL_DB,
        `SELECT DuckDB_PROJ_Compiled_Version() as version;`
      );
      proj = projResult.values[0]?.version || 'unknown';
    } catch {
      // PROJ version function may not exist in all builds
    }
    
    return {
      version,
      geos,
      proj,
      loaded: true,
    };
  } catch (error) {
    console.error('[SpatialService] Failed to verify spatial extension:', error);
    console.error('[SpatialService] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return {
      version: 'not available',
      geos: 'not available',
      proj: 'not available',
      loaded: false,
    };
  }
}

// ============================================================================
// Table Management
// ============================================================================

/**
 * Create all tables for the spatial demo
 */
export async function createSpatialTables(): Promise<void> {
  // User drawings table - for user-created geometries
  await duckdb.execute(SPATIAL_DB, `
    CREATE TABLE IF NOT EXISTS user_drawings (
      id INTEGER PRIMARY KEY,
      name VARCHAR NOT NULL,
      geometry_type VARCHAR NOT NULL,
      geometry GEOMETRY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      properties JSON
    );
  `);
  
  // Create sequence for user drawings if not exists
  await duckdb.execute(SPATIAL_DB, `
    CREATE SEQUENCE IF NOT EXISTS user_drawings_seq START 1;
  `);
  
  // Countries table
  await duckdb.execute(SPATIAL_DB, `
    CREATE TABLE IF NOT EXISTS ne_countries (
      id INTEGER PRIMARY KEY,
      name VARCHAR NOT NULL,
      name_long VARCHAR,
      iso_a3 VARCHAR(3),
      iso_a2 VARCHAR(2),
      continent VARCHAR,
      subregion VARCHAR,
      pop_est BIGINT,
      gdp_md DOUBLE,
      geometry GEOMETRY
    );
  `);
  
  // Cities table
  await duckdb.execute(SPATIAL_DB, `
    CREATE TABLE IF NOT EXISTS ne_cities (
      id INTEGER PRIMARY KEY,
      name VARCHAR NOT NULL,
      country VARCHAR,
      admin1 VARCHAR,
      latitude DOUBLE,
      longitude DOUBLE,
      population BIGINT,
      rank INTEGER,
      timezone VARCHAR,
      geometry GEOMETRY
    );
  `);
  
  // Airports table
  await duckdb.execute(SPATIAL_DB, `
    CREATE TABLE IF NOT EXISTS ne_airports (
      id INTEGER PRIMARY KEY,
      name VARCHAR NOT NULL,
      abbrev VARCHAR,
      type VARCHAR,
      iata_code VARCHAR(3),
      gps_code VARCHAR,
      location VARCHAR,
      geometry GEOMETRY
    );
  `);
  
  // Rivers table
  await duckdb.execute(SPATIAL_DB, `
    CREATE TABLE IF NOT EXISTS ne_rivers (
      id INTEGER PRIMARY KEY,
      name VARCHAR,
      scalerank INTEGER,
      geometry GEOMETRY
    );
  `);
  
  // Lakes table
  await duckdb.execute(SPATIAL_DB, `
    CREATE TABLE IF NOT EXISTS ne_lakes (
      id INTEGER PRIMARY KEY,
      name VARCHAR,
      scalerank INTEGER,
      geometry GEOMETRY
    );
  `);
}

// ============================================================================
// Data Seeding
// ============================================================================

/**
 * Check if data has already been seeded
 */
export async function isDataSeeded(): Promise<boolean> {
  try {
    const result = await duckdb.query<{ count: number }>(
      SPATIAL_DB,
      `SELECT COUNT(*) as count FROM ne_countries;`
    );
    return (result.values[0]?.count || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Seed countries data from Natural Earth
 */
async function seedCountries(): Promise<number> {
  const countries = naturalEarth.countries();
  let count = 0;
  
  // Process in batches for better performance
  const batchSize = 20;
  const features = countries.features;
  
  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize);
    
    for (const feature of batch) {
      try {
        const props = feature.properties;
        const wkt = geometryToWkt(feature.geometry);
        
        await duckdb.run(
          SPATIAL_DB,
          `INSERT INTO ne_countries (id, name, name_long, iso_a3, iso_a2, continent, subregion, pop_est, gdp_md, geometry)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_GeomFromText($10::VARCHAR));`,
          [
            count + 1,
            props.NAME || 'Unknown',
            props.NAME_LONG || props.NAME || 'Unknown',
            props.ISO_A3 || '',
            props.ISO_A2 || '',
            props.CONTINENT || '',
            props.SUBREGION || '',
            props.POP_EST || 0,
            props.GDP_MD || 0,
            wkt,
          ]
        );
        count++;
      } catch (error) {
        console.warn(`Failed to insert country: ${(feature as CountryFeature).properties.NAME}`, error);
      }
    }
  }
  
  return count;
}

/**
 * Seed cities data from Natural Earth
 */
async function seedCities(): Promise<number> {
  const cities = naturalEarth.cities();
  let count = 0;
  
  const batchSize = 50;
  const features = cities.features;
  
  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize);
    
    for (const feature of batch) {
      try {
        const props = feature.properties;
        const coords = feature.geometry.coordinates as [number, number];
        const wkt = `POINT(${coords[0]} ${coords[1]})`;
        
        await duckdb.run(
          SPATIAL_DB,
          `INSERT INTO ne_cities (id, name, country, admin1, latitude, longitude, population, rank, timezone, geometry)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_GeomFromText($10::VARCHAR));`,
          [
            count + 1,
            props.NAME || 'Unknown',
            props.ADM0NAME || '',
            props.ADM1NAME || '',
            props.LATITUDE || coords[1],
            props.LONGITUDE || coords[0],
            props.POP_MAX || 0,
            props.RANK_MAX || 0,
            props.TIMEZONE || '',
            wkt,
          ]
        );
        count++;
      } catch (error) {
        console.warn(`Failed to insert city: ${(feature as CityFeature).properties.NAME}`, error);
      }
    }
  }
  
  return count;
}

/**
 * Seed airports data from Natural Earth
 */
async function seedAirports(): Promise<number> {
  const airports = naturalEarth.airports();
  let count = 0;
  
  const batchSize = 50;
  const features = airports.features;
  
  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize);
    
    for (const feature of batch) {
      try {
        const props = feature.properties;
        const coords = feature.geometry.coordinates as [number, number];
        const wkt = `POINT(${coords[0]} ${coords[1]})`;
        
        await duckdb.run(
          SPATIAL_DB,
          `INSERT INTO ne_airports (id, name, abbrev, type, iata_code, gps_code, location, geometry)
           VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8::VARCHAR));`,
          [
            count + 1,
            props.name || 'Unknown',
            props.abbrev || '',
            props.type || '',
            props.iata_code || '',
            props.gps_code || '',
            props.location || '',
            wkt,
          ]
        );
        count++;
      } catch (error) {
        console.warn(`Failed to insert airport: ${(feature as AirportFeature).properties.name}`, error);
      }
    }
  }
  
  return count;
}

/**
 * Seed rivers data from Natural Earth
 */
async function seedRivers(): Promise<number> {
  const rivers = naturalEarth.rivers();
  let count = 0;
  
  for (const feature of rivers.features) {
    try {
      const props = feature.properties;
      const wkt = geometryToWkt(feature.geometry);
      
      await duckdb.run(
        SPATIAL_DB,
        `INSERT INTO ne_rivers (id, name, scalerank, geometry)
         VALUES ($1, $2, $3, ST_GeomFromText($4::VARCHAR));`,
        [
          count + 1,
          props.name || 'Unknown River',
          props.scalerank || 0,
          wkt,
        ]
      );
      count++;
    } catch (error) {
      console.warn(`Failed to insert river: ${(feature as RiverFeature).properties.name}`, error);
    }
  }
  
  return count;
}

/**
 * Seed lakes data from Natural Earth
 */
async function seedLakes(): Promise<number> {
  const lakes = naturalEarth.lakes();
  let count = 0;
  
  for (const feature of lakes.features) {
    try {
      const props = feature.properties;
      const wkt = geometryToWkt(feature.geometry);
      
      await duckdb.run(
        SPATIAL_DB,
        `INSERT INTO ne_lakes (id, name, scalerank, geometry)
         VALUES ($1, $2, $3, ST_GeomFromText($4::VARCHAR));`,
        [
          count + 1,
          props.name || 'Unknown Lake',
          props.scalerank || 0,
          wkt,
        ]
      );
      count++;
    } catch (error) {
      console.warn(`Failed to insert lake: ${(feature as LakeFeature).properties.name}`, error);
    }
  }
  
  return count;
}

/**
 * Seed all Natural Earth data into DuckDB
 */
export async function seedNaturalEarthData(
  onProgress?: (message: string, percent: number) => void
): Promise<{ countries: number; cities: number; airports: number; rivers: number; lakes: number }> {
  const progress = onProgress || (() => {});
  
  progress('Seeding countries...', 0);
  const countries = await seedCountries();
  
  progress('Seeding cities...', 20);
  const cities = await seedCities();
  
  progress('Seeding airports...', 50);
  const airports = await seedAirports();
  
  progress('Seeding rivers...', 75);
  const rivers = await seedRivers();
  
  progress('Seeding lakes...', 90);
  const lakes = await seedLakes();
  
  progress('Complete!', 100);
  
  return { countries, cities, airports, rivers, lakes };
}

// ============================================================================
// User Drawings CRUD
// ============================================================================

/**
 * Save a user-drawn geometry
 */
export async function saveUserDrawing(
  name: string,
  geometryType: string,
  wkt: string,
  properties?: Record<string, unknown>
): Promise<number> {
  const result = await duckdb.query<{ id: number }>(
    SPATIAL_DB,
    `INSERT INTO user_drawings (id, name, geometry_type, geometry, properties)
     VALUES (nextval('user_drawings_seq'), $1, $2, ST_GeomFromText($3::VARCHAR), $4)
     RETURNING id;`,
    [name, geometryType, wkt, properties ? JSON.stringify(properties) : null]
  );
  return result.values[0]?.id || 0;
}

/**
 * Get all user drawings
 */
export async function getUserDrawings(): Promise<UserDrawing[]> {
  const result = await duckdb.query<{
    id: number;
    name: string;
    geometry_type: string;
    geometry_wkt: string;
    created_at: string;
    properties: string | null;
  }>(
    SPATIAL_DB,
    `SELECT id, name, geometry_type, ST_AsText(geometry) as geometry_wkt, 
            created_at::VARCHAR as created_at, properties::VARCHAR as properties
     FROM user_drawings
     ORDER BY created_at DESC;`
  );
  
  return result.values.map(row => ({
    ...row,
    properties: row.properties ? JSON.parse(row.properties) : undefined,
  }));
}

/**
 * Delete a user drawing by ID
 */
export async function deleteUserDrawing(id: number): Promise<void> {
  await duckdb.run(SPATIAL_DB, `DELETE FROM user_drawings WHERE id = $1;`, [id]);
}

/**
 * Update a user drawing's name
 */
export async function updateUserDrawingName(id: number, name: string): Promise<void> {
  await duckdb.run(SPATIAL_DB, `UPDATE user_drawings SET name = $1 WHERE id = $2;`, [name, id]);
}

// ============================================================================
// Spatial Statistics
// ============================================================================

/**
 * Get comprehensive spatial stats for the demo
 */
export async function getSpatialStats(): Promise<SpatialStats> {
  const version = await checkSpatialExtension();
  
  if (!version.loaded) {
    return {
      version,
      userDrawings: 0,
      countries: 0,
      cities: 0,
      airports: 0,
      rivers: 0,
      lakes: 0,
      dataSeeded: false,
    };
  }
  
  const counts = await duckdb.query<{
    user_drawings: number;
    countries: number;
    cities: number;
    airports: number;
    rivers: number;
    lakes: number;
  }>(
    SPATIAL_DB,
    `SELECT 
      (SELECT COUNT(*) FROM user_drawings) as user_drawings,
      (SELECT COUNT(*) FROM ne_countries) as countries,
      (SELECT COUNT(*) FROM ne_cities) as cities,
      (SELECT COUNT(*) FROM ne_airports) as airports,
      (SELECT COUNT(*) FROM ne_rivers) as rivers,
      (SELECT COUNT(*) FROM ne_lakes) as lakes;`
  );
  
  const row = counts.values[0];
  
  return {
    version,
    userDrawings: row?.user_drawings || 0,
    countries: row?.countries || 0,
    cities: row?.cities || 0,
    airports: row?.airports || 0,
    rivers: row?.rivers || 0,
    lakes: row?.lakes || 0,
    dataSeeded: (row?.countries || 0) > 0,
  };
}

// ============================================================================
// Layer Registry Functions (for 10m comprehensive data)
// ============================================================================

/**
 * Get all available layers from the layer_registry table
 */
export async function getAvailableLayers(): Promise<LayerInfo[]> {
  try {
    const result = await duckdb.query<{
      id: number;
      name: string;
      table_name: string;
      display_name: string;
      category: string;
      geometry_type: string;
      description: string;
      feature_count: number;
      enabled_by_default: boolean;
      style_color: string;
      style_weight: number;
      style_opacity: number;
      min_zoom: number;
      max_zoom: number;
    }>(
      SPATIAL_DB,
      `SELECT id, name, table_name, display_name, category, geometry_type, 
              description, feature_count, enabled_by_default, style_color,
              style_weight, style_opacity, min_zoom, max_zoom
       FROM layer_registry
       WHERE feature_count > 0
       ORDER BY category, display_name;`
    );

    return result.values.map(row => ({
      id: row.id,
      name: row.name,
      tableName: row.table_name,
      displayName: row.display_name,
      category: row.category,
      geometryType: row.geometry_type,
      description: row.description,
      featureCount: row.feature_count,
      enabledByDefault: row.enabled_by_default,
      styleColor: row.style_color,
      styleWeight: row.style_weight,
      styleOpacity: row.style_opacity,
      minZoom: row.min_zoom,
      maxZoom: row.max_zoom,
    }));
  } catch (error) {
    console.warn('[SpatialService] layer_registry not found, using legacy layers');
    // Return empty if registry doesn't exist (legacy database)
    return [];
  }
}

/**
 * Get layers grouped by category
 */
export async function getLayersByCategory(): Promise<Record<string, LayerInfo[]>> {
  const layers = await getAvailableLayers();
  return layers.reduce((acc, layer) => {
    if (!acc[layer.category]) {
      acc[layer.category] = [];
    }
    acc[layer.category].push(layer);
    return acc;
  }, {} as Record<string, LayerInfo[]>);
}

/**
 * Get GeoJSON for any layer by name (dynamic query)
 * Uses ST_Intersects for proper spatial filtering on all geometry types
 */
export async function getDynamicLayerGeoJSON(
  layerName: string, 
  options?: LayerQueryOptions
): Promise<FeatureCollection> {
  // First get the layer info from registry
  const layers = await getAvailableLayers();
  const layerInfo = layers.find(l => l.name === layerName);
  
  if (!layerInfo) {
    // Fall back to legacy layer handling
    if (['countries', 'cities', 'airports', 'rivers', 'lakes'].includes(layerName)) {
      return getLayerGeoJSON(layerName as LayerName, options);
    }
    return { type: 'FeatureCollection', features: [] };
  }

  const tableName = layerInfo.tableName;
  
  // Get limits from settings (with fallback defaults)
  const settings = await settingsService.getSettings();
  const limits = settings.mapLayerLimits;
  
  // Determine appropriate limit based on layer type
  // Bathymetry and other heavy polygon layers need strict limits
  let maxFeatures = options?.maxFeatures || 5000;
  const layerNameLower = layerName.toLowerCase();
  if (layerNameLower.includes('bathymetry') || layerNameLower.includes('ocean')) {
    maxFeatures = Math.min(maxFeatures, limits.bathymetry);
  } else if (layerInfo.geometryType === 'Polygon' || layerInfo.geometryType === 'MultiPolygon') {
    maxFeatures = Math.min(maxFeatures, limits.polygons);
  } else if (layerInfo.geometryType === 'LineString' || layerInfo.geometryType === 'MultiLineString') {
    maxFeatures = Math.min(maxFeatures, limits.lines);
  } else if (layerInfo.geometryType === 'Point' || layerInfo.geometryType === 'MultiPoint') {
    maxFeatures = Math.min(maxFeatures, limits.points);
  }

  // Build WHERE clause with spatial filter
  let whereClause = '';
  if (options?.bbox) {
    const [minLon, minLat, maxLon, maxLat] = options.bbox;
    // Use ST_Intersects with ST_MakeEnvelope for proper spatial filtering
    whereClause = `WHERE ST_Intersects(geometry, ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}))`;
  }

  // Get all columns except geometry, then add geometry as GeoJSON
  const sql = `
    SELECT *, ST_AsGeoJSON(geometry) AS geometry_geojson
    FROM ${tableName}
    ${whereClause}
    LIMIT ${maxFeatures};
  `;

  console.log(`[SpatialService] Query for ${layerName}: limit=${maxFeatures}, bbox=${options?.bbox ? 'yes' : 'no'}`);

  try {
    const result = await duckdb.query<Record<string, unknown>>(SPATIAL_DB, sql);

    const features = result.values
      .filter(row => row.geometry_geojson)
      .map(row => {
        const geometry = JSON.parse(String(row.geometry_geojson)) as Geometry;
        const { geometry_geojson, geometry: _geom, ...properties } = row;
        return {
          type: 'Feature' as const,
          id: row.id as number | string | undefined,
          properties,
          geometry,
        };
      });
    
    console.log(`[SpatialService] ${layerName}: returned ${features.length} features`);
    return { type: 'FeatureCollection', features };
  } catch (error) {
    console.error(`[SpatialService] Error querying layer ${layerName}:`, error);
    return { type: 'FeatureCollection', features: [] };
  }
}

// ============================================================================
// GeoJSON Export Helpers
// ============================================================================

interface LayerConfig {
  table: string;
  idColumn: string;
  propertyColumns: string[];
}

const LAYER_CONFIGS: Record<LayerName, LayerConfig> = {
  countries: {
    table: 'ne_countries',
    idColumn: 'id',
    propertyColumns: ['name', 'name_long', 'iso_a3', 'iso_a2', 'continent', 'subregion', 'pop_est', 'gdp_md'],
  },
  cities: {
    table: 'ne_cities',
    idColumn: 'id',
    propertyColumns: ['name', 'country', 'admin1', 'latitude', 'longitude', 'population', 'rank', 'timezone'],
  },
  airports: {
    table: 'ne_airports',
    idColumn: 'id',
    propertyColumns: ['name', 'abbrev', 'type', 'iata_code', 'gps_code', 'location'],
  },
  rivers: {
    table: 'ne_rivers',
    idColumn: 'id',
    propertyColumns: ['name', 'scalerank'],
  },
  lakes: {
    table: 'ne_lakes',
    idColumn: 'id',
    propertyColumns: ['name', 'scalerank'],
  },
};

function rowsToFeatureCollection(rows: Record<string, unknown>[], config: LayerConfig): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((row) => row.geometry_geojson)
      .map((row) => {
        const geometry = JSON.parse(String(row.geometry_geojson)) as Geometry;
        const idValue = row[config.idColumn];
        const featureId = typeof idValue === 'string' || typeof idValue === 'number' ? idValue : undefined;
        const properties = config.propertyColumns.reduce<Record<string, unknown>>((acc, column) => {
          acc[column] = row[column];
          return acc;
        }, {});
        return {
          type: 'Feature',
          id: featureId,
          properties,
          geometry,
        };
      }),
  } satisfies FeatureCollection;
}

export async function getLayerGeoJSON(layer: LayerName, options?: LayerQueryOptions): Promise<FeatureCollection> {
  const config = LAYER_CONFIGS[layer];
  const columns = [config.idColumn, ...config.propertyColumns];
  const where: string[] = [];
  const params: unknown[] = [];

  const addParam = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (options?.bbox) {
    const [minLon, minLat, maxLon, maxLat] = options.bbox;
    
    // Use layer-specific filtering strategies based on available columns
    // to avoid relying on spatial functions that may not be available
    if (layer === 'cities' || layer === 'airports') {
      // These tables have explicit latitude/longitude columns - use those directly
      where.push(
        `longitude >= ${addParam(minLon)} AND longitude <= ${addParam(maxLon)} AND latitude >= ${addParam(minLat)} AND latitude <= ${addParam(maxLat)}`
      );
    }
    // For countries, rivers, lakes - skip bbox filter since:
    // - countries is small (~200 rows), fetch all
    // - rivers/lakes are complex geometries; without working spatial functions
    //   we'd need to add computed min/max columns during seeding
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let limitClause = '';
  if (typeof options?.maxFeatures === 'number' && options.maxFeatures > 0) {
    const limit = Math.max(1, Math.floor(options.maxFeatures));
    limitClause = `LIMIT ${limit}`;
  }

  const sql = `
    SELECT ${columns.join(', ')}, ST_AsGeoJSON(geometry) AS geometry_geojson
    FROM ${config.table}
    ${whereClause}
    ${limitClause};
  `;
  const values = params.length ? params : undefined;
  const result = await duckdb.query<Record<string, unknown>>(SPATIAL_DB, sql, values);
  return rowsToFeatureCollection(result.values || [], config);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the spatial demo database
 * - Opens database
 * - Verifies spatial extension
 * - Creates tables
 * - Seeds data if not already seeded
 */
export async function initializeSpatialDemo(
  onProgress?: (message: string, percent: number) => void
): Promise<SpatialStats> {
  const progress = onProgress || (() => {});
  
  progress('Opening database...', 5);
  await duckdb.openDatabase(SPATIAL_DB);
  
  progress('Checking spatial extension...', 10);
  const version = await checkSpatialExtension();
  
  if (!version.loaded) {
    throw new Error('Spatial extension is not available. Please rebuild DuckDB with --spatial flag.');
  }
  
  progress('Creating tables...', 15);
  await createSpatialTables();
  
  progress('Checking if data is seeded...', 20);
  const seeded = await isDataSeeded();
  
  if (!seeded) {
    progress('Seeding Natural Earth data...', 25);
    await seedNaturalEarthData((msg, pct) => {
      // Map 0-100 to 25-95
      progress(msg, 25 + (pct * 0.7));
    });
  }
  
  progress('Getting stats...', 98);
  const stats = await getSpatialStats();
  
  progress('Ready!', 100);
  return stats;
}

// Export a singleton-like interface
export const spatialService = {
  SPATIAL_DB,
  initialize: initializeSpatialDemo,
  checkExtension: checkSpatialExtension,
  createTables: createSpatialTables,
  seedData: seedNaturalEarthData,
  isSeeded: isDataSeeded,
  getStats: getSpatialStats,
  getLayerGeoJSON,
  // Dynamic layer support (10m comprehensive data)
  getAvailableLayers,
  getLayersByCategory,
  getDynamicLayerGeoJSON,
  // User drawings
  saveDrawing: saveUserDrawing,
  getDrawings: getUserDrawings,
  deleteDrawing: deleteUserDrawing,
  updateDrawingName: updateUserDrawingName,
};

export default spatialService;
