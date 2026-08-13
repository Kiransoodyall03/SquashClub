/**
 * Tests for the two pure, correctness-critical pieces of the server: the
 * rating engine and score validation.
 *
 * Run with: node test/engine.test.js
 *
 * These specifically pin the two real defects found in the original
 * implementation: fixed-format matches were decided on aggregate points rather
 * than games won, and there was no rating floor.
 */

const r = require('../src/rating');
const assert = require('assert');

// Equal ratings, new players: winner gains ~half of K
let d = r.calculateRatingChange(1200, 1200, true, 0);
assert(d > 20 && d < 30, `equal/new win = ${d}`);
assert.strictEqual(r.calculateRatingChange(1200, 1200, false, 0), -d, 'symmetric at equal rating/experience');

// Upset is amplified
const upset = r.calculateRatingChange(1000, 1500, true, 50);
const expected = r.calculateRatingChange(1500, 1000, true, 50);
assert(upset > expected * 5, `upset ${upset} should dwarf expected ${expected}`);

// K decays with ranked experience
assert(r.kFactor(0, 1200) > r.kFactor(50, 1200), 'K decays');
assert(r.kFactor(500, 1200) >= 16, 'K floors at 16');

// Elite players are reduced ONCE (the old code double-penalised)
assert(r.kFactor(50, 2500) < r.kFactor(50, 1200), 'elite K reduced');

// Rating floor is respected
const floored = r.calculateRatingChange(405, 2000, false, 300);
assert(405 + floored >= 400, `floor breached: ${405 + floored}`);

// A result always moves the rating
assert.notStrictEqual(r.calculateRatingChange(2000, 1000, true, 400), 0, 'never zero');

// ---- score validation ----
const m = require('../src/matches');
const v = m._validateScores;

// valid best of 5 to 11
let res = v([{team1:11,team2:5},{team1:11,team2:9},{team1:11,team2:7}], 'Best of 5 to 11');
assert.strictEqual(res.winner, 'team1');
assert.strictEqual(res.team1Games, 3);

const throws = (fn, label) => { try { fn(); throw new Error('NO THROW: ' + label); } catch (e) { if (String(e.message).startsWith('NO THROW')) throw e; } };

throws(() => v([{team1:11,team2:5},{team1:11,team2:9}], 'Best of 5 to 11'), 'incomplete best-of-5');
throws(() => v([{team1:9,team2:5}], '1 game to 21'), 'game did not reach target');
throws(() => v([{team1:13,team2:5}], '1 game to 11'), 'overtime not by two');
throws(() => v([{team1:11,team2:11}], '1 game to 11'), 'draw');
throws(() => v([{team1:11,team2:10}], '1 game to 11'), 'must win by two at 10-all');

// 12-10 is legitimate
v([{team1:12,team2:10}], '1 game to 11');

// The old aggregate-points bug: 11-0, 0-11, 11-9 is 2 games to 1 -> team1 wins
res = v([{team1:11,team2:0},{team1:0,team2:11},{team1:11,team2:9}], '3 games to 11');
assert.strictEqual(res.winner, 'team1', 'games must decide, not total points');

console.log('all rating + validation tests passed');
