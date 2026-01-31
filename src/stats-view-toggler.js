// src/stats-view-toggler.js
import { getAllMatches, getTeamStats } from './statistics-tracker.js';
import { displayOverallStats, displaySeasonStats, displayTodayStats, showTeamDetails } from './statistics-display.js';

export function setupToggleUI() {
    const toggleButton = document.createElement('button');
    toggleButton.innerText = 'Switch to Team View';
    toggleButton.id = 'stats-view-toggle';
    toggleButton.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        z-index: 10000;
        padding: 15px 25px;
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        border: 2px solid white;
        border-radius: 30px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        transition: all 0.3s ease;
    `;
    toggleButton.onmouseover = () => toggleButton.style.transform = 'scale(1.05)';
    toggleButton.onmouseout = () => toggleButton.style.transform = 'scale(1)';

    toggleButton.onclick = function() {
        const statsContainer = document.querySelector('#overallStatsDisplay') || document.querySelector('#seasonStatsDisplay') || document.querySelector('.stats-display');

        if (toggleButton.innerText === 'Switch to Team View') {
            // Switch to team view
            window.currentStatsView = 'team'; // Set view state first
            
            // Detect which stats tab is currently selected
            const statsTabSelect = document.querySelector('#statsTabSelect');
            const activeTab = statsTabSelect ? statsTabSelect.value : 'overall';
            
            // Clear only the active tab's container
            let activeContainer = null;
            if (activeTab === 'today') {
                activeContainer = document.querySelector('#todayStatsDisplay');
            } else if (activeTab === 'season') {
                activeContainer = document.querySelector('#seasonStatsDisplay');
            } else if (activeTab === 'overall') {
                activeContainer = document.querySelector('#overallStatsDisplay');
            } else if (activeTab === 'custom') {
                activeContainer = document.querySelector('#customStatsDisplay');
            }
            
            if (activeContainer) {
                activeContainer.innerHTML = '';
                activeContainer.style.display = 'block';
            }
            
            renderTeamTable();
            toggleButton.innerText = 'Switch to Player View';
            toggleButton.style.background = 'linear-gradient(135deg, #4CAF50, #388E3C)'; // Green for team view
        } else {
            // Switch to player view - detect which stats tab is active and restore appropriate stats
            window.currentStatsView = 'player'; // Clear team view state first
            
            // Detect which stats tab is currently selected
            const statsTabSelect = document.querySelector('#statsTabSelect');
            const activeTab = statsTabSelect ? statsTabSelect.value : 'overall';
            
            // Clear all containers
            const allStatsContainers = document.querySelectorAll('#overallStatsDisplay, #seasonStatsDisplay, #todayStatsDisplay, #customStatsDisplay, .stats-display');
            allStatsContainers.forEach(container => {
                container.innerHTML = '';
                container.style.display = 'block';
            });
            
            // Restore stats based on active tab
            if (activeTab === 'today') {
                displayTodayStats(
                    document.getElementById('todayStatsDisplay')
                );
            } else if (activeTab === 'season') {
                const currentSeason = window.appController?.seasonManager?.getCurrentSeason() || 1;
                displaySeasonStats(
                    currentSeason,
                    document.getElementById('seasonStatsDisplay')
                );
            } else if (activeTab === 'overall') {
                displayOverallStats(
                    document.getElementById('overallStatsDisplay')
                );
            }
            
            toggleButton.innerText = 'Switch to Team View';
            toggleButton.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)'; // Blue for player view
        }
    };
    // Only add the button if we're on the stats page and it doesn't already exist
    const checkForStatsPage = () => {
        const statsContainer = document.querySelector('#overallStatsDisplay') || document.querySelector('#seasonStatsDisplay');
        if (statsContainer && !document.querySelector('#stats-view-toggle')) {
            document.body.appendChild(toggleButton);
        }
    };

    // Check immediately and also after a delay in case the page loads dynamically
    checkForStatsPage();
    setTimeout(checkForStatsPage, 1000);
    setTimeout(checkForStatsPage, 3000); // Extra check for slower loading
}

export function renderPlayerTable() {
    // Use existing stats display for player view
    const statsContainer = document.querySelector('#overallStatsDisplay') || document.querySelector('#seasonStatsDisplay') || document.querySelector('.stats-display');
    if (statsContainer) {
        displayOverallStats(statsContainer);
    }
}

export function renderTeamTable() {
    // Get all matches and calculate team stats
    const matches = getAllMatches() || [];
    const teamStats = getTeamStats(matches) || {};

    if (Object.keys(teamStats).length === 0) {
        statsContainer.innerHTML = '<div class="empty-state"><p>No team data available. Play some matches first!</p></div>';
        return;
    }

    // Detect which stats tab is currently active
    const statsTabSelect = document.querySelector('#statsTabSelect');
    const activeTab = statsTabSelect ? statsTabSelect.value : 'overall';
    
    // Find the appropriate stats container based on active tab
    let statsContainer = null;
    if (activeTab === 'today') {
        statsContainer = document.querySelector('#todayStatsDisplay');
    } else if (activeTab === 'season') {
        statsContainer = document.querySelector('#seasonStatsDisplay');
    } else if (activeTab === 'overall') {
        statsContainer = document.querySelector('#overallStatsDisplay');
    } else if (activeTab === 'custom') {
        statsContainer = document.querySelector('#customStatsDisplay');
    }
    
    // Fallback to any stats display container
    if (!statsContainer) {
        statsContainer = document.querySelector('#overallStatsDisplay') || 
                        document.querySelector('#seasonStatsDisplay') || 
                        document.querySelector('#todayStatsDisplay') ||
                        document.querySelector('.stats-display');
    }

    if (!statsContainer) {
        console.error('No stats container found for team view');
        return;
    }

    // Clear existing content completely
    statsContainer.innerHTML = '';
    statsContainer.style.display = 'block';

    // Helper function to format team name with "&" on shorter line
    function formatTeamName(players) {
        if (players.length === 1) {
            return players[0];
        }
        if (players.length === 2) {
            const [player1, player2] = players;
            const len1 = player1.length;
            const len2 = player2.length;
            
            // Put "&" on shorter line, default to top if equal
            if (len1 <= len2) {
                return `${player1} &<br>${player2}`;
            } else {
                return `${player1}<br>& ${player2}`;
            }
        }
        // For 3+ players, just join them
        return players.join(' &<br>');
    }

    // Filter out solo teams (teams with only 1 player) - only show partnerships
    const partnershipStats = Object.entries(teamStats).filter(([teamId, teamData]) => {
        const players = Array.isArray(teamData.players) ? teamData.players : [teamData.players];
        return players.length > 1; // Only show teams with 2+ players
    });
    
    // Debug: Show team data before creating table
    const sortedTeams = partnershipStats
        .sort(([,a], [,b]) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

    // Create team table with prominent styling and mobile-friendly layout
    const teamTable = document.createElement('div');
    teamTable.className = 'stat-card team-stats-card';
    teamTable.style.cssText = `
        background: #f8f9fa;
        border: 2px solid #4CAF50;
        border-radius: 12px;
        padding: 15px;
        margin: 20px 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    `;
    
    // Create scrollable table container
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        overflow-x: auto;
        overflow-y: visible;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        max-width: 100%;
    `;
    
    teamTable.innerHTML = `
        <h3 style="color: #4CAF50; font-size: 20px; margin-bottom: 15px; text-align: center;">🏆 TEAM LEAGUE STANDINGS 🏆</h3>
    `;
    
    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        min-width: 600px;
        border-collapse: collapse;
        font-size: 14px;
    `;
    
    table.innerHTML = `
        <thead>
            <tr style="background: #4CAF50; color: white; position: sticky; top: 0; z-index: 10;">
                <th style="padding: 12px 8px; text-align: left; min-width: 120px; max-width: 150px; font-size: 13px;">Team</th>
                <th style="padding: 12px 8px; text-align: center; min-width: 50px; font-size: 13px; font-weight: bold;">Pts</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">P</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">W</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">D</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">L</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 40px; font-size: 13px;">GF</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 40px; font-size: 13px;">GA</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 45px; font-size: 13px;">GD</th>
            </tr>
        </thead>
        <tbody>
            ${sortedTeams
                .map(([teamId, stats], index) => `
                    <tr style="border-bottom: 1px solid #e0e0e0; background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                        <td style="font-weight: bold; font-size: 14px; padding: 10px 8px; line-height: 1.4; max-width: 150px; vertical-align: middle;" title="${stats.players.join(' & ')}">
                            <span class="team-name-clickable" data-team-id="${teamId}" data-team-players="${stats.players.join(',')}" style="cursor: pointer; color: #2196F3; text-decoration: underline;">${formatTeamName(stats.players)}</span>
                        </td>
                        <td style="text-align: center; padding: 10px 8px; font-weight: bold; font-size: 16px; color: #4CAF50;">${stats.points}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.played}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.won}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.drawn}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.lost}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.gf}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.ga}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px; font-weight: bold; ${stats.gd > 0 ? 'color: #2e7d32;' : stats.gd < 0 ? 'color: #c62828;' : 'color: #666;'}">${stats.gd > 0 ? '+' : ''}${stats.gd}</td>
                    </tr>
                `).join('')}
        </tbody>
    `;
    
    tableContainer.appendChild(table);
    teamTable.appendChild(tableContainer);

    statsContainer.appendChild(teamTable);
    
    // Add click handlers for team names
    setTimeout(() => {
        const clickableNames = teamTable.querySelectorAll('.team-name-clickable');
        clickableNames.forEach(element => {
            element.addEventListener('click', (e) => {
                const teamId = element.getAttribute('data-team-id');
                const teamPlayers = element.getAttribute('data-team-players').split(',');
                if (window.appController && window.appController.showTeamDetails) {
                    showTeamDetails(teamPlayers);
                }
            });
        });
    }, 100);
    
    // Force a visual update
    statsContainer.style.display = 'block';
    statsContainer.style.visibility = 'visible';
    teamTable.style.display = 'block';
    teamTable.style.visibility = 'visible';
    
    // Scroll to the table
    teamTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
}