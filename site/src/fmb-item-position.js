export function createItemPositioner(topInset) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const panels = new Map();
  let frame, touch;
  let pan = false, dragging = false;

  window.addEventListener('wheel', event => {
    if (event.deltaY && !event.ctrlKey) pan = false;
  }, {passive: true});
  window.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touch = event.touches[0];
  }, {passive: true});
  window.addEventListener('touchmove', event => {
    if (!touch || dragging || event.touches.length !== 1) return;
    const point = event.touches[0], dy = Math.abs(point.clientY - touch.clientY);
    if (dy >= 8 && dy >= Math.abs(point.clientX - touch.clientX)) {
      dragging = true;
      pan = false;
    }
  }, {passive: true});
  function endTouch(event) {
    if (event.touches.length) return;
    touch = undefined;
    dragging = false;
  }
  window.addEventListener('touchend', endTouch, {passive: true});
  window.addEventListener('touchcancel', endTouch, {passive: true});
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    if (event.target.isContentEditable || event.target.closest?.('select, textarea, input:not([type="checkbox"], [type="radio"], [type="button"])')) return;
    if (event.key === ' ' && event.target.closest?.('input, button, summary, [role="button"]')) return;
    pan = false;
  });

  function finish() {
    for (const {box, open, show} of panels.values()) {
      show(open);
      box.style.removeProperty('height');
    }
    panels.clear();
    frame = undefined;
    pan = false;
  }

  function transition(changes, heading) {
    cancelAnimationFrame(frame);
    pan = Boolean(heading) && !dragging;
    for (const change of changes) panels.set(change.box, change);
    const items = [...panels.values()];
    for (const item of items) item.start = item.box.getBoundingClientRect().height;
    const reduced = motion.matches;
    for (const {box, show, open, start} of items) {
      if (!reduced) box.style.height = start + 'px';
      show(reduced ? open : true);
    }
    // The visibility observer formats newly opened text before this frame.
    frame = requestAnimationFrame(started => {
      const from = scrollY;
      for (const {box} of items) box.style.removeProperty('height');
      // Measure descendants first when a topic and its questions are both changing.
      const nestedFirst = items.sort((a, b) => a.box.contains(b.box) ? 1 : b.box.contains(a.box) ? -1 : 0);
      for (const item of nestedFirst) {
        const {box, content, open} = item;
        item.end = box.getBoundingClientRect().height - (open || reduced ? 0 : content.getBoundingClientRect().height);
        box.style.height = item.end + 'px';
      }
      const scroller = document.scrollingElement;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const desired = pan && heading.getClientRects().length ?
        heading.getBoundingClientRect().top + scrollY - topInset(heading) : from;
      const to = Math.max(0, Math.min(desired, max));
      for (const {box, start} of items) box.style.height = start + 'px';
      const duration = reduced ? 0 : 260;
      function paint(now) {
        const time = duration ? Math.min(1, (now - started) / duration) : 1;
        const eased = time * time * (3 - 2 * time);
        for (const {box, start, end} of items) box.style.height = start + (end - start) * eased + 'px';
        if (pan && Math.abs(from + (to - from) * eased - scrollY) > 0.5) {
          window.scrollTo(0, from + (to - from) * eased);
        }
        if (time === 1) finish();
        else frame = requestAnimationFrame(paint);
      }
      paint(started);
    });
  }

  return {
    transition,
    reset() { cancelAnimationFrame(frame); finish(); },
    isOpen(box, fallback) { return panels.get(box)?.open ?? fallback; },
  };
}

export function bindFaq(faq, positioner, {closeOutside = false} = {}) {
  const questions = [...faq.querySelectorAll('details')];
  if (positioner) for (const detail of questions) detail.removeAttribute('name');
  const isOpen = detail => positioner?.isOpen(detail, detail.open) ?? detail.open;
  function change(box, open) {
    return {box, open, content: box.lastElementChild, show: value => { box.open = value; }};
  }
  function close() {
    return questions.filter(detail => isOpen(detail)).map(detail => change(detail, false));
  }
  function apply(changes, heading) {
    if (positioner) positioner.transition(changes, heading);
    else for (const {open, show} of changes) show(open);
  }
  faq.addEventListener('click', event => {
    const heading = event.target.closest('summary');
    if (!heading) return;
    event.preventDefault();
    const box = heading.parentElement;
    const open = !isOpen(box);
    const siblings = open || !positioner ? questions.filter(detail => detail !== box &&
      (!positioner || detail.parentElement === box.parentElement) && isOpen(detail)) : [];
    const closing = open ? siblings : [...siblings, box];
    const changes = questions.filter(detail =>
      closing.includes(detail) || (isOpen(detail) && closing.some(parent => parent.contains(detail)))
    ).map(detail => change(detail, false));
    if (open) changes.push(change(box, true));
    apply(changes, open ? heading : null);
  });
  if (closeOutside) document.addEventListener('click', event => {
    if (faq.contains(event.target)) return;
    const changes = close();
    if (changes.length) apply(changes, null);
  });
  return close;
}
