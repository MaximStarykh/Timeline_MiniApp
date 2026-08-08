import {
  createGame,
  createSeededRandom,
  drawEvent,
  placeCurrent,
} from './game-engine.js';
import { CATEGORY_META, EVENTS } from './events.js';

const elements = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  progress: document.getElementById('progress'),
  timeline: document.getElementById('timeline'),
  timelineHint: document.getElementById('timeline-hint'),
  currentHost: document.getElementById('current-card-host'),
  drawButton: document.getElementById('draw-event'),
  feedback: document.getElementById('feedback'),
  resultDialog: document.getElementById('result-dialog'),
  resultMessage: document.getElementById('result-message'),
  resultScore: document.getElementById('result-score'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultStreak: document.getElementById('result-streak'),
  restartButton: document.getElementById('restart-game'),
};

const params = new URLSearchParams(window.location.search);
const parsedSeed = Number(params.get('seed'));
const testSeed = Number.isFinite(parsedSeed) && params.has('seed')
  ? parsedSeed
  : null;

function newGame() {
  const rng = testSeed === null ? Math.random : createSeededRandom(testSeed);
  return createGame(EVENTS, { deckSize: 10, rng });
}

let state = newGame();

function categoryFor(event) {
  return CATEGORY_META[event.category];
}

function createTimelineCard(event) {
  const category = categoryFor(event);
  const card = document.createElement('article');
  card.className = 'timeline-card';
  card.dataset.year = String(event.year);
  card.dataset.eventId = event.id;
  card.style.setProperty('--accent', category.accent);
  card.setAttribute('role', 'listitem');

  const top = document.createElement('div');
  top.className = 'timeline-card__top';

  const icon = document.createElement('span');
  icon.className = 'timeline-card__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = event.icon;

  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'timeline-card__category';
  categoryLabel.textContent = category.label;

  const title = document.createElement('h2');
  title.className = 'timeline-card__title';
  title.textContent = event.title;

  const year = document.createElement('p');
  year.className = 'timeline-card__year';
  year.textContent = String(event.year);

  top.append(icon, categoryLabel);
  card.append(top, title, year);
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
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = '+';

  const label = document.createElement('span');
  label.className = 'gap-slot__label';
  label.textContent = 'сюди';

  gap.append(marker, label);
  return gap;
}

function renderTimeline() {
  const fragment = document.createDocumentFragment();

  state.timeline.forEach((event, index) => {
    if (state.phase === 'placing') fragment.append(createGap(index));
    fragment.append(createTimelineCard(event));
  });

  if (state.phase === 'placing') {
    fragment.append(createGap(state.timeline.length));
  }

  elements.timeline.replaceChildren(fragment);
  elements.timelineHint.textContent = state.phase === 'placing'
    ? 'Натисни на «+» у правильному місці.'
    : 'Витягни подію, щоб обрати її місце.';
}

function createCurrentCard(event) {
  const category = categoryFor(event);
  const card = document.createElement('article');
  card.className = 'current-card';
  card.style.setProperty('--accent', category.accent);

  const categoryRow = document.createElement('div');
  categoryRow.className = 'current-card__category-row';

  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'current-card__category';
  categoryLabel.textContent = category.label;

  const year = document.createElement('span');
  year.className = 'current-card__year';
  year.setAttribute('aria-label', 'Рік приховано');
  year.textContent = '????';

  const body = document.createElement('div');
  body.className = 'current-card__body';

  const icon = document.createElement('span');
  icon.className = 'current-card__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = event.icon;

  const copy = document.createElement('div');

  const title = document.createElement('h2');
  title.className = 'current-card__title';
  title.textContent = event.title;

  const description = document.createElement('p');
  description.className = 'current-card__description';
  description.textContent = event.description;

  categoryRow.append(categoryLabel, year);
  copy.append(title, description);
  body.append(icon, copy);
  card.append(categoryRow, body);
  return card;
}

function renderCurrentPanel() {
  if (state.phase === 'placing') {
    elements.currentHost.replaceChildren(createCurrentCard(state.current));
  } else {
    const empty = document.createElement('div');
    empty.className = 'current-empty';

    const symbol = document.createElement('span');
    symbol.className = 'current-empty__symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = state.phase === 'finished' ? '✓' : '✦';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = state.phase === 'finished'
      ? 'Лінію завершено'
      : 'Наступна подія чекає';
    const description = document.createElement('p');
    description.textContent = state.phase === 'finished'
      ? 'Переглянь результат і спробуй ще раз.'
      : 'Рік буде приховано — орієнтуйся на свої знання.';

    copy.append(title, description);
    empty.append(symbol, copy);
    elements.currentHost.replaceChildren(empty);
  }

  elements.drawButton.disabled = state.phase !== 'ready';
  elements.drawButton.hidden = state.phase !== 'ready';
}

function renderFeedback() {
  const result = state.lastResult;
  elements.feedback.className = 'feedback';

  if (!result) {
    elements.feedback.textContent = '';
    return;
  }

  elements.feedback.classList.add(
    result.correct ? 'feedback--correct' : 'feedback--correction',
  );
  elements.feedback.textContent = result.correct
    ? `Точно! ${result.year} рік · +${result.scoreGain}`
    : `Не зовсім. ${result.year} — правильне місце вже показано.`;
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

  elements.resultMessage.textContent = state.lives === 0
    ? 'Життя закінчилися, але кожна помилка вже стала підказкою.'
    : 'Усі події на своїх місцях. Ти не загубився у часі.';
  elements.resultScore.textContent = String(state.score);
  elements.resultAccuracy.textContent = `${accuracy}%`;
  elements.resultStreak.textContent = String(state.bestStreak);

  if (!elements.resultDialog.open) elements.resultDialog.showModal();
}

function renderStats() {
  elements.score.textContent = String(state.score);
  elements.lives.textContent = String(state.lives);
  elements.progress.textContent = `${state.resolvedCount}/${state.deckSize}`;
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
  renderStats();
  renderTimeline();
  renderCurrentPanel();
  renderFeedback();
  renderDialog();

  if (scrollToResult) requestAnimationFrame(focusResolvedCard);
}

elements.drawButton.addEventListener('click', () => {
  if (state.phase !== 'ready') return;
  state = drawEvent(state);
  render();
  elements.timeline.querySelector('.gap-slot')?.focus({ preventScroll: true });
});

elements.timeline.addEventListener('click', (event) => {
  const gap = event.target.closest('.gap-slot');
  if (!gap || state.phase !== 'placing') return;

  state = placeCurrent(state, Number(gap.dataset.gapIndex));
  render({ scrollToResult: true });
});

elements.restartButton.addEventListener('click', () => {
  state = newGame();
  render();
  elements.drawButton.focus();
});

render();
