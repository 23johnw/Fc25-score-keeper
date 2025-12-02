#!/usr/bin/env node
/**
 * Helper script to increment version in service-worker.js
 * Can be run manually: node increment-version.js
 */

const fs = require('fs');
const path = require('path');

const serviceWorkerPath = path.join(__dirname, 'service-worker.js');

try {
    let content = fs.readFileSync(serviceWorkerPath, 'utf8');
    
    // Extract current version
    const match = content.match(/CACHE_NAME\s*=\s*'fc25-score-tracker-v(\d+)'/);
    if (!match) {
        console.error('Could not find version number in service-worker.js');
        process.exit(1);
    }
    
    const currentVersion = parseInt(match[1], 10);
    const newVersion = currentVersion + 1;
    
    // Replace version
    content = content.replace(`v${currentVersion}`, `v${newVersion}`);
    
    // Write back
    fs.writeFileSync(serviceWorkerPath, content, 'utf8');
    
    console.log(`✓ Incremented version: v${currentVersion} -> v${newVersion}`);
} catch (error) {
    console.error('Error updating version:', error.message);
    process.exit(1);
}

