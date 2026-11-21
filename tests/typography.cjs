
/*
 * Browser regressions for the static site. Install Playwright and its engines
 * separately. PLAYWRIGHT_MODULE and CHROME_EXECUTABLE can select local installs.
 * Run from this repository: node tests/typography.cjs
 * TYPO_ENGINES and TYPO_REPORT select engines and a JSON report outside site/.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),origin='https://www.vladimir1.com';
const languages=['ru','en','es','pt-BR','tr','fil','id','ms','th','vi','hi'];
const routes=['','t-capital/','fast-money-bot/','t-capital/instruction/','fast-money-bot/instruction/','legal/','privacy/','risks/'];
const mime={html:'text/html',js:'text/javascript',css:'text/css',woff2:'font/woff2',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',webp:'image/webp'};
function measure(input){
 const lang=document.documentElement.lang,range=document.createRange(),ctx=document.createElement('canvas').getContext('2d');
 const wordSeg=new Intl.Segmenter(lang,{granularity:'word'}),sentSeg=new Intl.Segmenter(lang,{granularity:'sentence'}),letter=/\p{L}/u;
 const home=document.body.classList.contains('home');
 const pick='main :is(p,li,h1,h2,h3,h4,h5,h6,summary), dialog :is(p,li,h2,h3,summary)'+(home?', main .button':'');
 const all=[...document.querySelectorAll(pick)],issues=[],latent=[],stats={blocks:0,words:0,sentences:0,bound:0,gaps:0,rows:0,hyphen:0,soft:0,auto:0,hard:0,fragment:0,maxStreak:0,justifyBlocks:0,wrapStart:0};
 const normal=new Map(),getWidth=f=>{if(!normal.has(f)){ctx.font=f;normal.set(f,ctx.measureText(' ').width);}return normal.get(f);};
 const unit='(?:минут[а-яё]*|час[а-яё]*|секунд[а-яё]*|км|кг|minutes?|hours?|seconds?|km|kg|minutos?|horas?|segundos?|menit|minit|jam|dakika|saat|phút|giờ|นาที|ชั่วโมง|मिनट|घंट[ेा]|USD|EUR|USDT)';
 const atom=new RegExp('Fast\\s+Money\\s+Bot|MetaTrader\\s*4|Classic\\s+Pro|Markets4you|Vladimir1\\.com|T[-‑]Capital|Myfxbook|Telegram(?:[-‑](?:бот|канал)[а-яё]*)?|YouTube|Google\\s*/\\s*Facebook|Google|Facebook|Share4you|(?:ID|IP)[-‑][\\p{L}\\p{M}]+|стоп[-‑]лосс[\\p{L}\\p{M}]*|stop[-‑]loss(?:[-‑]nya)?|proof[-‑]of[-‑]address|[$€£]\\s*\\d+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?\\s*%|\\d+\\s*[:–—−-]\\s*\\d+|\\d+(?:[.,]\\d+)?\\s*'+unit,'giu');
 const quote=/«[^»]+»|“[^”]+”|„[^“]+“|"[^"\n]+"/gu;
 const abbrev=/(?:^|[^\p{L}])(?:т\.\s*[едкпнч]|г|ул|им|рис|стр|см|др|пр|мин|макс|руб|mr|mrs|ms|dr|prof|jr|sr|no|fig|vs|etc|e\.g|i\.e|p\. ej|p\. ex|srta|ud|dra|örn|bkz|vb|mis|dll|dsb|v\.v)\.$/iu;
 const same=(a,b)=>a&&b&&Math.abs(a.mid-b.mid)<Math.min(a.height,b.height)*.55;
 const nodePath=n=>n?.parentElement?.closest('.protected-name,.keep-words,a,strong,b')?.className||n?.parentElement?.tagName||'';
 const summary=[];
 for(const [bi,e] of all.entries()){
  if(e.closest('details:not([open])')&&!e.matches('summary, summary *'))continue;
  if(!e.getClientRects().length||getComputedStyle(e).visibility==='hidden')continue;
  let text='';const nodes=[];const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
  for(let n=w.nextNode();n;n=w.nextNode()){
   if(n.parentElement.closest('script,style,[aria-hidden=true]')||n.parentElement.closest(pick)!==e||!n.parentElement.getClientRects().length)continue;
   nodes.push({node:n,start:text.length,end:text.length+n.length,font:getComputedStyle(n.parentElement).font});text+=n.data;
  }
  if(!text.trim())continue;
  const locate=i=>nodes.find(x=>x.start<=i&&i<x.end),cache=new Map();
  function rect(i){if(cache.has(i))return cache.get(i);const d=locate(i);if(!d)return null;const n=d.node,o=i-d.start;range.setStart(n,o);range.setEnd(n,Math.min(n.length,o+(n.data.codePointAt(o)>65535?2:1)));const r=[...range.getClientRects()].filter(x=>x.width>.02&&x.height>0).at(-1);const result=r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,mid:(r.top+r.bottom)/2,width:r.width,font:d.font}:null;cache.set(i,result);return result;}
  const y=r=>r?+(r.top+scrollY).toFixed(2):null;
  const style=getComputedStyle(e),mode=style.textAlign;
  stats.blocks++;if(mode==='justify')stats.justifyBlocks++;
  const ref={bi,tag:e.tagName,part:e.parentElement.className,mode,hyphens:style.hyphens||style.webkitHyphens,text:text.replace(/\u00ad/g,'')};
  const rows=[];const tails=new Map();const parts=new Set(),lineOf=r=>{let i=rows.findIndex(x=>same(x,r));if(i<0){i=rows.length;rows.push(r);}return i;};
  for(let i=0;i<text.length;){const c=String.fromCodePoint(text.codePointAt(i)),r=rect(i);if(r&&/[\p{L}\p{N}]/u.test(c))lineOf(r);i+=c.length;}
  rows.sort((a,b)=>a.mid-b.mid);stats.rows+=rows.length;
  const tokens=[...wordSeg.segment(text)].filter(t=>t.isWordLike);
  const letters=t=>[...t.segment.matchAll(/\p{L}/gu)].map(m=>t.index+m.index);
  stats.words+=tokens.length;
  for(const t of tokens){const ids=letters(t);if(ids.length<2)continue;let prev=ids[0],a=rect(prev);
   for(const i of ids.slice(1)){const b=rect(i);if(a&&b&&!same(a,b)&&b.top>a.top+2){
    const soft=text.slice(prev+1,i).includes('\u00ad');const reason=soft?'soft':'auto';stats[reason]++;stats.hyphen++;
    if(home&&(lang!=='th'||soft))issues.push({rule:'home-word',...ref,example:t.segment.replace(/\u00ad/g,''),y:y(a),yNext:y(b)});
    const k=rows.findIndex(z=>same(z,a));if(k>=0)tails.set(k,reason);
    const firstHalf=ids.filter(j=>j<i&&same(rect(j),a)).length,secondHalf=ids.filter(j=>j>=i&&same(rect(j),b)).length;
    if(firstHalf<3||secondHalf<3){stats.fragment++;if(soft||lang!=='th')parts.add(t.segment.replace(/\u00ad/g,''));}
    const p=locate(prev)?.node.parentElement;if(p?.closest('strong,b,h1,h2,h3,h4,h5,h6,.protected-name,.keep-words')&&!p.closest('a[href^="mailto:"],.typography-address,.address'))issues.push({rule:'protected-word',...ref,example:t.segment.replace(/\u00ad/g,''),y:y(a),yNext:y(b),source:reason});
   }if(b){a=b;prev=i;}}
  }
  const plain=text.replace(/\u00ad/g,'');const translate=[];for(let i=0;i<text.length;i++)if(text[i]!=='\u00ad')translate.push(i);
  for(const m of plain.matchAll(/[\p{L}\p{M}]+(?:[-‐‑][\p{L}\p{M}]+)+/gu)){const start=translate[m.index],end=translate[m.index+m[0].length-1],p=locate(start)?.node.parentElement;const aa=rect(start),bb=rect(end);if(!aa||!bb||same(aa,bb))continue;

   const rigid=p?.closest('strong,b,h1,h2,h3,h4,h5,h6,.protected-name,.keep-words');
   if(home)issues.push({rule:'home-compound',...ref,example:m[0],y:y(aa),yNext:y(bb)});
   if(rigid||[...plain.matchAll(quote)].some(q=>q.index<=m.index&&q.index+q[0].length>m.index))issues.push({rule:'protected-compound',...ref,example:m[0],y:y(aa),yNext:y(bb)});
   for(const h of m[0].matchAll(/[-‐‑]/gu)){const i=translate[m.index+h.index],j=translate[m.index+h.index+1],a=rect(i),b=rect(j);if(a&&b&&!same(a,b)){stats.hard++;const k=rows.findIndex(z=>same(z,a));if(k>=0)tails.set(k,'hard');}}
  }
  for(const m of plain.matchAll(atom)){const indices=[...m[0].matchAll(/[\p{L}\p{N}$€£%]/gu)].map(x=>translate[m.index+x.index]);if(indices.length<2)continue;const a=rect(indices[0]),b=rect(indices.at(-1));if(a&&b&&!same(a,b))issues.push({rule:'protected-atom',...ref,example:m[0],y:y(a),yNext:y(b),firstParent:nodePath(locate(indices[0])?.node),lastParent:nodePath(locate(indices.at(-1))?.node)});}
  for(const p of e.querySelectorAll('.protected-name,.keep-words')){if(p.parentElement.closest(pick)!==e||p.matches('.typography-address,.address')||p.closest('a[href^="mailto:"]'))continue;const rr=[...p.getClientRects()].filter(x=>x.width>.02);if(rr.length>1&&rr.some(r=>Math.abs((r.top+r.bottom-rr[0].top-rr[0].bottom)/2)>Math.min(r.height,rr[0].height)*.55))issues.push({rule:'static-atom',...ref,example:p.textContent,y:+(rr[0].top+scrollY).toFixed(2)});}
  const starts=new Map([...sentSeg.segment(text)].slice(1).map(s=>[s.index,'Intl']));
  for(const m of text.matchAll(/[.!?।॥。！？][»”"’')\]]*[\s\u2060]*(?=[«“„"‘'(\[]*[\p{Lu}\p{Script=Thai}\p{Script=Devanagari}])/gu)){const at=m.index+m[0].length;if(!starts.has(at))starts.set(at,'punctuation');}
  const eligible=[];
  for(const [pi,source] of starts){
   const head=text.slice(0,pi).trimEnd().replace(/[»”"’')\]]+$/u,'');
   if(!/[.!?।॥。！？]$/u.test(head)||abbrev.test(head)||/(?:^|\s)\p{Lu}\.$/u.test(head))continue;
   const ix=tokens.findIndex(t=>t.index>=pi&&letter.test(t.segment));if(ix<0||ix+1>=tokens.length||!letter.test(tokens[ix+1].segment))continue;
   const [a,b]=tokens.slice(ix,ix+2);if(!/^[\s«“„"'‘(\[]*$/u.test(text.slice(pi,a.index)))continue;
   const count=(a.segment.normalize('NFC').match(/\p{L}/gu)||[]).length;
   const gap=text.slice(a.index+a.segment.length,b.index);if(!/^[\s\u2060]*$/u.test(gap))continue;
   const last=letters(a).at(-1),next=letters(b)[0],r=rect(last),v=rect(next);if(!r||!v)continue;
   if(count<1||count>4)continue;
   const k=a.index;if(eligible.some(x=>x.k===k))continue;eligible.push({k,end:a.index+a.segment.length});
   stats.sentences++;const protectedGap=/[\u00a0\u2060]/u.test(gap);if(protectedGap)stats.bound++;
   if(!same(r,v))issues.push({rule:'sentence',...ref,example:a.segment+' / '+b.segment,count,y:y(r),yNext:y(v),gap:gap.codePointAt(0),segmentation:source,context:text.slice(Math.max(0,a.index-38),b.index+b.segment.length+25).replace(/\u00ad/g,'')});
   else if(letters(b).at(-1)!==next&&!same(r,rect(letters(b).at(-1))))issues.push({rule:'sentence-next-continues',...ref,example:a.segment+' '+b.segment,y:y(r),yNext:y(rect(letters(b).at(-1)))});
   else if(!protectedGap)latent.push({bi,example:a.segment+' '+b.segment,context:text.slice(Math.max(0,a.index-25),b.index+b.segment.length).replace(/\u00ad/g,'')});
  }
  // Measure the actual blank between measured adjacent non-space glyph boxes on the same line.
  for(const m of text.matchAll(/[ \u00a0]+/gu)){const i=m.index,j=i+m[0].length;if(i===0||j>=text.length)continue;
   let pi=i-1,ni=j;while(pi>=0&&/[\u00ad\u2060]/u.test(text[pi]))pi--;while(ni<text.length&&/[\u00ad\u2060]/u.test(text[ni]))ni++;
   const a=rect(pi),b=rect(ni),sr=rect(i);if(!same(a,b)||!same(a,sr))continue;
   const px=b.left-a.right,standard=getWidth(sr.font);if(px<.05||!standard)continue;stats.gaps++;
   if(px>standard*1.5+.001){const line=rows.findIndex(z=>same(z,a));issues.push({rule:'space',...ref,line,left:text.slice(Math.max(0,i-22),i),right:text.slice(j,j+22),space:+sr.width.toFixed(3),gap:+px.toFixed(3),standard:+standard.toFixed(3),ratio:+(px/standard).toFixed(3),font:sr.font,y:y(a)});}
  }
  let streak=0,max=0;for(let i=0;i<rows.length;i++){streak=tails.has(i)?streak+1:0;max=Math.max(max,streak);}
  stats.maxStreak=Math.max(stats.maxStreak,max);
  if(tails.size||parts.size)summary.push({...ref,rows:rows.length,ends:tails.size,soft:[...tails.values()].filter(x=>x==='soft').length,auto:[...tails.values()].filter(x=>x==='auto').length,hard:[...tails.values()].filter(x=>x==='hard').length,streak:max,parts:[...parts]});
 }
 return {width:innerWidth,actualWidth:document.documentElement.clientWidth,height:innerHeight,body:document.body.className,rootOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),issues,latent,stats,hyphens:summary,
  nested:[...document.querySelectorAll('main .protected-name .protected-name')].map(e=>e.textContent)};
}

async function settle(page) {
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));});
}

const negative = '<!doctype html><html lang="en"><body class="home"><main>'+
  '<p>pag-<br>automate</p><p>auto<br>mate</p>'+
  '<p>Risk is 1%. For <br>each trade.</p><p>Sign in with Google/<br>Facebook.</p><p>Use MetaTrader <br>4 here.</p>'+
  '<p><span style="word-spacing:2em">normal words</span></p>'+
  '<p id="false-bonds">It ends. <span class="protected-name">First stays</span> in <span class="protected-name">the rain</span>.</p></main>';
const fixture = '<!doctype html><html lang="ru"><meta charset="utf-8"><link rel="stylesheet" href="/src/site.css"><body><main>'+
  '<p id="pair">Риск до <span>1%</span>. <strong>Для</strong> <a id="kept" href="/ru/">каждой</a> сделки. После сделки идём и ждём решения.</p>'+
  '<p id="quoted">Он сказал «Готово.» Вы здесь. (Сделка закрыта.) Мы ждём. Доктор г. Москва. Цена 1.25 и 1.5.</p>'+
  '<p>Вход через <span class="protected-name">Google</span>/<wbr>Facebook и MetaTrader <em>4 app.</em></p>'+
  '<p id="ordinary-compound" lang="en" style="width:4.5ch">auto-test</p>'+
  '<p id="bold-words" lang="en" style="width:9ch"><strong>auto-test plain</strong></p>'+
  '<h4 id="heading-compound" lang="en" style="width:9ch">auto-test plain</h4>'+
  '<p id="edge-fallback" style="width:18.5ch;font:16px monospace">qqqqqq jj xxxx zzzzzzzzz ggggg mm vvvvvvvv</p>'+
  '<p id="thai-prose" lang="th">ทดสอบการตัดคำภาษาไทย</p>'+
  '</main><script>window.keptLink=document.querySelector("#kept");</script><script type="module" src="/src/prose-spacing.js"></script>';

async function measureResize(page, width, height) {
  await page.evaluate(() => {
    const line = [...document.querySelectorAll('.step-content li')]
      .find(item => item.textContent.includes('cuenta de Google/Facebook'));
    const range = document.createRange();
    const canvas = document.createElement('canvas').getContext('2d');
    const samples = [];
    const sample = phase => {
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      const chars = [];
      for(let node=walker.nextNode();node;node=walker.nextNode()){
        for(let offset=0;offset<node.length;offset++)chars.push({node,offset,char:node.data[offset]});
      }
      const at = chars.map(part=>part.char).join('').indexOf('cuenta de');
      if(at<0)throw Error('Resize test phrase not found');
      const blank = at + 'cuenta'.length;
      const rect = ({node,offset}) => {
        range.setStart(node,offset);
        range.setEnd(node,offset+1);
        return range.getBoundingClientRect();
      };
      const left = rect(chars[blank-1]), right = rect(chars[blank+1]);
      if(Math.abs(left.top-right.top)<1){
        canvas.font = getComputedStyle(chars[blank].node.parentElement).font;
        const standard=canvas.measureText(' ').width;
        samples.push({phase,width:innerWidth,height:innerHeight,gap:right.left-left.right,standard});
      }
    };
    let frame;
    const onResize = () => sample('resize');
    const onFrame = () => {
      sample('frame');
      frame = requestAnimationFrame(onFrame);
    };
    addEventListener('resize', onResize);
    frame = requestAnimationFrame(onFrame);
    window.finishTypographyResize = () => {
      removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
      return samples;
    };
  });
  await page.setViewportSize({width, height});
  await settle(page);
  const samples = await page.evaluate(() => window.finishTypographyResize());
  return samples.filter(sample => sample.width === width && sample.height === height);
}

async function main(){
  const selected=process.env.TYPO_ENGINES?.split(',')??['chromium','firefox','webkit'];
  const report={engines:{},findings:[]};
  for(const engine of selected){
    const headless=true, chromiumPath=process.env.CHROME_EXECUTABLE;
    const browser=await pw[engine].launch(engine==='chromium'&&chromiumPath?{headless,executablePath:chromiumPath}:{headless});
    try{
      const c=await browser.newContext({viewport:{width:375,height:850}}),p=await c.newPage();
      let current;const pageErrors=[],rows=[],flows=[];
      p.on('pageerror',e=>pageErrors.push({page:current,error:e.message}));
      await c.route('**/*',r=>{
        const u=new URL(r.request().url());
        if(u.origin!==origin)return r.abort();
        if(u.pathname==='/test-typography-negative')return r.fulfill({body:negative,contentType:'text/html'});
        if(u.pathname==='/test-typography-positive')return r.fulfill({body:fixture,contentType:'text/html'});
        let f=path.join(root,'site',u.pathname);if(u.pathname.endsWith('/'))f=path.join(f,'index.html');
        if(!fs.existsSync(f))return r.abort();
        return r.fulfill({body:fs.readFileSync(f),contentType:mime[path.extname(f).slice(1)]??'application/octet-stream'});
      });
      await p.addInitScript(()=>{if(!location.search){localStorage.clear();sessionStorage.clear();}});
      await p.goto(origin+'/test-typography-negative');await settle(p);
      const failures=await p.evaluate(measure);
      assert.ok(failures.issues.some(x=>x.rule==='sentence'&&x.example==='For / each'));
      assert.ok(failures.issues.some(x=>x.rule==='protected-atom'&&x.example==='Google/Facebook'));
      assert.ok(failures.issues.some(x=>x.rule==='protected-atom'&&x.example==='MetaTrader 4'));
      assert.ok(failures.issues.some(x=>x.rule==='space'));
      assert.ok(failures.issues.some(x=>x.rule==='home-compound'&&x.example==='pag-automate'));
      assert.ok(failures.issues.some(x=>x.rule==='home-word'&&x.example==='automate'));
      assert.deepEqual(await p.locator('#false-bonds .protected-name').allTextContents(),['First stays','the rain']);
      await p.goto(origin+'/test-typography-positive');await settle(p);
      const fx=()=>p.evaluate(()=>({links:[...document.querySelectorAll('main a')].map(a=>a.getAttribute('href')),pairs:[...document.querySelectorAll('.protected-name')].map(x=>x.textContent.trim()),nested:document.querySelectorAll('.protected-name .protected-name').length,text:document.querySelector('main').textContent,html:document.querySelector('main').innerHTML}));
      const example=await fx();
      const expanded=await p.locator('#edge-fallback').evaluate(el=>{
        const range=document.createRange(),rows=new Map(),edge=el.getBoundingClientRect().right;
        const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
        for(let node=walker.nextNode();node;node=walker.nextNode()){
          range.selectNodeContents(node);
          const extra=parseFloat(getComputedStyle(node.parentElement).wordSpacing)||0;
          for(const r of range.getClientRects()){
            if(!r.width)continue;
            const row=rows.get(r.top)??{right:0,expanded:0};
            row.right=Math.max(row.right,r.right);
            row.expanded+=Number(extra>0);
            rows.set(r.top,row);
          }
        }
        range.selectNodeContents(el);
        return {text:range.toString(),lines:[...rows].sort((a,b)=>a[0]-b[0]).map(([,r])=>({gap:edge-r.right,expanded:r.expanded}))};
      });
      assert.equal(expanded.lines.length,3);
      assert.ok(expanded.lines[0].gap>10&&expanded.lines[0].expanded>0,'A short line should use its allowed extra spaces');
      assert.ok(expanded.lines[1].gap<1&&expanded.lines[1].expanded>0,'The next line should reach the edge independently');
      assert.equal(expanded.lines[2].expanded,0,'The last line should keep natural spaces');
      assert.equal(expanded.text,'qqqqqq jj xxxx zzzzzzzzz ggggg mm vvvvvvvv');
      const selected=await p.locator('#pair').evaluate(el=>{
        const r=document.createRange(),selection=document.getSelection();
        r.selectNodeContents(el);selection.removeAllRanges();selection.addRange(r);
        return selection.toString();
      });
      assert.ok(selected.includes('Для каждой'));
      await p.setViewportSize({width:280,height:850});
      await settle(p);
      assert.equal(await p.evaluate(()=>document.getSelection().toString()),selected);
      await p.evaluate(()=>document.getSelection().removeAllRanges());
      await p.setViewportSize({width:375,height:850});
      await settle(p);
      const native=await p.evaluate(()=>{
        const lines=(element,term)=>{
          const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),chars=[];
          for(let n=walker.nextNode();n;n=walker.nextNode())for(let i=0;i<n.length;i++)chars.push({n,i,c:n.data[i]});
          const start=chars.map(x=>x.c).join('').indexOf(term);
          const first=chars[start],last=chars[start+term.length-1];
          const range=document.createRange();
          range.setStart(first.n,first.i);
          range.setEnd(last.n,last.i+1);
          return new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>r.top)).size;
        };
        const ordinary=document.querySelector('#ordinary-compound');
        const bold=document.querySelector('#bold-words strong');
        const heading=document.querySelector('#heading-compound');
        return {
          ordinary:getComputedStyle(ordinary).hyphens,
          hardBreak:lines(ordinary,'auto-test'),
          boldMode:getComputedStyle(bold).hyphens,
          boldText:lines(bold,'auto-test plain'),
          boldCompound:lines(bold,'auto-test'),
          headingMode:getComputedStyle(heading).hyphens,
          headingCompound:lines(heading,'auto-test'),
          thai:getComputedStyle(document.querySelector('#thai-prose')).hyphens
        };
      });
      assert.deepEqual(native,{ordinary:'auto',hardBreak:2,boldMode:'none',boldText:2,boldCompound:1,headingMode:'none',headingCompound:1,thai:'none'});
      assert.deepEqual(example.links,['/ru/']);
      assert.equal(await p.evaluate(()=>document.querySelector('#kept')===window.keptLink),true);
      for (const width of [280,320,375]) {
        await p.setViewportSize({width,height:850});await settle(p);
        const result=await p.evaluate(measure);
        assert.deepEqual(result.issues,[]);assert.equal(result.rootOverflow,0);
      }
      for(const pair of ['Для каждой','Вы здесь','Мы ждём','Google/Facebook','MetaTrader 4'])assert.ok(example.pairs.includes(pair),pair);
      assert.ok(!example.pairs.some(text=>/^(После |и |г. |Доктор )/.test(text)));
      assert.equal(example.nested,0);
      await p.evaluate(async()=>{await import('/src/prose-spacing.js?repeat');window.dispatchEvent(new Event('resize'));});
      await settle(p);
      assert.deepEqual(await fx(),example);
      await p.goto(origin+'/fil/');
      for(const [width,height] of [[390,440],[412,440],[412,915],[430,440],[430,915]]){
        await p.setViewportSize({width,height});await settle(p);
        const result=await p.evaluate(measure);
        assert.deepEqual(result.issues.filter(issue=>issue.rule.startsWith('home-')),[],engine+' FIL '+width+'×'+height);
      }
      if(engine==='chromium'){
        await p.setViewportSize({width:673,height:841});
        await p.goto(origin+'/es/t-capital/instruction/');await settle(p);
        for(const [width,height] of [[344,882],[673,841],[344,882]]){
          const samples=await measureResize(p,width,height);
          assert.ok(samples.some(sample=>sample.phase==='frame'),'Resize frame was not measured');
          assert.deepEqual(samples.filter(sample=>sample.gap>1.5*sample.standard+.001),[],'A resized line stretched beyond 1.5 spaces');
        }
      }
      if (process.env.TYPO_FIXTURES_ONLY==='1') {
        console.log(engine+' regression fixtures passed');
        continue;
      }
      for(const l of languages)for(const route of routes){
        current=l+'/'+route;const href=origin+'/'+current;
        await p.goto(href);await settle(p);
        assert.equal(await p.locator('html').getAttribute('lang'),l);
        const raw=fs.readFileSync(path.join(root,'site',current,'index.html'),'utf8');
        assert.doesNotMatch(raw,/&shy;|&#0*173;?|&#x0*ad;?|\u00ad/iu,current);
        const policy=await p.evaluate(()=>{
          const expected=document.body.matches('.home')?'none':'auto';
          const ordinary=[...document.querySelectorAll('main :is(p,li), dialog :is(.legal-copy,[data-panel=leader]) :is(p,li)')];
          return ordinary.filter(el=>{
            if(el.closest('.protected-name,.keep-words,.quoted-phrase'))return false;
            const css=getComputedStyle(el),limit=css.getPropertyValue('hyphenate-limit-chars');
            const mode=el.matches(':lang(th)')?'none':expected;
            return css.hyphens!==mode||css.wordBreak!=='normal'||css.overflowWrap!=='normal'||(limit&&!/^auto(?: auto){0,2}$/.test(limit));
          }).map(el=>[el.tagName,el.className,getComputedStyle(el).hyphens]);
        });
        assert.deepEqual(policy,[],current+' has inconsistent prose hyphenation');
        const snapshot=await p.evaluate(raw=>{
          const valid=new DOMParser().parseFromString(raw,'text/html');
          const clean=t=>t.replace(/[\u00ad\u2060]/g,'').replace(/\s+/g,' ').trim();
          const nodes=document.querySelectorAll('main p,main li'),old=valid.querySelectorAll('main p,main li');
          return {
            text:clean(document.querySelector('main').textContent)===clean(valid.querySelector('main').textContent),
            hrefs:JSON.stringify([...document.querySelectorAll('a')].map(a=>a.getAttribute('href')))===JSON.stringify([...valid.querySelectorAll('a')].map(a=>a.getAttribute('href'))),
            count:nodes.length===old.length,nested:document.querySelectorAll('.protected-name .protected-name').length
          };
        },raw);
        if(!snapshot.text||!snapshot.hrefs||!snapshot.count||snapshot.nested)report.findings.push({engine,page:current,dom:snapshot});
        const guide=route.endsWith('/instruction/');
        if(guide)await p.evaluate(()=>{document.querySelectorAll('.step-content,#completion').forEach(e=>e.hidden=false);document.querySelectorAll('#faq details').forEach(e=>e.open=true);});
        const sizes=[280,320,375,768,1024,1440];
        if(guide&&engine==='chromium')sizes.push(344,412,673,853,344);
        for(const width of sizes){
          await p.setViewportSize({width,height:width===412?440:850});await settle(p);
          const geometry=await p.evaluate(measure);
          rows.push({page:current,width,...geometry});
          if(geometry.issues.length||geometry.rootOverflow)report.findings.push({engine,page:current,width,issues:geometry.issues,overflow:geometry.rootOverflow});
        }
        if(guide){
          await p.setViewportSize({width:375,height:812});await p.reload();await settle(p);
          await p.locator('[data-step-check]').first().check();
          const total=route.startsWith('t-capital/')?3:4;
          assert.equal(await p.locator('#progress-count').textContent(),'1 / '+total);
          await p.locator('#faq summary').first().click();assert.equal(await p.locator('#faq details[open]').count(),1);
          await p.locator('#faq summary').first().click();assert.equal(await p.locator('#faq details[open]').count(),0);
          await p.locator('[data-open-legal]').click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');await p.locator('dialog[open]').waitFor({state:'hidden'});
          flows.push(current);
        }
      }
      report.engines[engine]={rows,flows,pageErrors,version:browser.version()};
      if(pageErrors.length)report.findings.push({engine,pageErrors});
      console.log(JSON.stringify({engine,layouts:rows.length,flows:flows.length,findings:report.findings.filter(x=>x.engine===engine).length}));
    }finally{await browser.close();}
  }
  if(process.env.TYPO_REPORT)fs.writeFileSync(process.env.TYPO_REPORT,JSON.stringify(report));
  if(report.findings.length){console.error(JSON.stringify(report.findings.slice(0,5)));process.exitCode=1;}
}
main().catch(e=>{console.error(e);process.exitCode=1});
