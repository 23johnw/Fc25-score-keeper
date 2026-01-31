// ============================================================================
// MatchRecorder - Record and manage matches (classic script for global use)
// Mirrors data-handler.js record/find/update/delete for apps that load scripts without ES modules.
// ============================================================================

class MatchRecorder {
    constructor(storage, seasonManager, playerManager) {
        this.storage = storage;
        this.seasonManager = seasonManager;
        this.playerManager = playerManager;
    }

    _getPlayerPresenceSnapshot(team1, team2) {
        const team1Arr = Array.isArray(team1) ? team1 : [team1];
        const team2Arr = Array.isArray(team2) ? team2 : [team2];
        const allPlayers = [...new Set([...team1Arr, ...team2Arr])];
        const snapshot = {};
        allPlayers.forEach(player => {
            snapshot[player] = this.playerManager && typeof this.playerManager.isPlayerPresent === 'function'
                ? this.playerManager.isPlayerPresent(player)
                : true;
        });
        return snapshot;
    }

    recordMatch(matchData) {
        let finalTeam1Score = matchData.score1;
        let finalTeam2Score = matchData.score2;

        if (matchData.penaltiesScore1 != null && matchData.penaltiesScore2 != null) {
            finalTeam1Score = matchData.penaltiesScore1;
            finalTeam2Score = matchData.penaltiesScore2;
        } else if (matchData.extraTimeScore1 != null && matchData.extraTimeScore2 != null) {
            finalTeam1Score = matchData.extraTimeScore1;
            finalTeam2Score = matchData.extraTimeScore2;
        }

        let result;
        if (finalTeam1Score > finalTeam2Score) result = 'team1';
        else if (finalTeam2Score > finalTeam1Score) result = 'team2';
        else result = 'draw';

        const timestamp = matchData.timestamp || new Date().toISOString();
        const playerPresence = this._getPlayerPresenceSnapshot(matchData.team1, matchData.team2);

        const match = {
            team1: matchData.team1,
            team2: matchData.team2,
            team1Score: matchData.score1,
            team2Score: matchData.score2,
            result: result,
            timestamp: timestamp,
            playerPresence: playerPresence
        };
        if (matchData.team1Name) match.team1Name = matchData.team1Name;
        if (matchData.team2Name) match.team2Name = matchData.team2Name;
        if (matchData.team1League != null) match.team1League = matchData.team1League;
        if (matchData.team2League != null) match.team2League = matchData.team2League;
        if (matchData.extraTimeScore1 != null && matchData.extraTimeScore2 != null) {
            match.team1ExtraTimeScore = matchData.extraTimeScore1;
            match.team2ExtraTimeScore = matchData.extraTimeScore2;
        }
        if (matchData.penaltiesScore1 != null && matchData.penaltiesScore2 != null) {
            match.team1PenaltiesScore = matchData.penaltiesScore1;
            match.team2PenaltiesScore = matchData.penaltiesScore2;
        }

        const currentSeason = this.seasonManager.getCurrentSeason();
        const saved = this.storage.updateData(data => {
            if (!data.seasons[currentSeason]) {
                data.seasons[currentSeason] = { matches: [], startDate: new Date().toISOString() };
            }
            data.seasons[currentSeason].matches.push(match);
            data.overallStats.totalMatches = (data.overallStats.totalMatches || 0) + 1;

            const updatePlayerStats = (player, wins, losses, draws, goalsFor, goalsAgainst) => {
                if (!data.overallStats.players[player]) {
                    data.overallStats.players[player] = { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 };
                }
                const p = data.overallStats.players[player];
                p.wins += wins;
                p.losses += losses;
                p.draws += draws;
                p.goalsFor += goalsFor;
                p.goalsAgainst += goalsAgainst;
            };

            const team1Players = Array.isArray(matchData.team1) ? matchData.team1 : [matchData.team1];
            const team2Players = Array.isArray(matchData.team2) ? matchData.team2 : [matchData.team2];

            if (match.result === 'team1') {
                team1Players.forEach(p => updatePlayerStats(p, 1, 0, 0, finalTeam1Score, finalTeam2Score));
                team2Players.forEach(p => updatePlayerStats(p, 0, 1, 0, finalTeam2Score, finalTeam1Score));
            } else if (match.result === 'team2') {
                team1Players.forEach(p => updatePlayerStats(p, 0, 1, 0, finalTeam1Score, finalTeam2Score));
                team2Players.forEach(p => updatePlayerStats(p, 1, 0, 0, finalTeam2Score, finalTeam1Score));
            } else {
                team1Players.forEach(p => updatePlayerStats(p, 0, 0, 1, finalTeam1Score, finalTeam2Score));
                team2Players.forEach(p => updatePlayerStats(p, 0, 0, 1, finalTeam2Score, finalTeam1Score));
            }
        });

        return saved ? match : null;
    }

    findMatch(timestamp) {
        const data = this.storage.getData();
        for (const [seasonNum, season] of Object.entries(data.seasons || {})) {
            if (season.matches) {
                const index = season.matches.findIndex(m => m.timestamp === timestamp);
                if (index !== -1) {
                    return { season: parseInt(seasonNum, 10), index };
                }
            }
        }
        return null;
    }

    updateMatch(timestamp, newTeam1Score, newTeam2Score, newTeam1ExtraTimeScore, newTeam2ExtraTimeScore, newTeam1PenaltiesScore, newTeam2PenaltiesScore) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        let finalTeam1 = newTeam1Score;
        let finalTeam2 = newTeam2Score;
        if (newTeam1PenaltiesScore != null && newTeam2PenaltiesScore != null) {
            finalTeam1 = newTeam1PenaltiesScore;
            finalTeam2 = newTeam2PenaltiesScore;
        } else if (newTeam1ExtraTimeScore != null && newTeam2ExtraTimeScore != null) {
            finalTeam1 = newTeam1ExtraTimeScore;
            finalTeam2 = newTeam2ExtraTimeScore;
        }

        let newResult = finalTeam1 > finalTeam2 ? 'team1' : (finalTeam2 > finalTeam1 ? 'team2' : 'draw');

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches[matchInfo.index]) {
                const match = season.matches[matchInfo.index];
                match.team1Score = newTeam1Score;
                match.team2Score = newTeam2Score;
                match.result = newResult;
                if (newTeam1ExtraTimeScore != null && newTeam2ExtraTimeScore != null) {
                    match.team1ExtraTimeScore = newTeam1ExtraTimeScore;
                    match.team2ExtraTimeScore = newTeam2ExtraTimeScore;
                } else {
                    delete match.team1ExtraTimeScore;
                    delete match.team2ExtraTimeScore;
                }
                if (newTeam1PenaltiesScore != null && newTeam2PenaltiesScore != null) {
                    match.team1PenaltiesScore = newTeam1PenaltiesScore;
                    match.team2PenaltiesScore = newTeam2PenaltiesScore;
                } else {
                    delete match.team1PenaltiesScore;
                    delete match.team2PenaltiesScore;
                }
            }
        });
    }

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
}
