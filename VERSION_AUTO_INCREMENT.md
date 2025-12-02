# Automatic Version Increment

The repository includes an automatic version increment system that updates the cache version in `service-worker.js` whenever you commit changes to the main app files.

## How It Works

A **Git pre-commit hook** (`.git/hooks/pre-commit`) automatically:
- Detects when `app.js`, `index.html`, or `styles.css` are being committed
- Increments the version number in `service-worker.js` (e.g., v24 → v25)
- Adds the updated `service-worker.js` to your commit

## Features

- **Automatic**: No need to remember to update the version
- **Smart**: Only increments when app files change
- **Respects manual updates**: If you manually change the version in `service-worker.js`, it won't auto-increment
- **Cross-platform**: Works on Windows (Git Bash), Linux, and Mac

## When Version Updates

The version will auto-increment when you commit changes to:
- `app.js`
- `index.html`
- `styles.css`

The version will **NOT** auto-increment if:
- Only `service-worker.js` is being committed (unless you manually changed the version)
- Only other files (like README.md, etc.) are being committed
- You manually updated the version yourself (the hook detects this)

## Manual Version Update

If you need to manually update the version without committing app files:

1. Edit `service-worker.js` and change the version number
2. Commit the file normally - the hook will detect your manual change and won't override it

## Manual Script

You can also manually increment the version using:

```bash
node increment-version.js
```

## Disabling Auto-Increment

To disable automatic version increment:

1. Remove or rename `.git/hooks/pre-commit`
2. Or add `SKIP_VERSION_CHECK=1` to your commit command (requires hook modification)

## Troubleshooting

If the hook doesn't run:
- Make sure `.git/hooks/pre-commit` is executable: `chmod +x .git/hooks/pre-commit`
- On Windows, ensure you're using Git Bash or have Git installed properly
- Check that the hook file exists and has the correct permissions

If you see warnings:
- The hook will skip version updates if it can't find or parse the version
- Your commit will still proceed - version just won't be auto-updated

