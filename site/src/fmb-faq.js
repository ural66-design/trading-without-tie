import {createItemPositioner} from './fmb-item-position.js?v=3';

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

const disclosures = new MutationObserver(records => {
  const changed = records.map(record => record.target);
  const opened = changed.reverse().find(details => details.open && !details.parentElement.closest('details:not([open])'));
  if (opened) {
    activeDetails = opened;
    positioner.position(opened.firstElementChild);
  } else if (activeDetails && changed.some(details => !details.open && details.contains(activeDetails))) {
    activeDetails = null;
    positioner.hold();
  }
});
disclosures.observe(faq, {subtree: true, attributes: true, attributeFilter: ['open']});
