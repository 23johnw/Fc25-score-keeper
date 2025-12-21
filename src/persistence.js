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

