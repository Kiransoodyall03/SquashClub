import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Download, Info, TrendingDown, Users,
} from 'lucide-react';

import {
  getDailyAnalytics, getAllMembers, getRecentCompletedMatches, buildClubAnalytics,
} from '../../firebase/analytics';
import { getRangeBookings } from '../../firebase/bookings';
import { getCourts } from '../../firebase/courts';
import { addDays, todayKey, WEEKDAYS, WEEKDAY_SHORT, formatDateKey } from '../../lib/schedule';
import { AGE_GROUPS } from '../../lib/constants';
import './ClubAnalytics.css';

/**
 * Club analytics for the owner.
 *
 * The questions this screen exists to answer are commercial, not sporting:
 * which of the fifteen courts earn their keep, when is demand concentrated,
 * who is drifting away, and is the club getting stronger.
 *
 * Utilisation comes from the nightly `analyticsDaily` rollups rather than a
 * scan of every booking — a year of history is 365 reads instead of tens of
 * thousands.
 */

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

/* --------------------------------------------------------------- helpers */

const pct = (n) => (Number.isFinite(n) ? `${Math.round(n)}%` : '-');

const downloadCsv = (filename, headers, rows) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Horizontal bar for a table cell. Flat fill, no gradient. */
const Bar = ({ value, max, tone = '' }) => {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-col">
      <div className="bar-col__track">
        <div className={`bar-col__fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="bar-col__value">{value}</span>
    </div>
  );
};

const CsvButton = ({ onClick, label = 'Download CSV' }) => (
  <button type="button" className="btn btn-small" onClick={onClick}>
    <Download aria-hidden="true" /> {label}
  </button>
);

/* ----------------------------------------------------------------- page */

const ClubAnalytics = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rollupsMissing, setRollupsMissing] = useState(false);

  const load = useCallback(async (windowDays) => {
    setLoading(true);
    setError('');
    const from = addDays(todayKey(), -windowDays);
    const to = todayKey();

    try {
      const [daily, members, bookings, matches, courts] = await Promise.all([
        getDailyAnalytics(from, to),
        getAllMembers(),
        getRangeBookings(from, to),
        getRecentCompletedMatches(new Date(Date.now() - windowDays * 86400000)),
        getCourts(),
      ]);

      setRollupsMissing(daily.length === 0);
      setData(buildClubAnalytics({ daily, members, bookings, matches, courts, days: windowDays }));
    } catch (err) {
      setError(err.message || 'Could not load club analytics.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    load(days).catch(() => {});
    return () => { live = false; };
  }, [days, load]);

  const heat = useMemo(() => {
    if (!data) return { hours: [], max: 0, lookup: new Map() };
    const cells = data.utilisation.heatmap || [];
    const hours = [...new Set(cells.map((c) => c.hour))].sort();
    const max = cells.reduce((m, c) => Math.max(m, c.value), 0);
    const lookup = new Map(cells.map((c) => [`${c.day}|${c.hour}`, c.value]));
    return { hours, max, lookup };
  }, [data]);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading-block">
            <span className="loading-spinner" aria-hidden="true" />
            Loading club analytics
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="container">
          <div className="error-message" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error || 'No analytics available.'}</span>
          </div>
        </div>
      </div>
    );
  }

  const { utilisation: u, membership: m, engagement: e, competition: c } = data;

  const courtRows = Object.entries(u.byCourt).sort((a, b) => b[1] - a[1]);
  const maxCourt = courtRows.reduce((max, [, n]) => Math.max(max, n), 0);
  const hourRows = Object.entries(u.byHour).sort((a, b) => a[0].localeCompare(b[0]));
  const maxHour = hourRows.reduce((max, [, n]) => Math.max(max, n), 0);
  const weekdayRows = WEEKDAYS.map((d) => [d, u.byWeekday[d] || 0]);
  const maxWeekday = weekdayRows.reduce((max, [, n]) => Math.max(max, n), 0);
  const joinRows = Object.entries(m.joinedByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxJoin = joinRows.reduce((max, [, n]) => Math.max(max, n), 0);
  const ratingRows = Object.entries(c.ratingBuckets).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxRating = ratingRows.reduce((max, [, n]) => Math.max(max, n), 0);

  return (
    <div className="page club-analytics">
      <div className="container">
        <header className="page-header">
          <div>
            <h1 className="page-header__title">Club analytics</h1>
            <p className="page-header__subtitle">
              {formatDateKey(data.period.from, { day: 'numeric', month: 'short' })}
              {' to '}
              {formatDateKey(data.period.to, { day: 'numeric', month: 'short' })}
            </p>
          </div>
          <div className="tabs" role="tablist" aria-label="Reporting period">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                role="tab"
                aria-selected={days === p.days}
                className={`tab ${days === p.days ? 'is-active' : ''}`}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {rollupsMissing && (
          <div className="notice notice--info">
            <Info aria-hidden="true" />
            <span>
              No nightly rollups exist yet, so utilisation history is empty. The scheduled job
              writes one summary per day at 01:15 — figures will start appearing tomorrow.
              Membership and competition figures below are live and already accurate.
            </span>
          </div>
        )}

        {/* ---------------------------------------------------- headline */}
        <div className="grid grid--4">
          <div className="stat">
            <span className="stat__label label">Court utilisation</span>
            <span className="stat__value">{pct(u.rate)}</span>
            <span className="stat__meta">{u.slotsBooked} of {u.slotsOffered} slots</span>
          </div>
          <div className="stat">
            <span className="stat__label label">Active members</span>
            <span className="stat__value">{e.activeInPeriod}</span>
            <span className="stat__meta">{pct(e.activeShare)} of {m.active} on the roll</span>
          </div>
          <div className="stat">
            <span className="stat__label label">Matches completed</span>
            <span className="stat__value">{c.matchesCompleted}</span>
            <span className="stat__meta">{c.rankedMatches} ranked, {c.casualMatches} casual</span>
          </div>
          <div className="stat">
            <span className="stat__label label">Courts in service</span>
            <span className="stat__value">{u.activeCourts}</span>
            <span className="stat__meta">of {u.totalCourts} total</span>
          </div>
        </div>

        {/* -------------------------------------------------- heatmap */}
        <section className="section">
          <div className="card">
            <div className="card-header">
              <h2 className="card__title">When the club is busy</h2>
              <span className="text-xs text-muted">Average bookings per weekday and hour</span>
            </div>
            <div className="card-body">
              {heat.hours.length === 0 ? (
                <p className="text-sm text-muted">
                  No booking history in this period yet.
                </p>
              ) : (
                <>
                  <div className="heatmap" role="img" aria-label="Booking density by weekday and hour">
                    <div className="heatmap__corner" />
                    {heat.hours.map((h) => (
                      <div key={h} className="heatmap__hour label">{h}</div>
                    ))}
                    {WEEKDAYS.map((day) => (
                      <React.Fragment key={day}>
                        <div className="heatmap__day label">{WEEKDAY_SHORT[day]}</div>
                        {heat.hours.map((h) => {
                          const v = heat.lookup.get(`${day}|${h}`) || 0;
                          const intensity = heat.max > 0 ? v / heat.max : 0;
                          return (
                            <div
                              key={`${day}-${h}`}
                              className="heatmap__cell"
                              /* Single hue, varying opacity. A multi-hue scale
                                 would be prettier and much harder to read. */
                              style={{ opacity: 0.08 + intensity * 0.92 }}
                              title={`${WEEKDAY_SHORT[day]} ${h}:00 - ${v.toFixed(1)} bookings`}
                            />
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
                    Darker means busier. Peak is {heat.max.toFixed(1)} bookings in a single hour.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- utilisation */}
        <div className="grid grid--2">
          <section className="card">
            <div className="card-header">
              <h2 className="card__title">Court usage</h2>
              <CsvButton
                onClick={() => downloadCsv('court-usage.csv', ['Court', 'Bookings'], courtRows)}
              />
            </div>
            <div className="card-body">
              {courtRows.length === 0 ? (
                <p className="text-sm text-muted">No bookings recorded in this period.</p>
              ) : (
                <table className="table">
                  <caption className="visually-hidden">Bookings per court</caption>
                  <thead>
                    <tr><th scope="col">Court</th><th scope="col">Bookings</th></tr>
                  </thead>
                  <tbody>
                    {courtRows.map(([court, n]) => (
                      <tr key={court}>
                        <th scope="row">{court}</th>
                        <td><Bar value={n} max={maxCourt} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card__title">Demand by hour</h2></div>
            <div className="card-body">
              {hourRows.length === 0 ? (
                <p className="text-sm text-muted">No bookings recorded in this period.</p>
              ) : (
                <table className="table">
                  <caption className="visually-hidden">Bookings per hour of day</caption>
                  <thead><tr><th scope="col">Hour</th><th scope="col">Bookings</th></tr></thead>
                  <tbody>
                    {hourRows.map(([hour, n]) => (
                      <tr key={hour}>
                        <th scope="row" className="numeric">{hour}:00</th>
                        <td><Bar value={n} max={maxHour} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid--2">
          <section className="card">
            <div className="card-header"><h2 className="card__title">Demand by weekday</h2></div>
            <div className="card-body">
              <table className="table">
                <caption className="visually-hidden">Bookings per weekday</caption>
                <thead><tr><th scope="col">Day</th><th scope="col">Bookings</th></tr></thead>
                <tbody>
                  {weekdayRows.map(([day, n]) => (
                    <tr key={day}>
                      <th scope="row">{WEEKDAY_SHORT[day]}</th>
                      <td><Bar value={n} max={maxWeekday} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card__title">Wasted capacity</h2></div>
            <div className="card-body">
              <dl className="deflist">
                <dt>Cancellations</dt>
                <dd className="numeric">{u.cancellations}</dd>
                <dt>Late cancellations</dt>
                <dd className="numeric">{u.lateCancellations}</dd>
                <dt>Cancellation rate</dt>
                <dd className="numeric">{pct(u.cancellationRate)}</dd>
              </dl>
              <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
                Late cancellations are the ones that hurt: the slot is released too close to the
                start for anyone else to take it, so the court sits empty. This is the number a
                late-cancellation fee would target when billing is added.
              </p>
            </div>
          </section>
        </div>

        {/* -------------------------------------------------- membership */}
        <div className="grid grid--2">
          <section className="card">
            <div className="card-header"><h2 className="card__title">Membership</h2></div>
            <div className="card-body">
              <div className="grid grid--2" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="stat">
                  <span className="stat__label label">Active</span>
                  <span className="stat__value">{m.active}</span>
                </div>
                <div className="stat">
                  <span className="stat__label label">Suspended</span>
                  <span className="stat__value">{m.suspended}</span>
                </div>
              </div>
              <table className="table">
                <caption className="visually-hidden">Members by age group</caption>
                <thead><tr><th scope="col">Age group</th><th scope="col" className="col-numeric">Members</th></tr></thead>
                <tbody>
                  {AGE_GROUPS.filter((g) => g.key !== 'all').map((g) => (
                    <tr key={g.key}>
                      <th scope="row">{g.title}</th>
                      <td className="col-numeric">{m.byAgeGroup[g.key] || 0}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="text-muted">Date of birth not recorded</th>
                    <td className="col-numeric">{m.byAgeGroup.unknown || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card__title">Joiners by month</h2></div>
            <div className="card-body">
              {joinRows.length === 0 ? (
                <p className="text-sm text-muted">No join dates recorded.</p>
              ) : (
                <table className="table">
                  <caption className="visually-hidden">New members per month</caption>
                  <thead><tr><th scope="col">Month</th><th scope="col">Joined</th></tr></thead>
                  <tbody>
                    {joinRows.map(([month, n]) => (
                      <tr key={month}>
                        <th scope="row" className="numeric">{month}</th>
                        <td><Bar value={n} max={maxJoin} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        {/* -------------------------------------------------- engagement */}
        <section className="section">
          <div className="card">
            <div className="card-header">
              <h2 className="card__title">
                <TrendingDown aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Members at risk of drifting away
              </h2>
              <CsvButton
                onClick={() => downloadCsv(
                  'churn-risk.csv',
                  ['Name', 'Rating', 'Matches played', 'Last on court'],
                  e.churnRisk.map((p) => [p.name, p.elo, p.matchesPlayed, p.lastSeen || 'never'])
                )}
              />
            </div>
            <div className="card-body">
              <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>
                These {e.churnRiskCount} members have not been on a court in six weeks. This is
                the most actionable list on the page: a phone call or an invitation to a box
                league recovers far more members than a renewal reminder does.
              </p>
              {e.churnRisk.length === 0 ? (
                <p className="text-sm">Nobody has gone quiet. Unusual, and good.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">Members who have not played recently</caption>
                    <thead>
                      <tr>
                        <th scope="col">Member</th>
                        <th scope="col" className="col-numeric">Rating</th>
                        <th scope="col" className="col-numeric">Matches</th>
                        <th scope="col">Last on court</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.churnRisk.map((p) => (
                        <tr key={p.id}>
                          <th scope="row">{p.name || 'Unnamed member'}</th>
                          <td className="col-numeric">{p.elo}</td>
                          <td className="col-numeric">{p.matchesPlayed}</td>
                          <td>{p.lastSeen ? formatDateKey(p.lastSeen) : <span className="text-muted">Never</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- competition */}
        <div className="grid grid--2">
          <section className="card">
            <div className="card-header"><h2 className="card__title">Engagement</h2></div>
            <div className="card-body">
              <dl className="deflist">
                <dt>Active share</dt><dd className="numeric">{pct(e.activeShare)}</dd>
                <dt>Matches per active member</dt><dd className="numeric">{e.matchesPerActiveMember}</dd>
                <dt>Never competed</dt><dd className="numeric">{e.neverCompeted}</dd>
              </dl>
              <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
                Members who have never entered a match usually point at a programme gap rather
                than a lack of interest. A beginners box is the standard fix.
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card__title">Rating distribution</h2>
              <span className="text-xs text-muted">Median {c.medianRating}</span>
            </div>
            <div className="card-body">
              {ratingRows.length === 0 ? (
                <p className="text-sm text-muted">No rated members yet.</p>
              ) : (
                <table className="table">
                  <caption className="visually-hidden">Members per rating band</caption>
                  <thead><tr><th scope="col">Band</th><th scope="col">Members</th></tr></thead>
                  <tbody>
                    {ratingRows.map(([bucket, n]) => (
                      <tr key={bucket}>
                        <th scope="row" className="numeric">{bucket}-{Number(bucket) + 99}</th>
                        <td><Bar value={n} max={maxRating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ClubAnalytics;
