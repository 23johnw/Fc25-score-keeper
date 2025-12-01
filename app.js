// ============================================================================
// App Version - Fallback constant if cache version cannot be detected
// The displayed version is automatically extracted from service worker cache name
// Update the cache version in service-worker.js (e.g., v19) to update the version
// ============================================================================
const APP_VERSION = '1.19.0';

// ============================================================================
// LocalStorageManager - Data Persistence
// ============================================================================

class LocalStorageManager {
    constructor() {
        this.storageKey = 'fc25_score_tracker';
        this.data = this.loadData();
    }

    loadData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return this.applyDefaults(parsed);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        return this.getDefaultData();
    }

    getDefaultData() {
        return {
            players: [],
            playerNameHistory: [], // Add this line to store previously used names
            currentSeason: 1,
            seasons: {},
            overallStats: {
                players: {},
                totalMatches: 0
            },
            playerLock: {
                player: null,
                side: 'neutral'
            }
        };
    }

    applyDefaults(data) {
        const defaults = this.getDefaultData();
        const merged = {
            ...defaults,
            ...data,
            seasons: data.seasons || defaults.seasons,
            overallStats: {
                ...defaults.overallStats,
                ...(data.overallStats || {})
            },
            playerLock: data.playerLock || defaults.playerLock
        };

        if (!merged.playerLock || typeof merged.playerLock !== 'object') {
            merged.playerLock = { ...defaults.playerLock };
        } else {
            const validSides = ['home', 'away', 'neutral'];
            merged.playerLock = {
                player: merged.playerLock.player || null,
                side: validSides.includes(merged.playerLock.side) ? merged.playerLock.side : 'neutral'
            };
        }

        return merged;
    }

    saveData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    getData() {
        return this.data;
    }

    updateData(updater) {
        updater(this.data);
        this.data = this.applyDefaults(this.data);
        return this.saveData();
    }

    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
            this.data = this.getDefaultData();
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    clearAllStatistics() {
        return this.updateData(data => {
            // Reset to default structure but keep players
            const players = data.players || [];
            data.currentSeason = 1;
            data.seasons = {};
            data.overallStats = {
                players: {},
                totalMatches: 0
            };
            // Keep players intact
            data.players = players;
        });
    }
}

// ============================================================================
// SettingsManager - Settings Management
// ============================================================================

class SettingsManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.settingsKey = 'fc25_settings';
        this.settings = this.loadSettings();
    }

    getDefaultSettings() {
        return {
            labels: {
                home: 'Home',
                away: 'Away',
                neutral: 'Neutral'
            },
            playerColors: {},
            darkMode: false
        };
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem(this.settingsKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.getDefaultSettings(), ...parsed };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return this.getDefaultSettings();
    }

    saveSettings() {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    getSettings() {
        return this.settings;
    }

    updateSettings(updater) {
        updater(this.settings);
        return this.saveSettings();
    }

    getLabel(type) {
        return this.settings.labels[type] || this.getDefaultSettings().labels[type];
    }

    setLabel(type, value) {
        if (['home', 'away', 'neutral'].includes(type)) {
            this.settings.labels[type] = value || this.getDefaultSettings().labels[type];
            return this.saveSettings();
        }
        return false;
    }

    getPlayerColor(playerName) {
        return this.settings.playerColors[playerName] || null;
    }

    setPlayerColor(playerName, color) {
        if (playerName && color) {
            this.settings.playerColors[playerName] = color;
            return this.saveSettings();
        }
        return false;
    }

    removePlayerColor(playerName) {
        if (this.settings.playerColors[playerName]) {
            delete this.settings.playerColors[playerName];
            return this.saveSettings();
        }
        return false;
    }

    isDarkMode() {
        return this.settings.darkMode || false;
    }

    setDarkMode(enabled) {
        this.settings.darkMode = enabled;
        this.saveSettings();
        return enabled;
    }

    resetLabels() {
        this.settings.labels = { ...this.getDefaultSettings().labels };
        return this.saveSettings();
    }

    resetAll() {
        this.settings = this.getDefaultSettings();
        return this.saveSettings();
    }
}

// ============================================================================
// PlayerManager - Player CRUD Operations
// ============================================================================

class PlayerManager {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    getPlayers() {
        return this.storage.getData().players || [];
    }

    setPlayers(players) {
        const validPlayers = players.filter(p => p && p.trim().length > 0);
        if (validPlayers.length < 1 || validPlayers.length > 4) {
            return false;
        }
        return this.storage.updateData(data => {
            data.players = validPlayers;
            this.ensureLockIntegrity(data);
        });
    }

    addPlayer(name) {
        const players = this.getPlayers();
        if (players.length >= 4) return false;
        if (players.includes(name.trim())) return false;
        
        return this.storage.updateData(data => {
            data.players.push(name.trim());
            this.ensureLockIntegrity(data);
        });
    }

    removePlayer(name) {
        return this.storage.updateData(data => {
            data.players = data.players.filter(p => p !== name);
            this.ensureLockIntegrity(data);
        });
    }

    hasPlayers() {
        return this.getPlayers().length >= 2;
    }

    getPlayerNameHistory() {
        return this.storage.getData().playerNameHistory || [];
    }

    addToHistory(playerName) {
        const trimmedName = playerName.trim();
        if (!trimmedName) return false;
        
        return this.storage.updateData(data => {
            if (!data.playerNameHistory) {
                data.playerNameHistory = [];
            }
            // Add name if not already in history
            if (!data.playerNameHistory.includes(trimmedName)) {
                data.playerNameHistory.push(trimmedName);
                // Sort alphabetically
                data.playerNameHistory.sort();
            }
        });
    }

    ensureLockIntegrity(data) {
        if (!data.playerLock || typeof data.playerLock !== 'object') {
            data.playerLock = {
                player: null,
                side: 'neutral'
            };
            return;
        }

        const validSides = ['home', 'away', 'neutral'];
        if (!validSides.includes(data.playerLock.side)) {
            data.playerLock.side = 'neutral';
        }

        const players = data.players || [];
        if (!players.includes(data.playerLock.player)) {
            data.playerLock.player = null;
            data.playerLock.side = 'neutral';
        }

        if (data.playerLock.side === 'neutral') {
            data.playerLock.player = null;
        }
    }

    getPlayerLock() {
        const data = this.storage.getData();
        if (!data.playerLock) {
            return { player: null, side: 'neutral' };
        }
        return {
            player: data.playerLock.player || null,
            side: data.playerLock.side || 'neutral'
        };
    }

    setPlayerLock(player, side) {
        const normalizedSide = ['home', 'away', 'neutral'].includes(side) ? side : 'neutral';
        if (normalizedSide === 'neutral') {
            return this.clearPlayerLock();
        }

        const players = this.getPlayers();
        if (!players.includes(player)) {
            return false;
        }

        return this.storage.updateData(data => {
            data.playerLock = {
                player,
                side: normalizedSide
            };
        });
    }

    clearPlayerLock() {
        return this.storage.updateData(data => {
            data.playerLock = {
                player: null,
                side: 'neutral'
            };
        });
    }
}

// ============================================================================
// TeamGenerator - Generate Round Structures
// ============================================================================

class TeamGenerator {
    // Generate all possible round structures where each structure is a complete set of matches
    generateRoundStructures(players, lock = { player: null, side: 'neutral' }) {
        const count = players.length;
        const structures = [];

        if (count < 2) {
            return structures;
        }

        if (count === 2) {
            // Single structure with one 1v1 match
            structures.push({
                matches: [
                    {
                        team1: [players[0]],
                        team2: [players[1]]
                    }
                ]
            });
        } else if (count === 3) {
            // Generate all permutations of the 3-match structure
            // Base structure: [1&2 vs 3, 1&3 vs 2, 2&3 vs 1]
            const baseStructure = [
                { team1: [players[0], players[1]], team2: [players[2]] },
                { team1: [players[0], players[2]], team2: [players[1]] },
                { team1: [players[1], players[2]], team2: [players[0]] }
            ];
            
            // Generate all permutations of the base structure
            const permutations = this.getPermutations(baseStructure);
            permutations.forEach(perm => {
                structures.push({ matches: perm });
            });
        } else if (count === 4) {
            // Generate all permutations where player 0 pairs with 1, 2, 3 in different orders
            // Base structure: [1&2 vs 3&4, 1&3 vs 2&4, 1&4 vs 2&3]
            const baseStructure = [
                { team1: [players[0], players[1]], team2: [players[2], players[3]] },
                { team1: [players[0], players[2]], team2: [players[1], players[3]] },
                { team1: [players[0], players[3]], team2: [players[1], players[2]] }
            ];
            
            // Generate all permutations of the base structure
            const permutations = this.getPermutations(baseStructure);
            permutations.forEach(perm => {
                structures.push({ matches: perm });
            });
        }

        return this.applyPlayerLock(structures, players, lock);
    }

    // Helper function to generate all permutations of an array
    getPermutations(arr) {
        if (arr.length <= 1) return [arr];
        
        const permutations = [];
        
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
            const remainingPerms = this.getPermutations(remaining);
            
            for (const perm of remainingPerms) {
                permutations.push([current, ...perm]);
            }
        }
        
        return permutations;
    }

    applyPlayerLock(structures, players, lock) {
        const lockActive = lock && lock.player && lock.side && lock.side !== 'neutral' && players.includes(lock.player);

        return structures.map(structure => {
            const matches = structure.matches.map(match => {
                const originalTeam1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const originalTeam2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
                let team1 = [...originalTeam1];
                let team2 = [...originalTeam2];

                if (lockActive) {
                    const playerInTeam1 = team1.includes(lock.player);
                    const playerInTeam2 = team2.includes(lock.player);

                    if (lock.side === 'home' && playerInTeam2) {
                        [team1, team2] = [team2, team1];
                    } else if (lock.side === 'away' && playerInTeam1) {
                        [team1, team2] = [team2, team1];
                    }
                }

                return {
                    team1: [...team1],
                    team2: [...team2]
                };
            });

            return { matches };
        });
    }

    formatTeamName(team) {
        return team.join(' & ');
    }

    // Legacy method for backward compatibility (returns matches from first structure)
    generateCombinations(players) {
        const structures = this.generateRoundStructures(players);
        if (structures.length === 0) return [];
        return structures[0].matches;
    }
}

// ============================================================================
// Statistics Calculators - Modular System
// ============================================================================

class StatisticsCalculators {
    static registry = [];

    static register(calculator) {
        if (calculator.id && calculator.name && calculator.calculate && calculator.display) {
            // Default category to 'general' if not specified
            if (!calculator.category) {
                calculator.category = 'general';
            }
            this.registry.push(calculator);
        }
    }
    
    static getByCategory(category) {
        return this.registry.filter(calc => calc.category === category);
    }
    
    static getBySubcategory(category, subcategory) {
        return this.registry.filter(calc => 
            calc.category === category && calc.subcategory === subcategory
        );
    }
    
    static getSubcategories(category) {
        const subcategories = new Set(
            this.registry
                .filter(calc => calc.category === category && calc.subcategory)
                .map(calc => calc.subcategory)
        );
        return Array.from(subcategories);
    }
    
    static getCategories() {
        const categories = new Set(this.registry.map(calc => calc.category));
        return Array.from(categories);
    }

    static getAll() {
        return this.registry;
    }

    static getById(id) {
        return this.registry.find(c => c.id === id);
    }
}

// Default Statistics Calculators

// Win/Loss/Draw Calculator
StatisticsCalculators.register({
    id: 'winLossDraw',
    name: 'Wins, Losses & Draws',
    category: 'performance',
    subcategory: 'wins-losses',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { wins: 0, losses: 0, draws: 0, games: 0 };
        });

        matches.forEach(match => {
            const { team1, team2, result } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            if (result === 'team1') {
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].wins++;
                        stats[p].games++;
                    }
                });
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                    }
                });
            } else if (result === 'team2') {
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].wins++;
                        stats[p].games++;
                    }
                });
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                    }
                });
            } else if (result === 'draw') {
                [...team1Players, ...team2Players].forEach(p => {
                    if (stats[p]) {
                        stats[p].draws++;
                        stats[p].games++;
                    }
                });
            }
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by games played (descending), then wins
        const sorted = Object.entries(data)
            .sort((a, b) => {
                if (b[1].games !== a[1].games) {
                    return b[1].games - a[1].games;
                }
                return b[1].wins - a[1].wins;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>GP</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats]) => `
                        <tr>
                            <td class="player-name">${player}</td>
                            <td>${stats.games}</td>
                            <td>${stats.wins}</td>
                            <td>${stats.draws}</td>
                            <td>${stats.losses}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Win Rate Calculator
StatisticsCalculators.register({
    id: 'winRate',
    name: 'Win Rate',
    category: 'performance',
    subcategory: 'win-rate',
    calculate: (matches, players) => {
        const wld = StatisticsCalculators.getById('winLossDraw').calculate(matches, players);
        const winRates = {};
        
        Object.entries(wld).forEach(([player, stats]) => {
            winRates[player] = {
                winRate: stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : 0,
                games: stats.games
            };
        });
        
        return winRates;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by win rate (descending), then games
        const sorted = Object.entries(data)
            .sort((a, b) => {
                const rateA = parseFloat(a[1].winRate);
                const rateB = parseFloat(b[1].winRate);
                if (rateB !== rateA) {
                    return rateB - rateA;
                }
                return b[1].games - a[1].games;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Win %</th>
                        <th>GP</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats]) => `
                        <tr>
                            <td class="player-name">${player}</td>
                            <td class="points">${stats.winRate}%</td>
                            <td>${stats.games}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Streak Calculator
StatisticsCalculators.register({
    id: 'streak',
    name: 'Current Streak',
    category: 'performance',
    subcategory: 'streak',
    calculate: (matches, players) => {
        const streaks = {};
        players.forEach(player => {
            streaks[player] = { currentStreak: 0, streakType: 'none' };
        });

        // Sort matches by timestamp (most recent first)
        const sortedMatches = [...matches].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        // Calculate streak for each player
        players.forEach(player => {
            let streak = 0;
            let streakType = 'none';
            
            for (const match of sortedMatches) {
                const { team1, team2, result } = match;
                const team1Players = Array.isArray(team1) ? team1 : [team1];
                const team2Players = Array.isArray(team2) ? team2 : [team2];
                
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                
                if (!inTeam1 && !inTeam2) continue;
                
                let won = false;
                if (result === 'team1' && inTeam1) won = true;
                if (result === 'team2' && inTeam2) won = true;
                
                if (streak === 0) {
                    streak = 1;
                    streakType = won ? 'win' : 'loss';
                } else if (
                    (streakType === 'win' && won) ||
                    (streakType === 'loss' && !won && result !== 'draw')
                ) {
                    streak++;
                } else {
                    break;
                }
                
                if (result === 'draw') break; // Draws break streaks
            }
            
            streaks[player] = {
                currentStreak: streak,
                streakType: streakType
            };
        });

        return streaks;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const html = Object.entries(data)
            .sort((a, b) => b[1].currentStreak - a[1].currentStreak)
            .map(([player, stats]) => {
                const streakText = stats.streakType === 'win' 
                    ? `${stats.currentStreak} win${stats.currentStreak !== 1 ? 's' : ''}`
                    : stats.streakType === 'loss'
                    ? `${stats.currentStreak} loss${stats.currentStreak !== 1 ? 'es' : ''}`
                    : 'No streak';
                
                return `
                    <h4>${player}</h4>
                    <div class="stat-item">
                        <span class="label">Current Streak:</span>
                        <span class="value">${streakText}</span>
                    </div>
                `;
            }).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// Total Goals Scored Calculator (includes extra time goals)
StatisticsCalculators.register({
    id: 'totalGoals',
    name: 'Total Goals Scored',
    category: 'goals',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { 
                goals: 0,
                fullTimeGoals: 0,
                extraTimeGoals: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score, team1ExtraTimeScore, team2ExtraTimeScore } = match;
            
            // Handle matches that might not have scores yet (backward compatibility)
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return; // Skip matches without scores
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            // Determine if match went to extra time
            const hasExtraTime = team1ExtraTimeScore !== undefined && team2ExtraTimeScore !== undefined;
            
            // Calculate goals (use extra time score if available, otherwise full time)
            let team1Goals = team1Score;
            let team2Goals = team2Score;
            let team1ExtraGoals = 0;
            let team2ExtraGoals = 0;
            
            if (hasExtraTime) {
                // Extra time scores are cumulative, so calculate extra time goals only
                team1ExtraGoals = team1ExtraTimeScore - team1Score;
                team2ExtraGoals = team2ExtraTimeScore - team2Score;
                team1Goals = team1ExtraTimeScore; // Total goals includes extra time
                team2Goals = team2ExtraTimeScore;
            }

            // Team 1 players
            team1Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goals += team1Goals;
                    stats[p].fullTimeGoals += team1Score;
                    if (hasExtraTime) {
                        stats[p].extraTimeGoals += team1ExtraGoals;
                    }
                }
            });

            // Team 2 players
            team2Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goals += team2Goals;
                    stats[p].fullTimeGoals += team2Score;
                    if (hasExtraTime) {
                        stats[p].extraTimeGoals += team2ExtraGoals;
                    }
                }
            });
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by goals (descending)
        const sorted = Object.entries(data)
            .sort((a, b) => b[1].goals - a[1].goals);
        
        // Check if any player has extra time goals
        const hasExtraTimeGoals = sorted.some(([_, stats]) => stats.extraTimeGoals > 0);
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Total</th>
                        ${hasExtraTimeGoals ? '<th>FT</th><th>ET</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        const color = window.appController && window.appController.settingsManager
                            ? window.appController.settingsManager.getPlayerColor(player)
                            : null;
                        const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';
                        
                        return `
                            <tr ${position === 1 ? 'class="leader"' : ''}>
                                <td class="position">${position}</td>
                                <td class="player-name" ${playerStyle}>${positionSymbol} ${escapeHtml(player)}</td>
                                <td class="points"><strong>${stats.goals}</strong></td>
                                ${hasExtraTimeGoals ? `
                                    <td>${stats.fullTimeGoals}</td>
                                    <td>${stats.extraTimeGoals > 0 ? `<span style="color: var(--primary-color); font-weight: 600;">${stats.extraTimeGoals}</span>` : '0'}</td>
                                ` : ''}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Goal Difference Calculator
StatisticsCalculators.register({
    id: 'goalDifference',
    name: 'Goal Difference',
    category: 'goals',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score } = match;
            
            // Skip matches without scores
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return;
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            // Team 1 players
            team1Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goalsFor += team1Score;
                    stats[p].goalsAgainst += team2Score;
                }
            });

            // Team 2 players
            team2Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goalsFor += team2Score;
                    stats[p].goalsAgainst += team1Score;
                }
            });
        });

        // Calculate goal difference for each player
        Object.keys(stats).forEach(player => {
            stats[player].goalDifference = stats[player].goalsFor - stats[player].goalsAgainst;
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by goal difference (descending), then goals for
        const sorted = Object.entries(data)
            .sort((a, b) => {
                if (b[1].goalDifference !== a[1].goalDifference) {
                    return b[1].goalDifference - a[1].goalDifference;
                }
                return b[1].goalsFor - a[1].goalsFor;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        const goalDiffClass = stats.goalDifference > 0 ? 'positive' : stats.goalDifference < 0 ? 'negative' : '';
                        const goalDiffSign = stats.goalDifference > 0 ? '+' : '';
                        const positionClass = position === 1 ? 'leader' : '';
                        return `
                            <tr class="${positionClass}">
                                <td class="position">${position}</td>
                                <td class="player-name">${positionSymbol} ${player}</td>
                                <td>${stats.goalsFor}</td>
                                <td>${stats.goalsAgainst}</td>
                                <td class="goal-diff ${goalDiffClass}">${goalDiffSign}${stats.goalDifference}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// League Points Calculator
StatisticsCalculators.register({
    id: 'leaguePoints',
    name: 'League Table',
    category: 'league',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { 
                points: 0, 
                wins: 0, 
                draws: 0, 
                losses: 0,
                games: 0,
                goalsFor: 0,
                goalsAgainst: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, result, team1Score, team2Score } = match;
            
            // Skip matches without scores
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return;
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            if (result === 'team1') {
                // Team 1 wins - each player gets 1 point
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].points += 1;
                        stats[p].wins++;
                        stats[p].games++;
                        stats[p].goalsFor += team1Score;
                        stats[p].goalsAgainst += team2Score;
                    }
                });
                // Team 2 loses - 0 points
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                        stats[p].goalsFor += team2Score;
                        stats[p].goalsAgainst += team1Score;
                    }
                });
            } else if (result === 'team2') {
                // Team 2 wins - each player gets 1 point
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].points += 1;
                        stats[p].wins++;
                        stats[p].games++;
                        stats[p].goalsFor += team2Score;
                        stats[p].goalsAgainst += team1Score;
                    }
                });
                // Team 1 loses - 0 points
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                        stats[p].goalsFor += team1Score;
                        stats[p].goalsAgainst += team2Score;
                    }
                });
            } else if (result === 'draw') {
                // Draw - all players get 1 point
                [...team1Players, ...team2Players].forEach(p => {
                    if (stats[p]) {
                        stats[p].points += 1;
                        stats[p].draws++;
                        stats[p].games++;
                        // Goals for/against depend on which team they're on
                        if (team1Players.includes(p)) {
                            stats[p].goalsFor += team1Score;
                            stats[p].goalsAgainst += team2Score;
                        } else {
                            stats[p].goalsFor += team2Score;
                            stats[p].goalsAgainst += team1Score;
                        }
                    }
                });
            }
        });

        // Calculate goal difference for each player
        Object.keys(stats).forEach(player => {
            stats[player].goalDifference = stats[player].goalsFor - stats[player].goalsAgainst;
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by points (descending), then by goal difference (descending), then by goals for (descending)
        const sorted = Object.entries(data)
            .sort((a, b) => {
                if (b[1].points !== a[1].points) {
                    return b[1].points - a[1].points;
                }
                if (b[1].goalDifference !== a[1].goalDifference) {
                    return b[1].goalDifference - a[1].goalDifference;
                }
                return b[1].goalsFor - a[1].goalsFor;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Pts</th>
                        <th>GP</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        const goalDiffClass = stats.goalDifference > 0 ? 'positive' : stats.goalDifference < 0 ? 'negative' : '';
                        const goalDiffSign = stats.goalDifference > 0 ? '+' : '';
                        const positionClass = position === 1 ? 'leader' : '';
                        
                        return `
                            <tr class="${positionClass}">
                                <td class="position">${position}</td>
                                <td class="player-name">${positionSymbol} ${player}</td>
                                <td class="points">${stats.points}</td>
                                <td>${stats.games}</td>
                                <td>${stats.wins}</td>
                                <td>${stats.draws}</td>
                                <td>${stats.losses}</td>
                                <td>${stats.goalsFor}</td>
                                <td>${stats.goalsAgainst}</td>
                                <td class="goal-diff ${goalDiffClass}">${goalDiffSign}${stats.goalDifference}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Records Calculator (Best and Worst performances)
StatisticsCalculators.register({
    id: 'worstLosses',
    name: 'Records',
    category: 'records',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = {
                worstByGoalsAgainst: null,  // Match with most goals conceded in a loss
                worstByDifference: null,   // Match with biggest goal deficit in a loss
                bestByGoalsFor: null,      // Match with most goals scored in a win
                bestBySurplus: null        // Match with biggest goal surplus in a win
            };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score, result, timestamp } = match;
            
            // Skip matches without scores
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return;
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            // Helper function to format teammates
            const getTeammates = (player, teamPlayers) => {
                return teamPlayers.filter(p => p !== player);
            };
            
            // Helper function to get opponents
            const getOpponents = (player, team1Players, team2Players) => {
                if (team1Players.includes(player)) {
                    return team2Players;
                } else {
                    return team1Players;
                }
            };
            
            // Process team 1 players
            team1Players.forEach(player => {
                if (!stats[player]) return;
                
                const teammates = getTeammates(player, team1Players);
                const opponents = team2Players;
                const goalsFor = team1Score;
                const goalsAgainst = team2Score;
                const goalDifference = team1Score - team2Score;
                
                if (result === 'team2') { // Team 1 lost
                    // Check worst by goals against
                    if (!stats[player].worstByGoalsAgainst || 
                        goalsAgainst > stats[player].worstByGoalsAgainst.goalsAgainst) {
                        stats[player].worstByGoalsAgainst = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check worst by goal difference
                    if (!stats[player].worstByDifference || 
                        goalDifference < stats[player].worstByDifference.goalDifference) {
                        stats[player].worstByDifference = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                } else if (result === 'team1') { // Team 1 won
                    // Check best by goals for
                    if (!stats[player].bestByGoalsFor || 
                        goalsFor > stats[player].bestByGoalsFor.goalsFor) {
                        stats[player].bestByGoalsFor = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check best by goal surplus
                    if (!stats[player].bestBySurplus || 
                        goalDifference > stats[player].bestBySurplus.goalDifference) {
                        stats[player].bestBySurplus = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                }
            });
            
            // Process team 2 players
            team2Players.forEach(player => {
                if (!stats[player]) return;
                
                const teammates = getTeammates(player, team2Players);
                const opponents = team1Players;
                const goalsFor = team2Score;
                const goalsAgainst = team1Score;
                const goalDifference = team2Score - team1Score;
                
                if (result === 'team1') { // Team 2 lost
                    // Check worst by goals against
                    if (!stats[player].worstByGoalsAgainst || 
                        goalsAgainst > stats[player].worstByGoalsAgainst.goalsAgainst) {
                        stats[player].worstByGoalsAgainst = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check worst by goal difference
                    if (!stats[player].worstByDifference || 
                        goalDifference < stats[player].worstByDifference.goalDifference) {
                        stats[player].worstByDifference = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                } else if (result === 'team2') { // Team 2 won
                    // Check best by goals for
                    if (!stats[player].bestByGoalsFor || 
                        goalsFor > stats[player].bestByGoalsFor.goalsFor) {
                        stats[player].bestByGoalsFor = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check best by goal surplus
                    if (!stats[player].bestBySurplus || 
                        goalDifference > stats[player].bestBySurplus.goalDifference) {
                        stats[player].bestBySurplus = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                }
            });
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Helper function to format date
        const formatDate = (timestamp) => {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        };
        
        // Helper function to format team names
        const formatTeamNames = (players) => {
            if (players.length === 0) return 'Solo';
            return players.join(' & ');
        };
        
        // Prepare data for tables
        const worstGoalsAgainst = [];
        const worstDeficit = [];
        const bestGoalsFor = [];
        const bestSurplus = [];
        
        Object.entries(data).forEach(([player, stats]) => {
            if (stats.worstByGoalsAgainst) {
                worstGoalsAgainst.push({
                    player,
                    ...stats.worstByGoalsAgainst,
                    teammates: formatTeamNames(stats.worstByGoalsAgainst.teammates),
                    opponents: formatTeamNames(stats.worstByGoalsAgainst.opponents)
                });
            }
            if (stats.worstByDifference) {
                worstDeficit.push({
                    player,
                    ...stats.worstByDifference,
                    teammates: formatTeamNames(stats.worstByDifference.teammates),
                    opponents: formatTeamNames(stats.worstByDifference.opponents)
                });
            }
            if (stats.bestByGoalsFor) {
                bestGoalsFor.push({
                    player,
                    ...stats.bestByGoalsFor,
                    teammates: formatTeamNames(stats.bestByGoalsFor.teammates),
                    opponents: formatTeamNames(stats.bestByGoalsFor.opponents)
                });
            }
            if (stats.bestBySurplus) {
                bestSurplus.push({
                    player,
                    ...stats.bestBySurplus,
                    teammates: formatTeamNames(stats.bestBySurplus.teammates),
                    opponents: formatTeamNames(stats.bestBySurplus.opponents)
                });
            }
        });
        
        // Sort by metric value (descending for goals/scoring, ascending for worst losses)
        worstGoalsAgainst.sort((a, b) => b.goalsAgainst - a.goalsAgainst);
        worstDeficit.sort((a, b) => a.goalDifference - b.goalDifference);
        bestGoalsFor.sort((a, b) => b.goalsFor - a.goalsFor);
        bestSurplus.sort((a, b) => b.goalDifference - a.goalDifference);
        
        const renderTable = (title, rows, columns) => {
            if (rows.length === 0) return '';
            
            const headers = columns.map(col => `<th>${col.header}</th>`).join('');
            const tableRows = rows.map(row => {
                const cells = columns.map(col => {
                    const value = col.getter(row);
                    const classes = col.class ? ` class="${col.class}"` : '';
                    return `<td${classes}>${value}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            
            return `
                <h3 style="margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.1rem;">${title}</h3>
                <table class="league-table">
                    <thead>
                        <tr>${headers}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            `;
        };
        
        let html = '';
        
        // Worst Losses - Most Goals Against
        html += renderTable('Worst Loss - Most Goals Conceded', worstGoalsAgainst, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GA', getter: (r) => r.goalsAgainst },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        // Worst Losses - Biggest Deficit
        html += renderTable('Worst Loss - Biggest Deficit', worstDeficit, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GD', getter: (r) => `<span class="goal-diff negative">${r.goalDifference}</span>`, class: 'goal-diff' },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        // Best Win - Most Goals Scored
        html += renderTable('Best Win - Most Goals Scored', bestGoalsFor, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GF', getter: (r) => r.goalsFor },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        // Best Win - Biggest Surplus
        html += renderTable('Best Win - Biggest Surplus', bestSurplus, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GD', getter: (r) => `<span class="goal-diff positive">+${r.goalDifference}</span>`, class: 'goal-diff' },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        if (!html) {
            container.innerHTML = '<div class="empty-state"><p>No records available yet. Play some matches first!</p></div>';
        } else {
            container.innerHTML = html;
        }
        
        return container;
    }
});

// Average Goals Per Game Calculator
StatisticsCalculators.register({
    id: 'avgGoalsPerGame',
    name: 'Average Goals Per Game',
    category: 'goals',
    calculate: (matches, players) => {
        const totalGoals = StatisticsCalculators.getById('totalGoals').calculate(matches, players);
        const wld = StatisticsCalculators.getById('winLossDraw').calculate(matches, players);
        
        const stats = {};
        players.forEach(player => {
            const goals = totalGoals[player]?.goals || 0;
            const games = wld[player]?.games || 0;
            stats[player] = {
                avgGoals: games > 0 ? (goals / games).toFixed(2) : 0,
                totalGoals: goals,
                games: games
            };
        });
        
        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const sorted = Object.entries(data)
            .sort((a, b) => parseFloat(b[1].avgGoals) - parseFloat(a[1].avgGoals));
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Avg</th>
                        <th>GF</th>
                        <th>GP</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        return `
                            <tr ${position === 1 ? 'class="leader"' : ''}>
                                <td class="position">${position}</td>
                                <td class="player-name">${positionSymbol} ${player}</td>
                                <td class="points">${stats.avgGoals}</td>
                                <td>${stats.totalGoals}</td>
                                <td>${stats.games}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Form Tracking (Last 5 Games)
StatisticsCalculators.register({
    id: 'form',
    name: 'Form (Last 5 Games)',
    category: 'performance',
    subcategory: 'form',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = {
                form: [],
                wins: 0,
                draws: 0,
                losses: 0
            };
        });

        // Sort matches by date (most recent first)
        const sortedMatches = [...matches].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        // Track last 5 games for each player
        players.forEach(player => {
            let gamesCount = 0;
            for (const match of sortedMatches) {
                if (gamesCount >= 5) break;
                
                const { team1, team2, result } = match;
                const team1Players = Array.isArray(team1) ? team1 : [team1];
                const team2Players = Array.isArray(team2) ? team2 : [team2];
                
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                
                if (!inTeam1 && !inTeam2) continue;
                
                let outcome = '';
                if (result === 'draw') {
                    outcome = 'D';
                    stats[player].draws++;
                } else if ((result === 'team1' && inTeam1) || (result === 'team2' && inTeam2)) {
                    outcome = 'W';
                    stats[player].wins++;
                } else {
                    outcome = 'L';
                    stats[player].losses++;
                }
                
                stats[player].form.push(outcome);
                gamesCount++;
            }
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const sorted = Object.entries(data)
            .sort((a, b) => {
                // Sort by points (W=3, D=1, L=0) then by most recent wins
                const pointsA = b[1].wins * 3 + b[1].draws;
                const pointsB = a[1].wins * 3 + a[1].draws;
                if (pointsA !== pointsB) return pointsA - pointsB;
                return b[1].wins - a[1].wins;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Form</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats]) => {
                        const formDisplay = stats.form.length > 0 
                            ? stats.form.map(r => {
                                if (r === 'W') return '<span style="color: #4CAF50; font-weight: bold;">W</span>';
                                if (r === 'D') return '<span style="color: #FF9800; font-weight: bold;">D</span>';
                                return '<span style="color: #f44336; font-weight: bold;">L</span>';
                            }).join(' ')
                            : '-';
                        const points = stats.wins * 3 + stats.draws;
                        return `
                            <tr>
                                <td class="player-name">${player}</td>
                                <td>${formDisplay}</td>
                                <td>${stats.wins}</td>
                                <td>${stats.draws}</td>
                                <td>${stats.losses}</td>
                                <td class="points">${points}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Head-to-Head Calculator
StatisticsCalculators.register({
    id: 'headToHead',
    name: 'Head-to-Head',
    category: 'performance',
    subcategory: 'h2h',
    calculate: (matches, players) => {
        const stats = {};
        
        // Initialize all player pairs
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const p1 = players[i];
                const p2 = players[j];
                const key = [p1, p2].sort().join(' vs ');
                if (!stats[key]) {
                    stats[key] = {
                        player1: p1,
                        player2: p2,
                        together: { wins: 0, draws: 0, losses: 0, games: 0 },
                        against: { wins: 0, draws: 0, losses: 0, games: 0 }
                    };
                }
            }
        }

        matches.forEach(match => {
            const { team1, team2, result } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            // Check all player pairs
            for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                    const p1 = players[i];
                    const p2 = players[j];
                    const key = [p1, p2].sort().join(' vs ');
                    
                    const p1InTeam1 = team1Players.includes(p1);
                    const p2InTeam1 = team1Players.includes(p2);
                    const p1InTeam2 = team2Players.includes(p1);
                    const p2InTeam2 = team2Players.includes(p2);
                    
                    // Playing together
                    if ((p1InTeam1 && p2InTeam1) || (p1InTeam2 && p2InTeam2)) {
                        stats[key].together.games++;
                        if (result === 'draw') {
                            stats[key].together.draws++;
                        } else if ((result === 'team1' && p1InTeam1) || (result === 'team2' && p1InTeam2)) {
                            stats[key].together.wins++;
                        } else {
                            stats[key].together.losses++;
                        }
                    }
                    // Playing against each other
                    else if ((p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1)) {
                        stats[key].against.games++;
                        if (result === 'draw') {
                            stats[key].against.draws++;
                        } else if ((result === 'team1' && p1InTeam1) || (result === 'team2' && p1InTeam2)) {
                            stats[key].against.wins++;
                        } else {
                            stats[key].against.losses++;
                        }
                    }
                }
            }
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const sorted = Object.entries(data)
            .filter(([key, stats]) => stats.together.games > 0 || stats.against.games > 0)
            .sort((a, b) => {
                const totalA = a[1].together.games + a[1].against.games;
                const totalB = b[1].together.games + b[1].against.games;
                return totalB - totalA;
            });
        
        if (sorted.length === 0) {
            container.innerHTML = '<p>No head-to-head data available yet.</p>';
            return container;
        }
        
        const html = sorted.map(([key, stats]) => {
            const [p1, p2] = key.split(' vs ');
            return `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background-color: var(--background-color); border-radius: 8px;">
                    <h4 style="margin-bottom: 0.75rem; font-size: 1.1rem;">${p1} vs ${p2}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <strong>Playing Together:</strong>
                            <table class="league-table" style="margin-top: 0.5rem;">
                                <thead>
                                    <tr>
                                        <th>GP</th>
                                        <th>W</th>
                                        <th>D</th>
                                        <th>L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${stats.together.games}</td>
                                        <td>${stats.together.wins}</td>
                                        <td>${stats.together.draws}</td>
                                        <td>${stats.together.losses}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <strong>Playing Against:</strong>
                            <table class="league-table" style="margin-top: 0.5rem;">
                                <thead>
                                    <tr>
                                        <th>GP</th>
                                        <th>W</th>
                                        <th>D</th>
                                        <th>L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${stats.against.games}</td>
                                        <td>${stats.against.wins}</td>
                                        <td>${stats.against.draws}</td>
                                        <td>${stats.against.losses}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// ============================================================================
// Chart Calculators - Data Visualization
// ============================================================================

// Win Rate Over Time Chart
StatisticsCalculators.register({
    id: 'winRateChart',
    name: 'Win Rate Over Time',
    category: 'visualization',
    subcategory: 'trends',
    calculate: (matches, players) => {
        // Group matches by date and calculate win rate for each player
        const sortedMatches = [...matches].sort((a, b) => 
            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );
        
        const playerData = {};
        players.forEach(player => {
            playerData[player] = {
                dates: [],
                winRates: [],
                cumulativeWins: 0,
                cumulativeGames: 0
            };
        });

        sortedMatches.forEach(match => {
            const date = match.timestamp ? new Date(match.timestamp).toLocaleDateString() : 'Unknown';
            const { team1, team2, result } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            players.forEach(player => {
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                if (!inTeam1 && !inTeam2) return;

                const data = playerData[player];
                data.cumulativeGames++;
                
                let won = false;
                if (result === 'team1' && inTeam1) won = true;
                if (result === 'team2' && inTeam2) won = true;
                if (won) data.cumulativeWins++;

                const winRate = data.cumulativeGames > 0 
                    ? (data.cumulativeWins / data.cumulativeGames) * 100 
                    : 0;

                data.dates.push(date);
                data.winRates.push(winRate);
            });
        });

        return playerData;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Data</h3><p>Play some matches to see win rate trends!</p></div>';
            return container;
        }

        // Get player colors from settings if available
        const getPlayerColor = (playerName) => {
            // Try to get from global settings manager if available
            if (window.appController && window.appController.settingsManager) {
                return window.appController.settingsManager.getPlayerColor(playerName) || null;
            }
            return null;
        };

        const colors = [
            '#2196F3', '#4CAF50', '#FF9800', '#F44336',
            '#9C27B0', '#00BCD4', '#FFC107', '#795548'
        ];

        const datasets = players.map((player, index) => {
            const playerData = data[player];
            const color = getPlayerColor(player) || colors[index % colors.length];
            
            return {
                label: player,
                data: playerData.winRates,
                borderColor: color,
                backgroundColor: color + '40',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            };
        });

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: data[players[0]]?.dates || [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Win Rate Over Time (%)',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Win Rate (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });

        return container;
    }
});

// Goals Scored Chart
StatisticsCalculators.register({
    id: 'goalsChart',
    name: 'Goals Scored',
    category: 'visualization',
    subcategory: 'goals',
    calculate: (matches, players) => {
        const goalsData = {};
        players.forEach(player => {
            goalsData[player] = {
                goalsFor: 0,
                goalsAgainst: 0,
                totalGoals: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            team1Players.forEach(player => {
                if (goalsData[player]) {
                    goalsData[player].goalsFor += team1Score || 0;
                    goalsData[player].goalsAgainst += team2Score || 0;
                    goalsData[player].totalGoals += team1Score || 0;
                }
            });

            team2Players.forEach(player => {
                if (goalsData[player]) {
                    goalsData[player].goalsFor += team2Score || 0;
                    goalsData[player].goalsAgainst += team1Score || 0;
                    goalsData[player].totalGoals += team2Score || 0;
                }
            });
        });

        return goalsData;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Data</h3><p>Play some matches to see goals scored!</p></div>';
            return container;
        }

        const getPlayerColor = (playerName) => {
            if (window.appController && window.appController.settingsManager) {
                return window.appController.settingsManager.getPlayerColor(playerName) || null;
            }
            return null;
        };

        const colors = [
            '#2196F3', '#4CAF50', '#FF9800', '#F44336',
            '#9C27B0', '#00BCD4', '#FFC107', '#795548'
        ];

        const sortedPlayers = players.sort((a, b) => 
            data[b].totalGoals - data[a].totalGoals
        );

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sortedPlayers,
                datasets: [{
                    label: 'Goals For',
                    data: sortedPlayers.map(p => data[p].goalsFor),
                    backgroundColor: sortedPlayers.map((p, i) => {
                        const color = getPlayerColor(p) || colors[i % colors.length];
                        return color + 'CC';
                    }),
                    borderColor: sortedPlayers.map((p, i) => {
                        const color = getPlayerColor(p) || colors[i % colors.length];
                        return color;
                    }),
                    borderWidth: 2
                }, {
                    label: 'Goals Against',
                    data: sortedPlayers.map(p => data[p].goalsAgainst),
                    backgroundColor: '#F44336CC',
                    borderColor: '#F44336',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Goals Scored & Conceded',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        title: {
                            display: true,
                            text: 'Goals'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Player'
                        }
                    }
                }
            }
        });

        return container;
    }
});

// Match Distribution Pie Chart
StatisticsCalculators.register({
    id: 'matchDistributionChart',
    name: 'Match Distribution',
    category: 'visualization',
    subcategory: 'overview',
    calculate: (matches, players) => {
        let wins = 0, losses = 0, draws = 0;

        matches.forEach(match => {
            if (match.result === 'team1' || match.result === 'team2') {
                wins++;
            } else if (match.result === 'draw') {
                draws++;
            }
        });

        // For individual player perspective, we'd need to calculate per player
        // For now, showing overall distribution
        return {
            wins,
            losses,
            draws,
            total: matches.length
        };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        if (data.total === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Data</h3><p>Play some matches to see distribution!</p></div>';
            return container;
        }

        new Chart(canvas, {
            type: 'pie',
            data: {
                labels: ['Wins', 'Draws', 'Losses'],
                datasets: [{
                    data: [data.wins, data.draws, data.losses],
                    backgroundColor: [
                        '#4CAF50',
                        '#FF9800',
                        '#F44336'
                    ],
                    borderColor: [
                        '#388E3C',
                        '#F57C00',
                        '#D32F2F'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Match Result Distribution',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        return container;
    }
});

// Performance Insights - AI-like Analysis
StatisticsCalculators.register({
    id: 'performanceInsights',
    name: 'Performance Insights',
    category: 'visualization',
    subcategory: 'insights',
    calculate: (matches, players) => {
        if (matches.length === 0) return {};

        const insights = {};
        
        players.forEach(player => {
            const playerInsights = [];
            const playerMatches = matches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                return team1Players.includes(player) || team2Players.includes(player);
            });

            if (playerMatches.length === 0) {
                insights[player] = { insights: ['No matches played yet'] };
                return;
            }

            // Calculate basic stats
            let wins = 0, losses = 0, draws = 0;
            let goalsFor = 0, goalsAgainst = 0;
            const dayOfWeekStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Sunday = 0
            const dayOfWeekWins = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            const recentMatches = playerMatches.slice(-10); // Last 10 matches
            const olderMatches = playerMatches.slice(0, -10);

            playerMatches.forEach(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);

                if (match.timestamp) {
                    const date = new Date(match.timestamp);
                    const dayOfWeek = date.getDay();
                    dayOfWeekStats[dayOfWeek]++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        dayOfWeekWins[dayOfWeek]++;
                    }
                }

                if (inTeam1) {
                    goalsFor += match.team1Score || 0;
                    goalsAgainst += match.team2Score || 0;
                    if (match.result === 'team1') wins++;
                    else if (match.result === 'team2') losses++;
                    else draws++;
                } else if (inTeam2) {
                    goalsFor += match.team2Score || 0;
                    goalsAgainst += match.team1Score || 0;
                    if (match.result === 'team2') wins++;
                    else if (match.result === 'team1') losses++;
                    else draws++;
                }
            });

            const totalGames = wins + losses + draws;
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
            const goalDifference = goalsFor - goalsAgainst;

            // Insight 1: Overall performance
            if (winRate >= 60) {
                playerInsights.push(`🏆 Excellent win rate of ${winRate.toFixed(1)}%! You're dominating!`);
            } else if (winRate >= 50) {
                playerInsights.push(`✅ Strong performance with ${winRate.toFixed(1)}% win rate`);
            } else if (winRate >= 40) {
                playerInsights.push(`📊 Decent ${winRate.toFixed(1)}% win rate - room for improvement`);
            } else {
                playerInsights.push(`💪 Keep practicing! Your win rate is ${winRate.toFixed(1)}%`);
            }

            // Insight 2: Recent form vs overall
            if (recentMatches.length >= 5 && olderMatches.length >= 5) {
                let recentWins = 0, recentGames = 0;
                let olderWins = 0, olderGames = 0;

                recentMatches.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    if (!inTeam1 && !inTeam2) return;

                    recentGames++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        recentWins++;
                    }
                });

                olderMatches.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    if (!inTeam1 && !inTeam2) return;

                    olderGames++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        olderWins++;
                    }
                });

                const recentWinRate = recentGames > 0 ? (recentWins / recentGames) * 100 : 0;
                const olderWinRate = olderGames > 0 ? (olderWins / olderGames) * 100 : 0;

                if (recentWinRate > olderWinRate + 10) {
                    playerInsights.push(`📈 Your form is improving! Recent win rate (${recentWinRate.toFixed(1)}%) is much better than earlier (${olderWinRate.toFixed(1)}%)`);
                } else if (recentWinRate < olderWinRate - 10) {
                    playerInsights.push(`📉 Your recent form has declined (${recentWinRate.toFixed(1)}% vs ${olderWinRate.toFixed(1)}% earlier)`);
                } else if (recentWinRate > olderWinRate) {
                    playerInsights.push(`📊 Slight improvement in recent matches`);
                }
            }

            // Insight 3: Best day of week
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let bestDay = null;
            let bestDayWinRate = 0;
            let bestDayGames = 0;

            for (let day = 0; day < 7; day++) {
                if (dayOfWeekStats[day] >= 3) { // Need at least 3 games
                    const dayWinRate = dayOfWeekStats[day] > 0 
                        ? (dayOfWeekWins[day] / dayOfWeekStats[day]) * 100 
                        : 0;
                    if (dayWinRate > bestDayWinRate) {
                        bestDayWinRate = dayWinRate;
                        bestDay = day;
                        bestDayGames = dayOfWeekStats[day];
                    }
                }
            }

            if (bestDay !== null && bestDayWinRate >= 50) {
                playerInsights.push(`📅 You play best on ${dayNames[bestDay]}s! ${bestDayWinRate.toFixed(1)}% win rate (${bestDayGames} games)`);
            }

            // Insight 4: Goal difference
            if (goalDifference > 20) {
                playerInsights.push(`⚽ Excellent goal difference of +${goalDifference}! You're scoring freely`);
            } else if (goalDifference > 10) {
                playerInsights.push(`⚽ Strong goal difference of +${goalDifference}`);
            } else if (goalDifference < -10) {
                playerInsights.push(`⚽ Focus on defense - goal difference is ${goalDifference}`);
            }

            // Insight 5: Streak analysis
            let currentStreak = 0;
            let streakType = 'none';
            const sortedMatches = [...playerMatches].sort((a, b) => 
                new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
            );

            for (const match of sortedMatches) {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                if (!inTeam1 && !inTeam2) continue;

                let won = false;
                if (match.result === 'team1' && inTeam1) won = true;
                if (match.result === 'team2' && inTeam2) won = true;

                if (streakType === 'none') {
                    streakType = won ? 'win' : 'loss';
                    currentStreak = 1;
                } else if ((streakType === 'win' && won) || (streakType === 'loss' && !won && match.result !== 'draw')) {
                    currentStreak++;
                } else {
                    break;
                }

                if (match.result === 'draw') break;
            }

            if (currentStreak >= 5 && streakType === 'win') {
                playerInsights.push(`🔥 On fire! ${currentStreak} game winning streak!`);
            } else if (currentStreak >= 3 && streakType === 'win') {
                playerInsights.push(`🔥 ${currentStreak} game winning streak - keep it up!`);
            } else if (currentStreak >= 3 && streakType === 'loss') {
                playerInsights.push(`💪 ${currentStreak} game losing streak - time to bounce back!`);
            }

            // Insight 6: Games played milestone
            if (totalGames >= 100) {
                playerInsights.push(`🎯 Milestone: ${totalGames} games played!`);
            } else if (totalGames >= 50) {
                playerInsights.push(`🎯 ${totalGames} games played - great dedication!`);
            }

            insights[player] = {
                insights: playerInsights.length > 0 ? playerInsights : ['Keep playing to unlock insights!'],
                stats: {
                    winRate: winRate.toFixed(1),
                    totalGames,
                    goalDifference
                }
            };
        });

        return insights;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card insights-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        
        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤖</div><h3>No Insights Yet</h3><p>Play some matches to unlock AI insights!</p></div>';
            return container;
        }

        const html = players.map(player => {
            const playerData = data[player];
            const color = window.appController && window.appController.settingsManager
                ? window.appController.settingsManager.getPlayerColor(player)
                : null;
            const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';

            return `
                <div class="insight-player-section">
                    <h4 ${playerStyle}>${escapeHtml(player)}</h4>
                    <div class="insights-list">
                        ${playerData.insights.map(insight => `
                            <div class="insight-item">
                                <span class="insight-text">${escapeHtml(insight)}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${playerData.stats ? `
                        <div class="insight-stats">
                            <span>Win Rate: ${playerData.stats.winRate}%</span>
                            <span>Games: ${playerData.stats.totalGames}</span>
                            <span>Goal Diff: ${playerData.stats.goalDifference > 0 ? '+' : ''}${playerData.stats.goalDifference}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Trend Analysis Calculator
StatisticsCalculators.register({
    id: 'trendAnalysis',
    name: 'Trend Analysis',
    category: 'visualization',
    subcategory: 'trends',
    calculate: (matches, players) => {
        if (matches.length < 5) return {}; // Need at least 5 matches for trends

        const sortedMatches = [...matches].sort((a, b) => 
            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );

        const trends = {};
        
        players.forEach(player => {
            const playerMatches = sortedMatches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                return team1Players.includes(player) || team2Players.includes(player);
            });

            if (playerMatches.length < 5) {
                trends[player] = { trend: 'insufficient_data', message: 'Need at least 5 matches for trend analysis' };
                return;
            }

            // Split into thirds for trend analysis
            const thirdSize = Math.floor(playerMatches.length / 3);
            const firstThird = playerMatches.slice(0, thirdSize);
            const middleThird = playerMatches.slice(thirdSize, thirdSize * 2);
            const lastThird = playerMatches.slice(thirdSize * 2);

            const calculateWinRate = (matchSet) => {
                let wins = 0, games = 0;
                matchSet.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    if (!inTeam1 && !inTeam2) return;

                    games++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        wins++;
                    }
                });
                return games > 0 ? (wins / games) * 100 : 0;
            };

            const firstWinRate = calculateWinRate(firstThird);
            const middleWinRate = calculateWinRate(middleThird);
            const lastWinRate = calculateWinRate(lastThird);

            // Determine trend
            let trend = 'stable';
            let trendStrength = 0;
            let message = '';

            const earlyAvg = (firstWinRate + middleWinRate) / 2;
            const improvement = lastWinRate - earlyAvg;

            if (improvement > 15) {
                trend = 'improving_strong';
                trendStrength = Math.min(100, (improvement / 50) * 100);
                message = `Strong improvement! Win rate increased by ${improvement.toFixed(1)}%`;
            } else if (improvement > 5) {
                trend = 'improving';
                trendStrength = Math.min(100, (improvement / 20) * 100);
                message = `Improving! Win rate up by ${improvement.toFixed(1)}%`;
            } else if (improvement < -15) {
                trend = 'declining_strong';
                trendStrength = Math.min(100, (Math.abs(improvement) / 50) * 100);
                message = `Declining performance. Win rate down by ${Math.abs(improvement).toFixed(1)}%`;
            } else if (improvement < -5) {
                trend = 'declining';
                trendStrength = Math.min(100, (Math.abs(improvement) / 20) * 100);
                message = `Slight decline. Win rate down by ${Math.abs(improvement).toFixed(1)}%`;
            } else {
                trend = 'stable';
                message = `Stable performance. Win rate around ${lastWinRate.toFixed(1)}%`;
            }

            trends[player] = {
                trend,
                trendStrength,
                message,
                firstPeriod: firstWinRate.toFixed(1),
                middlePeriod: middleWinRate.toFixed(1),
                lastPeriod: lastWinRate.toFixed(1),
                overallChange: improvement.toFixed(1)
            };
        });

        return trends;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card trend-analysis-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><h3>No Trend Data</h3><p>Play at least 5 matches to see trend analysis!</p></div>';
            return container;
        }

        const getTrendIcon = (trend) => {
            switch(trend) {
                case 'improving_strong': return '🚀';
                case 'improving': return '📈';
                case 'declining_strong': return '📉';
                case 'declining': return '⚠️';
                default: return '➡️';
            }
        };

        const getTrendColor = (trend) => {
            switch(trend) {
                case 'improving_strong': return '#4CAF50';
                case 'improving': return '#8BC34A';
                case 'declining_strong': return '#F44336';
                case 'declining': return '#FF9800';
                default: return '#757575';
            }
        };

        const html = players.map(player => {
            const trendData = data[player];
            
            if (trendData.trend === 'insufficient_data') {
                return `
                    <div class="trend-player-section">
                        <h4>${escapeHtml(player)}</h4>
                        <p class="trend-message">${escapeHtml(trendData.message)}</p>
                    </div>
                `;
            }

            const color = window.appController && window.appController.settingsManager
                ? window.appController.settingsManager.getPlayerColor(player)
                : null;
            const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';
            const trendColor = getTrendColor(trendData.trend);
            const trendIcon = getTrendIcon(trendData.trend);

            return `
                <div class="trend-player-section">
                    <h4 ${playerStyle}>${escapeHtml(player)}</h4>
                    <div class="trend-indicator" style="border-left-color: ${trendColor};">
                        <div class="trend-header">
                            <span class="trend-icon">${trendIcon}</span>
                            <span class="trend-message" style="color: ${trendColor};">${escapeHtml(trendData.message)}</span>
                        </div>
                        <div class="trend-progress">
                            <div class="trend-bar" style="width: ${trendData.trendStrength}%; background-color: ${trendColor};"></div>
                        </div>
                        <div class="trend-periods">
                            <div class="trend-period">
                                <span class="period-label">Early</span>
                                <span class="period-value">${trendData.firstPeriod}%</span>
                            </div>
                            <div class="trend-period">
                                <span class="period-label">Middle</span>
                                <span class="period-value">${trendData.middlePeriod}%</span>
                            </div>
                            <div class="trend-period">
                                <span class="period-label">Recent</span>
                                <span class="period-value">${trendData.lastPeriod}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Comparative Stats - Compare Two Players
StatisticsCalculators.register({
    id: 'comparativeStats',
    name: 'Player Comparison',
    category: 'visualization',
    subcategory: 'comparison',
    calculate: (matches, players) => {
        if (players.length < 2) return {};

        // Calculate stats for all player pairs
        const comparisons = {};
        
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const player1 = players[i];
                const player2 = players[j];
                const key = `${player1} vs ${player2}`;

                let p1Stats = { wins: 0, losses: 0, draws: 0, games: 0, goalsFor: 0, goalsAgainst: 0 };
                let p2Stats = { wins: 0, losses: 0, draws: 0, games: 0, goalsFor: 0, goalsAgainst: 0 };
                let headToHead = { p1Wins: 0, p2Wins: 0, draws: 0, games: 0 };

                matches.forEach(match => {
                    const { team1, team2, result, team1Score, team2Score } = match;
                    const team1Players = Array.isArray(team1) ? team1 : [team1];
                    const team2Players = Array.isArray(team2) ? team2 : [team2];

                    const p1InTeam1 = team1Players.includes(player1);
                    const p1InTeam2 = team2Players.includes(player1);
                    const p2InTeam1 = team1Players.includes(player2);
                    const p2InTeam2 = team2Players.includes(player2);

                    // Head-to-head (playing against each other)
                    if ((p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1)) {
                        headToHead.games++;
                        if (result === 'team1' && p1InTeam1) headToHead.p1Wins++;
                        else if (result === 'team2' && p1InTeam2) headToHead.p1Wins++;
                        else if (result === 'team1' && p2InTeam1) headToHead.p2Wins++;
                        else if (result === 'team2' && p2InTeam2) headToHead.p2Wins++;
                        else if (result === 'draw') headToHead.draws++;
                    }

                    // Player 1 stats
                    if (p1InTeam1 || p1InTeam2) {
                        p1Stats.games++;
                        if (p1InTeam1) {
                            p1Stats.goalsFor += team1Score || 0;
                            p1Stats.goalsAgainst += team2Score || 0;
                            if (result === 'team1') p1Stats.wins++;
                            else if (result === 'team2') p1Stats.losses++;
                            else p1Stats.draws++;
                        } else {
                            p1Stats.goalsFor += team2Score || 0;
                            p1Stats.goalsAgainst += team1Score || 0;
                            if (result === 'team2') p1Stats.wins++;
                            else if (result === 'team1') p1Stats.losses++;
                            else p1Stats.draws++;
                        }
                    }

                    // Player 2 stats
                    if (p2InTeam1 || p2InTeam2) {
                        p2Stats.games++;
                        if (p2InTeam1) {
                            p2Stats.goalsFor += team1Score || 0;
                            p2Stats.goalsAgainst += team2Score || 0;
                            if (result === 'team1') p2Stats.wins++;
                            else if (result === 'team2') p2Stats.losses++;
                            else p2Stats.draws++;
                        } else {
                            p2Stats.goalsFor += team2Score || 0;
                            p2Stats.goalsAgainst += team1Score || 0;
                            if (result === 'team2') p2Stats.wins++;
                            else if (result === 'team1') p2Stats.losses++;
                            else p2Stats.draws++;
                        }
                    }
                });

                const p1WinRate = p1Stats.games > 0 ? (p1Stats.wins / p1Stats.games) * 100 : 0;
                const p2WinRate = p2Stats.games > 0 ? (p2Stats.wins / p2Stats.games) * 100 : 0;

                comparisons[key] = {
                    player1,
                    player2,
                    player1Stats: {
                        ...p1Stats,
                        winRate: p1WinRate.toFixed(1),
                        goalDifference: p1Stats.goalsFor - p1Stats.goalsAgainst
                    },
                    player2Stats: {
                        ...p2Stats,
                        winRate: p2WinRate.toFixed(1),
                        goalDifference: p2Stats.goalsFor - p2Stats.goalsAgainst
                    },
                    headToHead: {
                        ...headToHead,
                        p1WinRate: headToHead.games > 0 ? (headToHead.p1Wins / headToHead.games) * 100 : 0,
                        p2WinRate: headToHead.games > 0 ? (headToHead.p2Wins / headToHead.games) * 100 : 0
                    }
                };
            }
        }

        return comparisons;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card comparative-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const comparisons = Object.keys(data);
        if (comparisons.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚖️</div><h3>No Comparisons</h3><p>Need at least 2 players to compare!</p></div>';
            return container;
        }

        const getPlayerColor = (playerName) => {
            if (window.appController && window.appController.settingsManager) {
                return window.appController.settingsManager.getPlayerColor(playerName) || null;
            }
            return null;
        };

        const html = comparisons.map(key => {
            const comp = data[key];
            const p1Color = getPlayerColor(comp.player1) || '#2196F3';
            const p2Color = getPlayerColor(comp.player2) || '#4CAF50';

            return `
                <div class="comparison-section">
                    <h4 class="comparison-title">${escapeHtml(comp.player1)} <span class="vs">vs</span> ${escapeHtml(comp.player2)}</h4>
                    
                    <div class="comparison-stats-grid">
                        <div class="comparison-player" style="border-color: ${p1Color};">
                            <div class="comparison-player-header" style="background-color: ${p1Color}20;">
                                <h5 style="color: ${p1Color};">${escapeHtml(comp.player1)}</h5>
                            </div>
                            <div class="comparison-stats">
                                <div class="comparison-stat">
                                    <span class="stat-label">Win Rate</span>
                                    <span class="stat-value">${comp.player1Stats.winRate}%</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Games</span>
                                    <span class="stat-value">${comp.player1Stats.games}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">W-D-L</span>
                                    <span class="stat-value">${comp.player1Stats.wins}-${comp.player1Stats.draws}-${comp.player1Stats.losses}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goals</span>
                                    <span class="stat-value">${comp.player1Stats.goalsFor}:${comp.player1Stats.goalsAgainst}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goal Diff</span>
                                    <span class="stat-value ${comp.player1Stats.goalDifference >= 0 ? 'positive' : 'negative'}">${comp.player1Stats.goalDifference > 0 ? '+' : ''}${comp.player1Stats.goalDifference}</span>
                                </div>
                            </div>
                        </div>

                        <div class="comparison-player" style="border-color: ${p2Color};">
                            <div class="comparison-player-header" style="background-color: ${p2Color}20;">
                                <h5 style="color: ${p2Color};">${escapeHtml(comp.player2)}</h5>
                            </div>
                            <div class="comparison-stats">
                                <div class="comparison-stat">
                                    <span class="stat-label">Win Rate</span>
                                    <span class="stat-value">${comp.player2Stats.winRate}%</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Games</span>
                                    <span class="stat-value">${comp.player2Stats.games}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">W-D-L</span>
                                    <span class="stat-value">${comp.player2Stats.wins}-${comp.player2Stats.draws}-${comp.player2Stats.losses}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goals</span>
                                    <span class="stat-value">${comp.player2Stats.goalsFor}:${comp.player2Stats.goalsAgainst}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goal Diff</span>
                                    <span class="stat-value ${comp.player2Stats.goalDifference >= 0 ? 'positive' : 'negative'}">${comp.player2Stats.goalDifference > 0 ? '+' : ''}${comp.player2Stats.goalDifference}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${comp.headToHead.games > 0 ? `
                        <div class="head-to-head-section">
                            <h5>Head-to-Head</h5>
                            <div class="h2h-stats">
                                <div class="h2h-stat">
                                    <span class="h2h-label">${escapeHtml(comp.player1)}</span>
                                    <span class="h2h-value" style="color: ${p1Color};">${comp.headToHead.p1Wins} wins (${comp.headToHead.p1WinRate.toFixed(1)}%)</span>
                                </div>
                                <div class="h2h-stat">
                                    <span class="h2h-label">Draws</span>
                                    <span class="h2h-value">${comp.headToHead.draws}</span>
                                </div>
                                <div class="h2h-stat">
                                    <span class="h2h-label">${escapeHtml(comp.player2)}</span>
                                    <span class="h2h-value" style="color: ${p2Color};">${comp.headToHead.p2Wins} wins (${comp.headToHead.p2WinRate.toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Extra Time & Penalties Statistics Calculator
StatisticsCalculators.register({
    id: 'extraTimePenalties',
    name: 'Extra Time & Penalties',
    category: 'performance',
    subcategory: 'match-types',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = {
                totalMatches: 0,
                extraTimeMatches: 0,
                extraTimeWins: 0,
                extraTimeLosses: 0,
                extraTimeDraws: 0,
                penaltiesMatches: 0,
                penaltiesWins: 0,
                penaltiesLosses: 0,
                penaltiesScored: 0,
                penaltiesConceded: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, result, team1ExtraTimeScore, team2ExtraTimeScore, team1PenaltiesScore, team2PenaltiesScore } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            const hasExtraTime = team1ExtraTimeScore !== undefined && team2ExtraTimeScore !== undefined;
            const hasPenalties = team1PenaltiesScore !== undefined && team2PenaltiesScore !== undefined;

            // Count all matches for each player
            [...team1Players, ...team2Players].forEach(player => {
                if (stats[player]) {
                    stats[player].totalMatches++;
                    
                    const inTeam1 = team1Players.includes(player);
                    const won = (result === 'team1' && inTeam1) || (result === 'team2' && !inTeam1);
                    const lost = (result === 'team1' && !inTeam1) || (result === 'team2' && inTeam1);
                    const drawn = result === 'draw';
                    
                    if (hasExtraTime) {
                        stats[player].extraTimeMatches++;
                        if (won) stats[player].extraTimeWins++;
                        else if (lost) stats[player].extraTimeLosses++;
                        else if (drawn) stats[player].extraTimeDraws++;
                    }
                    
                    if (hasPenalties) {
                        stats[player].penaltiesMatches++;
                        if (won) stats[player].penaltiesWins++;
                        else if (lost) stats[player].penaltiesLosses++;
                        
                        // Count penalties scored/conceded
                        if (inTeam1) {
                            stats[player].penaltiesScored += team1PenaltiesScore || 0;
                            stats[player].penaltiesConceded += team2PenaltiesScore || 0;
                        } else {
                            stats[player].penaltiesScored += team2PenaltiesScore || 0;
                            stats[player].penaltiesConceded += team1PenaltiesScore || 0;
                        }
                    }
                }
            });
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        
        const sorted = Object.entries(data)
            .sort((a, b) => {
                // Sort by total matches, then by extra time matches
                if (b[1].totalMatches !== a[1].totalMatches) {
                    return b[1].totalMatches - a[1].totalMatches;
                }
                return b[1].extraTimeMatches - a[1].extraTimeMatches;
            });

        if (sorted.length === 0 || sorted.every(([_, stats]) => stats.totalMatches === 0)) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏱️</div><h3>No Extra Time Data</h3><p>Record matches that went to extra time or penalties to see statistics here!</p></div>';
            return container;
        }

        const html = sorted.map(([player, stats]) => {
            const extraTimeWinRate = stats.extraTimeMatches > 0 
                ? ((stats.extraTimeWins / stats.extraTimeMatches) * 100).toFixed(1) 
                : '0.0';
            const penaltiesWinRate = stats.penaltiesMatches > 0 
                ? ((stats.penaltiesWins / stats.penaltiesMatches) * 100).toFixed(1) 
                : '0.0';
            
            const color = window.appController && window.appController.settingsManager
                ? window.appController.settingsManager.getPlayerColor(player)
                : null;
            const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';

            return `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background-color: var(--surface-color); border-radius: 8px; border: 1px solid var(--border-color);">
                    <h4 ${playerStyle}>${escapeHtml(player)}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div>
                            <strong style="font-size: 0.9rem; color: var(--text-secondary);">Extra Time</strong>
                            <table class="league-table" style="margin-top: 0.5rem; font-size: 0.9rem;">
                                <tbody>
                                    <tr>
                                        <td>Matches</td>
                                        <td><strong>${stats.extraTimeMatches}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>W-D-L</td>
                                        <td><strong>${stats.extraTimeWins}-${stats.extraTimeDraws}-${stats.extraTimeLosses}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Win Rate</td>
                                        <td><strong>${extraTimeWinRate}%</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <strong style="font-size: 0.9rem; color: var(--text-secondary);">Penalties</strong>
                            <table class="league-table" style="margin-top: 0.5rem; font-size: 0.9rem;">
                                <tbody>
                                    <tr>
                                        <td>Matches</td>
                                        <td><strong>${stats.penaltiesMatches}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>W-L</td>
                                        <td><strong>${stats.penaltiesWins}-${stats.penaltiesLosses}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Win Rate</td>
                                        <td><strong>${penaltiesWinRate}%</strong></td>
                                    </tr>
                                    ${stats.penaltiesMatches > 0 ? `
                                    <tr>
                                        <td>Pens Scored</td>
                                        <td><strong>${stats.penaltiesScored}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Pens Conceded</td>
                                        <td><strong>${stats.penaltiesConceded}</strong></td>
                                    </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Performance Heatmap - Calendar View
StatisticsCalculators.register({
    id: 'performanceHeatmap',
    name: 'Activity Heatmap',
    category: 'visualization',
    subcategory: 'overview',
    calculate: (matches, players) => {
        if (matches.length === 0) return {};

        // Group matches by date
        const dateMap = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        matches.forEach(match => {
            if (!match.timestamp) return;
            const matchDate = new Date(match.timestamp);
            matchDate.setHours(0, 0, 0, 0);
            const dateKey = matchDate.toISOString().split('T')[0];
            
            if (!dateMap[dateKey]) {
                dateMap[dateKey] = 0;
            }
            dateMap[dateKey]++;
        });

        // Get date range (last 365 days or from first match)
        const allDates = Object.keys(dateMap).sort();
        const startDate = allDates.length > 0 
            ? new Date(allDates[0]) 
            : new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        
        const endDate = today;
        const maxMatches = Math.max(...Object.values(dateMap), 1);

        return {
            dateMap,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            maxMatches,
            totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card heatmap-card';
        
        if (!data.dateMap || Object.keys(data.dateMap).length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Activity</h3><p>Play some matches to see your activity heatmap!</p></div>';
            return container;
        }

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const maxMatches = data.maxMatches;

        // Generate calendar grid (weeks x days)
        const weeks = [];
        let currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() - currentDate.getDay()); // Start from Sunday

        while (currentDate <= endDate) {
            const week = [];
            for (let day = 0; day < 7; day++) {
                const dateKey = currentDate.toISOString().split('T')[0];
                const matchCount = data.dateMap[dateKey] || 0;
                const intensity = maxMatches > 0 ? Math.min(1, matchCount / maxMatches) : 0;
                
                week.push({
                    date: new Date(currentDate),
                    dateKey,
                    matchCount,
                    intensity
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeks.push(week);
        }

        // Get month labels
        const monthLabels = [];
        let lastMonth = -1;
        weeks.forEach((week, weekIndex) => {
            const firstDay = week[0].date;
            const month = firstDay.getMonth();
            if (month !== lastMonth) {
                monthLabels.push({ weekIndex, month: firstDay.toLocaleDateString('en-US', { month: 'short' }) });
                lastMonth = month;
            }
        });

        const getIntensityColor = (intensity) => {
            if (intensity === 0) return '#EBEDF0';
            if (intensity < 0.25) return '#C6E48B';
            if (intensity < 0.5) return '#7BC96F';
            if (intensity < 0.75) return '#239A3B';
            return '#196127';
        };

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const html = `
            <div class="heatmap-container">
                <h4>Match Activity Calendar</h4>
                <div class="heatmap-legend">
                    <span>Less</span>
                    <div class="heatmap-legend-colors">
                        <div class="legend-square" style="background-color: #EBEDF0;"></div>
                        <div class="legend-square" style="background-color: #C6E48B;"></div>
                        <div class="legend-square" style="background-color: #7BC96F;"></div>
                        <div class="legend-square" style="background-color: #239A3B;"></div>
                        <div class="legend-square" style="background-color: #196127;"></div>
                    </div>
                    <span>More</span>
                </div>
                <div class="heatmap-grid">
                    <div class="heatmap-day-labels">
                        ${dayNames.map(day => `<div class="day-label">${day}</div>`).join('')}
                    </div>
                    <div class="heatmap-content">
                        <div class="heatmap-months">
                            ${monthLabels.map(m => `<div class="month-label" style="grid-column: ${m.weekIndex + 2};">${m.month}</div>`).join('')}
                        </div>
                        <div class="heatmap-squares">
                            ${weeks.map(week => 
                                week.map(day => {
                                    const color = getIntensityColor(day.intensity);
                                    const tooltip = day.matchCount > 0 
                                        ? `${day.matchCount} match${day.matchCount > 1 ? 'es' : ''} on ${day.date.toLocaleDateString()}`
                                        : `No matches on ${day.date.toLocaleDateString()}`;
                                    return `
                                        <div 
                                            class="heatmap-square ${day.intensity > 0 ? 'has-matches' : ''}" 
                                            style="background-color: ${color};"
                                            title="${tooltip}"
                                            data-date="${day.dateKey}"
                                            data-count="${day.matchCount}"
                                        ></div>
                                    `;
                                }).join('')
                            ).join('')}
                        </div>
                    </div>
                </div>
                <div class="heatmap-summary">
                    <p>Total match days: <strong>${Object.keys(data.dateMap).length}</strong></p>
                    <p>Total matches: <strong>${Object.values(data.dateMap).reduce((a, b) => a + b, 0)}</strong></p>
                </div>
            </div>
        `;

        container.innerHTML = html;
        return container;
    }
});

// ============================================================================
// StatisticsTracker - Core Statistics Framework
// ============================================================================

class StatisticsTracker {
    constructor(storageManager) {
        this.storage = storageManager;
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

        calculators.forEach(calculator => {
            const calculated = calculator.calculate(matches, players);
            stats[calculator.id] = calculated;
        });

        return stats;
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
}

// ============================================================================
// ToastManager - Toast Notifications
// ============================================================================

class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 3000, title = null) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = icons[type] || icons.info;
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Close">×</button>
        `;

        this.container.appendChild(toast);

        // Auto remove after duration
        const autoRemove = setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Manual close
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoRemove);
            this.remove(toast);
        });

        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease-out';
        });

        return toast;
    }

    remove(toast) {
        toast.classList.add('slide-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    success(message, title = null, duration = 3000) {
        return this.show(message, 'success', duration, title);
    }

    error(message, title = null, duration = 4000) {
        return this.show(message, 'error', duration, title);
    }

    warning(message, title = null, duration = 3500) {
        return this.show(message, 'warning', duration, title);
    }

    info(message, title = null, duration = 3000) {
        return this.show(message, 'info', duration, title);
    }

    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

// ============================================================================
// StatisticsDisplay - Render Statistics
// ============================================================================

class StatisticsDisplay {
    constructor(statisticsTracker, settingsManager = null) {
        this.tracker = statisticsTracker;
        this.settingsManager = settingsManager;
    }
    
    // Helper to format player name with color
    formatPlayerNameWithColor(playerName) {
        if (!this.settingsManager) {
            return this.escapeHtml(playerName);
        }
        const color = this.settingsManager.getPlayerColor(playerName);
        const escapedName = this.escapeHtml(playerName);
        if (color) {
            return `<span style="color: ${color}; font-weight: 600;">${escapedName}</span>`;
        }
        return escapedName;
    }
    
    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    displaySeasonStats(seasonNumber, container, category = null, subcategory = null) {
        const stats = this.tracker.getSeasonStats(seasonNumber);
        this.renderStats(stats, container, category, subcategory);
    }

    displayOverallStats(container, category = null, subcategory = null) {
        const stats = this.tracker.getOverallStats();
        this.renderStats(stats, container, category, subcategory);
    }

    displayTodayStats(container, category = null, subcategory = null) {
        const stats = this.tracker.getTodayStats();
        this.renderStats(stats, container, category, subcategory, true);
    }

    renderStats(stats, container, category = null, subcategory = null, isToday = false) {
        container.innerHTML = '';
        
        if (Object.keys(stats).length === 0) {
            const message = isToday 
                ? '<div class="empty-state"><p>No matches played today yet. Start playing to see today\'s statistics!</p></div>'
                : '<div class="empty-state"><p>No statistics available yet. Play some matches first!</p></div>';
            container.innerHTML = message;
            return;
        }

        let calculators;
        if (category && subcategory) {
            calculators = StatisticsCalculators.getBySubcategory(category, subcategory);
        } else if (category) {
            calculators = StatisticsCalculators.getByCategory(category);
        } else {
            calculators = StatisticsCalculators.getAll();
        }
        
        // When showing "All", ensure we show ALL calculators
        const showAll = category === null;
        
        calculators.forEach(calculator => {
            try {
                const data = stats[calculator.id];
                // When showing "All", display all calculators (they handle empty states)
                // When filtering by category, only show calculators with data
                if (showAll) {
                    // Show all calculators when "All" is selected - always display them
                    // Use the data from stats, or empty object if not calculated
                    const displayData = data !== undefined ? data : {};
                    let element;
                    try {
                        element = calculator.display(displayData);
                    } catch (displayError) {
                        console.error(`Display error for calculator ${calculator.id}:`, displayError);
                        element = null;
                    }
                    if (element && element.nodeType) {
                        // Apply player colors to the rendered element
                        this.applyPlayerColorsToElement(element);
                        container.appendChild(element);
                    } else {
                        // If display returned null/undefined/falsy, create a placeholder
                        const placeholderElement = document.createElement('div');
                        placeholderElement.className = 'stat-card';
                        placeholderElement.innerHTML = `<div class="empty-state"><h3>${calculator.name || calculator.id}</h3><p>No data available</p></div>`;
                        container.appendChild(placeholderElement);
                    }
                } else {
                    // For specific categories, only show calculators with data
                    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                        const element = calculator.display(data);
                        if (element && element.nodeType) {
                            // Apply player colors to the rendered element
                            this.applyPlayerColorsToElement(element);
                            container.appendChild(element);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error displaying calculator ${calculator.id}:`, error);
                // Still try to display an error message for the calculator when showing All
                if (showAll) {
                    const errorElement = document.createElement('div');
                    errorElement.className = 'stat-card';
                    errorElement.innerHTML = `<div class="empty-state"><h3>${calculator.name || calculator.id}</h3><p>Error loading: ${error.message}</p></div>`;
                    container.appendChild(errorElement);
                }
            }
        });
    }
    
    // Post-process HTML to apply player colors
    applyPlayerColorsToElement(element) {
        if (!this.settingsManager) return;
        
        const players = this.tracker.getPlayers();
        // Apply colors to all player-name elements
        element.querySelectorAll('.player-name').forEach(el => {
            const text = el.textContent.trim();
            // Remove emoji symbols for matching (🥇🥈🥉)
            const cleanText = text.replace(/[🥇🥈🥉]/g, '').trim();
            
            // Try to match player name (handle cases where name might have emoji prefix)
            players.forEach(player => {
                if (cleanText === player || text === player) {
                    const color = this.settingsManager.getPlayerColor(player);
                    if (color && !el.style.color) {
                        el.style.color = color;
                        el.style.fontWeight = '600';
                    }
                }
            });
        });
    }
}

// ============================================================================
// MatchRecorder - Record Match Results
// ============================================================================

class MatchRecorder {
    constructor(storageManager, seasonManager) {
        this.storage = storageManager;
        this.seasonManager = seasonManager;
    }

    recordMatch(team1, team2, team1Score, team2Score, team1ExtraTimeScore = null, team2ExtraTimeScore = null, team1PenaltiesScore = null, team2PenaltiesScore = null) {
        // Determine result from scores (use penalties if available, otherwise extra time, otherwise full time)
        let finalTeam1Score = team1Score;
        let finalTeam2Score = team2Score;
        
        if (team1PenaltiesScore !== null && team2PenaltiesScore !== null) {
            // Use penalties score for result determination
            finalTeam1Score = team1PenaltiesScore;
            finalTeam2Score = team2PenaltiesScore;
        } else if (team1ExtraTimeScore !== null && team2ExtraTimeScore !== null) {
            // Use extra time score for result determination
            finalTeam1Score = team1ExtraTimeScore;
            finalTeam2Score = team2ExtraTimeScore;
        }
        
        let result;
        if (finalTeam1Score > finalTeam2Score) {
            result = 'team1';
        } else if (finalTeam2Score > finalTeam1Score) {
            result = 'team2';
        } else {
            result = 'draw';
        }

        const match = {
            team1: team1,
            team2: team2,
            team1Score: team1Score,
            team2Score: team2Score,
            result: result, // Automatically determined from scores
            timestamp: new Date().toISOString()
        };

        // Add extra time scores if provided
        if (team1ExtraTimeScore !== null && team2ExtraTimeScore !== null) {
            match.team1ExtraTimeScore = team1ExtraTimeScore;
            match.team2ExtraTimeScore = team2ExtraTimeScore;
        }

        // Add penalties scores if provided
        if (team1PenaltiesScore !== null && team2PenaltiesScore !== null) {
            match.team1PenaltiesScore = team1PenaltiesScore;
            match.team2PenaltiesScore = team2PenaltiesScore;
        }

        const currentSeason = this.seasonManager.getCurrentSeason();
        return this.storage.updateData(data => {
            if (!data.seasons[currentSeason]) {
                data.seasons[currentSeason] = { matches: [], startDate: new Date().toISOString() };
            }
            data.seasons[currentSeason].matches.push(match);
            data.overallStats.totalMatches = (data.overallStats.totalMatches || 0) + 1;
        });
    }

    getCurrentSeasonMatches() {
        const currentSeason = this.seasonManager.getCurrentSeason();
        const data = this.storage.getData();
        const season = data.seasons[currentSeason];
        return season ? season.matches || [] : [];
    }

    // Find match by timestamp and season, return {season, index}
    findMatch(timestamp) {
        const data = this.storage.getData();
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

    // Update a match
    updateMatch(timestamp, newTeam1Score, newTeam2Score, newTeam1ExtraTimeScore = null, newTeam2ExtraTimeScore = null, newTeam1PenaltiesScore = null, newTeam2PenaltiesScore = null) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        // Determine result from scores (use penalties if available, otherwise extra time, otherwise full time)
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

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches[matchInfo.index]) {
                const match = season.matches[matchInfo.index];
                match.team1Score = newTeam1Score;
                match.team2Score = newTeam2Score;
                match.result = newResult;
                
                // Update or remove extra time scores
                if (newTeam1ExtraTimeScore !== null && newTeam2ExtraTimeScore !== null) {
                    match.team1ExtraTimeScore = newTeam1ExtraTimeScore;
                    match.team2ExtraTimeScore = newTeam2ExtraTimeScore;
                } else {
                    delete match.team1ExtraTimeScore;
                    delete match.team2ExtraTimeScore;
                }
                
                // Update or remove penalties scores
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

    // Delete a match
    deleteMatch(timestamp) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches) {
                season.matches.splice(matchInfo.index, 1);
                if (data.overallStats.totalMatches > 0) {
                    data.overallStats.totalMatches--;
                }
            }
        });
    }
}

// ============================================================================
// SeasonManager - Season Management
// ============================================================================

class SeasonManager {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    getCurrentSeason() {
        return this.storage.getData().currentSeason || 1;
    }

    startNewSeason() {
        const currentSeason = this.getCurrentSeason();
        const newSeason = currentSeason + 1;
        
        return this.storage.updateData(data => {
            data.currentSeason = newSeason;
            if (!data.seasons[newSeason]) {
                data.seasons[newSeason] = {
                    matches: [],
                    startDate: new Date().toISOString()
                };
            }
        });
    }

    getSeasonData(seasonNumber) {
        const data = this.storage.getData();
        return data.seasons[seasonNumber] || null;
    }
}

// ============================================================================
// ShareManager - Social Sharing & Export
// ============================================================================

class ShareManager {
    constructor(storageManager, statisticsTracker, seasonManager) {
        this.storage = storageManager;
        this.tracker = statisticsTracker;
        this.seasonManager = seasonManager;
    }

    // Generate shareable image from statistics
    async generateStatsImage(statsType, category = null, subcategory = null) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = 1200;
        canvas.height = 1600;
        
        // Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Header gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#2196F3');
        gradient.addColorStop(1, '#1976D2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 200);
        
        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('FC 25 Score Tracker', canvas.width / 2, 80);
        
        // Stats type subtitle
        ctx.font = '32px Arial';
        const typeLabels = {
            'today': 'Today\'s Statistics',
            'season': `Season ${this.seasonManager.getCurrentSeason()} Statistics`,
            'overall': 'Overall Statistics'
        };
        ctx.fillText(typeLabels[statsType] || 'Statistics', canvas.width / 2, 140);
        
        // Date
        ctx.font = '24px Arial';
        ctx.fillText(new Date().toLocaleDateString(), canvas.width / 2, 180);
        
        // Get statistics
        let stats;
        if (statsType === 'today') {
            stats = this.tracker.getTodayStats();
        } else if (statsType === 'season') {
            stats = this.tracker.getSeasonStats(this.seasonManager.getCurrentSeason());
        } else {
            stats = this.tracker.getOverallStats();
        }
        
        // Draw statistics
        let yPos = 280;
        ctx.fillStyle = '#212121';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'left';
        
        // Get calculators
        let calculators;
        if (category && subcategory) {
            calculators = StatisticsCalculators.getBySubcategory(category, subcategory);
        } else if (category) {
            calculators = StatisticsCalculators.getByCategory(category);
        } else {
            calculators = StatisticsCalculators.getAll();
        }
        
        calculators.forEach(calculator => {
            const data = stats[calculator.id];
            if (data && Object.keys(data).length > 0) {
                // Category title
                ctx.font = 'bold 32px Arial';
                ctx.fillStyle = '#2196F3';
                ctx.fillText(calculator.name, 60, yPos);
                yPos += 50;
                
                // Draw stats based on calculator type
                if (calculator.id === 'league-table') {
                    this.drawLeagueTable(ctx, data, yPos, canvas.width - 120);
                    yPos += (data.length * 60) + 40;
                } else {
                    // Draw individual stats
                    ctx.font = '28px Arial';
                    ctx.fillStyle = '#212121';
                    Object.entries(data).slice(0, 10).forEach(([key, value]) => {
                        if (yPos > canvas.height - 100) return;
                        ctx.fillText(`${key}: ${value}`, 80, yPos);
                        yPos += 45;
                    });
                    yPos += 20;
                }
            }
        });
        
        // Footer
        ctx.fillStyle = '#757575';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Generated by FC 25 Score Tracker', canvas.width / 2, canvas.height - 40);
        
        return canvas.toDataURL('image/png');
    }

    drawLeagueTable(ctx, data, startY, width) {
        const rowHeight = 50;
        const colWidth = width / 6;
        let y = startY;
        
        // Header
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(60, y, width, rowHeight);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        const headers = ['Pos', 'Player', 'W', 'L', 'D', 'Pts'];
        headers.forEach((header, i) => {
            ctx.fillText(header, 60 + (i * colWidth) + (colWidth / 2), y + 35);
        });
        
        y += rowHeight;
        
        // Rows
        ctx.fillStyle = '#212121';
        ctx.font = '22px Arial';
        data.slice(0, 8).forEach((row, index) => {
            if (index === 0) {
                ctx.fillStyle = '#4CAF50';
            } else {
                ctx.fillStyle = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
            }
            ctx.fillRect(60, y, width, rowHeight);
            
            ctx.fillStyle = '#212121';
            ctx.textAlign = 'center';
            ctx.fillText((index + 1).toString(), 60 + (colWidth / 2), y + 35);
            ctx.textAlign = 'left';
            ctx.fillText(row.player || row.name || 'Unknown', 60 + colWidth + 10, y + 35);
            ctx.textAlign = 'center';
            ctx.fillText((row.wins || 0).toString(), 60 + (colWidth * 2) + (colWidth / 2), y + 35);
            ctx.fillText((row.losses || 0).toString(), 60 + (colWidth * 3) + (colWidth / 2), y + 35);
            ctx.fillText((row.draws || 0).toString(), 60 + (colWidth * 4) + (colWidth / 2), y + 35);
            ctx.fillText((row.points || 0).toString(), 60 + (colWidth * 5) + (colWidth / 2), y + 35);
            
            y += rowHeight;
        });
    }

    // Generate shareable image from match result
    async generateMatchImage(match) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 1200;
        canvas.height = 800;
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#2196F3');
        gradient.addColorStop(1, '#1976D2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // White content area
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(50, 50, canvas.width - 100, canvas.height - 100);
        
        // Title
        ctx.fillStyle = '#2196F3';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Match Result', canvas.width / 2, 150);
        
        // Teams
        const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
        const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
        const team1Display = team1Players.join(' & ');
        const team2Display = team2Players.join(' & ');
        
        ctx.fillStyle = '#212121';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(team1Display, canvas.width / 2, 280);
        
        // Score
        ctx.fillStyle = '#2196F3';
        ctx.font = 'bold 72px Arial';
        ctx.fillText(`${match.team1Score || 0} - ${match.team2Score || 0}`, canvas.width / 2, 400);
        
        ctx.fillStyle = '#212121';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(team2Display, canvas.width / 2, 500);
        
        // Date
        const date = new Date(match.timestamp);
        ctx.fillStyle = '#757575';
        ctx.font = '24px Arial';
        ctx.fillText(date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), canvas.width / 2, 600);
        
        // Footer
        ctx.fillStyle = '#757575';
        ctx.font = '20px Arial';
        ctx.fillText('FC 25 Score Tracker', canvas.width / 2, canvas.height - 80);
        
        return canvas.toDataURL('image/png');
    }

    // Export leaderboard as PDF
    async exportLeaderboardPDF(statsType, category = null, subcategory = null) {
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            // Try to load jsPDF from CDN if not already loaded
            try {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            } catch (error) {
                throw new Error('Failed to load PDF library. Please check your internet connection.');
            }
        }
        
        if (typeof window.jspdf === 'undefined') {
            throw new Error('PDF library not available. Please refresh the page and try again.');
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Get statistics
        let stats;
        let title;
        if (statsType === 'today') {
            stats = this.tracker.getTodayStats();
            title = 'Today\'s Statistics';
        } else if (statsType === 'season') {
            stats = this.tracker.getSeasonStats(this.seasonManager.getCurrentSeason());
            title = `Season ${this.seasonManager.getCurrentSeason()} Statistics`;
        } else {
            stats = this.tracker.getOverallStats();
            title = 'Overall Statistics';
        }
        
        // Helper function to draw a table
        const drawTable = (headers, rows, startY, colWidths, headerColor = [33, 150, 243]) => {
            let currentY = startY;
            const pageWidth = 210;
            const margin = 15;
            const tableWidth = pageWidth - (margin * 2);
            
            // Draw header background
            doc.setFillColor(...headerColor);
            doc.rect(margin, currentY - 5, tableWidth, 7, 'F');
            
            // Draw header text
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            let xPos = margin + 2;
            headers.forEach((header, i) => {
                doc.text(header, xPos, currentY);
                xPos += colWidths[i];
            });
            
            currentY += 5;
            
            // Draw rows
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            
            rows.forEach((row, rowIndex) => {
                // Check if we need a new page
                if (currentY > 270) {
                    doc.addPage();
                    currentY = 20;
                    // Redraw header on new page
                    doc.setFillColor(...headerColor);
                    doc.rect(margin, currentY - 5, tableWidth, 7, 'F');
                    doc.setFontSize(9);
                    doc.setTextColor(255, 255, 255);
                    doc.setFont(undefined, 'bold');
                    xPos = margin + 2;
                    headers.forEach((header, i) => {
                        doc.text(header, xPos, currentY);
                        xPos += colWidths[i];
                    });
                    currentY += 5;
                    doc.setFontSize(8);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont(undefined, 'normal');
                }
                
                // Alternate row background
                if (rowIndex % 2 === 0) {
                    doc.setFillColor(245, 245, 245);
                    doc.rect(margin, currentY - 4, tableWidth, 5, 'F');
                }
                
                // Draw row text
                xPos = margin + 2;
                row.forEach((cell, i) => {
                    const cellText = String(cell || '').substring(0, 25); // Limit text length
                    doc.text(cellText, xPos, currentY);
                    xPos += colWidths[i];
                });
                
                currentY += 5;
            });
            
            return currentY + 3;
        };
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(33, 150, 243);
        doc.setFont(undefined, 'bold');
        doc.text('FC 25 Score Tracker', 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(title, 105, 28, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(117, 117, 117);
        doc.setFont(undefined, 'normal');
        doc.text(new Date().toLocaleDateString(), 105, 35, { align: 'center' });
        
        let yPos = 42;
        
        // Get calculators
        let calculators;
        if (category && subcategory) {
            calculators = StatisticsCalculators.getBySubcategory(category, subcategory);
        } else if (category) {
            calculators = StatisticsCalculators.getByCategory(category);
        } else {
            calculators = StatisticsCalculators.getAll();
        }
        
        calculators.forEach(calculator => {
            // Skip visualization calculators (charts) that don't work well in PDF
            if (calculator.id === 'winRateChart' || calculator.id === 'goalsChart') {
                return;
            }
            
            const data = stats[calculator.id];
            if (data && Object.keys(data).length > 0) {
                // Check if we need a new page
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                
                // Category title
                doc.setFontSize(12);
                doc.setTextColor(33, 150, 243);
                doc.setFont(undefined, 'bold');
                doc.text(calculator.name, 15, yPos);
                yPos += 8;
                
                // Sort entries based on calculator type
                let sortedEntries = Object.entries(data);
                if (calculator.id === 'totalGoals') {
                    sortedEntries = sortedEntries.sort((a, b) => (b[1].goals || 0) - (a[1].goals || 0));
                } else if (calculator.id === 'goalDifference') {
                    sortedEntries = sortedEntries.sort((a, b) => (b[1].goalDifference || 0) - (a[1].goalDifference || 0));
                } else if (calculator.id === 'avgGoalsPerGame') {
                    sortedEntries = sortedEntries.sort((a, b) => parseFloat(b[1].avgGoals || 0) - parseFloat(a[1].avgGoals || 0));
                } else if (calculator.id === 'winLossDraw') {
                    sortedEntries = sortedEntries.sort((a, b) => {
                        if (b[1].games !== a[1].games) {
                            return b[1].games - a[1].games;
                        }
                        return b[1].wins - a[1].wins;
                    });
                } else if (calculator.id === 'winRate') {
                    sortedEntries = sortedEntries.sort((a, b) => {
                        const rateA = parseFloat(a[1].winRate || 0);
                        const rateB = parseFloat(b[1].winRate || 0);
                        if (rateB !== rateA) {
                            return rateB - rateA;
                        }
                        return b[1].games - a[1].games;
                    });
                } else if (calculator.id === 'streak') {
                    sortedEntries = sortedEntries.sort((a, b) => (b[1].currentStreak || 0) - (a[1].currentStreak || 0));
                } else if (calculator.id === 'form' || calculator.id === 'leaguePoints') {
                    sortedEntries = sortedEntries.sort((a, b) => {
                        const pointsA = (b[1].wins || 0) * 3 + (b[1].draws || 0);
                        const pointsB = (a[1].wins || 0) * 3 + (a[1].draws || 0);
                        return pointsA - pointsB;
                    });
                }
                
                // Format data into table rows based on calculator type
                let headers = [];
                let rows = [];
                let colWidths = [];
                
                if (calculator.id === 'leaguePoints' || calculator.id === 'league-table') {
                    // League table format
                    headers = ['Pos', 'Player', 'Pts', 'W', 'D', 'L', 'GP'];
                    colWidths = [12, 60, 18, 15, 15, 15, 18];
                    if (Array.isArray(data)) {
                        rows = data.slice(0, 20).map((row, index) => [
                            (index + 1).toString(),
                            (row.player || row.name || 'Unknown').substring(0, 20),
                            (row.points || 0).toString(),
                            (row.wins || 0).toString(),
                            (row.draws || 0).toString(),
                            (row.losses || 0).toString(),
                            (row.games || 0).toString()
                        ]);
                    } else {
                        rows = sortedEntries.slice(0, 20).map(([player, stats], index) => [
                            (index + 1).toString(),
                            player.substring(0, 20),
                            (stats.points || 0).toString(),
                            (stats.wins || 0).toString(),
                            (stats.draws || 0).toString(),
                            (stats.losses || 0).toString(),
                            (stats.games || 0).toString()
                        ]);
                    }
                } else if (calculator.id === 'totalGoals') {
                    headers = ['Pos', 'Player', 'Goals'];
                    colWidths = [12, 120, 30];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => [
                        (index + 1).toString(),
                        player.substring(0, 25),
                        (stats.goals || 0).toString()
                    ]);
                } else if (calculator.id === 'goalDifference') {
                    headers = ['Pos', 'Player', 'GD', 'GF', 'GA'];
                    colWidths = [12, 80, 20, 20, 20];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => [
                        (index + 1).toString(),
                        player.substring(0, 20),
                        (stats.goalDifference || 0).toString(),
                        (stats.goalsFor || 0).toString(),
                        (stats.goalsAgainst || 0).toString()
                    ]);
                } else if (calculator.id === 'avgGoalsPerGame') {
                    headers = ['Pos', 'Player', 'Avg', 'GF', 'GP'];
                    colWidths = [12, 80, 25, 25, 25];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => [
                        (index + 1).toString(),
                        player.substring(0, 20),
                        (stats.avgGoals || 0).toString(),
                        (stats.totalGoals || 0).toString(),
                        (stats.games || 0).toString()
                    ]);
                } else if (calculator.id === 'winLossDraw') {
                    headers = ['Pos', 'Player', 'GP', 'W', 'D', 'L'];
                    colWidths = [12, 80, 20, 20, 20, 20];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => [
                        (index + 1).toString(),
                        player.substring(0, 20),
                        (stats.games || 0).toString(),
                        (stats.wins || 0).toString(),
                        (stats.draws || 0).toString(),
                        (stats.losses || 0).toString()
                    ]);
                } else if (calculator.id === 'winRate') {
                    headers = ['Pos', 'Player', 'Win %', 'GP'];
                    colWidths = [12, 100, 30, 30];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => [
                        (index + 1).toString(),
                        player.substring(0, 25),
                        `${(stats.winRate || 0)}%`,
                        (stats.games || 0).toString()
                    ]);
                } else if (calculator.id === 'streak') {
                    headers = ['Pos', 'Player', 'Streak', 'Type'];
                    colWidths = [12, 100, 25, 35];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => {
                        const streakType = stats.streakType === 'win' ? 'Wins' : stats.streakType === 'loss' ? 'Losses' : 'None';
                        return [
                            (index + 1).toString(),
                            player.substring(0, 25),
                            (stats.currentStreak || 0).toString(),
                            streakType
                        ];
                    });
                } else if (calculator.id === 'form') {
                    headers = ['Pos', 'Player', 'Form', 'W', 'D', 'L', 'Pts'];
                    colWidths = [12, 70, 25, 15, 15, 15, 20];
                    rows = sortedEntries.slice(0, 20).map(([player, stats], index) => {
                        const formStr = (stats.form || []).slice(-5).map(f => f === 'W' ? 'W' : f === 'D' ? 'D' : 'L').join('');
                        const points = (stats.wins || 0) * 3 + (stats.draws || 0);
                        return [
                            (index + 1).toString(),
                            player.substring(0, 18),
                            formStr || 'N/A',
                            (stats.wins || 0).toString(),
                            (stats.draws || 0).toString(),
                            (stats.losses || 0).toString(),
                            points.toString()
                        ];
                    });
                } else if (calculator.id === 'worstLosses') {
                    headers = ['Player', 'Best Win', 'Worst Loss'];
                    colWidths = [50, 65, 65];
                    rows = sortedEntries.slice(0, 15).map(([player, stats]) => {
                        const bestWin = stats.bestByGoalsFor ? stats.bestByGoalsFor.score : '-';
                        const worstLoss = stats.worstByGoalsAgainst ? stats.worstByGoalsAgainst.score : '-';
                        return [
                            player.substring(0, 20),
                            bestWin,
                            worstLoss
                        ];
                    });
                } else if (calculator.id === 'headToHead') {
                    headers = ['Players', 'Together (W-D-L)', 'Against (W-D-L)'];
                    colWidths = [60, 50, 50];
                    rows = sortedEntries.slice(0, 15).map(([pair, stats]) => {
                        const together = stats.together || {};
                        const against = stats.against || {};
                        return [
                            pair.substring(0, 20),
                            `${together.wins || 0}-${together.draws || 0}-${together.losses || 0}`,
                            `${against.wins || 0}-${against.draws || 0}-${against.losses || 0}`
                        ];
                    });
                } else if (calculator.id === 'insights' || calculator.id === 'performanceInsights') {
                    // Skip insights - they're text-based and don't format well in PDF tables
                    return;
                } else if (calculator.id === 'winRateChart' || calculator.id === 'goalsChart') {
                    // Skip chart calculators
                    return;
                } else if (calculator.id === 'trendAnalysis') {
                    // Format trend analysis better
                    headers = ['Player', 'Trend', 'Strength'];
                    colWidths = [80, 60, 40];
                    rows = sortedEntries.slice(0, 20).map(([player, stats]) => {
                        const trend = stats.trend || 'stable';
                        const strength = (stats.trendStrength !== undefined && stats.trendStrength !== null) 
                            ? `${Math.round(stats.trendStrength)}%` 
                            : '-';
                        const trendText = trend === 'improving_strong' ? 'Strong ↑' :
                                        trend === 'improving' ? 'Improving ↑' :
                                        trend === 'declining_strong' ? 'Strong ↓' :
                                        trend === 'declining' ? 'Declining ↓' : 'Stable →';
                        return [
                            player.substring(0, 20),
                            trendText,
                            strength
                        ];
                    });
                } else if (calculator.id === 'comparativeStats') {
                    // Format player comparison
                    headers = ['Players', 'P1 Win %', 'P2 Win %', 'Games'];
                    colWidths = [70, 30, 30, 30];
                    rows = sortedEntries.slice(0, 15).map(([pair, stats]) => {
                        const p1Rate = stats.player1WinRate ? `${stats.player1WinRate.toFixed(1)}%` : '-';
                        const p2Rate = stats.player2WinRate ? `${stats.player2WinRate.toFixed(1)}%` : '-';
                        const games = stats.totalGames || 0;
                        return [
                            pair.substring(0, 20),
                            p1Rate,
                            p2Rate,
                            games.toString()
                        ];
                    });
                } else if (calculator.id === 'activityHeatmap' || calculator.id === 'matchDistribution') {
                    // Skip these - they're visualization/data structures
                    return;
                } else if (calculator.id === 'extraTimePenalties') {
                    // Format extra time and penalties
                    headers = ['Player', 'Matches', 'Extra Time', 'Penalties'];
                    colWidths = [60, 30, 40, 40];
                    rows = sortedEntries.slice(0, 20).map(([player, stats]) => {
                        const matches = stats.totalMatches || 0;
                        const extraTime = stats.extraTimeMatches || 0;
                        const penalties = stats.penaltyMatches || 0;
                        return [
                            player.substring(0, 20),
                            matches.toString(),
                            extraTime.toString(),
                            penalties.toString()
                        ];
                    });
                } else {
                    // Generic table for other stats - format better
                    headers = ['Player', 'Details'];
                    colWidths = [80, 100];
                    rows = sortedEntries.slice(0, 20).map(([player, stats]) => {
                        let value = '';
                        if (typeof stats === 'object') {
                            // Format common stat fields nicely
                            if (stats.goalsFor !== undefined && stats.goalsAgainst !== undefined) {
                                value = `GF: ${stats.goalsFor}, GA: ${stats.goalsAgainst}`;
                            } else if (stats.cumulativeWins !== undefined && stats.cumulativeGames !== undefined) {
                                const winRate = stats.cumulativeGames > 0 
                                    ? ((stats.cumulativeWins / stats.cumulativeGames) * 100).toFixed(1) 
                                    : '0.0';
                                value = `Wins: ${stats.cumulativeWins}, Games: ${stats.cumulativeGames}, Win Rate: ${winRate}%`;
                            } else {
                                // Format other numeric fields
                                const formatted = Object.entries(stats)
                                    .filter(([k, v]) => typeof v === 'number' && !k.includes('Date') && !k.includes('date'))
                                    .slice(0, 3)
                                    .map(([k, v]) => {
                                        const label = k.replace(/([A-Z])/g, ' $1').trim();
                                        return `${label}: ${v}`;
                                    })
                                    .join(', ');
                                value = formatted || 'No data';
                            }
                        } else {
                            value = String(stats);
                        }
                        return [player.substring(0, 25), value.substring(0, 50)];
                    });
                }
                
                if (rows.length > 0) {
                    yPos = drawTable(headers, rows, yPos, colWidths);
                }
            }
        });
        
        // Footer
        const pageCount = doc.internal.pages.length - 1;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(117, 117, 117);
            doc.text('Generated by FC 25 Score Tracker', 105, 285, { align: 'center' });
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }
        
        // Generate PDF blob
        const pdfBlob = doc.output('blob');
        const fileName = `FC25_${statsType}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Try mobile-friendly saving methods
        let saved = false;
        
        // Try Web Share API for mobile devices (if File constructor is supported)
        if (navigator.share && typeof File !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            try {
                // Check if Web Share API supports files
                if (navigator.canShare) {
                    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                    const shareData = { files: [file] };
                    if (navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                        saved = true;
                        return { blob: pdfBlob, blobUrl: URL.createObjectURL(pdfBlob), fileName, saved: true };
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error sharing PDF:', error);
                }
                // Fall through to other methods
            }
        }
        
        // Try File System Access API (mainly for desktop/Chrome)
        if (!saved && 'showSaveFilePicker' in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'PDF files',
                        accept: { 'application/pdf': ['.pdf'] }
                    }]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(pdfBlob);
                await writable.close();
                saved = true;
                return { blob: pdfBlob, blobUrl: URL.createObjectURL(pdfBlob), fileName, saved: true };
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error saving PDF via File System API:', error);
                }
                // Fall through to fallback method
            }
        }
        
        // Fallback: Use traditional download (works on all browsers)
        if (!saved) {
            const blobUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Don't revoke URL immediately - keep it for viewing
            saved = true;
            return { blob: pdfBlob, blobUrl, fileName, saved: true };
        }
        
        return { blob: pdfBlob, blobUrl: URL.createObjectURL(pdfBlob), fileName, saved: false };
    }

    // Share image via Web Share API or download
    async shareImage(imageDataUrl, fileName) {
        try {
            // Convert data URL to blob
            const response = await fetch(imageDataUrl);
            const blob = await response.blob();
            const file = new File([blob], fileName, { type: 'image/png' });
            
            // Try Web Share API
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'FC 25 Statistics',
                    text: 'Check out my FC 25 match statistics!',
                    files: [file]
                });
                return true;
            }
        } catch (error) {
            console.log('Web Share API not available or failed:', error);
        }
        
        // Fallback: download image
        this.downloadImage(imageDataUrl, fileName);
        return false;
    }

    // Download image
    downloadImage(imageDataUrl, fileName) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = imageDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Haptic Feedback Helper
    vibrate(pattern = [50]) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Vibration not supported or failed
            }
        }
    }

    // Load external script
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// ============================================================================
// Main Application Controller
// ============================================================================

class AppController {
    constructor() {
        this.storage = new LocalStorageManager();
        this.settingsManager = new SettingsManager(this.storage);
        this.toastManager = new ToastManager();
        this.playerManager = new PlayerManager(this.storage);
        this.teamGenerator = new TeamGenerator();
        this.seasonManager = new SeasonManager(this.storage);
        this.matchRecorder = new MatchRecorder(this.storage, this.seasonManager);
        this.statisticsTracker = new StatisticsTracker(this.storage);
        this.statisticsDisplay = new StatisticsDisplay(this.statisticsTracker, this.settingsManager);
        this.shareManager = new ShareManager(this.storage, this.statisticsTracker, this.seasonManager);
        
        this.currentScreen = 'playerScreen';
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.selectedAllStructures = false;
        this.currentGameIndex = 0;
        this.currentStatsState = {};
        this.editingMatchTimestamp = null;
        this.playerEditorValues = [];
        this.hasUnsavedPlayerChanges = false;
        this.currentHistoryView = 'list'; // 'list' or 'timeline'
        this.lastPDFBlobUrl = null; // Store last exported PDF for viewing
        
        // Initialize lock labels before anything else that might use them
        this.updateLockLabels();
        
        this.initializeEventListeners();
        this.initializeApp();
    }
    
    updateLockLabels() {
        // Update lock labels from settings
        this.lockLabels = {
            home: this.settingsManager.getLabel('home'),
            away: this.settingsManager.getLabel('away'),
            neutral: this.settingsManager.getLabel('neutral')
        };
    }

    initializeApp() {
        // Load existing players
        const players = this.playerManager.getPlayers();
        this.loadPlayersIntoUI(players);
        this.showScreen(players.length >= 2 ? 'teamScreen' : 'playerScreen');
        
        this.updateSeasonInfo();
        this.updatePlayerNameHistory(); // Add this line
        this.renderPlayerLockOptions();
    }

    initializeEventListeners() {
        // Player screen
        const saveBtn = document.getElementById('savePlayersBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                console.log('Save button clicked'); // Debug log
                this.savePlayers();
            });
        } else {
            console.error('savePlayersBtn not found!');
        }
        document.getElementById('startNewSessionBtn').addEventListener('click', () => this.startNewSession());
        const addPlayerBtn = document.getElementById('addPlayerBtn');
        if (addPlayerBtn) {
            addPlayerBtn.addEventListener('click', () => this.addPlayerRow());
        }

        const editableList = document.getElementById('playerEditableList');
        if (editableList) {
            editableList.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-player-btn');
                if (deleteBtn) {
                    const index = parseInt(deleteBtn.dataset.index);
                    this.removePlayerRow(index);
                }
            });

            editableList.addEventListener('input', (e) => {
                const input = e.target.closest('.player-name-input');
                if (input) {
                    const index = parseInt(input.dataset.index);
                    const value = input.value;
                    this.updatePlayerRow(index, value);
                }
            });

            editableList.addEventListener('change', (e) => {
                const select = e.target.closest('.lock-select');
                if (select) {
                    const index = parseInt(select.dataset.index);
                    const side = select.value;
                    if (!isNaN(index) && side) {
                        this.handleInlineLockToggle(index, side);
                    }
                }
            });
        }

        const playerLockList = document.getElementById('playerLockList');
        if (playerLockList) {
            playerLockList.addEventListener('click', (event) => {
                const button = event.target.closest('.lock-btn');
                if (!button || button.disabled) {
                    return;
                }
                const player = button.dataset.player;
                const side = button.dataset.side;
                if (player && side) {
                    this.handleLockSelection(player, side);
                }
            });
        }

        // Team screen
        document.getElementById('confirmSequenceBtn').addEventListener('click', () => this.confirmSequence());
        document.getElementById('selectAllCombinationsBtn').addEventListener('click', () => this.selectAllStructures());
        document.getElementById('backToPlayersBtn').addEventListener('click', () => this.showScreen('playerScreen'));

        // Sequence screen
        document.getElementById('startGamesBtn').addEventListener('click', () => this.startGames());
        document.getElementById('backToTeamsBtn').addEventListener('click', () => this.showScreen('teamScreen'));

        // Match screen
        document.getElementById('submitScoreBtn').addEventListener('click', () => this.recordScore());
        document.getElementById('backToSequenceBtn').addEventListener('click', () => this.showScreen('sequenceScreen'));
        
        // Extra time and penalties checkboxes
        const extraTimeCheckbox = document.getElementById('wentToExtraTime');
        const penaltiesCheckbox = document.getElementById('wentToPenalties');
        if (extraTimeCheckbox) {
            extraTimeCheckbox.addEventListener('change', (e) => {
                const extraTimeScores = document.getElementById('extraTimeScores');
                if (extraTimeScores) {
                    extraTimeScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        if (penaltiesCheckbox) {
            penaltiesCheckbox.addEventListener('change', (e) => {
                const penaltiesScores = document.getElementById('penaltiesScores');
                if (penaltiesScores) {
                    penaltiesScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }

        // Stats screen
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchStatsTab(e.target.dataset.tab));
        });
        document.getElementById('newSeasonBtn').addEventListener('click', () => this.startNewSeason());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataBtn').addEventListener('click', () => this.importData());
        document.getElementById('clearOverallStatsBtn').addEventListener('click', () => this.clearAllStatistics());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.showScreen('playerScreen'));
        
        // Share buttons
        document.getElementById('shareTodayStatsBtn').addEventListener('click', () => this.shareStats('today'));
        document.getElementById('shareSeasonStatsBtn').addEventListener('click', () => this.shareStats('season'));
        document.getElementById('shareOverallStatsBtn').addEventListener('click', () => this.shareStats('overall'));
        document.getElementById('exportTodayPDFBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('exportSeasonPDFBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('exportOverallPDFBtn').addEventListener('click', () => this.exportPDF());
        const viewPdfBtn = document.getElementById('viewLastPDFBtn');
        if (viewPdfBtn) {
            viewPdfBtn.addEventListener('click', () => this.viewLastPDF());
        }

        // History screen
        document.getElementById('backFromHistoryBtn').addEventListener('click', () => this.showScreen('statsScreen'));
        document.getElementById('historyFilter').addEventListener('change', () => this.loadMatchHistory());
        document.getElementById('historySearch').addEventListener('input', () => this.loadMatchHistory());
        document.getElementById('historyDateFrom').addEventListener('change', () => this.loadMatchHistory());
        document.getElementById('historyDateTo').addEventListener('change', () => this.loadMatchHistory());
        document.getElementById('clearHistoryFiltersBtn').addEventListener('click', () => this.clearHistoryFilters());
        document.getElementById('historyListViewBtn').addEventListener('click', () => this.switchHistoryView('list'));
        document.getElementById('historyTimelineViewBtn').addEventListener('click', () => this.switchHistoryView('timeline'));

        // Settings screen
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSettingsTab(e.target.dataset.settingsTab));
        });
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('backFromSettingsBtn').addEventListener('click', () => this.showScreen('playerScreen'));
        document.getElementById('resetLabelsBtn').addEventListener('click', () => this.resetLabels());
        document.getElementById('exportDataSettingsBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataSettingsBtn').addEventListener('click', () => this.importData());
        document.getElementById('clearAllDataBtn').addEventListener('click', () => this.confirmClearAllData());
        const darkModeSetting = document.getElementById('darkModeSetting');
        if (darkModeSetting) {
            darkModeSetting.addEventListener('change', (e) => {
                this.settingsManager.setDarkMode(e.target.checked);
                this.toggleDarkMode();
            });
        }

        // Edit match modal
        document.getElementById('saveEditMatchBtn').addEventListener('click', () => this.saveEditMatch());
        document.getElementById('cancelEditMatchBtn').addEventListener('click', () => this.closeEditModal());
        document.getElementById('deleteMatchBtn').addEventListener('click', () => this.confirmDeleteMatch());
        
        // Edit modal extra time and penalties checkboxes
        const editExtraTimeCheckbox = document.getElementById('editWentToExtraTime');
        const editPenaltiesCheckbox = document.getElementById('editWentToPenalties');
        if (editExtraTimeCheckbox) {
            editExtraTimeCheckbox.addEventListener('change', (e) => {
                const editExtraTimeScores = document.getElementById('editExtraTimeScores');
                if (editExtraTimeScores) {
                    editExtraTimeScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        if (editPenaltiesCheckbox) {
            editPenaltiesCheckbox.addEventListener('change', (e) => {
                const editPenaltiesScores = document.getElementById('editPenaltiesScores');
                if (editPenaltiesScores) {
                    editPenaltiesScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        document.getElementById('importFileInput').addEventListener('change', (e) => this.handleFileImport(e));

        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
            this.initializeDarkMode();
        }
        
        // Refresh/Update button
        const refreshAppBtn = document.getElementById('refreshAppBtn');
        if (refreshAppBtn) {
            refreshAppBtn.addEventListener('click', () => this.checkForUpdates());
        }

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const screen = e.target.closest('.nav-btn').dataset.screen;
                this.showScreen(screen);
            });
        });
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;

            // Update navigation
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.screen === screenId);
            });

            // Load screen-specific data
            if (screenId === 'teamScreen') {
                this.loadTeamCombinations();
            } else if (screenId === 'sequenceScreen') {
                this.loadSequenceList();
            } else if (screenId === 'statsScreen') {
                this.loadStatistics();
                this.updateViewPDFButton();
            } else if (screenId === 'playerScreen') {
                // Reload players to ensure UI is in sync
                const players = this.playerManager.getPlayers();
                this.loadPlayersIntoUI(players);
                this.updatePlayerNameHistory();
            } else if (screenId === 'historyScreen') {
                // Initialize view toggle state
                const listBtn = document.getElementById('historyListViewBtn');
                const timelineBtn = document.getElementById('historyTimelineViewBtn');
                if (listBtn && timelineBtn) {
                    listBtn.classList.toggle('active', this.currentHistoryView === 'list');
                    timelineBtn.classList.toggle('active', this.currentHistoryView === 'timeline');
                    document.getElementById('matchHistoryList').style.display = this.currentHistoryView === 'list' ? 'flex' : 'none';
                    document.getElementById('matchHistoryTimeline').style.display = this.currentHistoryView === 'timeline' ? 'block' : 'none';
                }
                this.loadMatchHistory();
            } else if (screenId === 'settingsScreen') {
                this.loadSettingsScreen();
            }
        }
    }

    // Player Management
    loadPlayersIntoUI(players) {
        this.playerEditorValues = Array.isArray(players) ? [...players] : [];
        if (this.playerEditorValues.length === 0) {
            this.playerEditorValues = ['', ''];
        } else if (this.playerEditorValues.length === 1) {
            this.playerEditorValues.push('');
        }
        this.renderEditablePlayerList();
        this.updateCurrentPlayersDisplay();
    }

    // Helper function to format player name with color
    formatPlayerNameWithColor(playerName) {
        const color = this.settingsManager.getPlayerColor(playerName);
        const escapedName = this.escapeHtml(playerName);
        if (color) {
            return `<span class="player-name" style="color: ${color}; font-weight: 600;">${escapedName}</span>`;
        }
        return `<span class="player-name">${escapedName}</span>`;
    }

    // Helper function to format team with player colors
    formatTeamWithColors(team) {
        if (Array.isArray(team)) {
            return team.map(p => this.formatPlayerNameWithColor(p)).join(' & ');
        }
        return this.formatPlayerNameWithColor(team);
    }

    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getEditorPlayersTrimmed() {
        return this.playerEditorValues
            .map(name => (typeof name === 'string' ? name.trim() : ''))
            .filter(name => name.length > 0);
    }

    renderEditablePlayerList() {
        const list = document.getElementById('playerEditableList');
        if (!list) return;

        const globalPlayers = this.playerManager.getPlayers();
        const editorTrimmed = this.getEditorPlayersTrimmed();
        const unsaved = editorTrimmed.length !== globalPlayers.length ||
            editorTrimmed.some((name, index) => name !== globalPlayers[index]);
        const lockState = this.playerManager.getPlayerLock();
        const lockActive = lockState && lockState.player && lockState.side && lockState.side !== 'neutral';

        list.innerHTML = this.playerEditorValues.map((player, index) => {
            const value = typeof player === 'string' ? player : '';
            const isFilled = value.trim().length > 0;
            const trimmed = value.trim();
            const isSavedPlayer = isFilled && globalPlayers.includes(trimmed);
            const isLockedPlayer = isSavedPlayer && lockActive && lockState.player === trimmed;
            const labels = this.lockLabels || {
                home: 'Home',
                away: 'Away',
                neutral: 'Neutral'
            };
            const canSelect = isSavedPlayer && !unsaved;
            let selectedValue = 'neutral';
            if (isLockedPlayer) {
                selectedValue = lockState.side;
            } else if (lockActive) {
                selectedValue = 'neutral';
            }

            return `
            <li class="player-editable-item${isFilled ? ' active' : ''}" data-index="${index}">
                <div class="drag-handle" draggable="true" data-index="${index}">☰</div>
                <input
                    type="text"
                    class="player-name-input"
                    data-index="${index}"
                    value="${this.escapeHtml(value)}"
                    placeholder="Player ${index + 1}"
                    maxlength="20"
                />
                <select class="lock-select" data-index="${index}" ${!canSelect ? 'disabled' : ''}>
                    <option value="home" ${selectedValue === 'home' ? 'selected' : ''}>${this.escapeHtml(labels.home)}</option>
                    <option value="neutral" ${selectedValue === 'neutral' ? 'selected' : ''}>${this.escapeHtml(labels.neutral)}</option>
                    <option value="away" ${selectedValue === 'away' ? 'selected' : ''}>${this.escapeHtml(labels.away)}</option>
                </select>
                <div class="player-actions">
                    <button class="delete-player-btn" data-index="${index}" title="Remove player">×</button>
                </div>
            </li>
        `;
        }).join('');

        const addButton = document.getElementById('addPlayerBtn');
        if (addButton) {
            const count = this.playerEditorValues.length;
            addButton.disabled = count >= 4;
            addButton.textContent = count < 4 ? 'Add Player' : 'Max Players';
            addButton.title = count < 4 ? 'Add another player slot' : 'Maximum of 4 players supported';
        }

        this.initializeDragAndDrop();
        this.updatePlayerNameHistory();
        this.renderPlayerLockOptions();
    }

    initializeDragAndDrop() {
        const list = document.getElementById('playerEditableList');
        if (!list) return;

        let draggedIndex = null;

        list.querySelectorAll('.drag-handle').forEach(handle => {
            handle.addEventListener('dragstart', (e) => {
                draggedIndex = parseInt(e.target.dataset.index);
                e.dataTransfer.effectAllowed = 'move';
            });
        });

        list.querySelectorAll('.player-editable-item').forEach(item => {
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIndex = parseInt(item.dataset.index);
                if (draggedIndex === null || isNaN(targetIndex) || targetIndex === draggedIndex) {
                    return;
                }
                this.reorderPlayers(draggedIndex, targetIndex);
                draggedIndex = null;
            });
        });
    }

    reorderPlayers(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.playerEditorValues.length || toIndex < 0 || toIndex >= this.playerEditorValues.length) {
            return;
        }
        const updated = [...this.playerEditorValues];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        this.playerEditorValues = updated;
        this.renderEditablePlayerList();
    }

    addPlayerRow() {
        if (this.playerEditorValues.length >= 4) {
            alert('Maximum 4 players allowed');
            return;
        }
        this.playerEditorValues.push('');
        this.renderEditablePlayerList();
    }

    removePlayerRow(index) {
        if (index < 0 || index >= this.playerEditorValues.length) return;
        this.playerEditorValues.splice(index, 1);
        if (this.playerEditorValues.length === 0) {
            this.playerEditorValues = ['', ''];
        } else if (this.playerEditorValues.length === 1) {
            this.playerEditorValues.push('');
        }
        this.renderEditablePlayerList();
    }

    updatePlayerRow(index, value) {
        if (index < 0 || index >= this.playerEditorValues.length) return;
        this.playerEditorValues[index] = value;
        const listItems = document.querySelectorAll('.player-editable-item');
        if (listItems[index]) {
            listItems[index].classList.toggle('active', value.trim().length > 0);
        }
        this.updatePlayerNameHistory();
        this.renderPlayerLockOptions();
    }

    updateCurrentPlayersDisplay() {
        const players = this.playerManager.getPlayers();
        const container = document.getElementById('currentPlayers');
        const list = document.getElementById('playersList');
        
        if (players.length > 0) {
            container.style.display = 'block';
            list.innerHTML = players.map(p => `<li>${p}</li>`).join('');
            document.getElementById('startNewSessionBtn').style.display = 'block';
        } else {
            container.style.display = 'none';
            document.getElementById('startNewSessionBtn').style.display = 'none';
        }
        this.renderPlayerLockOptions();
    }

    renderPlayerLockOptions() {
        const container = document.getElementById('playerLockContainer');
        const list = document.getElementById('playerLockList');
        const hint = document.getElementById('playerLockHint');
        const unsavedHint = document.getElementById('playerLockUnsavedHint');

        if (!container || !list) {
            this.hasUnsavedPlayerChanges = false;
            return;
        }

        const players = this.playerManager.getPlayers();
        const editorPlayers = this.getEditorPlayersTrimmed();
        const unsavedChanges = editorPlayers.length !== players.length ||
            editorPlayers.some((name, index) => name !== players[index]);
        this.hasUnsavedPlayerChanges = unsavedChanges;

        const editableList = document.getElementById('playerEditableList');
        if (editableList) {
            editableList.classList.toggle('unsaved', unsavedChanges);
        }

        if (!players || players.length < 2) {
            container.style.display = 'none';
            list.innerHTML = '';
            if (hint) {
                hint.style.display = 'none';
            }
            if (unsavedHint) {
                unsavedHint.style.display = 'none';
            }
            return;
        }

        container.style.display = 'block';
        container.classList.toggle('unsaved', unsavedChanges);
        const lockState = this.playerManager.getPlayerLock();
        const lockActive = lockState.player && lockState.side && lockState.side !== 'neutral';

        list.innerHTML = players.map(player => {
            const isLockedPlayer = lockActive && lockState.player === player;
            const homeActive = isLockedPlayer && lockState.side === 'home';
            const awayActive = isLockedPlayer && lockState.side === 'away';
            const homeDisabled = unsavedChanges || (lockActive && !isLockedPlayer);
            const awayDisabled = unsavedChanges || (lockActive && !isLockedPlayer);
            const neutralDisabled = unsavedChanges || (!isLockedPlayer && lockActive);
            const homeClass = `lock-btn home${homeActive ? ' active' : ''}`;
            const awayClass = `lock-btn away${awayActive ? ' active' : ''}`;
            const neutralClass = 'lock-btn neutral';

            return `
                <div class="player-lock-row${isLockedPlayer ? ' locked' : ''}">
                    <span class="player-lock-name">${this.escapeHtml(player)}</span>
                    <div class="player-lock-options">
                        <button class="${homeClass}" data-player="${this.escapeHtml(player)}" data-side="home" ${homeDisabled ? 'disabled' : ''}>${this.escapeHtml(this.lockLabels.home)}</button>
                        <button class="${awayClass}" data-player="${this.escapeHtml(player)}" data-side="away" ${awayDisabled ? 'disabled' : ''}>${this.escapeHtml(this.lockLabels.away)}</button>
                        <button class="${neutralClass}" data-player="${this.escapeHtml(player)}" data-side="neutral" ${neutralDisabled ? 'disabled' : ''}>${this.escapeHtml(this.lockLabels.neutral)}</button>
                    </div>
                </div>
            `;
        }).join('');

        if (hint) {
            hint.style.display = lockActive ? 'block' : 'none';
        }
        if (unsavedHint) {
            unsavedHint.style.display = unsavedChanges ? 'block' : 'none';
        }
    }

    handleLockSelection(player, side) {
        if (!player || !side) {
            return;
        }

        let success = true;
        if (side === 'neutral') {
            success = this.playerManager.clearPlayerLock();
        } else {
            success = this.playerManager.setPlayerLock(player, side);
        }

        if (success === false) {
            return;
        }

        this.resetSelectedStructure();
        this.renderPlayerLockOptions();

        if (this.currentScreen === 'teamScreen') {
            this.loadTeamCombinations();
        } else if (this.currentScreen === 'sequenceScreen' || this.currentScreen === 'matchScreen') {
            this.showScreen('teamScreen');
        }

        this.renderEditablePlayerList();
    }

    handleInlineLockToggle(index, side) {
        if (typeof index !== 'number' || isNaN(index) || !side) {
            return;
        }

        if (this.hasUnsavedPlayerChanges) {
            this.toastManager.warning('Please save players before changing home/away settings.');
            return;
        }

        const value = this.playerEditorValues[index];
        const trimmed = value ? value.trim() : '';
        if (!trimmed) {
            return;
        }

        const players = this.playerManager.getPlayers();
        if (!Array.isArray(players) || !players.includes(trimmed)) {
            this.toastManager.warning('Save players before changing home/away settings.');
            return;
        }

        this.handleLockSelection(trimmed, side);
    }

    resetSelectedStructure() {
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.selectedAllStructures = false;
        this.currentGameIndex = 0;
        this.currentMatch = null;

        const confirmBtn = document.getElementById('confirmSequenceBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    }

    savePlayers() {
        console.log('savePlayers called'); // Debug log
        
        const rawPlayers = this.playerEditorValues
            .map(name => (typeof name === 'string' ? name.trim() : ''))
            .filter(name => name.length > 0);

        const players = rawPlayers.filter((name, index) => rawPlayers.indexOf(name) === index);

        if (players.length !== rawPlayers.length) {
            this.toastManager.error('Duplicate player names detected. Please ensure each player has a unique name.', 'Validation Error');
            return;
        }

        console.log('Players extracted:', players); // Debug log

        if (players.length < 2) {
            this.toastManager.warning('Please enter at least 2 players', 'Player Requirement');
            return;
        }

        try {
            // Add each player to history
            players.forEach(player => {
                this.playerManager.addToHistory(player);
            });
            
            if (this.playerManager.setPlayers(players)) {
                console.log('Players saved successfully');
                this.playerEditorValues = [...players];
                if (this.playerEditorValues.length === 1) {
                    this.playerEditorValues.push('');
                } else if (this.playerEditorValues.length === 0) {
                    this.playerEditorValues = ['', ''];
                }
                this.renderEditablePlayerList();
                this.updateCurrentPlayersDisplay();
                this.updatePlayerNameHistory(); // Update the history display
                this.resetSelectedStructure();
                this.showScreen('teamScreen');
                this.toastManager.success('Players saved successfully!');
            } else {
                console.error('Failed to save players');
                this.toastManager.error('Error saving players');
            }
        } catch (error) {
            console.error('Error in savePlayers:', error);
            this.toastManager.error('Error saving players: ' + error.message);
        }
    }

    startNewSession() {
        this.resetSelectedStructure();
        this.showScreen('teamScreen');
    }

    // Round Structures
    loadTeamCombinations() {
        const players = this.playerManager.getPlayers();
        if (players.length < 2) {
            this.showScreen('playerScreen');
            return;
        }

        const lockState = this.playerManager.getPlayerLock();
        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        const container = document.getElementById('teamCombinations');
        
        if (!container) {
            console.error('teamCombinations container not found');
            return;
        }
        
        if (structures.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Need at least 2 players to generate round structures.</p></div>';
            return;
        }

        container.innerHTML = structures.map((structure, structureIndex) => {
            const isSelected = this.selectedStructureIndex === structureIndex || this.selectedAllStructures;
            
            const matchesHTML = structure.matches.map((match, matchIndex) => {
                const team1Name = this.teamGenerator.formatTeamName(match.team1);
                const team2Name = this.teamGenerator.formatTeamName(match.team2);
                return `
                    <div class="structure-match">
                        <div class="match-round-label">Round ${matchIndex + 1}</div>
                        <div class="team-display">
                            <div class="team-players">
                                ${match.team1.map(p => this.formatPlayerNameWithColor(p)).join('')}
                            </div>
                            <span class="vs">VS</span>
                            <div class="team-players">
                                ${match.team2.map(p => this.formatPlayerNameWithColor(p)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            const showSelectButton = this.selectedStructureIndex === structureIndex && !this.selectedAllStructures;
            const allSelectedIndicator = this.selectedAllStructures ? '<span class="all-selected-indicator">✓ All Selected</span>' : '';
            
            return `
                <div class="round-structure-card ${isSelected ? 'selected' : ''}" data-index="${structureIndex}">
                    <div class="structure-header">
                        <h3>Round Structure ${structureIndex + 1} ${allSelectedIndicator}</h3>
                        ${showSelectButton ? `<button class="select-structure-btn" data-index="${structureIndex}">Select</button>` : ''}
                    </div>
                    <div class="structure-matches">
                        ${matchesHTML}
                    </div>
                </div>
            `;
        }).join('');

        // Use event delegation on the container for more reliable event handling
        // Remove any existing listeners first to avoid duplicates
        const existingClickHandler = container._clickHandler;
        const existingTouchHandler = container._touchHandler;
        if (existingClickHandler) {
            container.removeEventListener('click', existingClickHandler);
        }
        if (existingTouchHandler) {
            container.removeEventListener('touchend', existingTouchHandler);
        }

        // Create click handler
        const clickHandler = (e) => {
            // Check if click is on a round structure card
            const card = e.target.closest('.round-structure-card');
            if (!card) {
                return;
            }

            // Check if click is on the select button
            if (e.target.closest('.select-structure-btn')) {
                e.stopPropagation();
                console.log('Select button clicked');
                this.confirmSequence();
                return;
            }

            // Otherwise, select the structure
            const index = parseInt(card.dataset.index);
            if (!isNaN(index)) {
                console.log('Round structure card clicked, index:', index);
                this.selectStructure(index);
            }
        };

        // Create touch handler for mobile
        const touchHandler = (e) => {
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const card = target ? target.closest('.round-structure-card') : null;
            
            if (!card) {
                return;
            }

            // Check if touch is on the select button
            if (target && target.closest('.select-structure-btn')) {
                e.stopPropagation();
                console.log('Select button touched');
                this.confirmSequence();
                return;
            }

            // Otherwise, select the structure
            const index = parseInt(card.dataset.index);
            if (!isNaN(index)) {
                console.log('Round structure card touched, index:', index);
                this.selectStructure(index);
            }
        };

        // Store handler references and attach
        container._clickHandler = clickHandler;
        container._touchHandler = touchHandler;
        
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            container.addEventListener('click', clickHandler, { passive: false });
            container.addEventListener('touchend', touchHandler, { passive: false });
            console.log('Event listeners attached to teamCombinations container');
            console.log('Number of cards:', container.querySelectorAll('.round-structure-card').length);
        });

        const description = document.getElementById('teamScreenDescription');
        const playerCount = players.length;
        if (playerCount === 4) {
            description.textContent = 'Select a round structure to play. Each structure contains 3 matches (2v2) where each player pairs with every other player once.';
        } else if (playerCount === 3) {
            description.textContent = 'Select a round structure to play. Each structure contains 3 matches (2v1) ensuring all pairings.';
        } else {
            description.textContent = 'Ready to play 1v1!';
        }

        // Show "Select All" button and update its state
        const selectAllBtn = document.getElementById('selectAllCombinationsBtn');
        selectAllBtn.style.display = 'block';
        if (this.selectedAllStructures) {
            selectAllBtn.textContent = 'All Selected ✓';
            selectAllBtn.classList.add('btn-success');
            selectAllBtn.classList.remove('btn-secondary');
        } else {
            selectAllBtn.textContent = 'Select All';
            selectAllBtn.classList.remove('btn-success');
            selectAllBtn.classList.add('btn-secondary');
        }
        document.getElementById('confirmSequenceBtn').disabled = this.selectedStructureIndex === null && !this.selectedAllStructures;
    }

    selectStructure(structureIndex) {
        console.log('selectStructure called with index:', structureIndex);

        const players = this.playerManager.getPlayers();
        console.log('Players:', players);

        const lockState = this.playerManager.getPlayerLock();
        console.log('Lock state:', lockState);

        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        console.log('Generated structures:', structures.length);

        if (structureIndex >= 0 && structureIndex < structures.length) {
            console.log('Setting selected structure:', structureIndex);
            this.selectedStructureIndex = structureIndex;
            this.selectedStructure = structures[structureIndex];
            this.selectedAllStructures = false; // Clear "select all" when selecting individual structure
            this.loadTeamCombinations();
            document.getElementById('confirmSequenceBtn').disabled = false;
            console.log('Structure selected successfully');
        } else {
            console.log('Invalid structure index:', structureIndex, 'max:', structures.length - 1);
        }
    }

    selectAllStructures() {
        console.log('selectAllStructures called');
        const players = this.playerManager.getPlayers();
        const lockState = this.playerManager.getPlayerLock();
        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        
        if (structures.length === 0) {
            this.toastManager.warning('No round structures available', 'Selection Error');
            return;
        }

        // Combine all matches from all structures into one sequence
        const allMatches = [];
        structures.forEach((structure, index) => {
            structure.matches.forEach((match, matchIndex) => {
                allMatches.push({
                    ...match,
                    structureIndex: index,
                    matchIndex: matchIndex
                });
            });
        });

        // Create a combined structure
        this.selectedStructure = {
            matches: allMatches
        };
        this.selectedStructureIndex = null; // Clear individual selection
        this.selectedAllStructures = true;
        
        this.loadTeamCombinations();
        document.getElementById('confirmSequenceBtn').disabled = false;
        this.toastManager.success(`Selected all ${allMatches.length} matches from ${structures.length} structures`, 'All Selected');
        console.log('All structures selected, total matches:', allMatches.length);
    }

    confirmSequence() {
        console.log('confirmSequence called');
        console.log('selectedStructureIndex:', this.selectedStructureIndex);
        console.log('selectedStructure:', this.selectedStructure);
        console.log('selectedAllStructures:', this.selectedAllStructures);

        if ((this.selectedStructureIndex === null && !this.selectedAllStructures) || !this.selectedStructure) {
            console.log('No structure selected, showing warning');
            this.toastManager.warning('Please select a round structure or click "Select All"', 'Selection Required');
            return;
        }

        console.log('Structure confirmed, switching to sequence screen');
        // Haptic feedback
        this.vibrate([30, 50, 30]);
        this.showScreen('sequenceScreen');
    }

    // Game Sequence
    loadSequenceList() {
        if (!this.selectedStructure) {
            this.showScreen('teamScreen');
            return;
        }
        
        const container = document.getElementById('sequenceList');
        
        container.innerHTML = this.selectedStructure.matches.map((match, index) => {
            const team1Display = this.formatTeamWithColors(match.team1);
            const team2Display = this.formatTeamWithColors(match.team2);
            return `
                <div class="sequence-item">
                    <div class="sequence-number">Round ${index + 1}</div>
                    <div class="team-display">
                        <div class="team-players">
                            ${team1Display}
                        </div>
                        <span class="vs">VS</span>
                        <div class="team-players">
                            ${team2Display}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    startGames() {
        if (!this.selectedStructure) {
            this.showScreen('teamScreen');
            return;
        }
        this.currentGameIndex = 0;
        this.showCurrentMatch();
    }

    showCurrentMatch() {
        if (!this.selectedStructure || !this.selectedStructure.matches[this.currentGameIndex]) {
            this.showScreen('sequenceScreen');
            return;
        }
        
        const match = this.selectedStructure.matches[this.currentGameIndex];
        
        document.getElementById('currentGameNumber').textContent = this.currentGameIndex + 1;
        document.getElementById('totalGames').textContent = this.selectedStructure.matches.length;
        
        const team1Name = this.teamGenerator.formatTeamName(match.team1);
        const team2Name = this.teamGenerator.formatTeamName(match.team2);

        const team1Display = this.formatTeamWithColors(match.team1);
        const team2Display = this.formatTeamWithColors(match.team2);
        document.getElementById('team1Display').innerHTML = team1Display;
        document.getElementById('team2Display').innerHTML = team2Display;
        document.getElementById('team1ScoreLabel').textContent = `${team1Name} Score (Full Time)`;
        document.getElementById('team2ScoreLabel').textContent = `${team2Name} Score (Full Time)`;
        
        // Reset score inputs
        document.getElementById('team1Score').value = 0;
        document.getElementById('team2Score').value = 0;
        
        // Reset extra time and penalties
        const extraTimeCheckbox = document.getElementById('wentToExtraTime');
        const penaltiesCheckbox = document.getElementById('wentToPenalties');
        if (extraTimeCheckbox) {
            extraTimeCheckbox.checked = false;
            document.getElementById('extraTimeScores').style.display = 'none';
            document.getElementById('team1ExtraTimeScore').value = 0;
            document.getElementById('team2ExtraTimeScore').value = 0;
            
            // Add event listener to auto-fill extra time with full time scores when checkbox is checked
            // Remove old listener if exists and add new one
            const newExtraTimeHandler = () => {
                if (extraTimeCheckbox.checked) {
                    // Auto-fill with current full time scores as starting point
                    const currentTeam1Score = parseInt(document.getElementById('team1Score').value) || 0;
                    const currentTeam2Score = parseInt(document.getElementById('team2Score').value) || 0;
                    document.getElementById('team1ExtraTimeScore').value = currentTeam1Score;
                    document.getElementById('team2ExtraTimeScore').value = currentTeam2Score;
                }
            };
            
            // Remove old listener if exists
            extraTimeCheckbox.removeEventListener('change', this._extraTimeAutoFillHandler);
            // Store reference and add new listener
            this._extraTimeAutoFillHandler = newExtraTimeHandler;
            extraTimeCheckbox.addEventListener('change', this._extraTimeAutoFillHandler);
        }
        if (penaltiesCheckbox) {
            penaltiesCheckbox.checked = false;
            document.getElementById('penaltiesScores').style.display = 'none';
            document.getElementById('team1PenaltiesScore').value = 0;
            document.getElementById('team2PenaltiesScore').value = 0;
        }
        
        // Show extra time and penalties sections (they're hidden by default, shown when needed)
        document.getElementById('extraTimeSection').style.display = 'block';
        document.getElementById('penaltiesSection').style.display = 'block';
        
        this.currentMatch = match;
        this.showScreen('matchScreen');
    }

    // Match Recording
    recordScore() {
        const team1Score = parseInt(document.getElementById('team1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('team2Score').value) || 0;

        if (!this.currentMatch) return;

        // Get extra time scores if applicable
        // Extra time scores should be cumulative (full time + extra time goals)
        const wentToExtraTime = document.getElementById('wentToExtraTime').checked;
        let team1ExtraTimeScore = null;
        let team2ExtraTimeScore = null;
        if (wentToExtraTime) {
            // User enters the total score after extra time (cumulative)
            team1ExtraTimeScore = parseInt(document.getElementById('team1ExtraTimeScore').value) || 0;
            team2ExtraTimeScore = parseInt(document.getElementById('team2ExtraTimeScore').value) || 0;
        }

        // Get penalties scores if applicable
        const wentToPenalties = document.getElementById('wentToPenalties').checked;
        let team1PenaltiesScore = null;
        let team2PenaltiesScore = null;
        if (wentToPenalties) {
            team1PenaltiesScore = parseInt(document.getElementById('team1PenaltiesScore').value) || 0;
            team2PenaltiesScore = parseInt(document.getElementById('team2PenaltiesScore').value) || 0;
        }

        const { team1, team2 } = this.currentMatch;
        if (this.matchRecorder.recordMatch(
            team1, 
            team2, 
            team1Score, 
            team2Score,
            team1ExtraTimeScore,
            team2ExtraTimeScore,
            team1PenaltiesScore,
            team2PenaltiesScore
        )) {
            // Reset score inputs
            document.getElementById('team1Score').value = 0;
            document.getElementById('team2Score').value = 0;
            
            this.currentGameIndex++;
            
            if (this.selectedStructure && this.currentGameIndex < this.selectedStructure.matches.length) {
                this.showCurrentMatch();
            } else {
                // All games completed - reset to first match for replay
                this.currentGameIndex = 0;
                this.showCurrentMatch();
            }
        } else {
            this.toastManager.error('Error recording match result');
        }
    }

    // Statistics
    loadStatistics() {
        this.switchStatsTab('today');
    }

    switchStatsTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.getElementById('seasonStats').classList.toggle('active', tab === 'season');
        document.getElementById('overallStats').classList.toggle('active', tab === 'overall');
        document.getElementById('todayStats').classList.toggle('active', tab === 'today');

        const currentSeason = this.seasonManager.getCurrentSeason();
        if (tab === 'season') {
            this.renderCategoryTabs('season', 'league');
            this.switchStatsCategory('season', 'league');
        } else if (tab === 'overall') {
            this.renderCategoryTabs('overall', 'league');
            this.switchStatsCategory('overall', 'league');
        } else if (tab === 'today') {
            this.renderCategoryTabs('today', 'league');
            this.switchStatsCategory('today', 'league');
        }
    }
    
    renderCategoryTabs(type, selectedCategory = 'all') {
        const categories = StatisticsCalculators.getCategories();
        let containerId;
        if (type === 'season') {
            containerId = 'seasonCategoryTabs';
        } else if (type === 'overall') {
            containerId = 'overallCategoryTabs';
        } else if (type === 'today') {
            containerId = 'todayCategoryTabs';
        } else {
            return;
        }
        const container = document.getElementById(containerId);
        
        // Category display names
        const categoryNames = {
            'performance': 'Performance',
            'goals': 'Goals',
            'league': 'League',
            'records': 'Records',
            'general': 'General',
            'visualization': 'Charts',
            'all': 'All'
        };
        
        // Subcategory display names
        const subcategoryNames = {
            'wins-losses': 'Wins/Losses',
            'win-rate': 'Win Rate',
            'streak': 'Streak',
            'form': 'Form',
            'h2h': 'Head-to-Head',
            'trends': 'Trends',
            'overview': 'Overview',
            'insights': 'Insights',
            'comparison': 'Comparison',
            'match-types': 'Match Types',
            'goals': 'Goals'
        };
        
        let tabsHTML = '';
        
        // Render main category tabs
        tabsHTML += `
            <button class="category-btn ${selectedCategory === 'all' ? 'active' : ''}" data-category="all">All</button>
            ${categories.map(cat => `
                <button class="category-btn ${selectedCategory === cat ? 'active' : ''}" data-category="${cat}">${categoryNames[cat] || cat}</button>
            `).join('')}
        `;
        
        // If performance is selected, show subcategory tabs
        if (selectedCategory === 'performance') {
            const subcategories = StatisticsCalculators.getSubcategories('performance');
            tabsHTML += `<div class="subcategory-tabs">`;
            tabsHTML += `<button class="subcategory-btn active" data-subcategory="all">All</button>`;
            subcategories.forEach(subcat => {
                tabsHTML += `<button class="subcategory-btn" data-subcategory="${subcat}">${subcategoryNames[subcat] || subcat}</button>`;
            });
            tabsHTML += `</div>`;
        }
        
        container.innerHTML = tabsHTML;
        
        // Add event listeners for category buttons
        container.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.switchStatsCategory(type, category);
            });
        });
        
        // Add event listeners for subcategory buttons (if they exist)
        container.querySelectorAll('.subcategory-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subcategory = e.target.dataset.subcategory;
                this.switchStatsSubcategory(type, 'performance', subcategory);
            });
        });
    }
    
    switchStatsCategory(type, category) {
        // Store current category for this type
        if (!this.currentStatsState) {
            this.currentStatsState = {};
        }
        this.currentStatsState[type] = { category, subcategory: null };
        
        // Re-render category tabs to show/hide subcategories
        this.renderCategoryTabs(type, category);
        
        const currentSeason = this.seasonManager.getCurrentSeason();
        const selectedCategory = category === 'all' ? null : category;
        
        if (type === 'season') {
            this.statisticsDisplay.displaySeasonStats(
                currentSeason, 
                document.getElementById('seasonStatsDisplay'),
                selectedCategory,
                null
            );
        } else if (type === 'overall') {
            this.statisticsDisplay.displayOverallStats(
                document.getElementById('overallStatsDisplay'),
                selectedCategory,
                null
            );
        } else if (type === 'today') {
            this.statisticsDisplay.displayTodayStats(
                document.getElementById('todayStatsDisplay'),
                selectedCategory,
                null
            );
        }
    }
    
    switchStatsSubcategory(type, category, subcategory) {
        // Store current subcategory
        if (!this.currentStatsState) {
            this.currentStatsState = {};
        }
        this.currentStatsState[type] = { category, subcategory };
        
        // Update active subcategory button
        let containerId;
        if (type === 'season') {
            containerId = 'seasonCategoryTabs';
        } else if (type === 'overall') {
            containerId = 'overallCategoryTabs';
        } else if (type === 'today') {
            containerId = 'todayCategoryTabs';
        } else {
            return;
        }
        const container = document.getElementById(containerId);
        container.querySelectorAll('.subcategory-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subcategory === subcategory);
        });
        
        const currentSeason = this.seasonManager.getCurrentSeason();
        const selectedCategory = category === 'all' ? null : category;
        const selectedSubcategory = subcategory === 'all' ? null : subcategory;
        
        if (type === 'season') {
            this.statisticsDisplay.displaySeasonStats(
                currentSeason, 
                document.getElementById('seasonStatsDisplay'),
                selectedCategory,
                selectedSubcategory
            );
        } else if (type === 'overall') {
            this.statisticsDisplay.displayOverallStats(
                document.getElementById('overallStatsDisplay'),
                selectedCategory,
                selectedSubcategory
            );
        } else if (type === 'today') {
            this.statisticsDisplay.displayTodayStats(
                document.getElementById('todayStatsDisplay'),
                selectedCategory,
                selectedSubcategory
            );
        }
    }

    startNewSeason() {
        if (confirm('Start a new season? This will reset season statistics but keep overall statistics.')) {
            if (this.seasonManager.startNewSeason()) {
                this.updateSeasonInfo();
                this.switchStatsTab('season');
                this.toastManager.success('New season started!', 'Season Reset');
            } else {
                this.toastManager.error('Error starting new season');
            }
        }
    }

    updateSeasonInfo() {
        const season = this.seasonManager.getCurrentSeason();
        document.getElementById('currentSeasonNumber').textContent = season;
        document.getElementById('seasonInfo').style.display = 'block';
    }

    clearAllStatistics() {
        if (confirm('WARNING: This will delete ALL statistics, all seasons, and all match history. This cannot be undone. Continue?')) {
            if (this.storage.clearAllStatistics()) {
                alert('All statistics cleared. Players are kept.');
                this.updateSeasonInfo();
                // Reload the statistics display
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'season';
                this.switchStatsTab(currentTab);
            } else {
                this.toastManager.error('Error clearing statistics');
            }
        }
    }

    // Share statistics as image
    async shareStats(statsType) {
        try {
            // Get current category/subcategory from active tabs
            let category = null;
            let subcategory = null;
            
            let categoryTabsId;
            if (statsType === 'today') {
                categoryTabsId = 'todayCategoryTabs';
            } else if (statsType === 'season') {
                categoryTabsId = 'seasonCategoryTabs';
            } else {
                categoryTabsId = 'overallCategoryTabs';
            }
            
            const categoryTabs = document.getElementById(categoryTabsId);
            if (categoryTabs) {
                const activeCategoryBtn = categoryTabs.querySelector('.category-btn.active');
                if (activeCategoryBtn && activeCategoryBtn.dataset.category !== 'all') {
                    category = activeCategoryBtn.dataset.category;
                    
                    // Check for subcategory
                    const subcategoryBtns = categoryTabs.querySelectorAll('.subcategory-btn');
                    if (subcategoryBtns.length > 0) {
                        const activeSubcategoryBtn = Array.from(subcategoryBtns).find(btn => btn.classList.contains('active'));
                        if (activeSubcategoryBtn && activeSubcategoryBtn.dataset.subcategory !== 'all') {
                            subcategory = activeSubcategoryBtn.dataset.subcategory;
                        }
                    }
                }
            }
            
            const imageDataUrl = await this.shareManager.generateStatsImage(statsType, category, subcategory);
            const fileName = `FC25_${statsType}_${new Date().toISOString().split('T')[0]}.png`;
            
            await this.shareManager.shareImage(imageDataUrl, fileName);
        } catch (error) {
            console.error('Error sharing stats:', error);
            alert('Error generating shareable image. Please try again.');
        }
    }

    // Export statistics as PDF
    async exportPDF(statsType = null) {
        try {
            // Detect active stats tab if statsType not provided
            if (!statsType) {
                const activeTabElement = document.querySelector('.stats-content.active');
                if (activeTabElement) {
                    const tabId = activeTabElement.id;
                    if (tabId === 'todayStats') {
                        statsType = 'today';
                    } else if (tabId === 'seasonStats') {
                        statsType = 'season';
                    } else if (tabId === 'overallStats') {
                        statsType = 'overall';
                    }
                }
                // Fallback: check active tab button
                if (!statsType) {
                    const activeTabBtn = document.querySelector('.tab-btn.active');
                    if (activeTabBtn) {
                        statsType = activeTabBtn.dataset.tab;
                    }
                }
                // Final fallback
                if (!statsType) {
                    statsType = 'season';
                }
            }
            
            // Get current category/subcategory from active tabs
            let category = null;
            let subcategory = null;
            
            let categoryTabsId;
            if (statsType === 'today') {
                categoryTabsId = 'todayCategoryTabs';
            } else if (statsType === 'season') {
                categoryTabsId = 'seasonCategoryTabs';
            } else {
                categoryTabsId = 'overallCategoryTabs';
            }
            
            const categoryTabs = document.getElementById(categoryTabsId);
            if (categoryTabs) {
                const activeCategoryBtn = categoryTabs.querySelector('.category-btn.active');
                if (activeCategoryBtn && activeCategoryBtn.dataset.category !== 'all') {
                    category = activeCategoryBtn.dataset.category;
                    
                    // Check for subcategory
                    const subcategoryBtns = categoryTabs.querySelectorAll('.subcategory-btn');
                    if (subcategoryBtns.length > 0) {
                        const activeSubcategoryBtn = Array.from(subcategoryBtns).find(btn => btn.classList.contains('active'));
                        if (activeSubcategoryBtn && activeSubcategoryBtn.dataset.subcategory !== 'all') {
                            subcategory = activeSubcategoryBtn.dataset.subcategory;
                        }
                    }
                }
            }
            
            const result = await this.shareManager.exportLeaderboardPDF(statsType, category, subcategory);
            
            // Store PDF blob URL for viewing
            if (result && result.blobUrl) {
                try {
                    // Clean up previous PDF blob URL
                    if (this.lastPDFBlobUrl) {
                        try {
                            URL.revokeObjectURL(this.lastPDFBlobUrl);
                        } catch (e) {
                            // Ignore errors revoking old URL
                        }
                    }
                    this.lastPDFBlobUrl = result.blobUrl;
                    
                    // Show success notification
                    if (this.toastManager) {
                        this.toastManager.success(`PDF saved: ${result.fileName || 'PDF'}`, 'PDF Exported');
                    }
                    
                    // Enable view PDF button if it exists
                    this.updateViewPDFButton();
                } catch (error) {
                    console.error('Error handling PDF result:', error);
                    if (this.toastManager) {
                        this.toastManager.error('Error saving PDF. Please try again.');
                    }
                }
            } else if (result) {
                // PDF was created but might not have blobUrl, still show success
                if (this.toastManager) {
                    this.toastManager.success('PDF exported successfully', 'PDF Exported');
                }
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.toastManager.error('Error exporting PDF. Please try again.');
        }
    }

    updateViewPDFButton() {
        try {
            const viewPdfBtn = document.getElementById('viewLastPDFBtn');
            if (viewPdfBtn) {
                if (this.lastPDFBlobUrl) {
                    viewPdfBtn.disabled = false;
                    viewPdfBtn.style.opacity = '1';
                    viewPdfBtn.style.cursor = 'pointer';
                } else {
                    viewPdfBtn.disabled = true;
                    viewPdfBtn.style.opacity = '0.5';
                    viewPdfBtn.style.cursor = 'not-allowed';
                }
            }
        } catch (error) {
            console.error('Error updating view PDF button:', error);
            // Silently fail - button might not be in DOM yet
        }
    }

    viewLastPDF() {
        try {
            if (this.lastPDFBlobUrl) {
                window.open(this.lastPDFBlobUrl, '_blank');
            } else {
                if (this.toastManager) {
                    this.toastManager.error('No PDF available. Please export a PDF first.');
                } else {
                    alert('No PDF available. Please export a PDF first.');
                }
            }
        } catch (error) {
            console.error('Error viewing PDF:', error);
            if (this.toastManager) {
                this.toastManager.error('Error opening PDF. Please try again.');
            }
        }
    }

    // Share match result
    async shareMatch(timestamp) {
        try {
            const matchInfo = this.matchRecorder.findMatch(timestamp);
            if (!matchInfo) {
                this.toastManager.error('Match not found');
                return;
            }
            
            const data = this.storage.getData();
            const match = data.seasons[matchInfo.season].matches[matchInfo.index];
            
            const imageDataUrl = await this.shareManager.generateMatchImage(match);
            const dateStr = new Date(match.timestamp).toISOString().split('T')[0];
            const fileName = `FC25_Match_${dateStr}.png`;
            
            await this.shareManager.shareImage(imageDataUrl, fileName);
        } catch (error) {
            console.error('Error sharing match:', error);
            alert('Error generating shareable image. Please try again.');
        }
    }

    // Match History
    loadMatchHistory() {
        const listContainer = document.getElementById('matchHistoryList');
        const timelineContainer = document.getElementById('matchHistoryTimeline');
        if (!listContainer || !timelineContainer) return;

        const filter = document.getElementById('historyFilter').value;
        const search = document.getElementById('historySearch').value.toLowerCase();
        const dateFrom = document.getElementById('historyDateFrom').value;
        const dateTo = document.getElementById('historyDateTo').value;

        let allMatches = [];

        if (filter === 'today') {
            allMatches = this.statisticsTracker.getTodayMatches();
        } else if (filter === 'current') {
            const currentSeason = this.seasonManager.getCurrentSeason();
            allMatches = this.statisticsTracker.getSeasonMatches(currentSeason);
        } else {
            allMatches = this.statisticsTracker.getAllMatches();
        }

        // Filter by date range
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            allMatches = allMatches.filter(match => {
                const matchDate = new Date(match.timestamp);
                matchDate.setHours(0, 0, 0, 0);
                return matchDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            allMatches = allMatches.filter(match => {
                const matchDate = new Date(match.timestamp);
                return matchDate <= toDate;
            });
        }

        // Filter by search term
        if (search) {
            allMatches = allMatches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const allPlayers = [...team1Players, ...team2Players];
                return allPlayers.some(p => p.toLowerCase().includes(search));
            });
        }

        // Sort by date (newest first for list, oldest first for timeline)
        if (this.currentHistoryView === 'timeline') {
            allMatches.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } else {
            allMatches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        if (allMatches.length === 0) {
            const emptyMessage = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Matches Found</h3><p>Try adjusting your filters or start recording matches!</p></div>';
            listContainer.innerHTML = emptyMessage;
            timelineContainer.innerHTML = emptyMessage;
            return;
        }

        if (this.currentHistoryView === 'timeline') {
            this.renderTimelineView(allMatches, timelineContainer);
        } else {
            this.renderListView(allMatches, listContainer);
        }
    }

    renderListView(matches, container) {
        container.innerHTML = matches.map(match => {
            const team1Display = this.formatTeamWithColors(match.team1);
            const team2Display = this.formatTeamWithColors(match.team2);
            
            const date = new Date(match.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="match-history-item">
                    <div class="match-history-info">
                        <div class="match-history-teams">${team1Display} vs ${team2Display}</div>
                        <div class="match-history-score">
                            ${match.team1Score || 0} - ${match.team2Score || 0}
                            ${match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined ? 
                                ` <span class="extra-time-score">(${match.team1ExtraTimeScore}-${match.team2ExtraTimeScore} ET)</span>` : ''}
                            ${match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined ? 
                                ` <span class="penalties-score">(${match.team1PenaltiesScore}-${match.team2PenaltiesScore} Pens)</span>` : ''}
                        </div>
                        <div class="match-history-date">${dateStr}</div>
                    </div>
                    <div class="match-history-actions">
                        <button class="match-history-btn share" data-timestamp="${match.timestamp}" title="Share Match">📤</button>
                        <button class="match-history-btn edit" data-timestamp="${match.timestamp}">Edit</button>
                        <button class="match-history-btn delete" data-timestamp="${match.timestamp}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        this.attachHistoryEventListeners(container);
    }

    renderTimelineView(matches, container) {
        // Group matches by date
        const matchesByDate = {};
        matches.forEach(match => {
            const date = new Date(match.timestamp);
            const dateKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!matchesByDate[dateKey]) {
                matchesByDate[dateKey] = [];
            }
            matchesByDate[dateKey].push(match);
        });

        container.innerHTML = Object.entries(matchesByDate).map(([dateKey, dateMatches]) => {
            const dateHeader = `
                <div class="timeline-date-group">
                    <div class="timeline-date-header">
                        <div class="timeline-date-title">${dateKey}</div>
                        <div class="timeline-date-count">${dateMatches.length} match${dateMatches.length !== 1 ? 'es' : ''}</div>
                    </div>
            `;

            const matchesHTML = dateMatches.map(match => {
                const team1Display = this.formatTeamWithColors(match.team1);
                const team2Display = this.formatTeamWithColors(match.team2);
                
                const date = new Date(match.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Determine result class and indicator
                let resultClass = 'draw';
                let resultIndicator = 'draw';
                if (match.result === 'team1' || match.result === 'team2') {
                    resultClass = match.result === 'team1' ? 'team1-win' : 'team2-win';
                    resultIndicator = 'win';
                }

                return `
                    <div class="timeline-match-item ${resultClass}" data-timestamp="${match.timestamp}">
                        <div class="timeline-match-header">
                            <div class="timeline-match-teams">
                                <span class="timeline-result-indicator ${resultIndicator}"></span>
                                ${team1Display} vs ${team2Display}
                            </div>
                            <div class="timeline-match-score">
                                ${match.team1Score || 0} - ${match.team2Score || 0}
                                ${match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined ? 
                                    ` <span class="extra-time-score">(${match.team1ExtraTimeScore}-${match.team2ExtraTimeScore} ET)</span>` : ''}
                                ${match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined ? 
                                    ` <span class="penalties-score">(${match.team1PenaltiesScore}-${match.team2PenaltiesScore} Pens)</span>` : ''}
                            </div>
                        </div>
                        <div class="timeline-match-time">${timeStr}</div>
                        <div class="timeline-match-details">
                            <div class="timeline-match-actions">
                                <button class="match-history-btn share" data-timestamp="${match.timestamp}" title="Share Match">📤 Share</button>
                                <button class="match-history-btn edit" data-timestamp="${match.timestamp}">Edit</button>
                                <button class="match-history-btn delete" data-timestamp="${match.timestamp}">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return dateHeader + matchesHTML + '</div>';
        }).join('');

        this.attachHistoryEventListeners(container);
        
        // Add click handlers to expand/collapse match details
        container.querySelectorAll('.timeline-match-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't expand if clicking on a button
                if (e.target.closest('.match-history-btn')) {
                    return;
                }
                item.classList.toggle('expanded');
            });
        });
    }

    attachHistoryEventListeners(container) {
        container.querySelectorAll('.match-history-btn.share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareMatch(btn.dataset.timestamp);
            });
        });

        container.querySelectorAll('.match-history-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMatch(btn.dataset.timestamp);
            });
        });

        container.querySelectorAll('.match-history-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this match? This cannot be undone.')) {
                    this.deleteMatch(btn.dataset.timestamp);
                }
            });
        });
    }

    switchHistoryView(view) {
        this.currentHistoryView = view;
        
        // Update toggle buttons
        document.getElementById('historyListViewBtn').classList.toggle('active', view === 'list');
        document.getElementById('historyTimelineViewBtn').classList.toggle('active', view === 'timeline');
        
        // Show/hide containers
        document.getElementById('matchHistoryList').style.display = view === 'list' ? 'flex' : 'none';
        document.getElementById('matchHistoryTimeline').style.display = view === 'timeline' ? 'block' : 'none';
        
        // Reload history with current view
        this.loadMatchHistory();
    }

    clearHistoryFilters() {
        document.getElementById('historyFilter').value = 'all';
        document.getElementById('historySearch').value = '';
        document.getElementById('historyDateFrom').value = '';
        document.getElementById('historyDateTo').value = '';
        this.loadMatchHistory();
    }

    editMatch(timestamp) {
        const matchInfo = this.matchRecorder.findMatch(timestamp);
        if (!matchInfo) return;

        const data = this.storage.getData();
        const match = data.seasons[matchInfo.season].matches[matchInfo.index];
        
        this.editingMatchTimestamp = timestamp;

        const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
        const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
        const team1Display = this.formatTeamWithColors(match.team1);
        const team2Display = this.formatTeamWithColors(match.team2);

        document.getElementById('editMatchTeams').innerHTML = `
            <div class="team-display">
                <div class="team-players">${team1Display}</div>
                <span class="vs">VS</span>
                <div class="team-players">${team2Display}</div>
            </div>
        `;
        document.getElementById('editTeam1Score').value = match.team1Score || 0;
        document.getElementById('editTeam2Score').value = match.team2Score || 0;
        
        // Set extra time if exists
        const hasExtraTime = match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined;
        const editExtraTimeCheckbox = document.getElementById('editWentToExtraTime');
        if (editExtraTimeCheckbox) {
            editExtraTimeCheckbox.checked = hasExtraTime;
            if (hasExtraTime) {
                document.getElementById('editExtraTimeScores').style.display = 'flex';
                document.getElementById('editTeam1ExtraTimeScore').value = match.team1ExtraTimeScore || 0;
                document.getElementById('editTeam2ExtraTimeScore').value = match.team2ExtraTimeScore || 0;
            } else {
                document.getElementById('editExtraTimeScores').style.display = 'none';
                document.getElementById('editTeam1ExtraTimeScore').value = 0;
                document.getElementById('editTeam2ExtraTimeScore').value = 0;
            }
        }
        
        // Set penalties if exists
        const hasPenalties = match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined;
        const editPenaltiesCheckbox = document.getElementById('editWentToPenalties');
        if (editPenaltiesCheckbox) {
            editPenaltiesCheckbox.checked = hasPenalties;
            if (hasPenalties) {
                document.getElementById('editPenaltiesScores').style.display = 'flex';
                document.getElementById('editTeam1PenaltiesScore').value = match.team1PenaltiesScore || 0;
                document.getElementById('editTeam2PenaltiesScore').value = match.team2PenaltiesScore || 0;
            } else {
                document.getElementById('editPenaltiesScores').style.display = 'none';
                document.getElementById('editTeam1PenaltiesScore').value = 0;
                document.getElementById('editTeam2PenaltiesScore').value = 0;
            }
        }
        
        document.getElementById('editMatchModal').style.display = 'flex';
    }

    saveEditMatch() {
        if (!this.editingMatchTimestamp) return;

        const team1Score = parseInt(document.getElementById('editTeam1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('editTeam2Score').value) || 0;

        // Get extra time scores if applicable
        const wentToExtraTime = document.getElementById('editWentToExtraTime').checked;
        let team1ExtraTimeScore = null;
        let team2ExtraTimeScore = null;
        if (wentToExtraTime) {
            team1ExtraTimeScore = parseInt(document.getElementById('editTeam1ExtraTimeScore').value) || 0;
            team2ExtraTimeScore = parseInt(document.getElementById('editTeam2ExtraTimeScore').value) || 0;
        }

        // Get penalties scores if applicable
        const wentToPenalties = document.getElementById('editWentToPenalties').checked;
        let team1PenaltiesScore = null;
        let team2PenaltiesScore = null;
        if (wentToPenalties) {
            team1PenaltiesScore = parseInt(document.getElementById('editTeam1PenaltiesScore').value) || 0;
            team2PenaltiesScore = parseInt(document.getElementById('editTeam2PenaltiesScore').value) || 0;
        }

        if (this.matchRecorder.updateMatch(
            this.editingMatchTimestamp, 
            team1Score, 
            team2Score,
            team1ExtraTimeScore,
            team2ExtraTimeScore,
            team1PenaltiesScore,
            team2PenaltiesScore
        )) {
            // Haptic feedback
            this.vibrate([50]);
            this.toastManager.success('Match updated successfully', 'Match Saved');
            this.closeEditModal();
            this.loadMatchHistory();
            // Refresh stats if on stats screen
            if (this.currentScreen === 'statsScreen') {
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'today';
                this.switchStatsTab(currentTab);
            }
        } else {
            this.toastManager.error('Error updating match');
        }
    }

    confirmDeleteMatch() {
        if (!this.editingMatchTimestamp) return;
        
        if (confirm('Delete this match? This cannot be undone.')) {
            this.deleteMatch(this.editingMatchTimestamp);
        }
    }

    deleteMatch(timestamp) {
        if (this.matchRecorder.deleteMatch(timestamp)) {
            // Haptic feedback
            this.vibrate([100, 50, 100]);
            this.toastManager.success('Match deleted successfully', 'Match Removed');
            this.closeEditModal();
            this.loadMatchHistory();
            // Refresh stats if on stats screen
            if (this.currentScreen === 'statsScreen') {
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'today';
                this.switchStatsTab(currentTab);
            }
        } else {
            this.toastManager.error('Error deleting match');
        }
    }

    closeEditModal() {
        document.getElementById('editMatchModal').style.display = 'none';
        this.editingMatchTimestamp = null;
    }

    // Export/Import Data
    exportData() {
        const data = this.storage.getData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fc25-score-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Data exported successfully!');
    }

    importData() {
        document.getElementById('importFileInput').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Basic validation
                if (!importedData.players || !Array.isArray(importedData.players)) {
                    throw new Error('Invalid data format');
                }

                if (confirm('This will replace ALL your current data. Continue?')) {
                    this.storage.updateData(data => {
                        Object.assign(data, importedData);
                    });
                    alert('Data imported successfully! Reloading...');
                    location.reload();
                }
            } catch (error) {
                alert('Error importing data: ' + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    // Dark Mode
    initializeDarkMode() {
        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) {
            document.body.classList.add('dark-mode');
            document.getElementById('darkModeToggle').textContent = '☀️';
        }
    }

    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
    }

    // Check for app updates
    async checkForUpdates() {
        const refreshBtn = document.getElementById('refreshAppBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳';
        }
        
        try {
            if ('serviceWorker' in navigator) {
                // Unregister all service workers
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                
                // Clear all caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
            }
            
            // Force reload with cache bypass
            window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
        } catch (error) {
            console.error('Error checking for updates:', error);
            // Fallback: reload
            window.location.reload();
        }
    }

    // Add this method to display player name history
    updatePlayerNameHistory() {
        const history = this.playerManager.getPlayerNameHistory();
        const container = document.getElementById('playerHistory');
        const list = document.getElementById('playerHistoryList');
        
        if (history.length > 0) {
            container.style.display = 'block';
            
            list.innerHTML = history.map(name => {
                const isUsed = this.playerEditorValues.some(value => (value || '').trim() === name);
                
                return `
                    <button class="player-history-btn ${isUsed ? 'used' : ''}" 
                            data-name="${name}" 
                            ${isUsed ? 'disabled' : ''}>
                        ${name}
                    </button>
                `;
            }).join('');
            
            // Add click listeners
            list.querySelectorAll('.player-history-btn').forEach(btn => {
                if (!btn.disabled) {
                    btn.addEventListener('click', () => {
                        const playerName = btn.dataset.name;
                        this.fillEmptyPlayerInput(playerName);
                    });
                }
            });
        } else {
            container.style.display = 'none';
        }
    }

    // Add this method to fill the first empty input
    fillEmptyPlayerInput(playerName) {
        const trimmed = (playerName || '').trim();
        if (!trimmed) return;

        if (this.playerEditorValues.some(value => (value || '').trim() === trimmed)) {
            alert(`${trimmed} is already in the list.`);
            return;
        }

        const emptyIndex = this.playerEditorValues.findIndex(value => (value || '').trim().length === 0);
        if (emptyIndex !== -1) {
            this.playerEditorValues[emptyIndex] = trimmed;
        } else if (this.playerEditorValues.length < 4) {
            this.playerEditorValues.push(trimmed);
        } else {
            alert('Maximum 4 players allowed');
            return;
        }

        this.renderEditablePlayerList();
        this.updatePlayerNameHistory();
    }

    // Settings Management
    switchSettingsTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.settingsTab === tabId);
        });
        
        // Update tab content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const targetTab = document.getElementById(`${tabId}SettingsTab`) || 
                         document.getElementById(`${tabId}ConfigTab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Load tab-specific content
        if (tabId === 'visual') {
            this.renderPlayerColors();
        }
    }

    loadSettingsScreen() {
        // Load current settings into UI
        const settings = this.settingsManager.getSettings();
        
        // Load labels
        document.getElementById('homeLabelInput').value = settings.labels.home || 'Home';
        document.getElementById('awayLabelInput').value = settings.labels.away || 'Away';
        document.getElementById('neutralLabelInput').value = settings.labels.neutral || 'Neutral';
        
        // Load dark mode
        const darkModeSetting = document.getElementById('darkModeSetting');
        if (darkModeSetting) {
            darkModeSetting.checked = settings.darkMode || false;
        }
        
        // Render player colors
        this.renderPlayerColors();
        
        // Display app version - extract from service worker cache or use constant
        const versionDisplay = document.getElementById('appVersionDisplay');
        if (versionDisplay) {
            // Try to get version from service worker cache name (more accurate)
            this.displayAppVersion(versionDisplay);
        }
    }

    async displayAppVersion(versionDisplayElement) {
        // First, try to get version from active cache name
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                // Find the cache name that matches our pattern: fc25-score-tracker-vXX
                const cacheName = cacheNames.find(name => name.startsWith('fc25-score-tracker-v'));
                if (cacheName) {
                    // Extract version number (e.g., "v19" -> "19")
                    const versionMatch = cacheName.match(/v(\d+)/);
                    if (versionMatch) {
                        const cacheVersion = versionMatch[1];
                        // Format as version number (e.g., "1.19.0")
                        versionDisplayElement.textContent = `Version 1.${cacheVersion}.0`;
                        return;
                    }
                }
            } catch (error) {
                console.error('Error reading cache names:', error);
            }
        }
        
        // Fallback to constant version
        if (typeof APP_VERSION !== 'undefined') {
            versionDisplayElement.textContent = `Version ${APP_VERSION}`;
        } else {
            versionDisplayElement.textContent = 'Version unknown';
        }
    }

    renderPlayerColors() {
        const container = document.getElementById('playerColorsList');
        if (!container) return;
        
        const players = this.playerManager.getPlayers();
        const settings = this.settingsManager.getSettings();
        
        if (players.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Add players first to assign colors</p>';
            return;
        }
        
        container.innerHTML = players.map(player => {
            const currentColor = settings.playerColors[player] || '#2196F3';
            return `
                <div class="player-color-item">
                    <label>${this.escapeHtml(player)}</label>
                    <input type="color" 
                           class="player-color-picker" 
                           value="${currentColor}"
                           data-player="${this.escapeHtml(player)}"
                           title="Choose color for ${this.escapeHtml(player)}">
                </div>
            `;
        }).join('');
        
        // Add event listeners for color changes
        container.querySelectorAll('.player-color-picker').forEach(picker => {
            picker.addEventListener('change', (e) => {
                const player = e.target.dataset.player;
                const color = e.target.value;
                this.settingsManager.setPlayerColor(player, color);
            });
        });
    }

    saveSettings() {
        // Save labels
        const homeLabel = document.getElementById('homeLabelInput').value.trim() || 'Home';
        const awayLabel = document.getElementById('awayLabelInput').value.trim() || 'Away';
        const neutralLabel = document.getElementById('neutralLabelInput').value.trim() || 'Neutral';
        
        this.settingsManager.setLabel('home', homeLabel);
        this.settingsManager.setLabel('away', awayLabel);
        this.settingsManager.setLabel('neutral', neutralLabel);
        
        // Update lock labels in app
        this.updateLockLabels();
        
        // Refresh UI that uses labels
        this.renderPlayerLockOptions();
        
        // Show success message
        alert('Settings saved successfully!');
    }

    resetLabels() {
        if (confirm('Reset labels to default values?')) {
            this.settingsManager.resetLabels();
            this.loadSettingsScreen();
            this.updateLockLabels();
            this.renderPlayerLockOptions();
        }
    }

    confirmClearAllData() {
        if (confirm('Are you sure you want to clear ALL data? This cannot be undone!\n\nThis will delete:\n- All matches\n- All statistics\n- All settings\n- All player data')) {
            if (confirm('This is your last chance. Are you absolutely sure?')) {
                this.storage.clearAll();
                this.settingsManager.resetAll();
                location.reload();
            }
        }
    }

    // Haptic Feedback Helper
    vibrate(pattern = [50]) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Vibration not supported or failed
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.appController = new AppController();
});

// Register service worker for PWA with update checking
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/Fc25-score-keeper/service-worker.js', {
            scope: '/Fc25-score-keeper/',
            updateViaCache: 'none' // Always check for updates
        })
            .then(reg => {
                console.log('Service Worker registered');
                
                // Check for updates immediately
                reg.update();
                
                // Check for updates periodically (every hour)
                setInterval(() => {
                    reg.update();
                }, 3600000);
                
                // Listen for updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available
                                console.log('New service worker available');
                                // Show update notification
                                if (confirm('A new version is available! Reload to update?')) {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                });
            })
            .catch(err => console.log('Service Worker registration failed:', err));
        
        // Listen for controller change (service worker updated)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                console.log('Service worker updated, reloading page...');
                window.location.reload();
            }
        });
    });
}

