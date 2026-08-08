# Solo Timeline Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable mobile-first solo timeline game with tap placement, educational correction, deterministic game state, restart, and automated unit and browser tests.

**Architecture:** A pure ES module owns all game rules and returns immutable state transitions. A small DOM controller renders that state into semantic HTML, while a local catalog module owns content and category presentation data. The app stays build-free and static; Node's test runner covers the engine and a Playwright script covers the complete mobile flow.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Node.js 22 built-in test runner, Playwright as a development-only browser dependency.

## Global Constraints

- The first product surface is solo only; exclude Telegram SDK, multiplayer, accounts, backend, monetization, and cloud saves.
- A session contains exactly 10 unique events: one initial anchor and nine player decisions.
- Tap gap controls are the primary placement interaction; drag-and-drop is not required.
- The current event year must stay hidden until resolution.
- An incorrect answer removes one life, resets streak, reveals the answer, and inserts the event into its correct sorted position.
- The timeline must remain chronologically sorted after every state transition.
- Support keyboard activation, pinch zoom, reduced motion, and a 390 x 844 mobile viewport.
- Add no production runtime dependencies.

---

## File map

- `game-engine.js`: pure game creation, draw, placement, scoring, chronological insertion, and phase transitions.
- `events.js`: Ukrainian seed event catalog and category metadata.
- `index.html`: semantic game surface and end-state dialog.
- `script.js`: state ownership, DOM rendering, input events, feedback, and restart.
- `styles.css`: mobile-first visual system, horizontal timeline, cards, gap controls, dialog, responsive and reduced-motion rules.
- `manifest.json`: valid relative PWA metadata and icon path.
- `package.json`: unit and browser verification commands plus Playwright dev dependency.
- `tests/game-engine.test.js`: deterministic engine tests.
- `tests/e2e.mjs`: in-process static server and mobile Chromium acceptance flow.
- `README.md`: product summary, local run, test commands, rules, and scope.

### Task 1: Pure game engine

**Files:**
- Create: `game-engine.js`
- Create: `tests/game-engine.test.js`
- Create: `package.json`

**Interfaces:**
- Consumes: event objects shaped as `{ id: string, year: number, title: string, category: string, icon: string, description: string }`.
- Produces: `createGame(events, options)`, `drawEvent(state)`, `placeCurrent(state, gapIndex)`, `isGapCorrect(timeline, event, gapIndex)`, `insertChronologically(timeline, event)`, and `createSeededRandom(seed)`.
- `createGame` returns `{ deckSize, drawPile, timeline, current, phase, lives, score, streak, bestStreak, resolvedCount, correctCount, incorrectCount, lastResult }`.

- [ ] **Step 1: Add package scripts and write failing creation tests**

```json
{
  "name": "timeline-solo-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/game-engine.test.js",
    "test:e2e": "node tests/e2e.mjs",
    "verify": "npm test && npm run test:e2e"
  },
  "devDependencies": {
    "playwright": "^1.61.1"
  }
}
```

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createSeededRandom } from '../game-engine.js';

test('creates a unique deterministic session with one sorted anchor', () => {
  const game = createGame(FIXTURES, {
    deckSize: 4,
    rng: createSeededRandom(7),
  });
  const ids = [...game.timeline, ...game.drawPile].map((event) => event.id);
  assert.equal(new Set(ids).size, 4);
  assert.equal(game.timeline.length, 1);
  assert.equal(game.drawPile.length, 3);
  assert.equal(game.resolvedCount, 1);
  assert.equal(game.phase, 'ready');
});

test('rejects a deck larger than the event catalog', () => {
  assert.throws(
    () => createGame(FIXTURES, { deckSize: FIXTURES.length + 1 }),
    /deck size cannot exceed event catalog/i,
  );
});
```

- [ ] **Step 2: Run creation tests and verify they fail**

Run: `npm test`

Expected: FAIL because `game-engine.js` and its exports do not exist.

- [ ] **Step 3: Implement deterministic sampling and initial state**

```js
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
```

- [ ] **Step 4: Run creation tests and verify they pass**

Run: `npm test`

Expected: PASS for deterministic creation and invalid deck size.

- [ ] **Step 5: Write failing transition and invariant tests**

Add tests proving:

```js
const placing = drawEvent(game);
assert.equal(placing.phase, 'placing');
assert.equal(placing.current.id, game.drawPile[0].id);
assert.equal(placing.drawPile.length, game.drawPile.length - 1);
assert.throws(() => drawEvent(placing), /cannot draw/i);

const correctGap = placing.timeline.findIndex(
  (event) => placing.current.year <= event.year,
);
const resolved = placeCurrent(
  placing,
  correctGap === -1 ? placing.timeline.length : correctGap,
);
assert.equal(resolved.lastResult.correct, true);
assert.equal(resolved.score, 100);
assert.equal(resolved.streak, 1);
assert.deepEqual(
  resolved.timeline.map((event) => event.year),
  [...resolved.timeline.map((event) => event.year)].sort((a, b) => a - b),
);
```

Also cover a second consecutive correct answer for 125 points, an incorrect answer, equal-year gaps, zero-life completion, normal deck completion, and invalid gap indexes.

- [ ] **Step 6: Run transition tests and verify they fail**

Run: `npm test`

Expected: FAIL because draw and placement functions are not implemented.

- [ ] **Step 7: Implement immutable draw and placement transitions**

Implement these rules exactly:

```js
export function isGapCorrect(timeline, event, gapIndex) {
  const previous = timeline[gapIndex - 1];
  const next = timeline[gapIndex];
  return (!previous || previous.year <= event.year)
    && (!next || event.year <= next.year);
}

export function insertChronologically(timeline, event) {
  const insertionIndex = timeline.findIndex((item) => event.year < item.year);
  const index = insertionIndex === -1 ? timeline.length : insertionIndex;
  return [...timeline.slice(0, index), event, ...timeline.slice(index)];
}

export function drawEvent(state) {
  if (state.phase !== 'ready' || state.drawPile.length === 0) {
    throw new Error('Cannot draw an event in the current phase');
  }
  const [current, ...drawPile] = state.drawPile;
  return { ...state, current, drawPile, phase: 'placing', lastResult: null };
}
```

`placeCurrent` must validate `gapIndex`, compute correctness, insert at the selected gap when correct, otherwise call `insertChronologically`, update score/lives/streak/counters, set `phase` to `finished` on zero lives or `resolvedCount === deckSize`, and clear `current`.

- [ ] **Step 8: Run engine tests and verify all pass**

Run: `npm test`

Expected: all engine tests PASS.

- [ ] **Step 9: Commit engine and unit tests**

```bash
git add package.json game-engine.js tests/game-engine.test.js
git commit -m "feat: add tested solo game engine"
```

### Task 2: Content catalog and semantic application shell

**Files:**
- Create: `events.js`
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: event shape required by `createGame`.
- Produces: `EVENTS` and `CATEGORY_META` exports; semantic DOM ids consumed by `script.js`.

- [ ] **Step 1: Create a valid Ukrainian event catalog**

Create at least 16 unique local events spanning statehood, culture, science, society, and resistance. Every entry must include stable `id`, integer `year`, Ukrainian `title`, `category`, one-character `icon`, and a one-sentence Ukrainian `description` that does not reveal the year.

Validate at module load that ids are unique, all years are finite integers, and every category exists in `CATEGORY_META`.

- [ ] **Step 2: Replace the broken HTML shell**

Create semantic regions with these required ids:

```html
<main id="app" class="app-shell">
  <header class="game-header">...</header>
  <section id="timeline-region" aria-labelledby="timeline-title">
    <div id="timeline" class="timeline" role="list"></div>
  </section>
  <section id="current-panel" aria-live="polite">...</section>
  <button id="draw-event" type="button">Витягнути подію</button>
  <div id="feedback" role="status" aria-live="polite"></div>
</main>
<dialog id="result-dialog">...</dialog>
<script type="module" src="script.js"></script>
```

The viewport meta must allow zoom. Link `manifest.json`, `styles.css`, and `images/icon.png` correctly.

- [ ] **Step 3: Repair metadata and documentation**

Use relative manifest paths:

```json
{
  "name": "Не загубись у часі",
  "short_name": "Лінія часу",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": [{
    "src": "./images/icon.png",
    "sizes": "192x192",
    "type": "image/png"
  }]
}
```

Document `npm install`, `python3 -m http.server 4173`, `npm test`, `npm run test:e2e`, the game rules, and the explicit solo-MVP scope in `README.md`.

- [ ] **Step 4: Perform static validation**

Run:

```bash
node --check events.js
node --check script.js
node -e "JSON.parse(require('node:fs').readFileSync('manifest.json', 'utf8'))"
rg -n '<script type="module" src="script.js"></script>|rel="manifest"|user-scalable=no' index.html
```

Expected: module script and manifest link are present; `user-scalable=no` is absent; JSON parses.

- [ ] **Step 5: Commit content and shell**

```bash
git add events.js index.html manifest.json README.md
git commit -m "feat: add Ukrainian solo game content and shell"
```

### Task 3: Mobile-first renderer and interaction

**Files:**
- Modify: `script.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: engine functions from `game-engine.js`, `EVENTS`, and `CATEGORY_META` from `events.js`.
- Produces: rendered `.timeline-card`, `.gap-slot`, `.current-card`, feedback state, result dialog, and restart behavior.

- [ ] **Step 1: Implement state ownership and rendering**

Initialize with deterministic query support for acceptance tests:

```js
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed'));
const rng = Number.isFinite(seed) ? createSeededRandom(seed) : Math.random;
let state = createGame(EVENTS, { deckSize: 10, rng });
```

Render the timeline from `state.timeline`. When `state.phase === 'placing'`, render `timeline.length + 1` buttons with class `gap-slot`, `data-gap-index`, and clear Ukrainian `aria-label` text. Never render `state.current.year` before resolution.

- [ ] **Step 2: Wire draw, placement, and restart**

Use one delegated click listener on the timeline:

```js
timeline.addEventListener('click', (event) => {
  const gap = event.target.closest('.gap-slot');
  if (!gap || state.phase !== 'placing') return;
  state = placeCurrent(state, Number(gap.dataset.gapIndex));
  render();
});
```

The draw button calls `drawEvent`, restart creates a fresh game with a new runtime RNG, result dialog opens only for `finished`, and feedback uses `state.lastResult`.

- [ ] **Step 3: Build the focused mobile visual system**

Implement:

- full-height deep-ink application surface;
- compact stats header;
- horizontally scrollable timeline with snap alignment;
- warm paper event cards and category accent variables;
- explicit 44px-minimum gap targets;
- a dominant current-event card without its year;
- success/correction feedback;
- accessible dialog and focus states;
- layouts for widths below 420px and above 760px;
- `prefers-reduced-motion: reduce` overrides.

Do not wrap the entire app in a decorative centered card. Use the viewport as the game surface.

- [ ] **Step 4: Run static and unit verification**

Run:

```bash
node --check script.js
npm test
git diff --check
```

Expected: syntax passes, all engine tests pass, and there are no whitespace errors.

- [ ] **Step 5: Commit renderer and visual system**

```bash
git add script.js styles.css
git commit -m "feat: build mobile solo timeline experience"
```

### Task 4: Browser acceptance and final hardening

**Files:**
- Create: `tests/e2e.mjs`
- Modify: `README.md` only if verification reveals missing run instructions.

**Interfaces:**
- Consumes: the static application at `http://127.0.0.1:4173/?seed=17`.
- Produces: a zero-exit acceptance command `npm run test:e2e`.

- [ ] **Step 1: Write the failing browser acceptance script**

The script must start an in-process Node static server, launch Chromium at 390 x 844, collect console errors and failed requests, and use Node strict assertions.

Required checks:

```js
assert.equal(await page.locator('#progress').textContent(), '1/10');
await page.locator('#draw-event').click();
assert.equal(await page.locator('.current-card__year').textContent(), '????');
assert.equal(await page.locator('.gap-slot').count(), 2);
```

Use the title to find the current event in imported `EVENTS`, compute one deliberately wrong gap, assert lives decrease and timeline years stay sorted, then resolve every remaining card with the correct gap. Assert the result dialog opens, contains score and accuracy, restart returns progress to `1/10`, and collected console/request failures are empty.

- [ ] **Step 2: Run browser acceptance and observe failures**

Run: `npm install && npm run test:e2e`

Expected on the first run: FAIL on any mismatch between the planned DOM contract and implementation.

- [ ] **Step 3: Fix only acceptance mismatches and mobile regressions**

Adjust `script.js`, `styles.css`, or `index.html` only where the browser test demonstrates a behavior or accessibility defect. Preserve the engine API and product scope.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm run verify
node --check game-engine.js
node --check events.js
node --check script.js
git diff --check
git status --short
```

Expected: unit and browser checks PASS; syntax and whitespace checks PASS; only intentional files are modified.

- [ ] **Step 5: Commit acceptance coverage and fixes**

```bash
git add tests/e2e.mjs index.html script.js styles.css README.md package-lock.json
git commit -m "test: cover complete mobile solo game flow"
```

- [ ] **Step 6: Prepare the deliverable**

Create a source archive outside the repository containing the committed working tree without `.git` or `node_modules`. Report the final commit, verification commands, and any remaining product limitations.
