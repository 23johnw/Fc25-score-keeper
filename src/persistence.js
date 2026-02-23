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
                const data = this.applyDefaults(parsed);
                // Set this.data first so migration can save if needed
                this.data = data;
                // Run migrations to fix old data
                this.migratePlayerPresence(data);
                this.migrateOverallStatsForPresence(data);
                return this.data;
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        const defaultData = this.getDefaultData();
        this.data = defaultData;
        return defaultData;
    }

    /**
     * Migration: Retroactively mark players as absent in old matches where their partner was solo
     * This ensures the Ghost Proxy system works correctly for historical data
     */
    migratePlayerPresence(data) {
        if (!data.seasons) return;
        
        let updated = 0;
        let needsSave = false;
        
        // Get all known partnerships from match history
        const partnerships = new Map(); // Map<player, Set<partners>>
        
        // First pass: identify partnerships by finding players who have played together
        Object.values(data.seasons).forEach(season => {
            if (!season.matches) return;
            season.matches.forEach(match => {
                const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const allPlayers = [...new Set([...team1, ...team2])];
                
                // For each team, record partnerships (players who played together)
                if (team1.length > 1) {
                    team1.forEach(p1 => {
                        team1.forEach(p2 => {
                            if (p1 !== p2) {
                                if (!partnerships.has(p1)) partnerships.set(p1, new Set());
                                if (!partnerships.has(p2)) partnerships.set(p2, new Set());
                                partnerships.get(p1).add(p2);
                                partnerships.get(p2).add(p1);
                            }
                        });
                    });
                }
                if (team2.length > 1) {
                    team2.forEach(p1 => {
                        team2.forEach(p2 => {
                            if (p1 !== p2) {
                                if (!partnerships.has(p1)) partnerships.set(p1, new Set());
                                if (!partnerships.has(p2)) partnerships.set(p2, new Set());
                                partnerships.get(p1).add(p2);
                                partnerships.get(p2).add(p1);
                            }
                        });
                    });
                }
            });
        });
        
        // Second pass: fix playerPresence for solo matches
        Object.values(data.seasons).forEach(season => {
            if (!season.matches) return;
            season.matches.forEach(match => {
                const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
                
                if (!match.playerPresence) {
                    match.playerPresence = {};
                    needsSave = true;
                }
                
                const presence = match.playerPresence;
                
                // Check each player who has known partnerships
                partnerships.forEach((partners, player) => {
                    const playerInT1 = team1.includes(player);
                    const playerInT2 = team2.includes(player);
                    const playerSolo = (playerInT1 && team1.length === 1) || (playerInT2 && team2.length === 1);
                    
                    if (playerSolo) {
                        // Player is solo - check if any of their partners should be marked absent
                        partners.forEach(partner => {
                            const partnerInT1 = team1.includes(partner);
                            const partnerInT2 = team2.includes(partner);
                            const partnerNotPresent = !partnerInT1 && !partnerInT2;
                            
                            // If partner is not in either team and not already marked absent, mark them as absent
                            if (partnerNotPresent && presence[partner] !== false) {
                                presence[partner] = false;
                                updated++;
                                needsSave = true;
                            }
                        });
                    }
                });
            });
        });
        
        if (needsSave && updated > 0) {
            console.log(`Migration: Updated ${updated} player presence entries for Ghost Proxy system`);
            this.data = data;
            this.saveData();
        }
    }

    /**
     * Migration: Recompute overallStats.players from match history using playerPresence.
     * Team/match totals stay unchanged; absent players should not receive individual attribution.
     */
    migrateOverallStatsForPresence(data) {
        if (!data || !data.seasons) return;

        const makeEmptyStats = () => ({ wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 });
        const computed = {};

        const ensurePlayer = (player) => {
            if (!computed[player]) {
                computed[player] = makeEmptyStats();
            }
            return computed[player];
        };

        const updatePlayerStats = (player, wins, losses, draws, goalsFor, goalsAgainst) => {
            const s = ensurePlayer(player);
            s.wins += wins;
            s.losses += losses;
            s.draws += draws;
            s.goalsFor += goalsFor;
            s.goalsAgainst += goalsAgainst;
        };

        Object.values(data.seasons).forEach(season => {
            if (!season || !Array.isArray(season.matches)) return;
            season.matches.forEach(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const presence = (match && typeof match.playerPresence === 'object' && match.playerPresence) ? match.playerPresence : {};
                const isPresent = (player) => presence[player] !== false;

                let finalTeam1Score = Number(match.team1Score) || 0;
                let finalTeam2Score = Number(match.team2Score) || 0;

                const hasPens = match.team1PenaltiesScore != null && match.team2PenaltiesScore != null;
                const hasExtra = match.team1ExtraTimeScore != null && match.team2ExtraTimeScore != null;
                if (hasPens) {
                    finalTeam1Score = Number(match.team1PenaltiesScore) || 0;
                    finalTeam2Score = Number(match.team2PenaltiesScore) || 0;
                } else if (hasExtra) {
                    finalTeam1Score = Number(match.team1ExtraTimeScore) || 0;
                    finalTeam2Score = Number(match.team2ExtraTimeScore) || 0;
                }

                const result = finalTeam1Score > finalTeam2Score
                    ? 'team1'
                    : (finalTeam2Score > finalTeam1Score ? 'team2' : 'draw');

                if (result === 'team1') {
                    team1Players.forEach(p => {
                        if (isPresent(p)) updatePlayerStats(p, 1, 0, 0, finalTeam1Score, finalTeam2Score);
                    });
                    team2Players.forEach(p => {
                        if (isPresent(p)) updatePlayerStats(p, 0, 1, 0, finalTeam2Score, finalTeam1Score);
                    });
                } else if (result === 'team2') {
                    team1Players.forEach(p => {
                        if (isPresent(p)) updatePlayerStats(p, 0, 1, 0, finalTeam1Score, finalTeam2Score);
                    });
                    team2Players.forEach(p => {
                        if (isPresent(p)) updatePlayerStats(p, 1, 0, 0, finalTeam2Score, finalTeam1Score);
                    });
                } else {
                    team1Players.forEach(p => {
                        if (isPresent(p)) updatePlayerStats(p, 0, 0, 1, finalTeam1Score, finalTeam2Score);
                    });
                    team2Players.forEach(p => {
                        if (isPresent(p)) updatePlayerStats(p, 0, 0, 1, finalTeam2Score, finalTeam1Score);
                    });
                }
            });
        });

        // Keep zeroed entries for known players so profile rows remain available.
        const knownPlayers = new Set([
            ...(Array.isArray(data.players) ? data.players : []),
            ...Object.keys((data.overallStats && data.overallStats.players) || {})
        ]);
        knownPlayers.forEach(player => ensurePlayer(player));

        const previous = JSON.stringify((data.overallStats && data.overallStats.players) || {});
        const next = JSON.stringify(computed);
        if (previous !== next) {
            if (!data.overallStats || typeof data.overallStats !== 'object') {
                data.overallStats = { players: {}, totalMatches: 0 };
            }
            data.overallStats.players = computed;
            this.data = data;
            this.saveData();
            console.log('Migration: Recomputed overall player stats with attendance-aware attribution');
        }
    }

    getDefaultData() {
        return {
            players: [],
            playerNameHistory: [], // Add this line to store previously used names
            uploadedTeamNames: [], // legacy: array of strings
            uploadedTeamEntries: [], // { league, name }[] from Sync Top Teams
            selectedLeagues: ['PL', 'PD', 'BL1', 'FL1'], // league codes to sync (default Top 4)
            teamsPerLeague: 5, // how many teams to fetch per league when syncing (1–20)
            currentSeason: 1,
            seasons: {},
            overallStats: {
                players: {},
                totalMatches: 0
            },
            playerLock: {
                player: null,
                side: 'neutral'
            },
            currentGameState: {
                screen: null, // Current screen the user was on
                selectedStructureIndex: null, // Which team structure was selected
                selectedStructure: null, // The actual structure data
                currentGameIndex: 0, // Which match in the sequence they're on
                currentMatch: null, // Current match being played (if any)
                enteredScores: null // Any scores that were entered but not submitted
            }
        };
    }

    // Save current game state
    saveCurrentGameState(gameState) {
        this.data.currentGameState = {
            ...this.data.currentGameState,
            ...gameState
        };
        this.saveData();
    }

    // Get current game state
    getCurrentGameState() {
        return this.data.currentGameState || this.getDefaultData().currentGameState;
    }

    // Clear current game state (when starting fresh)
    clearCurrentGameState() {
        this.data.currentGameState = this.getDefaultData().currentGameState;
        this.saveData();
    }

    applyDefaults(data) {
        const defaults = this.getDefaultData();
        const merged = {
            ...defaults,
            ...data,
            uploadedTeamNames: Array.isArray(data.uploadedTeamNames) ? data.uploadedTeamNames : defaults.uploadedTeamNames,
            uploadedTeamEntries: Array.isArray(data.uploadedTeamEntries) ? data.uploadedTeamEntries : (defaults.uploadedTeamEntries || []),
            selectedLeagues: Array.isArray(data.selectedLeagues) ? data.selectedLeagues : (defaults.selectedLeagues || []),
            teamsPerLeague: typeof data.teamsPerLeague === 'number' && data.teamsPerLeague >= 1 && data.teamsPerLeague <= 20
                ? data.teamsPerLeague
                : (defaults.teamsPerLeague ?? 5),
            seasons: data.seasons || defaults.seasons,
            overallStats: {
                ...defaults.overallStats,
                ...(data.overallStats || {})
            },
            playerLock: data.playerLock || defaults.playerLock,
            currentGameState: data.currentGameState || defaults.currentGameState
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

export { LocalStorageManager };

