"use strict";
/* ===== Pending holds real offers only (16 Oct) =====
   - Expected rounds: a meeting or task with `expected: true` and state "unplanned" is a round the company's process
     says comes next that nobody has offered yet (written by next-role-interview-prep so its prep has a home). It
     shows only on the role's Interviews tab, as "Expected, not offered", never in Week ahead's Pending (03's
     pendShown). Booking it, or setting it to waiting on their reply, makes it an ordinary item.
   - Pending rows carry Book it / Edit / Remove on the collapsed row (03's cmtCard). Remove here deletes with an Undo.
   - A role that ends takes its open items with it: every unplanned, offered or conditional meeting or task for a
     closed or rejected role is closed (meetings Cancelled, tasks Won't do), whoever closed the role, board or skill.
     One toast with Undo; an undone item gets `keepOnClose: true` and is left alone after that. */

mtStatus=(function(orig){ return function(c){
  if(cmtExpected(c)) return ["Expected, not offered",""];
  return orig(c);
}; })(mtStatus);

/* Remove from a pending row, with Undo (the doc is written back as it was). */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="pend_rm"]');
  if(!b || !DB) return;
  ev.preventDefault(); ev.stopPropagation();
  var cid=b.dataset.cid, c=commitments.find(function(x){ return x.id===cid; }); if(!c) return;
  var keep={}; Object.keys(c).forEach(function(k){ if(k!=="id") keep[k]=c[k]; });
  unlinkMeeting(cid);
  DB.doc("commitments/"+cid).delete().then(function(){
    toastUndo("Removed "+(c.title||"it"),function(){ DB.doc("commitments/"+cid).set(keep).catch(function(e){ console.warn("pend undo",e); }); });
  }).catch(function(e){ console.warn("pend rm",e&&e.code); toast("Couldn't remove — try again",true); });
},true);

/* Close open items for ended roles. Runs after a render, outside it, once per item per page load. */
var PEND_HEAL={done:{}, timer:0};
function pendHealScan(){
  PEND_HEAL.timer=0;
  if(!DB || (typeof NRB!=="undefined" && (!NRB.ready || NRB.busy))) return;
  var t=today(), hit=commitments.filter(function(c){
    return (c.state==="unplanned"||c.state==="offered"||c.state==="conditional") && !c.keepOnClose && !PEND_HEAL.done[c.id] && cmtRoleEnded(c);
  });
  if(!hit.length) return;
  var undo=[];
  hit.forEach(function(c){
    PEND_HEAL.done[c.id]=1;
    var from=c.state, task=mtItem(c)==="task";
    var patch= task? {state:"done", doneAt:t, closedAs:"wontdo", closedFrom:from, closedWhy:"role closed"}
                   : {state:"cancelled", cancelledAt:t, closedFrom:from, closedWhy:"role closed"};
    undo.push({id:c.id, back: task? {state:from, doneAt:"", closedAs:"", closedFrom:"", closedWhy:"", keepOnClose:true}
                                  : {state:from, cancelledAt:"", closedFrom:"", closedWhy:"", keepOnClose:true}});
    DB.doc("commitments/"+c.id).update(patch).catch(function(e){ console.warn("pend heal",e&&e.code); });
  });
  toastUndo("Closed "+plural(hit.length,"open meeting or task","open meetings and tasks")+" for roles that have ended",function(){
    undo.forEach(function(u){ DB.doc("commitments/"+u.id).update(u.back).catch(function(e){ console.warn("pend heal undo",e); }); });
  });
}
render=(function(orig){ return function(){
  orig.apply(this,arguments);
  if(!PEND_HEAL.timer) PEND_HEAL.timer=setTimeout(pendHealScan,1500);
}; })(render);
