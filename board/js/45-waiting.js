"use strict";
/* ===== Waiting on Applied: days, chases and Gone quiet (13 Oct) =====
   Every Applied status now carries its age, e.g. "Applied, no reply · 7d", so a role nobody answers is visible
   instead of sitting there for ever. Two waiting states, each with its own clock:
   - Applied, no reply: counted from `appliedAt`. Chase them at 14 days, only when someone is linked to chase
     (a person at the company, or a referral); otherwise there's no one to nudge. Gone quiet at 30 days.
   - Waiting for feedback (after an interview or conversation): counted from when it moved there (`flowAt`).
     Chase them 10 days after it moved there or after the last chase. Gone quiet at 30 days, or 10 days after a second
     chase with no reply.
   Gone quiet asks rather than closes: Close as no reply (ended by them, reason "Went quiet", with undo) or Keep
   waiting (`quietUntil` = 14 days on; it asks again then).
   New fields: `flowAt` (the day the status last changed; written by every setFlow), `chaseDates` (every Chase sent),
   `quietUntil`. Roles from before fall back to the applied date, the last chase, or the last meeting or notes.
   Mark applied now asks for the date you applied (default today). */
var WQ={noreply:{chase:14, quiet:30}, feedback:{chase:10, quiet:30, chases:2}, snooze:14};
var WQ_WAIT={noreply:1, feedback:1, chase:1, quiet:1};
FLOW.quiet={label:"Gone quiet — close it?", cls:"weak", mine:true};
FLOW_ORDER.splice(FLOW_ORDER.indexOf("writeup")+1,0,"quiet");

function wqMax(a){ return a.filter(Boolean).sort().pop()||""; }
/* Has anything happened since applying: a meeting that took place, or notes logged? */
function wqHappened(r){
  var t=today();
  return sessionsFor(r.id).some(function(c){ return c.state==="done" || (c.date && c.date<t && c.state!=="cancelled"); }) || convsFor(r.id).length>0;
}
function wqLastHappened(r){
  var t=today(), ds=[];
  sessionsFor(r.id).forEach(function(c){ if(c.state==="done") ds.push(c.doneAt||c.date); else if(c.date && c.date<t && c.state!=="cancelled") ds.push(c.date); });
  convsFor(r.id).forEach(function(c){ ds.push(c.date); });
  return wqMax(ds);
}
function wqContact(r){
  var cid=coIdOfRole(r);
  return !!(r.referral || (cid && people.some(function(p){ return p.companyId===cid; })));
}
function wqChases(r,since){
  var ds=(r.chaseDates||[]).slice(); if(r.chasedAt && ds.indexOf(r.chasedAt)<0) ds.push(r.chasedAt);
  return ds.filter(function(d){ return d && (!since || d>=since); }).sort();
}
/* The waiting picture for a role, or null when it isn't waiting. */
function wqInfo(r){
  if(r.stage!=="applied") return null;
  var k0=r.flowStatus || initialFlow(r);
  if(!WQ_WAIT[k0]) return null;
  var mode = (k0==="feedback" || wqHappened(r))? "feedback" : "noreply";
  var start = mode==="noreply"? (r.appliedAt||r.seen||"")
    : ((r.flowStatus==="feedback" && r.flowAt)? r.flowAt : (wqLastHappened(r) || r.flowAt || r.appliedAt || ""));
  if(!start) return null;
  var t=today(), ch=wqChases(r,start), last=wqMax([start, ch[ch.length-1]]);
  var I={mode:mode, start:start, days:Math.max(0,dayGap(start,t)||0), chases:ch.length, since:Math.max(0,dayGap(last,t)||0),
    snoozed: !!(r.quietUntil && r.quietUntil>t), contact: mode==="feedback" || wqContact(r)};
  var R=WQ[mode];
  var quiet = k0==="quiet" || (mode==="noreply"? I.days>=R.quiet : (I.days>=R.quiet || (I.chases>=R.chases && I.since>=R.chase)));
  if(quiet && !I.snoozed){ I.k="quiet"; return I; }
  if(k0==="chase" || (I.contact && I.since>=R.chase)){ I.k="chase"; return I; }
  I.k=mode; return I;
}
function wqDays(n){ return n+"d"; }
/* The status pill is narrow (13 Oct): days go first so they never get cut off, with a shorter label. */
var WQ_SHORT={noreply:"No reply", feedback:"Awaiting feedback", chase:"Chase them", quiet:"Gone quiet", slot:"Awaiting a slot", writeup:"Write it up", offer:"Offer"};
function wqLabel(k,days){ return wqDays(days)+" · "+(WQ_SHORT[k]||(FLOW[k]||{}).label||k); }

flowOf=(function(orig){ return function(r){
  var st=orig(r);
  try{
    var I=wqInfo(r);
    if(I){
      var f=FLOW[I.k];
      st.k=I.k; st.cls=f.cls; st.mine=f.mine; st.auto = I.k!==(r.flowStatus||"");
      st.label=wqLabel(I.k,I.days);
      var since=niceShort(I.start);
      st.why = I.k==="quiet"? (I.mode==="noreply"? "Applied "+since+", "+I.days+" days with no reply." : "Waiting since "+since+(I.chases? ", chased "+I.chases+(I.chases===1?" time":" times") : "")+", no reply.")+" Close it, or keep waiting."
        : I.k==="chase"? (I.mode==="noreply"? "Applied "+since+". Nothing back — worth a nudge through your contact." : "Waiting since "+since+". "+I.since+" days since you last heard or chased.")
        : I.mode==="noreply"? "Sent "+since+". Nothing back yet."+(I.contact? "" : " No one linked to chase, so it waits.")
        : "Waiting since "+since+(I.chases? ", chased "+I.chases+(I.chases===1?" time":" times") : "")+".";
      if(I.snoozed && I.k!=="quiet") st.why+=" Keeping waiting until "+niceShort(r.quietUntil)+".";
      st.sort=(FLOW_ORDER.indexOf(st.k)<0?9:FLOW_ORDER.indexOf(st.k))+"-"+st.sort.split("-").slice(1).join("-");
      st.wq=I;
    } else if(r.stage==="applied" && r.flowAt && st.k!=="prep" && st.k!=="ready"){
      st.label=wqLabel(st.k,Math.max(0,dayGap(r.flowAt,today())||0));
    }
  }catch(e){ console.warn("waiting",e); }
  return st;
}; })(flowOf);
playStatus=function(r){ return flowOf(r); };
/* Hovering the pill gives the full status and why, since the pill shows the short form. */
flowSelect=(function(orig){ return function(r,st,extra){
  st=st||playStatus(r);
  var h=orig(r,st,extra), f=FLOW[st.k]||{};
  var tip=(f.label||"")+(st.why? " — "+String(st.why).replace(/<[^>]*>/g,"") : "");
  return h.replace("<select ",'<select title="'+esc(tip)+'" ');
}; })(flowSelect);

/* Every status change records its day. A chase that keeps the same stored status keeps the clock. */
setFlow=(function(orig){ return function(id,next,extra){
  var r=roles.find(function(x){ return x.id===id; });
  var add={};
  if(!r || r.flowStatus!==next) add.flowAt=today();
  if(!WQ_WAIT[next]) add.quietUntil="";
  return orig(id,next,Object.assign(add,extra||{}));
}; })(setFlow);

/* Buttons for Gone quiet: on the card's status line, and in place of the row's quick buttons. */
function wqBtns(id){
  return sbtn("wq_close",id,"Close as no reply","primary",' title="Ends it as They said no — Went quiet. Undo is on the toast."')+
    sbtn("wq_keep",id,"Keep waiting","",' title="Asks again in '+WQ.snooze+' days"');
}
playCard=(function(orig){ return function(r){
  var h=orig(r), st;
  try{ st=flowOf(r); }catch(e){ return h; }
  if(st.k!=="quiet") return h;
  var k='<div class="bgroup outcome">', i=h.indexOf(k);
  if(i>=0) h=h.slice(0,i)+wqBtns(r.id)+h.slice(i);
  var q=h.lastIndexOf('<span class="qacts">');
  if(q>=0){ var e=h.indexOf("</span>",q); if(e>q) h=h.slice(0,q)+'<span class="qacts">'+wqBtns(r.id)+h.slice(e); }
  return h;
}; })(playCard);

/* Mark applied asks for the date (default today). */
function wqApplied(id){
  var r=roles.find(function(x){ return x.id===id; }); if(!r) return;
  openForm({title:"Mark applied", ok:"Mark applied", lede:(r.company||"")+" — "+(r.title||""),
    fields:[{id:"wqapplied", label:"Applied on", value:today()}],
    onSave:function(v){
      var d=v.wqapplied;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Pick the date you applied.";
      if(d>today()) return "That's in the future.";
      save(id,{stage:"applied", appliedAt:d, flowAt:d});
      return "";
    }});
  var f=el("fm-wqapplied"); if(f){ f.type="date"; f.max=today(); f.value=today(); }
}

document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="wq_close"],[data-act="wq_keep"],[data-act="fs_chased"],[data-act="prepapplied"]');
  if(!b || !DB) return;
  var a=b.dataset.act, id=b.dataset.id, r=roles.find(function(x){ return x.id===id; }); if(!r) return;
  ev.preventDefault(); ev.stopPropagation();
  if(a==="prepapplied"){ wqApplied(id); return; }
  var I=wqInfo(r);
  if(a==="fs_chased"){
    var stay = I? I.mode : (r.flowStatus==="feedback"? "feedback" : "noreply");
    var cd=(r.chaseDates||[]).concat([today()]);
    setFlow(id, stay, {chasedAt:today(), chaseDates:cd, court:"them"});
    return;
  }
  if(a==="wq_keep"){
    var prevQ=r.quietUntil||"";
    save(id,{quietUntil:addDays(today(),WQ.snooze)});
    toastUndo("Keeping waiting — asks again "+niceShort(addDays(today(),WQ.snooze)), function(){ save(id,{quietUntil:prevQ}); });
    return;
  }
  if(a==="wq_close"){
    var after = typeof isInterviewing==="function" && isInterviewing(r);
    var done = typeof stagesOf==="function"? stagesOf(r).filter(function(x){ return x.st==="done"; }).length : 0;
    var note = I? (I.mode==="noreply"? "No reply "+I.days+" days after applying" : "No reply "+I.days+" days after the last conversation"+(I.chases? ", chased "+I.chases+(I.chases===1?" time":" times") : "")) : "No reply";
    var keys=["stage","closedAt","closedReason","closedNote","closedAfter","endBy","endReason","endNote","endAt","endStage","endStagesDone","endRule","endGap"];
    var before={}; keys.forEach(function(k){ before[k]= r[k]==null? "" : r[k]; });
    save(id,{stage:"closed", closedAt:today(), closedReason:"Went quiet", closedNote:note, closedAfter: after? "interview" : "application",
      endBy:"them", endReason:"Went quiet", endNote:note, endAt:today(), endStage: after? "After interviewing" : "After applying",
      endStagesDone:done, endRule:"", endGap:""});
    toastUndo("Closed as no reply — "+(r.company||"role"), function(){ save(id,before); });
    return;
  }
},true);
