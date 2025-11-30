#!/usr/bin/env node
/**
 * Download Natural Earth GeoJSON data for the Spatial Demo App
 * 
 * Downloads 1:110m scale data (smallest, perfect for mobile demos):
 * - Countries (admin boundaries)
 * - Populated places (cities)
 * - Rivers
 * - Lakes
 * 
 * Plus 1:10m airports (more detail needed for this dataset)
 * 
 * Source: https://github.com/nvkelso/natural-earth-vector
 * License: Public Domain (CC0)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'geojson');

// Natural Earth GeoJSON URLs (from official GitHub repo)
const DATASETS = [
  {
    name: 'countries',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
    description: 'Country boundaries (1:110m scale)',
  },
  {
    name: 'cities',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places.geojson',
    description: 'Major cities and populated places (1:110m scale)',
  },
  {
    name: 'rivers',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_rivers_lake_centerlines.geojson',
    description: 'Major rivers (1:110m scale)',
  },
  {
    name: 'lakes',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_lakes.geojson',
    description: 'Major lakes (1:110m scale)',
  },
  {
    name: 'airports',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_airports.geojson',
    description: 'Airports (1:10m scale for better coverage)',
  },
];

async function downloadFile(url, name) {
  console.log(`  Downloading ${name}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${name}: ${response.status} ${response.statusText}`);
  }
  const data = await response.text();
  const sizeKB = (data.length / 1024).toFixed(1);
  console.log(`  ✓ ${name} (${sizeKB} KB)`);
  return data;
}

async function main() {
  console.log('🌍 Downloading Natural Earth GeoJSON data...\n');

  // Create data directory
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created directory: ${DATA_DIR}\n`);
  }

  let totalSize = 0;

  for (const dataset of DATASETS) {
    try {
      const data = await downloadFile(dataset.url, dataset.name);
      const filePath = join(DATA_DIR, `${dataset.name}.geojson`);
      writeFileSync(filePath, data);
      totalSize += data.length;
    } catch (error) {
      console.error(`  ✗ Failed to download ${dataset.name}: ${error.message}`);
    }
  }

  console.log(`\n✅ Downloaded ${DATASETS.length} datasets (${(totalSize / 1024).toFixed(1)} KB total)`);
  console.log(`   Saved to: ${DATA_DIR}`);

  // Generate TypeScript loader
  console.log('\n📝 Generating TypeScript loader...');
  generateLoader();
  console.log('✅ Generated src/data/naturalEarth.ts');
}

function generateLoader() {
  const loaderPath = join(__dirname, '..', 'src', 'data', 'naturalEarth.ts');
  
  const loaderContent = `/**
 * Natural Earth GeoJSON Data Loader
 * 
 * Provides type-safe access to embedded Natural Earth datasets.
 * Data source: https://www.naturalearthdata.com/
 * License: Public Domain (CC0)
 * 
 * Datasets included:
 * - Countries (1:110m) - Administrative boundaries
 * - Cities (1:110m) - Major populated places
 * - Rivers (1:110m) - Major rivers and lake centerlines
 * - Lakes (1:110m) - Major lakes
 * - Airports (1:10m) - International airports
 */

import type { FeatureCollection, Feature, Geometry, Point, Polygon, MultiPolygon, LineString, MultiLineString } from 'geojson';

// Import GeoJSON files
import countriesData from './geojson/countries.geojson';
import citiesData from './geojson/cities.geojson';
import riversData from './geojson/rivers.geojson';
import lakesData from './geojson/lakes.geojson';
import airportsData from './geojson/airports.geojson';

// ============================================================================
// Type Definitions
// ============================================================================

/** Country properties from Natural Earth */
export interface CountryProperties {
  NAME: string;
  NAME_LONG: string;
  ISO_A3: string;
  ISO_A2: string;
  CONTINENT: string;
  SUBREGION: string;
  POP_EST: number;
  GDP_MD: number;
  ECONOMY: string;
  INCOME_GRP: string;
  SOVEREIGNT: string;
  TYPE: string;
  ADMIN: string;
  [key: string]: unknown;
}

/** City properties from Natural Earth */
export interface CityProperties {
  NAME: string;
  NAMEASCII: string;
  SOV0NAME: string;
  ADM0NAME: string;
  ADM1NAME: string;
  LATITUDE: number;
  LONGITUDE: number;
  POP_MAX: number;
  POP_MIN: number;
  POP_OTHER: number;
  RANK_MAX: number;
  RANK_MIN: number;
  FEATURECLA: string;
  TIMEZONE: string;
  [key: string]: unknown;
}

/** River properties from Natural Earth */
export interface RiverProperties {
  name: string;
  name_alt?: string;
  featurecla: string;
  scalerank: number;
  rivernum?: number;
  [key: string]: unknown;
}

/** Lake properties from Natural Earth */
export interface LakeProperties {
  name: string;
  name_alt?: string;
  featurecla: string;
  scalerank: number;
  [key: string]: unknown;
}

/** Airport properties from Natural Earth */
export interface AirportProperties {
  name: string;
  abbrev: string;
  type: string;
  natlscale: number;
  scalerank: number;
  featurecla: string;
  location: string;
  gps_code?: string;
  iata_code?: string;
  wikipedia?: string;
  [key: string]: unknown;
}

// ============================================================================
// Typed Feature Collections
// ============================================================================

export type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>;
export type CityFeature = Feature<Point, CityProperties>;
export type RiverFeature = Feature<LineString | MultiLineString, RiverProperties>;
export type LakeFeature = Feature<Polygon | MultiPolygon, LakeProperties>;
export type AirportFeature = Feature<Point, AirportProperties>;

export type CountriesCollection = FeatureCollection<Polygon | MultiPolygon, CountryProperties>;
export type CitiesCollection = FeatureCollection<Point, CityProperties>;
export type RiversCollection = FeatureCollection<LineString | MultiLineString, RiverProperties>;
export type LakesCollection = FeatureCollection<Polygon | MultiPolygon, LakeProperties>;
export type AirportsCollection = FeatureCollection<Point, AirportProperties>;

// ============================================================================
// Data Access Functions
// ============================================================================

/** Get all countries as a typed FeatureCollection */
export function getCountries(): CountriesCollection {
  return countriesData as CountriesCollection;
}

/** Get all cities as a typed FeatureCollection */
export function getCities(): CitiesCollection {
  return citiesData as CitiesCollection;
}

/** Get all rivers as a typed FeatureCollection */
export function getRivers(): RiversCollection {
  return riversData as RiversCollection;
}

/** Get all lakes as a typed FeatureCollection */
export function getLakes(): LakesCollection {
  return lakesData as LakesCollection;
}

/** Get all airports as a typed FeatureCollection */
export function getAirports(): AirportsCollection {
  return airportsData as AirportsCollection;
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Get a country by ISO A3 code (e.g., 'USA', 'GBR', 'JPN') */
export function getCountryByCode(isoA3: string): CountryFeature | undefined {
  return getCountries().features.find(
    (f) => f.properties.ISO_A3 === isoA3.toUpperCase()
  );
}

/** Get a country by name (case-insensitive partial match) */
export function getCountryByName(name: string): CountryFeature | undefined {
  const lower = name.toLowerCase();
  return getCountries().features.find(
    (f) => f.properties.NAME.toLowerCase().includes(lower) ||
           f.properties.NAME_LONG.toLowerCase().includes(lower)
  );
}

/** Get cities in a specific country by ISO A3 code */
export function getCitiesInCountry(isoA3: string): CityFeature[] {
  // Note: Cities use SOV0NAME/ADM0NAME, not ISO codes directly
  return getCities().features.filter((f) => {
    const country = getCountryByCode(isoA3);
    return country && (
      f.properties.SOV0NAME === country.properties.SOVEREIGNT ||
      f.properties.ADM0NAME === country.properties.ADMIN
    );
  });
}

/** Get top N cities by population */
export function getTopCitiesByPopulation(n: number): CityFeature[] {
  return [...getCities().features]
    .sort((a, b) => (b.properties.POP_MAX || 0) - (a.properties.POP_MAX || 0))
    .slice(0, n);
}

/** Get airports by type (e.g., 'major', 'mid', 'small', 'spaceport') */
export function getAirportsByType(type: string): AirportFeature[] {
  return getAirports().features.filter(
    (f) => f.properties.type?.toLowerCase() === type.toLowerCase()
  );
}

/** Get airport by IATA code (e.g., 'JFK', 'LAX', 'LHR') */
export function getAirportByIata(iataCode: string): AirportFeature | undefined {
  return getAirports().features.find(
    (f) => f.properties.iata_code === iataCode.toUpperCase()
  );
}

/** Get countries by continent */
export function getCountriesByContinent(continent: string): CountryFeature[] {
  const lower = continent.toLowerCase();
  return getCountries().features.filter(
    (f) => f.properties.CONTINENT?.toLowerCase() === lower
  );
}

/** Get summary statistics about the loaded data */
export function getDataSummary() {
  return {
    countries: getCountries().features.length,
    cities: getCities().features.length,
    rivers: getRivers().features.length,
    lakes: getLakes().features.length,
    airports: getAirports().features.length,
  };
}

// ============================================================================
// WKT Conversion Helpers (for DuckDB spatial queries)
// ============================================================================

/** Convert a GeoJSON Point to WKT */
export function pointToWkt(coords: [number, number]): string {
  return \`POINT(\${coords[0]} \${coords[1]})\`;
}

/** Convert a GeoJSON LineString to WKT */
export function lineStringToWkt(coords: [number, number][]): string {
  const points = coords.map(([x, y]) => \`\${x} \${y}\`).join(', ');
  return \`LINESTRING(\${points})\`;
}

/** Convert a GeoJSON Polygon to WKT (outer ring only) */
export function polygonToWkt(coords: [number, number][][]): string {
  const rings = coords.map((ring) => {
    const points = ring.map(([x, y]) => \`\${x} \${y}\`).join(', ');
    return \`(\${points})\`;
  }).join(', ');
  return \`POLYGON(\${rings})\`;
}

/** Convert any GeoJSON geometry to WKT string */
export function geometryToWkt(geometry: Geometry): string {
  switch (geometry.type) {
    case 'Point':
      return pointToWkt(geometry.coordinates as [number, number]);
    case 'LineString':
      return lineStringToWkt(geometry.coordinates as [number, number][]);
    case 'Polygon':
      return polygonToWkt(geometry.coordinates as [number, number][][]);
    case 'MultiPoint':
      const mpoints = (geometry.coordinates as [number, number][])
        .map(c => \`(\${c[0]} \${c[1]})\`).join(', ');
      return \`MULTIPOINT(\${mpoints})\`;
    case 'MultiLineString':
      const mlines = (geometry.coordinates as [number, number][][])
        .map(line => \`(\${line.map(([x, y]) => \`\${x} \${y}\`).join(', ')})\`).join(', ');
      return \`MULTILINESTRING(\${mlines})\`;
    case 'MultiPolygon':
      const mpolys = (geometry.coordinates as [number, number][][][])
        .map(poly => {
          const rings = poly.map(ring => 
            \`(\${ring.map(([x, y]) => \`\${x} \${y}\`).join(', ')})\`
          ).join(', ');
          return \`(\${rings})\`;
        }).join(', ');
      return \`MULTIPOLYGON(\${mpolys})\`;
    default:
      throw new Error(\`Unsupported geometry type: \${geometry.type}\`);
  }
}

// Export all datasets for convenience
export const naturalEarth = {
  countries: getCountries,
  cities: getCities,
  rivers: getRivers,
  lakes: getLakes,
  airports: getAirports,
  summary: getDataSummary,
};

export default naturalEarth;
`;

  writeFileSync(loaderPath, loaderContent);
}

main().catch(console.error);
