/**
 * LayerSelector Component
 * 
 * A comprehensive layer selection panel that displays all available
 * Natural Earth 10m layers grouped by category with checkboxes.
 */

import { useState, useEffect, useMemo } from 'react';
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
} from '@ionic/react';
import {
  earthOutline,
  waterOutline,
  businessOutline,
  carOutline,
  mapOutline,
  leafOutline,
  layersOutline,
} from 'ionicons/icons';

import { spatialService, type LayerInfo } from '../../services/spatialService';
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
  compact = false,
  maxHeight = '400px',
}) => {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['boundaries', 'physical']));

  // Load layers from database
  useEffect(() => {
    async function loadLayers() {
      setLoading(true);
      try {
        const availableLayers = await spatialService.getAvailableLayers();
        setLayers(availableLayers);
      } catch (error) {
        console.error('Failed to load layers:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLayers();
  }, []);

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
    </div>
  );
};

export default LayerSelector;
