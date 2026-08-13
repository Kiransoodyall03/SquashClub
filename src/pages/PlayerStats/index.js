import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  LineChart,
  MapPin,
  RefreshCw,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { auth } from '../../firebase/config';
import {
  getPlayerMatches,
  getRatingHistory,
  buildPlayerAnalytics,
} from '../../firebase/analytics';
import { getMemberBookings } from '../../firebase/bookings';
import { WEEKDAYS, WEEKDAY_SHORT } from '../../lib/schedule';
import './PlayerStats.css';

/**
 * A member's own analytics.
 *
 * Every number on this page comes from `buildPlayerAnalytics`. Nothing is
 * recomputed here beyond presentation, because a second implementation of the
 * same arithmetic is a second implementation to keep correct.
 *
 * The three reads are settled independently rather than with Promise.all: a
 * missing Firestore index on bookings must not blank out the match analytics,
 * and the reason for whatever is missing is shown rather than swallowed.
 */

/* ----------------------------------------------------------- formatting -- */

/** Percentage or null. Never NaN, never Infinity — the denominator is checked. */
const rate = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);

/** '—' is the honest rendering of a value we do not have. */
const DASH = '—';

const showNum = (v) => (Number.isFinite(v) ? String(v) : DASH);
const showPct = (v) => (Number.isFinite(v) ? `${v}%` : DASH);
const signed = (v) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v}` : DASH);

const isDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

const fmtDate = (d) =>
  (isDate(d) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : DASH);

const fmtShortDate = (d) =>
  (isDate(d) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : DASH);

const fmtMonth = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return String(key);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

const fmtHour = (key) => `${String(key).padStart(2, '0')}:00`;

/** A scoreline written from this player's side, e.g. "11-9, 8-11, 11-6". */
const scoreLine = (result) => {
  const games = Array.isArray(result?.scores) ? result.scores : [];
  const parts = games
    .map((g) => {
      const mine = result.side === 'team1' ? g?.team1 : g?.team2;
      const theirs = result.side === 'team1' ? g?.team2 : g?.team1;
      return Number.isFinite(mine) && Number.isFinite(theirs) ? `${mine}-${theirs}` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(', ') : DASH;
};

/** Signed value with a semantic colour. Zero stays neutral — it is not a loss. */
const Delta = ({ value, suffix = '' }) => {
  if (!Number.isFinite(value)) return <span>{DASH}</span>;
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted';
  return <span className={tone}>{`${signed(value)}${suffix}`}</span>;
};

/* --------------------------------------------------------------- charts -- */

/**
 * The rating curve.
 *
 * Geometry is expressed in viewBox units, not pixels: the SVG scales with its
 * container and the stylesheet owns every colour and type size.
 */
const RatingCurve = ({ points }) => {
  const titleId = useId();
  const descId = useId();

  const ratings = points.map((p) => p.rating).filter(Number.isFinite);
  if (ratings.length === 0) return null;

  const W = 720;
  const H = 240;
  const PAD_L = 48;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 30;

  const lo = Math.min(...ratings);
  const hi = Math.max(...ratings);
  // A player whose rating never moved would give a zero span and an infinite
  // scale factor; pad the band so a flat line renders as a flat line.
  const span = hi - lo || 20;
  const yLo = lo - span * 0.15;
  const yHi = hi + span * 0.15;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = points.length;

  const x = (i) => (n === 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW);
  const y = (v) => PAD_T + (1 - (v - yLo) / (yHi - yLo)) * plotH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.rating).toFixed(1)}`)
    .join(' ');

  const ticks = [yHi, (yHi + yLo) / 2, yLo].map((v) => Math.round(v));
  const first = points.find((p) => isDate(p.date));
  const last = [...points].reverse().find((p) => isDate(p.date));

  return (
    <div className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>Rating over time</title>
        <desc id={descId}>
          {`Line chart of ${n} rating change${n === 1 ? '' : 's'}, from ${
            first ? fmtDate(first.date) : 'the first recorded change'
          } to ${last ? fmtDate(last.date) : 'the most recent change'}. Lowest ${lo}, highest ${hi}.`}
        </desc>

        {ticks.map((t) => (
          <g key={t}>
            <line className="chart__grid" x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} />
            <text className="chart__axis" x={PAD_L - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}

        <line className="chart__axis-line" x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} />
        <line className="chart__axis-line" x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} />

        <path className="chart__line" d={path} />

        {/* Dots would be noise on a long history; they only help a short one. */}
        {n <= 60 &&
          points.map((p, i) => (
            <circle key={`${p.date ? p.date.getTime() : 'x'}-${i}`} className="chart__point" cx={x(i)} cy={y(p.rating)} r="2.5" />
          ))}

        <text className="chart__axis" x={PAD_L} y={H - 8} textAnchor="start">
          {first ? fmtShortDate(first.date) : ''}
        </text>
        <text className="chart__axis" x={W - PAD_R} y={H - 8} textAnchor="end">
          {last ? fmtShortDate(last.date) : ''}
        </text>
      </svg>

      <table className="table visually-hidden">
        <caption>Rating history, one row per recorded change</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Rating</th>
            <th scope="col">Change</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.date ? p.date.getTime() : 'x'}-${i}`}>
              <th scope="row">{fmtDate(p.date)}</th>
              <td>{showNum(p.rating)}</td>
              <td>{signed(p.delta)}</td>
              <td>{p.reason || DASH}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Vertical bars from `[{ key, label, value }]`, with a hidden table beside it.
 * Flat brand fill only — height carries the value, colour carries nothing.
 */
const BarChart = ({ data, title, description, valueHeading, labelHeading }) => {
  const titleId = useId();
  const descId = useId();

  if (!data.length) return null;

  const W = 720;
  const H = 200;
  const PAD_L = 40;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const values = data.map((d) => (Number.isFinite(d.value) ? d.value : 0));
  const max = Math.max(...values, 1); // never divide by zero on an all-empty series
  const step = plotW / data.length;
  const barW = Math.max(step * 0.62, 1);
  // Too many labels collide; thin them rather than overlap them.
  const every = Math.ceil(data.length / 14);

  return (
    <div className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>

        <line className="chart__axis-line" x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} />
        <text className="chart__axis" x={PAD_L - 8} y={PAD_T + 4} textAnchor="end">{max}</text>
        <text className="chart__axis" x={PAD_L - 8} y={H - PAD_B} textAnchor="end">0</text>

        {data.map((d, i) => {
          const v = Number.isFinite(d.value) ? d.value : 0;
          const h = (v / max) * plotH;
          const cx = PAD_L + i * step + step / 2;
          return (
            <g key={d.key}>
              <rect
                className="chart__bar"
                x={cx - barW / 2}
                y={H - PAD_B - h}
                width={barW}
                height={Math.max(h, v > 0 ? 1 : 0)}
              />
              {i % every === 0 && (
                <text className="chart__axis" x={cx} y={H - 10} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <table className="table visually-hidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{labelHeading}</th>
            <th scope="col">{valueHeading}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{showNum(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ---------------------------------------------------------- small parts -- */

const Section = ({ id, icon, title, meta, children }) => (
  <section className="section" aria-labelledby={id}>
    <div className="card">
      <div className="card-header">
        <h2 className="card__title" id={id}>
          {icon}
          <span>{title}</span>
        </h2>
        {meta ? <span className="label">{meta}</span> : null}
      </div>
      <div className="card-body">{children}</div>
    </div>
  </section>
);

const EmptySection = ({ title, children }) => (
  <div className="empty-state">
    <h3>{title}</h3>
    <p className="text-sm">{children}</p>
  </div>
);

const SplitTable = ({ caption, rowHeading, rows }) => (
  <div className="table-wrap">
    <table className="table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{rowHeading}</th>
          <th scope="col" className="col-numeric">Played</th>
          <th scope="col" className="col-numeric">Won</th>
          <th scope="col" className="col-numeric">Win rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.label}</th>
            <td className="col-numeric">{showNum(r.played)}</td>
            <td className="col-numeric">{showNum(r.won)}</td>
            <td className="col-numeric">{showPct(rate(r.won, r.played))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ------------------------------------------------------------------ page -- */

const H2H_COLUMNS = [
  { key: 'name', label: 'Opponent', numeric: false },
  { key: 'played', label: 'Played', numeric: true },
  { key: 'won', label: 'Won', numeric: true },
  { key: 'lost', label: 'Lost', numeric: true },
  { key: 'winRate', label: 'Win rate', numeric: true },
  { key: 'lastPlayed', label: 'Last played', numeric: true },
];

const PlayerStats = ({ user, userProfile }) => {
  // The route may pass either prop, or neither; auth is the last resort.
  const uid = user?.uid || userProfile?.id || auth.currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [failures, setFailures] = useState([]);
  const [bookingsFailed, setBookingsFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState({ key: 'played', dir: 'desc' });

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return undefined;
    }

    // Set false on unmount and checked after every await, so a slow query
    // resolving after the member navigates away cannot set state.
    let cancelled = false;

    setLoading(true);
    setFailures([]);
    setBookingsFailed(false);

    (async () => {
      const settled = await Promise.allSettled([
        getPlayerMatches(uid),
        getRatingHistory(uid),
        getMemberBookings(uid, 200),
      ]);
      if (cancelled) return;

      const problems = [];
      const take = (result, source, fallback) => {
        if (result.status === 'fulfilled') return result.value;
        problems.push({ source, message: result.reason?.message || String(result.reason) });
        return fallback;
      };

      const matches = take(settled[0], 'Match history', []);
      const ratingHistory = take(settled[1], 'Rating history', []);
      const bookings = take(settled[2], 'Court bookings', []);

      try {
        setAnalytics(buildPlayerAnalytics({ playerId: uid, matches, ratingHistory, bookings }));
      } catch (err) {
        setAnalytics(null);
        problems.push({ source: 'Analytics', message: err?.message || String(err) });
      }

      setBookingsFailed(settled[2].status === 'rejected');
      setFailures(problems);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const toggleSort = useCallback((key) => {
    setSort((current) =>
      (current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  }, []);

  const headToHead = useMemo(() => {
    const rows = analytics?.headToHead || [];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return factor * String(a.name || '').localeCompare(String(b.name || ''));
      if (sort.key === 'lastPlayed') {
        return factor * ((isDate(a.lastPlayed) ? a.lastPlayed.getTime() : 0) - (isDate(b.lastPlayed) ? b.lastPlayed.getTime() : 0));
      }
      return factor * ((a[sort.key] || 0) - (b[sort.key] || 0));
    });
  }, [analytics, sort]);

  if (!uid) {
    return (
      <div className="page stats-page">
        <div className="container">
          <div className="error-message" role="alert">
            <AlertTriangle />
            <span>You are not signed in, so there are no statistics to show. Sign in and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page stats-page">
        <div className="container">
          <div className="stats-loading">
            <div className="loading-spinner" />
            <p className="text-muted text-sm">Loading your statistics…</p>
          </div>
        </div>
      </div>
    );
  }

  const a = analytics;
  const played = a?.played || 0;
  const curve = a?.curve || [];
  const form = a?.form || [];
  const bands = a?.bands || {};
  const monthEntries = Object.entries(a?.byMonth || {}).sort(([x], [z]) => x.localeCompare(z));

  const courtRows = Object.entries(a?.byCourt || {})
    .sort(([x], [z]) => String(x).localeCompare(String(z)))
    .map(([key, v]) => ({ key, label: key, ...v }));

  const hourRows = Object.entries(a?.byHour || {})
    .sort(([x], [z]) => String(x).localeCompare(String(z)))
    .map(([key, v]) => ({ key, label: fmtHour(key), ...v }));

  const weekdayRows = WEEKDAYS.filter((d) => (a?.byWeekday || {})[d]).map((d) => ({
    key: d,
    label: WEEKDAY_SHORT[d] || d,
    ...a.byWeekday[d],
  }));

  const hasSplits = courtRows.length > 0 || hourRows.length > 0 || weekdayRows.length > 0;

  const bandRows = [
    { key: 'stronger', label: 'Stronger (rating +75 or more)', ...(bands.stronger || { played: 0, won: 0 }) },
    { key: 'similar', label: 'Similar (within 75)', ...(bands.similar || { played: 0, won: 0 }) },
    { key: 'weaker', label: 'Weaker (rating -75 or less)', ...(bands.weaker || { played: 0, won: 0 }) },
  ];
  const bandTotal = bandRows.reduce((n, r) => n + (r.played || 0), 0);

  const pointDiff = Number.isFinite(a?.pointsFor) && Number.isFinite(a?.pointsAgainst)
    ? a.pointsFor - a.pointsAgainst
    : null;

  return (
    <div className="page stats-page">
      <div className="container">
        <header className="page-header">
          <div>
            <h1 className="page-header__title">My statistics</h1>
            <p className="page-header__subtitle">
              Everything the club records about your play. Ratings, form, opponents and court habits.
            </p>
          </div>
          <button type="button" className="btn" onClick={reload}>
            <RefreshCw />
            Refresh
          </button>
        </header>

        {/* Nothing is hidden: a failed read is named, with the reason. */}
        {failures.map((f) => (
          <div className="error-message" role="alert" key={f.source}>
            <AlertTriangle />
            <span>
              <strong>{f.source} could not be loaded.</strong> {f.message}
            </span>
          </div>
        ))}

        {!a ? (
          <EmptySection title="No statistics available">
            Nothing could be loaded for your account. Use Refresh to try again.
          </EmptySection>
        ) : (
          <>
            {/* ---------------------------------------------- headline stats */}
            <section className="section" aria-labelledby="stats-headline">
              <h2 className="visually-hidden" id="stats-headline">Headline statistics</h2>
              <div className="grid grid--4">
                <div className="stat">
                  <span className="label stat__label">Current rating</span>
                  <span className="stat__value">{showNum(a.currentRating)}</span>
                  <div className="stat__meta">
                    <span className="stats-deltas">
                      <span>
                        30d <Delta value={a.ratingChange30} />
                      </span>
                      <span>
                        90d <Delta value={a.ratingChange90} />
                      </span>
                    </span>
                  </div>
                </div>

                <div className="stat">
                  <span className="label stat__label">Peak rating</span>
                  <span className="stat__value">{showNum(a.peakRating)}</span>
                  <div className="stat__meta">
                    {Number.isFinite(a.peakRating) && Number.isFinite(a.currentRating) && a.peakRating > a.currentRating
                      ? `${a.peakRating - a.currentRating} below your peak`
                      : 'At your peak rating'}
                  </div>
                </div>

                <div className="stat">
                  <span className="label stat__label">Matches played</span>
                  <span className="stat__value">{showNum(played)}</span>
                  <div className="stat__meta">
                    {`${showNum(a.won)} won, ${showNum(a.lost)} lost`}
                  </div>
                </div>

                <div className="stat">
                  <span className="label stat__label">Win rate</span>
                  <span className="stat__value">{played > 0 ? `${a.winRate}%` : DASH}</span>
                  <div className="stat__meta">
                    {played > 0
                      ? `${showNum(a.rankedWon)} of ${showNum(a.rankedPlayed)} ranked matches won`
                      : 'No completed matches yet'}
                  </div>
                </div>
              </div>
            </section>

            {/* ----------------------------------------------- rating curve */}
            <Section
              id="stats-curve"
              icon={<LineChart aria-hidden="true" />}
              title="Rating curve"
              meta={curve.length ? `${curve.length} changes` : null}
            >
              {curve.length === 0 ? (
                <EmptySection title="No rating history yet">
                  Rating history starts accumulating from your next confirmed match. Nothing was
                  recorded before now, so there is no earlier curve to draw — this page will fill in
                  as you play.
                </EmptySection>
              ) : (
                <RatingCurve points={curve} />
              )}
            </Section>

            {/* ------------------------------------------------------- form */}
            <Section id="stats-form" icon={<Activity aria-hidden="true" />} title="Form">
              {form.length === 0 ? (
                <EmptySection title="No results yet">
                  Your last ten results will appear here once you have completed a match.
                </EmptySection>
              ) : (
                <>
                  <p className="stats-hint">Oldest on the left, most recent on the right.</p>
                  <ol className="form-strip">
                    {form.map((r, i) => (
                      <li
                        // Results have no stable id in the form array; position is the identity.
                        key={`${i}-${r}`}
                        className={`form-strip__cell ${r === 'W' ? 'form-strip__cell--win' : 'form-strip__cell--loss'}`}
                      >
                        <span aria-hidden="true">{r}</span>
                        <span className="visually-hidden">{r === 'W' ? 'Win' : 'Loss'}</span>
                      </li>
                    ))}
                  </ol>

                  <dl className="deflist stats-deflist">
                    <dt>Current streak</dt>
                    <dd className="numeric">
                      {a.currentStreak?.count
                        ? `${a.currentStreak.count} ${a.currentStreak.type === 'W' ? 'win' : 'loss'}${a.currentStreak.count === 1 ? '' : 'es'}`
                        : DASH}
                    </dd>
                    <dt>Longest win streak</dt>
                    <dd className="numeric">{showNum(a.longestWinStreak)}</dd>
                    <dt>Longest losing streak</dt>
                    <dd className="numeric">{showNum(a.longestLossStreak)}</dd>
                  </dl>
                </>
              )}
            </Section>

            {/* ------------------------------------------------ head to head */}
            <Section
              id="stats-h2h"
              icon={<Swords aria-hidden="true" />}
              title="Head to head"
              meta={headToHead.length ? `${headToHead.length} opponents` : null}
            >
              {headToHead.length === 0 ? (
                <EmptySection title="No opponents yet">
                  Once you have completed a match, every opponent you have faced is listed here with
                  your record against them.
                </EmptySection>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">
                      Your record against each opponent. Column headings sort the table.
                    </caption>
                    <thead>
                      <tr>
                        {H2H_COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            scope="col"
                            className={col.numeric ? 'col-numeric' : undefined}
                            aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          >
                            <button type="button" className="sort-btn" onClick={() => toggleSort(col.key)}>
                              <span>{col.label}</span>
                              {sort.key === col.key
                                ? (sort.dir === 'asc' ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />)
                                : null}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {headToHead.map((o) => (
                        <tr key={o.id}>
                          <th scope="row">{o.name || 'Unknown player'}</th>
                          <td className="col-numeric">{showNum(o.played)}</td>
                          <td className="col-numeric">{showNum(o.won)}</td>
                          <td className="col-numeric">{showNum(o.lost)}</td>
                          <td className="col-numeric">{showPct(rate(o.won, o.played))}</td>
                          <td className="col-numeric">{fmtShortDate(o.lastPlayed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* --------------------------------------------- quality of play */}
            <Section id="stats-quality" icon={<Target aria-hidden="true" />} title="Quality of play">
              {played === 0 ? (
                <EmptySection title="No completed matches">
                  Points, close games and deciders are counted from confirmed scorelines.
                </EmptySection>
              ) : (
                <>
                  <div className="grid grid--4">
                    <div className="stat">
                      <span className="label stat__label">Avg points for</span>
                      <span className="stat__value">{showNum(a.avgPointsFor)}</span>
                      <div className="stat__meta">{`${showNum(a.pointsFor)} in total`}</div>
                    </div>
                    <div className="stat">
                      <span className="label stat__label">Avg points against</span>
                      <span className="stat__value">{showNum(a.avgPointsAgainst)}</span>
                      <div className="stat__meta">{`${showNum(a.pointsAgainst)} in total`}</div>
                    </div>
                    <div className="stat">
                      <span className="label stat__label">Point differential</span>
                      <span className="stat__value">
                        <Delta value={pointDiff} />
                      </span>
                      <div className="stat__meta">{`Across ${showNum(a.totalGames)} games`}</div>
                    </div>
                    <div className="stat">
                      <span className="label stat__label">Games won</span>
                      <span className="stat__value">{showNum(a.gamesFor)}</span>
                      <div className="stat__meta">{`${showNum(a.gamesAgainst)} games lost`}</div>
                    </div>
                  </div>

                  <div className="table-wrap stats-spaced">
                    <table className="table">
                      <caption className="visually-hidden">Close-game and deciding-game records</caption>
                      <thead>
                        <tr>
                          <th scope="col">Situation</th>
                          <th scope="col" className="col-numeric">Played</th>
                          <th scope="col" className="col-numeric">Won</th>
                          <th scope="col" className="col-numeric">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">Close games</th>
                          <td className="col-numeric">{showNum(a.closeGamesPlayed)}</td>
                          <td className="col-numeric">{showNum(a.closeGamesWon)}</td>
                          <td className="col-numeric">{showPct(a.closeGameRate)}</td>
                        </tr>
                        <tr>
                          <th scope="row">Deciding games</th>
                          <td className="col-numeric">{showNum(a.decidersPlayed)}</td>
                          <td className="col-numeric">{showNum(a.decidersWon)}</td>
                          <td className="col-numeric">{showPct(a.deciderRate)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="stats-hint">
                    A close game is one decided by exactly two points — the narrowest winning margin in
                    squash. A deciding game is the last game of a match that went the distance.
                  </p>
                </>
              )}
            </Section>

            {/* ------------------------------------------ opponent strength */}
            <Section id="stats-bands" icon={<Trophy aria-hidden="true" />} title="By opponent strength">
              {bandTotal === 0 ? (
                <EmptySection title="No rated opponents yet">
                  This split needs opponents with a recorded rating at the time of the match. It will
                  appear once you have played a rated opponent.
                </EmptySection>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">
                      Record against stronger, similar and weaker opponents, relative to your current rating.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Opponent strength</th>
                        <th scope="col" className="col-numeric">Played</th>
                        <th scope="col" className="col-numeric">Won</th>
                        <th scope="col" className="col-numeric">Win rate</th>
                        <th scope="col" className="bar-col">Win rate bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bandRows.map((b) => {
                        const r = rate(b.won, b.played);
                        return (
                          <tr key={b.key}>
                            <th scope="row">{b.label}</th>
                            <td className="col-numeric">{showNum(b.played)}</td>
                            <td className="col-numeric">{showNum(b.won)}</td>
                            <td className="col-numeric">{showPct(r)}</td>
                            <td className="bar-col">
                              {/* The number beside it is the accessible value; the bar is decoration. */}
                              <div className="meter" aria-hidden="true">
                                <div className="meter__fill" style={{ width: `${r || 0}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ----------------------------------------------------- splits */}
            <Section id="stats-splits" icon={<MapPin aria-hidden="true" />} title="Court and time splits">
              {bookingsFailed ? (
                <div className="notice notice--error">
                  <AlertTriangle aria-hidden="true" />
                  <span>
                    Your bookings could not be read, so court, hour and weekday splits are unavailable.
                    The error is shown at the top of this page.
                  </span>
                </div>
              ) : !hasSplits ? (
                <EmptySection title="No linked bookings yet">
                  These splits are built by matching your completed matches to the court booking they
                  were played on. None of your matches has a booking attached yet, so there is nothing
                  to break down by court, hour or weekday.
                </EmptySection>
              ) : (
                <div className="grid grid--3">
                  {courtRows.length > 0 && (
                    <div>
                      <h3 className="label stats-subhead">By court</h3>
                      <SplitTable caption="Record by court" rowHeading="Court" rows={courtRows} />
                    </div>
                  )}
                  {hourRows.length > 0 && (
                    <div>
                      <h3 className="label stats-subhead">By start time</h3>
                      <SplitTable caption="Record by start time" rowHeading="Time" rows={hourRows} />
                    </div>
                  )}
                  {weekdayRows.length > 0 && (
                    <div>
                      <h3 className="label stats-subhead">By weekday</h3>
                      <SplitTable caption="Record by weekday" rowHeading="Day" rows={weekdayRows} />
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* --------------------------------------------------- activity */}
            <Section id="stats-activity" icon={<CalendarClock aria-hidden="true" />} title="Activity">
              <div className="grid grid--2">
                <div className="stat">
                  <span className="label stat__label">Last played</span>
                  <span className="stat__value stats-value--text">{fmtDate(a.lastPlayed)}</span>
                  <div className="stat__meta">
                    {Number.isFinite(a.daysSinceLastMatch)
                      ? `${a.daysSinceLastMatch} day${a.daysSinceLastMatch === 1 ? '' : 's'} ago`
                      : 'No completed match on record'}
                  </div>
                </div>
                <div className="stat">
                  <span className="label stat__label">Months with a match</span>
                  <span className="stat__value">{showNum(monthEntries.length)}</span>
                  <div className="stat__meta">
                    {monthEntries.length
                      ? `Busiest month: ${fmtMonth(monthEntries.reduce((best, e) => (e[1] > best[1] ? e : best))[0])}`
                      : 'Nothing recorded yet'}
                  </div>
                </div>
              </div>

              <div className="stats-spaced">
                {monthEntries.length === 0 ? (
                  <EmptySection title="No monthly activity yet">
                    Matches you complete are counted per month and charted here.
                  </EmptySection>
                ) : (
                  <BarChart
                    title="Matches completed per month"
                    description={`Bar chart of matches completed in each of ${monthEntries.length} month${monthEntries.length === 1 ? '' : 's'}.`}
                    labelHeading="Month"
                    valueHeading="Matches"
                    data={monthEntries.map(([key, value]) => ({ key, label: fmtMonth(key), value }))}
                  />
                )}
              </div>
            </Section>

            {/* -------------------------------------------- recent matches */}
            <Section
              id="stats-recent"
              icon={<BarChart3 aria-hidden="true" />}
              title="Recent matches"
              meta={a.recent?.length ? `Last ${a.recent.length}` : null}
            >
              {!a.recent || a.recent.length === 0 ? (
                <EmptySection title="No completed matches">
                  Confirmed match results appear here, newest first.
                </EmptySection>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">Your most recent completed matches, newest first</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Opponent</th>
                        <th scope="col">Result</th>
                        <th scope="col" className="col-numeric">Score</th>
                        <th scope="col" className="col-numeric">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.recent.map((r) => (
                        <tr key={r.id}>
                          <th scope="row" className="col-numeric stats-date-cell">{fmtShortDate(r.date)}</th>
                          <td>{r.opponentName || 'Unknown opponent'}</td>
                          <td>
                            <span className={`badge ${r.won ? 'badge-success' : 'badge-danger'}`}>
                              {r.won ? 'Won' : 'Lost'}
                            </span>
                          </td>
                          <td className="col-numeric">{scoreLine(r)}</td>
                          <td className="col-numeric">
                            <Delta value={Number.isFinite(r.delta) ? r.delta : 0} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <p className="stats-hint stats-footnote">
              <Clock aria-hidden="true" />
              <span>
                Only confirmed, completed matches count towards these figures. A match awaiting your
                opponent&apos;s confirmation is not included until it is settled.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerStats;
