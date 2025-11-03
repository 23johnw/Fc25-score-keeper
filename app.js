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
                return JSON.parse(stored);
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
            }
        };
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
        });
    }

    addPlayer(name) {
        const players = this.getPlayers();
        if (players.length >= 4) return false;
        if (players.includes(name.trim())) return false;
        
        return this.storage.updateData(data => {
            data.players.push(name.trim());
        });
    }

    removePlayer(name) {
        return this.storage.updateData(data => {
            data.players = data.players.filter(p => p !== name);
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
}

// ============================================================================
// TeamGenerator - Generate Round Structures
// ============================================================================

class TeamGenerator {
    // Generate all possible round structures where each structure is a complete set of matches
    generateRoundStructures(players) {
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

        return structures;
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
        
        this.currentScreen = 'playerScreen';
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.currentGameIndex = 0;
        this.currentStatsState = {};
        
        this.initializeEventListeners();
        this.initializeApp();
    }

    initializeApp() {
        // Load existing players
        const players = this.playerManager.getPlayers();
        if (players.length >= 2) {
            this.loadPlayersIntoUI(players);
            this.showScreen('teamScreen');
        } else {
            this.showScreen('playerScreen');
        }
        
        this.updateSeasonInfo();
        this.updatePlayerNameHistory(); // Add this line
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
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.removePlayerInput(e.target.dataset.player));
        });

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
        document.getElementById('clearOverallStatsBtn').addEventListener('click', () => this.clearAllStatistics());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.showScreen('playerScreen'));

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
            }
        }
    }

    // Player Management
    loadPlayersIntoUI(players) {
        const inputs = ['player1Input', 'player2Input', 'player3Input', 'player4Input'];
        inputs.forEach((id, index) => {
            const input = document.getElementById(id);
            if (players[index]) {
                input.value = players[index];
                const removeBtn = input.nextElementSibling;
                if (removeBtn && removeBtn.classList.contains('remove-btn')) {
                    removeBtn.style.display = 'block';
                }
            }
        });
        this.updateCurrentPlayersDisplay();
    }

    removePlayerInput(playerNum) {
        const input = document.getElementById(`player${playerNum}Input`);
        if (input) {
            input.value = '';
            const removeBtn = input.nextElementSibling;
            if (removeBtn && removeBtn.classList.contains('remove-btn')) {
                removeBtn.style.display = 'none';
            }
            // Refresh history to show the name is now available
            this.updatePlayerNameHistory();
        }
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
    }

    savePlayers() {
        console.log('savePlayers called'); // Debug log
        
        const inputs = ['player1Input', 'player2Input', 'player3Input', 'player4Input'];
        const players = inputs
            .map(id => {
                const input = document.getElementById(id);
                if (!input) {
                    console.error(`Input ${id} not found!`);
                    return '';
                }
                return input.value.trim();
            })
            .filter(p => p.length > 0);

        console.log('Players extracted:', players); // Debug log

        if (players.length < 2) {
            alert('Please enter at least 2 players');
            return;
        }

        if (players.length > 4) {
            alert('Maximum 4 players allowed');
            return;
        }

        try {
            // Add each player to history
            players.forEach(player => {
                this.playerManager.addToHistory(player);
            });
            
            if (this.playerManager.setPlayers(players)) {
                console.log('Players saved successfully');
                this.updateCurrentPlayersDisplay();
                this.updatePlayerNameHistory(); // Update the history display
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
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.currentGameIndex = 0;
        this.showScreen('teamScreen');
    }

    // Round Structures
    loadTeamCombinations() {
        const players = this.playerManager.getPlayers();
        if (players.length < 2) {
            this.showScreen('playerScreen');
            return;
        }

        const structures = this.teamGenerator.generateRoundStructures(players);
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
        const structures = this.teamGenerator.generateRoundStructures(players);
        
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
            'streak': 'Streak'
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

    // Add this method to display player name history
    updatePlayerNameHistory() {
        const history = this.playerManager.getPlayerNameHistory();
        const container = document.getElementById('playerHistory');
        const list = document.getElementById('playerHistoryList');
        
        if (history.length > 0) {
            container.style.display = 'block';
            
            list.innerHTML = history.map(name => {
                // Check if this name is already in one of the input fields
                const inputs = ['player1Input', 'player2Input', 'player3Input', 'player4Input'];
                const isUsed = inputs.some(id => {
                    const input = document.getElementById(id);
                    return input && input.value.trim() === name;
                });
                
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
        const inputs = ['player1Input', 'player2Input', 'player3Input', 'player4Input'];
        
        for (const id of inputs) {
            const input = document.getElementById(id);
            if (input && !input.value.trim()) {
                input.value = playerName;
                // Show remove button if it exists
                const removeBtn = input.nextElementSibling;
                if (removeBtn && removeBtn.classList.contains('remove-btn')) {
                    removeBtn.style.display = 'block';
                }
                // Update history display to show this name as used
                this.updatePlayerNameHistory();
                // Focus the next empty input for better UX
                input.focus();
                break;
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AppController();
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/Fc25-score-keeper/service-worker.js', {
            scope: '/Fc25-score-keeper/'
        })
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

