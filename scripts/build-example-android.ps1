<#
.SYNOPSIS
Build Example Android APK with Pre-populated DuckDB Database (PowerShell version)

.DESCRIPTION
This script:
1. Prepares the demo DuckDB database (if not exists)
2. Copies the database to Android assets
3. Builds the example-app web assets
4. Syncs with Capacitor
5. Builds the Android APK

.PARAMETER SkipDb
Skip building the demo database

.PARAMETER Release
Build release version instead of debug
#>

param (
    [switch]$SkipDb,
    [switch]$Release
)

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = $PSScriptRoot
$ROOT_DIR = Split-Path -Parent $SCRIPT_DIR
$EXAMPLE_APP_DIR = Join-Path $ROOT_DIR "example-app"
$ANDROID_DIR = Join-Path $EXAMPLE_APP_DIR "android"
$BUILD_DIR = Join-Path $ROOT_DIR "build\demo-database"
$DEMO_DB = Join-Path $BUILD_DIR "demo.duckdb"
$ASSETS_DIR = Join-Path $ANDROID_DIR "app\src\main\assets"

Write-Host "🦆 Capacitor DuckDB Example App Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Prepare demo database
if (-not $SkipDb) {
    if (-not (Test-Path $DEMO_DB)) {
        Write-Host "📦 Step 1: Building demo database..." -ForegroundColor Green
        Write-Host ""
        node (Join-Path $SCRIPT_DIR "prepare-demo-database.mjs")
        Write-Host ""
    } else {
        Write-Host "📦 Step 1: Demo database already exists, skipping..." -ForegroundColor Yellow
        Write-Host "   (Use -SkipDb:$false to force rebuild, or delete $DEMO_DB)"
        Write-Host ""
    }
} else {
    Write-Host "📦 Step 1: Skipping database preparation (-SkipDb)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 2: Copy database to Android assets
Write-Host "📱 Step 2: Copying database to Android assets..." -ForegroundColor Green
$DestDir = Join-Path $ASSETS_DIR "databases"
if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
}

if (Test-Path $DEMO_DB) {
    Copy-Item $DEMO_DB (Join-Path $DestDir "demo.duckdb") -Force
    $DbSize = (Get-Item (Join-Path $DestDir "demo.duckdb")).Length / 1MB
    Write-Host "   ✓ Copied demo.duckdb ($("{0:N2}" -f $DbSize) MB)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Warning: Demo database not found at $DEMO_DB" -ForegroundColor Yellow
    Write-Host "   Run without -SkipDb to create it"
}
Write-Host ""

# Step 3: Build plugin TypeScript
Write-Host "🔨 Step 3: Building plugin TypeScript..." -ForegroundColor Green
Push-Location $ROOT_DIR
try {
    # Ensure dependencies are installed
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installing dependencies..." -ForegroundColor Cyan
        cmd /c "npm install"
    }
    
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) { throw "Plugin build failed" }
    Write-Host "   ✓ Plugin built" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 4: Build example-app web assets
Write-Host "🌐 Step 4: Building example-app web assets..." -ForegroundColor Green
Push-Location $EXAMPLE_APP_DIR
try {
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) { throw "Web assets build failed" }
    Write-Host "   ✓ Web assets built" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 5: Sync with Capacitor
Write-Host "🔄 Step 5: Syncing with Capacitor..." -ForegroundColor Green
Push-Location $EXAMPLE_APP_DIR
try {
    cmd /c "npx cap sync android"
    if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed" }
    Write-Host "   ✓ Capacitor synced" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 6: Build Android APK
$BuildType = if ($Release) { "release" } else { "debug" }
Write-Host "🤖 Step 6: Building Android APK ($BuildType)..." -ForegroundColor Green
Push-Location $ANDROID_DIR

try {
    if ($Release) {
        .\gradlew.bat assembleRelease
        $ApkPath = Join-Path $ANDROID_DIR "app\build\outputs\apk\release\app-release.apk"
    } else {
        .\gradlew.bat assembleDebug
        $ApkPath = Join-Path $ANDROID_DIR "app\build\outputs\apk\debug\app-debug.apk"
    }

    if (Test-Path $ApkPath) {
        $ApkSize = (Get-Item $ApkPath).Length / 1MB
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "✅ Build complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   APK: $ApkPath"
        Write-Host "   Size: $("{0:N2}" -f $ApkSize) MB"
        Write-Host ""
        Write-Host "📲 To install on device:"
        Write-Host "   adb install -r `"$ApkPath`""
        Write-Host ""
        Write-Host "🚀 To run directly:"
        Write-Host "   cd `"$ANDROID_DIR`"; .\gradlew.bat installDebug"
    } else {
        Write-Host ""
        Write-Host "❌ Build failed - APK not found" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
