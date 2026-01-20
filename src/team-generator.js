// ============================================================================
// TeamGenerator - Generate Round Structures
// ============================================================================

// Team Data Model
type TeamStats = {
    played: number,
    won: number,
    drawn: number,
    lost: number,
    gf: number,
    ga: number,
    gd: number,
    points: number
};
type Team = {
    id: string,
    players: string[],
    stats: TeamStats,
    optional: {
        history?: string[],
        form?: string,
        streaks?: string
    }
};

class TeamGenerator {
    // Generate all possible round structures where each structure is a complete set of matches
    generateRoundStructures(players, lock = { player: null, side: 'neutral' }) {
        const teamIds = players.map((p1, i1) => players.map((p2, i2) => i2 > i1 ? `team_${p1}_${p2}` : null)).flat().filter(Boolean);
        const teamIdDict = {};
        teamIds.forEach(id => teamIdDict[id] = {played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0});

    // Handle solo play - counts for team stats
    function handleSoloPlay(player) {
        return teamIds.includes(`team_${player}`) ? 'team' : 'player';
    }
        const count = players.length;
        const structures = [];

        if (count < 2) {
            return structures;
        }

        if (count === 2) {
            // Single structure with one 1v1 match
            structures.push({
                matches: [
                    {
                        team1: [players[0]],
                        team2: [players[1]]
                    }
                ]
            });
        } else if (count === 3) {
            // Generate all permutations of the 3-match structure
            // Base structure: [1&2 vs 3, 1&3 vs 2, 2&3 vs 1]
            const baseStructure = [
                { team1: [players[0], players[1]], team2: [players[2]] },
                { team1: [players[0], players[2]], team2: [players[1]] },
                { team1: [players[1], players[2]], team2: [players[0]] }
            ];
            
            // Generate all permutations of the base structure
            const permutations = this.getPermutations(baseStructure);
            permutations.forEach(perm => {
                structures.push({ matches: perm });
            });
        } else if (count === 4) {
            // Generate all permutations where player 0 pairs with 1, 2, 3 in different orders
            // Base structure: [1&2 vs 3&4, 1&3 vs 2&4, 1&4 vs 2&3]
            const baseStructure = [
                { team1: [players[0], players[1]], team2: [players[2], players[3]] },
                { team1: [players[0], players[2]], team2: [players[1], players[3]] },
                { team1: [players[0], players[3]], team2: [players[1], players[2]] }
            ];
            
            // Generate all permutations of the base structure
            const permutations = this.getPermutations(baseStructure);
            permutations.forEach(perm => {
                structures.push({ matches: perm });
            });
        }

        return this.applyPlayerLock(structures, players, lock);
    }

    // Helper function to generate all permutations of an array
    getPermutations(arr) {
        if (arr.length <= 1) return [arr];
        
        const permutations = [];
        
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
            const remainingPerms = this.getPermutations(remaining);
            
            for (const perm of remainingPerms) {
                permutations.push([current, ...perm]);
            }
        }
        
        return permutations;
    }

    applyPlayerLock(structures, players, lock) {
        const lockActive = lock && lock.player && lock.side && lock.side !== 'neutral' && players.includes(lock.player);

        return structures.map(structure => {
            const matches = structure.matches.map(match => {
                const originalTeam1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const originalTeam2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
                let team1 = [...originalTeam1];
                let team2 = [...originalTeam2];

                if (lockActive) {
                    const playerInTeam1 = team1.includes(lock.player);
                    const playerInTeam2 = team2.includes(lock.player);

                    if (lock.side === 'home' && playerInTeam2) {
                        [team1, team2] = [team2, team1];
                    } else if (lock.side === 'away' && playerInTeam1) {
                        [team1, team2] = [team2, team1];
                    }
                }

                return {
                    team1: [...team1],
                    team2: [...team2]
                };
            });

            return { matches };
        });
    }

    formatTeamName(team) {
        return team.join(' & ');
    }

    // Legacy method for backward compatibility (returns matches from first structure)
    generateCombinations(players) {
        const structures = this.generateRoundStructures(players);
        if (structures.length === 0) return [];
        return structures[0].matches;
    }
}

