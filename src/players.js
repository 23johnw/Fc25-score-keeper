// ============================================================================
// PlayerManager - Player CRUD Operations

// Player Data Model
type PlayerStats = {
    teamStats: Record<string, {
        goals: number,
        assists: number,
        appearances: number
    }>,
    overallStats: {
        goals: number,
        assists: number,
        appearances: number
    }
};
// ============================================================================

class PlayerManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.firebaseStore = null; // Will be set by app controller
    }

    setFirebaseStore(firebaseStore) {
        this.firebaseStore = firebaseStore;
    }

    getPlayers() {
        // If Firebase mode, use active players list (or extract from matches if not set)
        if (this.firebaseStore) {
            const activePlayers = this.firebaseStore.getActivePlayers();

            // If active players list exists, use it
            if (activePlayers && activePlayers.length > 0) {
                return activePlayers;
            }
            
            // Otherwise extract from matches (fallback for backwards compatibility)
            const matches = this.firebaseStore.getMatches();
            const playerSet = new Set();
            
            matches.forEach(match => {
                const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
                team1.forEach(p => p && playerSet.add(p));
                team2.forEach(p => p && playerSet.add(p));
            });
            
            // Also include any players from local storage (for backwards compatibility)
            const localPlayers = this.storage.getData().players || [];
            localPlayers.forEach(p => p && playerSet.add(p));
            
            const players = Array.from(playerSet).sort();
            return players;
        }
        
        // Otherwise use local storage
        return this.storage.getData().players || [];
    }

    async setPlayers(players) {
        const validPlayers = players.filter(p => p && p.trim().length > 0);
        if (validPlayers.length < 1 || validPlayers.length > 4) {
            return false;
        }

        // Save to Firebase if available
        if (this.firebaseStore) {
            try {
                await this.firebaseStore.saveActivePlayers(validPlayers);
            } catch (error) {
                console.error('Error saving players to Firebase:', error);
                // Continue to save locally even if Firebase fails
            }
        }
        
        // Also save to local storage
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
        // If Firebase mode, use the same logic as getPlayers (extract from matches)
        if (this.firebaseStore) {
            return this.getPlayers(); // In Firebase mode, all players from matches are the history
        }
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

