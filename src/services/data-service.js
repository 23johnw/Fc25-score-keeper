// ============================================================================
// DataService - Data Abstraction Layer
// ============================================================================
// This service provides a clean API for all data operations, hiding the
// underlying storage implementation (LocalStorage). This makes it easy to
// swap storage backends in the future (e.g., IndexedDB, cloud sync).

import { LocalStorageManager } from '../persistence.js';
import { SeasonManager } from '../season.js';
import { PlayerManager } from '../players.js';
import { SettingsManager } from '../settings.js';
import {
    addPlayer as addPlayerToStore,
    recordMatch as recordMatchToStore,
    findMatch,
    updateMatch as updateMatchInStore,
    deleteMatch as deleteMatchFromStore,
    getCurrentSeasonMatches,
    deleteLastMatch as deleteLastMatchFromStore,
    getPlayerPresenceSnapshot
} from '../data-handler.js';
import {
    getAllMatches,
    getSeasonMatches,
    getMatchesByDateRange,
    getTodayMatches,
    getPlayers,
    getTeamStats,
    aggregateSubsetTeams,
    calculateStatistics,
    getSeasonStats,
    getOverallStats,
    getTodayStats,
    getCustomStats,
    setStatsMode,
    getStatsMode,
    getGamesPlayed
} from '../statistics-tracker.js';

export class DataService {
    constructor() {
        // Initialize storage and managers
        this.storage = new LocalStorageManager();
        this.seasonManager = new SeasonManager(this.storage);
        this.playerManager = new PlayerManager(this.storage);
        this.settingsManager = new SettingsManager(this.storage);
    }

    // ============================================================================
    // Storage Operations
    // ============================================================================

    getData() {
        return this.storage.getData();
    }

    updateData(updater) {
        return this.storage.updateData(updater);
    }

    clearAll() {
        return this.storage.clearAll();
    }

    clearAllStatistics() {
        return this.storage.clearAllStatistics();
    }

    // ============================================================================
    // Player Operations
    // ============================================================================

    getPlayers() {
        return this.playerManager.getPlayers();
    }

    getAllPlayersFromHistory() {
        return getPlayers();
    }

    async setPlayers(players) {
        return this.playerManager.setPlayers(players);
    }

    async addPlayer(name) {
        return this.playerManager.addPlayer(name);
    }

    async removePlayer(name) {
        return this.playerManager.removePlayer(name);
    }

    hasPlayers() {
        return this.playerManager.hasPlayers();
    }

    getPlayerNameHistory() {
        return this.playerManager.getPlayerNameHistory();
    }

    addToPlayerHistory(playerName) {
        return this.playerManager.addToHistory(playerName);
    }

    // Player Lock
    getPlayerLock() {
        return this.playerManager.getPlayerLock();
    }

    setPlayerLock(player, side) {
        return this.playerManager.setPlayerLock(player, side);
    }

    clearPlayerLock() {
        return this.playerManager.clearPlayerLock();
    }

    // Player Presence (Ghost Proxy)
    getPlayerPresence() {
        return this.playerManager.getPlayerPresence();
    }

    setPlayerPresence(playerName, isPresent) {
        return this.playerManager.setPlayerPresence(playerName, isPresent);
    }

    isPlayerPresent(playerName) {
        return this.playerManager.isPlayerPresent(playerName);
    }

    getAllPlayerPresence() {
        return this.playerManager.getAllPlayerPresence();
    }

    // ============================================================================
    // Match Operations
    // ============================================================================

    async recordMatch(matchData) {
        return recordMatchToStore(matchData);
    }

    async updateMatch(timestamp, newTeam1Score, newTeam2Score, newTeam1ExtraTimeScore = null, newTeam2ExtraTimeScore = null, newTeam1PenaltiesScore = null, newTeam2PenaltiesScore = null) {
        return updateMatchInStore(timestamp, newTeam1Score, newTeam2Score, newTeam1ExtraTimeScore, newTeam2ExtraTimeScore, newTeam1PenaltiesScore, newTeam2PenaltiesScore);
    }

    async deleteMatch(timestamp) {
        return deleteMatchFromStore(timestamp);
    }

    async deleteLastMatch() {
        return deleteLastMatchFromStore();
    }

    findMatch(timestamp) {
        return findMatch(timestamp);
    }

    getCurrentSeasonMatches() {
        return getCurrentSeasonMatches();
    }

    getAllMatches() {
        return getAllMatches();
    }

    getSeasonMatches(seasonNumber) {
        return getSeasonMatches(seasonNumber);
    }

    getTodayMatches() {
        return getTodayMatches();
    }

    getMatchesByDateRange(fromDateStr = null, toDateStr = null) {
        return getMatchesByDateRange(fromDateStr, toDateStr);
    }

    getPlayerPresenceSnapshot(team1, team2) {
        return getPlayerPresenceSnapshot(team1, team2);
    }

    // ============================================================================
    // Season Operations
    // ============================================================================

    getCurrentSeason() {
        return this.seasonManager.getCurrentSeason();
    }

    startNewSeason() {
        return this.seasonManager.startNewSeason();
    }

    getSeasonData(seasonNumber) {
        return this.seasonManager.getSeasonData(seasonNumber);
    }

    // ============================================================================
    // Statistics Operations
    // ============================================================================

    getTeamStats(matches) {
        return getTeamStats(matches);
    }

    aggregateSubsetTeams(teamStats) {
        return aggregateSubsetTeams(teamStats);
    }

    calculateStatistics(matches, type = 'season') {
        return calculateStatistics(matches, type);
    }

    getSeasonStats(seasonNumber) {
        return getSeasonStats(seasonNumber);
    }

    getOverallStats() {
        return getOverallStats();
    }

    getTodayStats() {
        return getTodayStats();
    }

    getCustomStats(fromDateStr = null, toDateStr = null) {
        return getCustomStats(fromDateStr, toDateStr);
    }

    getGamesPlayed(matches = []) {
        return getGamesPlayed(matches);
    }

    setStatsMode(mode) {
        return setStatsMode(mode);
    }

    getStatsMode() {
        return getStatsMode();
    }

    // ============================================================================
    // Settings Operations
    // ============================================================================

    getSettings() {
        return this.settingsManager.getSettings();
    }

    updateSettings(updater) {
        return this.settingsManager.updateSettings(updater);
    }

    getLabel(type) {
        return this.settingsManager.getLabel(type);
    }

    setLabel(type, value) {
        return this.settingsManager.setLabel(type, value);
    }

    getPlayerColor(playerName) {
        return this.settingsManager.getPlayerColor(playerName);
    }

    setPlayerColor(playerName, color) {
        return this.settingsManager.setPlayerColor(playerName, color);
    }

    removePlayerColor(playerName) {
        return this.settingsManager.removePlayerColor(playerName);
    }

    getPointsPerResult() {
        return this.settingsManager.getPointsPerResult();
    }

    setPointsPerResult(points) {
        return this.settingsManager.setPointsPerResult(points);
    }

    isDarkMode() {
        return this.settingsManager.isDarkMode();
    }

    setDarkMode(enabled) {
        return this.settingsManager.setDarkMode(enabled);
    }

    resetLabels() {
        return this.settingsManager.resetLabels();
    }

    resetAllSettings() {
        return this.settingsManager.resetAll();
    }

    // ============================================================================
    // Game State Operations
    // ============================================================================

    saveCurrentGameState(gameState) {
        return this.storage.saveCurrentGameState(gameState);
    }

    getCurrentGameState() {
        return this.storage.getCurrentGameState();
    }

    clearCurrentGameState() {
        return this.storage.clearCurrentGameState();
    }

    // ============================================================================
    // Selected Leagues Operations
    // ============================================================================

    getSelectedLeagues() {
        const data = this.storage.getData();
        return data.selectedLeagues || [];
    }

    setSelectedLeagues(leagues) {
        return this.storage.updateData(data => {
            data.selectedLeagues = leagues;
        });
    }
}
