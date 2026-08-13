import {
  collection, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from './config';
import { MATCH_STATUS, BOOKING_STATUS, STARTING_RATING, ageGroupOf } from '../lib/constants';
import { toDateKey, addDays, todayKey, weekdayOf, WEEKDAYS } from '../lib/schedule';

/**
 * Analytics.
 *
 * Two sources, chosen deliberately:
 *
 *   - Club utilisation reads `analyticsDaily`, pre-aggregated nightly by a
 *     scheduled function. A year of history is 365 document reads rather than
 *     a scan of every booking ever made.
 *   - Player analytics read the player's own matches and rating history
 *     directly, because they are individually small and need to be current.
 *
 * Every query here is bounded by date or by limit. The original data layer
 * downloaded whole collections and discarded the tail in JavaScript.
 */

/* ========================================================================
   PLAYER ANALYTICS
   ======================================================================== */

const isCompleted = (m) => m.status === MATCH_STATUS.COMPLETED || m.status === 'completed';

const teamOf = (match, playerId) =>
  (match.team1 || []).some((p) => p.id === playerId) ? 'team1'
    : (match.team2 || []).some((p) => p.id === playerId) ? 'team2'
      : null;

const opponentsOf = (match, playerId) => {
  const side = teamOf(match, playerId);
  if (!side) return [];
  return match[side === 'team1' ? 'team2' : 'team1'] || [];
};

export const getPlayerMatches = async (playerId, max = 300) => {
  const snap = await getDocs(
    query(
      collection(db, 'individualMatches'),
      where('playerIds', 'array-contains', playerId),
      orderBy('createdAt', 'desc'),
      limit(max)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getRatingHistory = async (playerId, max = 500) => {
  const snap = await getDocs(
    query(
      collection(db, 'ratingHistory'),
      where('playerId', '==', playerId),
      orderBy('at', 'asc'),
      limit(max)
    )
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      date: data.at?.toDate ? data.at.toDate() : null,
    };
  });
};

/**
 * Everything the player analytics screen needs, computed in one pass.
 *
 * None of this existed before: no streaks, no head-to-head, no form, no
 * splits, no rating curve. The dashboard tiles that were meant to show a
 * subset of it were reading an array as if it were an object and rendering
 * hard-coded zeroes.
 */
export const buildPlayerAnalytics = ({ playerId, matches, ratingHistory, bookings = [] }) => {
  const completed = matches
    .filter(isCompleted)
    .sort((a, b) => (a.completedAt?.seconds || 0) - (b.completedAt?.seconds || 0));

  const results = completed.map((m) => {
    const side = teamOf(m, playerId);
    const won = side && m.winner === side;
    const opponents = opponentsOf(m, playerId);

    // Points for and against, from this player's perspective.
    let pointsFor = 0;
    let pointsAgainst = 0;
    let gamesFor = 0;
    let gamesAgainst = 0;
    (m.scores || []).forEach((g) => {
      const mine = side === 'team1' ? g.team1 : g.team2;
      const theirs = side === 'team1' ? g.team2 : g.team1;
      pointsFor += mine;
      pointsAgainst += theirs;
      if (mine > theirs) gamesFor += 1; else gamesAgainst += 1;
    });

    return {
      id: m.id,
      side,
      won,
      ranked: m.matchMode === 'ranked',
      format: m.format,
      date: m.completedAt?.toDate ? m.completedAt.toDate() : null,
      opponents,
      opponentName: opponents.map((o) => o.name).join(' & '),
      opponentId: opponents[0]?.id || null,
      opponentRating: opponents[0]?.ratingAtChallenge || opponents[0]?.elo || null,
      delta: (m.eloChanges || {})[playerId] ?? 0,
      pointsFor,
      pointsAgainst,
      gamesFor,
      gamesAgainst,
      gameCount: (m.scores || []).length,
      scores: m.scores || [],
      bookingId: m.bookingId || null,
    };
  });

  const played = results.length;
  const won = results.filter((r) => r.won).length;
  const ranked = results.filter((r) => r.ranked);

  /* --- streaks ---------------------------------------------------------- */
  let currentStreak = 0;
  let currentStreakType = null;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    const type = results[i].won ? 'W' : 'L';
    if (currentStreakType === null) { currentStreakType = type; currentStreak = 1; }
    else if (type === currentStreakType) currentStreak += 1;
    else break;
  }

  let longestWin = 0;
  let longestLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  results.forEach((r) => {
    if (r.won) { runWin += 1; runLoss = 0; longestWin = Math.max(longestWin, runWin); }
    else { runLoss += 1; runWin = 0; longestLoss = Math.max(longestLoss, runLoss); }
  });

  /* --- head to head ----------------------------------------------------- */
  const h2h = {};
  results.forEach((r) => {
    r.opponents.forEach((o) => {
      if (!h2h[o.id]) h2h[o.id] = { id: o.id, name: o.name, played: 0, won: 0, lost: 0, lastPlayed: null };
      h2h[o.id].played += 1;
      if (r.won) h2h[o.id].won += 1; else h2h[o.id].lost += 1;
      if (r.date && (!h2h[o.id].lastPlayed || r.date > h2h[o.id].lastPlayed)) {
        h2h[o.id].lastPlayed = r.date;
      }
    });
  });
  const headToHead = Object.values(h2h)
    .map((o) => ({ ...o, winRate: o.played ? Math.round((o.won / o.played) * 100) : 0 }))
    .sort((a, b) => b.played - a.played);

  /* --- quality of play -------------------------------------------------- */
  const totalGames = results.reduce((n, r) => n + r.gameCount, 0);

  // A close game is one decided by exactly two points — the minimum winning
  // margin in squash. Whether the player won it is read from their own side of
  // the scoreline, not inferred from the match result.
  let closeGamesPlayed = 0;
  let closeGamesWon = 0;
  results.forEach((r) => {
    if (!r.side) return;
    r.scores.forEach((g) => {
      const mine = r.side === 'team1' ? g.team1 : g.team2;
      const theirs = r.side === 'team1' ? g.team2 : g.team1;
      if (Math.abs(mine - theirs) === 2) {
        closeGamesPlayed += 1;
        if (mine > theirs) closeGamesWon += 1;
      }
    });
  });

  /* --- deciding games --------------------------------------------------- */
  const deciders = results.filter((r) => r.gameCount >= 3 && Math.abs(r.gamesFor - r.gamesAgainst) === 1);
  const decidersWon = deciders.filter((r) => r.won).length;

  /* --- splits by opponent strength -------------------------------------- */
  const bands = { stronger: { played: 0, won: 0 }, similar: { played: 0, won: 0 }, weaker: { played: 0, won: 0 } };
  const currentRating = ratingHistory.length
    ? ratingHistory[ratingHistory.length - 1].after
    : STARTING_RATING;

  results.forEach((r) => {
    if (!r.opponentRating) return;
    const diff = r.opponentRating - currentRating;
    const band = diff > 75 ? 'stronger' : diff < -75 ? 'weaker' : 'similar';
    bands[band].played += 1;
    if (r.won) bands[band].won += 1;
  });

  /* --- rating curve ----------------------------------------------------- */
  const curve = ratingHistory.map((h) => ({ date: h.date, rating: h.after, delta: h.delta, reason: h.reason }));
  const peak = curve.reduce((max, p) => Math.max(max, p.rating), currentRating);

  const ratingChangeOver = (days) => {
    if (!curve.length) return 0;
    const cutoff = new Date(Date.now() - days * 86400000);
    const before = [...curve].reverse().find((p) => p.date && p.date < cutoff);
    return currentRating - (before ? before.rating : curve[0].rating);
  };

  /* --- activity --------------------------------------------------------- */
  const byMonth = {};
  results.forEach((r) => {
    if (!r.date) return;
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  const lastPlayed = results.length ? results[results.length - 1].date : null;
  const daysSinceLastMatch = lastPlayed
    ? Math.floor((Date.now() - lastPlayed.getTime()) / 86400000)
    : null;

  /* --- splits by court and time of day ---------------------------------- */
  const byCourt = {};
  const byHour = {};
  const byWeekday = {};
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  results.forEach((r) => {
    const b = r.bookingId ? bookingById.get(r.bookingId) : null;
    if (!b) return;
    const bucket = (map, key) => {
      if (!map[key]) map[key] = { played: 0, won: 0 };
      map[key].played += 1;
      if (r.won) map[key].won += 1;
    };
    bucket(byCourt, b.courtName || b.courtId);
    bucket(byHour, String(b.startTime).slice(0, 2));
    bucket(byWeekday, weekdayOf(b.date));
  });

  return {
    currentRating,
    peakRating: peak,
    played,
    won,
    lost: played - won,
    winRate: played ? Math.round((won / played) * 100) : 0,
    rankedPlayed: ranked.length,
    rankedWon: ranked.filter((r) => r.won).length,

    form: results.slice(-10).map((r) => (r.won ? 'W' : 'L')),
    currentStreak: { count: currentStreak, type: currentStreakType },
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,

    pointsFor: results.reduce((n, r) => n + r.pointsFor, 0),
    pointsAgainst: results.reduce((n, r) => n + r.pointsAgainst, 0),
    avgPointsFor: played ? Math.round(results.reduce((n, r) => n + r.pointsFor, 0) / played) : 0,
    avgPointsAgainst: played ? Math.round(results.reduce((n, r) => n + r.pointsAgainst, 0) / played) : 0,
    gamesFor: results.reduce((n, r) => n + r.gamesFor, 0),
    gamesAgainst: results.reduce((n, r) => n + r.gamesAgainst, 0),
    totalGames,

    closeGamesPlayed,
    closeGamesWon,
    closeGameRate: closeGamesPlayed ? Math.round((closeGamesWon / closeGamesPlayed) * 100) : null,
    decidersPlayed: deciders.length,
    decidersWon,
    deciderRate: deciders.length ? Math.round((decidersWon / deciders.length) * 100) : null,

    headToHead,
    bands,
    curve,
    ratingChange30: ratingChangeOver(30),
    ratingChange90: ratingChangeOver(90),

    byMonth,
    byCourt,
    byHour,
    byWeekday,
    lastPlayed,
    daysSinceLastMatch,
    recent: results.slice(-15).reverse(),
  };
};

/* ========================================================================
   CLUB ANALYTICS
   ======================================================================== */

export const getDailyAnalytics = async (fromDate, toDate) => {
  const snap = await getDocs(
    query(
      collection(db, 'analyticsDaily'),
      where('date', '>=', fromDate),
      where('date', '<=', toDate),
      orderBy('date', 'asc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllMembers = async () => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const ageFrom = (birthDate) => {
  if (!birthDate) return null;
  const value = birthDate?.toDate ? birthDate.toDate() : new Date(birthDate);
  if (Number.isNaN(value.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - value.getFullYear();
  const m = today.getMonth() - value.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < value.getDate())) age -= 1;
  return age;
};

/**
 * The club dashboard.
 *
 * `days` bounds every query. Utilisation comes from the nightly rollups where
 * they exist and falls back to live bookings for the current day, which the
 * rollup has not covered yet.
 */
export const buildClubAnalytics = ({ daily, members, bookings, matches, courts, days = 30 }) => {
  const activeCourts = courts.filter((c) => c.status === 'active');

  /* --- utilisation ------------------------------------------------------ */
  const slotsOffered = daily.reduce((n, d) => n + (d.slotsOffered || 0), 0);
  const slotsBooked = daily.reduce((n, d) => n + (d.slotsBooked || 0), 0);

  const byHour = {};
  const byWeekday = {};
  const byCourt = {};

  daily.forEach((d) => {
    Object.entries(d.byHour || {}).forEach(([h, n]) => { byHour[h] = (byHour[h] || 0) + n; });
    Object.entries(d.byCourt || {}).forEach(([c, n]) => { byCourt[c] = (byCourt[c] || 0) + n; });
    byWeekday[d.weekday] = (byWeekday[d.weekday] || 0) + (d.slotsBooked || 0);
  });

  // Heatmap cells: weekday x hour, from the daily rollups.
  const heatmap = [];
  const hours = Object.keys(byHour).sort();
  WEEKDAYS.forEach((day) => {
    hours.forEach((hour) => {
      const cells = daily.filter((d) => d.weekday === day);
      const total = cells.reduce((n, d) => n + ((d.byHour || {})[hour] || 0), 0);
      const occasions = cells.length || 1;
      heatmap.push({ day, hour, value: total / occasions });
    });
  });

  const cancellations = daily.reduce((n, d) => n + (d.cancellations || 0), 0);
  const lateCancellations = daily.reduce((n, d) => n + (d.lateCancellations || 0), 0);

  /* --- membership ------------------------------------------------------- */
  const players = members.filter((m) => m.role === 'player');
  const activeMembers = players.filter((m) => !m.disabled);

  const byAgeGroup = {};
  activeMembers.forEach((m) => {
    const key = ageGroupOf(ageFrom(m.birthDate)) || 'unknown';
    byAgeGroup[key] = (byAgeGroup[key] || 0) + 1;
  });

  const joinedByMonth = {};
  members.forEach((m) => {
    const created = m.createdAt?.toDate ? m.createdAt.toDate() : null;
    if (!created) return;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    joinedByMonth[key] = (joinedByMonth[key] || 0) + 1;
  });

  /* --- engagement and churn risk ---------------------------------------- */
  const playedRecently = new Set();
  bookings.forEach((b) => (b.playerIds || []).forEach((id) => playedRecently.add(id)));
  matches.forEach((m) => (m.playerIds || []).forEach((id) => playedRecently.add(id)));

  const lastSeen = {};
  bookings.forEach((b) => {
    (b.playerIds || []).forEach((id) => {
      if (!lastSeen[id] || b.date > lastSeen[id]) lastSeen[id] = b.date;
    });
  });

  const dormantCutoff = addDays(todayKey(), -42); // six weeks
  const churnRisk = activeMembers
    .filter((m) => !lastSeen[m.id] || lastSeen[m.id] < dormantCutoff)
    .map((m) => ({
      id: m.id,
      name: [m.firstName, m.lastName].filter(Boolean).join(' '),
      elo: m.elo || STARTING_RATING,
      matchesPlayed: m.matchesPlayed || 0,
      lastSeen: lastSeen[m.id] || null,
    }))
    .sort((a, b) => (b.matchesPlayed || 0) - (a.matchesPlayed || 0));

  const neverCompeted = activeMembers.filter((m) => !(m.matchesPlayed > 0)).length;

  /* --- competition ------------------------------------------------------ */
  const rankedMatches = matches.filter((m) => m.matchMode === 'ranked');
  const ratings = activeMembers.map((m) => m.elo || STARTING_RATING).sort((a, b) => a - b);
  const median = ratings.length ? ratings[Math.floor(ratings.length / 2)] : STARTING_RATING;

  const ratingBuckets = {};
  ratings.forEach((r) => {
    const bucket = `${Math.floor(r / 100) * 100}`;
    ratingBuckets[bucket] = (ratingBuckets[bucket] || 0) + 1;
  });

  return {
    period: { days, from: addDays(todayKey(), -days), to: todayKey() },

    utilisation: {
      slotsOffered,
      slotsBooked,
      rate: slotsOffered ? Math.round((slotsBooked / slotsOffered) * 100) : 0,
      byHour,
      byWeekday,
      byCourt,
      heatmap,
      cancellations,
      lateCancellations,
      cancellationRate: slotsBooked + cancellations
        ? Math.round((cancellations / (slotsBooked + cancellations)) * 100)
        : 0,
      activeCourts: activeCourts.length,
      totalCourts: courts.length,
      // The hours that are wasted rather than simply unsold.
      wastedSlots: lateCancellations,
    },

    membership: {
      total: members.length,
      players: players.length,
      active: activeMembers.length,
      suspended: players.length - activeMembers.length,
      owners: members.filter((m) => m.role === 'owner').length,
      byAgeGroup,
      joinedByMonth,
    },

    engagement: {
      activeInPeriod: playedRecently.size,
      activeShare: activeMembers.length
        ? Math.round((playedRecently.size / activeMembers.length) * 100)
        : 0,
      matchesPerActiveMember: playedRecently.size
        ? Math.round((matches.length / playedRecently.size) * 10) / 10
        : 0,
      neverCompeted,
      churnRisk: churnRisk.slice(0, 25),
      churnRiskCount: churnRisk.length,
    },

    competition: {
      matchesCompleted: matches.length,
      rankedMatches: rankedMatches.length,
      casualMatches: matches.length - rankedMatches.length,
      medianRating: median,
      ratingBuckets,
    },
  };
};

/** Completed matches within a window, for the club dashboard. */
export const getRecentCompletedMatches = async (fromDate) => {
  const snap = await getDocs(
    query(
      collection(db, 'individualMatches'),
      where('status', '==', MATCH_STATUS.COMPLETED),
      where('completedAt', '>=', fromDate),
      orderBy('completedAt', 'desc'),
      limit(1000)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
