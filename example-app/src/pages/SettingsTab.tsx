/**
 * SettingsTab - Application Settings
 * 
 * Configurable settings for map layer limits, preferences,
 * and performance options. Settings persist to DuckDB.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonToggle,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonNote,
  IonRange,
  IonButtons,
  IonSpinner,
  IonAlert,
  useIonToast,
  IonText,
} from '@ionic/react';
import {
  saveOutline,
  refreshOutline,
  layersOutline,
  speedometerOutline,
  colorPaletteOutline,
  informationCircleOutline,
  warningOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

import settingsService, { 
  type AppSettings, 
  type MapLayerLimits,
  DEFAULT_SETTINGS 
} from '../services/settingsService';

import './SettingsTab.css';

const SettingsTab: React.FC = () => {
  const [presentToast] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetAlert, setShowResetAlert] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // getSettings handles initialization and returns defaults on failure
        const loaded = await settingsService.getSettings();
        setSettings(loaded);
      } catch (error) {
        console.error('Failed to load settings:', error);
        presentToast({ message: 'Failed to load settings', duration: 2000, color: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [presentToast]);

  const updateLayerLimit = useCallback((key: keyof MapLayerLimits, value: number) => {
    setSettings(prev => ({
      ...prev,
      mapLayerLimits: { ...prev.mapLayerLimits, [key]: value },
    }));
    setHasChanges(true);
  }, []);

  const updateBooleanSetting = useCallback((key: keyof AppSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const updateNumberSetting = useCallback((key: keyof AppSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await settingsService.setSettings(settings);
      setHasChanges(false);
      presentToast({ message: 'Settings saved', duration: 2000, color: 'success', icon: checkmarkCircleOutline });
    } catch (error) {
      console.error('Failed to save settings:', error);
      presentToast({ message: 'Failed to save settings', duration: 2000, color: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [settings, presentToast]);

  const handleReset = useCallback(async () => {
    try {
      await settingsService.resetSettings();
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(false);
      presentToast({ message: 'Settings reset to defaults', duration: 2000, color: 'success' });
    } catch (error) {
      console.error('Failed to reset settings:', error);
      presentToast({ message: 'Failed to reset settings', duration: 2000, color: 'danger' });
    }
    setShowResetAlert(false);
  }, [presentToast]);

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>⚙️ Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="loading-container">
            <IonSpinner />
            <p>Loading settings...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>⚙️ Settings</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowResetAlert(true)}>
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
            <IonButton onClick={handleSave} disabled={!hasChanges || saving} strong>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon slot="icon-only" icon={saveOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {hasChanges && (
          <div className="unsaved-banner">
            <IonIcon icon={warningOutline} />
            <span>You have unsaved changes</span>
            <IonButton size="small" onClick={handleSave} disabled={saving}>Save</IonButton>
          </div>
        )}

        {/* Map Layer Limits */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle><IonIcon icon={layersOutline} /> Map Layer Limits</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonNote>Maximum features to load per layer type. Lower values improve performance.</IonNote>
          </IonCardContent>
          
          <IonList>
            <IonItem>
              <IonLabel>
                <h3>Bathymetry / Ocean</h3>
                <p>Heavy polygon layers</p>
              </IonLabel>
              <IonInput
                type="number"
                value={settings.mapLayerLimits.bathymetry}
                min={100}
                max={2000}
                onIonChange={(e) => {
                  const val = parseInt(String(e.detail.value), 10);
                  if (!Number.isNaN(val)) {
                    updateLayerLimit('bathymetry', val);
                  }
                }}
                className="limit-input"
              />
            </IonItem>
            
            <IonItem>
              <IonLabel>
                <h3>Polygons</h3>
                <p>Countries, lakes, parks</p>
              </IonLabel>
              <IonInput
                type="number"
                value={settings.mapLayerLimits.polygons}
                min={500}
                max={10000}
                onIonChange={(e) => {
                  const val = parseInt(String(e.detail.value), 10);
                  if (!Number.isNaN(val)) {
                    updateLayerLimit('polygons', val);
                  }
                }}
                className="limit-input"
              />
            </IonItem>
            
            <IonItem>
              <IonLabel>
                <h3>Lines</h3>
                <p>Rivers, roads, railroads</p>
              </IonLabel>
              <IonInput
                type="number"
                value={settings.mapLayerLimits.lines}
                min={500}
                max={15000}
                onIonChange={(e) => {
                  const val = parseInt(String(e.detail.value), 10);
                  if (!Number.isNaN(val)) {
                    updateLayerLimit('lines', val);
                  }
                }}
                className="limit-input"
              />
            </IonItem>
            
            <IonItem>
              <IonLabel>
                <h3>Points</h3>
                <p>Cities, airports, ports</p>
              </IonLabel>
              <IonInput
                type="number"
                value={settings.mapLayerLimits.points}
                min={1000}
                max={20000}
                onIonChange={(e) => {
                  const val = parseInt(String(e.detail.value), 10);
                  if (!Number.isNaN(val)) {
                    updateLayerLimit('points', val);
                  }
                }}
                className="limit-input"
              />
            </IonItem>
          </IonList>
        </IonCard>

        {/* Performance */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle><IonIcon icon={speedometerOutline} /> Performance</IonCardTitle>
          </IonCardHeader>
          
          <IonList>
            <IonItem>
              <IonLabel>
                <h3>Enable Layer Caching</h3>
                <p>Cache layers to reduce queries</p>
              </IonLabel>
              <IonToggle
                checked={settings.enableLayerCaching}
                onIonChange={(e) => updateBooleanSetting('enableLayerCaching', e.detail.checked)}
              />
            </IonItem>
            
            <IonItem>
              <IonLabel>
                <h3>Max Cached Layers</h3>
                <p>Layers to keep in memory</p>
              </IonLabel>
              <IonRange
                min={5}
                max={20}
                step={1}
                pin
                pinFormatter={(value) => `${value}`}
                value={settings.maxCachedLayers}
                onIonChange={(e) => updateNumberSetting('maxCachedLayers', e.detail.value as number)}
                style={{ maxWidth: '150px' }}
              />
            </IonItem>
          </IonList>
        </IonCard>

        {/* Preferences */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle><IonIcon icon={colorPaletteOutline} /> Preferences</IonCardTitle>
          </IonCardHeader>
          
          <IonList>
            <IonItem>
              <IonLabel>
                <h3>Show Debug Info</h3>
                <p>Display query logs and metrics</p>
              </IonLabel>
              <IonToggle
                checked={settings.showDebugInfo}
                onIonChange={(e) => updateBooleanSetting('showDebugInfo', e.detail.checked)}
              />
            </IonItem>
            
            <IonItem>
              <IonLabel>
                <h3>Default Map Zoom</h3>
                <p>Initial zoom level</p>
              </IonLabel>
              <IonRange
                min={1}
                max={10}
                step={1}
                pin
                pinFormatter={(value) => `${value}`}
                value={settings.defaultMapZoom}
                onIonChange={(e) => updateNumberSetting('defaultMapZoom', e.detail.value as number)}
                style={{ maxWidth: '150px' }}
              />
            </IonItem>
          </IonList>
        </IonCard>

        {/* Info */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle><IonIcon icon={informationCircleOutline} /> About</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText color="medium">
              <p>Settings persist to DuckDB and survive app restarts.</p>
              <p style={{ marginTop: '8px' }}><strong>Low-memory device recommendations:</strong></p>
              <ul>
                <li>Bathymetry: 200-300</li>
                <li>Polygons: 1000-1500</li>
                <li>Lines: 2000-2500</li>
                <li>Points: 3000-4000</li>
              </ul>
            </IonText>
          </IonCardContent>
        </IonCard>

        <div style={{ height: '80px' }} />

        <IonAlert
          isOpen={showResetAlert}
          onDidDismiss={() => setShowResetAlert(false)}
          header="Reset Settings"
          message="Reset all settings to defaults?"
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Reset', role: 'destructive', handler: handleReset },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
