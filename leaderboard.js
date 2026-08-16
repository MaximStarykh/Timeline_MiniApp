// Клієнт лідерборда. Працює лише в Telegram (потрібен initData для
// підтвердження особи гравця) і лише коли налаштовано LEADERBOARD_API.

import { LEADERBOARD_API } from './config.js';
import { telegramInitData } from './telegram.js';

export function leaderboardAvailable() {
  return Boolean(LEADERBOARD_API) && Boolean(telegramInitData());
}

async function call(path, options = {}) {
  const response = await fetch(`${LEADERBOARD_API}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': telegramInitData(),
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Leaderboard HTTP ${response.status}`);
  return response.json();
}

// Надіслати рахунок завершеної партії. Помилки мережі не мають ламати гру.
export async function submitScore(mode, score) {
  if (!leaderboardAvailable()) return null;
  try {
    return await call('/score', {
      method: 'POST',
      body: JSON.stringify({ mode, score }),
    });
  } catch {
    return null;
  }
}

// Повертає { global: [{name, score, me}], chat: [...], me: {rank, score} | null }
export async function fetchLeaderboard(mode) {
  if (!leaderboardAvailable()) return null;
  try {
    return await call(`/top?mode=${encodeURIComponent(mode)}`);
  } catch {
    return null;
  }
}
