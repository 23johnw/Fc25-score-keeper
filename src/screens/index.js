// ============================================================================
// Screen modules: each screen can have init(controller) and load(controller).
// AppController calls registerScreens(this) once; showScreen() can call load()
// for the active screen when needed.
// ============================================================================

import * as moreScreen from './more-screen.js';
import * as historyScreen from './history-screen.js';
import * as settingsScreen from './settings-screen.js';
import * as playerScreen from './players-screen.js';
import * as teamScreen from './teams-screen.js';
import * as sequenceScreen from './sequence-screen.js';
import * as matchScreen from './match-screen.js';
import * as statsScreen from './stats-screen.js';
import * as sessionScreen from './session-screen.js';

const screens = {
    moreScreen,
    historyScreen,
    settingsScreen,
    playerScreen,
    teamScreen,
    sequenceScreen,
    matchScreen,
    statsScreen,
    sessionScreen,
};

/**
 * Register all screen modules with the app controller.
 * Call this once from AppController.initializeEventListeners().
 * @param {import('../app-controller.js').AppController} controller
 */
export function registerScreens(controller) {
    Object.values(screens).forEach(module => {
        if (typeof module.init === 'function') {
            module.init(controller);
        }
    });
}

/**
 * Call load() for a screen by id (e.g. when showing that screen).
 * @param {string} screenId
 * @param {import('../app-controller.js').AppController} controller
 */
export function loadScreen(screenId, controller) {
    const key = screenId.replace(/Screen$/, '') + 'Screen';
    const module = screens[key];
    if (module && typeof module.load === 'function') {
        module.load(controller);
    }
}
