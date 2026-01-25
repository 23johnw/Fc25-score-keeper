// ============================================================================
// Main Application Controller
// ============================================================================

class AppController {
    constructor() {
        this.storage = new LocalStorageManager();
        this.settingsManager = new SettingsManager(this.storage);
        this.toastManager = new ToastManager();
        this.playerManager = new PlayerManager(this.storage);
        this.teamGenerator = new TeamGenerator();

        // Session wizard state
        this.sessionWizardStep = 'players'; // 'players' | 'teams' | 'match'
        this.sessionPlayers = [];
        this.sessionSelectedStructure = null;
        this.sessionSelectedStructureIndex = null;
        this.sessionAvailableStructures = [];
        this.sessionStarted = false;
        this.uiMode = 'session'; // 'session' | 'advanced'
        this.seasonManager = new SeasonManager(this.storage);
        this.matchRecorder = new MatchRecorder(this.storage, this.seasonManager);
        this.statisticsTracker = new StatisticsTracker(this.storage, this.settingsManager);
        this.statisticsDisplay = new StatisticsDisplay(this.statisticsTracker, this.settingsManager);
        this.shareManager = new ShareManager(this.storage, this.statisticsTracker, this.seasonManager);
        
        // Firebase integration
        this.firebaseManager = null;
        this.firebaseStore = null;
        this.isFirebaseMode = false;
        this.isAdmin = false;
        this.adminUnlockedThisSession = false; // Track if admin was unlocked in current session

        this.currentScreen = null;
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.selectedAllStructures = false;
        this.currentGameIndex = 0;
        this.currentStatsState = {};
        this.lastStatsTab = 'today';
        this.customFilterActive = false;
        this.editingMatchTimestamp = null;
        this.touchSwipeHandler = new TouchSwipeHandler(); // Initialize swipe gesture handler
        this.playerEditorValues = [];
        this.hasUnsavedPlayerChanges = false;
        this.currentHistoryView = 'list'; // 'list' or 'timeline'
        this.historySortOrder = 'desc'; // 'desc' = last played first, 'asc' = oldest first
        this.lastPDFBlobUrl = null; // Store last exported PDF for viewing
        this.currentByDateFilter = { from: null, to: null, selectedDate: null };
        this.playedDates = [];
        this.lastRecordedMatch = null; // Store last recorded match for undo
        
        // Initialize lock labels before anything else that might use them
        this.updateLockLabels();
        
        this.initializeEventListeners();
        this.initializeApp();
    }
    
    updateLockLabels() {
        // Update lock labels from settings
        this.lockLabels = {
            home: this.settingsManager.getLabel('home'),
            away: this.settingsManager.getLabel('away'),
            neutral: this.settingsManager.getLabel('neutral')
        };
    }

    async initializeApp() {

        // Initialize Firebase first
        await this.initializeFirebase();

        // Retry Firebase initialization after a delay if it failed
        if (!this.isFirebaseMode) {
            setTimeout(async () => {
                console.log('Retrying Firebase initialization...');
                await this.initializeFirebase();
            }, 2000);
        }

        // Load existing players
        const players = this.playerManager.getPlayers();
        this.loadPlayersIntoUI(players);

        // Load settings into form fields (regardless of current screen)
        this.loadSettingsIntoForm();

        // UI mode (session vs advanced) should be known before we decide default screen
        this.loadUiMode();
        this.applyUiMode();

        // Try to restore saved game state
        this.restoreSavedGameState();

        // Default screen selection:
        // - Session mode: always land on Session splash (no tabs)
        // - Advanced mode: restore saved screen, otherwise Players
        if (this.uiMode === 'session') {
            // Always show session screen in session mode, ignore saved state
            this.currentScreen = null;
            this.showScreen('sessionScreen');
        } else if (!this.currentScreen) {
            this.showScreen('playerScreen');
        }
        
        this.updateSeasonInfo();
        this.updatePlayerNameHistory(); // Add this line
        this.renderPlayerLockOptions();

        // Precompute played dates for By Date panel
        this.updatePlayedDates();
        this.initializeByDatePanel();
        this.updateCustomFilterSummary([]);

        // Update share URL in settings
        this.updateShareUrl();
        this.renderCustomStatsSection();

        this.initializeEventListeners();
        
        // Display app version banner
        const bannerVersion = document.getElementById('appVersionBanner');
        if (bannerVersion) {
            // Set version immediately (synchronously)
            bannerVersion.textContent = 'Version 1.87.0';
            // Then try to update from cache (async)
            this.displayAppVersion(bannerVersion).catch(err => {
                console.error('Error displaying app version:', err);
            });
        }
    }

    async initializeFirebase() {
        try {
            // Wait for Firebase modules to load
            let attempts = 0;
            while (window.firebaseReady === undefined && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (window.firebaseReady === false || !window.firebaseManager || !window.firebaseStore) {
                console.log('Firebase modules not available, using local storage mode');
                this.toastManager.info('Using local storage mode');
                return;
            }
            
            this.firebaseManager = window.firebaseManager;
            this.firebaseStore = window.firebaseStore;
            
            // Make this available globally for Firebase callbacks
            window.appController = this;
            
            // Initialize Firebase
            const authOk = await this.firebaseManager.initialize();
            if (authOk) {
                const leagueOk = await this.firebaseStore.initializeLeague();
                this.isFirebaseMode = !!leagueOk;
                
                // Set Firebase store on other managers
                if (this.isFirebaseMode) {
                    this.matchRecorder.setFirebaseStore(this.firebaseStore);
                    this.statisticsTracker.setFirebaseStore(this.firebaseStore);
                    this.playerManager.setFirebaseStore(this.firebaseStore);
                }
                // Always set playerManager on matchRecorder (needed for presence tracking)
                this.matchRecorder.setPlayerManager(this.playerManager);
                
                console.log('Firebase initialized successfully');
                if (this.isFirebaseMode) {
                    this.toastManager.success('Connected to shared league! 🔥');
                } else {
                    this.toastManager.info('Using local storage mode');
                }
                
                // Update UI to show Firebase is ready
                this.updateAdminUI();
                this.updateShareUrl();
            } else {
                console.warn('Firebase initialization failed, using local storage');
                this.toastManager.info('Using local storage mode');
            }
        } catch (error) {
            console.error('Firebase setup error:', error);
            console.log('Falling back to local storage');
            this.toastManager.info('Using local storage mode');
        }
    }

    onAuthStateChanged(user, isAdmin) {
        console.log('Auth state changed - isAdmin:', isAdmin, 'session unlocked:', this.adminUnlockedThisSession);

        // Only grant admin status if it was unlocked in THIS session
        // This prevents admin status from persisting across browser refreshes
        const wasAdminBefore = this.isAdmin;
        this.isAdmin = isAdmin && this.adminUnlockedThisSession;

        if (wasAdminBefore && !this.isAdmin) {
            console.log('Admin status cleared on page load (session-only)');
        }

        this.updateAdminUI();

        // In compat mode, firebaseStore may not have claimAdmin; admin claim is handled in firebase-simple.js
        if (this.isAdmin && this.firebaseStore && typeof this.firebaseStore.claimAdmin === 'function') {
            this.firebaseStore.claimAdmin(user);
        }
    }

    onDataChanged(type, data) {
        // Handle real-time data updates from Firebase
        switch (type) {
            case 'matches':
                this.onMatchesChanged(data);
                break;
            case 'players':
                this.onPlayersChanged(data);
                break;
            case 'activePlayers':
                this.onActivePlayersChanged(data);
                break;
            case 'settings':
                this.onSettingsChanged(data);
                break;
        }
    }

    onMatchesChanged(matches) {
        // Update UI when matches change
        console.log('Firebase matches changed:', matches.length, 'matches');
        if (this.currentScreen === 'historyScreen') {
            this.loadMatchHistory();
        }
        if (this.currentScreen === 'statsScreen') {
            this.renderStatsForCurrentTab();
        }
    }

    renderStatsForCurrentTab() {
        // Re-render stats for the currently active tab
        const activeTabBtn = document.querySelector('#statsTabSelect');
        const currentTab = activeTabBtn ? activeTabBtn.value : 'today';
        console.log('Refreshing stats for tab:', currentTab);
        this.switchStatsTab(currentTab);
    }

    onPlayersChanged(players) {
        // Update UI when players change
        // For now, we'll keep using local player management
        // but this could be extended to sync players too
    }

    onActivePlayersChanged(players) {
        // Update UI if on player screen
        if (this.currentScreen === 'playerScreen') {
            const currentPlayers = this.playerManager.getPlayers();
            this.loadPlayersIntoUI(currentPlayers);
        }
    }

    onSettingsChanged(settings) {
        // Update UI when settings change
        this.settingsManager.updateFromFirebase(settings);
        this.updateLockLabels();
    }

    updateAdminUI() {
        const adminStatus = document.getElementById('adminStatus');
        const adminStatusText = document.getElementById('adminStatusText');
        const adminPinInput = document.getElementById('adminPinInput');
        const adminPinConfirmInput = document.getElementById('adminPinConfirmInput');
        const adminUnlockBtn = document.getElementById('adminUnlockBtn');
        const adminSetPinBtn = document.getElementById('adminSetPinBtn');
        const adminPinSetupRow = document.getElementById('adminPinSetupRow');
        const adminLockBtn = document.getElementById('adminLockBtn');
        const adminResetPinBtn = document.getElementById('adminResetPinBtn');
        
        if (adminStatus && adminStatusText && adminPinInput && adminUnlockBtn && adminSetPinBtn && adminPinSetupRow && adminLockBtn && adminResetPinBtn) {
            if (this.isAdmin) {
                adminStatus.classList.add('admin-active');
                adminStatusText.textContent = 'Admin unlocked';
                adminPinInput.value = '';
                if (adminPinConfirmInput) adminPinConfirmInput.value = '';
                adminPinInput.style.display = 'none';
                adminUnlockBtn.style.display = 'none';
                adminPinSetupRow.style.display = 'none';
                adminLockBtn.style.display = 'block';
                // “Hidden” reset (shown only when already admin; can be hidden further later)
                adminResetPinBtn.style.display = 'block';
            } else {
                adminStatus.classList.remove('admin-active');
                adminStatusText.textContent = 'Admin locked';
                adminLockBtn.style.display = 'none';
                adminResetPinBtn.style.display = 'none';
                adminPinInput.style.display = 'block';
                adminUnlockBtn.style.display = 'inline-flex';
            }
        }
    }

    updateShareUrl() {
        const shareUrlInput = document.getElementById('shareUrlInput');
        if (shareUrlInput) {
            if (this.isFirebaseMode) {
                shareUrlInput.value = 'https://fc---score-keeper.web.app';
                shareUrlInput.disabled = false;
            } else {
                shareUrlInput.value = 'Local storage mode - no sharing available';
                shareUrlInput.disabled = true;
            }
        }
    }

    initializeEventListeners() {
        // Player screen
        const saveBtn = document.getElementById('savePlayersBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.savePlayers();
            });
        } else {
            console.error('savePlayersBtn not found!');
        }
        document.getElementById('startNewSessionBtn').addEventListener('click', () => this.startNewSession());
        const addPlayerBtn = document.getElementById('addPlayerBtn');
        if (addPlayerBtn) {
            addPlayerBtn.addEventListener('click', () => this.addPlayerRow());
        }

        const editableList = document.getElementById('playerEditableList');
        if (editableList) {
            editableList.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-player-btn');
                if (deleteBtn) {
                    const index = parseInt(deleteBtn.dataset.index);
                    this.removePlayerRow(index);
                }
            });

            editableList.addEventListener('input', (e) => {
                const input = e.target.closest('.player-name-input');
                if (input) {
                    const index = parseInt(input.dataset.index);
                    const value = input.value;
                    this.updatePlayerRow(index, value);
                }
            });

            editableList.addEventListener('change', (e) => {
                const select = e.target.closest('.lock-select');
                if (select) {
                    const index = parseInt(select.dataset.index);
                    const side = select.value;
                    if (!isNaN(index) && side) {
                        this.handleInlineLockToggle(index, side);
                    }
                }
                
                // Handle presence checkbox
                const checkbox = e.target.closest('.presence-checkbox');
                if (checkbox) {
                    const playerName = checkbox.dataset.player;
                    const isPresent = checkbox.checked;
                    if (playerName) {
                        this.playerManager.setPlayerPresence(playerName, isPresent);
                        this.updatePlayerPresenceDisplay(playerName, isPresent);
                    }
                }
            });
        }

        const playerLockList = document.getElementById('playerLockList');
        if (playerLockList) {
            playerLockList.addEventListener('click', (event) => {
                const button = event.target.closest('.lock-btn');
                if (!button || button.disabled) {
                    return;
                }
                const player = button.dataset.player;
                const side = button.dataset.side;
                if (player && side) {
                    this.handleLockSelection(player, side);
                }
            });
        }

        // Team screen
        document.getElementById('confirmSequenceBtn').addEventListener('click', () => this.confirmSequence());
        document.getElementById('selectAllCombinationsBtn').addEventListener('click', () => this.selectAllStructures());
        document.getElementById('randomCombinationBtn').addEventListener('click', () => this.randomSelectStructure());
        document.getElementById('backToPlayersBtn').addEventListener('click', () => this.showScreen('playerScreen'));

        // Sequence screen
        document.getElementById('startGamesBtn').addEventListener('click', () => this.startGames());
        document.getElementById('backToTeamsBtn').addEventListener('click', () => this.showScreen('teamScreen'));

        // Match screen
        document.getElementById('submitScoreBtn').addEventListener('click', () => this.recordScore());
        document.getElementById('backToSequenceBtn').addEventListener('click', () => this.showScreen('sequenceScreen'));
        const undoBtn = document.getElementById('undoLastMatchBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoLastMatch());
        }
        
        // Extra time and penalties checkboxes
        const extraTimeCheckbox = document.getElementById('wentToExtraTime');
        const penaltiesCheckbox = document.getElementById('wentToPenalties');
        if (extraTimeCheckbox) {
            extraTimeCheckbox.addEventListener('change', (e) => {
                const extraTimeScores = document.getElementById('extraTimeScores');
                if (extraTimeScores) {
                    extraTimeScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        if (penaltiesCheckbox) {
            penaltiesCheckbox.addEventListener('change', (e) => {
                const penaltiesScores = document.getElementById('penaltiesScores');
                if (penaltiesScores) {
                    penaltiesScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }

        // Auto-select score inputs on focus so new typing replaces existing values
        const autoSelectIds = [
            // Match screen
            'team1Score', 'team2Score',
            'team1ExtraTimeScore', 'team2ExtraTimeScore',
            'team1PenaltiesScore', 'team2PenaltiesScore',
            // Edit modal
            'editTeam1Score', 'editTeam2Score',
            'editTeam1ExtraTimeScore', 'editTeam2ExtraTimeScore',
            'editTeam1PenaltiesScore', 'editTeam2PenaltiesScore'
        ];
        autoSelectIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('focus', () => requestAnimationFrame(() => el.select()));
            // Prevent mouseup/tap from clearing the selection
            el.addEventListener('mouseup', (e) => e.preventDefault());
        });

        // Stats screen
        const statsTabSelect = document.getElementById('statsTabSelect');
        if (statsTabSelect) {
            statsTabSelect.addEventListener('change', (e) => this.switchStatsTab(e.target.value));
        }
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchStatsMode(e.target.dataset.mode));
        });
        document.getElementById('newSeasonBtn').addEventListener('click', () => this.startNewSeason());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataBtn').addEventListener('click', () => this.importData());
        document.getElementById('clearOverallStatsBtn').addEventListener('click', () => this.clearAllStatistics());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.showScreen('playerScreen'));
        
        // Share buttons
        document.getElementById('shareTodayStatsBtn').addEventListener('click', () => this.shareStats('today'));
        document.getElementById('shareSeasonStatsBtn').addEventListener('click', () => this.shareStats('season'));
        document.getElementById('shareOverallStatsBtn').addEventListener('click', () => this.shareStats('overall'));
        const shareCustomBtn = document.getElementById('shareCustomStatsBtn');
        if (shareCustomBtn) {
            shareCustomBtn.addEventListener('click', () => this.shareStats('custom'));
        }
        document.getElementById('exportTodayPDFBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('exportSeasonPDFBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('exportOverallPDFBtn').addEventListener('click', () => this.exportPDF());
        const exportCustomBtn = document.getElementById('exportCustomPDFBtn');
        if (exportCustomBtn) {
            exportCustomBtn.addEventListener('click', () => this.exportPDF('custom'));
        }
        const viewPdfBtn = document.getElementById('viewLastPDFBtn');
        if (viewPdfBtn) {
            viewPdfBtn.addEventListener('click', () => this.viewLastPDF());
        }
        const byDateBtn = document.getElementById('byDateStatsBtn');
        if (byDateBtn) {
            byDateBtn.addEventListener('click', () => this.toggleByDatePanel(true));
        }

        // History screen
        document.getElementById('backFromHistoryBtn').addEventListener('click', () => this.showScreen('statsScreen'));
        
        // Team Details screen
        document.getElementById('backFromTeamDetailsBtn').addEventListener('click', () => this.showScreen('statsScreen'));
        document.getElementById('historyFilter').addEventListener('change', () => this.loadMatchHistory());
        document.getElementById('historySearch').addEventListener('input', () => this.loadMatchHistory());
        document.getElementById('historyDateFrom').addEventListener('change', () => this.loadMatchHistory());
        document.getElementById('historyDateTo').addEventListener('change', () => this.loadMatchHistory());
        const historySortOrder = document.getElementById('historySortOrder');
        if (historySortOrder) {
            historySortOrder.value = this.historySortOrder;
            historySortOrder.addEventListener('change', (e) => {
                this.historySortOrder = e.target.value === 'asc' ? 'asc' : 'desc';
                this.loadMatchHistory();
            });
        }
        document.getElementById('clearHistoryFiltersBtn').addEventListener('click', () => this.clearHistoryFilters());
        document.getElementById('historyListViewBtn').addEventListener('click', () => this.switchHistoryView('list'));
        document.getElementById('historyTimelineViewBtn').addEventListener('click', () => this.switchHistoryView('timeline'));
        const historyFiltersToggle = document.getElementById('historyFiltersToggle');
        const historyControlsWrapper = document.getElementById('historyControlsWrapper');
        if (historyFiltersToggle && historyControlsWrapper) {
            historyFiltersToggle.addEventListener('click', () => {
                const isCollapsed = historyControlsWrapper.classList.toggle('collapsed');
                historyControlsWrapper.style.display = isCollapsed ? 'none' : 'grid';
                historyFiltersToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
                historyFiltersToggle.textContent = isCollapsed ? 'More filters ▸' : 'More filters ▾';
            });
        }
        document.querySelectorAll('.history-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter || 'all';
                this.setHistoryQuickFilter(filter);
            });
        });

        // Settings screen
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSettingsTab(e.target.dataset.settingsTab));
        });
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('backFromSettingsBtn').addEventListener('click', () => this.showScreen('playerScreen'));
        document.getElementById('resetLabelsBtn').addEventListener('click', () => this.resetLabels());
        document.getElementById('exportDataSettingsBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataSettingsBtn').addEventListener('click', () => this.importData());
        document.getElementById('clearAllDataBtn').addEventListener('click', () => this.confirmClearAllData());
        
        // Admin PIN buttons
        const adminUnlockBtn = document.getElementById('adminUnlockBtn');
        if (adminUnlockBtn) adminUnlockBtn.addEventListener('click', () => this.unlockAdminWithPin());
        const adminSetPinBtn = document.getElementById('adminSetPinBtn');
        if (adminSetPinBtn) adminSetPinBtn.addEventListener('click', () => this.setAdminPin());
        const adminLockBtn = document.getElementById('adminLockBtn');
        if (adminLockBtn) adminLockBtn.addEventListener('click', () => this.lockAdmin());
        const adminResetPinBtn = document.getElementById('adminResetPinBtn');
        if (adminResetPinBtn) adminResetPinBtn.addEventListener('click', () => this.resetAdminPin());
        const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
        if (copyShareUrlBtn) {
            copyShareUrlBtn.addEventListener('click', () => this.copyShareUrl());
        }
        
        const darkModeSetting = document.getElementById('darkModeSetting');
        if (darkModeSetting) {
            darkModeSetting.addEventListener('change', (e) => {
                this.settingsManager.setDarkMode(e.target.checked);
                this.toggleDarkMode();
            });
        }
        const savePointsSettingsBtn = document.getElementById('savePointsSettingsBtn');
        if (savePointsSettingsBtn) {
            savePointsSettingsBtn.addEventListener('click', () => this.savePointsSettings());
        }
        const cancelPointsSettingsBtn = document.getElementById('cancelPointsSettingsBtn');
        if (cancelPointsSettingsBtn) {
            cancelPointsSettingsBtn.addEventListener('click', () => this.closePointsSettingsModal());
        }

        // Edit match modal
        document.getElementById('saveEditMatchBtn').addEventListener('click', () => this.saveEditMatch());
        document.getElementById('cancelEditMatchBtn').addEventListener('click', () => this.closeEditModal());
        document.getElementById('deleteMatchBtn').addEventListener('click', () => this.confirmDeleteMatch());
        
        // Edit modal extra time and penalties checkboxes
        const editExtraTimeCheckbox = document.getElementById('editWentToExtraTime');
        const editPenaltiesCheckbox = document.getElementById('editWentToPenalties');
        if (editExtraTimeCheckbox) {
            editExtraTimeCheckbox.addEventListener('change', (e) => {
                const editExtraTimeScores = document.getElementById('editExtraTimeScores');
                if (editExtraTimeScores) {
                    editExtraTimeScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        if (editPenaltiesCheckbox) {
            editPenaltiesCheckbox.addEventListener('change', (e) => {
                const editPenaltiesScores = document.getElementById('editPenaltiesScores');
                if (editPenaltiesScores) {
                    editPenaltiesScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        document.getElementById('importFileInput').addEventListener('change', (e) => this.handleFileImport(e));

        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            // Remove any existing listeners first
            const newToggle = darkModeToggle.cloneNode(true);
            darkModeToggle.parentNode.replaceChild(newToggle, darkModeToggle);
            // Re-attach listener
            document.getElementById('darkModeToggle').addEventListener('click', () => {
                console.log('Dark mode button clicked');
                this.toggleDarkMode();
            });
            this.initializeDarkMode();
        }
        
        // Refresh/Update button
        const refreshAppBtn = document.getElementById('refreshAppBtn');
        if (refreshAppBtn) {
            refreshAppBtn.addEventListener('click', () => this.checkForUpdates());
        }

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const screen = e.target.closest('.nav-btn').dataset.screen;
                const screenOrder = ['sessionScreen', 'homeScreen', 'playerScreen', 'teamScreen', 'sequenceScreen', 'gameScreen', 'statsScreen', 'historyScreen', 'settingsScreen'];
                const currentIndex = screenOrder.indexOf(this.currentScreen);
                const targetIndex = screenOrder.indexOf(screen);
                const direction = targetIndex > currentIndex ? 'forward' : 'back';
                this.showScreen(screen, direction);
            });
        });

        // Session wizard
        const sessionContinueBtn = document.getElementById('sessionContinueBtn');
        if (sessionContinueBtn) {
            sessionContinueBtn.addEventListener('click', () => this.sessionContinue());
        }

        const sessionAdvancedLink = document.getElementById('sessionAdvancedLink');
        if (sessionAdvancedLink) {
            sessionAdvancedLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.sessionAdvanced();
            });
        }

        const sessionAddPlayerBtn = document.getElementById('sessionAddPlayerBtn');
        if (sessionAddPlayerBtn) {
            sessionAddPlayerBtn.addEventListener('click', () => this.addNewSessionPlayerInput());
        }

        const sessionNextMatchBtn = document.getElementById('sessionNextMatchBtn');
        if (sessionNextMatchBtn) {
            sessionNextMatchBtn.addEventListener('click', () => this.sessionNextMatch());
        }

        const sessionStartBtn = document.getElementById('sessionStartBtn');
        if (sessionStartBtn) {
            sessionStartBtn.addEventListener('click', () => this.startSessionWizard());
        }

        const sessionAdvancedModeBtn = document.getElementById('sessionAdvancedModeBtn');
        if (sessionAdvancedModeBtn) {
            sessionAdvancedModeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.setUiMode('advanced');
                // Jump to the classic players screen to make it obvious
                this.showScreen('playerScreen');
            });
        }

        const goToSessionBtn = document.getElementById('goToSessionBtn');
        if (goToSessionBtn) {
            goToSessionBtn.addEventListener('click', () => {
                this.setUiMode('session');
                this.sessionStarted = false;
                this.showScreen('sessionScreen');
            });
        }
    }

    showScreen(screenId, direction = 'forward') {
        // Determine animation direction
        const screenOrder = ['sessionScreen', 'homeScreen', 'playerScreen', 'teamScreen', 'sequenceScreen', 'gameScreen', 'statsScreen', 'historyScreen', 'settingsScreen'];
        const currentIndex = this.currentScreen ? screenOrder.indexOf(this.currentScreen) : -1;
        const targetIndex = screenOrder.indexOf(screenId);
        
        // Auto-detect direction if not specified
        if (currentIndex >= 0 && targetIndex >= 0) {
            if (direction === 'forward' && targetIndex < currentIndex) {
                direction = 'back';
            } else if (direction === 'back' && targetIndex > currentIndex) {
                direction = 'forward';
            }
        }

        // Get current and target screens
        const currentScreen = this.currentScreen ? document.getElementById(this.currentScreen) : null;
        const targetScreen = document.getElementById(screenId);
        
        if (!targetScreen) return;

        // Hide all screens first
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active', 'slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
        });

        // Add exit animation to current screen if it exists
        if (currentScreen && currentScreen !== targetScreen) {
            currentScreen.classList.add(direction === 'forward' ? 'slide-out-left' : 'slide-out-right');
        }

        // Show target screen with enter animation
        targetScreen.classList.add('active', direction === 'forward' ? 'slide-in-right' : 'slide-in-left');
        this.currentScreen = screenId;
        this.saveCurrentGameState(); // Save the state when screen changes

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenId);
        });

        // Load screen-specific data
        if (screenId === 'sessionScreen') {
            // Session screen now starts with a splash, unless the wizard was started
            if (this.uiMode === 'advanced' || !this.sessionStarted) {
                this.applyUiMode();
            } else {
                this.loadSessionWizard();
            }

            // Hide back to session button on session screen
            this.updateBackToSessionButton();
        } else if (screenId === 'teamScreen') {
            this.loadTeamCombinations();
        } else if (screenId === 'sequenceScreen') {
            this.loadSequenceList();
        } else if (screenId === 'statsScreen') {
            this.updatePlayedDates();
            this.loadStatistics();
            this.updateViewPDFButton();
            // Initialize swipe gestures for stats tabs
            setTimeout(() => {
                this.initializeStatsTabSwipes();
            }, 100);

            // Show/hide back to session button
            this.updateBackToSessionButton();
        } else if (screenId === 'playerScreen') {
            // Reload players to ensure UI is in sync
            const players = this.playerManager.getPlayers();
            this.loadPlayersIntoUI(players);
            this.updatePlayerNameHistory();
        } else if (screenId === 'historyScreen') {
            // Initialize view toggle state
            const listBtn = document.getElementById('historyListViewBtn');
            const timelineBtn = document.getElementById('historyTimelineViewBtn');
            if (listBtn && timelineBtn) {
                listBtn.classList.toggle('active', this.currentHistoryView === 'list');
                timelineBtn.classList.toggle('active', this.currentHistoryView === 'timeline');
                document.getElementById('matchHistoryList').style.display = this.currentHistoryView === 'list' ? 'flex' : 'none';
                document.getElementById('matchHistoryTimeline').style.display = this.currentHistoryView === 'timeline' ? 'block' : 'none';
            }

            // Show/hide back to session button
            this.updateBackToSessionButton();
            this.loadMatchHistory();
        } else if (screenId === 'settingsScreen') {
            this.loadSettingsScreen();
        }
    }

    // Player Management
    loadPlayersIntoUI(players) {
        this.playerEditorValues = Array.isArray(players) ? [...players] : [];
        if (this.playerEditorValues.length === 0) {
            this.playerEditorValues = ['', ''];
        } else if (this.playerEditorValues.length === 1) {
            this.playerEditorValues.push('');
        }
        this.renderEditablePlayerList();
        this.updateCurrentPlayersDisplay();
    }

    // Helper function to format player name with color
    formatPlayerNameWithColor(playerName) {
        const color = this.settingsManager.getPlayerColor(playerName);
        const escapedName = this.escapeHtml(playerName);
        if (color) {
            return `<span class="player-name" style="color: ${color}; font-weight: 600;">${escapedName}</span>`;
        }
        return `<span class="player-name">${escapedName}</span>`;
    }

    // Helper function to format team with player colors
    formatTeamWithColors(team) {
        if (Array.isArray(team)) {
            return team.map(p => this.formatPlayerNameWithColor(p)).join(' & ');
        }
        return this.formatPlayerNameWithColor(team);
    }

    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) return text;
        if (typeof text !== 'string') return text; // Safety check
        
        try {
            // Escape regex special characters in search term
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            
            // Simple highlight: wrap matches in mark tag
            return text.replace(regex, '<mark class="search-highlight">$1</mark>');
        } catch (e) {
            console.error('Error highlighting search term:', e);
            return text; // Return original text on error
        }
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getEditorPlayersTrimmed() {
        return this.playerEditorValues
            .map(name => (typeof name === 'string' ? name.trim() : ''))
            .filter(name => name.length > 0);
    }

    renderEditablePlayerList() {
        const list = document.getElementById('playerEditableList');
        if (!list) return;

        const globalPlayers = this.playerManager.getPlayers();
        const editorTrimmed = this.getEditorPlayersTrimmed();
        const unsaved = editorTrimmed.length !== globalPlayers.length ||
            editorTrimmed.some((name, index) => name !== globalPlayers[index]);
        const lockState = this.playerManager.getPlayerLock();
        const lockActive = lockState && lockState.player && lockState.side && lockState.side !== 'neutral';

        list.innerHTML = this.playerEditorValues.map((player, index) => {
            const value = typeof player === 'string' ? player : '';
            const isFilled = value.trim().length > 0;
            const trimmed = value.trim();
            const isSavedPlayer = isFilled && globalPlayers.includes(trimmed);
            const isLockedPlayer = isSavedPlayer && lockActive && lockState.player === trimmed;
            const isPresent = isSavedPlayer ? this.playerManager.isPlayerPresent(trimmed) : true;
            const labels = this.lockLabels || {
                home: 'Home',
                away: 'Away',
                neutral: 'Neutral'
            };
            const canSelect = isSavedPlayer && !unsaved;
            let selectedValue = 'neutral';
            if (isLockedPlayer) {
                selectedValue = lockState.side;
            } else if (lockActive) {
                selectedValue = 'neutral';
            }

            return `
            <li class="player-editable-item${isFilled ? ' active' : ''}${isSavedPlayer && !isPresent ? ' absent' : ''}" data-index="${index}">
                <div class="drag-handle" draggable="true" data-index="${index}">☰</div>
                <input
                    type="text"
                    class="player-name-input"
                    data-index="${index}"
                    value="${this.escapeHtml(value)}"
                    placeholder="Player ${index + 1}"
                    maxlength="20"
                />
                <div class="player-controls">
                    <div class="presence-toggle" data-player="${this.escapeHtml(trimmed)}" style="${!isSavedPlayer ? 'display:none' : ''}">
                        <label class="presence-label" title="${isPresent ? 'Player is present - stats will count' : 'Player is absent - individual stats frozen, team stats continue'}">
                            <input type="checkbox"
                                   class="presence-checkbox"
                                   data-player="${this.escapeHtml(trimmed)}"
                                   ${isPresent ? 'checked' : ''} />
                            <span class="presence-text">${isPresent ? 'Present' : 'Absent'}</span>
                        </label>
                    </div>
                    <select class="lock-select" data-index="${index}" ${!canSelect ? 'disabled' : ''}>
                        <option value="home" ${selectedValue === 'home' ? 'selected' : ''}>${this.escapeHtml(labels.home)}</option>
                        <option value="neutral" ${selectedValue === 'neutral' ? 'selected' : ''}>${this.escapeHtml(labels.neutral)}</option>
                        <option value="away" ${selectedValue === 'away' ? 'selected' : ''}>${this.escapeHtml(labels.away)}</option>
                    </select>
                </div>
                <div class="player-actions">
                    <button class="delete-player-btn" data-index="${index}" title="Remove player">×</button>
                </div>
            </li>
        `;
        }).join('');

        const addButton = document.getElementById('addPlayerBtn');
        if (addButton) {
            const count = this.playerEditorValues.length;
            addButton.disabled = count >= 4;
            addButton.textContent = count < 4 ? 'Add Player' : 'Max Players';
            addButton.title = count < 4 ? 'Add another player slot' : 'Maximum of 4 players supported';
        }

        this.initializeDragAndDrop();
        this.updatePlayerNameHistory();
        this.renderPlayerLockOptions();
    }

    initializeDragAndDrop() {
        const list = document.getElementById('playerEditableList');
        if (!list) return;

        let draggedIndex = null;

        list.querySelectorAll('.drag-handle').forEach(handle => {
            handle.addEventListener('dragstart', (e) => {
                draggedIndex = parseInt(e.target.dataset.index);
                e.dataTransfer.effectAllowed = 'move';
            });
        });

        list.querySelectorAll('.player-editable-item').forEach(item => {
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIndex = parseInt(item.dataset.index);
                if (draggedIndex === null || isNaN(targetIndex) || targetIndex === draggedIndex) {
                    return;
                }
                this.reorderPlayers(draggedIndex, targetIndex);
                draggedIndex = null;
            });
        });
    }

    reorderPlayers(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.playerEditorValues.length || toIndex < 0 || toIndex >= this.playerEditorValues.length) {
            return;
        }
        const updated = [...this.playerEditorValues];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        this.playerEditorValues = updated;
        this.renderEditablePlayerList();
    }

    addPlayerRow() {
        if (this.playerEditorValues.length >= 4) {
            alert('Maximum 4 players allowed');
            return;
        }
        this.playerEditorValues.push('');
        this.renderEditablePlayerList();
    }

    removePlayerRow(index) {
        if (index < 0 || index >= this.playerEditorValues.length) return;
        this.playerEditorValues.splice(index, 1);
        if (this.playerEditorValues.length === 0) {
            this.playerEditorValues = ['', ''];
        } else if (this.playerEditorValues.length === 1) {
            this.playerEditorValues.push('');
        }
        this.renderEditablePlayerList();
    }

    updatePlayerRow(index, value) {
        if (index < 0 || index >= this.playerEditorValues.length) return;
        this.playerEditorValues[index] = value;
        const listItems = document.querySelectorAll('.player-editable-item');
        if (listItems[index]) {
            listItems[index].classList.toggle('active', value.trim().length > 0);
        }
        this.updatePlayerNameHistory();
        this.renderPlayerLockOptions();
    }

    updatePlayerPresenceDisplay(playerName, isPresent) {
        const playerItems = document.querySelectorAll('.player-editable-item');
        playerItems.forEach(item => {
            const checkbox = item.querySelector(`.presence-checkbox[data-player="${playerName}"]`);
            if (checkbox) {
                const presenceText = item.querySelector('.presence-text');
                if (presenceText) {
                    presenceText.textContent = isPresent ? 'Present' : 'Absent';
                }
                item.classList.toggle('absent', !isPresent);
            }
        });
    }

    updateCurrentPlayersDisplay() {
        const players = this.playerManager.getPlayers();
        const container = document.getElementById('currentPlayers');
        const list = document.getElementById('playersList');
        
        if (players.length > 0) {
            container.style.display = 'block';
            list.innerHTML = players.map(p => `<li>${p}</li>`).join('');
            document.getElementById('startNewSessionBtn').style.display = 'block';
        } else {
            container.style.display = 'none';
            document.getElementById('startNewSessionBtn').style.display = 'none';
        }
        this.renderPlayerLockOptions();
    }

    renderPlayerLockOptions() {
        const container = document.getElementById('playerLockContainer');
        const list = document.getElementById('playerLockList');
        const hint = document.getElementById('playerLockHint');
        const unsavedHint = document.getElementById('playerLockUnsavedHint');

        if (!container || !list) {
            this.hasUnsavedPlayerChanges = false;
            return;
        }

        const players = this.playerManager.getPlayers();
        const editorPlayers = this.getEditorPlayersTrimmed();
        const unsavedChanges = editorPlayers.length !== players.length ||
            editorPlayers.some((name, index) => name !== players[index]);
        this.hasUnsavedPlayerChanges = unsavedChanges;

        const editableList = document.getElementById('playerEditableList');
        if (editableList) {
            editableList.classList.toggle('unsaved', unsavedChanges);
        }

        if (!players || players.length < 2) {
            container.style.display = 'none';
            list.innerHTML = '';
            if (hint) {
                hint.style.display = 'none';
            }
            if (unsavedHint) {
                unsavedHint.style.display = 'none';
            }
            return;
        }

        container.style.display = 'block';
        container.classList.toggle('unsaved', unsavedChanges);
        const lockState = this.playerManager.getPlayerLock();
        const lockActive = lockState.player && lockState.side && lockState.side !== 'neutral';

        list.innerHTML = players.map(player => {
            const isLockedPlayer = lockActive && lockState.player === player;
            const homeActive = isLockedPlayer && lockState.side === 'home';
            const awayActive = isLockedPlayer && lockState.side === 'away';
            const homeDisabled = unsavedChanges || (lockActive && !isLockedPlayer);
            const awayDisabled = unsavedChanges || (lockActive && !isLockedPlayer);
            const neutralDisabled = unsavedChanges || (!isLockedPlayer && lockActive);
            const homeClass = `lock-btn home${homeActive ? ' active' : ''}`;
            const awayClass = `lock-btn away${awayActive ? ' active' : ''}`;
            const neutralClass = 'lock-btn neutral';

            return `
                <div class="player-lock-row${isLockedPlayer ? ' locked' : ''}">
                    <span class="player-lock-name">${this.escapeHtml(player)}</span>
                    <div class="player-lock-options">
                        <button class="${homeClass}" data-player="${this.escapeHtml(player)}" data-side="home" ${homeDisabled ? 'disabled' : ''}>${this.escapeHtml(this.lockLabels.home)}</button>
                        <button class="${awayClass}" data-player="${this.escapeHtml(player)}" data-side="away" ${awayDisabled ? 'disabled' : ''}>${this.escapeHtml(this.lockLabels.away)}</button>
                        <button class="${neutralClass}" data-player="${this.escapeHtml(player)}" data-side="neutral" ${neutralDisabled ? 'disabled' : ''}>${this.escapeHtml(this.lockLabels.neutral)}</button>
                    </div>
                </div>
            `;
        }).join('');

        if (hint) {
            hint.style.display = lockActive ? 'block' : 'none';
        }
        if (unsavedHint) {
            unsavedHint.style.display = unsavedChanges ? 'block' : 'none';
        }
    }

    handleLockSelection(player, side) {
        if (!player || !side) {
            return;
        }

        let success = true;
        if (side === 'neutral') {
            success = this.playerManager.clearPlayerLock();
        } else {
            success = this.playerManager.setPlayerLock(player, side);
        }

        if (success === false) {
            return;
        }

        this.resetSelectedStructure();
        this.renderPlayerLockOptions();

        if (this.currentScreen === 'teamScreen') {
            this.loadTeamCombinations();
        } else if (this.currentScreen === 'sequenceScreen' || this.currentScreen === 'matchScreen') {
            this.showScreen('teamScreen');
        }

        this.renderEditablePlayerList();
    }

    handleInlineLockToggle(index, side) {
        if (typeof index !== 'number' || isNaN(index) || !side) {
            return;
        }

        if (this.hasUnsavedPlayerChanges) {
            this.toastManager.warning('Please save players before changing home/away settings.');
            return;
        }

        const value = this.playerEditorValues[index];
        const trimmed = value ? value.trim() : '';
        if (!trimmed) {
            return;
        }

        const players = this.playerManager.getPlayers();
        if (!Array.isArray(players) || !players.includes(trimmed)) {
            this.toastManager.warning('Save players before changing home/away settings.');
            return;
        }

        this.handleLockSelection(trimmed, side);
    }

    resetSelectedStructure() {
        this.selectedStructureIndex = null;
        this.selectedStructure = null;
        this.selectedAllStructures = false;
        this.currentGameIndex = 0;
        this.currentMatch = null;

        const confirmBtn = document.getElementById('confirmSequenceBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    }

    async savePlayers() {
        const rawPlayers = this.playerEditorValues
            .map(name => (typeof name === 'string' ? name.trim() : ''))
            .filter(name => name.length > 0);

        const players = rawPlayers.filter((name, index) => rawPlayers.indexOf(name) === index);

        if (players.length !== rawPlayers.length) {
            this.toastManager.error('Duplicate player names detected. Please ensure each player has a unique name.', 'Validation Error');
            return;
        }

        if (players.length < 2) {
            this.toastManager.warning('Please enter at least 2 players', 'Player Requirement');
            return;
        }

        try {
            // Add each player to history
            players.forEach(player => {
                this.playerManager.addToHistory(player);
            });
            
            const saved = await this.playerManager.setPlayers(players);
            if (saved) {
                this.playerEditorValues = [...players];
                if (this.playerEditorValues.length === 1) {
                    this.playerEditorValues.push('');
                } else if (this.playerEditorValues.length === 0) {
                    this.playerEditorValues = ['', ''];
                }
                this.renderEditablePlayerList();
                this.updateCurrentPlayersDisplay();
                this.updatePlayerNameHistory(); // Update the history display
                this.resetSelectedStructure();
                this.showScreen('teamScreen');
                this.toastManager.success('Players saved successfully!');
            } else {
                this.toastManager.error('Error saving players');
            }
        } catch (error) {
            console.error('Error in savePlayers:', error);
            this.toastManager.error('Error saving players: ' + error.message);
        }
    }

    startNewSession() {
        this.resetSelectedStructure();
        this.showScreen('teamScreen');
    }

    // Round Structures
    loadTeamCombinations() {
        const players = this.playerManager.getPlayers();
        if (players.length < 2) {
            this.showScreen('playerScreen');
            return;
        }

        if (!players || players.length < 2) {
            this.toastManager.warning('Add at least 2 players to randomize teams', 'Not Enough Players');
            return;
        }

        const lockState = this.playerManager.getPlayerLock();
        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        const container = document.getElementById('teamCombinations');
        
        if (!container) {
            console.error('teamCombinations container not found');
            return;
        }
        
        if (structures.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Need at least 2 players to generate round structures.</p></div>';
            return;
        }

        container.innerHTML = structures.map((structure, structureIndex) => {
            const isSelected = this.selectedStructureIndex === structureIndex || this.selectedAllStructures;
            
            const matchesHTML = structure.matches.map((match, matchIndex) => {
                const team1Name = this.teamGenerator.formatTeamName(match.team1);
                const team2Name = this.teamGenerator.formatTeamName(match.team2);
                return `
                    <div class="structure-match">
                        <div class="match-round-label">Round ${matchIndex + 1}</div>
                        <div class="team-display">
                            <div class="team-players">
                                ${match.team1.map(p => this.formatPlayerNameWithColor(p)).join('')}
                            </div>
                            <span class="vs">VS</span>
                            <div class="team-players">
                                ${match.team2.map(p => this.formatPlayerNameWithColor(p)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            const showSelectButton = this.selectedStructureIndex === structureIndex && !this.selectedAllStructures;
            const allSelectedIndicator = this.selectedAllStructures ? '<span class="all-selected-indicator">✓ All Selected</span>' : '';
            
            return `
                <div class="round-structure-card ${isSelected ? 'selected' : ''}" data-index="${structureIndex}">
                    <div class="structure-header">
                        <h3>Round Structure ${structureIndex + 1} ${allSelectedIndicator}</h3>
                        ${showSelectButton ? `<button class="select-structure-btn" data-index="${structureIndex}">Select</button>` : ''}
                    </div>
                    <div class="structure-matches">
                        ${matchesHTML}
                    </div>
                </div>
            `;
        }).join('');

        // Use event delegation on the container for more reliable event handling
        // Remove any existing listeners first to avoid duplicates
        const existingClickHandler = container._clickHandler;
        const existingTouchHandler = container._touchHandler;
        if (existingClickHandler) {
            container.removeEventListener('click', existingClickHandler);
        }
        if (existingTouchHandler) {
            container.removeEventListener('touchend', existingTouchHandler);
        }

        // Create click handler
        const clickHandler = (e) => {
            // Check if click is on a round structure card
            const card = e.target.closest('.round-structure-card');
            if (!card) {
                return;
            }

            // Check if click is on the select button
            if (e.target.closest('.select-structure-btn')) {
                e.stopPropagation();
                console.log('Select button clicked');
                this.confirmSequence();
                return;
            }

            // Otherwise, select the structure
            const index = parseInt(card.dataset.index);
            if (!isNaN(index)) {
                console.log('Round structure card clicked, index:', index);
                this.selectStructure(index);
            }
        };

        // Create touch handler for mobile
        const touchHandler = (e) => {
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const card = target ? target.closest('.round-structure-card') : null;
            
            if (!card) {
                return;
            }

            // Check if touch is on the select button
            if (target && target.closest('.select-structure-btn')) {
                e.stopPropagation();
                console.log('Select button touched');
                this.confirmSequence();
                return;
            }

            // Otherwise, select the structure
            const index = parseInt(card.dataset.index);
            if (!isNaN(index)) {
                console.log('Round structure card touched, index:', index);
                this.selectStructure(index);
            }
        };

        // Store handler references and attach
        container._clickHandler = clickHandler;
        container._touchHandler = touchHandler;
        
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            container.addEventListener('click', clickHandler, { passive: false });
            container.addEventListener('touchend', touchHandler, { passive: false });
            console.log('Event listeners attached to teamCombinations container');
            console.log('Number of cards:', container.querySelectorAll('.round-structure-card').length);
        });

        const description = document.getElementById('teamScreenDescription');
        const playerCount = players.length;
        if (playerCount === 4) {
            description.textContent = 'Select a round structure to play. Each structure contains 3 matches (2v2) where each player pairs with every other player once.';
        } else if (playerCount === 3) {
            description.textContent = 'Select a round structure to play. Each structure contains 3 matches (2v1) ensuring all pairings.';
        } else {
            description.textContent = 'Ready to play 1v1!';
        }

        // Show "Select All" button and update its state
        const selectAllBtn = document.getElementById('selectAllCombinationsBtn');
        selectAllBtn.style.display = 'block';
        if (this.selectedAllStructures) {
            selectAllBtn.textContent = 'All Selected ✓';
            selectAllBtn.classList.add('btn-success');
            selectAllBtn.classList.remove('btn-secondary');
        } else {
            selectAllBtn.textContent = 'Select All';
            selectAllBtn.classList.remove('btn-success');
            selectAllBtn.classList.add('btn-secondary');
        }
        document.getElementById('confirmSequenceBtn').disabled = this.selectedStructureIndex === null && !this.selectedAllStructures;
    }

    selectStructure(structureIndex) {
        console.log('selectStructure called with index:', structureIndex);

        const players = this.playerManager.getPlayers();
        console.log('Players:', players);

        const lockState = this.playerManager.getPlayerLock();
        console.log('Lock state:', lockState);

        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        console.log('Generated structures:', structures.length);

        if (structureIndex >= 0 && structureIndex < structures.length) {
            console.log('Setting selected structure:', structureIndex);
            this.selectedStructureIndex = structureIndex;
            this.selectedStructure = structures[structureIndex];
            this.selectedAllStructures = false; // Clear "select all" when selecting individual structure
            this.loadTeamCombinations();
            document.getElementById('confirmSequenceBtn').disabled = false;
            this.saveCurrentGameState(); // Save the state
            console.log('Structure selected successfully');
        } else {
            console.log('Invalid structure index:', structureIndex, 'max:', structures.length - 1);
        }
    }

    randomSelectStructure() {
        console.log('randomSelectStructure called');
        const players = this.playerManager.getPlayers();
        const lockState = this.playerManager.getPlayerLock();
        const structures = this.teamGenerator.generateRoundStructures(players, lockState);

        if (!structures || structures.length === 0) {
            this.toastManager.warning('No round structures available to randomize', 'Randomize Failed');
            return;
        }

        const randomIndex = Math.floor(Math.random() * structures.length);
        console.log('Randomly selected structure:', randomIndex);

        this.selectedStructureIndex = randomIndex;
        this.selectedStructure = structures[randomIndex];
        this.selectedAllStructures = false;
        this.currentGameIndex = 0;

        const confirmBtn = document.getElementById('confirmSequenceBtn');
        if (confirmBtn) confirmBtn.disabled = false;

        this.loadTeamCombinations();
        this.toastManager.success(`Randomized order selected: Structure ${randomIndex + 1}`, 'Random Pick');
        this.saveCurrentGameState(); // Save the state
        this.confirmSequence();
    }

    selectAllStructures() {
        console.log('selectAllStructures called');
        const players = this.playerManager.getPlayers();
        const lockState = this.playerManager.getPlayerLock();
        const structures = this.teamGenerator.generateRoundStructures(players, lockState);
        
        if (structures.length === 0) {
            this.toastManager.warning('No round structures available', 'Selection Error');
            return;
        }

        // Combine all matches from all structures into one sequence
        const allMatches = [];
        structures.forEach((structure, index) => {
            structure.matches.forEach((match, matchIndex) => {
                allMatches.push({
                    ...match,
                    structureIndex: index,
                    matchIndex: matchIndex
                });
            });
        });

        // Create a combined structure
        this.selectedStructure = {
            matches: allMatches
        };
        this.selectedStructureIndex = null; // Clear individual selection
        this.selectedAllStructures = true;
        
        this.loadTeamCombinations();
        document.getElementById('confirmSequenceBtn').disabled = false;
        this.saveCurrentGameState(); // Save the state
        this.toastManager.success(`Selected all ${allMatches.length} matches from ${structures.length} structures`, 'All Selected');
        console.log('All structures selected, total matches:', allMatches.length);
    }

    confirmSequence() {
        console.log('confirmSequence called');
        console.log('selectedStructureIndex:', this.selectedStructureIndex);
        console.log('selectedStructure:', this.selectedStructure);
        console.log('selectedAllStructures:', this.selectedAllStructures);

        if ((this.selectedStructureIndex === null && !this.selectedAllStructures) || !this.selectedStructure) {
            console.log('No structure selected, showing warning');
            this.toastManager.warning('Please select a round structure or click "Select All"', 'Selection Required');
            return;
        }

        console.log('Structure confirmed, switching to sequence screen');
        // Haptic feedback
        this.vibrate([30, 50, 30]);
        this.showScreen('sequenceScreen');
    }

    // Game Sequence
    loadSequenceList() {
        if (!this.selectedStructure) {
            this.showScreen('teamScreen');
            return;
        }
        
        const container = document.getElementById('sequenceList');
        
        container.innerHTML = this.selectedStructure.matches.map((match, index) => {
            const team1Display = this.formatTeamWithColors(match.team1);
            const team2Display = this.formatTeamWithColors(match.team2);
            return `
                <div class="sequence-item">
                    <div class="sequence-number">Round ${index + 1}</div>
                    <div class="team-display">
                        <div class="team-players">
                            ${team1Display}
                        </div>
                        <span class="vs">VS</span>
                        <div class="team-players">
                            ${team2Display}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    startGames() {
        if (!this.selectedStructure) {
            this.showScreen('teamScreen');
            return;
        }
        this.currentGameIndex = 0;
        this.showScreen('matchScreen'); // Make sure we're on the match screen
        this.saveCurrentGameState(); // Save the state when starting games
        this.showCurrentMatch();
    }

    showCurrentMatch() {
        if (!this.selectedStructure || !this.selectedStructure.matches[this.currentGameIndex]) {
            this.showScreen('sequenceScreen');
            return;
        }
        
        const match = this.selectedStructure.matches[this.currentGameIndex];
        
        document.getElementById('currentGameNumber').textContent = this.currentGameIndex + 1;
        document.getElementById('totalGames').textContent = this.selectedStructure.matches.length;
        
        const team1Name = this.teamGenerator.formatTeamName(match.team1);
        const team2Name = this.teamGenerator.formatTeamName(match.team2);

        const team1Display = this.formatTeamWithColors(match.team1);
        const team2Display = this.formatTeamWithColors(match.team2);
        document.getElementById('team1Display').innerHTML = team1Display;
        document.getElementById('team2Display').innerHTML = team2Display;
        document.getElementById('team1ScoreLabel').textContent = `${team1Name} Score (Full Time)`;
        document.getElementById('team2ScoreLabel').textContent = `${team2Name} Score (Full Time)`;
        
        // Reset score inputs
        document.getElementById('team1Score').value = 0;
        document.getElementById('team2Score').value = 0;
        
        // Reset extra time and penalties
        const extraTimeCheckbox = document.getElementById('wentToExtraTime');
        const penaltiesCheckbox = document.getElementById('wentToPenalties');
        if (extraTimeCheckbox) {
            extraTimeCheckbox.checked = false;
            document.getElementById('extraTimeScores').style.display = 'none';
            document.getElementById('team1ExtraTimeScore').value = 0;
            document.getElementById('team2ExtraTimeScore').value = 0;
            
            // Add event listener to auto-fill extra time with full time scores when checkbox is checked
            // Remove old listener if exists and add new one
            const newExtraTimeHandler = () => {
                if (extraTimeCheckbox.checked) {
                    // Auto-fill with current full time scores as starting point
                    const currentTeam1Score = parseInt(document.getElementById('team1Score').value) || 0;
                    const currentTeam2Score = parseInt(document.getElementById('team2Score').value) || 0;
                    document.getElementById('team1ExtraTimeScore').value = currentTeam1Score;
                    document.getElementById('team2ExtraTimeScore').value = currentTeam2Score;
                }
            };
            
            // Remove old listener if exists
            extraTimeCheckbox.removeEventListener('change', this._extraTimeAutoFillHandler);
            // Store reference and add new listener
            this._extraTimeAutoFillHandler = newExtraTimeHandler;
            extraTimeCheckbox.addEventListener('change', this._extraTimeAutoFillHandler);
        }
        if (penaltiesCheckbox) {
            penaltiesCheckbox.checked = false;
            document.getElementById('penaltiesScores').style.display = 'none';
            document.getElementById('team1PenaltiesScore').value = 0;
            document.getElementById('team2PenaltiesScore').value = 0;
        }
        
        // Show extra time and penalties sections (they're hidden by default, shown when needed)
        document.getElementById('extraTimeSection').style.display = 'block';
        document.getElementById('penaltiesSection').style.display = 'block';
        
        this.currentMatch = match;
        this.showScreen('matchScreen');
    }

    // Match Recording
    async recordScore() {
        const team1Score = parseInt(document.getElementById('team1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('team2Score').value) || 0;

        if (!this.currentMatch) return;

        // Get extra time scores if applicable
        // Extra time scores should be cumulative (full time + extra time goals)
        const wentToExtraTime = document.getElementById('wentToExtraTime').checked;
        let team1ExtraTimeScore = null;
        let team2ExtraTimeScore = null;
        if (wentToExtraTime) {
            // User enters the total score after extra time (cumulative)
            team1ExtraTimeScore = parseInt(document.getElementById('team1ExtraTimeScore').value) || 0;
            team2ExtraTimeScore = parseInt(document.getElementById('team2ExtraTimeScore').value) || 0;
        }

        // Get penalties scores if applicable
        const wentToPenalties = document.getElementById('wentToPenalties').checked;
        let team1PenaltiesScore = null;
        let team2PenaltiesScore = null;
        if (wentToPenalties) {
            team1PenaltiesScore = parseInt(document.getElementById('team1PenaltiesScore').value) || 0;
            team2PenaltiesScore = parseInt(document.getElementById('team2PenaltiesScore').value) || 0;
        }

        const { team1, team2 } = this.currentMatch;
        const matchIndex = this.currentGameIndex;
        
        const savedMatch = await this.matchRecorder.recordMatch(
            team1, 
            team2, 
            team1Score, 
            team2Score,
            team1ExtraTimeScore,
            team2ExtraTimeScore,
            team1PenaltiesScore,
            team2PenaltiesScore
        );
        
        if (savedMatch) {
            // Track last recorded match for undo
            this.lastRecordedMatch = { match: savedMatch, gameIndex: matchIndex };

            // Reset score inputs
            document.getElementById('team1Score').value = 0;
            document.getElementById('team2Score').value = 0;
            this.updatePlayedDates();
            this.renderCustomStatsSection();
            
            this.currentGameIndex++;
            this.saveCurrentGameState(); // Save the state after recording match
            
            if (this.selectedStructure && this.currentGameIndex < this.selectedStructure.matches.length) {
                this.showCurrentMatch();
            } else {
                // All games completed - reset to first match for replay
                this.currentGameIndex = 0;
                this.showCurrentMatch();
            }
        } else {
            this.toastManager.error('Error recording match result');
        }
    }

    // By Date / Custom Stats helpers
    initializeByDatePanel() {
        const closeBtn = document.getElementById('closeByDatePanel');
        const applyBtn = document.getElementById('applyByDateBtn');
        const clearBtn = document.getElementById('clearByDateBtn');
        const listContainer = document.getElementById('byDateList');
        const fromInput = document.getElementById('byDateFrom');
        const toInput = document.getElementById('byDateTo');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleByDatePanel(false));
        }
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyByDateFilter());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearByDateFilter());
        }

        if (listContainer) {
            this.renderByDateList(listContainer);
        }

        if (fromInput) {
            fromInput.addEventListener('change', (e) => {
                this.currentByDateFilter.from = e.target.value || null;
                this.currentByDateFilter.selectedDate = null;
            });
        }
        if (toInput) {
            toInput.addEventListener('change', (e) => {
                this.currentByDateFilter.to = e.target.value || null;
                this.currentByDateFilter.selectedDate = null;
            });
        }
    }

    toggleByDatePanel(show = false) {
        const panel = document.getElementById('byDatePanel');
        if (!panel) return;
        panel.style.display = show ? 'block' : 'none';
        if (show) {
            const listContainer = document.getElementById('byDateList');
            if (listContainer) {
                this.renderByDateList(listContainer);
            }
        }
    }

    updatePlayedDates() {
        const allMatches = this.statisticsTracker.getAllMatches();
        const dateSet = new Set();
        allMatches.forEach(match => {
            if (match && match.timestamp) {
                const dateKey = new Date(match.timestamp).toISOString().split('T')[0];
                dateSet.add(dateKey);
            }
        });
        this.playedDates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));

        const listContainer = document.getElementById('byDateList');
        const panel = document.getElementById('byDatePanel');
        if (panel && panel.style.display !== 'none' && listContainer) {
            this.renderByDateList(listContainer);
        }
    }

    renderByDateList(container) {
        container.style.maxHeight = '240px';
        container.style.overflowY = 'auto';
        const dates = this.playedDates || [];
        if (dates.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h4>No Dates</h4><p>Play some matches to enable date filtering.</p></div>';
            return;
        }
        container.innerHTML = dates.map(dateStr => {
            const isSelected = this.currentByDateFilter.selectedDate === dateStr;
            return `
                <button class="by-date-pill ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                    ${dateStr}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.by-date-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.date;
                this.currentByDateFilter.selectedDate = chosen;
                this.currentByDateFilter.from = chosen;
                this.currentByDateFilter.to = chosen;
                const fromInput = document.getElementById('byDateFrom');
                const toInput = document.getElementById('byDateTo');
                if (fromInput) fromInput.value = chosen;
                if (toInput) toInput.value = chosen;
                this.renderByDateList(container);
            });
        });
    }

    clearByDateFilter() {
        this.currentByDateFilter = { from: null, to: null, selectedDate: null };
        const fromInput = document.getElementById('byDateFrom');
        const toInput = document.getElementById('byDateTo');
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
        const listContainer = document.getElementById('byDateList');
        if (listContainer) this.renderByDateList(listContainer);
        this.updateCustomFilterSummary([]);
        this.customFilterActive = false;
        this.setByDateButtonActive(false);
        this.showNormalStatsTabs();
    }

    applyByDateFilter() {
        const { selectedDate, from, to } = this.currentByDateFilter || {};
        let rangeFrom = null;
        let rangeTo = null;

        if (selectedDate) {
            rangeFrom = selectedDate;
            rangeTo = selectedDate;
        } else {
            rangeFrom = from || null;
            rangeTo = to || null;
        }

        this.currentByDateFilter = { selectedDate: selectedDate || null, from: rangeFrom, to: rangeTo };
        const matches = this.getCustomMatches();
        this.renderCustomStatsSection(matches);
        this.toggleByDatePanel(false);
    }

    // Undo last recorded match and re-show that matchup for correction
    undoLastMatch() {
        if (!this.lastRecordedMatch || !this.lastRecordedMatch.match) {
            this.toastManager.info('No match to undo');
            return;
        }

        const { match, gameIndex } = this.lastRecordedMatch;
        this.matchRecorder.deleteMatch(match.timestamp);

        // Rewind to that match in the sequence
        this.currentGameIndex = typeof gameIndex === 'number' ? gameIndex : Math.max(0, this.currentGameIndex - 1);
        this.lastRecordedMatch = null;

        // Refresh derived data
        this.updatePlayedDates();
        this.renderCustomStatsSection();
        if (this.currentScreen === 'historyScreen') {
            this.loadMatchHistory();
        }

        // Show the same matchup again for re-entry
        this.showCurrentMatch();
        this.toastManager.success('Last match removed. Re-enter the score.', 'Undo');
    }

    getCustomMatches() {
        const { from, to } = this.currentByDateFilter || {};
        if (!from && !to) return [];
        return this.statisticsTracker.getMatchesByDateRange(from, to);
    }

    getCustomFilterLabel() {
        const { from, to } = this.currentByDateFilter || {};
        if (!from && !to) return 'No date selected';
        if (from && to) {
            if (from === to) return `Date: ${from}`;
            return `From ${from} to ${to}`;
        }
        if (from) return `From ${from}`;
        return `Up to ${to}`;
    }

    updateCustomFilterSummary(matches = []) {
        const summary = document.getElementById('customFilterSummary');
        if (!summary) return;
        const { from, to } = this.currentByDateFilter || {};
        if (!from && !to) {
            summary.textContent = 'Select a date from the By Date panel to view custom stats.';
            return;
        }
        const label = this.getCustomFilterLabel();
        const count = matches ? matches.length : 0;
        summary.textContent = `${label} • ${count} match${count === 1 ? '' : 'es'}`;
    }

    getActiveStatsTab() {
        const select = document.getElementById('statsTabSelect');
        if (select && select.value) return select.value;
        return 'today';
    }

    setByDateButtonActive(active = false) {
        const btn = document.getElementById('byDateStatsBtn');
        if (!btn) return;
        btn.classList.toggle('by-date-active', active);
        if (active) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
        } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        }
    }

    renderCustomStatsSection(matchesOverride = null) {
        const section = document.getElementById('customStats');
        if (!section) return;
        const matches = matchesOverride || this.getCustomMatches();
        this.updateCustomFilterSummary(matches);

        if (!matches || matches.length === 0) {
            this.customFilterActive = false;
            section.style.display = 'none';
            this.setByDateButtonActive(false);
            this.showNormalStatsTabs();
            return;
        }

        this.customFilterActive = true;
        this.lastStatsTab = this.getActiveStatsTab();
        // Clear tab button active states so only By Date indicates active filter
        const statsTabSelect = document.getElementById('statsTabSelect');
        if (statsTabSelect) {
            statsTabSelect.value = '';
        }

        // Hide normal stats panels while filter is active
        const todayStats = document.getElementById('todayStats');
        const seasonStats = document.getElementById('seasonStats');
        const overallStats = document.getElementById('overallStats');
        if (todayStats) todayStats.style.display = 'none';
        if (seasonStats) seasonStats.style.display = 'none';
        if (overallStats) overallStats.style.display = 'none';
        if (todayStats) todayStats.classList.remove('active');
        if (seasonStats) seasonStats.classList.remove('active');
        if (overallStats) overallStats.classList.remove('active');

        // Show filtered stats
        section.style.display = 'block';
        section.classList.add('active');
        const defaultGroup = this.currentStatsState.custom?.category || STAT_GROUPS[0]?.key || 'overview';
        this.renderCategoryTabs('custom', defaultGroup);
        this.switchStatsCategory('custom', defaultGroup);
        this.setByDateButtonActive(true);
    }

    showNormalStatsTabs() {
        this.customFilterActive = false;
        const customStats = document.getElementById('customStats');
        if (customStats) {
            customStats.style.display = 'none';
            customStats.classList.remove('active');
        }
        const todayStats = document.getElementById('todayStats');
        const seasonStats = document.getElementById('seasonStats');
        const overallStats = document.getElementById('overallStats');
        if (todayStats) todayStats.style.display = '';
        if (seasonStats) seasonStats.style.display = '';
        if (overallStats) overallStats.style.display = '';
        if (todayStats) todayStats.classList.remove('active');
        if (seasonStats) seasonStats.classList.remove('active');
        if (overallStats) overallStats.classList.remove('active');

        const targetTab = this.lastStatsTab || 'today';
        this.setByDateButtonActive(false);
        this.switchStatsTab(targetTab);
    }

    // Statistics
    loadStatistics() {
        if (this.customFilterActive) {
            this.renderCustomStatsSection();
            return;
        }
        const select = document.getElementById('statsTabSelect');
        const targetTab = select ? select.value : 'today';
        this.switchStatsTab(targetTab || 'today');
    }

    switchStatsTab(tab) {
        const select = document.getElementById('statsTabSelect');
        if (select) {
            select.value = tab;
        }
        
        console.log('Switching to stats tab:', tab);

        const seasonStats = document.getElementById('seasonStats');
        const overallStats = document.getElementById('overallStats');
        const todayStats = document.getElementById('todayStats');
        const customStats = document.getElementById('customStats');

        if (todayStats) todayStats.style.display = tab === 'today' ? '' : 'none';
        if (seasonStats) seasonStats.style.display = tab === 'season' ? '' : 'none';
        if (overallStats) overallStats.style.display = tab === 'overall' ? '' : 'none';
        if (customStats) customStats.style.display = tab === 'custom' ? '' : 'none';

        document.getElementById('seasonStats').classList.toggle('active', tab === 'season');
        document.getElementById('overallStats').classList.toggle('active', tab === 'overall');
        document.getElementById('todayStats').classList.toggle('active', tab === 'today');
        if (customStats) {
            customStats.classList.toggle('active', tab === 'custom');
        }
        if (tab !== 'custom') {
            this.setByDateButtonActive(false);
            this.customFilterActive = false;
        }
        
        // Initialize swipe gestures for stats tabs if not already done
        this.initializeStatsTabSwipes();

        const defaultGroup = STAT_GROUPS[0]?.key || 'overview';
        if (tab === 'season') {
            this.renderCategoryTabs('season', defaultGroup);
            this.switchStatsCategory('season', defaultGroup);
        } else if (tab === 'overall') {
            this.renderCategoryTabs('overall', defaultGroup);
            this.switchStatsCategory('overall', defaultGroup);
        } else if (tab === 'today') {
            this.renderCategoryTabs('today', defaultGroup);
            this.switchStatsCategory('today', defaultGroup);
        }
        if (tab !== 'custom') {
            this.lastStatsTab = tab;
        }
    }

    switchStatsMode(mode) {
        if (!['raw', 'perGame', 'projected'].includes(mode)) {
            return;
        }
        this.statisticsTracker.setStatsMode(mode);
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Re-render current visible stats section
        if (this.customFilterActive) {
            this.renderCustomStatsSection();
        } else {
            const activeTab = this.getActiveStatsTab();
            this.switchStatsTab(activeTab || 'today');
        }
    }

    initializeStatsTabSwipes() {
        // Add swipe gestures to stats screen for tab navigation
        const statsScreen = document.getElementById('statsScreen');
        if (!statsScreen || statsScreen.swipeInitialized) return;

        const tabs = ['today', 'season', 'overall'];
        
        this.touchSwipeHandler.attach(statsScreen, {
            onSwipeLeft: () => {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) {
                    const currentIndex = tabs.indexOf(activeTab.dataset.tab);
                    if (currentIndex < tabs.length - 1) {
                        this.switchStatsTab(tabs[currentIndex + 1]);
                    }
                }
            },
            onSwipeRight: () => {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) {
                    const currentIndex = tabs.indexOf(activeTab.dataset.tab);
                    if (currentIndex > 0) {
                        this.switchStatsTab(tabs[currentIndex - 1]);
                    }
                }
            }
        });

        statsScreen.swipeInitialized = true;
    }

    initializePullToRefresh() {
        // Disable pull-to-refresh for stats screen as it's not needed
        // Stats refresh automatically when switching tabs and don't need manual refresh
        // This prevents accidental triggers when scrolling
        const statsScreen = document.getElementById('statsScreen');
        if (statsScreen) {
            statsScreen.pullRefreshInitialized = true;
        }
    }

    initializeHistoryPullToRefresh() {
        const historyScreen = document.getElementById('historyScreen');
        if (!historyScreen || historyScreen.pullRefreshInitialized) return;

        const historyContainer = historyScreen.querySelector('.match-history-list') || 
                                historyScreen.querySelector('.match-history-timeline');
        
        if (historyContainer) {
            this.touchSwipeHandler.attachPullToRefresh(historyContainer, (doneCallback) => {
                // Reload match history
                this.loadMatchHistory();
                if (this.toastManager) {
                    this.toastManager.success('History refreshed');
                }
                doneCallback();
            });
        }

        historyScreen.pullRefreshInitialized = true;
    }
    
    renderCategoryTabs(type, selectedCategory = 'all') {
        let containerId;
        if (type === 'season') {
            containerId = 'seasonCategoryTabs';
        } else if (type === 'overall') {
            containerId = 'overallCategoryTabs';
        } else if (type === 'today') {
            containerId = 'todayCategoryTabs';
        } else if (type === 'custom') {
            containerId = 'customCategoryTabs';
        } else {
            return;
        }
        const container = document.getElementById(containerId);
        if (!container) return;

        const selectId = `${containerId}Select`;
        const optionsHTML = STAT_GROUPS.map(group => `
            <option value="${group.key}" ${selectedCategory === group.key ? 'selected' : ''}>${group.label}</option>
        `).join('');
        container.innerHTML = `
            <label style="font-size: 0.9rem; margin-right: 0.35rem;">Group:</label>
            <select class="category-select" id="${selectId}" data-type="${type}" style="min-width: 160px;">
                ${optionsHTML}
            </select>
        `;
        
        const selectEl = container.querySelector('.category-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                this.switchStatsCategory(type, e.target.value);
            });
        }
    }
    
    switchStatsCategory(type, category) {
        // If in team view, re-render team table for the active tab
        if (window.currentStatsView === 'team') {
            console.log('Team view active - re-rendering team table for', type);
            // Re-render team table in the appropriate container
            setTimeout(() => {
                if (window.renderTeamTable && typeof window.renderTeamTable === 'function') {
                    window.renderTeamTable();
                }
            }, 50);
            return;
        }

        // Store current category for this type
        if (!this.currentStatsState) {
            this.currentStatsState = {};
        }
        this.currentStatsState[type] = { category, subcategory: null };
        // Update select value if it exists
        const containerId = type === 'season' ? 'seasonCategoryTabs'
            : type === 'overall' ? 'overallCategoryTabs'
            : type === 'today' ? 'todayCategoryTabs'
            : type === 'custom' ? 'customCategoryTabs'
            : null;
        if (containerId) {
            const selectEl = document.querySelector(`#${containerId} .category-select`);
            if (selectEl && selectEl.value !== category) {
                selectEl.value = category;
            }
        }
        
        const currentSeason = this.seasonManager.getCurrentSeason();
        const selectedGroup = STAT_GROUPS.find(g => g.key === category) || STAT_GROUPS[0];
        const allowedCalculatorIds = selectedGroup ? selectedGroup.calculatorIds : null;
        
        if (type === 'season') {
            this.statisticsDisplay.displaySeasonStats(
                currentSeason, 
                document.getElementById('seasonStatsDisplay'),
                null,
                null,
                allowedCalculatorIds
            );
        } else if (type === 'overall') {
            this.statisticsDisplay.displayOverallStats(
                document.getElementById('overallStatsDisplay'),
                null,
                null,
                allowedCalculatorIds
            );
        } else if (type === 'today') {
            this.statisticsDisplay.displayTodayStats(
                document.getElementById('todayStatsDisplay'),
                null,
                null,
                allowedCalculatorIds
            );
        } else if (type === 'custom') {
            const matches = this.getCustomMatches();
            this.updateCustomFilterSummary(matches);
            this.statisticsDisplay.displayCustomStats(
                matches,
                document.getElementById('customStatsDisplay'),
                null,
                null,
                allowedCalculatorIds
            );
        }
    }
    
    switchStatsSubcategory(type, category, subcategory) {
        // Subcategories are no longer used with the new grouped tabs.
        // Keep this method as a no-op for backward compatibility.
        return;
    }

    async startNewSeason() {
        if (!this.isAdmin) {
            const pin = await this.showPinModal('Enter Admin PIN', 'Enter admin PIN to start a new season:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin);
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
        }

        if (confirm('Start a new season? This will reset season statistics but keep overall statistics.')) {
            if (this.seasonManager.startNewSeason()) {
                this.updateSeasonInfo();
                this.switchStatsTab('season');
                this.toastManager.success('New season started!', 'Season Reset');
            } else {
                this.toastManager.error('Error starting new season');
            }
        }
    }

    updateSeasonInfo() {
        const season = this.seasonManager.getCurrentSeason();
        document.getElementById('currentSeasonNumber').textContent = season;
        document.getElementById('seasonInfo').style.display = 'block';
    }

    async clearAllStatistics() {
        if (!this.isAdmin) {
            const pin = await this.showPinModal('Enter Admin PIN', 'Enter admin PIN to clear all statistics:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
        }

        if (confirm('WARNING: This will delete ALL statistics, all seasons, and all match history. This cannot be undone. Continue?')) {
            if (this.storage.clearAllStatistics()) {
                alert('All statistics cleared. Players are kept.');
                this.updateSeasonInfo();
                // Reload the statistics display
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'season';
                this.switchStatsTab(currentTab);
            } else {
                this.toastManager.error('Error clearing statistics');
            }
        }
    }

    // Share statistics as image
    async shareStats(statsType) {
        try {
            // Get current category/subcategory from active tabs
            let categoryTabsId;
            if (statsType === 'today') {
                categoryTabsId = 'todayCategoryTabs';
            } else if (statsType === 'season') {
                categoryTabsId = 'seasonCategoryTabs';
            } else if (statsType === 'overall') {
                categoryTabsId = 'overallCategoryTabs';
            } else {
                categoryTabsId = 'customCategoryTabs';
            }
            
            let calculatorIds = null;
            const categoryTabs = document.getElementById(categoryTabsId);
            if (categoryTabs) {
                const selectEl = categoryTabs.querySelector('.category-select');
                const activeKey = selectEl ? selectEl.value : null;
                const selectedGroup = STAT_GROUPS.find(g => g.key === activeKey) || STAT_GROUPS[0];
                calculatorIds = selectedGroup ? selectedGroup.calculatorIds : null;
            }
            
            let customOptions = null;
            if (statsType === 'custom') {
                const matches = this.getCustomMatches();
                if (!matches || matches.length === 0) {
                    this.toastManager.warning('Select a date in the By Date panel first.');
                    return;
                }
                customOptions = {
                    customMatches: matches,
                    customLabel: this.getCustomFilterLabel()
                };
            }

            const imageDataUrl = await this.shareManager.generateStatsImage(statsType, null, null, calculatorIds, customOptions || undefined);
            const fileName = `FC25_${statsType}_${new Date().toISOString().split('T')[0]}.png`;
            
            await this.shareManager.shareImage(imageDataUrl, fileName);
        } catch (error) {
            console.error('Error sharing stats:', error);
            alert('Error generating shareable image. Please try again.');
        }
    }

    // Export statistics as PDF
    async exportPDF(statsType = null) {
        try {
            // Detect active stats tab if statsType not provided
            if (!statsType) {
                const activeTabElement = document.querySelector('.stats-content.active');
                if (activeTabElement) {
                    const tabId = activeTabElement.id;
                    if (tabId === 'todayStats') {
                        statsType = 'today';
                    } else if (tabId === 'seasonStats') {
                        statsType = 'season';
                    } else if (tabId === 'overallStats') {
                        statsType = 'overall';
                    } else if (tabId === 'customStats') {
                        statsType = 'custom';
                    }
                }
                // Fallback: check active tab button
                if (!statsType) {
                    const activeTabBtn = document.querySelector('.tab-btn.active');
                    if (activeTabBtn) {
                        statsType = activeTabBtn.dataset.tab;
                    }
                }
                // Final fallback
                if (!statsType) {
                    statsType = 'season';
                }
            }
            
            // Get current category/subcategory from active tabs
            let categoryTabsId;
            if (statsType === 'today') {
                categoryTabsId = 'todayCategoryTabs';
            } else if (statsType === 'season') {
                categoryTabsId = 'seasonCategoryTabs';
            } else if (statsType === 'overall') {
                categoryTabsId = 'overallCategoryTabs';
            } else {
                categoryTabsId = 'customCategoryTabs';
            }
            
            let calculatorIds = null;
            const categoryTabs = document.getElementById(categoryTabsId);
            if (categoryTabs) {
                const selectEl = categoryTabs.querySelector('.category-select');
                const activeKey = selectEl ? selectEl.value : null;
                const selectedGroup = STAT_GROUPS.find(g => g.key === activeKey) || STAT_GROUPS[0];
                calculatorIds = selectedGroup ? selectedGroup.calculatorIds : null;
            }
            
            let customOptions = null;
            if (statsType === 'custom') {
                const matches = this.getCustomMatches();
                if (!matches || matches.length === 0) {
                    this.toastManager.warning('Select a date in the By Date panel first.');
                    return;
                }
                customOptions = {
                    customMatches: matches,
                    customLabel: this.getCustomFilterLabel()
                };
            }

            const result = await this.shareManager.exportLeaderboardPDF(statsType, null, null, calculatorIds, customOptions || undefined);
            
            // Store PDF blob URL for viewing
            if (result && result.blobUrl) {
                try {
                    // Clean up previous PDF blob URL
                    if (this.lastPDFBlobUrl) {
                        try {
                            URL.revokeObjectURL(this.lastPDFBlobUrl);
                        } catch (e) {
                            // Ignore errors revoking old URL
                        }
                    }
                    this.lastPDFBlobUrl = result.blobUrl;
                    
                    // Show success notification
                    if (this.toastManager) {
                        this.toastManager.success(`PDF saved: ${result.fileName || 'PDF'}`, 'PDF Exported');
                    }
                    
                    // Enable view PDF button if it exists
                    this.updateViewPDFButton();
                } catch (error) {
                    console.error('Error handling PDF result:', error);
                    if (this.toastManager) {
                        this.toastManager.error('Error saving PDF. Please try again.');
                    }
                }
            } else if (result) {
                // PDF was created but might not have blobUrl, still show success
                if (this.toastManager) {
                    this.toastManager.success('PDF exported successfully', 'PDF Exported');
                }
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.toastManager.error('Error exporting PDF. Please try again.');
        }
    }

    updateViewPDFButton() {
        try {
            const viewPdfBtn = document.getElementById('viewLastPDFBtn');
            if (viewPdfBtn) {
                if (this.lastPDFBlobUrl) {
                    viewPdfBtn.disabled = false;
                    viewPdfBtn.style.opacity = '1';
                    viewPdfBtn.style.cursor = 'pointer';
                } else {
                    viewPdfBtn.disabled = true;
                    viewPdfBtn.style.opacity = '0.5';
                    viewPdfBtn.style.cursor = 'not-allowed';
                }
            }
        } catch (error) {
            console.error('Error updating view PDF button:', error);
            // Silently fail - button might not be in DOM yet
        }
    }

    viewLastPDF() {
        try {
            if (this.lastPDFBlobUrl) {
                window.open(this.lastPDFBlobUrl, '_blank');
            } else {
                if (this.toastManager) {
                    this.toastManager.error('No PDF available. Please export a PDF first.');
                } else {
                    alert('No PDF available. Please export a PDF first.');
                }
            }
        } catch (error) {
            console.error('Error viewing PDF:', error);
            if (this.toastManager) {
                this.toastManager.error('Error opening PDF. Please try again.');
            }
        }
    }

    // Share match result
    async shareMatch(timestamp) {
        try {
            const matchInfo = this.matchRecorder.findMatch(timestamp);
            if (!matchInfo) {
                this.toastManager.error('Match not found');
                return;
            }
            
            const data = this.storage.getData();
            const match = data.seasons[matchInfo.season].matches[matchInfo.index];
            
            const imageDataUrl = await this.shareManager.generateMatchImage(match);
            const dateStr = new Date(match.timestamp).toISOString().split('T')[0];
            const fileName = `FC25_Match_${dateStr}.png`;
            
            await this.shareManager.shareImage(imageDataUrl, fileName);
        } catch (error) {
            console.error('Error sharing match:', error);
            alert('Error generating shareable image. Please try again.');
        }
    }

    // Match History
    setHistoryQuickFilter(filter = 'all') {
        const select = document.getElementById('historyFilter');
        if (select) {
            select.value = ['all', 'current', 'today'].includes(filter) ? filter : 'all';
        }
        // Clear other filters for quick taps
        const search = document.getElementById('historySearch');
        const from = document.getElementById('historyDateFrom');
        const to = document.getElementById('historyDateTo');
        if (search) search.value = '';
        if (from) from.value = '';
        if (to) to.value = '';

        this.updateHistoryQuickFilterButtons(filter);
        this.loadMatchHistory();
    }

    updateHistoryQuickFilterButtons(activeFilter = 'all') {
        document.querySelectorAll('.history-quick-btn').forEach(btn => {
            const matches = (btn.dataset.filter || 'all') === activeFilter;
            btn.classList.toggle('active', matches);
        });
    }

    loadMatchHistory() {
        const listContainer = document.getElementById('matchHistoryList');
        const timelineContainer = document.getElementById('matchHistoryTimeline');
        if (!listContainer || !timelineContainer) return;

        // Sync sort order from UI control (if present)
        const sortOrderSelect = document.getElementById('historySortOrder');
        if (sortOrderSelect) {
            this.historySortOrder = sortOrderSelect.value === 'asc' ? 'asc' : 'desc';
        }

        const filter = document.getElementById('historyFilter').value;
        this.updateHistoryQuickFilterButtons(filter);
        const search = document.getElementById('historySearch').value.toLowerCase();
        const dateFrom = document.getElementById('historyDateFrom').value;
        const dateTo = document.getElementById('historyDateTo').value;

        let allMatches = [];

        if (filter === 'today') {
            allMatches = this.statisticsTracker.getTodayMatches();
        } else if (filter === 'current') {
            const currentSeason = this.seasonManager.getCurrentSeason();
            allMatches = this.statisticsTracker.getSeasonMatches(currentSeason);
        } else {
            allMatches = this.statisticsTracker.getAllMatches();
        }

        // Filter by date range
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            allMatches = allMatches.filter(match => {
                const matchDate = new Date(match.timestamp);
                matchDate.setHours(0, 0, 0, 0);
                return matchDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            allMatches = allMatches.filter(match => {
                const matchDate = new Date(match.timestamp);
                return matchDate <= toDate;
            });
        }

        // Filter by search term
        if (search) {
            allMatches = allMatches.filter(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const allPlayers = [...team1Players, ...team2Players];
                return allPlayers.some(p => p.toLowerCase().includes(search));
            });
        }

        // Sort by date (toggleable for list, chronological for timeline)
        if (this.currentHistoryView === 'timeline') {
            allMatches.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } else {
            const order = this.historySortOrder === 'asc' ? 'asc' : 'desc';
            allMatches.sort((a, b) => order === 'asc'
                ? new Date(a.timestamp) - new Date(b.timestamp)
                : new Date(b.timestamp) - new Date(a.timestamp));
        }

        // Show quick stats if filters are active
        this.renderFilterStats(allMatches, filter, search, dateFrom, dateTo);

        if (allMatches.length === 0) {
            const emptyMessage = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Matches Found</h3><p>Try adjusting your filters or start recording matches!</p></div>';
            listContainer.innerHTML = emptyMessage;
            timelineContainer.innerHTML = emptyMessage;
            return;
        }

        if (this.currentHistoryView === 'timeline') {
            this.renderTimelineView(allMatches, timelineContainer, search);
        } else {
            this.renderListView(allMatches, listContainer, search);
        }
    }

    renderFilterStats(matches, filter, search, dateFrom, dateTo) {
        // Check if any filters are active
        const hasFilters = filter !== 'all' || search || dateFrom || dateTo;
        if (!hasFilters || matches.length === 0) {
            // Remove existing filter stats if any
            const existingStats = document.getElementById('historyFilterStats');
            if (existingStats) {
                existingStats.remove();
            }
            return;
        }

        // Calculate quick stats for filtered matches
        if (!this.playerManager) return; // Safety check
        const players = this.playerManager.getPlayers();
        if (!players || players.length === 0) return; // Safety check
        const playerStats = {};
        let totalGoals = 0;
        
        players.forEach(player => {
            let wins = 0, losses = 0, draws = 0, goals = 0;
            matches.forEach(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                const inTeam1 = team1Players.includes(player);
                const inTeam2 = team2Players.includes(player);
                
                if (inTeam1 || inTeam2) {
                    if (inTeam1) goals += (match.team1Score || 0);
                    if (inTeam2) goals += (match.team2Score || 0);
                    totalGoals += (match.team1Score || 0) + (match.team2Score || 0);
                    
                    if (match.result === 'draw') {
                        draws++;
                    } else if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                        wins++;
                    } else {
                        losses++;
                    }
                }
            });
            
            if (wins + losses + draws > 0) {
                playerStats[player] = {
                    wins, losses, draws, goals,
                    games: wins + losses + draws,
                    winRate: ((wins / (wins + losses + draws)) * 100).toFixed(1)
                };
            }
        });

        // Create or update filter stats display
        let statsContainer = document.getElementById('historyFilterStats');
        if (!statsContainer) {
            const historyScreen = document.getElementById('historyScreen');
            if (!historyScreen) return; // Safety check
            
            const controls = historyScreen.querySelector('.history-controls');
            if (!controls) return; // Safety check
            
            statsContainer = document.createElement('div');
            statsContainer.id = 'historyFilterStats';
            statsContainer.className = 'history-filter-stats';
            controls.insertAdjacentElement('afterend', statsContainer);
        }

        // Build active filters display
        const activeFilters = [];
        if (filter !== 'all') {
            activeFilters.push(`Season: ${filter === 'today' ? 'Today' : 'Current'}`);
        }
        if (dateFrom) {
            activeFilters.push(`From: ${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
        }
        if (dateTo) {
            activeFilters.push(`To: ${new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
        }
        if (search) {
            activeFilters.push(`Search: "${search}"`);
        }

        const sortedPlayers = Object.entries(playerStats).sort((a, b) => {
            return parseFloat(b[1].winRate) - parseFloat(a[1].winRate);
        });

        statsContainer.innerHTML = `
            <div class="filter-stats-header">
                <span class="filter-stats-title">📊 Quick Stats (${matches.length} match${matches.length !== 1 ? 'es' : ''})</span>
                ${activeFilters.length > 0 ? `
                    <div class="active-filters">
                        ${activeFilters.map(f => `<span class="filter-badge">${this.escapeHtml(f)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            ${sortedPlayers.length > 0 ? `
                <div class="filter-stats-content">
                    ${sortedPlayers.slice(0, 4).map(([player, stats]) => {
                        const playerColor = (this.settingsManager && this.settingsManager.getPlayerColor) ? (this.settingsManager.getPlayerColor(player) || '#2196F3') : '#2196F3';
                        return `
                            <div class="filter-stat-item">
                                <span class="filter-stat-name" style="color: ${playerColor}; font-weight: 600;">${this.escapeHtml(player)}</span>
                                <span class="filter-stat-values">
                                    <span class="filter-stat-value">${stats.winRate}%</span>
                                    <span class="filter-stat-separator">•</span>
                                    <span class="filter-stat-value">${stats.wins}W</span>
                                    <span class="filter-stat-separator">•</span>
                                    <span class="filter-stat-value">${stats.goals}G</span>
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
        `;
    }

    showTeamDetails(teamPlayers) {
        // #region agent log
        fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                location: 'src/app-controller.js:showTeamDetails',
                message: 'showTeamDetails called',
                data: { teamPlayers },
                timestamp: Date.now(),
                sessionId: 'debug-session'
            })
        }).catch(() => {});
        // #endregion

        // Update title and subtitle
        const teamName = teamPlayers.length === 1 ? teamPlayers[0] : teamPlayers.join(' & ');
        document.getElementById('teamDetailsTitle').textContent = teamName;
        document.getElementById('teamDetailsSubtitle').textContent = `Match history for ${teamName}`;

        // Get all matches
        const allMatches = this.statisticsTracker.getAllMatches();
        
        // Filter matches for this team/partnership
        const teamMatches = this.filterMatchesForTeam(allMatches, teamPlayers);
        
        // Sort matches by timestamp (oldest first) to assign game numbers
        teamMatches.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Assign game numbers (1, 2, 3, etc.) starting from the first match
        teamMatches.forEach((match, index) => {
            match.gameNumber = index + 1;
        });
        
        // Store total games count before reversing
        const totalGames = teamMatches.length;
        
        // Reverse to show most recent first for display
        teamMatches.reverse();
        
        // Pass total games to render function
        this.renderTeamDetailsMatches(teamMatches, teamPlayers, totalGames);
        
        // Show the team details screen
        this.showScreen('teamDetailsScreen');
    }

    filterMatchesForTeam(matches, teamPlayers) {
        // #region agent log
        fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                location: 'src/app-controller.js:filterMatchesForTeam',
                message: 'filterMatchesForTeam called',
                data: { teamPlayers, matchesCount: matches.length },
                timestamp: Date.now(),
                sessionId: 'debug-session'
            })
        }).catch(() => {});
        // #endregion

        // Strict partnership filtering: Only show matches where Player A, Player B, or both are on the SAME team
        const filtered = [];
        const [playerA, playerB] = teamPlayers; // Get the two partnership players
        
        for (const match of matches) {
            const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
            const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
            
            // Check if both players are together on the same team
            const team1HasBoth = team1.includes(playerA) && team1.includes(playerB);
            const team2HasBoth = team2.includes(playerA) && team2.includes(playerB);
            
            // Check if players are on opposite teams (both present but split)
            const playerAInTeam1 = team1.includes(playerA);
            const playerAInTeam2 = team2.includes(playerA);
            const playerBInTeam1 = team1.includes(playerB);
            const playerBInTeam2 = team2.includes(playerB);
            const playersOnOppositeTeams = (playerAInTeam1 && playerBInTeam2) || (playerAInTeam2 && playerBInTeam1);
            
            // Exclude if players are on opposite teams (head-to-head, not partnership match)
            if (playersOnOppositeTeams) {
                continue;
            }
            
            // Check for solo matches - one player from partnership playing solo (team size = 1)
            // This includes both true solo matches and Ghost Proxy matches (where partner was absent)
            // The team stats aggregation system merges solo teams into partnership teams, so all solo matches count
            const team1HasAOnly = team1.includes(playerA) && !team1.includes(playerB) && team1.length === 1;
            const team2HasAOnly = team2.includes(playerA) && !team2.includes(playerB) && team2.length === 1;
            const team1HasBOnly = team1.includes(playerB) && !team1.includes(playerA) && team1.length === 1;
            const team2HasBOnly = team2.includes(playerB) && !team2.includes(playerA) && team2.length === 1;
            
            // #region agent log
            fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    location: 'src/app-controller.js:filterMatchesForTeam',
                    message: 'filterMatchesForTeam - match analysis',
                    data: { 
                        team1,
                        team2,
                        team1HasBoth,
                        team2HasBoth,
                        team1HasAOnly,
                        team2HasAOnly,
                        team1HasBOnly,
                        team2HasBOnly,
                        playersOnOppositeTeams
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session'
                })
            }).catch(() => {});
            // #endregion
            
            // Include if:
            // 1. Both players together on same team (Full Team)
            // 2. One player solo (team size = 1) - includes both true solo and Ghost Proxy matches
            //    This aligns with team stats aggregation which merges solo teams into partnership teams
            if (team1HasBoth || team2HasBoth || team1HasAOnly || team2HasAOnly || team1HasBOnly || team2HasBOnly) {
                filtered.push(match);
            }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                location: 'src/app-controller.js:filterMatchesForTeam',
                message: 'filterMatchesForTeam completed',
                data: { filteredCount: filtered.length },
                timestamp: Date.now(),
                sessionId: 'debug-session'
            })
        }).catch(() => {});
        // #endregion
        
        return filtered;
    }

    classifyMatch(match, teamPlayers) {
        // #region agent log
        fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                location: 'src/app-controller.js:classifyMatch',
                message: 'classifyMatch called',
                data: { 
                    teamPlayers,
                    team1: match.team1,
                    team2: match.team2,
                    result: match.result
                },
                timestamp: Date.now(),
                sessionId: 'debug-session'
            })
        }).catch(() => {});
        // #endregion

        const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
        const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
        const [playerA, playerB] = teamPlayers;
        
        // Check if both players are together on the same team (Full Team)
        // This includes 2v2, 2v1, etc. - as long as both A and B are together, it's "Full Team"
        const team1HasBoth = team1.includes(playerA) && team1.includes(playerB);
        const team2HasBoth = team2.includes(playerA) && team2.includes(playerB);
        const bothPresent = team1HasBoth || team2HasBoth;
        
        // Check for Ghost Proxy matches - one player solo but other was absent (still counts as Full Team)
        const matchPresence = match.playerPresence || {};
        const playerAAbsent = matchPresence[playerA] === false;
        const playerBAbsent = matchPresence[playerB] === false;
        
        // Solo matches where the other partner was absent (Ghost Proxy system)
        const team1HasSoloAWithAbsentB = team1.includes(playerA) && !team1.includes(playerB) && team1.length === 1 && playerBAbsent;
        const team2HasSoloAWithAbsentB = team2.includes(playerA) && !team2.includes(playerB) && team2.length === 1 && playerBAbsent;
        const team1HasSoloBWithAbsentA = team1.includes(playerB) && !team1.includes(playerA) && team1.length === 1 && playerAAbsent;
        const team2HasSoloBWithAbsentA = team2.includes(playerB) && !team2.includes(playerA) && team2.length === 1 && playerAAbsent;
        
        const isGhostProxy = team1HasSoloAWithAbsentB || team2HasSoloAWithAbsentB || team1HasSoloBWithAbsentA || team2HasSoloBWithAbsentA;
        
        if (bothPresent || isGhostProxy) {
            // Full Team match - both players together OR one solo with other absent (Ghost Proxy)
            const isTeam1 = team1HasBoth || team1HasSoloAWithAbsentB || team1HasSoloBWithAbsentA;
            let result = 'Draw';
            if (match.result === 'team1' && isTeam1) {
                result = 'Win';
            } else if (match.result === 'team2' && !isTeam1) {
                result = 'Win';
            } else if (match.result === 'team1' && !isTeam1) {
                result = 'Loss';
            } else if (match.result === 'team2' && isTeam1) {
                result = 'Loss';
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    location: 'src/app-controller.js:classifyMatch',
                    message: 'classifyMatch - full team match',
                    data: { type: 'team', result, isTeam1, isGhostProxy },
                    timestamp: Date.now(),
                    sessionId: 'debug-session'
                })
            }).catch(() => {});
            // #endregion
            
            return { type: 'team', result, soloPlayer: null };
        } else {
            // Solo match - only one player from partnership played AND they are truly alone (team size = 1)
            // AND the other partner was NOT marked absent (true solo, not Ghost Proxy)
            const team1HasAOnly = team1.includes(playerA) && !team1.includes(playerB) && team1.length === 1;
            const team2HasAOnly = team2.includes(playerA) && !team2.includes(playerB) && team2.length === 1;
            const team1HasBOnly = team1.includes(playerB) && !team1.includes(playerA) && team1.length === 1;
            const team2HasBOnly = team2.includes(playerB) && !team2.includes(playerA) && team2.length === 1;
            
            let soloPlayer = null;
            let isTeam1 = false;
            
            if (team1HasAOnly || team2HasAOnly) {
                soloPlayer = playerA;
                isTeam1 = team1HasAOnly;
            } else if (team1HasBOnly || team2HasBOnly) {
                soloPlayer = playerB;
                isTeam1 = team1HasBOnly;
            }
            
            if (soloPlayer) {
                // Calculate result based on which team the solo player was on
                let result = 'Draw';
                if (match.result === 'team1' && isTeam1) {
                    result = 'Win';
                } else if (match.result === 'team2' && !isTeam1) {
                    result = 'Win';
                } else if (match.result === 'team1' && !isTeam1) {
                    result = 'Loss';
                } else if (match.result === 'team2' && isTeam1) {
                    result = 'Loss';
                }
                
                // #region agent log
                fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        location: 'src/app-controller.js:classifyMatch',
                        message: 'classifyMatch - solo match',
                        data: { type: 'solo', result, soloPlayer, isTeam1 },
                        timestamp: Date.now(),
                        sessionId: 'debug-session'
                    })
                }).catch(() => {});
                // #endregion
                
                return { type: 'solo', result, soloPlayer };
            }
        }
        
        return { type: 'unknown', result: 'Unknown', soloPlayer: null };
    }

    renderTeamDetailsMatches(matches, teamPlayers, totalGames = null) {
        // #region agent log
        fetch('http://127.0.0.1:7249/ingest/12f9232d-c1a6-4b9d-9176-f23ba151eb7a', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                location: 'src/app-controller.js:renderTeamDetailsMatches',
                message: 'renderTeamDetailsMatches called',
                data: { matchesCount: matches.length },
                timestamp: Date.now(),
                sessionId: 'debug-session'
            })
        }).catch(() => {});
        // #endregion

        const container = document.getElementById('teamDetailsMatchList');
        if (!container) return;
        
        if (matches.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No matches found for this team.</p></div>';
            return;
        }
        
        const teamName = teamPlayers.length === 1 ? teamPlayers[0] : teamPlayers.join(' & ');
        
        container.innerHTML = matches.map(match => {
            const classification = this.classifyMatch(match, teamPlayers);
            const team1 = Array.isArray(match.team1) ? match.team1 : [match.team1];
            const team2 = Array.isArray(match.team2) ? match.team2 : [match.team2];
            const [playerA, playerB] = teamPlayers;
            
            // Determine which team the partnership was on (consistent with classifyMatch logic)
            // Check if both players are together on the same team (Full Team - works for 2v2, 2v1, etc.)
            const team1HasBoth = team1.includes(playerA) && team1.includes(playerB);
            const team2HasBoth = team2.includes(playerA) && team2.includes(playerB);
            
            // Check if only one player is present (Solo)
            const team1HasA = team1.includes(playerA) && !team1.includes(playerB);
            const team2HasA = team2.includes(playerA) && !team2.includes(playerB);
            const team1HasB = team1.includes(playerB) && !team1.includes(playerA);
            const team2HasB = team2.includes(playerB) && !team2.includes(playerA);
            
            // Determine which team the partnership player(s) were on
            const isTeam1 = team1HasBoth || team1HasA || team1HasB;
            const ourTeam = isTeam1 ? team1 : team2;
            const opponentTeam = isTeam1 ? team2 : team1;
            
            // Format opponent names with " & " separator
            const opponentNames = opponentTeam.map(p => this.formatPlayerNameWithColor(p)).join(' & ');
            
            // Format date
            const date = new Date(match.timestamp);
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Format score
            const ourScore = isTeam1 ? (match.team1Score || 0) : (match.team2Score || 0);
            const opponentScore = isTeam1 ? (match.team2Score || 0) : (match.team1Score || 0);
            
            // Extra time and penalties
            const hasExtra = match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined;
            const hasPens = match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined;
            
            // Classification label
            let classificationLabel = '';
            if (classification.type === 'team') {
                classificationLabel = `Full Team ${classification.result}`;
            } else if (classification.type === 'solo') {
                classificationLabel = `${classification.soloPlayer} Solo ${classification.result}`;
            }
            
            // Result badge color
            let resultClass = '';
            if (classification.result === 'Win') {
                resultClass = 'team-win';
            } else if (classification.result === 'Loss') {
                resultClass = 'team-loss';
            } else {
                resultClass = 'team-draw';
            }
            
            // Get game number (assigned during sorting in showTeamDetails)
            const gameNumber = match.gameNumber !== undefined ? match.gameNumber : 0;
            const totalGamesCount = totalGames !== null ? totalGames : matches.length;
            
            return `
                <div class="team-details-match-item">
                    <div class="team-details-match-header">
                        <span class="team-details-classification ${resultClass}">${classificationLabel}</span>
                        <span class="team-details-date-game">
                            <span class="team-details-date">${dateStr}</span>
                            <span class="team-details-game-number">Game ${gameNumber} / ${totalGamesCount}</span>
                        </span>
                    </div>
                    <div class="team-details-match-content">
                        <div class="team-details-teams">
                            <span class="team-details-our-team">${teamName}</span>
                            <span class="team-details-vs">vs</span>
                            <span class="team-details-opponent">${opponentNames}</span>
                        </div>
                        <div class="team-details-score">
                            <span class="team-details-score-value ${classification.result === 'Win' ? 'winning' : ''}">${ourScore}</span>
                            <span class="team-details-score-sep">-</span>
                            <span class="team-details-score-value ${classification.result === 'Loss' ? 'winning' : ''}">${opponentScore}</span>
                            ${hasExtra ? `<span class="team-details-tag">ET ${isTeam1 ? match.team1ExtraTimeScore : match.team2ExtraTimeScore}-${isTeam1 ? match.team2ExtraTimeScore : match.team1ExtraTimeScore}</span>` : ''}
                            ${hasPens ? `<span class="team-details-tag">Pens ${isTeam1 ? match.team1PenaltiesScore : match.team2PenaltiesScore}-${isTeam1 ? match.team2PenaltiesScore : match.team1PenaltiesScore}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderListView(matches, container, searchTerm = '') {
        container.innerHTML = matches.map(match => {
            let team1Display = this.formatTeamWithColors(match.team1);
            let team2Display = this.formatTeamWithColors(match.team2);
            
            // Highlight search terms if present
            if (searchTerm) {
                team1Display = this.highlightSearchTerm(team1Display, searchTerm);
                team2Display = this.highlightSearchTerm(team2Display, searchTerm);
            }
            
            const date = new Date(match.timestamp);
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const hasExtra = match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined;
            const hasPens = match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined;

            const scoreLine = `
                <div class="match-history-score-line">
                    <span class="match-history-score">${match.team1Score || 0}</span>
                    <span class="match-history-score-sep">-</span>
                    <span class="match-history-score">${match.team2Score || 0}</span>
                    ${hasExtra ? `<span class="match-history-tag">ET ${match.team1ExtraTimeScore}-${match.team2ExtraTimeScore}</span>` : ''}
                    ${hasPens ? `<span class="match-history-tag">Pens ${match.team1PenaltiesScore}-${match.team2PenaltiesScore}</span>` : ''}
                </div>
            `;

            return `
                <div class="match-history-item compact" data-timestamp="${match.timestamp}">
                    <div class="match-history-header">
                        <div class="match-history-main">
                            <div class="match-history-teams">${team1Display} vs ${team2Display}</div>
                            ${scoreLine}
                            <div class="match-history-date">${dateStr}</div>
                        </div>
                        <button class="match-history-toggle" aria-expanded="false" aria-label="Show details">▾</button>
                    </div>
                    <div class="match-history-details" hidden>
                        <div class="match-history-actions">
                            <button class="match-history-btn share" data-timestamp="${match.timestamp}" title="Share Match">📤</button>
                            <button class="match-history-btn edit" data-timestamp="${match.timestamp}">Edit</button>
                            <button class="match-history-btn delete" data-timestamp="${match.timestamp}">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Toggle details
        container.querySelectorAll('.match-history-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.match-history-item');
                const details = item ? item.querySelector('.match-history-details') : null;
                const isOpen = item ? item.classList.toggle('expanded') : false;
                if (details) details.hidden = !isOpen;
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });

        this.attachHistoryEventListeners(container);
        
        // Add swipe-to-delete functionality to list items
        container.querySelectorAll('.match-history-item').forEach(item => {
            const deleteBtn = item.querySelector('.match-history-btn.delete');
            if (deleteBtn) {
                const timestamp = deleteBtn.dataset.timestamp;
                this.touchSwipeHandler.attachSwipeToDelete(item, () => {
                    this.confirmDeleteMatch(timestamp);
                });
            }
        });
    }

    renderTimelineView(matches, container, searchTerm = '') {
        // Group matches by date
        const matchesByDate = {};
        matches.forEach(match => {
            const date = new Date(match.timestamp);
            const dateKey = date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!matchesByDate[dateKey]) {
                matchesByDate[dateKey] = [];
            }
            matchesByDate[dateKey].push(match);
        });

        // Sort date entries chronologically for cumulative calculations
        const sortedDateEntries = Object.entries(matchesByDate).sort((a, b) => {
            const dateA = new Date(a[0]);
            const dateB = new Date(b[0]);
            return dateA - dateB;
        });
        const timelineOrder = this.historySortOrder === 'asc' ? 'asc' : 'desc';

        // Get all players for chart calculations
        if (!this.playerManager) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Players</h3><p>Add players to see timeline charts.</p></div>';
            return;
        }
        const players = this.playerManager.getPlayers();
        if (!players || players.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Players</h3><p>Add players to see timeline charts.</p></div>';
            return;
        }

        const timelineEntries = sortedDateEntries.map(([dateKey, dateMatches], dateIndex) => {
            // Calculate cumulative stats up to this date
            const allMatchesUpToThisDate = [];
            for (let i = 0; i <= dateIndex; i++) {
                allMatchesUpToThisDate.push(...sortedDateEntries[i][1]);
            }
            
            // Calculate win rates and goals for each player up to this date
            const playerWinRates = {};
            const playerGoals = {};
            players.forEach(player => {
                let wins = 0, games = 0, goals = 0;
                allMatchesUpToThisDate.forEach(match => {
                    const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                    const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                    const inTeam1 = team1Players.includes(player);
                    const inTeam2 = team2Players.includes(player);
                    
                    if (inTeam1 || inTeam2) {
                        games++;
                        if ((match.result === 'team1' && inTeam1) || (match.result === 'team2' && inTeam2)) {
                            wins++;
                        }
                        // Count goals
                        if (inTeam1) goals += (match.team1Score || 0);
                        if (inTeam2) goals += (match.team2Score || 0);
                    }
                });
                playerWinRates[player] = games > 0 ? (wins / games * 100).toFixed(1) : 0;
                playerGoals[player] = goals;
            });

            const dateHeader = `
                <div class="timeline-date-group compact">
                    <div class="timeline-date-header">
                        <div class="timeline-date-title">${dateKey}</div>
                        <div class="timeline-date-count">${dateMatches.length} match${dateMatches.length !== 1 ? 'es' : ''}</div>
                        <button class="timeline-date-toggle" aria-expanded="false" aria-label="Show stats">▶</button>
                    </div>
                    <div class="timeline-mini-stats" hidden>
                        ${players.length > 0 ? `
                        <div class="timeline-stats-section">
                            <div class="timeline-stats-label">Win Rates (Cumulative)</div>
                            <div class="timeline-win-rate-bars">
                                ${players.map(player => {
                                    const winRate = parseFloat(playerWinRates[player] || 0);
                                    const playerColor = (this.settingsManager && this.settingsManager.getPlayerColor) ? (this.settingsManager.getPlayerColor(player) || '#2196F3') : '#2196F3';
                                    return `
                                        <div class="timeline-player-stat">
                                            <div class="timeline-player-stat-header">
                                                <span class="timeline-player-name">${this.escapeHtml(player)}</span>
                                                <span class="timeline-player-value">${winRate}%</span>
                                            </div>
                                            <div class="timeline-progress-bar">
                                                <div class="timeline-progress-fill" style="width: ${winRate}%; background: ${playerColor};"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="timeline-stats-section">
                            <div class="timeline-stats-label">Goals Scored</div>
                            <div class="timeline-goals-display">
                                ${players.map(player => {
                                    const goals = playerGoals[player] || 0;
                                    const playerColor = (this.settingsManager && this.settingsManager.getPlayerColor) ? (this.settingsManager.getPlayerColor(player) || '#2196F3') : '#2196F3';
                                    return `
                                        <div class="timeline-goal-item">
                                            <span class="timeline-goal-dot" style="background: ${playerColor};"></span>
                                            <span class="timeline-goal-name">${this.escapeHtml(player)}:</span>
                                            <span class="timeline-goal-value">${goals}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
            `;

            const matchesHTML = dateMatches.map(match => {
                let team1Display = this.formatTeamWithColors(match.team1);
                let team2Display = this.formatTeamWithColors(match.team2);
                
                // Highlight search terms if present
                if (searchTerm) {
                    team1Display = this.highlightSearchTerm(team1Display, searchTerm);
                    team2Display = this.highlightSearchTerm(team2Display, searchTerm);
                }
                
                const date = new Date(match.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Determine result class and indicator
                let resultClass = 'draw';
                let resultIndicator = 'draw';
                if (match.result === 'team1' || match.result === 'team2') {
                    resultClass = match.result === 'team1' ? 'team1-win' : 'team2-win';
                    resultIndicator = 'win';
                }

                return `
                    <div class="timeline-match-item ${resultClass} compact" data-timestamp="${match.timestamp}">
                        <div class="timeline-match-header">
                            <div class="timeline-match-teams">
                                <span class="timeline-result-indicator ${resultIndicator}"></span>
                                ${team1Display} vs ${team2Display}
                            </div>
                            <div class="timeline-match-score">
                                ${match.result === 'team1' ?
                                    `<span class="winning-score">${match.team1Score || 0}</span>` :
                                    `<span>${match.team1Score || 0}</span>`
                                } - ${match.result === 'team2' ?
                                    `<span class="winning-score">${match.team2Score || 0}</span>` :
                                    `<span>${match.team2Score || 0}</span>`
                                }
                                ${match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined ?
                                    ` <span class="timeline-match-tag">ET</span>` : ''}
                                ${match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined ?
                                    ` <span class="timeline-match-tag">Pens</span>` : ''}
                            </div>
                            <div class="timeline-match-time">${timeStr}</div>
                            <button class="timeline-match-toggle" aria-expanded="false" aria-label="Show details">▼</button>
                        </div>
                        <div class="timeline-match-details" hidden>
                            <div class="timeline-match-actions">
                                <button class="match-history-btn share" data-timestamp="${match.timestamp}" title="Share Match">📤 Share</button>
                                <button class="match-history-btn edit" data-timestamp="${match.timestamp}">Edit</button>
                                <button class="match-history-btn delete" data-timestamp="${match.timestamp}">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return dateHeader + matchesHTML + '</div>';
        });

        // Apply chosen display order
        if (timelineOrder === 'desc') {
            timelineEntries.reverse();
        }

        container.innerHTML = timelineEntries.join('');
        this.attachHistoryEventListeners(container);

        // Add click handlers to expand/collapse date group stats
        container.querySelectorAll('.timeline-date-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const header = btn.closest('.timeline-date-header');
                const stats = header ? header.nextElementSibling : null;
                const isOpen = header && header.parentElement ? header.parentElement.classList.toggle('expanded') : false;
                if (stats) stats.hidden = !isOpen;
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });

        // Add click handlers to expand/collapse match details
        container.querySelectorAll('.timeline-match-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.timeline-match-item');
                const details = item ? item.querySelector('.timeline-match-details') : null;
                const isOpen = item ? item.classList.toggle('expanded') : false;
                if (details) details.hidden = !isOpen;
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });

        // Add swipe-to-delete functionality to timeline items
        container.querySelectorAll('.timeline-match-item').forEach(item => {
            const deleteBtn = item.querySelector('.match-history-btn.delete');
            if (deleteBtn) {
                const timestamp = deleteBtn.dataset.timestamp;
                this.touchSwipeHandler.attachSwipeToDelete(item, () => {
                    this.confirmDeleteMatch(timestamp);
                });
            }
        });
    }

    attachHistoryEventListeners(container) {
        container.querySelectorAll('.match-history-btn.share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareMatch(btn.dataset.timestamp);
            });
        });

        container.querySelectorAll('.match-history-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMatch(btn.dataset.timestamp);
            });
        });

        container.querySelectorAll('.match-history-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmDeleteMatch(btn.dataset.timestamp);
            });
        });
    }

    switchHistoryView(view) {
        this.currentHistoryView = view;
        
        // Update toggle buttons
        document.getElementById('historyListViewBtn').classList.toggle('active', view === 'list');
        document.getElementById('historyTimelineViewBtn').classList.toggle('active', view === 'timeline');
        
        // Show/hide containers
        document.getElementById('matchHistoryList').style.display = view === 'list' ? 'flex' : 'none';
        document.getElementById('matchHistoryTimeline').style.display = view === 'timeline' ? 'block' : 'none';
        
        // Reload history with current view
        this.loadMatchHistory();
    }

    clearHistoryFilters() {
        document.getElementById('historyFilter').value = 'all';
        document.getElementById('historySearch').value = '';
        document.getElementById('historyDateFrom').value = '';
        document.getElementById('historyDateTo').value = '';
        const sortOrderSelect = document.getElementById('historySortOrder');
        if (sortOrderSelect) {
            sortOrderSelect.value = 'desc';
        }
        this.historySortOrder = 'desc';
        this.loadMatchHistory();
    }

    async editMatch(timestamp) {
        // Check if match can be edited (admin can always edit, or match is not locked)
        const matchDate = new Date(timestamp);
        const today = new Date();

        // Get start of today in local timezone
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Get start of match day in local timezone
        const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());

        const isTodayMatch = startOfMatchDay.getTime() === startOfToday.getTime();


        // If match is from previous day(s) - require admin PIN
        if (!isTodayMatch && !this.isAdmin) {
            const pin = await this.showPinModal('Enter Admin PIN', 'This match is from a previous day. Enter admin PIN to edit:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
            this.toastManager.success('Admin access granted for this action');
        }

        // Now open the edit modal
        let match = null;
        if (this.isFirebaseMode && this.firebaseStore) {
            // In Firebase mode, find match in Firebase cache
            const firebaseMatches = this.firebaseStore.getMatches();
            console.log('Looking for match in Firebase cache, total matches:', firebaseMatches.length, 'timestamp:', timestamp);
            match = firebaseMatches.find(m => m.timestamp === timestamp);
            if (!match) {
                console.error('Match not found in Firebase cache:', timestamp);
                console.log('Available timestamps:', firebaseMatches.map(m => m.timestamp));
                return;
            }
            console.log('Found Firebase match:', match);
        } else {
            // Local storage mode
        const matchInfo = this.matchRecorder.findMatch(timestamp);
        if (!matchInfo) return;

        const data = this.storage.getData();
            match = data.seasons[matchInfo.season].matches[matchInfo.index];
        }
        
        this.editingMatchTimestamp = timestamp;

        const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
        const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
        const team1Display = this.formatTeamWithColors(match.team1);
        const team2Display = this.formatTeamWithColors(match.team2);

        document.getElementById('editMatchTeams').innerHTML = `
            <div class="team-display">
                <div class="team-players">${team1Display}</div>
                <span class="vs">VS</span>
                <div class="team-players">${team2Display}</div>
            </div>
        `;
        document.getElementById('editTeam1Score').value = match.team1Score || 0;
        document.getElementById('editTeam2Score').value = match.team2Score || 0;
        
        // Set extra time if exists
        const hasExtraTime = match.team1ExtraTimeScore !== undefined && match.team2ExtraTimeScore !== undefined;
        const editExtraTimeCheckbox = document.getElementById('editWentToExtraTime');
        if (editExtraTimeCheckbox) {
            editExtraTimeCheckbox.checked = hasExtraTime;
            if (hasExtraTime) {
                document.getElementById('editExtraTimeScores').style.display = 'flex';
                document.getElementById('editTeam1ExtraTimeScore').value = match.team1ExtraTimeScore || 0;
                document.getElementById('editTeam2ExtraTimeScore').value = match.team2ExtraTimeScore || 0;
            } else {
                document.getElementById('editExtraTimeScores').style.display = 'none';
                document.getElementById('editTeam1ExtraTimeScore').value = 0;
                document.getElementById('editTeam2ExtraTimeScore').value = 0;
            }
        }
        
        // Set penalties if exists
        const hasPenalties = match.team1PenaltiesScore !== undefined && match.team2PenaltiesScore !== undefined;
        const editPenaltiesCheckbox = document.getElementById('editWentToPenalties');
        if (editPenaltiesCheckbox) {
            editPenaltiesCheckbox.checked = hasPenalties;
            if (hasPenalties) {
                document.getElementById('editPenaltiesScores').style.display = 'flex';
                document.getElementById('editTeam1PenaltiesScore').value = match.team1PenaltiesScore || 0;
                document.getElementById('editTeam2PenaltiesScore').value = match.team2PenaltiesScore || 0;
            } else {
                document.getElementById('editPenaltiesScores').style.display = 'none';
                document.getElementById('editTeam1PenaltiesScore').value = 0;
                document.getElementById('editTeam2PenaltiesScore').value = 0;
            }
        }
        
        document.getElementById('editMatchModal').style.display = 'flex';
    }


    async saveEditMatch() {
        if (!this.editingMatchTimestamp) return;

        // Check if match is from today (same day)
        const matchDate = new Date(this.editingMatchTimestamp);
        const today = new Date();

        // Get start of today in local timezone
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Get start of match day in local timezone
        const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());

        const isTodayMatch = startOfMatchDay.getTime() === startOfToday.getTime();

        console.log('Edit check - timestamp:', this.editingMatchTimestamp);
        console.log('  matchDate:', matchDate, 'startOfMatchDay:', startOfMatchDay);
        console.log('  today:', today, 'startOfToday:', startOfToday);
        console.log('  isTodayMatch:', isTodayMatch, '(same day check)');

        // If match is from today, allow editing directly
        if (isTodayMatch || this.isAdmin) {
            // Continue with normal edit logic
        } else {
            // Match is from previous day(s) - require admin PIN
            const pin = await this.showPinModal('Enter Admin PIN', 'This match is from a previous day. Enter admin PIN to edit:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
            this.toastManager.success('Admin access granted for this action');
        }

        const team1Score = parseInt(document.getElementById('editTeam1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('editTeam2Score').value) || 0;

        // Get extra time scores if applicable
        const wentToExtraTime = document.getElementById('editWentToExtraTime').checked;
        let team1ExtraTimeScore = null;
        let team2ExtraTimeScore = null;
        if (wentToExtraTime) {
            team1ExtraTimeScore = parseInt(document.getElementById('editTeam1ExtraTimeScore').value) || 0;
            team2ExtraTimeScore = parseInt(document.getElementById('editTeam2ExtraTimeScore').value) || 0;
        }

        // Get penalties scores if applicable
        const wentToPenalties = document.getElementById('editWentToPenalties').checked;
        let team1PenaltiesScore = null;
        let team2PenaltiesScore = null;
        if (wentToPenalties) {
            team1PenaltiesScore = parseInt(document.getElementById('editTeam1PenaltiesScore').value) || 0;
            team2PenaltiesScore = parseInt(document.getElementById('editTeam2PenaltiesScore').value) || 0;
        }

        if (this.matchRecorder.updateMatch(
            this.editingMatchTimestamp, 
            team1Score, 
            team2Score,
            team1ExtraTimeScore,
            team2ExtraTimeScore,
            team1PenaltiesScore,
            team2PenaltiesScore
        )) {
            // Haptic feedback
            this.vibrate([50]);
            this.toastManager.success('Match updated successfully', 'Match Saved');
            this.closeEditModal();
            this.loadMatchHistory();
            // Refresh stats if on stats screen
            if (this.currentScreen === 'statsScreen') {
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'today';
                this.switchStatsTab(currentTab);
            }
        } else {
            this.toastManager.error('Error updating match');
        }
    }

    async confirmDeleteMatch(timestamp = null) {
        // Use provided timestamp or fall back to editingMatchTimestamp
        const matchTimestamp = timestamp || this.editingMatchTimestamp;
        if (!matchTimestamp) return;
        
        // Check if match is from today (same day)
        const matchDate = new Date(matchTimestamp);
        const today = new Date();

        // Get start of today in local timezone
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Get start of match day in local timezone
        const startOfMatchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());

        const isTodayMatch = startOfMatchDay.getTime() === startOfToday.getTime();


        // If match is from today, allow deletion directly
        if (isTodayMatch || this.isAdmin) {
        if (confirm('Delete this match? This cannot be undone.')) {
                this.deleteMatch(matchTimestamp);
            }
            return;
        }

        // Match is from previous day(s) - require admin PIN
        const pin = await this.showPinModal('Enter Admin PIN', 'This match is from a previous day. Enter admin PIN to delete:');
        if (!pin) {
            return; // User cancelled
        }

        const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
        if (isValid) {
            this.updateAdminUI();
            this.toastManager.success('Admin access granted for this action');
            if (confirm('Delete this match? This cannot be undone.')) {
                this.deleteMatch(matchTimestamp);
            }
        } else {
            this.toastManager.error('Incorrect PIN');
        }
    }

    deleteMatch(timestamp) {
        console.log('Attempting to delete match with timestamp:', timestamp, 'isAdmin:', this.isAdmin);

        if (this.matchRecorder.deleteMatch(timestamp)) {
            // Haptic feedback
            this.vibrate([100, 50, 100]);
            this.toastManager.success('Match deleted successfully', 'Match Removed');
            this.closeEditModal();
            this.loadMatchHistory();
            // Refresh stats if on stats screen
            if (this.currentScreen === 'statsScreen') {
                const activeTab = document.querySelector('.tab-btn.active');
                const currentTab = activeTab ? activeTab.dataset.tab : 'today';
                this.switchStatsTab(currentTab);
            }
        } else {
            this.toastManager.error('Error deleting match');
        }
    }

    closeEditModal() {
        document.getElementById('editMatchModal').style.display = 'none';
        this.editingMatchTimestamp = null;
    }

    // Helper method to redirect to admin unlock with context

    // Export/Import Data
    async exportData() {
        if (!this.isAdmin) {
            const pin = await this.showPinModal('Enter Admin PIN', 'Enter admin PIN to export data:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
        }
        const data = this.storage.getData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fc25-score-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Data exported successfully!');
    }

    async importData() {
        if (!this.isAdmin) {
            const pin = await this.showPinModal('Enter Admin PIN', 'Enter admin PIN to import data:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
        }
        document.getElementById('importFileInput').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Basic validation
                if (!importedData.players || !Array.isArray(importedData.players)) {
                    throw new Error('Invalid data format');
                }

                const isLegacyBackup = !!(importedData.seasons && typeof importedData.seasons === 'object');

                // Check if we can do Firebase import
                const canDoFirebaseImport = this.isFirebaseMode && this.firebaseStore && this.firebaseManager && isLegacyBackup;

                if (canDoFirebaseImport) {
                    console.log('Firebase available, importing to shared league');
                } else {
                    // Firebase not available or not legacy backup - do local import
                    console.log('Using local import mode');
                }

                // Firebase mode: import into shared league (merge, no deletes)
                if (canDoFirebaseImport) {
                    const allLegacyMatches = [];
                    Object.values(importedData.seasons || {}).forEach(season => {
                        (season.matches || []).forEach(m => allLegacyMatches.push(m));
                    });

                    const wipeFirst = confirm(
                        `Before importing, do you want to WIPE the shared league first?\n\n` +
                        `Choose OK = WIPE then import (clean slate)\n` +
                        `Choose Cancel = MERGE import (skip duplicates by timestamp)`
                    );

                    if (wipeFirst) {
                        if (this.firebaseManager && !this.firebaseManager.getIsAdmin()) {
                            alert('To wipe the shared league, you must unlock Admin first (PIN).');
                            return;
                        } else if (!this.firebaseManager) {
                            // Firebase not available, allow local wipe
                            console.log('Firebase not available, allowing local data wipe');
                        }
                        if (!confirm('Final warning: this will DELETE ALL existing shared matches for everyone. Continue?')) {
                            return;
                        }
                        await this.firebaseStore.wipeLeagueData();
                    } else {
                        if (!confirm(
                            `Import legacy backup into the SHARED league (merge)?\n\n` +
                            `- This will ADD matches (skip duplicates by timestamp)\n` +
                            `- Set active players to: ${importedData.players.join(', ')}\n\n` +
                            `Continue?`
                        )) {
                            return;
                        }
                    }

                    const result = await this.firebaseStore.importLegacyMatches(allLegacyMatches);
                    await this.firebaseStore.saveActivePlayers(importedData.players);

                    alert(`Import complete!\nImported: ${result.imported}\nSkipped: ${result.skipped}\n\nReloading...`);
                    location.reload();
                    return;
                }

                // Local mode fallback (when Firebase is broken or not available)
                if (!canDoFirebaseImport) {
                    console.log('Falling back to local import');
                }

                // Local mode (or non-legacy): replace local storage like before
                if (confirm('This will replace ALL your current LOCAL data on this device. Continue?')) {
                    this.storage.updateData(data => {
                        Object.assign(data, importedData);
                    });
                    alert('Data imported successfully! Reloading...');
                    location.reload();
                }
            } catch (error) {
                alert('Error importing data: ' + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    // Dark Mode
    initializeDarkMode() {
        // Check settings manager first, then localStorage for backwards compatibility
        let isDark = false;
        if (this.settingsManager) {
            isDark = this.settingsManager.isDarkMode();
        } else {
            isDark = localStorage.getItem('darkMode') === 'true';
        }
        
        if (isDark) {
            document.body.classList.add('dark-mode');
        }
        
        // Update toggle button icon
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
        }
    }

    toggleDarkMode() {
        console.log('toggleDarkMode called');
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        console.log('Dark mode is now:', isDark);
        
        // Update both localStorage and settings manager for consistency
        localStorage.setItem('darkMode', isDark ? 'true' : 'false');
        if (this.settingsManager) {
            this.settingsManager.setDarkMode(isDark);
        }
        
        // Update toggle button icon
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
        }
        
        // Update settings checkbox if it exists
        const darkModeSetting = document.getElementById('darkModeSetting');
        if (darkModeSetting) {
            darkModeSetting.checked = isDark;
        }
    }

    // Check for app updates
    async checkForUpdates() {
        const refreshBtn = document.getElementById('refreshAppBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳';
        }
        
        try {
            if ('serviceWorker' in navigator) {
                // Unregister all service workers
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                
                // Clear all caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
            }
            
            // Force reload with cache bypass
            window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
        } catch (error) {
            console.error('Error checking for updates:', error);
            // Fallback: reload
            window.location.reload();
        }
    }

    // Add this method to display player name history
    updatePlayerNameHistory() {
        const history = this.playerManager.getPlayerNameHistory();
        const container = document.getElementById('playerHistory');
        const list = document.getElementById('playerHistoryList');
        
        if (history.length > 0) {
            container.style.display = 'block';
            
            list.innerHTML = history.map(name => {
                const isUsed = this.playerEditorValues.some(value => (value || '').trim() === name);
                
                return `
                    <button class="player-history-btn ${isUsed ? 'used' : ''}" 
                            data-name="${name}" 
                            ${isUsed ? 'disabled' : ''}>
                        ${name}
                    </button>
                `;
            }).join('');
            
            // Add click listeners
            list.querySelectorAll('.player-history-btn').forEach(btn => {
                if (!btn.disabled) {
                    btn.addEventListener('click', () => {
                        const playerName = btn.dataset.name;
                        this.fillEmptyPlayerInput(playerName);
                    });
                }
            });
        } else {
            container.style.display = 'none';
        }
    }

    // Add this method to fill the first empty input
    fillEmptyPlayerInput(playerName) {
        const trimmed = (playerName || '').trim();
        if (!trimmed) return;

        if (this.playerEditorValues.some(value => (value || '').trim() === trimmed)) {
            alert(`${trimmed} is already in the list.`);
            return;
        }

        const emptyIndex = this.playerEditorValues.findIndex(value => (value || '').trim().length === 0);
        if (emptyIndex !== -1) {
            this.playerEditorValues[emptyIndex] = trimmed;
        } else if (this.playerEditorValues.length < 4) {
            this.playerEditorValues.push(trimmed);
        } else {
            alert('Maximum 4 players allowed');
            return;
        }

        this.renderEditablePlayerList();
        this.updatePlayerNameHistory();
    }

    // Settings Management
    switchSettingsTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.settingsTab === tabId);
        });
        
        // Update tab content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const targetTab = document.getElementById(`${tabId}SettingsTab`) || 
                         document.getElementById(`${tabId}ConfigTab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Load tab-specific content
        if (tabId === 'visual') {
            this.renderPlayerColors();
        }
    }

    loadSettingsIntoForm() {
        // Load current settings into form fields (called during app init)
        const settings = this.settingsManager.getSettings();

        // Load labels (only if elements exist)
        const homeLabelInput = document.getElementById('homeLabelInput');
        const awayLabelInput = document.getElementById('awayLabelInput');
        const neutralLabelInput = document.getElementById('neutralLabelInput');
        if (homeLabelInput) homeLabelInput.value = settings.labels.home || 'Home';
        if (awayLabelInput) awayLabelInput.value = settings.labels.away || 'Away';
        if (neutralLabelInput) neutralLabelInput.value = settings.labels.neutral || 'Neutral';

        // Load points settings (only if elements exist)
        const points = this.settingsManager.getPointsPerResult();
        const pointsWinInput = document.getElementById('pointsWinInput');
        const pointsDrawInput = document.getElementById('pointsDrawInput');
        const pointsLossInput = document.getElementById('pointsLossInput');
        if (pointsWinInput) pointsWinInput.value = points.win;
        if (pointsDrawInput) pointsDrawInput.value = points.draw;
        if (pointsLossInput) pointsLossInput.value = points.loss;

        // Load dark mode (only if element exists)
        const darkModeSetting = document.getElementById('darkModeSetting');
        if (darkModeSetting) {
            darkModeSetting.checked = settings.darkMode || false;
        }
    }

    loadSettingsScreen() {
        // Load current settings into UI (called when settings screen is shown)
        const settings = this.settingsManager.getSettings();

        // Load basic settings into form
        this.loadSettingsIntoForm();

        // Render player colors
        this.renderPlayerColors();

        // Display app version - extract from service worker cache or use constant
        const versionDisplay = document.getElementById('appVersionDisplay');
        if (versionDisplay) {
            // Try to get version from service worker cache name (more accurate)
            this.displayAppVersion(versionDisplay);
        }
        const bannerVersion = document.getElementById('appVersionBanner');
        if (bannerVersion) {
            // Set version immediately (synchronously)
            bannerVersion.textContent = 'Version 1.87.0';
            // Then try to update from cache (async)
            this.displayAppVersion(bannerVersion).catch(err => {
                console.error('Error displaying app version:', err);
            });
        }
    }

    async displayAppVersion(versionDisplayElement) {
        if (!versionDisplayElement) return;
        
        // Try to get version from active cache name
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                // Find the cache name that matches our pattern: fc25-score-tracker-vXX
                const cacheName = cacheNames.find(name => name.startsWith('fc25-score-tracker-v'));
                if (cacheName) {
                    // Extract version number (e.g., "v72" -> "72")
                    const versionMatch = cacheName.match(/v(\d+)/);
                    if (versionMatch) {
                        const cacheVersion = versionMatch[1];
                        // Format as version number (e.g., "1.72.0")
                        versionDisplayElement.textContent = `Version 1.${cacheVersion}.0`;
                        return;
                    }
                }
            } catch (error) {
                console.error('Error reading cache names:', error);
            }
        }
        
        // Fallback to constant version if cache lookup failed
        if (typeof APP_VERSION !== 'undefined') {
            versionDisplayElement.textContent = `Version ${APP_VERSION}`;
        }
    }

    renderPlayerColors() {
        const container = document.getElementById('playerColorsList');
        if (!container) return;
        
        const players = this.playerManager.getPlayers();
        const settings = this.settingsManager.getSettings();
        
        if (players.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Add players first to assign colors</p>';
            return;
        }
        
        const itemsHtml = players.map(player => {
            const currentColor = settings.playerColors[player] || '#2196F3';
            return `
                <div class="player-color-item">
                    <label>${this.escapeHtml(player)}</label>
                    <input type="color" 
                           class="player-color-picker" 
                           value="${currentColor}"
                           data-player="${this.escapeHtml(player)}"
                           title="Choose color for ${this.escapeHtml(player)}">
                </div>
            `;
        }).join('');

        container.innerHTML = itemsHtml;
        
        // Add event listeners for color changes
        container.querySelectorAll('.player-color-picker').forEach(picker => {
            picker.addEventListener('change', (e) => {
                const player = e.target.dataset.player;
                const color = e.target.value;
                this.settingsManager.setPlayerColor(player, color);
            });
        });
    }


    saveSettings() {
        // Save labels
        const homeLabel = document.getElementById('homeLabelInput').value.trim() || 'Home';
        const awayLabel = document.getElementById('awayLabelInput').value.trim() || 'Away';
        const neutralLabel = document.getElementById('neutralLabelInput').value.trim() || 'Neutral';
        
        this.settingsManager.setLabel('home', homeLabel);
        this.settingsManager.setLabel('away', awayLabel);
        this.settingsManager.setLabel('neutral', neutralLabel);

        // Save points settings
        const winPoints = parseFloat(document.getElementById('pointsWinInput').value) || 1;
        const drawPoints = parseFloat(document.getElementById('pointsDrawInput').value) || 1;
        const lossPoints = parseFloat(document.getElementById('pointsLossInput').value) || 0;
        this.settingsManager.setPointsPerResult({ win: winPoints, draw: drawPoints, loss: lossPoints });

        // Update lock labels in app
        this.updateLockLabels();

        // Refresh UI that uses labels
        this.renderPlayerLockOptions();
        
        // Show success message
        alert('Settings saved successfully!');
    }

    resetLabels() {
        if (confirm('Reset labels to default values?')) {
            this.settingsManager.resetLabels();
            this.loadSettingsScreen();
            this.updateLockLabels();
            this.renderPlayerLockOptions();
        }
    }

    async confirmClearAllData() {
        if (!this.isAdmin) {
            const pin = await this.showPinModal('Enter Admin PIN', 'Enter admin PIN to clear all data:');
            if (!pin) {
                return; // User cancelled
            }

            const isValid = await this.verifyPinAndGrantAdmin(pin.trim());
            if (!isValid) {
                this.toastManager.error('Incorrect PIN');
                return;
            }
            this.updateAdminUI();
        }

        const firebaseNote = this.isFirebaseMode ? '\n\n⚠️ This will also delete ALL Firebase data (shared across all browsers)!' : '';
        if (confirm('Are you sure you want to clear ALL data? This cannot be undone!\n\nThis will delete:\n- All matches\n- All statistics\n- All settings\n- All player data' + firebaseNote)) {
            if (confirm('This is your last chance. Are you absolutely sure?')) {
                
                
                // If Firebase mode, clear Firebase data first
                if (this.isFirebaseMode && this.firebaseStore) {
                    try {
                        if (!this.firebaseManager || !this.firebaseManager.getIsAdmin()) {
                            alert('To wipe the shared league, you must unlock Admin first (PIN).');
                            return;
                        }

                        const result = await this.firebaseStore.wipeLeagueData();
                        console.log('Wiped league data:', result);
                        
                    } catch (error) {
                        console.error('Error clearing Firebase:', error);
                        alert('Error clearing Firebase data: ' + error.message);
                        return;
                    }
                }
                
                // Clear local storage
                this.storage.clearAll();
                this.settingsManager.resetAll();
                
                // Also clear any other localStorage keys that might exist
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.includes('fc25') || key.includes('score') || key.includes('player'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                });
                
                // Small delay to ensure everything is saved
                await new Promise(resolve => setTimeout(resolve, 500));
                location.reload();
            }
        }
    }

    // Save current game state for persistence
    saveCurrentGameState() {
        const gameState = {
            screen: this.currentScreen,
            selectedStructureIndex: this.selectedStructureIndex,
            selectedStructure: this.selectedStructure,
            currentGameIndex: this.currentGameIndex,
            currentMatch: this.currentMatch
        };
        this.storage.saveCurrentGameState(gameState);
    }

    // Restore saved game state on app startup
    restoreSavedGameState() {
        const savedState = this.storage.getCurrentGameState();

        // Only restore if we have valid saved state and enough players
        const players = this.playerManager.getPlayers();
        if (!savedState || players.length < 2) {
            return;
        }

        // Restore basic state variables
        this.currentScreen = savedState.screen || this.currentScreen;
        this.selectedStructureIndex = savedState.selectedStructureIndex;
        this.selectedStructure = savedState.selectedStructure;
        this.currentGameIndex = savedState.currentGameIndex || 0;
        this.currentMatch = savedState.currentMatch;

        // Validate that the saved structure is still valid with current players
        if (this.selectedStructure && this.selectedStructure.matches) {
            const currentPlayers = new Set(players);
            const isValidStructure = this.selectedStructure.matches.every(match => {
                const team1Players = Array.isArray(match.team1) ? match.team1 : [match.team1];
                const team2Players = Array.isArray(match.team2) ? match.team2 : [match.team2];
                return [...team1Players, ...team2Players].every(player => currentPlayers.has(player));
            });

            if (!isValidStructure) {
                // Saved structure is no longer valid (players changed), clear it
                this.selectedStructure = null;
                this.selectedStructureIndex = null;
                this.currentGameIndex = 0;
                this.currentMatch = null;
                this.storage.saveCurrentGameState({
                    screen: this.currentScreen,
                    selectedStructureIndex: null,
                    selectedStructure: null,
                    currentGameIndex: 0,
                    currentMatch: null
                });
                return;
            }
        }

        // Show the saved screen
        if (this.currentScreen && this.currentScreen !== 'playerScreen') {
            this.showScreen(this.currentScreen, 'forward');

            // If we're restoring to the match screen, also show the current match
            if (this.currentScreen === 'matchScreen' && this.selectedStructure) {
                this.showCurrentMatch();
            }
        }
    }

    // Haptic Feedback Helper
    vibrate(pattern = [50]) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Vibration not supported or failed
            }
        }
    }

    // Admin PIN Methods
    /**
     * Show a custom PIN entry modal (replaces browser prompt for better compatibility)
     * @param {string} title - Title for the modal
     * @param {string} message - Message to display
     * @returns {Promise<string|null>} - Returns the PIN if entered, null if cancelled
     */
    showPinModal(title = 'Enter Admin PIN', message = 'Please enter your 4-digit PIN to continue') {
        return new Promise((resolve) => {
            const modal = document.getElementById('adminPinModal');
            const titleEl = document.getElementById('adminPinModalTitle');
            const messageEl = document.getElementById('adminPinModalMessage');
            const inputEl = document.getElementById('adminPinModalInput');
            const submitBtn = document.getElementById('adminPinModalSubmit');
            const cancelBtn = document.getElementById('adminPinModalCancel');

            if (!modal || !titleEl || !messageEl || !inputEl || !submitBtn || !cancelBtn) {
                console.error('PIN modal elements not found', {
                    modal: !!modal,
                    titleEl: !!titleEl,
                    messageEl: !!messageEl,
                    inputEl: !!inputEl,
                    submitBtn: !!submitBtn,
                    cancelBtn: !!cancelBtn
                });
                // Fallback: try to create modal dynamically if it doesn't exist
                if (!modal) {
                    console.error('Modal HTML not found in DOM - please refresh the page to get the latest version');
                    resolve(null);
                    return;
                }
                resolve(null);
                return;
            }

            // Set title and message
            titleEl.textContent = title;
            messageEl.textContent = message;

            // Reset input
            inputEl.value = '';
            inputEl.classList.remove('error');

            // Show modal
            modal.style.display = 'flex';

            // Focus input after a short delay to ensure modal is visible
            setTimeout(() => {
                inputEl.focus();
            }, 100);

            // Cleanup function
            const cleanup = () => {
                modal.style.display = 'none';
                inputEl.value = '';
                inputEl.classList.remove('error');
                submitBtn.removeEventListener('click', submitHandler);
                cancelBtn.removeEventListener('click', cancelHandler);
                inputEl.removeEventListener('keydown', keyHandler);
            };

            // Submit handler
            const submitHandler = () => {
                const pin = inputEl.value.trim();
                if (!/^\d{4}$/.test(pin)) {
                    inputEl.classList.add('error');
                    this.toastManager.error('Please enter a valid 4-digit PIN');
                    inputEl.focus();
                    return;
                }
                cleanup();
                resolve(pin);
            };

            // Cancel handler
            const cancelHandler = () => {
                cleanup();
                resolve(null);
            };

            // Key handler (Enter to submit, Escape to cancel)
            const keyHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitHandler();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelHandler();
                }
            };

            // Attach event listeners
            submitBtn.addEventListener('click', submitHandler);
            cancelBtn.addEventListener('click', cancelHandler);
            inputEl.addEventListener('keydown', keyHandler);

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cancelHandler();
                }
            });
        });
    }

    /**
     * Verify PIN and grant admin access
     * @param {string} pin - The PIN to verify
     * @returns {Promise<boolean>} - True if PIN is valid and admin granted
     */
    async verifyPinAndGrantAdmin(pin) {
        if (!pin || !/^\d{4}$/.test(pin)) {
            return false;
        }

        if (this.isFirebaseMode && this.firebaseManager) {
            // Firebase mode: verify PIN with Firebase
            try {
                await this.firebaseManager.verifyPin(pin);
                this.isAdmin = this.firebaseManager.getIsAdmin();
                return this.isAdmin;
            } catch (error) {
                console.error('Firebase PIN verification error:', error);
                return false;
            }
        } else {
            // Local mode: check against stored PIN
            const storedPin = this.storage.getData().adminPin;
            if (storedPin && pin === storedPin) {
                this.isAdmin = true;
                return true;
            }
            return false;
        }
    }

    async unlockAdminWithPin() {
        const pin = (document.getElementById('adminPinInput')?.value || '').trim();
        if (!/^\d{4}$/.test(pin)) {
            this.toastManager.error('Enter a 4-digit PIN');
            return;
        }

        const isValid = await this.verifyPinAndGrantAdmin(pin);
        if (isValid) {
            this.adminUnlockedThisSession = true; // Mark admin as unlocked in this session
            this.updateAdminUI();
            this.toastManager.success(`Admin unlocked${this.isFirebaseMode ? '' : ' (local mode)'}`);
        } else {
            if (!this.isFirebaseMode) {
                const storedPin = this.storage.getData().adminPin;
                if (!storedPin) {
                    // No PIN set yet, show setup row
                    const row = document.getElementById('adminPinSetupRow');
                    if (row) row.style.display = 'flex';
                    this.toastManager.info('Set a PIN first (local mode)');
                    return;
                }
            }
            this.toastManager.error('Incorrect PIN');
        }
    }

    async setAdminPin() {
        const pin = (document.getElementById('adminPinInput')?.value || '').trim();
        const confirmPin = (document.getElementById('adminPinConfirmInput')?.value || '').trim();
        if (!/^\d{4}$/.test(pin) || pin !== confirmPin) {
            this.toastManager.error('PINs must match and be 4 digits');
            return;
        }

        if (this.isFirebaseMode && this.firebaseManager) {
            // Firebase mode: set PIN in Firebase
            try {
                await this.firebaseManager.setPin(pin);
                this.adminUnlockedThisSession = true; // Mark admin as unlocked in this session
                this.isAdmin = this.firebaseManager.getIsAdmin();
                this.updateAdminUI();
                this.toastManager.success('PIN set. Admin unlocked');
            } catch (error) {
                this.toastManager.error('Could not set PIN (already set?)');
            }
        } else {
            // Local mode: store PIN in localStorage
            this.storage.updateData(data => {
                data.adminPin = pin;
            });
            this.adminUnlockedThisSession = true;
            this.isAdmin = true;
            this.updateAdminUI();
            this.toastManager.success('PIN set. Admin unlocked (local mode)');
        }
    }

    async lockAdmin() {
        try {
            if (this.firebaseManager) {
                await this.firebaseManager.clearAdmin();

                // Update local state immediately
                this.adminUnlockedThisSession = false; // Clear session flag
                this.isAdmin = false;
                this.updateAdminUI();

                this.toastManager.success('Admin locked successfully');
            } else {
                // Fallback for local mode
                this.adminUnlockedThisSession = false; // Clear session flag
                this.isAdmin = false;
                this.updateAdminUI();
                this.toastManager.info('Admin locked');
            }
        } catch (error) {
            console.error('Error locking admin:', error);
            this.toastManager.error('Failed to lock admin: ' + (error.message || 'Unknown error'));
        }
    }

    async resetAdminPin() {
        if (!this.firebaseManager || !this.isAdmin) return;
        const newPin = await this.showPinModal('Reset Admin PIN', 'Enter a NEW 4-digit PIN:');
        if (!newPin) {
            return; // User cancelled
        }

        try {
            await this.firebaseManager.resetPin(newPin);
            this.isAdmin = this.firebaseManager.getIsAdmin();
            this.updateAdminUI();
            this.toastManager.success('PIN reset');
        } catch (error) {
            this.toastManager.error('Could not reset PIN');
        }
    }

    copyShareUrl() {
        const shareUrlInput = document.getElementById('shareUrlInput');
        if (shareUrlInput) {
            shareUrlInput.select();
            shareUrlInput.setSelectionRange(0, 99999); // For mobile devices
            
            try {
                document.execCommand('copy');
                this.toastManager.success('Share URL copied to clipboard');
            } catch (err) {
                // Fallback for modern browsers
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrlInput.value).then(() => {
                        this.toastManager.success('Share URL copied to clipboard');
                    }).catch(() => {
                        this.toastManager.error('Failed to copy URL');
                    });
                } else {
                    this.toastManager.error('Failed to copy URL');
                }
            }
        }
    }

    loadSettingsScreen() {
        // Update admin UI when settings screen loads
        this.updateAdminUI();
        this.updateShareUrl();
        
        // Show/hide Firebase-specific UI
        const sharedLeagueSection = document.querySelector('.settings-section h3');
        if (sharedLeagueSection && sharedLeagueSection.textContent === 'Shared League') {
            const section = sharedLeagueSection.parentElement;
            if (this.isFirebaseMode) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        }
        
        // Load other settings as needed
        const darkModeSetting = document.getElementById('darkModeSetting');
        if (darkModeSetting) {
            darkModeSetting.checked = this.settingsManager.isDarkMode();
        }
    }

    // ===== SESSION WIZARD METHODS =====

    loadUiMode() {
        try {
            const saved = this.storage.loadData('uiMode');
            if (saved === 'advanced' || saved === 'session') {
                this.uiMode = saved;
            } else {
                this.uiMode = 'session';
            }
        } catch (e) {
            this.uiMode = 'session';
        }
    }

    setUiMode(mode) {
        if (mode !== 'advanced' && mode !== 'session') return;
        this.uiMode = mode;
        try {
            this.storage.saveData('uiMode', mode);
        } catch (e) {
            // ignore
        }
        this.applyUiMode();
    }

    applyUiMode() {
        const bottomNav = document.querySelector('.bottom-nav');
        const navButtons = document.querySelectorAll('.bottom-nav .nav-btn');
        navButtons.forEach(btn => {
            const screen = btn.dataset.screen;
            if (!screen) return;

            if (this.uiMode === 'session') {
                // Show Session, Stats, and History tabs in session mode
                const allowedScreens = ['sessionScreen', 'statsScreen', 'historyScreen'];
                btn.style.display = allowedScreens.includes(screen) ? 'inline-flex' : 'none';
            } else {
                // Show all tabs in advanced mode
                btn.style.display = 'inline-flex';
            }
        });

        // In session mode, show bottom nav with Session/Stats/History tabs
        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }

        // Header "Session" quick-return button only in advanced mode or session mode on stats/history
        const goToSessionBtn = document.getElementById('goToSessionBtn');
        if (goToSessionBtn) {
            const shouldShow = this.uiMode === 'advanced' ||
                              (this.uiMode === 'session' &&
                               (this.currentScreen === 'statsScreen' || this.currentScreen === 'historyScreen'));
            goToSessionBtn.style.display = shouldShow ? 'inline-flex' : 'none';

            // Save session state when leaving session screen
            if (this.uiMode === 'session' && this.currentScreen !== 'sessionScreen') {
                this.saveSessionState();
            }
        }
    }

    updateBackToSessionButton() {
        // This method is now handled above in applyUiMode
    }

    saveSessionState() {
        if (this.uiMode !== 'session') return;

        const sessionState = {
            wizardStep: this.sessionWizardStep,
            players: [...this.sessionPlayers],
            selectedStructureIndex: this.sessionSelectedStructureIndex,
            selectedStructure: this.sessionSelectedStructure,
            availableStructures: this.sessionAvailableStructures,
            started: this.sessionStarted
        };

        try {
            this.storage.saveData('sessionState', sessionState);
        } catch (e) {
            console.warn('Could not save session state:', e);
        }
    }

    restoreSessionState() {
        if (this.uiMode !== 'session') return;

        try {
            const savedState = this.storage.loadData('sessionState');
            if (savedState) {
                this.sessionWizardStep = savedState.wizardStep || 'players';
                this.sessionPlayers = Array.isArray(savedState.players) ? [...savedState.players] : [];
                this.sessionSelectedStructureIndex = savedState.selectedStructureIndex || null;
                this.sessionSelectedStructure = savedState.selectedStructure || null;
                this.sessionAvailableStructures = Array.isArray(savedState.availableStructures) ? [...savedState.availableStructures] : [];
                this.sessionStarted = savedState.started || false;
            }
        } catch (e) {
            console.warn('Could not restore session state:', e);
        }
    }

    startSessionWizard() {
        this.sessionStarted = true;
        const splash = document.getElementById('sessionSplash');
        const stepper = document.getElementById('sessionStepper');
        const wizard = document.getElementById('sessionWizardContent');
        const actions = document.getElementById('sessionWizardActions');

        if (splash) splash.style.display = 'none';
        if (stepper) stepper.style.display = 'flex';
        if (wizard) wizard.style.display = 'block';
        if (actions) actions.style.display = 'flex';

        this.loadSessionWizard();
    }

    loadSessionWizard() {
        // Ensure wizard UI is visible when loading
        const stepper = document.getElementById('sessionStepper');
        const wizard = document.getElementById('sessionWizardContent');
        const actions = document.getElementById('sessionWizardActions');
        if (stepper) stepper.style.display = 'flex';
        if (wizard) wizard.style.display = 'block';
        if (actions) actions.style.display = 'flex';

        // Restore previous session state if available
        this.restoreSessionState();

        // Only reset if we don't have saved state
        if (!this.sessionStarted) {
            this.resetSessionWizard();
        }

        this.renderCurrentSessionStep();
        this.updateSessionStepper();

        // Save state after loading
        this.saveSessionState();
    }

    resetSessionWizard() {
        this.sessionWizardStep = 'players';
        // Pre-populate with existing players from advanced mode
        this.sessionPlayers = [...this.playerManager.getPlayers()];
        this.sessionSelectedStructure = null;
        this.sessionSelectedStructureIndex = null;
        this.sessionAvailableStructures = [];

        // Reset UI
        document.querySelectorAll('.session-step').forEach(step => {
            step.style.display = 'none';
        });
        document.querySelectorAll('.step-indicator').forEach(indicator => {
            indicator.classList.remove('active', 'completed');
        });
        document.getElementById('sessionPlayersValidation').style.display = 'none';
        document.getElementById('sessionSelectedTeams').style.display = 'none';
        document.getElementById('sessionNextMatchCTA').style.display = 'none';
    }

    updateSessionStepper() {
        // Update step indicators
        const steps = ['players', 'teams', 'match'];
        const currentIndex = steps.indexOf(this.sessionWizardStep);

        steps.forEach((step, index) => {
            const indicator = document.querySelector(`.step-indicator[data-step="${step}"]`);
            if (indicator) {
                indicator.classList.remove('active', 'completed');
                if (index === currentIndex) {
                    indicator.classList.add('active');
                } else if (index < currentIndex) {
                    indicator.classList.add('completed');
                }
            }
        });

        // Show current step content
        document.querySelectorAll('.session-step').forEach(step => {
            step.style.display = 'none';
        });
        const currentStep = document.querySelector(`.session-step[data-step="${this.sessionWizardStep}"]`);
        if (currentStep) {
            currentStep.style.display = 'block';
        }

        // Update continue button text and behavior
        this.updateSessionContinueButton();
    }

    updateSessionContinueButton() {
        const continueBtn = document.getElementById('sessionContinueBtn');
        if (!continueBtn) return;

        let text = 'Continue';
        let disabled = false;

        switch (this.sessionWizardStep) {
            case 'players':
                text = this.sessionPlayers.length >= 2 ? 'Continue' : 'Add Players';
                disabled = this.sessionPlayers.length < 2;
                break;
            case 'teams':
                text = this.sessionSelectedStructureIndex !== null ? 'Start Playing' : 'Select Teams';
                disabled = this.sessionSelectedStructureIndex === null;
                break;
            case 'match':
                text = 'Submit Score';
                disabled = false;
                break;
        }

        continueBtn.textContent = text;
        continueBtn.disabled = disabled;
        continueBtn.style.opacity = disabled ? '0.5' : '1';
    }

    // Step 1: Players
    renderSessionPlayersStep() {
        const playerList = document.getElementById('sessionPlayerList');
        if (!playerList) return;

        playerList.innerHTML = '';

        // Add existing players
        this.sessionPlayers.forEach((player, index) => {
            this.addSessionPlayerInput(player, index);
        });

        // Add empty input for new player
        this.addSessionPlayerInput('', this.sessionPlayers.length);

        this.updateSessionContinueButton();
    }

    addSessionPlayerInput(value, index) {
        const playerList = document.getElementById('sessionPlayerList');
        const playerItem = document.createElement('div');
        playerItem.className = 'session-player-item';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'session-player-input';
        input.placeholder = `Player ${index + 1}`;
        input.value = value;
        input.dataset.index = index;

        input.addEventListener('input', (e) => {
            this.updateSessionPlayer(index, e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addNewSessionPlayerInput();
            }
        });

        playerItem.appendChild(input);

        // Add remove button (except for the last empty input)
        if (index < this.sessionPlayers.length) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'session-remove-player';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                this.removeSessionPlayer(index);
            });
            playerItem.appendChild(removeBtn);
        }

        playerList.appendChild(playerItem);
    }

    updateSessionPlayer(index, value) {
        if (value.trim()) {
            if (index >= this.sessionPlayers.length) {
                this.sessionPlayers.push(value.trim());
                this.addNewSessionPlayerInput();
            } else {
                this.sessionPlayers[index] = value.trim();
            }
        } else if (index < this.sessionPlayers.length) {
            this.sessionPlayers.splice(index, 1);
            this.renderSessionPlayersStep();
        }

        this.updateSessionContinueButton();
        this.saveSessionState();
    }

    removeSessionPlayer(index) {
        this.sessionPlayers.splice(index, 1);
        this.renderSessionPlayersStep();
    }

    addNewSessionPlayerInput() {
        this.addSessionPlayerInput('', this.sessionPlayers.length);
    }

    // Step 2: Teams
    renderSessionTeamsStep() {
        const teamOptions = document.getElementById('sessionTeamOptions');
        if (!teamOptions) return;

        teamOptions.innerHTML = '';

        // Add randomize button at the top
        const randomizeBtn = document.createElement('button');
        randomizeBtn.id = 'sessionRandomizeBtn';
        randomizeBtn.className = 'btn btn-secondary';
        randomizeBtn.textContent = 'Randomize Order';
        randomizeBtn.style.marginBottom = '1rem';
        randomizeBtn.onclick = () => {
            this.randomizeSessionStructures();
        };
        teamOptions.appendChild(randomizeBtn);

        // Add description
        const description = document.createElement('p');
        description.className = 'screen-description';
        description.textContent = 'Select the order you want to play these matches';
        description.style.marginBottom = '1rem';
        teamOptions.appendChild(description);

        // Generate round structures using the same logic as advanced mode
        const players = this.sessionPlayers;
        if (!players || players.length < 2) {
            teamOptions.innerHTML += '<div class="empty-state"><p>Need at least 2 players to generate team structures.</p></div>';
            return;
        }

        // Only generate structures if we don't have them already (preserves randomization)
        if (!this.sessionAvailableStructures || this.sessionAvailableStructures.length === 0) {
            const lockState = {}; // Session wizard doesn't have player locks
            const structures = this.teamGenerator.generateRoundStructures(players, lockState);

            if (structures.length === 0) {
                teamOptions.innerHTML += '<div class="empty-state"><p>Unable to generate round structures.</p></div>';
                return;
            }

            // Store structures for selection
            this.sessionAvailableStructures = structures;
        }

        // Render structures like the advanced team combinations screen
        const structuresHTML = this.sessionAvailableStructures.map((structure, structureIndex) => {
            const isSelected = this.sessionSelectedStructureIndex === structureIndex;

            const matchesHTML = structure.matches.map((match, matchIndex) => {
                const team1Name = this.teamGenerator.formatTeamName(match.team1);
                const team2Name = this.teamGenerator.formatTeamName(match.team2);
                return `
                    <div class="structure-match">
                        <div class="match-round-label">Round ${matchIndex + 1}</div>
                        <div class="team-display">
                            <div class="team-players">
                                ${match.team1.map(p => this.formatPlayerNameWithColor(p)).join('')}
                            </div>
                            <span class="vs">VS</span>
                            <div class="team-players">
                                ${match.team2.map(p => this.formatPlayerNameWithColor(p)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="round-structure-card ${isSelected ? 'selected' : ''}" data-index="${structureIndex}">
                    <div class="structure-header">
                        <h3>Round Structure ${structureIndex + 1}</h3>
                        <button class="select-structure-btn" data-index="${structureIndex}">Select</button>
                    </div>
                    <div class="structure-matches">
                        ${matchesHTML}
                    </div>
                </div>
            `;
        }).join('');

        teamOptions.insertAdjacentHTML('beforeend', structuresHTML);

        // Add click handlers for structure selection
        teamOptions.addEventListener('click', (e) => {
            const selectBtn = e.target.closest('.select-structure-btn');
            if (selectBtn) {
                const index = parseInt(selectBtn.dataset.index);
                if (!isNaN(index)) {
                    this.selectSessionStructureIndex(index);
                }
            }
        });
    }

    selectSessionStructure(structureId) {
        // Update UI selection
        document.querySelectorAll('.session-team-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`.session-team-option[data-structure="${structureId}"]`).classList.add('selected');

        this.sessionSelectedStructure = structureId;
        this.renderSessionSelectedTeams();

        // Auto-advance to match step
        this.saveSessionPlayers();
    }

    randomizeSessionStructures() {
        // Randomly select one structure and advance to match step
        if (this.sessionAvailableStructures && this.sessionAvailableStructures.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.sessionAvailableStructures.length);
            this.selectSessionStructureIndex(randomIndex);
        }
    }

    renderCurrentSessionStep() {
        switch (this.sessionWizardStep) {
            case 'players':
                this.renderSessionPlayersStep();
                break;
            case 'teams':
                this.renderSessionTeamsStep();
                break;
            case 'match':
                this.renderSessionMatchStep();
                break;
            default:
                this.renderSessionPlayersStep();
        }
    }

    selectSessionStructureIndex(index) {
        if (!this.sessionAvailableStructures || index < 0 || index >= this.sessionAvailableStructures.length) {
            return;
        }

        // Update selection
        this.sessionSelectedStructureIndex = index;
        this.sessionSelectedStructure = this.sessionAvailableStructures[index];

        // Update UI
        document.querySelectorAll('.round-structure-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`.round-structure-card[data-index="${index}"]`).classList.add('selected');

        this.renderSessionSelectedTeams();
        this.saveSessionState();

        // Auto-advance to match step
        this.saveSessionPlayers();
    }

    renderSessionSelectedTeams() {
        const selectedTeams = document.getElementById('sessionSelectedTeams');
        const matchPreview = document.getElementById('sessionMatchPreview');

        if (!this.sessionSelectedStructure || !selectedTeams || !matchPreview) return;

        selectedTeams.style.display = 'block';
        matchPreview.innerHTML = '';

        // Display the selected round structure matches
        const matches = this.sessionSelectedStructure.matches || [];

        matches.forEach((match, index) => {
            const matchItem = document.createElement('div');
            matchItem.className = 'session-match-item';

            const team1Display = match.team1.map(p => this.formatPlayerNameWithColor(p)).join('');
            const team2Display = match.team2.map(p => this.formatPlayerNameWithColor(p)).join('');

            matchItem.innerHTML = `
                <div class="match-round-label">Round ${index + 1}</div>
                <div class="team-display">
                    <div class="team-players">${team1Display}</div>
                    <span class="vs">VS</span>
                    <div class="team-players">${team2Display}</div>
                </div>
            `;
            matchPreview.appendChild(matchItem);
        });
    }

    // Step 3: Match
    renderSessionMatchStep() {
        const currentMatch = document.getElementById('sessionCurrentMatch');
        if (!currentMatch) return;

        // Check if we have a selected structure and current match
        if (!this.selectedStructure || !this.selectedStructure.matches || this.currentGameIndex >= this.selectedStructure.matches.length) {
            currentMatch.innerHTML = '<p>No match available</p>';
            return;
        }

        const match = this.selectedStructure.matches[this.currentGameIndex];
        const team1Name = this.teamGenerator.formatTeamName(match.team1);
        const team2Name = this.teamGenerator.formatTeamName(match.team2);
        const team1Display = this.formatTeamWithColors(match.team1);
        const team2Display = this.formatTeamWithColors(match.team2);

        // Store current match for score recording
        this.currentMatch = match;

        currentMatch.innerHTML = `
            <div class="session-match-display">
                <div class="match-info">
                    <div class="game-counter">
                        <span>${this.currentGameIndex + 1}</span> / <span>${this.selectedStructure.matches.length}</span>
                    </div>
                    <div class="match-teams">
                        <div class="team-display">
                            <div class="team-players">${team1Display}</div>
                            <span class="vs">VS</span>
                            <div class="team-players">${team2Display}</div>
                        </div>
                    </div>
                </div>

                <div class="match-result">
                    <h3>Enter Scores</h3>
                    <div class="score-input-container">
                        <div class="score-input-group">
                            <label for="sessionTeam1Score">${team1Name} Score (Full Time)</label>
                            <input type="number" id="sessionTeam1Score" min="0" max="99" value="0" class="score-input">
                        </div>
                        <span class="score-separator">-</span>
                        <div class="score-input-group">
                            <label for="sessionTeam2Score">${team2Name} Score (Full Time)</label>
                            <input type="number" id="sessionTeam2Score" min="0" max="99" value="0" class="score-input">
                        </div>
                    </div>
                    
                    <!-- Extra Time Section -->
                    <div class="extra-time-section" id="sessionExtraTimeSection" style="display: block; margin-top: 1rem;">
                        <label class="checkbox-label">
                            <input type="checkbox" id="sessionWentToExtraTime" class="checkbox-input">
                            <span>Went to Extra Time</span>
                        </label>
                        <p class="score-hint" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0.5rem;">Enter the total score after extra time (full time + extra time goals)</p>
                        <div class="score-input-container" id="sessionExtraTimeScores" style="display: none; margin-top: 0.75rem;">
                            <div class="score-input-group">
                                <label for="sessionTeam1ExtraTimeScore">Team 1 (Total)</label>
                                <input type="number" id="sessionTeam1ExtraTimeScore" min="0" max="99" value="0" class="score-input">
                            </div>
                            <span class="score-separator">-</span>
                            <div class="score-input-group">
                                <label for="sessionTeam2ExtraTimeScore">Team 2 (Total)</label>
                                <input type="number" id="sessionTeam2ExtraTimeScore" min="0" max="99" value="0" class="score-input">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Penalties Section -->
                    <div class="penalties-section" id="sessionPenaltiesSection" style="display: block; margin-top: 1rem;">
                        <label class="checkbox-label">
                            <input type="checkbox" id="sessionWentToPenalties" class="checkbox-input">
                            <span>Went to Penalties</span>
                        </label>
                        <p class="score-hint" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0.5rem;">Enter only the penalties scored (e.g., 5-4)</p>
                        <div class="score-input-container" id="sessionPenaltiesScores" style="display: none; margin-top: 0.75rem;">
                            <div class="score-input-group">
                                <label for="sessionTeam1PenaltiesScore">Team 1 (Pens)</label>
                                <input type="number" id="sessionTeam1PenaltiesScore" min="0" max="20" value="0" class="score-input">
                            </div>
                            <span class="score-separator">-</span>
                            <div class="score-input-group">
                                <label for="sessionTeam2PenaltiesScore">Team 2 (Pens)</label>
                                <input type="number" id="sessionTeam2PenaltiesScore" min="0" max="20" value="0" class="score-input">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners for extra time and penalties checkboxes
        const extraTimeCheckbox = document.getElementById('sessionWentToExtraTime');
        const penaltiesCheckbox = document.getElementById('sessionWentToPenalties');
        
        if (extraTimeCheckbox) {
            extraTimeCheckbox.addEventListener('change', (e) => {
                const extraTimeScores = document.getElementById('sessionExtraTimeScores');
                if (extraTimeScores) {
                    extraTimeScores.style.display = e.target.checked ? 'flex' : 'none';
                    if (e.target.checked) {
                        // Auto-fill with current full time scores as starting point
                        const currentTeam1Score = parseInt(document.getElementById('sessionTeam1Score').value) || 0;
                        const currentTeam2Score = parseInt(document.getElementById('sessionTeam2Score').value) || 0;
                        document.getElementById('sessionTeam1ExtraTimeScore').value = currentTeam1Score;
                        document.getElementById('sessionTeam2ExtraTimeScore').value = currentTeam2Score;
                    }
                }
            });
        }
        
        if (penaltiesCheckbox) {
            penaltiesCheckbox.addEventListener('change', (e) => {
                const penaltiesScores = document.getElementById('sessionPenaltiesScores');
                if (penaltiesScores) {
                    penaltiesScores.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
    }

    // Navigation
    sessionContinue() {
        switch (this.sessionWizardStep) {
            case 'players':
                if (this.sessionPlayers.length >= 2) {
                    this.sessionWizardStep = 'teams';
                    this.renderSessionTeamsStep();
                    this.updateSessionStepper();
                } else {
                    document.getElementById('sessionPlayersValidation').style.display = 'block';
                }
                break;
            case 'teams':
                if (this.sessionSelectedStructure) {
                    // Save players and start the session
                    this.saveSessionPlayers();
                }
                break;
            case 'match':
                this.submitSessionScore();
                break;
        }
    }

    saveSessionPlayers() {
        // Set players in player manager
        this.playerManager.setPlayers(this.sessionPlayers);

        // Generate teams and start games
        this.selectStructure(this.sessionSelectedStructure);
        this.startGames();

        // Advance to match step
        this.sessionWizardStep = 'match';
        this.renderSessionMatchStep();
        this.updateSessionStepper();
    }

    async submitSessionScore() {
        if (!this.currentMatch) {
            this.toastManager.error('No match selected');
            return;
        }

        const team1Score = parseInt(document.getElementById('sessionTeam1Score').value) || 0;
        const team2Score = parseInt(document.getElementById('sessionTeam2Score').value) || 0;

        // Get extra time scores if applicable
        const wentToExtraTime = document.getElementById('sessionWentToExtraTime')?.checked || false;
        let team1ExtraTimeScore = null;
        let team2ExtraTimeScore = null;
        if (wentToExtraTime) {
            team1ExtraTimeScore = parseInt(document.getElementById('sessionTeam1ExtraTimeScore').value) || 0;
            team2ExtraTimeScore = parseInt(document.getElementById('sessionTeam2ExtraTimeScore').value) || 0;
        }

        // Get penalties scores if applicable
        const wentToPenalties = document.getElementById('sessionWentToPenalties')?.checked || false;
        let team1PenaltiesScore = null;
        let team2PenaltiesScore = null;
        if (wentToPenalties) {
            team1PenaltiesScore = parseInt(document.getElementById('sessionTeam1PenaltiesScore').value) || 0;
            team2PenaltiesScore = parseInt(document.getElementById('sessionTeam2PenaltiesScore').value) || 0;
        }

        const { team1, team2 } = this.currentMatch;
        const matchIndex = this.currentGameIndex;
        
        const savedMatch = await this.matchRecorder.recordMatch(
            team1, 
            team2, 
            team1Score, 
            team2Score,
            team1ExtraTimeScore,
            team2ExtraTimeScore,
            team1PenaltiesScore,
            team2PenaltiesScore
        );
        
        if (savedMatch) {
            // Track last recorded match for undo
            this.lastRecordedMatch = { match: savedMatch, gameIndex: matchIndex };

            // Update played dates and stats
            this.updatePlayedDates();
            this.renderCustomStatsSection();

            // Advance to next match or show completion
            this.currentGameIndex++;
            
            if (this.selectedStructure && this.currentGameIndex < this.selectedStructure.matches.length) {
                // More matches to play - show next match CTA (button already exists in HTML)
                document.getElementById('sessionNextMatchCTA').style.display = 'block';
            } else {
                // All matches complete - show completion message
                this.toastManager.success('All matches completed!', 'Session Complete');
                const cta = document.getElementById('sessionNextMatchCTA');
                if (cta) {
                    cta.innerHTML = `
                        <h3>Session Complete!</h3>
                        <p>All matches have been recorded.</p>
                        <button id="sessionNextMatchBtn" class="btn btn-primary">Start New Session</button>
                    `;
                    cta.style.display = 'block';
                    // Re-attach event listener for the new button
                    const btn = document.getElementById('sessionNextMatchBtn');
                    if (btn) {
                        btn.addEventListener('click', () => this.sessionNextMatch());
                    }
                }
                
                // Reset to first match for replay if needed
                this.currentGameIndex = 0;
            }
        } else {
            this.toastManager.error('Error recording match result');
        }
    }

    sessionNextMatch() {
        // Hide CTA
        document.getElementById('sessionNextMatchCTA').style.display = 'none';

        // Check if we're at the end and should start a new session
        if (this.currentGameIndex >= this.selectedStructure.matches.length) {
            // Start a new session
            this.startSessionWizard();
            return;
        }

        // Reset and show next match
        this.renderSessionMatchStep();
    }

    sessionAdvanced() {
        // Navigate to the corresponding advanced screen
        switch (this.sessionWizardStep) {
            case 'players':
                this.showScreen('playerScreen');
                break;
            case 'teams':
                this.showScreen('teamScreen');
                break;
            case 'match':
                this.showScreen('matchScreen');
                break;
        }
    }
}

