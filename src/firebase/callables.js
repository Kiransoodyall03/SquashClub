import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

/**
 * Every privileged write goes through here.
 *
 * Two things this module is responsible for:
 *
 * 1. A single place where callable names are declared, so a rename in
 *    functions/index.js has exactly one place to break rather than twenty.
 *
 * 2. Turning Firebase's HttpsError into the `{ success, error }` shape the
 *    rest of the app already speaks — but WITHOUT the original codebase's
 *    habit of swallowing failures into an empty result. A failure here always
 *    carries a message the user can act on, because the server writes those
 *    messages deliberately ("That slot was taken a moment ago", "You already
 *    hold 3 upcoming bookings").
 */

const FRIENDLY = {
  unauthenticated: 'Please sign in and try again.',
  'permission-denied': 'You do not have permission to do that.',
  'not-found': 'That item no longer exists.',
  'already-exists': 'That already exists.',
  'failed-precondition': 'That action is not available right now.',
  'resource-exhausted': 'You have reached a limit.',
  'invalid-argument': 'Some details were missing or invalid.',
  internal: 'Something went wrong at our end. Please try again.',
  unavailable: 'Cannot reach the server. Check your connection and try again.',
};

const call = (name) => async (payload = {}) => {
  try {
    const fn = httpsCallable(functions, name);
    const result = await fn(payload);
    return { success: true, ...(result.data || {}) };
  } catch (err) {
    // The server's own message is far more useful than the generic fallback,
    // so it wins whenever one is present.
    const message = err?.message && !err.message.startsWith('INTERNAL')
      ? err.message
      : FRIENDLY[err?.code?.replace('functions/', '')] || FRIENDLY.internal;

    // eslint-disable-next-line no-console
    console.error(`[callable:${name}]`, err?.code, err?.message);
    return { success: false, error: message, code: err?.code };
  }
};

/* -------------------------------------------------------------- bookings */
export const createBooking = call('createBooking');
export const cancelBooking = call('cancelBooking');
export const joinWaitlist = call('joinWaitlist');
export const createRecurringBooking = call('createRecurringBooking');

/* --------------------------------------------------------------- matches */
export const createMatchChallenge = call('createMatchChallenge');
export const respondToChallenge = call('respondToChallenge');
export const submitMatchResult = call('submitMatchResult');
export const confirmMatchResult = call('confirmMatchResult');
export const disputeMatchResult = call('disputeMatchResult');
export const resolveDispute = call('resolveDispute');
export const cancelMatch = call('cancelMatch');

/* ----------------------------------------------------------------- admin */
export const seedCourts = call('seedCourts');
export const setMemberRole = call('setMemberRole');
export const adjustRating = call('adjustRating');
