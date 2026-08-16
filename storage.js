// Локальний прогрес гравця: рекорди, статистика, банк помилок, серія виклику дня.
// localStorage — основне сховище; Telegram CloudStorage синхронізується поверх.

import { cloudGet, cloudSet } from './telegram.js';

const BEST_KEY = 'timeline-best-scores';
const STATS_KEY = 'timeline-stats-v1';
const MISTAKES_KEY = 'timeline-mistake-bank';

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватний режим — прогрес не зберігається
  }
  cloudSet(key, JSON.stringify(value));
}

export function readBestScores() {
  return read(BEST_KEY, {});
}

export function saveBestScore(key, score) {
  const scores = readBestScores();
  if (score > (scores[key] ?? 0)) {
    scores[key] = score;
    write(BEST_KEY, scores);
    return true;
  }
  return false;
}

function emptyStats() {
  return {
    games: 0,
    byCategory: {},
    daily: { last: null, streak: 0 },
  };
}

export function readStats() {
  return read(STATS_KEY, emptyStats());
}

export function recordPlacement(category, correct) {
  const stats = readStats();
  const entry = stats.byCategory[category] ?? { attempts: 0, correct: 0 };
  entry.attempts += 1;
  if (correct) entry.correct += 1;
  stats.byCategory[category] = entry;
  write(STATS_KEY, stats);
}

export function recordGameFinished({ dailyDate = null } = {}) {
  const stats = readStats();
  stats.games += 1;

  if (dailyDate && stats.daily.last !== dailyDate) {
    const previous = stats.daily.last ? new Date(stats.daily.last) : null;
    const current = new Date(dailyDate);
    const oneDay = 24 * 60 * 60 * 1000;
    stats.daily.streak = previous && current - previous <= oneDay * 1.5
      ? stats.daily.streak + 1
      : 1;
    stats.daily.last = dailyDate;
  }

  write(STATS_KEY, stats);
  return stats;
}

export function overallAccuracy(stats) {
  let attempts = 0;
  let correct = 0;
  for (const entry of Object.values(stats.byCategory)) {
    attempts += entry.attempts;
    correct += entry.correct;
  }
  return attempts === 0 ? null : Math.round((correct / attempts) * 100);
}

export function readMistakeBank() {
  return read(MISTAKES_KEY, []);
}

export function addMistake(eventId) {
  const bank = readMistakeBank();
  if (!bank.includes(eventId)) {
    bank.push(eventId);
    write(MISTAKES_KEY, bank);
  }
}

export function removeMistake(eventId) {
  const bank = readMistakeBank();
  const index = bank.indexOf(eventId);
  if (index !== -1) {
    bank.splice(index, 1);
    write(MISTAKES_KEY, bank);
  }
}

// Одноразова синхронізація з Telegram CloudStorage: беремо те, чого немає локально.
export async function hydrateFromCloud() {
  for (const key of [BEST_KEY, STATS_KEY, MISTAKES_KEY]) {
    if (localStorage.getItem(key)) continue;
    const value = await cloudGet(key);
    if (value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ігноруємо
      }
    }
  }
}
