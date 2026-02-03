# FC 25 Score Tracker

A Progressive Web App (PWA) for tracking FC 25 football match scores and statistics on Android phones.

## Features

- **Player Management**: Add 1-4 player names
- **Team Combination Generator**: Automatically generates all possible team combinations (2v2, 2v1, or 1v1)
- **Game Sequence Selection**: Select and order which matches to play for the night
- **Match Recording**: Record wins, losses, and draws with timestamps
- **Statistics Tracking**: 
  - Season statistics (resets with each new season)
  - Overall statistics (across all seasons)
  - Modular statistics system (easily add new statistics)
- **Season Management**: Start new seasons while preserving overall statistics

## Installation on Android

1. **Host the files**: Upload all files to a web server or use a local development server
2. **Open in browser**: Navigate to the app URL in Chrome/Edge on your Android device
3. **Install**: Tap the menu (three dots) → "Add to Home screen" or "Install app"
4. **Use offline**: The app works offline once installed

## Local Development

1. **npm script (recommended)**:

   ```bash
   npm run start
   ```

   Then open `http://localhost:3000` in your browser.

2. **Simple HTTP Server**: Use Python's built-in server:
   ```bash
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser

3. **Or use any local server**: Serve the files from the project directory

## Usage

1. **Add Players**: Enter 1-4 player names on the Players screen
2. **View Teams**: The app automatically shows all possible team combinations
3. **Select Sequence**: Tap combinations to select them, then confirm the sequence
4. **Play Matches**: Record results as you play (Win Team 1, Draw, Win Team 2)
5. **View Statistics**: Check season and overall statistics anytime

## Statistics

The app tracks:
- **Wins, Losses, Draws**: Per player
- **Win Rate**: Percentage of games won
- **Current Streak**: Active win or loss streak

Statistics are modular - new statistics can be easily added by registering new calculator modules.

## File Structure

```
/
├── index.html          # Main app entry point
├── manifest.json       # PWA manifest for installation
├── service-worker.js   # Service worker for offline functionality
├── styles.css          # Mobile-responsive styling
├── src/                # ES module source (loaded directly by browser)
│   ├── app-controller.js  # Main controller / app entry module
│   ├── main.js            # Service worker registration bootstrap
│   ├── screens/           # One module per screen (Players/Teams/Match/Stats/etc.)
│   └── ...                # Managers, persistence, stats, sharing, etc.
└── README.md           # This file
```

## Browser Support

- Chrome (Android) - Recommended
- Edge (Android)
- Firefox (Android) - Partial PWA support
- Safari (iOS) - Limited PWA support

## Data Storage

All data is stored locally in your browser's localStorage. To reset all data, clear your browser's storage for this site.

## Adding New Statistics

The statistics system is modular. To add a new statistic:

1. Create a calculator object with:
   - `id`: Unique identifier
   - `name`: Display name
   - `calculate`: Function that takes (matches, players) and returns calculated data
   - `display`: Function that takes data and returns a DOM element

2. Register it: `StatisticsCalculators.register(yourCalculator)`

See the existing calculators in `src/stats-calculators.js` and how they are rendered in `src/statistics-display.js`.

## Future Enhancements

- Cloud sync capability
- Goals scored/conceded tracking
- Match history timeline
- Export statistics
- Custom team colors/icons

