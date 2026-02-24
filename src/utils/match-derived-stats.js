// ============================================================================
// Match-derived stat helpers
// ============================================================================

function toTeamArray(team) {
    return Array.isArray(team) ? team : [team];
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve final result scores using penalties > extra time > full time.
 * Supports both match records and recordMatch input payloads.
 */
function resolveFinalScores(matchLike = {}) {
    const fullTimeTeam1 = toNumber(matchLike.team1Score ?? matchLike.score1);
    const fullTimeTeam2 = toNumber(matchLike.team2Score ?? matchLike.score2);

    const penaltiesTeam1 = matchLike.team1PenaltiesScore ?? matchLike.penaltiesScore1;
    const penaltiesTeam2 = matchLike.team2PenaltiesScore ?? matchLike.penaltiesScore2;
    if (penaltiesTeam1 != null && penaltiesTeam2 != null) {
        return {
            team1: toNumber(penaltiesTeam1),
            team2: toNumber(penaltiesTeam2),
            source: 'penalties'
        };
    }

    const extraTeam1 = matchLike.team1ExtraTimeScore ?? matchLike.extraTimeScore1;
    const extraTeam2 = matchLike.team2ExtraTimeScore ?? matchLike.extraTimeScore2;
    if (extraTeam1 != null && extraTeam2 != null) {
        return {
            team1: toNumber(extraTeam1),
            team2: toNumber(extraTeam2),
            source: 'extraTime'
        };
    }

    return {
        team1: fullTimeTeam1,
        team2: fullTimeTeam2,
        source: 'fullTime'
    };
}

function determineMatchResult(team1Score, team2Score) {
    if (team1Score > team2Score) return 'team1';
    if (team2Score > team1Score) return 'team2';
    return 'draw';
}

function recomputeOverallPlayersFromData(data) {
    const computed = {};
    const ensurePlayer = (player) => {
        if (!computed[player]) {
            computed[player] = { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 };
        }
        return computed[player];
    };
    const updatePlayer = (player, wins, losses, draws, goalsFor, goalsAgainst) => {
        const s = ensurePlayer(player);
        s.wins += wins;
        s.losses += losses;
        s.draws += draws;
        s.goalsFor += goalsFor;
        s.goalsAgainst += goalsAgainst;
    };

    Object.values(data.seasons || {}).forEach(season => {
        if (!season || !Array.isArray(season.matches)) return;
        season.matches.forEach(match => {
            const team1Players = toTeamArray(match.team1);
            const team2Players = toTeamArray(match.team2);
            const presence = (match.playerPresence && typeof match.playerPresence === 'object') ? match.playerPresence : {};
            const isPresent = (player) => presence[player] !== false;
            const finalScores = resolveFinalScores(match);
            const result = determineMatchResult(finalScores.team1, finalScores.team2);

            if (result === 'team1') {
                team1Players.forEach(player => {
                    if (isPresent(player)) updatePlayer(player, 1, 0, 0, finalScores.team1, finalScores.team2);
                });
                team2Players.forEach(player => {
                    if (isPresent(player)) updatePlayer(player, 0, 1, 0, finalScores.team2, finalScores.team1);
                });
            } else if (result === 'team2') {
                team1Players.forEach(player => {
                    if (isPresent(player)) updatePlayer(player, 0, 1, 0, finalScores.team1, finalScores.team2);
                });
                team2Players.forEach(player => {
                    if (isPresent(player)) updatePlayer(player, 1, 0, 0, finalScores.team2, finalScores.team1);
                });
            } else {
                team1Players.forEach(player => {
                    if (isPresent(player)) updatePlayer(player, 0, 0, 1, finalScores.team1, finalScores.team2);
                });
                team2Players.forEach(player => {
                    if (isPresent(player)) updatePlayer(player, 0, 0, 1, finalScores.team2, finalScores.team1);
                });
            }
        });
    });

    const knownPlayers = new Set([
        ...(Array.isArray(data.players) ? data.players : []),
        ...Object.keys((data.overallStats && data.overallStats.players) || {})
    ]);
    knownPlayers.forEach(player => ensurePlayer(player));

    return computed;
}

export {
    toTeamArray,
    resolveFinalScores,
    determineMatchResult,
    recomputeOverallPlayersFromData
};
