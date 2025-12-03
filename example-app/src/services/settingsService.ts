/**
 * Settings Service
 * 
 * Manages application settings with persistence to DuckDB.
 * Settings are stored as key-value pairs in an app_settings table.
 */

import { duckdb } from './duckdb';

// Database name - use a dedicated settings database to avoid conflicts
const SETTINGS_DB = 'settings';

// ============================================================================
// Types
// ============================================================================

export interface MapLayerLimits {
  bathymetry: number;
  polygons: number;
  lines: number;
  points: number;
}

export interface AppSettings {
  // Map layer limits
  mapLayerLimits: MapLayerLimits;
  // Map defaults
  defaultMapZoom: number;
  defaultMapCenter: [number, number];
  // UI preferences
  darkMode: boolean;
  showDebugInfo: boolean;
  // Performance
  enableLayerCaching: boolean;
  maxCachedLayers: number;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  mapLayerLimits: {
    bathymetry: 500,
    polygons: 2000,
    lines: 3000,
    points: 5000,
  },
  defaultMapZoom: 2,
  defaultMapCenter: [0, 20],
  darkMode: false,
  showDebugInfo: false,
  enableLayerCaching: true,
  maxCachedLayers: 10,
};

// In-memory cache of settings
let settingsCache: AppSettings | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the settings table if it doesn't exist
 */
export async function initializeSettings(): Promise<void> {
  if (initialized) return;
  
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Create settings table if not exists
      await duckdb.execute(SETTINGS_DB, `
        CREATE TABLE IF NOT EXISTS app_settings (
          key VARCHAR PRIMARY KEY,
          value VARCHAR NOT NULL,
          updated_at VARCHAR
        );
      `);

      // Ensure updated_at column exists (migration)
      try {
        await duckdb.execute(SETTINGS_DB, "ALTER TABLE app_settings ADD COLUMN updated_at VARCHAR");
      } catch {
        // Column likely exists
      }
      
      // Load settings into cache
      await loadSettings();
      initialized = true;
      console.log('[SettingsService] Initialized');
    } catch (error) {
      console.error('[SettingsService] Failed to initialize:', error);
      // Do not set initialized = true if we failed to setup the DB.
      // This ensures we retry initialization on next access.
      // We still populate cache with defaults so the app doesn't crash if it ignores the error.
      settingsCache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load all settings from database into cache
 */
async function loadSettings(): Promise<void> {
  try {
    const result = await duckdb.query<{ key: string; value: string }>(
      SETTINGS_DB,
      'SELECT key, value FROM app_settings;'
    );

    // Start with defaults
    settingsCache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    if (result.values.length === 0) {
      console.log('[SettingsService] Settings table empty, populating with defaults');
      const flatDefaults = flattenObject(DEFAULT_SETTINGS);
      
      // Persist defaults to DB
      for (const [key, value] of Object.entries(flatDefaults)) {
        await persistSetting(key, value);
      }
    } else {
      // Override with stored values
      for (const row of result.values) {
        try {
          const parsed = JSON.parse(row.value);
          setNestedValue(settingsCache, row.key, parsed);
        } catch {
          // Skip invalid JSON
          console.warn(`[SettingsService] Invalid JSON for key: ${row.key}`);
        }
      }
    }

    console.log('[SettingsService] Loaded settings from database');
  } catch (error) {
    console.error('[SettingsService] Failed to load settings:', error);
    settingsCache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    throw error;
  }
}

/**
 * Helper to persist a single setting to DB without initialization check
 */
async function persistSetting(key: string, value: unknown): Promise<void> {
  const jsonValue = JSON.stringify(value);
  const escapedValue = jsonValue.replace(/'/g, "''");
  const now = new Date().toISOString();
  
  await duckdb.execute(SETTINGS_DB, `
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('${key}', '${escapedValue}', '${now}')
    ON CONFLICT (key) DO UPDATE SET 
      value = '${escapedValue}',
      updated_at = '${now}';
  `);
}

/**
 * Get all settings
 */
export async function getSettings(): Promise<AppSettings> {
  if (!initialized) {
    try {
      await initializeSettings();
    } catch (e) {
      console.warn('[SettingsService] Initialization failed, returning defaults', e);
      return { ...DEFAULT_SETTINGS };
    }
  }
  return settingsCache || { ...DEFAULT_SETTINGS };
}

/**
 * Get a specific setting by key path (e.g., 'mapLayerLimits.bathymetry')
 */
export async function getSetting<T>(keyPath: string): Promise<T> {
  const settings = await getSettings();
  return getNestedValue(settings, keyPath) as T;
}

/**
 * Update a specific setting
 */
export async function setSetting(keyPath: string, value: unknown): Promise<void> {
  if (!initialized) {
    await initializeSettings();
  }

  // Update cache
  if (settingsCache) {
    setNestedValue(settingsCache, keyPath, value);
  }

  // Persist to database
  try {
    await persistSetting(keyPath, value);
    console.log(`[SettingsService] Saved setting: ${keyPath}`);
  } catch (error) {
    console.error(`[SettingsService] Failed to save setting ${keyPath}:`, error);
    throw error;
  }
}

/**
 * Update multiple settings at once
 */
export async function setSettings(updates: Partial<AppSettings>): Promise<void> {
  const flatUpdates = flattenObject(updates);
  
  for (const [key, value] of Object.entries(flatUpdates)) {
    await setSetting(key, value);
  }
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  try {
    await duckdb.execute(SETTINGS_DB, 'DELETE FROM app_settings;');
    settingsCache = { ...DEFAULT_SETTINGS };
    console.log('[SettingsService] Reset all settings to defaults');
  } catch (error) {
    console.error('[SettingsService] Failed to reset settings:', error);
    throw error;
  }
}

/**
 * Export settings as JSON string
 */
export async function exportSettings(): Promise<string> {
  const settings = await getSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from JSON string
 */
export async function importSettings(jsonString: string): Promise<void> {
  const imported = JSON.parse(jsonString) as Partial<AppSettings>;
  await setSettings(imported);
  // Reload cache
  await loadSettings();
}

// ============================================================================
// Map Layer Limits - Convenience Functions
// ============================================================================

/**
 * Get map layer limits
 */
export async function getMapLayerLimits(): Promise<MapLayerLimits> {
  return getSetting<MapLayerLimits>('mapLayerLimits');
}

/**
 * Update map layer limits
 */
export async function setMapLayerLimits(limits: Partial<MapLayerLimits>): Promise<void> {
  const current = await getMapLayerLimits();
  const updated = { ...current, ...limits };
  await setSetting('mapLayerLimits', updated);
}

/**
 * Get limit for a specific geometry type
 */
export async function getLayerLimit(type: keyof MapLayerLimits): Promise<number> {
  const limits = await getMapLayerLimits();
  return limits[type];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return;
  
  let current = obj as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[lastKey] = value;
}

/**
 * Flatten an object to dot-notation keys
 */
function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, fullKey));
      } else {
        result[fullKey] = value;
      }
    }
  }
  
  return result;
}

// ============================================================================
// Export Service
// ============================================================================

export const settingsService = {
  initialize: initializeSettings,
  getSettings,
  getSetting,
  setSetting,
  setSettings,
  resetSettings,
  exportSettings,
  importSettings,
  getMapLayerLimits,
  setMapLayerLimits,
  getLayerLimit,
  DEFAULT_SETTINGS,
};

export default settingsService;
