// ============================================================================
// SettingsManager - Settings Management
// ============================================================================

class SettingsManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.settings = this.loadSettings();
    }

    getDefaultSettings() {
        return {
            labels: {
                home: 'Home',
                away: 'Away',
                neutral: 'Neutral'
            },
            pointsPerResult: {
                win: 1,
                draw: 1,
                loss: 0
            },
            playerColors: {},
            darkMode: false,
            useRandomTeams: false,
            useSameTeamName: false,
            useSameTeamPerRound: false
        };
    }

    loadSettings() {
        try {
            const data = this.storage.getData();
            if (data.settings) {
                return { ...this.getDefaultSettings(), ...data.settings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return this.getDefaultSettings();
    }

    saveSettings() {
        try {
            return this.storage.updateData(data => {
                data.settings = this.settings;
            });
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

    getPointsPerResult() {
        const defaults = this.getDefaultSettings().pointsPerResult;
        const stored = this.settings.pointsPerResult || {};
        const parseVal = (v, fallback) => {
            const num = Number(v);
            return Number.isFinite(num) ? num : fallback;
        };
        return {
            win: parseVal(stored.win, defaults.win),
            draw: parseVal(stored.draw, defaults.draw),
            loss: parseVal(stored.loss, defaults.loss)
        };
    }

    setPointsPerResult({ win, draw, loss }) {
        const defaults = this.getDefaultSettings().pointsPerResult;
        const parseVal = (v, fallback) => {
            const num = Number(v);
            return Number.isFinite(num) ? num : fallback;
        };
        this.settings.pointsPerResult = {
            win: parseVal(win, defaults.win),
            draw: parseVal(draw, defaults.draw),
            loss: parseVal(loss, defaults.loss)
        };
        return this.saveSettings();
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

    getUseRandomTeams() {
        return this.settings.useRandomTeams === true;
    }

    setUseRandomTeams(enabled) {
        this.settings.useRandomTeams = enabled === true;
        return this.saveSettings();
    }

    getUseSameTeamName() {
        return this.settings.useSameTeamName === true;
    }

    setUseSameTeamName(enabled) {
        this.settings.useSameTeamName = enabled === true;
        return this.saveSettings();
    }

    getUseSameTeamPerRound() {
        return this.settings.useSameTeamPerRound === true;
    }

    setUseSameTeamPerRound(enabled) {
        this.settings.useSameTeamPerRound = enabled === true;
        return this.saveSettings();
    }

    resetLabels() {
        this.settings.labels = { ...this.getDefaultSettings().labels };
        return this.saveSettings();
    }

    resetAll() {
        this.settings = this.getDefaultSettings();
        return this.saveSettings();
    }

    // Football Data API key (stored separately in localStorage for security)
    getFootballApiKey() {
        try {
            return localStorage.getItem('FOOTBALL_API_KEY') || '';
        } catch (e) {
            return '';
        }
    }

    setFootballApiKey(key) {
        try {
            if (key && key.trim()) {
                localStorage.setItem('FOOTBALL_API_KEY', key.trim());
            } else {
                localStorage.removeItem('FOOTBALL_API_KEY');
            }
            return true;
        } catch (e) {
            console.error('Error saving API key:', e);
            return false;
        }
    }

}

export { SettingsManager };

