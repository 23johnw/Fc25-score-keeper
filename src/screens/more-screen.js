// ============================================================================
// More screen: History + Settings entry. Pattern for screen-specific modules.
// ============================================================================

/**
 * Initialize the More screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.more-option-btn');
        if (btn && btn.dataset.screen) {
            e.preventDefault();
            controller.showScreen(btn.dataset.screen);
        }
    });
}

/**
 * Optional: run when the More screen is shown (e.g. refresh content).
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    // More screen has no dynamic content; add refresh logic here if needed.
}
