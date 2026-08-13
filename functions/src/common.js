/**
 * Shared plumbing: admin init, caller resolution, audit log, notifications.
 */

const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const { DEFAULT_CLUB_SETTINGS } = require('./shared');

if (admin.apps.length === 0) admin.initializeApp();

const db = admin.firestore();
const { FieldValue } = admin.firestore;

/* ------------------------------------------------------------- callers -- */

/**
 * Resolve the caller to a live, enabled member profile.
 *
 * Every callable starts here. This is where the original design's biggest
 * hole is closed: a suspended member's Firebase Auth credential remained
 * valid, and the only thing stopping them was a client-side check they could
 * simply not run.
 */
const requireMember = async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'No member profile found.');

  const profile = { id: uid, ...snap.data() };
  if (profile.disabled) {
    throw new HttpsError('permission-denied', 'This account has been suspended.');
  }
  return profile;
};

const requireOwner = async (request) => {
  const member = await requireMember(request);
  if (member.role !== 'owner') {
    throw new HttpsError('permission-denied', 'This action is restricted to club administrators.');
  }
  return member;
};

const displayName = (profile) =>
  [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
  profile.email ||
  'Member';

/* ------------------------------------------------------------ settings -- */

let settingsCache = null;
let settingsCachedAt = 0;

/** Club settings, cached for 60s to avoid a read on every booking attempt. */
const getSettings = async (force = false) => {
  const now = Date.now();
  if (!force && settingsCache && now - settingsCachedAt < 60000) return settingsCache;

  const snap = await db.collection('clubSettings').doc('config').get();
  settingsCache = { ...DEFAULT_CLUB_SETTINGS, ...(snap.exists ? snap.data() : {}) };
  settingsCachedAt = now;
  return settingsCache;
};

/* --------------------------------------------------------------- audit -- */

/**
 * Append-only audit entry. Written on every state change that a member could
 * later dispute: bookings, cancellations, results, rating adjustments,
 * suspensions.
 *
 * Deliberately fire-and-forget. An audit failure must never fail the action it
 * is describing, but it is logged loudly so it does not pass unnoticed.
 */
const audit = async ({ actorId, actorName, action, entity, entityId, detail = {} }) => {
  try {
    await db.collection('auditLog').add({
      actorId: actorId || 'system',
      actorName: actorName || 'System',
      action,
      entity,
      entityId,
      detail,
      at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[audit] failed to write entry', { action, entity, entityId, err });
  }
};

/* ------------------------------------------------------- notifications -- */

/**
 * In-app notification. Email and WhatsApp delivery hang off the same records
 * later; writing them now means the history exists when those channels arrive.
 */
const notify = async (recipientId, { title, body, type, link = null, meta = {} }) => {
  if (!recipientId) return;
  try {
    await db.collection('notifications').add({
      recipientId,
      title,
      body,
      type,
      link,
      meta,
      read: false,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[notify] failed', { recipientId, type, err });
  }
};

const notifyMany = (recipientIds, payload) =>
  Promise.all([...new Set(recipientIds.filter(Boolean))].map((id) => notify(id, payload)));

/* ------------------------------------------------------ rating history -- */

/**
 * Record a rating movement.
 *
 * The original app stored only the single most recent change, so a player's
 * rating curve was unrecoverable. Every settlement path must call this.
 */
const recordRatingChange = async (batchOrNull, {
  playerId, before, after, delta, reason, matchId = null, tournamentId = null,
  opponentId = null, opponentRating = null,
}) => {
  const ref = db.collection('ratingHistory').doc();
  const payload = {
    playerId,
    before,
    after,
    delta,
    reason,
    matchId,
    tournamentId,
    opponentId,
    opponentRating,
    at: FieldValue.serverTimestamp(),
  };
  if (batchOrNull) batchOrNull.set(ref, payload);
  else await ref.set(payload);
};

module.exports = {
  admin,
  db,
  FieldValue,
  HttpsError,
  requireMember,
  requireOwner,
  displayName,
  getSettings,
  audit,
  notify,
  notifyMany,
  recordRatingChange,
};
