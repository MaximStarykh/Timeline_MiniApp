export function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createGame(events, { deckSize = 10, rng = Math.random } = {}) {
  if (!Number.isInteger(deckSize) || deckSize < 2) {
    throw new Error('Deck size must be an integer of at least 2');
  }

  if (deckSize > events.length) {
    throw new Error('Deck size cannot exceed event catalog');
  }

  const shuffled = [...events];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const [anchor, ...drawPile] = shuffled.slice(0, deckSize);

  return {
    deckSize,
    drawPile,
    timeline: [anchor],
    current: null,
    phase: 'ready',
    lives: 3,
    score: 0,
    streak: 0,
    bestStreak: 0,
    resolvedCount: 1,
    correctCount: 0,
    incorrectCount: 0,
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
    lastResult: null,
  };
}

export function isGapCorrect(timeline, event, gapIndex) {
  const previous = timeline[gapIndex - 1];
  const next = timeline[gapIndex];

  return (!previous || previous.year <= event.year)
    && (!next || event.year <= next.year);
}

export function insertChronologically(timeline, event) {
  const insertionIndex = timeline.findIndex((item) => event.year < item.year);
  const index = insertionIndex === -1 ? timeline.length : insertionIndex;

  return [
    ...timeline.slice(0, index),
    event,
    ...timeline.slice(index),
  ];
}

export function placeCurrent(state, gapIndex) {
  if (state.phase !== 'placing' || !state.current) {
    throw new Error('Cannot place an event in the current phase');
  }

  if (!Number.isInteger(gapIndex) || gapIndex < 0 || gapIndex > state.timeline.length) {
    throw new Error('Invalid gap index');
  }

  const correct = isGapCorrect(state.timeline, state.current, gapIndex);
  const timeline = correct
    ? [
        ...state.timeline.slice(0, gapIndex),
        state.current,
        ...state.timeline.slice(gapIndex),
      ]
    : insertChronologically(state.timeline, state.current);
  const streak = correct ? state.streak + 1 : 0;
  const scoreGain = correct
    ? 100 + Math.min(streak - 1, 4) * 25
    : 0;
  const lives = correct ? state.lives : state.lives - 1;
  const resolvedCount = state.resolvedCount + 1;
  const finished = lives === 0 || resolvedCount === state.deckSize;

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
    lastResult: {
      correct,
      eventId: state.current.id,
      title: state.current.title,
      year: state.current.year,
      selectedGap: gapIndex,
      scoreGain,
    },
  };
}
