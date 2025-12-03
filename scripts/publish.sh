#!/bin/bash
set -e

# -----------------------------------------------------------------------------
# NOTE: This script is intended for LOCAL build and publishing only.
#
# There is a separate Bitrise-based CI/CD pipeline connected to GitHub that
# handles automated builds and releases.
# -----------------------------------------------------------------------------

# Default values
DRY_RUN=false
VERSION=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true ;;
        v*) VERSION="$1" ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [[ -z "$VERSION" ]]; then
    echo "Usage: ./scripts/publish.sh <version> [--dry-run]"
    echo "Example: ./scripts/publish.sh v0.0.1 --dry-run"
    exit 1
fi

echo "🚀 Starting publish process for version $VERSION..."
if [[ "$DRY_RUN" == "true" ]]; then
    echo "⚠️  DRY RUN MODE: No changes will be pushed or published."
fi

# Check for required environment variables
REQUIRED_VARS=("NPM_TOKEN" "GITHUB_ACCESS_TOKEN" "GITHUB_USERNAME")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!VAR}" ]]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo "❌ Error: The following environment variables are missing:"
    for VAR in "${MISSING_VARS[@]}"; do
        echo "  - $VAR"
    done
    echo "Please set them before running this script."
    exit 1
fi

# Set BITRISE_GIT_TAG for consistency with build scripts if they use it
export BITRISE_GIT_TAG="$VERSION"

# 1. Build Native Binaries
echo "📦 Building Android binaries..."
./scripts/build-android.sh --spatial

echo "📦 Building iOS binaries..."
./scripts/build-ios.sh --spatial

# 2. Prepare NPM Package
echo "📝 Updating package.json version..."
VERSION_NUM="${VERSION#v}"
if [[ "$DRY_RUN" == "false" ]]; then
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    if [[ "$CURRENT_VERSION" != "$VERSION_NUM" ]]; then
        npm version $VERSION_NUM --no-git-tag-version
    else
        echo "  Version is already $VERSION_NUM. Skipping update."
    fi
else
    echo "  (Dry run) Would run: npm version $VERSION_NUM --no-git-tag-version"
fi

echo "📚 Installing NPM dependencies..."
SKIP_BINARY_DOWNLOAD=true npm install

echo "🔨 Building TypeScript..."
npm run build

echo "📦 Packing NPM package..."
npm pack

# 3. Prepare Artifacts
DEPLOY_DIR="deploy_artifacts"
mkdir -p "$DEPLOY_DIR"
mv *.tgz "$DEPLOY_DIR/"

echo "🤐 Zipping Android binaries..."
cd android/src/main/jniLibs
zip -r "../../../../$DEPLOY_DIR/android-libs.zip" .
cd - > /dev/null

echo "🤐 Zipping iOS XCFramework..."
cd ios/Frameworks
zip -r "../../$DEPLOY_DIR/DuckDB.xcframework.zip" DuckDB.xcframework
cd - > /dev/null

# 4. Publish (if not dry run)
if [[ "$DRY_RUN" == "false" ]]; then
    echo "🚀 Publishing to NPM..."
    echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
    npm publish --access public
    rm .npmrc

    echo "octocat Publishing to GitHub Releases..."
    if command -v gh &> /dev/null; then
        gh release create "$VERSION" \
            "$DEPLOY_DIR"/*.tgz \
            "$DEPLOY_DIR/android-libs.zip" \
            "$DEPLOY_DIR/DuckDB.xcframework.zip" \
            --title "$VERSION" \
            --notes "Manual release $VERSION"
    else
        echo "⚠️  'gh' CLI not found. Skipping GitHub Release upload."
        echo "   Artifacts are in $DEPLOY_DIR"
    fi
else
    echo "✅ (Dry run) Build complete. Artifacts are in '$DEPLOY_DIR'."
    echo "   - NPM Tarball: $(ls $DEPLOY_DIR/*.tgz)"
    echo "   - Android Libs: $DEPLOY_DIR/android-libs.zip"
    echo "   - iOS Framework: $DEPLOY_DIR/DuckDB.xcframework.zip"
fi

echo "🎉 Done!"
