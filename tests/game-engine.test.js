import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HINTS_PER_GAME,
  HINT_COST,
  buildDeck,
  createGame,
  createSeededRandom,
  drawEvent,
  hintFor,
  insertChronologically,
  isGapCorrect,
  placeCurrent,
  useHint,
} from '../game-engine.js';

const FIXTURES = [
  { id: 'a', year: 100, title: 'A', difficulty: 1 },
  { id: 'b', year: 200, title: 'B', difficulty: 1 },
  { id: 'c', year: 300, title: 'C', difficulty: 2 },
  { id: 'd', year: 400, title: 'D', difficulty: 2 },
  { id: 'e', year: 500, title: 'E', difficulty: 3 },
  { id: 'f', year: 500, title: 'F', difficulty: 3 },
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
  difficulty = 'normal',
  hintsLeft = HINTS_PER_GAME,
  hintRevealed = false,
  mistakes = [],
} = {}) {
  return {
    deckSize,
    difficulty,
    drawPile,
    timeline,
    current,
    phase: 'placing',
    lives,
    maxLives: 3,
    score,
    streak,
    bestStreak,
    resolvedCount,
    correctCount,
    incorrectCount,
    hintsLeft,
    hintRevealed,
    mistakes,
    history: [],
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
  assert.equal(first.hintsLeft, HINTS_PER_GAME);
  assert.deepEqual(first.mistakes, []);
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

test('easy decks prefer well-known events and wide year gaps', () => {
  const deck = buildDeck(FIXTURES, {
    deckSize: 2,
    difficulty: 'easy',
    rng: createSeededRandom(5),
  });

  assert.equal(deck.length, 2);
  for (const event of deck) {
    assert.equal(event.difficulty, 1);
  }
  assert.ok(Math.abs(deck[0].year - deck[1].year) >= 25);
});

test('hard decks may include expert events', () => {
  const deck = buildDeck(FIXTURES, {
    deckSize: FIXTURES.length,
    difficulty: 'hard',
    rng: createSeededRandom(5),
  });

  assert.equal(deck.length, FIXTURES.length);
  assert.ok(deck.some((event) => event.difficulty === 3));
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

test('awards a precision bonus for placing into a tight middle gap', () => {
  const tightNeighbors = [
    { id: 'x', year: 290, title: 'X' },
    { id: 'y', year: 320, title: 'Y' },
  ];
  const resolved = placeCurrent(makePlacingState({
    timeline: tightNeighbors,
    current: FIXTURES[2],
  }), 1);

  assert.equal(resolved.lastResult.correct, true);
  assert.equal(resolved.lastResult.precisionBonus, 50);
  assert.equal(resolved.score, 150);
});

test('multiplies score gains on hard difficulty', () => {
  const resolved = placeCurrent(makePlacingState({ difficulty: 'hard' }), 1);

  assert.equal(resolved.lastResult.scoreGain, 150);
  assert.equal(resolved.score, 150);
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
  assert.equal(resolved.lastResult.correctGap, 1);
  assert.equal(resolved.lastResult.positionDelta, 1);
  assert.equal(resolved.lives, 2);
  assert.equal(resolved.streak, 0);
  assert.equal(resolved.bestStreak, 3);
  assert.equal(resolved.score, 500);
  assert.equal(resolved.incorrectCount, 1);
  assert.deepEqual(resolved.mistakes.map((event) => event.id), ['c']);
  assert.deepEqual(resolved.history, [false]);
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

test('hints cost score, are limited, and reset on the next draw', () => {
  const placing = makePlacingState({ score: 120 });
  const hinted = useHint(placing);

  assert.equal(hinted.hintsLeft, HINTS_PER_GAME - 1);
  assert.equal(hinted.hintRevealed, true);
  assert.equal(hinted.score, 120 - HINT_COST);
  assert.throws(() => useHint(hinted), /no hints/i);

  const poor = useHint(makePlacingState({ score: 10 }));
  assert.equal(poor.score, 0);

  const afterPlacement = placeCurrent(hinted, 1);
  assert.equal(afterPlacement.hintRevealed, false);

  const exhausted = makePlacingState({ hintsLeft: 0 });
  assert.throws(() => useHint(exhausted), /no hints/i);
});

test('describes the hidden year as a half-century hint', () => {
  assert.equal(hintFor({ year: 988 }), 'Друга половина X століття');
  assert.equal(hintFor({ year: 1710 }), 'Перша половина XVIII століття');
  assert.equal(hintFor({ year: 2022 }), 'Перша половина XXI століття');
  assert.equal(hintFor({ year: 1861 }), 'Друга половина XIX століття');
});
