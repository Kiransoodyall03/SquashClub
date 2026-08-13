import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { BOOKING_STATUS } from '../lib/constants';
import { slotId, isCourtOpen, closedReason, isPast } from '../lib/schedule';

/**
 * Booking reads and grid construction.
 *
 * Writes are NOT here — createBooking, cancelBooking and joinWaitlist live in
 * firebase/callables.js, because they run server-side inside a transaction.
 * That split is deliberate and should be preserved: anything that can
 * double-book a court must not be reachable from a browser.
 */

const BOOKINGS = 'bookings';
const WAITLIST = 'waitlist';

const hydrate = (d) => {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    // Firestore Timestamps are awkward in render code; expose Dates alongside.
    startDate: data.startAt?.toDate ? data.startAt.toDate() : null,
    endDate: data.endAt?.toDate ? data.endAt.toDate() : null,
  };
};

/* ----------------------------------------------------------------- reads */

/** Every booking on a single day. Powers the day view of the grid. */
export const subscribeDayBookings = (dateKey, onData, onError) =>
  onSnapshot(
    query(collection(db, BOOKINGS), where('date', '==', dateKey)),
    (snap) => onData(snap.docs.map(hydrate).filter((b) => b.status !== BOOKING_STATUS.CANCELLED)),
    onError
  );

/** Every booking across a date range. Powers the week view. */
export const subscribeRangeBookings = (fromDate, toDate, onData, onError) =>
  onSnapshot(
    query(
      collection(db, BOOKINGS),
      where('date', '>=', fromDate),
      where('date', '<=', toDate)
    ),
    (snap) => onData(snap.docs.map(hydrate).filter((b) => b.status !== BOOKING_STATUS.CANCELLED)),
    onError
  );

export const getRangeBookings = async (fromDate, toDate) => {
  const snap = await getDocs(
    query(collection(db, BOOKINGS), where('date', '>=', fromDate), where('date', '<=', toDate))
  );
  return snap.docs.map(hydrate);
};

export const getBooking = async (bookingId) => {
  const snap = await getDoc(doc(db, BOOKINGS, bookingId));
  return snap.exists() ? hydrate(snap) : null;
};

/** A member's own bookings, most recent first. Includes cancelled ones. */
export const getMemberBookings = async (memberId, max = 50) => {
  const snap = await getDocs(
    query(
      collection(db, BOOKINGS),
      where('playerIds', 'array-contains', memberId),
      orderBy('startAt', 'desc'),
      limit(max)
    )
  );
  return snap.docs.map(hydrate);
};

export const subscribeMemberBookings = (memberId, onData, onError, max = 50) =>
  onSnapshot(
    query(
      collection(db, BOOKINGS),
      where('playerIds', 'array-contains', memberId),
      orderBy('startAt', 'desc'),
      limit(max)
    ),
    (snap) => onData(snap.docs.map(hydrate)),
    onError
  );

export const getMemberWaitlist = async (memberId) => {
  const snap = await getDocs(
    query(collection(db, WAITLIST), where('memberId', '==', memberId), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/* ------------------------------------------------------- grid assembly -- */

/**
 * Turn courts, bookings and closures into the cell matrix the grid renders.
 *
 * One object per (slot, court) with everything a cell needs, so the component
 * does no lookups while rendering. Each cell is exactly one of:
 *
 *   state 'booked'  — someone has it
 *   state 'closed'  — court unavailable, with a reason
 *   state 'past'    — the slot has been and gone
 *   state 'free'    — bookable
 */
export const buildGrid = ({
  courts, bookings, closures, slots, dateKey, slotMinutes, currentUserId,
}) => {
  const byId = new Map(bookings.map((b) => [b.id, b]));

  return slots.map((startTime) => ({
    startTime,
    cells: courts.map((court) => {
      const id = slotId(court.id, dateKey, startTime);
      const booking = byId.get(id);

      if (booking && booking.status !== BOOKING_STATUS.CANCELLED) {
        return {
          court,
          startTime,
          slotId: id,
          state: 'booked',
          booking,
          isMine: (booking.playerIds || []).includes(currentUserId),
          label: booking.type === 'casual'
            ? (booking.players || []).map((p) => p.name.split(' ')[0]).join(' v ') || booking.bookedByName
            : booking.notes || booking.type,
        };
      }

      if (!isCourtOpen(court, dateKey, startTime, slotMinutes, closures)) {
        return {
          court,
          startTime,
          slotId: id,
          state: 'closed',
          reason: closedReason(court, dateKey, startTime, slotMinutes, closures),
        };
      }

      if (isPast(dateKey, startTime)) {
        return { court, startTime, slotId: id, state: 'past' };
      }

      return { court, startTime, slotId: id, state: 'free' };
    }),
  }));
};

/** Counts for the summary strip above the grid. */
export const summariseGrid = (rows) => {
  let free = 0;
  let booked = 0;
  let closed = 0;
  rows.forEach((row) =>
    row.cells.forEach((cell) => {
      if (cell.state === 'free') free += 1;
      else if (cell.state === 'booked') booked += 1;
      else if (cell.state === 'closed') closed += 1;
    })
  );
  const bookable = free + booked;
  return {
    free,
    booked,
    closed,
    utilisation: bookable > 0 ? Math.round((booked / bookable) * 100) : 0,
  };
};
