/**
 * DrawingToolbar Component
 * 
 * Touch-friendly toolbar for drawing geometries on the map
 * with snapping assistance and haptic feedback.
 */

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { IonFab, IonFabButton, IonFabList, IonIcon, IonBadge } from '@ionic/react';
import {
  locationOutline,
  removeOutline,
  squareOutline,
  pencilOutline,
  trashOutline,
  closeOutline,
  arrowUndoOutline,
  checkmarkOutline,
  layersOutline,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import OLMap from 'ol/Map';
import Draw, { DrawEvent } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import Select from 'ol/interaction/Select';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import WKT from 'ol/format/WKT';
import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';

import './DrawingToolbar.css';

// ============================================================================
// Types
// ============================================================================

export type DrawingMode = 'none' | 'point' | 'line' | 'polygon' | 'edit' | 'delete';

export interface DrawingToolbarProps {
  /** OpenLayers map instance */
  map: OLMap | null;
  /** Snap source for snapping to existing features */
  snapSource?: VectorSource;
  /** Callback when a geometry is completed */
  onGeometryComplete?: (geometry: Geometry, type: DrawingMode, wkt: string) => void;
  /** Callback when a geometry is deleted */
  onGeometryDelete?: (feature: Feature) => void;
  /** Callback when a geometry is modified */
  onGeometryModify?: (feature: Feature) => void;
  /** Callback when drawing mode changes */
  onModeChange?: (mode: DrawingMode) => void;
  /** Snap tolerance in pixels */
  snapTolerance?: number;
  /** Whether snapping is enabled */
  snapEnabled?: boolean;
  /** Position of the FAB */
  position?: 'bottom-start' | 'bottom-end';
}

export interface DrawingToolbarRef {
  /** Get current drawing mode */
  getMode: () => DrawingMode;
  /** Set drawing mode programmatically */
  setMode: (mode: DrawingMode) => void;
  /** Undo last vertex during drawing */
  undoLastVertex: () => void;
  /** Cancel current drawing */
  cancelDrawing: () => void;
  /** Get drawn features */
  getFeatures: () => Feature[];
  /** Clear all drawings */
  clearDrawings: () => void;
  /** Export drawings as GeoJSON */
  exportGeoJSON: () => string;
}

// ============================================================================
// Styles
// ============================================================================

const drawingStyle = new Style({
  fill: new Fill({ color: 'rgba(46, 204, 113, 0.3)' }),
  stroke: new Stroke({ color: '#27ae60', width: 3, lineDash: [5, 5] }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#27ae60' }),
    stroke: new Stroke({ color: '#fff', width: 2 }),
  }),
});

// Snap indicator style (reserved for future snap visualization)
// const snapIndicatorStyle = new Style({
//   image: new CircleStyle({
//     radius: 8,
//     fill: new Fill({ color: 'rgba(59, 130, 246, 0.3)' }),
//     stroke: new Stroke({ color: '#3b82f6', width: 2 }),
//   }),
// });

const selectedStyle = new Style({
  fill: new Fill({ color: 'rgba(231, 76, 60, 0.3)' }),
  stroke: new Stroke({ color: '#e74c3c', width: 3 }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#e74c3c' }),
    stroke: new Stroke({ color: '#fff', width: 2 }),
  }),
});

// ============================================================================
// Component
// ============================================================================

export const DrawingToolbar = forwardRef<DrawingToolbarRef, DrawingToolbarProps>(({
  map,
  snapSource,
  onGeometryComplete,
  onGeometryDelete,
  onGeometryModify,
  onModeChange,
  snapTolerance = 20,
  snapEnabled = true,
  position = 'bottom-start',
}, ref) => {
  const [mode, setMode] = useState<DrawingMode>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [vertexCount, setVertexCount] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

  // Refs for OpenLayers interactions
  const drawSourceRef = useRef<VectorSource>(new VectorSource());
  const drawLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const modifyInteractionRef = useRef<Modify | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const snapInteractionRef = useRef<Snap | null>(null);

  // Haptic feedback helper
  const triggerHaptic = useCallback(async (style: ImpactStyle = ImpactStyle.Light) => {
    try {
      await Haptics.impact({ style });
    } catch {
      // Haptics not available (e.g., on web)
    }
  }, []);

  // Initialize drawing layer
  useEffect(() => {
    if (!map) return;

    // Create drawing layer
    const drawLayer = new VectorLayer({
      source: drawSourceRef.current,
      style: drawingStyle,
      zIndex: 1000,
    });

    map.addLayer(drawLayer);
    drawLayerRef.current = drawLayer;

    return () => {
      map.removeLayer(drawLayer);
    };
  }, [map]);

  // Cleanup interactions when mode changes
  const cleanupInteractions = useCallback(() => {
    if (!map) return;

    // Remove existing interactions
    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    if (modifyInteractionRef.current) {
      if (Array.isArray(modifyInteractionRef.current)) {
        modifyInteractionRef.current.forEach(interaction => map.removeInteraction(interaction));
      } else {
        map.removeInteraction(modifyInteractionRef.current);
      }
      modifyInteractionRef.current = null;
    }
    if (selectInteractionRef.current) {
      map.removeInteraction(selectInteractionRef.current);
      selectInteractionRef.current = null;
    }
    if (snapInteractionRef.current) {
      map.removeInteraction(snapInteractionRef.current);
      snapInteractionRef.current = null;
    }

    setIsDrawing(false);
    setVertexCount(0);
  }, [map]);

  // Setup interactions based on mode
  useEffect(() => {
    if (!map) return;

    cleanupInteractions();

    if (mode === 'none') return;

    // Setup snap interaction if enabled
    if (snapEnabled && snapSource) {
      const snap = new Snap({
        source: snapSource,
        pixelTolerance: snapTolerance,
      });
      map.addInteraction(snap);
      snapInteractionRef.current = snap;

      // Listen for snap events (pointer move to detect snapping)
      const handlePointerMove = (e: PointerEvent) => {
        // Check if we're near a snap point
        const pixel = map.getEventPixel(e);
        const features = snapSource.getFeaturesAtCoordinate(
          map.getCoordinateFromPixel(pixel)
        );
        const snapping = features.length > 0;
        if (snapping !== isSnapping) {
          setIsSnapping(snapping);
          if (snapping) {
            triggerHaptic(ImpactStyle.Light);
          }
        }
      };
      map.getViewport().addEventListener('pointermove', handlePointerMove);
    }

    if (mode === 'point' || mode === 'line' || mode === 'polygon') {
      // Setup draw interaction
      const drawType = mode === 'point' ? 'Point' : mode === 'line' ? 'LineString' : 'Polygon';
      
      const draw = new Draw({
        source: drawSourceRef.current,
        type: drawType,
        style: drawingStyle,
      });

      draw.on('drawstart', (e) => {
        setIsDrawing(true);
        setVertexCount(1);
        triggerHaptic(ImpactStyle.Medium);

        // Update vertex count as user draws
        const feature = e.feature;
        const geometry = feature.getGeometry();
        if (geometry) {
          geometry.on('change', () => {
            const type = geometry.getType();
            let count = 0;
            
            if (type === 'LineString') {
              count = (geometry as any).getCoordinates().length;
            } else if (type === 'Polygon') {
              const coords = (geometry as any).getCoordinates();
              if (coords && coords.length > 0) {
                count = coords[0].length;
              }
            }
            setVertexCount(count);
          });
        }
      });

      draw.on('drawend', (e: DrawEvent) => {
        setIsDrawing(false);
        setVertexCount(0);
        triggerHaptic(ImpactStyle.Heavy);

        const geometry = e.feature.getGeometry();
        if (geometry && onGeometryComplete) {
          const format = new WKT();
          const wkt = format.writeGeometry(geometry, {
            featureProjection: 'EPSG:3857',
            dataProjection: 'EPSG:4326',
          });
          onGeometryComplete(geometry, mode, wkt);
        }
      });

      map.addInteraction(draw);
      drawInteractionRef.current = draw;

    } else if (mode === 'edit') {
      // Setup modify interaction
      const modify = new Modify({
        source: drawSourceRef.current,
      });

      const handleModifyEnd = (e: any) => {
        triggerHaptic(ImpactStyle.Medium);
        const features = e.features.getArray();
        if (features.length > 0 && onGeometryModify) {
          onGeometryModify(features[0]);
        }
      };

      modify.on('modifyend', handleModifyEnd);
      map.addInteraction(modify);
      modifyInteractionRef.current = modify;

      // Also allow modifying saved drawings
      const userDrawingsLayer = map.getLayers().getArray().find(l => l.get('name') === 'userDrawings') as VectorLayer<VectorSource>;
      if (userDrawingsLayer) {
        const modifyUser = new Modify({
          source: userDrawingsLayer.getSource()!,
        });
        modifyUser.on('modifyend', handleModifyEnd);
        map.addInteraction(modifyUser);
        // Store it in a way we can remove it. 
        // Since we only have one ref, we'll attach it to the map data or just use a local variable?
        // We need to clean it up in cleanupInteractions.
        // Let's use a custom property on the ref or just add it to the map and let cleanup remove all interactions?
        // cleanupInteractions removes specific refs.
        // We should probably change modifyInteractionRef to hold an array or just add a second ref.
        // For simplicity, let's just add it to the map and rely on a more robust cleanup.
        // Actually, cleanupInteractions only removes what's in the refs.
        // Let's hack it: store the second interaction in the same ref? No, it's typed.
        // Let's just add it to the map and not track it? No, then it won't be removed.
        // Let's add a secondary ref or array.
        (modifyInteractionRef.current as any) = [modify, modifyUser]; 
      }

    } else if (mode === 'delete') {
      // Setup select interaction for deletion
      const layers = [drawLayerRef.current!];
      const userDrawingsLayer = map.getLayers().getArray().find(l => l.get('name') === 'userDrawings') as VectorLayer<VectorSource>;
      if (userDrawingsLayer) {
        layers.push(userDrawingsLayer);
      }

      const select = new Select({
        style: selectedStyle,
        layers,
      });

      select.on('select', (e) => {
        const selected = e.selected;
        if (selected.length > 0) {
          triggerHaptic(ImpactStyle.Heavy);
          
          // Remove the selected feature
          selected.forEach((feature) => {
            // Try removing from draw source
            if (drawSourceRef.current.hasFeature(feature)) {
              drawSourceRef.current.removeFeature(feature);
            }
            // Try removing from user drawings source
            if (userDrawingsLayer && userDrawingsLayer.getSource()?.hasFeature(feature)) {
              userDrawingsLayer.getSource()?.removeFeature(feature);
            }
            
            onGeometryDelete?.(feature);
          });
          
          // Clear selection
          select.getFeatures().clear();
        }
      });

      map.addInteraction(select);
      selectInteractionRef.current = select;
    }

    return () => {
      cleanupInteractions();
    };
  }, [map, mode, snapEnabled, snapSource, snapTolerance, isSnapping, triggerHaptic, onGeometryComplete, onGeometryDelete, onGeometryModify, cleanupInteractions]);

  // Mode change handler
  const handleModeChange = useCallback((newMode: DrawingMode) => {
    setMode(newMode);
    onModeChange?.(newMode);
    triggerHaptic(ImpactStyle.Light);
  }, [onModeChange, triggerHaptic]);

  // Undo last vertex
  const undoLastVertex = useCallback(() => {
    if (drawInteractionRef.current && isDrawing) {
      drawInteractionRef.current.removeLastPoint();
      setVertexCount((prev) => Math.max(0, prev - 1));
      triggerHaptic(ImpactStyle.Light);
    }
  }, [isDrawing, triggerHaptic]);

  // Cancel current drawing
  const cancelDrawing = useCallback(() => {
    if (drawInteractionRef.current && isDrawing) {
      drawInteractionRef.current.abortDrawing();
      setIsDrawing(false);
      setVertexCount(0);
      triggerHaptic(ImpactStyle.Medium);
    }
  }, [isDrawing, triggerHaptic]);

  // Finish current drawing
  const finishDrawing = useCallback(() => {
    if (drawInteractionRef.current && isDrawing) {
      drawInteractionRef.current.finishDrawing();
    }
  }, [isDrawing]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getMode: () => mode,
    setMode: (newMode: DrawingMode) => handleModeChange(newMode),
    undoLastVertex,
    cancelDrawing,
    getFeatures: () => drawSourceRef.current.getFeatures(),
    clearDrawings: () => {
      drawSourceRef.current.clear();
      triggerHaptic(ImpactStyle.Heavy);
    },
    exportGeoJSON: () => ''
  }));;

  // Get position classes
  const fabVertical = 'bottom';
  const fabHorizontal = position === 'bottom-start' ? 'start' : 'end';

  return (
    <>
      {/* Snap indicator overlay */}
      {isSnapping && (
        <div className="snap-indicator">
          <span>📍 Snapping</span>
        </div>
      )}

      {/* Drawing status */}
      {isDrawing && (
        <div className="drawing-status">
          <IonBadge color="success">
            Drawing {mode}: {vertexCount} pts
          </IonBadge>
          {((mode === 'line' && vertexCount >= 2) || (mode === 'polygon' && vertexCount >= 4)) && (
            <IonFabButton size="small" color="success" onClick={finishDrawing}>
              <IonIcon icon={checkmarkOutline} />
            </IonFabButton>
          )}
          <IonFabButton size="small" color="warning" onClick={undoLastVertex}>
            <IonIcon icon={arrowUndoOutline} />
          </IonFabButton>
          <IonFabButton size="small" color="danger" onClick={cancelDrawing}>
            <IonIcon icon={closeOutline} />
          </IonFabButton>
        </div>
      )}

      {/* Main FAB */}
      <IonFab vertical={fabVertical} horizontal={fabHorizontal} slot="fixed">
        <IonFabButton color={mode === 'none' ? 'primary' : 'success'}>
          <IonIcon icon={mode === 'none' ? layersOutline : getModeIcon(mode)} />
        </IonFabButton>
        <IonFabList side="top">
          <IonFabButton
            color={mode === 'point' ? 'success' : 'medium'}
            onClick={() => handleModeChange(mode === 'point' ? 'none' : 'point')}
            data-tooltip="Draw Point"
          >
            <IonIcon icon={locationOutline} />
          </IonFabButton>
          <IonFabButton
            color={mode === 'line' ? 'success' : 'medium'}
            onClick={() => handleModeChange(mode === 'line' ? 'none' : 'line')}
            data-tooltip="Draw Line"
          >
            <IonIcon icon={removeOutline} />
          </IonFabButton>
          <IonFabButton
            color={mode === 'polygon' ? 'success' : 'medium'}
            onClick={() => handleModeChange(mode === 'polygon' ? 'none' : 'polygon')}
            data-tooltip="Draw Polygon"
          >
            <IonIcon icon={squareOutline} />
          </IonFabButton>
          <IonFabButton
            color={mode === 'edit' ? 'warning' : 'medium'}
            onClick={() => handleModeChange(mode === 'edit' ? 'none' : 'edit')}
            data-tooltip="Edit"
          >
            <IonIcon icon={pencilOutline} />
          </IonFabButton>
          <IonFabButton
            color={mode === 'delete' ? 'danger' : 'medium'}
            onClick={() => handleModeChange(mode === 'delete' ? 'none' : 'delete')}
            data-tooltip="Delete"
          >
            <IonIcon icon={trashOutline} />
          </IonFabButton>
        </IonFabList>
      </IonFab>
    </>
  );
});

function getModeIcon(mode: DrawingMode): string {
  switch (mode) {
    case 'point': return locationOutline;
    case 'line': return removeOutline;
    case 'polygon': return squareOutline;
    case 'edit': return pencilOutline;
    case 'delete': return trashOutline;
    default: return layersOutline;
  }
}

export default DrawingToolbar;
