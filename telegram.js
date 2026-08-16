// Прогресивне покращення для Telegram Mini App.
// Поза Telegram кожна функція тихо вироджується в no-op або веб-аналог.

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

function webApp() {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramEnvironment() {
  return Boolean(webApp())
    || /tgWebApp/i.test(window.location.hash)
    || /tgWebApp/i.test(window.location.search);
}

function applyColorScheme(tg) {
  document.documentElement.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
}

async function loadSdk() {
  if (webApp()) return webApp();
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => resolve(webApp());
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

export async function initTelegram() {
  if (!isTelegramEnvironment()) return null;

  const tg = await loadSdk();
  if (!tg) return null;

  try {
    tg.ready();
    tg.expand();
    applyColorScheme(tg);
    tg.onEvent?.('themeChanged', () => applyColorScheme(tg));
  } catch {
    // старі клієнти можуть не мати частини API
  }
  return tg;
}

export function haptic(kind) {
  const feedback = webApp()?.HapticFeedback;
  if (feedback) {
    try {
      if (kind === 'success') feedback.notificationOccurred('success');
      else if (kind === 'error') feedback.notificationOccurred('error');
      else feedback.impactOccurred('light');
      return;
    } catch {
      // ігноруємо та падаємо на вібрацію
    }
  }
  if (kind === 'error') navigator.vibrate?.([40, 60, 40]);
  else navigator.vibrate?.(12);
}

export async function shareText(text, url) {
  const tg = webApp();
  if (tg?.openTelegramLink) {
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(link);
    return 'telegram';
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: `${text}\n${url}` });
      return 'native';
    } catch {
      // користувач скасував — пробуємо буфер
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'clipboard';
  } catch {
    return null;
  }
}

// CloudStorage Telegram переживає перевстановлення застосунку та зміну пристрою.
export function cloudSet(key, value) {
  try {
    webApp()?.CloudStorage?.setItem(key, value, () => {});
  } catch {
    // no-op
  }
}

export function cloudGet(key) {
  return new Promise((resolve) => {
    const storage = webApp()?.CloudStorage;
    if (!storage) {
      resolve(null);
      return;
    }
    try {
      storage.getItem(key, (error, value) => resolve(error ? null : value ?? null));
    } catch {
      resolve(null);
    }
  });
}
