/**
 * Court bookings.
 *
 * Double-booking is prevented by two mechanisms used together:
 *
 *   1. The booking document ID is deterministic — `court-03_20260813_1800`.
 *      Two members tapping the same slot attempt to create the same document.
 *   2. The create happens inside a Firestore transaction that first reads that
 *      exact document. If it exists and is not cancelled, the transaction
 *      aborts.
 *
 * The second mechanism is what actually guarantees correctness under
 * contention; the first is what makes the check a single cheap read rather
 * than a query over a range.
 *
 * Every client write to `bookings` is denied by security rules, so this is the
 * only path in or out.
 */

const { onCall } = require('firebase-functions/v2/https');
const {
  db, FieldValue, HttpsError, requireMember, displayName,
  getSettings, audit, notify, notifyMany,
} = require('./common');
const {
  BOOKING_STATUS, OWNER_ONLY_BOOKING_TYPES,
  slotId, isCourtOpen, isPeak, toClubInstant, clubNow,
  addMinutes, daysBetween, toMinutes,
} = require('./shared');

const REGION = 'europe-west1';

/* ------------------------------------------------------------- helpers -- */

const loadCourt = async (courtId) => {
  const snap = await db.collection('courts').doc(courtId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'That court does not exist.');
  return { id: snap.id, ...snap.data() };
};

/** Closures that could overlap a given date. Small collection; read whole. */
const loadClosures = async (dateKey) => {
  const snap = await db.collection('courtClosures').where('toDate', '>=', dateKey).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.fromDate <= dateKey);
};

const startOfWeekKey = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
};

/**
 * The booking rules a member must satisfy. Owners bypass all of them —
 * they are running the club, not competing for slots.
 */
const checkMemberRules = async (member, settings, { dateKey, startTime, type, guests }) => {
  if (member.role === 'owner') return;

  if (OWNER_ONLY_BOOKING_TYPES.includes(type)) {
    throw new HttpsError('permission-denied', `Only administrators can create ${type} bookings.`);
  }

  const now = clubNow();

  if (dateKey < now.dateKey || (dateKey === now.dateKey && toMinutes(startTime) < toMinutes(now.time))) {
    throw new HttpsError('failed-precondition', 'That slot is in the past.');
  }

  const ahead = daysBetween(now.dateKey, dateKey);
  if (ahead > settings.maxAdvanceDays) {
    throw new HttpsError(
      'failed-precondition',
      `Bookings open ${settings.maxAdvanceDays} days ahead. That date is not open yet.`
    );
  }

  // Active bookings held at once.
  const active = await db
    .collection('bookings')
    .where('playerIds', 'array-contains', member.id)
    .where('startAt', '>=', new Date())
    .get();

  const activeConfirmed = active.docs
    .map((d) => d.data())
    .filter((b) => b.status === BOOKING_STATUS.CONFIRMED);

  if (activeConfirmed.length >= settings.maxActiveBookingsPerMember) {
    throw new HttpsError(
      'resource-exhausted',
      `You already hold ${activeConfirmed.length} upcoming bookings, which is the limit of ` +
      `${settings.maxActiveBookingsPerMember}. Cancel one to book another.`
    );
  }

  // Peak-time quota, counted per calendar week.
  if (isPeak(dateKey, startTime, settings.peakWindows)) {
    const weekStart = startOfWeekKey(dateKey);
    const weekPeak = activeConfirmed.filter(
      (b) => startOfWeekKey(b.date) === weekStart && isPeak(b.date, b.startTime, settings.peakWindows)
    );
    if (weekPeak.length >= settings.maxPeakBookingsPerWeek) {
      throw new HttpsError(
        'resource-exhausted',
        `You have reached the limit of ${settings.maxPeakBookingsPerWeek} peak-time bookings for that week.`
      );
    }
    if (guests.length > 0 && !settings.guestsAllowedAtPeak) {
      throw new HttpsError('failed-precondition', 'Guests are not permitted during peak hours.');
    }
  }
};

/* -------------------------------------------------------- createBooking -- */

exports.createBooking = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const settings = await getSettings();

  const {
    courtId,
    date: dateKey,
    startTime,
    type = 'casual',
    playerIds = [],
    guests = [],
    notes = '',
  } = request.data || {};

  if (!courtId || !dateKey || !startTime) {
    throw new HttpsError('invalid-argument', 'Court, date and time are all required.');
  }

  const court = await loadCourt(courtId);
  const closures = await loadClosures(dateKey);

  if (!isCourtOpen(court, dateKey, startTime, settings.slotMinutes, closures)) {
    throw new HttpsError('failed-precondition', `${court.name} is not available at that time.`);
  }

  await checkMemberRules(member, settings, { dateKey, startTime, type, guests });

  const endTime = addMinutes(startTime, settings.slotMinutes);
  const startAt = toClubInstant(dateKey, startTime);
  const endAt = toClubInstant(dateKey, endTime);

  // The booker is always on court. Everything else is de-duplicated.
  const allPlayerIds = [...new Set([member.id, ...playerIds.filter(Boolean)])];

  // Resolve names once, so the grid does not need a join to render.
  const playerDocs = await db.getAll(
    ...allPlayerIds.map((id) => db.collection('users').doc(id))
  );
  const players = playerDocs
    .filter((d) => d.exists)
    .map((d) => ({ id: d.id, name: displayName({ id: d.id, ...d.data() }) }));

  const id = slotId(courtId, dateKey, startTime);
  const ref = db.collection('bookings').doc(id);

  const booking = {
    id,
    courtId,
    courtNumber: court.number,
    courtName: court.name,
    date: dateKey,
    startTime,
    endTime,
    startAt,
    endAt,
    type,
    status: BOOKING_STATUS.CONFIRMED,
    bookedBy: member.id,
    bookedByName: displayName(member),
    players,
    playerIds: allPlayerIds,
    guests: guests.map((g) => ({ name: String(g.name || g).slice(0, 60) })),
    notes: String(notes).slice(0, 500),
    isPeak: isPeak(dateKey, startTime, settings.peakWindows),
    matchId: null,
    tournamentId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    cancelledAt: null,
    cancelledBy: null,
  };

  // The uniqueness guarantee.
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && existing.data().status !== BOOKING_STATUS.CANCELLED) {
      throw new HttpsError(
        'already-exists',
        'That slot was taken a moment ago. Please choose another.'
      );
    }
    // Re-using a cancelled slot is legitimate and keeps the ID deterministic.
    tx.set(ref, existing.exists ? { ...booking, rebookedOver: true } : booking);
  });

  await audit({
    actorId: member.id,
    actorName: displayName(member),
    action: 'booking.create',
    entity: 'booking',
    entityId: id,
    detail: { courtId, date: dateKey, startTime, type },
  });

  await notifyMany(
    allPlayerIds.filter((pid) => pid !== member.id),
    {
      title: 'You have been added to a court booking',
      body: `${displayName(member)} booked ${court.name} on ${dateKey} at ${startTime}.`,
      type: 'booking.added',
      link: '/bookings',
      meta: { bookingId: id },
    }
  );

  return { success: true, bookingId: id, booking: { ...booking, startAt: null, endAt: null } };
});

/* -------------------------------------------------------- cancelBooking -- */

exports.cancelBooking = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const settings = await getSettings();
  const { bookingId, reason = '' } = request.data || {};

  if (!bookingId) throw new HttpsError('invalid-argument', 'A booking is required.');

  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That booking no longer exists.');

  const booking = snap.data();
  const isOwner = member.role === 'owner';
  const isParticipant = (booking.playerIds || []).includes(member.id);

  if (!isOwner && !isParticipant) {
    throw new HttpsError('permission-denied', 'That is not your booking.');
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new HttpsError('failed-precondition', 'That booking is already cancelled.');
  }

  // Cancellation cut-off. The owner can always cancel — courts break.
  const startsAt = booking.startAt.toDate ? booking.startAt.toDate() : new Date(booking.startAt);
  const hoursUntil = (startsAt.getTime() - Date.now()) / 3600000;
  const lateCancel = hoursUntil < settings.cancellationCutoffHours;

  if (!isOwner && hoursUntil < 0) {
    throw new HttpsError('failed-precondition', 'That booking has already started.');
  }

  await ref.update({
    status: BOOKING_STATUS.CANCELLED,
    cancelledAt: FieldValue.serverTimestamp(),
    cancelledBy: member.id,
    cancelledByName: displayName(member),
    cancellationReason: String(reason).slice(0, 300),
    // Recorded rather than charged. When billing arrives this is the flag a
    // late-cancellation fee keys off.
    lateCancellation: lateCancel,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await audit({
    actorId: member.id,
    actorName: displayName(member),
    action: 'booking.cancel',
    entity: 'booking',
    entityId: bookingId,
    detail: { lateCancel, hoursUntil: Math.round(hoursUntil * 10) / 10, reason },
  });

  await notifyMany(
    (booking.playerIds || []).filter((pid) => pid !== member.id),
    {
      title: 'Court booking cancelled',
      body: `${displayName(member)} cancelled ${booking.courtName} on ${booking.date} at ${booking.startTime}.`,
      type: 'booking.cancelled',
      link: '/bookings',
      meta: { bookingId },
    }
  );

  // Hand the slot to whoever is waiting for it.
  const promoted = await promoteFromWaitlist(booking);

  return { success: true, lateCancellation: lateCancel, promoted };
});

/* ------------------------------------------------------------ waitlist -- */

/**
 * When a slot frees up, tell the longest-waiting member first.
 *
 * Deliberately a notification rather than an automatic booking: auto-booking
 * someone onto a court they may no longer want creates no-shows, which is the
 * problem the waitlist exists to reduce.
 */
const promoteFromWaitlist = async (booking) => {
  const snap = await db
    .collection('waitlist')
    .where('date', '==', booking.date)
    .where('startTime', '==', booking.startTime)
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (snap.empty) return null;

  const entry = { id: snap.docs[0].id, ...snap.docs[0].data() };
  if (entry.courtId && entry.courtId !== booking.courtId) return null;

  await notify(entry.memberId, {
    title: 'A court has come free',
    body: `${booking.courtName} is now available on ${booking.date} at ${booking.startTime}. First to book takes it.`,
    type: 'waitlist.released',
    link: '/bookings',
    meta: { courtId: booking.courtId, date: booking.date, startTime: booking.startTime },
  });

  await snap.docs[0].ref.delete();
  return entry.memberId;
};

exports.joinWaitlist = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const settings = await getSettings();

  if (!settings.allowWaitlist) {
    throw new HttpsError('failed-precondition', 'The waitlist is currently disabled.');
  }

  const { date: dateKey, startTime, courtId = null } = request.data || {};
  if (!dateKey || !startTime) {
    throw new HttpsError('invalid-argument', 'A date and time are required.');
  }

  const dupe = await db
    .collection('waitlist')
    .where('memberId', '==', member.id)
    .where('date', '==', dateKey)
    .where('startTime', '==', startTime)
    .limit(1)
    .get();

  if (!dupe.empty) {
    throw new HttpsError('already-exists', 'You are already on the waitlist for that slot.');
  }

  const ref = await db.collection('waitlist').add({
    memberId: member.id,
    memberName: displayName(member),
    date: dateKey,
    startTime,
    courtId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, entryId: ref.id };
});

/* ------------------------------------------------------- owner actions -- */

/**
 * Recurring reservations: league nights, coaching blocks, the junior
 * programme. Creates one booking per occurrence and reports the slots it could
 * not take rather than failing the whole run — a partial block is more useful
 * to the owner than an error.
 */
exports.createRecurringBooking = onCall({ region: REGION }, async (request) => {
  const { requireOwner } = require('./common');
  const owner = await requireOwner(request);
  const settings = await getSettings();

  const {
    courtIds = [], startDate, endDate, weekdays = [], startTime,
    type = 'league', notes = '',
  } = request.data || {};

  if (!courtIds.length || !startDate || !endDate || !weekdays.length || !startTime) {
    throw new HttpsError('invalid-argument', 'Courts, a date range, weekdays and a time are required.');
  }

  const { WEEKDAYS } = require('./shared');
  const created = [];
  const skipped = [];

  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);

  if ((last - cursor) / 86400000 > 366) {
    throw new HttpsError('invalid-argument', 'A recurring block may not span more than a year.');
  }

  while (cursor <= last) {
    const dateKey = cursor.toISOString().slice(0, 10);
    if (weekdays.includes(WEEKDAYS[cursor.getUTCDay()])) {
      for (const courtId of courtIds) {
        const id = slotId(courtId, dateKey, startTime);
        const ref = db.collection('bookings').doc(id);
        try {
          // eslint-disable-next-line no-await-in-loop
          await db.runTransaction(async (tx) => {
            const existing = await tx.get(ref);
            if (existing.exists && existing.data().status !== BOOKING_STATUS.CANCELLED) {
              throw new Error('taken');
            }
            const court = { id: courtId };
            tx.set(ref, {
              id,
              courtId,
              courtNumber: null,
              courtName: courtId,
              date: dateKey,
              startTime,
              endTime: addMinutes(startTime, settings.slotMinutes),
              startAt: toClubInstant(dateKey, startTime),
              endAt: toClubInstant(dateKey, addMinutes(startTime, settings.slotMinutes)),
              type,
              status: BOOKING_STATUS.CONFIRMED,
              bookedBy: owner.id,
              bookedByName: displayName(owner),
              players: [],
              playerIds: [],
              guests: [],
              notes,
              isPeak: isPeak(dateKey, startTime, settings.peakWindows),
              recurring: true,
              matchId: null,
              tournamentId: null,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              cancelledAt: null,
              cancelledBy: null,
              _court: court.id,
            });
          });
          created.push(id);
        } catch (err) {
          skipped.push({ id, reason: err.message === 'taken' ? 'already booked' : err.message });
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  await audit({
    actorId: owner.id,
    actorName: displayName(owner),
    action: 'booking.recurring',
    entity: 'booking',
    entityId: `${startDate}..${endDate}`,
    detail: { created: created.length, skipped: skipped.length, type },
  });

  return { success: true, created: created.length, skipped };
});

exports._promoteFromWaitlist = promoteFromWaitlist;
