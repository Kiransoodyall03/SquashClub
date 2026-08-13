/**
 * Constants and scheduling helpers for the Cloud Functions runtime.
 *
 * This is a deliberate duplicate of `src/lib/constants.js` and
 * `src/lib/schedule.js`. Functions are a separate npm package with its own
 * dependency tree and cannot import from the CRA source tree.
 *
 * If you change a status string, a slot ID format, or the rating engine, you
 * must change it in BOTH places. The slot ID format in particular is the
 * double-booking defence — a divergence between client and server there would
 * be silent and severe.
 */

const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
};

const MATCH_STATUS = {
  PENDING_ACCEPTANCE: 'pending_acceptance',
  SCHEDULED: 'scheduled',
  AWAITING_RESULT: 'awaiting_result',
  AWAITING_CONFIRM: 'awaiting_confirm',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

const OWNER_ONLY_BOOKING_TYPES = ['maintenance', 'event', 'league', 'coaching'];

const STARTING_RATING = 1200;
const RATING_FLOOR = 400;

const DEFAULT_CLUB_SETTINGS = {
  clubName: 'Parkview Squash Club',
  slotMinutes: 60,
  openTime: '06:00',
  closeTime: '22:00',
  maxAdvanceDays: 14,
  maxActiveBookingsPerMember: 3,
  maxPeakBookingsPerWeek: 2,
  cancellationCutoffHours: 4,
  noShowGraceMinutes: 15,
  allowWaitlist: true,
  guestsAllowedAtPeak: false,
  autoConfirmResultHours: 72,
  peakWindows: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], from: '17:00', to: '20:00' }],
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* --------------------------------------------------------------- time --- */

const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + (m || 0);
};

const toTime = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const addMinutes = (time, minutes) => toTime(toMinutes(time) + minutes);

const fromDateKey = (dateKey) => {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const weekdayOf = (dateKey) => WEEKDAYS[fromDateKey(dateKey).getDay()];

/**
 * A wall-clock instant in the club's timezone, expressed as a UTC Date.
 *
 * Cloud Functions run in UTC. The club is in Africa/Johannesburg, which is
 * UTC+2 with no daylight saving — so a fixed offset is correct and, unlike a
 * timezone library, cannot drift. If the club ever moves timezone, change
 * CLUB_UTC_OFFSET_HOURS and nothing else.
 */
const CLUB_UTC_OFFSET_HOURS = 2;

const toClubInstant = (dateKey, time) => {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const [hh, mm] = String(time).split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - CLUB_UTC_OFFSET_HOURS, mm || 0, 0, 0));
};

/** Current wall-clock date and time at the club. */
const clubNow = () => {
  const now = new Date();
  const shifted = new Date(now.getTime() + CLUB_UTC_OFFSET_HOURS * 3600000);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 16),
    instant: now,
  };
};

const daysBetween = (fromKey, toKey) =>
  Math.round((fromDateKey(toKey) - fromDateKey(fromKey)) / 86400000);

/* --------------------------------------------------------------- slots --- */

/** MUST match src/lib/schedule.js exactly. */
const slotId = (courtId, dateKey, startTime) =>
  `${courtId}_${String(dateKey).replace(/-/g, '')}_${String(startTime).replace(':', '')}`;

const isCourtOpen = (court, dateKey, startTime, slotMinutes, closures = []) => {
  if (!court || court.status !== 'active') return false;

  const windows = (court.availability && court.availability[weekdayOf(dateKey)]) || [];
  if (windows.length === 0) return false;

  const start = toMinutes(startTime);
  const end = start + slotMinutes;

  const inside = windows.some(
    (w) => start >= toMinutes(w.opens) && end <= toMinutes(w.closes)
  );
  if (!inside) return false;

  if (court.bookableFrom && start < toMinutes(court.bookableFrom)) return false;

  return !closures.some(
    (c) =>
      c.courtId === court.id &&
      dateKey >= c.fromDate &&
      dateKey <= c.toDate &&
      start < toMinutes(c.toTime || '23:59') &&
      end > toMinutes(c.fromTime || '00:00')
  );
};

const isPeak = (dateKey, startTime, peakWindows = []) => {
  const day = weekdayOf(dateKey);
  const start = toMinutes(startTime);
  return peakWindows.some(
    (w) => (w.days || []).includes(day) && start >= toMinutes(w.from) && start < toMinutes(w.to)
  );
};

module.exports = {
  BOOKING_STATUS,
  MATCH_STATUS,
  OWNER_ONLY_BOOKING_TYPES,
  STARTING_RATING,
  RATING_FLOOR,
  DEFAULT_CLUB_SETTINGS,
  WEEKDAYS,
  CLUB_UTC_OFFSET_HOURS,
  toMinutes,
  toTime,
  addMinutes,
  fromDateKey,
  toDateKey,
  weekdayOf,
  toClubInstant,
  clubNow,
  daysBetween,
  slotId,
  isCourtOpen,
  isPeak,
};
