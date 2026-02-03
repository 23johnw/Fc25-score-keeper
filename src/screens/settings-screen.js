// ============================================================================
// Settings screen: tabs, API keys, data management, admin PIN, debug log.
// ============================================================================

import { getLogText, clear as clearDebugLog } from '../debug-log.js';

/**
 * Initialize the Settings screen: attach event listeners.
 * @param {import('../app-controller.js').AppController} controller
 */
export function init(controller) {
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => controller.switchSettingsTab(e.target.dataset.settingsTab));
    });

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => controller.saveSettings());
    }

    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            const apiKeyInput = document.getElementById('apiKeyInput');
            const key = apiKeyInput ? apiKeyInput.value : '';
            controller.settingsManager.setFootballApiKey(key);
            controller.toastManager.success('API key saved');
        });
    }

    const saveCorsProxyKeyBtn = document.getElementById('saveCorsProxyKeyBtn');
    if (saveCorsProxyKeyBtn) {
        saveCorsProxyKeyBtn.addEventListener('click', () => {
            const corsProxyKeyInput = document.getElementById('corsProxyKeyInput');
            const key = corsProxyKeyInput ? corsProxyKeyInput.value : '';
            controller.settingsManager.setCorsProxyApiKey(key);
            controller.toastManager.success(key ? 'CORS proxy key saved – Sync on phone should work' : 'CORS proxy key cleared');
        });
    }

    const backFromSettingsBtn = document.getElementById('backFromSettingsBtn');
    if (backFromSettingsBtn) {
        backFromSettingsBtn.addEventListener('click', () => controller.showScreen('moreScreen'));
    }

    const resetLabelsBtn = document.getElementById('resetLabelsBtn');
    if (resetLabelsBtn) {
        resetLabelsBtn.addEventListener('click', () => controller.resetLabels());
    }

    const exportDataSettingsBtn = document.getElementById('exportDataSettingsBtn');
    if (exportDataSettingsBtn) {
        exportDataSettingsBtn.addEventListener('click', () => controller.exportData());
    }

    const importDataSettingsBtn = document.getElementById('importDataSettingsBtn');
    if (importDataSettingsBtn) {
        importDataSettingsBtn.addEventListener('click', () => controller.importData());
    }

    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', () => controller.confirmClearAllData());
    }

    const clearOverallStatsBtn = document.getElementById('clearOverallStatsBtn');
    if (clearOverallStatsBtn) {
        clearOverallStatsBtn.addEventListener('click', () => controller.clearAllStatistics());
    }

    // Debug log
    const copyDebugLogBtn = document.getElementById('copyDebugLogBtn');
    if (copyDebugLogBtn) {
        copyDebugLogBtn.addEventListener('click', () => {
            const text = getLogText();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => controller.toastManager.success('Log copied to clipboard')).catch(() => controller.toastManager.error('Copy failed'));
            } else {
                controller.toastManager.error('Copy not supported');
            }
        });
    }

    const exportDebugLogBtn = document.getElementById('exportDebugLogBtn');
    if (exportDebugLogBtn) {
        exportDebugLogBtn.addEventListener('click', () => {
            const text = getLogText();
            const filename = 'fc25-debug-log-' + new Date().toISOString().slice(0, 10) + '.txt';
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            controller.toastManager.success('Log exported as ' + filename);
        });
    }

    const clearDebugLogBtn = document.getElementById('clearDebugLogBtn');
    if (clearDebugLogBtn) {
        clearDebugLogBtn.addEventListener('click', () => {
            clearDebugLog();
            const ta = document.getElementById('debugLogTextarea');
            if (ta) ta.value = getLogText();
            controller.toastManager.success('Debug log cleared');
        });
    }

    // Admin PIN
    const adminUnlockBtn = document.getElementById('adminUnlockBtn');
    if (adminUnlockBtn) adminUnlockBtn.addEventListener('click', () => controller.unlockAdminWithPin());
    const adminSetPinBtn = document.getElementById('adminSetPinBtn');
    if (adminSetPinBtn) adminSetPinBtn.addEventListener('click', () => controller.setAdminPin());
    const adminLockBtn = document.getElementById('adminLockBtn');
    if (adminLockBtn) adminLockBtn.addEventListener('click', () => controller.lockAdmin());
    const adminResetPinBtn = document.getElementById('adminResetPinBtn');
    if (adminResetPinBtn) adminResetPinBtn.addEventListener('click', () => controller.resetAdminPin());

    const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    if (copyShareUrlBtn) {
        copyShareUrlBtn.addEventListener('click', () => controller.copyShareUrl());
    }

    const darkModeSetting = document.getElementById('darkModeSetting');
    if (darkModeSetting) {
        darkModeSetting.addEventListener('change', (e) => {
            controller.settingsManager.setDarkMode(e.target.checked);
            controller.toggleDarkMode();
        });
    }

    const savePointsSettingsBtn = document.getElementById('savePointsSettingsBtn');
    if (savePointsSettingsBtn) {
        savePointsSettingsBtn.addEventListener('click', () => controller.savePointsSettings());
    }

    const cancelPointsSettingsBtn = document.getElementById('cancelPointsSettingsBtn');
    if (cancelPointsSettingsBtn) {
        cancelPointsSettingsBtn.addEventListener('click', () => controller.closePointsSettingsModal());
    }
}

/**
 * Run when the Settings screen is shown.
 * @param {import('../app-controller.js').AppController} controller
 */
export function load(controller) {
    controller.loadSettingsScreen();
}
