# Лідерборд: розгортання за 5 хвилин

Лідерборд працює на Cloudflare Workers (безкоштовний тариф) і показує два топи:
**Глобальний** (усі гравці) та **Цей чат** (люди, що відкрили Mini App з того самого
чату/групи — телеграмний аналог «по контактах»; Telegram не дає веб-застосункам
доступу до списку контактів, тому чатовий топ — максимум можливого без порушення приватності).

Результати підписуються Telegram initData та перевіряються на сервері HMAC-підписом,
тож накрутити чужий рахунок не можна.

## Кроки

1. Зареєструйся на [cloudflare.com](https://dash.cloudflare.com/sign-up) (безкоштовно) і встанови wrangler:

```bash
npm install -g wrangler
```

2. Увійди в акаунт:

```bash
wrangler login
```

3. Створи KV-сховище (з каталогу `server/`):

```bash
cd server && wrangler kv namespace create SCORES
```

Скопіюй `id` з відповіді у `server/wrangler.toml` (замість `REPLACE_WITH_KV_NAMESPACE_ID`).

4. Додай токен бота (той самий, що від BotFather; вводиться у власному терміналі, в чат нікому не надсилай):

```bash
cd server && wrangler secret put BOT_TOKEN
```

5. Задеплой:

```bash
cd server && wrangler deploy
```

Wrangler надрукує URL виду `https://timeline-leaderboard.<нік>.workers.dev`.

6. Впиши цей URL у `config.js` в корені гри:

```js
export const LEADERBOARD_API = 'https://timeline-leaderboard.<нік>.workers.dev';
```

7. Закоміть і запуш — CI сам передеплоїть гру на Pages.

## Як це працює

- Після кожної завершеної партії гра надсилає рахунок (`POST /score`) з initData у заголовку.
- Воркер перевіряє підпис, оновлює глобальний топ-100 і топ-50 чату (`chat_instance` з initData).
- Кнопка «Лідерборд» з'являється на старті та у фіналі тільки в Telegram і тільки коли `LEADERBOARD_API` налаштовано.
- Топи ведуться окремо для кожного режиму (класика/марафон/виклик дня/помилки).
