# FC 25 Score Tracker – Improvement Roadmap

This document outlines high-impact improvements across UX, architecture, performance, and polish. Two CSS bugs were fixed in `styles.css` (button block and dark-mode selector).

---

## Overview for new developers: what this app does and what it uses

*Use this section when someone asks: “Good app — what’s it using and what’s it doing?”*

### What the app does

**FC 25 Score Tracker** is a **Progressive Web App (PWA)** for tracking local football (FC 25) match scores and stats when you play with friends on the same device (e.g. one phone passed around).

- **Flow:** You add 1–4 **players** → the app generates all possible **team combinations** (e.g. 2v2, 1v1) → you pick the **order of matches** for the session → you **record each match** (scores, optional extra time/penalties) → you view **statistics** (today, season, overall) and **match history**.
- **Modes:**  
  - **Session:** A guided wizard (Players → Teams → Match) for a quick session.  
  - **Advanced:** Full bottom navigation to Players, Teams, Match, Stats, History, Settings.
- **Features:** Season management (start new season, stats reset per season but overall stats persist), league tables, win/loss/draw and streaks, optional team names from an external API, player colors, Home/Away lock, export/import JSON, PDF export and share, dark mode, optional Admin PIN for editing old matches.
- **Data:** Everything is stored **locally** in the browser (`localStorage`). No backend; the app works offline once installed.

So in one sentence: *it’s a local, offline-first score and stats tracker for FC 25 couch multiplayer.*

---

### Tech stack and systems

| Layer | What we use |
|-------|-------------|
| **Runtime** | Browser only (no Node server for the app itself). |
| **UI** | Plain **HTML** + **CSS** (one `index.html`, one `styles.css`). No React/Vue/Svelte. |
| **Logic** | **JavaScript (ES modules)**. No framework; one main controller + modules. |
| **Entry** | `index.html` loads `src/app-controller.js` as the only ES module entry; that file imports everything else. |
| **Data** | **localStorage** via a single JSON blob (key: `fc25_score_tracker`). No database, no auth. |
| **PWA** | `manifest.json` + `service-worker.js` for installability and offline caching (e.g. for GitHub Pages). |
| **External libs (CDN)** | **Chart.js** (stats charts), **jsPDF** (PDF export). Both lazy-loaded on demand (Chart.js when Stats screen opens, jsPDF when Export PDF is used); no npm install for the app. |
| **APIs (optional)** | **football-data.org** (team names for “Sync Top Teams”), **cors.sh** (CORS proxy for mobile). User supplies API keys in Settings. |
| **Dev / run** | `package.json` has `npm run start` → `npx serve -l 3000`. No bundler (Vite/Webpack) by default. |

So: *vanilla JS + HTML/CSS + localStorage PWA, with Chart.js and jsPDF from CDN.*

---

### Codebase structure (high level)

- **`index.html`** – Single page: all screens are `<section>`s, one visible at a time. Header, bottom nav, modals (e.g. edit match, admin PIN, by-date filter). Inline script block for optional debug/agent logging (can be removed or gated).
- **`styles.css`** – All styles: layout, screens, components, dark mode, responsive. No CSS framework.
- **`src/main.js`** – Registers the service worker and re-exports `AppController`. The real entry point used by the app is **`src/app-controller.js`** (loaded from `index.html`).
- **`src/app-controller.js`** – **Central controller:** one big class that owns state, wires DOM events, and calls into other modules. Handles screen switching, session wizard, players, teams, match recording, stats, history, settings, share, etc. (~5500+ lines; main candidate for splitting by screen/feature).
- **Persistence & data**
  - **`src/persistence.js`** – `LocalStorageManager`: load/save the single JSON blob, migrations, played-dates and by-date filter helpers.
  - **`src/data-handler.js`** – Higher-level data ops (e.g. `syncTeamsFromOnline`).
  - **`src/season.js`** – SeasonManager (current season, start new season).
- **Domain logic**
  - **`src/players.js`** – PlayerManager (CRUD, presence, lock).
  - **`src/team-generator.js`** – Builds team combinations from player list.
  - **`src/match.js`** – MatchRecorder (record match, undo, edit).
  - **`src/statistics-tracker.js`** – Reads matches and computes stats.
  - **`src/stats-calculators.js`** – Stat definitions and calculations (e.g. league table, streaks); **`src/statistics-display.js`** – Renders stats UI (tables, charts).
- **UI / UX**
  - **`src/history-viewer.js`** – Match history list/timeline and filters.
  - **`src/share.js`** – ShareManager (share as image, export PDF).
  - **`src/toast.js`** – Toast notifications.
  - **`src/touch.js`** – TouchSwipeHandler for swipe gestures.
  - **`src/stats-view-toggler.js`** & **`stats-view-toggler-global.js`** – Stats view toggling.
- **Config & external**
  - **`src/settings.js`** – SettingsManager (theme, labels, points, API keys, etc.), backed by persistence.
  - **`src/api-service.js`** – football-data.org and league/team presets.
  - **`src/constants.js`** – App constants.
  - **`src/debug-log.js`** – In-memory debug log for Sync/API troubleshooting.
- **`service-worker.js`** – PWA caching and update checks.

**Pattern:** App is **single-page**: one HTML file, one CSS file, one main JS entry (`app-controller.js`) that imports modules. No build step in the default setup; ES modules loaded directly by the browser. State lives in the controller and in `LocalStorageManager`; UI is updated by the controller and helpers (e.g. `StatisticsDisplay`, `HistoryViewer`).

---

## 1. UX & Onboarding

| Improvement | Why |
|-------------|-----|
| **First-run onboarding** | New users see many screens and options with no guidance. Add a short “How it works” (Players → Teams → Match → Stats) or optional tour. |
| **Session vs Advanced** | “Advanced” is easy to miss. Consider making Session the default with a clear “Use full menu” link, or rename to “Quick session” vs “Full app”. |
| **Empty states** | When there are no players, no matches, or no history, use clear empty-state messages with a single primary action (e.g. “Add your first player”). |
| **Confirm destructive actions** | “Clear All Statistics”, “Clear All Data”, “Delete Match” should use a confirmation dialog (you already have Admin PIN; add a simple confirm for non-admin). |
| **Version banner** | The green “Loading version…” bar is prominent. Consider moving version to Settings/About or a small footer link so the header stays focused. |

---

## 2. Navigation & Information Architecture

| Improvement | Why |
|-------------|-----|
| **Bottom nav (7 items)** | ~~Consider More tab.~~ **Done:** Nav is now 6 items (Session, Players, Teams, Match, Stats, More). History and Settings are under More. |
| **Context in Match screen** | ~~Show “Game 3 of 8” and progress bar.~~ **Done:** Match screen shows “Game X of Y” and a slim progress bar; progress bar width = current/total. |
| **Back from Session** | ~~Clearer labels.~~ **Done:** Session splash link is “Switch to full app”; wizard link is “Exit session”. Stats “Back to Menu” is now “Back”. |
| **Stats tab persistence** | ~~Remember last stats tab.~~ **Done:** `lastStatsTab` is saved in game state and restored on load; Stats screen restores the last tab (Today/Season/Overall). |

---

## 3. Performance & Loading

| Improvement | Why |
|-------------|-----|
| **Single app-controller.js** | ~~Split by screen.~~ **Done:** All main screens are in `src/screens/` (more, history, settings, players, teams, sequence, match, stats, session). The controller delegates via `registerScreens()` and `loadScreen()`. Optional: further trim controller by moving shared helpers into modules. |
| **Chart.js** | ~~Loaded from CDN. Consider self-hosting or loading only on Stats screen.~~ **Done:** Chart.js is lazy-loaded when the user opens the Stats screen (`ensureChartJs()` in app-controller). Optional: self-host for offline reliability. |
| **jsPDF** | ~~Load on demand when user taps “Export PDF”.~~ **Done:** jsPDF is lazy-loaded by `share.js` when the user exports a PDF. |
| **Lazy stats** | Compute heavy stats (e.g. heatmaps, trends) only when the user opens that category tab, not on every stats view. |

---

## 4. Data & Offline

| Improvement | Why |
|-------------|-----|
| **Export/backup reminder** | Periodically (e.g. after N matches or in Settings) suggest “Export a backup” so users don’t lose data if they clear storage or switch devices. |
| **Import validation** | On import, validate JSON shape and show a clear error message (and optionally a “Try again” / “See example” flow). |
| **Sync** | README lists “Cloud sync” as future; even a simple “Export to file / Import from file” flow per device reduces fear of data loss. |

---

## 5. Visual & Accessibility

| Improvement | Why |
|-------------|-----|
| **Focus styles** | Ensure all interactive elements (buttons, inputs, tabs) have visible focus (e.g. `:focus-visible` ring) for keyboard and assistive tech. |
| **Contrast** | Review WCAG AA for text and buttons, especially in dark mode and on the green version banner. |
| **Touch targets** | You already use min 44px in many places; audit remaining controls (e.g. category tabs, lock buttons, date inputs) for consistency. |
| **Red “testing” button** | ~~Move to Settings.~~ **Done:** “Clear All Statistics (testing)” now lives under Settings → Data Management. |

---

## 6. Code & Maintainability

| Improvement | Why |
|-------------|-----|
| **Split AppController** | ~~Break into screen modules.~~ **Done:** Nine screen modules in `src/screens/` (more, history, settings, players, teams, sequence, match, stats, session). The main controller wires them via `registerScreens()` and `loadScreen()`. See `src/screens/README.md`. |
| **Centralize DOM IDs** | Replace repeated `document.getElementById('...')` with a small “DOM refs” module or constants so renames and structure changes are easier. |
| **Remove or gate debug agent** | The inline script in `index.html` that POSTs to `http://127.0.0.1:7249/ingest/...` will fail in production and can clutter the console. Remove or guard with a build flag / env check. |
| **README vs code** | ~~README still mentions `app.js` and an older structure.~~ **Done:** README now reflects the ES module structure and points at `src/app-controller.js` / `src/screens/`. |

---

## 7. Features (from README / plan)

| Improvement | Why |
|-------------|-----|
| **Match history timeline** | You have a timeline view; consider a simple “Matches this month” or “Activity by week” summary on Stats or History. |
| **Goals scored/conceded** | You already store scores; adding optional goals-for/goals-against per team/player would enable more stats (e.g. goal difference, form). |
| **Custom team colors/icons** | You have player colors in Settings; extending to “team strip” or icon per session could make match screens more recognizable. |
| **Finish plan.md refactor** | `plan.md` describes moving history/stats logic into `history-viewer.js` and `stats-display.js`. Completing that will keep persistence and UI concerns separated and simplify testing. |

---

## 8. Quick Wins Already Done

- **CSS**  
  - Fixed malformed `.btn` block in `styles.css` (duplicate/orphaned rules and extra `}`).  
  - Fixed dark-mode selector so `.team-name-badge` is not grouped with `body.dark-mode` only; light/dark styling is correct.
- **Performance**  
  - Chart.js lazy-loaded when Stats screen opens; jsPDF lazy-loaded when Export PDF is used.
- **UX**  
  - “Clear All Statistics (Testing)” moved to Settings → Data Management.
- **Code**  
  - Screen split: `src/screens/` with 9 screen modules; `app-controller.js` delegates via `registerScreens()` and `loadScreen()`.
- **Navigation**  
  - Match screen: “Game X of Y” label and slim progress bar; session labels “Switch to full app” / “Exit session”; Stats “Back”; stats tab persisted in game state and restored on load.

---

## Suggested Priority

1. ~~**High impact, low effort:** Move “Clear All Statistics (Testing)” to Settings; add confirmations for destructive actions; improve empty states.~~ **Done.**  
2. ~~**High impact, medium effort:** Reduce bottom nav (e.g. “More” or combined Setup flow); lazy-load Chart.js and jsPDF.~~ **Done.**  
3. ~~**Medium term:** Split `app-controller.js` further by screen.~~ **Done.** Remaining: complete plan.md refactor; optional onboarding (first-run overlay done).  
4. **Later:** Lazy stats (compute heatmaps/trends only when category tab opens); cloud sync, goals tracking, README/agent cleanup.

If you tell me which area you want to tackle first (e.g. “navigation”, “split app controller”, “onboarding”), I can outline concrete steps or patches for that part.
