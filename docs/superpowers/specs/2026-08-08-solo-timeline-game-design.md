# Solo Timeline Game Design

Date: 2026-08-08
Status: Approved by delegated product authority

## Product goal

Build a mobile-first solo game that proves the timeline placement mechanic before adding Telegram multiplayer, accounts, progression, or a backend.

The first release succeeds when a player can complete a full session on a phone and the game remains internally consistent after correct placements, incorrect placements, loss of all lives, completion, and restart.

## Audience and session

- Ukrainian-speaking casual players aged roughly 12 and up.
- A session lasts three to five minutes.
- The game uses ten historical events per session.
- No sign-in, network connection, persistent progression, or multiplayer is required.

## Core loop

1. Start with one randomly selected anchor event already placed and its year visible.
2. Draw a new event showing its title, category, visual symbol, and short context, but not its year.
3. Choose one of the insertion gaps shown before, between, and after the existing timeline cards.
4. Resolve the placement immediately.
5. On a correct placement, reveal the year, lock the card into the selected position, increase the score and streak, and continue.
6. On an incorrect placement, remove one life, reset the streak, reveal the year, and automatically insert the card into its correct chronological position. The timeline must never remain unsorted.
7. Continue until all ten events have been resolved or the player loses all three lives.
8. Show a summary and allow a clean restart.

## Interaction model

Tap is the primary interaction because the target surface is mobile. Every legal insertion position is represented by a large explicit gap button.

Desktop pointer users can use the same gap buttons. Drag-and-drop is not required for the MVP because it is less reliable on mobile and harder to make accessible. A future drag interaction may be added as progressive enhancement without replacing tap controls.

Keyboard users can tab through gap buttons and activate them with Enter or Space. The interface must not disable pinch zoom.

## Game rules

- A session deck contains ten unique events sampled from the local event catalog.
- One event is the anchor; the remaining nine are player decisions.
- Starting lives: 3.
- Correct placement: 100 base points plus a streak bonus of 25 points for each consecutive correct answer after the first, capped at a 5-answer streak bonus.
- Incorrect placement: no points, lose one life, reset streak to zero, reveal the correct answer.
- Events with identical years are accepted in either order.
- The game ends immediately when lives reach zero or when all session events are resolved.
- Progress counts resolved events, including the initial anchor, so it always runs from 1/10 to 10/10.

## Screen composition

The game uses one full-height mobile surface.

- Header: compact product mark, score, remaining lives, and progress.
- Timeline: the dominant horizontally scrollable region, with readable year labels and explicit insertion gaps.
- Current event: one large card near the bottom with category color, icon, title, and short context. The year remains hidden until resolution.
- Primary action: `Draw event` when no event is active.
- Feedback layer: short success or correction message after placement.
- End-state dialog: score, accuracy, best streak, and restart.

The visual language is inspired by colorful illustrated history cards, but uses an original system: deep ink background, warm paper cards, saturated category colors, flat symbols, and restrained motion.

## State model

The game engine is independent of the DOM. Its state contains:

- catalog and sampled session deck;
- timeline events in chronological order;
- current event;
- resolved event count;
- score;
- lives;
- streak and best streak;
- correct and incorrect answer counts;
- phase: `ready`, `placing`, or `finished`;
- last resolution result for feedback.

The UI renders from this state. DOM order is not the source of truth.

## Components and boundaries

- `game-engine.js`: pure state transitions, placement validation, chronological insertion, scoring, and end conditions.
- `events.js`: local event catalog and category metadata.
- `script.js`: DOM rendering, input wiring, feedback timing, and modal behavior.
- `index.html`: semantic application structure.
- `styles.css`: responsive visual system and motion preferences.
- `tests/game-engine.test.js`: deterministic engine tests using Node's built-in test runner.
- `tests/e2e.mjs`: browser acceptance flow for the mobile UI.

## Error and edge-case behavior

- Ignore placement input unless the game is in the `placing` phase.
- Ignore draw input while an event is already active.
- Prevent duplicate events within one session.
- Handle equal years without corrupting order.
- If the requested deck size exceeds the catalog, fail with a clear development error.
- Restart creates a completely fresh state and clears feedback and dialog UI.
- Reduced-motion users receive state changes without large transforms or auto-scrolling animation.

## Test acceptance criteria

Unit tests must prove:

- deterministic session creation with unique events;
- years remain sorted after every resolution;
- correct gap placement awards score and grows streak;
- incorrect placement loses a life, resets streak, and inserts at the correct position;
- equal-year placement works;
- input is rejected in invalid phases;
- the game finishes on zero lives and on completion;
- restart returns all counters and phase to initial values.

Browser acceptance must prove at a 390 x 844 viewport:

- the initial anchor and progress render correctly;
- drawing hides the current event year;
- a correct placement updates score and timeline;
- an incorrect placement keeps the timeline sorted and updates lives;
- the game can be completed;
- the result dialog appears and restart works;
- there are no console errors or failed local asset requests.

## Explicit exclusions

- Telegram SDK integration.
- Multiplayer rooms or invitations.
- User accounts, leaderboards, achievements, or cloud saves.
- Backend APIs or remote content management.
- Monetization, ads, or purchases.
- Drag-and-drop as a required interaction.
- Full historical content production and editorial review beyond the seed catalog.

## Future extension points

After the solo mechanic is validated, the same pure engine can support daily challenges, themed decks, Telegram identity, and multiplayer turns. These are future products, not requirements of this MVP.
