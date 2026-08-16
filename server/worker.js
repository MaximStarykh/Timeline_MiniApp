// Лідерборд «Лінії часу» — Cloudflare Worker.
//
// Зберігає найкращі результати гравців у KV:
//   g:<mode>                — глобальний топ-100
//   c:<chat_instance>:<mode> — топ-50 чату, з якого відкрили Mini App
//
// Особа гравця підтверджується підписом Telegram initData (HMAC із BOT_TOKEN),
// тому підробити чужий результат неможливо.
//
// Налаштування (див. docs/leaderboard-setup.md):
//   wrangler kv namespace create SCORES
//   wrangler secret put BOT_TOKEN
//   wrangler deploy

const GLOBAL_LIMIT = 100;
const CHAT_LIMIT = 50;
const MODES = new Set(['classic', 'marathon', 'daily', 'mistakes']);
const ALLOWED_ORIGINS = new Set([
  'https://maximstarykh.github.io',
  'http://127.0.0.1:4179',
]);

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'null',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-telegram-init-data',
    'content-type': 'application/json; charset=utf-8',
  };
}

async function hmacSha256(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Перевіряє підпис initData за схемою Telegram Mini Apps.
async function validateInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = await hmacSha256('WebAppData', botToken);
  const signature = hex(await hmacSha256(secret, dataCheckString));
  if (signature !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  let user = null;
  try {
    user = JSON.parse(params.get('user') ?? 'null');
  } catch {
    return null;
  }
  if (!user?.id) return null;

  return {
    user,
    chatInstance: params.get('chat_instance') ?? null,
  };
}

function displayName(user) {
  const last = user.last_name ? ` ${user.last_name[0]}.` : '';
  return `${user.first_name ?? 'Гравець'}${last}`.slice(0, 32);
}

async function updateBoard(kv, key, entry, limit) {
  const board = (await kv.get(key, 'json')) ?? [];
  const existing = board.find((row) => row.id === entry.id);
  if (existing) {
    if (entry.score <= existing.score) {
      return board;
    }
    existing.score = entry.score;
    existing.name = entry.name;
  } else {
    board.push(entry);
  }
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, limit);
  await kv.put(key, JSON.stringify(trimmed));
  return trimmed;
}

function publicBoard(board, meId) {
  return board.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    score: row.score,
    me: row.id === meId,
  }));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') ?? '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const auth = await validateInitData(
      request.headers.get('x-telegram-init-data'),
      env.BOT_TOKEN,
    );
    if (!auth) {
      return new Response(JSON.stringify({ error: 'invalid init data' }), { status: 401, headers });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/score') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers });
      }
      const score = Math.floor(Number(body.score));
      const mode = String(body.mode);
      if (!MODES.has(mode) || !Number.isFinite(score) || score < 0 || score > 1000000) {
        return new Response(JSON.stringify({ error: 'bad payload' }), { status: 400, headers });
      }

      const entry = { id: auth.user.id, name: displayName(auth.user), score };
      const global = await updateBoard(env.SCORES, `g:${mode}`, entry, GLOBAL_LIMIT);
      let chat = [];
      if (auth.chatInstance) {
        chat = await updateBoard(env.SCORES, `c:${auth.chatInstance}:${mode}`, entry, CHAT_LIMIT);
      }

      return new Response(JSON.stringify({
        global: publicBoard(global, auth.user.id),
        chat: publicBoard(chat, auth.user.id),
      }), { headers });
    }

    if (request.method === 'GET' && url.pathname === '/top') {
      const mode = url.searchParams.get('mode') ?? 'classic';
      if (!MODES.has(mode)) {
        return new Response(JSON.stringify({ error: 'bad mode' }), { status: 400, headers });
      }
      const global = (await env.SCORES.get(`g:${mode}`, 'json')) ?? [];
      const chat = auth.chatInstance
        ? (await env.SCORES.get(`c:${auth.chatInstance}:${mode}`, 'json')) ?? []
        : [];
      const meIndex = global.findIndex((row) => row.id === auth.user.id);

      return new Response(JSON.stringify({
        global: publicBoard(global, auth.user.id),
        chat: publicBoard(chat, auth.user.id),
        me: meIndex === -1 ? null : { rank: meIndex + 1, score: global[meIndex].score },
      }), { headers });
    }

    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
  },
};
