import {createItemPositioner} from './fmb-item-position.js?v=4';

const faq = document.querySelector('#faq');
const positioner = createItemPositioner(document.querySelector('#faq-scroll-room'),
  () => parseFloat(getComputedStyle(document.body).paddingTop));
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const transitions = new WeakMap();

// Keep native details as the fallback. With JavaScript, close siblings after their transition.
for (const details of faq.querySelectorAll('details[name]')) details.removeAttribute('name');

function changeDisclosure(details, open) {
  const previous = transitions.get(details);
  if (previous?.open === open) return previous.done;
  const start = details.getBoundingClientRect().height;
  previous?.animation?.cancel();
  if (motion.matches || !details.animate) {
    transitions.delete(details);
    details.open = open;
    details.style.removeProperty('height');
    return;
  }

  const change = {open};
  transitions.set(details, change);
  // Keep the current height until the visibility observer has formatted the answer.
  details.style.height = start + 'px';
  if (open) details.open = true;
  change.done = (async () => {
    await new Promise(requestAnimationFrame);
    if (transitions.get(details) !== change) return;
    try {
      details.style.height = '';
      const end = open ? details.getBoundingClientRect().height :
        details.firstElementChild.getBoundingClientRect().height + details.offsetHeight - details.clientHeight;
      change.animation = details.animate({height: [start + 'px', end + 'px']},
        {duration: 210, easing: 'ease-in-out', fill: 'both'});
      await change.animation.finished;
    } catch {
      // A newer click may cancel the animation.
    } finally {
      if (transitions.get(details) === change) {
        details.open = open;
        details.style.removeProperty('height');
        change.animation?.cancel();
        transitions.delete(details);
      }
    }
  })();
  return change.done;
}

faq.addEventListener('click', event => {
  const summary = event.target.closest('summary');
  if (!summary) return;
  event.preventDefault();
  const details = summary.parentElement;
  const open = !(transitions.get(details)?.open ?? details.open);
  const closing = open ? [...details.parentElement.children]
    .filter(item => item !== details && item instanceof HTMLDetailsElement && item.open) : [details];
  const closingHeight = closing.reduce((height, item) => height +
    item.getBoundingClientRect().height - item.firstElementChild.getBoundingClientRect().height, 0);
  if (closingHeight) positioner.prepare(closingHeight);
  const changes = closing.map(item => changeDisclosure(item, false));
  if (open) {
    changes.push(changeDisclosure(details, true));
    positioner.position(summary, Promise.all(changes));
  } else positioner.hold();
});
