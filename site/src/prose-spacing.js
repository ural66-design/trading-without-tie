const atomic = '.protected-name,.keep-words,.long-word';
const controls = 'script,style,input,select,textarea,[contenteditable],p[role=status],[aria-hidden=true]';
const nameSeparator = '[\\s\\u00a0]*';
const names = /Fast[\s\u00a0]+Money[\s\u00a0]+Bot|MetaTrader[\s\u00a0]*4|Classic[\s\u00a0]+Pro|Markets4you|Vladimir1\.com|T[-‑]Capital|Myfxbook|Telegram(?:[-‑](?:бот|канал)[а-яё]*)?|YouTube|Google\s*\/\s*Facebook|Google|Facebook|Share4you|e-mail|\b(?:ID|IP)[-‑][\p{L}\p{M}]+|(?:стоп[-‑]лосс[\p{L}\p{M}]*|stop[-‑]loss(?:[-‑]nya)?|proof[-‑]of[-‑]address)/giu;
const number = '\\d+(?:[.,]\\d+)?';
const units = '(?:минут[а-яё]*|час[а-яё]*|секунд[а-яё]*|км|кг|мин\\.|minutes?|hours?|seconds?|km|kg|minutos?|horas?|segundos?|menit|minit|jam|dakika|saat|phút|giờ|นาที|ชั่วโมง|मिनट|घंट[ेा]|USD|EUR|USDT)';
const values = '[$€£]'+nameSeparator+number+'|'+number+nameSeparator+'%|\\d+\\s*[:–—−-]\\s*\\d+|'+number+nameSeparator+units+'(?![\\p{L}\\p{M}])';
const guideAtoms = new RegExp(names.source + '|' + values, 'giu');
const quotedText = /«[^»]+»|“[^”]+”|„[^“]+“|"[^"\n]+"/gu;
const compoundWord = /[\p{L}\p{M}\p{N}]+(?:[-‐‑][\p{L}\p{M}\p{N}]+)+/gu;

const language = document.documentElement.lang;
const segmenter = new Intl.Segmenter(language,{granularity:'word'});
const sentenceSegmenter = new Intl.Segmenter(language,{granularity:'sentence'});
const prose = 'main:not(.placeholder), dialog .legal-copy, dialog [data-panel=leader]';
const textBlocks = 'p,li,h1,h2,h3,h4,h5,h6,summary,.button,.step-toggle';
const blocks = [...new Set([...document.querySelectorAll(prose)].flatMap(e=>[...e.querySelectorAll(textBlocks)]))].filter(e=>!e.closest(controls));
const technicalLinks = 'a[href^="mailto:"],a[href^="tel:"]';
const noHyphens = 'h1,h2,h3,h4,h5,h6,strong,b,button,.button';
const scrollTabStops = new WeakSet();
const prepared = new WeakSet();

function nodesOf(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let node=walker.nextNode(); node; node=walker.nextNode()) {
    const parent=node.parentElement;
    if (parent.closest(textBlocks)===block && !parent.closest(controls)) nodes.push(node);
  }
  return nodes;
}

function textMap(nodes) {
  let text='';
  const segments=[];
  for (const node of nodes) {
    const from=text.length, offsets=[];
    for(let i=0;i<node.length;i++){
      if(node.data[i]==='\u00ad')continue;
      offsets.push(i);
      text+=node.data[i];
    }
    if(offsets.length)segments.push({node,from,to:text.length,offsets});
  }
  const point=i=>{
    const s=segments.find(entry=>entry.from<=i&&i<entry.to);
    return s&&{node:s.node,offset:s.offsets[i-s.from]};
  };
  return {text,segments,point};
}

function sentencePairs(text) {
  const starts=new Set([...sentenceSegmenter.segment(text)].slice(1).map(x=>x.index));
  // Quoted endings are not segmented uniformly in all engines.
  for(const m of text.matchAll(/(?:\.[»”"’')\]]*\s+|[!?।॥。！？][»”"’')\]]*\s*)(?=[«“„"‘'(\[]*[\p{Lu}\p{Script=Thai}\p{Script=Devanagari}])/gu)){
    starts.add(m.index+m[0].length);
  }
  const abbrev=/(?:^|[^\p{L}])(?:т\.\s*[едкпнч]|г|ул|им|рис|стр|см|др|пр|мин|макс|руб|mr|mrs|ms|dr|prof|jr|sr|no|fig|vs|etc|e\.g|i\.e|p\. ej|p\. ex|srta|ud|dra|örn|bkz|vb|mis|dll|dsb|v\.v)\.$/iu;
  const words=[...segmenter.segment(text)].filter(x=>x.isWordLike),pairs=[];
  for(const start of starts){
    const previous=text.slice(0,start).trimEnd().replace(/[»”"’')\]]+$/u,'');
    if(!/[.!?।॥。！？]$/u.test(previous)||abbrev.test(previous)||/(?:^|\s)\p{Lu}\.$/u.test(previous))continue;
    const i=words.findIndex(w=>w.index>=start);
    if(i<0||i+1>=words.length)continue;
    const [first,next]=words.slice(i,i+2),size=(first.segment.normalize('NFC').match(/\p{L}/gu)||[]).length;
    if(!size||size>4||!/^\p{L}[\p{L}\p{M}]*$/u.test(first.segment)||!/\p{L}/u.test(next.segment))continue;
    if(!/^[\s«“„"‘'(\[]*$/u.test(text.slice(start,first.index)))continue;
    if(!/^\s*$/u.test(text.slice(first.index+first.segment.length,next.index)))continue;
    pairs.push([first.index,next.index+next.segment.length]);
  }
  return pairs;
}

function edgeThroughInline(block,node,offset,start) {
  while(node.parentNode!==block && node.parentElement?.matches('span,b,strong,em,i,small,a') &&
    (start?offset===0&&!node.previousSibling:offset===(node.nodeType===3?node.length:node.childNodes.length)&&!node.nextSibling)){
    node=node.parentNode;
    offset=start?0:node.childNodes.length;
  }
  return {node,offset};
}

function protect(block,map,from,to) {
  const first=map.point(from),last=map.point(to-1);
  if(!first||!last||first.node.parentElement.closest(technicalLinks)||last.node.parentElement.closest(technicalLinks))return;
  if(first.node.parentElement.closest(atomic)?.contains(last.node))return;
  const a=edgeThroughInline(block,first.node,first.offset,true);
  const b=edgeThroughInline(block,last.node,last.offset+1,false);
  const range=document.createRange();
  range.setStart(a.node,a.offset);
  range.setEnd(b.node,b.offset);
  if(a.node.nodeType===1&&a.node!==range.commonAncestorContainer)range.setStartBefore(a.node);
  if(b.node.nodeType===1&&b.node!==range.commonAncestorContainer)range.setEndAfter(b.node);
  const common=range.commonAncestorContainer;
  // Preserve link elements and handlers when a match straddles only part of a link.
  if([...block.querySelectorAll('a')].some(link=>!link.contains(common)&&
    (link.contains(range.startContainer)||link.contains(range.endContainer)))){
    for(const wbr of block.querySelectorAll('wbr'))if(range.intersectsNode(wbr))wbr.remove();
    for(const part of [...map.segments].reverse()){
      const start=Math.max(from,part.from),end=Math.min(to,part.to);
      if(start>=end)continue;
      for(let i=end-1;i>=start;i--){
        const offset=part.offsets[i-part.from];
        if(i<to-1&&(i===part.to-1||/[\s\-‐/]/u.test(part.node.data[offset])))part.node.insertData(offset+1,'\u2060');
      }
    }
    return;
  }
  const contents=range.extractContents();
  for(const wbr of contents.querySelectorAll('wbr'))wbr.remove();
  for(const nested of contents.querySelectorAll('.protected-name'))nested.classList.remove('protected-name');
  const walk=document.createTreeWalker(contents,NodeFilter.SHOW_TEXT);
  for(let n=walk.nextNode();n;n=walk.nextNode())if(n.data.includes('\u00ad'))n.data=n.data.replaceAll('\u00ad','');
  const span=document.createElement('span');
  span.className='protected-name';
  span.append(contents);
  range.insertNode(span);
}

function prepare(block) {
  if(prepared.has(block))return;
  prepared.add(block);
  const clean=textMap(nodesOf(block));
  const quotes=[...clean.text.matchAll(quotedText)].map(m=>[m.index,m.index+m[0].length]);
  const hits=[...clean.text.matchAll(guideAtoms)].map(m=>[m.index,m.index+m[0].length]);
  for (const [from,to] of quotes) {
    for (const word of segmenter.segment(clean.text.slice(from,to))) {
      if (word.isWordLike) hits.push([from+word.index, from+word.index+word.segment.length]);
    }
  }
  if(block.matches('p,li,summary,h1,h2,h3,h4,h5,h6'))hits.push(...sentencePairs(clean.text));
  const home=block.closest('.home');
  for(const m of clean.text.matchAll(compoundWord)){
    const end=m.index+m[0].length;
    if(home||clean.point(m.index)?.node.parentElement.closest(noHyphens)||quotes.some(([a,b])=>a<=m.index&&m.index<b)||
       hits.some(([a,b])=>a<end&&m.index<b))hits.push([m.index,end]);
  }
  for(const e of block.querySelectorAll(atomic)){
    const segments=clean.segments.filter(x=>e.contains(x.node));
    if(!segments.length)continue;
    const from=segments[0].from,to=segments.at(-1).to;
    if(hits.some(([a,b])=>a<to&&from<b))hits.push([from,to]);
  }
  const merged=[];
  for(const [a,b] of hits.sort((x,y)=>x[0]-y[0]||y[1]-x[1])){
    const last=merged.at(-1);
    if(last&&a<last[1])last[1]=Math.max(last[1],b);
    else merged.push([a,b]);
  }
  for(const [a,b] of merged.reverse())protect(block,clean,a,b);
}

const context=document.createElement('canvas').getContext('2d');
const spaceWidths=new Map();
const roundingReserve=1/16;
function measureProse(block, measureLines=false) {
  const range=document.createRange(),characters=[];
  let index=0;
  for(const node of nodesOf(block)){
    const font=getComputedStyle(node.parentElement).font;
    if(!spaceWidths.has(font)){context.font=font;spaceWidths.set(font,context.measureText(' ').width);}
    let offset=0;
    for(const char of node.data){
      range.setStart(node,offset);offset+=char.length;range.setEnd(node,offset);
      const rect=[...range.getClientRects()].filter(x=>x.width>.02).at(-1);
      if(rect)characters.push({rect,space:/[ \u00a0]/u.test(char),unit:spaceWidths.get(font),index});
      index++;
    }
  }
  const same=(a,b)=>Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<Math.min(a.height,b.height)*.55;
  const lines=[];
  let limit=Infinity;
  for(let i=0;i<characters.length;i++){
    const {rect,space,unit,index}=characters[i];
    const previous=characters[i-1]?.rect,next=characters[i+1]?.rect;
    const gap=space&&unit&&previous&&next&&same(previous,rect)&&same(next,rect);
    if(gap){
      limit=Math.min(limit,unit*1.5-roundingReserve-Math.max(rect.width,next.left-previous.right));
      if(!measureLines&&limit<0)return {wide:true};
    }
    if(!measureLines)continue;
    let line=lines.at(-1);
    if(!line||!same(line.anchor,rect)){
      line={anchor:rect,right:rect.right,count:0,end:index};
      lines.push(line);
    }
    if(!space){
      line.right=Math.max(line.right,rect.right);
      line.end=index;
    }
    if(gap)line.count++;
  }
  return {wide:limit<0,lines,limit};
}

function extraSpacing(block, layout) {
  if(layout.lines.length<2||layout.wide||!Number.isFinite(layout.limit))return 0;
  const css=getComputedStyle(block);
  const edge=block.getBoundingClientRect().right-parseFloat(css.borderRightWidth)-parseFloat(css.paddingRight);
  const room=Math.min(...layout.lines.filter(line=>line.count).map(line=>(edge-line.right-roundingReserve)/line.count));
  return Math.max(0, Math.min(room,layout.limit));
}

function fitAtoms(block) {
  const style = getComputedStyle(block);
  const width = block.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  if (width <= 0) return;
  for (const span of block.querySelectorAll(atomic)) {
    if (span.closest('a[href^="mailto:"]') || span.matches('.typography-address,.address') || span.parentElement.closest(textBlocks)!==block) continue;
    span.classList.remove('guide-inline-scroll');
    const oversized = Math.max(span.getBoundingClientRect().width,span.scrollWidth) > width + .5;
    span.classList.toggle('guide-inline-scroll', oversized);
    if (oversized && !span.hasAttribute('tabindex')) { span.tabIndex=0; scrollTabStops.add(span); }
    else if (!oversized && scrollTabStops.has(span)) { span.removeAttribute('tabindex'); scrollTabStops.delete(span); }
  }
}


function clearExtraSpacing(block) {
  if(!block.style.getPropertyValue('--prose-extra-space'))return;
  block.style.removeProperty('--prose-extra-space');
  if(!block.style.length)block.removeAttribute('style');
}

const formatted=new WeakMap();
function refreshSpacing(candidates) {
  const changed=[];
  const fontsLoaded=document.fonts.status==='loaded';
  for(const block of candidates){
    if(!block.getClientRects().length||(!block.matches('summary')&&block.closest('details:not([open])')))continue;
    const key=block.getBoundingClientRect().width+'|'+devicePixelRatio+'|'+getComputedStyle(block).font+'|'+block.textContent;
    if(formatted.get(block)===key)continue;
    changed.push({block,key});
  }
  for(const {block} of changed){
    block.classList.remove('prose-justified');
    clearExtraSpacing(block);
    fitAtoms(block);
  }
  const eligible=fontsLoaded?changed.map(({block})=>block).filter(block=>
    block.matches('p,li')&&!block.closest('.home')&&!block.matches(':lang(th)')&&!block.querySelector('p,li')&&
    /^(start|left)$/.test(getComputedStyle(block).textAlign)):[];

  // Test browser justification before painting. Paragraphs with a wide gap
  // instead keep native line breaks and can use a bounded amount of spacing.
  for(const block of eligible)block.classList.add('prose-justified');
  const rejected=eligible.filter(block=>measureProse(block).wide);
  for(const block of rejected)block.classList.remove('prose-justified');

  const fallback=rejected.map(block=>{
    const layout=measureProse(block,true);
    return {block,layout,extra:extraSpacing(block,layout)};
  }).filter(({extra})=>extra>=.08);
  for(const {block,extra} of fallback)block.style.setProperty('--prose-extra-space',extra+'px');
  const rewrapped=fallback.filter(({block,layout})=>{
    const result=measureProse(block,true);
    return result.wide||result.lines.length!==layout.lines.length||
      result.lines.some((line,i)=>line.end!==layout.lines[i].end);
  });
  for(const {block} of rewrapped)clearExtraSpacing(block);
  if(fontsLoaded)for(const {block,key} of changed)formatted.set(block,key);
}
const checkSpacing=()=>refreshSpacing(blocks);

for(const block of blocks)prepare(block);
const observer=new ResizeObserver(entries=>{
  refreshSpacing(entries.map(entry=>entry.target));
});
for(const block of blocks)observer.observe(block,{box:'border-box'});
const visibility=new MutationObserver(checkSpacing);
for(const el of document.querySelectorAll('dialog,dialog [data-panel],dialog .legal-copy,#faq details')) {
  visibility.observe(el,{attributes:true,attributeFilter:['open','hidden']});
}
document.fonts.ready.then(checkSpacing);
document.fonts.addEventListener('loading',()=>{
  for(const block of blocks){
    block.classList.remove('prose-justified');
    clearExtraSpacing(block);
    formatted.delete(block);
  }
});
document.fonts.addEventListener('loadingdone',()=>{
  spaceWidths.clear();
  for(const block of blocks)formatted.delete(block);
  checkSpacing();
});
// Viewport geometry is already current here. Waiting for another animation
// frame would leave the previous width's justification active during reflow.
window.addEventListener('resize',checkSpacing);
for(const feature of ['horizontal-viewport-segments','vertical-viewport-segments']){
  matchMedia('('+feature+' > 1)').addEventListener('change',checkSpacing);
}
