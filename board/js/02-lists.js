"use strict";
/* ---------- GATE 1 ---------- */
var Q={g1:"",co:"",pp:""};
/* A role that arrives without a number (sweep, pasted link, add form) gets the next one. Oldest first,
   so the numbers follow arrival order. Written once; the db write triggers a fresh snapshot. */
var REF_BUSY=false;
function assignRefs(){
  if(REF_BUSY || !DB) return;
  var miss=rawRoles.filter(function(r){ return !r.ref; }); if(!miss.length) return;
  var max=rawRoles.reduce(function(m,r){ return Math.max(m, +r.ref||0); },0);
  miss.sort(function(a,b){ return String(a.seen||"").localeCompare(String(b.seen||"")) || String(a.id).localeCompare(String(b.id)); });
  REF_BUSY=true;
  Promise.all(miss.map(function(r,i){ r.ref=max+i+1; return DB.doc("roles/"+r.id).update({ref:r.ref}); }))
    .catch(function(e){ console.warn(e); }).then(function(){ REF_BUSY=false; });
}
/* Role number (1 Oct): a short unique id after every title, so a role can be named in chat as "#74". */
function refTag(r){ return r && r.ref? '<span class="rref" title="Role number">#'+esc(r.ref)+'</span>' : ""; }
function refTxt(r){ return r && r.ref? "#"+r.ref+" " : ""; }
function qHit(q){ var w=String(q||"").toLowerCase().split(/\s+/).filter(Boolean); return function(){ var hay=Array.prototype.join.call(arguments," ").toLowerCase(); return w.every(function(x){return hay.indexOf(x)>=0;}); }; }
/* The longlist keeps its order while you work through it (4 Oct): scoring a role used to jump it to the
   top. The order is set when you open the Longlist and held until you leave it; new roles join the end. */
var G1FREEZE=null;
function g1Frozen(list){
  if(!G1FREEZE){ G1FREEZE={}; list.forEach(function(r,i){ G1FREEZE[r.id]=i; }); return list; }
  var n=Object.keys(G1FREEZE).length;
  return list.map(function(r,i){ return {r:r, k:(r.id in G1FREEZE)? G1FREEZE[r.id] : n+i}; }).sort(function(a,b){ return a.k-b.k; }).map(function(x){ return x.r; });
}
function renderG1(){
  var list=g1Frozen(roles.filter(function(r){return r.stage==="proposed";}).sort(orderG1));
  if(Q.g1){ var h1=qHit(Q.g1); list=list.filter(function(r){ return h1(r.title,r.company,r.location||"",r.ref? "#"+r.ref : ""); }); }
  /* The Mix filter applies to the whole longlist before the batch is cut, so its counts match the rail (2 Oct). */
  if(typeof mixFilter==="function") list=mixFilter("gate1",list);
  var batch=sortRoles("gate1",list.slice(0,30)), queued=list.length-batch.length;
  var host=el("g1-list");
  if(!batch.length){
    if(Q.g1){ host.innerHTML='<div class="card empty"><b>No match.</b>Nothing on the longlist matches “'+esc(Q.g1)+'”.</div>'; return; }
    host.innerHTML='<div class="card empty"><b>Nothing in the queue.</b>'+
      'Log a sweep on the Sourcing tab, or use + Add a role myself. A zero is a result — record it rather than assume the run broke.</div>';
    return;
  }
  host.innerHTML=batch.map(function(r,i){
    var summary = statusHead({label:"Longlist \u2014 gut check", cls:"warm",
        why: esc(r.source==="self"?"Self-found":"Agent-found")+(quadrant(r.fun,r.shot)? " \u00b7 <i>"+esc(quadrant(r.fun,r.shot))+"</i>" : ""),
        primary:[sbtn("accept",r.id,"Send to shortlist","primary")], secondary:[],
        outcome:[sbtn("rejopen",r.id,"Reject","danger")],
        after: closeBlock(r,"g1")});
    /* Roles you pasted wait here for the morning read (5 Oct), and say so. */
    var body = (r.addedVia==="paste"? readBox(r) : "")+cardTabs(r, summary, [
      {k:"details", label:"Overview", html: overviewPanel(r)},
    {k:"fit", label:"Fit", html: fitTab(r)},
      {k:"company", label:"Company", html: researchPanel(r)},
    {k:"questions", label:"Questions", n: qCount(r)||"", html: questionsPanel(r)},
    {k:"notes", label:"Notes", n: notesCount(r), html: notesPanel(r,coOf(r))}
    ], "details");
    /* The same two buttons on the collapsed row, same data-act, so the same handlers run. */
    var quick = '<span class="qacts">'+sbtn("accept",r.id,"Send to shortlist","primary")+
      sbtn("rejopen",r.id,"Reject","danger",' title="Opens the card to pick a reason"')+'</span>';
    return roleShell(r, i+1, "", body, quick);
  }).join("");
  if(queued>0){
    host.insertAdjacentHTML("beforeend",
      '<p class="emptyline"><b class="mono">'+queued+'</b> more queued below the batch. Not rejected, just below the cut.</p>');
  }
}

/* ---------- GATE 2 ---------- */
/* Meeting-aware shortlist (3 Oct): a shortlist role with a meeting booked (e.g. a talent screen
   before deciding to apply) is waiting on that meeting, not on you. Once the meeting date has passed it is
   back on you to decide. Worked out from the role's meetings, so nothing is set by hand. */
function g2Meet(r){
  if(!r || r.stage!=="consideration") return null;
  var t=today(), ms=sessionsFor(r.id).filter(function(c){ return mtItem(c)!=="task" && c.date && (c.state==="booked"||c.state==="done"); });
  var next=ms.filter(function(c){ return c.state==="booked" && c.date>=t; }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); })[0];
  if(next) return {k:"before", c:next};
  var past=ms.filter(function(c){ return c.date<t && c.date>=(r.g1At||""); }).sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); })[0];
  return past? {k:"after", c:past} : null;
}
/* A role moved to the Shortlist waits for the next morning's research before it's on you (4 Oct). */
function g2Pending(r){ return r && r.stage==="consideration" && !r.g2At && !needsRead(r); }
function g2Card(r,parked){
  var e=r.enrich||{}, rules=(e.gate2Rules)||{}, exp=(e.expensive)||{}, cs=convsShown(r), oq=e.openQuestions||[];
  var gm = parked? null : g2Meet(r);
  var pend = !parked && !gm && g2Pending(r);
  var summary = statusHead({label: parked? (r.parkUntil? "Parked until "+niceShort(r.parkUntil) : "Parked") : gm? (gm.k==="before"? "Meeting "+niceShort(gm.c.date) : "Met them "+niceShort(gm.c.date)+" \u2014 decide") : pend? "Queued for research \u2014 decide after" : "Shortlist \u2014 decide",
      cls: parked? "mid" : (gm && gm.k==="before") || pend? "" : "warm", mine:!parked && !(gm && gm.k==="before") && !pend,
      why: (parked&&r.parkUntil? "Review "+esc(r.parkUntil)+". " : "")+(e.summary? esc(clip(e.summary,260)) : "No enrichment yet."),
      primary:[sbtn("g2prep",r.id,"Send to To apply","primary")],
      secondary:[(parked? sbtn("g2back",r.id,"Back to shortlist","ghost") : sbtn("g2park",r.id,"Park \u2014 unsure",""))],
      outcome:[sbtn("rejopen",r.id,"Reject","danger")],
      after:closeBlock(r,"g2")});
  var rulesHtml = '<div class="sechead"><span class="eyebrow">Hard rules and expensive scores \u2014 click any to change it</span></div>'+
      '<div><span class="eyebrow">Hard rules still open</span><div class="rulegrid" style="margin-top:6px">'+
        g2Rules().map(function(g){
          var v=rules[g[0]]||"unknown";
          var m=v==="pass"?"\u2713":v==="fail"?"\u2715":"?";
          return '<button class="rulechk" data-act="rule" data-id="'+r.id+'" data-code="'+g[0]+'" data-v="'+v+'">'+
            '<span class="mark">'+m+'</span><span class="lbl"><span class="mono" style="font-size:10.5px;opacity:.7">'+g[0]+'</span> '+esc(g[1])+'</span></button>';
        }).join("")+'</div></div>'+
      '<div><span class="eyebrow">Expensive scores</span><div class="rulegrid" style="margin-top:6px">'+
        expRules().map(function(g){
          var v=exp[g[0]]||"unknown";
          var m=v==="strong"?"\u25B2":v==="ok"?"\u25A0":v==="weak"?"\u25BC":"?";
          var cls=v==="strong"?"pass":v==="weak"?"fail":"";
          return '<button class="rulechk" data-act="exp" data-id="'+r.id+'" data-code="'+g[0]+'" data-v="'+(cls||"unknown")+'" data-raw="'+v+'">'+
            '<span class="mark">'+m+'</span><span class="lbl"><span class="mono" style="font-size:10.5px;opacity:.7">'+g[0]+'</span> '+esc(g[1])+'</span></button>';
        }).join("")+'</div></div>';
  var body = readBox(r)+cardTabs(r, summary, [
    {k:"details", label:"Overview", html: overviewPanel(r)},
    {k:"fit", label:"Fit", html: fitTab(r)},
    {k:"company", label:"Company", html: researchPanel(r)},
    {k:"questions", label:"Questions", n: qCount(r)||"", html: questionsPanel(r)},
    {k:"prep", label:"Interviews", n: mtInterviewCount(r), html: interviewsPanel(r)},
    {k:"notes", label:"Notes", n: notesCount(r), html: notesPanel(r,coOf(r))}
  ], "details");
  /* Phone-only quick row, same data-acts as the status header (30 Sep). */
  var quick='<span class="qacts">'+sbtn("g2prep",r.id,"To apply","primary")+
    (parked? sbtn("g2back",r.id,"Unpark","") : sbtn("g2park",r.id,"Park",""))+
    sbtn("rejopen",r.id,"Reject","danger",' title="Opens the card to pick a reason"')+'</span>';
  return roleShell(r, null, parked&&r.parkUntil? '<span class="chip mid">review '+esc(r.parkUntil)+'</span>' : "", body, quick);
}

function renderG2(){
  var live=roles.filter(function(r){return r.stage==="consideration";})
    .sort(function(a,b){var ac=days(a.closing),bc=days(b.closing);
      if(ac!=null&&bc!=null) return ac-bc; if(ac!=null) return -1; if(bc!=null) return 1;
      return priRank(coOf(a))-priRank(coOf(b));});
  var parked=roles.filter(function(r){return r.stage==="parked";});
  var nNeed=live.concat(parked).filter(needsRead).length; if(!nNeed) G2_NEEDS=false;
  el("g2-filter").innerHTML = nNeed? '<div class="cofrow" style="margin:0 0 12px"><div class="cofseg">'+
      '<button type="button" class="cof'+(G2_NEEDS?" on":"")+'" data-act="g2needs">'+nNeed+' need'+(nNeed===1?"s":"")+' you</button></div>'+
      (G2_NEEDS? ' <button type="button" class="linkbtn" data-act="g2needs">show all</button>' : "")+'</div>' : "";
  if(G2_NEEDS){ live=live.filter(needsRead); parked=parked.filter(needsRead); }
  live=sortRoles("gate2",live); parked=sortRoles("gate2",parked);
  el("g2-list").innerHTML = live.length? live.map(function(r){return g2Card(r,false);}).join("")
    : '<div class="card empty"><b>Nothing on the shortlist.</b>Roles arrive here from the longlist, or from a manual add — noticing a role and thinking it worth keeping <em>is</em> the longlist.</div>';
  el("park-list").innerHTML = parked.length? parked.map(function(r){return g2Card(r,true);}).join("")
    : '<div class="card empty" style="padding:22px"><b>Nothing parked.</b>Parked needs an expiry or it becomes a graveyard.</div>';
}
