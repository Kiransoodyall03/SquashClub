/**
 * Administrative callables.
 *
 * Role changes and rating adjustments live here specifically because security
 * rules deny them to every client. In the original design a member could write
 * `role: 'owner'` to their own profile, which made the registration password
 * shipped in the JavaScript bundle entirely decorative.
 */

const { onCall } = require('firebase-functions/v2/https');
const {
  db, FieldValue, HttpsError, requireOwner, displayName, audit, notify,
  recordRatingChange, getSettings,
} = require('./common');
const { DEFAULT_CLUB_SETTINGS, RATING_FLOOR } = require('./shared');

const REGION = 'europe-west1';

/* ---------------------------------------------------------- seedCourts -- */

/**
 * Create the club's fifteen courts and the settings document, once.
 *
 * The availability written here is a starting point the owner is expected to
 * edit. It is not a claim about the club's real opening hours — nobody told me
 * what those are, and guessing them into production data would be worse than
 * an obvious placeholder.
 */
exports.seedCourts = onCall({ region: REGION }, async (request) => {
  const owner = await requireOwner(request);
  const { courtCount = 15, force = false } = request.data || {};

  const existing = await db.collection('courts').get();
  if (!existing.empty && !force) {
    throw new HttpsError(
      'already-exists',
      `${existing.size} courts already exist. Pass force to re-seed.`
    );
  }

  const weekdayWindow = [{ opens: '06:00', closes: '22:00' }];
  const weekendWindow = [{ opens: '07:00', closes: '18:00' }];

  const availability = {
    mon: weekdayWindow, tue: weekdayWindow, wed: weekdayWindow,
    thu: weekdayWindow, fri: weekdayWindow,
    sat: weekendWindow, sun: weekendWindow,
  };

  const batch = db.batch();

  for (let n = 1; n <= courtCount; n += 1) {
    const id = `court-${String(n).padStart(2, '0')}`;
    batch.set(db.collection('courts').doc(id), {
      id,
      number: n,
      name: `Court ${n}`,
      status: 'active',
      attributes: [],
      availability,
      // Placeholder for the courts the club said open later in the day. The
      // owner sets the real values in Court Management.
      bookableFrom: null,
      sortOrder: n,
      notes: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const settingsRef = db.collection('clubSettings').doc('config');
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    batch.set(settingsRef, {
      ...DEFAULT_CLUB_SETTINGS,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  await getSettings(true);

  await audit({
    actorId: owner.id, actorName: displayName(owner),
    action: 'courts.seed', entity: 'court', entityId: 'all',
    detail: { courtCount, force },
  });

  return { success: true, created: courtCount };
});

/* ------------------------------------------------------- setMemberRole -- */

exports.setMemberRole = onCall({ region: REGION }, async (request) => {
  const owner = await requireOwner(request);
  const { memberId, role } = request.data || {};

  if (!['player', 'owner'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Role must be player or owner.');
  }
  if (memberId === owner.id && role !== 'owner') {
    // Prevents an administrator locking themselves out, and prevents the club
    // ending up with no administrator at all.
    throw new HttpsError('failed-precondition', 'You cannot remove your own administrator access.');
  }

  const ref = db.collection('users').doc(memberId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such member.');

  const previous = snap.data().role;
  await ref.update({ role, updatedAt: FieldValue.serverTimestamp() });

  await audit({
    actorId: owner.id, actorName: displayName(owner),
    action: 'member.roleChange', entity: 'user', entityId: memberId,
    detail: { from: previous, to: role },
  });

  await notify(memberId, {
    title: 'Your access level changed',
    body: role === 'owner'
      ? 'You now have club administrator access.'
      : 'Your access has been set to member.',
    type: 'member.role',
    link: '/profile',
  });

  return { success: true };
});

/* --------------------------------------------------------- adjustRating -- */

/**
 * Manual rating correction. Exists because results settled from a mistaken
 * score used to be uncorrectable, and there was no way to seed a new member at
 * a realistic rating.
 *
 * Every adjustment is written to rating history with a reason, so the curve
 * shows it rather than presenting an unexplained jump.
 */
exports.adjustRating = onCall({ region: REGION }, async (request) => {
  const owner = await requireOwner(request);
  const { memberId, newRating, reason = '' } = request.data || {};

  const rating = Number(newRating);
  if (!Number.isInteger(rating) || rating < RATING_FLOOR || rating > 3000) {
    throw new HttpsError('invalid-argument', `A rating must be between ${RATING_FLOOR} and 3000.`);
  }
  if (!reason.trim()) {
    throw new HttpsError('invalid-argument', 'A reason is required for a manual adjustment.');
  }

  const ref = db.collection('users').doc(memberId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No such member.');
    const before = snap.data().elo || 1200;

    tx.update(ref, {
      elo: rating,
      lastEloChange: rating - before,
      ratingUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(db.collection('ratingHistory').doc(), {
      playerId: memberId,
      before,
      after: rating,
      delta: rating - before,
      reason: 'adjustment',
      matchId: null,
      tournamentId: null,
      opponentId: null,
      opponentRating: null,
      note: String(reason).slice(0, 300),
      adjustedBy: owner.id,
      at: FieldValue.serverTimestamp(),
    });

    return { before };
  });

  await audit({
    actorId: owner.id, actorName: displayName(owner),
    action: 'rating.adjust', entity: 'user', entityId: memberId,
    detail: { from: result.before, to: rating, reason },
  });

  await notify(memberId, {
    title: 'Your rating was adjusted',
    body: `An administrator set your rating to ${rating}. Reason: ${reason}`,
    type: 'rating.adjusted',
    link: '/profile',
  });

  return { success: true, before: result.before, after: rating };
});
