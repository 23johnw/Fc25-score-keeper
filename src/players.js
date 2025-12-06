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

