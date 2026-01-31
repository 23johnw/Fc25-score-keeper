# Refactor and Clean Up FIFA Score Tracker

## Overview

This plan aims to modularize your program by creating dedicated functions for inputting scores/players, displaying statistics, and viewing history. It also includes removing all remnants of Firestore, as `localStorage` is confirmed to be the current data persistence method. The screen management will follow a **decentralized** approach, with each major screen having its own dedicated module for logic.

## Detailed Plan

1.  **Remove Firestore Files and Dependencies**
    *   Delete the following files and directories, as they are no longer needed and refer to the unused Firestore integration:
        *   `.firebaserc`
        *   `firebase.json`
        *   `firestore.indexes.json`
        *   `firestore.rules`
        *   `functions/` (and its entire contents: `.gitignore`, `index.js`, `package-lock.json`, `package.json`)
    *   I will also check the root `package.json` for any remaining Firebase dependencies and remove them if found.

2.  **Refactor `LocalStorageManager` and Implement Screen-Specific Modules**
    *   **Function to Handle Input Scores and Players (`src/data-handler.js`):**
        *   This new file will contain functions like `addPlayer(playerData)` and `recordMatch(matchData)`, abstracting interactions with `LocalStorageManager` for data input.
        *   I will modify `AppController` and any other relevant modules (e.g., `src/match.js`, `src/players.js`) to use these new functions for adding players and recording match results.
    *   **Module for Stats Display (`src/stats-display.js`):**
        *   This existing file will be refactored or created to encapsulate the logic for reading statistics from `LocalStorageManager`, processing them with `statistics-tracker.js` and `stats-calculators.js`, and updating the UI for various statistics views.
        *   It will contain functions like `renderOverallStats()`, `renderPlayerStats(playerName)`, and `renderSeasonStats(seasonId)`.
        *   `AppController` will call these functions to display statistics.
    *   **Module for History Viewing (`src/history-viewer.js`):**
        *   This new file will encapsulate all logic related to displaying match history, including filtering by date. This will move the `initializeByDatePanel`, `toggleByDatePanel`, `updatePlayedDates`, `renderByDateList`, `clearByDateFilter`, and `applyByDateFilter` methods currently in `LocalStorageManager` into this dedicated module.
        *   This module will manage its own UI elements and interact with `LocalStorageManager` to fetch historical data.
        *   `AppController` will be updated to use functions from `src/history-viewer.js` for all history-related interactions.

3.  **Update `AppController` and Other Modules**
    *   `src/app-controller.js` will be updated to import and orchestrate calls to the new modular functions in `src/data-handler.js`, `src/stats-display.js`, and `src/history-viewer.js`. It will act as a central coordinator, but the screen-specific logic will reside in their respective modules.
    *   Other existing modules in `src/` will be adjusted to interact with these new, more focused functions rather than directly with `LocalStorageManager` where applicable.

## Architecture Diagram

```mermaid
graph TD
    User --> AppController
    AppController --> DataHandler[src/data-handler.js]: "addPlayer(), recordMatch()"
    AppController --> StatsDisplayModule[src/stats-display.js]: "renderOverallStats(), etc."
    AppController --> HistoryViewerModule[src/history-viewer.js]: "renderHistory(), filterHistory()"

    DataHandler --> LocalStorageManager[src/persistence.js]
    StatsDisplayModule --> LocalStorageManager
    HistoryViewerModule --> LocalStorageManager

    LocalStorageManager --> StatisticsTracker[src/statistics-tracker.js]
    LocalStorageManager --> StatsCalculators[src/stats-calculators.js]
```

## Todos

*   [remove-firestore-files] Delete all Firestore-related files and dependencies.
*   [refactor-data-input] Create `src/data-handler.js` and move score/player input logic.
*   [refactor-stats-display] Refactor `src/statistics-display.js` to manage reading/displaying statistics, encapsulating display logic.
*   [refactor-history-viewer] Create `src/history-viewer.js` and move history viewing/filtering logic from `src/persistence.js`, encapsulating UI and data interaction for history.
*   [update-app-controller] Update `src/app-controller.js` and other necessary modules to use the new, more modular functions and screen-specific modules.
