const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

try {
    console.log('Fetching build details...');
    const jsonOutput = execSync('npx eas-cli build:list --limit 1 --json --non-interactive', { encoding: 'utf-8' });
    const builds = JSON.parse(jsonOutput);

    if (!builds || builds.length === 0) {
        console.error('No builds found.');
        process.exit(1);
    }

    const latestBuild = builds[0];
    const downloadUrl = latestBuild.artifacts?.buildUrl;

    if (!downloadUrl) {
        console.error('No download URL found in the latest build.');
        console.log('Build status:', latestBuild.status);
        process.exit(1);
    }

    console.log(`Found APK URL: ${downloadUrl}`);
    console.log('Downloading to medicare-plus.apk...');

    const file = fs.createWriteStream("medicare-plus.apk");
    https.get(downloadUrl, function (response) {
        response.pipe(file);
        file.on('finish', function () {
            file.close(() => {
                console.log('Download completed successfully: medicare-plus.apk');
            });
        });
    }).on('error', function (err) {
        fs.unlink("medicare-plus.apk");
        console.error('Error downloading file:', err.message);
    });

} catch (error) {
    console.error('Error:', error.message);
}
