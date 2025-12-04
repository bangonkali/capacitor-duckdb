<#
.SYNOPSIS
Build DuckDB native libraries for Android (PowerShell version)
Supports arm64-v8a and x86_64 ABIs

.DESCRIPTION
This script builds a MONOLITHIC DuckDB library with ALL extensions statically linked:
  - spatial (GIS/geometry functions via GDAL, GEOS, PROJ)
  - vss (Vector Similarity Search with HNSW indexes)
  - icu (International Components for Unicode)
  - json (JSON parsing and generation)
  - parquet (Parquet file format support)
  - inet (IP address functions)
  - tpch (TPC-H benchmark queries)
  - tpcds (TPC-DS benchmark queries)

.PARAMETER BuildApp
Also build example app

.PARAMETER DuckDBVersion
DuckDB version/branch (default: main)
#>

param (
    [switch]$BuildApp,
    [string]$DuckDBVersion = "main"
)

$ErrorActionPreference = "Stop"

# Configuration
$DUCKDB_EXTENSIONS = "icu;json;parquet;inet;tpch;tpcds"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$OUTPUT_DIR = Join-Path $PROJECT_ROOT "android\src\main"

# vcpkg settings
if ($env:VCPKG_ROOT) {
    $VCPKG_ROOT = $env:VCPKG_ROOT
} else {
    $VCPKG_ROOT = Join-Path $HOME "vcpkg"
}

# API level 28+ required for posix_spawn and getrandom used by GDAL
if ($env:ANDROID_API_LEVEL) {
    $ANDROID_API_LEVEL = $env:ANDROID_API_LEVEL
} else {
    $ANDROID_API_LEVEL = "28"
}

function Log-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Log-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Log-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Blue
}

function Check-Vcpkg {
    if (-not (Test-Path (Join-Path $VCPKG_ROOT "vcpkg.exe")) -and -not (Test-Path (Join-Path $VCPKG_ROOT "vcpkg"))) {
        Log-Error "vcpkg not found at $VCPKG_ROOT"
        Log-Error "vcpkg is REQUIRED for building DuckDB with spatial extension"
        Log-Error ""
        Log-Error "Install vcpkg:"
        Log-Error "  git clone https://github.com/Microsoft/vcpkg.git $HOME\vcpkg"
        Log-Error "  .\vcpkg\bootstrap-vcpkg.bat"
        Log-Error "  `$env:VCPKG_ROOT = `"$HOME\vcpkg`""
        exit 1
    }
    Log-Info "Using vcpkg: $VCPKG_ROOT"
}

function Check-Ndk {
    if (-not $env:ANDROID_NDK) {
        # Try to find NDK in common locations
        if ($env:ANDROID_HOME) {
            $NDK_DIR = Join-Path $env:ANDROID_HOME "ndk"
            if (Test-Path $NDK_DIR) {
                $versions = Get-ChildItem $NDK_DIR | Sort-Object Name | Select-Object -Last 1
                if ($versions) {
                    $env:ANDROID_NDK = $versions.FullName
                }
            }
        }
        
        # Try Windows default location
        if (-not $env:ANDROID_NDK -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk\ndk")) {
            $versions = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\ndk" | Sort-Object Name | Select-Object -Last 1
            if ($versions) {
                $env:ANDROID_NDK = $versions.FullName
            }
        }
    }

    if (-not $env:ANDROID_NDK -or -not (Test-Path $env:ANDROID_NDK)) {
        Log-Error "Android NDK not found!"
        Log-Error "Please set ANDROID_NDK environment variable or install NDK via Android Studio"
        Log-Error "  Android Studio -> Tools -> SDK Manager -> SDK Tools -> NDK (Side by side)"
        exit 1
    }

    Log-Info "Using Android NDK: $env:ANDROID_NDK"
}

function Check-Tools {
    $missingTools = @()
    if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) { $missingTools += "cmake" }
    if (-not (Get-Command ninja -ErrorAction SilentlyContinue)) { $missingTools += "ninja" }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { $missingTools += "git" }

    if ($missingTools.Count -gt 0) {
        Log-Error "Missing required tools: $($missingTools -join ', ')"
        Log-Error "Please install them."
        exit 1
    }

    # Add Git's usr/bin to PATH for patch.exe (required by DuckDB extension build scripts)
    $gitPath = (Get-Command git).Source
    if ($gitPath) {
        $gitDir = Split-Path (Split-Path $gitPath)
        $usrBin = Join-Path $gitDir "usr\bin"
        if (Test-Path (Join-Path $usrBin "patch.exe")) {
            Log-Info "Adding Git tools to PATH: $usrBin"
            $env:PATH = "$usrBin;$env:PATH"
        } else {
            Log-Warn "patch.exe not found in $usrBin. Build may fail if extensions require patching."
        }
    }
}

function Get-SpatialSource {
    $spatialDir = Join-Path $PROJECT_ROOT "build\spatial\duckdb-spatial"
    Log-Step "Getting duckdb-spatial source..."
    
    New-Item -ItemType Directory -Force -Path (Join-Path $PROJECT_ROOT "build\spatial") | Out-Null
    
    if (Test-Path $spatialDir) {
        Log-Info "Using existing duckdb-spatial source..."
    } else {
        Log-Info "Cloning duckdb-spatial repository..."
        git clone --recurse-submodules https://github.com/duckdb/duckdb-spatial.git $spatialDir
    }
    
    Push-Location $spatialDir
    git reset --hard
    git submodule update --init --recursive
    Pop-Location
}

function Get-VssSource {
    $vssDir = Join-Path $PROJECT_ROOT "build\vss\duckdb-vss"
    Log-Step "Getting duckdb-vss source..."
    
    New-Item -ItemType Directory -Force -Path (Join-Path $PROJECT_ROOT "build\vss") | Out-Null
    
    if (Test-Path $vssDir) {
        Log-Info "Using existing duckdb-vss source..."
        Push-Location $vssDir
        git reset --hard
        git fetch origin
        git pull
        Pop-Location
    } else {
        Log-Info "Cloning duckdb-vss repository..."
        git clone --recurse-submodules https://github.com/duckdb/duckdb-vss $vssDir
    }
}

function Get-DuckPgqSource {
    $duckpgqDir = Join-Path $PROJECT_ROOT "build\duckpgq\duckpgq-extension"
    Log-Step "Getting duckpgq-extension source..."
    
    New-Item -ItemType Directory -Force -Path (Join-Path $PROJECT_ROOT "build\duckpgq") | Out-Null
    
    if (Test-Path $duckpgqDir) {
        Log-Info "Using existing duckpgq-extension source..."
        Push-Location $duckpgqDir
        git reset --hard
        git fetch origin
        git checkout v1.4-andium
        git pull origin v1.4-andium
        Pop-Location
    } else {
        Log-Info "Cloning duckpgq-extension repository..."
        git clone --recurse-submodules -b v1.4-andium https://github.com/cwida/duckpgq-extension $duckpgqDir
    }
    
    Push-Location $duckpgqDir
    # Force HTTPS for submodules
    if (Test-Path ".gitmodules") {
        Log-Info "Switching submodule URLs from SSH to HTTPS..."
        (Get-Content .gitmodules) -replace 'git@github.com:', 'https://github.com/' | Set-Content .gitmodules
        git submodule sync
    }
    git submodule update --init --recursive
    Pop-Location
}

function Create-VssExtensionConfig {
    $configDir = Join-Path $PROJECT_ROOT "build\vss"
    $configFile = Join-Path $configDir "vss_extension_config.cmake"
    $vssDir = (Join-Path $PROJECT_ROOT "build\vss\duckdb-vss").Replace("\", "/")
    
    Log-Info "Creating custom VSS extension config for static linking..."
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    
    $content = @"
# Custom VSS extension config for static linking
# This overrides the default config which has DONT_LINK

duckdb_extension_load(vss
    SOURCE_DIR ${vssDir}
    LOAD_TESTS
)
"@
    Set-Content -Path $configFile -Value $content -Encoding UTF8 -NoNewline
    Log-Info "VSS extension config created at: $configFile"
}

function Create-DuckPgqExtensionConfig {
    $configDir = Join-Path $PROJECT_ROOT "build\duckpgq"
    $configFile = Join-Path $configDir "duckpgq_extension_config.cmake"
    $duckpgqDir = (Join-Path $PROJECT_ROOT "build\duckpgq\duckpgq-extension").Replace("\", "/")
    
    Log-Info "Creating custom DuckPGQ extension config for static linking..."
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    
    $content = @"
# Custom DuckPGQ extension config for static linking

duckdb_extension_load(duckpgq
    SOURCE_DIR ${duckpgqDir}
    LOAD_TESTS
)
"@
    Set-Content -Path $configFile -Value $content -Encoding UTF8 -NoNewline
    Log-Info "DuckPGQ extension config created at: $configFile"
}

function Install-VcpkgDeps {
    param([string]$Triplet)
    
    $spatialDir = Join-Path $PROJECT_ROOT "build\spatial\duckdb-spatial"
    $hostTriplet = "x64-windows" # Assuming Windows host for PowerShell script
    
    Log-Step "Installing vcpkg dependencies for $Triplet (host: $hostTriplet)..."
    Log-Info "This may take 30-60 minutes on first run (building GDAL, GEOS, PROJ from source)..."
    
    Push-Location $spatialDir
    
    if (-not (Test-Path "vcpkg.json.original")) {
        Copy-Item "vcpkg.json" "vcpkg.json.original"
    }
    
    $vcpkgJsonContent = @"
{
  "dependencies": [
    "vcpkg-cmake",
    "openssl",
    "zlib",
    "geos",
    "expat",
    {
      "name": "sqlite3",
      "features": ["rtree"],
      "default-features": false
    },
    {
      "name": "proj",
      "default-features": false,
      "version>=": "9.1.1"
    },
    {
      "name": "curl",
      "features": ["openssl"],
      "default-features": false
    },
    {
      "name": "gdal",
      "version>=": "3.8.5",
      "features": [
        "network",
        "geos"
      ]
    }
  ],
  "vcpkg-configuration": {
    "overlay-ports": [
      "./vcpkg_ports"
    ],
    "registries": [
      {
        "kind": "git",
        "repository": "https://github.com/duckdb/vcpkg-duckdb-ports",
        "baseline": "3c7b96fa186c27eae2226a1b5b292f2b2dd3cf8f",
        "packages": [ "vcpkg-cmake" ]
      }
    ]
  },
  "builtin-baseline" : "ce613c41372b23b1f51333815feb3edd87ef8a8b"
}
"@
    Set-Content -Path "vcpkg.json" -Value $vcpkgJsonContent -Encoding UTF8 -NoNewline
    
    $env:ANDROID_NDK_HOME = $env:ANDROID_NDK
    
    $customTripletsDir = Join-Path $spatialDir "custom-triplets"
    New-Item -ItemType Directory -Force -Path $customTripletsDir | Out-Null
    
    $arm64Content = @"
set(VCPKG_TARGET_ARCHITECTURE arm64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Android)
set(VCPKG_CMAKE_SYSTEM_VERSION $ANDROID_API_LEVEL)
set(VCPKG_MAKE_BUILD_TRIPLET "--host=aarch64-linux-android")
set(VCPKG_CMAKE_CONFIGURE_OPTIONS -DANDROID_ABI=arm64-v8a)
"@
    Set-Content -Path (Join-Path $customTripletsDir "arm64-android.cmake") -Value $arm64Content -Encoding UTF8 -NoNewline

    $x64Content = @"
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Android)
set(VCPKG_CMAKE_SYSTEM_VERSION $ANDROID_API_LEVEL)
set(VCPKG_MAKE_BUILD_TRIPLET "--host=x86_64-linux-android")
set(VCPKG_CMAKE_CONFIGURE_OPTIONS -DANDROID_ABI=x86_64)
"@
    Set-Content -Path (Join-Path $customTripletsDir "x64-android.cmake") -Value $x64Content -Encoding UTF8 -NoNewline

    Log-Info "Created custom triplets with Android API level $ANDROID_API_LEVEL"
    
    $apiMarker = Join-Path $spatialDir "vcpkg_installed\.api_level_$ANDROID_API_LEVEL"
    if ((Test-Path (Join-Path $spatialDir "vcpkg_installed\$Triplet")) -and -not (Test-Path $apiMarker)) {
        Log-Warn "Removing old vcpkg installation (different API level)..."
        Remove-Item -Recurse -Force (Join-Path $spatialDir "vcpkg_installed")
    }
    
    # Fix patch files line endings (CRLF -> LF) to prevent "corrupt patch" errors on Windows
    Log-Info "Fixing patch file line endings..."
    if (Test-Path (Join-Path $spatialDir "vcpkg_ports")) {
        Get-ChildItem -Path (Join-Path $spatialDir "vcpkg_ports") -Recurse -Filter "*.patch" | ForEach-Object {
            $content = [IO.File]::ReadAllText($_.FullName)
            if ($content -match "`r`n") {
                $content = $content -replace "`r`n", "`n"
                [IO.File]::WriteAllText($_.FullName, $content)
                Log-Info "  Converted $($_.Name) to LF"
            }
        }
    }

    $vcpkgExe = Join-Path $VCPKG_ROOT "vcpkg"
    if (Test-Path "$vcpkgExe.exe") { $vcpkgExe = "$vcpkgExe.exe" }
    
    & $vcpkgExe install `
        --triplet="$Triplet" `
        --host-triplet="$hostTriplet" `
        --x-install-root="$(Join-Path $spatialDir 'vcpkg_installed')" `
        --overlay-triplets="$customTripletsDir"
        
    if ($LASTEXITCODE -ne 0) {
        Log-Error "vcpkg install failed"
        exit 1
    }
    
    New-Item -ItemType File -Force -Path $apiMarker | Out-Null
    Log-Info "vcpkg dependencies installed for $Triplet"
    
    Pop-Location
}

function Build-For-Abi {
    param(
        [string]$Abi,
        [string]$Triplet
    )
    
    $platformName = "android_${Abi}"
    $spatialDir = Join-Path $PROJECT_ROOT "build\spatial\duckdb-spatial"
    $duckpgqDir = Join-Path $PROJECT_ROOT "build\duckpgq\duckpgq-extension"
    $buildPath = Join-Path $spatialDir "build\${platformName}"
    $vssConfig = (Join-Path $PROJECT_ROOT "build\vss\vss_extension_config.cmake").Replace("\", "/")
    $duckpgqConfig = (Join-Path $PROJECT_ROOT "build\duckpgq\duckpgq_extension_config.cmake").Replace("\", "/")
    
    Log-Step "Building DuckDB with all extensions for $Abi..."
    
    Install-VcpkgDeps -Triplet $Triplet
    
    Push-Location $spatialDir
    
    $vcpkgInstalled = Join-Path $spatialDir "vcpkg_installed\$Triplet"
    if (-not (Test-Path $vcpkgInstalled)) {
        Log-Error "vcpkg installation not found at $vcpkgInstalled"
        exit 1
    }
    
    Log-Info "Using vcpkg libraries from: $vcpkgInstalled"
    
    $hostTriplet = "x64-windows"
    
    if (Test-Path $buildPath) {
        Remove-Item -Recurse -Force $buildPath
    }
    New-Item -ItemType Directory -Force -Path $buildPath | Out-Null
    
    Log-Info "Running CMake configuration..."
    Log-Info "  Source: $duckpgqDir\duckdb (Forked for DuckPGQ)"
    Log-Info "  Extension configs: spatial + vss + duckpgq"
    Log-Info "  In-tree extensions: $DUCKDB_EXTENSIONS"
    
    $customTripletsDir = (Join-Path $spatialDir "custom-triplets").Replace("\", "/")
    $vcpkgRootCmake = (Join-Path $VCPKG_ROOT "scripts/buildsystems/vcpkg.cmake").Replace("\", "/")
    $androidToolchain = (Join-Path $env:ANDROID_NDK "build/cmake/android.toolchain.cmake").Replace("\", "/")
    $vcpkgInstalledDir = (Join-Path $spatialDir "vcpkg_installed").Replace("\", "/")
    $vcpkgOverlayPorts = (Join-Path $spatialDir "vcpkg_ports").Replace("\", "/")
    $spatialExtensionConfig = (Join-Path $spatialDir "extension_config.cmake").Replace("\", "/")
    $duckpgqDuckdbSource = (Join-Path $duckpgqDir "duckdb").Replace("\", "/")
    
    # Build with vcpkg toolchain + Android NDK
    cmake -G "Ninja" `
        -DCMAKE_BUILD_TYPE=Release `
        -DCMAKE_TOOLCHAIN_FILE="$vcpkgRootCmake" `
        -DVCPKG_CHAINLOAD_TOOLCHAIN_FILE="$androidToolchain" `
        -DVCPKG_TARGET_TRIPLET="$Triplet" `
        -DVCPKG_HOST_TRIPLET="$hostTriplet" `
        -DVCPKG_INSTALLED_DIR="$vcpkgInstalledDir" `
        -DVCPKG_OVERLAY_PORTS="$vcpkgOverlayPorts" `
        -DVCPKG_OVERLAY_TRIPLETS="$customTripletsDir" `
        -DANDROID_ABI="$Abi" `
        -DANDROID_PLATFORM="android-$ANDROID_API_LEVEL" `
        -DEXTENSION_STATIC_BUILD=ON `
        -DDUCKDB_EXTENSION_CONFIGS="$spatialExtensionConfig;$vssConfig;$duckpgqConfig" `
        -DSPATIAL_USE_NETWORK=ON `
        -DBUILD_SHELL=OFF `
        -DBUILD_UNITTESTS=OFF `
        -DENABLE_EXTENSION_AUTOLOADING=ON `
        -DENABLE_EXTENSION_AUTOINSTALL=OFF `
        -DDUCKDB_EXTRA_LINK_FLAGS="-llog -Wl,-z,max-page-size=16384" `
        -DDUCKDB_EXPLICIT_PLATFORM="$platformName" `
        -DLOCAL_EXTENSION_REPO="" `
        -DOVERRIDE_GIT_DESCRIBE="" `
        -DBUILD_EXTENSIONS="$DUCKDB_EXTENSIONS" `
        -S "$duckpgqDuckdbSource" `
        -B "$buildPath"
        
    if ($LASTEXITCODE -ne 0) {
        Log-Error "CMake configuration failed"
        exit 1
    }
    
    Log-Info "Building DuckDB (this may take a while)..."
    cmake --build "$buildPath" --config Release
    
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Build failed"
        exit 1
    }
    
    # Copy the built library
    $outputAbiDir = Join-Path $OUTPUT_DIR "jniLibs\$Abi"
    New-Item -ItemType Directory -Force -Path $outputAbiDir | Out-Null
    
    $libPath = Join-Path $buildPath "src\libduckdb.so"
    if (Test-Path $libPath) {
        Copy-Item $libPath $outputAbiDir
        Log-Info "Copied libduckdb.so to $outputAbiDir"
    } else {
        Log-Error "libduckdb.so not found!"
        Get-ChildItem -Path $buildPath -Filter "*.so" -Recurse | Select-Object -First 10
        exit 1
    }
    
    Pop-Location
}

function Copy-Headers {
    $duckpgqDir = Join-Path $PROJECT_ROOT "build\duckpgq\duckpgq-extension"
    $includeDir = Join-Path $OUTPUT_DIR "cpp\include"
    
    Log-Info "Copying DuckDB headers..."
    New-Item -ItemType Directory -Force -Path $includeDir | Out-Null
    Copy-Item (Join-Path $duckpgqDir "duckdb\src\include\duckdb.h") $includeDir
    Log-Info "Headers copied to $includeDir"
}

function Build-ExampleApp {
    Log-Info "Building plugin and example app..."
    
    Push-Location $PROJECT_ROOT
    if (Test-Path "package.json") {
        npm install
        npm run build
    }
    
    Set-Location (Join-Path $PROJECT_ROOT "example-app")
    if (Test-Path "package.json") {
        npm install
        npm run build
        npx cap sync android
    }
    
    Set-Location (Join-Path $PROJECT_ROOT "example-app\android")
    if (Test-Path "gradlew.bat") {
        .\gradlew.bat bundleRelease
        Log-Info "Build complete: $(Join-Path $PROJECT_ROOT 'example-app\android\app\build\outputs\bundle\release\')"
    }
    Pop-Location
}

# Main execution
Log-Info "=== DuckDB Android Build Script (Monolithic) ==="
Log-Info ""
Log-Info "Building DuckDB with ALL extensions statically linked:"
Log-Info "  - spatial (GIS: ST_Point, ST_Distance, ST_Buffer, etc.)"
Log-Info "  - vss (Vector Search: HNSW indexes, vss_join, vss_match)"
Log-Info "  - duckpgq (Graph: Property Graph Queries, SQL/PGQ)"
Log-Info "  - icu (Unicode support)"
Log-Info "  - json (JSON functions)"
Log-Info "  - parquet (Parquet file format)"
Log-Info "  - inet (IP address functions)"
Log-Info "  - tpch, tpcds (Benchmark queries)"
Log-Info ""

Check-Tools
Check-Ndk
Check-Vcpkg

# Get extension sources
Get-SpatialSource
Get-VssSource
Get-DuckPgqSource
Create-VssExtensionConfig
Create-DuckPgqExtensionConfig

Log-Warn "⚠️  First build takes 30-60 minutes (compiling GDAL, GEOS, PROJ)"
Log-Warn "   Subsequent builds are much faster (cached)"
Log-Info ""

# Build for both ABIs
Build-For-Abi -Abi "arm64-v8a" -Triplet "arm64-android"
Build-For-Abi -Abi "x86_64" -Triplet "x64-android"

# Copy headers
Copy-Headers

Log-Info ""
Log-Info "=== Build complete! ==="
Log-Info "Output: $(Join-Path $OUTPUT_DIR 'jniLibs')"
Log-Info ""
Log-Info "All extensions are statically linked and available offline."

if ($BuildApp) {
    Build-ExampleApp
} else {
    Log-Info ""
    Log-Info "To build the example app: .\scripts\build-android.ps1 -BuildApp"
}
