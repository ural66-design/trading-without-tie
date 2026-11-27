export function createItemPositioner(scrollRoom, topInset) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame, target;

  function reserve(top, closingHeight = 0) {
    const pageEnd = scrollRoom.getBoundingClientRect().top + window.scrollY
      + parseFloat(getComputedStyle(document.body).paddingBottom);
    const height = Math.max(0, Math.ceil(top + document.documentElement.clientHeight - pageEnd + closingHeight));
    scrollRoom.style.height = height + 'px';
  }

  function hold(container) {
    if (container && (!target || !container.contains(target))) return;
    target = null;
    cancelAnimationFrame(frame);
    window.scrollTo({top: window.scrollY, behavior: 'instant'});
    reserve(window.scrollY);
  }

  window.addEventListener('scroll', () => {
    if (!target) reserve(window.scrollY);
  }, {passive: true});

  return {
    prepare(closingHeight) {
      reserve(window.scrollY, closingHeight);
    },
    hold,
    position(element) {
      target = element;
      cancelAnimationFrame(frame);
      // Let disclosure, rendering and typography update the layout before measuring.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!element.getClientRects().length) return;
          const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - topInset(element));
          reserve(Math.max(top, window.scrollY));
          window.scrollTo({top, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
        });
      });
    },
  };
}
