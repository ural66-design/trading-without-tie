const atomic = '.protected-name,.keep-words,.long-word';
const controls = 'script,style,input,select,textarea,[contenteditable],p[role=status],[aria-hidden=true]';
const nameSeparator = '[\\s\\u00a0]*';
const names = /Fast[\s\u00a0]+Money[\s\u00a0]+Bot|MetaTrader[\s\u00a0]*4|Classic[\s\u00a0]+Pro|Markets4you|Vladimir1\.com|T[-‑]Capital|Myfxbook|Telegram(?:[-‑](?:бот|канал)[а-яё]*)?|YouTube|Google\s*\/\s*Facebook|Google|Facebook|Share4you|e-mail|\b(?:ID|IP)[-‑][\p{L}\p{M}]+|(?:стоп[-‑]лосс[\p{L}\p{M}]*|stop[-‑]loss(?:[-‑]nya)?|proof[-‑]of[-‑]address)/giu;
const number = '\\d+(?:[.,]\\d+)?';
const units = '(?:минут[а-яё]*|час[а-яё]*|секунд[а-яё]*|км|кг|мин\\.|minutes?|hours?|seconds?|km|kg|minutos?|horas?|segundos?|menit|minit|jam|dakika|saat|phút|giờ|นาที|ชั่วโมง|मिनट|घंट[ेा]|USD|EUR|USDT)';
const values = '[$€£]'+nameSeparator+number+'|'+number+nameSeparator+'%|\\d+\\s*[:–—−-]\\s*\\d+|'+number+nameSeparator+units+'(?![\\p{L}\\p{M}])';
// Export the same matchers used by the formatter for corpus and regression checks.
export const protectionRegistry = {
  brands: /Fast\s+Money\s+Bot|T[-‑]Capital|MetaTrader\s*4|Markets4you|Classic\s+Pro|Myfxbook|Vladimir1\.com|YouTube|Google\s*\/\s*Facebook|Google|Facebook|Share4you|Bot\s+Telegram|Telegram(?:\s+ID|[-‑](?:бот(?:а|е|у)?|канал(?:а|е|у)?))?/iu,
  terms: /стоп[-‑]лосс(?:ов|а|ом|е|ы)?|stop[-‑]loss(?:es|[-‑]nya)?|स्टॉप[-‑]लॉस|proof[-‑]of[-‑]address|e-mail|ID[-‑]карт[ауые]|IP[-‑]адрес(?:а|ов|е|ом)?/iu,
  values: new RegExp('[$€£]'+nameSeparator+number+'|'+number+nameSeparator+'(?:[%$€£]|руб\\.|'+units+')|'+number+'\\s*[:–—−-]\\s*'+number, 'iu')
};
const homeAtoms = new RegExp(names.source+'|'+values,'giu');
const wordEdge = '[\\p{L}\\p{M}\\p{N}_]';
const guideAtoms = new RegExp('(?<!'+wordEdge+')('+Object.values(protectionRegistry).map(r=>r.source).join('|')+')(?!'+wordEdge+')','giu');
const quotedText = /«[^»]+»|“[^”]+”|„[^“]+“|"[^"\n]+"/gu;
const compoundWord = /[\p{L}\p{M}\p{N}]+(?:[-‐‑][\p{L}\p{M}\p{N}]+)+/gu;

const language = document.documentElement.lang;
const segmenter = new Intl.Segmenter(language,{granularity:'word'});
const sentenceSegmenter = new Intl.Segmenter(language,{granularity:'sentence'});
const prose = 'main:not(.placeholder), dialog .legal-copy, dialog [data-panel=leader]';
const textBlocks = 'p,li,blockquote,figcaption,dd,td,h1,h2,h3,h4,h5,h6,summary,.button,.step-toggle';
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

function sentencePairs(text,home,control) {
  const starts=new Set([...sentenceSegmenter.segment(text)].slice(1).map(x=>x.index));
  if(!home)starts.add(0);
  // Quoted endings are not segmented uniformly in all engines.
  for(const m of text.matchAll(/(?:\.[»”"’')\]]*\s+|[!?।॥。！？][»”"’')\]]*\s*)(?=[¿¡«“„"‘'(\[]*[\p{Lu}\p{Script=Thai}\p{Script=Devanagari}])/gu)){
    starts.add(m.index+m[0].length);
  }
  if(!home)for(const m of text.matchAll(/…[»”"'’)\]]*\s+(?=[¿¡«“„"'(\[]*[\p{Lu}\p{Script=Thai}\p{Script=Devanagari}])/gu))starts.add(m.index+m[0].length);
  const abbrev=/(?:^|[^\p{L}])(?:т\.\s*[едкпнч]|г|ул|им|рис|стр|см|др|пр|мин|макс|руб|mr|mrs|ms|dr|prof|jr|sr|no|fig|vs|etc|e\.g|i\.e|p\. ej|p\. ex|srta|ud|dra|örn|bkz|vb|mis|dll|dsb|v\.v)\.$/iu;
  const words=[...segmenter.segment(text)].filter(x=>x.isWordLike),pairs=new Map();
  for(const start of starts){
    const previous=text.slice(0,start).trimEnd().replace(/[»”"’')\]]+$/u,'');
    if(start&&(!/[.!?…。।॥！？]$/u.test(previous)||abbrev.test(previous)||/(?:^|\s)\p{Lu}\.$/u.test(previous)))continue;
    const i=words.findIndex(w=>w.index>=start);
    if(i<0||i+1>=words.length)continue;
    const [first,next]=words.slice(i,i+2),size=(first.segment.normalize('NFC').match(/\p{L}/gu)||[]).length;
    if(!size||size>4||!/^\p{L}[\p{L}\p{M}]*$/u.test(first.segment)||!/\p{L}/u.test(next.segment))continue;
    if(!/^[\s¿¡«“„"‘'(\[]*$/u.test(text.slice(start,first.index)))continue;
    const separator=text.slice(first.index+first.segment.length,next.index);
    if(!/^\s*$/u.test(separator))continue;
    // Spaced text needs protection only through the existing separator.
    // In unspaced scripts include the next grapheme to cover the boundary.
    if(!separator&&!home&&!control)continue;
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
  const home=block.closest('.home');
  const hits=[...clean.text.matchAll(home?homeAtoms:guideAtoms)].map(m=>[m.index,m.index+m[0].length]);
  for (const [from,to] of quotes) {
    for (const word of segmenter.segment(clean.text.slice(from,to))) {
      if (word.isWordLike) hits.push([from+word.index, from+word.index+word.segment.length]);
    }
  }
  const sentences=block.matches('p,li,blockquote,figcaption,dd,td,summary,h1,h2,h3,h4,h5,h6')?sentencePairs(clean.text,home,block.matches('summary,button,.button')):[];
  // The approved home layout already forbids hyphenation within all words.
  if(home)hits.push(...sentences.map(({from,to})=>[from,to]));
  for(const m of clean.text.matchAll(compoundWord)){
    const end=m.index+m[0].length;
    if(home||clean.point(m.index)?.node.parentElement.closest(noHyphens)||quotes.some(([a,b])=>a<=m.index&&m.index<b)||
       (home&&hits.some(([a,b])=>a<end&&m.index<b)))hits.push([m.index,end]);
  }
  for(const e of home?block.querySelectorAll(atomic):[]){
    const segments=clean.segments.filter(x=>e.contains(x.node));
    if(!segments.length)continue;
    const from=segments[0].from,to=segments.at(-1).to;
    if(hits.some(([a,b])=>a<to&&from<b))hits.push([from,to]);
  }
  const merged=[];
  for(const [a,b] of hits.sort((x,y)=>x[0]-y[0]||y[1]-x[1])){
    const last=merged.at(-1);
    if(last&&a<last[1]){if(home)last[1]=Math.max(last[1],b);}
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

function lineLayout(pieces,start=0) {
  const range=document.createRange(),lines=[];
  for(let index=start;index<pieces.length;index++){
    const piece=pieces[index];
    range.setStart(piece.node,piece.start);
    range.setEnd(piece.node,piece.end);
    const fragments=[...range.getClientRects()].filter(rect=>rect.width>.02&&rect.height);
    for(const rect of fragments){
      const middle=(rect.top+rect.bottom)/2;
      let line=lines.at(-1);
      if(!line||Math.abs(line.middle-middle)>=Math.min(line.height,rect.height)*.5){
        line={middle,height:rect.height,left:Infinity,right:-Infinity,firstWord:-1,word:-1,fragment:0,gaps:[]};
        lines.push(line);
      }
      if(piece.space){
        line.gaps.push({piece,rect});
      }else if(piece.node.data.trim()){
        line.left=Math.min(line.left,rect.left);
        line.right=Math.max(line.right,rect.right);
        if(line.firstWord<0)line.firstWord=index;
        line.word=index;
        line.fragment=rect.width;
        line.split=fragments.length>1;
      }
    }
  }
  return lines.filter(line=>line.word>=0);
}

function planSpacing(block,pieces,retry=false,start=0) {
  const css=getComputedStyle(block);
  const box=block.getBoundingClientRect();
  const edge=box.right-parseFloat(css.borderRightWidth)-parseFloat(css.paddingRight);
  const width=edge-box.left-parseFloat(css.borderLeftWidth)-parseFloat(css.paddingLeft);
  const lines=lineLayout(pieces,start),changes=new Map();
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
  return {block,pieces,lines,changes,edge,width};
}

function sameEnding(a,b) {
  return a.word===b.word&&a.split===b.split&&(!a.split||Math.abs(a.fragment-b.fragment)<1.5);
}

function lastFragment(piece,line) {
  const value=piece.node.data.slice(piece.start,piece.end);
  const units=[...graphemes.segment(value)];
  const range=document.createRange();
  let from=0,to=units.length;
  while(from<to){
    const i=(from+to)>>1;
    const offset=piece.start+units[i].index;
    range.setStart(piece.node,offset);
    range.setEnd(piece.node,offset+units[i].segment.length);
    const box=range.getBoundingClientRect();
    if(box.top+box.height/2<line.middle-line.height*.5)from=i+1;
    else to=i;
  }
  return value.slice(units[from]?.index??value.length);
}

function ending({lines,pieces}) {
  if(lines.length<2)return {single:false,short:false};
  const last=lines.at(-1);
  if(last.gaps.some(({rect})=>rect.left>last.left&&rect.right<last.right))return {single:false,short:false};
  const first=pieces[last.firstWord];
  const previousWord=lines.at(-2).word;
  const splitPiece=previousWord===last.firstWord;
  const continuation=splitPiece;
  const piecesOnLast=pieces.slice(last.firstWord,last.word+1);
  const text=piecesOnLast.map((piece,i)=>i===0&&splitPiece?lastFragment(piece,last):piece.node.data.slice(piece.start,piece.end)).join('');
  let words=0,letters=0;
  for(const part of segmenter.segment(text)){
    if(!part.isWordLike)continue;
    if(++words>1)return {single:false,short:false};
    letters=(part.segment.normalize('NFC').match(/\p{L}/gu)||[]).length;
  }
  return {single:words===1,short:words===1&&continuation&&letters<4&&language!=='vi'&&
    /^[\p{Script=Latin}\p{Script=Cyrillic}\p{M}\p{P}]+$/u.test(text)&&
    !first.node.parentElement.closest(atomic+','+noHyphens+','+technicalLinks)};
}

function remainingGap(plan,line) {
  const extra=line.gaps.reduce((total,{piece})=>total+(parseFloat(plan.changes.get(piece))||0),0);
  return Math.max(0,plan.edge-line.right-extra);
}

function layoutScore(plan) {
  const gaps=plan.lines.slice(0,-1).map(line=>remainingGap(plan,line));
  let score=0;
  const limit=.15*plan.width;
  for(const gap of gaps)score+=gap+2*Math.max(0,gap-limit);
  return {score,worst:Math.max(0,...gaps),gaps};
}

const tailGaps=new WeakMap();

function resetTail(block) {
  const gap=tailGaps.get(block);
  if(!gap)return;
  gap.inserted[0].replaceWith(gap.original);
  for(const node of gap.inserted.slice(1))node.remove();
  tailGaps.delete(block);
}

function holdPiece({block,pieces},index,start,end) {
  const target=pieces[index],node=target.node;
  const span=document.createElement('span');
  span.style.whiteSpace='nowrap';
  span.textContent=node.data.slice(start,end);
  const inserted=[document.createTextNode(node.data.slice(0,start)),span,document.createTextNode(node.data.slice(end))];
  node.replaceWith(...inserted);
  tailGaps.set(block,{original:node,inserted});
  return pieces.map(piece=>{
    if(piece.node!==node)return piece;
    if(piece===target)return {...piece,node:span.firstChild,start:0,end:end-start};
    if(piece.end<=start)return {...piece,node:inserted[0]};
    return {...piece,node:inserted[2],start:piece.start-end,end:piece.end-end};
  });
}

function betterEnding(plan,next,row,original) {
  if(!next.lines.length||next.lines.length>plan.lines.length||
    next.lines.some(line=>line.right>next.edge+.5))return false;
  if(!plan.lines.slice(0,row).every((line,i)=>next.lines[i]&&sameEnding(line,next.lines[i])))return false;
  const after=ending(next);
  if(after.short&&!original.short)return false;
  const beforeScore=layoutScore(plan),afterScore=layoutScore(next);
  const limit=Math.max(.15*plan.width,beforeScore.worst+.03*plan.width);
  const repairedShort=original.short&&!after.short;
  if(afterScore.worst>limit)return false;
  if(repairedShort&&afterScore.gaps.some((gap,i)=>gap>beforeScore.gaps[i]+.02*plan.width))return false;
  const cost=afterScore.score-beforeScore.score-(plan.lines.length-next.lines.length)*.1*plan.width;
  if(cost<-.5)return true;
  return repairedShort&&cost<=.17*plan.width;
}

function trialBoundaries(plan,original,quality) {
  const rows=plan.lines;
  if(rows.length<2)return [];
  const last=rows.length-1;
  const worst=quality.gaps.indexOf(quality.worst)+1;
  // Restrict the search to two plausible local changes.
  const indices=original.single?[last,Math.max(1,last-1)]:[worst];
  const boundaries=[...new Set(indices)].flatMap(i=>{
    const first=rows[i].firstWord;
    if(rows[i-1].word===first&&!original.short)return [];
    const index=first-1;
    const gap=plan.pieces[index];
    if(!gap?.space||gap.node.parentElement.closest(atomic))return [];
    return [{index,start:gap.start,end:gap.end,row:Math.max(0,i-2)}];
  });
  return boundaries;
}

function improveEndings(plans) {
  let pending=[];
  for(const [index,plan] of plans.entries()){
    // Contact links may wrap internally as an emergency fallback. Do not force them
    // onto the previous line using a temporary join elsewhere in the paragraph.
    if(plan.lines.length<2||plan.block.querySelector(technicalLinks+',.typography-address,.address'))continue;
    const original=ending(plan),quality=layoutScore(plan);
    if(!original.short&&quality.worst<.15*plan.width)continue;
    const boundaries=trialBoundaries(plan,original,quality);
    if(boundaries.length)pending.push({index,plan,original,boundaries});
  }
  for(let attempt=0;attempt<2&&pending.length;attempt++){
    const trials=pending.flatMap(entry=>{
      const boundary=entry.boundaries[attempt];
      if(!boundary)return [];
      const pieces=holdPiece(entry.plan,boundary.index,boundary.start,boundary.end);
      return [{...entry,boundary,pieces}];
    });
    pending=[];
    for(const {index,plan,original,boundaries,boundary,pieces} of trials){
      let row=boundary.row;
      // Validate a short suffix window first. Earlier rows are retained in the full check.
      while(row>0&&plan.lines[row-1].word===plan.lines[row].firstWord)row--;
      if(row){
        const tail=planSpacing(plan.block,pieces,false,plan.lines[row].firstWord);
        if(!betterEnding({...plan,lines:plan.lines.slice(row)},tail,0,original)){
          pending.push({index,plan,original,boundaries});
          continue;
        }
      }
      const next=planSpacing(plan.block,pieces);
      if(betterEnding(plan,next,row,original))plans[index]=next;
      else pending.push({index,plan,original,boundaries});
    }
    for(const {plan:{block}} of pending)resetTail(block);
  }
  return plans;
}

function preservesLines(plan) {
  const after=lineLayout(plan.pieces);
  return plan.lines.length===after.length&&after.every((line,i)=>
    sameEnding(line,plan.lines[i])&&
    line.gaps.every(({piece,rect})=>!piece.normal||rect.width<=1.5*piece.normal+.001));
}

function fitAtoms(blocksToFit) {
  const atoms = [];
  for (const {block} of blocksToFit) {
    const style = getComputedStyle(block);
    const width = block.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    if (width <= 0) continue;
    for (const span of block.querySelectorAll(atomic)) {
      if (span.closest('a[href^="mailto:"]') || span.matches('.typography-address,.address') || span.parentElement.closest(textBlocks)!==block) continue;
      atoms.push({span,width});
    }
  }
  for (const {span} of atoms) {
    if (span.classList.contains('guide-inline-scroll')) span.classList.remove('guide-inline-scroll');
  }
  const oversizedAtoms = atoms.map(({span,width}) => Math.max(span.getBoundingClientRect().width,span.scrollWidth) > width + .5);
  atoms.forEach(({span},index) => {
    const oversized = oversizedAtoms[index];
    span.classList.toggle('guide-inline-scroll', oversized);
    if (oversized && !span.hasAttribute('tabindex')) { span.tabIndex=0; scrollTabStops.add(span); }
    else if (!oversized && scrollTabStops.has(span)) { span.removeAttribute('tabindex'); scrollTabStops.delete(span); }
  });
}


// Keep the original Text nodes so each resize starts with native line breaking.
let formatted=new WeakMap();
const applied=new WeakMap(),deferred=new Set();
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
  applied.set(block,records);
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
  block.classList.add('prose-line-spaced');
}

function refreshSpacing(candidates) {
  const pending=[],selection=document.getSelection();
  const selected=selection&&!selection.isCollapsed&&selection.rangeCount?selection.getRangeAt(0):null;
  const fontsLoaded=document.fonts.status==='loaded';
  const visible=[...candidates].filter(block=>{
    const scope=block.matches('summary')?block.parentElement.parentElement:block;
    return !scope?.closest('details:not([open])')&&block.getClientRects().length;
  });
  for(const block of visible){
    if(!prepared.has(block)&&!selected?.intersectsNode(block))prepare(block);
  }
  for(const block of visible){
    const css=getComputedStyle(block);
    const key=block.getBoundingClientRect().width+'|'+devicePixelRatio+'|'+css.font+'|'+block.textContent;
    if(formatted.get(block)===key)continue;
    if(selected?.intersectsNode(block)){
      hideSpacing(block);
      deferred.add(block);
      continue;
    }
    deferred.delete(block);
    const eligible=fontsLoaded&&block.matches('p,li,blockquote,figcaption,dd,td')&&!block.closest('.home,nav,form,button,code,pre')&&!block.matches(':lang(th)')&&
      !block.querySelector('p,li,blockquote,figcaption,dd,td')&&/^(start|left)$/.test(css.textAlign);
    pending.push({block,key,eligible});
  }
  for(const {block} of pending){
    if(applied.has(block))restoreSpacing(block);
    resetTail(block);
  }
  fitAtoms(pending);
  const layouts=pending.filter(({eligible})=>eligible).map(({block})=>planSpacing(block,textPieces(block)));
  const plans=improveEndings(layouts).filter(plan=>plan.changes.size);
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
// Roll back reversible layout trials if a measurement fails mid-pass.
function safelyRefresh(candidates) {
  try {
    refreshSpacing(candidates);
  } catch (error) {
    for(const block of candidates){
      if(applied.has(block))restoreSpacing(block);
      resetTail(block);
      formatted.delete(block);
    }
    console.error(error);
  }
}
const initialized=Symbol.for('vladimir1.prose-spacing');
if(!document[initialized]){
  document[initialized]=true;
  const registered=new Set(blocks),queued=new Set(),widths=new WeakMap();
  let frame, all=false, idle, nextToPrepare=0, lastScroll=-Infinity;

  function queue(candidates){
    if(candidates)for(const block of candidates)queued.add(block);
    else all=true;
    if(frame!==undefined)return;
    frame=requestAnimationFrame(()=>{
      frame=undefined;
      const pending=all?blocks:[...queued];
      all=false;
      queued.clear();
      safelyRefresh(pending);
    });
  }

  function warmHidden(){
    if(idle!==undefined||nextToPrepare>=blocks.length)return;
    idle=setTimeout(()=>{
      const run=deadline=>{
        idle=undefined;
        if(frame===undefined&&performance.now()-lastScroll>=200){
          const end=performance.now()+6;
          while(nextToPrepare<blocks.length&&performance.now()<end&&deadline.timeRemaining()>1){
            const block=blocks[nextToPrepare++];
            if(!prepared.has(block))prepare(block);
          }
        }
        warmHidden();
      };
      if('requestIdleCallback' in window)idle=requestIdleCallback(run);
      else run({timeRemaining:()=>6});
    },100);
  }

  document.addEventListener('selectionchange',()=>{
    if(deferred.size&&document.getSelection()?.isCollapsed)queue(deferred);
  });
  const observer=new ResizeObserver(entries=>{
    const changed=[];
    for(const {target,borderBoxSize,contentRect} of entries){
      const width=borderBoxSize?.[0]?.inlineSize??contentRect.width;
      if(width&&widths.get(target)!==width)changed.push(target);
      widths.set(target,width);
    }
    if(changed.length)queue(changed);
  });
  for(const block of blocks)observer.observe(block,{box:'border-box'});
  const visibility=new MutationObserver(records=>{
    const shown=new Set();
    for(const {target} of records){
      if(target.hidden||target.matches('details:not([open]),dialog:not([open])'))continue;
      for(const block of target.querySelectorAll(textBlocks))if(registered.has(block))shown.add(block);
    }
    if(shown.size)queue(shown);
  });
  for(const el of document.querySelectorAll('dialog,dialog [data-panel],dialog .legal-copy,#faq details,.step-content,#completion')) {
    visibility.observe(el,{attributes:true,attributeFilter:['open','hidden']});
  }
  queue();
  warmHidden();
  document.fonts.ready.then(()=>queue());
  document.fonts.addEventListener('loading',()=>{
    for(const block of document.querySelectorAll('.prose-line-spaced'))hideSpacing(block);
    formatted=new WeakMap();
  });
  function refreshFonts(){
    spaceWidths.clear();
    formatted=new WeakMap();
    queue();
  }
  document.fonts.addEventListener('loadingdone',refreshFonts);
  document.fonts.addEventListener('loadingerror',refreshFonts);
  window.addEventListener('scroll',()=>{lastScroll=performance.now();},{passive:true});
  let viewportWidth=document.documentElement.clientWidth, pixelRatio=devicePixelRatio;
  window.addEventListener('resize',()=>{
    const width=document.documentElement.clientWidth, ratio=devicePixelRatio;
    if(width===viewportWidth&&ratio===pixelRatio)return;
    viewportWidth=width;
    pixelRatio=ratio;
    queue();
  });
  for(const feature of ['horizontal-viewport-segments','vertical-viewport-segments']){
    matchMedia('('+feature+' > 1)').addEventListener('change',()=>queue());
  }
}
