/**
 * Cloud Functions entry point — Parkview Squash Club.
 *
 * Region is europe-west1 throughout: it is the closest Google Cloud region to
 * Johannesburg with full Cloud Functions and Firestore support, and mixing
 * regions between the database and functions adds latency to every call.
 *
 * Everything exported here is either a callable invoked by the client or a
 * scheduled job. Nothing in the client writes to bookings, matches, ratings or
 * tournament settlement directly — security rules deny all of it.
 */

const bookings = require('./src/bookings');
const matches = require('./src/matches');
const scheduled = require('./src/scheduled');
const admin = require('./src/admin');

/* ------------------------------------------------------------- bookings */
exports.createBooking = bookings.createBooking;
exports.cancelBooking = bookings.cancelBooking;
exports.joinWaitlist = bookings.joinWaitlist;
exports.createRecurringBooking = bookings.createRecurringBooking;

/* -------------------------------------------------------------- matches */
exports.createMatchChallenge = matches.createMatchChallenge;
exports.respondToChallenge = matches.respondToChallenge;
exports.submitMatchResult = matches.submitMatchResult;
exports.confirmMatchResult = matches.confirmMatchResult;
exports.disputeMatchResult = matches.disputeMatchResult;
exports.resolveDispute = matches.resolveDispute;
exports.cancelMatch = matches.cancelMatch;

/* ---------------------------------------------------------------- admin */
exports.seedCourts = admin.seedCourts;
exports.setMemberRole = admin.setMemberRole;
exports.adjustRating = admin.adjustRating;

/* ------------------------------------------------------------ scheduled */
exports.autoConfirmResults = scheduled.autoConfirmResults;
exports.closeOutBookings = scheduled.closeOutBookings;
exports.sendBookingReminders = scheduled.sendBookingReminders;
exports.rollUpDailyAnalytics = scheduled.rollUpDailyAnalytics;
exports.flagUnsettledTournaments = scheduled.flagUnsettledTournaments;
