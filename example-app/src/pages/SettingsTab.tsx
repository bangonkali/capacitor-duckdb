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
  colorPaletteOutline,
  informationCircleOutline,
  warningOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

import settingsService, { 
  type AppSettings, 
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

  const updateBooleanSetting = useCallback((key: keyof AppSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const updateNumberSetting = useCallback((key: keyof AppSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const updateMapCenter = useCallback((index: 0 | 1, value: number) => {
    setSettings(prev => {
      const newCenter = [...prev.defaultMapCenter] as [number, number];
      newCenter[index] = value;
      return { ...prev, defaultMapCenter: newCenter };
    });
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

        {/* Map Settings Moved */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle><IonIcon icon={layersOutline} /> Map Settings</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>Map layer limits, visibility, and performance settings have been moved to the Map view.</p>
            <p style={{ marginTop: '10px' }}>
              Go to <strong>Spatial Demo</strong> and click the <strong>Layers</strong> button to configure map settings.
            </p>
          </IonCardContent>
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

            <IonItem>
              <IonLabel>
                <h3>Default Map Center</h3>
                <p>Longitude, Latitude</p>
              </IonLabel>
              <div style={{ display: 'flex', gap: '10px', maxWidth: '200px' }}>
                <IonInput
                  type="number"
                  placeholder="Lon"
                  value={settings.defaultMapCenter[0]}
                  onIonChange={(e) => updateMapCenter(0, parseFloat(e.detail.value!) || 0)}
                />
                <IonInput
                  type="number"
                  placeholder="Lat"
                  value={settings.defaultMapCenter[1]}
                  onIonChange={(e) => updateMapCenter(1, parseFloat(e.detail.value!) || 0)}
                />
              </div>
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
