// Owner's default: data-theme on <html>. Visitor's choice stays on this device.
(() => {
  const root = document.documentElement;
  const choices = ['sea', 'winter', 'spring'];
  const picker = document.querySelector('.theme-picker');
  function apply(theme) {
    if (!choices.includes(theme)) return;
    root.dataset.theme = theme;
    picker.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
    document.querySelector('meta[name="theme-color"]').content =
      {sea: '#123951', winter: '#173a55', spring: '#234c3b'}[theme];
  }
  try { apply(localStorage.getItem('vt-theme')); } catch { /* Storage may be unavailable. */ }
  picker.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-choice]');
    if (!button) return;
    apply(button.dataset.themeChoice);
    try { localStorage.setItem('vt-theme', button.dataset.themeChoice); } catch {}
    picker.open = false;
    picker.querySelector('summary').focus();
  });
  document.querySelectorAll('details.language-picker').forEach(menu => {
    menu.addEventListener('toggle', () => {
      if (menu.open) document.querySelectorAll('details.language-picker').forEach(other => {
        if (other !== menu) other.open = false;
      });
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
    });
  });
  document.addEventListener('click', event => {
    document.querySelectorAll('details.language-picker').forEach(menu => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
})();
