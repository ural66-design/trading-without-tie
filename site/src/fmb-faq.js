const faq = document.querySelector('#faq');
const scrollRoom = document.querySelector('#faq-scroll-room');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let activeDetails = null;
let frame;

function reserveScrollRoom(top, closingHeight = 0) {
  const pageEnd = scrollRoom.getBoundingClientRect().top + window.scrollY
    + parseFloat(getComputedStyle(document.body).paddingBottom);
  const height = Math.max(0, Math.ceil(top + document.documentElement.clientHeight - pageEnd + closingHeight));
  scrollRoom.style.height = height + 'px';
}

faq.addEventListener('click', event => {
  const summary = event.target.closest('summary');
  if (!summary) return;
  const details = summary.parentElement;
  const closing = details.open ? details : [...details.parentElement.children]
    .find(item => item.open && item.name === details.name);
  if (closing) {
    // Preserve the viewport before the browser closes a disclosure or its sibling.
    reserveScrollRoom(window.scrollY, closing.lastElementChild.getBoundingClientRect().height);
  }
});

faq.addEventListener('toggle', event => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement)) return;
  if (!details.open) {
    if (activeDetails && details.contains(activeDetails)) {
      activeDetails = null;
      cancelAnimationFrame(frame);
      // Stop any in-flight scroll and keep the heading in view as the content shrinks.
      window.scrollTo({top: window.scrollY, behavior: 'instant'});
      reserveScrollRoom(window.scrollY);
    }
    return;
  }

  activeDetails = details;
  cancelAnimationFrame(frame);
  // Let native disclosure and the typography module update the rendered layout.
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      const summary = details.firstElementChild;
      if (!details.open || !summary.getClientRects().length) return;
      const inset = parseFloat(getComputedStyle(document.body).paddingTop);
      const top = Math.max(0, summary.getBoundingClientRect().top + window.scrollY - inset);
      reserveScrollRoom(Math.max(top, window.scrollY));
      window.scrollTo({top, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    });
  });
}, true);

// Reclaim any space retained when closing a disclosure as the reader scrolls back.
window.addEventListener('scroll', () => {
  if (!activeDetails) reserveScrollRoom(window.scrollY);
}, {passive: true});
