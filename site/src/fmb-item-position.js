export function createItemPositioner(scrollRoom, topInset) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame, target, idleTimer, touch;
  let smoothScroll = false;
  let touchScrolling = false;

  function reserve(top, closingHeight = 0) {
    const pageEnd = scrollRoom.getBoundingClientRect().top + window.scrollY
      + parseFloat(getComputedStyle(document.body).paddingBottom);
    const height = Math.max(0, Math.ceil(top + document.documentElement.clientHeight - pageEnd + closingHeight));
    const nextHeight = height + 'px';
    if (scrollRoom.style.height !== nextHeight) scrollRoom.style.height = nextHeight;
  }

  function cleanAfterScroll() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (frame !== undefined || touchScrolling) return;
      smoothScroll = false;
      if (scrollRoom.offsetHeight) reserve(window.scrollY);
    }, 350);
  }

  function cancelPosition() {
    target = null;
    cancelAnimationFrame(frame);
    frame = undefined;
    if (smoothScroll) {
      smoothScroll = false;
      window.scrollTo({top: window.scrollY, behavior: 'instant'});
    }
    cleanAfterScroll();
  }

  function hold(container) {
    if (container && (!target || !container.contains(target))) return;
    cancelPosition();
  }

  window.addEventListener('scroll', cleanAfterScroll, {passive: true});
  window.addEventListener('wheel', event => {
    if (event.deltaY && !event.ctrlKey) cancelPosition();
  }, {passive: true});
  window.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touch = event.touches[0];
  }, {passive: true});
  window.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0];
    const vertical = Math.abs(point.clientY - touch.clientY);
    if (!touchScrolling && vertical >= 8 && vertical >= Math.abs(point.clientX - touch.clientX)) {
      touchScrolling = true;
      cancelPosition();
    }
  }, {passive: true});
  function endTouch(event) {
    if (event.touches.length) return;
    touch = undefined;
    if (!touchScrolling) return;
    touchScrolling = false;
    cleanAfterScroll();
  }
  window.addEventListener('touchend', endTouch, {passive: true});
  window.addEventListener('touchcancel', endTouch, {passive: true});
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    if (event.target.isContentEditable || event.target.closest?.('select, textarea, input:not([type="checkbox"], [type="radio"], [type="button"])')) return;
    if (event.key === ' ' && event.target.closest?.('input, button, summary, [role="button"]')) return;
    cancelPosition();
  });

  return {
    prepare(closingHeight) {
      reserve(window.scrollY, closingHeight);
      cleanAfterScroll();
    },
    hold,
    position(element) {
      if (touchScrolling) return;
      target = element;
      cancelAnimationFrame(frame);
      // Let disclosure, rendering and typography update the layout before measuring.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          frame = undefined;
          if (!element.getClientRects().length) return;
          const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - topInset(element));
          reserve(Math.max(top, window.scrollY));
          smoothScroll = !reducedMotion.matches && Math.abs(top - window.scrollY) > 1;
          window.scrollTo({top, behavior: smoothScroll ? 'smooth' : 'instant'});
          cleanAfterScroll();
        });
      });
    },
  };
}
