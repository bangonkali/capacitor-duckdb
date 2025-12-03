const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PACKAGE_JSON = require('../package.json');
const VERSION = PACKAGE_JSON.version;
const REPO_URL = 'https://github.com/bangonkali/capacitor-duckdb'; // Update with your actual repo
const BINARY_BASE_URL = `${REPO_URL}/releases/download/v${VERSION}`;

const PLATFORMS = {
    android: {
        dest: 'android/src/main/jniLibs',
        files: [
            'libduckdb.so' // We might need to handle per-arch downloads if they are separate files
        ]
    },
    ios: {
        dest: 'ios/Sources/CapacitorDuckDbPlugin',
        files: ['libduckdb.a']
    }
};

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

async function main() {
    if (process.env.SKIP_BINARY_DOWNLOAD === 'true') {
        console.log('Skipping binary download as SKIP_BINARY_DOWNLOAD is set to true.');
        return;
    }
    console.log(`Downloading native binaries for version ${VERSION}...`);

    // Create directories if they don't exist
    for (const platform of Object.values(PLATFORMS)) {
        if (!fs.existsSync(platform.dest)) {
            fs.mkdirSync(platform.dest, { recursive: true });
        }
    }

    // Download Android binaries
    // Note: In the Bitrise step, we uploaded android/src/main/jniLibs/**/*.so
    // GitHub Releases usually flatten the structure or we need to zip them.
    // For simplicity, let's assume we zip them into android-libs.zip in Bitrise
    // But wait, the Bitrise config I wrote uploads individual .so files.
    // GitHub Releases will likely just have a bunch of .so files, but they might clash if names are same.
    // Actually, `libduckdb.so` is the same name for different archs.
    // We MUST zip them or rename them (e.g. libduckdb-arm64.so).
    // Let's assume we will update Bitrise to zip them.

    // TODO: Update Bitrise to zip android libs to avoid name collisions and easier download.

    // For now, let's assume we download a zip for android and a static lib for ios.

    try {
        // Android
        const androidZipUrl = `${BINARY_BASE_URL}/android-libs.zip`;
        const androidZipPath = path.join(PLATFORMS.android.dest, 'android-libs.zip');

        console.log(`Downloading Android binaries from ${androidZipUrl}...`);
        await downloadFile(androidZipUrl, androidZipPath);

        console.log('Extracting Android binaries...');
        try {
            const zip = new AdmZip(androidZipPath);
            zip.extractAllTo(PLATFORMS.android.dest, true);
        } catch (e) {
            console.error('Failed to unzip using adm-zip:', e);
            throw e;
        }

        fs.unlinkSync(androidZipPath);

        // iOS
        const iosLibUrl = `${BINARY_BASE_URL}/libduckdb.a`;
        const iosLibPath = path.join(PLATFORMS.ios.dest, 'libduckdb.a');

        console.log(`Downloading iOS binary from ${iosLibUrl}...`);
        await downloadFile(iosLibUrl, iosLibPath);

        console.log('Download complete.');
    } catch (error) {
        console.error('Error downloading binaries:', error.message);
        console.warn('Native functionality may not work until binaries are manually placed.');
        // Don't fail the install, just warn? Or fail?
        // process.exit(1); 
    }
}

main();
