# DuckDB Capacitor Demo App

A demo Ionic React app showcasing the `@bangonkali/capacitor-duckdb` plugin with two powerful demonstrations:

## Features

### 🚕 NYC Taxi Analytics Tab
- **Taxi rides** generated and stored locally
- Dashboard with aggregated statistics (avg fare, tip, distance, duration)
- Pre-computed query results showing:
  - Top 10 most expensive trips
  - Best tipping hours
  - Busiest pickup zones
  - Longest trips
- All queries execute in **<300ms** on device

### ✅ Todo List Tab
- Classic todo list demonstrating CRUD operations
- Uses DuckDB sequences for ID generation
- Persistent storage across app restarts

### 💻 SQL Query Tab
- Interactive SQL editor
- Quick query buttons for common operations
- Real-time query execution with timing
- Works with both Taxi and Todo databases

### 🌍 Spatial Demo Tab
- OpenLayers-powered world map driven entirely by DuckDB spatial queries
- Natural Earth countries, cities, airports, rivers, and lakes datasets
- User drawing layer for custom geometries stored in DuckDB
- Layer toggles stream data from DuckDB (`spatialService.getLayerGeoJSON`) instead of static JSON imports
- Demonstrates the GeoJSON ➜ DuckDB ➜ OpenLayers pipeline shared by analytics queries and visualization

## Tech Stack

- **Ionic Framework 8** with React
- **TypeScript** for type safety
- **DuckDB** via native JNI plugin
- **Capacitor 7** for native bridge

## Running the Demo

### Prerequisites

1. Build the main DuckDB plugin first:
   ```bash
   cd ..
   ./scripts/build-android.sh
   npm run build
   ```

### Development

```bash
npm install
npm start
```

### Build & Run on Android

```bash
npm run build
npx cap sync android
npx cap open android
```

Then run from Android Studio on your device/emulator.

## First Launch

On first launch:
1. The app will detect no existing data
2. It will generate 1,000,000 taxi ride records
3. It will seed Natural Earth datasets into DuckDB tables (countries, cities, airports, rivers, lakes)
4. This takes ~5-10 seconds for taxi data + ~10 seconds for spatial seeding depending on device
5. Data persists between app launches

## Architecture

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Router + tabs setup
├── services/
│   ├── duckdb.ts         # Core DuckDB service wrapper
│   └── spatialService.ts # Spatial seeding + layer fetch helpers
├── data/
│   ├── naturalEarth.ts   # Typed dataset accessors
│   └── geojson/          # Bundled Natural Earth GeoJSON assets
├── components/
│   └── map/MapView.tsx   # OpenLayers map connected to DuckDB
├── pages/
│   ├── TaxiTab.tsx       # NYC Taxi analytics
│   ├── TodoTab.tsx       # Todo list demo
│   ├── QueryTab.tsx      # SQL query editor
│   ├── SpatialTab.tsx    # Spatial hub + toolbar
│   └── spatial/          # Demo category screens (Constructors, etc.)
└── theme/
    └── variables.css     # Ionic theming
```

  ## Spatial Data Flow

  1. **Bundle** – GeoJSON lives under `src/data/geojson` and is imported through `naturalEarth.ts`.
  2. **Seed** – `spatialService.initialize()` loads each dataset into DuckDB tables on first launch (if empty).
  3. **Serve** – `spatialService.getLayerGeoJSON(layer)` executes `ST_AsGeoJSON` queries to build FeatureCollections.
  4. **Render** – `MapView` requests data from the service when a layer toggle is enabled and feeds it to OpenLayers.

  This keeps the Natural Earth data synchronized between SQL queries and the interactive map without duplicating loading logic.

## Key Demonstrations

This demo showcases that DuckDB on mobile can:

1. **Handle large datasets** - 100K rows loads and indexes quickly
2. **Execute complex queries fast** - Aggregations return in milliseconds
3. **Work 100% offline** - No backend required
4. **Persist data reliably** - Survives app restarts
5. **Serve geospatial data** - Spatial functions drive both analytics and live map layers

Perfect for data-heavy mobile apps where SQLite falls short!
