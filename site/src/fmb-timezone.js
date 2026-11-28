// The shared module skips normal browser visits and pages without an endpoint.
const endpoint = document.querySelector('meta[name="fmb-timezone-endpoint"]')?.content;
if (endpoint && new URLSearchParams(location.search).get('view') === 'telegram') {
  const sync = async () => {
    try {
      const initData = globalThis.Telegram?.WebApp?.initData;
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!initData || !zone) return;
      const url = new URL(endpoint);
      if (url.protocol !== 'https:') return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, zone }),
          credentials: 'omit',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // The guide remains usable when sync is unavailable.
    }
  };
  const onSdkReady = () => {
    const webApp = globalThis.Telegram?.WebApp;
    if (document.body.matches('.fmb-guide[data-page="guide"]') && (webApp?.initData || (webApp?.platform && webApp.platform !== 'unknown'))) {
      webApp.ready?.();
      webApp.expand?.();
      if (webApp.isVersionAtLeast?.('7.7') !== false) webApp.disableVerticalSwipes?.();
    }
    void sync();
  };
  if (globalThis.Telegram?.WebApp) {
    onSdkReady();
  } else {
    const sdk = document.createElement('script');
    sdk.src = 'https://telegram.org/js/telegram-web-app.js';
    sdk.addEventListener('load', onSdkReady, { once: true });
    document.head.append(sdk);
  }
}
