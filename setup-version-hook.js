#!/usr/bin/env node
/**
 * Setup script to install the version auto-increment git hook
 * Run: node setup-version-hook.js
 */

const fs = require('fs');
const path = require('path');

const hookContent = `#!/bin/sh
# Pre-commit hook to automatically increment version when app files change
# Works on Windows (Git Bash), Linux, and Mac

# Files that should trigger version update
APP_FILES="app.js index.html styles.css"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# Check if service-worker.js is being committed with version changes
if echo "$STAGED_FILES" | grep -q "^service-worker.js$"; then
    # Check if CACHE_NAME line changed (manual version update)
    if git diff --cached service-worker.js | grep -q "^[+-].*CACHE_NAME.*v[0-9]"; then
        # Version was manually updated, don't auto-update
        exit 0
    fi
fi

# Check if any app files (except service-worker.js) are in staged changes
NEEDS_VERSION_UPDATE=false
for file in $APP_FILES; do
    if echo "$STAGED_FILES" | grep -q "^$file$"; then
        NEEDS_VERSION_UPDATE=true
        break
    fi
done

# If app files changed, auto-increment version
if [ "$NEEDS_VERSION_UPDATE" = true ]; then
    if [ ! -f service-worker.js ]; then
        echo "Warning: service-worker.js not found, skipping version update"
        exit 0
    fi
    
    # Extract current version number
    CURRENT_VERSION=$(grep "CACHE_NAME.*v[0-9]" service-worker.js | sed -E 's/.*v([0-9]+).*/\1/')
    
    if [ -z "$CURRENT_VERSION" ]; then
        echo "Warning: Could not extract version number from service-worker.js"
        exit 0
    fi
    
    # Increment version
    NEW_VERSION=$((CURRENT_VERSION + 1))
    
    # Update service-worker.js - handle different sed syntax
    OS=$(uname -s)
    if [ "$OS" = "MINGW" ] || [ "$OS" = "MSYS" ] || [ "$OS" = "CYGWIN" ] || echo "$OS" | grep -q "MSYS"; then
        # Windows Git Bash
        sed -i "s/v$CURRENT_VERSION/v$NEW_VERSION/g" service-worker.js
    elif [ "$OS" = "Darwin" ]; then
        # macOS
        sed -i '' "s/v$CURRENT_VERSION/v$NEW_VERSION/g" service-worker.js
    else
        # Linux
        sed -i "s/v$CURRENT_VERSION/v$NEW_VERSION/g" service-worker.js
    fi
    
    # Stage the updated file
    git add service-worker.js
    
    echo "Auto-incremented version: v$CURRENT_VERSION -> v$NEW_VERSION"
fi

exit 0
`;

const hooksDir = path.join(__dirname, '.git', 'hooks');
const hookPath = path.join(hooksDir, 'pre-commit');

try {
    // Create .git/hooks directory if it doesn't exist
    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }
    
    // Write the hook
    fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
    
    console.log('✓ Git hook installed successfully!');
    console.log('  The version will now auto-increment when you commit changes to:');
    console.log('  - app.js');
    console.log('  - index.html');
    console.log('  - styles.css');
} catch (error) {
    console.error('Error installing hook:', error.message);
    process.exit(1);
}

