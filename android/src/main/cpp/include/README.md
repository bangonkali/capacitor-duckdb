# DuckDB Headers

This directory contains DuckDB C API headers.

## Contents

After running `./scripts/build-android.sh`, this directory will contain:

```
include/
└── duckdb.h
```

## Building

Run from the project root:

```bash
./scripts/build-android.sh
```

The build script automatically copies the required headers from the DuckDB source.
