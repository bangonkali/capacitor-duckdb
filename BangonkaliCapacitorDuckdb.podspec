require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'BangonkaliCapacitorDuckdb'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['repository']['url']
  s.author = package['author']
  s.source = { :git => package['repository']['url'], :tag => s.version.to_s }
  
  # Swift and Objective-C source files
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  
  # DuckDB XCFramework (static library)
  # Built by: ./scripts/build-ios.sh
  # Contains: arm64 (device) + arm64/x86_64 (simulator) architectures
  # Static linking preferred for iOS:
  #   - No code signing issues with embedded frameworks
  #   - Dead code elimination reduces final app size
  #   - Faster app startup (no dylib loading)
  s.vendored_frameworks = 'ios/Frameworks/DuckDB.xcframework'
  
  # DuckDB C API header location for Swift bridging
  s.public_header_files = 'ios/Sources/CapacitorDuckDbPlugin/include/*.h'
  s.preserve_paths = 'ios/Sources/CapacitorDuckDbPlugin/include/**/*'
  
  # Required system libraries for DuckDB
  # - c++: DuckDB is written in C++, requires C++ standard library
  # - z: zlib for compression (parquet, etc.)
  # - sqlite3: SQLite compatibility layer
  s.libraries = 'c++', 'z', 'sqlite3'
  
  # Required system frameworks
  s.frameworks = 'Foundation', 'Security'
  
  # Build settings for DuckDB integration
  s.pod_target_xcconfig = {
    # Header search path for DuckDB C API
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/ios/Sources/CapacitorDuckDbPlugin/include"',
    # Swift import paths for the CDuckDB module
    'SWIFT_INCLUDE_PATHS' => '"$(PODS_TARGET_SRCROOT)/ios/Sources/CapacitorDuckDbPlugin/include"',
    # Enable C++ interop for Swift
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    # Module stability for framework distribution
    'BUILD_LIBRARY_FOR_DISTRIBUTION' => 'YES',
    # Other linker flags for static library
    'OTHER_LDFLAGS' => '-ObjC -all_load'
  }
  
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
