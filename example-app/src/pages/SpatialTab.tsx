/**
 * SpatialTab - Main Spatial Demo Hub
 * 
 * Interactive map with Natural Earth data, drawing tools,
 * and navigation to spatial function demo pages.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonBadge,
  IonChip,
  IonLabel,
  IonModal,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonProgressBar,
  IonText,
  IonFab,
  IonFabButton,
  useIonToast,
  IonSearchbar,
} from '@ionic/react';
import {
  layersOutline,
  constructOutline,
  gitCompareOutline,
  analyticsOutline,
  colorWandOutline,
  swapHorizontalOutline,
  statsChartOutline,
  gitBranchOutline,
  codeSlashOutline,
  mapOutline,
  navigateOutline,
  informationCircleOutline,
  refreshOutline,
} from 'ionicons/icons';

import MapView, { type MapViewRef } from '../components/map/MapView';
import DrawingToolbar, { type DrawingMode, type DrawingToolbarRef } from '../components/map/DrawingToolbar';
import LayerSelector from '../components/map/LayerSelector';
import spatialService, { type SpatialStats } from '../services/spatialService';
import settingsService, { DEFAULT_SETTINGS, type UserLayerVisibility } from '../services/settingsService';
import type { Feature as OlFeature } from 'ol';
import type { FeatureCollection } from 'geojson';
import WKT from 'ol/format/WKT';

import './SpatialTab.css';

// ============================================================================
// Function Categories for Navigation
// ============================================================================

interface FunctionCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  functions: string[];
  color: string;
  route: string;
}

const FUNCTION_CATEGORIES: FunctionCategory[] = [
  {
    id: 'constructors',
    title: 'Constructors',
    icon: constructOutline,
    description: 'Create geometries from coordinates',
    functions: ['ST_Point', 'ST_MakeLine', 'ST_MakePolygon', 'ST_Collect', 'ST_MakeEnvelope'],
    color: 'primary',
    route: '/spatial/constructors',
  },
  {
    id: 'predicates',
    title: 'Predicates',
    icon: gitCompareOutline,
    description: 'Test spatial relationships',
    functions: ['ST_Contains', 'ST_Intersects', 'ST_Within', 'ST_DWithin', 'ST_Covers'],
    color: 'secondary',
    route: '/spatial/predicates',
  },
  {
    id: 'measurements',
    title: 'Measurements',
    icon: analyticsOutline,
    description: 'Calculate distances and areas',
    functions: ['ST_Distance', 'ST_Distance_Spheroid', 'ST_Area', 'ST_Length', 'ST_Perimeter'],
    color: 'tertiary',
    route: '/spatial/measurements',
  },
  {
    id: 'processing',
    title: 'Processing',
    icon: colorWandOutline,
    description: 'Transform and combine geometries',
    functions: ['ST_Buffer', 'ST_Union', 'ST_Intersection', 'ST_Difference', 'ST_ConvexHull'],
    color: 'success',
    route: '/spatial/processing',
  },
  {
    id: 'transforms',
    title: 'Transforms',
    icon: swapHorizontalOutline,
    description: 'Coordinate systems and simplification',
    functions: ['ST_Transform', 'ST_Simplify', 'ST_SimplifyPreserveTopology', 'ST_ReducePrecision'],
    color: 'warning',
    route: '/spatial/transforms',
  },
  {
    id: 'aggregates',
    title: 'Aggregates',
    icon: statsChartOutline,
    description: 'Combine multiple geometries',
    functions: ['ST_Union_Agg', 'ST_Extent_Agg', 'ST_Intersection_Agg', 'ST_Collect'],
    color: 'danger',
    route: '/spatial/aggregates',
  },
  {
    id: 'lineops',
    title: 'Line Operations',
    icon: gitBranchOutline,
    description: 'Work with linestrings and paths',
    functions: ['ST_LineInterpolatePoint', 'ST_LineSubstring', 'ST_ShortestLine', 'ST_LineMerge'],
    color: 'medium',
    route: '/spatial/lineops',
  },
  {
    id: 'io',
    title: 'I/O Formats',
    icon: codeSlashOutline,
    description: 'Convert between formats',
    functions: ['ST_AsGeoJSON', 'ST_AsText', 'ST_AsWKB', 'ST_GeomFromText', 'ST_GeomFromGeoJSON'],
    color: 'dark',
    route: '/spatial/io',
  },
];

// ============================================================================
// Component
// ============================================================================

const SpatialTab: React.FC = () => {
  const history = useHistory();
  const mapRef = useRef<MapViewRef>(null);
  const drawingToolbarRef = useRef<DrawingToolbarRef>(null);
  const [presentToast] = useIonToast();

  // State
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [stats, setStats] = useState<SpatialStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Map settings
  const [mapSettings, setMapSettings] = useState({
    center: DEFAULT_SETTINGS.defaultMapCenter,
    zoom: DEFAULT_SETTINGS.defaultMapZoom
  });
  const [userLayerVisibility, setUserLayerVisibility] = useState<UserLayerVisibility>(DEFAULT_SETTINGS.userLayerVisibility);
  const [userDrawings, setUserDrawings] = useState<FeatureCollection>({ type: 'FeatureCollection', features: [] });

  // Dynamic layers from layer registry
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());
  const [pendingLayers, setPendingLayers] = useState<Set<string>>(new Set()); // Layers selected but not yet applied
  const [useDynamicLayers, setUseDynamicLayers] = useState(false);

  // UI state
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [, setDrawingMode] = useState<DrawingMode>('none');

  // Initialize spatial demo
  useEffect(() => {
    const init = async () => {
      try {
        // Load settings first
        try {
          const settings = await settingsService.getSettings();
          setMapSettings({
            center: settings.defaultMapCenter,
            zoom: settings.defaultMapZoom
          });
          setUserLayerVisibility(settings.userLayerVisibility);
        } catch (e) {
          console.warn('[SpatialTab] Failed to load settings, using defaults', e);
        }

        const result = await spatialService.initialize((message, percent) => {
          setLoadingMessage(message);
          setLoadingProgress(percent / 100);
        });
        setStats(result);

        // Load user drawings
        try {
          const drawings = await spatialService.getDrawingsGeoJSON();
          setUserDrawings(drawings);
        } catch (e) {
          console.warn('[SpatialTab] Failed to load user drawings', e);
        }

        // Try to load dynamic layers from registry
        try {
          const layers = await spatialService.getAvailableLayers();
          console.log(`[SpatialTab] Got ${layers.length} layers from registry`);
          if (layers.length > 0) {
            setUseDynamicLayers(true);
            // Enable default layers
            const defaultEnabled = new Set(
              layers.filter(l => l.enabledByDefault).map(l => l.name)
            );
            console.log(`[SpatialTab] Default enabled layers:`, Array.from(defaultEnabled));
            setEnabledLayers(defaultEnabled);
            setPendingLayers(defaultEnabled);
          }
        } catch (e) {
          console.log('[SpatialTab] Dynamic layers not available, using legacy mode', e);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize spatial demo:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    init();
  }, []);

  // Handle map click
  const handleMapClick = useCallback((coords: [number, number], features: OlFeature[]) => {
    if (features.length > 0) {
      const feature = features[0];
      const name = feature.get('NAME') || feature.get('name') || 'Unknown';
      presentToast({
        message: `Clicked: ${name} (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`,
        duration: 2000,
        position: 'bottom',
      });
    }
  }, [presentToast]);

  // Handle drawing mode change
  const handleModeChange = useCallback((mode: DrawingMode) => {
    setDrawingMode(mode);
  }, []);

  // Handle layer toggle for dynamic layers (updates pending, not active)
  const handleLayerToggle = useCallback((layerName: string, enabled: boolean) => {
    console.log(`[SpatialTab] Layer toggle (pending): ${layerName} = ${enabled}`);
    setPendingLayers(prev => {
      const next = new Set(prev);
      if (enabled) {
        next.add(layerName);
      } else {
        next.delete(layerName);
      }
      return next;
    });
  }, []);

  // Handle bulk toggle for dynamic layers (updates pending, not active)
  const handleBulkToggle = useCallback((layerNames: string[], enabled: boolean) => {
    console.log(`[SpatialTab] Bulk toggle (pending): ${layerNames.length} layers = ${enabled}`);
    setPendingLayers(prev => {
      const next = new Set(prev);
      layerNames.forEach(name => {
        if (enabled) {
          next.add(name);
        } else {
          next.delete(name);
        }
      });
      return next;
    });
  }, []);

  // Handle settings change from LayerSelector
  const handleSettingsChange = useCallback((newSettings: typeof DEFAULT_SETTINGS) => {
    setUserLayerVisibility(newSettings.userLayerVisibility);
    setMapSettings({
      center: newSettings.defaultMapCenter,
      zoom: newSettings.defaultMapZoom
    });
  }, []);

  // Apply pending layers when panel closes
  const handleLayerPanelClose = useCallback(() => {
    console.log(`[SpatialTab] Applying ${pendingLayers.size} layers:`, Array.from(pendingLayers));
    setEnabledLayers(new Set(pendingLayers));
    setShowLayerPanel(false);
  }, [pendingLayers]);

  // Reset pending layers when panel opens
  const handleLayerPanelOpen = useCallback(() => {
    setPendingLayers(new Set(enabledLayers));
    setShowLayerPanel(true);
  }, [enabledLayers]);

  // Handle geometry complete (save to database)
  const handleGeometryComplete = useCallback(async (_geometry: unknown, type: DrawingMode, wkt: string) => {
    try {
      const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${Date.now()}`;
      await spatialService.saveDrawing(name, type, wkt);
      
      presentToast({
        message: `Saved ${type} geometry`,
        duration: 2000,
        color: 'success',
      });

      // Refresh stats and drawings
      const [newStats, newDrawings] = await Promise.all([
        spatialService.getStats(),
        spatialService.getDrawingsGeoJSON()
      ]);
      setStats(newStats);
      setUserDrawings(newDrawings);
      
      // Clear the drawing from the toolbar since it's now in the map view
      drawingToolbarRef.current?.clearDrawings();
    } catch (err) {
      console.error('Failed to save geometry:', err);
      presentToast({
        message: 'Failed to save geometry',
        duration: 2000,
        color: 'danger',
      });
    }
  }, [presentToast]);

  // Handle geometry delete
  const handleGeometryDelete = useCallback(async (feature: OlFeature) => {
    try {
      const id = feature.getId();
      if (typeof id === 'number') {
        await spatialService.deleteDrawing(id);
        presentToast({ message: 'Drawing deleted', duration: 2000, color: 'success' });
        
        // Refresh
        const [newStats, newDrawings] = await Promise.all([
          spatialService.getStats(),
          spatialService.getDrawingsGeoJSON()
        ]);
        setStats(newStats);
        setUserDrawings(newDrawings);
      }
    } catch (err) {
      console.error('Failed to delete geometry:', err);
    }
  }, [presentToast]);

  // Handle geometry modify
  const handleGeometryModify = useCallback(async (feature: OlFeature) => {
    try {
      const id = feature.getId();
      if (typeof id === 'number') {
        const geometry = feature.getGeometry();
        if (geometry) {
          const format = new WKT();
          const wkt = format.writeGeometry(geometry, {
            featureProjection: 'EPSG:3857',
            dataProjection: 'EPSG:4326',
          });
          await spatialService.updateUserDrawingGeometry(id, wkt);
          presentToast({ message: 'Drawing updated', duration: 2000, color: 'success' });
          
          // Refresh
          const newDrawings = await spatialService.getDrawingsGeoJSON();
          setUserDrawings(newDrawings);
        }
      }
    } catch (err) {
      console.error('Failed to update geometry:', err);
    }
  }, [presentToast]);

  // Navigate to demo page
  const navigateToDemo = useCallback((route: string) => {
    setShowCategorySheet(false);
    history.push(route);
  }, [history]);

  // Filter categories
  const filteredCategories = FUNCTION_CATEGORIES.filter(
    (cat) =>
      cat.title.toLowerCase().includes(categoryFilter.toLowerCase()) ||
      cat.functions.some((f) => f.toLowerCase().includes(categoryFilter.toLowerCase()))
  );

  // Refresh data
  const handleRefresh = useCallback(async () => {
    try {
      const newStats = await spatialService.getStats();
      setStats(newStats);
      presentToast({ message: 'Data refreshed', duration: 1500 });
    } catch (err) {
      console.error('Failed to refresh:', err);
    }
  }, [presentToast]);

  // Loading screen
  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div className="loading-container">
            <div className="loading-icon">🌍</div>
            <h2>Loading Spatial Demo</h2>
            <p>{loadingMessage}</p>
            <IonProgressBar value={loadingProgress} color="primary" />
            <IonText color="medium">
              <p>{Math.round(loadingProgress * 100)}%</p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // Error screen
  if (error) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>Spatial Extension Not Available</h2>
            <p>{error}</p>
            <IonButton onClick={() => window.location.reload()}>
              <IonIcon slot="start" icon={refreshOutline} />
              Retry
            </IonButton>
            <IonText color="medium">
              <p className="hint">
                Make sure DuckDB was built using the build scripts (spatial is included by default).
              </p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>
            <span className="title-icon">🌍</span>
            Spatial Demo
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleRefresh}>
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
            <IonButton onClick={handleLayerPanelOpen}>
              <IonIcon slot="icon-only" icon={layersOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Stats bar */}
        <div className="stats-bar">
          {stats?.version.loaded && (
            <IonChip color="success" outline>
              <IonLabel>Spatial v{stats.version.version}</IonLabel>
            </IonChip>
          )}
          <IonChip color="medium" outline>
            <IonIcon icon={mapOutline} />
            <IonLabel>{stats?.countries || 0} countries</IonLabel>
          </IonChip>
          <IonChip color="medium" outline>
            <IonIcon icon={navigateOutline} />
            <IonLabel>{stats?.cities || 0} cities</IonLabel>
          </IonChip>
        </div>

        {/* Map */}
        <div className="map-container">
          <MapView
            ref={mapRef}
            center={mapSettings.center}
            zoom={mapSettings.zoom}
            showCountries={!useDynamicLayers}
            dynamicLayers={useDynamicLayers ? enabledLayers : undefined}
            userDrawings={userDrawings}
            userLayerVisibility={userLayerVisibility}
            onMapClick={handleMapClick}
            height="100%"
          />

          {/* Drawing toolbar */}
          <DrawingToolbar
            ref={drawingToolbarRef}
            map={mapRef.current?.getMap() ?? null}
            onModeChange={handleModeChange}
            onGeometryComplete={handleGeometryComplete}
            onGeometryDelete={handleGeometryDelete}
            onGeometryModify={handleGeometryModify}
            snapEnabled={true}
            snapTolerance={20}
          />
        </div>

        {/* Function categories button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: '60px' }}>
          <IonFabButton color="secondary" onClick={() => setShowCategorySheet(true)}>
            <IonIcon icon={constructOutline} />
          </IonFabButton>
        </IonFab>

        {/* Layer panel modal */}
        <IonModal isOpen={showLayerPanel} onDidDismiss={handleLayerPanelClose}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Map Layers</IonTitle>
              <IonButtons slot="start">
                <IonButton onClick={() => { setPendingLayers(new Set(enabledLayers)); setShowLayerPanel(false); }}>
                  Cancel
                </IonButton>
              </IonButtons>
              <IonButtons slot="end">
                <IonButton strong onClick={handleLayerPanelClose}>Apply</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <LayerSelector
              enabledLayers={pendingLayers}
              onLayerToggle={handleLayerToggle}
              onBulkToggle={handleBulkToggle}
              onSettingsChange={handleSettingsChange}
              maxHeight="calc(100vh - 130px)"
            />
            
            {/* Data Source Info - Only show if we have layers or if we want to show attribution */}
            <div style={{ padding: '0 16px 16px' }}>
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>
                    <IonIcon icon={informationCircleOutline} /> Data Source
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <p>
                    Map data from <strong>Natural Earth</strong>.
                    <br />
                    License: Public Domain (CC0)
                  </p>
                  <p>
                    <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">
                      naturalearthdata.com
                    </a>
                  </p>
                </IonCardContent>
              </IonCard>
            </div>
          </IonContent>
        </IonModal>

        {/* Function categories sheet */}
        <IonModal
          isOpen={showCategorySheet}
          onDidDismiss={() => setShowCategorySheet(false)}
          breakpoints={[0, 0.5, 0.9]}
          initialBreakpoint={0.5}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Spatial Functions</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowCategorySheet(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
            <IonToolbar>
              <IonSearchbar
                value={categoryFilter}
                onIonInput={(e) => setCategoryFilter(e.detail.value || '')}
                placeholder="Search functions..."
              />
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div className="category-grid">
              {filteredCategories.map((category) => (
                <IonCard
                  key={category.id}
                  button
                  onClick={() => navigateToDemo(category.route)}
                  className="category-card"
                >
                  <IonCardHeader>
                    <div className={`category-icon ${category.color}`}>
                      <IonIcon icon={category.icon} />
                    </div>
                    <IonCardTitle>{category.title}</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <p>{category.description}</p>
                    <div className="function-chips">
                      {category.functions.slice(0, 3).map((fn) => (
                        <IonBadge key={fn} color={category.color}>
                          {fn}
                        </IonBadge>
                      ))}
                      {category.functions.length > 3 && (
                        <IonBadge color="medium">+{category.functions.length - 3}</IonBadge>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default SpatialTab;
