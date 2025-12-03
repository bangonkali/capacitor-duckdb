# Troubleshooting

## Common Issues

### "Spatial Extension Not Available"

If spatial functions like `ST_Point()` return errors:

1.  **Verify build included spatial:**
    ```bash
    # Check libduckdb.so size (should be 80-100MB with all extensions)
    ls -lh android/src/main/jniLibs/arm64-v8a/libduckdb.so
    
    # Check for spatial symbols
    nm -gC android/src/main/jniLibs/arm64-v8a/libduckdb.so | grep -i spatial
    ```

2.  **Rebuild (all extensions are included by default):**
    ```bash
    ./scripts/build-android.sh
    ```

### Checking if Spatial Extension is Loaded

**Important:** On Android/iOS, `duckdb_extensions()` does NOT work reliably for statically-linked extensions because it often requires `home_directory` or dynamic loading paths.

Instead, verify spatial by calling a spatial function:

```typescript
// ✅ Correct way to check spatial availability
try {
  const result = await CapacitorDuckDb.query({
    database: 'mydb',
    statement: 'SELECT ST_AsText(ST_Point(0, 0)) as test'
  });
  console.log('Spatial is available:', result.values[0].test); // "POINT (0 0)"
} catch (e) {
  console.log('Spatial is NOT available');
}
```

### Spatial Demo Shows "Cannot read properties of undefined"

If the spatial demo fails with `TypeError: Cannot read properties of undefined (reading 'length')`:

This is often caused by GeoJSON files not being parsed correctly by Vite.

**Fix:**
1.  **Use `.json` extension** instead of `.geojson` for data files.
2.  **Remove `assetsInclude`** from `vite.config.ts` (it causes Vite to return URLs instead of parsed JSON).
3.  **Use `as unknown as` type casting** for GeoJSON imports.

```typescript
// vite.config.ts - DO NOT use assetsInclude for GeoJSON
export default defineConfig({
  plugins: [react()],
  // Don't add: assetsInclude: ['**/*.geojson']
});

// Import .json files, not .geojson
import countriesData from './geojson/countries.json';
export function getCountries() {
  return countriesData as unknown as CountriesCollection;
}
```

### ST_Version() or ST_GEOSVersion() Not Found

These functions do NOT exist in DuckDB's spatial extension. This is normal.

```typescript
// ✅ Use this to verify spatial works
SELECT ST_AsText(ST_Point(0, 0)) as test;

// ✅ PROJ version is available
SELECT DuckDB_PROJ_Compiled_Version() as version;

// ❌ These don't exist
// ST_Version(), ST_GEOSVersion()
```

### Build Fails: vcpkg Dependencies

If vcpkg cross-compilation fails:

1.  **Ensure vcpkg is bootstrapped:**
    ```bash
    cd ~/vcpkg
    ./bootstrap-vcpkg.sh
    ```

2.  **Clear vcpkg cache and retry:**
    ```bash
    rm -rf ~/vcpkg/buildtrees/*
    rm -rf build/spatial
    ./scripts/build-android.sh
    ```

### JNI Library Not Found (Android)

If the app crashes with "couldn't find libcapacitor_duckdb_jni.so":

1.  **Ensure Android build completes:**
    ```bash
    cd example-app/android
    ./gradlew assembleDebug --info
    ```

2.  **Check JNI libs are in place:**
    ```bash
    ls android/src/main/jniLibs/*/libduckdb.so
    ```

### Query Returns Empty Results

Verify the database path is correct and the table exists:

```typescript
// Check what tables exist
const tables = await CapacitorDuckDb.listTables({ database: 'mydb' });
console.log('Tables:', tables.tables);

// Check database file location
const version = await CapacitorDuckDb.getVersion();
console.log('DuckDB version:', version.version);
```
