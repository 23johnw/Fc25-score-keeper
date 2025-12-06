// ============================================================================
// MatchRecorder - Record Match Results
// ============================================================================

class MatchRecorder {
    constructor(storageManager, seasonManager) {
        this.storage = storageManager;
        this.seasonManager = seasonManager;
    }

    recordMatch(team1, team2, team1Score, team2Score, team1ExtraTimeScore = null, team2ExtraTimeScore = null, team1PenaltiesScore = null, team2PenaltiesScore = null) {
        // Determine result from scores (use penalties if available, otherwise extra time, otherwise full time)
        let finalTeam1Score = team1Score;
        let finalTeam2Score = team2Score;
        
        if (team1PenaltiesScore !== null && team2PenaltiesScore !== null) {
            // Use penalties score for result determination
            finalTeam1Score = team1PenaltiesScore;
            finalTeam2Score = team2PenaltiesScore;
        } else if (team1ExtraTimeScore !== null && team2ExtraTimeScore !== null) {
            // Use extra time score for result determination
            finalTeam1Score = team1ExtraTimeScore;
            finalTeam2Score = team2ExtraTimeScore;
        }
        
        let result;
        if (finalTeam1Score > finalTeam2Score) {
            result = 'team1';
        } else if (finalTeam2Score > finalTeam1Score) {
            result = 'team2';
        } else {
            result = 'draw';
        }

        const timestamp = new Date().toISOString();
        const match = {
            team1: team1,
            team2: team2,
            team1Score: team1Score,
            team2Score: team2Score,
            result: result, // Automatically determined from scores
            timestamp
        };

        // Add extra time scores if provided
        if (team1ExtraTimeScore !== null && team2ExtraTimeScore !== null) {
            match.team1ExtraTimeScore = team1ExtraTimeScore;
            match.team2ExtraTimeScore = team2ExtraTimeScore;
        }

        // Add penalties scores if provided
        if (team1PenaltiesScore !== null && team2PenaltiesScore !== null) {
            match.team1PenaltiesScore = team1PenaltiesScore;
            match.team2PenaltiesScore = team2PenaltiesScore;
        }

        const currentSeason = this.seasonManager.getCurrentSeason();
        const saved = this.storage.updateData(data => {
            if (!data.seasons[currentSeason]) {
                data.seasons[currentSeason] = { matches: [], startDate: new Date().toISOString() };
            }
            data.seasons[currentSeason].matches.push(match);
            data.overallStats.totalMatches = (data.overallStats.totalMatches || 0) + 1;
        });

        return saved ? match : null;
    }

    getCurrentSeasonMatches() {
        const currentSeason = this.seasonManager.getCurrentSeason();
        const data = this.storage.getData();
        const season = data.seasons[currentSeason];
        return season ? season.matches || [] : [];
    }

    // Find match by timestamp and season, return {season, index}
    findMatch(timestamp) {
        const data = this.storage.getData();
        for (const [seasonNum, season] of Object.entries(data.seasons)) {
            if (season.matches) {
                const index = season.matches.findIndex(m => m.timestamp === timestamp);
                if (index !== -1) {
                    return { season: parseInt(seasonNum), index };
                }
            }
        }
        return null;
    }

    // Update a match
    updateMatch(timestamp, newTeam1Score, newTeam2Score, newTeam1ExtraTimeScore = null, newTeam2ExtraTimeScore = null, newTeam1PenaltiesScore = null, newTeam2PenaltiesScore = null) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        // Determine result from scores (use penalties if available, otherwise extra time, otherwise full time)
        let finalTeam1Score = newTeam1Score;
        let finalTeam2Score = newTeam2Score;
        
        if (newTeam1PenaltiesScore !== null && newTeam2PenaltiesScore !== null) {
            finalTeam1Score = newTeam1PenaltiesScore;
            finalTeam2Score = newTeam2PenaltiesScore;
        } else if (newTeam1ExtraTimeScore !== null && newTeam2ExtraTimeScore !== null) {
            finalTeam1Score = newTeam1ExtraTimeScore;
            finalTeam2Score = newTeam2ExtraTimeScore;
        }
        
        let newResult;
        if (finalTeam1Score > finalTeam2Score) {
            newResult = 'team1';
        } else if (finalTeam2Score > finalTeam1Score) {
            newResult = 'team2';
        } else {
            newResult = 'draw';
        }

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches[matchInfo.index]) {
                const match = season.matches[matchInfo.index];
                match.team1Score = newTeam1Score;
                match.team2Score = newTeam2Score;
                match.result = newResult;
                
                // Update or remove extra time scores
                if (newTeam1ExtraTimeScore !== null && newTeam2ExtraTimeScore !== null) {
                    match.team1ExtraTimeScore = newTeam1ExtraTimeScore;
                    match.team2ExtraTimeScore = newTeam2ExtraTimeScore;
                } else {
                    delete match.team1ExtraTimeScore;
                    delete match.team2ExtraTimeScore;
                }
                
                // Update or remove penalties scores
                if (newTeam1PenaltiesScore !== null && newTeam2PenaltiesScore !== null) {
                    match.team1PenaltiesScore = newTeam1PenaltiesScore;
                    match.team2PenaltiesScore = newTeam2PenaltiesScore;
                } else {
                    delete match.team1PenaltiesScore;
                    delete match.team2PenaltiesScore;
                }
            }
        });
    }

    // Delete a match
    deleteMatch(timestamp) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches) {
                season.matches.splice(matchInfo.index, 1);
                if (data.overallStats.totalMatches > 0) {
                    data.overallStats.totalMatches--;
                }
            }
        });
    }

    // Delete the most recently recorded match in the current season
    deleteLastMatch() {
        const currentSeason = this.seasonManager.getCurrentSeason();
        const data = this.storage.getData();
        const season = data.seasons[currentSeason];
        if (!season || !season.matches || season.matches.length === 0) {
            return null;
        }

        const removedMatch = season.matches[season.matches.length - 1];

        this.storage.updateData(d => {
            const s = d.seasons[currentSeason];
            if (s && s.matches && s.matches.length > 0) {
                s.matches.pop();
                if (d.overallStats.totalMatches > 0) {
                    d.overallStats.totalMatches--;
                }
            }
        });

        return removedMatch;
    }
}

