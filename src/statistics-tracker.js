// ============================================================================
// StatisticsTracker - Core Statistics Framework
// ============================================================================

import { StatisticsCalculators } from './stats-calculators.js';

function getTeamId(team) {
    const s = [...team].sort();
    return 'team_' + s.join('_');
}

let statsMode = 'raw'; // raw | perGame | projected

class StatisticsTracker {
    constructor(storage, settingsManager) {
        this.storage = storage;
        this.settingsManager = settingsManager;
    }

    getSeasonMatches(seasonNumber) {
        const data = this.storage.getData();
    const season = data.seasons[seasonNumber];
    return season ? season.matches || [] : [];
    }

    getAllMatches() {
        const data = this.storage.getData();
    const allMatches = [];
    Object.values(data.seasons).forEach(season => {
        if (season.matches) {
            allMatches.push(...season.matches);
        }
    });
        return allMatches;
    }

    getTeamStats(matches) {
        const teamStats = {};
        const pointsConfig = this.getPointsConfig();

    matches.forEach(match => {
        try {
            const teamAId = getTeamId(match.team1);
            const teamBId = getTeamId(match.team2);
            const teamA = Array.isArray(match.team1) ? match.team1 : [match.team1];
            const teamB = Array.isArray(match.team2) ? match.team2 : [match.team2];
            const matchPresence = match.playerPresence || {};
            const falseCount = Object.values(matchPresence).filter(v => v === false).length;
            const exactlyOneAbsent = falseCount === 1;

            // Initialize team stats if not exists
            if (!teamStats[teamAId]) {
                teamStats[teamAId] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, players: match.team1 };
            }
            if (!teamStats[teamBId]) {
                teamStats[teamBId] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, players: match.team2 };
            }

            // Update stats
            const teamAStats = teamStats[teamAId];
            const teamBStats = teamStats[teamBId];

            const teamAIsSolo = teamA.length === 1;
            const teamBIsSolo = teamB.length === 1;

            // For solo teams, only count Ghost Proxy matches (exactly 1 absent)
            // For partnerships, count all matches
            if (teamAIsSolo && !exactlyOneAbsent) {
                // Skip - true solo match, not Ghost Proxy
            } else {
                teamAStats.played++;
                teamAStats.gf += match.team1Score || 0;
                teamAStats.ga += match.team2Score || 0;
                if (match.result === 'team1') {
                    teamAStats.won++;
                    teamAStats.points += pointsConfig.win;
                } else if (match.result === 'team2') {
                    teamAStats.lost++;
                } else if (match.result === 'draw') {
                    teamAStats.drawn++;
                    teamAStats.points += pointsConfig.draw;
                }
                teamAStats.gd = teamAStats.gf - teamAStats.ga;
            }
            if (teamBIsSolo && !exactlyOneAbsent) {
                // Skip - true solo match, not Ghost Proxy
            } else {
                teamBStats.played++;
                teamBStats.gf += match.team2Score || 0;
                teamBStats.ga += match.team1Score || 0;
                if (match.result === 'team2') {
                    teamBStats.won++;
                    teamBStats.points += pointsConfig.win;
                } else if (match.result === 'team1') {
                    teamBStats.lost++;
                } else if (match.result === 'draw') {
                    teamBStats.drawn++;
                    teamBStats.points += pointsConfig.draw;
                }
                teamBStats.gd = teamBStats.gf - teamBStats.ga;
            }
        } catch (error) {
            console.error('Error processing match:', error, match);
        }
    });

        return teamStats;
    }

    aggregateSubsetTeams(teamStats) {

    const teamIds = Object.keys(teamStats);
    
    // Sort team IDs: first by player count (longest first), then by games played (most first)
    // This ensures partnerships with more games together get priority for merging solo teams
    const sortedTeamIds = [...teamIds].sort((a, b) => {
        const aPlayers = Array.isArray(teamStats[a]?.players) ? teamStats[a].players.length : 1;
        const bPlayers = Array.isArray(teamStats[b]?.players) ? teamStats[b].players.length : 1;
        
        // First sort by player count (longer teams first)
        if (aPlayers !== bPlayers) {
            return bPlayers - aPlayers;
        }
        
        // For teams with same player count, sort by games played (fewer games first)
        // This ensures smaller partnerships get priority for solo team merges
        // This way, team_Gezza_Mandem (25 games) processes before team_Flip_Mandem (30 games)
        const aPlayed = teamStats[a]?.played || 0;
        const bPlayed = teamStats[b]?.played || 0;
        return aPlayed - bPlayed; // Fewer games first
    });

    const mergedSubsetIds = new Set();

    // For each team, check if any other teams are subsets
    sortedTeamIds.forEach(teamId => {
        const teamData = teamStats[teamId];
        if (!teamData) return; // Team might have been deleted

        const teamPlayers = Array.isArray(teamData.players) ? teamData.players : [teamData.players];
        
        // Find teams that are subsets of this team (contain fewer players, all of which are in this team)
        // Skip teams that have already been merged into another partnership
        const subsetTeams = sortedTeamIds.filter(otherId => {
            if (otherId === teamId) return false;
            if (mergedSubsetIds.has(otherId)) return false; // Already merged into another team
            const otherTeamData = teamStats[otherId];
            if (!otherTeamData) return false;

            const otherPlayers = Array.isArray(otherTeamData.players) ? otherTeamData.players : [otherTeamData.players];
            
            // Check if otherPlayers is a subset of teamPlayers (all other players are in team players)
            // AND other team has fewer players (it's a true subset, not equal)
            const isSubset = otherPlayers.length < teamPlayers.length &&
                           otherPlayers.every(player => teamPlayers.includes(player));
            
            return isSubset;
        });

        // If there are subset teams, merge their stats into this team
        if (subsetTeams.length > 0) {
            subsetTeams.forEach(subsetId => {
                const subsetData = teamStats[subsetId];
                if (!subsetData) return;

                // Add stats from subset team to superset team
                
                teamData.played += subsetData.played;
                teamData.won += subsetData.won;
                teamData.drawn += subsetData.drawn;
                teamData.lost += subsetData.lost;
                teamData.gf += subsetData.gf;
                teamData.ga += subsetData.ga;
                teamData.points += subsetData.points;
                teamData.gd = teamData.gf - teamData.ga;

                // Mark this subset as merged (so it won't be merged into other teams)
                mergedSubsetIds.add(subsetId);
            });
        }
    });

    // Now delete all merged subset teams
    mergedSubsetIds.forEach(subsetId => {
        delete teamStats[subsetId];
    });
    }

    getPlayers() {
        const data = this.storage.getData();
    const players = Array.isArray(data.players) ? [...data.players] : [];
    const seen = new Set(players);
    const addPlayer = (p) => {
        if (!p) return;
        if (!seen.has(p)) {
            seen.add(p);
            players.push(p);
        }
    };

    // Include any players found in recorded matches (even if not in current players list)
    Object.values(data.seasons || {}).forEach(season => {
        (season.matches || []).forEach(match => {
            const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
            const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
            team1.forEach(addPlayer);
            team2.forEach(addPlayer);
        });
    });

        return players;
    }

    calculateStatistics(matches, type = 'season') {
        const players = this.getPlayers();
    if (players.length === 0) return {};

    const stats = {};
    const calculators = StatisticsCalculators.getAll();
    // Note: Calculators now check player presence internally (Ghost Proxy system)
    // Team stats use all matches, individual stats only count matches where player was present
        const gamesPlayedMap = this.getGamesPlayed(matches);
        const maxGamesPlayed = Math.max(...Object.values(gamesPlayedMap || { 0: 0 }), 0);
        const pointsConfig = this.getPointsConfig();

    calculators.forEach(calculator => {
        const calculated = calculator.calculate(matches, players, pointsConfig);
            stats[calculator.id] = this.applyModeToStats(calculated, calculator.id, gamesPlayedMap, maxGamesPlayed);
    });

        return stats;
    }

    getGamesPlayed(matches = []) {
    const games = {};
    matches.forEach(match => {
        const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
        const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
        [...team1, ...team2].forEach(player => {
            // Only count games where player was present (Ghost Proxy system)
            const wasPresent = !match.playerPresence || match.playerPresence[player] !== false;
            if (wasPresent) {
                games[player] = (games[player] || 0) + 1;
            }
        });
    });
        return games;
    }

    setStatsMode(mode) {
    if (['raw', 'perGame', 'projected'].includes(mode)) {
        statsMode = mode;
    }
        return statsMode;
    }

    getStatsMode() {
        return statsMode || 'raw';
    }

    applyModeToStats(calculated, calculatorId, gamesPlayedMap, maxGamesPlayed) {
        const mode = this.getStatsMode();
    if (mode === 'raw') return calculated;

    // If we don't have games played info, don't transform
    const hasGP = gamesPlayedMap && Object.keys(gamesPlayedMap).length > 0;
    if (!hasGP) return calculated;

    const transformValue = (player, value) => {
        const gp = gamesPlayedMap[player] || 0;
        if (gp === 0) return mode === 'projected' ? 0 : 0;
        if (mode === 'perGame') {
            if (typeof value === 'number') {
                const per = value / gp;
                return Math.round(per * 10) / 10;
            }
            return value;
        }
        if (mode === 'projected') {
            if (typeof value === 'number') {
                const perGame = value / gp;
                const projected = perGame * (maxGamesPlayed || gp);
                return Math.round(projected * 10) / 10;
            }
            return value;
        }
        return value;
    };

    // Handle common shapes: arrays of rows with player field, or objects keyed by player
    if (Array.isArray(calculated)) {
        return calculated.map(row => {
            if (row && row.player) {
                const newRow = { ...row };
                Object.keys(newRow).forEach(key => {
                    if (key === 'player') return;
                    newRow[key] = transformValue(newRow.player, newRow[key]);
                });
                return newRow;
            }
            return row;
        });
    }

    if (calculated && typeof calculated === 'object') {
        // Only transform objects that are keyed by known players; otherwise leave as-is (charts, aggregates)
        const keys = Object.keys(calculated);
        const keysArePlayers = keys.length > 0 && keys.every(k => gamesPlayedMap[k] !== undefined);
        if (!keysArePlayers) {
            return calculated;
        }

        const result = {};
        Object.entries(calculated).forEach(([player, value]) => {
            if (typeof value === 'number') {
                result[player] = transformValue(player, value);
            } else if (value && typeof value === 'object') {
                const inner = {};
                Object.entries(value).forEach(([k, v]) => {
                    inner[k] = transformValue(player, v);
                });
                result[player] = inner;
            } else {
                result[player] = value;
            }
        });
        return result;
    }

        return calculated;
    }

    getSeasonStats(seasonNumber) {
        const matches = this.getSeasonMatches(seasonNumber);
        return this.calculateStatistics(matches, 'season');
    }

    getOverallStats() {
        const matches = this.getAllMatches();
        return this.calculateStatistics(matches, 'overall');
    }

    getTodayMatches() {
        const allMatches = this.getAllMatches();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allMatches.filter(match => {
        if (!match.timestamp) return false;
        const matchDate = new Date(match.timestamp);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate.getTime() === today.getTime();
    });
    }

    getTodayStats() {
        const matches = this.getTodayMatches();
        return this.calculateStatistics(matches, 'today');
    }

    getMonthMatches(year, month) {
        const allMatches = this.getAllMatches();
    return allMatches.filter(match => {
        if (!match.timestamp) return false;
        const matchDate = new Date(match.timestamp);
        return matchDate.getFullYear() === year && matchDate.getMonth() === month;
    });
    }

    getCurrentMonthStats() {
        const now = new Date();
        const matches = this.getMonthMatches(now.getFullYear(), now.getMonth());
        return this.calculateStatistics(matches, 'month');
    }

    getWeekMatches(startDate) {
        const allMatches = this.getAllMatches();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    
    return allMatches.filter(match => {
        if (!match.timestamp) return false;
        const matchDate = new Date(match.timestamp);
        return matchDate >= startDate && matchDate < endDate;
    });
    }

    getCurrentWeekStats() {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const matches = this.getWeekMatches(startOfWeek);
        return this.calculateStatistics(matches, 'week');
    }

    getMatchesByDateRange(fromDateStr = null, toDateStr = null) {
        const allMatches = this.getAllMatches();
    if (!fromDateStr && !toDateStr) return allMatches;

    const normalizeDateKey = (dateStr) => {
        // Expect yyyy-mm-dd from date inputs / stored keys; fall back gracefully
        if (!dateStr || typeof dateStr !== 'string') return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [y, m, d] = parts;
        if (!y || !m || !d) return null;
        // Ensure zero-padded
        const mm = m.padStart(2, '0');
        const dd = d.padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    };

    const fromKey = normalizeDateKey(fromDateStr);
    const toKey = normalizeDateKey(toDateStr);

    return allMatches.filter(match => {
        if (!match.timestamp) return false;
        const matchKey = new Date(match.timestamp).toISOString().split('T')[0];
        if (fromKey && matchKey < fromKey) return false;
        if (toKey && matchKey > toKey) return false;
        return true;
    });
    }

    getCustomStats(fromDateStr = null, toDateStr = null) {
        const matches = this.getMatchesByDateRange(fromDateStr, toDateStr);
        return this.calculateStatistics(matches, 'custom');
    }

    getPointsConfig() {
        const defaults = { win: 1, draw: 1, loss: 0 };
        if (this.settingsManager && typeof this.settingsManager.getPointsPerResult === 'function') {
            return this.settingsManager.getPointsPerResult();
        }
        return defaults;
    }
}

export { StatisticsTracker };
