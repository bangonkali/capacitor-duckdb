/**
 * TypeScript declaration for GeoJSON file imports
 * Allows importing .geojson files as modules
 */

declare module '*.geojson' {
  import type { FeatureCollection } from 'geojson';
  const value: FeatureCollection;
  export default value;
}
