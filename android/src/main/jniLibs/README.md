# DuckDB Native Libraries

This directory contains prebuilt DuckDB native libraries for Android.

## Contents

After running `./scripts/build-android.sh`, this directory will contain:

```
jniLibs/
├── arm64-v8a/
│   └── libduckdb.so
└── x86_64/
    └── libduckdb.so
```

## Building

Run from the project root:

```bash
./scripts/build-android.sh
```

See `README.md` for build requirements and options.
