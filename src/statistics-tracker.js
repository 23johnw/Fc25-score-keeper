// ============================================================================
// StatisticsTracker - Core Statistics Framework
// ============================================================================

class StatisticsTracker {
    constructor(storageManager, settingsManager = null) {
        this.storage = storageManager;
        this.settingsManager = settingsManager;
        this.statsMode = 'raw'; // raw | perGame | projected
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

    getPlayers() {
        return this.storage.getData().players || [];
    }

    calculateStatistics(matches, type = 'season') {
        const players = this.getPlayers();
        if (players.length === 0) return {};

        const stats = {};
        const calculators = StatisticsCalculators.getAll();
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
                games[player] = (games[player] || 0) + 1;
            });
        });
        return games;
    }

    setStatsMode(mode) {
        if (['raw', 'perGame', 'projected'].includes(mode)) {
            this.statsMode = mode;
        }
        return this.statsMode;
    }

    getStatsMode() {
        return this.statsMode || 'raw';
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
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
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

