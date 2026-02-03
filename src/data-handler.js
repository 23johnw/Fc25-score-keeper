// src/data-handler.js
import { LocalStorageManager } from './persistence.js';
import { SeasonManager } from './season.js';
import { PlayerManager } from './players.js';
import { fetchTopTeams } from './api-service.js';
import { push as debugPush } from './debug-log.js';

const storage = new LocalStorageManager();
const seasonManager = new SeasonManager(storage);
const playerManager = new PlayerManager(storage);

export function addPlayer(playerData) {
    return storage.updateData(data => {
        if (!data.players.includes(playerData.name)) {
            data.players.push(playerData.name);
            data.overallStats.players[playerData.name] = { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 };
        }
    });
}

export function recordMatch(matchData) {
    // Determine result from scores (use penalties if available, otherwise extra time, otherwise full time)
    let finalTeam1Score = matchData.score1;
    let finalTeam2Score = matchData.score2;
    
    if (matchData.penaltiesScore1 !== null && matchData.penaltiesScore2 !== null) {
        // Use penalties score for result determination
        finalTeam1Score = matchData.penaltiesScore1;
        finalTeam2Score = matchData.penaltiesScore2;
    } else if (matchData.extraTimeScore1 !== null && matchData.extraTimeScore2 !== null) {
        // Use extra time score for result determination
        finalTeam1Score = matchData.extraTimeScore1;
        finalTeam2Score = matchData.extraTimeScore2;
    }
    
    let result;
    if (finalTeam1Score > finalTeam2Score) {
        result = 'team1';
    } else if (finalTeam2Score > finalTeam1Score) {
        result = 'team2';
    } else {
        result = 'draw';
    }

    const timestamp = matchData.timestamp || new Date().toISOString();
    
    // Capture player presence at match time (for Ghost Proxy system)
    const playerPresence = getPlayerPresenceSnapshot(matchData.team1, matchData.team2);
    
    const match = {
        team1: matchData.team1,
        team2: matchData.team2,
        team1Score: matchData.score1,
        team2Score: matchData.score2,
        result: result, // Automatically determined from scores
        timestamp,
        playerPresence: playerPresence // Track which players were present/absent
    };

    // Add team names and leagues if provided
    if (matchData.team1Name) match.team1Name = matchData.team1Name;
    if (matchData.team2Name) match.team2Name = matchData.team2Name;
    if (matchData.team1League != null) match.team1League = matchData.team1League;
    if (matchData.team2League != null) match.team2League = matchData.team2League;

    // Add extra time scores if provided
    if (matchData.extraTimeScore1 !== null && matchData.extraTimeScore2 !== null) {
        match.team1ExtraTimeScore = matchData.extraTimeScore1;
        match.team2ExtraTimeScore = matchData.extraTimeScore2;
    }

    // Add penalties scores if provided
    if (matchData.penaltiesScore1 !== null && matchData.penaltiesScore2 !== null) {
        match.team1PenaltiesScore = matchData.penaltiesScore1;
        match.team2PenaltiesScore = matchData.penaltiesScore2;
    }

    const currentSeason = seasonManager.getCurrentSeason();
    const saved = storage.updateData(data => {
        if (!data.seasons[currentSeason]) {
            data.seasons[currentSeason] = { matches: [], startDate: new Date().toISOString() };
        }
        data.seasons[currentSeason].matches.push(match);
        data.overallStats.totalMatches = (data.overallStats.totalMatches || 0) + 1;

        // Update player stats
        const updatePlayerStats = (player, wins, losses, draws, goalsFor, goalsAgainst) => {
            if (!data.overallStats.players[player]) {
                data.overallStats.players[player] = { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 };
            }
            data.overallStats.players[player].wins += wins;
            data.overallStats.players[player].losses += losses;
            data.overallStats.players[player].draws += draws;
            data.overallStats.players[player].goalsFor += goalsFor;
            data.overallStats.players[player].goalsAgainst += goalsAgainst;
        };

        const team1Players = Array.isArray(matchData.team1) ? matchData.team1 : [matchData.team1];
        const team2Players = Array.isArray(matchData.team2) ? matchData.team2 : [matchData.team2];

        if (match.result === 'team1') {
            team1Players.forEach(p => updatePlayerStats(p, 1, 0, 0, finalTeam1Score, finalTeam2Score));
            team2Players.forEach(p => updatePlayerStats(p, 0, 1, 0, finalTeam2Score, finalTeam1Score));
        } else if (match.result === 'team2') {
            team1Players.forEach(p => updatePlayerStats(p, 0, 1, 0, finalTeam1Score, finalTeam2Score));
            team2Players.forEach(p => updatePlayerStats(p, 1, 0, 0, finalTeam2Score, finalTeam1Score));
        } else {
            team1Players.forEach(p => updatePlayerStats(p, 0, 0, 1, finalTeam1Score, finalTeam2Score));
            team2Players.forEach(p => updatePlayerStats(p, 0, 0, 1, finalTeam2Score, finalTeam1Score));
        }

    });

    return saved ? match : null;
}

export function getCurrentSeasonMatches() {
    const currentSeason = seasonManager.getCurrentSeason();
    const data = storage.getData();
    const season = data.seasons[currentSeason];
    return season ? season.matches || [] : [];
}

export function findMatch(timestamp) {
    const data = storage.getData();
    for (const [seasonNum, season] of Object.entries(data.seasons)) {
        if (season.matches) {
            const index = season.matches.findIndex(m => m.timestamp === timestamp);
            if (index !== -1) {
                return { season: parseInt(seasonNum), index };
            }
        }
    }
    return null;
}

export function updateMatch(timestamp, newTeam1Score, newTeam2Score, newTeam1ExtraTimeScore = null, newTeam2ExtraTimeScore = null, newTeam1PenaltiesScore = null, newTeam2PenaltiesScore = null) {
    const matchInfo = findMatch(timestamp);
    if (!matchInfo) return false;

    let finalTeam1Score = newTeam1Score;
    let finalTeam2Score = newTeam2Score;
    
    if (newTeam1PenaltiesScore !== null && newTeam2PenaltiesScore !== null) {
        finalTeam1Score = newTeam1PenaltiesScore;
        finalTeam2Score = newTeam2PenaltiesScore;
    } else if (newTeam1ExtraTimeScore !== null && newTeam2ExtraTimeScore !== null) {
        finalTeam1Score = newTeam1ExtraTimeScore;
        finalTeam2Score = newTeam2ExtraTimeScore;
    }
    
    let newResult;
    if (finalTeam1Score > finalTeam2Score) {
        newResult = 'team1';
    } else if (finalTeam2Score > finalTeam1Score) {
        newResult = 'team2';
    } else {
        newResult = 'draw';
    }

    return storage.updateData(data => {
        const season = data.seasons[matchInfo.season];
        if (season && season.matches[matchInfo.index]) {
            const match = season.matches[matchInfo.index];
            match.team1Score = newTeam1Score;
            match.team2Score = newTeam2Score;
            match.result = newResult;
            
            if (newTeam1ExtraTimeScore !== null && newTeam2ExtraTimeScore !== null) {
                match.team1ExtraTimeScore = newTeam1ExtraTimeScore;
                match.team2ExtraTimeScore = newTeam2ExtraTimeScore;
            } else {
                delete match.team1ExtraTimeScore;
                delete match.team2ExtraTimeScore;
            }
            
            if (newTeam1PenaltiesScore !== null && newTeam2PenaltiesScore !== null) {
                match.team1PenaltiesScore = newTeam1PenaltiesScore;
                match.team2PenaltiesScore = newTeam2PenaltiesScore;
            } else {
                delete match.team1PenaltiesScore;
                delete match.team2PenaltiesScore;
            }
        }
    });
}

export function deleteMatch(timestamp) {
    const matchInfo = findMatch(timestamp);
    if (!matchInfo) return false;

    return storage.updateData(data => {
        const season = data.seasons[matchInfo.season];
        if (season && season.matches) {
            season.matches.splice(matchInfo.index, 1);
            if (data.overallStats.totalMatches > 0) {
                data.overallStats.totalMatches--;
            }
        }
    });
}

export function getPlayerPresenceSnapshot(team1, team2) {
    const allPlayers = [...new Set([...team1, ...team2])];
    const snapshot = {};
    
    allPlayers.forEach(player => {
        snapshot[player] = playerManager.isPlayerPresent(player);
    });
    
    return snapshot;
}

export function deleteLastMatch() {
    const currentSeason = seasonManager.getCurrentSeason();
    const data = storage.getData();
    const season = data.seasons[currentSeason];
    if (!season || !season.matches || season.matches.length === 0) {
        return null;
    }

    const removedMatch = season.matches[season.matches.length - 1];

    storage.updateData(d => {
        const s = d.seasons[currentSeason];
        if (s && s.matches && s.matches.length > 0) {
            s.matches.pop();
            if (d.overallStats.totalMatches > 0) {
                d.overallStats.totalMatches--;
            }
        }
    });

    return removedMatch;
}

export function getTeamId(team) {
    // Create deterministic team ID from player names
    const sortedPlayers = [...team].sort();
    return `team_${sortedPlayers.join('_')}`;
}

/**
 * Sync teams from football-data.org API. Fetches top 5 from selected leagues
 * and overwrites uploadedTeamEntries in persistence (used when randomising team names).
 * Uses opts.storage when provided so the same instance as the app is updated (fixes View list).
 * @param {Object} opts - Options with toastManager, optional storage, optional selectedLeagues (league codes)
 * @returns {Promise<{ success: boolean, count?: number, entries?: Array, error?: string }>}
 */
export async function syncTeamsFromOnline(opts = {}) {
    const toast = opts.toastManager;
    const store = opts.storage ?? storage;
    const selectedLeagues = opts.selectedLeagues ?? (store.getData().selectedLeagues);
    const teamsPerLeague = opts.teamsPerLeague ?? (store.getData().teamsPerLeague ?? 5);
    const show = (msg, type = 'info', title = null) => {
        if (toast && typeof toast[type] === 'function') {
            toast[type](msg, title);
        }
    };

    if (toast) show('Syncing...', 'info');
    let rateLimitToast = null;
    try {
        const { entries, skipped } = await fetchTopTeams(selectedLeagues, {
            teamsPerLeague,
            onRateLimitWait(secondsRemaining, leagueName) {
                if (!rateLimitToast && toast && typeof toast.showPersistent === 'function') {
                    rateLimitToast = toast.showPersistent(
                        `Retrying ${leagueName} in ${secondsRemaining}s…`,
                        'Rate limited'
                    );
                }
                if (rateLimitToast) {
                    rateLimitToast.update(secondsRemaining > 0
                        ? `Retrying ${leagueName} in ${secondsRemaining}s…`
                        : `Retrying ${leagueName} now…`);
                }
            }
        });
        if (rateLimitToast) {
            rateLimitToast.close();
            rateLimitToast = null;
        }
        if (!entries || entries.length === 0) {
            show('No teams retrieved from API', 'warning');
            return { success: false, error: 'No teams retrieved' };
        }
        store.updateData(data => {
            data.uploadedTeamEntries = entries;
            data.uploadedTeamNames = []; // clear legacy file list so randomise only uses synced list
        });
        if (toast) {
            const msg = skipped.length > 0
                ? `Synced ${entries.length} teams. ${skipped.map(s => s.name).join(', ')} skipped (rate limit or not in API plan).`
                : `Synced ${entries.length} teams from selected leagues!`;
            show(msg, skipped.length > 0 ? 'warning' : 'success', 'Success!');
        }
        return { success: true, count: entries.length, entries, skipped };
    } catch (err) {
        let msg = err?.message || 'Sync failed';
        if (msg.includes('No API key')) {
            msg = 'No API Key found. Add your key in Settings > Data > External Services.';
        } else if (msg.includes('CORS_PROXY_NEEDED') || msg.includes('401') || msg.includes('Unauthorized')) {
            msg = 'Sync on this device needs a CORS proxy key. In Settings > Data > External Services add a free key from cors.sh, save, then try Sync again.';
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('blocked')) {
            msg = 'Sync on this device needs a CORS proxy key. In Settings > Data > External Services add a free key from cors.sh, save, then try Sync again.';
        }
        debugPush('Sync: error shown to user', { rawError: err?.message, userMessage: msg });
        if (toast) show(msg, 'error', 'Error');
        return { success: false, error: msg };
    } finally {
        if (rateLimitToast) {
            rateLimitToast.close();
            rateLimitToast = null;
        }
    }
}
