# Screen modules

Each major screen can have its own module under `src/screens/` to keep `app-controller.js` smaller and screen logic in one place.

## Pattern

- **`init(controller)`** – Attach event listeners for this screen. Called once when the app starts via `registerScreens(controller)`.
- **`load(controller)`** – Optional. Run when the screen is shown (e.g. refresh data). Can be called from `showScreen()` in app-controller when that screen becomes active.

## Adding a new screen module

1. Create `src/screens/your-screen.js`:

   ```js
   export function init(controller) {
     // e.g. document.addEventListener('click', ...) for buttons on this screen
   }
   export function load(controller) {
     // optional: refresh content when screen is shown
   }
   ```

2. In `src/screens/index.js`, import the module and add it to the `screens` object.

3. In app-controller, remove the event listeners and load logic that now live in the screen module; call `loadScreen('yourScreen', this)` from `showScreen()` when `screenId === 'yourScreen'` if you use `load()`.

## Current modules

- **more-screen.js** – More tab (History + Settings entry). Handles clicks on `.more-option-btn` to navigate to History or Settings.
- **history-screen.js** – Match history list/timeline, filters, sort, quick filters. Load: sync list/timeline toggle, loadMatchHistory().
- **settings-screen.js** – Settings tabs, API keys, data management, admin PIN, debug log. Load: loadSettingsScreen().
- **players-screen.js** – Add/edit players, lock, presence. Load: loadPlayersIntoUI(), updatePlayerNameHistory().
- **teams-screen.js** – Team combinations, Sync Top Teams, league presets, confirm sequence. Load: loadTeamCombinations().
- **sequence-screen.js** – Game sequence list, start games. Load: loadSequenceList().
- **match-screen.js** – Record score, extra time/penalties, undo. Load: no-op (state set by startGames).
- **stats-screen.js** – Stats tabs, mode toggle, share/export, by-date. Load: ensureChartJs() then loadStatistics(), etc.
- **session-screen.js** – Session wizard (players → teams → match), advanced link. Load: applyUiMode() or loadSessionWizard(), updateBackToSessionButton().
