# Releasing

This project uses an automated Bitrise **graph** pipeline to distribute native binaries (Android `.so` files and the iOS XCFramework) alongside the npm package. The native binaries stay out of the npm tarball to keep installs fast and allow extension customisation.

## Release Flow

1.  **Trigger**: Pushing a new tag that matches `v*` kicks off the Bitrise `build-publish` pipeline.
2.  **`build-ios-binaries` workflow**
    *   Installs Ninja, CMake, and vcpkg.
    *   Runs `./scripts/build-ios.sh` to build `DuckDB.xcframework` with all extensions (spatial, vss, icu, json, parquet, inet, tpch, tpcds).
    *   Archives the framework as `DuckDB.xcframework.zip` and advertises it to downstream workflows via the intermediate file key `IOS_FRAMEWORK_ZIP_PATH`.
3.  **`build-android-binaries` workflow**
    *   Installs the same toolchain as the iOS workflow.
    *   Runs `./scripts/build-android.sh` which builds all extensions monolithically.
    *   Archives the ABI folders under `android/src/main/jniLibs` into `android-libs.zip` and exposes it as the intermediate file `ANDROID_LIBS_ZIP_PATH`.
4.  **`build-npm-package` workflow** (depends on both build workflows)
    *   Pulls intermediate files so the restored binaries land in `ios/Frameworks` and `android/src/main/jniLibs`.
    *   Aligns `package.json` with the git tag, installs JS dependencies, builds TypeScript, and runs `npm pack`.
    *   Publishes the package to npm automatically when `BITRISE_GIT_TAG` is present.
    *   Creates a GitHub release containing the npm tarball (`RELEASE_ARCHIVE_PATH`), `DuckDB.xcframework.zip`, and `android-libs.zip`.

## Installation Flow (User Side)

When a user runs `npm install @bangonkali/capacitor-duckdb`:

1.  npm installs the JS/TS code.
2.  The `postinstall` script (`scripts/install-binaries.js`) runs automatically.
3.  The script resolves the package version from `package.json`.
4.  It downloads the release assets produced by the pipeline and extracts them to:
    *   `node_modules/@bangonkali/capacitor-duckdb/android/src/main/jniLibs/`
    *   `node_modules/@bangonkali/capacitor-duckdb/ios/Sources/CapacitorDuckDbPlugin/`

## Prerequisites for Release

To ensure the pipeline works:

1.  **Bitrise Permissions**: The Bitrise GitHub App must have "Extend GitHub App permissions to builds" enabled in Project Settings > Git Provider. This allows it to create releases.
2.  **NPM Token**: Add a secret named `NPM_TOKEN` so the `Publish to NPM` step can authenticate.
    *   Generate a "Granular Access Token" on [npmjs.com](https://www.npmjs.com/) with "Read and Publish" permissions.
    *   Keep the secret protected from PR builds.
3.  **GitHub Credentials**: Provide `GITHUB_ACCESS_TOKEN` and `GITHUB_USERNAME` so Bitrise can upload release assets via the `github-release` step.
4.  **Tagging**: You must push a tag.
    ```bash
    git tag v0.0.2
    git push origin v0.0.2
    ```

## Troubleshooting

### "Failed to download binaries"
If users report this, check:
1.  Does the GitHub Release for that version exist?
2.  Does it contain `android-libs.zip` and `DuckDB.xcframework.zip`?
3.  Are the assets public?

### "Unzip not found"
The install script relies on the system `unzip` command. This is standard on macOS and Linux (CI environments). Windows users might need Git Bash or similar.
