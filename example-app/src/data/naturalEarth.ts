/**
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

// Import GeoJSON files (as .json so Vite parses them properly)
import countriesData from './geojson/countries.json';
import citiesData from './geojson/cities.json';
import riversData from './geojson/rivers.json';
import lakesData from './geojson/lakes.json';
import airportsData from './geojson/airports.json';

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
  return countriesData as unknown as CountriesCollection;
}

/** Get all cities as a typed FeatureCollection */
export function getCities(): CitiesCollection {
  return citiesData as unknown as CitiesCollection;
}

/** Get all rivers as a typed FeatureCollection */
export function getRivers(): RiversCollection {
  return riversData as unknown as RiversCollection;
}

/** Get all lakes as a typed FeatureCollection */
export function getLakes(): LakesCollection {
  return lakesData as unknown as LakesCollection;
}

/** Get all airports as a typed FeatureCollection */
export function getAirports(): AirportsCollection {
  return airportsData as unknown as AirportsCollection;
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
  return `POINT(${coords[0]} ${coords[1]})`;
}

/** Convert a GeoJSON LineString to WKT */
export function lineStringToWkt(coords: [number, number][]): string {
  const points = coords.map(([x, y]) => `${x} ${y}`).join(', ');
  return `LINESTRING(${points})`;
}

/** Convert a GeoJSON Polygon to WKT (outer ring only) */
export function polygonToWkt(coords: [number, number][][]): string {
  const rings = coords.map((ring) => {
    const points = ring.map(([x, y]) => `${x} ${y}`).join(', ');
    return `(${points})`;
  }).join(', ');
  return `POLYGON(${rings})`;
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
        .map(c => `(${c[0]} ${c[1]})`).join(', ');
      return `MULTIPOINT(${mpoints})`;
    case 'MultiLineString':
      const mlines = (geometry.coordinates as [number, number][][])
        .map(line => `(${line.map(([x, y]) => `${x} ${y}`).join(', ')})`).join(', ');
      return `MULTILINESTRING(${mlines})`;
    case 'MultiPolygon':
      const mpolys = (geometry.coordinates as [number, number][][][])
        .map(poly => {
          const rings = poly.map(ring => 
            `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`
          ).join(', ');
          return `(${rings})`;
        }).join(', ');
      return `MULTIPOLYGON(${mpolys})`;
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
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
