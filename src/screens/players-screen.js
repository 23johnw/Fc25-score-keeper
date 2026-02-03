// ============================================================================
// Players screen: add/edit players, lock, presence, start new session.
// ============================================================================

/**
 * Initialize the Players screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const saveBtn = document.getElementById('savePlayersBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => controller.savePlayers());
    }

    const startNewSessionBtn = document.getElementById('startNewSessionBtn');
    if (startNewSessionBtn) {
        startNewSessionBtn.addEventListener('click', () => controller.startNewSession());
    }

    const addPlayerBtn = document.getElementById('addPlayerBtn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', () => controller.addPlayerRow());
    }

    const editableList = document.getElementById('playerEditableList');
    if (editableList) {
        editableList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-player-btn');
            if (deleteBtn) {
                const index = parseInt(deleteBtn.dataset.index);
                controller.removePlayerRow(index);
            }
        });

        editableList.addEventListener('input', (e) => {
            const input = e.target.closest('.player-name-input');
            if (input) {
                const index = parseInt(input.dataset.index);
                const value = input.value;
                controller.updatePlayerRow(index, value);
            }
        });

        editableList.addEventListener('change', (e) => {
            const select = e.target.closest('.lock-select');
            if (select) {
                const index = parseInt(select.dataset.index);
                const side = select.value;
                if (!isNaN(index) && side) {
                    controller.handleInlineLockToggle(index, side);
                }
            }

            const checkbox = e.target.closest('.presence-checkbox');
            if (checkbox) {
                const playerName = checkbox.dataset.player;
                const isPresent = checkbox.checked;
                if (playerName) {
                    controller.playerManager.setPlayerPresence(playerName, isPresent);
                    controller.updatePlayerPresenceDisplay(playerName, isPresent);
                }
            }
        });
    }

    const playerLockList = document.getElementById('playerLockList');
    if (playerLockList) {
        playerLockList.addEventListener('click', (event) => {
            const button = event.target.closest('.lock-btn');
            if (!button || button.disabled) return;
            const player = button.dataset.player;
            const side = button.dataset.side;
            if (player && side) {
                controller.handleLockSelection(player, side);
            }
        });
    }
}

/**
 * Run when the Players screen is shown.
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    const players = controller.playerManager.getPlayers();
    controller.loadPlayersIntoUI(players);
    controller.updatePlayerNameHistory();
}
