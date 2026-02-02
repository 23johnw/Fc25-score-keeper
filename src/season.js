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

export { SeasonManager };

