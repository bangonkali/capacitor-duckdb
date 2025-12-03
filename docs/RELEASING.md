# Releasing

This project uses an automated release pipeline to distribute native binaries (Android .so files and iOS static libraries) alongside the npm package. This is necessary because the native binaries are too large to be included directly in the npm package.

## Release Flow

1.  **Trigger**: A new tag (e.g., `v0.0.1`) is pushed to the repository.
2.  **Bitrise Build**: Bitrise triggers the `build_npm_package` workflow.
    *   It builds the Android binaries (with spatial extension).
    *   It builds the iOS binaries (with spatial extension).
    *   It packs the npm package.
    *   It zips the Android binaries into `android-libs.zip`.
3.  **GitHub Release**: Bitrise uploads the following artifacts to a new GitHub Release matching the tag:
    *   `android-libs.zip`
    *   `libduckdb.a` (iOS)
    *   `package.tgz` (npm tarball)
4.  **NPM Publish**: (Currently manual) You download the `package.tgz` from the release (or build locally) and run `npm publish`.
    *   *Note: You can automate npm publish in Bitrise too if you add an NPM token.*

## Installation Flow (User Side)

When a user runs `npm install @bangonkali/capacitor-duckdb`:

1.  npm installs the JS/TS code.
2.  The `postinstall` script (`scripts/install-binaries.js`) is executed.
3.  The script detects the package version from `package.json`.
4.  It downloads the corresponding native binaries from the GitHub Release for that version.
5.  It extracts them to:
    *   `node_modules/@bangonkali/capacitor-duckdb/android/src/main/jniLibs/`
    *   `node_modules/@bangonkali/capacitor-duckdb/ios/Sources/CapacitorDuckDbPlugin/`

## Prerequisites for Release

To ensure the pipeline works:

1.  **Bitrise Permissions**: The Bitrise GitHub App must have "Extend GitHub App permissions to builds" enabled in Project Settings > Git Provider. This allows it to create releases.
2.  **NPM Token**: You must add a Secret in Bitrise named `NPM_TOKEN`.
    *   Generate a "Granular Access Token" on [npmjs.com](https://www.npmjs.com/) with "Read and Publish" permissions.
    *   Add it to Bitrise Secrets (do not expose to PRs).
3.  **Tagging**: You must push a tag.
    ```bash
    git tag v0.0.2
    git push origin v0.0.2
    ```

## Troubleshooting

### "Failed to download binaries"
If users report this, check:
1.  Does the GitHub Release for that version exist?
2.  Does it contain `android-libs.zip` and `libduckdb.a`?
3.  Are the assets public?

### "Unzip not found"
The install script relies on the system `unzip` command. This is standard on macOS and Linux (CI environments). Windows users might need Git Bash or similar.
