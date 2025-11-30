/**
 * MapView Component
 * 
 * OpenLayers-based interactive map with OSM tiles, vector layers,
 * and coordinate transformation support.
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import OLMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import OLGeoJSON from 'ol/format/GeoJSON';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import type { Feature as OlFeature } from 'ol';
import type { FeatureLike } from 'ol/Feature';
import type { FeatureCollection } from 'geojson';
import { buffer as bufferExtent } from 'ol/extent';

import spatialService, { type LayerName, type LayerInfo } from '../../services/spatialService';
import type { Extent } from 'ol/extent';

import 'ol/ol.css';

// ============================================================================
// Types
// ============================================================================

export interface MapViewProps {
  /** Initial center coordinates [longitude, latitude] */
  center?: [number, number];
  /** Initial zoom level (0-20) */
  zoom?: number;
  /** Whether to show country boundaries layer */
  showCountries?: boolean;
  /** Whether to show cities layer */
  showCities?: boolean;
  /** Whether to show airports layer */
  showAirports?: boolean;
  /** Whether to show rivers layer */
  showRivers?: boolean;
  /** Whether to show lakes layer */
  showLakes?: boolean;
  /** Dynamic layers to show (from layer registry) */
  dynamicLayers?: Set<string>;
  /** GeoJSON data for the user drawings layer */
  userDrawings?: FeatureCollection;
  /** GeoJSON data for highlighting/results */
  highlightData?: FeatureCollection;
  /** Callback when map is clicked */
  onMapClick?: (coords: [number, number], features: OlFeature[]) => void;
  /** Callback when map view changes */
  onViewChange?: (center: [number, number], zoom: number, extent: [number, number, number, number]) => void;
  /** Map container height */
  height?: string;
  /** Custom styles for layers */
  layerStyles?: LayerStyles;
}

export interface LayerStyles {
  countries?: Style;
  cities?: Style;
  airports?: Style;
  rivers?: Style;
  lakes?: Style;
  userDrawings?: Style;
  highlight?: Style;
}

export interface MapViewRef {
  /** Get the OpenLayers map instance */
  getMap: () => OLMap | null;
  /** Fit view to given extent [minX, minY, maxX, maxY] in EPSG:4326 */
  fitExtent: (extent: [number, number, number, number], options?: { padding?: number[]; duration?: number }) => void;
  /** Fly to a specific location */
  flyTo: (center: [number, number], zoom?: number, duration?: number) => void;
  /** Get current map extent in EPSG:4326 */
  getExtent: () => [number, number, number, number];
  /** Get current center in EPSG:4326 */
  getCenter: () => [number, number];
  /** Get current zoom level */
  getZoom: () => number;
  /** Add GeoJSON features to highlight layer */
  highlightFeatures: (geojson: FeatureCollection) => void;
  /** Clear highlight layer */
  clearHighlight: () => void;
  /** Update user drawings layer */
  updateUserDrawings: (geojson: FeatureCollection) => void;
  /** Get features at a pixel location */
  getFeaturesAtPixel: (pixel: [number, number]) => OlFeature[];
}

// ============================================================================
// Default Styles
// ============================================================================

const defaultStyles: Required<LayerStyles> = {
  countries: new Style({
    fill: new Fill({ color: 'rgba(200, 200, 200, 0.3)' }),
    stroke: new Stroke({ color: '#666', width: 1 }),
  }),
  cities: new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#e74c3c' }),
      stroke: new Stroke({ color: '#fff', width: 1 }),
    }),
    text: new Text({
      font: '11px sans-serif',
      offsetY: -12,
      fill: new Fill({ color: '#333' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  }),
  airports: new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: '#3498db' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  }),
  rivers: new Style({
    stroke: new Stroke({ color: '#3498db', width: 2 }),
  }),
  lakes: new Style({
    fill: new Fill({ color: 'rgba(52, 152, 219, 0.5)' }),
    stroke: new Stroke({ color: '#2980b9', width: 1 }),
  }),
  userDrawings: new Style({
    fill: new Fill({ color: 'rgba(46, 204, 113, 0.4)' }),
    stroke: new Stroke({ color: '#27ae60', width: 3 }),
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#27ae60' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  }),
  highlight: new Style({
    fill: new Fill({ color: 'rgba(241, 196, 15, 0.5)' }),
    stroke: new Stroke({ color: '#f39c12', width: 4 }),
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: '#f39c12' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
    }),
  }),
};

const LAYER_FETCH_LIMITS: Partial<Record<LayerName, number>> = {
  cities: 5000,
  airports: 5000,
  rivers: 8000,
  lakes: 5000,
};

const clampExtent = (extent: Extent): Extent => [
  Math.max(-180, extent[0]),
  Math.max(-90, extent[1]),
  Math.min(180, extent[2]),
  Math.min(90, extent[3]),
];

const expandExtent = (extent: Extent, bufferDeg: number): Extent => [
  extent[0] - bufferDeg,
  extent[1] - bufferDeg,
  extent[2] + bufferDeg,
  extent[3] + bufferDeg,
];

const extentContains = (outer: Extent, inner: Extent): boolean =>
  outer[0] <= inner[0] &&
  outer[1] <= inner[1] &&
  outer[2] >= inner[2] &&
  outer[3] >= inner[3];

const getExtentPaddingDegrees = (layer: LayerName, zoomLevel: number): number => {
  const normalizedZoom = Number.isFinite(zoomLevel) ? zoomLevel : 2;
  const base = Math.min(45, Math.max(0.1, 360 / Math.pow(2, normalizedZoom + 4)));
  if (layer === 'countries') return base * 4;
  if (layer === 'rivers' || layer === 'lakes') return base * 2;
  return base;
};

// ============================================================================
// Component
// ============================================================================

export const MapView = forwardRef<MapViewRef, MapViewProps>((props, ref) => {
  const {
    center = [0, 20],
    zoom = 2,
    showCountries = true,
    showCities = false,
    showAirports = false,
    showRivers = false,
    showLakes = false,
    dynamicLayers,
    userDrawings,
    highlightData,
    onMapClick,
    onViewChange,
    height = '100%',
    layerStyles = {},
  } = props;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OLMap | null>(null);

  type LayerVectorMap = Record<LayerName | 'userDrawings' | 'highlight', VectorLayer<VectorSource> | undefined>;
  const layersRef = useRef<LayerVectorMap>({
    countries: undefined,
    cities: undefined,
    airports: undefined,
    rivers: undefined,
    lakes: undefined,
    userDrawings: undefined,
    highlight: undefined,
  });

  // Dynamic layers ref - stores layers created from layer_registry
  const dynamicLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const dynamicLayerLoadingRef = useRef<Set<string>>(new Set());
  const dynamicLayerCacheRef = useRef<Map<string, { extent: Extent; zoom: number }>>(new Map());
  const [layerInfoCache, setLayerInfoCache] = useState<Map<string, LayerInfo>>(new Map());

  const layerLoadingRef = useRef<Record<LayerName, boolean>>({
    countries: false,
    cities: false,
    airports: false,
    rivers: false,
    lakes: false,
  });

  type LayerViewportCache = Partial<Record<LayerName, { extent: Extent; zoom: number }>>;
  const layerViewportCacheRef = useRef<LayerViewportCache>({});

  const [viewExtent4326, setViewExtent4326] = useState<Extent | null>(null);
  const [viewZoom, setViewZoom] = useState(zoom);

  const stylesRef = useRef({ ...defaultStyles, ...layerStyles });

  // Create city style function with labels
  const cityStyleFunction = useCallback((feature: FeatureLike) => {
    const name = feature.get('NAME') || feature.get('name') || '';
    const population = feature.get('POP_MAX') || feature.get('population') || 0;
    // Only show labels for larger cities
    const currentZoom = mapRef.current?.getView().getZoom() || 2;
    const showLabel = population > 1000000 || currentZoom > 5;
    
    return new Style({
      image: new CircleStyle({
        radius: Math.min(4 + Math.log10(population + 1), 10),
        fill: new Fill({ color: '#e74c3c' }),
        stroke: new Stroke({ color: '#fff', width: 1 }),
      }),
      text: showLabel ? new Text({
        text: name,
        font: '11px sans-serif',
        offsetY: -12,
        fill: new Fill({ color: '#333' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }) : undefined,
    });
  }, []);

  const updateViewState = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const view = map.getView();
    const size = map.getSize();
    if (!size) return;

    const calculatedExtent = view.calculateExtent(size);
    const padded = bufferExtent(calculatedExtent, 25000); // pad by ~25km to cover rotation
    const geographicExtent = transformExtent(padded, 'EPSG:3857', 'EPSG:4326') as Extent;
    setViewExtent4326(geographicExtent);
    setViewZoom(view.getZoom() || 2);
  }, []);

  const clearLayerCache = useCallback((layerName: LayerName) => {
    delete layerViewportCacheRef.current[layerName];
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create vector sources
    const countriesSource = new VectorSource();
    const citiesSource = new VectorSource();
    const airportsSource = new VectorSource();
    const riversSource = new VectorSource();
    const lakesSource = new VectorSource();
    const userDrawingsSource = new VectorSource();
    const highlightSource = new VectorSource();

    // Create layers
    const countriesLayer = new VectorLayer({
      source: countriesSource,
      style: stylesRef.current.countries,
      visible: showCountries,
      zIndex: 1,
    });

    const lakesLayer = new VectorLayer({
      source: lakesSource,
      style: stylesRef.current.lakes,
      visible: showLakes,
      zIndex: 2,
    });

    const riversLayer = new VectorLayer({
      source: riversSource,
      style: stylesRef.current.rivers,
      visible: showRivers,
      zIndex: 3,
    });

    const citiesLayer = new VectorLayer({
      source: citiesSource,
      style: cityStyleFunction,
      visible: showCities,
      zIndex: 4,
    });

    const airportsLayer = new VectorLayer({
      source: airportsSource,
      style: stylesRef.current.airports,
      visible: showAirports,
      zIndex: 5,
    });

    const userDrawingsLayer = new VectorLayer({
      source: userDrawingsSource,
      style: stylesRef.current.userDrawings,
      zIndex: 10,
    });

    const highlightLayer = new VectorLayer({
      source: highlightSource,
      style: stylesRef.current.highlight,
      zIndex: 100,
    });

    // Store layer references
    layersRef.current = {
      countries: countriesLayer,
      cities: citiesLayer,
      airports: airportsLayer,
      rivers: riversLayer,
      lakes: lakesLayer,
      userDrawings: userDrawingsLayer,
      highlight: highlightLayer,
    };

    // Create map
    const map = new OLMap({
      target: mapContainerRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
          zIndex: 0,
        }),
        countriesLayer,
        lakesLayer,
        riversLayer,
        citiesLayer,
        airportsLayer,
        userDrawingsLayer,
        highlightLayer,
      ],
      view: new View({
        center: fromLonLat(center),
        zoom: zoom,
        maxZoom: 18,
        minZoom: 1,
      }),
    });

    mapRef.current = map;
    updateViewState();

    // Add click handler
    map.on('click', (event) => {
      const coords = toLonLat(event.coordinate) as [number, number];
      const features: OlFeature[] = [];
      
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        features.push(feature as OlFeature);
      });
      
      onMapClick?.(coords, features);
    });

    // Add view change handler
    map.on('moveend', () => {
      updateViewState();
      const view = map.getView();
      const currentCenter = toLonLat(view.getCenter() || [0, 0]) as [number, number];
      const currentZoom = view.getZoom() || 2;
      const extent = transformExtent(
        view.calculateExtent(map.getSize()),
        'EPSG:3857',
        'EPSG:4326'
      ) as [number, number, number, number];
      
      onViewChange?.(currentCenter, currentZoom, extent);
    });

    // Cleanup
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateViewState]);

  const shouldFetchLayer = useCallback((layerName: LayerName, requestedExtent: Extent, zoomLevel: number) => {
    const cache = layerViewportCacheRef.current[layerName];
    if (!cache) return true;
    if (Math.abs((cache.zoom ?? 0) - (zoomLevel ?? 0)) >= 0.75) {
      return true;
    }
    return !extentContains(cache.extent, requestedExtent);
  }, []);

  const loadLayerData = useCallback(
    async (layerName: LayerName, extentToFetch: Extent, zoomLevel: number) => {
      if (layerLoadingRef.current[layerName]) return;

      const layer = layersRef.current[layerName];
      if (!layer) return;

      const source = layer.getSource();
      if (!source) return;

      layerLoadingRef.current[layerName] = true;

      try {
        const collection = await spatialService.getLayerGeoJSON(layerName, {
          bbox: extentToFetch as [number, number, number, number],
          maxFeatures: LAYER_FETCH_LIMITS[layerName],
        });
        const geojson = new OLGeoJSON();
        const features = geojson.readFeatures(collection, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        // Only clear and replace if we got valid data
        if (features.length > 0 || collection.features.length === 0) {
          source.clear();
          source.addFeatures(features);
        }
        layerViewportCacheRef.current[layerName] = {
          extent: extentToFetch,
          zoom: zoomLevel,
        };
      } catch (error) {
        console.error(`Failed to load ${layerName} layer:`, error);
      } finally {
        layerLoadingRef.current[layerName] = false;
      }
    },
    []
  );

  // Load Natural Earth data from DuckDB when layers become visible and viewport changes
  useEffect(() => {
    if (!viewExtent4326) return;

    const requestLayer = (layerName: LayerName, visible: boolean) => {
      if (!visible) return;
      const paddingDeg = getExtentPaddingDegrees(layerName, viewZoom);
      const paddedExtent = clampExtent(expandExtent(viewExtent4326, paddingDeg));
      if (!shouldFetchLayer(layerName, paddedExtent, viewZoom)) {
        return;
      }
      void loadLayerData(layerName, paddedExtent, viewZoom);
    };

    requestLayer('countries', showCountries);
    requestLayer('cities', showCities);
    requestLayer('airports', showAirports);
    requestLayer('rivers', showRivers);
    requestLayer('lakes', showLakes);
  }, [
    viewExtent4326,
    viewZoom,
    showCountries,
    showCities,
    showAirports,
    showRivers,
    showLakes,
    loadLayerData,
    shouldFetchLayer,
  ]);

  // Update layer visibility
  useEffect(() => {
    const toggleLayer = (layerName: LayerName, visible: boolean) => {
      const layer = layersRef.current[layerName];
      layer?.setVisible(visible);
      if (!visible) {
        layer?.getSource()?.clear();
        clearLayerCache(layerName);
      }
    };

    toggleLayer('countries', showCountries);
    toggleLayer('cities', showCities);
    toggleLayer('airports', showAirports);
    toggleLayer('rivers', showRivers);
    toggleLayer('lakes', showLakes);
  }, [showCountries, showCities, showAirports, showRivers, showLakes, clearLayerCache]);

  // Helper to create style for a dynamic layer
  const createDynamicLayerStyle = useCallback((layerInfo: LayerInfo): Style | ((feature: FeatureLike) => Style) => {
    const color = layerInfo.styleColor || '#3388ff';
    const weight = layerInfo.styleWeight || 1;
    const opacity = layerInfo.styleOpacity || 0.7;
    
    // Parse color and add opacity
    const fillColor = color.startsWith('#') 
      ? `${color}${Math.round(opacity * 0.5 * 255).toString(16).padStart(2, '0')}`
      : color;
    
    if (layerInfo.geometryType === 'Point') {
      return (feature: FeatureLike) => {
        const name = feature.get('NAME') || feature.get('name') || '';
        const currentZoom = mapRef.current?.getView().getZoom() || 2;
        const showLabel = currentZoom > 6;
        
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#fff', width: 1 }),
          }),
          text: showLabel ? new Text({
            text: name,
            font: '10px sans-serif',
            offsetY: -10,
            fill: new Fill({ color: '#333' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }) : undefined,
        });
      };
    } else if (layerInfo.geometryType === 'LineString' || layerInfo.geometryType === 'MultiLineString') {
      return new Style({
        stroke: new Stroke({ color, width: weight }),
      });
    } else {
      return new Style({
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color, width: weight }),
      });
    }
  }, []);

  // Fetch layer info from registry on mount
  useEffect(() => {
    const fetchLayerInfo = async () => {
      try {
        const layers = await spatialService.getAvailableLayers();
        console.log(`[MapView] Loaded ${layers.length} layer definitions from registry`);
        const cache = new Map<string, LayerInfo>();
        layers.forEach(l => cache.set(l.name, l));
        setLayerInfoCache(cache);
      } catch (err) {
        console.error('[MapView] Failed to fetch layer info:', err);
      }
    };
    fetchLayerInfo();
  }, []);

  // Load data for a dynamic layer
  const loadDynamicLayerData = useCallback(async (layerName: string, extent: Extent) => {
    if (dynamicLayerLoadingRef.current.has(layerName)) {
      console.log(`[MapView] Skip ${layerName} - already loading`);
      return;
    }
    
    const map = mapRef.current;
    if (!map) {
      console.log(`[MapView] Skip ${layerName} - no map`);
      return;
    }

    console.log(`[MapView] Loading layer: ${layerName}`);

    // Get or create layer
    let layer = dynamicLayersRef.current.get(layerName);
    const layerInfo = layerInfoCache.get(layerName);
    
    if (!layer) {
      console.log(`[MapView] Creating new OpenLayers layer for: ${layerName}`);
      // Create new layer
      const source = new VectorSource();
      const style = layerInfo ? createDynamicLayerStyle(layerInfo) : new Style({
        fill: new Fill({ color: 'rgba(100, 100, 200, 0.3)' }),
        stroke: new Stroke({ color: '#6464c8', width: 1 }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#6464c8' }),
          stroke: new Stroke({ color: '#fff', width: 1 }),
        }),
      });
      
      layer = new VectorLayer({
        source,
        style,
        zIndex: 10 + dynamicLayersRef.current.size,
      });
      
      dynamicLayersRef.current.set(layerName, layer);
      map.addLayer(layer);
      console.log(`[MapView] Added layer to map: ${layerName}`);
    }

    const source = layer.getSource();
    if (!source) return;

    // Check cache - skip if we already have data for this extent
    const cached = dynamicLayerCacheRef.current.get(layerName);
    if (cached && extentContains(cached.extent, extent) && Math.abs(cached.zoom - viewZoom) < 1) {
      console.log(`[MapView] Skip ${layerName} - using cached data`);
      return;
    }

    dynamicLayerLoadingRef.current.add(layerName);

    try {
      // Expand extent for fetching
      const paddedExtent = clampExtent(expandExtent(extent, 5));
      
      console.log(`[MapView] Fetching GeoJSON for ${layerName}...`);
      const collection = await spatialService.getDynamicLayerGeoJSON(layerName, {
        bbox: paddedExtent as [number, number, number, number],
        maxFeatures: 5000, // Let spatialService apply appropriate limits per layer type
      });
      
      console.log(`[MapView] Got ${collection.features.length} features for ${layerName}`);
      
      const geojson = new OLGeoJSON();
      const features = geojson.readFeatures(collection, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      
      source.clear();
      source.addFeatures(features);
      
      // Update cache
      dynamicLayerCacheRef.current.set(layerName, { extent: paddedExtent, zoom: viewZoom });
      
      console.log(`[MapView] ✅ Loaded ${features.length} features for ${layerName}`);
    } catch (error) {
      console.error(`[MapView] ❌ Failed to load dynamic layer ${layerName}:`, error);
    } finally {
      dynamicLayerLoadingRef.current.delete(layerName);
    }
  }, [layerInfoCache, createDynamicLayerStyle, viewZoom]);

  // Handle dynamic layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.log('[MapView] Dynamic layers effect - no map');
      return;
    }
    if (!dynamicLayers) {
      console.log('[MapView] Dynamic layers effect - no dynamicLayers prop');
      return;
    }
    if (!viewExtent4326) {
      console.log('[MapView] Dynamic layers effect - no viewExtent');
      return;
    }
    
    console.log(`[MapView] Dynamic layers effect - ${dynamicLayers.size} layers enabled:`, Array.from(dynamicLayers));

    // Get current dynamic layer names
    const currentLayerNames = new Set(dynamicLayersRef.current.keys());
    
    // Remove layers that are no longer enabled
    currentLayerNames.forEach(name => {
      if (!dynamicLayers.has(name)) {
        const layer = dynamicLayersRef.current.get(name);
        if (layer) {
          map.removeLayer(layer);
          dynamicLayersRef.current.delete(name);
          dynamicLayerCacheRef.current.delete(name);
        }
      }
    });

    // Add/update enabled layers
    dynamicLayers.forEach(layerName => {
      // Skip legacy layers - they're handled separately
      if (['countries', 'cities', 'airports', 'rivers', 'lakes'].includes(layerName)) {
        return;
      }
      
      void loadDynamicLayerData(layerName, viewExtent4326);
    });
  }, [dynamicLayers, viewExtent4326, loadDynamicLayerData]);

  // Update user drawings layer
  useEffect(() => {
    const layer = layersRef.current.userDrawings;
    if (!layer || !userDrawings) return;
    
    const source = layer.getSource();
    if (!source) return;
    
    source.clear();
    const geojson = new OLGeoJSON();
    const features = geojson.readFeatures(userDrawings, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    source.addFeatures(features);
  }, [userDrawings]);

  // Update highlight layer
  useEffect(() => {
    const layer = layersRef.current.highlight;
    if (!layer) return;
    
    const source = layer.getSource();
    if (!source) return;
    
    source.clear();
    if (highlightData) {
      const geojson = new OLGeoJSON();
      const features = geojson.readFeatures(highlightData, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      source.addFeatures(features);
    }
  }, [highlightData]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    
    fitExtent: (extent, options) => {
      const map = mapRef.current;
      if (!map) return;
      
      const transformedExtent = transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
      map.getView().fit(transformedExtent, {
        padding: options?.padding || [50, 50, 50, 50],
        duration: options?.duration || 500,
      });
    },
    
    flyTo: (targetCenter, targetZoom, duration = 1000) => {
      const map = mapRef.current;
      if (!map) return;
      
      const view = map.getView();
      view.animate({
        center: fromLonLat(targetCenter),
        zoom: targetZoom ?? view.getZoom(),
        duration,
      });
    },
    
    getExtent: () => {
      const map = mapRef.current;
      if (!map) return [0, 0, 0, 0];
      
      const extent = map.getView().calculateExtent(map.getSize());
      return transformExtent(extent, 'EPSG:3857', 'EPSG:4326') as [number, number, number, number];
    },
    
    getCenter: () => {
      const map = mapRef.current;
      if (!map) return [0, 0];
      
      const centerCoord = map.getView().getCenter();
      return (centerCoord ? toLonLat(centerCoord) : [0, 0]) as [number, number];
    },
    
    getZoom: () => {
      return mapRef.current?.getView().getZoom() || 2;
    },
    
    highlightFeatures: (geojson) => {
      const layer = layersRef.current.highlight;
      if (!layer) return;
      
      const source = layer.getSource();
      if (!source) return;
      
      source.clear();
      const format = new OLGeoJSON();
      const features = format.readFeatures(geojson, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      source.addFeatures(features);
    },
    
    clearHighlight: () => {
      const layer = layersRef.current.highlight;
      if (!layer) return;
      
      layer.getSource()?.clear();
    },
    
    updateUserDrawings: (geojson) => {
      const layer = layersRef.current.userDrawings;
      if (!layer) return;
      
      const source = layer.getSource();
      if (!source) return;
      
      source.clear();
      const format = new OLGeoJSON();
      const features = format.readFeatures(geojson, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      source.addFeatures(features);
    },
    
    getFeaturesAtPixel: (pixel) => {
      const map = mapRef.current;
      if (!map) return [];
      
      const features: OlFeature[] = [];
      map.forEachFeatureAtPixel(pixel, (feature) => {
        features.push(feature as OlFeature);
      });
      return features;
    },
  }), []);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height,
        position: 'relative',
      }}
    />
  );
});

MapView.displayName = 'MapView';

export default MapView;
