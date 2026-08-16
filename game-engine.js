export function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: 'Легко',
    maxEventDifficulty: 1,
    minYearGap: 25,
    scoreMultiplier: 1,
  }),
  normal: Object.freeze({
    label: 'Звичайно',
    maxEventDifficulty: 2,
    minYearGap: 0,
    scoreMultiplier: 1,
  }),
  hard: Object.freeze({
    label: 'Складно',
    maxEventDifficulty: 3,
    minYearGap: 0,
    scoreMultiplier: 1.5,
  }),
});

export const HINTS_PER_GAME = 2;
export const HINT_COST = 50;

function shuffle(events, rng) {
  const shuffled = [...events];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildDeck(events, { deckSize, difficulty = 'normal', rng = Math.random }) {
  const config = DIFFICULTIES[difficulty];
  if (!config) throw new Error(`Unknown difficulty: ${difficulty}`);

  const preferred = events.filter(
    (event) => (event.difficulty ?? 2) <= config.maxEventDifficulty,
  );
  const fallback = events.filter(
    (event) => (event.difficulty ?? 2) > config.maxEventDifficulty,
  );
  const ordered = [...shuffle(preferred, rng), ...shuffle(fallback, rng)];

  if (config.minYearGap === 0) return ordered.slice(0, deckSize);

  const deck = [];
  const skipped = [];
  for (const event of ordered) {
    if (deck.length === deckSize) break;
    const tooClose = deck.some(
      (picked) => Math.abs(picked.year - event.year) < config.minYearGap,
    );
    if (tooClose) skipped.push(event);
    else deck.push(event);
  }
  return [...deck, ...skipped].slice(0, deckSize);
}

export function createGame(events, {
  deckSize = 10,
  lives = 3,
  difficulty = 'normal',
  rng = Math.random,
} = {}) {
  if (!Number.isInteger(deckSize) || deckSize < 2) {
    throw new Error('Deck size must be an integer of at least 2');
  }

  if (deckSize > events.length) {
    throw new Error('Deck size cannot exceed event catalog');
  }

  const [anchor, ...drawPile] = buildDeck(events, { deckSize, difficulty, rng });

  return {
    deckSize,
    difficulty,
    drawPile,
    timeline: [anchor],
    current: null,
    phase: 'ready',
    lives,
    maxLives: lives,
    score: 0,
    streak: 0,
    bestStreak: 0,
    resolvedCount: 1,
    correctCount: 0,
    incorrectCount: 0,
    hintsLeft: HINTS_PER_GAME,
    hintRevealed: false,
    mistakes: [],
    history: [],
    lastResult: null,
  };
}

export function drawEvent(state) {
  if (state.phase !== 'ready' || state.drawPile.length === 0) {
    throw new Error('Cannot draw an event in the current phase');
  }

  const [current, ...drawPile] = state.drawPile;

  return {
    ...state,
    current,
    drawPile,
    phase: 'placing',
    hintRevealed: false,
    lastResult: null,
  };
}

const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
  [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
  [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRoman(number) {
  let rest = number;
  let result = '';
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      result += glyph;
      rest -= value;
    }
  }
  return result;
}

export function hintFor(event) {
  const century = Math.ceil(event.year / 100);
  const positionInCentury = event.year - (century - 1) * 100;
  const half = positionInCentury <= 50 ? 'Перша' : 'Друга';
  return `${half} половина ${toRoman(century)} століття`;
}

export function useHint(state) {
  if (state.phase !== 'placing' || !state.current) {
    throw new Error('Hints are only available while placing');
  }
  if (state.hintsLeft <= 0 || state.hintRevealed) {
    throw new Error('No hints available');
  }

  return {
    ...state,
    hintsLeft: state.hintsLeft - 1,
    hintRevealed: true,
    score: Math.max(0, state.score - HINT_COST),
  };
}

export function isGapCorrect(timeline, event, gapIndex) {
  const previous = timeline[gapIndex - 1];
  const next = timeline[gapIndex];

  return (!previous || previous.year <= event.year)
    && (!next || event.year <= next.year);
}

export function correctGapIndex(timeline, event) {
  const index = timeline.findIndex((item) => event.year < item.year);
  return index === -1 ? timeline.length : index;
}

export function insertChronologically(timeline, event) {
  const index = correctGapIndex(timeline, event);

  return [
    ...timeline.slice(0, index),
    event,
    ...timeline.slice(index),
  ];
}

export const PRECISION_GAP_YEARS = 50;
export const PRECISION_BONUS = 50;

function precisionBonusFor(timeline, gapIndex) {
  const previous = timeline[gapIndex - 1];
  const next = timeline[gapIndex];
  if (!previous || !next) return 0;
  return next.year - previous.year <= PRECISION_GAP_YEARS ? PRECISION_BONUS : 0;
}

export function placeCurrent(state, gapIndex) {
  if (state.phase !== 'placing' || !state.current) {
    throw new Error('Cannot place an event in the current phase');
  }

  if (!Number.isInteger(gapIndex) || gapIndex < 0 || gapIndex > state.timeline.length) {
    throw new Error('Invalid gap index');
  }

  const correct = isGapCorrect(state.timeline, state.current, gapIndex);
  const rightIndex = correctGapIndex(state.timeline, state.current);
  const timeline = correct
    ? [
        ...state.timeline.slice(0, gapIndex),
        state.current,
        ...state.timeline.slice(gapIndex),
      ]
    : insertChronologically(state.timeline, state.current);
  const streak = correct ? state.streak + 1 : 0;
  const multiplier = DIFFICULTIES[state.difficulty]?.scoreMultiplier ?? 1;
  const baseScore = correct ? 100 : 0;
  const streakBonus = correct ? Math.min(streak - 1, 4) * 25 : 0;
  const precisionBonus = correct ? precisionBonusFor(state.timeline, gapIndex) : 0;
  const scoreGain = Math.round((baseScore + streakBonus + precisionBonus) * multiplier);
  const lives = correct ? state.lives : state.lives - 1;
  const resolvedCount = state.resolvedCount + 1;
  const finished = lives === 0 || resolvedCount === state.deckSize;
  const mistakes = correct
    ? state.mistakes
    : [...state.mistakes, state.current];

  return {
    ...state,
    timeline,
    current: null,
    phase: finished ? 'finished' : 'ready',
    lives,
    score: state.score + scoreGain,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    resolvedCount,
    correctCount: state.correctCount + (correct ? 1 : 0),
    incorrectCount: state.incorrectCount + (correct ? 0 : 1),
    hintRevealed: false,
    mistakes,
    history: [...state.history, correct],
    lastResult: {
      correct,
      eventId: state.current.id,
      title: state.current.title,
      year: state.current.year,
      selectedGap: gapIndex,
      correctGap: rightIndex,
      positionDelta: Math.abs(gapIndex - rightIndex),
      scoreGain,
      baseScore,
      streakBonus,
      precisionBonus,
    },
  };
}
