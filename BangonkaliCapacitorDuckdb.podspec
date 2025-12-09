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
  
  # Swift source files and C++ wrapper
  # duckdb_ios.cpp uses C++ API internally but exposes C interface
  s.source_files = [
    'ios/Sources/CapacitorDuckDbPlugin/*.swift',
    'ios/Sources/CapacitorDuckDbPlugin/duckdb_ios.hpp',
    'ios/Sources/CapacitorDuckDbPlugin/duckdb_ios.cpp',
    'ios/Sources/CapacitorDuckDbPlugin/include/duckdb.h'
  ]
  
  # DuckDB XCFramework (static library)
  s.vendored_frameworks = 'ios/Frameworks/DuckDB.xcframework'
  
  # Only expose our wrapper header and duckdb.h as public
  # The C++ headers are private implementation details (kept via preserve_paths)
  s.public_header_files = [
    'ios/Sources/CapacitorDuckDbPlugin/include/duckdb.h',
    'ios/Sources/CapacitorDuckDbPlugin/duckdb_ios.hpp'
  ]
  
  # Preserve DuckDB C++ headers for C++ compilation
  s.preserve_paths = [
    'ios/Sources/CapacitorDuckDbPlugin/include/**/*',
    'ios/Sources/CapacitorDuckDbPlugin/include/module.modulemap'
  ]
  
  s.libraries = 'c++', 'z', 'sqlite3'
  s.frameworks = 'Foundation', 'Security'
  
  # Build settings
  s.pod_target_xcconfig = {
    # Header search paths - include DuckDB C++ headers here
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/ios/Sources/CapacitorDuckDbPlugin/include"',
      '"$(PODS_TARGET_SRCROOT)/ios/Sources/CapacitorDuckDbPlugin"'
    ].join(' '),
    'SWIFT_INCLUDE_PATHS' => '"$(PODS_TARGET_SRCROOT)/ios/Sources/CapacitorDuckDbPlugin/include"',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'BUILD_LIBRARY_FOR_DISTRIBUTION' => 'YES',
    'OTHER_LDFLAGS' => '-ObjC -all_load',
    'GCC_ENABLE_CPP_EXCEPTIONS' => 'YES',
    'GCC_ENABLE_CPP_RTTI' => 'YES',
    # Don't treat warnings as errors for DuckDB headers
    'GCC_TREAT_WARNINGS_AS_ERRORS' => 'NO'
  }
  
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
