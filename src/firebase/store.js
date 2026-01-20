// Firestore-backed data store
import { 
    doc, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDoc, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    where,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseManager, db } from './firebase.js';

class FirebaseStore {
    constructor() {
        this.leagueId = 'default';
        this.listeners = new Map();
        this.cache = {
            matches: [],
            players: [],
            settings: {}
        };
    }

    // League management
    async initializeLeague() {
        try {
            const leagueRef = doc(db, 'leagues', this.leagueId);
            const leagueDoc = await getDoc(leagueRef);
            
            if (!leagueDoc.exists()) {
                // Create new league
                await updateDoc(leagueRef, {
                    createdAt: serverTimestamp(),
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

    async claimAdmin(user) {
        try {
            const leagueRef = doc(db, 'leagues', this.leagueId);
            const leagueDoc = await getDoc(leagueRef);
            
            if (leagueDoc.exists()) {
                const data = leagueDoc.data();
                if (!data.adminUid) {
                    // Claim admin if no admin exists
                    await updateDoc(leagueRef, {
                        adminUid: user.uid
                    });
                    console.log('Admin claimed by:', user.uid);
                    return true;
                }
                
                // Check if current user is admin
                return data.adminUid === user.uid;
            }
            
            return false;
        } catch (error) {
            console.error('Error claiming admin:', error);
            return false;
        }
    }

    setupListeners() {
        // Listen to matches
        const matchesRef = collection(db, 'leagues', this.leagueId, 'matches');
        const matchesQuery = query(matchesRef, orderBy('createdAt', 'desc'));
        
        const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
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
        
        this.listeners.set('matches', unsubscribeMatches);

        // Listen to players
        const playersRef = collection(db, 'leagues', this.leagueId, 'players');
        const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
            this.cache.players = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            if (window.appController) {
                window.appController.onDataChanged('players', this.cache.players);
            }
        });
        
        this.listeners.set('players', unsubscribePlayers);

        // Listen to league settings
        const leagueRef = doc(db, 'leagues', this.leagueId);
        const unsubscribeLeague = onSnapshot(leagueRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                this.cache.settings = data.settings || {};
                
                if (window.appController) {
                    window.appController.onDataChanged('settings', this.cache.settings);
                }
            }
        });
        
        this.listeners.set('league', unsubscribeLeague);
    }

    // Match operations
    async addMatch(matchData) {
        try {
            const matchesRef = collection(db, 'leagues', this.leagueId, 'matches');
            const user = firebaseManager.getCurrentUser();
            
            const docRef = await addDoc(matchesRef, {
                ...matchData,
                createdAt: serverTimestamp(),
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

    async updateMatch(matchId, matchData) {
        try {
            const matchRef = doc(db, 'leagues', this.leagueId, 'matches', matchId);
            await updateDoc(matchRef, matchData);
            console.log('Match updated:', matchId);
            return true;
        } catch (error) {
            console.error('Error updating match:', error);
            throw error;
        }
    }

    async deleteMatch(matchId) {
        try {
            const matchRef = doc(db, 'leagues', this.leagueId, 'matches', matchId);
            await deleteDoc(matchRef);
            console.log('Match deleted:', matchId);
            return true;
        } catch (error) {
            console.error('Error deleting match:', error);
            throw error;
        }
    }

    // Player operations
    async addPlayer(playerData) {
        try {
            const playersRef = collection(db, 'leagues', this.leagueId, 'players');
            const docRef = await addDoc(playersRef, playerData);
            console.log('Player added:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error adding player:', error);
            throw error;
        }
    }

    async updatePlayer(playerId, playerData) {
        try {
            const playerRef = doc(db, 'leagues', this.leagueId, 'players', playerId);
            await updateDoc(playerRef, playerData);
            console.log('Player updated:', playerId);
            return true;
        } catch (error) {
            console.error('Error updating player:', error);
            throw error;
        }
    }

    // Settings operations
    async updateSettings(settings) {
        try {
            const leagueRef = doc(db, 'leagues', this.leagueId);
            await updateDoc(leagueRef, {
                settings: settings
            });
            console.log('Settings updated');
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }

    // Data access methods
    getMatches() {
        return this.cache.matches;
    }

    getPlayers() {
        return this.cache.players;
    }

    getSettings() {
        return this.cache.settings;
    }

    // Check if match is locked for editing
    isMatchLocked(match) {
        if (firebaseManager.getIsAdmin()) {
            return false; // Admin can always edit
        }
        
        if (!match.lockAt) {
            return false; // No lock time set yet
        }
        
        return new Date() > match.lockAt;
    }

    // Check if user can edit a specific match
    canEditMatch(match) {
        return !this.isMatchLocked(match);
    }

    // Get lock status message for UI
    getMatchLockMessage(match) {
        if (firebaseManager.getIsAdmin()) {
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

    // Cleanup
    destroy() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners.clear();
    }
}

// Create and export singleton instance
const firebaseStore = new FirebaseStore();

export { firebaseStore };
