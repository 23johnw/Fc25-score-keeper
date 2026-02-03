// ============================================================================
// History viewer helpers
// ============================================================================
// This file intentionally contains UI helpers that depend on the controller.
// Persistence stays in `src/persistence.js`.

/**
 * @param {import('./app-controller.js').AppController} controller
 */
export function initializeByDatePanel(controller) {
    const closeBtn = document.getElementById('closeByDatePanel');
    const applyBtn = document.getElementById('applyByDateBtn');
    const clearBtn = document.getElementById('clearByDateBtn');
    const listContainer = document.getElementById('byDateList');
    const fromInput = document.getElementById('byDateFrom');
    const toInput = document.getElementById('byDateTo');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => controller.toggleByDatePanel(false));
    }
    if (applyBtn) {
        applyBtn.addEventListener('click', () => controller.applyByDateFilter());
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => controller.clearByDateFilter());
    }

    if (listContainer) {
        renderByDateList(controller, listContainer);
    }

    if (fromInput) {
        fromInput.addEventListener('change', (e) => {
            controller.currentByDateFilter.from = e.target.value || null;
            controller.currentByDateFilter.selectedDate = null;
        });
    }
    if (toInput) {
        toInput.addEventListener('change', (e) => {
            controller.currentByDateFilter.to = e.target.value || null;
            controller.currentByDateFilter.selectedDate = null;
        });
    }
}

/**
 * @param {import('./app-controller.js').AppController} controller
 * @param {boolean} show
 */
export function toggleByDatePanel(controller, show = false) {
    const panel = document.getElementById('byDatePanel');
    if (!panel) return;
    panel.style.display = show ? 'flex' : 'none';
    if (show) {
        const listContainer = document.getElementById('byDateList');
        if (listContainer) {
            updatePlayedDates(controller);
            renderByDateList(controller, listContainer);
        }
    }
}

/**
 * @param {import('./app-controller.js').AppController} controller
 */
export function updatePlayedDates(controller) {
    const allMatches = controller.statisticsTracker.getAllMatches();
    const dateSet = new Set();
    allMatches.forEach(match => {
        if (match && match.timestamp) {
            const dateKey = new Date(match.timestamp).toISOString().split('T')[0];
            dateSet.add(dateKey);
        }
    });
    controller.playedDates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));

    const panel = document.getElementById('byDatePanel');
    const listContainer = document.getElementById('byDateList');
    if (!panel || !listContainer) return;
    if (getComputedStyle(panel).display !== 'none') {
        renderByDateList(controller, listContainer);
    }
}

/**
 * @param {import('./app-controller.js').AppController} controller
 * @param {HTMLElement} container
 */
export function renderByDateList(controller, container) {
    container.style.maxHeight = '240px';
    container.style.overflowY = 'auto';

    const dates = controller.playedDates || [];
    if (dates.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h4>No Dates</h4><p>Play some matches to enable date filtering.</p></div>';
        return;
    }

    container.innerHTML = dates.map(dateStr => {
        const isSelected = controller.currentByDateFilter.selectedDate === dateStr;
        return `
            <button class="by-date-pill ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                ${dateStr}
            </button>
        `;
    }).join('');

    container.querySelectorAll('.by-date-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const chosen = btn.dataset.date;
            controller.currentByDateFilter.selectedDate = chosen;
            controller.currentByDateFilter.from = chosen;
            controller.currentByDateFilter.to = chosen;
            const fromInput = document.getElementById('byDateFrom');
            const toInput = document.getElementById('byDateTo');
            if (fromInput) fromInput.value = chosen;
            if (toInput) toInput.value = chosen;
            renderByDateList(controller, container);
        });
    });
}

/**
 * @param {import('./app-controller.js').AppController} controller
 */
export function clearByDateFilter(controller) {
    controller.currentByDateFilter = { from: null, to: null, selectedDate: null };
    const fromInput = document.getElementById('byDateFrom');
    const toInput = document.getElementById('byDateTo');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    const listContainer = document.getElementById('byDateList');
    if (listContainer) renderByDateList(controller, listContainer);
    controller.updateCustomFilterSummary([]);
    controller.customFilterActive = false;
    controller.setByDateButtonActive(false);
    controller.showNormalStatsTabs();
}

/**
 * @param {import('./app-controller.js').AppController} controller
 */
export function applyByDateFilter(controller) {
    const { selectedDate, from, to } = controller.currentByDateFilter || {};
    let rangeFrom = null;
    let rangeTo = null;

    if (selectedDate) {
        rangeFrom = selectedDate;
        rangeTo = selectedDate;
    } else {
        rangeFrom = from || null;
        rangeTo = to || null;
    }

    if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
        const tmp = rangeFrom;
        rangeFrom = rangeTo;
        rangeTo = tmp;
    }

    controller.currentByDateFilter = { selectedDate: selectedDate || null, from: rangeFrom, to: rangeTo };
    const matches = controller.getCustomMatches();
    controller.renderCustomStatsSection(matches);
    toggleByDatePanel(controller, false);
}