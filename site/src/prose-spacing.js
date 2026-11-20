const leaderProse = '.fmb-guide [data-panel=leader] :is(p,li)';
const selector = ':is(main:not(.placeholder), .legal-copy) :is(p:not([role="status"]), li), '+leaderProse;
const guideProse = 'body.guide:is(.tc-guide,.fmb-guide) main.panel :is(.guide-intro,.howto,.risk,.step-content,.step-note,.answer,.completion) :is(p:not([role="status"]),li), body.fmb-guide dialog [data-panel=leader] :is(p,li)';
const panel = document.querySelector('main:not(.placeholder)');
const inlineSizes = new WeakMap();
let pending;
let formattedBlocks = new WeakMap();
const blockSignature = element => devicePixelRatio+'|'+element.getBoundingClientRect().width+'|'+getComputedStyle(element).font+'|'+element.textContent;

function hasWideSpaces(element, spaceRatio = null) {
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = style.font;
    const limit = Math.min(parseFloat(style.fontSize) * .65, context.measureText(' ').width * 2.2);
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const characters = [];
    const spaceWidths = new Map();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = [...range.getClientRects()].find(rect => rect.width > 0);
        if (!rect) continue;
        const space = /\s/u.test(node.data[i]);
        let maximum = limit;
        if (space && spaceRatio !== null) {
          const font = getComputedStyle(node.parentElement).font;
          if (!spaceWidths.has(font)) {
            context.font = font;
            spaceWidths.set(font, context.measureText(' ').width * spaceRatio);
          }
          maximum = spaceWidths.get(font);
        }
        characters.push({space,rect,maximum});
      }
    }
    const sameLine = (a,b) => spaceRatio === null ? Math.abs(a.top-b.top)<2 :
      Math.abs((a.top+a.bottom-b.top-b.bottom)/2) < Math.min(a.height,b.height)/2;
    return characters.some((char,i) => char.space && char.rect.width > char.maximum + (spaceRatio === null ? 0 : .02) &&
      characters[i-1] && characters[i+1] &&
      sameLine(char.rect,characters[i-1].rect) && sameLine(char.rect,characters[i+1].rect));
}

const language = document.documentElement.lang;
const segmenter = new Intl.Segmenter(language,{granularity:'word'});
const typographySelector = 'main :is(p,li,h1,h2,h3), dialog [data-panel] :is(p,li,h2,h3)';
function protectNamesAndValues(){
  for(const span of document.querySelectorAll(isGuide ? '.legal-copy .protected-name' : '.protected-name')){
    if(span.textContent.includes('@'))span.classList.add('typography-address');
    const range=span.textContent.match(/^(\d+[–—-]\d+|\d+\s+a\s+\d+)\s+(.+)$/u);
    if(range){span.textContent=range[1];span.after(document.createTextNode(' '+range[2]));}
  }
  const pattern=/Fast Money Bot|MetaTrader 4|Markets4you|Vladimir1\.com|T-Capital|Telegram(?:-бот[а-яё]*)?|Google|Facebook|e-mail|[$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?%|\d+:\d+|\d+[–—]\d+|\d+\s+(?:минут\p{L}*|час\p{L}*|км|кг|minutes?|hours?|km|kg|minutos?|horas?|menit|minit|jam|dakika|saat|phút|giờ|นาที|ชั่วโมง|मिनट|घंटे)/gu;
  // Protect quoted labels and hyphenated compounds before the browser lays out the text.
  const quoted = '«[^«»\\n]{1,48}»|“[^“”\\n]{1,48}”|„[^„“\\n]{1,48}“';
  const compound = '[\\p{L}\\p{N}]+(?:\\u00ad[\\p{L}\\p{N}]+)*[-‐‑][\\p{L}\\p{N}]+(?:\\u00ad[\\p{L}\\p{N}]+)*';
  const protectedPattern = new RegExp(quoted + '|' + compound + '|' + pattern.source, 'gu');
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(node.parentElement.closest('main,dialog')&&!node.parentElement.closest('script,style,.protected-name,.keep-words')&&(!isGuide||node.parentElement.closest('.legal-copy')))nodes.push(node);
  }
  for(const node of nodes){
    const bold=node.parentElement.closest('strong,b,h1,h2,h3,button,.button,summary');
    const matcher=protectedPattern;
    const matches=[...node.data.matchAll(matcher)];
    if(!matches.length)continue;
    const fragment=document.createDocumentFragment();let offset=0;
    for(const m of matches){fragment.append(node.data.slice(offset,m.index));const span=document.createElement('span');span.className=(m[0].length>24&&/\s/u.test(m[0])&&/^[«“„]/u.test(m[0]))?'quoted-phrase':'protected-name';span.textContent=m[0].replace(/\u00ad/g,'');fragment.append(span);offset=m.index+m[0].length;}
    fragment.append(node.data.slice(offset));node.replaceWith(fragment);
  }
  for(const google of document.querySelectorAll(isGuide ? '.legal-copy .protected-name' : 'main .protected-name')){
    const slash=google.nextSibling,facebook=slash?.nextSibling;
    if(google.textContent==='Google'&&slash?.nodeType===Node.TEXT_NODE&&slash.data==='/'&&facebook?.textContent==='Facebook')slash.after(document.createElement('wbr'));
  }
}

const isGuide = document.body.matches('.guide:is(.tc-guide,.fmb-guide)');
const guideHeadings = 'main.panel :is(h1,h2,h3,h4,h5,h6), dialog [data-panel=leader] :is(h1,h2,h3,h4,h5,h6)';
const guideBlocks = guideProse + ', ' + guideHeadings;
const atomic = '.protected-name,.keep-words';
const controls = 'script,style,button,label,input,select,textarea,[aria-hidden=true]';
const nameSeparator = '[\\s\\u00a0]*';
const names = /Fast[\s\u00a0]+Money[\s\u00a0]+Bot|MetaTrader[\s\u00a0]+4|Classic[\s\u00a0]+Pro|Markets4you|Vladimir1\.com|T[-‑]Capital|Myfxbook|Telegram(?:[-‑](?:бот|канал)[а-яё]*)?|YouTube|Google\s*\/\s*Facebook|Google|Facebook|Share4you|e-mail|\b(?:ID|IP)[-‑][\p{L}\p{M}]+|(?:стоп[-‑]лосс[\p{L}\p{M}]*|stop[-‑]loss(?:[-‑]nya)?|proof[-‑]of[-‑]address)/giu;
const number = '\\d+(?:[.,]\\d+)?';
const units = '(?:минут[а-яё]*|час[а-яё]*|секунд[а-яё]*|км|кг|мин\\.|minutes?|hours?|seconds?|km|kg|minutos?|horas?|segundos?|menit|minit|jam|dakika|saat|phút|giờ|นาที|ชั่วโมง|मिनट|घंट[ेा]|USD|EUR|USDT)';
const values = '[$€£]'+nameSeparator+number+'|'+number+nameSeparator+'%|\\d+\\s*[:–—−-]\\s*\\d+|'+number+nameSeparator+units+'(?![\\p{L}\\p{M}])';
const guideAtoms = new RegExp(names.source + '|' + values, 'giu');
const quotedText = /«[^»]+»|“[^”]+”|„[^“]+“|"[^"\n]+"/gu;
const compoundWord = /[\p{L}\p{M}\p{N}]+(?:[-‐‑][\p{L}\p{M}\p{N}]+)+/gu;
const sentenceSegmenter = isGuide ? new Intl.Segmenter(language, {granularity:'sentence'}) : null;

function guideText(block) {
  const nodes = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let text = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({node, offset:text.length});
    text += node.data;
  }
  return {text,nodes};
}

function prepareGuideText() {
  for (const block of document.querySelectorAll(guideBlocks)) {
    const {text,nodes} = guideText(block);
    const quotes = [...text.matchAll(quotedText)].map(m => [m.index,m.index + m[0].length]);
    for (const {node,offset} of nodes) {
      const parent = node.parentElement;
      if (parent.closest(controls)) continue;
      if (parent.closest(atomic)) {
        if (node.data.includes('\u00ad')) node.data = node.data.replaceAll('\u00ad','');
        continue;
      }
      const plain = node.data.replaceAll('\u00ad','');
      const indices = [];
      for (let i = 0; i < node.length; i++) if (node.data[i] !== '\u00ad') indices.push(i);
      const rigid = parent.closest('h1,h2,h3,h4,h5,h6,strong,b');
      const matches = [...plain.matchAll(guideAtoms)];
      for (const word of plain.matchAll(compoundWord)) {
        const at = offset + indices[word.index];
        if (rigid || quotes.some(([start,end]) => start <= at && at < end)) matches.push(word);
      }
      // Use the original offsets so ordinary soft hyphens survive unchanged.
      const output = document.createDocumentFragment();
      const clean = (start,end) => node.data.slice(start,end).split('').map((c,i) =>
        c === '\u00ad' && (rigid || quotes.some(([a,b]) => a <= offset+start+i && offset+start+i < b)) ? '' : c).join('');
      let cursor = 0;
      for (const match of matches.sort((a,b) => a.index-b.index || b[0].length-a[0].length)) {
        const start = indices[match.index];
        const end = indices[match.index+match[0].length-1]+1;
        if (start < cursor) continue;
        output.append(clean(cursor,start));
        const span = document.createElement('span');
        span.className = 'protected-name';
        span.textContent = match[0];
        if (parent.closest('a[href^="mailto:"]')) span.classList.add('typography-address');
        output.append(span);
        cursor = end;
      }
      const tail = clean(cursor,node.length);
      if (cursor) {
        output.append(tail);
        node.replaceWith(output);
      } else if (tail !== node.data) node.data = tail;
    }
    if (block.matches(guideProse)) bindSentenceStarts(block);
  }
}

function bindSentenceStarts(block) {
  const {text,nodes} = guideText(block);
  const segments = [...sentenceSegmenter.segment(text)];
  const abbreviations = /(?:^|[^\p{L}])(?:т\.\s*[едкпнч]|г|ул|им|рис|стр|см|др|пр|мин|макс|руб|mr|mrs|ms|dr|prof|jr|sr|no|fig|vs|etc|e\.g|i\.e|p\. ej|p\. ex|srta|ud|dra|örn|bkz|vb|mis|dll|dsb|v\.v)\.$/iu;
  const position = i => nodes.findLast(({offset}) => offset <= i);
  for (const {index,segment} of segments.slice(1).reverse()) {
    const previous = text.slice(0,index).trimEnd().replace(/[»”"’')\]]+$/u,'');
    if (!/[.!?।॥。！？]$/u.test(previous) || abbreviations.test(previous) ||
        /(?:^|\s)\p{Lu}\.$/u.test(previous)) continue;
    const words = [...segmenter.segment(segment)].filter(t => /\p{L}/u.test(t.segment));
    if (words.length < 2) continue;
    const [first,next] = words;
    const count = (first.segment.normalize('NFC').match(/\p{L}/gu) || []).length;
    if (count < 1 || count > 4 || !/^[\s«“„"‘'(\[]*$/u.test(segment.slice(0,first.index))) continue;
    const end = index+first.index+first.segment.length;
    const following = index+next.index;
    const gap = text.slice(end,following);
    if (!/^[ \t\r\n\u00a0]*$/u.test(gap)) continue;
    const {node,offset} = position(end);
    if (node.parentElement.closest(controls)) continue;
    if (/^[ \t\r\n]+$/u.test(gap)) {
      // A no-break space binds the words across inline elements and preserves syllable breaks.
      for (let i = following-1; i >= end; i--) {
        const part = position(i);
        part.node.replaceData(i-part.offset,1,i === end ? '\u00a0' : '');
      }
    } else if (!gap && language === 'th') {
      node.insertData(end-offset,'\u2060');
    }
  }
}

function fitGuideAtoms(block) {
  const style = getComputedStyle(block);
  const width = block.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  for (const span of block.querySelectorAll(atomic)) {
    if (span.closest('a') || span.classList.contains('typography-address')) continue;
    span.classList.remove('guide-inline-scroll');
    const oversized = span.getBoundingClientRect().width > width + .5;
    span.classList.toggle('guide-inline-scroll', oversized);
    if (oversized) span.setAttribute('tabindex','0');
    else if (span.getAttribute('tabindex') === '0') span.removeAttribute('tabindex');
  }
}

protectNamesAndValues();
if (isGuide) prepareGuideText();

function fitOverflowingHeadings(changed){
  for(const heading of document.querySelectorAll('main :is(h1,h2,h3),dialog :is(h2,h3)')){
    if(!changed.has(heading))continue;
    if(heading.dataset.typographySize!==undefined){heading.style.fontSize=heading.dataset.typographySize;delete heading.dataset.typographySize;}
    if(heading.matches('.guide main h1'))continue;
    const style=getComputedStyle(heading),available=heading.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT),range=document.createRange();let widest=0;
    for(let node=walker.nextNode();node;node=walker.nextNode())for(const word of segmenter.segment(node.data)){
      if(!word.isWordLike)continue;range.setStart(node,word.index);range.setEnd(node,word.index+word.segment.length);
      widest=Math.max(widest,...[...range.getClientRects()].map(r=>r.width));
    }
    for(const atom of heading.querySelectorAll('.protected-name,.keep-words'))widest=Math.max(widest,atom.getBoundingClientRect().width);
    if(widest>available+.5){heading.dataset.typographySize=heading.style.fontSize;heading.style.fontSize=(Math.floor(parseFloat(style.fontSize)*available/widest*100)/100)+'px';}
  }
}

function checkSpacing() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = undefined;
    if(document.fonts.status!=='loaded'){document.fonts.ready.then(checkSpacing);return;}
    const changed = new Set([...document.querySelectorAll(isGuide ? guideBlocks : typographySelector)].filter(block=>block.getClientRects().length&&(!isGuide||!block.closest('details:not([open])'))&&formattedBlocks.get(block)!==blockSignature(block)));
    if(!changed.size)return;
    document.querySelectorAll('[data-typography-bond]').forEach(span=>{
      if(changed.has(span.closest('p,li,h1,h2,h3')))span.replaceWith(...span.childNodes);
    });
    if (isGuide) {
      for (const block of changed) fitGuideAtoms(block);
    } else fitOverflowingHeadings(changed);
    const candidates = [...document.querySelectorAll(selector)].filter(block=>changed.has(block)&&!block.matches(guideProse));
    const blocks = candidates.filter(block => (block.clientWidth >= 576 || block.matches(leaderProse)) && block.getClientRects().length);
    for (const block of candidates) block.classList.remove('prose-justified');
    // Try native justification at the current width and keep it only for readable paragraphs.
    for (const block of blocks) block.classList.add('prose-justified');
    const wideSpaces = blocks.filter(block => getComputedStyle(block).textAlign === 'justify' && hasWideSpaces(block));
    for (const block of wideSpaces) block.classList.remove('prose-justified');
    for (const block of changed) {
      if (!block.matches(guideProse) || !block.matches('p,li')) continue;
      if (block.matches(':lang(th)')) continue;
      block.classList.add('guide-justify');
      if (hasWideSpaces(block, 1.5)) block.classList.remove('guide-justify');
    }
    for(const block of changed)formattedBlocks.set(block,blockSignature(block));
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
if (isGuide) {
  for (const block of document.querySelectorAll(guideBlocks)) observer.observe(block);
}
const leaderPanel = document.querySelector('.fmb-guide [data-panel=leader]');
if (leaderPanel) observer.observe(leaderPanel, { box: 'border-box' });

const visibility = new MutationObserver(checkSpacing);
for (const documentPanel of document.querySelectorAll('dialog .legal-copy, dialog [data-panel]')) {
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
document.fonts.addEventListener('loadingdone',()=>{formattedBlocks=new WeakMap();checkSpacing();});
window.addEventListener('resize',checkSpacing);
