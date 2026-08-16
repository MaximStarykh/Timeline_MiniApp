import {
  createGame,
  createSeededRandom,
  drawEvent,
  hintFor,
  placeCurrent,
  useHint,
} from './game-engine.js';
import { CATEGORY_META, EVENTS } from './events.js';
import { haptic, initTelegram, shareText } from './telegram.js';
import {
  addMistake,
  hydrateFromCloud,
  overallAccuracy,
  readBestScores,
  readMistakeBank,
  readStats,
  recordGameFinished,
  recordPlacement,
  removeMistake,
  saveBestScore,
} from './storage.js';

const CATEGORY_ARTWORK = Object.freeze({
  state: './images/cards/category-state.webp',
  culture: './images/cards/category-culture.webp',
  science: './images/cards/category-science.webp',
  society: './images/cards/category-society.webp',
  resistance: './images/cards/category-resistance.webp',
});

const ICONS = Object.freeze({
  heart: './images/icons/heart-fill.svg',
  plus: './images/icons/plus-bold.svg',
  ready: './images/icons/sparkle-fill.svg',
  correct: './images/icons/check-circle-fill.svg',
  correction: './images/icons/x-circle-fill.svg',
});

const MISTAKES_MIN = 5;

const MODES = Object.freeze({
  classic: { label: 'Класика' },
  marathon: { label: 'Марафон' },
  daily: { label: 'Виклик дня' },
  mistakes: { label: 'Помилки' },
});

const elements = {
  app: document.getElementById('app'),
  score: document.getElementById('score'),
  scoreFloat: document.getElementById('score-float'),
  streak: document.getElementById('streak'),
  streakFlame: document.getElementById('streak-flame'),
  lives: document.getElementById('lives'),
  lifeIcons: document.getElementById('life-icons'),
  progress: document.getElementById('progress'),
  modeLabel: document.getElementById('mode-label'),
  timeline: document.getElementById('timeline'),
  timelineHint: document.getElementById('timeline-hint'),
  currentHost: document.getElementById('current-card-host'),
  drawButton: document.getElementById('draw-event'),
  confirmButton: document.getElementById('confirm-place'),
  hintButton: document.getElementById('hint-button'),
  feedback: document.getElementById('feedback'),
  startDialog: document.getElementById('start-dialog'),
  difficultyPicker: document.getElementById('difficulty-picker'),
  mistakesOption: document.getElementById('mistakes-option'),
  mistakesInput: document.getElementById('mistakes-input'),
  mistakesHint: document.getElementById('mistakes-hint'),
  playerStats: document.getElementById('player-stats'),
  bestScore: document.getElementById('best-score'),
  startButton: document.getElementById('start-game'),
  resultDialog: document.getElementById('result-dialog'),
  resultMode: document.getElementById('result-mode'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  resultScore: document.getElementById('result-score'),
  resultRecord: document.getElementById('result-record'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultStreak: document.getElementById('result-streak'),
  resultMistakes: document.getElementById('result-mistakes'),
  resultMistakesList: document.getElementById('result-mistakes-list'),
  restartButton: document.getElementById('restart-game'),
  shareButton: document.getElementById('share-result'),
  changeModeButton: document.getElementById('change-mode'),
};

const params = new URLSearchParams(window.location.search);
const parsedSeed = Number(params.get('seed'));
const testSeed = Number.isFinite(parsedSeed) && params.has('seed')
  ? parsedSeed
  : null;

const session = {
  mode: MODES[params.get('mode')] ? params.get('mode') : 'classic',
  difficulty: ['easy', 'normal', 'hard'].includes(params.get('difficulty'))
    ? params.get('difficulty')
    : 'normal',
};

let state = null;
let selectedGap = null;
let recordBeaten = false;
let firstEverGame = readStats().games === 0;

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dailySeed() {
  return Number(todayIso().replaceAll('-', ''));
}

function mistakePool() {
  const bank = new Set(readMistakeBank());
  return EVENTS.filter((event) => bank.has(event.id));
}

function newGame() {
  const { mode, difficulty } = session;

  if (mode === 'mistakes') {
    const pool = mistakePool();
    return createGame(pool, {
      deckSize: Math.min(10, pool.length),
      difficulty: 'hard',
      rng: testSeed === null ? Math.random : createSeededRandom(testSeed),
    });
  }

  const seed = testSeed !== null
    ? testSeed
    : mode === 'daily' ? dailySeed() : null;
  const rng = seed === null ? Math.random : createSeededRandom(seed);

  return createGame(EVENTS, {
    deckSize: mode === 'marathon' ? EVENTS.length : 10,
    difficulty: mode === 'classic' ? difficulty : mode === 'daily' ? 'normal' : 'hard',
    rng,
  });
}

function bestScoreKey() {
  return session.mode === 'classic'
    ? `classic-${session.difficulty}`
    : session.mode;
}

function categoryFor(event) {
  return CATEGORY_META[event.category];
}

function createIcon(source, className) {
  const icon = document.createElement('img');
  icon.className = className;
  icon.src = source;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function createArtwork(event, className) {
  const image = document.createElement('img');
  image.className = className;
  image.src = CATEGORY_ARTWORK[event.category];
  image.alt = '';
  image.decoding = 'async';
  image.setAttribute('aria-hidden', 'true');
  return image;
}

function createTimelineCard(event, { preview = false } = {}) {
  const category = categoryFor(event);
  const card = document.createElement(preview ? 'button' : 'article');
  card.className = 'timeline-card';
  if (preview) {
    card.type = 'button';
    card.classList.add('timeline-card--preview');
    card.dataset.gapIndex = String(selectedGap);
    card.setAttribute('aria-label', 'Підтвердити це місце');
  } else {
    card.dataset.year = String(event.year);
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${event.title}, ${event.year} рік`);
  }
  card.dataset.eventId = event.id;
  card.dataset.category = event.category;
  card.style.setProperty('--accent', category.accent);

  const visual = document.createElement('div');
  visual.className = 'timeline-card__visual';
  visual.append(createArtwork(event, 'timeline-card__artwork'));

  const body = document.createElement('div');
  body.className = 'timeline-card__body';

  const title = document.createElement(preview ? 'span' : 'h2');
  title.className = 'timeline-card__title';
  title.textContent = event.title;

  const year = document.createElement('span');
  year.className = 'timeline-card__year';
  year.textContent = preview ? '????' : String(event.year);

  body.append(title, year);
  card.append(visual, body);

  if (!preview && state.lastResult?.eventId === event.id) {
    card.classList.add(state.lastResult.correct
      ? 'timeline-card--placed'
      : 'timeline-card--corrected');
    if (!state.lastResult.correct) {
      const badge = document.createElement('span');
      badge.className = 'timeline-card__badge';
      badge.textContent = 'правильне місце';
      card.append(badge);
    }
  }

  return card;
}

function gapLabel(index) {
  const previous = state.timeline[index - 1];
  const next = state.timeline[index];

  if (!previous) return `Розмістити перед ${next.year} роком`;
  if (!next) return `Розмістити після ${previous.year} року`;
  return `Розмістити між ${previous.year} і ${next.year} роками`;
}

function createGap(index) {
  const gap = document.createElement('button');
  gap.className = 'gap-slot';
  gap.type = 'button';
  gap.dataset.gapIndex = String(index);
  gap.setAttribute('aria-label', gapLabel(index));

  const marker = document.createElement('span');
  marker.className = 'gap-slot__marker';
  marker.append(createIcon(ICONS.plus, 'gap-slot__icon'));

  const label = document.createElement('span');
  label.className = 'gap-slot__label';
  label.textContent = 'сюди';

  gap.append(marker, label);
  return gap;
}

function renderTimeline() {
  const fragment = document.createDocumentFragment();

  state.timeline.forEach((event, index) => {
    if (state.phase === 'placing') {
      fragment.append(index === selectedGap
        ? createTimelineCard(state.current, { preview: true })
        : createGap(index));
    }
    fragment.append(createTimelineCard(event));
  });

  if (state.phase === 'placing') {
    fragment.append(state.timeline.length === selectedGap
      ? createTimelineCard(state.current, { preview: true })
      : createGap(state.timeline.length));
  }

  elements.timeline.replaceChildren(fragment);

  if (state.phase !== 'placing') {
    elements.timelineHint.textContent = firstEverGame
      ? 'Натисни кнопку внизу, щоб витягнути першу подію.'
      : 'Витягни подію та знайди її місце.';
  } else if (selectedGap === null) {
    elements.timelineHint.textContent = firstEverGame
      ? 'Було це раніше чи пізніше? Натисни «сюди» там, де має стояти подія.'
      : 'Натисни «сюди» у правильному місці.';
  } else {
    elements.timelineHint.textContent = 'Перевір сусідів і підтверди вибір.';
  }
}

function createCurrentCard(event) {
  const category = categoryFor(event);
  const card = document.createElement('article');
  card.className = 'current-card';
  card.dataset.category = event.category;
  card.style.setProperty('--accent', category.accent);

  const visual = document.createElement('div');
  visual.className = 'current-card__visual';
  visual.append(createArtwork(event, 'current-card__artwork'));

  const content = document.createElement('div');
  content.className = 'current-card__content';

  const categoryRow = document.createElement('div');
  categoryRow.className = 'current-card__category-row';

  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'current-card__category';
  categoryLabel.textContent = category.label;

  const year = document.createElement('span');
  year.className = 'current-card__year';
  year.setAttribute('aria-label', 'Рік приховано');
  year.textContent = '????';

  const title = document.createElement('h2');
  title.className = 'current-card__title';
  title.textContent = event.title;

  const description = document.createElement('p');
  description.className = 'current-card__description';
  description.textContent = event.description;

  categoryRow.append(categoryLabel, year);
  content.append(categoryRow, title, description);

  if (state.hintRevealed) {
    const hint = document.createElement('p');
    hint.className = 'current-card__hint';
    hint.textContent = hintFor(event);
    content.append(hint);
  }

  card.append(visual, content);
  return card;
}

function createCurrentEmpty() {
  const empty = document.createElement('div');
  empty.className = 'current-empty';

  const result = state.lastResult;
  const iconSource = result
    ? (result.correct ? ICONS.correct : ICONS.correction)
    : ICONS.ready;
  const icon = createIcon(iconSource, 'current-empty__icon');

  const copy = document.createElement('div');
  const title = document.createElement('h2');
  const description = document.createElement('p');

  if (state.phase === 'finished') {
    title.textContent = 'Лінію завершено';
    description.textContent = 'Переглянь результат і спробуй зібрати нову.';
  } else if (result?.correct) {
    title.textContent = 'Точно в ціль';
    description.textContent = `${result.year} рік став на вибране місце.`;
  } else if (result) {
    title.textContent = 'Тепер на своєму місці';
    description.textContent = `Це був ${result.year} рік — дивись позначку на лінії.`;
  } else {
    title.textContent = 'Наступна картка чекає';
    description.textContent = 'Рік буде приховано — орієнтуйся на подію.';
  }

  copy.append(title, description);
  empty.append(icon, copy);
  return empty;
}

function renderCurrentPanel() {
  const content = state.phase === 'placing'
    ? createCurrentCard(state.current)
    : createCurrentEmpty();
  elements.currentHost.replaceChildren(content);

  const placing = state.phase === 'placing';
  elements.drawButton.disabled = state.phase !== 'ready';
  elements.drawButton.hidden = state.phase !== 'ready';
  elements.drawButton.querySelector('span').textContent = state.lastResult
    ? 'Наступна подія'
    : 'Витягнути подію';

  elements.confirmButton.hidden = !placing || selectedGap === null;

  elements.hintButton.hidden = !placing || state.hintRevealed;
  elements.hintButton.disabled = state.hintsLeft <= 0;
  elements.hintButton.querySelector('span').textContent = state.hintsLeft > 0
    ? `Підказка · −50 (${state.hintsLeft})`
    : 'Підказок немає';
}

function renderFeedback() {
  const result = state.lastResult;
  elements.feedback.className = 'feedback';

  if (state.phase === 'placing' && state.hintRevealed) {
    elements.feedback.textContent = `Підказка: ${hintFor(state.current)}`;
    return;
  }

  if (!result) {
    elements.feedback.textContent = '';
    return;
  }

  elements.feedback.classList.add(
    result.correct ? 'feedback--correct' : 'feedback--correction',
  );

  if (result.correct) {
    const parts = [`+${result.baseScore}`];
    if (result.streakBonus > 0) parts.push(`серія +${result.streakBonus}`);
    if (result.precisionBonus > 0) parts.push(`щільний проміжок +${result.precisionBonus}`);
    elements.feedback.textContent = `Правильно · ${parts.join(' · ')}`;
  } else {
    const off = result.positionDelta === 1
      ? 'поруч із правильним місцем'
      : `за ${result.positionDelta} ${result.positionDelta <= 4 ? 'позиції' : 'позицій'} від правильного місця`;
    elements.feedback.textContent = `Це був ${result.year} рік · ти ${off} · −1 життя`;
  }
}

function verdictFor() {
  const won = state.lives > 0;
  const accuracyPerfect = state.incorrectCount === 0;

  if (session.mode === 'mistakes' && won) {
    return {
      title: 'Помилки опрацьовано',
      message: 'Виправлені події зникли з банку помилок. Так тримати!',
    };
  }
  if (won && accuracyPerfect) {
    return {
      title: 'Бездоганна лінія',
      message: 'Жодної помилки. Ти не загубився у часі.',
    };
  }
  if (won) {
    return {
      title: 'Твоя лінія готова',
      message: 'Усі події на своїх місцях. Помилки вже стали підказками.',
    };
  }
  return {
    title: 'Час переміг — поки що',
    message: 'Життя закінчилися, але кожна помилка запам’яталася на лінії.',
  };
}

function modeCaption() {
  if (session.mode === 'classic') {
    const difficultyLabel = { easy: 'легко', normal: 'звичайно', hard: 'складно' }[session.difficulty];
    return `${MODES.classic.label} · ${difficultyLabel}`;
  }
  if (session.mode === 'daily') {
    return `${MODES.daily.label} · ${new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`;
  }
  return MODES[session.mode].label;
}

function shareSummary() {
  const grid = state.history.map((correct) => (correct ? '✅' : '❌')).join('');
  const streakNote = state.bestStreak >= 3 ? ` · серія ${state.bestStreak}` : '';
  return `Лінія часу — ${modeCaption()}\n${grid}\n${state.score} очок${streakNote}`;
}

function renderDialog() {
  if (state.phase !== 'finished') {
    if (elements.resultDialog.open) elements.resultDialog.close();
    return;
  }

  const decisions = state.correctCount + state.incorrectCount;
  const accuracy = decisions === 0
    ? 0
    : Math.round((state.correctCount / decisions) * 100);
  const verdict = verdictFor();

  elements.resultMode.textContent = modeCaption();
  elements.resultTitle.textContent = verdict.title;
  elements.resultMessage.textContent = verdict.message;
  elements.resultScore.textContent = String(state.score);
  elements.resultRecord.hidden = !recordBeaten;
  elements.resultAccuracy.textContent = `${accuracy}%`;
  elements.resultStreak.textContent = String(state.bestStreak);

  const mistakes = state.mistakes;
  elements.resultMistakes.hidden = mistakes.length === 0;
  elements.resultMistakesList.replaceChildren(
    ...mistakes.map((event) => {
      const item = document.createElement('li');
      const year = document.createElement('strong');
      year.textContent = String(event.year);
      item.append(year, ` — ${event.title}`);
      return item;
    }),
  );

  if (!elements.resultDialog.open) elements.resultDialog.showModal();
}

function renderLives() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < state.maxLives; index += 1) {
    const icon = createIcon(ICONS.heart, 'life-icons__heart');
    icon.classList.toggle('life-icons__heart--lost', index >= state.lives);
    if (state.lastResult && !state.lastResult.correct && index === state.lives) {
      icon.classList.add('life-icons__heart--breaking');
    }
    fragment.append(icon);
  }

  elements.lifeIcons.replaceChildren(fragment);
}

function renderStats() {
  elements.score.textContent = String(state.score);
  elements.streak.textContent = String(state.streak);
  elements.streakFlame.hidden = state.streak < 2;
  elements.lives.textContent = String(state.lives);
  elements.progress.textContent = `${state.resolvedCount}/${state.deckSize}`;
  elements.modeLabel.textContent = modeCaption();
  renderLives();
}

function floatScore(gain) {
  if (gain <= 0) return;
  const float = elements.scoreFloat;
  float.textContent = `+${gain}`;
  float.classList.remove('score-float--active');
  void float.offsetWidth;
  float.classList.add('score-float--active');
}

function focusResolvedCard() {
  if (!state.lastResult) return;
  const card = elements.timeline.querySelector(
    `[data-event-id="${state.lastResult.eventId}"]`,
  );
  if (!card) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView({
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'nearest',
    inline: 'center',
  });
}

function render({ scrollToResult = false } = {}) {
  elements.app.dataset.phase = state.phase;
  renderStats();
  renderTimeline();
  renderCurrentPanel();
  renderFeedback();
  renderDialog();

  if (scrollToResult) requestAnimationFrame(focusResolvedCard);
}

function startGame() {
  state = newGame();
  selectedGap = null;
  recordBeaten = false;
  render();
  elements.drawButton.focus();
}

function placeAt(gapIndex) {
  const placedEvent = state.current;
  state = placeCurrent(state, gapIndex);
  selectedGap = null;

  recordPlacement(placedEvent.category, state.lastResult.correct);
  if (state.lastResult.correct) {
    removeMistake(placedEvent.id);
    haptic('success');
    floatScore(state.lastResult.scoreGain);
  } else {
    addMistake(placedEvent.id);
    haptic('error');
  }

  if (state.phase === 'finished') {
    recordBeaten = saveBestScore(bestScoreKey(), state.score);
    recordGameFinished({
      dailyDate: session.mode === 'daily' ? todayIso() : null,
    });
    firstEverGame = false;
  }

  render({ scrollToResult: true });
  if (state.phase === 'ready') elements.drawButton.focus({ preventScroll: true });
}

elements.drawButton.addEventListener('click', () => {
  if (state.phase !== 'ready') return;
  state = drawEvent(state);
  selectedGap = null;
  render();
  elements.timeline.querySelector('.gap-slot')?.focus({ preventScroll: true });
});

elements.confirmButton.addEventListener('click', () => {
  if (state.phase !== 'placing' || selectedGap === null) return;
  placeAt(selectedGap);
});

elements.hintButton.addEventListener('click', () => {
  if (state.phase !== 'placing' || state.hintsLeft <= 0 || state.hintRevealed) return;
  state = useHint(state);
  haptic('light');
  render();
});

elements.timeline.addEventListener('click', (event) => {
  if (state.phase !== 'placing') return;

  const preview = event.target.closest('.timeline-card--preview');
  if (preview) {
    placeAt(Number(preview.dataset.gapIndex));
    return;
  }

  const gap = event.target.closest('.gap-slot');
  if (!gap) return;

  selectedGap = Number(gap.dataset.gapIndex);
  haptic('light');
  render();
  const previewCard = elements.timeline.querySelector('.timeline-card--preview');
  previewCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  previewCard?.focus({ preventScroll: true });
});

document.addEventListener('keydown', (event) => {
  if (!state || state.phase !== 'placing') return;

  if (event.key === 'Escape' && selectedGap !== null) {
    selectedGap = null;
    render();
    return;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  const gapCount = state.timeline.length + 1;
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const from = selectedGap ?? (step === 1 ? -1 : gapCount);
  selectedGap = Math.min(gapCount - 1, Math.max(0, from + step));
  event.preventDefault();
  render();
  const preview = elements.timeline.querySelector('.timeline-card--preview');
  preview?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  preview?.focus({ preventScroll: true });
});

elements.restartButton.addEventListener('click', () => {
  elements.resultDialog.close();
  if (session.mode === 'mistakes' && mistakePool().length < 2) {
    session.mode = 'classic';
    openStartDialog();
    return;
  }
  startGame();
});

elements.shareButton.addEventListener('click', async () => {
  const channel = await shareText(shareSummary(), window.location.origin + window.location.pathname);
  if (channel === 'clipboard') {
    elements.shareButton.querySelector('span').textContent = 'Скопійовано!';
    setTimeout(() => {
      elements.shareButton.querySelector('span').textContent = 'Поділитися';
    }, 1600);
  }
});

elements.changeModeButton.addEventListener('click', () => {
  elements.resultDialog.close();
  openStartDialog();
});

function checkedMode() {
  return elements.startDialog.querySelector('input[name="mode"]:checked').value;
}

function syncStartDialog() {
  const mode = checkedMode();
  elements.difficultyPicker.hidden = mode !== 'classic';

  const pool = mistakePool();
  const enough = pool.length >= MISTAKES_MIN;
  elements.mistakesInput.disabled = !enough;
  elements.mistakesOption.classList.toggle('mode-option--disabled', !enough);
  elements.mistakesHint.textContent = enough
    ? `${pool.length} подій · 3 життя`
    : `відкриється після ${MISTAKES_MIN} помилок (${pool.length}/${MISTAKES_MIN})`;

  const stats = readStats();
  const accuracy = overallAccuracy(stats);
  const statsParts = [];
  if (stats.games > 0) statsParts.push(`Партій: ${stats.games}`);
  if (accuracy !== null) statsParts.push(`Точність: ${accuracy}%`);
  if (stats.daily.streak > 1) statsParts.push(`Виклик дня: ${stats.daily.streak} поспіль`);
  elements.playerStats.hidden = statsParts.length === 0;
  elements.playerStats.textContent = statsParts.join(' · ');

  const difficulty = elements.startDialog.querySelector('input[name="difficulty"]:checked').value;
  const key = mode === 'classic' ? `classic-${difficulty}` : mode;
  const best = readBestScores()[key];
  elements.bestScore.hidden = !best;
  if (best) elements.bestScore.textContent = `Твій рекорд: ${best}`;
}

function openStartDialog() {
  syncStartDialog();
  if (!elements.startDialog.open) elements.startDialog.showModal();
}

elements.startDialog.addEventListener('change', syncStartDialog);

elements.startButton.addEventListener('click', () => {
  session.mode = checkedMode();
  session.difficulty = elements.startDialog.querySelector('input[name="difficulty"]:checked').value;
  elements.startDialog.close();
  startGame();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

initTelegram();
hydrateFromCloud().then(() => {
  if (elements.startDialog.open) syncStartDialog();
});

// Прямий запуск через URL (тести та поділені посилання) пропускає стартовий екран.
if (testSeed !== null || params.has('mode')) {
  startGame();
} else {
  state = newGame();
  render();
  openStartDialog();
}
