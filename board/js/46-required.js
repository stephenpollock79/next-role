"use strict";
/* ===== Reject box: show what's missing (13 Oct) =====
   Pressing Reject with something still to fill in used to leave only a small grey line above the button, so it
   looked as if nothing happened. Now the missing field gets a red outline and the cursor, and the hint turns red.
   Checked in the order 12's rejsave checks them: who, reason, the deal-breaker / gap pick, Other's note, rating an
   unrated company, why rule the company out. Runs after 12's handler (both bubble on document; this one is added
   later), so it never changes what is saved. Everything is looked up inside the clicked box, not by id. */
function rqMissing(bx){
  var who=bx.dataset.who||"";
  if(!who) return {el:bx.querySelector('.endwho button'), msg:"Who ended it? Pick one first."};
  var sel=bx.querySelector('.reasons[data-who="'+who+'"] button[aria-pressed="true"]')||bx.querySelector('.reasons button[aria-pressed="true"]');
  if(!sel) return {el:bx.querySelector('.reasons:not([hidden]) button'), msg:"Pick a reason first."};
  var sub=bx.querySelector('.rejsub select, .rejsub input');
  if(sub && (!sub.value || sub.value==="__new")) return {el:sub, msg:"Pick which one."};
  var note=bx.querySelector('[id^="rejnote-"]');
  if(sel.dataset.r==="Other" && note && !note.value.trim()) return {el:note, msg:"Other needs a short note, or it can never be counted."};
  var after=bx.querySelector('[data-act="co_after"]');
  if(after && after.dataset.rate==="1" && !after.value) return {el:after, msg:"Rate the company first — it decides how often the sweep checks them."};
  var why=bx.querySelector('[id^="costop-"]');
  if(after && after.value==="stop" && why && !why.value.trim()) return {el:why, msg:"Say why you're ruling them out — it's kept on their card."};
  return null;
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="rejsave"]'); if(!b) return;
  var bx=b.closest(".rejbox"); if(!bx || !bx.isConnected) return;
  var m=rqMissing(bx); if(!m) return;
  bx.querySelectorAll(".reqbad").forEach(function(x){ x.classList.remove("reqbad"); });
  var h=bx.querySelector('[id^="rejhint-"]');
  if(h){ if(!h.textContent) h.textContent=m.msg; h.classList.add("reqmsg"); }
  if(m.el){ m.el.classList.add("reqbad"); try{ m.el.focus({preventScroll:false}); }catch(e){} if(m.el.scrollIntoView) m.el.scrollIntoView({block:"nearest"}); }
});
["input","change","click"].forEach(function(n){
  document.addEventListener(n,function(ev){
    var t=ev.target; if(!t || !t.closest) return;
    var bx=t.closest(".rejbox"); if(!bx) return;
    if(n==="click" && t.closest('[data-act="rejsave"]')) return;
    var x=t.closest(".reqbad")||(t.closest(".endwho,.reasons") && bx.querySelector(".endwho .reqbad,.reasons .reqbad"));
    if(x) x.classList.remove("reqbad");
    if(!bx.querySelector(".reqbad")){ var h=bx.querySelector(".reqmsg"); if(h) h.classList.remove("reqmsg"); }
  });
});
(function(){
  var s=document.createElement("style");
  s.textContent='.rejbox .reqbad{outline:2px solid var(--bad,#b91c1c); outline-offset:1px; border-radius:6px}'+
    '.rejbox .statushint.reqmsg{color:var(--bad,#b91c1c); font-weight:500}';
  document.head.appendChild(s);
})();
