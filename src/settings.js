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

