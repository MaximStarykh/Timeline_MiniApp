import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORY_META, EVENTS } from '../events.js';

test('provides a catalog large enough for every mode', () => {
  assert.ok(EVENTS.length >= 250, `Catalog has ${EVENTS.length} events`);
  assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length);

  for (const event of EVENTS) {
    assert.match(event.id, /^[a-z0-9-]+$/);
    assert.equal(Number.isInteger(event.year), true);
    assert.ok(event.title.length >= 5);
    assert.ok(event.description.length >= 20);
    assert.ok([1, 2, 3].includes(event.difficulty));
    assert.ok(CATEGORY_META[event.category]);
  }
});

test('keeps enough well-known events for an easy classic deck', () => {
  const easy = EVENTS.filter((event) => event.difficulty === 1);
  assert.ok(easy.length >= 10, `Easy pool has ${easy.length} events`);
});

test('covers every category with several events', () => {
  for (const key of Object.keys(CATEGORY_META)) {
    const count = EVENTS.filter((event) => event.category === key).length;
    assert.ok(count >= 5, `Category ${key} has ${count} events`);
  }
});

test('keeps category presentation metadata complete', () => {
  for (const [key, category] of Object.entries(CATEGORY_META)) {
    assert.ok(key.length > 0);
    assert.ok(category.label.length > 0);
    assert.match(category.accent, /^#[0-9a-f]{6}$/i);
  }
});
