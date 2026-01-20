// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    GoogleAuthProvider, 
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    getFirestore,
    connectFirestoreEmulator 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Firebase configuration (from user's setup)
const firebaseConfig = {
    apiKey: "AIzaSyCvulsS4GT1haQKbj3NTSb1sflP0nSp6pY",
    authDomain: "fc---score-keeper.firebaseapp.com",
    projectId: "fc---score-keeper",
    storageBucket: "fc---score-keeper.firebasestorage.app",
    messagingSenderId: "990570140768",
    appId: "1:990570140768:web:9e04c7b541d6ec99e05f05",
    measurementId: "G-PG7RECYTW5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

class FirebaseManager {
    constructor() {
        this.app = app;
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.isAdmin = false;
        this.leagueId = 'default'; // For now, use a single default league
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            this.onAuthStateChange(user);
        });
    }

    async initialize() {
        try {
            // Sign in anonymously if not already signed in
            if (!auth.currentUser) {
                await signInAnonymously(auth);
                console.log('Signed in anonymously');
            }
            
            // Check for redirect result (for mobile Google sign-in)
            const result = await getRedirectResult(auth);
            if (result && result.user) {
                console.log('Google sign-in redirect result:', result.user);
                await this.handleAdminClaim(result.user);
            }
            
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return false;
        }
    }

    async signInWithGoogle() {
        try {
            // Use popup on desktop, redirect on mobile
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            let result;
            if (isMobile) {
                // Use redirect for mobile devices (more reliable)
                await signInWithRedirect(auth, googleProvider);
                return; // Result will be handled in initialize()
            } else {
                // Use popup for desktop
                result = await signInWithPopup(auth, googleProvider);
            }
            
            if (result && result.user) {
                console.log('Google sign-in successful:', result.user);
                await this.handleAdminClaim(result.user);
                return result.user;
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    }

    async handleAdminClaim(user) {
        // This will be implemented when we add the Firestore store
        // For now, just set admin status
        this.isAdmin = true;
        console.log('User claimed admin status:', user.uid);
    }

    async signOut() {
        try {
            await signOut(auth);
            this.isAdmin = false;
            console.log('Signed out successfully');
            
            // Sign back in anonymously
            await signInAnonymously(auth);
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

    getLeagueId() {
        return this.leagueId;
    }
}

// Create and export singleton instance
const firebaseManager = new FirebaseManager();

export { firebaseManager, db, auth };
