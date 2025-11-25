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

// Total Goals Scored Calculator
StatisticsCalculators.register({
    id: 'totalGoals',
    name: 'Total Goals Scored',
    category: 'goals',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { goals: 0 };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score } = match;
            
            // Handle matches that might not have scores yet (backward compatibility)
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return; // Skip matches without scores
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            // Team 1 players get team1Score added to their total
            team1Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goals += team1Score;
                }
            });

            // Team 2 players get team2Score added to their total
            team2Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goals += team2Score;
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
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Goals</th>
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
                                <td class="points">${stats.goals}</td>
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
// StatisticsDisplay - Render Statistics
// ============================================================================

class StatisticsDisplay {
    constructor(statisticsTracker) {
        this.tracker = statisticsTracker;
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
            
        calculators.forEach(calculator => {
            const data = stats[calculator.id];
            if (data && Object.keys(data).length > 0) {
                const element = calculator.display(data);
                container.appendChild(element);
            }
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

    recordMatch(team1, team2, team1Score, team2Score) {
        // Determine result from scores
        let result;
        if (team1Score > team2Score) {
            result = 'team1';
        } else if (team2Score > team1Score) {
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
    updateMatch(timestamp, newTeam1Score, newTeam2Score) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        let newResult;
        if (newTeam1Score > newTeam2Score) {
            newResult = 'team1';
        } else if (newTeam2Score > newTeam1Score) {
            newResult = 'team2';
        } else {
            newResult = 'draw';
        }

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches[matchInfo.index]) {
                season.matches[matchInfo.index].team1Score = newTeam1Score;
                season.matches[matchInfo.index].team2Score = newTeam2Score;
                season.matches[matchInfo.index].result = newResult;
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
    async exportLeaderboardPDF(statsType, category = null) {
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
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(33, 150, 243);
        doc.text('FC 25 Score Tracker', 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(title, 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(117, 117, 117);
        doc.text(new Date().toLocaleDateString(), 105, 37, { align: 'center' });
        
        let yPos = 50;
        
        // Get calculators
        let calculators;
        if (category) {
            calculators = StatisticsCalculators.getByCategory(category);
        } else {
            calculators = StatisticsCalculators.getAll();
        }
        
        calculators.forEach(calculator => {
            const data = stats[calculator.id];
            if (data && Object.keys(data).length > 0) {
                // Add page break if needed
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                
                // Category title
                doc.setFontSize(14);
                doc.setTextColor(33, 150, 243);
                doc.setFont(undefined, 'bold');
                doc.text(calculator.name, 20, yPos);
                yPos += 10;
                
                // Draw stats
                if (calculator.id === 'league-table') {
                    // League table
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont(undefined, 'bold');
                    
                    // Header
                    doc.text('Pos', 20, yPos);
                    doc.text('Player', 35, yPos);
                    doc.text('W', 100, yPos);
                    doc.text('L', 110, yPos);
                    doc.text('D', 120, yPos);
                    doc.text('Pts', 130, yPos);
                    yPos += 7;
                    
                    // Rows
                    doc.setFont(undefined, 'normal');
                    data.slice(0, 15).forEach((row, index) => {
                        if (yPos > 270) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.text((index + 1).toString(), 20, yPos);
                        doc.text((row.player || row.name || 'Unknown').substring(0, 20), 35, yPos);
                        doc.text((row.wins || 0).toString(), 100, yPos);
                        doc.text((row.losses || 0).toString(), 110, yPos);
                        doc.text((row.draws || 0).toString(), 120, yPos);
                        doc.text((row.points || 0).toString(), 130, yPos);
                        yPos += 7;
                    });
                    yPos += 5;
                } else {
                    // Individual stats - format based on calculator type
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    
                    // Helper function to format statistic value
                    const formatStatValue = (playerName, statValue, calcId) => {
                        if (typeof statValue === 'object' && statValue !== null) {
                            // Format based on calculator type
                            if (calcId === 'totalGoals') {
                                return `${playerName}: ${statValue.goals || 0} goals`;
                            } else if (calcId === 'goalDifference') {
                                return `${playerName}: GD ${statValue.goalDifference || 0} (GF: ${statValue.goalsFor || 0}, GA: ${statValue.goalsAgainst || 0})`;
                            } else if (calcId === 'avgGoalsPerGame') {
                                return `${playerName}: ${statValue.avgGoals || 0} avg (${statValue.totalGoals || 0} goals in ${statValue.games || 0} games)`;
                            } else if (calcId === 'winLossDraw') {
                                return `${playerName}: W: ${statValue.wins || 0}, D: ${statValue.draws || 0}, L: ${statValue.losses || 0}, GP: ${statValue.games || 0}`;
                            } else if (calcId === 'winRate') {
                                return `${playerName}: ${statValue.winRate || 0}% (${statValue.games || 0} games)`;
                            } else if (calcId === 'streak') {
                                const streakType = statValue.streakType === 'win' ? 'Wins' : statValue.streakType === 'loss' ? 'Losses' : 'None';
                                return `${playerName}: ${statValue.currentStreak || 0} ${streakType}`;
                            } else if (calcId === 'form') {
                                const formStr = (statValue.form || []).slice(-5).map(f => f === 'W' ? 'W' : f === 'D' ? 'D' : 'L').join('');
                                return `${playerName}: ${formStr || 'N/A'} (W: ${statValue.wins || 0}, D: ${statValue.draws || 0}, L: ${statValue.losses || 0}, Pts: ${(statValue.wins || 0) * 3 + (statValue.draws || 0)})`;
                            } else if (calcId === 'leaguePoints') {
                                return `${playerName}: ${statValue.points || 0} pts (W: ${statValue.wins || 0}, D: ${statValue.draws || 0}, L: ${statValue.losses || 0}, GP: ${statValue.games || 0})`;
                            } else if (calcId === 'worstLosses') {
                                // Format records
                                const records = [];
                                if (statValue.bestByGoalsFor) {
                                    records.push(`Best GF: ${statValue.bestByGoalsFor.score} vs ${(statValue.bestByGoalsFor.opponents || []).join(' & ')}`);
                                }
                                if (statValue.bestBySurplus) {
                                    records.push(`Best Surplus: ${statValue.bestBySurplus.score} vs ${(statValue.bestBySurplus.opponents || []).join(' & ')}`);
                                }
                                if (statValue.worstByGoalsAgainst) {
                                    records.push(`Worst GA: ${statValue.worstByGoalsAgainst.score} vs ${(statValue.worstByGoalsAgainst.opponents || []).join(' & ')}`);
                                }
                                if (statValue.worstByDifference) {
                                    records.push(`Worst Deficit: ${statValue.worstByDifference.score} vs ${(statValue.worstByDifference.opponents || []).join(' & ')}`);
                                }
                                return `${playerName}: ${records.length > 0 ? records.join(' | ') : 'No records yet'}`;
                            } else if (calcId === 'headToHead') {
                                // Head-to-head is more complex, show summary
                                const together = statValue.together || {};
                                const against = statValue.against || {};
                                return `${playerName}: Together (W: ${together.wins || 0}, D: ${together.draws || 0}, L: ${together.losses || 0}) | Against (W: ${against.wins || 0}, D: ${against.draws || 0}, L: ${against.losses || 0})`;
                            } else {
                                // Generic formatting - show all numeric properties
                                const props = Object.entries(statValue)
                                    .filter(([k, v]) => typeof v === 'number')
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ');
                                return `${playerName}: ${props || 'N/A'}`;
                            }
                        } else {
                            // Simple value
                            return `${playerName}: ${statValue}`;
                        }
                    };
                    
                    // Sort entries based on calculator type for better display
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
                    
                    sortedEntries.slice(0, 15).forEach(([playerName, statValue]) => {
                        if (yPos > 270) {
                            doc.addPage();
                            yPos = 20;
                        }
                        const formattedText = formatStatValue(playerName, statValue, calculator.id);
                        // Split long text across multiple lines if needed
                        const maxWidth = 170; // mm
                        const lines = doc.splitTextToSize(formattedText, maxWidth);
                        lines.forEach((line, lineIndex) => {
                            if (yPos > 270) {
                                doc.addPage();
                                yPos = 20;
                            }
                            doc.text(line, 25, yPos);
                            yPos += 7;
                        });
                    });
                    yPos += 5;
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
        
        // Save PDF
        const fileName = `FC25_${statsType}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
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
        this.playerManager = new PlayerManager(this.storage);
        this.teamGenerator = new TeamGenerator();
        this.seasonManager = new SeasonManager(this.storage);
        this.matchRecorder = new MatchRecorder(this.storage, this.seasonManager);
        this.statisticsTracker = new StatisticsTracker(this.storage);
        this.statisticsDisplay = new StatisticsDisplay(this.statisticsTracker);
        this.shareManager = new ShareManager(this.storage, this.statisticsTracker, this.seasonManager);
        
        this.currentScreen = 'playerScreen';
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.currentGameIndex = 0;
        this.currentStatsState = {};
        this.editingMatchTimestamp = null;
        this.playerEditorValues = [];
        this.hasUnsavedPlayerChanges = false;
        this.lockLabels = {
            home: 'Home',
            neutral: 'Neutral',
            away: 'Away'
        };
        
        this.initializeEventListeners();
        this.initializeApp();
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
        document.getElementById('backToPlayersBtn').addEventListener('click', () => this.showScreen('playerScreen'));

        // Sequence screen
        document.getElementById('startGamesBtn').addEventListener('click', () => this.startGames());
        document.getElementById('backToTeamsBtn').addEventListener('click', () => this.showScreen('teamScreen'));

        // Match screen
        document.getElementById('submitScoreBtn').addEventListener('click', () => this.recordScore());
        document.getElementById('backToSequenceBtn').addEventListener('click', () => this.showScreen('sequenceScreen'));

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
        document.getElementById('exportTodayPDFBtn').addEventListener('click', () => this.exportPDF('today'));
        document.getElementById('exportSeasonPDFBtn').addEventListener('click', () => this.exportPDF('season'));
        document.getElementById('exportOverallPDFBtn').addEventListener('click', () => this.exportPDF('overall'));

        // History screen
        document.getElementById('backFromHistoryBtn').addEventListener('click', () => this.showScreen('statsScreen'));
        document.getElementById('historyFilter').addEventListener('change', () => this.loadMatchHistory());
        document.getElementById('historySearch').addEventListener('input', () => this.loadMatchHistory());

        // Edit match modal
        document.getElementById('saveEditMatchBtn').addEventListener('click', () => this.saveEditMatch());
        document.getElementById('cancelEditMatchBtn').addEventListener('click', () => this.closeEditModal());
        document.getElementById('deleteMatchBtn').addEventListener('click', () => this.confirmDeleteMatch());
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
            } else if (screenId === 'playerScreen') {
                this.updatePlayerNameHistory(); // Add this line
            } else if (screenId === 'historyScreen') {
                this.loadMatchHistory();
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
            const labels = this.lockLabels;
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
            alert('Please save players before changing home/away settings.');
            return;
        }

        const value = this.playerEditorValues[index];
        const trimmed = value ? value.trim() : '';
        if (!trimmed) {
            return;
        }

        const players = this.playerManager.getPlayers();
        if (!Array.isArray(players) || !players.includes(trimmed)) {
            alert('Save players before changing home/away settings.');
            return;
        }

        this.handleLockSelection(trimmed, side);
    }

    resetSelectedStructure() {
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
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
            alert('Duplicate player names detected. Please ensure each player has a unique name.');
            return;
        }

        console.log('Players extracted:', players); // Debug log

        if (players.length < 2) {
            alert('Please enter at least 2 players');
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
            } else {
                console.error('Failed to save players');
                alert('Error saving players');
            }
        } catch (error) {
            console.error('Error in savePlayers:', error);
            alert('Error saving players: ' + error.message);
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
        
        if (structures.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Need at least 2 players to generate round structures.</p></div>';
            return;
        }

        container.innerHTML = structures.map((structure, structureIndex) => {
            const isSelected = this.selectedStructureIndex === structureIndex;
            
            const matchesHTML = structure.matches.map((match, matchIndex) => {
                const team1Name = this.teamGenerator.formatTeamName(match.team1);
                const team2Name = this.teamGenerator.formatTeamName(match.team2);
                return `
                    <div class="structure-match">
                        <div class="match-round-label">Round ${matchIndex + 1}</div>
                        <div class="team-display">
                            <div class="team-players">
                                ${match.team1.map(p => `<span class="player-name">${p}</span>`).join('')}
                            </div>
                            <span class="vs">VS</span>
                            <div class="team-players">
                                ${match.team2.map(p => `<span class="player-name">${p}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="round-structure-card ${isSelected ? 'selected' : ''}" data-index="${structureIndex}">
                    <div class="structure-header">
                        <h3>Round Structure ${structureIndex + 1}</h3>
                        ${isSelected ? `<button class="select-structure-btn" data-index="${structureIndex}">Select</button>` : ''}
                    </div>
                    <div class="structure-matches">
                        ${matchesHTML}
                    </div>
                </div>
            `;
        }).join('');

        // Add click listeners for cards
        container.querySelectorAll('.round-structure-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't select if clicking the button
                if (e.target.classList.contains('select-structure-btn')) {
                    return;
                }
                const index = parseInt(card.dataset.index);
                this.selectStructure(index);
            });
        });

        // Add click listeners for select buttons
        container.querySelectorAll('.select-structure-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                this.confirmSequence();
            });
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

        // Hide "Select All" button since we're selecting one structure
        document.getElementById('selectAllCombinationsBtn').style.display = 'none';
        document.getElementById('confirmSequenceBtn').disabled = this.selectedStructureIndex === null;
    }

    selectStructure(structureIndex) {
        const players = this.playerManager.getPlayers();
        const lockState = this.playerManager.getPlayerLock();
        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        
        if (structureIndex >= 0 && structureIndex < structures.length) {
            this.selectedStructureIndex = structureIndex;
            this.selectedStructure = structures[structureIndex];
            this.loadTeamCombinations();
            document.getElementById('confirmSequenceBtn').disabled = false;
        }
    }

    confirmSequence() {
        if (this.selectedStructureIndex === null || !this.selectedStructure) {
            alert('Please select a round structure');
            return;
        }
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
            const team1Name = this.teamGenerator.formatTeamName(match.team1);
            const team2Name = this.teamGenerator.formatTeamName(match.team2);
            return `
                <div class="sequence-item">
                    <div class="sequence-number">Round ${index + 1}</div>
                    <div class="team-display">
                        <div class="team-players">
                            <span class="player-name">${team1Name}</span>
                        </div>
                        <span class="vs">VS</span>
                        <div class="team-players">
                            <span class="player-name">${team2Name}</span>
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
        document.getElementById('team1Display').innerHTML = 
            `<span class="player-name">${team1Name}</span>`;
        document.getElementById('team2Display').innerHTML = 
            `<span class="player-name">${team2Name}</span>`;
        document.getElementById('team1ScoreLabel').textContent = `${team1Name} Score`;
        document.getElementById('team2ScoreLabel').textContent = `${team2Name} Score`;
        
        // Reset score inputs
        document.getElementById('team1Score').value = 0;
        document.getElementById('team2Score').value = 0;
        
        this.currentMatch = match;
        this.showScreen('matchScreen');
    }

    // Match Recording
    recordScore() {
        const team1Score = parseInt(document.getElementById('team1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('team2Score').value) || 0;

        if (!this.currentMatch) return;

        const { team1, team2 } = this.currentMatch;
        if (this.matchRecorder.recordMatch(team1, team2, team1Score, team2Score)) {
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
            alert('Error recording match result');
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
            this.renderCategoryTabs('season');
            this.switchStatsCategory('season', 'all');
        } else if (tab === 'overall') {
            this.renderCategoryTabs('overall');
            this.switchStatsCategory('overall', 'all');
        } else if (tab === 'today') {
            this.renderCategoryTabs('today');
            this.switchStatsCategory('today', 'all');
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
            'all': 'All'
        };
        
        // Subcategory display names
        const subcategoryNames = {
            'wins-losses': 'Wins/Losses',
            'win-rate': 'Win Rate',
            'streak': 'Streak',
            'form': 'Form',
            'h2h': 'Head-to-Head'
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
                alert('New season started!');
            } else {
                alert('Error starting new season');
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
                alert('Error clearing statistics');
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
    async exportPDF(statsType) {
        try {
            // Get current category from active tabs
            let category = null;
            
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
                }
            }
            
            await this.shareManager.exportLeaderboardPDF(statsType, category);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Error exporting PDF. Please try again.');
        }
    }

    // Share match result
    async shareMatch(timestamp) {
        try {
            const matchInfo = this.matchRecorder.findMatch(timestamp);
            if (!matchInfo) {
                alert('Match not found');
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
        const container = document.getElementById('matchHistoryList');
        if (!container) return;

        const filter = document.getElementById('historyFilter').value;
        const search = document.getElementById('historySearch').value.toLowerCase();

        let allMatches = [];
        const data = this.storage.getData();

        if (filter === 'today') {
            allMatches = this.statisticsTracker.getTodayMatches();
        } else if (filter === 'current') {
            const currentSeason = this.seasonManager.getCurrentSeason();
            allMatches = this.statisticsTracker.getSeasonMatches(currentSeason);
        } else {
            allMatches = this.statisticsTracker.getAllMatches();
        }

        // Sort by date (newest first)
        allMatches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Filter by search term
        if (search) {
            allMatches = allMatches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const allPlayers = [...team1Players, ...team2Players];
                return allPlayers.some(p => p.toLowerCase().includes(search));
            });
        }

        if (allMatches.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No matches found.</p></div>';
            return;
        }

        container.innerHTML = allMatches.map(match => {
            const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
            const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
            const team1Display = team1Players.join(' & ');
            const team2Display = team2Players.join(' & ');
            
            const date = new Date(match.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="match-history-item">
                    <div class="match-history-info">
                        <div class="match-history-teams">${team1Display} vs ${team2Display}</div>
                        <div class="match-history-score">${match.team1Score || 0} - ${match.team2Score || 0}</div>
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

        // Add event listeners
        container.querySelectorAll('.match-history-btn.share').forEach(btn => {
            btn.addEventListener('click', () => this.shareMatch(btn.dataset.timestamp));
        });

        container.querySelectorAll('.match-history-btn.edit').forEach(btn => {
            btn.addEventListener('click', () => this.editMatch(btn.dataset.timestamp));
        });

        container.querySelectorAll('.match-history-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this match? This cannot be undone.')) {
                    this.deleteMatch(btn.dataset.timestamp);
                }
            });
        });
    }

    editMatch(timestamp) {
        const matchInfo = this.matchRecorder.findMatch(timestamp);
        if (!matchInfo) return;

        const data = this.storage.getData();
        const match = data.seasons[matchInfo.season].matches[matchInfo.index];
        
        this.editingMatchTimestamp = timestamp;

        const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
        const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
        const team1Display = team1Players.join(' & ');
        const team2Display = team2Players.join(' & ');

        document.getElementById('editMatchTeams').innerHTML = `
            <div class="team-display">
                <div class="team-players">${team1Display}</div>
                <span class="vs">VS</span>
                <div class="team-players">${team2Display}</div>
            </div>
        `;
        document.getElementById('editTeam1Score').value = match.team1Score || 0;
        document.getElementById('editTeam2Score').value = match.team2Score || 0;
        document.getElementById('editMatchModal').style.display = 'flex';
    }

    saveEditMatch() {
        if (!this.editingMatchTimestamp) return;

        const team1Score = parseInt(document.getElementById('editTeam1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('editTeam2Score').value) || 0;

        if (this.matchRecorder.updateMatch(this.editingMatchTimestamp, team1Score, team2Score)) {
            this.closeEditModal();
            this.loadMatchHistory();
            // Refresh stats if on stats screen
            if (this.currentScreen === 'statsScreen') {
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'today';
                this.switchStatsTab(currentTab);
            }
        } else {
            alert('Error updating match');
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
            this.closeEditModal();
            this.loadMatchHistory();
            // Refresh stats if on stats screen
            if (this.currentScreen === 'statsScreen') {
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'today';
                this.switchStatsTab(currentTab);
            }
        } else {
            alert('Error deleting match');
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AppController();
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

