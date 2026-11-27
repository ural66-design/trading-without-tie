import {bindFaq, createItemPositioner} from './fmb-item-position.js?v=5';

const positioner = createItemPositioner(document.querySelector('#faq-scroll-room'),
  () => parseFloat(getComputedStyle(document.body).paddingTop));
bindFaq(document.querySelector('#faq'), positioner);