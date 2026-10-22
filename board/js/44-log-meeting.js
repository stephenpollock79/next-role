"use strict";
/* ===== Log a conversation: the meeting decides kind, who and date (13 Oct) =====
   - Opened from a meeting (Add notes on a meeting row or card): that meeting is set.
   - Opened from the top (+ New › Log a conversation, Applied's + Log): when the role has meetings, the
     meeting dropdown starts on "Pick the meeting…" and Log it waits until one is picked
     ("Not a booked meeting" counts as a pick).
   - With a meeting picked, Date, Kind and Who are not asked: a summary line shows them from the meeting,
     with Change to correct them (a swapped interviewer, an extra person on the panel).
   - Saved notes carry `fromMeeting: true` while untouched; they then show the meeting's live kind and people,
     so fixing the meeting fixes the notes. A changed kind or who is stored as typed (`fromMeeting: false`).
   - Picking a meeting that already has notes opens those notes instead (one meeting, one set of notes). */
var CVM={mode:"auto", over:false};
var CVM_PICK="__pick";

function cvmMeet(){
  var s=el("cv-meet"), w=el("cv-meet-wrap");
  if(!s || !w || w.hidden || !el("cv-role").value) return null;
  var v=s.value; if(!v || v===CVM_PICK) return null;
  return commitments.find(function(x){ return x.id===v; }) || null;
}
function cvmWho(m){
  var ps=csWho(m);
  return ps.map(function(p){ return p.name+(p.role? ", "+p.role : ""); }).join("; ");
}
function cvmKind(m){ return mtLabel(m); }
/* Called by 12's save: true when the kind and who come from the meeting. */
function cvmDerived(){ return !!cvmMeet() && !CVM.over; }

function cvmSetKind(v){
  var k=el("cv-kind"); if(!k || !v) return;
  var has=[].some.call(k.options,function(o){ return o.value===v; });
  if(!has){ var o=document.createElement("option"); o.textContent=v; o.value=v; o.dataset.cvm="1"; k.appendChild(o); }
  k.value=v;
}
function cvmBar(){
  var b=el("cv-mfrom");
  if(!b){
    b=document.createElement("div"); b.id="cv-mfrom"; b.className="cvmfrom";
    var w=el("cv-meet-wrap"); w.parentNode.insertBefore(b,w.nextSibling);
  }
  return b;
}
function cvmPaint(){
  var m=cvmMeet(), kg=el("cv-kind").closest(".grid2"), dl=el("cv-date").closest("label"), b=cvmBar();
  var hide=!!m && !CVM.over;
  if(kg) kg.hidden=hide;
  if(dl) dl.hidden=hide;
  if(!m){ b.hidden=true; b.innerHTML=""; return; }
  if(!CVM.over){
    cvmSetKind(cvmKind(m));
    el("cv-who").value=cvmWho(m);
    if(m.date) el("cv-date").value=m.date;
  }
  var who=cvmWho(m);
  b.hidden=CVM.over;
  b.innerHTML='<span class="cvmk">'+esc(cvmKind(m))+'</span>'+
    '<span>'+(who? esc(who) : '<i>No one named on the meeting</i>')+'</span>'+
    (m.date? '<span class="cvmd">'+esc(niceShort(m.date))+'</span>' : "")+
    '<button type="button" class="btn ghost cvmch" data-cvm="change">Change</button>';
}

fillMeet=(function(orig){ return function(){
  var hadPick=CV_MEET_PICK!=null;
  orig();
  var s=el("cv-meet"), w=el("cv-meet-wrap");
  if(s && w && !w.hidden && CVM.mode==="pick" && !hadPick){
    var o=document.createElement("option"); o.value=CVM_PICK; o.textContent="Pick the meeting…"; o.disabled=true;
    s.insertBefore(o,s.firstChild); s.value=CVM_PICK;
  }
  CVM.over=false;
  cvmPaint();
}; })(fillMeet);

meetDate=(function(orig){ return function(){ orig(); CVM.over=false; cvmPaint(); }; })(meetDate);

/* Which way the form was opened. 12's handler runs after this (bubble), so the mode is set first. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="logjump"],[data-act="fs_logit"]');
  if(!b) return;
  CVM.mode = (b.dataset.act==="logjump" && !b.dataset.cid)? "pick" : "auto";
  CVM.over=false;
  var h=el("cv-hint"); if(h) h.textContent="";
},true);

document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-cvm="change"]');
  if(!b) return;
  ev.preventDefault();
  CVM.over=true; cvmPaint();
  var wv=el("cv-who"); if(wv) setTimeout(function(){ wv.focus(); },30);
});

/* Before 12's save handler: insist on a pick, hand off to existing notes, fill kind and who. */
el("cv-save").addEventListener("click",function(ev){
  var s=el("cv-meet"), w=el("cv-meet-wrap"), h=el("cv-hint");
  if(el("cv-role").value && w && !w.hidden && s && s.value===CVM_PICK){
    ev.stopImmediatePropagation();
    if(h) h.textContent="Pick the meeting these notes are about, or Not a booked meeting.";
    s.focus();
    return;
  }
  var m=cvmMeet();
  if(m){
    var ex=conversations.find(function(v){ return v.meetingId===m.id; });
    if(ex){
      ev.stopImmediatePropagation();
      var d=el("cv-dialog"); if(d && d.open && d.close) d.close();
      openEdDialog("conversation", ex.id, ED_TITLES.conversation);
      toast("That meeting already has notes — add to them here");
      return;
    }
    if(!CVM.over){ cvmSetKind(cvmKind(m)); el("cv-who").value=cvmWho(m); if(m.date) el("cv-date").value=m.date; }
    cvmAfter(m.id, el("cv-role").value);
  }
},true);

/* ===== Notes logged on a meeting that has happened move things on (13 Oct) =====
   Once 12's save lands (the new conversation arrives through the subscription), a role meeting dated
   today or earlier is marked done (as It happened), and an Applied role's status goes to Prep the interview
   when a later round is booked, else Waiting for feedback. Offer, future meetings and "Not a booked
   meeting" notes are left alone. One undo toast puts both back. */
function cvmAfter(cid, roleId){
  if(!roleId) return;
  var t0=Date.now();
  (function poll(){
    var hit=conversations.some(function(v){ return v.meetingId===cid; });
    if(hit) return cvmAdvance(cid, roleId);
    if(Date.now()-t0<8000) setTimeout(poll,300);
  })();
}
function cvmAdvance(cid, roleId){
  if(!DB) return;
  var m=commitments.find(function(x){ return x.id===cid; });
  var r=roles.find(function(x){ return x.id===roleId; });
  if(!m || !r || !m.date || m.date>today()) return;
  var undo=[], did=[];
  if(m.state!=="done" && m.state!=="cancelled"){
    var prevState=m.state||"booked", prevDoneAt=m.doneAt||"";
    DB.doc("commitments/"+cid).update({state:"done", doneAt:today()}).catch(function(e){ console.warn("cvm done",e&&e.code); });
    undo.push(function(){ DB.doc("commitments/"+cid).update({state:prevState, doneAt:prevDoneAt}).catch(function(){}); });
    did.push("meeting marked done");
  }
  if(r.stage==="applied"){
    var nx=sessionsFor(r.id).filter(function(c){ return c.id!==cid && c.state==="booked" && c.date && c.date>=today(); })
      .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); })[0];
    var next = nx? (nx.prepDone? "ready" : "prep") : "feedback";
    /* Waiting for feedback restarts its clock on new notes, even if it was already waiting (45). */
    if(flowOf(r).k!==next || (next==="feedback" && r.flowAt!==today())){
      var prevFlow=r.flowStatus||"", prevPrev=r.flowPrev||"", prevAt=r.flowAt||"", prevQ=r.quietUntil||"";
      setFlow(r.id, next, next==="feedback"? {flowAt:today(), quietUntil:""} : null);
      undo.push(function(){ save(r.id,{flowStatus:prevFlow, flowPrev:prevPrev, flowAt:prevAt, quietUntil:prevQ}); });
      did.unshift("moved to "+FLOW[next].label);
    }
  }
  if(!did.length) return;
  var msg=did.join(", "); msg=msg.charAt(0).toUpperCase()+msg.slice(1);
  toastUndo(msg, function(){ undo.forEach(function(f){ f(); }); });
}

/* Notes taken from a meeting show its live kind and people. */
convEntry=(function(orig){ return function(c,showAbout){
  if(c && c.fromMeeting && c.meetingId){
    var m=commitments.find(function(x){ return x.id===c.meetingId; });
    if(m){ var who=cvmWho(m); c=Object.assign({},c,{kind:cvmKind(m), who:who||c.who}); }
  }
  return orig(c,showAbout);
}; })(convEntry);

(function(){
  var s=document.createElement("style");
  s.textContent=
    '.cvmfrom{display:flex; flex-wrap:wrap; align-items:center; gap:6px 12px; padding:9px 12px; border-radius:10px; '+
      'background:var(--surface-2); border:1px solid var(--line-2); font-size:13px; color:var(--ink-2)}'+
    '.cvmfrom .cvmk{font-weight:600; color:var(--ink)}'+
    '.cvmfrom .cvmd{color:var(--muted)}'+
    '.cvmfrom .cvmch{margin-left:auto; padding:3px 10px; font-size:12px}';
  document.head.appendChild(s);
})();
