// ============================================================================
// StatisticsDisplay - Render Statistics
// ============================================================================

import { StatisticsCalculators, StatDescriptions } from './stats-calculators.js';

class StatisticsDisplay {
    constructor(statisticsTracker, settingsManager) {
        this.statisticsTracker = statisticsTracker;
        this.settingsManager = settingsManager;
    }

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
        const stats = this.statisticsTracker.getSeasonStats(seasonNumber);
        this.renderStats(stats, container, category, subcategory, false, allowedCalculatorIds);
    }

    displayOverallStats(container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.statisticsTracker.getOverallStats();
        this.renderStats(stats, container, category, subcategory, false, allowedCalculatorIds);
    }

    displayTodayStats(container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.statisticsTracker.getTodayStats();
        this.renderStats(stats, container, category, subcategory, true, allowedCalculatorIds);
    }

    displayCustomStats(matches, container, category = null, subcategory = null, allowedCalculatorIds = null) {
        const stats = this.statisticsTracker.calculateStatistics(matches || [], 'custom');
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
                ? '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No matches today</h3><p>Start playing to see today\'s statistics.</p><button type="button" class="btn btn-primary empty-state-cta" data-screen="matchScreen">Record a match</button></div>'
                : '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No statistics yet</h3><p>Play some matches to see stats here.</p><button type="button" class="btn btn-primary empty-state-cta" data-screen="playerScreen">Add players</button></div>'
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

    applyPlayerColorsToElement(element) {
        if (!this.settingsManager) return;
        const players = this.statisticsTracker.getPlayers();
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

    closeStatDescription() {
        const modal = document.querySelector('.stat-description-modal-overlay');
        if (modal) modal.remove();
    }

    showTeamDetails(teamPlayers) {
    // This function will be defined in app-controller.js and passed down.
    // For now, it's a placeholder, but it's important to define it as part of the public interface.
        console.log('Showing team details for:', teamPlayers);
    }
}

export { StatisticsDisplay };
