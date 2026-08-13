import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { DEFAULT_CLUB_SETTINGS } from '../lib/constants';

/**
 * Courts, closures and club settings.
 *
 * These are owner-writable directly (see firestore.rules) because they are
 * configuration rather than contended state — two administrators editing a
 * court's opening hours at once is a last-write-wins situation, not a
 * correctness problem. Bookings are the opposite, and go through callables.
 *
 * Unlike the original data layer, these functions THROW on failure rather than
 * returning an empty array. Silently returning `[]` when a query fails made a
 * missing index look identical to "no courts exist", which is exactly the kind
 * of failure that wastes an afternoon.
 */

const COURTS = 'courts';
const CLOSURES = 'courtClosures';
const SETTINGS = 'clubSettings';

/* ---------------------------------------------------------------- courts */

export const getCourts = async () => {
  const snap = await getDocs(query(collection(db, COURTS), orderBy('sortOrder', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Live court list. Returns the unsubscribe function. */
export const subscribeCourts = (onData, onError) =>
  onSnapshot(
    query(collection(db, COURTS), orderBy('sortOrder', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );

export const getCourt = async (courtId) => {
  const snap = await getDoc(doc(db, COURTS, courtId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveCourt = async (courtId, updates) => {
  await updateDoc(doc(db, COURTS, courtId), { ...updates, updatedAt: serverTimestamp() });
  return { success: true };
};

export const createCourt = async (court) => {
  const id = court.id || `court-${String(court.number).padStart(2, '0')}`;
  await setDoc(
    doc(db, COURTS, id),
    { ...court, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );
  return { success: true, id };
};

/* -------------------------------------------------------------- closures */

/**
 * Closures that could overlap the given date range.
 *
 * Firestore cannot express "overlaps a range" in one query, so this filters on
 * `toDate >= from` server-side and narrows `fromDate <= to` in memory. The
 * collection is small — a club has tens of closures, not thousands.
 */
export const getClosures = async (fromDate, toDate) => {
  const snap = await getDocs(query(collection(db, CLOSURES), where('toDate', '>=', fromDate)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.fromDate <= toDate);
};

export const subscribeClosures = (fromDate, toDate, onData, onError) =>
  onSnapshot(
    query(collection(db, CLOSURES), where('toDate', '>=', fromDate)),
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.fromDate <= toDate)
      ),
    onError
  );

export const addClosure = async (closure) => {
  const ref = doc(collection(db, CLOSURES));
  await setDoc(ref, {
    id: ref.id,
    courtId: closure.courtId,
    fromDate: closure.fromDate,
    toDate: closure.toDate || closure.fromDate,
    fromTime: closure.fromTime || '00:00',
    toTime: closure.toTime || '23:59',
    reason: closure.reason || 'Closed',
    createdAt: serverTimestamp(),
  });
  return { success: true, id: ref.id };
};

export const removeClosure = async (closureId) => {
  await deleteDoc(doc(db, CLOSURES, closureId));
  return { success: true };
};

/* -------------------------------------------------------------- settings */

export const getClubSettings = async () => {
  const snap = await getDoc(doc(db, SETTINGS, 'config'));
  return { ...DEFAULT_CLUB_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
};

export const subscribeClubSettings = (onData, onError) =>
  onSnapshot(
    doc(db, SETTINGS, 'config'),
    (snap) => onData({ ...DEFAULT_CLUB_SETTINGS, ...(snap.exists() ? snap.data() : {}) }),
    onError
  );

export const saveClubSettings = async (updates) => {
  await setDoc(
    doc(db, SETTINGS, 'config'),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return { success: true };
};
