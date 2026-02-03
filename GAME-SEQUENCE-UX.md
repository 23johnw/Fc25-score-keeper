# Game Sequence Tab – Eye-Friendly Improvements

This document describes the UX improvements made to the Game Sequence screen. It is separate from [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Problem

The Game Sequence screen repeated the same text on both sides of "VS" when league or team was shared (e.g. "Same team per round" or same league):

- **League row**: "Campeonato Brasileiro Série A" | spacer | "Campeonato Brasileiro Série A"
- **Team row**: "Botafogo FR" | spacer | "Botafogo FR"
- **Players row**: "Flip & Gezza" VS "Angry & Mandem"

This was noisy and harder to scan. The layout also reused the same formatter as the Match Recording screen, which is tuned for two different teams.

## Approach Implemented

1. **Deduplicate shared context on the Sequence screen only**  
   When `league1 === league2`, the league is shown once (one line above the matchup). When `name1 === name2`, the team/venue name is shown once. Match Recording and Edit Match screens keep the existing two-column behaviour when teams differ.

2. **Sequence-specific formatter**  
   In `src/app-controller.js`, a new helper `formatSequenceMatchDisplay()` builds HTML for each sequence item: a single league line when leagues are equal, a single team line when team names are equal, and the same players-vs-players row. `loadSequenceList()` and the Record Match screen (`showCurrentMatch()`) use this formatter so both Game Sequence and Record Match get deduplication and "Country – League" display.

3. **Show country with league**  
   In `src/api-service.js`, each item in `SUPPORTED_LEAGUES` has a `country` field (e.g. England, Spain, Brazil). A league-name → country lookup and `getLeagueDisplay(leagueName)` return `"Country – League"` (e.g. "Brazil – Campeonato Brasileiro Série A") when country is known, else the league name. The sequence formatter uses this when rendering the league line so users can find the league in the game. Stored data remains `{ league, name }`; country is display-time only.

4. **Layout and hierarchy**  
   - **Round**: "Round N" remains the main label.
   - **League**: Single line when same league (with "Country – League"); two columns when different.
   - **Team/venue**: Single line when same team; two columns when different.
   - **Matchup**: One clear row: "[Player1 & Player2] VS [Player3 & Player4]" with existing player colors.
   - In `styles.css`, `.sequence-item` and `.match-teams` (Record Match screen) have styles for single-line league/team (`.sequence-single`), consistent spacing, and slightly increased margin between items. Dark mode overrides for `.sequence-item` are unchanged.

## Files Touched

| File | Change |
|------|--------|
| `src/api-service.js` | Added `country` to each `SUPPORTED_LEAGUES` entry. Exported `getLeagueDisplay(leagueName)` and internal `LEAGUE_COUNTRY_BY_NAME`-style lookup. |
| `src/app-controller.js` | Added `formatSequenceMatchDisplay()`. `loadSequenceList()` and `showCurrentMatch()` (Record Match) use it; imports `getLeagueDisplay` for "Country – League" on the league line. |
| `styles.css` | Added `.sequence-item` and `.match-teams` single-line league/team styles (`.sequence-single`); increased `.sequence-item` margin-bottom. |

## Out of Scope

- Changing the Match Recording or Edit Match screens’ two-column layout when teams differ; Record Match now uses the new formatter.
- Adding new features (e.g. reorder rounds); scope was limited to making the sequence and Record Match screens more eye-friendly.
