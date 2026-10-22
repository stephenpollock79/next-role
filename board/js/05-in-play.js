"use strict";
/* ---------- In play: eight states, seven buttons ----------
   The status is STORED on the role and set by the buttons below. Only two things move it without
   you, and both are facts about time rather than guesses:
     1. a booked date passes            -> Write up the interview
     2. ten days with no contact        -> Chase them   (reset by pressing "Chase sent")
   Both are applied at render, so pressing a button always wins until the fact recurs.
   There is no lead time. Prep is owed from the moment an interview is booked. */
var QUIET_DAYS = 10;

var FLOW = {
  noreply:  {label:"Applied, no reply",       cls:"",       mine:false},
  chase:    {label:"Chase them",              cls:"weak",   mine:true },
  slot:     {label:"Awaiting a slot",         cls:"",       mine:false},
  prep:     {label:"Prep the interview",      cls:"warm",   mine:true },
  ready:    {label:"Ready for it",            cls:"",       mine:false},
  writeup:  {label:"Write up the interview",  cls:"weak",   mine:true },
  feedback: {label:"Waiting for feedback",    cls:"",       mine:false},
  offer:    {label:"Offer \u2014 decide",         cls:"strong", mine:true }
};
var FLOW_ORDER = ["offer","writeup","prep","chase","ready","slot","feedback","noreply"];

function lastContact(r){
  var ds=[r.chasedAt, r.appliedAt, r.seen];
  sessionsFor(r.id).forEach(function(c){ if(c.date) ds.push(c.date); });
  convsFor(r.id).forEach(function(c){ if(c.date) ds.push(c.date); });
  ds=ds.filter(Boolean).sort();
  return ds.length? ds[ds.length-1] : "";
}

/* A role that has never had a button pressed must not claim "no reply" while an interview sits on
   its card. The opening state is read off what is actually there; from the first button press the
   stored value wins and nothing infers again. */
function initialFlow(r){
  var t=today();
  if(r.stage==="offer") return "offer";
  var sess=sessionsFor(r.id);
  var fut=sess.filter(function(c){return c.state==="booked" && c.date && c.date>=t;})
    .sort(function(a,b){return String(a.date).localeCompare(String(b.date));})[0];
  if(fut) return fut.prepDone? "ready" : "prep";
  var pastOpen=sess.filter(function(c){return c.state!=="done" && c.date && c.date<t;})[0];
  if(pastOpen) return "writeup";
  if(sess.filter(function(c){return c.state==="done";}).length || convsFor(r.id).length) return "feedback";
  if(sess.filter(function(c){return c.state==="offered"||c.state==="conditional";}).length) return "slot";
  return "noreply";
}

/* Every status change records where it came from, so every move has a way back. Pressing Back
   again returns you — it toggles rather than walking a history, which is what you want when the
   mistake was one click. A status moved by the clock offers its own resets instead (Chase sent,
   Log it), because stepping "back" from a fact about time would only be undone by the same fact. */
function setFlow(id,next,extra){
  var r=roles.find(function(x){return x.id===id;});
  var patch=Object.assign({flowStatus:next, flowPrev: r? flowOf(r).k : ""}, extra||{});
  save(id,patch);
}

function flowOf(r){
  var t=today();
  var k = r.flowStatus || initialFlow(r);
  if(!FLOW[k]) k="noreply";
  var nx=nextSessionOf(r.id);
  var why="", auto="";

  /* rule 1 — a booked date has passed */
  if(k==="prep" || k==="ready"){
    var past=sessionsFor(r.id).filter(function(c){return c.state!=="done" && c.date && c.date<t;})
      .sort(function(a,b){return String(b.date).localeCompare(String(a.date));})[0];
    if(past && !nx){ k="writeup"; auto="the "+esc(niceDay(past.date))+" session is in the past"; }
  }
  /* rule 2 — ten days of silence */
  if(k==="noreply" || k==="feedback"){
    var lc=lastContact(r), n=lc? dayGap(lc,t) : null;
    if(n!=null && n>=QUIET_DAYS){ k="chase"; auto=n+" days with no contact"; }
  }

  var f=FLOW[k];
  /* Role-level moves only. Anything about a specific meeting — it happened, change the date,
     remove it — belongs on that meeting's row, or the interview gets described twice and the two
     descriptions disagree with each other. */
  var A={
    slot:     ["fs_slot","They want to talk",""],
    prepped:  ["fs_prepped","Prepped","primary"],
    notready: ["fs_notready","Prep still to do",""],
    logit:    ["fs_logit","Log it","primary"],
    skiplog:  ["fs_skiplog","Skip the write-up","ghost"],
    chased:   ["fs_chased","Chase sent","primary"],
    offer:    ["fs_offer","Offer",""],
    closed:   ["rejopen","Closed","ghost"]
  };
  var acts = {
    noreply:  [A.slot, A.chased, A.offer, A.closed],
    chase:    [A.chased, A.slot, A.closed],
    slot:     [A.chased, A.closed],
    prep:     [A.prepped, A.closed],
    ready:    [A.notready, A.closed],
    writeup:  [A.logit, A.skiplog, A.closed],
    feedback: [A.notready, A.chased, A.offer, A.closed],
    offer:    [A.closed]
  }[k];

  if(!why){
    why = k==="noreply"  ? ("Sent"+(r.appliedAt? " "+esc(niceDay(r.appliedAt)) : "")+". Nothing back yet.")
        : k==="chase"    ? (auto || "You marked this as needing a nudge.")
        : k==="slot"     ? "They want to talk and no date is fixed."
        : k==="prep"     ? (nx? "Booked for "+esc(niceDay(nx.date))+(nx.time?" at "+esc(nx.time):"")+". Not prepped."
                              : "Not prepped, and nothing is booked \u2014 book it or say it happened.")
        : k==="ready"    ? (nx? "Prepped. "+esc(niceDay(nx.date))+(nx.time?" at "+esc(nx.time):"")+"."
                              : "Prepped, but nothing is booked.")
        : k==="writeup"  ? ((auto? auto.charAt(0).toUpperCase()+auto.slice(1)+". " : "")+
                            "What concerned you is the part that decays fastest.")
        : k==="feedback" ? "The interview is done. Nothing next is booked."
        : /* offer */      "An offer is the only thing here that expires on your silence.";
  }
  if(!auto && r.flowPrev && FLOW[r.flowPrev] && r.flowPrev!==k)
    acts = (acts||[]).concat([["fs_back","Back to "+FLOW[r.flowPrev].label.replace(" \u2014 decide",""),"ghost"]]);

  return {k:k, label:f.label, cls:f.cls, mine:f.mine, why:why, auto:!!auto,
          sort:(FLOW_ORDER.indexOf(k)<0?9:FLOW_ORDER.indexOf(k))+"-"+(nx? nx.date : "zzzz"),
          acts:acts};
}
function playStatus(r){ return flowOf(r); }

/* The Applied status dropdown, shared by the open card and the collapsed row (1 Oct, night). */
function flowSelect(r,st,extra){
  st=st||playStatus(r);
  return '<select class="spillsel '+(st.cls||"")+(extra? " "+extra : "")+'" data-act="fs_set" data-id="'+r.id+'" aria-label="Status">'+
    Object.keys(FLOW).map(function(kk){ return '<option value="'+kk+'"'+(st.k===kk?" selected":"")+'>'+esc(FLOW[kk].label)+'</option>'; }).join("")+
    '</select>';
}
function playCard(r){
  var cs=convsShown(r), sess=sessionsFor(r.id);
  var next=sess.filter(function(c){return c.state==="booked" && c.date && c.date>=today();})
    .sort(function(a,b){return String(a.date).localeCompare(String(b.date));})[0];
  var st = playStatus(r);
  var lead = next? chip("code", nextLabel(next), "Next meeting \u2014 "+(next.title||"session")) : "";
  /* One control for the status, one button only when the move is yours and the button records
     something the dropdown would not (a chase date, prep done, the write-up). Stage moves sit
     together on the right. 30 Sep. */
  var DO={chase:["fs_chased","Chase sent"], prep:["fs_prepped","Prepped"], writeup:["fs_logit","Log it"]}[st.k];
  var sel=flowSelect(r,st,"");
  var summary='<div class="shead compact'+(st.mine?" mine":"")+'">'+
      '<div class="srow">'+
        '<span class="eyebrow">Status</span>'+sel+
        (st.auto? '<span class="chip code" title="Moved here by the clock: '+esc(st.why)+'">by the clock</span>' : "")+
        (DO? sbtn(DO[0],r.id,DO[1],"primary") : "")+
        '<div class="bgroup outcome">'+
          (r.stage==="applied"? sbtn("prepunapplied",r.id,"Back to to-apply","ghost") : "")+
          (r.stage!=="offer"? sbtn("fs_offer",r.id,"Offer","") : "")+
          sbtn("rejopen",r.id,"Closed or rejected","danger")+
        '</div>'+
      '</div>'+closeBlock(r,"out")+
    '</div>'+
    nextUp(r);
  var body=cardTabs(r, summary, [
    {k:"details", label:"Overview", html: overviewPanel(r)},
    {k:"fit", label:"Fit", html: fitTab(r)},
    {k:"prep", label:"Interviews", n: mtInterviewCount(r), html: interviewsPanel(r)},
    {k:"cv", label:"CV", html: cvPanel(r)},
    {k:"company", label:"Company", html: researchPanel(r)},
    {k:"questions", label:"Questions", n: qCount(r)||"", html: questionsPanel(r)},
    {k:"notes", label:"Notes", n: notesCount(r), html: notesPanel(r,coOf(r))}
  ], "details");
  var quick='<span class="qacts">'+(DO? sbtn(DO[0],r.id,DO[1],"primary") : "")+
    (r.stage!=="offer"? sbtn("fs_offer",r.id,"Offer","") : "")+
    sbtn("rejopen",r.id,"Closed","danger",' title="Opens the card to pick a reason"')+'</span>';
  return roleShell(r, null, lead, body, quick);
}

function closedCard(r){
  var cs=convsShown(r);
  var lead='';
  var summary=statusHead({label:"Closed"+(r.closedAfter? " after "+r.closedAfter : ""), cls:"weak",
      why: r.closedNote? esc(r.closedNote) : "", primary:[], secondary:[sbtn("reopen",r.id,"Reopen","ghost")]});
  var quick='<span class="qacts">'+sbtn("reopen",r.id,"Reopen","")+'</span>';
  var body=cardTabs(r, summary, [
    {k:"details", label:"Overview", html: overviewPanel(r)},
    {k:"fit", label:"Fit", html: fitTab(r)},
    (finalCount(r)? {k:"cv", label:"CV", html: cvPanel(r)} : null),
    {k:"prep", label:"Interviews", n: mtInterviewCount(r), html: interviewsPanel(r)},
    {k:"company", label:"Company", html: researchPanel(r)},
    {k:"questions", label:"Questions", n: qCount(r)||"", html: questionsPanel(r)},
    {k:"notes", label:"Notes", n: notesCount(r), html: notesPanel(r,coOf(r))}
  ], "details");
  return roleShell(r, null, lead, body, quick);
}

function fillRoleSelect(){
  var sel=el("cv-role"); if(!sel) return;
  var cur=sel.value;
  var STW={consideration:"Shortlist",parked:"parked",prep:"to apply",applied:"applied",offer:"offer",closed:"closed"};
  var live=roles.filter(function(r){return STW[r.stage];})
    .sort(function(a,b){return String(a.company).localeCompare(String(b.company));});
  sel.innerHTML='<option value="">Not a role \u2014 a company, a person or a topic</option>'+
    live.map(function(r){
      return '<option value="'+esc(r.id)+'">'+esc(refTxt(r)+r.company)+' \u2014 '+esc(r.title)+' ('+STW[r.stage]+')</option>';
    }).join("");
  if(cur){ sel.value=cur; if(sel.value!==cur) sel.value=""; }
  var cs=el("cv-co");
  if(cs){
    var cc=cs.value;
    cs.innerHTML='<option value="">No company</option>'+companies.slice()
      .sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));})
      .map(function(c){ return '<option value="'+esc(c.id)+'">'+esc(c.name||c.id)+'</option>'; }).join("");
    if(cc){ cs.value=cc; if(cs.value!==cc) cs.value=""; }
  }
  var ss=el("cv-sec");
  if(ss){
    var sc=ss.value;
    ss.innerHTML='<option value="">No sector</option>'+sectors.slice()
      .sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));})
      .map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.name||x.id)+'</option>'; }).join("");
    if(sc){ ss.value=sc; if(ss.value!==sc) ss.value=""; }
  }
  toggleSubj();
}
var CV_MEET_PICK=null, CV_MEET_FREE="";
function fillMeet(){
  var rid=el("cv-role").value, sel=el("cv-meet"), wrap=el("cv-meet-wrap"); if(!sel) return;
  var ss=rid? sessionsFor(rid).filter(function(c){return c.date;}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));}) : [];
  wrap.hidden=!ss.length;
  sel.innerHTML='<option value="">Not a booked meeting</option>'+ss.map(function(c){
    return '<option value="'+esc(c.id)+'">'+esc((c.title||"Meeting")+" · "+niceShort(c.date))+'</option>'; }).join("");
  var t=today(), dflt=ss.filter(function(c){return c.date<=t;})[0];
  sel.value = CV_MEET_PICK!=null? CV_MEET_PICK : (dflt? dflt.id : "");
  if(sel.selectedIndex<0) sel.value="";
  CV_MEET_PICK=null;
  meetDate();
}
function meetDate(){ var c=commitments.find(function(x){return x.id===el("cv-meet").value;}); if(c&&c.date) el("cv-date").value=c.date; }
function toggleSubj(){ var w=el("cv-subj-wrap"), s=el("cv-role"); if(w&&s) w.hidden = !!s.value; fillMeet(); }
function renderToApply(){
  var live=roles.filter(function(r){return r.stage==="prep";})
    .sort(function(a,b){
      var ac=days(a.closing), bc=days(b.closing);
      if(ac!=null&&bc!=null) return ac-bc; if(ac!=null) return -1; if(bc!=null) return 1;
      return priRank(coOf(a))-priRank(coOf(b));
    });
  var h=el("toapply-list"); if(!h) return;
  live=sortRoles("toapply",live);
  h.innerHTML = live.length? live.map(applyCard).join("")
    : '<div class="card empty"><b>Nothing waiting to be sent.</b>'+
      'Roles arrive here from the shortlist with their research attached. An empty list here and a full shortlist '+
      'means the writing is the bottleneck, not the sourcing.</div>';
  fillRoleSelect();
}

function renderInPlay(){
  var live=roles.filter(function(r){return r.stage==="applied"||r.stage==="offer";})
    .map(function(r){ return {r:r, st:playStatus(r)}; })
    .sort(function(a,b){ return a.st.sort.localeCompare(b.st.sort); });
  var gr=function(x){return x.r;};
  var mine=sortRoles("inplay",live.filter(function(x){return x.st.mine;}),gr);
  var theirs=sortRoles("inplay",live.filter(function(x){return !x.st.mine;}),gr);

  var h=el("inplay-list"); if(!h) return;
  if(!live.length){
    h.innerHTML='<div class="card empty"><b>Nothing applied yet.</b>'+
      'Mark a role applied on the To apply tab and it lands here. It stays until you close it out \u2014 '+
      'an application with no recorded ending is the one thing this board cannot tell from a live one.</div>';
  } else {
    h.innerHTML =
      '<div class="sec-head" style="margin:0 0 12px">'+
        '<h2 style="font-size:17px">Your move</h2>'+
        (mine.length? '<span class="chip weak">'+mine.length+'</span>' : '<span class="chip strong">clear</span>')+
        '<span class="eyebrow">nothing here moves until you do</span>'+
      '</div>'+
      (mine.length
        ? '<div class="stack">'+mine.map(function(x){return playCard(x.r);}).join("")+'</div>'
        : '<p class="emptyline">Nothing is waiting on you. Everything below is in their court or the clock\u2019s.</p>')+
      '<div class="sec-head" style="margin:28px 0 12px">'+
        '<h2 style="font-size:17px">Waiting</h2>'+
        '<span class="chip">'+theirs.length+'</span>'+
        '<span class="eyebrow">their court, or the clock\u2019s</span>'+
      '</div>'+
      (theirs.length
        ? '<div class="stack">'+theirs.map(function(x){return playCard(x.r);}).join("")+'</div>'
        : '<p class="emptyline">Nothing waiting. Every live application needs something from you.</p>');
  }

  /* A sector conversation lives on its Sectors card. 29 Sep: this chat "isnt in play right now". */
  /* 29 Sep: "Conversations should be added to role, company or sector files." A company
     chat already shows on its company card and every role card there, so listing it here as well
     meant it sat on In play for ever. Only a conversation attached to nothing appears here, as a
     to-do to attach it; the section is hidden when there are none. */
  var loose=conversations.filter(function(c){return !c.roleId && !c.companyId && !c.sectorId;})
    .sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
  var cw=el("conv-wrap"); if(cw) cw.hidden = !loose.length;
  el("conv-list").innerHTML = loose.length? loose.map(function(c){
      return '<article class="role"><div class="rail"></div><div class="role-body">'+
        '<div class="role-head"><div style="min-width:0;flex:1">'+
        '<h3 style="font-size:16px">'+esc(c.companyId? coName(c.companyId) : (c.subject||"Conversation"))+'</h3>'+
        (c.companyId? '<div class="co">Company conversation \u00b7 also on its company card and role cards</div>' : "")+
        '</div></div>'+
        convEntry(c,false)+'</div></article>';
    }).join("")
    : '<div class="card empty" style="padding:22px"><b>No standalone conversations logged.</b>'+
      'Warm chats and recruiter calls change the search more than any single application does, and they are the easiest to lose.</div>';

  var closed=roles.filter(function(r){return r.stage==="closed";})
    .sort(function(a,b){return String(b.closedAt||"").localeCompare(String(a.closedAt||""));});
  el("closedcount").textContent = closed.length? (closed.length+(closed.length===1?" role":" roles")) : "none";
  el("closed-list").innerHTML = closed.length? closed.map(closedCard).join("")
    : '<p class="lede" style="font-size:12.5px;margin:0">Nothing closed yet. Closing one records how far it got \u2014 '+
      'rejected at screening and rejected after a panel say very different things about the criteria.</p>';

  fillRoleSelect();
}
