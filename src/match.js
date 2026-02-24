// ============================================================================
// MatchRecorder - Record and manage matches (classic script for global use)
// Mirrors data-handler.js record/find/update/delete for apps that load scripts without ES modules.
// ============================================================================

import {
    toTeamArray,
    resolveFinalScores,
    determineMatchResult,
    recomputeOverallPlayersFromData
} from './utils/match-derived-stats.js';

class MatchRecorder {
    constructor(storage, seasonManager, playerManager) {
        this.storage = storage;
        this.seasonManager = seasonManager;
        this.playerManager = playerManager;
    }

    _getPlayerPresenceSnapshot(team1, team2) {
        const team1Arr = toTeamArray(team1);
        const team2Arr = toTeamArray(team2);
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
        const finalScores = resolveFinalScores(matchData);
        const result = determineMatchResult(finalScores.team1, finalScores.team2);

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

            const team1Players = toTeamArray(matchData.team1);
            const team2Players = toTeamArray(matchData.team2);
            const isPresent = (player) => playerPresence[player] !== false;

            if (match.result === 'team1') {
                team1Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 1, 0, 0, finalScores.team1, finalScores.team2);
                });
                team2Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 0, 1, 0, finalScores.team2, finalScores.team1);
                });
            } else if (match.result === 'team2') {
                team1Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 0, 1, 0, finalScores.team1, finalScores.team2);
                });
                team2Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 1, 0, 0, finalScores.team2, finalScores.team1);
                });
            } else {
                team1Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 0, 0, 1, finalScores.team1, finalScores.team2);
                });
                team2Players.forEach(p => {
                    if (isPresent(p)) updatePlayerStats(p, 0, 0, 1, finalScores.team2, finalScores.team1);
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

        const finalScores = resolveFinalScores({
            team1Score: nextTeam1Score,
            team2Score: nextTeam2Score,
            team1ExtraTimeScore: nextTeam1Extra,
            team2ExtraTimeScore: nextTeam2Extra,
            team1PenaltiesScore: nextTeam1Pens,
            team2PenaltiesScore: nextTeam2Pens
        });
        const newResult = determineMatchResult(finalScores.team1, finalScores.team2);

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
                data.overallStats.players = recomputeOverallPlayersFromData(data);
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
                data.overallStats.players = recomputeOverallPlayersFromData(data);
            }
        });
    }
}

export { MatchRecorder };
