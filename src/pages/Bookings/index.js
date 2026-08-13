/**
 * Court booking grid — the page both members and the owner live in.
 *
 * The whole screen is one day: rows are time slots, columns are courts. That
 * shape is deliberate. A club owner's question is "what is free at six" and a
 * member's is "can I get on tonight"; both are answered by scanning a row, and
 * a row only exists if courts are columns.
 *
 * No date arithmetic is performed here. Every calendar and clock operation goes
 * through lib/schedule.js, because the wall-clock-string discipline in that file
 * is what keeps slot boundaries from drifting by a timezone offset.
 *
 * Writes go through firebase/callables.js, never Firestore directly — the
 * server transaction on the deterministic slot ID is the only thing standing
 * between two members and the same court.
 */

import React, {
  useCallback, useEffect, useId, useMemo, useRef, useState,
} from 'react';
import {
  AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ListPlus, Lock,
  Plus, Search, Trash2, UserPlus, X, Zap,
} from 'lucide-react';

import { auth } from '../../firebase/config';
import { getAllUsers } from '../../firebase/firestore';
import { getClubSettings, subscribeClosures, subscribeCourts } from '../../firebase/courts';
import { buildGrid, subscribeDayBookings, summariseGrid } from '../../firebase/bookings';
import { cancelBooking, createBooking, joinWaitlist } from '../../firebase/callables';
import {
  BOOKING_TYPE, BOOKING_TYPE_LABELS, OWNER_ONLY_BOOKING_TYPES, ROLES,
} from '../../lib/constants';
import {
  WEEKDAY_SHORT, addDays, buildSlotAxis, daysBetween, formatDateKey, isPast,
  isPeak, startOfWeek, todayKey, weekDates, weekdayOf,
} from '../../lib/schedule';

import './Bookings.css';

/* ------------------------------------------------------------------ modal */

/**
 * Dialog shell. Kept local to the page rather than shared, because the two
 * booking pages are the only callers and a cross-page import would couple them.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
  ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ title, onClose, children, footer }) => {
  const dialogRef = useRef(null);
  const titleId = useId();

  // onClose is read through a ref so a new closure identity on every parent
  // render cannot re-run this effect and yank focus back to the top mid-typing.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const node = dialogRef.current;
    const firstField = node.querySelector(FOCUSABLE);
    (firstField || node).focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>{title}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close dialog">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- helpers -- */

const memberName = (m) =>
  [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.displayName || m.email || m.id;

const longDate = (dateKey) =>
  formatDateKey(dateKey, { weekday: 'long', day: 'numeric', month: 'long' });

/** Hours from now until a booking starts. Negative once it has begun. */
const hoursUntil = (booking) => {
  const start = booking.startDate instanceof Date ? booking.startDate : null;
  if (!start) return Number.POSITIVE_INFINITY;
  return (start.getTime() - Date.now()) / 3600000;
};

/* ------------------------------------------------------------ grid cell -- */

const GridCell = ({ cell, dateKey, onBook, onInspect }) => {
  const where = `${cell.court.name || `Court ${cell.court.number}`} at ${cell.startTime}`;

  if (cell.state === 'free') {
    return (
      <td className="bookings-cell bookings-cell--free">
        <button
          type="button"
          className="bookings-cell__btn"
          onClick={() => onBook(cell)}
          aria-label={`Book ${where} on ${longDate(dateKey)}`}
        >
          <Plus aria-hidden="true" className="bookings-cell__icon" />
        </button>
      </td>
    );
  }

  if (cell.state === 'booked') {
    const label = cell.label || BOOKING_TYPE_LABELS[cell.booking?.type] || 'Booked';
    return (
      <td className={`bookings-cell bookings-cell--booked${cell.isMine ? ' is-mine' : ''}`}>
        <button
          type="button"
          className="bookings-cell__btn"
          onClick={() => onInspect(cell)}
          title={label}
          aria-label={`${where}: booked${cell.isMine ? ', you are playing' : ''} — ${label}. View details`}
        >
          <span className="bookings-cell__label">{label}</span>
          {/* The "mine" marker is a word as well as a rule, so it survives
              greyscale, colour-blindness and a printed court sheet. */}
          {cell.isMine ? <span className="bookings-cell__you">You</span> : null}
        </button>
      </td>
    );
  }

  if (cell.state === 'closed') {
    return (
      <td className="bookings-cell bookings-cell--closed" title={cell.reason}>
        <Lock aria-hidden="true" className="bookings-cell__icon" />
        <span className="visually-hidden">{`${where}: ${cell.reason}`}</span>
      </td>
    );
  }

  return (
    <td className="bookings-cell bookings-cell--past">
      <span aria-hidden="true" className="bookings-cell__dash">&mdash;</span>
      <span className="visually-hidden">{`${where}: in the past`}</span>
    </td>
  );
};

/* --------------------------------------------------------- create modal -- */

const CreateBookingModal = ({ cell, dateKey, settings, isOwner, onClose, onCreated }) => {
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersEmpty, setMembersEmpty] = useState(false);
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState([]);      // {id, name}
  const [guestName, setGuestName] = useState('');
  const [guests, setGuests] = useState([]);        // string names
  const [notes, setNotes] = useState('');
  const [type, setType] = useState(BOOKING_TYPE.CASUAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = auth.currentUser?.uid;
  const peak = isPeak(dateKey, cell.startTime, settings.peakWindows);

  useEffect(() => {
    let live = true;
    (async () => {
      // getAllUsers swallows its own failures and returns [], so an empty list
      // is reported to the user as "could not be loaded" rather than silence.
      const users = await getAllUsers();
      if (!live) return;
      const pickable = users.filter((u) => !u.disabled && u.id !== currentUserId);
      setMembers(pickable);
      setMembersEmpty(users.length === 0);
      setMembersLoading(false);
    })();
    return () => { live = false; };
  }, [currentUserId]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const chosen = new Set(players.map((p) => p.id));
    return members
      .filter((m) => !chosen.has(m.id))
      .filter((m) => {
        if (!term) return false; // the picker only lists once you type
        return `${memberName(m)} ${m.email || ''}`.toLowerCase().includes(term);
      })
      .slice(0, 8);
  }, [members, players, search]);

  const addPlayer = (m) => {
    setPlayers((prev) => [...prev, { id: m.id, name: memberName(m) }]);
    setSearch('');
  };

  const addGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    setGuests((prev) => [...prev, name]);
    setGuestName('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const result = await createBooking({
      courtId: cell.court.id,
      date: dateKey,
      startTime: cell.startTime,
      type: isOwner ? type : BOOKING_TYPE.CASUAL,
      playerIds: players.map((p) => p.id),
      guests: guests.map((name) => ({ name })),
      notes: notes.trim(),
    });

    if (!result.success) {
      // Verbatim. The server writes these deliberately ("That slot was taken a
      // moment ago"); a generic replacement would destroy the only information
      // the member has about what to do next.
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onCreated(`${cell.court.name || `Court ${cell.court.number}`} booked for ${cell.startTime}.`);
  };

  return (
    <Modal
      title="Book this court"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-booking-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? <span className="loading-spinner bookings-inline-spinner" /> : null}
            {submitting ? 'Booking' : 'Confirm booking'}
          </button>
        </>
      )}
    >
      {error ? (
        <div className="error-message" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <dl className="deflist bookings-summary-list">
        <dt>Court</dt>
        <dd>{cell.court.name || `Court ${cell.court.number}`}</dd>
        <dt>Date</dt>
        <dd>{longDate(dateKey)}</dd>
        <dt>Time</dt>
        <dd className="numeric">
          {cell.startTime}
          {peak ? <span className="badge badge-warning bookings-peak-badge">Peak</span> : null}
        </dd>
      </dl>

      {peak && !settings.guestsAllowedAtPeak ? (
        <div className="notice notice--caution">
          <AlertTriangle aria-hidden="true" />
          <span>Guests are not permitted during peak hours at this club.</span>
        </div>
      ) : null}

      <form id="create-booking-form" onSubmit={submit} className="bookings-form">
        {isOwner ? (
          <div className="form-group">
            <label className="form-label" htmlFor="booking-type">Booking type</label>
            <select
              id="booking-type"
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {Object.values(BOOKING_TYPE).map((value) => (
                <option key={value} value={value}>
                  {BOOKING_TYPE_LABELS[value]}
                  {OWNER_ONLY_BOOKING_TYPES.includes(value) ? ' (staff only)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label" htmlFor="player-search">Other players</label>
          <div className="bookings-search">
            <Search aria-hidden="true" className="bookings-search__icon" />
            <input
              id="player-search"
              type="text"
              className="form-input bookings-search__input"
              placeholder="Search members by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          {membersLoading ? (
            <p className="form-hint">Loading members…</p>
          ) : null}
          {!membersLoading && membersEmpty ? (
            <p className="form-hint">The member list could not be loaded. You can still book on your own.</p>
          ) : null}
          {!membersLoading && !membersEmpty && search.trim() && matches.length === 0 ? (
            <p className="form-hint">No members match that search.</p>
          ) : null}

          {matches.length > 0 ? (
            <ul className="bookings-picker">
              {matches.map((m) => (
                <li key={m.id}>
                  <button type="button" className="bookings-picker__item" onClick={() => addPlayer(m)}>
                    <UserPlus aria-hidden="true" />
                    <span className="bookings-picker__name">{memberName(m)}</span>
                    <span className="bookings-picker__meta">{m.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {players.length > 0 ? (
            <ul className="bookings-chips">
              {players.map((p) => (
                <li key={p.id} className="bookings-chip">
                  <span>{p.name}</span>
                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => setPlayers((prev) => prev.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name} from this booking`}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="guest-name">Guests</label>
          <div className="bookings-add-row">
            <input
              id="guest-name"
              type="text"
              className="form-input"
              placeholder="Guest name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds a guest rather than submitting the whole booking.
                if (e.key === 'Enter') { e.preventDefault(); addGuest(); }
              }}
              autoComplete="off"
            />
            <button type="button" className="btn" onClick={addGuest} disabled={!guestName.trim()}>
              Add guest
            </button>
          </div>

          {guests.length > 0 ? (
            <ul className="bookings-chips">
              {guests.map((name, index) => (
                // Guest names are free text and may repeat, so the index is the
                // only stable identity available.
                // eslint-disable-next-line react/no-array-index-key
                <li key={`${name}-${index}`} className="bookings-chip">
                  <span>{name}</span>
                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => setGuests((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove guest ${name}`}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="booking-notes">Notes</label>
          <textarea
            id="booking-notes"
            className="form-input bookings-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Anything the club should know"
          />
        </div>
      </form>
    </Modal>
  );
};

/* --------------------------------------------------------- detail modal -- */

const BookingDetailModal = ({ booking, settings, viewerId, isOwner, onClose, onCancelled }) => {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isParticipant = (booking.playerIds || []).includes(viewerId);
  const canCancel = isParticipant || isOwner;
  const remaining = hoursUntil(booking);
  const insideCutoff = remaining < (settings.cancellationCutoffHours || 0);
  const alreadyStarted = remaining < 0;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    const result = await cancelBooking({ bookingId: booking.id, reason: reason.trim() });
    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    onCancelled(
      result.lateCancellation
        ? 'Booking cancelled. It has been recorded as a late cancellation.'
        : 'Booking cancelled.'
    );
  };

  const players = booking.players || [];
  const guests = booking.guests || [];

  return (
    <Modal
      title="Booking details"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Close
          </button>
          {canCancel && !confirming ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" />
              Cancel booking
            </button>
          ) : null}
          {canCancel && confirming ? (
            <button type="button" className="btn btn-danger" onClick={submit} disabled={submitting}>
              {submitting ? <span className="loading-spinner bookings-inline-spinner" /> : null}
              {submitting ? 'Cancelling' : 'Confirm cancellation'}
            </button>
          ) : null}
        </>
      )}
    >
      {error ? (
        <div className="error-message" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <dl className="deflist bookings-summary-list">
        <dt>Court</dt>
        <dd>{booking.courtName || booking.courtId}</dd>
        <dt>Date</dt>
        <dd>{longDate(booking.date)}</dd>
        <dt>Time</dt>
        <dd className="numeric">{booking.startTime}&ndash;{booking.endTime}</dd>
        <dt>Type</dt>
        <dd>{BOOKING_TYPE_LABELS[booking.type] || booking.type}</dd>
        <dt>Booked by</dt>
        <dd>{booking.bookedByName || 'Unknown'}</dd>
        <dt>Players</dt>
        <dd>
          {players.length > 0
            ? players.map((p) => p.name).join(', ')
            : <span className="text-muted">None recorded</span>}
        </dd>
        <dt>Guests</dt>
        <dd>
          {guests.length > 0
            ? guests.map((g) => g.name).join(', ')
            : <span className="text-muted">None</span>}
        </dd>
        <dt>Notes</dt>
        <dd>{booking.notes ? booking.notes : <span className="text-muted">None</span>}</dd>
      </dl>

      {confirming ? (
        <div className="bookings-confirm">
          {alreadyStarted ? (
            <div className="notice notice--caution">
              <AlertTriangle aria-hidden="true" />
              <span>This booking has already started. Only an administrator can cancel it now.</span>
            </div>
          ) : null}
          {insideCutoff && !alreadyStarted ? (
            <div className="notice notice--caution">
              <AlertTriangle aria-hidden="true" />
              <span>
                {`This is within the ${settings.cancellationCutoffHours}-hour cancellation cut-off. `}
                It will be recorded against your account as a late cancellation.
              </span>
            </div>
          ) : null}
          <div className="form-group">
            <label className="form-label" htmlFor="cancel-reason">Reason (optional)</label>
            <input
              id="cancel-reason"
              type="text"
              className="form-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Why is this being cancelled?"
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

/* ------------------------------------------------------------ the page -- */

const Bookings = ({ userProfile }) => {
  const viewerId = userProfile?.id || auth.currentUser?.uid || null;
  const isOwner = userProfile?.role === ROLES.OWNER;

  const [dateKey, setDateKey] = useState(todayKey());
  const [weekStart, setWeekStart] = useState(startOfWeek(todayKey()));

  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');

  const [courts, setCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError, setCourtsError] = useState('');

  const [closures, setClosures] = useState([]);
  const [closuresError, setClosuresError] = useState('');

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');

  const [createCell, setCreateCell] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [flash, setFlash] = useState('');
  const [waitlistBusy, setWaitlistBusy] = useState('');
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistNote, setWaitlistNote] = useState('');

  /* --- settings: read once; the owner changes them rarely ---------------- */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const config = await getClubSettings();
        if (live) setSettings(config);
      } catch (err) {
        if (live) setSettingsError(`Club settings could not be loaded: ${err.message}`);
      }
    })();
    return () => { live = false; };
  }, []);

  /* --- courts ------------------------------------------------------------ */
  useEffect(() => {
    const unsubscribe = subscribeCourts(
      (list) => { setCourts(list); setCourtsLoading(false); setCourtsError(''); },
      (err) => { setCourtsError(`Courts could not be loaded: ${err.message}`); setCourtsLoading(false); }
    );
    return () => unsubscribe();
  }, []);

  /* --- closures: subscribed per visible week, not per day, so moving
         between days inside a week does not churn the listener ------------ */
  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  useEffect(() => {
    const unsubscribe = subscribeClosures(
      days[0],
      days[days.length - 1],
      (list) => { setClosures(list); setClosuresError(''); },
      (err) => setClosuresError(`Court closures could not be loaded: ${err.message}`)
    );
    return () => unsubscribe();
  }, [days]);

  /* --- bookings for the selected day ------------------------------------- */
  useEffect(() => {
    setBookingsLoading(true);
    const unsubscribe = subscribeDayBookings(
      dateKey,
      (list) => { setBookings(list); setBookingsLoading(false); setBookingsError(''); },
      (err) => { setBookingsError(`Bookings could not be loaded: ${err.message}`); setBookingsLoading(false); }
    );
    return () => unsubscribe();
  }, [dateKey]);

  /* --- the grid ---------------------------------------------------------- */
  const slots = useMemo(() => {
    if (!settings) return [];
    return buildSlotAxis(settings.openTime, settings.closeTime, settings.slotMinutes);
  }, [settings]);

  const rows = useMemo(() => {
    if (!settings || courts.length === 0 || slots.length === 0) return [];
    return buildGrid({
      courts,
      bookings,
      closures,
      slots,
      dateKey,
      slotMinutes: settings.slotMinutes,
      currentUserId: viewerId,
    });
  }, [settings, courts, bookings, closures, slots, dateKey, viewerId]);

  const summary = useMemo(() => summariseGrid(rows), [rows]);

  // The open booking, re-read from the live list so a cancellation by someone
  // else updates the dialog instead of leaving a stale copy on screen.
  const openBooking = useMemo(
    () => (detailBooking ? bookings.find((b) => b.id === detailBooking.id) || null : null),
    [detailBooking, bookings]
  );

  useEffect(() => {
    // The booking vanished from under the dialog — close rather than show a ghost.
    if (detailBooking && !openBooking) setDetailBooking(null);
  }, [detailBooking, openBooking]);

  const goToDate = useCallback((key) => {
    setDateKey(key);
    setWeekStart(startOfWeek(key));
    setFlash('');
    setWaitlistNote('');
    setWaitlistError('');
  }, []);

  const handleWaitlist = async (startTime) => {
    setWaitlistBusy(startTime);
    setWaitlistError('');
    setWaitlistNote('');
    const result = await joinWaitlist({ date: dateKey, startTime });
    if (!result.success) setWaitlistError(result.error);
    else setWaitlistNote(`You are on the waitlist for ${startTime} on ${longDate(dateKey)}.`);
    setWaitlistBusy('');
  };

  const loading = !settings || courtsLoading || bookingsLoading;
  const waitlistEnabled = Boolean(settings?.allowWaitlist);
  const daysAhead = daysBetween(todayKey(), dateKey);
  const beyondWindow =
    settings && !isOwner && daysAhead > settings.maxAdvanceDays;

  return (
    <div className="page bookings-page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Court bookings</h1>
            <p className="page-header__subtitle">
              {settings
                ? `${settings.openTime} to ${settings.closeTime}, ${settings.slotMinutes}-minute slots`
                : 'Loading club hours'}
            </p>
          </div>
          <button type="button" className="btn" onClick={() => goToDate(todayKey())}>
            <CalendarDays aria-hidden="true" />
            Today
          </button>
        </div>

        {/* Every failure is shown. None of these are recoverable by retrying
            silently, so the member is told which part of the page is missing. */}
        <div role="alert" aria-live="polite">
          {settingsError ? (
            <div className="error-message"><AlertTriangle aria-hidden="true" /><span>{settingsError}</span></div>
          ) : null}
          {courtsError ? (
            <div className="error-message"><AlertTriangle aria-hidden="true" /><span>{courtsError}</span></div>
          ) : null}
          {closuresError ? (
            <div className="error-message"><AlertTriangle aria-hidden="true" /><span>{closuresError}</span></div>
          ) : null}
          {bookingsError ? (
            <div className="error-message"><AlertTriangle aria-hidden="true" /><span>{bookingsError}</span></div>
          ) : null}
          {waitlistError ? (
            <div className="error-message"><AlertTriangle aria-hidden="true" /><span>{waitlistError}</span></div>
          ) : null}
          {flash ? <div className="success-message"><span>{flash}</span></div> : null}
          {waitlistNote ? <div className="success-message"><span>{waitlistNote}</span></div> : null}
        </div>

        {/* ------------------------------------------------------ date strip */}
        <div className="bookings-datestrip">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => goToDate(addDays(dateKey, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft aria-hidden="true" />
          </button>

          <div className="bookings-datestrip__days" role="group" aria-label="Select a day">
            {days.map((key) => (
              <button
                key={key}
                type="button"
                className={`bookings-datestrip__day${key === dateKey ? ' is-selected' : ''}`}
                onClick={() => goToDate(key)}
                aria-pressed={key === dateKey}
                aria-label={longDate(key)}
              >
                <span className="bookings-datestrip__weekday">{WEEKDAY_SHORT[weekdayOf(key)]}</span>
                <span className="bookings-datestrip__date">{formatDateKey(key, { day: 'numeric' })}</span>
                <span className="bookings-datestrip__month">{formatDateKey(key, { month: 'short' })}</span>
                {key === todayKey() ? <span className="bookings-datestrip__today">Today</span> : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-icon"
            onClick={() => goToDate(addDays(dateKey, 7))}
            aria-label="Next week"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>

        {beyondWindow ? (
          <div className="notice notice--info">
            <AlertTriangle aria-hidden="true" />
            <span>
              {`Bookings open ${settings.maxAdvanceDays} days ahead. This day is ${daysAhead} days away, so it cannot be booked yet.`}
            </span>
          </div>
        ) : null}

        {/* --------------------------------------------------------- summary */}
        <div className="grid grid-cols-3 bookings-stats">
          <div className="stat">
            <span className="stat__label label">Free slots</span>
            <span className="stat__value">{summary.free}</span>
          </div>
          <div className="stat">
            <span className="stat__label label">Booked slots</span>
            <span className="stat__value">{summary.booked}</span>
          </div>
          <div className="stat">
            <span className="stat__label label">Utilisation</span>
            <span className="stat__value">{summary.utilisation}%</span>
            <span className="stat__meta">{`${summary.closed} slots unavailable`}</span>
          </div>
        </div>

        {/* ---------------------------------------------------------- legend */}
        <div className="card bookings-legend">
          <div className="card-body">
            <span className="label bookings-legend__title">Legend</span>
            <ul className="bookings-legend__items">
              <li className="bookings-legend__item">
                <span className="bookings-legend__swatch bookings-cell--free" aria-hidden="true">
                  <Plus />
                </span>
                Free — select to book
              </li>
              <li className="bookings-legend__item">
                <span className="bookings-legend__swatch bookings-cell--booked" aria-hidden="true">A v B</span>
                Booked — select for details
              </li>
              <li className="bookings-legend__item">
                <span className="bookings-legend__swatch bookings-cell--booked is-mine" aria-hidden="true">You</span>
                Yours — marked with a rule and the word You
              </li>
              <li className="bookings-legend__item">
                <span className="bookings-legend__swatch bookings-cell--closed" aria-hidden="true">
                  <Lock />
                </span>
                Closed — hover for the reason
              </li>
              <li className="bookings-legend__item">
                <span className="bookings-legend__swatch bookings-cell--past" aria-hidden="true">&mdash;</span>
                Past
              </li>
              <li className="bookings-legend__item">
                <span className="bookings-legend__swatch bookings-legend__swatch--peak" aria-hidden="true">
                  <Zap />
                </span>
                Peak time
              </li>
            </ul>
          </div>
        </div>

        {/* ------------------------------------------------------------ grid */}
        {loading ? (
          <div className="bookings-loading">
            <span className="loading-spinner" />
            <p>Loading the court grid…</p>
          </div>
        ) : null}

        {!loading && courts.length === 0 ? (
          <div className="empty-state">
            <h3>No courts configured</h3>
            <p>An administrator needs to add courts before anything can be booked.</p>
          </div>
        ) : null}

        {!loading && courts.length > 0 && slots.length === 0 ? (
          <div className="empty-state">
            <h3>No slots today</h3>
            <p>The club opening hours produce no bookable slots. Check the club settings.</p>
          </div>
        ) : null}

        {!loading && rows.length > 0 ? (
          <div className="table-wrap bookings-gridwrap">
            <table className="table bookings-grid">
              <caption className="visually-hidden">
                {`Court availability for ${longDate(dateKey)}. Rows are times, columns are courts.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="bookings-grid__corner">Time</th>
                  {courts.map((court) => (
                    <th key={court.id} scope="col" className="bookings-grid__courthead">
                      <span className="bookings-grid__courtnum">
                        {court.number ?? court.name}
                      </span>
                      <span className="visually-hidden">{court.name || `Court ${court.number}`}</span>
                    </th>
                  ))}
                  {waitlistEnabled ? <th scope="col" className="bookings-grid__waithead">Waitlist</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const peak = isPeak(dateKey, row.startTime, settings.peakWindows);
                  const rowPast = isPast(dateKey, row.startTime);
                  const anyFree = row.cells.some((c) => c.state === 'free');
                  const anyBooked = row.cells.some((c) => c.state === 'booked');
                  const fullyBooked = !anyFree && anyBooked && !rowPast;

                  return (
                    <tr key={row.startTime}>
                      <th scope="row" className={`bookings-grid__time${peak ? ' is-peak' : ''}`}>
                        <span className="bookings-grid__timevalue">{row.startTime}</span>
                        {peak ? (
                          <>
                            <Zap aria-hidden="true" className="bookings-grid__peakmark" />
                            <span className="visually-hidden">Peak time</span>
                          </>
                        ) : null}
                      </th>

                      {row.cells.map((cell) => (
                        <GridCell
                          key={cell.slotId}
                          cell={cell}
                          dateKey={dateKey}
                          onBook={(c) => { setFlash(''); setCreateCell(c); }}
                          onInspect={(c) => { setFlash(''); setDetailBooking(c.booking); }}
                        />
                      ))}

                      {waitlistEnabled ? (
                        <td className="bookings-cell bookings-cell--wait">
                          {fullyBooked ? (
                            <button
                              type="button"
                              className="btn btn-small btn-outline"
                              onClick={() => handleWaitlist(row.startTime)}
                              disabled={waitlistBusy === row.startTime}
                            >
                              <ListPlus aria-hidden="true" />
                              {waitlistBusy === row.startTime ? 'Joining' : 'Join waitlist'}
                            </button>
                          ) : (
                            <span className="visually-hidden">Courts still available at this time</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {createCell && settings ? (
        <CreateBookingModal
          cell={createCell}
          dateKey={dateKey}
          settings={settings}
          isOwner={isOwner}
          onClose={() => setCreateCell(null)}
          onCreated={(message) => { setCreateCell(null); setFlash(message); }}
        />
      ) : null}

      {openBooking && settings ? (
        <BookingDetailModal
          booking={openBooking}
          settings={settings}
          viewerId={viewerId}
          isOwner={isOwner}
          onClose={() => setDetailBooking(null)}
          onCancelled={(message) => { setDetailBooking(null); setFlash(message); }}
        />
      ) : null}
    </div>
  );
};

export default Bookings;
