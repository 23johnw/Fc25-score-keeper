const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const auth = getAuth();

function assertSignedIn(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
}

function assertValidLeagueId(leagueId) {
  if (typeof leagueId !== 'string' || !leagueId.trim()) {
    throw new HttpsError('invalid-argument', 'leagueId is required.');
  }
}

function assertValidPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'PIN must be exactly 4 digits.');
  }
}

function hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const derivedKey = crypto.scryptSync(pin, salt, 32);
  return derivedKey.toString('hex');
}

function newSaltHex() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Cloud Function to set lockAt timestamp when a match is created
 * This ensures matches are locked at midnight UK time server-side
 */
exports.setMatchLockTime = onDocumentCreated(
    'leagues/{leagueId}/matches/{matchId}',
    async (event) => {
        const matchData = event.data.data();
        const matchRef = event.data.ref;
        
        try {
            // Prefer the match's logical timestamp (legacy imports) so old matches lock immediately.
            // Fallback to createdAt if timestamp is missing/invalid.
            let baseDate = null;
            if (matchData.timestamp) {
                const parsed = new Date(matchData.timestamp);
                if (!isNaN(parsed.getTime())) {
                    baseDate = parsed;
                }
            }

            if (!baseDate) {
                const createdAt = matchData.createdAt;
                if (!createdAt || !createdAt.toDate) {
                    console.error('Match has no valid createdAt timestamp');
                    return;
                }
                baseDate = createdAt.toDate();
            }
            
            // Calculate midnight of the same day in Europe/London timezone
            const lockAt = getMidnightOfDayUK(baseDate);
            
            // Update the match with lockAt timestamp
            await matchRef.update({
                lockAt: Timestamp.fromDate(lockAt)
            });
            
            console.log(`Set lockAt for match ${event.params.matchId}: ${lockAt.toISOString()}`);
            
        } catch (error) {
            console.error('Error setting match lock time:', error);
        }
    }
);

/**
 * Calculate the midnight of the same day in Europe/London timezone
 * @param {Date} date - The date to calculate from
 * @returns {Date} - Midnight of the same day in UK time
 */
function getMidnightOfDayUK(date) {
    // Create a new date in UK timezone
    const ukDate = new Date(date.toLocaleString("en-US", { timeZone: "Europe/London" }));

    // Set to midnight of the same day
    const midnightOfDay = new Date(ukDate);
    midnightOfDay.setHours(24, 0, 0, 0); // Set to end of day (midnight next day)

    // Convert back to UTC for storage
    const ukOffset = getUKTimezoneOffset(midnightOfDay);
    const utcMidnight = new Date(midnightOfDay.getTime() - ukOffset);

    return utcMidnight;
}

/**
 * Get the timezone offset for UK at a specific date (handles BST/GMT)
 * @param {Date} date - The date to check
 * @returns {number} - Offset in milliseconds
 */
function getUKTimezoneOffset(date) {
    // Create dates in UTC and UK timezone
    const utc = new Date(date.toISOString());
    const uk = new Date(date.toLocaleString("en-US", { timeZone: "Europe/London" }));
    
    // Calculate the difference
    return uk.getTime() - utc.getTime();
}

/**
 * One-time PIN setup. Only allowed if no PIN is set yet for the league.
 */
exports.setPin = onCall(async (request) => {
  assertSignedIn(request);
  const { leagueId = 'default', pin } = request.data || {};
  assertValidLeagueId(leagueId);
  assertValidPin(pin);

  const leagueRef = db.collection('leagues').doc(leagueId);
  const snap = await leagueRef.get();
  const data = snap.exists ? snap.data() : null;

  if (data && data.adminPinHash) {
    throw new HttpsError('failed-precondition', 'PIN is already set.');
  }

  const saltHex = newSaltHex();
  const pinHash = hashPin(pin, saltHex);

  const adminPinVersion = 1;
  await leagueRef.set(
    {
      adminPinHash: pinHash,
      adminPinSalt: saltHex,
      adminPinSetAt: FieldValue.serverTimestamp(),
      adminPinVersion,
    },
    { merge: true }
  );

  // Grant admin claim to the caller immediately after setting the PIN.
  await auth.setCustomUserClaims(request.auth.uid, {
    admin: true,
    leagueId,
    adminPinVersion,
  });

  return { ok: true, adminPinVersion };
});

/**
 * Verify PIN and grant admin custom claim to the caller UID.
 */
exports.verifyPin = onCall(async (request) => {
  assertSignedIn(request);
  const { leagueId = 'default', pin } = request.data || {};
  assertValidLeagueId(leagueId);
  assertValidPin(pin);

  const leagueRef = db.collection('leagues').doc(leagueId);
  const snap = await leagueRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'League not found.');
  }
  const data = snap.data() || {};
  if (!data.adminPinHash || !data.adminPinSalt) {
    throw new HttpsError('failed-precondition', 'PIN not set yet.');
  }

  const computed = hashPin(pin, data.adminPinSalt);
  if (computed !== data.adminPinHash) {
    throw new HttpsError('permission-denied', 'Incorrect PIN.');
  }

  const adminPinVersion = data.adminPinVersion || 1;
  await auth.setCustomUserClaims(request.auth.uid, {
    admin: true,
    leagueId,
    adminPinVersion,
  });

  return { ok: true, adminPinVersion };
});

/**
 * Reset PIN (admin only).
 */
exports.resetPin = onCall(async (request) => {
  assertSignedIn(request);
  const { leagueId = 'default', newPin } = request.data || {};
  assertValidLeagueId(leagueId);
  assertValidPin(newPin);

  // Require existing admin claim
  const token = request.auth.token || {};
  if (!(token.admin === true && token.leagueId === leagueId)) {
    throw new HttpsError('permission-denied', 'Admin required.');
  }

  const leagueRef = db.collection('leagues').doc(leagueId);
  const snap = await leagueRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'League not found.');
  }
  const data = snap.data() || {};

  const prevVersion = data.adminPinVersion || 1;
  const adminPinVersion = prevVersion + 1;

  const saltHex = newSaltHex();
  const pinHash = hashPin(newPin, saltHex);

  await leagueRef.set(
    {
      adminPinHash: pinHash,
      adminPinSalt: saltHex,
      adminPinSetAt: FieldValue.serverTimestamp(),
      adminPinVersion,
    },
    { merge: true }
  );

  // Refresh admin claim for caller with the new version
  await auth.setCustomUserClaims(request.auth.uid, {
    admin: true,
    leagueId,
    adminPinVersion,
  });

  return { ok: true, adminPinVersion };
});

/**
 * Clear admin status. Only allowed if caller is currently admin.
 */
exports.clearAdmin = onCall(async (request) => {
  assertSignedIn(request);
  const { leagueId = 'default' } = request.data || {};
  assertValidLeagueId(leagueId);

  // Check if caller is currently admin
  const token = request.auth.token || {};
  if (!(token.admin === true && token.leagueId === leagueId)) {
    throw new HttpsError('permission-denied', 'Only admin can clear admin status.');
  }

  // Clear custom claims
  await auth.setCustomUserClaims(request.auth.uid, null);

  return { success: true, message: 'Admin status cleared.' };
});
