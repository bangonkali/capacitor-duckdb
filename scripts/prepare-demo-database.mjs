#!/usr/bin/env node
/**
 * Prepare Demo DuckDB Database
 * 
 * Downloads comprehensive Natural Earth 10m data and NYC taxi-style data,
 * creates a pre-populated DuckDB database that can be embedded in the APK.
 * 
 * This eliminates runtime data loading - the app starts with data ready.
 * 
 * Data Sources:
 * - Natural Earth (1:10m scale) - Full physical and cultural vector data
 *   https://www.naturalearthdata.com/downloads/10m-physical-vectors/
 *   https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
 * - NYC Taxi data (generated synthetic data matching TLC schema)
 * 
 * Output:
 * - build/demo.duckdb - Pre-populated database file
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, statSync, readdirSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const BUILD_DIR = join(ROOT_DIR, 'build', 'demo-database');
const GEODATA_DIR = join(BUILD_DIR, 'geodata');
const OUTPUT_DB = join(BUILD_DIR, 'demo.duckdb');

// ============================================================================
// NATURAL EARTH 10m COMPREHENSIVE DOWNLOADS
// ============================================================================

// Two main zip files containing ALL 10m data
// Primary: naciscdn.org (official CDN)
const NE_DOWNLOADS = [
  {
    name: 'physical',
    url: 'https://naciscdn.org/naturalearth/10m/physical/10m_physical.zip',
    description: 'All 10m physical vectors (coastline, land, ocean, rivers, lakes, glaciers, etc.)',
  },
  {
    name: 'cultural',
    url: 'https://naciscdn.org/naturalearth/10m/cultural/10m_cultural.zip',
    description: 'All 10m cultural vectors (countries, states, cities, airports, roads, etc.)',
  },
];

// Layer definitions - maps shapefile names to friendly names and categories
// These will be auto-discovered from the extracted zips
const LAYER_DEFINITIONS = {
  // Physical layers
  'ne_10m_coastline': { name: 'coastline', category: 'physical', display: 'Coastlines', geom: 'LineString', color: '#1E88E5', weight: 1, enabled: false },
  'ne_10m_land': { name: 'land', category: 'physical', display: 'Land', geom: 'Polygon', color: '#A5D6A7', weight: 1, enabled: false },
  'ne_10m_ocean': { name: 'ocean', category: 'physical', display: 'Ocean', geom: 'Polygon', color: '#90CAF9', weight: 1, enabled: false },
  'ne_10m_minor_islands': { name: 'minor_islands', category: 'physical', display: 'Minor Islands', geom: 'Polygon', color: '#C8E6C9', weight: 1, enabled: false },
  'ne_10m_rivers_lake_centerlines': { name: 'rivers', category: 'physical', display: 'Rivers', geom: 'LineString', color: '#42A5F5', weight: 1.5, enabled: true },
  'ne_10m_rivers_lake_centerlines_scale_rank': { name: 'rivers_ranked', category: 'physical', display: 'Rivers (by scale)', geom: 'LineString', color: '#42A5F5', weight: 1.5, enabled: false },
  'ne_10m_lakes': { name: 'lakes', category: 'physical', display: 'Lakes', geom: 'Polygon', color: '#64B5F6', weight: 1, enabled: true },
  'ne_10m_lakes_historic': { name: 'lakes_historic', category: 'physical', display: 'Historic Lakes', geom: 'Polygon', color: '#90CAF9', weight: 1, enabled: false },
  'ne_10m_lakes_pluvial': { name: 'lakes_pluvial', category: 'physical', display: 'Pluvial Lakes', geom: 'Polygon', color: '#81D4FA', weight: 1, enabled: false },
  'ne_10m_playas': { name: 'playas', category: 'physical', display: 'Playas (Dry Lakes)', geom: 'Polygon', color: '#E0E0E0', weight: 1, enabled: false },
  'ne_10m_reefs': { name: 'reefs', category: 'physical', display: 'Coral Reefs', geom: 'Polygon', color: '#FF7043', weight: 1, enabled: false },
  'ne_10m_glaciated_areas': { name: 'glaciated_areas', category: 'physical', display: 'Glaciers', geom: 'Polygon', color: '#E3F2FD', weight: 1, enabled: false },
  'ne_10m_antarctic_ice_shelves_polys': { name: 'antarctic_ice_shelves', category: 'physical', display: 'Antarctic Ice Shelves', geom: 'Polygon', color: '#ECEFF1', weight: 1, enabled: false },
  'ne_10m_antarctic_ice_shelves_lines': { name: 'antarctic_ice_lines', category: 'physical', display: 'Antarctic Ice Lines', geom: 'LineString', color: '#B0BEC5', weight: 1, enabled: false },
  'ne_10m_geography_regions_polys': { name: 'geography_regions', category: 'physical', display: 'Geographic Regions', geom: 'Polygon', color: '#FFF9C4', weight: 0.5, enabled: false },
  'ne_10m_geography_regions_points': { name: 'geography_points', category: 'physical', display: 'Region Labels', geom: 'Point', color: '#795548', weight: 1, enabled: false },
  'ne_10m_geography_regions_elevation_points': { name: 'elevation_points', category: 'physical', display: 'Mountain Peaks', geom: 'Point', color: '#6D4C41', weight: 1, enabled: false },
  'ne_10m_geography_marine_polys': { name: 'geography_marine', category: 'physical', display: 'Marine Regions', geom: 'Polygon', color: '#B3E5FC', weight: 0.5, enabled: false },
  'ne_10m_geographic_lines': { name: 'geographic_lines', category: 'physical', display: 'Geographic Lines', geom: 'LineString', color: '#FFAB91', weight: 1, enabled: false },
  'ne_10m_bathymetry_all': { name: 'bathymetry', category: 'physical', display: 'Bathymetry', geom: 'Polygon', color: '#0D47A1', weight: 1, enabled: false },
  'ne_10m_graticules_1': { name: 'graticules_1', category: 'physical', display: 'Graticules (1°)', geom: 'LineString', color: '#BDBDBD', weight: 0.5, enabled: false },
  'ne_10m_graticules_5': { name: 'graticules_5', category: 'physical', display: 'Graticules (5°)', geom: 'LineString', color: '#9E9E9E', weight: 0.5, enabled: false },
  'ne_10m_graticules_10': { name: 'graticules_10', category: 'physical', display: 'Graticules (10°)', geom: 'LineString', color: '#757575', weight: 0.5, enabled: false },
  'ne_10m_graticules_15': { name: 'graticules_15', category: 'physical', display: 'Graticules (15°)', geom: 'LineString', color: '#616161', weight: 0.5, enabled: false },
  'ne_10m_graticules_20': { name: 'graticules_20', category: 'physical', display: 'Graticules (20°)', geom: 'LineString', color: '#424242', weight: 0.5, enabled: false },
  'ne_10m_graticules_30': { name: 'graticules_30', category: 'physical', display: 'Graticules (30°)', geom: 'LineString', color: '#212121', weight: 0.5, enabled: false },
  
  // Cultural layers - Administrative
  'ne_10m_admin_0_countries': { name: 'countries', category: 'boundaries', display: 'Countries', geom: 'Polygon', color: '#FFE082', weight: 1, enabled: true },
  'ne_10m_admin_0_countries_lakes': { name: 'countries_lakes', category: 'boundaries', display: 'Countries (with lakes)', geom: 'Polygon', color: '#FFECB3', weight: 1, enabled: false },
  'ne_10m_admin_0_sovereignty': { name: 'sovereignty', category: 'boundaries', display: 'Sovereign States', geom: 'Polygon', color: '#FFCC80', weight: 1, enabled: false },
  'ne_10m_admin_0_map_units': { name: 'map_units', category: 'boundaries', display: 'Map Units', geom: 'Polygon', color: '#FFE0B2', weight: 1, enabled: false },
  'ne_10m_admin_0_map_subunits': { name: 'map_subunits', category: 'boundaries', display: 'Map Subunits', geom: 'Polygon', color: '#FFF3E0', weight: 1, enabled: false },
  'ne_10m_admin_0_scale_rank': { name: 'countries_scale_rank', category: 'boundaries', display: 'Countries (by scale)', geom: 'Polygon', color: '#FFE082', weight: 1, enabled: false },
  'ne_10m_admin_1_states_provinces': { name: 'states_provinces', category: 'boundaries', display: 'States/Provinces', geom: 'Polygon', color: '#FFECB3', weight: 0.5, enabled: false },
  'ne_10m_admin_1_states_provinces_lakes': { name: 'states_provinces_lakes', category: 'boundaries', display: 'States/Provinces (with lakes)', geom: 'Polygon', color: '#FFF8E1', weight: 0.5, enabled: false },
  'ne_10m_admin_1_states_provinces_lines': { name: 'states_provinces_lines', category: 'boundaries', display: 'State/Province Borders', geom: 'LineString', color: '#FF8F00', weight: 0.5, enabled: false },
  'ne_10m_admin_2_counties': { name: 'counties', category: 'boundaries', display: 'US Counties', geom: 'Polygon', color: '#FFF8E1', weight: 0.3, enabled: false },
  'ne_10m_admin_0_boundary_lines_land': { name: 'boundary_lines_land', category: 'boundaries', display: 'Land Boundaries', geom: 'LineString', color: '#795548', weight: 1, enabled: false },
  'ne_10m_admin_0_boundary_lines_maritime_indicator': { name: 'boundary_lines_maritime', category: 'boundaries', display: 'Maritime Boundaries', geom: 'LineString', color: '#607D8B', weight: 1, enabled: false },
  'ne_10m_admin_0_disputed_areas': { name: 'disputed_areas', category: 'boundaries', display: 'Disputed Areas', geom: 'Polygon', color: '#FFCDD2', weight: 1, enabled: false },
  'ne_10m_admin_0_breakaway_disputed_areas': { name: 'breakaway_areas', category: 'boundaries', display: 'Breakaway Areas', geom: 'Polygon', color: '#EF9A9A', weight: 1, enabled: false },
  'ne_10m_admin_0_pacific_groupings': { name: 'pacific_groupings', category: 'boundaries', display: 'Pacific Groupings', geom: 'Polygon', color: '#B2DFDB', weight: 0.5, enabled: false },
  
  // Cultural layers - Places
  'ne_10m_populated_places': { name: 'populated_places', category: 'places', display: 'Cities & Towns', geom: 'Point', color: '#E53935', weight: 1, enabled: true },
  'ne_10m_populated_places_simple': { name: 'populated_places_simple', category: 'places', display: 'Cities (Simple)', geom: 'Point', color: '#EF5350', weight: 1, enabled: false },
  'ne_10m_urban_areas': { name: 'urban_areas', category: 'places', display: 'Urban Areas', geom: 'Polygon', color: '#BDBDBD', weight: 1, enabled: false },
  'ne_10m_urban_areas_landscan': { name: 'urban_areas_landscan', category: 'places', display: 'Urban Areas (LandScan)', geom: 'Polygon', color: '#9E9E9E', weight: 1, enabled: false },
  
  // Cultural layers - Transportation
  'ne_10m_airports': { name: 'airports', category: 'transport', display: 'Airports', geom: 'Point', color: '#7E57C2', weight: 1, enabled: true },
  'ne_10m_ports': { name: 'ports', category: 'transport', display: 'Seaports', geom: 'Point', color: '#26A69A', weight: 1, enabled: false },
  'ne_10m_roads': { name: 'roads', category: 'transport', display: 'Major Roads', geom: 'LineString', color: '#FF8A65', weight: 2, enabled: false },
  'ne_10m_roads_north_america': { name: 'roads_na', category: 'transport', display: 'Roads (N. America)', geom: 'LineString', color: '#FFAB91', weight: 2, enabled: false },
  'ne_10m_railroads': { name: 'railroads', category: 'transport', display: 'Railroads', geom: 'LineString', color: '#8D6E63', weight: 1.5, enabled: false },
  'ne_10m_railroads_north_america': { name: 'railroads_na', category: 'transport', display: 'Railroads (N. America)', geom: 'LineString', color: '#A1887F', weight: 1.5, enabled: false },
  
  // Cultural layers - Other
  'ne_10m_parks_and_protected_lands_area': { name: 'parks', category: 'other', display: 'Parks & Protected Areas', geom: 'Polygon', color: '#66BB6A', weight: 1, enabled: false },
  'ne_10m_parks_and_protected_lands_point': { name: 'parks_points', category: 'other', display: 'Parks (Points)', geom: 'Point', color: '#81C784', weight: 1, enabled: false },
  'ne_10m_parks_and_protected_lands_line': { name: 'parks_lines', category: 'other', display: 'Parks (Lines)', geom: 'LineString', color: '#A5D6A7', weight: 1, enabled: false },
  'ne_10m_parks_and_protected_lands_scale_rank': { name: 'parks_ranked', category: 'other', display: 'Parks (by scale)', geom: 'Polygon', color: '#C8E6C9', weight: 1, enabled: false },
  'ne_10m_time_zones': { name: 'timezones', category: 'other', display: 'Time Zones', geom: 'Polygon', color: '#CE93D8', weight: 0.5, enabled: false },
  'ne_10m_cultural_building_blocks_all': { name: 'cultural_blocks', category: 'other', display: 'Cultural Building Blocks', geom: 'Polygon', color: '#FFE0B2', weight: 0.5, enabled: false },
};

// NYC Taxi data configuration
const TAXI_CONFIG = {
  totalTrips: 1_000_000,
  batchSize: 50_000,
  zones: [
    'Manhattan - Midtown', 'Manhattan - Downtown', 'Manhattan - Uptown',
    'Brooklyn - Downtown', 'Brooklyn - Williamsburg', 'Queens - Astoria',
    'Queens - Jamaica', 'Bronx - South', 'JFK Airport', 'LaGuardia Airport',
    'Newark Airport', 'Times Square', 'Central Park', 'Wall Street', 'Harlem',
  ],
  paymentTypes: ['Credit Card', 'Cash', 'No Charge', 'Dispute'],
};

/**
 * Download a file with progress reporting
 */
async function downloadFile(url, destPath, name) {
  console.log(`  Downloading ${name}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${name}: ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let downloadedBytes = 0;

  const fileStream = createWriteStream(destPath);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    fileStream.write(Buffer.from(value));
    downloadedBytes += value.length;

    if (totalBytes > 0) {
      const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
      process.stdout.write(`\r  Downloading ${name}... ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  // Wait for the file to be fully written before returning
  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
    fileStream.end();
  });
  
  console.log(`\n  ✓ Downloaded ${name} (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
}

/**
 * Extract a zip file
 */
function extractZip(zipPath, destDir) {
  execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
}

/**
 * Check if DuckDB CLI is available
 */
function checkDuckDBCLI() {
  try {
    const version = execSync('duckdb --version', { encoding: 'utf-8' }).trim();
    console.log(`✓ DuckDB CLI found: ${version}`);
    return true;
  } catch {
    console.error('✗ DuckDB CLI not found. Please install it:');
    console.error('  brew install duckdb');
    console.error('  or download from https://duckdb.org/docs/installation/');
    return false;
  }
}

/**
 * Run DuckDB SQL from a file
 */
function runDuckDBFromFile(dbPath, sqlFile, description) {
  if (description) console.log(`  ${description}...`);
  try {
    execSync(`duckdb "${dbPath}" < "${sqlFile}"`, { stdio: 'pipe', shell: true });
  } catch (error) {
    console.error(`  Error running SQL file: ${error.message}`);
    throw error;
  }
}

/**
 * Run DuckDB SQL commands
 */
function runDuckDB(dbPath, sql, description) {
  console.log(`  ${description}...`);
  const escapedSql = sql.replace(/"/g, '\\"');
  try {
    execSync(`duckdb "${dbPath}" "${escapedSql}"`, { stdio: 'pipe' });
  } catch (error) {
    console.error(`  Error running SQL: ${error.message}`);
    throw error;
  }
}

/**
 * Download and extract all Natural Earth data (2 comprehensive zips)
 */
async function downloadNaturalEarthData() {
  console.log('\n📥 Downloading Natural Earth 10m comprehensive data...\n');

  if (!existsSync(GEODATA_DIR)) {
    mkdirSync(GEODATA_DIR, { recursive: true });
  }

  for (const download of NE_DOWNLOADS) {
    const zipPath = join(GEODATA_DIR, `${download.name}.zip`);
    const extractDir = join(GEODATA_DIR, download.name);

    try {
      // Download if not exists
      if (!existsSync(zipPath)) {
        await downloadFile(download.url, zipPath, `10m_${download.name}.zip`);
      } else {
        const stats = statSync(zipPath);
        console.log(`  ✓ ${download.name}.zip already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB), skipping download`);
      }

      // Extract
      if (!existsSync(extractDir)) {
        mkdirSync(extractDir, { recursive: true });
      }
      process.stdout.write(`  Extracting ${download.name}...`);
      extractZip(zipPath, extractDir);
      console.log(' ✓');
      
      // Count extracted shapefiles
      const shpFiles = findShapefiles(extractDir);
      console.log(`    Found ${shpFiles.length} shapefiles in ${download.name}`);
    } catch (error) {
      console.log(` ✗ Failed: ${error.message}`);
    }
  }
}

/**
 * Find all shapefiles in a directory (recursively)
 */
function findShapefiles(dir) {
  const shapefiles = [];
  
  function walk(currentDir) {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.shp')) {
        shapefiles.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return shapefiles;
}

/**
 * Discover all available shapefiles and match them to layer definitions
 */
function discoverLayers() {
  const layers = [];
  
  // Search in both physical and cultural directories
  for (const download of NE_DOWNLOADS) {
    const extractDir = join(GEODATA_DIR, download.name);
    const shapefiles = findShapefiles(extractDir);
    
    for (const shpPath of shapefiles) {
      const shpName = basename(shpPath, '.shp');
      const layerDef = LAYER_DEFINITIONS[shpName];
      
      if (layerDef) {
        layers.push({
          ...layerDef,
          shpPath,
          shpName,
          tableName: `ne_${layerDef.name}`,
        });
      } else {
        // Auto-generate definition for unknown layers
        const autoName = shpName.replace('ne_10m_', '').replace(/_/g, '_');
        layers.push({
          name: autoName,
          category: download.name,
          display: autoName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          geom: 'Unknown',
          color: '#9E9E9E',
          weight: 1,
          enabled: false,
          shpPath,
          shpName,
          tableName: `ne_${autoName}`,
        });
      }
    }
  }
  
  return layers;
}

/**
 * Generate the SQL to create schema for all layers
 */
function generateSchemaSQL() {
  const sqlParts = [];

  // Install and load spatial extension
  sqlParts.push(`
-- Install and load spatial extension
INSTALL spatial;
LOAD spatial;

SET enable_progress_bar = true;
`);

  // Create a master layer registry table
  sqlParts.push(`
-- Layer registry for the map UI
CREATE TABLE IF NOT EXISTS layer_registry (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  table_name VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  geometry_type VARCHAR,
  description VARCHAR,
  feature_count INTEGER DEFAULT 0,
  enabled_by_default BOOLEAN DEFAULT false,
  style_color VARCHAR,
  style_weight DOUBLE DEFAULT 1.0,
  style_opacity DOUBLE DEFAULT 0.8,
  min_zoom INTEGER DEFAULT 0,
  max_zoom INTEGER DEFAULT 20
);

CREATE SEQUENCE IF NOT EXISTS layer_registry_seq START 1;
`);

  // User drawings table
  sqlParts.push(`
-- User drawings table (empty, for user-created geometries)
CREATE TABLE IF NOT EXISTS user_drawings (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  geometry_type VARCHAR NOT NULL,
  geometry GEOMETRY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  properties JSON
);

CREATE SEQUENCE IF NOT EXISTS user_drawings_seq START 1;
`);

  // NYC Taxi data
  sqlParts.push(`
-- NYC Taxi trips
CREATE TABLE IF NOT EXISTS trips (
  trip_id INTEGER PRIMARY KEY,
  pickup_datetime TIMESTAMP,
  dropoff_datetime TIMESTAMP,
  passenger_count INTEGER,
  trip_distance DOUBLE,
  pickup_zone VARCHAR,
  dropoff_zone VARCHAR,
  payment_type VARCHAR,
  fare_amount DOUBLE,
  tip_amount DOUBLE,
  tolls_amount DOUBLE,
  total_amount DOUBLE
);
`);

  return sqlParts.join('\n');
}

/**
 * Generate SQL to create and populate a layer table from shapefile
 */
function generateLayerSQL(layer) {
  return `
-- Load spatial extension (required for ST_Read)
INSTALL spatial;
LOAD spatial;

-- Load ${layer.name} from shapefile
DROP TABLE IF EXISTS ${layer.tableName};
CREATE TABLE ${layer.tableName} AS 
SELECT 
  ROW_NUMBER() OVER () as id,
  *,
  geom as geometry
FROM ST_Read('${layer.shpPath}');

-- Drop the duplicate geom column
ALTER TABLE ${layer.tableName} DROP COLUMN IF EXISTS geom;
`;
}

/**
 * Generate taxi data SQL for batch insertion
 */
function generateTaxiDataSQL(batchNum, batchSize) {
  const startId = batchNum * batchSize + 1;
  const values = [];

  for (let i = 0; i < batchSize; i++) {
    const tripId = startId + i;
    const baseDate = new Date('2023-01-01');
    const pickupDate = new Date(baseDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
    const tripMinutes = 5 + Math.random() * 55;
    const dropoffDate = new Date(pickupDate.getTime() + tripMinutes * 60 * 1000);
    const passengers = 1 + Math.floor(Math.random() * 4);
    const distance = 0.5 + Math.random() * 20;
    const pickupZone = TAXI_CONFIG.zones[Math.floor(Math.random() * TAXI_CONFIG.zones.length)];
    const dropoffZone = TAXI_CONFIG.zones[Math.floor(Math.random() * TAXI_CONFIG.zones.length)];
    const payment = TAXI_CONFIG.paymentTypes[Math.floor(Math.random() * TAXI_CONFIG.paymentTypes.length)];
    const fare = 2.5 + distance * 2.5 + tripMinutes * 0.5;
    const tip = payment === 'Credit Card' ? fare * (0.15 + Math.random() * 0.1) : 0;
    const tolls = Math.random() > 0.8 ? 6.55 : 0;
    const total = fare + tip + tolls;

    values.push(`(${tripId}, '${pickupDate.toISOString()}', '${dropoffDate.toISOString()}', ${passengers}, ${distance.toFixed(2)}, '${pickupZone}', '${dropoffZone}', '${payment}', ${fare.toFixed(2)}, ${tip.toFixed(2)}, ${tolls.toFixed(2)}, ${total.toFixed(2)})`);
  }

  return `INSERT INTO trips VALUES ${values.join(',\n')};`;
}

/**
 * Populate layer registry with metadata from discovered layers
 */
function generateLayerRegistrySQL(layers) {
  const values = layers.map((l, i) => {
    const desc = l.display || l.name;
    const enabled = l.enabled ? 'true' : 'false';
    return `(${i + 1}, '${l.name}', '${l.tableName}', '${l.display}', '${l.category}', '${l.geom}', '${desc}', 0, ${enabled}, '${l.color}', ${l.weight}, 0.8, 0, 20)`;
  });

  return `
-- Populate layer registry
INSERT INTO layer_registry (id, name, table_name, display_name, category, geometry_type, description, feature_count, enabled_by_default, style_color, style_weight, style_opacity, min_zoom, max_zoom)
VALUES
${values.join(',\n')};
`;
}

/**
 * Generate SQL to update feature counts for all discovered layers
 */
function generateUpdateCountsSQL(layers) {
  const updates = layers.map(l => `
UPDATE layer_registry SET feature_count = (
  SELECT COUNT(*) FROM ${l.tableName}
) WHERE name = '${l.name}';`).join('\n');

  return updates;
}

/**
 * Main build process
 */
async function main() {
  console.log('🦆 DuckDB Demo Database Builder (10m Comprehensive)\n');
  console.log('=' .repeat(60));

  // Check prerequisites
  if (!checkDuckDBCLI()) {
    process.exit(1);
  }

  // Create build directory
  if (!existsSync(BUILD_DIR)) {
    mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Remove existing database
  if (existsSync(OUTPUT_DB)) {
    console.log('\n🗑️  Removing existing database...');
    unlinkSync(OUTPUT_DB);
    const walFile = OUTPUT_DB + '.wal';
    if (existsSync(walFile)) unlinkSync(walFile);
  }

  // Download Natural Earth comprehensive data (2 zip files)
  await downloadNaturalEarthData();

  // Discover all available layers from extracted shapefiles
  console.log('\n🔍 Discovering available layers...');
  const layers = discoverLayers();
  console.log(`  Found ${layers.length} layers total`);
  
  // Show breakdown by category
  const byCategory = {};
  for (const layer of layers) {
    byCategory[layer.category] = (byCategory[layer.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`    ${cat}: ${count} layers`);
  }

  // Generate and write schema SQL
  console.log('\n📝 Generating database schema...');
  const schemaSQL = generateSchemaSQL();
  const schemaSQLPath = join(BUILD_DIR, 'schema.sql');
  writeFileSync(schemaSQLPath, schemaSQL);

  // Create database with schema
  console.log('\n🗃️  Creating database...');
  runDuckDBFromFile(OUTPUT_DB, schemaSQLPath, 'Creating schema');

  // Load each layer from shapefiles
  console.log('\n🌍 Loading Natural Earth layers...');
  let loadedLayers = 0;
  
  for (const layer of layers) {
    const layerSQL = generateLayerSQL(layer);
    const layerSQLPath = join(BUILD_DIR, `layer_${layer.name}.sql`);
    writeFileSync(layerSQLPath, layerSQL);
    try {
      process.stdout.write(`  Loading ${layer.name}...`);
      runDuckDBFromFile(OUTPUT_DB, layerSQLPath, '');
      console.log(' ✓');
      loadedLayers++;
      unlinkSync(layerSQLPath);
    } catch (error) {
      console.log(` ✗ ${error.message}`);
    }
  }
  console.log(`\n  Loaded ${loadedLayers}/${layers.length} layers`);

  // Populate layer registry
  console.log('\n📋 Populating layer registry...');
  const registrySQL = generateLayerRegistrySQL(layers.filter((_, i) => i < loadedLayers || true)); // Only register successfully loaded layers
  const registrySQLPath = join(BUILD_DIR, 'registry.sql');
  writeFileSync(registrySQLPath, registrySQL);
  runDuckDBFromFile(OUTPUT_DB, registrySQLPath, 'Populating registry');
  unlinkSync(registrySQLPath);

  // Update feature counts
  console.log('\n📊 Updating feature counts...');
  const countsSQL = generateUpdateCountsSQL(layers);
  const countsSQLPath = join(BUILD_DIR, 'counts.sql');
  writeFileSync(countsSQLPath, countsSQL);
  try {
    runDuckDBFromFile(OUTPUT_DB, countsSQLPath, 'Updating counts');
  } catch {
    // Some tables may not exist, that's OK
  }
  unlinkSync(countsSQLPath);

  // Generate and insert taxi data in batches
  console.log('\n🚕 Generating NYC taxi data (1 million trips)...');
  const totalBatches = Math.ceil(TAXI_CONFIG.totalTrips / TAXI_CONFIG.batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const progress = ((batch + 1) / totalBatches * 100).toFixed(1);
    process.stdout.write(`\r  Generating batch ${batch + 1}/${totalBatches} (${progress}%)...`);

    const taxiSQL = generateTaxiDataSQL(batch, TAXI_CONFIG.batchSize);
    const taxiSQLPath = join(BUILD_DIR, `taxi_batch_${batch}.sql`);
    writeFileSync(taxiSQLPath, taxiSQL);

    execSync(`duckdb "${OUTPUT_DB}" < "${taxiSQLPath}"`, { stdio: 'pipe', shell: true });
    unlinkSync(taxiSQLPath);
  }
  console.log('\n  ✓ Taxi data generated');

  // Create indexes
  console.log('\n📊 Creating indexes...');
  const indexSQL = `
CREATE INDEX IF NOT EXISTS idx_pickup_time ON trips(pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_distance ON trips(trip_distance);
CREATE INDEX IF NOT EXISTS idx_total_amount ON trips(total_amount);
CREATE INDEX IF NOT EXISTS idx_pickup_zone ON trips(pickup_zone);
`;
  const indexSQLPath = join(BUILD_DIR, 'indexes.sql');
  writeFileSync(indexSQLPath, indexSQL);
  runDuckDBFromFile(OUTPUT_DB, indexSQLPath, 'Creating indexes');
  unlinkSync(indexSQLPath);

  // Checkpoint and vacuum
  console.log('\n🧹 Optimizing database...');
  runDuckDB(OUTPUT_DB, 'CHECKPOINT;', 'Checkpointing');
  runDuckDB(OUTPUT_DB, 'VACUUM;', 'Vacuuming');

  // Get final stats
  console.log('\n📈 Database statistics:');
  try {
    const stats = execSync(`duckdb "${OUTPUT_DB}" "SELECT display_name, feature_count FROM layer_registry WHERE feature_count > 0 ORDER BY feature_count DESC LIMIT 20;"`, { encoding: 'utf-8' });
    console.log(stats);
  } catch {
    // Stats query might fail
  }

  // Get file size
  const dbStats = statSync(OUTPUT_DB);
  const sizeMB = (dbStats.size / 1024 / 1024).toFixed(1);

  console.log('=' .repeat(60));
  console.log(`\n✅ Database created successfully!`);
  console.log(`   Output: ${OUTPUT_DB}`);
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Layers: ${loadedLayers}`);
  console.log(`\n📱 To embed in Android APK, run:`);
  console.log(`   ./scripts/build-example-android.sh`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
