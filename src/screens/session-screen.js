// ============================================================================
// Session screen: wizard (players → teams → match), advanced link.
// ============================================================================

/**
 * Initialize the Session screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const sessionContinueBtn = document.getElementById('sessionContinueBtn');
    if (sessionContinueBtn) {
        sessionContinueBtn.addEventListener('click', () => controller.sessionContinue());
    }

    const sessionAdvancedLink = document.getElementById('sessionAdvancedLink');
    if (sessionAdvancedLink) {
        sessionAdvancedLink.addEventListener('click', (e) => {
            e.preventDefault();
            controller.sessionAdvanced();
        });
    }

    const sessionAddPlayerBtn = document.getElementById('sessionAddPlayerBtn');
    if (sessionAddPlayerBtn) {
        sessionAddPlayerBtn.addEventListener('click', () => controller.addNewSessionPlayerInput());
    }

    const sessionNextMatchBtn = document.getElementById('sessionNextMatchBtn');
    if (sessionNextMatchBtn) {
        sessionNextMatchBtn.addEventListener('click', () => controller.sessionNextMatch());
    }

    const sessionStartBtn = document.getElementById('sessionStartBtn');
    if (sessionStartBtn) {
        sessionStartBtn.addEventListener('click', () => controller.startSessionWizard());
    }

    const sessionAdvancedModeBtn = document.getElementById('sessionAdvancedModeBtn');
    if (sessionAdvancedModeBtn) {
        sessionAdvancedModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            controller.setUiMode('advanced');
            controller.showScreen('playerScreen');
        });
    }

}

/**
 * Run when the Session screen is shown.
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    if (controller.uiMode === 'advanced' || !controller.sessionStarted) {
        controller.applyUiMode();
    } else {
        controller.loadSessionWizard();
    }
    controller.updateBackToSessionButton();
}
