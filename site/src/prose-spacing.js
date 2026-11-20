const leaderProse = '.fmb-guide [data-panel=leader] :is(p,li)';
const selector = ':is(main:not(.placeholder), .legal-copy) :is(p:not([role="status"]), li), '+leaderProse;
const panel = document.querySelector('main:not(.placeholder)');
const inlineSizes = new WeakMap();
let pending;
let formattedBlocks = new WeakMap();
const blockSignature = element => devicePixelRatio+'|'+element.getBoundingClientRect().width+'|'+getComputedStyle(element).font+'|'+element.textContent;

function hasWideSpaces(element) {
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = style.font;
    const limit = Math.min(parseFloat(style.fontSize) * .65, context.measureText(' ').width * 2.2);
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const characters = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = [...range.getClientRects()].find(rect => rect.width > 0);
        if (rect) characters.push({space:/\s/u.test(node.data[i]),rect});
      }
    }
    return characters.some((char,i) => char.space && char.rect.width > limit &&
      characters[i-1] && characters[i+1] &&
      Math.abs(char.rect.top-characters[i-1].rect.top)<2 &&
      Math.abs(char.rect.top-characters[i+1].rect.top)<2);
}

const language = document.documentElement.lang;
const serviceWords = {
  ru:'в к с у о а и на по от до за из для при без об со во ко не но',
  en:'a an the of to in on at by for and or', es:'a y e o u de en con por del al el la los las',
  pt:'a o as os e de da do em no na ao por com', tr:'ve ile ya', fil:'ang ng sa at o mga na ay ni si',
  id:'di ke dari dan atau untuk pada dengan', ms:'di ke dari dan atau untuk pada dengan',
  vi:'và ở của với từ đến', hi:'और'
};
const shortWords = new Set((serviceWords[language.split('-')[0]]||'').split(' '));
const segmenter = new Intl.Segmenter(language,{granularity:'word'});
const typographySelector = 'main :is(p,li,h1,h2,h3), dialog [data-panel] :is(p,li,h2,h3)';
function protectLineEnds(element) {
  if (!element.getClientRects().length || language==='th') return;
  for(let pass=0;pass<24;pass++){
    const nodes=[],walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    let text='';
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      nodes.push({node,start:text.length,end:text.length+node.length});text+=node.data;
    }
    const tokens=[...segmenter.segment(text)].filter(t=>t.isWordLike);
    const position=offset=>{const part=nodes.find(n=>n.end>offset);return part&&{node:part.node,offset:offset-part.start};};
    let changed=false;
    for(let i=0;i<tokens.length-1;i++){
      const word=tokens[i],next=tokens[i+1];
      const sentence=word.segment.length<=5&&/[.!?]\s+$/u.test(text.slice(0,word.index));
      if(!sentence&&!shortWords.has(word.segment.toLocaleLowerCase(language)))continue;
      if(!/^[\s$€£«“„"'(,;:]+$/u.test(text.slice(word.index+word.segment.length,next.index)))continue;
      const start=position(word.index),end=position(next.index+next.segment.length-1);
      if(!start||!end)continue;
      if(start.node.parentElement.closest('.protected-name,.keep-words,a'))continue;
      const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(start.node,start.offset+word.segment.length);
      const previous=[...range.getClientRects()].filter(r=>r.width).at(-1);
      const nextStart=position(next.index);range.setStart(nextStart.node,nextStart.offset);range.setEnd(end.node,end.offset+1);
      const following=[...range.getClientRects()].find(r=>r.width);
      if(!previous||!following||following.top-previous.top<Math.min(previous.height,following.height)*.6)continue;
      const atom=nextStart.node.parentElement.closest('.protected-name,.keep-words,a');
      if(nextStart.node.parentElement.closest('a[href^="mailto:"],.typography-address')){
        const gap=position(word.index+word.segment.length);
        if(gap&&gap.node.data[gap.offset]===' '){gap.node.replaceData(gap.offset,1,'\u00a0');changed=true;break;}
        continue;
      }
      range.setStart(start.node,start.offset);
      if(atom&&element.contains(atom)&&atom.textContent.trimStart().startsWith(next.segment))range.setEndAfter(atom);
      else range.setEnd(end.node,end.offset+1);
      const measure=document.createElement('span');
      measure.style.cssText='position:fixed;visibility:hidden;white-space:nowrap;width:max-content;max-width:none';
      measure.append(range.cloneContents());element.append(measure);
      const width=measure.getBoundingClientRect().width;measure.remove();
      const style=getComputedStyle(element),available=element.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
      if(width>available+1){
        if(/^H[123]$/.test(element.tagName)&&(!element.matches('.guide main h1')||innerWidth<=280)){
          if(element.dataset.typographySize===undefined)element.dataset.typographySize=element.style.fontSize;
          element.style.fontSize=(Math.floor(parseFloat(style.fontSize)*available/width*100)/100)+'px';changed=true;break;
        }
        continue;
      }
      const span=document.createElement('span');span.className='keep-words';span.dataset.typographyBond='';span.append(range.extractContents());range.insertNode(span);
      changed=true;break;
    }
    if(!changed)break;
  }
}

function protectNamesAndValues(){
  for(const span of document.querySelectorAll('.protected-name')){
    if(span.textContent.includes('@'))span.classList.add('typography-address');
    const range=span.textContent.match(/^(\d+[–—-]\d+|\d+\s+a\s+\d+)\s+(.+)$/u);
    if(range){span.textContent=range[1];span.after(document.createTextNode(' '+range[2]));}
  }
  const pattern=/Fast Money Bot|MetaTrader 4|Markets4you|Vladimir1\.com|T-Capital|Telegram(?:-бот[а-яё]*)?|Google|Facebook|e-mail|[$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?%|\d+:\d+|\d+[–—]\d+|\d+\s+(?:минут\p{L}*|час\p{L}*|км|кг|minutes?|hours?|km|kg|minutos?|horas?|menit|minit|jam|dakika|saat|phút|giờ|นาที|ชั่วโมง|मिनट|घंटे)/gu;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(node.parentElement.closest('main,dialog')&&!node.parentElement.closest('script,style,.protected-name,.keep-words'))nodes.push(node);
  }
  for(const node of nodes){
    const bold=node.parentElement.closest('strong,b,h1,h2,h3,button,.button,summary');
    const matcher=bold?new RegExp('[\\p{L}\\p{M}]+(?:-[\\p{L}\\p{M}]+)+|'+pattern.source,'gu'):pattern;
    const matches=[...node.data.matchAll(matcher)];
    if(!matches.length)continue;
    const fragment=document.createDocumentFragment();let offset=0;
    for(const m of matches){fragment.append(node.data.slice(offset,m.index));const span=document.createElement('span');span.className='protected-name';span.textContent=m[0];fragment.append(span);offset=m.index+m[0].length;}
    fragment.append(node.data.slice(offset));node.replaceWith(fragment);
  }
  for(const google of document.querySelectorAll('main .protected-name')){
    const slash=google.nextSibling,facebook=slash?.nextSibling;
    if(google.textContent==='Google'&&slash?.nodeType===Node.TEXT_NODE&&slash.data==='/'&&facebook?.textContent==='Facebook')slash.after(document.createElement('wbr'));
  }
}
protectNamesAndValues();

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
    const changed = new Set([...document.querySelectorAll(typographySelector)].filter(block=>block.getClientRects().length&&formattedBlocks.get(block)!==blockSignature(block)));
    if(!changed.size)return;
    document.querySelectorAll('[data-typography-bond]').forEach(span=>{
      if(changed.has(span.closest('p,li,h1,h2,h3')))span.replaceWith(...span.childNodes);
    });
    fitOverflowingHeadings(changed);
    const candidates = [...document.querySelectorAll(selector)].filter(block=>changed.has(block));
    const blocks = candidates.filter(block => (block.clientWidth >= 576 || block.matches(leaderProse)) && block.getClientRects().length);
    for (const block of candidates) block.classList.remove('prose-justified');
    // Try native justification at the current width and keep it only for readable paragraphs.
    for (const block of blocks) block.classList.add('prose-justified');
    const wideSpaces = blocks.filter(block => getComputedStyle(block).textAlign === 'justify' && hasWideSpaces(block));
    for (const block of wideSpaces) block.classList.remove('prose-justified');
    for(const block of changed)protectLineEnds(block);
    for(const block of blocks){
      if(getComputedStyle(block).textAlign==='justify'&&hasWideSpaces(block))block.classList.remove('prose-justified');
    }
    for(const block of changed)protectLineEnds(block);
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
