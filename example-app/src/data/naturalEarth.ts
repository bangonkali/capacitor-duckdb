/**
 * Natural Earth Type Definitions and WKT Utilities
 * 
 * This module provides type definitions for Natural Earth data and
 * WKT conversion utilities for DuckDB spatial queries.
 * 
 * NOTE: Geographic data is NOT loaded from JSON files at runtime.
 * All Natural Earth data is pre-populated in the demo DuckDB database
 * (demo.duckdb) which is bundled with the app. Query data using
 * spatialService.getLayerGeoJSON() or spatialService.getDynamicLayerGeoJSON().
 * 
 * Data source: https://www.naturalearthdata.com/
 * License: Public Domain (CC0)
 */

import type { Feature, Geometry, Point, Polygon, MultiPolygon, LineString, MultiLineString } from 'geojson';

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
// Typed Feature Types
// ============================================================================

export type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>;
export type CityFeature = Feature<Point, CityProperties>;
export type RiverFeature = Feature<LineString | MultiLineString, RiverProperties>;
export type LakeFeature = Feature<Polygon | MultiPolygon, LakeProperties>;
export type AirportFeature = Feature<Point, AirportProperties>;

// ============================================================================
// WKT Conversion Helpers (for DuckDB spatial queries)
// ============================================================================

/** Convert a GeoJSON Point coordinates to WKT */
export function pointToWkt(coords: [number, number]): string {
  return `POINT(${coords[0]} ${coords[1]})`;
}

/** Convert a GeoJSON LineString coordinates to WKT */
export function lineStringToWkt(coords: [number, number][]): string {
  const points = coords.map(([x, y]) => `${x} ${y}`).join(', ');
  return `LINESTRING(${points})`;
}

/** Convert a GeoJSON Polygon coordinates to WKT */
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
    case 'MultiPoint': {
      const mpoints = (geometry.coordinates as [number, number][])
        .map(c => `(${c[0]} ${c[1]})`).join(', ');
      return `MULTIPOINT(${mpoints})`;
    }
    case 'MultiLineString': {
      const mlines = (geometry.coordinates as [number, number][][])
        .map(line => `(${line.map(([x, y]) => `${x} ${y}`).join(', ')})`).join(', ');
      return `MULTILINESTRING(${mlines})`;
    }
    case 'MultiPolygon': {
      const mpolys = (geometry.coordinates as [number, number][][][])
        .map(poly => {
          const rings = poly.map(ring => 
            `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`
          ).join(', ');
          return `(${rings})`;
        }).join(', ');
      return `MULTIPOLYGON(${mpolys})`;
    }
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}

// Export WKT utilities as default for convenience
export const naturalEarthUtils = {
  pointToWkt,
  lineStringToWkt,
  polygonToWkt,
  geometryToWkt,
};

export default naturalEarthUtils;
