// ============================================================================
// Sequence screen: list of selected matches, start games.
// ============================================================================

/**
 * Initialize the Sequence screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const startGamesBtn = document.getElementById('startGamesBtn');
    if (startGamesBtn) {
        startGamesBtn.addEventListener('click', () => controller.startGames());
    }

    const backToTeamsBtn = document.getElementById('backToTeamsBtn');
    if (backToTeamsBtn) {
        backToTeamsBtn.addEventListener('click', () => controller.showScreen('teamScreen'));
    }
}

/**
 * Run when the Sequence screen is shown.
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    controller.loadSequenceList();
}
