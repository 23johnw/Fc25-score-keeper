// ============================================================================
// StatisticsDisplay - Render Statistics
// ============================================================================

// UI Toggle Implementation

function setupToggleUI() {
    // #region agent log
    console.log('setupToggleUI called');
    fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            location: 'src/statistics-display.js:setupToggleUI',
            message: 'setupToggleUI executed',
            timestamp: Date.now(),
            sessionId: 'debug-session'
        })
    }).catch(() => {});
    // #endregion

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
        // #region agent log
        console.log('Toggle button clicked, current text:', toggleButton.innerText);
        fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                location: 'src/statistics-display.js:toggleButton.onclick',
                message: 'Toggle button clicked',
                data: { currentView: toggleButton.innerText },
                timestamp: Date.now(),
                sessionId: 'debug-session'
            })
        }).catch(() => {});
        // #endregion

        const statsContainer = document.querySelector('#overallStatsDisplay') || document.querySelector('#seasonStatsDisplay') || document.querySelector('.stats-display');

        if (toggleButton.innerText === 'Switch to Team View') {
            // Switch to team view
            console.log('Switching to team view');
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
            console.log('Switching to player view');
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
            if (window.appController?.statisticsDisplay) {
                if (activeTab === 'today') {
                    window.appController.statisticsDisplay.displayTodayStats(
                        document.getElementById('todayStatsDisplay')
                    );
                } else if (activeTab === 'season') {
                    const currentSeason = window.appController?.seasonManager?.getCurrentSeason() || 1;
                    window.appController.statisticsDisplay.displaySeasonStats(
                        currentSeason,
                        document.getElementById('seasonStatsDisplay')
                    );
                } else if (activeTab === 'overall') {
                    window.appController.statisticsDisplay.displayOverallStats(
                        document.getElementById('overallStatsDisplay')
                    );
                }
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
            console.log('Stats toggle button added to page');
        }
    };

    // Check immediately and also after a delay in case the page loads dynamically
    checkForStatsPage();
    setTimeout(checkForStatsPage, 1000);
    setTimeout(checkForStatsPage, 3000); // Extra check for slower loading
}

function renderPlayerTable() {
    // #region agent log
    console.log('renderPlayerTable called');
    fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            location: 'src/statistics-display.js:renderPlayerTable',
            message: 'renderPlayerTable executed',
            timestamp: Date.now(),
            sessionId: 'debug-session'
        })
    }).catch(() => {});
    // #endregion

    // Use existing stats display for player view
    const statsContainer = document.querySelector('#overallStatsDisplay') || document.querySelector('#seasonStatsDisplay') || document.querySelector('.stats-display');
    if (statsContainer && window.appController?.statisticsDisplay) {
        window.appController.statisticsDisplay.displayOverallStats(statsContainer);
    }
}

// Make renderTeamTable globally accessible
window.renderTeamTable = function renderTeamTable() {
    // #region agent log
    console.log('renderTeamTable called');
    fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            location: 'src/statistics-display.js:renderTeamTable',
            message: 'renderTeamTable executed',
            timestamp: Date.now(),
            sessionId: 'debug-session'
        })
    }).catch(() => {});
    // #endregion

    // Get all matches and calculate team stats
    const matches = window.appController?.statisticsTracker?.getAllMatches() || [];
    const teamStats = window.appController?.statisticsTracker?.getTeamStats(matches) || {};

    console.log('Team View Debug:', {
        matchesCount: matches.length,
        teamStatsKeys: Object.keys(teamStats),
        teamStats: teamStats,
        sampleMatch: matches[0]
    });

    if (Object.keys(teamStats).length === 0) {
        statsContainer.innerHTML = '<div class="empty-state"><p>No team data available. Play some matches first!</p></div>';
        console.log('No team stats available');
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

    console.log('Found stats container:', statsContainer.id, 'for team view (active tab:', activeTab, ')');

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

    // Debug: Show team data before creating table
    const sortedTeams = Object.entries(teamStats)
        .sort(([,a], [,b]) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

    console.log('Sorted teams for display:', sortedTeams);
    console.log(`Top team: ${sortedTeams[0]?.[1]?.players?.join(' & ')} with ${sortedTeams[0]?.[1]?.points} points`);

    // Create team table with prominent styling and mobile-friendly layout
    const teamTable = document.createElement('div');
    teamTable.className = 'stat-card team-stats-card';
    teamTable.style.cssText = `
        background: #f8f9fa;
        border: 2px solid #4CAF50;
        border-radius: 12px;
        padding: 15px;
        margin: 20px 0;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
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
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">P</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">W</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">D</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 35px; font-size: 13px;">L</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 40px; font-size: 13px;">GF</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 40px; font-size: 13px;">GA</th>
                <th style="padding: 12px 6px; text-align: center; min-width: 45px; font-size: 13px;">GD</th>
                <th style="padding: 12px 8px; text-align: center; min-width: 50px; font-size: 13px; font-weight: bold;">Pts</th>
            </tr>
        </thead>
        <tbody>
            ${sortedTeams
                .map(([teamId, stats], index) => `
                    <tr style="border-bottom: 1px solid #e0e0e0; background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                        <td style="font-weight: bold; font-size: 14px; padding: 10px 8px; line-height: 1.4; max-width: 150px; vertical-align: middle;" title="${stats.players.join(' & ')}">${formatTeamName(stats.players)}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.played}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.won}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.drawn}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.lost}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.gf}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px;">${stats.ga}</td>
                        <td style="text-align: center; padding: 10px 6px; font-size: 14px; font-weight: bold; ${stats.gd > 0 ? 'color: #2e7d32;' : stats.gd < 0 ? 'color: #c62828;' : 'color: #666;'}">${stats.gd > 0 ? '+' : ''}${stats.gd}</td>
                        <td style="text-align: center; padding: 10px 8px; font-weight: bold; font-size: 16px; color: #4CAF50;">${stats.points}</td>
                    </tr>
                `).join('')}
        </tbody>
    `;
    
    tableContainer.appendChild(table);
    teamTable.appendChild(tableContainer);

    statsContainer.appendChild(teamTable);
    console.log('Team table appended to container:', statsContainer.id);
    
    // Force a visual update
    statsContainer.style.display = 'block';
    statsContainer.style.visibility = 'visible';
    teamTable.style.display = 'block';
    teamTable.style.visibility = 'visible';
    
    // Scroll to the table
    teamTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// #region agent log
console.log('setupToggleUI called at end of script');
fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        location: 'src/statistics-display.js:setupToggleUI call',
        message: 'setupToggleUI invoked at script end',
        timestamp: Date.now(),
        sessionId: 'debug-session'
    })
}).catch(() => {});
// #endregion

setupToggleUI();


class StatisticsDisplay {
    constructor(statisticsTracker, settingsManager = null) {
        this.tracker = statisticsTracker;
        this.settingsManager = settingsManager;
    }
    
    // Helper to format player name with color
    formatPlayerNameWithColor(playerName) {
        if (!this.settingsManager) {
            return this.escapeHtml(playerName);
        }
        const color = this.settingsManager.getPlayerColor(playerName);
        const escapedName = this.escapeHtml(playerName);
        if (color) {
            return `<span style="color: ${color}; font-weight: 600;">${escapedName}</span>`;
        }
        return escapedName;
    }
    
    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    displaySeasonStats(seasonNumber, container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.tracker.getSeasonStats(seasonNumber);
        this.renderStats(stats, container, category, subcategory, false, allowedCalculatorIds);
    }

    displayOverallStats(container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.tracker.getOverallStats();
        this.renderStats(stats, container, category, subcategory, false, allowedCalculatorIds);
    }

    displayTodayStats(container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.tracker.getTodayStats();
        this.renderStats(stats, container, category, subcategory, true, allowedCalculatorIds);
    }

    displayCustomStats(matches, container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.tracker.calculateStatistics(matches || [], 'custom');
        const customEmptyMessage = '<div class="empty-state"><p>Select a date range in By Date to see custom statistics.</p></div>';
        const noMatches = !matches || matches.length === 0;
        this.renderStats(
            stats,
            container,
            category,
            subcategory,
            false,
            allowedCalculatorIds,
            noMatches ? customEmptyMessage : null
        );
    }

    renderStats(stats, container, category = null, subcategory = null, isToday = false, allowedCalculatorIds = null, customEmptyMessage = null) {
        container.innerHTML = '';
        
        if (Object.keys(stats).length === 0) {
            const message = customEmptyMessage || (
                isToday 
                    ? '<div class="empty-state"><p>No matches played today yet. Start playing to see today\'s statistics!</p></div>'
                    : '<div class="empty-state"><p>No statistics available yet. Play some matches first!</p></div>'
            );
            container.innerHTML = message;
            return;
        }

        let calculators;
        if (category && subcategory) {
            calculators = StatisticsCalculators.getBySubcategory(category, subcategory);
        } else if (category) {
            calculators = StatisticsCalculators.getByCategory(category);
        } else {
            calculators = StatisticsCalculators.getAll();
        }

        if (allowedCalculatorIds && allowedCalculatorIds.length > 0) {
            calculators = calculators
                .filter(calc => allowedCalculatorIds.includes(calc.id))
                .sort((a, b) => allowedCalculatorIds.indexOf(a.id) - allowedCalculatorIds.indexOf(b.id));
        }
        
        // When showing "All", ensure we show ALL calculators or all in the selected group
        const showAll = category === null || (allowedCalculatorIds && allowedCalculatorIds.length > 0);
        
        calculators.forEach(calculator => {
            try {
                const data = stats[calculator.id];
                // When showing "All", display all calculators (they handle empty states)
                // When filtering by category, only show calculators with data
                if (showAll) {
                    // Show all calculators when "All" is selected - always display them
                    // Use the data from stats, or empty object if not calculated
                    const displayData = data !== undefined ? data : {};
                    let element;
                    try {
                        element = calculator.display(displayData);
                    } catch (displayError) {
                        console.error(`Display error for calculator ${calculator.id}:`, displayError);
                        element = null;
                    }
                    if (element && element.nodeType) {
                        // Apply player colors to the rendered element
                        this.applyPlayerColorsToElement(element);
                        // Add title with help icon
                        this.addStatCardTitleWithIcon(element, calculator);
                        container.appendChild(element);
                    } else {
                        // If display returned null/undefined/falsy, create a placeholder
                        const placeholderElement = document.createElement('div');
                        placeholderElement.className = 'stat-card';
                        placeholderElement.innerHTML = `<div class="empty-state"><h3>${calculator.name || calculator.id}</h3><p>No data available</p></div>`;
                        // Add title with help icon to placeholder
                        this.addStatCardTitleWithIcon(placeholderElement, calculator);
                        container.appendChild(placeholderElement);
                    }
                } else {
                    // For specific categories, only show calculators with data
                    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                        const element = calculator.display(data);
                        if (element && element.nodeType) {
                            // Apply player colors to the rendered element
                            this.applyPlayerColorsToElement(element);
                            // Add title with help icon
                            this.addStatCardTitleWithIcon(element, calculator);
                            container.appendChild(element);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error displaying calculator ${calculator.id}:`, error);
                // Still try to display an error message for the calculator when showing All
                if (showAll) {
                    const errorElement = document.createElement('div');
                    errorElement.className = 'stat-card';
                    errorElement.innerHTML = `<div class="empty-state"><h3>${calculator.name || calculator.id}</h3><p>Error loading: ${error.message}</p></div>`;
                    // Add title with help icon to error element
                    this.addStatCardTitleWithIcon(errorElement, calculator);
                    container.appendChild(errorElement);
                }
            }
        });
    }
    
    // Post-process HTML to apply player colors
    applyPlayerColorsToElement(element) {
        if (!this.settingsManager) return;
        
        const players = this.tracker.getPlayers();
        // Apply colors to all player-name elements
        element.querySelectorAll('.player-name').forEach(el => {
            const text = el.textContent.trim();
            // Remove emoji symbols for matching (🥇🥈🥉)
            const cleanText = text.replace(/[🥇🥈🥉]/g, '').trim();
            
            // Try to match player name (handle cases where name might have emoji prefix)
            players.forEach(player => {
                if (cleanText === player || text === player) {
                    const color = this.settingsManager.getPlayerColor(player);
                    if (color && !el.style.color) {
                        el.style.color = color;
                        el.style.fontWeight = '600';
                    }
                }
            });
        });
    }

    // Add title and question mark icon to stat card
    addStatCardTitleWithIcon(element, calculator) {
        // For worstLosses (Records) which has multiple sub-tables, check if there are multiple h3 elements
        const allH3s = element.querySelectorAll('h3');
        
        // If there are multiple h3s (like in worstLosses), add a main title at the top
        // Otherwise, check if there's a single h3 to modify
        if (allH3s.length > 1 || calculator.id === 'worstLosses') {
            // Create new main title header with icon at the very beginning
            const titleContainer = document.createElement('div');
            titleContainer.className = 'stat-card-title-container';
            
            const title = document.createElement('h3');
            title.className = 'stat-card-title';
            title.textContent = calculator.name || calculator.id;
            
            titleContainer.appendChild(title);
            titleContainer.appendChild(this.createHelpIcon(calculator.id, calculator.name));
            
            // Insert at the very beginning of the stat card
            element.insertBefore(titleContainer, element.firstChild);
        } else if (allH3s.length === 1) {
            // Single h3 exists, add icon next to it
            const existingTitle = allH3s[0];
            const titleContainer = document.createElement('div');
            titleContainer.className = 'stat-card-title-container';
            
            // Clone title and wrap it
            const titleClone = existingTitle.cloneNode(true);
            titleContainer.appendChild(titleClone);
            
            // Add question mark icon
            titleContainer.appendChild(this.createHelpIcon(calculator.id, calculator.name));
            
            // Replace existing title with container
            existingTitle.replaceWith(titleContainer);
        } else {
            // No h3 exists, create new title header with icon
            const titleContainer = document.createElement('div');
            titleContainer.className = 'stat-card-title-container';
            
            const title = document.createElement('h3');
            title.className = 'stat-card-title';
            title.textContent = calculator.name || calculator.id;
            
            titleContainer.appendChild(title);
            titleContainer.appendChild(this.createHelpIcon(calculator.id, calculator.name));
            
            // Insert at the beginning of the stat card
            element.insertBefore(titleContainer, element.firstChild);
        }
    }

    // Create help icon button
    createHelpIcon(calculatorId, calculatorName) {
        const helpIcon = document.createElement('button');
        helpIcon.className = 'stat-help-icon';
        helpIcon.innerHTML = '?';
        helpIcon.setAttribute('aria-label', `Show description for ${calculatorName}`);
        helpIcon.setAttribute('title', 'What does this table show?');
        helpIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showStatDescription(calculatorId, calculatorName);
        });
        return helpIcon;
    }

    // Show modal popup with stat description
    showStatDescription(calculatorId, calculatorName) {
        const description = StatDescriptions.getUIDescription(calculatorId);
        if (!description) return;

        // Remove existing modal if present
        const existingModal = document.querySelector('.stat-description-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'stat-description-modal-overlay';
        
        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'stat-description-modal';
        
        // Create header with title and close button
        const header = document.createElement('div');
        header.className = 'stat-description-modal-header';
        
        const title = document.createElement('h3');
        title.className = 'stat-description-modal-title';
        title.textContent = calculatorName;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'stat-description-modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.addEventListener('click', () => this.closeStatDescription());
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'stat-description-modal-content';
        content.textContent = description;
        
        modal.appendChild(header);
        modal.appendChild(content);
        overlay.appendChild(modal);
        
        // Add to document
        document.body.appendChild(overlay);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeStatDescription();
            }
        });
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeStatDescription();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Focus close button for accessibility
        setTimeout(() => closeBtn.focus(), 100);
    }

    // Close stat description modal
    closeStatDescription() {
        const modal = document.querySelector('.stat-description-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
}

