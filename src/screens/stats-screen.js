// ============================================================================
// Stats screen: tabs, mode toggle, share/export, by-date, load statistics.
// ============================================================================

/**
 * Initialize the Stats screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const statsTabSelect = document.getElementById('statsTabSelect');
    if (statsTabSelect) {
        statsTabSelect.addEventListener('change', (e) => controller.switchStatsTab(e.target.value));
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => controller.switchStatsMode(e.target.dataset.mode));
    });

    const newSeasonBtn = document.getElementById('newSeasonBtn');
    if (newSeasonBtn) newSeasonBtn.addEventListener('click', () => controller.startNewSeason());

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', () => controller.exportData());

    const importDataBtn = document.getElementById('importDataBtn');
    if (importDataBtn) importDataBtn.addEventListener('click', () => controller.importData());

    const backToMenuBtn = document.getElementById('backToMenuBtn');
    if (backToMenuBtn) backToMenuBtn.addEventListener('click', () => controller.showScreen('playerScreen'));

    const shareTodayStatsBtn = document.getElementById('shareTodayStatsBtn');
    if (shareTodayStatsBtn) shareTodayStatsBtn.addEventListener('click', () => controller.shareStats('today'));

    const shareSeasonStatsBtn = document.getElementById('shareSeasonStatsBtn');
    if (shareSeasonStatsBtn) shareSeasonStatsBtn.addEventListener('click', () => controller.shareStats('season'));

    const shareOverallStatsBtn = document.getElementById('shareOverallStatsBtn');
    if (shareOverallStatsBtn) shareOverallStatsBtn.addEventListener('click', () => controller.shareStats('overall'));

    const shareCustomBtn = document.getElementById('shareCustomStatsBtn');
    if (shareCustomBtn) shareCustomBtn.addEventListener('click', () => controller.shareStats('custom'));

    const exportTodayPDFBtn = document.getElementById('exportTodayPDFBtn');
    if (exportTodayPDFBtn) exportTodayPDFBtn.addEventListener('click', () => controller.exportPDF());

    const exportSeasonPDFBtn = document.getElementById('exportSeasonPDFBtn');
    if (exportSeasonPDFBtn) exportSeasonPDFBtn.addEventListener('click', () => controller.exportPDF());

    const exportOverallPDFBtn = document.getElementById('exportOverallPDFBtn');
    if (exportOverallPDFBtn) exportOverallPDFBtn.addEventListener('click', () => controller.exportPDF());

    const exportCustomBtn = document.getElementById('exportCustomPDFBtn');
    if (exportCustomBtn) exportCustomBtn.addEventListener('click', () => controller.exportPDF('custom'));

    const viewPdfBtn = document.getElementById('viewLastPDFBtn');
    if (viewPdfBtn) viewPdfBtn.addEventListener('click', () => controller.viewLastPDF());

    const byDateBtn = document.getElementById('byDateStatsBtn');
    if (byDateBtn) {
        byDateBtn.addEventListener('click', () => controller.toggleByDatePanel(true));
    }
}

/**
 * Run when the Stats screen is shown (load Chart.js then statistics).
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    const statsTabSelect = document.getElementById('statsTabSelect');
    if (statsTabSelect && controller.lastStatsTab) {
        statsTabSelect.value = controller.lastStatsTab;
    }
    controller.ensureChartJs().then(() => {
        controller.updatePlayedDates();
        controller.loadStatistics();
        controller.updateViewPDFButton();
        setTimeout(() => controller.initializeStatsTabSwipes(), 100);
        controller.updateBackToSessionButton();
    }).catch(() => {
        controller.toastManager.error('Could not load charts. Check your connection.');
        controller.updatePlayedDates();
        controller.loadStatistics();
        controller.updateViewPDFButton();
        setTimeout(() => controller.initializeStatsTabSwipes(), 100);
        controller.updateBackToSessionButton();
    });
}
