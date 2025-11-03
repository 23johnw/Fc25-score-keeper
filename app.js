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
            this.registry.push(calculator);
        }
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
        
        const html = Object.entries(data).map(([player, stats]) => `
            <h4>${player}</h4>
            <div class="stat-item">
                <span class="label">Games Played:</span>
                <span class="value">${stats.games}</span>
            </div>
            <div class="stat-item">
                <span class="label">Wins:</span>
                <span class="value">${stats.wins}</span>
            </div>
            <div class="stat-item">
                <span class="label">Losses:</span>
                <span class="value">${stats.losses}</span>
            </div>
            <div class="stat-item">
                <span class="label">Draws:</span>
                <span class="value">${stats.draws}</span>
            </div>
        `).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// Win Rate Calculator
StatisticsCalculators.register({
    id: 'winRate',
    name: 'Win Rate',
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
        
        const html = Object.entries(data)
            .sort((a, b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate))
            .map(([player, stats]) => `
                <h4>${player}</h4>
                <div class="stat-item">
                    <span class="label">Win Rate:</span>
                    <span class="value">${stats.winRate}%</span>
                </div>
                <div class="stat-item">
                    <span class="label">Games:</span>
                    <span class="value">${stats.games}</span>
                </div>
            `).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// Streak Calculator
StatisticsCalculators.register({
    id: 'streak',
    name: 'Current Streak',
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
        
        const html = Object.entries(data)
            .sort((a, b) => b[1].goals - a[1].goals)
            .map(([player, stats]) => `
                <h4>${player}</h4>
                <div class="stat-item">
                    <span class="label">Total Goals Scored:</span>
                    <span class="value">${stats.goals}</span>
                </div>
            `).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// Goal Difference Calculator
StatisticsCalculators.register({
    id: 'goalDifference',
    name: 'Goal Difference',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { goalsFor: 0, goalsAgainst: 0, difference: 0 };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score } = match;
            
            // Handle matches that might not have scores yet (backward compatibility)
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return; // Skip matches without scores
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            // Team 1 players: goalsFor = team1Score, goalsAgainst = team2Score
            team1Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goalsFor += team1Score;
                    stats[p].goalsAgainst += team2Score;
                }
            });

            // Team 2 players: goalsFor = team2Score, goalsAgainst = team1Score
            team2Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goalsFor += team2Score;
                    stats[p].goalsAgainst += team1Score;
                }
            });
        });

        // Calculate difference for each player
        Object.keys(stats).forEach(player => {
            stats[player].difference = stats[player].goalsFor - stats[player].goalsAgainst;
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const html = Object.entries(data)
            .sort((a, b) => b[1].difference - a[1].difference)
            .map(([player, stats]) => {
                const diffClass = stats.difference > 0 ? 'positive' : stats.difference < 0 ? 'negative' : 'neutral';
                const diffSign = stats.difference > 0 ? '+' : '';
                return `
                    <h4>${player}</h4>
                    <div class="stat-item">
                        <span class="label">Goals For:</span>
                        <span class="value">${stats.goalsFor}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Goals Against:</span>
                        <span class="value">${stats.goalsAgainst}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Goal Difference:</span>
                        <span class="value ${diffClass}">${diffSign}${stats.difference}</span>
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
}

// ============================================================================
// StatisticsDisplay - Render Statistics
// ============================================================================

class StatisticsDisplay {
    constructor(statisticsTracker) {
        this.tracker = statisticsTracker;
    }

    displaySeasonStats(seasonNumber, container) {
        const stats = this.tracker.getSeasonStats(seasonNumber);
        this.renderStats(stats, container);
    }

    displayOverallStats(container) {
        const stats = this.tracker.getOverallStats();
        this.renderStats(stats, container);
    }

    renderStats(stats, container) {
        container.innerHTML = '';
        
        if (Object.keys(stats).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No statistics available yet. Play some matches first!</p></div>';
            return;
        }

        const calculators = StatisticsCalculators.getAll();
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
            return `
                <div class="sequence-item">
                    <div class="sequence-number">Round ${index + 1}</div>
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
        
        document.getElementById('team1Display').innerHTML = 
            match.team1.map(p => `<span class="player-name">${p}</span>`).join('');
        document.getElementById('team2Display').innerHTML = 
            match.team2.map(p => `<span class="player-name">${p}</span>`).join('');
        
        const team1Name = this.teamGenerator.formatTeamName(match.team1);
        const team2Name = this.teamGenerator.formatTeamName(match.team2);
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
        this.switchStatsTab('season');
    }

    switchStatsTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.getElementById('seasonStats').classList.toggle('active', tab === 'season');
        document.getElementById('overallStats').classList.toggle('active', tab === 'overall');

        const currentSeason = this.seasonManager.getCurrentSeason();
        if (tab === 'season') {
            this.statisticsDisplay.displaySeasonStats(currentSeason, document.getElementById('seasonStatsDisplay'));
        } else {
            this.statisticsDisplay.displayOverallStats(document.getElementById('overallStatsDisplay'));
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
                this.switchStatsTab('season');
                // Reload the statistics display
                this.loadStatistics();
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

