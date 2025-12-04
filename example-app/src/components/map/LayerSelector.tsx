/**
 * LayerSelector Component
 * 
 * A comprehensive layer selection panel that displays all available
 * Natural Earth 10m layers grouped by category with checkboxes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonItemDivider,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonSearchbar,
  IonChip,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonInput,
  IonToggle,
  IonRange,
  IonCard,
  IonCardContent,
} from '@ionic/react';
import {
  earthOutline,
  waterOutline,
  businessOutline,
  carOutline,
  mapOutline,
  leafOutline,
  layersOutline,
  settingsOutline,
} from 'ionicons/icons';

import { spatialService, type LayerInfo } from '../../services/spatialService';
import settingsService, { 
  type AppSettings, 
  type MapLayerLimits,
  type UserLayerVisibility,
  DEFAULT_SETTINGS 
} from '../../services/settingsService';
import './LayerSelector.css';

// ============================================================================
// Types
// ============================================================================

export interface LayerSelectorProps {
  /** Currently enabled layers (by name) */
  enabledLayers: Set<string>;
  /** Callback when layer visibility changes */
  onLayerToggle: (layerName: string, enabled: boolean) => void;
  /** Callback to enable/disable multiple layers at once */
  onBulkToggle?: (layerNames: string[], enabled: boolean) => void;
  /** Callback when settings change */
  onSettingsChange?: (settings: AppSettings) => void;
  /** Whether the selector is in compact mode */
  compact?: boolean;
  /** Maximum height for the selector */
  maxHeight?: string;
}

// ============================================================================
// Category Icons & Colors
// ============================================================================

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  physical: { icon: earthOutline, color: '#4CAF50', label: 'Physical Features' },
  boundaries: { icon: mapOutline, color: '#FF9800', label: 'Administrative' },
  places: { icon: businessOutline, color: '#E91E63', label: 'Places' },
  transport: { icon: carOutline, color: '#9C27B0', label: 'Transportation' },
  water: { icon: waterOutline, color: '#2196F3', label: 'Water Bodies' },
  other: { icon: leafOutline, color: '#607D8B', label: 'Other' },
};

// ============================================================================
// Component
// ============================================================================

const LayerSelector: React.FC<LayerSelectorProps> = ({
  enabledLayers,
  onLayerToggle,
  onBulkToggle,
  onSettingsChange,
  compact = false,
  maxHeight = '400px',
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'settings'>('layers');
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['boundaries', 'physical']));
  
  // Settings state
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load layers and settings
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [availableLayers, appSettings] = await Promise.all([
          spatialService.getAvailableLayers(),
          settingsService.getSettings()
        ]);
        setLayers(availableLayers);
        setSettings(appSettings);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Settings handlers
  const updateLayerLimit = useCallback(async (key: keyof MapLayerLimits, value: number) => {
    const newSettings = {
      ...settings,
      mapLayerLimits: { ...settings.mapLayerLimits, [key]: value },
    };
    setSettings(newSettings);
    await settingsService.setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [settings, onSettingsChange]);

  const updateUserLayerVisibility = useCallback(async (key: keyof UserLayerVisibility, value: boolean) => {
    const newSettings = {
      ...settings,
      userLayerVisibility: { ...settings.userLayerVisibility, [key]: value },
    };
    setSettings(newSettings);
    await settingsService.setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [settings, onSettingsChange]);

  const updateBooleanSetting = useCallback(async (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await settingsService.setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [settings, onSettingsChange]);

  const updateNumberSetting = useCallback(async (key: keyof AppSettings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await settingsService.setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [settings, onSettingsChange]);

  // Group layers by category
  const layersByCategory = useMemo(() => {
    const filtered = searchText
      ? layers.filter(l => 
          l.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
          l.description.toLowerCase().includes(searchText.toLowerCase())
        )
      : layers;

    return filtered.reduce((acc, layer) => {
      const cat = layer.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(layer);
      return acc;
    }, {} as Record<string, LayerInfo[]>);
  }, [layers, searchText]);

  // Count enabled layers per category
  const enabledCountByCategory = useMemo(() => {
    return Object.entries(layersByCategory).reduce((acc, [cat, catLayers]) => {
      acc[cat] = catLayers.filter(l => enabledLayers.has(l.name)).length;
      return acc;
    }, {} as Record<string, number>);
  }, [layersByCategory, enabledLayers]);

  // Total stats
  const totalEnabled = enabledLayers.size;
  const totalLayers = layers.length;

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Toggle all layers in a category
  const toggleCategoryLayers = (category: string, enabled: boolean) => {
    const catLayers = layersByCategory[category] || [];
    if (onBulkToggle) {
      onBulkToggle(catLayers.map(l => l.name), enabled);
    } else {
      catLayers.forEach(l => onLayerToggle(l.name, enabled));
    }
  };

  if (loading) {
    return (
      <div className="layer-selector-loading">
        <IonSpinner name="crescent" />
        <IonText color="medium">Loading layers...</IonText>
      </div>
    );
  }

  if (layers.length === 0) {
    return (
      <div className="layer-selector-empty">
        <IonIcon icon={layersOutline} />
        <IonText color="medium">No layers available</IonText>
        <IonText color="medium" className="ion-text-center">
          <small>Run the database preparation script to load Natural Earth 10m data.</small>
        </IonText>
      </div>
    );
  }

  return (
    <div className="layer-selector" style={{ maxHeight }}>
      {/* Tabs */}
      <IonSegment value={activeTab} onIonChange={e => setActiveTab(e.detail.value as 'layers' | 'settings')}>
        <IonSegmentButton value="layers">
          <IonLabel>Layers</IonLabel>
          <IonIcon icon={layersOutline} />
        </IonSegmentButton>
        <IonSegmentButton value="settings">
          <IonLabel>Settings</IonLabel>
          <IonIcon icon={settingsOutline} />
        </IonSegmentButton>
      </IonSegment>

      {activeTab === 'layers' ? (
        <>
          {/* Header with stats */}
          <div className="layer-selector-header">
            <IonSearchbar
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value || '')}
              placeholder="Search layers..."
              debounce={200}
              className="layer-search"
            />
            <div className="layer-stats">
              <IonChip color={totalEnabled > 0 ? 'primary' : 'medium'} outline>
                <IonIcon icon={layersOutline} />
                <IonLabel>{totalEnabled} / {totalLayers} enabled</IonLabel>
              </IonChip>
            </div>
          </div>

          {/* Layer list by category */}
          <IonList className="layer-list">
            {Object.entries(layersByCategory).map(([category, catLayers]) => {
              const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
              const isExpanded = expandedCategories.has(category);
              const enabledCount = enabledCountByCategory[category] || 0;

              return (
                <div key={category} className="layer-category">
                  {/* Category header */}
                  <IonItemDivider 
                    className="category-header"
                    onClick={() => toggleCategory(category)}
                    style={{ cursor: 'pointer', '--background': `${config.color}15` }}
                  >
                    <IonIcon 
                      icon={config.icon} 
                      slot="start" 
                      style={{ color: config.color }}
                    />
                    <IonLabel>
                      <h3>{config.label}</h3>
                      <p>{catLayers.length} layers</p>
                    </IonLabel>
                    <IonBadge 
                      slot="end" 
                      color={enabledCount > 0 ? 'primary' : 'medium'}
                    >
                      {enabledCount}
                    </IonBadge>
                    {!compact && (
                      <IonCheckbox
                        slot="end"
                        checked={enabledCount === catLayers.length}
                        indeterminate={enabledCount > 0 && enabledCount < catLayers.length}
                        onIonChange={(e) => {
                          e.stopPropagation();
                          toggleCategoryLayers(category, e.detail.checked);
                        }}
                        style={{ marginLeft: '8px' }}
                      />
                    )}
                  </IonItemDivider>

                  {/* Layer items */}
                  {isExpanded && catLayers.map((layer) => (
                    <IonItem 
                      key={layer.name}
                      className={`layer-item ${enabledLayers.has(layer.name) ? 'enabled' : ''}`}
                      lines="none"
                    >
                      <div 
                        className="layer-color-indicator"
                        style={{ backgroundColor: layer.styleColor }}
                        slot="start"
                      />
                      <IonLabel>
                        <h3>{layer.displayName}</h3>
                        {!compact && (
                          <p>
                            {layer.featureCount.toLocaleString()} features
                            {layer.geometryType && ` • ${layer.geometryType}`}
                          </p>
                        )}
                      </IonLabel>
                      <IonCheckbox
                        slot="end"
                        checked={enabledLayers.has(layer.name)}
                        onIonChange={(e) => onLayerToggle(layer.name, e.detail.checked)}
                      />
                    </IonItem>
                  ))}
                </div>
              );
            })}
          </IonList>
        </>
      ) : (
        <div className="layer-settings">
          {/* User Layer Visibility */}
          <IonCard>
            <IonCardContent>
              <IonText color="medium">
                <h3>User Drawings</h3>
              </IonText>
              <IonList lines="none">
                <IonItem>
                  <IonLabel>Points</IonLabel>
                  <IonToggle
                    checked={settings.userLayerVisibility.points}
                    onIonChange={(e) => updateUserLayerVisibility('points', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel>Lines</IonLabel>
                  <IonToggle
                    checked={settings.userLayerVisibility.lines}
                    onIonChange={(e) => updateUserLayerVisibility('lines', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel>Polygons</IonLabel>
                  <IonToggle
                    checked={settings.userLayerVisibility.polygons}
                    onIonChange={(e) => updateUserLayerVisibility('polygons', e.detail.checked)}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Map Layer Limits */}
          <IonCard>
            <IonCardContent>
              <IonText color="medium">
                <h3>Feature Limits</h3>
                <p style={{ fontSize: '0.8em' }}>Max features to load per layer type</p>
              </IonText>
              <IonList lines="none">
                <IonItem>
                  <IonLabel>
                    <h3>Bathymetry</h3>
                    <p>Heavy polygons</p>
                  </IonLabel>
                  <IonInput
                    type="number"
                    value={settings.mapLayerLimits.bathymetry}
                    onIonChange={(e) => updateLayerLimit('bathymetry', parseInt(e.detail.value!, 10) || 0)}
                    style={{ textAlign: 'right' }}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h3>Polygons</h3>
                    <p>Countries, lakes</p>
                  </IonLabel>
                  <IonInput
                    type="number"
                    value={settings.mapLayerLimits.polygons}
                    onIonChange={(e) => updateLayerLimit('polygons', parseInt(e.detail.value!, 10) || 0)}
                    style={{ textAlign: 'right' }}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h3>Lines</h3>
                    <p>Rivers, roads</p>
                  </IonLabel>
                  <IonInput
                    type="number"
                    value={settings.mapLayerLimits.lines}
                    onIonChange={(e) => updateLayerLimit('lines', parseInt(e.detail.value!, 10) || 0)}
                    style={{ textAlign: 'right' }}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h3>Points</h3>
                    <p>Cities, places</p>
                  </IonLabel>
                  <IonInput
                    type="number"
                    value={settings.mapLayerLimits.points}
                    onIonChange={(e) => updateLayerLimit('points', parseInt(e.detail.value!, 10) || 0)}
                    style={{ textAlign: 'right' }}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Performance */}
          <IonCard>
            <IonCardContent>
              <IonText color="medium">
                <h3>Performance</h3>
              </IonText>
              <IonList lines="none">
                <IonItem>
                  <IonLabel>
                    <h3>Enable Caching</h3>
                    <p>Cache layers in memory</p>
                  </IonLabel>
                  <IonToggle
                    checked={settings.enableLayerCaching}
                    onIonChange={(e) => updateBooleanSetting('enableLayerCaching', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h3>Max Cached Layers</h3>
                  </IonLabel>
                  <IonRange
                    min={5}
                    max={20}
                    step={1}
                    pin
                    value={settings.maxCachedLayers}
                    onIonChange={(e) => updateNumberSetting('maxCachedLayers', e.detail.value as number)}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      )}
    </div>
  );
};

export default LayerSelector;
