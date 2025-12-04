# Backend Server Setup Guide

This guide explains how to set up and run the backend server for the FC 25 Score Tracker desktop application.

## Quick Start

1. **Double-click `setup-backend.bat`** to start the server
2. The server will automatically open your browser to `http://localhost:8000`
3. To stop the server, press `Ctrl+C` in the command window, or run `stop-backend.bat`

## What These Files Do

### `setup-backend.bat`
This batch file automatically:
- Detects if you have Python or Node.js installed
- Starts a local HTTP server on port 8000
- Opens your default browser to the app
- Keeps the server running until you stop it

### `stop-backend.bat`
This batch file stops any running server on port 8000.

## Requirements

You need one of the following installed on your system:

### Option 1: Python (Recommended)
1. Download Python from https://www.python.org/downloads/
2. During installation, make sure to check **"Add Python to PATH"**
3. Run `setup-backend.bat`

### Option 2: Node.js
1. Download Node.js from https://nodejs.org/
2. Install Node.js
3. The script will automatically install `http-server` for you, or you can install it manually:
   ```
   npm install -g http-server
   ```
4. Run `setup-backend.bat`

## Troubleshooting

### Port 8000 is already in use
- Close any other applications using port 8000
- Or edit `setup-backend.bat` and change `set PORT=8000` to a different port (e.g., `set PORT=8080`)

### "Python is not recognized"
- Python is not installed or not added to PATH
- Reinstall Python and make sure to check "Add Python to PATH" during installation

### "Node.js is not recognized"
- Node.js is not installed
- Install Node.js from https://nodejs.org/

### Server starts but app doesn't load
- Make sure all app files (index.html, app.js, styles.css, etc.) are in the same folder as `setup-backend.bat`
- Check the browser console for errors (F12)

## For Distribution with EXE

When packaging this app as an EXE, make sure to include:
- `setup-backend.bat` - Required
- `stop-backend.bat` - Optional, but helpful
- All app files (index.html, app.js, styles.css, manifest.json, icons, etc.)

**Important:** Users will still need Python or Node.js installed on their system to run the backend server. Consider including Python in your installer, or provide instructions for users to install it.

## Alternative: Embedded Server

For a better user experience in a packaged EXE, consider:
- Using Electron to package the app (includes a built-in server)
- Using a tool like Tauri
- Including a lightweight HTTP server executable with your app

## Manual Server Start

If you prefer to start the server manually:

**Python 3:**
```bash
python -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js (http-server):**
```bash
http-server -p 8000 -c-1
```

Then open your browser to: `http://localhost:8000`

