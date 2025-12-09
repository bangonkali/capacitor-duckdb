const https = require('https');
const pkg = require('../package.json');

const DEFAULT_REPO_URL = 'https://github.com/bangonkali/capacitor-duckdb';
const repoUrlFromPackage = pkg.repository?.url ? pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '') : DEFAULT_REPO_URL;
const REPO_URL = process.env.REPO_URL || repoUrlFromPackage || DEFAULT_REPO_URL;
const BINARY_BASE_URL = `${REPO_URL}/releases/download/v${pkg.version}`;

const assets = [
    'android-libs.zip',
    'libduckdb.a'
];

function head(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'HEAD' }, (res) => {
            const status = res.statusCode || 0;
            if ([301, 302, 307, 308].includes(status) && res.headers.location) {
                return resolve(head(res.headers.location));
            }
            if (status === 200) {
                return resolve({ ok: true, status });
            }
            return reject(new Error(`Unexpected status ${status} for ${url}`));
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log(`Checking release assets at ${BINARY_BASE_URL}`);
    const failures = [];

    for (const asset of assets) {
        const url = `${BINARY_BASE_URL}/${asset}`;
        try {
            await head(url);
            console.log(`✅ Found: ${url}`);
        } catch (err) {
            console.error(`❌ Missing: ${url}`);
            failures.push({ asset, error: err.message });
        }
    }

    if (failures.length) {
        console.error('\nRequired release assets are missing:');
        for (const f of failures) {
            console.error(`- ${f.asset}: ${f.error}`);
        }
        process.exit(1);
    }

    console.log('All required release assets are available.');
}

main().catch((err) => {
    console.error('check-release-assets failed:', err);
    process.exit(1);
});
