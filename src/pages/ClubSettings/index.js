import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, Plus, Save, Trash2 } from 'lucide-react';

import { getClubSettings, saveClubSettings } from '../../firebase/courts';
import { WEEKDAYS, WEEKDAY_SHORT } from '../../lib/schedule';
import './ClubSettings.css';

/**
 * Club settings — the booking rules engine, in one screen.
 *
 * Every field here is a policy decision the committee will argue about, so each
 * one carries a plain-English hint saying what it actually does. Getting these
 * wrong is the difference between a booking system members trust and one they
 * work around.
 */

const NUMERIC_FIELDS = [
  {
    key: 'maxAdvanceDays',
    label: 'Booking window (days)',
    hint: 'How far ahead members may book. Longer windows favour organised members; shorter ones spread access more evenly.',
    min: 1, max: 90,
  },
  {
    key: 'maxActiveBookingsPerMember',
    label: 'Max upcoming bookings per member',
    hint: 'Counted across all future slots. Stops a handful of members holding the diary.',
    min: 1, max: 20,
  },
  {
    key: 'maxPeakBookingsPerWeek',
    label: 'Max peak bookings per week',
    hint: 'Applies only to slots inside the peak windows below, counted per calendar week.',
    min: 1, max: 20,
  },
  {
    key: 'cancellationCutoffHours',
    label: 'Cancellation cut-off (hours)',
    hint: 'Cancelling inside this window is still allowed, but is recorded as a late cancellation. That flag is what a late-cancel fee will key off when billing arrives.',
    min: 0, max: 72,
  },
  {
    key: 'noShowGraceMinutes',
    label: 'No-show grace (minutes)',
    hint: 'How long after a slot starts before the system considers it unused.',
    min: 0, max: 60,
  },
  {
    key: 'autoConfirmResultHours',
    label: 'Result auto-confirm (hours)',
    hint: 'A submitted score that nobody disputes within this window is treated as agreed, and ratings are applied. Without it, one unresponsive opponent freezes a rating change indefinitely.',
    min: 1, max: 336,
  },
];

const ClubSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    getClubSettings()
      .then((s) => { if (live) { setSettings(s); setLoading(false); } })
      .catch((err) => {
        if (live) { setError(err.message || 'Could not load club settings.'); setLoading(false); }
      });
    return () => { live = false; };
  }, []);

  const set = (key, value) => {
    setNotice('');
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const setPeak = (index, patch) =>
    setSettings((prev) => {
      const windows = [...(prev.peakWindows || [])];
      windows[index] = { ...windows[index], ...patch };
      return { ...prev, peakWindows: windows };
    });

  const togglePeakDay = (index, day) =>
    setPeak(index, {
      days: (settings.peakWindows[index].days || []).includes(day)
        ? settings.peakWindows[index].days.filter((d) => d !== day)
        : [...(settings.peakWindows[index].days || []), day],
    });

  const addPeak = () =>
    setSettings((prev) => ({
      ...prev,
      peakWindows: [...(prev.peakWindows || []), { days: ['mon'], from: '17:00', to: '20:00' }],
    }));

  const removePeak = (index) =>
    setSettings((prev) => ({
      ...prev,
      peakWindows: prev.peakWindows.filter((_, i) => i !== index),
    }));

  const validate = () => {
    if (!settings.clubName?.trim()) return 'The club needs a name.';
    if (settings.openTime >= settings.closeTime) return 'Closing time must be after opening time.';
    for (const w of settings.peakWindows || []) {
      if (!w.days?.length) return 'Every peak window needs at least one weekday.';
      if (w.from >= w.to) return 'A peak window must end after it starts.';
    }
    for (const f of NUMERIC_FIELDS) {
      const v = Number(settings[f.key]);
      if (!Number.isFinite(v) || v < f.min || v > f.max) {
        return `${f.label} must be between ${f.min} and ${f.max}.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) { setError(problem); setNotice(''); return; }

    setSaving(true);
    setError('');
    try {
      const payload = { ...settings };
      NUMERIC_FIELDS.forEach((f) => { payload[f.key] = Number(payload[f.key]); });
      // slotMinutes is intentionally not written from this screen — see below.
      delete payload.slotMinutes;
      await saveClubSettings(payload);
      setNotice('Settings saved.');
    } catch (err) {
      setError(err.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading-block">
            <span className="loading-spinner" aria-hidden="true" />
            Loading club settings
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page">
        <div className="container">
          <div className="error-message" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error || 'Club settings are unavailable.'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page club-settings">
      <div className="container">
        <header className="page-header">
          <div>
            <h1 className="page-header__title">Club settings</h1>
            <p className="page-header__subtitle">Booking rules, peak hours and result handling</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save aria-hidden="true" />
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </header>

        {error && (
          <div className="error-message" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="success-message" role="status"><span>{notice}</span></div>
        )}

        <div className="grid grid--2">
          <section className="card">
            <div className="card-header"><h2 className="card__title">Club</h2></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="clubName">Club name</label>
                <input
                  id="clubName"
                  className="form-input"
                  value={settings.clubName || ''}
                  onChange={(e) => set('clubName', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="openTime">Opens</label>
                  <input
                    id="openTime" type="time" className="form-input"
                    value={settings.openTime || ''}
                    onChange={(e) => set('openTime', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="closeTime">Closes</label>
                  <input
                    id="closeTime" type="time" className="form-input"
                    value={settings.closeTime || ''}
                    onChange={(e) => set('closeTime', e.target.value)}
                  />
                </div>
              </div>
              <p className="form-hint">
                These bound the booking grid. Individual courts can open later or close earlier
                in Court management.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="slotMinutes">Slot length (minutes)</label>
                <input
                  id="slotMinutes" className="form-input" value={settings.slotMinutes} disabled
                />
                <p className="form-hint">
                  Fixed after go-live. Booking IDs encode the start time, so changing the slot
                  length would orphan every existing booking from its conflict check. Changing it
                  needs a migration, not a setting.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card__title">Booking rules</h2></div>
            <div className="card-body">
              {NUMERIC_FIELDS.map((f) => (
                <div className="form-group" key={f.key}>
                  <label className="form-label" htmlFor={f.key}>{f.label}</label>
                  <input
                    id={f.key}
                    type="number"
                    className="form-input"
                    min={f.min}
                    max={f.max}
                    value={settings[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  <p className="form-hint">{f.hint}</p>
                </div>
              ))}

              <div className="form-group">
                <label className="checkbox-row" htmlFor="allowWaitlist">
                  <input
                    id="allowWaitlist"
                    type="checkbox"
                    checked={!!settings.allowWaitlist}
                    onChange={(e) => set('allowWaitlist', e.target.checked)}
                  />
                  <span>
                    Allow a waitlist on full slots
                    <span className="form-hint" style={{ display: 'block' }}>
                      Members waiting are notified when a court frees up. They are not booked
                      automatically, because auto-booking someone who no longer wants the slot
                      just creates a no-show.
                    </span>
                  </span>
                </label>
              </div>

              <div className="form-group">
                <label className="checkbox-row" htmlFor="guestsAllowedAtPeak">
                  <input
                    id="guestsAllowedAtPeak"
                    type="checkbox"
                    checked={!!settings.guestsAllowedAtPeak}
                    onChange={(e) => set('guestsAllowedAtPeak', e.target.checked)}
                  />
                  <span>Allow guests during peak hours</span>
                </label>
              </div>
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: 'var(--space-5)' }}>
          <div className="card-header">
            <h2 className="card__title">Peak hours</h2>
            <button type="button" className="btn btn-small" onClick={addPeak}>
              <Plus aria-hidden="true" /> Add window
            </button>
          </div>
          <div className="card-body">
            <div className="notice notice--info">
              <Info aria-hidden="true" />
              <span>
                Peak windows drive the per-week peak quota and the guest rule. They also mark
                slots on the booking grid so members can see when demand is highest.
              </span>
            </div>

            {(settings.peakWindows || []).length === 0 ? (
              <p className="text-sm text-muted">No peak windows. Every slot counts as off-peak.</p>
            ) : (
              (settings.peakWindows || []).map((w, i) => (
                <div className="peak-row" key={`peak-${i}`}>
                  <div className="peak-row__days" role="group" aria-label={`Weekdays for peak window ${i + 1}`}>
                    {WEEKDAYS.map((day) => {
                      const on = (w.days || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`peak-day ${on ? 'peak-day--on' : ''}`}
                          aria-pressed={on}
                          onClick={() => togglePeakDay(i, day)}
                        >
                          {WEEKDAY_SHORT[day]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="peak-row__times">
                    <label className="visually-hidden" htmlFor={`peak-from-${i}`}>Peak window start</label>
                    <input
                      id={`peak-from-${i}`} type="time" className="form-input"
                      value={w.from} onChange={(e) => setPeak(i, { from: e.target.value })}
                    />
                    <span className="text-muted">to</span>
                    <label className="visually-hidden" htmlFor={`peak-to-${i}`}>Peak window end</label>
                    <input
                      id={`peak-to-${i}`} type="time" className="form-input"
                      value={w.to} onChange={(e) => setPeak(i, { to: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label={`Remove peak window ${i + 1}`}
                      onClick={() => removePeak(i)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClubSettings;
