# Firebase Deployment Guide

This guide will help you deploy your FC 25 Score Tracker to Firebase with shared data functionality.

## Prerequisites

1. You should have already created a Firebase project called `fc---score-keeper`
2. You should have enabled:
   - **Authentication** with Anonymous and Google providers
   - **Firestore Database**
   - **Firebase Hosting**

## Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

## Step 2: Login to Firebase

```bash
firebase login
```

## Step 3: Initialize Firebase (if not already done)

The project is already configured with:
- `firebase.json` - Firebase configuration
- `.firebaserc` - Project settings
- `firestore.rules` - Database security rules
- `firestore.indexes.json` - Database indexes
- `functions/` - Cloud Functions for match locking

## Step 4: Install Cloud Functions Dependencies

```bash
cd functions
npm install
cd ..
```

## Step 5: Deploy Everything

Deploy hosting, Firestore rules, and Cloud Functions:

```bash
firebase deploy
```

Or deploy individually:

```bash
# Deploy hosting only
firebase deploy --only hosting

# Deploy Firestore rules only
firebase deploy --only firestore

# Deploy Cloud Functions only
firebase deploy --only functions
```

## Step 6: Get Your Share URL

After deployment, your app will be available at:
- `https://fc---score-keeper.web.app`
- `https://fc---score-keeper.firebaseapp.com`

Share either URL in your WhatsApp group!

## Step 7: Test the App

1. **Open the URL** on your phone and a friend's phone
2. **Add some players** and start a match
3. **Record a match** - it should sync between devices
4. **Sign in as admin** in Settings → Data Management
5. **Test editing** - non-admins should only be able to edit today's matches

## Important Notes

### Cloud Functions Billing
- The Cloud Function that locks matches at midnight UK time requires **Blaze billing plan**
- This is usually **free** at your usage level (first 2M invocations/month are free)
- Enable billing in Firebase Console → Settings → Usage and billing

### Admin Access
- The **first person to sign in with Google** becomes the admin
- Admin can edit/delete any match
- Others can only edit matches from today (locked at midnight UK time)

### Data Sync
- All match data is stored in Firestore and syncs in real-time
- Local storage is used as backup/fallback
- Export/Import still works for data backup

## Troubleshooting

### "Permission denied" errors
- Check that Firestore rules deployed correctly: `firebase deploy --only firestore`
- Ensure users are signed in (should happen automatically)

### Cloud Function not working
- Check billing is enabled for Cloud Functions
- View logs: `firebase functions:log`
- Redeploy: `firebase deploy --only functions`

### App not updating
- Clear browser cache
- Check service worker is updating properly

## Commands Reference

```bash
# View live logs
firebase functions:log

# Test functions locally
cd functions && npm run serve

# Check deployment status
firebase projects:list

# View current project
firebase use

# Deploy specific targets
firebase deploy --only hosting,firestore,functions
```

Your app is now ready for shared use! 🎮⚽
