/**
 * Individual matches, with two-sided confirmation.
 *
 * The original design let any player create a ranked match naming another
 * player and then enter the score alone — permanently moving the named
 * player's rating with no consent at any point. Every transition below now
 * requires the affected party to act, or a timeout to elapse.
 *
 *   createMatchChallenge -> pending_acceptance
 *   respondToChallenge   -> scheduled | declined
 *   submitMatchResult    -> awaiting_confirm
 *   confirmMatchResult   -> completed   (ratings applied here, once)
 *   disputeMatchResult   -> disputed    (owner resolves)
 *   autoConfirmResults   -> completed   (scheduled sweep, after the timeout)
 *
 * Ratings are applied in exactly one place: settleMatch(), inside a
 * transaction, guarded by a status check that makes double-settlement
 * impossible even under concurrent calls.
 */

const { onCall } = require('firebase-functions/v2/https');
const {
  db, FieldValue, HttpsError, requireMember, requireOwner, displayName,
  getSettings, audit, notify, notifyMany, recordRatingChange,
} = require('./common');
const { MATCH_STATUS, STARTING_RATING } = require('./shared');
const { settleSingles, settleDoubles } = require('./rating');

const REGION = 'europe-west1';

/* ------------------------------------------------------ score validation */

/**
 * Parse the format strings the UI produces, e.g. 'Best of 5 to 11'.
 * Returns { games, gamesToWin, pointsToWin, isBestOf }.
 */
const parseFormat = (format) => {
  const text = String(format || '');
  const points = /to\s+(\d+)/i.exec(text);
  const pointsToWin = points ? Number(points[1]) : 11;

  const bestOf = /best\s+of\s+(\d+)/i.exec(text);
  if (bestOf) {
    const games = Number(bestOf[1]);
    return { games, gamesToWin: Math.ceil(games / 2), pointsToWin, isBestOf: true };
  }

  const fixed = /^(\d+)\s+games?/i.exec(text);
  const games = fixed ? Number(fixed[1]) : 1;
  return { games, gamesToWin: games, pointsToWin, isBestOf: false };
};

/**
 * Validate a submitted score against the format.
 *
 * The original app validated essentially nothing: a client could post a winner
 * who was not in the match, scores inconsistent with the declared winner, or
 * a 50-3 game. It also decided fixed-format matches on aggregate points, so a
 * player could win two games out of three and lose the match — which is not
 * squash.
 */
const validateScores = (scores, format) => {
  const cfg = parseFormat(format);

  if (!Array.isArray(scores) || scores.length === 0) {
    throw new HttpsError('invalid-argument', 'A score is required.');
  }
  if (scores.length > cfg.games) {
    throw new HttpsError('invalid-argument', `This format is at most ${cfg.games} games.`);
  }

  let team1Games = 0;
  let team2Games = 0;

  scores.forEach((game, i) => {
    const a = Number(game.team1);
    const b = Number(game.team2);

    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      throw new HttpsError('invalid-argument', `Game ${i + 1} has an invalid score.`);
    }
    if (a === b) {
      throw new HttpsError('invalid-argument', `Game ${i + 1} cannot be a draw.`);
    }

    const high = Math.max(a, b);
    const low = Math.min(a, b);

    if (high < cfg.pointsToWin) {
      throw new HttpsError(
        'invalid-argument',
        `Game ${i + 1}: a game is played to ${cfg.pointsToWin} points.`
      );
    }
    // Beyond the target, a game continues until someone leads by two.
    if (high > cfg.pointsToWin && high - low !== 2) {
      throw new HttpsError(
        'invalid-argument',
        `Game ${i + 1}: past ${cfg.pointsToWin} the game is won by two clear points.`
      );
    }
    if (high === cfg.pointsToWin && low > cfg.pointsToWin - 2) {
      throw new HttpsError(
        'invalid-argument',
        `Game ${i + 1}: at ${cfg.pointsToWin}-${cfg.pointsToWin - 1} play continues to a two-point lead.`
      );
    }

    if (a > b) team1Games += 1;
    else team2Games += 1;
  });

  // Games are always counted. Aggregate points never decide a match.
  if (team1Games === team2Games) {
    throw new HttpsError('invalid-argument', 'The score does not produce a winner.');
  }
  const winner = team1Games > team2Games ? 'team1' : 'team2';

  if (cfg.isBestOf) {
    const winnerGames = Math.max(team1Games, team2Games);
    if (winnerGames !== cfg.gamesToWin) {
      throw new HttpsError(
        'invalid-argument',
        `A best of ${cfg.games} ends when someone reaches ${cfg.gamesToWin} games.`
      );
    }
  } else if (scores.length !== cfg.games) {
    throw new HttpsError('invalid-argument', `All ${cfg.games} games must be recorded.`);
  }

  return { winner, team1Games, team2Games };
};

/* ------------------------------------------------------------- helpers -- */

const allPlayerIds = (match) => [
  ...(match.team1 || []).map((p) => p.id),
  ...(match.team2 || []).map((p) => p.id),
];

const teamOf = (match, playerId) =>
  (match.team1 || []).some((p) => p.id === playerId) ? 'team1'
    : (match.team2 || []).some((p) => p.id === playerId) ? 'team2'
      : null;

/* -------------------------------------------------- createMatchChallenge */

exports.createMatchChallenge = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const {
    matchType = '1v1',
    matchMode = 'ranked',
    format = 'Best of 5 to 11',
    opponentIds = [],
    partnerId = null,
    bookingId = null,
    scheduledFor = null,
  } = request.data || {};

  if (matchMode === 'ranked' && !/best\s+of/i.test(format)) {
    throw new HttpsError('invalid-argument', 'Ranked matches must use a best-of format.');
  }

  const team1Ids = [member.id, ...(matchType === '2v2' && partnerId ? [partnerId] : [])];
  const team2Ids = opponentIds.filter(Boolean);

  const expectedOpponents = matchType === '2v2' ? 2 : 1;
  if (team2Ids.length !== expectedOpponents) {
    throw new HttpsError('invalid-argument', `A ${matchType} match needs ${expectedOpponents} opponent(s).`);
  }
  if (matchType === '2v2' && !partnerId) {
    throw new HttpsError('invalid-argument', 'A doubles match needs a partner.');
  }

  const everyone = [...team1Ids, ...team2Ids];
  if (new Set(everyone).size !== everyone.length) {
    throw new HttpsError('invalid-argument', 'A player cannot appear twice in the same match.');
  }

  const docs = await db.getAll(...everyone.map((id) => db.collection('users').doc(id)));
  const profiles = {};
  docs.forEach((d) => {
    if (!d.exists) throw new HttpsError('not-found', 'One of those players no longer exists.');
    const data = d.data();
    if (data.disabled) throw new HttpsError('failed-precondition', `${displayName(data)} is not an active member.`);
    profiles[d.id] = { id: d.id, ...data };
  });

  const toPlayer = (id) => ({
    id,
    name: displayName(profiles[id]),
    // Snapshot for display only. Settlement re-reads live ratings.
    ratingAtChallenge: profiles[id].elo || STARTING_RATING,
  });

  // Everyone except the creator must accept.
  const acceptances = {};
  everyone.forEach((id) => {
    acceptances[id] = id === member.id ? 'accepted' : 'pending';
  });

  const ref = db.collection('individualMatches').doc();
  const match = {
    id: ref.id,
    matchType,
    matchMode,
    format,
    team1: team1Ids.map(toPlayer),
    team2: team2Ids.map(toPlayer),
    playerIds: everyone,
    players: everyone, // legacy field name, kept so old queries keep working
    createdBy: member.id,
    createdByName: displayName(member),
    status: MATCH_STATUS.PENDING_ACCEPTANCE,
    acceptances,
    scores: [],
    winner: null,
    eloChanges: null,
    bookingId,
    scheduledFor,
    resultSubmittedBy: null,
    resultSubmittedAt: null,
    confirmations: null,
    autoConfirmAt: null,
    disputeReason: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null,
  };

  await ref.set(match);

  await audit({
    actorId: member.id, actorName: displayName(member),
    action: 'match.challenge', entity: 'individualMatch', entityId: ref.id,
    detail: { matchType, matchMode, format, opponents: team2Ids },
  });

  await notifyMany(everyone.filter((id) => id !== member.id), {
    title: `${displayName(member)} has challenged you`,
    body: `${matchMode === 'ranked' ? 'Ranked' : 'Casual'} ${matchType} - ${format}. Accept or decline.`,
    type: 'match.challenge',
    link: `/match/${ref.id}`,
    meta: { matchId: ref.id },
  });

  return { success: true, matchId: ref.id };
});

/* --------------------------------------------------- respondToChallenge */

exports.respondToChallenge = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const { matchId, accept } = request.data || {};
  if (!matchId) throw new HttpsError('invalid-argument', 'A match is required.');

  const ref = db.collection('individualMatches').doc(matchId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'That match no longer exists.');
    const match = snap.data();

    if (match.status !== MATCH_STATUS.PENDING_ACCEPTANCE) {
      throw new HttpsError('failed-precondition', 'That challenge is no longer open.');
    }
    if (!allPlayerIds(match).includes(member.id)) {
      throw new HttpsError('permission-denied', 'You are not in that match.');
    }
    if ((match.acceptances || {})[member.id] !== 'pending') {
      throw new HttpsError('failed-precondition', 'You have already responded.');
    }

    const acceptances = { ...match.acceptances, [member.id]: accept ? 'accepted' : 'declined' };

    let status = MATCH_STATUS.PENDING_ACCEPTANCE;
    if (!accept) status = MATCH_STATUS.DECLINED;
    else if (Object.values(acceptances).every((v) => v === 'accepted')) status = MATCH_STATUS.SCHEDULED;

    tx.update(ref, { acceptances, status, updatedAt: FieldValue.serverTimestamp() });
    return { status, match };
  });

  await audit({
    actorId: member.id, actorName: displayName(member),
    action: accept ? 'match.accept' : 'match.decline',
    entity: 'individualMatch', entityId: matchId, detail: {},
  });

  await notifyMany(allPlayerIds(result.match).filter((id) => id !== member.id), {
    title: accept ? 'Challenge accepted' : 'Challenge declined',
    body: `${displayName(member)} ${accept ? 'accepted' : 'declined'} the match.`,
    type: accept ? 'match.accepted' : 'match.declined',
    link: `/match/${matchId}`,
    meta: { matchId },
  });

  return { success: true, status: result.status };
});

/* ----------------------------------------------------- submitMatchResult */

exports.submitMatchResult = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const settings = await getSettings();
  const { matchId, scores } = request.data || {};
  if (!matchId) throw new HttpsError('invalid-argument', 'A match is required.');

  const ref = db.collection('individualMatches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That match no longer exists.');
  const match = snap.data();

  const playable = [MATCH_STATUS.SCHEDULED, MATCH_STATUS.AWAITING_RESULT];
  if (!playable.includes(match.status)) {
    throw new HttpsError('failed-precondition', 'A result cannot be entered for this match.');
  }
  if (!allPlayerIds(match).includes(member.id) && member.role !== 'owner') {
    throw new HttpsError('permission-denied', 'You are not in that match.');
  }

  const { winner, team1Games, team2Games } = validateScores(scores, match.format);

  // Everyone on the other side must confirm. The submitter is implicitly agreed.
  const confirmations = {};
  allPlayerIds(match).forEach((id) => {
    confirmations[id] = id === member.id ? 'confirmed' : 'pending';
  });

  const autoConfirmAt = new Date(Date.now() + (settings.autoConfirmResultHours || 72) * 3600000);

  await ref.update({
    scores: scores.map((g) => ({ team1: Number(g.team1), team2: Number(g.team2) })),
    winner,
    gamesWon: { team1: team1Games, team2: team2Games },
    status: MATCH_STATUS.AWAITING_CONFIRM,
    resultSubmittedBy: member.id,
    resultSubmittedByName: displayName(member),
    resultSubmittedAt: FieldValue.serverTimestamp(),
    confirmations,
    autoConfirmAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await audit({
    actorId: member.id, actorName: displayName(member),
    action: 'match.submitResult', entity: 'individualMatch', entityId: matchId,
    detail: { scores, winner },
  });

  await notifyMany(allPlayerIds(match).filter((id) => id !== member.id), {
    title: 'Confirm a match result',
    body: `${displayName(member)} recorded a result. Confirm it, or raise a dispute, within ${settings.autoConfirmResultHours} hours.`,
    type: 'match.confirmResult',
    link: `/match/${matchId}`,
    meta: { matchId },
  });

  return { success: true, winner };
});

/* ---------------------------------------------------- confirmMatchResult */

exports.confirmMatchResult = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const { matchId } = request.data || {};
  if (!matchId) throw new HttpsError('invalid-argument', 'A match is required.');

  const ref = db.collection('individualMatches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That match no longer exists.');
  const match = snap.data();

  if (match.status !== MATCH_STATUS.AWAITING_CONFIRM) {
    throw new HttpsError('failed-precondition', 'That result is not awaiting confirmation.');
  }
  if (!allPlayerIds(match).includes(member.id)) {
    throw new HttpsError('permission-denied', 'You are not in that match.');
  }

  const confirmations = { ...match.confirmations, [member.id]: 'confirmed' };
  const everyoneAgrees = Object.values(confirmations).every((v) => v === 'confirmed');

  if (!everyoneAgrees) {
    await ref.update({ confirmations, updatedAt: FieldValue.serverTimestamp() });
    return { success: true, settled: false };
  }

  await settleMatch(matchId, { confirmedBy: member.id, confirmations });
  return { success: true, settled: true };
});

/* ---------------------------------------------------- disputeMatchResult */

exports.disputeMatchResult = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const { matchId, reason = '' } = request.data || {};

  const ref = db.collection('individualMatches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That match no longer exists.');
  const match = snap.data();

  if (match.status !== MATCH_STATUS.AWAITING_CONFIRM) {
    throw new HttpsError('failed-precondition', 'That result is not awaiting confirmation.');
  }
  if (!allPlayerIds(match).includes(member.id)) {
    throw new HttpsError('permission-denied', 'You are not in that match.');
  }

  await ref.update({
    status: MATCH_STATUS.DISPUTED,
    confirmations: { ...match.confirmations, [member.id]: 'disputed' },
    disputeReason: String(reason).slice(0, 500),
    disputedBy: member.id,
    disputedByName: displayName(member),
    disputedAt: FieldValue.serverTimestamp(),
    autoConfirmAt: null, // a disputed result must never auto-confirm
    updatedAt: FieldValue.serverTimestamp(),
  });

  await audit({
    actorId: member.id, actorName: displayName(member),
    action: 'match.dispute', entity: 'individualMatch', entityId: matchId,
    detail: { reason },
  });

  const owners = await db.collection('users').where('role', '==', 'owner').get();
  await notifyMany(owners.docs.map((d) => d.id), {
    title: 'A match result is disputed',
    body: `${displayName(member)} disputed the result of a match. It needs resolving.`,
    type: 'match.disputed',
    link: `/match/${matchId}`,
    meta: { matchId },
  });

  return { success: true };
});

/* --------------------------------------------------------- resolveDispute */

exports.resolveDispute = onCall({ region: REGION }, async (request) => {
  const owner = await requireOwner(request);
  const { matchId, scores, cancel = false, note = '' } = request.data || {};

  const ref = db.collection('individualMatches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That match no longer exists.');
  const match = snap.data();

  if (match.status !== MATCH_STATUS.DISPUTED) {
    throw new HttpsError('failed-precondition', 'That match is not disputed.');
  }

  if (cancel) {
    await ref.update({
      status: MATCH_STATUS.CANCELLED,
      resolutionNote: String(note).slice(0, 500),
      resolvedBy: owner.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await audit({
      actorId: owner.id, actorName: displayName(owner),
      action: 'match.disputeVoided', entity: 'individualMatch', entityId: matchId, detail: { note },
    });
    await notifyMany(allPlayerIds(match), {
      title: 'Disputed match voided',
      body: 'An administrator voided the disputed match. No ratings were changed.',
      type: 'match.resolved', link: `/match/${matchId}`, meta: { matchId },
    });
    return { success: true, voided: true };
  }

  const { winner, team1Games, team2Games } = validateScores(scores, match.format);

  await ref.update({
    scores: scores.map((g) => ({ team1: Number(g.team1), team2: Number(g.team2) })),
    winner,
    gamesWon: { team1: team1Games, team2: team2Games },
    resolutionNote: String(note).slice(0, 500),
    resolvedBy: owner.id,
    resolvedByName: displayName(owner),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await settleMatch(matchId, { confirmedBy: owner.id, resolvedByOwner: true });

  return { success: true, voided: false };
});

/* ---------------------------------------------------------- settleMatch -- */

/**
 * Apply ratings and close the match. The single place ratings move for
 * individual matches.
 *
 * The status check inside the transaction is what makes double-settlement
 * impossible: two concurrent confirmations both read the document, one wins,
 * and the loser sees COMPLETED and aborts. The original code performed a
 * read-then-write check outside any transaction, so both callers passed it and
 * both applied ratings.
 */
const settleMatch = async (matchId, meta = {}) => {
  const ref = db.collection('individualMatches').doc(matchId);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const match = snap.data();

    if (match.status === MATCH_STATUS.COMPLETED) {
      throw new HttpsError('failed-precondition', 'That match is already settled.');
    }

    const ids = allPlayerIds(match);
    const userRefs = ids.map((id) => db.collection('users').doc(id));
    const userSnaps = await tx.getAll(...userRefs);

    // Live ratings, read inside the transaction. Not the snapshot taken when
    // the challenge was issued.
    const live = {};
    userSnaps.forEach((s) => {
      const d = s.data() || {};
      live[s.id] = {
        id: s.id,
        rating: d.elo || STARTING_RATING,
        rankedMatches: d.rankedMatchesPlayed || 0,
        matchesPlayed: d.matchesPlayed || 0,
        matchesWon: d.matchesWon || 0,
      };
    });

    const winningTeam = match.winner; // 'team1' | 'team2'
    const winners = (match[winningTeam] || []).map((p) => live[p.id]).filter(Boolean);
    const losers = (match[winningTeam === 'team1' ? 'team2' : 'team1'] || [])
      .map((p) => live[p.id]).filter(Boolean);

    const ranked = match.matchMode === 'ranked';
    let deltas = {};

    if (ranked) {
      if (match.matchType === '2v2') {
        deltas = settleDoubles({ winners, losers });
      } else {
        const { winnerDelta, loserDelta } = settleSingles({
          winner: winners[0], loser: losers[0],
        });
        deltas[winners[0].id] = winnerDelta;
        deltas[losers[0].id] = loserDelta;
      }
    } else {
      ids.forEach((id) => { deltas[id] = 0; });
    }

    const historyEntries = [];

    ids.forEach((id) => {
      const player = live[id];
      const won = winners.some((w) => w.id === id);
      const delta = deltas[id] || 0;
      const after = player.rating + delta;

      const update = {
        matchesPlayed: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (won) update.matchesWon = FieldValue.increment(1);

      if (ranked) {
        update.elo = after;
        update.lastEloChange = delta;
        update.ratingUpdatedAt = FieldValue.serverTimestamp();
        // Counted separately so casual play cannot deflate the K-factor.
        update.rankedMatchesPlayed = FieldValue.increment(1);
        update.peakRating = Math.max(player.rating, after, 0);

        historyEntries.push({
          playerId: id,
          before: player.rating,
          after,
          delta,
          reason: 'match',
          matchId,
          opponentId: won ? losers[0]?.id : winners[0]?.id,
          opponentRating: won ? losers[0]?.rating : winners[0]?.rating,
        });
      }

      tx.update(db.collection('users').doc(id), update);
    });

    tx.update(ref, {
      status: MATCH_STATUS.COMPLETED,
      eloChanges: deltas,
      confirmations: meta.confirmations || match.confirmations,
      settledAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      autoConfirmAt: null,
      settlementReason: meta.resolvedByOwner ? 'owner_resolution'
        : meta.auto ? 'auto_confirmed' : 'confirmed',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Rating history is written inside the same transaction so the curve can
    // never disagree with the profile.
    historyEntries.forEach((entry) => {
      tx.set(db.collection('ratingHistory').doc(), {
        ...entry,
        at: FieldValue.serverTimestamp(),
      });
    });

    return { deltas, ids, ranked };
  });

  await audit({
    actorId: meta.confirmedBy || 'system',
    action: 'match.settled', entity: 'individualMatch', entityId: matchId,
    detail: { deltas: outcome.deltas, ranked: outcome.ranked, auto: !!meta.auto },
  });

  await notifyMany(outcome.ids, {
    title: 'Match confirmed',
    body: outcome.ranked ? 'The result is confirmed and ratings have been updated.'
      : 'The result is confirmed.',
    type: 'match.completed',
    link: `/match/${matchId}`,
    meta: { matchId },
  });

  return outcome;
};

/* --------------------------------------------------------- cancelMatch -- */

exports.cancelMatch = onCall({ region: REGION }, async (request) => {
  const member = await requireMember(request);
  const { matchId, reason = '' } = request.data || {};

  const ref = db.collection('individualMatches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That match no longer exists.');
  const match = snap.data();

  const terminal = [MATCH_STATUS.COMPLETED, MATCH_STATUS.CANCELLED, MATCH_STATUS.DECLINED];
  if (terminal.includes(match.status)) {
    throw new HttpsError('failed-precondition', 'That match can no longer be cancelled.');
  }
  // A submitted result may only be withdrawn by the person who submitted it,
  // or by an administrator — otherwise a losing player could cancel to escape.
  if (match.status === MATCH_STATUS.AWAITING_CONFIRM
      && match.resultSubmittedBy !== member.id && member.role !== 'owner') {
    throw new HttpsError(
      'permission-denied',
      'A submitted result can only be withdrawn by whoever entered it, or by an administrator. Raise a dispute instead.'
    );
  }
  if (!allPlayerIds(match).includes(member.id) && member.role !== 'owner') {
    throw new HttpsError('permission-denied', 'You are not in that match.');
  }

  await ref.update({
    status: MATCH_STATUS.CANCELLED,
    cancelledBy: member.id,
    cancelledByName: displayName(member),
    cancellationReason: String(reason).slice(0, 300),
    cancelledAt: FieldValue.serverTimestamp(),
    autoConfirmAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await audit({
    actorId: member.id, actorName: displayName(member),
    action: 'match.cancel', entity: 'individualMatch', entityId: matchId, detail: { reason },
  });

  await notifyMany(allPlayerIds(match).filter((id) => id !== member.id), {
    title: 'Match cancelled',
    body: `${displayName(member)} cancelled the match.`,
    type: 'match.cancelled', link: `/match/${matchId}`, meta: { matchId },
  });

  return { success: true };
});

exports._settleMatch = settleMatch;
exports._validateScores = validateScores;
exports._parseFormat = parseFormat;
