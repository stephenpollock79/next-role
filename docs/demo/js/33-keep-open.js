"use strict";
/* ===== Pop-ups and panels stay open (5 Oct) =====
   1. Drag-safe outside clicks. A pop-up closed on any click whose target was the pop-up box itself (12), and the side
      panel on any click outside it (18). A text selection or drag that starts inside and ends outside fires exactly
      that click, as does a click in a pop-up's own padding. Now a pop-up closes only when the press AND the release are
      both on the backdrop, and the panel only when the press started outside it.
   2. Survives a reload. The open page, side panel and any form pop-up (with what you've typed) are kept in this
      browser tab's sessionStorage and put back after a reload, for up to 30 minutes. Form pop-ups whose fields are in
      the page markup (KEEP_DLG) come back with their text; pop-ups the board builds on the fly (meeting form, edit
      forms, Claude drafts) can't be rebuilt from storage and stay closed. */
var KEEP_KEY="nr-keep", KEEP_MAX=30*60*1000;
var KEEP_DLG=["add-dialog","cv-dialog","co-dialog","sec-dialog","pp-dialog","ch-dialog","cm-dialog"];
var KEEP_PD=null, KEEP_DONE=false;

/* ---------- 1. outside clicks ---------- */
function keepInBox(elm,x,y){ var r=elm.getBoundingClientRect(); return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom; }
window.addEventListener("pointerdown",function(ev){ KEEP_PD={t:ev.target, x:ev.clientX, y:ev.clientY}; },true);
window.addEventListener("click",function(ev){
  var pd=KEEP_PD, t=ev.target; if(!t || !t.closest) return;
  /* Only a real click (8 Oct). Buttons inside the panel that switch page do it by clicking the sidebar for you (e.g.
     Practise → Mock interview); that click lands outside the panel while the press began inside, and was swallowed. */
  if(!ev.isTrusted) return;
  /* A pop-up's backdrop: the click's target is the <dialog> itself. Real backdrop clicks are outside its box. */
  if(t.tagName==="DIALOG"){
    var startIn= pd && pd.t && pd.t.closest && pd.t.closest("dialog")===t && keepInBox(t,pd.x,pd.y);
    if(keepInBox(t,ev.clientX,ev.clientY) || startIn){ ev.stopImmediatePropagation(); return; }
  }
  /* The side panel: a press that started inside it is never an outside click. */
  if(typeof SP!=="undefined" && SP.id && SP.kind!=="wk" && pd && pd.t && pd.t.closest && pd.t.closest("#sidepanel") && !t.closest("#sidepanel")){
    ev.stopImmediatePropagation(); return;
  }
},true);

/* ---------- 2. survive a reload ---------- */
function keepOpenDlg(){ for(var i=0;i<KEEP_DLG.length;i++){ var d=el(KEEP_DLG[i]); if(d && d.open) return d; } return null; }
function keepSnap(){
  if(!KEEP_DONE) return;   /* never overwrite a saved state before it has been restored */
  var o={at:Date.now(), tab:(typeof tab!=="undefined"? tab : ""), dlg:"", mode:"", vals:{}, sp:null};
  var d=keepOpenDlg();
  if(d){ o.dlg=d.id;
    var m=d.querySelector('[data-act="ctab"][aria-selected="true"]'); if(m) o.mode=m.dataset.k||"";
    d.querySelectorAll("input[id],textarea[id],select[id]").forEach(function(f){ if(f.type!=="file" && f.type!=="hidden" || f.id==="add-src" || f.id==="paste-src") o.vals[f.id]=f.value; }); }
  if(typeof SP!=="undefined" && SP.id) o.sp={id:SP.id, kind:SP.kind};
  try{ sessionStorage.setItem(KEEP_KEY, JSON.stringify(o)); }catch(e){}
}
function keepFill(d,vals){
  Object.keys(vals||{}).forEach(function(id){ var f=el(id); if(f && d.contains(f) && vals[id]!=null) f.value=vals[id]; });
}
function keepRestore(){
  var o=null; try{ o=JSON.parse(sessionStorage.getItem(KEEP_KEY)||"null"); }catch(e){}
  KEEP_DONE=true;
  if(!o || !o.at || Date.now()-o.at>KEEP_MAX) return;
  try{
    if(o.tab && o.tab!==tab && typeof showTab==="function") showTab(o.tab);
    if(o.sp && o.sp.id && typeof spOpen==="function"){
      var ok= o.sp.kind==="person"? people.some(function(p){ return p.id===o.sp.id; })
        : o.sp.kind==="wk"? !!document.querySelector('#tab-week details.rcard[data-id="'+cssq(o.sp.id)+'"]')
        : rawRoles.some(function(r){ return r.id===o.sp.id; });
      /* A person's panel follows the People list's open card, so reopen it there (QA 15 Oct); spOpen alone was undone by the next render. */
      if(o.sp.kind==="person"){ var sp0=o.sp, tries=0;
        (function pp(){ if(people.some(function(p){ return p.id===sp0.id; }) && typeof expanded!=="undefined" && expanded){
            Array.from(expanded).forEach(function(k){ if(k.indexOf("pp-")===0) expanded.delete(k); }); expanded.add("pp-"+sp0.id); renderPeople(); }
          else if(++tries<15) setTimeout(pp,200); })(); }
      else if(ok) spOpen(o.sp.id, o.sp.kind);
    }
    if(o.dlg){ var d=el(o.dlg); if(d && !d.open){
      if(o.dlg==="add-dialog" && typeof openAdd==="function") openAdd(o.mode||"");
      else { if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
      keepFill(d,o.vals);
      if(o.dlg==="cv-dialog" && typeof toggleSubj==="function") toggleSubj();
    } }
  }catch(e){ console.warn("keep open",e); }
  keepSnap();
}
document.addEventListener("input",function(){ keepSnap(); },true);
document.addEventListener("change",function(){ keepSnap(); },true);
setInterval(keepSnap,1500);
window.addEventListener("pagehide",keepSnap);
/* Restore once the data is in (29 sets NRB.ready after the first batched render), or after 8 seconds at most. */
(function(){ var t0=Date.now();
  (function wait(){ var ready=(typeof NRB!=="undefined" && NRB.ready) && rawRoles.length;
    if(ready || Date.now()-t0>8000) setTimeout(keepRestore,150); else setTimeout(wait,200); })(); })();
