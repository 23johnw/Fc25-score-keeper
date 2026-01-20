// Simple Firebase integration using compat library
class SimpleFirebaseManager {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.functions = firebase.app().functions();
        this.currentUser = null;
        this.isAdmin = false;
        this.leagueId = 'default';
        this.adminPinVersion = null;
        
        // Listen for auth state changes
        this.auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            await this.refreshAdminStatus(user);
            this.onAuthStateChange(user);
        });
    }

    async initialize() {
        try {
            // Sign in anonymously if not already signed in
            if (!this.auth.currentUser) {
                await this.auth.signInAnonymously();
                console.log('Signed in anonymously');
            }

            // Ensure admin status is correct for the current user
            await this.refreshAdminStatus(this.auth.currentUser);
            
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return false;
        }
    }

    async refreshAdminStatus(user) {
        try {
            if (!user) {
                this.isAdmin = false;
                return;
            }
            const tokenResult = await user.getIdTokenResult(true);
            const claims = tokenResult && tokenResult.claims ? tokenResult.claims : {};
            this.isAdmin = claims.admin === true && claims.leagueId === this.leagueId;
            this.adminPinVersion = claims.adminPinVersion || null;
        } catch (error) {
            console.error('Error refreshing admin status:', error);
            this.isAdmin = false;
        }
    }

    async setPin(pin) {
        const callable = this.functions.httpsCallable('setPin');
        const res = await callable({ leagueId: this.leagueId, pin: String(pin) });
        // Force refresh claims
        await this.auth.currentUser.getIdToken(true);
        await this.refreshAdminStatus(this.auth.currentUser);
        return res.data;
    }

    async verifyPin(pin) {
        const callable = this.functions.httpsCallable('verifyPin');
        const res = await callable({ leagueId: this.leagueId, pin: String(pin) });
        await this.auth.currentUser.getIdToken(true);
        await this.refreshAdminStatus(this.auth.currentUser);
        return res.data;
    }

    async resetPin(newPin) {
        const callable = this.functions.httpsCallable('resetPin');
        const res = await callable({ leagueId: this.leagueId, newPin: String(newPin) });
        await this.auth.currentUser.getIdToken(true);
        await this.refreshAdminStatus(this.auth.currentUser);
        return res.data;
    }

    async clearAdmin() {
        const callable = this.functions.httpsCallable('clearAdmin');
        const res = await callable({ leagueId: this.leagueId });
        
        // Force token refresh and update admin status
        await this.auth.currentUser.getIdToken(true);
        this.isAdmin = false; // Immediately update local state
        await this.refreshAdminStatus(this.auth.currentUser);
        
        // Notify the app about the change
        this.onAuthStateChange(this.auth.currentUser);
        
        return res.data;
    }

    async signOut() {
        try {
            await this.auth.signOut();
            this.isAdmin = false;
            console.log('Signed out successfully');
            
            // Sign back in anonymously
            await this.auth.signInAnonymously();
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    onAuthStateChange(user) {
        // Notify the app about auth state changes
        if (window.appController) {
            window.appController.onAuthStateChanged(user, this.isAdmin);
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getIsAdmin() {
        return this.isAdmin;
    }

    getAdminPinVersion() {
        return this.adminPinVersion;
    }

    getLeagueId() {
        return this.leagueId;
    }
}

class SimpleFirebaseStore {
    constructor() {
        this.db = firebase.firestore();
        this.leagueId = 'default';
        this.listeners = [];
        this.cache = {
            matches: [],
            players: [],
            settings: {}
        };
    }

    async initializeLeague() {
        try {
            const leagueRef = this.db.collection('leagues').doc(this.leagueId);
            const leagueDoc = await leagueRef.get();
            
            if (!leagueDoc.exists) {
                // Create new league
                await leagueRef.set({
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    adminUid: null,
                    settings: {
                        pointsPerResult: { win: 1, draw: 1, loss: 0 },
                        labels: { home: 'Home', away: 'Away', neutral: 'Neutral' }
                    }
                });
                console.log('Created new league:', this.leagueId);
            }
            
            // Set up real-time listeners
            this.setupListeners();
            
            return true;
        } catch (error) {
            console.error('Error initializing league:', error);
            return false;
        }
    }

    setupListeners() {
        // Listen to matches
        const matchesRef = this.db.collection('leagues').doc(this.leagueId).collection('matches');
        const matchesQuery = matchesRef.orderBy('createdAt', 'desc');
        
        const unsubscribeMatches = matchesQuery.onSnapshot((snapshot) => {
            this.cache.matches = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Convert Firestore timestamps to JS dates
                createdAt: doc.data().createdAt?.toDate(),
                lockAt: doc.data().lockAt?.toDate()
            }));
            
            // Notify app of data changes
            if (window.appController) {
                window.appController.onDataChanged('matches', this.cache.matches);
            }
        });
        
        // Listen to league settings (includes active player list)
        const leagueRef = this.db.collection('leagues').doc(this.leagueId);
        const unsubscribeLeague = leagueRef.onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                this.cache.players = data.activePlayers || [];
                
                // Notify app of player changes
                if (window.appController) {
                    window.appController.onDataChanged('activePlayers', this.cache.players);
                }
            }
        });
        
        this.listeners.push(unsubscribeMatches, unsubscribeLeague);
    }

    async addMatch(matchData) {
        try {
            const matchesRef = this.db.collection('leagues').doc(this.leagueId).collection('matches');
            const user = firebase.auth().currentUser;
            
            const docRef = await matchesRef.add({
                ...matchData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: user?.uid || 'anonymous',
                lockAt: null // Will be set by Cloud Function
            });
            
            console.log('Match added:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error adding match:', error);
            throw error;
        }
    }

    _safeDocIdFromTimestamp(timestamp) {
        const ts = typeof timestamp === 'string' ? timestamp : '';
        const compact = ts.replace(/[^0-9]/g, '').slice(0, 20);
        // fallback random-ish suffix if timestamp is missing
        const suffix = compact || String(Date.now());
        return `legacy_${suffix}`;
    }

    /**
     * Import legacy/local matches into Firebase.
     * - Uses deterministic doc IDs derived from timestamp to reduce duplicates
     * - Does NOT delete existing matches
     * - Skips matches whose timestamp already exists in current cache
     */
    async importLegacyMatches(legacyMatches = []) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) throw new Error('Not signed in');

            const matches = Array.isArray(legacyMatches) ? legacyMatches : [];
            const existingTimestamps = new Set(
                (this.cache.matches || [])
                    .map(m => m && m.timestamp)
                    .filter(Boolean)
            );

            const toImport = matches.filter(m => m && m.timestamp && !existingTimestamps.has(m.timestamp));
            if (toImport.length === 0) {
                return { imported: 0, skipped: matches.length };
            }

            const matchesRef = this.db.collection('leagues').doc(this.leagueId).collection('matches');
            const batch = this.db.batch();

            let imported = 0;
            let skipped = matches.length - toImport.length;

            toImport.forEach((m) => {
                const docId = this._safeDocIdFromTimestamp(m.timestamp);
                const ref = matchesRef.doc(docId);

                // Normalize arrays + optional ET/Pens fields
                const team1 = Array.isArray(m.team1) ? m.team1 : [m.team1].filter(Boolean);
                const team2 = Array.isArray(m.team2) ? m.team2 : [m.team2].filter(Boolean);

                // Validate and fix timestamp if it's clearly wrong (only future dates are invalid)
                let validTimestamp = m.timestamp;
                if (m.timestamp) {
                    const timestampDate = new Date(m.timestamp);
                    const now = new Date();

                    // Only fix future timestamps (matches can't be from the future)
                    if (timestampDate > now) {
                        console.warn('Future timestamp detected, using import time:', m.timestamp);
                        validTimestamp = now.toISOString();
                    }
                }

                const payload = {
                    team1,
                    team2,
                    team1Score: Number.isFinite(m.team1Score) ? m.team1Score : parseInt(m.team1Score) || 0,
                    team2Score: Number.isFinite(m.team2Score) ? m.team2Score : parseInt(m.team2Score) || 0,
                    result: m.result || 'draw',
                    timestamp: validTimestamp,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: user.uid,
                    lockAt: null, // Cloud Function will set based on timestamp
                    importedFrom: 'legacyBackup'
                };

                if (m.team1ExtraTimeScore !== undefined && m.team2ExtraTimeScore !== undefined) {
                    payload.team1ExtraTimeScore = parseInt(m.team1ExtraTimeScore) || 0;
                    payload.team2ExtraTimeScore = parseInt(m.team2ExtraTimeScore) || 0;
                }
                if (m.team1PenaltiesScore !== undefined && m.team2PenaltiesScore !== undefined) {
                    payload.team1PenaltiesScore = parseInt(m.team1PenaltiesScore) || 0;
                    payload.team2PenaltiesScore = parseInt(m.team2PenaltiesScore) || 0;
                }

                batch.set(ref, payload, { merge: false });
                imported++;
            });

            await batch.commit();
            return { imported, skipped };
        } catch (error) {
            console.error('Error importing legacy matches:', error);
            throw error;
        }
    }

    async updateMatch(matchId, matchData) {
        try {
            const matchRef = this.db.collection('leagues').doc(this.leagueId).collection('matches').doc(matchId);
            await matchRef.update(matchData);
            console.log('Match updated:', matchId);
            return true;
        } catch (error) {
            console.error('Error updating match:', error);
            throw error;
        }
    }

    async deleteMatch(matchId) {
        try {
            const matchRef = this.db.collection('leagues').doc(this.leagueId).collection('matches').doc(matchId);
            await matchRef.delete();
            console.log('Match deleted:', matchId);
            return true;
        } catch (error) {
            console.error('Error deleting match:', error);
            throw error;
        }
    }

    async wipeLeagueData() {
        // Requires admin for locked match deletes (rules-enforced).
        try {
            const leagueRef = this.db.collection('leagues').doc(this.leagueId);
            const matchesRef = leagueRef.collection('matches');

            // Delete matches in pages (Firestore batch limit 500)
            let deleted = 0;
            while (true) {
                const snap = await matchesRef.orderBy('createdAt', 'desc').limit(400).get();
                if (snap.empty) break;

                const batch = this.db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                deleted += snap.size;

                // Small yield to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Reset league doc fields (do NOT delete the league doc)
            await leagueRef.set({
                activePlayers: [],
                activePlayersUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                settings: {
                    pointsPerResult: { win: 1, draw: 1, loss: 0 },
                    labels: { home: 'Home', away: 'Away', neutral: 'Neutral' }
                }
            }, { merge: true });

            return { deletedMatches: deleted };
        } catch (error) {
            console.error('Error wiping league data:', error);
            throw error;
        }
    }

    getMatches() {
        return this.cache.matches;
    }

    async saveActivePlayers(players) {
        try {
            const leagueRef = this.db.collection('leagues').doc(this.leagueId);
            await leagueRef.update({
                activePlayers: players,
                activePlayersUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error saving active players:', error);
            throw error;
        }
    }

    getActivePlayers() {
        return this.cache.players || [];
    }

    isMatchLocked(match) {
        if (window.firebaseManager && window.firebaseManager.getIsAdmin()) {
            return false; // Admin can always edit
        }
        
        if (!match.lockAt) {
            return false; // No lock time set yet
        }
        
        return new Date() > match.lockAt;
    }

    canEditMatch(match) {
        return !this.isMatchLocked(match);
    }

    getMatchLockMessage(match) {
        if (window.firebaseManager && window.firebaseManager.getIsAdmin()) {
            return null; // Admin can always edit
        }
        
        if (!match.lockAt) {
            return null; // No restrictions
        }
        
        if (this.isMatchLocked(match)) {
            return 'This match is locked. Sign in as admin to edit past matches.';
        }
        
        return null;
    }

    destroy() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners = [];
    }
}

// Create and expose instances globally
window.firebaseManager = new SimpleFirebaseManager();
window.firebaseStore = new SimpleFirebaseStore();
window.firebaseReady = true;

console.log('Simple Firebase manager initialized');
