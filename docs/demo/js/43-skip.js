"use strict";
/* ===== Close without doing it (12 Oct) =====
   A second way to clear a Week ahead item, worded by type:
   - Recurring: **Skip** closes this day's occurrence only. The date goes into `skipDates` AND `doneDates`, so
     everything that counts open items (badges, rail, Today) treats it as closed; the series carries on.
   - One-off task: **Won't do** — `state: "done"`, `closedAs: "wontdo"`, `closedFrom` (the state it left).
   - Meeting or interview: **Cancelled** — `state: "cancelled"`, `cancelledAt`, `closedFrom`. Its own state, not
     "done", so a cancelled screen never fires "finishes the screen" triggers or counts as a round that happened.
   - Prep: **Won't do** — same write as "No prep needed" (`prepLead: 0`), plus `prepSkippedAt`; the toast names
     the meeting that is still booked.
   Shown greyed with its label, never struck through (struck through = done). Every close has an Undo toast,
   and the card keeps a way back (Not skipped after all / Reopen). */

mtStatus=(function(orig){ return function(c){
  var k=cmtClosedAs(c); if(k) return [SKIP_LAB[k],"skipst"];
  return orig(c);
}; })(mtStatus);

function skipWrite(cid,patch,msg,undoPatch){
  if(!DB) return;
  var ref=DB.doc("commitments/"+cid);
  ref.update(patch).then(function(){
    if(msg && undoPatch) toastUndo(msg,function(){ ref.update(undoPatch).catch(function(e){ console.warn("skip undo",e); }); });
  }).catch(function(e){ console.warn("skip",e&&e.code); toast("Couldn't save — try again",true); });
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="taskskip"],[data-act="taskunskip"],[data-act="cmtwontdo"],[data-act="cmtcancel"],[data-act="cmtreopen"],[data-act="prepwontdo"]');
  if(!b || !DB) return;
  ev.preventDefault(); ev.stopPropagation();
  var a=b.dataset.act, cid=b.dataset.cid, d=b.dataset.d, c=commitments.find(function(x){ return x.id===cid; });
  if(!c) return;
  var dd=(c.doneDates||[]).slice(), sd=(c.skipDates||[]).slice();
  function without(arr,x){ return arr.filter(function(y){ return y!==x; }); }
  if(a==="taskskip"){
    if(!d) return;
    var dd2=without(dd,d).concat([d]).sort(), sd2=without(sd,d).concat([d]).sort();
    skipWrite(cid,{doneDates:dd2, skipDates:sd2},"Skipped "+niceShort(d),{doneDates:without(dd2,d), skipDates:without(sd2,d)});
    return;
  }
  if(a==="taskunskip"){
    if(!d) return;
    skipWrite(cid,{doneDates:without(dd,d), skipDates:without(sd,d)});
    return;
  }
  if(a==="cmtwontdo"){
    var from=c.state||"booked";
    skipWrite(cid,{state:"done", doneAt:today(), closedAs:"wontdo", closedFrom:from},"Closed as won’t do",
      {state:from, doneAt:"", closedAs:"", closedFrom:""});
    return;
  }
  if(a==="cmtcancel"){
    var from2=c.state||"booked";
    skipWrite(cid,{state:"cancelled", cancelledAt:today(), closedFrom:from2},"Marked cancelled",
      {state:from2, cancelledAt:"", closedFrom:""});
    return;
  }
  if(a==="cmtreopen"){
    skipWrite(cid,{state:c.closedFrom||"booked", doneAt:"", cancelledAt:"", closedAs:"", closedFrom:""});
    return;
  }
  if(a==="prepwontdo"){
    var lead=c.prepLead==null? null : c.prepLead;
    var still = c.state==="booked" && c.date && c.date>=today();
    var msg = still? "No prep — "+(c.title||"the meeting")+" is still on "+niceShort(c.date)+(c.time? " "+c.time : "") : "Prep closed as won’t do";
    skipWrite(cid,{prepLead:0, prepNow:false, prepSkippedAt:today()},msg,{prepLead:lead, prepSkippedAt:""});
  }
},true);

/* Styles: greyed like done, but not struck through, with a small label. */
(function(){
  var s=document.createElement("style");
  s.textContent=
    'article.role.wkskip{opacity:.6}'+
    'article.role.wkskip .rsum-title{color:var(--muted)}'+
    '.skiptag{display:inline-block; margin-left:6px; padding:0 6px; border-radius:999px; font-size:10.5px; line-height:17px; font-weight:500; '+
      'color:var(--muted); background:var(--surface-2); border:1px dashed var(--line); vertical-align:1px; text-decoration:none}'+
    '.spill.skipst{color:var(--muted); background:var(--surface-2); border:1px dashed var(--line)}'+
    '.wbc.skip{opacity:.6} .wbc.skip .wbn{text-decoration:none; color:var(--muted)}'+
    '.wbsk{font-weight:500; color:var(--muted)}'+
    '.wba{gap:6px}'+
    '.dl li.dli.skip .dn{text-decoration:none}'+
    '.stage.taskrow.st-won’tdo .stname, .stage.taskrow.st-skip .stname{text-decoration:none}';
  document.head.appendChild(s);
})();
