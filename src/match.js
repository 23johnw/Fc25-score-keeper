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
            const isPresent = (player) => playerPresence[player] !== false;

            if (match.result === 'team1') {
                team1Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 1, 0, 0, finalTeam1Score, finalTeam2Score);
                });
                team2Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 0, 1, 0, finalTeam2Score, finalTeam1Score);
                });
            } else if (match.result === 'team2') {
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

    updateMatch(timestamp, updateOrTeam1Score, newTeam2Score, newTeam1ExtraTimeScore, newTeam2ExtraTimeScore, newTeam1PenaltiesScore, newTeam2PenaltiesScore) {
        const matchInfo = this.findMatch(timestamp);
        if (!matchInfo) return false;

        const update = (typeof updateOrTeam1Score === 'object' && updateOrTeam1Score !== null)
            ? updateOrTeam1Score
            : {
                team1Score: updateOrTeam1Score,
                team2Score: newTeam2Score,
                team1ExtraTimeScore: newTeam1ExtraTimeScore,
                team2ExtraTimeScore: newTeam2ExtraTimeScore,
                team1PenaltiesScore: newTeam1PenaltiesScore,
                team2PenaltiesScore: newTeam2PenaltiesScore
            };

        const nextTeam1 = Array.isArray(update.team1) ? [...update.team1] : null;
        const nextTeam2 = Array.isArray(update.team2) ? [...update.team2] : null;
        const nextTeam1Score = Number(update.team1Score) || 0;
        const nextTeam2Score = Number(update.team2Score) || 0;
        const nextTeam1Extra = update.team1ExtraTimeScore != null ? (Number(update.team1ExtraTimeScore) || 0) : null;
        const nextTeam2Extra = update.team2ExtraTimeScore != null ? (Number(update.team2ExtraTimeScore) || 0) : null;
        const nextTeam1Pens = update.team1PenaltiesScore != null ? (Number(update.team1PenaltiesScore) || 0) : null;
        const nextTeam2Pens = update.team2PenaltiesScore != null ? (Number(update.team2PenaltiesScore) || 0) : null;

        let finalTeam1 = nextTeam1Score;
        let finalTeam2 = nextTeam2Score;
        if (nextTeam1Pens != null && nextTeam2Pens != null) {
            finalTeam1 = nextTeam1Pens;
            finalTeam2 = nextTeam2Pens;
        } else if (nextTeam1Extra != null && nextTeam2Extra != null) {
            finalTeam1 = nextTeam1Extra;
            finalTeam2 = nextTeam2Extra;
        }

        const newResult = finalTeam1 > finalTeam2 ? 'team1' : (finalTeam2 > finalTeam1 ? 'team2' : 'draw');

        return this.storage.updateData(data => {
            const season = data.seasons[matchInfo.season];
            if (season && season.matches[matchInfo.index]) {
                const match = season.matches[matchInfo.index];
                if (nextTeam1) match.team1 = nextTeam1;
                if (nextTeam2) match.team2 = nextTeam2;
                match.team1Score = nextTeam1Score;
                match.team2Score = nextTeam2Score;
                match.result = newResult;
                if (nextTeam1Extra != null && nextTeam2Extra != null) {
                    match.team1ExtraTimeScore = nextTeam1Extra;
                    match.team2ExtraTimeScore = nextTeam2Extra;
                } else {
                    delete match.team1ExtraTimeScore;
                    delete match.team2ExtraTimeScore;
                }
                if (nextTeam1Pens != null && nextTeam2Pens != null) {
                    match.team1PenaltiesScore = nextTeam1Pens;
                    match.team2PenaltiesScore = nextTeam2Pens;
                } else {
                    delete match.team1PenaltiesScore;
                    delete match.team2PenaltiesScore;
                }

                if (update.team1Name !== undefined) {
                    if (update.team1Name) match.team1Name = String(update.team1Name);
                    else delete match.team1Name;
                }
                if (update.team2Name !== undefined) {
                    if (update.team2Name) match.team2Name = String(update.team2Name);
                    else delete match.team2Name;
                }
                if (update.team1League !== undefined) {
                    if (update.team1League) match.team1League = String(update.team1League);
                    else delete match.team1League;
                }
                if (update.team2League !== undefined) {
                    if (update.team2League) match.team2League = String(update.team2League);
                    else delete match.team2League;
                }

                // Rebuild playerPresence for edited lineups.
                const oldPresence = (match.playerPresence && typeof match.playerPresence === 'object') ? match.playerPresence : {};
                const explicitPresence = (update.playerPresence && typeof update.playerPresence === 'object') ? update.playerPresence : null;
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const allPlayers = [...new Set([...team1Players, ...team2Players])];
                const rebuiltPresence = {};
                allPlayers.forEach(player => {
                    if (explicitPresence && (explicitPresence[player] === false || explicitPresence[player] === true)) {
                        rebuiltPresence[player] = explicitPresence[player];
                    } else if (oldPresence[player] === false || oldPresence[player] === true) {
                        rebuiltPresence[player] = oldPresence[player];
                    } else {
                        rebuiltPresence[player] = this.playerManager && typeof this.playerManager.isPlayerPresent === 'function'
                            ? this.playerManager.isPlayerPresent(player)
                            : true;
                    }
                });
                match.playerPresence = rebuiltPresence;
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

export { MatchRecorder };
