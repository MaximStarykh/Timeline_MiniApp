import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORY_META, EVENTS } from '../events.js';

test('provides enough unique valid events for a ten-card session', () => {
  assert.ok(EVENTS.length >= 16);
  assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length);

  for (const event of EVENTS) {
    assert.match(event.id, /^[a-z0-9-]+$/);
    assert.equal(Number.isInteger(event.year), true);
    assert.ok(event.title.length >= 5);
    assert.ok(event.description.length >= 20);
    assert.ok(event.icon.length >= 1);
    assert.ok(CATEGORY_META[event.category]);
  }
});

test('keeps category presentation metadata complete', () => {
  for (const [key, category] of Object.entries(CATEGORY_META)) {
    assert.ok(key.length > 0);
    assert.ok(category.label.length > 0);
    assert.match(category.accent, /^#[0-9a-f]{6}$/i);
  }
});
