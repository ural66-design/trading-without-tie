import {createItemPositioner} from './fmb-item-position.js?v=1';

const faq = document.querySelector('#faq');
const positioner = createItemPositioner(document.querySelector('#faq-scroll-room'),
  () => parseFloat(getComputedStyle(document.body).paddingTop));
let activeDetails = null;

faq.addEventListener('click', event => {
  const summary = event.target.closest('summary');
  if (!summary) return;
  const details = summary.parentElement;
  const closing = details.open ? details : [...details.parentElement.children]
    .find(item => item.open && item.name === details.name);
  if (closing) {
    // Preserve the viewport before the browser closes a disclosure or its sibling.
    positioner.prepare(closing.lastElementChild.getBoundingClientRect().height);
  }
});

faq.addEventListener('toggle', event => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement)) return;
  if (!details.open) {
    if (activeDetails && details.contains(activeDetails)) {
      activeDetails = null;
      positioner.hold();
    }
    return;
  }

  activeDetails = details;
  positioner.position(details.firstElementChild);
}, true);
