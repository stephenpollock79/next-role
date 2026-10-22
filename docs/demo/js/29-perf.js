"use strict";
/* ---------- Responsiveness (5 Oct) ----------
   On a phone the board ignored taps for a second or more and the side panel lost what you'd picked. Cause:
   every database change redrew every page (Targets › Companies alone was over half the cost), and the
   panel borrows the card's body from the list, so each redraw swapped in a fresh, blank copy.
   This file loads last, so its wrappers are the outermost ones:
   1. Held redraws: while 18's nrFlush runs a burst of snapshots, render() only notes that it's wanted;
      nrFlush redraws once at the end (NRB.ready tells it this file has loaded).
   2. Hidden pages wait: the page renderers below skip their work while their page is hidden and catch up
      when you open the page (`showTab` wrapper). Counts, Week ahead, Overview and the rail still run every time.
   3. Save buttons answer at once: the row (or the open panel) fades and ignores repeat taps until the change
      lands; "Saving…" shows on the button only if it's still waiting after a second. Buttons that open a form
      or pop-up (Reject, Send to shortlist with no scores yet) just open it.
   4. The reject box keeps its state (open, who, reason, sub-pick, note, the company choice) across redraws
      until it is saved, cancelled or the panel closes. */

/* 1. Held redraws */
render=(function(orig){ return function(){ if(NRB.busy){ NRB.want=true; return; } return orig.apply(this,arguments); }; })(render);

/* 2. Hidden pages wait */
var LAZY={}, LAZY_HOST={renderCompanies:"co-list", renderSectors:"sec-list", renderG1:"g1-list", renderG2:"g2-list",
  renderToApply:"toapply-list", renderInPlay:"inplay-list", renderRejected:"cl-where"};
function lazyHidden(id){ var h=el(id), s=h && h.closest('section[id^="tab-"]'); return !!(s && s.hidden); }
Object.keys(LAZY_HOST).forEach(function(n){
  var orig=window[n]; if(typeof orig!=="function") return;
  window[n]=function(){
    if(lazyHidden(LAZY_HOST[n])){ LAZY[n]=1; if((n==="renderToApply"||n==="renderInPlay") && typeof fillRoleSelect==="function") fillRoleSelect(); return; }
    delete LAZY[n]; var out=orig.apply(this,arguments); rkRestore(); return out;
  };
});
function lazyCatchUp(){ Object.keys(LAZY).forEach(function(n){ if(!lazyHidden(LAZY_HOST[n])) window[n](); }); }
showTab=(function(orig){ return function(t){ var out=orig.apply(this,arguments); lazyCatchUp(); return out; }; })(showTab);

/* 3. Save buttons answer at once */
var SAVE_ACTS={accept:1, rejsave:1, g2prep:1, g2park:1, g2back:1, prepapplied:1, prepback:1, reopen:1,
  fs_chased:1, fs_offer:1, fs_prepped:1, fs_notready:1};
var BUSY={};   /* "act|id" -> timers */
function busyKey(b){ return b.dataset.act+"|"+(b.dataset.id||""); }
function busyEls(b){
  var art=b.isConnected? b.closest("article.role") : null, sp=b.isConnected? b.closest("#sp-body") : null;
  if(!b.isConnected && SP.id===b.dataset.id && !el("sidepanel").hidden) sp=el("sp-body");
  if(!art && !sp){ var d=document.querySelector('main details.rcard[data-id="'+cssq(b.dataset.id||"")+'"]'); art=d && d.closest("article.role"); }
  return {art:art, sp:sp};
}
function busyClear(k){ var x=BUSY[k]; if(!x) return; clearTimeout(x.t1); clearTimeout(x.t2);
  [x.b, x.art, x.sp].forEach(function(n){ if(n){ n.classList.remove("nrbusy"); if(n.removeAttribute) n.removeAttribute("data-saving"); } });
  delete BUSY[k]; }
/* Window capture: 07's scores-first and confirm listener is a document capture listener that stops the click. */
window.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("button[data-act]"); if(!b || !SAVE_ACTS[b.dataset.act]) return;
  var k=busyKey(b);
  if(BUSY[k]){ if(typeof CF_PASS!=="undefined" && CF_PASS===b) return;   /* the pop-up replaying the click after its save */
    ev.preventDefault(); ev.stopImmediatePropagation(); return; }   /* a repeat tap while it saves */
  if(b.dataset.act==="rejsave"){ var h=el("rejhint-"+b.dataset.id); if(h) h.textContent=""; }
  var openBefore=!!document.querySelector("dialog[open]");
  setTimeout(function(){
    if(!openBefore && document.querySelector("dialog[open]")){ BUSY_PEND={b:b, k:k}; return; }   /* it opened a pop-up (scores first, a confirm) */
    if(b.dataset.act==="rejsave"){ var h2=el("rejhint-"+b.dataset.id); if(h2 && h2.textContent) return; }   /* something still to fill in */
    busyMark(b,k);
  },0);
},true);
function busyMark(b,k){
  if(BUSY[k]) return;
  var E=busyEls(b), x={b:b, art:E.art, sp:E.sp};
  [b, E.art, E.sp].forEach(function(n){ if(n) n.classList.add("nrbusy"); });
  x.t1=setTimeout(function(){ if(b.isConnected) b.setAttribute("data-saving",""); },1000);
  x.t2=setTimeout(function(){ busyClear(k); },8000);   /* never stuck: a write that fails shows its own message */
  BUSY[k]=x;
}
/* A true double-click on a save is ignored (QA 14 Oct): the same button again within 700 ms, with the same form
   contents and no pop-up opened or closed in between. Forms and moves outside SAVE_ACTS wrote twice. */
var DBL_SEL='#pp-add,#co-add,#sec-add,#ch-add,#cm-save,#mt-save,#fm-save,#add-save,#paste-add,#run-save,#cv-save,#pr-save,#ru-save,[data-act="ed_save"],[data-ecl],[data-dup],[data-swc^="add:"],[data-act="g2prep"]';
var DBL_LAST={el:null, t:0, s:""};
function dblSnap(b){
  var root=b.closest("dialog,form,#mr,.rcard,article,li,.hyrow")||b.parentNode||document.body, d=document.querySelector("dialog[open]");
  return (d? d.id : "-")+"|"+Array.prototype.map.call(root.querySelectorAll("input,textarea,select"),function(e){ return e.type==="checkbox"||e.type==="radio"? (e.checked?1:0) : e.value; }).join("\u0001")+"|"+Array.prototype.map.call(root.querySelectorAll(".statushint,[id$='-hint']"),function(e){ return e.textContent; }).join("\u0001");   /* a shown error allows the retry */
}
window.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest(DBL_SEL); if(!b) return;
  if(typeof CF_PASS!=="undefined" && CF_PASS===b) return;
  var now=Date.now(), sn=dblSnap(b);
  if(DBL_LAST.el===b && now-DBL_LAST.t<700 && DBL_LAST.s===sn){ ev.preventDefault(); ev.stopImmediatePropagation(); return; }
  DBL_LAST={el:b, t:now, s:sn};
},true);
document.addEventListener("close",function(){ DBL_LAST.el=null; },true);   /* a pop-up closing (Cancel, Esc) starts afresh */
/* Scores first, then the move: the row fades the moment you confirm the pop-up, not when its save returns. */
var BUSY_PEND=null;
window.addEventListener("click",function(ev){
  var t=ev.target.closest && ev.target.closest("#sc-yes,#cf-yes,#sc-no,#cf-no"); if(!t || !BUSY_PEND) return;   /* window capture too */
  var P=BUSY_PEND; BUSY_PEND=null;
  if(t.id==="sc-yes"||t.id==="cf-yes") busyMark(P.b,P.k);
},true);
/* The change landed: the redraw replaced the row, so drop the marks. The panel's body is replaced too. */
render=(function(orig){ return function(){ var out=orig.apply(this,arguments);
  Object.keys(BUSY).forEach(function(k){ var x=BUSY[k]; if(!x.b.isConnected || (x.sp && !x.sp.contains(x.b))) busyClear(k); });
  rkRestore(); return out; }; })(render);

/* 4. The reject box keeps its state */
var REJKEEP={};
function rkCapture(id){
  var bx=el("rej-"+id); if(!bx) return;
  if(!bx.classList.contains("open")){ delete REJKEEP[id]; return; }
  var who=bx.dataset.who||"", sel=bx.querySelector('.reasons button[aria-pressed="true"]');
  var subs={}; bx.querySelectorAll(".rejsub select, .rejsub input").forEach(function(f){ if(f.id) subs[f.id]=f.value; });
  var note=el("rejnote-"+id), after=bx.querySelector('[data-act="co_after"]'), stop=el("costop-"+id);
  REJKEEP[id]={who:who, r:sel? sel.dataset.r : "", rwho:sel? (sel.closest(".reasons")||{dataset:{}}).dataset.who : "",
    subs:subs, note:note? note.value : "", after:after? after.value : "", stop:stop? stop.value : ""};
}
function rkRestore(){
  Object.keys(REJKEEP).forEach(function(id){
    var k=REJKEEP[id], bx=el("rej-"+id); if(!bx || bx.classList.contains("open")) return;
    bx.classList.add("open");
    document.querySelectorAll('[data-act="rejopen"][data-id="'+cssq(id)+'"]').forEach(function(y){ y.setAttribute("aria-pressed","true"); });
    var ew=k.who && bx.querySelector('[data-act="endwho"][data-w="'+cssq(k.who)+'"]');
    if(ew){ bx.dataset.who=k.who; bx.querySelectorAll('[data-act="endwho"]').forEach(function(x){ x.setAttribute("aria-pressed",String(x===ew)); });
      bx.querySelectorAll(".reasons").forEach(function(g){ g.hidden = g.dataset.who!==k.who; }); }
    if(k.r){
      var grp=bx.querySelector('.reasons[data-who="'+cssq(k.rwho||k.who)+'"]')||bx;
      var rb=grp.querySelector('[data-act="reason"][data-r="'+cssq(k.r)+'"]');
      if(rb){ bx.querySelectorAll('[data-act="reason"]').forEach(function(x){ x.setAttribute("aria-pressed","false"); }); rb.setAttribute("aria-pressed","true");
        if(k.rwho && !ew) bx.dataset.who=k.rwho;
        var sv=bx.querySelector('[data-act="rejsave"]'); if(sv){ sv.disabled=false; sv.removeAttribute("title"); }
        var subw=el("rejsubw-"+id); if(subw && typeof endSubHtml==="function"){ subw.innerHTML=endSubHtml(k.r,"rejsub-"+id);
          Object.keys(k.subs).forEach(function(fid){ var f=el(fid); if(f) f.value=k.subs[fid]; }); }
        var rn=el("rejnote-"+id); if(rn && sv && sv.dataset.kind==="g2" && bx.dataset.who==="neither") rn.placeholder="Optional — the fact it’s gone is reason enough";
      }
    }
    var note=el("rejnote-"+id); if(note && k.note) note.value=k.note;
    var after=bx.querySelector('[data-act="co_after"]'); if(after && k.after){ after.value=k.after; if(typeof costopSync==="function") costopSync(after); }
    var stop=el("costop-"+id); if(stop && k.stop) stop.value=k.stop;
  });
}
function rkIdOf(t){ var bx=t && t.closest && t.closest(".rejbox"); return bx? bx.id.slice(4) : ""; }
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-act]"); if(!b) return;
  var a=b.dataset.act, id=b.dataset.id||rkIdOf(b);
  if(a==="rejcancel"){ delete REJKEEP[id]; return; }
  if(a==="rejopen"||a==="reason"||a==="endwho"||rkIdOf(b)) setTimeout(function(){ rkCapture(id); },0);
});
["input","change"].forEach(function(n){ document.addEventListener(n,function(ev){ var id=rkIdOf(ev.target); if(id) rkCapture(id); }); });
/* Saved, or the panel closed: forget it. A save that is still missing something keeps it. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="rejsave"]'); if(!b) return;
  var id=b.dataset.id; setTimeout(function(){ var h=el("rejhint-"+id); if(!(h && h.textContent)) delete REJKEEP[id]; },0);
});
spClose=(function(orig){ return function(){ REJKEEP={}; return orig.apply(this,arguments); }; })(spClose);

NRB.ready=true;
