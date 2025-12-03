#!/bin/bash
#
# Build Example iOS App with Pre-populated DuckDB Database
#
# This script:
# 1. Prepares the demo DuckDB database (if not exists)
# 2. Copies the database to iOS app bundle
# 3. Builds the example-app web assets
# 4. Syncs with Capacitor
# 5. Installs CocoaPods dependencies
# 6. Builds the iOS app (simulator or device)
#
# Usage:
#   ./scripts/build-example-ios.sh [--skip-db] [--release] [--device] [--simulator NAME]
#
# Prerequisites:
#   - Xcode with command line tools
#   - CocoaPods: gem install cocoapods
#   - DuckDB XCFramework built: ./scripts/build-ios.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXAMPLE_APP_DIR="$ROOT_DIR/example-app"
IOS_DIR="$EXAMPLE_APP_DIR/ios"
IOS_APP_DIR="$IOS_DIR/App"
BUILD_DIR="$ROOT_DIR/build/demo-database"
DEMO_DB="$BUILD_DIR/demo.duckdb"
# iOS assets location - files in App/App/ are bundled with the app
ASSETS_DIR="$IOS_APP_DIR/App"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Parse arguments
SKIP_DB=false
REBUILD_NATIVE=false
BUILD_TYPE="debug"
BUILD_TARGET="simulator"
SIMULATOR_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --rebuild-native)
      REBUILD_NATIVE=true
      shift
      ;;
    --release)
      BUILD_TYPE="release"
      shift
      ;;
    --device)
      BUILD_TARGET="device"
      shift
      ;;
    --simulator)
      BUILD_TARGET="simulator"
      # Only consume next arg if it exists and doesn't start with --
      if [[ -n "$2" && "$2" != --* ]]; then
        SIMULATOR_NAME="$2"
        shift 2
      else
        shift
      fi
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --rebuild-native    Rebuild native DuckDB library (runs ./scripts/build-ios.sh)"
      echo "  --skip-db           Skip demo database preparation"
      echo "  --release           Build release configuration (default: debug)"
      echo "  --device            Build for physical iOS device"
      echo "  --simulator NAME    Build for simulator (default: 'iPhone 15')"
      echo "  --help              Show this help message"
      echo ""
      echo "Examples:"
      echo "  # Build for simulator (default)"
      echo "  ./scripts/build-example-ios.sh"
      echo ""
      echo "  # Rebuild native lib and then the app"
      echo "  ./scripts/build-example-ios.sh --rebuild-native"
      echo ""
      echo "  # Build release for device"
      echo "  ./scripts/build-example-ios.sh --release --device"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🦆 Capacitor DuckDB iOS Example App Builder"
echo "============================================"
echo ""

# Step 0: Check for XCFramework
log_step "Step 0: Checking for DuckDB XCFramework..."

if [ "$REBUILD_NATIVE" = true ]; then
    log_info "Rebuilding native DuckDB library (--rebuild-native)..."
    "$ROOT_DIR/scripts/build-ios.sh"
    echo ""
fi

XCFRAMEWORK_PATH="$ROOT_DIR/ios/Frameworks/DuckDB.xcframework"
if [ ! -d "$XCFRAMEWORK_PATH" ]; then
    log_warn "DuckDB XCFramework not found at $XCFRAMEWORK_PATH"
    log_warn "Please run ./scripts/build-ios.sh first to build the native library"
    log_warn "OR run this script with --rebuild-native"
    log_warn ""
    log_warn "Continuing anyway - the build may fail at linking stage..."
    echo ""
else
    log_info "Found DuckDB XCFramework"
    echo ""
fi

# Step 1: Prepare demo database
log_step "Step 1: Preparing demo database..."
if [ "$SKIP_DB" = false ]; then
  if [ ! -f "$DEMO_DB" ]; then
    log_info "Building demo database..."
    node "$SCRIPT_DIR/prepare-demo-database.mjs"
  else
    log_info "Demo database already exists, skipping..."
    log_info "(Delete $DEMO_DB to force rebuild)"
  fi
else
  log_info "Skipping database preparation (--skip-db)"
fi
echo ""

# Step 2: Copy database to iOS app bundle
log_step "Step 2: Copying database to iOS app bundle..."
# Create databases directory in app bundle
mkdir -p "$ASSETS_DIR/databases"
if [ -f "$DEMO_DB" ]; then
  cp "$DEMO_DB" "$ASSETS_DIR/databases/demo.duckdb"
  DB_SIZE=$(du -h "$ASSETS_DIR/databases/demo.duckdb" | cut -f1)
  log_info "Copied demo.duckdb ($DB_SIZE) to app bundle"
else
  log_warn "Demo database not found at $DEMO_DB"
  log_warn "Run without --skip-db to create it"
fi
echo ""

# Step 3: Build plugin TypeScript
log_step "Step 3: Building plugin TypeScript..."
cd "$ROOT_DIR"
npm run build
log_info "Plugin built"
echo ""

# Step 4: Build example-app web assets
log_step "Step 4: Building example-app web assets..."
cd "$EXAMPLE_APP_DIR"
npm run build
log_info "Web assets built"
echo ""

# Step 5: Sync with Capacitor
log_step "Step 5: Syncing with Capacitor..."
npx cap sync ios
log_info "Capacitor synced"
echo ""

# Step 6: Install CocoaPods dependencies
log_step "Step 6: Installing CocoaPods dependencies..."
cd "$IOS_APP_DIR"
if command -v pod &> /dev/null; then
    pod install
    log_info "CocoaPods dependencies installed"
else
    log_error "CocoaPods not found!"
    log_error "Please install CocoaPods: gem install cocoapods"
    exit 1
fi
echo ""

# Step 7: Build iOS app
log_step "Step 7: Building iOS app ($BUILD_TYPE for $BUILD_TARGET)..."
cd "$IOS_APP_DIR"

# Determine configuration
if [ "$BUILD_TYPE" = "release" ]; then
    CONFIGURATION="Release"
else
    CONFIGURATION="Debug"
fi

# Find an available iPhone simulator if not specified
if [ "$BUILD_TARGET" = "simulator" ] && [ -z "$SIMULATOR_NAME" ]; then
    log_info "Auto-detecting available iPhone simulator..."
    
    # Get the first available iPhone simulator with its ID
    # We use `simctl list devices available` which lists available simulators
    # and filter for iPhone, then get one with a recent iOS version
    SIMULATOR_INFO=$(xcrun simctl list devices available 2>/dev/null | grep -E "iPhone (16|15|14)" | grep -v "unavailable" | head -1)
    
    if [ -n "$SIMULATOR_INFO" ]; then
        # Extract the device name and ID from output like:
        #   "iPhone 16 Pro (5C7972F2-0BB9-49D1-8348-C31EA34ACCAB) (Shutdown)"
        SIMULATOR_NAME=$(echo "$SIMULATOR_INFO" | sed -E 's/^[[:space:]]*//' | sed -E 's/[[:space:]]*\([A-F0-9-]+\).*//')
        SIMULATOR_ID=$(echo "$SIMULATOR_INFO" | grep -oE '[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}')
        log_info "Found simulator: $SIMULATOR_NAME (ID: $SIMULATOR_ID)"
    fi
    
    if [ -z "$SIMULATOR_NAME" ]; then
        log_error "No iPhone simulator found! Please create one in Xcode."
        exit 1
    fi
fi

if [ "$BUILD_TARGET" = "device" ]; then
    # Build for physical device
    # This creates an archive that can be exported for distribution
    log_info "Building for physical iOS device..."
    
    ARCHIVE_PATH="$IOS_APP_DIR/build/App.xcarchive"
    
    xcodebuild -workspace App.xcworkspace \
        -scheme App \
        -destination 'generic/platform=iOS' \
        -configuration "$CONFIGURATION" \
        -archivePath "$ARCHIVE_PATH" \
        archive
    
    if [ -d "$ARCHIVE_PATH" ]; then
        log_info ""
        log_info "============================================"
        log_info "✅ Archive created successfully!"
        log_info ""
        log_info "   Archive: $ARCHIVE_PATH"
        log_info ""
        log_info "📱 To export IPA for distribution:"
        log_info "   Open Xcode -> Window -> Organizer"
        log_info "   Or use: xcodebuild -exportArchive ..."
        log_info ""
        log_info "🔧 To install directly on connected device:"
        log_info "   Open $IOS_APP_DIR/App.xcworkspace in Xcode"
        log_info "   Select your device and click Run"
    else
        log_error "Archive failed - not found at $ARCHIVE_PATH"
        exit 1
    fi
else
    # Build for simulator
    log_info "Building for iOS Simulator: $SIMULATOR_NAME..."
    
    # Build the app using simulator ID if available, otherwise by name
    if [ -n "$SIMULATOR_ID" ]; then
        xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
            -configuration "$CONFIGURATION" \
            build
    else
        xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" \
            -configuration "$CONFIGURATION" \
            build
    fi
    
    # Find the built app
    APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "App.app" -path "*$CONFIGURATION-iphonesimulator*" -type d 2>/dev/null | head -1)
    
    if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
        APP_SIZE=$(du -sh "$APP_PATH" | cut -f1)
        log_info ""
        log_info "============================================"
        log_info "✅ Build complete!"
        log_info ""
        log_info "   App: $APP_PATH"
        log_info "   Size: $APP_SIZE"
        log_info ""
        log_info "📲 To run on simulator:"
        log_info "   # Boot simulator"
        log_info "   xcrun simctl boot '$SIMULATOR_NAME' 2>/dev/null || true"
        log_info ""
        log_info "   # Install app"
        log_info "   xcrun simctl install booted '$APP_PATH'"
        log_info ""
        log_info "   # Launch app"
        log_info "   xcrun simctl launch booted com.bangonkali.capacitorduckdb.example"
        log_info ""
        log_info "🚀 Or open in Xcode and run:"
        log_info "   open $IOS_APP_DIR/App.xcworkspace"
    else
        log_warn "Build completed but app bundle not found in DerivedData"
        log_info ""
        log_info "To run the app, open Xcode:"
        log_info "   open $IOS_APP_DIR/App.xcworkspace"
    fi
fi

echo ""
log_info "============================================"
log_info "Build process complete!"
