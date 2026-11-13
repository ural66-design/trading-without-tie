const selector = ':is(main:not(.placeholder), .legal-copy) :is(p:not([role="status"]), li)';
const panel = document.querySelector('main:not(.placeholder)');
const inlineSizes = new WeakMap();
let pending;

function hasWideSpaces(element) {
  const limit = parseFloat(getComputedStyle(element).fontSize);
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lines = new Map();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const word of node.data.matchAll(/[^\s\u00a0\u202f]+/gu)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      for (const rect of range.getClientRects()) {
        if (!rect.width) continue;
        const top = Math.round(rect.top);
        if (!lines.has(top)) lines.set(top, []);
        lines.get(top).push(rect);
      }
    }
  }
  return [...lines.values()].slice(0, -1).some(line => {
    line.sort((first, second) => first.left - second.left);
    return line.some((rect, index) => index > 0 && rect.left - line[index - 1].right > limit);
  });
}

function checkSpacing() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = undefined;
    const candidates = [...document.querySelectorAll(selector)];
    const blocks = candidates.filter(block => block.clientWidth >= 576 && block.getClientRects().length);
    for (const block of candidates) block.classList.remove('prose-justified');
    // Try native justification at the current width and keep it only for readable paragraphs.
    for (const block of blocks) block.classList.add('prose-justified');
    const wideSpaces = blocks.filter(block => getComputedStyle(block).textAlign === 'justify' && hasWideSpaces(block));
    for (const block of wideSpaces) block.classList.remove('prose-justified');
  });
}

const observer = new ResizeObserver(entries => {
  let resized = false;
  for (const entry of entries) {
    const width = entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width;
    if (inlineSizes.get(entry.target) !== width) resized = true;
    inlineSizes.set(entry.target, width);
  }
  if (resized) checkSpacing();
});
if (panel) observer.observe(panel, { box: 'border-box' });

const visibility = new MutationObserver(checkSpacing);
for (const documentPanel of document.querySelectorAll('dialog .legal-copy')) {
  visibility.observe(documentPanel, { attributes: true, attributeFilter: ['hidden'] });
}
const dialog = document.querySelector('dialog');
if (dialog) visibility.observe(dialog, { attributes: true, attributeFilter: ['open'] });

for (const details of document.querySelectorAll('#faq details')) {
  visibility.observe(details, { attributes: true, attributeFilter: ['open'] });
}
document.querySelector('main')?.addEventListener('click', event => {
  if (event.target.closest('[data-step-toggle]')) checkSpacing();
});
document.querySelector('main')?.addEventListener('change', event => {
  if (event.target.matches('[data-step-check]')) checkSpacing();
});
document.fonts.ready.then(checkSpacing);
