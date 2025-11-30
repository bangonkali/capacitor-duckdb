#!/bin/bash
#
# Build Example Android APK with Pre-populated DuckDB Database
#
# This script:
# 1. Prepares the demo DuckDB database (if not exists)
# 2. Copies the database to Android assets
# 3. Builds the example-app web assets
# 4. Syncs with Capacitor
# 5. Builds the Android APK
#
# Usage:
#   ./scripts/build-example-android.sh [--skip-db] [--release]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXAMPLE_APP_DIR="$ROOT_DIR/example-app"
ANDROID_DIR="$EXAMPLE_APP_DIR/android"
BUILD_DIR="$ROOT_DIR/build/demo-database"
DEMO_DB="$BUILD_DIR/demo.duckdb"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"

# Parse arguments
SKIP_DB=false
BUILD_TYPE="debug"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --release)
      BUILD_TYPE="release"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🦆 Capacitor DuckDB Example App Builder"
echo "========================================"
echo ""

# Step 1: Prepare demo database
if [ "$SKIP_DB" = false ]; then
  if [ ! -f "$DEMO_DB" ]; then
    echo "📦 Step 1: Building demo database..."
    echo ""
    node "$SCRIPT_DIR/prepare-demo-database.mjs"
    echo ""
  else
    echo "📦 Step 1: Demo database already exists, skipping..."
    echo "   (Use --skip-db=false to force rebuild, or delete $DEMO_DB)"
    echo ""
  fi
else
  echo "📦 Step 1: Skipping database preparation (--skip-db)"
  echo ""
fi

# Step 2: Copy database to Android assets
echo "📱 Step 2: Copying database to Android assets..."
mkdir -p "$ASSETS_DIR/databases"
if [ -f "$DEMO_DB" ]; then
  cp "$DEMO_DB" "$ASSETS_DIR/databases/demo.duckdb"
  DB_SIZE=$(du -h "$ASSETS_DIR/databases/demo.duckdb" | cut -f1)
  echo "   ✓ Copied demo.duckdb ($DB_SIZE)"
else
  echo "   ⚠️  Warning: Demo database not found at $DEMO_DB"
  echo "   Run without --skip-db to create it"
fi
echo ""

# Step 3: Build plugin TypeScript
echo "🔨 Step 3: Building plugin TypeScript..."
cd "$ROOT_DIR"
npm run build
echo "   ✓ Plugin built"
echo ""

# Step 4: Build example-app web assets
echo "🌐 Step 4: Building example-app web assets..."
cd "$EXAMPLE_APP_DIR"
npm run build
echo "   ✓ Web assets built"
echo ""

# Step 5: Sync with Capacitor
echo "🔄 Step 5: Syncing with Capacitor..."
npx cap sync android
echo "   ✓ Capacitor synced"
echo ""

# Step 6: Build Android APK
echo "🤖 Step 6: Building Android APK ($BUILD_TYPE)..."
cd "$ANDROID_DIR"

if [ "$BUILD_TYPE" = "release" ]; then
  ./gradlew assembleRelease
  APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
else
  ./gradlew assembleDebug
  APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
fi

if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "========================================"
  echo "✅ Build complete!"
  echo ""
  echo "   APK: $APK_PATH"
  echo "   Size: $APK_SIZE"
  echo ""
  echo "📲 To install on device:"
  echo "   adb install -r \"$APK_PATH\""
  echo ""
  echo "🚀 To run directly:"
  echo "   cd $ANDROID_DIR && ./gradlew installDebug"
else
  echo ""
  echo "❌ Build failed - APK not found"
  exit 1
fi
