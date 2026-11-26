// Until the HTTPS endpoint is approved, no request or SDK load is made.
const endpoint = document.querySelector('meta[name="fmb-timezone-endpoint"]')?.content;
if (endpoint && new URLSearchParams(location.search).get('view') === 'telegram') {
  const sync = async () => {
    try {
      const initData = globalThis.Telegram?.WebApp?.initData;
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!initData || !zone) return;
      const url = new URL(endpoint);
      if (url.protocol !== 'https:') return;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, zone }),
        credentials: 'omit',
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // The guide remains usable when sync is unavailable.
    }
  };
  if (globalThis.Telegram?.WebApp) {
    void sync();
  } else {
    const sdk = document.createElement('script');
    sdk.src = 'https://telegram.org/js/telegram-web-app.js';
    sdk.addEventListener('load', sync, { once: true });
    document.head.append(sdk);
  }
}
