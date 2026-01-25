// ============================================================================
// LocalStorageManager - Data Persistence
// ============================================================================

class LocalStorageManager {
    constructor() {
        this.storageKey = 'fc25_score_tracker';
        this.data = this.loadData();
    }

    initializeByDatePanel() {
        const closeBtn = document.getElementById('closeByDatePanel');
        const applyBtn = document.getElementById('applyByDateBtn');
        const clearBtn = document.getElementById('clearByDateBtn');
        const listContainer = document.getElementById('byDateList');
        const fromInput = document.getElementById('byDateFrom');
        const toInput = document.getElementById('byDateTo');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleByDatePanel(false));
        }
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyByDateFilter());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearByDateFilter());
        }

        if (listContainer) {
            this.renderByDateList(listContainer);
        }

        if (fromInput) {
            fromInput.addEventListener('change', (e) => {
                this.currentByDateFilter.from = e.target.value || null;
            });
        }
        if (toInput) {
            toInput.addEventListener('change', (e) => {
                this.currentByDateFilter.to = e.target.value || null;
            });
        }
    }

    toggleByDatePanel(show = false) {
        const panel = document.getElementById('byDatePanel');
        if (!panel) return;
        panel.style.display = show ? 'flex' : 'none';
        if (show) {
            const listContainer = document.getElementById('byDateList');
            if (listContainer) {
                this.renderByDateList(listContainer);
            }
        }
    }

    updatePlayedDates() {
        const allMatches = this.statisticsTracker.getAllMatches();
        const dateSet = new Set();
        allMatches.forEach(match => {
            if (match.timestamp) {
                const dateKey = new Date(match.timestamp).toISOString().split('T')[0];
                dateSet.add(dateKey);
            }
        });
        this.playedDates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));
    }

    renderByDateList(container) {
        const dates = this.playedDates || [];
        if (dates.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h4>No Dates</h4><p>Play some matches to enable date filtering.</p></div>';
            return;
        }
        container.innerHTML = dates.map(dateStr => {
            const isSelected = this.currentByDateFilter.selectedDate === dateStr;
            return `
                <button class="by-date-pill ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                    ${dateStr}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.by-date-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.date;
                this.currentByDateFilter.selectedDate = chosen;
                this.currentByDateFilter.from = null;
                this.currentByDateFilter.to = null;
                const fromInput = document.getElementById('byDateFrom');
                const toInput = document.getElementById('byDateTo');
                if (fromInput) fromInput.value = '';
                if (toInput) toInput.value = '';
                this.renderByDateList(container);
            });
        });
    }

    clearByDateFilter() {
        this.currentByDateFilter = { from: null, to: null, selectedDate: null };
        const fromInput = document.getElementById('byDateFrom');
        const toInput = document.getElementById('byDateTo');
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
        const listContainer = document.getElementById('byDateList');
        if (listContainer) this.renderByDateList(listContainer);
        this.applyByDateFilter();
    }

    applyByDateFilter() {
        // If a single date is selected, use that; otherwise use range
        const { selectedDate, from, to } = this.currentByDateFilter || {};
        let rangeFrom = null;
        let rangeTo = null;

        if (selectedDate) {
            rangeFrom = selectedDate;
            rangeTo = selectedDate;
        } else {
            rangeFrom = from || null;
            rangeTo = to || null;
        }

        this.currentByDateFilter = { selectedDate: null, from: rangeFrom, to: rangeTo };

        // Re-render current stats view using filtered matches
        this.refreshCurrentStatsWithDateFilter();
        this.toggleByDatePanel(false);
    }

    refreshCurrentStatsWithDateFilter() {
        // Determine active stats tab
        const activeTabBtn = document.querySelector('.tab-btn.active');
        const tab = activeTabBtn ? activeTabBtn.dataset.tab : 'today';

        // Force reload of stats with filter applied
        this.switchStatsTab(tab);
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

