// ============================================================================
// Statistics Calculators - Modular System
// ============================================================================

class StatisticsCalculators {
    static registry = [];

    static register(calculator) {
        if (calculator.id && calculator.name && calculator.calculate && calculator.display) {
            // Default category to 'general' if not specified
            if (!calculator.category) {
                calculator.category = 'general';
            }
            this.registry.push(calculator);
        }
    }
    
    static getByCategory(category) {
        return this.registry.filter(calc => calc.category === category);
    }
    
    static getBySubcategory(category, subcategory) {
        return this.registry.filter(calc => 
            calc.category === category && calc.subcategory === subcategory
        );
    }
    
    static getSubcategories(category) {
        const subcategories = new Set(
            this.registry
                .filter(calc => calc.category === category && calc.subcategory)
                .map(calc => calc.subcategory)
        );
        return Array.from(subcategories);
    }
    
    static getCategories() {
        const categories = new Set(this.registry.map(calc => calc.category));
        return Array.from(categories);
    }

    static getAll() {
        return this.registry;
    }

    static getById(id) {
        return this.registry.find(c => c.id === id);
    }
}

// Friendly groupings for the stats UI
const STAT_GROUPS = [
    {
        key: 'overview',
        label: 'Overview',
        calculatorIds: [
            'leaguePoints',
            'winLossDraw',
            'winRate',
            'streak',
            'form',
            'avgGoalsPerGame',
            'totalGoals',
            'goalDifference',
            'extraTimePenalties'
        ]
    },
    {
        key: 'trends',
        label: 'Trends',
        calculatorIds: [
            'winRateChart',
            'rollingWinRateChart',
            'trendAnalysis',
            'performanceInsights'
        ]
    },
    {
        key: 'goals',
        label: 'Goals',
        calculatorIds: [
            'goalsChart',
            'totalGoals',
            'goalDifference',
            'avgGoalsPerGame'
        ]
    },
    {
        key: 'comparisons',
        label: 'Comparisons',
        calculatorIds: [
            'headToHead',
            'comparativeStats',
            'comparisonBarChart'
        ]
    },
    {
        key: 'timeline',
        label: 'Timeline',
        calculatorIds: [
            'dailyMatchesChart',
            'dayOfWeekChart',
            'matchDistributionChart'
        ]
    }
];

// ============================================================================
// StatDescriptions - Provides descriptions for statistics tables
// ============================================================================

class StatDescriptions {
    static getUIDescription(calculatorId) {
        const descriptions = {
            'winLossDraw': 'Shows wins, losses, draws, and total games played for each player.',
            'winRate': 'Displays the win percentage for each player, calculated as (wins / games) × 100.',
            'streak': 'Shows the current consecutive win or loss streak for each player.',
            'totalGoals': 'Total goals scored by each player across all matches.',
            'goalDifference': 'Goal difference (goals for - goals against) for each player.',
            'leaguePoints': 'League table with points calculated as 1 point per win. Sorted by points.',
            'worstLosses': 'Records showing best wins (most goals scored, biggest margin) and worst losses (most goals conceded, biggest deficit).',
            'avgGoalsPerGame': 'Average number of goals scored per game for each player.',
            'form': 'Last 5 games form showing recent match results (W/D/L) and points earned.',
            'headToHead': 'Statistics for player pairs: "Together" shows results when playing as teammates, "Against" shows head-to-head matchups.',
            'trendAnalysis': 'Compares early vs recent performance to show if players are improving, declining, or stable. Strength percentage indicates how significant the trend is.',
            'comparativeStats': 'Direct comparison between player pairs showing win rates when facing each other.',
            'extraTimePenalties': 'Counts of matches that went to extra time or penalties for each player.',
            'winRateChart': 'Visual chart showing how win rate changes over time for each player.',
            'goalsChart': 'Visual chart displaying goals scored over time for each player.',
            'matchDistributionChart': 'Visual chart showing the distribution of matches across different time periods.',
            'performanceInsights': 'Text-based insights and analysis of player performance patterns and trends.',
            'dailyMatchesChart': 'Line chart showing how many matches were played on each date.',
            'dayOfWeekChart': 'Bar chart showing which days of the week you play most often.',
            'rollingWinRateChart': 'Rolling (last 5 games) win rate trend per player to spot short-term form.',
            'comparisonBarChart': 'Side-by-side comparison of win rate and games played for each player.'
        };
        return descriptions[calculatorId] || null;
    }

    static getPDFDescription(calculatorId) {
        const descriptions = {
            'winLossDraw': 'This table shows the total number of wins, losses, draws, and games played (GP) for each player. Useful for understanding overall match participation and results.',
            'winRate': 'Win rate percentage indicates how successful each player has been. Calculated as (wins / total games) × 100. Higher percentages indicate better performance.',
            'streak': 'Current streak shows consecutive wins or losses. A positive streak indicates recent good form, while a negative streak suggests recent struggles.',
            'totalGoals': 'Total goals scored across all matches. This includes goals from both wins and losses, giving an overall picture of offensive performance.',
            'goalDifference': 'Goal difference is calculated as goals for (GF) - goals against (GA). Positive values indicate strong offensive and defensive play, while negative values suggest areas for improvement.',
            'leaguePoints': 'League table sorted by points, where each win = 1 point. This simple scoring system rewards wins equally.',
            'worstLosses': 'Records table showing: Worst Loss - Most Goals Conceded (highest goals allowed in a single loss), Worst Loss - Biggest Deficit (largest goal difference in a loss), Best Win - Most Goals Scored (highest goals scored in a win), Best Win - Biggest Surplus (largest goal difference in a win).',
            'avgGoalsPerGame': 'Average goals per game is calculated as total goals divided by games played. This metric helps identify consistently high-scoring players regardless of total matches played.',
            'form': 'Form shows results from the last 5 matches (W = Win, D = Draw, L = Loss) and total points earned. Points are calculated as wins × 3 + draws. This indicates recent performance trends.',
            'headToHead': 'Head-to-head statistics for player pairs. "Together" shows results when two players are on the same team (wins-draws-losses). "Against" shows results when the two players face each other in opposing teams.',
            'trendAnalysis': 'Trend analysis compares performance across three periods (early, middle, late) to identify if players are improving, declining, or stable. The strength percentage (0-100%) indicates how significant the trend is. A value of 0% means stable performance with no significant change.',
            'comparativeStats': 'Player comparison shows win rates for each player when facing specific opponents. This helps identify matchups where certain players perform better or worse.',
            'extraTimePenalties': 'Counts of matches that required extra time (beyond full time) or went to penalty shootouts. This indicates how often matches were closely contested.',
            'winRateChart': 'Visual chart showing how each player\'s win rate has changed over time. Useful for identifying performance trends and improvements.',
            'goalsChart': 'Visual chart displaying the number of goals scored by each player over time. Helps visualize offensive performance patterns.',
            'matchDistributionChart': 'Visual chart showing when matches were played, helping identify activity patterns and playing frequency.',
            'performanceInsights': 'Text-based insights and analysis of player performance patterns, strengths, weaknesses, and notable trends. Provides contextual information about player statistics.',
            'dailyMatchesChart': 'Shows how many matches were played each day, highlighting active and quiet periods.',
            'dayOfWeekChart': 'Shows how often matches occur on each day of the week to reveal preferred play days.',
            'rollingWinRateChart': 'Rolling (last 5 games) win rate for each player, useful for spotting recent form swings.',
            'comparisonBarChart': 'Compares win rate and games played per player in one view.'
        };
        return descriptions[calculatorId] || null;
    }
}

// Default Statistics Calculators

// Win/Loss/Draw Calculator
StatisticsCalculators.register({
    id: 'winLossDraw',
    name: 'Wins, Losses & Draws',
    category: 'performance',
    subcategory: 'wins-losses',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { wins: 0, losses: 0, draws: 0, games: 0 };
        });

        matches.forEach(match => {
            const { team1, team2, result } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            if (result === 'team1') {
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].wins++;
                        stats[p].games++;
                    }
                });
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                    }
                });
            } else if (result === 'team2') {
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].wins++;
                        stats[p].games++;
                    }
                });
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                    }
                });
            } else if (result === 'draw') {
                [...team1Players, ...team2Players].forEach(p => {
                    if (stats[p]) {
                        stats[p].draws++;
                        stats[p].games++;
                    }
                });
            }
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by games played (descending), then wins
        const sorted = Object.entries(data)
            .sort((a, b) => {
                if (b[1].games !== a[1].games) {
                    return b[1].games - a[1].games;
                }
                return b[1].wins - a[1].wins;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>GP</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats]) => `
                        <tr>
                            <td class="player-name">${player}</td>
                            <td>${stats.games}</td>
                            <td>${stats.wins}</td>
                            <td>${stats.draws}</td>
                            <td>${stats.losses}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Win Rate Calculator
StatisticsCalculators.register({
    id: 'winRate',
    name: 'Win Rate',
    category: 'performance',
    subcategory: 'win-rate',
    calculate: (matches, players) => {
        const wld = StatisticsCalculators.getById('winLossDraw').calculate(matches, players);
        const winRates = {};
        
        Object.entries(wld).forEach(([player, stats]) => {
            winRates[player] = {
                winRate: stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : 0,
                games: stats.games
            };
        });
        
        return winRates;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by win rate (descending), then games
        const sorted = Object.entries(data)
            .sort((a, b) => {
                const rateA = parseFloat(a[1].winRate);
                const rateB = parseFloat(b[1].winRate);
                if (rateB !== rateA) {
                    return rateB - rateA;
                }
                return b[1].games - a[1].games;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Win %</th>
                        <th>GP</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats]) => `
                        <tr>
                            <td class="player-name">${player}</td>
                            <td class="points">${stats.winRate}%</td>
                            <td>${stats.games}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Streak Calculator
StatisticsCalculators.register({
    id: 'streak',
    name: 'Current Streak',
    category: 'performance',
    subcategory: 'streak',
    calculate: (matches, players) => {
        const streaks = {};
        players.forEach(player => {
            streaks[player] = { currentStreak: 0, streakType: 'none' };
        });

        // Sort matches by timestamp (most recent first)
        const sortedMatches = [...matches].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        // Calculate streak for each player
        players.forEach(player => {
            let streak = 0;
            let streakType = 'none';
            
            for (const match of sortedMatches) {
                const { team1, team2, result } = match;
                const team1Players = Array.isArray(team1) ? team1 : [team1];
                const team2Players = Array.isArray(team2) ? team2 : [team2];
                
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                
                if (!inTeam1 && !inTeam2) continue;
                
                let won = false;
                if (result === 'team1' && inTeam1) won = true;
                if (result === 'team2' && inTeam2) won = true;
                
                if (streak === 0) {
                    streak = 1;
                    streakType = won ? 'win' : 'loss';
                } else if (
                    (streakType === 'win' && won) ||
                    (streakType === 'loss' && !won && result !== 'draw')
                ) {
                    streak++;
                } else {
                    break;
                }
                
                if (result === 'draw') break; // Draws break streaks
            }
            
            streaks[player] = {
                currentStreak: streak,
                streakType: streakType
            };
        });

        return streaks;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const html = Object.entries(data)
            .sort((a, b) => b[1].currentStreak - a[1].currentStreak)
            .map(([player, stats]) => {
                const streakText = stats.streakType === 'win' 
                    ? `${stats.currentStreak} win${stats.currentStreak !== 1 ? 's' : ''}`
                    : stats.streakType === 'loss'
                    ? `${stats.currentStreak} loss${stats.currentStreak !== 1 ? 'es' : ''}`
                    : 'No streak';
                
                return `
                    <h4>${player}</h4>
                    <div class="stat-item">
                        <span class="label">Current Streak:</span>
                        <span class="value">${streakText}</span>
                    </div>
                `;
            }).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// Total Goals Scored Calculator (includes extra time goals)
StatisticsCalculators.register({
    id: 'totalGoals',
    name: 'Total Goals Scored',
    category: 'goals',
    calculate: (matches, players) => {
        const stats = {};
        const unknownPlayers = new Set();

        const toArray = (value) => Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
        const toNumber = (value) => {
            if (typeof value === 'number') return value;
            if (typeof value === 'string' && value.trim() !== '') {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : NaN;
            }
            return NaN;
        };
        const warnUnknownPlayer = (player, match) => {
            if (!unknownPlayers.has(player)) {
                unknownPlayers.add(player);
                console.warn('Unknown player in match data (ignored):', player, match);
            }
        };

        players.forEach(player => {
            stats[player] = { 
                goals: 0,
                fullTimeGoals: 0,
                extraTimeGoals: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score, team1ExtraTimeScore, team2ExtraTimeScore } = match;

            const baseScore1 = toNumber(team1Score);
            const baseScore2 = toNumber(team2Score);

            // Skip matches without valid numeric scores
            if (!Number.isFinite(baseScore1) || !Number.isFinite(baseScore2)) {
                console.warn('Skipping match with invalid or missing scores:', match);
                return;
            }

            const team1Players = toArray(team1);
            const team2Players = toArray(team2);

            const extraProvided = team1ExtraTimeScore !== undefined || team2ExtraTimeScore !== undefined;
            const extraScoresPresent = team1ExtraTimeScore !== undefined && team2ExtraTimeScore !== undefined;
            const extraScore1 = extraScoresPresent ? toNumber(team1ExtraTimeScore) : NaN;
            const extraScore2 = extraScoresPresent ? toNumber(team2ExtraTimeScore) : NaN;

            let hasExtraTime = extraScoresPresent && Number.isFinite(extraScore1) && Number.isFinite(extraScore2);
            if (hasExtraTime && (extraScore1 < baseScore1 || extraScore2 < baseScore2)) {
                console.warn('Extra time scores lower than full-time scores; ignoring extra time for match:', match);
                hasExtraTime = false;
            }
            if (extraProvided && !hasExtraTime && extraScoresPresent) {
                console.warn('Ignoring invalid extra time scores for match:', match);
            }

            // Calculate goals (use extra time score if valid, otherwise full time)
            const team1Goals = hasExtraTime ? extraScore1 : baseScore1;
            const team2Goals = hasExtraTime ? extraScore2 : baseScore2;
            const team1ExtraGoals = hasExtraTime ? Math.max(0, extraScore1 - baseScore1) : 0;
            const team2ExtraGoals = hasExtraTime ? Math.max(0, extraScore2 - baseScore2) : 0;

            // Team 1 players
            team1Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goals += team1Goals;
                    stats[p].fullTimeGoals += baseScore1;
                    if (hasExtraTime) {
                        stats[p].extraTimeGoals += team1ExtraGoals;
                    }
                } else {
                    warnUnknownPlayer(p, match);
                }
            });

            // Team 2 players
            team2Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goals += team2Goals;
                    stats[p].fullTimeGoals += baseScore2;
                    if (hasExtraTime) {
                        stats[p].extraTimeGoals += team2ExtraGoals;
                    }
                } else {
                    warnUnknownPlayer(p, match);
                }
            });
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        const escapeSafe = (str = '') => String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        
        // Sort by goals (descending)
        const sorted = Object.entries(data)
            .sort((a, b) => b[1].goals - a[1].goals);
        
        // Check if any player has extra time goals
        const hasExtraTimeGoals = sorted.some(([_, stats]) => stats.extraTimeGoals > 0);
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Total</th>
                        ${hasExtraTimeGoals ? '<th>FT</th><th>ET</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        const color = window.appController && window.appController.settingsManager
                            ? window.appController.settingsManager.getPlayerColor(player)
                            : null;
                        const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';
                        
                        return `
                            <tr ${position === 1 ? 'class="leader"' : ''}>
                                <td class="position">${position}</td>
                                <td class="player-name" ${playerStyle}>${positionSymbol} ${escapeSafe(player)}</td>
                                <td class="points"><strong>${stats.goals}</strong></td>
                                ${hasExtraTimeGoals ? `
                                    <td>${stats.fullTimeGoals}</td>
                                    <td>${stats.extraTimeGoals > 0 ? `<span style="color: var(--primary-color); font-weight: 600;">${stats.extraTimeGoals}</span>` : '0'}</td>
                                ` : ''}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Goal Difference Calculator
StatisticsCalculators.register({
    id: 'goalDifference',
    name: 'Goal Difference',
    category: 'goals',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score } = match;
            
            // Skip matches without scores
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return;
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            // Team 1 players
            team1Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goalsFor += team1Score;
                    stats[p].goalsAgainst += team2Score;
                }
            });

            // Team 2 players
            team2Players.forEach(p => {
                if (stats[p]) {
                    stats[p].goalsFor += team2Score;
                    stats[p].goalsAgainst += team1Score;
                }
            });
        });

        // Calculate goal difference for each player
        Object.keys(stats).forEach(player => {
            stats[player].goalDifference = stats[player].goalsFor - stats[player].goalsAgainst;
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by goal difference (descending), then goals for
        const sorted = Object.entries(data)
            .sort((a, b) => {
                if (b[1].goalDifference !== a[1].goalDifference) {
                    return b[1].goalDifference - a[1].goalDifference;
                }
                return b[1].goalsFor - a[1].goalsFor;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        const goalDiffClass = stats.goalDifference > 0 ? 'positive' : stats.goalDifference < 0 ? 'negative' : '';
                        const goalDiffSign = stats.goalDifference > 0 ? '+' : '';
                        const positionClass = position === 1 ? 'leader' : '';
                        return `
                            <tr class="${positionClass}">
                                <td class="position">${position}</td>
                                <td class="player-name">${positionSymbol} ${player}</td>
                                <td>${stats.goalsFor}</td>
                                <td>${stats.goalsAgainst}</td>
                                <td class="goal-diff ${goalDiffClass}">${goalDiffSign}${stats.goalDifference}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// League Points Calculator
StatisticsCalculators.register({
    id: 'leaguePoints',
    name: 'League Table',
    category: 'league',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = { 
                points: 0, 
                wins: 0, 
                draws: 0, 
                losses: 0,
                games: 0,
                goalsFor: 0,
                goalsAgainst: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, result, team1Score, team2Score } = match;
            
            // Skip matches without scores
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return;
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            if (result === 'team1') {
                // Team 1 wins - each player gets 1 point
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].points += 1;
                        stats[p].wins++;
                        stats[p].games++;
                        stats[p].goalsFor += team1Score;
                        stats[p].goalsAgainst += team2Score;
                    }
                });
                // Team 2 loses - 0 points
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                        stats[p].goalsFor += team2Score;
                        stats[p].goalsAgainst += team1Score;
                    }
                });
            } else if (result === 'team2') {
                // Team 2 wins - each player gets 1 point
                team2Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].points += 1;
                        stats[p].wins++;
                        stats[p].games++;
                        stats[p].goalsFor += team2Score;
                        stats[p].goalsAgainst += team1Score;
                    }
                });
                // Team 1 loses - 0 points
                team1Players.forEach(p => {
                    if (stats[p]) {
                        stats[p].losses++;
                        stats[p].games++;
                        stats[p].goalsFor += team1Score;
                        stats[p].goalsAgainst += team2Score;
                    }
                });
            } else if (result === 'draw') {
                // Draw - all players get 1 point
                [...team1Players, ...team2Players].forEach(p => {
                    if (stats[p]) {
                        stats[p].points += 1;
                        stats[p].draws++;
                        stats[p].games++;
                        // Goals for/against depend on which team they're on
                        if (team1Players.includes(p)) {
                            stats[p].goalsFor += team1Score;
                            stats[p].goalsAgainst += team2Score;
                        } else {
                            stats[p].goalsFor += team2Score;
                            stats[p].goalsAgainst += team1Score;
                        }
                    }
                });
            }
        });

        // Calculate goal difference for each player
        Object.keys(stats).forEach(player => {
            stats[player].goalDifference = stats[player].goalsFor - stats[player].goalsAgainst;
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Sort by points (descending), then by goal difference (descending), then by goals for (descending)
        const sorted = Object.entries(data)
            .sort((a, b) => {
                if (b[1].points !== a[1].points) {
                    return b[1].points - a[1].points;
                }
                if (b[1].goalDifference !== a[1].goalDifference) {
                    return b[1].goalDifference - a[1].goalDifference;
                }
                return b[1].goalsFor - a[1].goalsFor;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Pts</th>
                        <th>GP</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        const goalDiffClass = stats.goalDifference > 0 ? 'positive' : stats.goalDifference < 0 ? 'negative' : '';
                        const goalDiffSign = stats.goalDifference > 0 ? '+' : '';
                        const positionClass = position === 1 ? 'leader' : '';
                        
                        return `
                            <tr class="${positionClass}">
                                <td class="position">${position}</td>
                                <td class="player-name">${positionSymbol} ${player}</td>
                                <td class="points">${stats.points}</td>
                                <td>${stats.games}</td>
                                <td>${stats.wins}</td>
                                <td>${stats.draws}</td>
                                <td>${stats.losses}</td>
                                <td>${stats.goalsFor}</td>
                                <td>${stats.goalsAgainst}</td>
                                <td class="goal-diff ${goalDiffClass}">${goalDiffSign}${stats.goalDifference}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Records Calculator (Best and Worst performances)
StatisticsCalculators.register({
    id: 'worstLosses',
    name: 'Records',
    category: 'records',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = {
                worstByGoalsAgainst: null,  // Match with most goals conceded in a loss
                worstByDifference: null,   // Match with biggest goal deficit in a loss
                bestByGoalsFor: null,      // Match with most goals scored in a win
                bestBySurplus: null        // Match with biggest goal surplus in a win
            };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score, result, timestamp } = match;
            
            // Skip matches without scores
            if (typeof team1Score === 'undefined' || typeof team2Score === 'undefined') {
                return;
            }
            
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            // Helper function to format teammates
            const getTeammates = (player, teamPlayers) => {
                return teamPlayers.filter(p => p !== player);
            };
            
            // Helper function to get opponents
            const getOpponents = (player, team1Players, team2Players) => {
                if (team1Players.includes(player)) {
                    return team2Players;
                } else {
                    return team1Players;
                }
            };
            
            // Process team 1 players
            team1Players.forEach(player => {
                if (!stats[player]) return;
                
                const teammates = getTeammates(player, team1Players);
                const opponents = team2Players;
                const goalsFor = team1Score;
                const goalsAgainst = team2Score;
                const goalDifference = team1Score - team2Score;
                
                if (result === 'team2') { // Team 1 lost
                    // Check worst by goals against
                    if (!stats[player].worstByGoalsAgainst || 
                        goalsAgainst > stats[player].worstByGoalsAgainst.goalsAgainst) {
                        stats[player].worstByGoalsAgainst = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check worst by goal difference
                    if (!stats[player].worstByDifference || 
                        goalDifference < stats[player].worstByDifference.goalDifference) {
                        stats[player].worstByDifference = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                } else if (result === 'team1') { // Team 1 won
                    // Check best by goals for
                    if (!stats[player].bestByGoalsFor || 
                        goalsFor > stats[player].bestByGoalsFor.goalsFor) {
                        stats[player].bestByGoalsFor = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check best by goal surplus
                    if (!stats[player].bestBySurplus || 
                        goalDifference > stats[player].bestBySurplus.goalDifference) {
                        stats[player].bestBySurplus = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team1Score} - ${team2Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                }
            });
            
            // Process team 2 players
            team2Players.forEach(player => {
                if (!stats[player]) return;
                
                const teammates = getTeammates(player, team2Players);
                const opponents = team1Players;
                const goalsFor = team2Score;
                const goalsAgainst = team1Score;
                const goalDifference = team2Score - team1Score;
                
                if (result === 'team1') { // Team 2 lost
                    // Check worst by goals against
                    if (!stats[player].worstByGoalsAgainst || 
                        goalsAgainst > stats[player].worstByGoalsAgainst.goalsAgainst) {
                        stats[player].worstByGoalsAgainst = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check worst by goal difference
                    if (!stats[player].worstByDifference || 
                        goalDifference < stats[player].worstByDifference.goalDifference) {
                        stats[player].worstByDifference = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsAgainst: goalsAgainst,
                            goalDifference: goalDifference
                        };
                    }
                } else if (result === 'team2') { // Team 2 won
                    // Check best by goals for
                    if (!stats[player].bestByGoalsFor || 
                        goalsFor > stats[player].bestByGoalsFor.goalsFor) {
                        stats[player].bestByGoalsFor = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                    
                    // Check best by goal surplus
                    if (!stats[player].bestBySurplus || 
                        goalDifference > stats[player].bestBySurplus.goalDifference) {
                        stats[player].bestBySurplus = {
                            date: timestamp,
                            teammates: teammates,
                            opponents: opponents,
                            score: `${team2Score} - ${team1Score}`,
                            goalsFor: goalsFor,
                            goalDifference: goalDifference
                        };
                    }
                }
            });
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        // Helper function to format date
        const formatDate = (timestamp) => {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        };
        
        // Helper function to format team names
        const formatTeamNames = (players) => {
            if (players.length === 0) return 'Solo';
            return players.join(' & ');
        };
        
        // Prepare data for tables
        const worstGoalsAgainst = [];
        const worstDeficit = [];
        const bestGoalsFor = [];
        const bestSurplus = [];
        
        Object.entries(data).forEach(([player, stats]) => {
            if (stats.worstByGoalsAgainst) {
                worstGoalsAgainst.push({
                    player,
                    ...stats.worstByGoalsAgainst,
                    teammates: formatTeamNames(stats.worstByGoalsAgainst.teammates),
                    opponents: formatTeamNames(stats.worstByGoalsAgainst.opponents)
                });
            }
            if (stats.worstByDifference) {
                worstDeficit.push({
                    player,
                    ...stats.worstByDifference,
                    teammates: formatTeamNames(stats.worstByDifference.teammates),
                    opponents: formatTeamNames(stats.worstByDifference.opponents)
                });
            }
            if (stats.bestByGoalsFor) {
                bestGoalsFor.push({
                    player,
                    ...stats.bestByGoalsFor,
                    teammates: formatTeamNames(stats.bestByGoalsFor.teammates),
                    opponents: formatTeamNames(stats.bestByGoalsFor.opponents)
                });
            }
            if (stats.bestBySurplus) {
                bestSurplus.push({
                    player,
                    ...stats.bestBySurplus,
                    teammates: formatTeamNames(stats.bestBySurplus.teammates),
                    opponents: formatTeamNames(stats.bestBySurplus.opponents)
                });
            }
        });
        
        // Sort by metric value (descending for goals/scoring, ascending for worst losses)
        worstGoalsAgainst.sort((a, b) => b.goalsAgainst - a.goalsAgainst);
        worstDeficit.sort((a, b) => a.goalDifference - b.goalDifference);
        bestGoalsFor.sort((a, b) => b.goalsFor - a.goalsFor);
        bestSurplus.sort((a, b) => b.goalDifference - a.goalDifference);
        
        const renderTable = (title, rows, columns) => {
            if (rows.length === 0) return '';
            
            const headers = columns.map(col => `<th>${col.header}</th>`).join('');
            const tableRows = rows.map(row => {
                const cells = columns.map(col => {
                    const value = col.getter(row);
                    const classes = col.class ? ` class="${col.class}"` : '';
                    return `<td${classes}>${value}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            
            return `
                <h3 style="margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.1rem;">${title}</h3>
                <table class="league-table">
                    <thead>
                        <tr>${headers}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            `;
        };
        
        let html = '';
        
        // Worst Losses - Most Goals Against
        html += renderTable('Worst Loss - Most Goals Conceded', worstGoalsAgainst, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GA', getter: (r) => r.goalsAgainst },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        // Worst Losses - Biggest Deficit
        html += renderTable('Worst Loss - Biggest Deficit', worstDeficit, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GD', getter: (r) => `<span class="goal-diff negative">${r.goalDifference}</span>`, class: 'goal-diff' },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        // Best Win - Most Goals Scored
        html += renderTable('Best Win - Most Goals Scored', bestGoalsFor, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GF', getter: (r) => r.goalsFor },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        // Best Win - Biggest Surplus
        html += renderTable('Best Win - Biggest Surplus', bestSurplus, [
            { header: 'Player', getter: (r) => r.player, class: 'player-name' },
            { header: 'GD', getter: (r) => `<span class="goal-diff positive">+${r.goalDifference}</span>`, class: 'goal-diff' },
            { header: 'Score', getter: (r) => r.score },
            { header: 'Date', getter: (r) => formatDate(r.date) },
            { header: 'With', getter: (r) => r.teammates || 'Solo' },
            { header: 'Vs', getter: (r) => r.opponents }
        ]);
        
        if (!html) {
            container.innerHTML = '<div class="empty-state"><p>No records available yet. Play some matches first!</p></div>';
        } else {
            container.innerHTML = html;
        }
        
        return container;
    }
});

// Average Goals Per Game Calculator
StatisticsCalculators.register({
    id: 'avgGoalsPerGame',
    name: 'Average Goals Per Game',
    category: 'goals',
    calculate: (matches, players) => {
        const totalGoals = StatisticsCalculators.getById('totalGoals').calculate(matches, players);
        const wld = StatisticsCalculators.getById('winLossDraw').calculate(matches, players);
        
        const stats = {};
        players.forEach(player => {
            const goals = totalGoals[player]?.goals || 0;
            const games = wld[player]?.games || 0;
            stats[player] = {
                avgGoals: games > 0 ? (goals / games).toFixed(2) : 0,
                totalGoals: goals,
                games: games
            };
        });
        
        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const sorted = Object.entries(data)
            .sort((a, b) => parseFloat(b[1].avgGoals) - parseFloat(a[1].avgGoals));
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Avg</th>
                        <th>GF</th>
                        <th>GP</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats], index) => {
                        const position = index + 1;
                        const positionSymbol = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                        return `
                            <tr ${position === 1 ? 'class="leader"' : ''}>
                                <td class="position">${position}</td>
                                <td class="player-name">${positionSymbol} ${player}</td>
                                <td class="points">${stats.avgGoals}</td>
                                <td>${stats.totalGoals}</td>
                                <td>${stats.games}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Form Tracking (Last 5 Games)
StatisticsCalculators.register({
    id: 'form',
    name: 'Form (Last 5 Games)',
    category: 'performance',
    subcategory: 'form',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = {
                form: [],
                wins: 0,
                draws: 0,
                losses: 0
            };
        });

        // Sort matches by date (most recent first)
        const sortedMatches = [...matches].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        // Track last 5 games for each player
        players.forEach(player => {
            let gamesCount = 0;
            for (const match of sortedMatches) {
                if (gamesCount >= 5) break;
                
                const { team1, team2, result } = match;
                const team1Players = Array.isArray(team1) ? team1 : [team1];
                const team2Players = Array.isArray(team2) ? team2 : [team2];
                
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                
                if (!inTeam1 && !inTeam2) continue;
                
                let outcome = '';
                if (result === 'draw') {
                    outcome = 'D';
                    stats[player].draws++;
                } else if ((result === 'team1' && inTeam1) || (result === 'team2' && inTeam2)) {
                    outcome = 'W';
                    stats[player].wins++;
                } else {
                    outcome = 'L';
                    stats[player].losses++;
                }
                
                stats[player].form.push(outcome);
                gamesCount++;
            }
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const sorted = Object.entries(data)
            .sort((a, b) => {
                // Sort by points (W=3, D=1, L=0) then by most recent wins
                const pointsA = b[1].wins * 3 + b[1].draws;
                const pointsB = a[1].wins * 3 + a[1].draws;
                if (pointsA !== pointsB) return pointsA - pointsB;
                return b[1].wins - a[1].wins;
            });
        
        const html = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Form</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(([player, stats]) => {
                        const formDisplay = stats.form.length > 0 
                            ? stats.form.map(r => {
                                if (r === 'W') return '<span style="color: #4CAF50; font-weight: bold;">W</span>';
                                if (r === 'D') return '<span style="color: #FF9800; font-weight: bold;">D</span>';
                                return '<span style="color: #f44336; font-weight: bold;">L</span>';
                            }).join(' ')
                            : '-';
                        const points = Math.round((stats.wins * 3 + stats.draws) * 10) / 10;
                        return `
                            <tr>
                                <td class="player-name">${player}</td>
                                <td>${formDisplay}</td>
                                <td>${stats.wins}</td>
                                <td>${stats.draws}</td>
                                <td>${stats.losses}</td>
                                <td class="points">${points}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
        return container;
    }
});

// Head-to-Head Calculator
StatisticsCalculators.register({
    id: 'headToHead',
    name: 'Head-to-Head',
    category: 'performance',
    subcategory: 'h2h',
    calculate: (matches, players) => {
        const stats = {};
        
        // Initialize all player pairs
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const p1 = players[i];
                const p2 = players[j];
                const key = [p1, p2].sort().join(' vs ');
                if (!stats[key]) {
                    stats[key] = {
                        player1: p1,
                        player2: p2,
                        together: { wins: 0, draws: 0, losses: 0, games: 0 },
                        against: { wins: 0, draws: 0, losses: 0, games: 0 }
                    };
                }
            }
        }

        matches.forEach(match => {
            const { team1, team2, result } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            // Check all player pairs
            for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                    const p1 = players[i];
                    const p2 = players[j];
                    const key = [p1, p2].sort().join(' vs ');
                    
                    const p1InTeam1 = team1Players.includes(p1);
                    const p2InTeam1 = team1Players.includes(p2);
                    const p1InTeam2 = team2Players.includes(p1);
                    const p2InTeam2 = team2Players.includes(p2);
                    
                    // Playing together
                    if ((p1InTeam1 && p2InTeam1) || (p1InTeam2 && p2InTeam2)) {
                        stats[key].together.games++;
                        if (result === 'draw') {
                            stats[key].together.draws++;
                        } else if ((result === 'team1' && p1InTeam1) || (result === 'team2' && p1InTeam2)) {
                            stats[key].together.wins++;
                        } else {
                            stats[key].together.losses++;
                        }
                    }
                    // Playing against each other
                    else if ((p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1)) {
                        stats[key].against.games++;
                        if (result === 'draw') {
                            stats[key].against.draws++;
                        } else if ((result === 'team1' && p1InTeam1) || (result === 'team2' && p1InTeam2)) {
                            stats[key].against.wins++;
                        } else {
                            stats[key].against.losses++;
                        }
                    }
                }
            }
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const sorted = Object.entries(data)
            .filter(([key, stats]) => stats.together.games > 0 || stats.against.games > 0)
            .sort((a, b) => {
                const totalA = a[1].together.games + a[1].against.games;
                const totalB = b[1].together.games + b[1].against.games;
                return totalB - totalA;
            });
        
        if (sorted.length === 0) {
            container.innerHTML = '<p>No head-to-head data available yet.</p>';
            return container;
        }
        
        const html = sorted.map(([key, stats]) => {
            const [p1, p2] = key.split(' vs ');
            return `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background-color: var(--background-color); border-radius: 8px;">
                    <h4 style="margin-bottom: 0.75rem; font-size: 1.1rem;">${p1} vs ${p2}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <strong>Playing Together:</strong>
                            <table class="league-table" style="margin-top: 0.5rem;">
                                <thead>
                                    <tr>
                                        <th>GP</th>
                                        <th>W</th>
                                        <th>D</th>
                                        <th>L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${stats.together.games}</td>
                                        <td>${stats.together.wins}</td>
                                        <td>${stats.together.draws}</td>
                                        <td>${stats.together.losses}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <strong>Playing Against:</strong>
                            <table class="league-table" style="margin-top: 0.5rem;">
                                <thead>
                                    <tr>
                                        <th>GP</th>
                                        <th>W</th>
                                        <th>D</th>
                                        <th>L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${stats.against.games}</td>
                                        <td>${stats.against.wins}</td>
                                        <td>${stats.against.draws}</td>
                                        <td>${stats.against.losses}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        return container;
    }
});

// ============================================================================
// Chart Calculators - Data Visualization
// ============================================================================

// Win Rate Over Time Chart
StatisticsCalculators.register({
    id: 'winRateChart',
    name: 'Win Rate Over Time',
    category: 'visualization',
    subcategory: 'trends',
    calculate: (matches, players) => {
        // Group matches by date and calculate win rate for each player
        const sortedMatches = [...matches].sort((a, b) => 
            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );
        
        const playerData = {};
        players.forEach(player => {
            playerData[player] = {
                dates: [],
                winRates: [],
                cumulativeWins: 0,
                cumulativeGames: 0
            };
        });

        sortedMatches.forEach(match => {
            const date = match.timestamp ? new Date(match.timestamp).toLocaleDateString() : 'Unknown';
            const { team1, team2, result } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            players.forEach(player => {
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                if (!inTeam1 && !inTeam2) return;

                const data = playerData[player];
                data.cumulativeGames++;
                
                let won = false;
                if (result === 'team1' && inTeam1) won = true;
                if (result === 'team2' && inTeam2) won = true;
                if (won) data.cumulativeWins++;

                const winRate = data.cumulativeGames > 0 
                    ? (data.cumulativeWins / data.cumulativeGames) * 100 
                    : 0;

                data.dates.push(date);
                data.winRates.push(winRate);
            });
        });

        return playerData;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Data</h3><p>Play some matches to see win rate trends!</p></div>';
            return container;
        }

        // Get player colors from settings if available
        const getPlayerColor = (playerName) => {
            // Try to get from global settings manager if available
            if (window.appController && window.appController.settingsManager) {
                return window.appController.settingsManager.getPlayerColor(playerName) || null;
            }
            return null;
        };

        const colors = [
            '#2196F3', '#4CAF50', '#FF9800', '#F44336',
            '#9C27B0', '#00BCD4', '#FFC107', '#795548'
        ];

        const datasets = players.map((player, index) => {
            const playerData = data[player];
            const color = getPlayerColor(player) || colors[index % colors.length];
            
            return {
                label: player,
                data: playerData.winRates,
                borderColor: color,
                backgroundColor: color + '40',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            };
        });

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: data[players[0]]?.dates || [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Win Rate Over Time (%)',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Win Rate (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });

        return container;
    }
});

// Goals Scored Chart
StatisticsCalculators.register({
    id: 'goalsChart',
    name: 'Goals Scored',
    category: 'visualization',
    subcategory: 'goals',
    calculate: (matches, players) => {
        const goalsData = {};
        players.forEach(player => {
            goalsData[player] = {
                goalsFor: 0,
                goalsAgainst: 0,
                totalGoals: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, team1Score, team2Score } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];

            team1Players.forEach(player => {
                if (goalsData[player]) {
                    goalsData[player].goalsFor += team1Score || 0;
                    goalsData[player].goalsAgainst += team2Score || 0;
                    goalsData[player].totalGoals += team1Score || 0;
                }
            });

            team2Players.forEach(player => {
                if (goalsData[player]) {
                    goalsData[player].goalsFor += team2Score || 0;
                    goalsData[player].goalsAgainst += team1Score || 0;
                    goalsData[player].totalGoals += team2Score || 0;
                }
            });
        });

        return goalsData;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Data</h3><p>Play some matches to see goals scored!</p></div>';
            return container;
        }

        const getPlayerColor = (playerName) => {
            if (window.appController && window.appController.settingsManager) {
                return window.appController.settingsManager.getPlayerColor(playerName) || null;
            }
            return null;
        };

        const colors = [
            '#2196F3', '#4CAF50', '#FF9800', '#F44336',
            '#9C27B0', '#00BCD4', '#FFC107', '#795548'
        ];

        const sortedPlayers = players.sort((a, b) => 
            data[b].totalGoals - data[a].totalGoals
        );

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sortedPlayers,
                datasets: [{
                    label: 'Goals For',
                    data: sortedPlayers.map(p => data[p].goalsFor),
                    backgroundColor: sortedPlayers.map((p, i) => {
                        const color = getPlayerColor(p) || colors[i % colors.length];
                        return color + 'CC';
                    }),
                    borderColor: sortedPlayers.map((p, i) => {
                        const color = getPlayerColor(p) || colors[i % colors.length];
                        return color;
                    }),
                    borderWidth: 2
                }, {
                    label: 'Goals Against',
                    data: sortedPlayers.map(p => data[p].goalsAgainst),
                    backgroundColor: '#F44336CC',
                    borderColor: '#F44336',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Goals Scored & Conceded',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        title: {
                            display: true,
                            text: 'Goals'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Player'
                        }
                    }
                }
            }
        });

        return container;
    }
});

// Match Distribution Pie Chart
StatisticsCalculators.register({
    id: 'matchDistributionChart',
    name: 'Match Distribution',
    category: 'visualization',
    subcategory: 'overview',
    calculate: (matches, players) => {
        let wins = 0, losses = 0, draws = 0;

        matches.forEach(match => {
            if (match.result === 'team1' || match.result === 'team2') {
                wins++;
            } else if (match.result === 'draw') {
                draws++;
            }
        });

        // For individual player perspective, we'd need to calculate per player
        // For now, showing overall distribution
        return {
            wins,
            losses,
            draws,
            total: matches.length
        };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        if (data.total === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Data</h3><p>Play some matches to see distribution!</p></div>';
            return container;
        }

        new Chart(canvas, {
            type: 'pie',
            data: {
                labels: ['Wins', 'Draws', 'Losses'],
                datasets: [{
                    data: [data.wins, data.draws, data.losses],
                    backgroundColor: [
                        '#4CAF50',
                        '#FF9800',
                        '#F44336'
                    ],
                    borderColor: [
                        '#388E3C',
                        '#F57C00',
                        '#D32F2F'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Match Result Distribution',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        return container;
    }
});

// Daily Matches Chart (timeline view)
StatisticsCalculators.register({
    id: 'dailyMatchesChart',
    name: 'Matches per Day',
    category: 'visualization',
    subcategory: 'timeline',
    calculate: (matches) => {
        if (!matches || matches.length === 0) return { labels: [], counts: [] };
        const dateMap = {};
        matches.forEach(match => {
            if (!match.timestamp) return;
            const dateKey = new Date(match.timestamp).toISOString().split('T')[0];
            dateMap[dateKey] = (dateMap[dateKey] || 0) + 1;
        });
        const labels = Object.keys(dateMap).sort();
        return {
            labels,
            counts: labels.map(label => dateMap[label])
        };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        if (!data.labels || data.labels.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📆</div><h3>No Data</h3><p>Play matches to see daily activity.</p></div>';
            return container;
        }

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Matches',
                    data: data.counts,
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F340',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Matches Played per Day',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: 'Matches' }
                    },
                    x: {
                        title: { display: true, text: 'Date' },
                        ticks: { maxRotation: 45, minRotation: 45 }
                    }
                }
            }
        });

        return container;
    }
});

// Day-of-Week Activity
StatisticsCalculators.register({
    id: 'dayOfWeekChart',
    name: 'Day-of-Week Activity',
    category: 'visualization',
    subcategory: 'timeline',
    calculate: (matches) => {
        const counts = [0,0,0,0,0,0,0]; // Sun-Sat
        matches.forEach(match => {
            if (!match.timestamp) return;
            const day = new Date(match.timestamp).getDay();
            counts[day] += 1;
        });
        const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        return { labels, counts };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        if (!data || !data.labels || data.labels.every((_, idx) => (data.counts?.[idx] || 0) === 0)) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Data</h3><p>Play matches to see day-of-week patterns.</p></div>';
            return container;
        }

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Matches',
                    data: data.counts,
                    backgroundColor: '#4CAF50AA',
                    borderColor: '#388E3C',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Matches by Day of Week',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: 'Matches' }
                    }
                }
            }
        });

        return container;
    }
});

// Rolling Win Rate (per-player)
StatisticsCalculators.register({
    id: 'rollingWinRateChart',
    name: 'Rolling Win Rate',
    category: 'visualization',
    subcategory: 'trends',
    calculate: (matches, players) => {
        const windowSize = 5;
        const playerSeries = {};

        players.forEach(player => {
            const playerMatches = matches
                .filter(m => {
                    const team1 = Array.isArray(m.team1) ? m.team1 : [m.team1];
                    const team2 = Array.isArray(m.team2) ? m.team2 : [m.team2];
                    return team1.includes(player) || team2.includes(player);
                })
                .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

            const values = [];
            const labels = [];
            const results = [];

            playerMatches.forEach((m, idx) => {
                const team1 = Array.isArray(m.team1) ? m.team1 : [m.team1];
                const team2 = Array.isArray(m.team2) ? m.team2 : [m.team2];
                const inTeam1 = team1.includes(player);
                const inTeam2 = team2.includes(player);
                const win = (m.result === 'team1' && inTeam1) || (m.result === 'team2' && inTeam2);
                const draw = m.result === 'draw';
                results.push({ win, draw });

                const start = Math.max(0, results.length - windowSize);
                const slice = results.slice(start);
                const games = slice.length;
                const wins = slice.filter(r => r.win).length;
                const draws = slice.filter(r => r.draw).length;
                const winRate = games > 0 ? (wins / games) * 100 : 0;
                values.push(Number(winRate.toFixed(1)));
                labels.push(`${idx + 1}`);
            });

            playerSeries[player] = { labels, values };
        });

        const maxPoints = Math.max(0, ...Object.values(playerSeries).map(s => s.labels.length));
        const chartLabels = Array.from({ length: maxPoints }, (_, i) => `Game ${i + 1}`);

        const datasets = Object.keys(playerSeries).map((player, idx) => {
            const series = playerSeries[player];
            const colorPalette = ['#2196F3','#4CAF50','#FF9800','#F44336','#9C27B0','#00BCD4','#795548','#FFC107'];
            const color = colorPalette[idx % colorPalette.length];
            const data = chartLabels.map((_, i) => series.values[i] !== undefined ? series.values[i] : null);
            return {
                label: player,
                data,
                borderColor: color,
                backgroundColor: color + '40',
                borderWidth: 2,
                spanGaps: true,
                tension: 0.35
            };
        });

        return { labels: chartLabels, datasets };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        if (!data || !data.labels || data.labels.length === 0 || !data.datasets || data.datasets.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><h3>No Data</h3><p>Play matches to see rolling win rates.</p></div>';
            return container;
        }

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: data.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Rolling Win Rate (last 5 games)',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: true, position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? 0}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: v => `${v}%`
                        },
                        title: { display: true, text: 'Win Rate (%)' }
                    },
                    x: {
                        title: { display: true, text: 'Games Played' }
                    }
                }
            }
        });

        return container;
    }
});

// Player Comparison Bar (win rate)
StatisticsCalculators.register({
    id: 'comparisonBarChart',
    name: 'Player Win Rate Comparison',
    category: 'visualization',
    subcategory: 'comparison',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(p => stats[p] = { wins: 0, games: 0 });

        matches.forEach(match => {
            const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
            const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
            players.forEach(player => {
                const inTeam1 = team1.includes(player);
                const inTeam2 = team2.includes(player);
                if (!inTeam1 && !inTeam2) return;
                stats[player].games += 1;
                if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                    stats[player].wins += 1;
                }
            });
        });

        const labels = players;
        const winRates = labels.map(p => {
            const s = stats[p];
            return s.games > 0 ? Number(((s.wins / s.games) * 100).toFixed(1)) : 0;
        });
        const games = labels.map(p => stats[p].games);
        return { labels, winRates, games };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card chart-card';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        if (!data || !data.labels || data.labels.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤝</div><h3>No Data</h3><p>Add players and play matches to compare.</p></div>';
            return container;
        }

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Win Rate (%)',
                        data: data.winRates,
                        backgroundColor: '#2196F3AA',
                        borderColor: '#1976D2',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Games Played',
                        data: data.games,
                        backgroundColor: '#FF9800AA',
                        borderColor: '#F57C00',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Win Rate & Games Played',
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const label = ctx.dataset.label || '';
                                return `${label}: ${ctx.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        position: 'left',
                        ticks: { callback: v => `${v}%` },
                        title: { display: true, text: 'Win Rate (%)' }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Games' }
                    }
                }
            }
        });

        return container;
    }
});

// Performance Insights - AI-like Analysis
StatisticsCalculators.register({
    id: 'performanceInsights',
    name: 'Performance Insights',
    category: 'visualization',
    subcategory: 'insights',
    calculate: (matches, players) => {
        if (matches.length === 0) return {};

        const insights = {};
        
        players.forEach(player => {
            const playerInsights = [];
            const playerMatches = matches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                return team1Players.includes(player) || team2Players.includes(player);
            });

            if (playerMatches.length === 0) {
                insights[player] = { insights: ['No matches played yet'] };
                return;
            }

            // Calculate basic stats
            let wins = 0, losses = 0, draws = 0;
            let goalsFor = 0, goalsAgainst = 0;
            const dayOfWeekStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Sunday = 0
            const dayOfWeekWins = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            const recentMatches = playerMatches.slice(-10); // Last 10 matches
            const olderMatches = playerMatches.slice(0, -10);

            playerMatches.forEach(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);

                if (match.timestamp) {
                    const date = new Date(match.timestamp);
                    const dayOfWeek = date.getDay();
                    dayOfWeekStats[dayOfWeek]++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        dayOfWeekWins[dayOfWeek]++;
                    }
                }

                if (inTeam1) {
                    goalsFor += match.team1Score || 0;
                    goalsAgainst += match.team2Score || 0;
                    if (match.result === 'team1') wins++;
                    else if (match.result === 'team2') losses++;
                    else draws++;
                } else if (inTeam2) {
                    goalsFor += match.team2Score || 0;
                    goalsAgainst += match.team1Score || 0;
                    if (match.result === 'team2') wins++;
                    else if (match.result === 'team1') losses++;
                    else draws++;
                }
            });

            const totalGames = wins + losses + draws;
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
            const goalDifference = goalsFor - goalsAgainst;

            // Insight 1: Overall performance
            if (winRate >= 60) {
                playerInsights.push(`🏆 Excellent win rate of ${winRate.toFixed(1)}%! You're dominating!`);
            } else if (winRate >= 50) {
                playerInsights.push(`✅ Strong performance with ${winRate.toFixed(1)}% win rate`);
            } else if (winRate >= 40) {
                playerInsights.push(`📊 Decent ${winRate.toFixed(1)}% win rate - room for improvement`);
            } else {
                playerInsights.push(`💪 Keep practicing! Your win rate is ${winRate.toFixed(1)}%`);
            }

            // Insight 2: Recent form vs overall
            if (recentMatches.length >= 5 && olderMatches.length >= 5) {
                let recentWins = 0, recentGames = 0;
                let olderWins = 0, olderGames = 0;

                recentMatches.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    if (!inTeam1 && !inTeam2) return;

                    recentGames++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        recentWins++;
                    }
                });

                olderMatches.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    if (!inTeam1 && !inTeam2) return;

                    olderGames++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        olderWins++;
                    }
                });

                const recentWinRate = recentGames > 0 ? (recentWins / recentGames) * 100 : 0;
                const olderWinRate = olderGames > 0 ? (olderWins / olderGames) * 100 : 0;

                if (recentWinRate > olderWinRate + 10) {
                    playerInsights.push(`📈 Your form is improving! Recent win rate (${recentWinRate.toFixed(1)}%) is much better than earlier (${olderWinRate.toFixed(1)}%)`);
                } else if (recentWinRate < olderWinRate - 10) {
                    playerInsights.push(`📉 Your recent form has declined (${recentWinRate.toFixed(1)}% vs ${olderWinRate.toFixed(1)}% earlier)`);
                } else if (recentWinRate > olderWinRate) {
                    playerInsights.push(`📊 Slight improvement in recent matches`);
                }
            }

            // Insight 3: Best day of week
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let bestDay = null;
            let bestDayWinRate = 0;
            let bestDayGames = 0;

            for (let day = 0; day < 7; day++) {
                if (dayOfWeekStats[day] >= 3) { // Need at least 3 games
                    const dayWinRate = dayOfWeekStats[day] > 0 
                        ? (dayOfWeekWins[day] / dayOfWeekStats[day]) * 100 
                        : 0;
                    if (dayWinRate > bestDayWinRate) {
                        bestDayWinRate = dayWinRate;
                        bestDay = day;
                        bestDayGames = dayOfWeekStats[day];
                    }
                }
            }

            if (bestDay !== null && bestDayWinRate >= 50) {
                playerInsights.push(`📅 You play best on ${dayNames[bestDay]}s! ${bestDayWinRate.toFixed(1)}% win rate (${bestDayGames} games)`);
            }

            // Insight 4: Goal difference
            if (goalDifference > 20) {
                playerInsights.push(`⚽ Excellent goal difference of +${goalDifference}! You're scoring freely`);
            } else if (goalDifference > 10) {
                playerInsights.push(`⚽ Strong goal difference of +${goalDifference}`);
            } else if (goalDifference < -10) {
                playerInsights.push(`⚽ Focus on defense - goal difference is ${goalDifference}`);
            }

            // Insight 5: Streak analysis
            let currentStreak = 0;
            let streakType = 'none';
            const sortedMatches = [...playerMatches].sort((a, b) => 
                new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
            );

            for (const match of sortedMatches) {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                if (!inTeam1 && !inTeam2) continue;

                let won = false;
                if (match.result === 'team1' && inTeam1) won = true;
                if (match.result === 'team2' && inTeam2) won = true;

                if (streakType === 'none') {
                    streakType = won ? 'win' : 'loss';
                    currentStreak = 1;
                } else if ((streakType === 'win' && won) || (streakType === 'loss' && !won && match.result !== 'draw')) {
                    currentStreak++;
                } else {
                    break;
                }

                if (match.result === 'draw') break;
            }

            if (currentStreak >= 5 && streakType === 'win') {
                playerInsights.push(`🔥 On fire! ${currentStreak} game winning streak!`);
            } else if (currentStreak >= 3 && streakType === 'win') {
                playerInsights.push(`🔥 ${currentStreak} game winning streak - keep it up!`);
            } else if (currentStreak >= 3 && streakType === 'loss') {
                playerInsights.push(`💪 ${currentStreak} game losing streak - time to bounce back!`);
            }

            // Insight 6: Games played milestone
            if (totalGames >= 100) {
                playerInsights.push(`🎯 Milestone: ${totalGames} games played!`);
            } else if (totalGames >= 50) {
                playerInsights.push(`🎯 ${totalGames} games played - great dedication!`);
            }

            insights[player] = {
                insights: playerInsights.length > 0 ? playerInsights : ['Keep playing to unlock insights!'],
                stats: {
                    winRate: winRate.toFixed(1),
                    totalGames,
                    goalDifference
                }
            };
        });

        return insights;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card insights-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        
        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤖</div><h3>No Insights Yet</h3><p>Play some matches to unlock AI insights!</p></div>';
            return container;
        }

        const html = players.map(player => {
            const playerData = data[player];
            const color = window.appController && window.appController.settingsManager
                ? window.appController.settingsManager.getPlayerColor(player)
                : null;
            const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';

            return `
                <div class="insight-player-section">
                    <h4 ${playerStyle}>${escapeHtml(player)}</h4>
                    <div class="insights-list">
                        ${playerData.insights.map(insight => `
                            <div class="insight-item">
                                <span class="insight-text">${escapeHtml(insight)}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${playerData.stats ? `
                        <div class="insight-stats">
                            <span>Win Rate: ${playerData.stats.winRate}%</span>
                            <span>Games: ${playerData.stats.totalGames}</span>
                            <span>Goal Diff: ${playerData.stats.goalDifference > 0 ? '+' : ''}${playerData.stats.goalDifference}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Trend Analysis Calculator
StatisticsCalculators.register({
    id: 'trendAnalysis',
    name: 'Trend Analysis',
    category: 'visualization',
    subcategory: 'trends',
    calculate: (matches, players) => {
        if (matches.length < 5) return {}; // Need at least 5 matches for trends

        const sortedMatches = [...matches].sort((a, b) => 
            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );

        const trends = {};
        
        players.forEach(player => {
            const playerMatches = sortedMatches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                return team1Players.includes(player) || team2Players.includes(player);
            });

            if (playerMatches.length < 5) {
                trends[player] = { trend: 'insufficient_data', message: 'Need at least 5 matches for trend analysis' };
                return;
            }

            // Split into thirds for trend analysis
            const thirdSize = Math.floor(playerMatches.length / 3);
            const firstThird = playerMatches.slice(0, thirdSize);
            const middleThird = playerMatches.slice(thirdSize, thirdSize * 2);
            const lastThird = playerMatches.slice(thirdSize * 2);

            const calculateWinRate = (matchSet) => {
                let wins = 0, games = 0;
                matchSet.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    if (!inTeam1 && !inTeam2) return;

                    games++;
                    if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        wins++;
                    }
                });
                return games > 0 ? (wins / games) * 100 : 0;
            };

            const firstWinRate = calculateWinRate(firstThird);
            const middleWinRate = calculateWinRate(middleThird);
            const lastWinRate = calculateWinRate(lastThird);

            // Determine trend
            let trend = 'stable';
            let trendStrength = 0;
            let message = '';

            const earlyAvg = (firstWinRate + middleWinRate) / 2;
            const improvement = lastWinRate - earlyAvg;

            if (improvement > 15) {
                trend = 'improving_strong';
                trendStrength = Math.min(100, (improvement / 50) * 100);
                message = `Strong improvement! Win rate increased by ${improvement.toFixed(1)}%`;
            } else if (improvement > 5) {
                trend = 'improving';
                trendStrength = Math.min(100, (improvement / 20) * 100);
                message = `Improving! Win rate up by ${improvement.toFixed(1)}%`;
            } else if (improvement < -15) {
                trend = 'declining_strong';
                trendStrength = Math.min(100, (Math.abs(improvement) / 50) * 100);
                message = `Declining performance. Win rate down by ${Math.abs(improvement).toFixed(1)}%`;
            } else if (improvement < -5) {
                trend = 'declining';
                trendStrength = Math.min(100, (Math.abs(improvement) / 20) * 100);
                message = `Slight decline. Win rate down by ${Math.abs(improvement).toFixed(1)}%`;
            } else {
                trend = 'stable';
                message = `Stable performance. Win rate around ${lastWinRate.toFixed(1)}%`;
            }

            trends[player] = {
                trend,
                trendStrength,
                message,
                firstPeriod: firstWinRate.toFixed(1),
                middlePeriod: middleWinRate.toFixed(1),
                lastPeriod: lastWinRate.toFixed(1),
                overallChange: improvement.toFixed(1)
            };
        });

        return trends;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card trend-analysis-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const players = Object.keys(data);
        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><h3>No Trend Data</h3><p>Play at least 5 matches to see trend analysis!</p></div>';
            return container;
        }

        const getTrendIcon = (trend) => {
            switch(trend) {
                case 'improving_strong': return '🚀';
                case 'improving': return '📈';
                case 'declining_strong': return '📉';
                case 'declining': return '⚠️';
                default: return '➡️';
            }
        };

        const getTrendColor = (trend) => {
            switch(trend) {
                case 'improving_strong': return '#4CAF50';
                case 'improving': return '#8BC34A';
                case 'declining_strong': return '#F44336';
                case 'declining': return '#FF9800';
                default: return '#757575';
            }
        };

        const html = players.map(player => {
            const trendData = data[player];
            
            if (trendData.trend === 'insufficient_data') {
                return `
                    <div class="trend-player-section">
                        <h4>${escapeHtml(player)}</h4>
                        <p class="trend-message">${escapeHtml(trendData.message)}</p>
                    </div>
                `;
            }

            const color = window.appController && window.appController.settingsManager
                ? window.appController.settingsManager.getPlayerColor(player)
                : null;
            const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';
            const trendColor = getTrendColor(trendData.trend);
            const trendIcon = getTrendIcon(trendData.trend);

            return `
                <div class="trend-player-section">
                    <h4 ${playerStyle}>${escapeHtml(player)}</h4>
                    <div class="trend-indicator" style="border-left-color: ${trendColor};">
                        <div class="trend-header">
                            <span class="trend-icon">${trendIcon}</span>
                            <span class="trend-message" style="color: ${trendColor};">${escapeHtml(trendData.message)}</span>
                        </div>
                        <div class="trend-progress">
                            <div class="trend-bar" style="width: ${trendData.trendStrength}%; background-color: ${trendColor};"></div>
                        </div>
                        <div class="trend-periods">
                            <div class="trend-period">
                                <span class="period-label">Early</span>
                                <span class="period-value">${trendData.firstPeriod}%</span>
                            </div>
                            <div class="trend-period">
                                <span class="period-label">Middle</span>
                                <span class="period-value">${trendData.middlePeriod}%</span>
                            </div>
                            <div class="trend-period">
                                <span class="period-label">Recent</span>
                                <span class="period-value">${trendData.lastPeriod}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Comparative Stats - Compare Two Players
StatisticsCalculators.register({
    id: 'comparativeStats',
    name: 'Player Comparison',
    category: 'visualization',
    subcategory: 'comparison',
    calculate: (matches, players) => {
        if (players.length < 2) return {};

        // Calculate stats for all player pairs
        const comparisons = {};
        
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const player1 = players[i];
                const player2 = players[j];
                const key = `${player1} vs ${player2}`;

                let p1Stats = { wins: 0, losses: 0, draws: 0, games: 0, goalsFor: 0, goalsAgainst: 0 };
                let p2Stats = { wins: 0, losses: 0, draws: 0, games: 0, goalsFor: 0, goalsAgainst: 0 };
                let headToHead = { p1Wins: 0, p2Wins: 0, draws: 0, games: 0 };

                matches.forEach(match => {
                    const { team1, team2, result, team1Score, team2Score } = match;
                    const team1Players = Array.isArray(team1) ? team1 : [team1];
                    const team2Players = Array.isArray(team2) ? team2 : [team2];

                    const p1InTeam1 = team1Players.includes(player1);
                    const p1InTeam2 = team2Players.includes(player1);
                    const p2InTeam1 = team1Players.includes(player2);
                    const p2InTeam2 = team2Players.includes(player2);

                    // Head-to-head (playing against each other)
                    if ((p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1)) {
                        headToHead.games++;
                        if (result === 'team1' && p1InTeam1) headToHead.p1Wins++;
                        else if (result === 'team2' && p1InTeam2) headToHead.p1Wins++;
                        else if (result === 'team1' && p2InTeam1) headToHead.p2Wins++;
                        else if (result === 'team2' && p2InTeam2) headToHead.p2Wins++;
                        else if (result === 'draw') headToHead.draws++;
                    }

                    // Player 1 stats
                    if (p1InTeam1 || p1InTeam2) {
                        p1Stats.games++;
                        if (p1InTeam1) {
                            p1Stats.goalsFor += team1Score || 0;
                            p1Stats.goalsAgainst += team2Score || 0;
                            if (result === 'team1') p1Stats.wins++;
                            else if (result === 'team2') p1Stats.losses++;
                            else p1Stats.draws++;
                        } else {
                            p1Stats.goalsFor += team2Score || 0;
                            p1Stats.goalsAgainst += team1Score || 0;
                            if (result === 'team2') p1Stats.wins++;
                            else if (result === 'team1') p1Stats.losses++;
                            else p1Stats.draws++;
                        }
                    }

                    // Player 2 stats
                    if (p2InTeam1 || p2InTeam2) {
                        p2Stats.games++;
                        if (p2InTeam1) {
                            p2Stats.goalsFor += team1Score || 0;
                            p2Stats.goalsAgainst += team2Score || 0;
                            if (result === 'team1') p2Stats.wins++;
                            else if (result === 'team2') p2Stats.losses++;
                            else p2Stats.draws++;
                        } else {
                            p2Stats.goalsFor += team2Score || 0;
                            p2Stats.goalsAgainst += team1Score || 0;
                            if (result === 'team2') p2Stats.wins++;
                            else if (result === 'team1') p2Stats.losses++;
                            else p2Stats.draws++;
                        }
                    }
                });

                const p1WinRate = p1Stats.games > 0 ? (p1Stats.wins / p1Stats.games) * 100 : 0;
                const p2WinRate = p2Stats.games > 0 ? (p2Stats.wins / p2Stats.games) * 100 : 0;

                comparisons[key] = {
                    player1,
                    player2,
                    player1Stats: {
                        ...p1Stats,
                        winRate: p1WinRate.toFixed(1),
                        goalDifference: p1Stats.goalsFor - p1Stats.goalsAgainst
                    },
                    player2Stats: {
                        ...p2Stats,
                        winRate: p2WinRate.toFixed(1),
                        goalDifference: p2Stats.goalsFor - p2Stats.goalsAgainst
                    },
                    headToHead: {
                        ...headToHead,
                        p1WinRate: headToHead.games > 0 ? (headToHead.p1Wins / headToHead.games) * 100 : 0,
                        p2WinRate: headToHead.games > 0 ? (headToHead.p2Wins / headToHead.games) * 100 : 0
                    }
                };
            }
        }

        return comparisons;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card comparative-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const comparisons = Object.keys(data);
        if (comparisons.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚖️</div><h3>No Comparisons</h3><p>Need at least 2 players to compare!</p></div>';
            return container;
        }

        const getPlayerColor = (playerName) => {
            if (window.appController && window.appController.settingsManager) {
                return window.appController.settingsManager.getPlayerColor(playerName) || null;
            }
            return null;
        };

        const html = comparisons.map(key => {
            const comp = data[key];
            const p1Color = getPlayerColor(comp.player1) || '#2196F3';
            const p2Color = getPlayerColor(comp.player2) || '#4CAF50';

            return `
                <div class="comparison-section">
                    <h4 class="comparison-title">${escapeHtml(comp.player1)} <span class="vs">vs</span> ${escapeHtml(comp.player2)}</h4>
                    
                    <div class="comparison-stats-grid">
                        <div class="comparison-player" style="border-color: ${p1Color};">
                            <div class="comparison-player-header" style="background-color: ${p1Color}20;">
                                <h5 style="color: ${p1Color};">${escapeHtml(comp.player1)}</h5>
                            </div>
                            <div class="comparison-stats">
                                <div class="comparison-stat">
                                    <span class="stat-label">Win Rate</span>
                                    <span class="stat-value">${comp.player1Stats.winRate}%</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Games</span>
                                    <span class="stat-value">${comp.player1Stats.games}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">W-D-L</span>
                                    <span class="stat-value">${comp.player1Stats.wins}-${comp.player1Stats.draws}-${comp.player1Stats.losses}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goals</span>
                                    <span class="stat-value">${comp.player1Stats.goalsFor}:${comp.player1Stats.goalsAgainst}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goal Diff</span>
                                    <span class="stat-value ${comp.player1Stats.goalDifference >= 0 ? 'positive' : 'negative'}">${comp.player1Stats.goalDifference > 0 ? '+' : ''}${comp.player1Stats.goalDifference}</span>
                                </div>
                            </div>
                        </div>

                        <div class="comparison-player" style="border-color: ${p2Color};">
                            <div class="comparison-player-header" style="background-color: ${p2Color}20;">
                                <h5 style="color: ${p2Color};">${escapeHtml(comp.player2)}</h5>
                            </div>
                            <div class="comparison-stats">
                                <div class="comparison-stat">
                                    <span class="stat-label">Win Rate</span>
                                    <span class="stat-value">${comp.player2Stats.winRate}%</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Games</span>
                                    <span class="stat-value">${comp.player2Stats.games}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">W-D-L</span>
                                    <span class="stat-value">${comp.player2Stats.wins}-${comp.player2Stats.draws}-${comp.player2Stats.losses}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goals</span>
                                    <span class="stat-value">${comp.player2Stats.goalsFor}:${comp.player2Stats.goalsAgainst}</span>
                                </div>
                                <div class="comparison-stat">
                                    <span class="stat-label">Goal Diff</span>
                                    <span class="stat-value ${comp.player2Stats.goalDifference >= 0 ? 'positive' : 'negative'}">${comp.player2Stats.goalDifference > 0 ? '+' : ''}${comp.player2Stats.goalDifference}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${comp.headToHead.games > 0 ? `
                        <div class="head-to-head-section">
                            <h5>Head-to-Head</h5>
                            <div class="h2h-stats">
                                <div class="h2h-stat">
                                    <span class="h2h-label">${escapeHtml(comp.player1)}</span>
                                    <span class="h2h-value" style="color: ${p1Color};">${comp.headToHead.p1Wins} wins (${comp.headToHead.p1WinRate.toFixed(1)}%)</span>
                                </div>
                                <div class="h2h-stat">
                                    <span class="h2h-label">Draws</span>
                                    <span class="h2h-value">${comp.headToHead.draws}</span>
                                </div>
                                <div class="h2h-stat">
                                    <span class="h2h-label">${escapeHtml(comp.player2)}</span>
                                    <span class="h2h-value" style="color: ${p2Color};">${comp.headToHead.p2Wins} wins (${comp.headToHead.p2WinRate.toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Extra Time & Penalties Statistics Calculator
StatisticsCalculators.register({
    id: 'extraTimePenalties',
    name: 'Extra Time & Penalties',
    category: 'performance',
    subcategory: 'match-types',
    calculate: (matches, players) => {
        const stats = {};
        players.forEach(player => {
            stats[player] = {
                totalMatches: 0,
                extraTimeMatches: 0,
                extraTimeWins: 0,
                extraTimeLosses: 0,
                extraTimeDraws: 0,
                penaltiesMatches: 0,
                penaltiesWins: 0,
                penaltiesLosses: 0,
                penaltiesScored: 0,
                penaltiesConceded: 0
            };
        });

        matches.forEach(match => {
            const { team1, team2, result, team1ExtraTimeScore, team2ExtraTimeScore, team1PenaltiesScore, team2PenaltiesScore } = match;
            const team1Players = Array.isArray(team1) ? team1 : [team1];
            const team2Players = Array.isArray(team2) ? team2 : [team2];
            
            const hasExtraTime = team1ExtraTimeScore !== undefined && team2ExtraTimeScore !== undefined;
            const hasPenalties = team1PenaltiesScore !== undefined && team2PenaltiesScore !== undefined;

            // Count all matches for each player
            [...team1Players, ...team2Players].forEach(player => {
                if (stats[player]) {
                    stats[player].totalMatches++;
                    
                    const inTeam1 = team1Players.includes(player);
                    const won = (result === 'team1' && inTeam1) || (result === 'team2' && !inTeam1);
                    const lost = (result === 'team1' && !inTeam1) || (result === 'team2' && inTeam1);
                    const drawn = result === 'draw';
                    
                    if (hasExtraTime) {
                        stats[player].extraTimeMatches++;
                        if (won) stats[player].extraTimeWins++;
                        else if (lost) stats[player].extraTimeLosses++;
                        else if (drawn) stats[player].extraTimeDraws++;
                    }
                    
                    if (hasPenalties) {
                        stats[player].penaltiesMatches++;
                        if (won) stats[player].penaltiesWins++;
                        else if (lost) stats[player].penaltiesLosses++;
                        
                        // Count penalties scored/conceded
                        if (inTeam1) {
                            stats[player].penaltiesScored += team1PenaltiesScore || 0;
                            stats[player].penaltiesConceded += team2PenaltiesScore || 0;
                        } else {
                            stats[player].penaltiesScored += team2PenaltiesScore || 0;
                            stats[player].penaltiesConceded += team1PenaltiesScore || 0;
                        }
                    }
                }
            });
        });

        return stats;
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card';
        
        const escapeHtml = (str = '') => {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        
        const sorted = Object.entries(data)
            .sort((a, b) => {
                // Sort by total matches, then by extra time matches
                if (b[1].totalMatches !== a[1].totalMatches) {
                    return b[1].totalMatches - a[1].totalMatches;
                }
                return b[1].extraTimeMatches - a[1].extraTimeMatches;
            });

        if (sorted.length === 0 || sorted.every(([_, stats]) => stats.totalMatches === 0)) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏱️</div><h3>No Extra Time Data</h3><p>Record matches that went to extra time or penalties to see statistics here!</p></div>';
            return container;
        }

        const html = sorted.map(([player, stats]) => {
            const extraTimeWinRate = stats.extraTimeMatches > 0 
                ? ((stats.extraTimeWins / stats.extraTimeMatches) * 100).toFixed(1) 
                : '0.0';
            const penaltiesWinRate = stats.penaltiesMatches > 0 
                ? ((stats.penaltiesWins / stats.penaltiesMatches) * 100).toFixed(1) 
                : '0.0';
            
            const color = window.appController && window.appController.settingsManager
                ? window.appController.settingsManager.getPlayerColor(player)
                : null;
            const playerStyle = color ? `style="color: ${color}; font-weight: 600;"` : '';

            return `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background-color: var(--surface-color); border-radius: 8px; border: 1px solid var(--border-color);">
                    <h4 ${playerStyle}>${escapeHtml(player)}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div>
                            <strong style="font-size: 0.9rem; color: var(--text-secondary);">Extra Time</strong>
                            <table class="league-table" style="margin-top: 0.5rem; font-size: 0.9rem;">
                                <tbody>
                                    <tr>
                                        <td>Matches</td>
                                        <td><strong>${stats.extraTimeMatches}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>W-D-L</td>
                                        <td><strong>${stats.extraTimeWins}-${stats.extraTimeDraws}-${stats.extraTimeLosses}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Win Rate</td>
                                        <td><strong>${extraTimeWinRate}%</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <strong style="font-size: 0.9rem; color: var(--text-secondary);">Penalties</strong>
                            <table class="league-table" style="margin-top: 0.5rem; font-size: 0.9rem;">
                                <tbody>
                                    <tr>
                                        <td>Matches</td>
                                        <td><strong>${stats.penaltiesMatches}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>W-L</td>
                                        <td><strong>${stats.penaltiesWins}-${stats.penaltiesLosses}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Win Rate</td>
                                        <td><strong>${penaltiesWinRate}%</strong></td>
                                    </tr>
                                    ${stats.penaltiesMatches > 0 ? `
                                    <tr>
                                        <td>Pens Scored</td>
                                        <td><strong>${stats.penaltiesScored}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Pens Conceded</td>
                                        <td><strong>${stats.penaltiesConceded}</strong></td>
                                    </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        return container;
    }
});

// Performance Heatmap - Calendar View
StatisticsCalculators.register({
    id: 'performanceHeatmap',
    name: 'Activity Heatmap',
    category: 'visualization',
    subcategory: 'overview',
    calculate: (matches, players) => {
        if (matches.length === 0) return {};

        // Group matches by date
        const dateMap = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        matches.forEach(match => {
            if (!match.timestamp) return;
            const matchDate = new Date(match.timestamp);
            matchDate.setHours(0, 0, 0, 0);
            const dateKey = matchDate.toISOString().split('T')[0];
            
            if (!dateMap[dateKey]) {
                dateMap[dateKey] = 0;
            }
            dateMap[dateKey]++;
        });

        // Get date range (last 365 days or from first match)
        const allDates = Object.keys(dateMap).sort();
        const startDate = allDates.length > 0 
            ? new Date(allDates[0]) 
            : new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        
        const endDate = today;
        const maxMatches = Math.max(...Object.values(dateMap), 1);

        return {
            dateMap,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            maxMatches,
            totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        };
    },
    display: (data) => {
        const container = document.createElement('div');
        container.className = 'stat-card heatmap-card';
        
        if (!data.dateMap || Object.keys(data.dateMap).length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Activity</h3><p>Play some matches to see your activity heatmap!</p></div>';
            return container;
        }

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const maxMatches = data.maxMatches;

        // Generate calendar grid (weeks x days)
        const weeks = [];
        let currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() - currentDate.getDay()); // Start from Sunday

        while (currentDate <= endDate) {
            const week = [];
            for (let day = 0; day < 7; day++) {
                const dateKey = currentDate.toISOString().split('T')[0];
                const matchCount = data.dateMap[dateKey] || 0;
                const intensity = maxMatches > 0 ? Math.min(1, matchCount / maxMatches) : 0;
                
                week.push({
                    date: new Date(currentDate),
                    dateKey,
                    matchCount,
                    intensity
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeks.push(week);
        }

        // Get month labels
        const monthLabels = [];
        let lastMonth = -1;
        weeks.forEach((week, weekIndex) => {
            const firstDay = week[0].date;
            const month = firstDay.getMonth();
            if (month !== lastMonth) {
                monthLabels.push({ weekIndex, month: firstDay.toLocaleDateString('en-US', { month: 'short' }) });
                lastMonth = month;
            }
        });

        const getIntensityColor = (intensity) => {
            if (intensity === 0) return '#EBEDF0';
            if (intensity < 0.25) return '#C6E48B';
            if (intensity < 0.5) return '#7BC96F';
            if (intensity < 0.75) return '#239A3B';
            return '#196127';
        };

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const html = `
            <div class="heatmap-container">
                <h4>Match Activity Calendar</h4>
                <div class="heatmap-legend">
                    <span>Less</span>
                    <div class="heatmap-legend-colors">
                        <div class="legend-square" style="background-color: #EBEDF0;"></div>
                        <div class="legend-square" style="background-color: #C6E48B;"></div>
                        <div class="legend-square" style="background-color: #7BC96F;"></div>
                        <div class="legend-square" style="background-color: #239A3B;"></div>
                        <div class="legend-square" style="background-color: #196127;"></div>
                    </div>
                    <span>More</span>
                </div>
                <div class="heatmap-grid">
                    <div class="heatmap-day-labels">
                        ${dayNames.map(day => `<div class="day-label">${day}</div>`).join('')}
                    </div>
                    <div class="heatmap-content">
                        <div class="heatmap-months">
                            ${monthLabels.map(m => `<div class="month-label" style="grid-column: ${m.weekIndex + 2};">${m.month}</div>`).join('')}
                        </div>
                        <div class="heatmap-squares">
                            ${weeks.map(week => 
                                week.map(day => {
                                    const color = getIntensityColor(day.intensity);
                                    const tooltip = day.matchCount > 0 
                                        ? `${day.matchCount} match${day.matchCount > 1 ? 'es' : ''} on ${day.date.toLocaleDateString()}`
                                        : `No matches on ${day.date.toLocaleDateString()}`;
                                    return `
                                        <div 
                                            class="heatmap-square ${day.intensity > 0 ? 'has-matches' : ''}" 
                                            style="background-color: ${color};"
                                            title="${tooltip}"
                                            data-date="${day.dateKey}"
                                            data-count="${day.matchCount}"
                                        ></div>
                                    `;
                                }).join('')
                            ).join('')}
                        </div>
                    </div>
                </div>
                <div class="heatmap-summary">
                    <p>Total match days: <strong>${Object.keys(data.dateMap).length}</strong></p>
                    <p>Total matches: <strong>${Object.values(data.dateMap).reduce((a, b) => a + b, 0)}</strong></p>
                </div>
            </div>
        `;

        container.innerHTML = html;
        return container;
    }
});

