import {bindFaq, createItemPositioner} from './fmb-item-position.js?v=7';

const positioner = createItemPositioner(
  () => parseFloat(getComputedStyle(document.body).paddingTop));
bindFaq(document.querySelector('#faq'), positioner);
