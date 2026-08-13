import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarOff,
  Copy,
  Info,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  subscribeCourts,
  saveCourt,
  getClosures,
  addClosure,
  removeClosure,
  getClubSettings,
} from '../../firebase/courts';
import { seedCourts } from '../../firebase/callables';
import { getUserProfile } from '../../firebase/firestore';
import { auth } from '../../firebase/config';
import {
  COURT_ATTRIBUTES,
  COURT_COUNT,
  COURT_STATUS,
  COURT_STATUS_LABELS,
  ROLES,
} from '../../lib/constants';
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  addDays,
  formatDateKey,
  toMinutes,
  todayKey,
  weekdayOf,
} from '../../lib/schedule';

import './CourtManagement.css';

/**
 * Court Management — owner only.
 *
 * Everything on this page is club configuration rather than contended state,
 * so it writes straight to Firestore through `firebase/courts` (see the note at
 * the top of that module). The one exception is seeding, which has to run with
 * owner privileges server-side and therefore goes through a callable.
 */

/* ------------------------------------------------------------------ helpers */

/**
 * WEEKDAYS is Sunday-first because it indexes `Date.getDay()`. An owner reads
 * a week Monday-first, so the editor is rotated rather than re-declared —
 * a second hard-coded list would drift the moment one of them changed.
 */
const WEEK_ORDER = [...WEEKDAYS.slice(1), WEEKDAYS[0]];

/** Monday to Friday, the set the "copy Monday" shortcut fills. */
const WORKING_DAYS = WEEK_ORDER.slice(0, 5);

/** Court status maps onto the shared badge tones; colour never stands alone. */
const STATUS_TONE = {
  [COURT_STATUS.ACTIVE]: 'active',
  [COURT_STATUS.MAINTENANCE]: 'pending',
  [COURT_STATUS.RETIRED]: 'cancelled',
};

const ATTRIBUTE_LABELS = COURT_ATTRIBUTES.reduce((acc, a) => {
  acc[a.value] = a.label;
  return acc;
}, {});

/**
 * `getClosures` needs an explicit range. A year ahead covers anything an owner
 * would realistically schedule while staying one small query — the collection
 * holds tens of documents, not thousands.
 */
const CLOSURE_HORIZON_DAYS = 365;

/**
 * Availability windows need a key that survives a removal from the middle of
 * the list. An array index does not: remove window 1 of 3 and React would map
 * the old index-1 input state onto what is now a different window.
 */
let windowSeq = 0;
const nextWindowKey = () => {
  windowSeq += 1;
  return `w${windowSeq}`;
};

const toDraftAvailability = (availability) =>
  WEEK_ORDER.reduce((acc, day) => {
    acc[day] = ((availability || {})[day] || []).map((w) => ({
      key: nextWindowKey(),
      opens: w.opens || '',
      closes: w.closes || '',
    }));
    return acc;
  }, {});

/** Strip the render-only key before the draft goes anywhere near Firestore. */
const fromDraftAvailability = (draft) =>
  WEEK_ORDER.reduce((acc, day) => {
    acc[day] = draft[day].map(({ opens, closes }) => ({ opens, closes }));
    return acc;
  }, {});

const describeWindows = (windows) => {
  if (!windows || windows.length === 0) return null;
  return windows.map((w) => `${w.opens}–${w.closes}`).join(', ');
};

/**
 * Returns the first problem with a draft's availability, or null.
 *
 * Overlapping windows are rejected rather than merged: two windows that touch
 * almost always mean a typo, and silently merging them would hide it.
 */
const validateAvailability = (draft) => {
  for (let i = 0; i < WEEK_ORDER.length; i += 1) {
    const day = WEEK_ORDER[i];
    const label = WEEKDAY_LABELS[day];
    const windows = draft[day] || [];

    for (let n = 0; n < windows.length; n += 1) {
      const w = windows[n];
      if (!w.opens || !w.closes) {
        return `${label}: window ${n + 1} needs both an opening and a closing time.`;
      }
      if (toMinutes(w.closes) <= toMinutes(w.opens)) {
        return `${label}: window ${n + 1} closes at ${w.closes}, which is not after ${w.opens}.`;
      }
    }

    // Sort a copy — the stored order is the owner's and is left alone.
    const sorted = [...windows].sort((a, b) => toMinutes(a.opens) - toMinutes(b.opens));
    for (let n = 1; n < sorted.length; n += 1) {
      const prev = sorted[n - 1];
      const cur = sorted[n];
      if (toMinutes(cur.opens) < toMinutes(prev.closes)) {
        return (
          `${label}: ${prev.opens}–${prev.closes} overlaps ${cur.opens}–${cur.closes}. ` +
          'Windows on the same day must not overlap.'
        );
      }
    }
  }
  return null;
};

const errorText = (err, fallback) =>
  (err && err.message) || fallback;

/** Escape closes a modal. Bound while the modal is mounted, removed with it. */
const useEscapeKey = (onEscape, enabled) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onEscape, enabled]);
};

/* --------------------------------------------------------- court edit modal */

const CourtEditModal = ({ court, onClose, onSaved }) => {
  const [name, setName] = useState(court.name || '');
  const [status, setStatus] = useState(court.status || COURT_STATUS.ACTIVE);
  const [attributes, setAttributes] = useState(court.attributes || []);
  const [bookableFrom, setBookableFrom] = useState(court.bookableFrom || '');
  const [availability, setAvailability] = useState(() => toDraftAvailability(court.availability));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  useEscapeKey(close, true);

  const toggleAttribute = (value) => {
    setAttributes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const addWindow = (day) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: [...prev[day], { key: nextWindowKey(), opens: '', closes: '' }],
    }));
  };

  const removeWindow = (day, key) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].filter((w) => w.key !== key),
    }));
  };

  const updateWindow = (day, key, field, value) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].map((w) => (w.key === key ? { ...w, [field]: value } : w)),
    }));
  };

  const copyMonday = () => {
    setAvailability((prev) => {
      const next = { ...prev };
      WORKING_DAYS.slice(1).forEach((day) => {
        // Fresh keys, otherwise the same key would appear on five days at once.
        next[day] = prev.mon.map((w) => ({ ...w, key: nextWindowKey() }));
      });
      return next;
    });
  };

  const handleSave = async () => {
    const problem = validateAvailability(availability);
    if (problem) {
      setError(problem);
      return;
    }
    if (!name.trim()) {
      setError('Give the court a name.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveCourt(court.id, {
        name: name.trim(),
        status,
        attributes,
        // null rather than '' — `schedule.js` tests `court.bookableFrom &&`,
        // and an empty string would be falsy today but is not a value anyone
        // reading the document would expect to mean "no restriction".
        bookableFrom: bookableFrom || null,
        availability: fromDraftAvailability(availability),
      });
      onSaved(`Court ${court.number} saved.`);
    } catch (err) {
      setError(errorText(err, 'Could not save this court. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      // mousedown, not click: a drag that starts inside the modal and ends on
      // the overlay should not be read as "clicked outside".
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="court-edit-title"
      >
        <div className="modal__header">
          <h2 className="modal__title" id="court-edit-title">
            Edit court {court.number}
          </h2>
          <button
            type="button"
            className="btn-icon"
            onClick={close}
            aria-label="Close court editor"
            disabled={saving}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="modal__body">
          {error && (
            <div className="error-message" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="court-edit__grid">
            <div className="form-group">
              <label className="form-label" htmlFor="court-name">
                Court name
              </label>
              <input
                id="court-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="court-status">
                Status
              </label>
              <select
                id="court-status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={saving}
              >
                {Object.values(COURT_STATUS).map((value) => (
                  <option key={value} value={value}>
                    {COURT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <p className="form-hint court-mgmt__hint">
                Only active courts can be booked. Maintenance and retired courts
                disappear from the booking grid but keep their history.
              </p>
            </div>
          </div>

          <div className="form-group">
            <span className="form-label" id="court-attributes-label">
              Attributes
            </span>
            <div className="court-edit__attrs" role="group" aria-labelledby="court-attributes-label">
              {COURT_ATTRIBUTES.map((attr) => (
                <label className="court-edit__attr" key={attr.value} htmlFor={`attr-${attr.value}`}>
                  <input
                    id={`attr-${attr.value}`}
                    type="checkbox"
                    checked={attributes.includes(attr.value)}
                    onChange={() => toggleAttribute(attr.value)}
                    disabled={saving}
                  />
                  <span>{attr.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="court-bookable-from">
              Bookable from (optional)
            </label>
            <input
              id="court-bookable-from"
              className="form-input court-edit__time court-edit__time--single"
              type="time"
              value={bookableFrom}
              onChange={(e) => setBookableFrom(e.target.value)}
              disabled={saving}
            />
            <p className="form-hint court-mgmt__hint">
              For a court the club does not release until later in the day — a
              coaching court, or one shared with another sport in the morning.
              Members cannot book any slot starting before this time, even if
              the opening hours below allow it. Leave blank for no restriction.
            </p>
          </div>

          <div className="court-edit__toolbar">
            <span className="label">Opening hours</span>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-small"
              onClick={copyMonday}
              disabled={saving}
            >
              <Copy aria-hidden="true" />
              Copy Monday to all weekdays
            </button>
          </div>
          <p className="form-hint court-mgmt__hint court-mgmt__hint--block">
            Copies Monday onto Tuesday through Friday. Saturday and Sunday are
            left alone, because they rarely match the working week.
          </p>

          <div className="court-edit__days">
            {WEEK_ORDER.map((day) => {
              const windows = availability[day];
              return (
                <div className="court-edit__day" key={day}>
                  <div className="court-edit__day-head">
                    <span className="label">{WEEKDAY_LABELS[day]}</span>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => addWindow(day)}
                      disabled={saving}
                    >
                      <Plus aria-hidden="true" />
                      Add window
                    </button>
                  </div>

                  {windows.length === 0 ? (
                    <p className="court-edit__closed">Closed all day</p>
                  ) : (
                    windows.map((w, index) => (
                      <div className="court-edit__window" key={w.key}>
                        <label
                          className="visually-hidden"
                          htmlFor={`${day}-opens-${w.key}`}
                        >
                          {`${WEEKDAY_LABELS[day]} window ${index + 1} opens at`}
                        </label>
                        <input
                          id={`${day}-opens-${w.key}`}
                          className="form-input court-edit__time"
                          type="time"
                          value={w.opens}
                          onChange={(e) => updateWindow(day, w.key, 'opens', e.target.value)}
                          disabled={saving}
                        />
                        <span className="court-edit__sep" aria-hidden="true">
                          to
                        </span>
                        <label
                          className="visually-hidden"
                          htmlFor={`${day}-closes-${w.key}`}
                        >
                          {`${WEEKDAY_LABELS[day]} window ${index + 1} closes at`}
                        </label>
                        <input
                          id={`${day}-closes-${w.key}`}
                          className="form-input court-edit__time"
                          type="time"
                          value={w.closes}
                          onChange={(e) => updateWindow(day, w.key, 'closes', e.target.value)}
                          disabled={saving}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeWindow(day, w.key)}
                          aria-label={`Remove ${WEEKDAY_LABELS[day]} window ${index + 1}`}
                          disabled={saving}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save court'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ closure modal */

const ClosureModal = ({ courts, onClose, onSaved }) => {
  const today = todayKey();
  const [courtId, setCourtId] = useState(courts[0] ? courts[0].id : '');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  useEscapeKey(close, true);

  const handleSave = async () => {
    if (!courtId) {
      setError('Choose a court to close.');
      return;
    }
    if (!fromDate || !toDate) {
      setError('A closure needs a start and an end date.');
      return;
    }
    if (toDate < fromDate) {
      // Date keys are 'YYYY-MM-DD', so a string comparison is a date
      // comparison — no parsing, no timezone to get wrong.
      setError('The last day cannot be before the first day.');
      return;
    }
    if (toMinutes(toTime) <= toMinutes(fromTime)) {
      setError('The closure end time must be after its start time.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await addClosure({ courtId, fromDate, toDate, fromTime, toTime, reason: reason.trim() });
      onSaved('Closure added.');
    } catch (err) {
      setError(errorText(err, 'Could not add the closure. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="closure-title">
        <div className="modal__header">
          <h2 className="modal__title" id="closure-title">
            Add closure
          </h2>
          <button
            type="button"
            className="btn-icon"
            onClick={close}
            aria-label="Close the add closure dialog"
            disabled={saving}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="modal__body">
          {error && (
            <div className="error-message" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="closure-court">
              Court
            </label>
            <select
              id="closure-court"
              className="form-select"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              disabled={saving}
            >
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {`${court.number}. ${court.name}`}
                </option>
              ))}
            </select>
          </div>

          <div className="court-edit__grid">
            <div className="form-group">
              <label className="form-label" htmlFor="closure-from-date">
                First day closed
              </label>
              <input
                id="closure-from-date"
                className="form-input numeric"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="closure-to-date">
                Last day closed
              </label>
              <input
                id="closure-to-date"
                className="form-input numeric"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="court-edit__grid">
            <div className="form-group">
              <label className="form-label" htmlFor="closure-from-time">
                From
              </label>
              <input
                id="closure-from-time"
                className="form-input numeric"
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="closure-to-time">
                Until
              </label>
              <input
                id="closure-to-time"
                className="form-input numeric"
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <p className="form-hint court-mgmt__hint court-mgmt__hint--block">
            The times apply to every day in the range. Leave them at 00:00 and
            23:59 to close the court for whole days.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="closure-reason">
              Reason
            </label>
            <input
              id="closure-reason"
              className="form-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Floor resurfacing"
              disabled={saving}
            />
            <p className="form-hint court-mgmt__hint">
              Members see this on the booking grid. Left blank, it reads
              &quot;Closed&quot;.
            </p>
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Adding...' : 'Add closure'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- page */

const CourtManagement = ({ userProfile }) => {
  const [role, setRole] = useState(userProfile ? userProfile.role : null);

  const [courts, setCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError, setCourtsError] = useState('');

  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');

  const [closures, setClosures] = useState([]);
  const [closuresLoading, setClosuresLoading] = useState(true);
  const [closuresError, setClosuresError] = useState('');
  const [removingId, setRemovingId] = useState('');

  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');

  const [editing, setEditing] = useState(null);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [success, setSuccess] = useState('');

  const isOwner = role === ROLES.OWNER;

  /* The route already gates this page, but a page that can write club-wide
     configuration should not depend on the router alone to decide that. */
  useEffect(() => {
    if (userProfile && userProfile.role) {
      setRole(userProfile.role);
      return undefined;
    }
    const uid = auth.currentUser ? auth.currentUser.uid : null;
    if (!uid) {
      setRole('none');
      return undefined;
    }
    let cancelled = false;
    getUserProfile(uid).then((profile) => {
      if (!cancelled) setRole((profile && profile.role) || 'none');
    });
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  /* Courts are live: two administrators editing at once should each see the
     other's change rather than overwrite it silently. */
  useEffect(() => {
    if (!isOwner) return undefined;
    const unsubscribe = subscribeCourts(
      (rows) => {
        setCourts(rows);
        setCourtsError('');
        setCourtsLoading(false);
      },
      (err) => {
        setCourtsError(errorText(err, 'Could not load the courts.'));
        setCourtsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isOwner]);

  /* Guards the async loaders below: a result that lands after the page has
     been left is dropped rather than written into a dead component. */
  const aliveRef = useRef(true);
  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    []
  );

  const loadClosures = useCallback(async () => {
    setClosuresLoading(true);
    try {
      const from = todayKey();
      const rows = await getClosures(from, addDays(from, CLOSURE_HORIZON_DAYS));
      if (!aliveRef.current) return;
      // Soonest first. Date keys are 'YYYY-MM-DD', so they sort as strings.
      rows.sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
      setClosures(rows);
      setClosuresError('');
    } catch (err) {
      if (aliveRef.current) setClosuresError(errorText(err, 'Could not load closures.'));
    } finally {
      if (aliveRef.current) setClosuresLoading(false);
    }
  }, []);

  /* Closures are read once rather than subscribed: they change a handful of
     times a season, and the add/remove actions on this page refresh them. */
  useEffect(() => {
    if (!isOwner) return;
    loadClosures();
  }, [isOwner, loadClosures]);

  useEffect(() => {
    if (!isOwner) return undefined;
    let cancelled = false;
    getClubSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch((err) => {
        if (!cancelled) {
          setSettingsError(
            errorText(err, 'Could not load club settings, so opening hours are not shown.')
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  /* Confirmations are transient. The timer is cleared on unmount so a page
     left during the window does not set state on a dead component. */
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  const courtNames = useMemo(
    () =>
      courts.reduce((acc, court) => {
        acc[court.id] = `${court.number}. ${court.name}`;
        return acc;
      }, {}),
    [courts]
  );

  const today = todayKey();
  const todayWeekday = weekdayOf(today);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError('');
    // seedCourts is a callable and returns { success, error } rather than
    // throwing — see firebase/callables.js.
    const result = await seedCourts({ courtCount: COURT_COUNT });
    if (!result.success) {
      setSeedError(result.error || 'Could not create the courts.');
    } else {
      setSuccess(`${COURT_COUNT} courts created.`);
    }
    setSeeding(false);
  };

  const handleRemoveClosure = async (closure) => {
    setRemovingId(closure.id);
    setClosuresError('');
    try {
      await removeClosure(closure.id);
      await loadClosures();
      setSuccess('Closure removed.');
    } catch (err) {
      setClosuresError(errorText(err, 'Could not remove that closure.'));
    } finally {
      setRemovingId('');
    }
  };

  if (role === null) {
    return (
      <div className="court-mgmt">
        <div className="container">
          <div className="court-mgmt__loading">
            <span className="loading-spinner" aria-hidden="true" />
            <p>Checking your permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="court-mgmt">
        <div className="container">
          <div className="error-message" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>Court management is available to club owners only.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="court-mgmt">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Court management</h1>
            <p className="page-header__subtitle">
              Opening hours, status and closures for the club&apos;s courts.
            </p>
          </div>
          {courts.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowClosureModal(true)}
            >
              <Plus aria-hidden="true" />
              Add closure
            </button>
          )}
        </div>

        {success && (
          <div className="success-message" role="status">
            <Info aria-hidden="true" />
            <span>{success}</span>
          </div>
        )}

        {courtsError && (
          <div className="error-message" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{courtsError}</span>
          </div>
        )}

        {settingsError && (
          <div className="error-message" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{settingsError}</span>
          </div>
        )}

        {/* ------------------------------------------------------- courts -- */}
        <section className="court-mgmt__section" aria-labelledby="courts-heading">
          <div className="court-mgmt__section-head">
            <h2 id="courts-heading">Courts</h2>
            {settings && (
              <span className="court-mgmt__meta">
                Club hours{' '}
                <span className="numeric">
                  {settings.openTime}
                  {'–'}
                  {settings.closeTime}
                </span>
                , <span className="numeric">{settings.slotMinutes}</span> minute slots
              </span>
            )}
          </div>

          {courtsLoading ? (
            <div className="court-mgmt__loading">
              <span className="loading-spinner" aria-hidden="true" />
              <p>Loading courts...</p>
            </div>
          ) : courts.length === 0 ? (
            <div className="empty-state">
              <LayoutGrid aria-hidden="true" width={40} height={40} />
              <h3>No courts yet</h3>
              <p>
                The club has no court records. Create them once, then edit each
                court&apos;s hours and attributes here.
              </p>
              {seedError && (
                <div className="error-message court-mgmt__empty-error" role="alert">
                  <AlertCircle aria-hidden="true" />
                  <span>{seedError}</span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSeed}
                disabled={seeding}
              >
                {seeding ? 'Creating...' : "Create the club's courts"}
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table court-mgmt__table">
                <thead>
                  <tr>
                    <th scope="col" className="col-numeric">
                      No.
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Status</th>
                    <th scope="col">Attributes</th>
                    <th scope="col">{`Today (${WEEKDAY_LABELS[todayWeekday]})`}</th>
                    <th scope="col">Bookable from</th>
                    <th scope="col" className="col-actions">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courts.map((court) => {
                    const hours = describeWindows(
                      (court.availability || {})[todayWeekday]
                    );
                    const attrs = court.attributes || [];
                    return (
                      <tr key={court.id}>
                        <td className="col-numeric">{court.number}</td>
                        <td>{court.name}</td>
                        <td>
                          <span
                            className={`badge badge-${STATUS_TONE[court.status] || 'completed'}`}
                          >
                            {COURT_STATUS_LABELS[court.status] || court.status}
                          </span>
                        </td>
                        <td>
                          {attrs.length === 0 ? (
                            <span className="court-mgmt__muted">None</span>
                          ) : (
                            <span className="court-mgmt__attrs">
                              {attrs.map((value) => (
                                <span className="court-mgmt__attr" key={value}>
                                  {ATTRIBUTE_LABELS[value] || value}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td>
                          {hours ? (
                            <span className="court-mgmt__hours">{hours}</span>
                          ) : (
                            <span className="court-mgmt__muted">Closed</span>
                          )}
                        </td>
                        <td>
                          {court.bookableFrom ? (
                            <span className="court-mgmt__hours">{court.bookableFrom}</span>
                          ) : (
                            <span className="court-mgmt__muted">Any time</span>
                          )}
                        </td>
                        <td className="col-actions">
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => setEditing(court)}
                          >
                            <Pencil aria-hidden="true" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ----------------------------------------------------- closures -- */}
        <section className="court-mgmt__section" aria-labelledby="closures-heading">
          <div className="court-mgmt__section-head">
            <h2 id="closures-heading">Closures</h2>
            <span className="court-mgmt__meta">
              Upcoming closures, next{' '}
              <span className="numeric">{CLOSURE_HORIZON_DAYS}</span> days
            </span>
          </div>

          <div className="notice notice--info">
            <Info aria-hidden="true" />
            <span>
              A closure blocks new bookings for the court over the dates and
              times given. It does not cancel bookings that already exist —
              cancel those from the booking grid.
            </span>
          </div>

          {closuresError && (
            <div className="error-message" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{closuresError}</span>
            </div>
          )}

          {closuresLoading ? (
            <div className="court-mgmt__loading">
              <span className="loading-spinner" aria-hidden="true" />
              <p>Loading closures...</p>
            </div>
          ) : closures.length === 0 ? (
            <div className="empty-state">
              <CalendarOff aria-hidden="true" width={40} height={40} />
              <h3>No closures scheduled</h3>
              <p>Every court is available for its normal opening hours.</p>
              {courts.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowClosureModal(true)}
                >
                  <Plus aria-hidden="true" />
                  Add closure
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table court-mgmt__table court-mgmt__table--closures">
                <thead>
                  <tr>
                    <th scope="col">Court</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Times</th>
                    <th scope="col">Reason</th>
                    <th scope="col" className="col-actions">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map((closure) => (
                    <tr key={closure.id}>
                      <td>{courtNames[closure.courtId] || closure.courtId}</td>
                      <td className="court-mgmt__hours">
                        {closure.fromDate === closure.toDate
                          ? formatDateKey(closure.fromDate)
                          : `${formatDateKey(closure.fromDate)} – ${formatDateKey(
                              closure.toDate
                            )}`}
                      </td>
                      <td className="court-mgmt__hours">
                        {`${closure.fromTime || '00:00'}–${closure.toTime || '23:59'}`}
                      </td>
                      <td>{closure.reason || 'Closed'}</td>
                      <td className="col-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => handleRemoveClosure(closure)}
                          disabled={removingId === closure.id}
                          aria-label={`Remove closure for ${
                            courtNames[closure.courtId] || closure.courtId
                          } on ${closure.fromDate}`}
                        >
                          <Trash2 aria-hidden="true" />
                          {removingId === closure.id ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <CourtEditModal
          court={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setSuccess(message);
          }}
        />
      )}

      {showClosureModal && (
        <ClosureModal
          courts={courts}
          onClose={() => setShowClosureModal(false)}
          onSaved={(message) => {
            setShowClosureModal(false);
            setSuccess(message);
            loadClosures();
          }}
        />
      )}
    </div>
  );
};

export default CourtManagement;
