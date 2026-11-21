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
      if(node.data[i]==='\u00ad'||node.data[i]==='\u2060')continue;
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

const graphemes = new Intl.Segmenter(language);

function sentencePairs(text) {
  const starts=new Set([...sentenceSegmenter.segment(text)].slice(1).map(x=>x.index));
  // Quoted endings are not segmented uniformly in all engines.
  for(const m of text.matchAll(/(?:\.[»”"’')\]]*\s+|[!?।॥。！？][»”"’')\]]*\s*)(?=[«“„"‘'(\[]*[\p{Lu}\p{Script=Thai}\p{Script=Devanagari}])/gu)){
    starts.add(m.index+m[0].length);
  }
  const abbrev=/(?:^|[^\p{L}])(?:т\.\s*[едкпнч]|г|ул|им|рис|стр|см|др|пр|мин|макс|руб|mr|mrs|ms|dr|prof|jr|sr|no|fig|vs|etc|e\.g|i\.e|p\. ej|p\. ex|srta|ud|dra|örn|bkz|vb|mis|dll|dsb|v\.v)\.$/iu;
  const words=[...segmenter.segment(text)].filter(x=>x.isWordLike),pairs=new Map();
  for(const start of starts){
    const previous=text.slice(0,start).trimEnd().replace(/[»”"’')\]]+$/u,'');
    if(!/[.!?।॥。！？]$/u.test(previous)||abbrev.test(previous)||/(?:^|\s)\p{Lu}\.$/u.test(previous))continue;
    const i=words.findIndex(w=>w.index>=start);
    if(i<0||i+1>=words.length)continue;
    const [first,next]=words.slice(i,i+2),size=(first.segment.normalize('NFC').match(/\p{L}/gu)||[]).length;
    if(!size||size>4||!/^\p{L}[\p{L}\p{M}]*$/u.test(first.segment)||!/\p{L}/u.test(next.segment))continue;
    if(!/^[\s«“„"‘'(\[]*$/u.test(text.slice(start,first.index)))continue;
    const separator=text.slice(first.index+first.segment.length,next.index);
    if(!/^\s*$/u.test(separator))continue;
    // Spaced text needs protection only through the existing separator.
    // In unspaced scripts include the next grapheme to cover the boundary.
    const boundary=next.index+(separator?0:graphemes.segment(next.segment).containing(0).segment.length);
    pairs.set(first.index,{from:first.index,boundary,to:next.index+next.segment.length});
  }
  return [...pairs.values()];
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

function protectSentenceStart(map,from,boundary) {
  // Wrap only text within each original element, so links and their handlers stay in place.
  for(const part of map.segments){
    const start=Math.max(from,part.from),end=Math.min(boundary,part.to);
    if(start>=end||part.node.parentElement.closest(atomic))continue;
    const range=document.createRange();
    range.setStart(part.node,part.offsets[start-part.from]);
    range.setEnd(part.node,part.offsets[end-part.from-1]+1);
    const span=document.createElement('span');
    span.className='sentence-lead';
    range.surroundContents(span);
  }
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
  const sentences=block.matches('p,li,summary,h1,h2,h3,h4,h5,h6')?sentencePairs(clean.text):[];
  const home=block.closest('.home');
  // The approved home layout already forbids hyphenation within all words.
  if(home)hits.push(...sentences.map(({from,to})=>[from,to]));
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
  if(sentences.length&&!home){
    const map=textMap(nodesOf(block));
    // Work backwards to keep offsets in earlier parts of the same Text node valid.
    for(const {from,boundary} of sentences.sort((a,b)=>b.from-a.from))protectSentenceStart(map,from,boundary);
  }
}

const context=document.createElement('canvas').getContext('2d');
const spaceWidths=new Map();
const lineReserve=.25;
const spaceReserve=1/16;

function textPieces(block) {
  return nodesOf(block).flatMap(node=>{
    const fontSpace=node.parentElement.closest('.guide-inline-scroll')?0:normalSpace(node.parentElement);
    const parts=[];
    for(const match of node.data.matchAll(/ +|[^ ]+/g)){
      const start=match.index,end=start+match[0].length;
      parts.push({node,start,end,space:match[0][0]===' ',normal:fontSpace});
    }
    return parts;
  });
}

function normalSpace(element) {
  const font=getComputedStyle(element).font;
  if(!spaceWidths.has(font)){
    context.font=font;
    spaceWidths.set(font,context.measureText(' ').width);
  }
  return spaceWidths.get(font);
}

function lineLayout(pieces) {
  const range=document.createRange(),lines=[];
  for(const [index,piece] of pieces.entries()){
    range.setStart(piece.node,piece.start);
    range.setEnd(piece.node,piece.end);
    const fragments=[...range.getClientRects()].filter(rect=>rect.width>.02&&rect.height);
    for(const rect of fragments){
      const middle=(rect.top+rect.bottom)/2;
      let line=lines.at(-1);
      if(!line||Math.abs(line.middle-middle)>=Math.min(line.height,rect.height)*.5){
        line={middle,height:rect.height,left:Infinity,right:-Infinity,word:-1,fragment:0,gaps:[]};
        lines.push(line);
      }
      if(piece.space){
        line.gaps.push({piece,rect});
      }else if(piece.node.data.trim()){
        line.left=Math.min(line.left,rect.left);
        line.right=Math.max(line.right,rect.right);
        line.word=index;
        line.fragment=rect.width;
        line.split=fragments.length>1;
      }
    }
  }
  return lines.filter(line=>line.word>=0);
}

function planSpacing(block,pieces,retry=false) {
  const css=getComputedStyle(block);
  const edge=block.getBoundingClientRect().right-parseFloat(css.borderRightWidth)-parseFloat(css.paddingRight);
  const lines=lineLayout(pieces),changes=new Map();
  for(const line of lines.slice(0,-1)){
    const slack=edge-line.right-(retry?3:lineReserve);
    if(slack<=0)continue;
    const gaps=line.gaps.filter(({rect})=>rect.left>line.left&&rect.right<line.right);
    const room=gaps.map(({piece,rect})=>Math.max(0,piece.normal*1.5-rect.width-(retry ? .1875 : spaceReserve)));
    const total=room.reduce((sum,value)=>sum+value,0);
    if(!total)continue;
    const share=Math.min(1,slack/total);
    for(const [index,{piece}] of gaps.entries()){
      const pixels=Math.floor(64*room[index]*share)/64;
      if(pixels>0)changes.set(piece,pixels+'px');
    }
  }
  return {block,pieces,lines,changes};
}

function preservesLines(plan) {
  const after=lineLayout(plan.pieces);
  return plan.lines.length===after.length&&after.every((line,i)=>
    line.word===plan.lines[i].word&&line.split===plan.lines[i].split&&
    (!line.split||Math.abs(line.fragment-plan.lines[i].fragment)<1.5)&&
    line.gaps.every(({piece,rect})=>!piece.normal||rect.width<=1.5*piece.normal+.001));
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


// Keep the original Text nodes so each resize starts with native line breaking.
const formatted=new WeakMap(),applied=new WeakMap(),deferred=new Set();
function hideSpacing(block) {
  if(!block.classList.contains('prose-line-spaced'))return;
  block.classList.remove('prose-line-spaced');
  if(!block.classList.length)block.removeAttribute('class');
}

function restoreSpacing(block) {
  hideSpacing(block);
  for(const {original,inserted} of applied.get(block)??[]){
    inserted[0].replaceWith(original);
    for(const node of inserted.slice(1))node.remove();
  }
  applied.delete(block);
}

function applySpacing({block,pieces,changes}) {
  const records=[];
  for(let i=0;i<pieces.length;){
    const original=pieces[i].node;
    let j=i+1;
    while(j<pieces.length&&pieces[j].node===original)j++;
    const group=pieces.slice(i,j);
    i=j;
    if(!group.some(piece=>changes.has(piece)))continue;
    const fragment=document.createDocumentFragment();
    const inserted=[];
    for(let k=0;k<group.length;){
      const first=group[k],extra=changes.get(first);
      let next=k+1;
      if(!extra)while(next<group.length&&!changes.has(group[next]))next++;
      const offset=first.start;
      const text=document.createTextNode(original.data.slice(offset,group[next-1].end));
      let inline=text;
      if(extra){
        inline=document.createElement('span');
        inline.className='prose-space';
        inline.style.setProperty('--prose-gap',extra);
        inline.append(text);
      }
      fragment.append(inline);
      inserted.push(inline);
      for(const piece of group.slice(k,next)){
        piece.node=text;
        piece.start-=offset;
        piece.end-=offset;
      }
      k=next;
    }
    original.replaceWith(fragment);
    records.push({original,inserted});
  }
  applied.set(block,records);
  block.classList.add('prose-line-spaced');
}

function refreshSpacing(candidates) {
  const pending=[],selection=document.getSelection();
  const selected=selection&&!selection.isCollapsed&&selection.rangeCount?selection.getRangeAt(0):null;
  const fontsLoaded=document.fonts.status==='loaded';
  for(const block of candidates){
    if(!block.getClientRects().length||(!block.matches('summary')&&block.closest('details:not([open])')))continue;
    const css=getComputedStyle(block);
    const key=block.getBoundingClientRect().width+'|'+devicePixelRatio+'|'+css.font+'|'+block.textContent;
    if(formatted.get(block)===key)continue;
    if(selected?.intersectsNode(block)){
      hideSpacing(block);
      deferred.add(block);
      continue;
    }
    deferred.delete(block);
    const eligible=fontsLoaded&&block.matches('p,li')&&!block.closest('.home')&&!block.matches(':lang(th)')&&
      !block.querySelector('p,li')&&/^(start|left)$/.test(css.textAlign);
    pending.push({block,key,eligible});
  }
  for(const {block} of pending)if(applied.has(block))restoreSpacing(block);
  for(const {block} of pending)fitAtoms(block);
  const plans=pending.filter(({eligible})=>eligible)
    .map(({block})=>planSpacing(block,textPieces(block))).filter(plan=>plan.changes.size);
  for(const plan of plans)applySpacing(plan);
  const rejected=plans.filter(plan=>!preservesLines(plan));
  for(const {block} of rejected)restoreSpacing(block);
  // When engine rounding changes a break, retry with more room at the edge.
  const retried=rejected.map(({block})=>planSpacing(block,textPieces(block),true)).filter(plan=>plan.changes.size);
  for(const plan of retried)applySpacing(plan);
  const unsafe=retried.filter(plan=>!preservesLines(plan));
  for(const {block} of unsafe)restoreSpacing(block);
  if(fontsLoaded)for(const {block,key} of pending)formatted.set(block,key);
}
const checkSpacing=()=>refreshSpacing(blocks);

const initialized=Symbol.for('vladimir1.prose-spacing');
if(!document[initialized]){
  document[initialized]=true;
  document.addEventListener('selectionchange',()=>{
    if(deferred.size&&document.getSelection()?.isCollapsed)refreshSpacing([...deferred]);
  });
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
      hideSpacing(block);
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
}
