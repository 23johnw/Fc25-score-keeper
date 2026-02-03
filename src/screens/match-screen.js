// ============================================================================
// Match screen: record score, extra time/penalties, undo, back to sequence.
// ============================================================================

/**
 * Initialize the Match screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const submitScoreBtn = document.getElementById('submitScoreBtn');
    if (submitScoreBtn) {
        submitScoreBtn.addEventListener('click', () => controller.recordScore());
    }

    const backToSequenceBtn = document.getElementById('backToSequenceBtn');
    if (backToSequenceBtn) {
        backToSequenceBtn.addEventListener('click', () => controller.showScreen('sequenceScreen'));
    }

    const undoBtn = document.getElementById('undoLastMatchBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', () => controller.undoLastMatch());
    }

    const extraTimeCheckbox = document.getElementById('wentToExtraTime');
    if (extraTimeCheckbox) {
        extraTimeCheckbox.addEventListener('change', (e) => {
            const extraTimeScores = document.getElementById('extraTimeScores');
            if (extraTimeScores) {
                extraTimeScores.style.display = e.target.checked ? 'flex' : 'none';
            }
        });
    }

    const penaltiesCheckbox = document.getElementById('wentToPenalties');
    if (penaltiesCheckbox) {
        penaltiesCheckbox.addEventListener('change', (e) => {
            const penaltiesScores = document.getElementById('penaltiesScores');
            if (penaltiesScores) {
                penaltiesScores.style.display = e.target.checked ? 'flex' : 'none';
            }
        });
    }

    const autoSelectIds = [
        'team1Score', 'team2Score',
        'team1ExtraTimeScore', 'team2ExtraTimeScore',
        'team1PenaltiesScore', 'team2PenaltiesScore',
        'editTeam1Score', 'editTeam2Score',
        'editTeam1ExtraTimeScore', 'editTeam2ExtraTimeScore',
        'editTeam1PenaltiesScore', 'editTeam2PenaltiesScore'
    ];
    autoSelectIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('focus', () => requestAnimationFrame(() => el.select()));
        el.addEventListener('mouseup', (e) => e.preventDefault());
    });
}

/**
 * Run when the Match screen is shown (no-op; match state is set by startGames).
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    // Match display is updated when navigating here from sequence; no refresh needed.
}
