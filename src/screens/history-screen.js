// ============================================================================
// History screen: match history list/timeline, filters, team details back.
// ============================================================================

/**
 * Initialize the History screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const backFromHistoryBtn = document.getElementById('backFromHistoryBtn');
    if (backFromHistoryBtn) {
        backFromHistoryBtn.addEventListener('click', () => controller.showScreen('moreScreen'));
    }

    const backFromTeamDetailsBtn = document.getElementById('backFromTeamDetailsBtn');
    if (backFromTeamDetailsBtn) {
        backFromTeamDetailsBtn.addEventListener('click', () => controller.showScreen('statsScreen'));
    }

    const historyFilter = document.getElementById('historyFilter');
    if (historyFilter) historyFilter.addEventListener('change', () => controller.loadMatchHistory());

    const historySearch = document.getElementById('historySearch');
    if (historySearch) historySearch.addEventListener('input', () => controller.loadMatchHistory());

    const historyDateFrom = document.getElementById('historyDateFrom');
    if (historyDateFrom) historyDateFrom.addEventListener('change', () => controller.loadMatchHistory());

    const historyDateTo = document.getElementById('historyDateTo');
    if (historyDateTo) historyDateTo.addEventListener('change', () => controller.loadMatchHistory());

    const historySortOrder = document.getElementById('historySortOrder');
    if (historySortOrder) {
        historySortOrder.value = controller.historySortOrder;
        historySortOrder.addEventListener('change', (e) => {
            controller.historySortOrder = e.target.value === 'asc' ? 'asc' : 'desc';
            controller.loadMatchHistory();
        });
    }

    const clearHistoryFiltersBtn = document.getElementById('clearHistoryFiltersBtn');
    if (clearHistoryFiltersBtn) {
        clearHistoryFiltersBtn.addEventListener('click', () => controller.clearHistoryFilters());
    }

    const historyListViewBtn = document.getElementById('historyListViewBtn');
    if (historyListViewBtn) {
        historyListViewBtn.addEventListener('click', () => controller.switchHistoryView('list'));
    }

    const historyTimelineViewBtn = document.getElementById('historyTimelineViewBtn');
    if (historyTimelineViewBtn) {
        historyTimelineViewBtn.addEventListener('click', () => controller.switchHistoryView('timeline'));
    }

    const historyFiltersToggle = document.getElementById('historyFiltersToggle');
    const historyControlsWrapper = document.getElementById('historyControlsWrapper');
    if (historyFiltersToggle && historyControlsWrapper) {
        historyFiltersToggle.addEventListener('click', () => {
            const isCollapsed = historyControlsWrapper.classList.toggle('collapsed');
            historyControlsWrapper.style.display = isCollapsed ? 'none' : 'grid';
            historyFiltersToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            historyFiltersToggle.textContent = isCollapsed ? 'More filters ▸' : 'More filters ▾';
        });
    }

    document.querySelectorAll('.history-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter || 'all';
            controller.setHistoryQuickFilter(filter);
        });
    });
}

/**
 * Run when the History screen is shown.
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    const sortEl = document.getElementById('historySortOrder');
    if (sortEl) sortEl.value = controller.historySortOrder;
    const listBtn = document.getElementById('historyListViewBtn');
    const timelineBtn = document.getElementById('historyTimelineViewBtn');
    if (listBtn && timelineBtn) {
        listBtn.classList.toggle('active', controller.currentHistoryView === 'list');
        timelineBtn.classList.toggle('active', controller.currentHistoryView === 'timeline');
        const listEl = document.getElementById('matchHistoryList');
        const timelineEl = document.getElementById('matchHistoryTimeline');
        if (listEl) listEl.style.display = controller.currentHistoryView === 'list' ? 'flex' : 'none';
        if (timelineEl) timelineEl.style.display = controller.currentHistoryView === 'timeline' ? 'block' : 'none';
    }
    controller.updateBackToSessionButton();
    controller.loadMatchHistory();
}
