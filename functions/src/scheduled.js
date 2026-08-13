/**
 * Scheduled jobs.
 *
 * All times are Africa/Johannesburg, declared explicitly so the schedule does
 * not silently shift with the runtime's default timezone.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const {
  db, FieldValue, getSettings, audit, notifyMany,
} = require('./common');
const { BOOKING_STATUS, MATCH_STATUS, clubNow, toDateKey } = require('./shared');
const { _settleMatch: settleMatch } = require('./matches');

const REGION = 'europe-west1';
const TZ = 'Africa/Johannesburg';

/* -------------------------------------------------- auto-confirm results */

/**
 * A submitted result that nobody disputed within the window is treated as
 * agreed. Without this, one unresponsive opponent freezes a rating change
 * indefinitely and players stop trusting the ladder.
 *
 * Disputed results have autoConfirmAt cleared, so they can never be swept up
 * by this job.
 */
exports.autoConfirmResults = onSchedule(
  { schedule: 'every 1 hours', timeZone: TZ, region: REGION },
  async () => {
    const due = await db
      .collection('individualMatches')
      .where('status', '==', MATCH_STATUS.AWAITING_CONFIRM)
      .where('autoConfirmAt', '<=', new Date())
      .limit(100)
      .get();

    if (due.empty) return;

    let settled = 0;
    for (const doc of due.docs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await settleMatch(doc.id, { auto: true, confirmedBy: 'system' });
        settled += 1;
      } catch (err) {
        console.error('[autoConfirmResults] failed', doc.id, err.message);
      }
    }
    console.log(`[autoConfirmResults] settled ${settled} of ${due.size}`);
  }
);

/* -------------------------------------------------- close out bookings -- */

/**
 * Mark finished bookings as played, and flag the ones where nobody recorded
 * anything as a possible no-show.
 *
 * A no-show is recorded, not punished. When billing arrives this flag is what
 * a no-show fee keys off; for now it feeds the utilisation analytics, so
 * "booked" and "actually used" stop being the same number.
 */
exports.closeOutBookings = onSchedule(
  { schedule: 'every 2 hours', timeZone: TZ, region: REGION },
  async () => {
    const settings = await getSettings();
    const cutoff = new Date(Date.now() - (settings.noShowGraceMinutes || 15) * 60000);

    const finished = await db
      .collection('bookings')
      .where('status', '==', BOOKING_STATUS.CONFIRMED)
      .where('startAt', '<=', cutoff)
      .limit(400)
      .get();

    if (finished.empty) return;

    const batch = db.batch();
    let played = 0;
    let noShow = 0;

    finished.docs.forEach((doc) => {
      const b = doc.data();
      const endAt = b.endAt && b.endAt.toDate ? b.endAt.toDate() : null;
      if (endAt && endAt > new Date()) return; // still on court

      // A booking counts as played if a match was attached to it, or if it was
      // an administrative block. Casual bookings with no match attached are
      // ambiguous, so they are marked played rather than accused of a no-show —
      // check-in is what will make this precise, and it is on the roadmap.
      const wasUsed = !!b.matchId || b.type !== 'casual';
      batch.update(doc.ref, {
        status: wasUsed ? BOOKING_STATUS.COMPLETED : BOOKING_STATUS.COMPLETED,
        usageKnown: wasUsed,
        closedOutAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (wasUsed) played += 1; else noShow += 1;
    });

    await batch.commit();
    console.log(`[closeOutBookings] closed ${finished.size}: ${played} confirmed used, ${noShow} unverified`);
  }
);

/* ------------------------------------------------------- booking reminders */

exports.sendBookingReminders = onSchedule(
  { schedule: 'every 1 hours', timeZone: TZ, region: REGION },
  async () => {
    const from = new Date(Date.now() + 23 * 3600000);
    const to = new Date(Date.now() + 25 * 3600000);

    const upcoming = await db
      .collection('bookings')
      .where('status', '==', BOOKING_STATUS.CONFIRMED)
      .where('startAt', '>=', from)
      .where('startAt', '<=', to)
      .get();

    for (const doc of upcoming.docs) {
      const b = doc.data();
      if (b.reminderSentAt) continue;
      // eslint-disable-next-line no-await-in-loop
      await notifyMany(b.playerIds || [], {
        title: 'Court booked tomorrow',
        body: `${b.courtName} at ${b.startTime} on ${b.date}.`,
        type: 'booking.reminder',
        link: '/bookings',
        meta: { bookingId: doc.id },
      });
      // eslint-disable-next-line no-await-in-loop
      await doc.ref.update({ reminderSentAt: FieldValue.serverTimestamp() });
    }
  }
);

/* ------------------------------------------------------ analytics rollup */

/**
 * Nightly rollup into `analyticsDaily/{YYYY-MM-DD}`.
 *
 * The owner dashboard reads these pre-aggregated documents rather than
 * scanning the booking collection on every page load. One document per day
 * keeps a year of history to 365 reads for any chart.
 */
exports.rollUpDailyAnalytics = onSchedule(
  { schedule: '15 1 * * *', timeZone: TZ, region: REGION },
  async () => {
    const now = clubNow();
    const yesterday = new Date(`${now.dateKey}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateKey = yesterday.toISOString().slice(0, 10);

    const [bookingsSnap, courtsSnap, matchesSnap] = await Promise.all([
      db.collection('bookings').where('date', '==', dateKey).get(),
      db.collection('courts').get(),
      db.collection('individualMatches')
        .where('status', '==', MATCH_STATUS.COMPLETED)
        .where('completedAt', '>=', new Date(`${dateKey}T00:00:00Z`))
        .where('completedAt', '<', new Date(`${dateKey}T23:59:59Z`))
        .get(),
    ]);

    const bookings = bookingsSnap.docs.map((d) => d.data());
    const activeCourts = courtsSnap.docs.filter((d) => d.data().status === 'active');

    const confirmed = bookings.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);
    const cancelled = bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED);
    const lateCancelled = cancelled.filter((b) => b.lateCancellation);

    // Slots offered = sum of each active court's open hours for that weekday.
    const settings = await getSettings();
    const { toMinutes, weekdayOf } = require('./shared');
    const weekday = weekdayOf(dateKey);

    let slotsOffered = 0;
    activeCourts.forEach((doc) => {
      const windows = (doc.data().availability || {})[weekday] || [];
      windows.forEach((w) => {
        slotsOffered += Math.floor((toMinutes(w.closes) - toMinutes(w.opens)) / settings.slotMinutes);
      });
    });

    const byCourt = {};
    const byHour = {};
    confirmed.forEach((b) => {
      byCourt[b.courtId] = (byCourt[b.courtId] || 0) + 1;
      const hour = String(b.startTime).slice(0, 2);
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    const uniquePlayers = new Set();
    confirmed.forEach((b) => (b.playerIds || []).forEach((id) => uniquePlayers.add(id)));

    await db.collection('analyticsDaily').doc(dateKey).set({
      date: dateKey,
      weekday,
      slotsOffered,
      slotsBooked: confirmed.length,
      utilisation: slotsOffered > 0 ? confirmed.length / slotsOffered : 0,
      peakBooked: confirmed.filter((b) => b.isPeak).length,
      cancellations: cancelled.length,
      lateCancellations: lateCancelled.length,
      guestCount: confirmed.reduce((n, b) => n + (b.guests || []).length, 0),
      byCourt,
      byHour,
      byType: confirmed.reduce((acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
      }, {}),
      distinctPlayers: uniquePlayers.size,
      matchesCompleted: matchesSnap.size,
      rankedMatches: matchesSnap.docs.filter((d) => d.data().matchMode === 'ranked').length,
      activeCourts: activeCourts.length,
      generatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[rollUpDailyAnalytics] ${dateKey}: ${confirmed.length}/${slotsOffered} slots`);
  }
);

/* --------------------------------------------- stale tournament sweeper */

/**
 * The original code flipped any past tournament to `completed` on read,
 * without settling it — which permanently stranded everyone's rating change.
 * That behaviour is removed; instead, an unsettled tournament past its date
 * nags the owner until they close it out properly.
 */
exports.flagUnsettledTournaments = onSchedule(
  { schedule: '0 9 * * *', timeZone: TZ, region: REGION },
  async () => {
    const now = clubNow();
    const stale = await db
      .collection('tournaments')
      .where('status', 'in', ['upcoming', 'active'])
      .get();

    const overdue = stale.docs.filter((d) => (d.data().date || '9999-12-31') < now.dateKey);
    if (overdue.length === 0) return;

    const owners = await db.collection('users').where('role', '==', 'owner').get();

    await notifyMany(owners.docs.map((d) => d.id), {
      title: `${overdue.length} tournament(s) need closing out`,
      body: 'Ratings are not awarded until a tournament is completed. Open each one and finish it.',
      type: 'tournament.unsettled',
      link: '/tournaments',
      meta: { ids: overdue.map((d) => d.id) },
    });

    await audit({
      action: 'tournament.unsettledFlagged',
      entity: 'tournament',
      entityId: 'sweep',
      detail: { count: overdue.length, ids: overdue.map((d) => d.id) },
    });
  }
);
