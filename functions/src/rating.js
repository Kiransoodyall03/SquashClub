/**
 * The rating engine.
 *
 * This is the original ELO implementation with four defects corrected:
 *
 *   1. A rating floor. The original had none, so a long losing streak could
 *      drive a rating to zero or negative.
 *   2. Casual matches no longer inflate the K-factor. The original incremented
 *      matchesPlayed for casual play, which is the sole K-factor input — so a
 *      player could grind casual games to drive K from 50 down to 16 while
 *      their rating stayed frozen at 1200. Ranked matches are now counted
 *      separately in `rankedMatchesPlayed`.
 *   3. Elite players are no longer penalised twice. The original applied both
 *      a K reduction and a deflation factor above 2200.
 *   4. Ratings are read live at settlement rather than from a snapshot taken
 *      when the match or tournament was created.
 *
 * The engine is pure. It is the only place ratings are calculated, on either
 * side of the wire.
 */

const { STARTING_RATING, RATING_FLOOR } = require('./shared');

/**
 * K-factor by ranked experience, with a reduction for elite ratings.
 * Continuous at every band boundary.
 */
const kFactor = (rankedMatches, rating) => {
  const m = Math.max(0, rankedMatches || 0);
  let k;

  if (m <= 10) k = 50 - m * 1.0;                 // 50 -> 40
  else if (m <= 30) k = 40 - (m - 10) * 0.4;      // 40 -> 32
  else if (m <= 100) k = 32 - (m - 30) * 0.114;   // 32 -> 24
  else if (m <= 200) k = 24 - (m - 100) * 0.04;   // 24 -> 20
  else k = Math.max(20 - (m - 200) * 0.02, 16);   // 20 -> 16 floor

  // Elite stabilisation. Applied here only — there is no second deflation
  // step, unlike the original implementation.
  if (rating >= 2400) k = Math.max(k - 4, 12);
  else if (rating >= 2200) k = Math.max(k - 2, 14);

  return k;
};

/**
 * Amplify genuine upsets, damp expected results against much weaker players.
 * Only engages once the gap is at least 200 points.
 */
const upsetMultiplier = (playerRating, opponentRating, won) => {
  const diff = Math.abs(playerRating - opponentRating);
  if (diff < 200) return 1.0;

  const lowerRated = playerRating < opponentRating;
  const isUpset = (lowerRated && won) || (!lowerRated && !won);

  if (isUpset && won) return diff >= 400 ? 1.3 : diff >= 300 ? 1.2 : 1.15;
  if (isUpset && !won) return diff >= 400 ? 1.25 : diff >= 300 ? 1.15 : 1.1;
  if (!isUpset && won && diff >= 300) return 0.85;
  return 1.0;
};

const expectedScore = (playerRating, opponentRating) =>
  1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

/**
 * The rating change for one player in one match.
 *
 * @param {number} playerRating   current rating
 * @param {number} opponentRating current rating of the opponent (or team average)
 * @param {boolean} won
 * @param {number} rankedMatches  RANKED matches played before this one
 * @returns {number} integer delta, already floored
 */
const calculateRatingChange = (playerRating, opponentRating, won, rankedMatches = 0) => {
  const rating = playerRating || STARTING_RATING;
  const opponent = opponentRating || STARTING_RATING;

  const k = kFactor(rankedMatches, rating);
  const expected = expectedScore(rating, opponent);
  const actual = won ? 1 : 0;

  let delta = k * (actual - expected) * upsetMultiplier(rating, opponent, won);
  delta = Math.round(delta);

  // A result should always move the rating, even fractionally, or experienced
  // players stall permanently at an inaccurate number.
  if (delta === 0) delta = won ? 1 : -1;

  // Never push a rating below the floor.
  if (rating + delta < RATING_FLOOR) delta = RATING_FLOOR - rating;

  return delta;
};

/**
 * Both sides of a singles result in one call, so callers cannot accidentally
 * settle one player and not the other.
 */
const settleSingles = ({ winner, loser }) => ({
  winnerDelta: calculateRatingChange(winner.rating, loser.rating, true, winner.rankedMatches),
  loserDelta: calculateRatingChange(loser.rating, winner.rating, false, loser.rankedMatches),
});

/**
 * Doubles. Each player is rated against the opposing team's average.
 *
 * This is a known simplification: it lets a strong player be dragged down by a
 * weak partner. Rating doubles separately from singles is on the roadmap.
 */
const settleDoubles = ({ winners, losers }) => {
  const avg = (players) =>
    players.reduce((sum, p) => sum + (p.rating || STARTING_RATING), 0) / (players.length || 1);

  const winnerAvg = avg(winners);
  const loserAvg = avg(losers);

  const deltas = {};
  winners.forEach((p) => {
    deltas[p.id] = calculateRatingChange(p.rating, loserAvg, true, p.rankedMatches);
  });
  losers.forEach((p) => {
    deltas[p.id] = calculateRatingChange(p.rating, winnerAvg, false, p.rankedMatches);
  });
  return deltas;
};

/** Preview used by the client before a match is created. Same maths, no writes. */
const previewChange = (playerRating, opponentRating, rankedMatches) => ({
  win: calculateRatingChange(playerRating, opponentRating, true, rankedMatches),
  loss: calculateRatingChange(playerRating, opponentRating, false, rankedMatches),
});

module.exports = {
  kFactor,
  upsetMultiplier,
  expectedScore,
  calculateRatingChange,
  settleSingles,
  settleDoubles,
  previewChange,
};
