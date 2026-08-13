/**
 * Domain constants.
 *
 * Several of these strings are load-bearing beyond JavaScript: booking and
 * match statuses are used to build CSS class names at render time
 * (`badge badge-${status}`), and they are duplicated in `functions/src/shared.js`
 * for the Cloud Functions runtime. Changing a value here means changing it in
 * three places: this file, the functions copy, and `src/App/App.css`.
 */

/* ------------------------------------------------------------------ roles */

export const ROLES = { PLAYER: 'player', OWNER: 'owner' };

/* ----------------------------------------------------------------- courts */

export const COURT_STATUS = {
  ACTIVE: 'active',
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired',
};

export const COURT_STATUS_LABELS = {
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

export const COURT_ATTRIBUTES = [
  { value: 'glass_back', label: 'Glass back' },
  { value: 'show_court', label: 'Show court' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'air_conditioned', label: 'Air conditioned' },
  { value: 'viewing_gallery', label: 'Viewing gallery' },
];

/* --------------------------------------------------------------- bookings */

export const BOOKING_TYPE = {
  CASUAL: 'casual',
  TOURNAMENT: 'tournament',
  LEAGUE: 'league',
  COACHING: 'coaching',
  MAINTENANCE: 'maintenance',
  EVENT: 'event',
};

export const BOOKING_TYPE_LABELS = {
  casual: 'Casual play',
  tournament: 'Tournament',
  league: 'League',
  coaching: 'Coaching',
  maintenance: 'Maintenance',
  event: 'Club event',
};

/** Types only an owner may create. Members can create casual bookings only. */
export const OWNER_ONLY_BOOKING_TYPES = ['maintenance', 'event', 'league', 'coaching'];

export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
};

export const BOOKING_STATUS_LABELS = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Played',
  no_show: 'No show',
};

/* ---------------------------------------------------------------- matches */

/**
 * The individual-match lifecycle, rebuilt around two-sided confirmation.
 *
 *   pending_acceptance -> the opponent has been challenged, not yet answered
 *   scheduled          -> everyone accepted; the match is on
 *   awaiting_result    -> the scheduled time has passed, no score entered
 *   awaiting_confirm   -> one side entered a score, the other must confirm
 *   completed          -> confirmed; ratings applied
 *   disputed           -> the other side rejected the score; owner resolves
 *   declined           -> the opponent said no
 *   cancelled          -> withdrawn before completion
 *
 * `pending` and `in-progress` from the original schema are migrated to
 * `pending_acceptance` and `scheduled` respectively.
 */
export const MATCH_STATUS = {
  PENDING_ACCEPTANCE: 'pending_acceptance',
  SCHEDULED: 'scheduled',
  AWAITING_RESULT: 'awaiting_result',
  AWAITING_CONFIRM: 'awaiting_confirm',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

export const MATCH_STATUS_LABELS = {
  pending_acceptance: 'Awaiting acceptance',
  scheduled: 'Scheduled',
  awaiting_result: 'Awaiting result',
  awaiting_confirm: 'Awaiting confirmation',
  completed: 'Completed',
  disputed: 'Disputed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  /* legacy values, still present on historical documents */
  pending: 'Awaiting acceptance',
  'in-progress': 'Scheduled',
};

/** Badge modifier per match status. Keeps colour out of the components. */
export const MATCH_STATUS_TONE = {
  pending_acceptance: 'pending',
  scheduled: 'upcoming',
  awaiting_result: 'pending',
  awaiting_confirm: 'pending',
  completed: 'completed',
  disputed: 'cancelled',
  declined: 'cancelled',
  cancelled: 'cancelled',
  pending: 'pending',
  'in-progress': 'upcoming',
};

export const PARTICIPANT_RESPONSE = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

export const CONFIRMATION_RESPONSE = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed',
};

export const MATCH_MODE = { RANKED: 'ranked', CASUAL: 'casual' };
export const MATCH_TYPE = { SINGLES: '1v1', DOUBLES: '2v2' };

/* ---------------------------------------------------------------- ratings */

export const STARTING_RATING = 1200;

/** Ratings may not fall below this. The original system allowed negatives. */
export const RATING_FLOOR = 400;

export const RATING_TIERS = [
  { min: 1800, label: 'Master' },
  { min: 1600, label: 'Expert' },
  { min: 1400, label: 'Advanced' },
  { min: 1200, label: 'Intermediate' },
  { min: 0, label: 'Beginner' },
];

export const ratingTier = (rating) =>
  (RATING_TIERS.find((t) => (rating || 0) >= t.min) || RATING_TIERS[RATING_TIERS.length - 1]).label;

export const RATING_REASON = {
  MATCH: 'match',
  TOURNAMENT: 'tournament',
  ADJUSTMENT: 'adjustment',
};

/* ------------------------------------------------------------ age groups */

/**
 * A single definition, replacing the two contradictory ones that previously
 * existed (an 18-year-old was a Teenager server-side and an Adult client-side).
 */
export const AGE_GROUPS = [
  { key: 'all', label: 'All', title: 'All players', min: null, max: null },
  { key: 'junior', label: 'Juniors', title: 'Juniors (under 13)', min: 0, max: 12 },
  { key: 'teen', label: 'Teenagers', title: 'Teenagers (13 to 18)', min: 13, max: 18 },
  { key: 'adult', label: 'Adults', title: 'Adults (19 to 45)', min: 19, max: 45 },
  { key: 'masters', label: 'Masters', title: 'Masters (over 45)', min: 46, max: 200 },
];

export const ageGroupOf = (age) => {
  if (age === null || age === undefined || Number.isNaN(age)) return null;
  const g = AGE_GROUPS.find((x) => x.min !== null && age >= x.min && age <= x.max);
  return g ? g.key : null;
};

/* ------------------------------------------------------- default settings */

/**
 * Seed values only. The owner edits all of this in Club Settings; nothing here
 * is treated as authoritative once a settings document exists.
 */
export const DEFAULT_CLUB_SETTINGS = {
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
  peakWindows: [
    { days: ['mon', 'tue', 'wed', 'thu', 'fri'], from: '17:00', to: '20:00' },
  ],
};

export const COURT_COUNT = 15;
