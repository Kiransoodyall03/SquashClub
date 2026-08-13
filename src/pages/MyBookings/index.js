import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarDays, Clock, MapPin, Trash2, Users, X,
} from 'lucide-react';

import { auth } from '../../firebase/config';
import { subscribeMemberBookings, getMemberWaitlist } from '../../firebase/bookings';
import { getClubSettings } from '../../firebase/courts';
import { cancelBooking } from '../../firebase/callables';
import { BOOKING_STATUS, BOOKING_TYPE_LABELS } from '../../lib/constants';
import { formatDateKey } from '../../lib/schedule';
import './MyBookings.css';

/**
 * A member's own bookings.
 *
 * Deliberately shows cancelled bookings in the Past tab rather than hiding
 * them: when a late cancellation eventually carries a fee, the member needs to
 * be able to see the record that produced it.
 */

const statusTone = {
  [BOOKING_STATUS.CONFIRMED]: 'badge-active',
  [BOOKING_STATUS.COMPLETED]: 'badge-completed',
  [BOOKING_STATUS.CANCELLED]: 'badge-cancelled',
  [BOOKING_STATUS.NO_SHOW]: 'badge-danger',
};

const MyBookings = () => {
  const uid = auth.currentUser?.uid;

  const [bookings, setBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  useEffect(() => {
    let live = true;
    getClubSettings()
      .then((s) => { if (live) setSettings(s); })
      .catch((err) => { if (live) setError(err.message || 'Could not load club settings.'); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubscribe = subscribeMemberBookings(
      uid,
      (rows) => { setBookings(rows); setLoading(false); },
      (err) => {
        setError(err.message || 'Could not load your bookings.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  const loadWaitlist = useCallback(async () => {
    if (!uid) return;
    try {
      setWaitlist(await getMemberWaitlist(uid));
    } catch (err) {
      // Non-fatal: the bookings list is still useful without this.
      setError((prev) => prev || err.message || 'Could not load your waitlist entries.');
    }
  }, [uid]);

  useEffect(() => { loadWaitlist(); }, [loadWaitlist]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const up = [];
    const done = [];
    bookings.forEach((b) => {
      const isFuture = b.startDate && b.startDate > now;
      if (isFuture && b.status === BOOKING_STATUS.CONFIRMED) up.push(b);
      else done.push(b);
    });
    up.sort((a, b) => a.startDate - b.startDate);
    return { upcoming: up, past: done };
  }, [bookings]);

  const rows = tab === 'upcoming' ? upcoming : past;

  const hoursUntil = (booking) =>
    booking.startDate ? (booking.startDate.getTime() - Date.now()) / 3600000 : Infinity;

  const requestCancel = (booking) => {
    setNotice('');
    setError('');
    setConfirmTarget(booking);
  };

  const doCancel = async () => {
    const booking = confirmTarget;
    if (!booking) return;
    setCancelling(booking.id);
    const result = await cancelBooking({ bookingId: booking.id });
    setCancelling(null);
    setConfirmTarget(null);

    if (!result.success) {
      // The server writes deliberately specific messages; show them verbatim.
      setError(result.error);
      return;
    }
    setNotice(
      result.lateCancellation
        ? 'Booking cancelled. It was inside the cut-off, so it is recorded as a late cancellation.'
        : 'Booking cancelled.'
    );
    loadWaitlist();
  };

  const others = (booking) =>
    (booking.players || []).filter((p) => p.id !== uid).map((p) => p.name).join(', ');

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading-block">
            <span className="loading-spinner" aria-hidden="true" />
            Loading your bookings
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page my-bookings">
      <div className="container">
        <header className="page-header">
          <div>
            <h1 className="page-header__title">My bookings</h1>
            <p className="page-header__subtitle">Courts you are booked on, and your waitlist</p>
          </div>
          <Link to="/bookings" className="btn btn-primary">Book a court</Link>
        </header>

        {error && (
          <div className="error-message" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="success-message" role="status">
            <span>{notice}</span>
          </div>
        )}

        <div className="tabs" role="tablist" aria-label="Booking history">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            className={`tab ${tab === 'upcoming' ? 'is-active' : ''}`}
            onClick={() => setTab('upcoming')}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'past'}
            className={`tab ${tab === 'past' ? 'is-active' : ''}`}
            onClick={() => setTab('past')}
          >
            Past ({past.length})
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <CalendarDays aria-hidden="true" />
            <h3>{tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}</h3>
            <p className="text-sm">
              {tab === 'upcoming'
                ? 'Pick a free slot on the court grid to book.'
                : 'Bookings you have played will appear here.'}
            </p>
            {tab === 'upcoming' && (
              <Link to="/bookings" className="btn btn-primary">Open the court grid</Link>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                {tab === 'upcoming' ? 'Upcoming bookings' : 'Past bookings'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Court</th>
                  <th scope="col">Type</th>
                  <th scope="col">Playing with</th>
                  <th scope="col">Status</th>
                  {tab === 'upcoming' && <th scope="col" className="col-actions">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDateKey(b.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="col-numeric">{b.startTime} - {b.endTime}</td>
                    <td>{b.courtName}</td>
                    <td>
                      <span className="badge badge-secondary">
                        {BOOKING_TYPE_LABELS[b.type] || b.type}
                      </span>
                    </td>
                    <td className="text-sm">{others(b) || <span className="text-muted">On your own</span>}</td>
                    <td>
                      <span className={`badge ${statusTone[b.status] || 'badge-secondary'}`}>
                        {b.status === BOOKING_STATUS.CANCELLED && b.lateCancellation
                          ? 'Late cancel'
                          : (b.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    {tab === 'upcoming' && (
                      <td className="col-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => requestCancel(b)}
                          disabled={cancelling === b.id}
                        >
                          {cancelling === b.id ? 'Cancelling' : 'Cancel'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {waitlist.length > 0 && (
          <section className="section" style={{ marginTop: 'var(--space-6)' }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card__title">Waitlist</h2>
                <span className="text-xs text-muted">
                  You will be notified if a court frees up. First to book takes it.
                </span>
              </div>
              <div className="card-body">
                <ul className="waitlist-list">
                  {waitlist.map((w) => (
                    <li key={w.id} className="waitlist-list__item">
                      <Clock aria-hidden="true" />
                      <span>
                        {formatDateKey(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' at '}
                        <span className="numeric">{w.startTime}</span>
                        {w.courtId ? ` - ${w.courtId}` : ' - any court'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>

      {confirmTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setConfirmTarget(null); }}
        >
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title" id="cancel-booking-title">Cancel this booking?</h2>
              <button
                type="button"
                className="btn-icon"
                aria-label="Close"
                onClick={() => setConfirmTarget(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="modal__body">
              <dl className="deflist">
                <dt>Court</dt><dd>{confirmTarget.courtName}</dd>
                <dt>Date</dt><dd>{formatDateKey(confirmTarget.date, { weekday: 'long', day: 'numeric', month: 'long' })}</dd>
                <dt>Time</dt><dd className="numeric">{confirmTarget.startTime} - {confirmTarget.endTime}</dd>
              </dl>

              {settings && hoursUntil(confirmTarget) < settings.cancellationCutoffHours && (
                <div className="notice notice--caution" style={{ marginTop: 'var(--space-4)' }}>
                  <AlertTriangle aria-hidden="true" />
                  <span>
                    This is within the {settings.cancellationCutoffHours}-hour cut-off, so it will
                    be recorded as a late cancellation. The slot will be offered to anyone waiting.
                  </span>
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn" onClick={() => setConfirmTarget(null)}>
                Keep booking
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={doCancel}
                disabled={cancelling === confirmTarget.id}
              >
                <Trash2 aria-hidden="true" />
                {cancelling === confirmTarget.id ? 'Cancelling' : 'Cancel booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
