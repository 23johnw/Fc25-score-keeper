// ============================================================================
// Teams screen: team combinations, sync top teams, confirm sequence.
// ============================================================================

import { syncTeamsFromOnline } from '../data-handler.js';
import { LEAGUE_PRESETS } from '../api-service.js';

/**
 * Initialize the Teams screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    const confirmSequenceBtn = document.getElementById('confirmSequenceBtn');
    if (confirmSequenceBtn) {
        confirmSequenceBtn.addEventListener('click', () => controller.confirmSequence());
    }

    const selectAllCombinationsBtn = document.getElementById('selectAllCombinationsBtn');
    if (selectAllCombinationsBtn) {
        selectAllCombinationsBtn.addEventListener('click', () => controller.selectAllStructures());
    }

    const randomCombinationBtn = document.getElementById('randomCombinationBtn');
    if (randomCombinationBtn) {
        randomCombinationBtn.addEventListener('click', () => controller.randomSelectStructure());
    }

    const backToPlayersBtn = document.getElementById('backToPlayersBtn');
    if (backToPlayersBtn) {
        backToPlayersBtn.addEventListener('click', () => controller.showScreen('playerScreen'));
    }

    const syncTopTeamsBtn = document.getElementById('syncTopTeamsBtn');
    if (syncTopTeamsBtn) {
        syncTopTeamsBtn.addEventListener('click', async () => {
            syncTopTeamsBtn.disabled = true;
            controller.persistSelectedLeaguesFromCheckboxes();
            const selectedLeagues = controller.getSelectedLeaguesFromCheckboxes() ?? (Array.isArray(controller.storage.getData().selectedLeagues) ? controller.storage.getData().selectedLeagues : []);
            const result = await syncTeamsFromOnline({ toastManager: controller.toastManager, storage: controller.storage, selectedLeagues });
            syncTopTeamsBtn.disabled = false;
            if (result.success) {
                controller.updateTeamNamesSavedCountUI();
                controller.settingsManager.setUseRandomTeams(true);
                const useRandomCheck = document.getElementById('useRandomTeamsCheckbox');
                if (useRandomCheck) useRandomCheck.checked = true;
                controller.loadTeamCombinations();
                const currentSeason = controller.seasonManager.getCurrentSeason();
                controller.storage.updateData(data => {
                    if (data.seasons && data.seasons[currentSeason]) {
                        const season = data.seasons[currentSeason];
                        season.teamNames = {};
                        season.matchTeamNames = undefined;
                    }
                });
                if (result.entries && result.entries.length) controller.showSyncedTeamsListModal(result.entries);
            }
        });
    }

    const viewSyncedTeamsListBtn = document.getElementById('viewSyncedTeamsListBtn');
    if (viewSyncedTeamsListBtn) {
        viewSyncedTeamsListBtn.addEventListener('click', () => controller.showSyncedTeamsListModal());
    }

    const leaguePresetTop4 = document.getElementById('leaguePresetTop4');
    if (leaguePresetTop4) {
        leaguePresetTop4.addEventListener('click', () => {
            controller.storage.updateData(data => { data.selectedLeagues = [...LEAGUE_PRESETS.top4]; });
            controller.renderLeaguesToSyncCheckboxes();
        });
    }

    const leaguePresetTop6Europe = document.getElementById('leaguePresetTop6Europe');
    if (leaguePresetTop6Europe) {
        leaguePresetTop6Europe.addEventListener('click', () => {
            controller.storage.updateData(data => { data.selectedLeagues = [...LEAGUE_PRESETS.top6Europe]; });
            controller.renderLeaguesToSyncCheckboxes();
        });
    }

    const leaguePresetWorldMix = document.getElementById('leaguePresetWorldMix');
    if (leaguePresetWorldMix) {
        leaguePresetWorldMix.addEventListener('click', () => {
            controller.storage.updateData(data => { data.selectedLeagues = [...LEAGUE_PRESETS.worldMix]; });
            controller.renderLeaguesToSyncCheckboxes();
        });
    }

    const leaguePresetInternational = document.getElementById('leaguePresetInternational');
    if (leaguePresetInternational) {
        leaguePresetInternational.addEventListener('click', () => {
            controller.storage.updateData(data => { data.selectedLeagues = [...LEAGUE_PRESETS.international]; });
            controller.renderLeaguesToSyncCheckboxes();
        });
    }

    const teamsPerLeagueInput = document.getElementById('teamsPerLeagueInput');
    if (teamsPerLeagueInput) {
        teamsPerLeagueInput.addEventListener('change', () => {
            let n = parseInt(teamsPerLeagueInput.value, 10);
            if (isNaN(n) || n < 1) n = 1;
            if (n > 20) n = 20;
            teamsPerLeagueInput.value = n;
            controller.storage.updateData(data => { data.teamsPerLeague = n; });
        });
    }

    const syncedTeamsListModalClose = document.getElementById('syncedTeamsListModalClose');
    const syncedTeamsListModal = document.getElementById('syncedTeamsListModal');
    if (syncedTeamsListModalClose) syncedTeamsListModalClose.addEventListener('click', () => controller.closeSyncedTeamsListModal());
    if (syncedTeamsListModal) {
        syncedTeamsListModal.addEventListener('click', (e) => {
            if (e.target === syncedTeamsListModal) controller.closeSyncedTeamsListModal();
        });
    }
}

/**
 * Run when the Teams screen is shown.
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    controller.loadTeamCombinations();
}
