import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { EVENTS } from '../events.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const safePath = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, safePath);
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const browserErrors = [];
const failedRequests = [];

page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('requestfailed', (request) => {
  failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
});
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedRequests.push(`${response.url()}: HTTP ${response.status()}`);
  }
});

function correctGap(year, timelineYears) {
  const index = timelineYears.findIndex((timelineYear) => year <= timelineYear);
  return index === -1 ? timelineYears.length : index;
}

async function readTimelineYears() {
  return page.locator('.timeline-card').evaluateAll((cards) => (
    cards.map((card) => Number(card.dataset.year))
  ));
}

async function currentEvent() {
  const title = (await page.locator('.current-card__title').textContent()).trim();
  const event = EVENTS.find((candidate) => candidate.title === title);
  assert.ok(event, `Current event exists in catalog: ${title}`);
  return event;
}

async function placeAtGap(gapIndex) {
  await page.locator(`.gap-slot[data-gap-index="${gapIndex}"]`).click();
  await page.locator('#confirm-place').click();
}

try {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  assert.equal(
    await page.locator('#start-dialog').evaluate((dialog) => dialog.open),
    true,
    'Start dialog greets a direct visit',
  );
  await page.locator('.mode-option input[value="classic"]').check();
  await page.locator('#start-game').click();
  assert.equal(
    await page.locator('#start-dialog').evaluate((dialog) => dialog.open),
    false,
  );

  await page.goto(`${baseUrl}/?seed=17`, { waitUntil: 'networkidle' });

  assert.equal(await page.locator('#progress').textContent(), '1/10');
  assert.equal(await page.locator('#lives').textContent(), '3');
  assert.equal(await page.locator('.timeline-card').count(), 1);
  assert.equal(await page.locator('#draw-event').isEnabled(), true);

  await page.locator('#draw-event').click();
  assert.equal((await page.locator('.current-card__year').textContent()).trim(), '????');
  assert.equal(await page.locator('.gap-slot').count(), 2);
  assert.equal(await page.locator('#draw-event').isVisible(), false);

  await page.locator('#hint-button').click();
  assert.match(await page.locator('#feedback').textContent(), /підказка/i);
  assert.match(
    await page.locator('.current-card__hint').textContent(),
    /половина .+ століття/i,
  );

  await page.locator('.gap-slot[data-gap-index="0"]').click();
  assert.equal(await page.locator('.timeline-card--preview').count(), 1);
  assert.equal(await page.locator('#confirm-place').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.timeline-card--preview').count(), 0);

  const timelineFrame = await page.locator('.timeline-frame').boundingBox();
  const currentPanel = await page.locator('#current-panel').boundingBox();
  const verticalGap = currentPanel.y - (timelineFrame.y + timelineFrame.height);
  assert.ok(verticalGap <= 48, `Timeline-to-card gap is ${verticalGap}px`);

  const firstEvent = await currentEvent();
  const initialYears = await readTimelineYears();
  const firstCorrectGap = correctGap(firstEvent.year, initialYears);
  const wrongGap = firstCorrectGap === 0 ? initialYears.length : 0;
  await placeAtGap(wrongGap);

  assert.equal(await page.locator('#lives').textContent(), '2');
  assert.match(await page.locator('#feedback').textContent(), /це був \d+ рік/i);
  assert.equal(await page.locator('.timeline-card__badge').count(), 1);
  const correctedYears = await readTimelineYears();
  assert.deepEqual(correctedYears, [...correctedYears].sort((a, b) => a - b));

  while (!(await page.locator('#result-dialog').evaluate((dialog) => dialog.open))) {
    await page.locator('#draw-event').click();
    const event = await currentEvent();
    const years = await readTimelineYears();
    const gap = correctGap(event.year, years);
    await placeAtGap(gap);
  }

  assert.equal(await page.locator('#progress').textContent(), '10/10');
  assert.match(await page.locator('#result-score').textContent(), /^\d+$/);
  assert.match(await page.locator('#result-accuracy').textContent(), /^\d+%$/);
  assert.equal(await page.locator('#result-mistakes').isVisible(), true);
  assert.equal(await page.locator('#result-mistakes-list li').count(), 1);

  await page.locator('#restart-game').click();
  assert.equal(await page.locator('#result-dialog').evaluate((dialog) => dialog.open), false);
  assert.equal(await page.locator('#progress').textContent(), '1/10');
  assert.equal(await page.locator('#lives').textContent(), '3');
  assert.equal(await page.locator('.timeline-card').count(), 1);

  // Режим «Помилки» заблокований, поки в банку менше ніж 5 подій.
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#mistakes-input').isDisabled(), true);
  assert.match(await page.locator('#mistakes-hint').textContent(), /відкриється/i);

  // Марафон роздає всю колоду каталогу.
  await page.goto(`${baseUrl}/?mode=marathon`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#progress').textContent(), `1/${EVENTS.length}`);

  // Виклик дня детермінований у межах доби.
  await page.goto(`${baseUrl}/?mode=daily`, { waitUntil: 'networkidle' });
  await page.locator('#draw-event').click();
  const dailyFirstTitle = await page.locator('.current-card__title').textContent();
  await page.goto(`${baseUrl}/?mode=daily`, { waitUntil: 'networkidle' });
  await page.locator('#draw-event').click();
  assert.equal(await page.locator('.current-card__title').textContent(), dailyFirstTitle);

  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedRequests, []);
  console.log('Mobile solo game acceptance passed.');
} finally {
  await page.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
