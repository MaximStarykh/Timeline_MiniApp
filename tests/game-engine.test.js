import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame,
  createSeededRandom,
  drawEvent,
  insertChronologically,
  isGapCorrect,
  placeCurrent,
} from '../game-engine.js';

const FIXTURES = [
  { id: 'a', year: 100, title: 'A' },
  { id: 'b', year: 200, title: 'B' },
  { id: 'c', year: 300, title: 'C' },
  { id: 'd', year: 400, title: 'D' },
  { id: 'e', year: 500, title: 'E' },
  { id: 'f', year: 500, title: 'F' },
];

function makePlacingState({
  timeline = [FIXTURES[1]],
  current = FIXTURES[2],
  drawPile = [FIXTURES[3]],
  lives = 3,
  streak = 0,
  bestStreak = 0,
  score = 0,
  resolvedCount = 1,
  correctCount = 0,
  incorrectCount = 0,
  deckSize = 4,
} = {}) {
  return {
    deckSize,
    drawPile,
    timeline,
    current,
    phase: 'placing',
    lives,
    score,
    streak,
    bestStreak,
    resolvedCount,
    correctCount,
    incorrectCount,
    lastResult: null,
  };
}

test('creates a unique deterministic session with one anchor', () => {
  const first = createGame(FIXTURES, {
    deckSize: 4,
    rng: createSeededRandom(7),
  });
  const second = createGame(FIXTURES, {
    deckSize: 4,
    rng: createSeededRandom(7),
  });
  const ids = [...first.timeline, ...first.drawPile].map((event) => event.id);

  assert.equal(new Set(ids).size, 4);
  assert.deepEqual(first, second);
  assert.equal(first.timeline.length, 1);
  assert.equal(first.drawPile.length, 3);
  assert.equal(first.resolvedCount, 1);
  assert.equal(first.phase, 'ready');
});

test('validates deck size boundaries', () => {
  assert.throws(
    () => createGame(FIXTURES, { deckSize: FIXTURES.length + 1 }),
    /deck size cannot exceed event catalog/i,
  );
  assert.throws(
    () => createGame(FIXTURES, { deckSize: 1 }),
    /at least 2/i,
  );
});

test('draws exactly one current event only from the ready phase', () => {
  const game = createGame(FIXTURES, {
    deckSize: 4,
    rng: createSeededRandom(3),
  });
  const placing = drawEvent(game);

  assert.equal(placing.phase, 'placing');
  assert.equal(placing.current.id, game.drawPile[0].id);
  assert.equal(placing.drawPile.length, game.drawPile.length - 1);
  assert.equal(game.current, null);
  assert.throws(() => drawEvent(placing), /cannot draw/i);
});

test('recognizes legal gaps including equal-year neighbors', () => {
  const timeline = [FIXTURES[0], FIXTURES[2], FIXTURES[4]];

  assert.equal(isGapCorrect(timeline, FIXTURES[1], 1), true);
  assert.equal(isGapCorrect(timeline, FIXTURES[1], 0), false);
  assert.equal(isGapCorrect(timeline, FIXTURES[5], 2), true);
  assert.equal(isGapCorrect(timeline, FIXTURES[5], 3), true);
});

test('inserts events chronologically without mutating the timeline', () => {
  const timeline = [FIXTURES[0], FIXTURES[2], FIXTURES[4]];
  const inserted = insertChronologically(timeline, FIXTURES[1]);

  assert.deepEqual(inserted.map((event) => event.year), [100, 200, 300, 500]);
  assert.deepEqual(timeline.map((event) => event.year), [100, 300, 500]);
});

test('awards base and streak score for consecutive correct placements', () => {
  const first = placeCurrent(makePlacingState(), 1);
  const second = placeCurrent(makePlacingState({
    timeline: first.timeline,
    current: FIXTURES[3],
    drawPile: [],
    streak: first.streak,
    bestStreak: first.bestStreak,
    score: first.score,
    resolvedCount: first.resolvedCount,
    correctCount: first.correctCount,
    deckSize: 3,
  }), 2);

  assert.equal(first.lastResult.correct, true);
  assert.equal(first.score, 100);
  assert.equal(first.streak, 1);
  assert.equal(second.score, 225);
  assert.equal(second.streak, 2);
  assert.equal(second.bestStreak, 2);
  assert.equal(second.phase, 'finished');
});

test('corrects a wrong placement, loses one life, and preserves sorted order', () => {
  const state = makePlacingState({
    timeline: [FIXTURES[0], FIXTURES[3]],
    current: FIXTURES[2],
    streak: 3,
    bestStreak: 3,
    score: 500,
    resolvedCount: 2,
  });
  const resolved = placeCurrent(state, 0);

  assert.equal(resolved.lastResult.correct, false);
  assert.equal(resolved.lastResult.year, 300);
  assert.equal(resolved.lives, 2);
  assert.equal(resolved.streak, 0);
  assert.equal(resolved.bestStreak, 3);
  assert.equal(resolved.score, 500);
  assert.equal(resolved.incorrectCount, 1);
  assert.deepEqual(resolved.timeline.map((event) => event.year), [100, 300, 400]);
  assert.equal(resolved.phase, 'ready');
  assert.equal(resolved.current, null);
});

test('finishes immediately when the last life is lost', () => {
  const state = makePlacingState({
    timeline: [FIXTURES[0], FIXTURES[3]],
    current: FIXTURES[2],
    lives: 1,
    resolvedCount: 2,
  });
  const resolved = placeCurrent(state, 0);

  assert.equal(resolved.lives, 0);
  assert.equal(resolved.phase, 'finished');
  assert.equal(resolved.resolvedCount, 3);
  assert.deepEqual(resolved.timeline.map((event) => event.year), [100, 300, 400]);
});

test('finishes after every event in the session is resolved', () => {
  const state = makePlacingState({
    timeline: [FIXTURES[0], FIXTURES[1], FIXTURES[2]],
    current: FIXTURES[3],
    drawPile: [],
    resolvedCount: 3,
    deckSize: 4,
  });
  const resolved = placeCurrent(state, 3);

  assert.equal(resolved.phase, 'finished');
  assert.equal(resolved.resolvedCount, 4);
  assert.equal(resolved.correctCount, 1);
});

test('rejects placement outside the placing phase or legal gap range', () => {
  const ready = createGame(FIXTURES, {
    deckSize: 4,
    rng: createSeededRandom(2),
  });
  const placing = drawEvent(ready);

  assert.throws(() => placeCurrent(ready, 0), /cannot place/i);
  assert.throws(() => placeCurrent(placing, -1), /invalid gap/i);
  assert.throws(
    () => placeCurrent(placing, placing.timeline.length + 1),
    /invalid gap/i,
  );
});
