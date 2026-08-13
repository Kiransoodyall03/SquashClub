/**
 * Scheduling primitives shared by courts, bookings and tournament scheduling.
 *
 * Two rules govern everything in this file:
 *
 * 1. Wall-clock values ("2026-08-13", "18:00") are the source of truth, not
 *    Date objects. The original codebase parsed "2026-08-13" with `new Date()`,
 *    which yields UTC midnight, then applied local hours on top — so every
 *    boundary fired two hours early in South Africa. Strings avoid that class
 *    of bug entirely. Timestamps are derived for querying only.
 *
 * 2. A slot is identified by (courtId, date, startTime). That triple is what
 *    makes a booking document ID deterministic, which is what makes
 *    double-booking impossible at the database rather than in application code.
 */

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const WEEKDAY_LABELS = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

export const WEEKDAY_SHORT = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
};

/* ------------------------------------------------------------------ dates */

/** 'YYYY-MM-DD' for a Date, in local time. Never use toISOString() for this. */
export const toDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Parse 'YYYY-MM-DD' into a local-midnight Date. */
export const fromDateKey = (dateKey) => {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toDateKey(new Date());

export const addDays = (dateKey, days) => {
  const d = fromDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

export const weekdayOf = (dateKey) => WEEKDAYS[fromDateKey(dateKey).getDay()];

/** Monday-first start of the week containing dateKey. */
export const startOfWeek = (dateKey) => {
  const d = fromDateKey(dateKey);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toDateKey(d);
};

export const weekDates = (startKey) =>
  Array.from({ length: 7 }, (_, i) => addDays(startKey, i));

export const daysBetween = (fromKey, toKey) =>
  Math.round((fromDateKey(toKey) - fromDateKey(fromKey)) / 86400000);

export const formatDateKey = (dateKey, opts = { day: 'numeric', month: 'short' }) =>
  fromDateKey(dateKey).toLocaleDateString(undefined, opts);

/* ------------------------------------------------------------------ times */

/** '18:30' -> 1110 */
export const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + (m || 0);
};

/** 1110 -> '18:30' */
export const toTime = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const addMinutes = (time, minutes) => toTime(toMinutes(time) + minutes);

/** A real Date for a (dateKey, time) pair, in local time. */
export const toDateTime = (dateKey, time) => {
  const d = fromDateKey(dateKey);
  const [h, m] = String(time).split(':').map(Number);
  d.setHours(h, m || 0, 0, 0);
  return d;
};

export const isPast = (dateKey, time) => toDateTime(dateKey, time) < new Date();

/* ------------------------------------------------------------------ slots */

/**
 * Every slot the club could theoretically offer on a given day, ignoring
 * court availability. Used to build the row axis of the booking grid.
 */
export const buildSlotAxis = (openTime, closeTime, slotMinutes) => {
  const slots = [];
  const end = toMinutes(closeTime);
  for (let t = toMinutes(openTime); t + slotMinutes <= end; t += slotMinutes) {
    slots.push(toTime(t));
  }
  return slots;
};

/**
 * Is this court open for this slot?
 *
 * Checks, in order: court status, the weekday availability windows, the
 * court's own `bookableFrom` floor (the courts that only free up later in
 * the day), and any closure covering the slot.
 */
export const isCourtOpen = (court, dateKey, startTime, slotMinutes, closures = []) => {
  if (!court || court.status !== 'active') return false;

  const windows = court.availability?.[weekdayOf(dateKey)] || [];
  if (windows.length === 0) return false;

  const start = toMinutes(startTime);
  const end = start + slotMinutes;

  const insideWindow = windows.some(
    (w) => start >= toMinutes(w.opens) && end <= toMinutes(w.closes)
  );
  if (!insideWindow) return false;

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

/** The reason a slot is not open, for display. Returns null when it is open. */
export const closedReason = (court, dateKey, startTime, slotMinutes, closures = []) => {
  if (!court) return 'Unknown court';
  if (court.status === 'maintenance') return 'Court under maintenance';
  if (court.status === 'retired') return 'Court retired';

  const start = toMinutes(startTime);
  const closure = closures.find(
    (c) =>
      c.courtId === court.id &&
      dateKey >= c.fromDate &&
      dateKey <= c.toDate &&
      start < toMinutes(c.toTime || '23:59') &&
      start + slotMinutes > toMinutes(c.fromTime || '00:00')
  );
  if (closure) return closure.reason || 'Court closed';

  if (court.bookableFrom && start < toMinutes(court.bookableFrom)) {
    return `Opens at ${court.bookableFrom}`;
  }

  const windows = court.availability?.[weekdayOf(dateKey)] || [];
  if (windows.length === 0) return 'Closed today';

  return 'Outside opening hours';
};

/* -------------------------------------------------------------- peak time */

export const isPeak = (dateKey, startTime, peakWindows = []) => {
  const day = weekdayOf(dateKey);
  const start = toMinutes(startTime);
  return peakWindows.some(
    (w) =>
      (w.days || []).includes(day) &&
      start >= toMinutes(w.from) &&
      start < toMinutes(w.to)
  );
};

/* ----------------------------------------------------------- identifiers */

/**
 * The deterministic booking document ID.
 *
 * `court-03_20260813_1800`
 *
 * This is the whole double-booking defence. Two members tapping the same slot
 * both attempt to create the same document ID; exactly one create succeeds.
 * Never change this format without a migration — existing bookings would
 * become invisible to conflict checks.
 */
export const slotId = (courtId, dateKey, startTime) =>
  `${courtId}_${String(dateKey).replace(/-/g, '')}_${String(startTime).replace(':', '')}`;

export const parseSlotId = (id) => {
  const [courtId, date, time] = String(id).split('_');
  if (!courtId || !date || !time) return null;
  return {
    courtId,
    dateKey: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    startTime: `${time.slice(0, 2)}:${time.slice(2, 4)}`,
  };
};
