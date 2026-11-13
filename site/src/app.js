import {normalise,checkStep,toggleStep,progressSticky} from './state.js';
const body=document.body, page=body.dataset.page,lang=document.documentElement.lang;
const viewport=document.documentElement;
const stackedViewport=matchMedia('(vertical-viewport-segments > 1)');
function centerPanels(){
  const gutter=stackedViewport.matches
    ? body.offsetWidth-body.clientWidth
    : innerWidth-viewport.getBoundingClientRect().width;
  viewport.style.setProperty('--panel-center-offset',Math.max(0,gutter)/2+'px');
}
const viewportObserver=new ResizeObserver(centerPanels);
viewportObserver.observe(viewport);
viewportObserver.observe(body);
window.addEventListener('resize',centerPanels);
stackedViewport.addEventListener('change',centerPanels);
centerPanels();
const DATA=JSON.parse(document.querySelector('#page-data').textContent);
const originalURL=location.href;
for(const key in DATA.legalURLs)DATA.legalURLs[key]=new URL(DATA.legalURLs[key],originalURL).href;
const KEY='vladimir1:t-capital:progress:v2', LANG='vladimir1:language';
const isHistoryReturn=performance.getEntriesByType('navigation')[0]?.type==='back_forward';
let state=normalise(null), storageFailed=false, transfer=null;
try { transfer=JSON.parse(sessionStorage.getItem('vladimir1:transfer'));sessionStorage.removeItem('vladimir1:transfer'); } catch {}
const isTransfer=transfer?.target===location.pathname&&Date.now()-transfer.time<30000;
const picker=document.querySelector('.language-picker');
const pickerAnchor=document.createComment('language-picker');
picker.before(pickerAnchor);
const originalLanguageLinks=[...picker.querySelectorAll('a')].map(a=>a.href);
picker.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')picker.open=true;});
picker.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')picker.open=false;});
picker.querySelector('summary').addEventListener('click',e=>{
  if(e.pointerType==='mouse'&&matchMedia('(hover:hover)').matches){e.preventDefault();picker.open=true;}
});
picker.addEventListener('focusout',e=>{if(!picker.contains(e.relatedTarget))picker.open=false;});
document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))picker.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picker.open){picker.open=false;picker.querySelector('summary').focus();}});
let modal=null, lastFocus=null,scrollTop=0;
const dialog=document.querySelector('#dialog');
const standaloneCopy=document.querySelector('main.legal-copy');
const guideURL=new URL(location.href);
const legalTabs=[...dialog?.querySelectorAll('[data-legal-tab]')??[]];
const requestedDoc=legalTabs.find(tab=>tab.dataset.legalTab===guideURL.searchParams.get('legal'))?.dataset.legalTab;
if(requestedDoc)guideURL.searchParams.delete('legal');
const baseURL=guideURL.pathname+guideURL.search+guideURL.hash;

function readingSections(copy){
  return [copy,...copy.querySelectorAll(':scope > h2, :scope > h3')];
}
function readingEdge(scroller){
  return scroller===document.scrollingElement?0:scroller.querySelector('.legal-dialog-header').getBoundingClientRect().bottom;
}
function readingPosition(copy,scroller){
  const edge=readingEdge(scroller);
  const sections=readingSections(copy).map(section=>section.getBoundingClientRect().top);
  sections.push(copy.getBoundingClientRect().bottom);
  const index=Math.max(0,sections.findLastIndex(top=>top<=edge));
  const span=sections[index+1]-sections[index];
  return {index,ratio:span>0?Math.min(1,Math.max(0,(edge-sections[index])/span)):0,atStart:scroller.scrollTop<2};
}
function restoreReading(copy,scroller,reading){
  if(reading.atStart){scroller.scrollTop=0;return;}
  const sections=readingSections(copy);
  const index=Math.min(reading.index,sections.length-1);
  const start=sections[index].getBoundingClientRect().top;
  const end=sections[index+1]?.getBoundingClientRect().top??copy.getBoundingClientRect().bottom;
  scroller.scrollTop+=start+(end-start)*reading.ratio-readingEdge(scroller);
}
function restoreTransferredReading(copy,scroller){
  if(!isTransfer||!transfer.reading)return;
  const reading=transfer.reading;
  document.fonts.ready.then(()=>{
    // Wait for native navigation and the prose-spacing pass before measuring headings.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(copy.getClientRects().length)restoreReading(copy,scroller,reading);
    }));
  });
}
let standaloneReading;
if(standaloneCopy){
  window.addEventListener('scroll',()=>{
    if(scrollY>2||!picker.open&&!picker.contains(document.activeElement))standaloneReading=readingPosition(standaloneCopy,document.scrollingElement);
  },{passive:true});
}
picker.querySelectorAll('a').forEach(a=>a.addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const inLegalModal=modal?.kind==='legal';
  const copy=inLegalModal?dialog.querySelector('[data-legal-doc]:not([hidden])'):standaloneCopy;
  const target=new URL(a.href);
  try {localStorage.setItem(LANG,a.dataset.lang);}catch{}
  picker.open=false;
  if((inLegalModal||standaloneCopy)&&a.dataset.lang===lang){event.preventDefault();return;}
  const current=copy?readingPosition(copy,inLegalModal?dialog:document.scrollingElement):null;
  const reading=!inLegalModal&&current?.atStart?standaloneReading??current:current;
  try {sessionStorage.setItem('vladimir1:transfer',JSON.stringify({target:target.pathname,time:Date.now(),state:page==='guide'?state:null,reading}));}catch{}
  if(inLegalModal){
    event.preventDefault();
    location.replace(target.href);
  }
}));
if(!dialog&&history.state?.vladimirModal){
  const clean={...history.state};delete clean.vladimirModal;history.replaceState(clean,'');
}
function displayModal(kind,doc) {
  const documentChanged=modal?.doc!==doc;
  modal={kind,doc};lastFocus=lastFocus||document.activeElement;
  dialog.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==kind);
  dialog.classList.toggle('legal-dialog',kind==='legal');
  if(kind==='legal'){
    dialog.querySelector('.legal-language-slot').append(picker);
    picker.querySelectorAll('a').forEach((a,i)=>{
      const url=new URL(originalLanguageLinks[i]);
      url.searchParams.set('legal',doc);
      a.href=url.href;
    });
    dialog.querySelectorAll('[data-legal-doc]').forEach(el=>el.hidden=el.dataset.legalDoc!==doc);
    dialog.querySelectorAll('[data-legal-tab]').forEach(el=>{el.setAttribute('aria-selected',String(el.dataset.legalTab===doc));el.tabIndex=el.dataset.legalTab===doc?0:-1;});
    dialog.setAttribute('aria-labelledby','legal-dialog-title');
  } else dialog.setAttribute('aria-labelledby',kind+'-title');
  if(kind==='restore')document.querySelector('#restore-stage').textContent=DATA.ui.restoreStep.replace('{n}',Math.min(state.count+1,3));
  if(!dialog.open){
    scrollTop=scrollY;document.documentElement.classList.add('modal-open');dialog.showModal();
  }
  if(kind==='legal'&&documentChanged)dialog.scrollTop=0;
  dialog.querySelector(`[data-panel="${kind}"] button:not([hidden])`)?.focus({preventScroll:true});
}
function openModal(kind,doc=null,replace=false,replaceOnClose=history.state?.vladimirModal?.replaceOnClose??false){
  let url=baseURL;
  if(kind==='legal'){
    url=new URL(baseURL,location.origin);
    url.searchParams.set('legal',doc);
  }
  const h={...history.state,vladimirModal:{kind,doc,base:baseURL,replaceOnClose}};
  (replace?history.replaceState:history.pushState).call(history,h,'',url);
  displayModal(kind,doc);
}
function hideModal(){
  if(!dialog?.open)return;
  dialog.close();modal=null;document.documentElement.classList.remove('modal-open');
  pickerAnchor.after(picker);picker.open=false;
  picker.querySelectorAll('a').forEach((a,i)=>a.href=originalLanguageLinks[i]);
  scrollTo(0,scrollTop);lastFocus?.focus({preventScroll:true});lastFocus=null;
}
function closeModal(){
  const current=history.state?.vladimirModal;
  if(current?.replaceOnClose){
    const next={...history.state};
    delete next.vladimirModal;
    history.replaceState(next,'',baseURL);
    hideModal();
  }else if(current)history.back();
  else hideModal();
}
window.addEventListener('popstate',e=>{const m=e.state?.vladimirModal;if(m&&dialog)displayModal(m.kind,m.doc);else hideModal();});
if(dialog){
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
  dialog.querySelectorAll('[data-legal-tab]').forEach(b=>{
    b.addEventListener('click',()=>openModal('legal',b.dataset.legalTab,true));
    b.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const all=[...dialog.querySelectorAll('[data-legal-tab]')],i=all.indexOf(b);
      const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;
      openModal('legal',all[next].dataset.legalTab,true);all[next].focus();
    });
  });
}
document.querySelector('[data-open-legal]')?.addEventListener('click',e=>{e.preventDefault();openModal('legal','legal');});
if(page==='guide'){
  try{state=normalise(JSON.parse(localStorage.getItem(KEY)));}catch{storageFailed=true;}
  if(isTransfer&&transfer.state)state=normalise(transfer.state);
  const returning=state.visited, boxes=[...document.querySelectorAll('[data-step-check]')];
  function save(){
    state.visited=true;
    try{localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;}catch{storageFailed=true;}
    document.querySelector('#storage-status').hidden=!storageFailed;
  }
  function render(){
    document.querySelectorAll('.step').forEach((s,i)=>{
      const locked=i>state.count,open=state.open===i&&!locked;
      s.classList.toggle('locked',locked);s.classList.toggle('complete',i<state.count);
      const button=s.querySelector('[data-step-toggle]');
      button.disabled=locked;button.setAttribute('aria-expanded',String(open));
      s.querySelector('.step-content').hidden=!open;
      boxes[i].checked=i<state.count;boxes[i].disabled=locked;
    });
    const p=document.querySelector('#progress');p.classList.toggle('sticky',progressSticky(state));
    document.querySelector('#progress-count').textContent=state.count+' / 3';
    document.querySelector('#progress-fill').style.width=(state.count/3*100)+'%';
    document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',state.count);
    document.querySelector('#completion').hidden=state.count!==3;
    document.querySelector('#restart').hidden=state.count!==3;
  }
  boxes.forEach((b,i)=>b.addEventListener('change',()=>{state=checkStep(state,i,b.checked);save();render();}));
  document.querySelectorAll('[data-step-toggle]').forEach((b,i)=>b.addEventListener('click',()=>{state=toggleStep(state,i);save();render();}));
  function restart(){state=normalise({visited:true,count:0,open:0});save();render();}
  document.querySelectorAll('[data-restart]').forEach(b=>b.addEventListener('click',()=>{restart();if(modal)closeModal();}));
  document.querySelector('[data-continue]').addEventListener('click',closeModal);
  document.querySelector('[data-already]').addEventListener('click',()=>openModal('confirm',null,true));
  document.querySelector('[data-confirm-return]').addEventListener('click',()=>openModal('restore',null,true));
  document.querySelector('[data-confirm-done]').addEventListener('click',()=>{state={visited:true,count:3,open:null};save();render();closeModal();});
  save();render();
  if(requestedDoc){
    openModal('legal',requestedDoc,true,history.state?.vladimirModal?.replaceOnClose??true);
    restoreTransferredReading(dialog.querySelector('[data-legal-doc]:not([hidden])'),dialog);
  }else if(returning&&state.count<3&&!isTransfer&&!isHistoryReturn)openModal('restore',null,Boolean(history.state?.vladimirModal));
}
if(standaloneCopy)restoreTransferredReading(standaloneCopy,document.scrollingElement);
const faq=document.querySelector('#faq');
if(faq){
  const items=[...faq.querySelectorAll('details')];
  items.forEach(d=>d.querySelector('summary').addEventListener('click',e=>{e.preventDefault();const open=d.open;items.forEach(x=>x.open=false);d.open=!open;}));
  document.addEventListener('click',e=>{if(!faq.contains(e.target))items.forEach(d=>d.open=false);});
}
