"use strict";
/* ---------- In-card tabs (30 Sep) ----------
   Feedback: "So much info on them now." Every role card is now a summary of what matters for the
   decision in front of the user, then tabs for the rest. Every panel is rendered, only one shown; the
   chosen tab is remembered per card for the session so a re-render does not throw the user back. */
var CTAB={}, PREPSEL={};
/* The phone version of a tab row: a select placed right after it. Hidden above 560px. */
function ctabSel(tabs,cur,sub){
  return '<select class="ctabsel'+(sub?" sub":"")+'" aria-label="Section of this card">'+tabs.map(function(t){
    return '<option value="'+esc(t.k)+'"'+(t.k===cur?" selected":"")+'>'+esc(t.label+(t.n? " · "+t.n : ""))+'</option>';
  }).join("")+'</select>';
}
/* One tab order for every stage (1 Oct, night): tabs appear when relevant but never move.
   Should I go for it, my application, the process, background. */
var CTAB_ORDER=["details","fit","cv","prep","questions","company","notes"];
function cardTabs(r, summary, tabs, dflt){
  tabs=tabs.filter(function(t){return t && t.html;});
  /* Role cards only: company and sector cards share some tab names but keep their own order. */
  if(tabs.every(function(t){ return CTAB_ORDER.indexOf(t.k)>=0; }))
    tabs.sort(function(a,b){ return CTAB_ORDER.indexOf(a.k)-CTAB_ORDER.indexOf(b.k); });
  if(CTAB[r.id]==="pack"||CTAB[r.id]==="sent") CTAB[r.id]="cv";   /* the old Pack and Sent tabs are now CV */
  var cur=CTAB[r.id]; if(!tabs.some(function(t){return t.k===cur;})) cur=dflt||(tabs[0]&&tabs[0].k);
  return '<div class="csum">'+summary+'</div>'+
    '<div class="ctabs" role="tablist">'+tabs.map(function(t){
      return '<button type="button" role="tab" data-act="ctab" data-id="'+esc(r.id)+'" data-k="'+t.k+'" aria-selected="'+(t.k===cur)+'">'+
        esc(t.label)+(t.n? '<span class="tcount">'+t.n+'</span>' : "")+'</button>';
    }).join("")+'</div>'+ctabSel(tabs,cur,false)+
    tabs.map(function(t){
      return '<div class="cpanel" data-cp="'+esc(r.id)+'" data-k="'+t.k+'"'+(t.k===cur?"":" hidden")+'>'+t.html+'</div>';
    }).join("");
}
function keyFacts(r){
  var e=r.enrich||{}, out=[];
  var px=payOf(r,"base")||payOf(r,"total");
  if(px) out.push(chip("", esc(clip(px.v,60))+(PAYTAG[px.kind]? " · "+PAYTAG[px.kind][0] : ""), (px.src||"Pay")+(px.kind? " — "+px.kind : "")));
  if(r.location) out.push(chip("", esc(clip(r.location,48)), "Location"));
  if(r.office) out.push(chip("", esc(clip(r.office,40)), "In office"));
  if(r.referral) out.push(chip("warm", "referral", r.referral));
  return out.length? '<div class="row" style="gap:5px">'+out.join(" ")+'</div>' : "";
}
function asksOf(cs){
  var asks=[]; cs.forEach(function(c){ (c.nextQuestions||[]).forEach(function(q){ if(q) asks.push(q); }); }); return asks;
}
/* Rounds in order: screen prep first, then interviewPrep by key (r1-, r2-, … sort naturally). */
function prepRounds(r){
  var out=[], ip=r.interviewPrep||{};
  if(r.screenPrep) out.push({k:"screen", label:"Screen", sp:r.screenPrep});
  Object.keys(ip).sort().forEach(function(k){
    var p=ip[k]||{}, lab=String(p.round||k).split(/ [-–—] | \(/)[0];
    out.push({k:k, label:lab, p:p});
  });
  return out;
}
function prepTop(r){
  var rp=roundPrepFor(r);
  if(rp) return {k:rp.cid, p:rp.p, sess:rp.sess};
  if(r.screenPrep) return {k:"screen", sp:r.screenPrep};
  return null;
}
function roundBody(r,x){
  if(x.sp){ var sp=x.sp;
    return '<div class="cols advice">'+
      prepSec("Tell me about yourself",prepPara(sp.tellMe))+prepSec("Proof point",prepPara(sp.proofPoint))+
      prepSec("Why this role",ulist(sp.whyRole))+prepSec("Why this company",ulist(sp.whyCompany))+
      prepSec("Likely questions",ulist(sp.likelyQuestions))+prepSec("Avoid saying",ulist(sp.avoid),"avoid")+
      prepSec("Ask them",ulist(sp.askThem))+prepSec("Salary",prepPara(sp.salary))+prepSec("Logistics",prepPara(sp.logistics))+'</div>';
  }
  var p=x.p;
  return (p.tests? '<div class="notice" style="font-size:13px"><b>What it really tests.</b> '+esc(p.tests)+'</div>' : "")+
    '<div class="cols advice">'+prepSec("Lead with",ulist(p.focus))+prepSec("Stories to have ready",ulist(p.stories))+
      prepSec("Avoid saying",ulist(p.avoid),"avoid")+prepSec("Likely questions",ulist(p.likelyQuestions))+
      prepSec("Ask them",ulist(p.askThem))+'</div>';
}
function prepPanel(r){
  var rounds=prepRounds(r);
  if(!rounds.length) return '<div class="notice" style="font-size:12.5px"><b>No interview prep yet.</b> The morning task writes screen prep once a role is applied, and prep for each known round once the process is known. To have it sooner, ask Claude to prep the interview for this role.</div>'+
    '<div class="row"><button class="btn" data-act="mockfrom" data-id="'+r.id+'" data-cid="">Practise anyway</button></div>';
  var top=prepTop(r), sel=PREPSEL[r.id];
  if(!rounds.some(function(x){return x.k===sel;})) sel= top? top.k : rounds[0].k;
  var x=rounds.filter(function(y){return y.k===sel;})[0];
  var p=x.p||{};
  return '<div class="row" style="gap:6px">'+rounds.map(function(y){
      return '<button type="button" class="pill" data-act="prepsel" data-id="'+esc(r.id)+'" data-k="'+esc(y.k)+'" aria-pressed="'+(y.k===sel)+'">'+
        esc(y.label)+((y.p&&y.p.next)||(top&&top.k===y.k&&y.k!=="screen")? ' · next' : "")+'</button>';
    }).join("")+
    '<button class="btn primary" data-act="mockfrom" data-id="'+r.id+'" data-cid="'+esc(x.k)+'" style="margin-left:auto">Practise '+esc(x.k==="screen"?"the screen":x.label)+'</button></div>'+
    secHead(x.k==="screen"? "Screen prep" : (p.round||x.label), "prep", r.id+"~"+x.k, p.type? '<span class="chip">'+esc(MOCKTYPES[p.type]||p.type)+'</span>' : "")+
    roundBody(r,x)+
    ((x.p||x.sp).builtAt? '<div class="statushint">Built '+esc(niceShort((x.p||x.sp).builtAt))+' by the morning task.</div>' : "");
}
/* The one-glance line on an In play summary: what is next, the one thing to lead with, the one
   thing not to say. */
function nextUp(r){
  /* Only while there is something to prepare for. Waiting for feedback, chasing or writing up is
     not the moment for "lead with" (30 Sep). */
  var fk=playStatus(r).k; if(fk!=="prep" && fk!=="ready" && fk!=="slot") return "";
  var nx=nextSessionOf(r.id), top=prepTop(r);
  var what = nx? '<b>'+esc(nx.title||"Next meeting")+'</b> · '+esc(nextLabel(nx)) :
    top&&top.p? '<b>'+esc(top.p.round||"Next round")+'</b> · <span style="color:var(--muted)">not booked yet</span>' :
    '<span style="color:var(--muted)">Nothing booked</span>';
  var src = top? (top.p||top.sp) : null;
  var focus = src? ((src.focus||[])[0] || src.proofPoint || "") : "";
  var trap = src? ((src.avoid||[])[0]||"") : "";
  return '<div class="nextup">'+
    '<div class="row" style="gap:8px"><span class="eyebrow">Next</span><span style="font-size:13.5px">'+what+'</span>'+
      '</div>'+   /* Practise moved to the card's actions (2 Oct): it now goes to this round. */
    (focus? '<div class="nuline"><span class="nutag good">Lead with</span><span>'+esc(focus)+'</span></div>' : "")+
    (trap? '<div class="nuline"><span class="nutag bad">Don’t say</span><span>'+esc(trap)+'</span></div>' : "")+
  '</div>';
}

/* ---------- Section editors (30 Sep) ----------
   Feedback: "all the sections need to be editable. Each and every section on all tabs." Each tab
   section gets its own editor, built on the same editBox machinery as Edit details. A section
   editor's id can name a part of a document (role~round), so the spec supplies the fields and the
   document to write through dyn(id). */
var PAIR_SEP = " — ";
function roleOfSec(id){ var rid=String(id).split("~")[0]; return rawRoles.find(function(x){return x.id===rid;}); }
var MOCKTYPE_OPTS = Object.keys(MOCKTYPES).map(function(k){return [k,MOCKTYPES[k]];});
EDIT_SPEC.prep = {coll:"roles", find:roleOfSec, dyn:function(id){
  var parts=String(id).split("~"), k=parts[1], rid=parts[0];
  if(k==="screen") return {docId:rid, key:[
    ["screenPrep.tellMe","Tell me about yourself","area"],["screenPrep.proofPoint","Proof point","area"],
    ["screenPrep.whyRole","Why this role — one per line","list"],["screenPrep.whyCompany","Why this company — one per line","list"],
    ["screenPrep.likelyQuestions","Likely questions — one per line","list"],["screenPrep.avoid","Avoid saying — one per line","list"],
    ["screenPrep.askThem","Ask them — one per line","list"],["screenPrep.salary","Salary","area"],["screenPrep.logistics","Logistics","area"]], more:[]};
  var b="interviewPrep."+k+".";
  return {docId:rid, key:[
    [b+"round","Round","text",{wide:1}],[b+"type","Round type","select",MOCKTYPE_OPTS],
    [b+"tests","What it really tests","area"],
    [b+"focus","Lead with — one per line","list"],[b+"stories","Stories to have ready — one per line","list"],
    [b+"avoid","Avoid saying — one per line","list"],[b+"likelyQuestions","Likely questions — one per line","list"],
    [b+"askThem","Ask them — one per line","list"],[b+"mock.focus","Mock interview focus","area"]],
    more:[[b+"commitmentId","Booked meeting it belongs to — id","text"]]};
}};
EDIT_SPEC.research = {coll:"roles", find:roleOfSec, key:[
  ["enrich.summary","Summary","area"],["enrich.openQuestions","Open questions — one per line","list"],
  ["enrich.health","Company health","area"],["enrich.culture","How the role is written","area"],
  ["enrich.seatPackage","Package — this seat","area"],["g2Note","Shortlist note","area"]], more:[]};
EDIT_SPEC.facts = {coll:"roles", find:roleOfSec, key:[
  ["title","Title","text"],["company","Company name as shown","text"],["url","Posting URL","text",{wide:1}],
  ["location","Location","text"],["office","In office","text"],["salary","Base / salary","text"],
  ["closing","Closing date","date"],["referral","Referral — who, and where it stands","text",{wide:1}],
  ["red","Red flags — one per line","list"],["green","Upside flags — one per line","list"],
  ["postingAge","Posting age","text"]], more:[]};
/* A role can count on sector cards directly, beyond its company's card (2 Oct): a payments role
   at a travel company counts on a payments sector card. */
EDIT_SPEC.role.key.push(["sectorIds","Also counts on these sector cards — beyond its company’s own","sectors",{wide:1}]);
EDIT_SPEC.packcv = {coll:"roles", find:roleOfSec, key:[["pack.cv","CV file","text"],
  ["pack.cvChanges","What changed on the CV — one per line, “what — why”","pairs",{keys:["what","why"]}],["pack.builtAt","Built","date"],["pack.folder","Folder","text",{wide:1}]], more:[]};
EDIT_SPEC.packlet = {coll:"roles", find:roleOfSec, key:[["pack.letter","Cover letter file","text"],["pack.letterAngle","The letter’s argument","area"]], more:[]};
EDIT_SPEC.packgaps = {coll:"roles", find:roleOfSec, key:[["pack.gaps","Gaps to check — one per line","list"]], more:[]};
EDIT_SPEC.pack = {coll:"roles", find:roleOfSec, key:[
  ["pack.folder","Folder","text",{wide:1}],["pack.cv","CV file","text"],["pack.letter","Cover letter file","text"],
  ["pack.letterAngle","The letter’s argument","area"],
  ["pack.cvChanges","What changed on the CV — one per line, “what — why”","pairs",{keys:["what","why"]}],
  ["pack.gaps","Gaps to check — one per line","list"],["pack.builtAt","Built","date"]], more:[]};
EDIT_SPEC.intel = {coll:"companies", find:function(id){return companies.find(function(x){return x.id===id;});}, key:[
  ["interviewIntel.stages","Interview stages — one per line","list"],["interviewIntel.notes","How they interview","area"],
  ["interviewIntel.reported","Reported questions — one per line, “question — stage — source”","pairs",{keys:["q","stage","source"]}],
  ["interviewIntel.sources","Sources — one URL per line","list"],["interviewIntel.researchedAt","Researched","date"]], more:[]};
function specOf(kind,id){
  var sp=EDIT_SPEC[kind]; if(!sp) return null;
  return sp.dyn? Object.assign({},sp,sp.dyn(id)) : sp;
}
/* The section header every tab panel uses: a title, and an Edit button that opens that section's
   editor in place. */
function secHead(title,kind,id,extra){
  var open=!!EDITING[editKey(kind,id)];
  return '<div class="sechead'+(title?"":" bare")+'"><span class="eyebrow">'+esc(title)+'</span>'+(extra||"")+
    '<button type="button" class="btn ghost edbtn" data-act="ed_open" data-k="'+kind+'" data-id="'+esc(id)+'" style="margin-left:auto">'+
    "Edit"+'</button></div>'+editBox(kind,id);
}
/* ---------- The status header (30 Sep) ----------
   One block, top of every card: where it stands in one line, then the buttons grouped by what they
   do — move it forward · step back · end it. */
function sbtn(act,id,label,cls,extra){
  return '<button class="btn '+(cls||"")+'" data-act="'+act+'" data-id="'+esc(id)+'"'+(extra||"")+'>'+esc(label)+'</button>';
}
function statusHead(o){
  /* One line, the same as In play (30 Sep): STATUS and its pill, the one forward move
     beside it, every other stage move grouped on the right. No explanation line. */
  var right=(o.secondary||[]).concat(o.outcome||[]).filter(Boolean);
  return '<div class="shead compact'+(o.mine?" mine":"")+'">'+
    '<div class="srow">'+
      '<span class="eyebrow">Status</span><span class="spill '+(o.cls||"")+'">'+esc(o.label)+'</span>'+
      (o.clock? '<span class="chip code">by the clock</span>' : "")+
      (o.primary||[]).join("")+
      (right.length? '<div class="bgroup outcome">'+right.join("")+'</div>' : "")+
    '</div>'+(o.after||"")+
  '</div>';
}

/* ---------- v64 card structure (30 Sep, evening) ----------
   the user's layout: Overview (scores · core info · fit) · Research (company · role · open questions)
   · Meetings (notes attached to the meeting they came from) · Interviewing (cross-stage advice, then
   each stage with its status and its advice). The posting link lives on the collapsed row. */
var STAGEOPEN={};
/* The one status every collapsed row shows, top right (30 Sep). */
function stageStatusChip(r){
  var map={proposed:["Longlist \u2014 gut check","warm"], consideration:["Shortlist \u2014 decide","warm"], parked:["Parked","mid"],
    prep:[packReady(r)? "Ready to apply":"To apply \u2014 CV pending", packReady(r)? "strong":"mid"],
    closed:["Closed"+(r.closedAfter? " after "+r.closedAfter:""),"weak"], g1_rejected:["Dropped from longlist","weak"], g2_rejected:["Dropped from shortlist","weak"]};
  var x;
  if(r.stage==="applied"||r.stage==="offer"){ var st=playStatus(r); x=[st.label, st.cls]; }
  else if(needsRead(r) && GATES[r.stage]) x=["Needs you: "+(READWHY[r.readReason]||"can\'t read"),"weak"];
  /* Meeting-aware shortlist (3 Oct): waiting on a booked meeting, or met and back on you. */
  else if(r.stage==="consideration" && g2Meet(r)){ var gm=g2Meet(r);
    /* Short labels (5 Oct): the company must still fit beside the chip on a phone. */
    x = gm.k==="before"? ["Meeting "+niceShort(gm.c.date),"","Waiting on this meeting. It comes back to you to decide once it has happened."]
      : ["Met "+niceShort(gm.c.date),"warm","You've met them: it's back on you to decide."]; }
  /* Was "Reading tonight", which read like homework (2 Oct). Neutral colour: nothing for you to do. */
  else if(r.readState==="waiting" && GATES[r.stage]) x=["Queued for research","",'The morning run will read the posting and research the role. Nothing for you to do yet.'];
  else if(typeof g2Pending==="function" && g2Pending(r)) x=["Queued for research","","The morning run researches it first. Nothing for you to do yet."];
  else x=map[r.stage]||[r.stage||"",""];
  var dflt = x===map.proposed || x===map.consideration;   /* says nothing the tab doesn't */
  return '<span class="spill sm '+(x[1]||"")+(dflt?" dflt":"")+'"'+(x[2]? ' title="'+esc(x[2])+'"' : "")+'>'+esc(x[0])+'</span>';
}
function postLink(r){
  var IC='<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DOC='<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4 1.8h5.2L12.5 5v9.2H4z M9 1.8V5h3.5 M6 8h4.5M6 10.5h4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  if(r.url && /^https?:\/\//i.test(String(r.url).trim())) return '<a class="postlink" href="'+esc(r.url)+'" target="_blank" rel="noopener" title="Open the posting \u2014 '+esc(hostOf(r.url))+'" aria-label="Open the posting">'+IC+'<span>Job ad</span></a>';
  /* No link (2 Oct): a spec file opens from the board; pasted text is marked, not linked. */
  if(r.spec && r.spec.id) return assetLink(r.spec,DOC+'<span>Job spec</span>',"postlink","Job spec \u2014 "+(r.company||""));
  if(r.pasted) return '<span class="postlink nolink" title="Posting pasted \u2014 read on the card" aria-label="Posting pasted">'+DOC+'<span>Posting pasted</span></span>';
  return "";
}
function curScores(r){
  var first=(r.fun==null && r.shot==null) || r.stage==="proposed";
  return {f: first? r.fun : (r.fun2!=null? r.fun2 : r.fun), s: first? r.shot : (r.shot2!=null? r.shot2 : r.shot),
          ff: first? "fun":"fun2", sf: first? "shot":"shot2"};
}
/* Header row shared by the Overview boxes (1 Oct, night): title, a line on what it is, optional right side. */
function boxHead(t,sub,right,meta){ return '<div class="fhtop"><div class="fhtl"><span class="fhtitle">'+esc(t)+'</span><span class="fhsub">'+esc(sub)+'</span>'+
  (meta? '<span class="fhmeta">'+esc(meta)+'</span>' : "")+'</div>'+(right||"")+'</div>'; }
function scoreBlock(r){
  var c=curScores(r), q=quadrant(c.f,c.s);
  return '<div class="fithd scard">'+boxHead("Scores","How fun it would be, and your shot at it")+
    '<div class="scores">'+
      '<div class="scorer"><span class="lab">Fun</span>'+pips(r.id,c.ff,c.f)+'</div>'+
      '<div class="scorer"><span class="lab">Shot</span>'+pips(r.id,c.sf,c.s)+'</div>'+
      (q? '<span class="spill '+(/priority/.test(q)?"strong":/do not/.test(q)?"weak":/stretch/.test(q)?"warm":"mid")+'">'+esc(q)+'</span>' : '<span class="chip mid">unscored</span>')+
    '</div></div>';
}
function coreInfo(r){
  var e=r.enrich||{};
  function cell(k,v,na){ v=String(v||"").replace(/^posted posted/i,"posted"); return '<div class="fact"><div class="k">'+k+'</div><div class="v'+(v?"":" na")+'" title="'+esc(v)+'">'+esc(v? clip(v,80) : (na||"not stated"))+'</div></div>'; }
  var work = r.office || r.location || "";
  var pk = e.seatPackage || r.salary || "";
  var cl = closingLabel(r);
  var ref = r.referral? ("Yes — "+clip(r.referral,90)) : (r.warm? "Warm route at the company" : "No");
  /* The linked company record is shown because it is editable here (30 Sep: an edit for
     something not on screen is odd). Unlinked is flagged, since the company research cannot show. */
  var co=coOf(r);
  var coCell = co? '<div class="fact"><div class="k">Company record</div><div class="v">'+esc(co.name||co.id)+'</div></div>'
    : '<div class="fact"><div class="k">Company record</div><div class="v"><span class="chip mid" title="Edit to link one \u2014 until then the company research cannot show">Not linked</span></div></div>';
  return '<div class="fithd ccard">'+boxHead("Core info","The facts that decide whether it works")+'<div class="facts core">'+
    coCell+postingCell(r)+liveCell(r)+cell("Package",pk)+cell("Closing",cl)+cell("Referred",ref)+
    /* Closing already falls back to the posting age when there is no closing date — don't say it twice. */
    (r.closing? cell("Posting age",r.postingAge,"not known") : "")+
    cell("Found through",[r.source==="self"?"Me":"Agent", srcLabel(r)].filter(Boolean).join(" · "))+
    (function(){ var ids=[]; if(co && co.sectorId) ids.push(co.sectorId); (r.sectorIds||[]).forEach(function(i){ if(ids.indexOf(i)<0) ids.push(i); });
      return ids.length? cell("Sector cards",ids.map(function(i){ var x=sectors.find(function(s2){return s2.id===i;}); return x? x.name : i; }).join(", ")) : ""; })()+'</div></div>';
}
function overviewPanel(r){
  var e=r.enrich||{}, co=coOf(r);
  /* "Summary" and its Edit button share one line (1 Oct: Edit sat on top of the text). */
  var sum = e.summary? '<div class="ovsec"><p style="margin:0;font-size:13.5px;color:var(--ink-2)">'+esc(e.summary)+'</p></div>' : "";
  var extra = (r.stage==="parked" && r.parkUntil? '<div class="ovsec"><span class="eyebrow">Parked until</span><span style="font-size:13px">'+esc(niceShort(r.parkUntil))+'</span></div>' : "")+
    (r.stage==="closed"||/rejected/.test(r.stage||"")? para("Why it ended",[r.closedNote,r.rejectNote,r.g1Note].filter(Boolean).join(" \u00b7 ")) : "");
  if(r.intakeNote) extra+=para("Your notes when you added it",r.intakeNote);
  if(r.pasted && !e.summary) extra+=foldRow("pasted:"+r.id,"The posting text you pasted","",'<p style="margin:0;font-size:13px;white-space:pre-wrap;color:var(--ink-2)">'+esc(clip(r.pasted,6000))+'</p>');
  return secHead(e.summary? "Summary" : "Role facts","facts",r.id)+sum+adFold(r)+fitHeads(r)+
    /* Scores and core info as boxes like the criteria ones: four shapes on desktop (1 Oct, night). */
    '<div class="ovsec"><div class="ovboxes">'+scoreBlock(r)+coreInfo(r)+'</div></div>'+extra;
}
/* The job ad, summarised (6 Oct): adSummary, written by next-role-apply-pack at To apply. A fold under the summary,
   closed by default. Edit opens a form; Remove lives inside it and leaves {removed:true} so the morning run
   doesn't write it again. */
function adOk(a){ return a && typeof a==="object" && !a.removed && ["purpose","scope","product","success","process"].some(function(k){ return a[k]; }) || (a && !a.removed && (a.responsibilities||[]).length); }
function adFold(r){
  var a=r.adSummary; if(!adOk(a)) return "";
  var rs=(a.responsibilities||[]).filter(Boolean), nb=(a.notable||[]).filter(Boolean);
  var src='From '+(a.from==="pasted"? "the ad you pasted" : "the ad")+(a.at? ", "+esc(niceShort(a.at)) : "")+
    (a.url? ' · <a href="'+esc(a.url)+'" target="_blank" rel="noopener">source</a>' : "");
  var body='<div class="adsum">'+
    '<div class="row" style="justify-content:space-between;gap:8px"><span class="statushint">'+src+'</span>'+
      '<button type="button" class="btn sm ghost" data-adsum="'+esc(r.id)+'">Edit</button></div>'+
    para("Why the role exists",a.purpose)+para("Scope and team",a.scope)+para("Product and users",a.product)+
    listSec("Responsibilities",rs)+para("What success looks like",a.success)+para("Hiring process",a.process)+listSec("Also notable",nb)+'</div>';
  var meta=rs.length? rs.length+" responsibilit"+(rs.length===1?"y":"ies") : "";
  return '<div class="ovsec">'+foldRow("adsum:"+r.id,"The job ad",meta,body)+'</div>';
}
function adEdit(id){
  var r=rawRoles.find(function(x){ return x.id===id; }); if(!r) return;
  var a=r.adSummary||{}, ln=function(x){ return (x||[]).join("\n"); }, sp=function(t){ return String(t||"").split(/\n+/).map(function(x){return x.trim();}).filter(Boolean); };
  openForm({title:"The job ad — "+(r.title||""), lede:"The summary the mock interview, interview prep and CV packs use.",
    fields:[{id:"purpose",label:"Why the role exists",type:"area",rows:2,value:a.purpose},
      {id:"scope",label:"Scope and team",type:"area",rows:2,value:a.scope},
      {id:"product",label:"Product and users",type:"area",rows:2,value:a.product},
      {id:"resp",label:"Responsibilities — one per line",type:"area",rows:5,value:ln(a.responsibilities)},
      {id:"success",label:"What success looks like",type:"area",rows:2,value:a.success},
      {id:"process",label:"Hiring process",type:"area",rows:2,value:a.process},
      {id:"notable",label:"Also notable — one per line",type:"area",rows:3,value:ln(a.notable)}],
    onSave:function(v){
      var n=Object.assign({},a,{purpose:v.purpose, scope:v.scope, product:v.product, responsibilities:sp(v.resp), success:v.success,
        process:v.process, notable:sp(v.notable), editedAt:today()});
      if(!adOk(n)) return "Add something, or use Remove.";
      save(id,{adSummary:n}); toast("Job ad summary saved"); return "";
    },
    del:function(){ var old=a; save(id,{adSummary:{removed:true, at:today()}});
      toastUndo("Job ad summary removed",function(){ save(id,{adSummary:Object.assign({},old,{removed:{__delete__:true}})}); }); },
    delLabel:"Remove"});
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-adsum]"); if(!b) return;
  ev.preventDefault(); ev.stopPropagation(); adEdit(b.dataset.adsum);
});
function subTabs(key, tabs, dflt){
  tabs=tabs.filter(function(t){return t && t.html;});
  var cur=CTAB[key]; if(!tabs.some(function(t){return t.k===cur;})) cur=dflt||(tabs[0]&&tabs[0].k);
  return '<div class="ctabs sub" role="tablist">'+tabs.map(function(t){
      return '<button type="button" role="tab" data-act="ctab" data-id="'+esc(key)+'" data-k="'+t.k+'" aria-selected="'+(t.k===cur)+'">'+
        esc(t.label)+(t.n? '<span class="tcount">'+t.n+'</span>' : "")+'</button>';
    }).join("")+'</div>'+ctabSel(tabs,cur,true)+
    tabs.map(function(t){ return '<div class="cpanel" data-cp="'+esc(key)+'" data-k="'+t.k+'"'+(t.k===cur?"":" hidden")+'>'+t.html+'</div>'; }).join("");
}
function para(label,v){ return v? '<div><span class="eyebrow">'+esc(label)+'</span><p style="margin:3px 0 0;font-size:13px;color:var(--ink-2);white-space:pre-wrap">'+esc(v)+'</p></div>' : ""; }
function listSec(label,arr,cls){ arr=(arr||[]).filter(Boolean); return arr.length? '<div class="'+(cls||"")+'"><span class="eyebrow">'+esc(label)+'</span>'+ulist(arr)+'</div>' : ""; }
function researchPanel(r){
  var e=r.enrich||{}, co=coOf(r), cs=convsShown(r);
  /* Four cards, 2x2 (1 Oct, night): details and research on top, pluses and concerns below. */
  function card(cls,t,sub,inner,empty){ return '<div class="fithd '+cls+'">'+boxHead(t,sub)+(inner||'<p class="emptyline">'+esc(empty)+'</p>')+'</div>'; }
  function lst(arr,cls){ arr=(arr||[]).filter(Boolean); return arr.length? '<ul class="qlist cobul'+(cls?" "+cls:"")+'">'+arr.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul>' : ""; }
  var comp = co? secHead(co.name||r.company,"company",co.id)+
      '<div class="cogrid">'+
        card("codet","Company details","Who they are",
          '<div class="facts">'+fact("Sector",co.sector)+(secOfCo(co)? fact("Sector card",secOfCo(co).name) : "")+fact("Size",co.size)+fact("HQ",co.hq)+fact("Sites",co.sites)+fact("Office days",coOfficeTxt(co))+'</div>',"No details yet.")+
        card("cores","Company research","What it’s like to work there",
          [para("Company health",co.health||e.health),para("What it is like inside",co.culture),para("AI",co.ai),para("Pay picture",co.comp),para("The ladder",co.ladder)].join(""),"No research yet.")+
        card("coplus","Pluses","What counts in its favour",lst(co.green),"None noted yet.")+
        card("coneg","Concerns","What counts against it",lst(co.red,"neg"),"None noted yet.")+
      '</div>'
    : '<p class="lede" style="margin:0">No company record linked to this role.</p>'+para("Company health",e.health);
  return comp;
}
/* Research tab removed (1 Oct): Company and Notes are card tabs of their own. */
function notesCount(r){ var co=coOf(r); return ((r.notes||[]).length+((co&&co.notes)||[]).length+(r.g2Note?1:0))||""; }
/* Research holds known facts; Notes is for facts that do not fit the forms (1 Oct). */
function notesPanel(r,co){
  var rn=r.notes||[], cn=(co&&co.notes)||[];
  function li(n,act,i){ return '<li>'+esc(n.text)+' <span style="color:var(--faint);font-size:11.5px">'+esc(n.at?niceShort(n.at):"")+'</span>'+
    (act? ' <button class="btn danger sm" data-act="'+act+'" data-id="'+esc(r.id)+'" data-i="'+i+'">Remove</button>' : "")+'</li>'; }
  return '<div class="ivtab">'+
    /* Live roles add notes from the card's "+ Add" menu (2 Oct); an empty list keeps a quiet link. */
    ((typeof CARD_ACT_ST!=="undefined" && CARD_ACT_ST[r.stage])
      ? '<div class="ivsec">'+ivHead("Notes about this role","","")+(rn.length? noteList(rn,"role_delnote",r.id)
          : '<p class="emptyline">Nothing yet. <button type="button" class="linkbtn" data-act="note_open" data-kind="role" data-id="'+esc(r.id)+'">Add a note</button></p>')+'</div>'
      : '<div class="ivsec">'+ivHead("Notes about this role","",noteBtn("role",r.id))+noteList(rn,"role_delnote",r.id)+'</div>')+
    (cn.length? '<div class="ivsec">'+ivHead("About "+(co.name||r.company)+", from the company card","","")+noteList(cn,"",r.id)+'</div>' : "")+
    (r.g2Note? '<div class="ivsec">'+ivHead("Research log","","")+'<p style="margin:0;font-size:13px;color:var(--ink-2);white-space:pre-wrap">'+esc(r.g2Note)+'</p></div>' : "")+
  '</div>';
}
/* ---------- Answers to questions (1 Oct, night) ----------
   A question can carry an answer. Answered questions move to an Answered fold, so the open list stays
   short and nothing is lost. Role questions are answered on the role; company and sector questions on
   the company (a sector question gets a different answer at each company). Stored as arrays,
   qAnswers: [{q, a, at, src:"you"|"notes", convId}], so the question lists themselves don't change.
   When notes are logged, the board asks Claude which open questions they answer; those wait as
   suggestions (role.qSuggest) until accepted — a wrong match must never quietly close a question. */
var QA_OPEN={}, QA_BUSY={}, QA_DRAFT={};
/* Questions as rows (3 Oct): edit or add one question at a time, like the deal-breakers,
   instead of one text box per card. QA_EDIT holds the question being reworded, QA_ADD the card with
   an add box open; drafts survive re-renders. */
var QA_EDIT={}, QA_ADD={}, QA_EDRAFT={};
function qaEKey(k,id,q){ return k+"|"+id+"|"+(q==null? "+" : qaNorm(q)); }
function qaEForm(rm,r,q,val,mode){
  var a=' data-rk="'+rm.k+'" data-rid="'+esc(rm.id)+'" data-role="'+esc(r? r.id : "")+'"'+(mode==="edit"? ' data-q="'+esc(q)+'"' : "");
  return '<div class="qaeform" data-mode="'+mode+'"'+a+'>'+
    '<input type="text" value="'+esc(val||"")+'" placeholder="'+(mode==="edit"? "The question" : "A short question to ask them")+'" aria-label="Question">'+
    '<div class="row" style="gap:6px"><button type="button" class="btn sm primary" data-act="qa_esave">'+(mode==="edit"? "Save" : "Add question")+'</button>'+
    '<button type="button" class="btn sm ghost" data-act="qa_ecancel">Cancel</button></div></div>';
}
function qaAddBtn(k,id,r,lab){
  return '<button type="button" class="btn ghost edbtn" data-act="qa_add" data-rk="'+k+'" data-rid="'+esc(id)+'" data-role="'+esc(r? r.id : "")+'">'+esc(lab||"+ Add a question")+'</button>';
}
function qaAddRow(k,id,r){ var ak=qaEKey(k,id,null); return QA_ADD[ak]? qaEForm({k:k,id:id},r,"",QA_EDRAFT[ak]||"","add") : ""; }
/* Change one store's list of questions. fn gets the array and returns the new one. */
function qaSetList(k,id,roleId,fn){
  var r=roles.find(function(x){return x.id===roleId;});
  function fail(e){ console.warn("question",e&&e.code); toast("Couldn't save the question — try again",true); }
  if(k==="role" && r){ var en=JSON.parse(JSON.stringify(r.enrich||{})); en.openQuestions=fn((en.openQuestions||[]).slice()); r.enrich=en; render();
    if(DB) DB.doc("roles/"+r.id).update({enrich:en}).catch(fail); return true; }
  if(k==="company"){ var co=companies.find(function(x){return x.id===id;}); if(!co) return false;
    co.questions=fn((co.questions||[]).slice()); render(); if(DB) DB.doc("companies/"+co.id).update({questions:co.questions}).catch(fail); return true; }
  if(k==="sector"){ var sc=sectors.find(function(x){return x.id===id;}); if(!sc) return false;
    sc.questions=fn((sc.questions||[]).slice()); render(); if(DB) DB.doc("sectors/"+sc.id).update({questions:sc.questions}).catch(fail); return true; }
  if(k==="asks" && r){ convsShown(r).forEach(function(c){ var before=c.nextQuestions||[], nq=fn(before.slice());
      if(JSON.stringify(nq)!==JSON.stringify(before)){ c.nextQuestions=nq; if(DB) DB.doc("conversations/"+c.id).update({nextQuestions:nq}).catch(fail); } });
    render(); return true; }
  return false;
}
function qaESave(f){
  var inp=f.querySelector("input"), v=inp.value.trim().replace(/\s+/g," "); if(!v){ inp.focus(); return; }
  var k=f.dataset.rk, id=f.dataset.rid, mode=f.dataset.mode, old=f.dataset.q||"", n=qaNorm(old), nv=qaNorm(v);
  var ek=qaEKey(k,id,mode==="edit"? old : null);
  delete QA_EDIT[ek]; delete QA_ADD[ek]; delete QA_EDRAFT[ek];
  /* A reworded question keeps its star. */
  if(mode==="edit" && n!==nv){ var erm={k:k,id:id}, er=roles.find(function(x){return x.id===f.dataset.role;}), sd=qaStarDoc(erm,er);
    if(sd && qaIsStar(sd,old)) qaSetStar(erm,er,old,true,v); }
  qaSetList(k,id,f.dataset.role,function(arr){
    if(mode==="edit") return arr.reduce(function(o,x){ var m=qaNorm(x)===n? v : x; if(!o.some(function(y){return qaNorm(y)===qaNorm(m);})) o.push(m); return o; },[]);
    if(arr.some(function(x){ return qaNorm(x)===nv; })) return arr;
    arr.push(v); return arr;
  });
  toast(mode==="edit"? "Question saved" : "Question added");
}
document.addEventListener("input",function(ev){ var f=ev.target.closest && ev.target.closest(".qaeform"); if(f) QA_EDRAFT[qaEKey(f.dataset.rk,f.dataset.rid,f.dataset.mode==="edit"? f.dataset.q : null)]=ev.target.value; });
document.addEventListener("keydown",function(ev){
  var f=ev.target.closest && ev.target.closest(".qaeform"); if(!f) return;
  if(ev.key==="Enter"){ ev.preventDefault(); qaESave(f); }
  else if(ev.key==="Escape"){ ev.preventDefault(); ev.stopPropagation(); var b=f.querySelector('[data-act="qa_ecancel"]'); if(b) b.click(); }
});
/* Starred questions (3 Oct): `qStar` on the doc that holds the question — the role (its own questions and
   its meeting-note ones), the company or the sector — as a list of the question texts. Kept apart from the
   question lists, which the skills read as plain text. */
function qaStarDoc(rm,r){
  if(rm.k==="role"||rm.k==="asks") return r||roles.find(function(x){return x.id===rm.id;});
  if(rm.k==="company") return companies.find(function(x){return x.id===rm.id;});
  if(rm.k==="sector") return sectors.find(function(x){return x.id===rm.id;});
  return null;
}
function qaStarColl(rm){ return rm.k==="company"? "companies/" : rm.k==="sector"? "sectors/" : "roles/"; }
function qaIsStar(doc,q){ var n=qaNorm(q); return ((doc&&doc.qStar)||[]).some(function(x){ return qaNorm(x)===n; }); }
function qaSetStar(rm,r,q,on,newQ){
  var doc=qaStarDoc(rm,r); if(!doc) return;
  var n=qaNorm(q), arr=(doc.qStar||[]).filter(function(x){ return qaNorm(x)!==n; });
  if(on) arr.push(newQ||q);
  doc.qStar=arr; render();
  if(DB) DB.doc(qaStarColl(rm)+doc.id).update({qStar:arr}).catch(function(e){ console.warn("star",e&&e.code); toast("Couldn't save the star — try again",true); });
}
/* How many open questions in a card are starred, for its header. */
function qaStarCount(rm,r,qs,scope,sid){
  var doc=qaStarDoc(rm,r), adoc=qaDoc(scope,sid); if(!doc) return 0;
  return (qs||[]).filter(function(q){ return qaIsStar(doc,q) && !qaGet(adoc,q); }).length;
}
/* The card can be redrawn into the side panel just after render, so try again until a visible box has focus (QA 15 Oct). */
function qaFocusE(){ [0,60,200].forEach(function(ms){ setTimeout(function(){
  var all=document.querySelectorAll(".qaeform input"), i=null; for(var k=0;k<all.length;k++){ if(all[k].offsetParent){ i=all[k]; break; } }
  if(i && document.activeElement!==i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } },ms); }); }
/* Keep a half-typed answer across re-renders (live updates redraw the card). */
document.addEventListener("input",function(ev){ var f=ev.target.closest && ev.target.closest(".qaform"); if(f) QA_DRAFT[qaKey(f.dataset.scope,f.dataset.sid,f.dataset.q)]=ev.target.value; });
function qaNorm(q){ return String(q||"").trim().toLowerCase().replace(/\s+/g," "); }
function qaDoc(scope,sid){ return scope==="role"? roles.find(function(x){return x.id===sid;}) : companies.find(function(x){return x.id===sid;}); }
function qaGet(doc,q){ var n=qaNorm(q); return ((doc&&doc.qAnswers)||[]).find(function(x){ return qaNorm(x.q)===n; }); }
function qaKey(scope,sid,q){ return scope+"|"+sid+"|"+qaNorm(q); }
function qaWrite(scope,sid,q,a,src,convId){
  var doc=qaDoc(scope,sid); if(!doc) return;
  var n=qaNorm(q), arr=(doc.qAnswers||[]).filter(function(x){ return qaNorm(x.q)!==n; });
  if(a) arr.push({q:q, a:a, at:today(), src:src||"you", convId:convId||""});
  doc.qAnswers=arr; render();
  if(DB) DB.doc((scope==="role"?"roles/":"companies/")+sid).update({qAnswers:arr}).catch(function(e){ console.warn("answer",e&&e.code); toast("Couldn't save the answer — try again",true); });
}
/* Which of their criteria an answer may bear on: a nudge to review Fit, never an automatic change. */
/* Matched to the types on the user's deal-breakers and preferences (22 Oct), never to fixed rule numbers. */
var QA_CRIT=[[/pay|salary|band|package|pension|bonus|equity|rsu|compensation|£|\$|€/i,["pay"]],
  [/office|days|hybrid|remote|on-?site|travel|commute|in person/i,["office"]],
  [/contract|permanent|fixed[- ]term|freelance|part[- ]time|fractional|temporary/i,["contract"]], [/hours|on-?call|weekend|overtime/i,["hours"]],
  [/visa|right to work|sponsor|entity|payroll|eor/i,["rtw"]], [/\btitle\b/i,["roletype"]], [/\blevel(l?ing)?\b|ladder|seniority|promotion/i,["level"]]];
function qaCritName(c){ if(prefList("hardRules").some(function(h){ return h.id===c; })) return ruleName(c); var x=((PREFS&&PREFS.scored)||[]).find(function(h){return h.id===c;}); return x&&x.name? x.name : c; }
function qaNudge(item){
  var t=(item.q||"")+" "+(item.a||""), codes=[];
  QA_CRIT.forEach(function(m){ if(m[0].test(t)) prefIdsOfType(m[1]).forEach(function(c){ if(codes.indexOf(c)<0) codes.push(c); }); });
  return codes.slice(0,3);
}
function qaList(r,scope,sid,qs,empty,rm){
  var doc=qaDoc(scope,sid), open=[], done=[];
  qs.forEach(function(q){ var a=qaGet(doc,q); if(a) done.push(a); else open.push(q); });
  function form(q,val){
    return '<div class="qaform" data-scope="'+scope+'" data-sid="'+esc(sid)+'" data-q="'+esc(q)+'">'+
      '<textarea rows="2" placeholder="What did you find out?" aria-label="Answer">'+esc(QA_DRAFT[qaKey(scope,sid,q)]!=null? QA_DRAFT[qaKey(scope,sid,q)] : (val||""))+'</textarea>'+
      '<div class="row" style="gap:6px"><button type="button" class="btn sm primary" data-act="qa_save">Save answer</button>'+
      '<button type="button" class="btn sm ghost" data-act="qa_cancel">Cancel</button></div></div>';
  }
  function btn(act,q,lab,cls){ return '<button type="button" class="linkbtn '+(cls||"")+'" data-act="'+act+'" data-scope="'+scope+'" data-sid="'+esc(sid)+'" data-q="'+esc(q)+'">'+lab+'</button>'; }
  /* Starred questions first (3 Oct): the ones to ask if time runs short. Order within each group is kept. */
  var sdoc = rm? qaStarDoc(rm,r) : null;
  if(sdoc) open = open.filter(function(q){ return qaIsStar(sdoc,q); }).concat(open.filter(function(q){ return !qaIsStar(sdoc,q); }));
  var html = open.length? '<ul class="qalist">'+open.map(function(q){
      var k=qaKey(scope,sid,q), on=sdoc? qaIsStar(sdoc,q) : false;
      var star = rm? '<button type="button" class="qastar'+(on?" on":"")+'" data-act="qa_star" data-rk="'+rm.k+'" data-rid="'+esc(rm.id)+'" data-role="'+esc(r? r.id : "")+'" data-q="'+esc(q)+'" aria-pressed="'+on+'" title="'+(on? "Must ask — shown first. Click to unstar" : "Star it: must ask, shown first")+'" aria-label="'+(on? "Unstar" : "Star")+'">'+(on? "★" : "☆")+'</button>' : "";
      var rmAttrs = rm? ' data-rk="'+rm.k+'" data-rid="'+esc(rm.id)+'" data-role="'+esc(r? r.id : "")+'" data-q="'+esc(q)+'"' : "";
      var rb = rm? '<button type="button" class="linkbtn qarm" data-act="qa_rm"'+rmAttrs+'>Remove</button>' : "";
      var eb = rm? '<button type="button" class="linkbtn" data-act="qa_edit"'+rmAttrs+'>Edit</button>' : "";
      /* Each question is its own row: Answer, Edit or Remove it (3 Oct). */
      var ek = rm? qaEKey(rm.k,rm.id,q) : "";
      if(rm && QA_EDIT[ek]) return '<li>'+qaEForm(rm,r,q,QA_EDRAFT[ek]!=null? QA_EDRAFT[ek] : q,"edit")+'</li>';
      return '<li'+(on? ' class="qaon"' : "")+'><div class="qaq">'+star+'<span class="qat">'+esc(q)+'</span>'+(QA_OPEN[k]? "" : '<span class="qaacts">'+btn("qa_open",q,"Answer")+eb+rb+'</span>')+'</div>'+(QA_OPEN[k]? form(q,"") : "")+'</li>';
    }).join("")+'</ul>' : (done.length? '<p class="emptyline">All answered.</p>' : '<p class="emptyline">'+esc(empty)+'</p>');
  if(done.length){
    var fk="qa~"+scope+"~"+sid+"~"+qs.length;
    html+='<details class="stage fold qadone" data-mtk="'+esc(fk)+'"'+(MTOPEN[fk]?" open":"")+'><summary class="stsum"><span class="stname">Answered</span><span class="spill sm strong ststat">'+done.length+'</span></summary>'+
      '<div class="stbody"><ul class="qalist ans">'+done.map(function(x){
        var k=qaKey(scope,sid,x.q), nd=qaNudge(x);
        return '<li><div class="qaq"><span>'+esc(x.q)+'</span></div>'+
          (QA_OPEN[k]? form(x.q,x.a) :
          '<div class="qaa">'+esc(x.a)+'</div>'+
          '<div class="qameta">'+(x.src==="notes"? "From your notes" : "Added by you")+(x.at? " · "+esc(niceShort(x.at)) : "")+
            ' · '+btn("qa_open",x.q,"Edit")+' · '+btn("qa_clear",x.q,"Reopen")+'</div>'+
          (nd.length? '<div class="qanudge">May change '+nd.map(function(c){return esc(c)+" ("+esc(qaCritName(c))+")";}).join(", ")+
            (r? ' — <a href="#" data-act="fitgo" data-id="'+esc(r.id)+'" data-k="me">review Fit</a>' : " — review Fit on its roles")+'</div>' : ""))+'</li>';
      }).join("")+'</ul></div></details>';
  }
  return html;
}
function qaSuggestCard(r){
  var sg=(r.qSuggest||[]); if(!sg.length) return "";
  return '<div class="fithd qcard qasug">'+boxHead("Answers found in your notes","Check each one — accepting files it as the answer")+
    '<ul class="qalist">'+sg.map(function(x,i){
      return '<li><div class="qaq"><span>'+esc(x.q)+'</span></div><div class="qaa">'+esc(x.a)+'</div>'+
        '<div class="qameta">'+(x.date? "From your notes, "+esc(niceShort(x.date)) : "From your notes")+'</div>'+
        '<div class="row" style="gap:6px;margin-top:4px"><button type="button" class="btn sm primary" data-act="qa_acc" data-id="'+esc(r.id)+'" data-i="'+i+'">Accept</button>'+
        '<button type="button" class="btn sm ghost" data-act="qa_dis" data-id="'+esc(r.id)+'" data-i="'+i+'">Dismiss</button></div></li>';
    }).join("")+'</ul></div>';
}
function qaSetSuggest(r,arr){
  r.qSuggest=arr; render();
  if(DB) DB.doc("roles/"+r.id).update({qSuggest:arr}).catch(function(e){ console.warn("suggest",e&&e.code); });
}
/* Every open question this role can see, with where its answer would live. */
function qaOpenFor(r){
  var e=r.enrich||{}, co=coOf(r), sc=secOfCo(co), out=[];
  function add(scope,sid,qs){ var doc=qaDoc(scope,sid); (qs||[]).forEach(function(q){ if(q && !qaGet(doc,q)) out.push({scope:scope,sid:sid,q:q}); }); }
  add("role",r.id,(e.openQuestions||[]).concat(asksOf(convsShown(r))));
  if(co){ add("company",co.id,co.questions); if(sc) add("company",co.id,sc.questions); }
  var seen={}; return out.filter(function(x){ var k=qaNorm(x.q); if(seen[k]) return false; seen[k]=1; return true; });
}
function qaNoteText(c){
  return [c.who? "Who: "+c.who : "", c.liked? "Liked: "+c.liked : "", c.concerned? "Concerned: "+c.concerned : "", c.notes? "Notes: "+c.notes : "",
    c.nextStep? "Next step: "+c.nextStep : ""].filter(Boolean).join("\n");
}
/* Remove a question from where it is kept, after a confirm that says how far it reaches (2 Oct). */
function qaRemoveAsk(b){
  var k=b.dataset.rk, id=b.dataset.rid, q=b.dataset.q, n=qaNorm(q), r=roles.find(function(x){return x.id===b.dataset.role;});
  var co=k==="company"? companies.find(function(x){return x.id===id;}) : null, sc=k==="sector"? sectors.find(function(x){return x.id===id;}) : null;
  var convs = k==="asks" && r? convsShown(r).filter(function(c){ return (c.nextQuestions||[]).some(function(x){ return qaNorm(x)===n; }); }) : [];
  var msg = k==="role"? "It goes from this role’s questions."
    : k==="asks"? "It goes from your meeting notes"+(convs[0]&&convs[0].date? " of "+niceShort(convs[0].date) : "")+"."
    : k==="company"? "This is a "+((co&&co.name)||"company")+" question, so it goes from every role there."
    : "This is a sector question, so it goes from every role in "+((sc&&sc.name)||"this sector")+".";
  el("cf-title").textContent="Remove this question?";
  el("cf-msg").textContent="“"+q+"” — "+msg;
  el("cf-yes").textContent="Remove";
  CF_DO=function(){
    function drop(arr){ return (arr||[]).filter(function(x){ return qaNorm(x)!==n; }); }
    function fail(e){ console.warn("remove question",e&&e.code); toast("Couldn't remove it — try again",true); }
    /* A removed question loses its star too. */
    var srm={k:k,id:id}, sd=qaStarDoc(srm,r); if(sd && qaIsStar(sd,q)) qaSetStar(srm,r,q,false);
    if(k==="role" && r){ var en=JSON.parse(JSON.stringify(r.enrich||{})); en.openQuestions=drop(en.openQuestions); r.enrich=en; render();
      if(DB) DB.doc("roles/"+r.id).update({enrich:en}).catch(fail); }
    else if(k==="asks"){ convs.forEach(function(c){ var nq=drop(c.nextQuestions); c.nextQuestions=nq; if(DB) DB.doc("conversations/"+c.id).update({nextQuestions:nq}).catch(fail); }); render(); }
    else if(k==="company" && co){ co.questions=drop(co.questions); render(); if(DB) DB.doc("companies/"+co.id).update({questions:co.questions}).catch(fail); }
    else if(k==="sector" && sc){ sc.questions=drop(sc.questions); render(); if(DB) DB.doc("sectors/"+sc.id).update({questions:sc.questions}).catch(fail); }
    toast("Question removed");
  };
  var d=el("cf-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  setTimeout(function(){ el("cf-no").focus(); },30);
}
async function qaMatch(r,convs,quiet){
  if(!SAMPLE || !r || QA_BUSY[r.id]) { if(!quiet && !SAMPLE) toast("Asking Claude isn't available in this view",true); return; }
  var sug=r.qSuggest||[], open=qaOpenFor(r).filter(function(x){ return !sug.some(function(s){ return qaNorm(s.q)===qaNorm(x.q); }); });
  convs=(convs||[]).filter(function(c){ return qaNoteText(c); });
  if(!open.length || !convs.length){ if(!quiet) toast(open.length? "No notes to check" : "No open questions to check"); return; }
  QA_BUSY[r.id]=true; render(); if(!quiet) toast("Checking your notes for answers…");
  var notes=convs.slice(0,12).map(function(c,i){ return "Note "+(i+1)+" ("+(c.date||"")+"):\n"+qaNoteText(c).slice(0,2500); }).join("\n\n");
  var prompt="A job seeker keeps questions to ask about a role, and notes from their meetings about it. "+
    "Find the questions their notes clearly answer. Only answer from what the notes say; if a note only touches a topic without answering, skip it.\n\n"+
    "Role: "+(r.title||"")+" at "+(r.company||"")+"\n\nQuestions:\n"+open.map(function(x,i){ return (i+1)+". "+x.q; }).join("\n")+
    "\n\nNotes:\n"+notes+
    '\n\nReply with JSON only: {"answers":[{"q":<question number>,"note":<note number>,"answer":"<one short sentence of plain '+engVar()+' English, the facts from the note>"}]}. Empty list if none.';
  try{
    var j = SAMPLE.json? await SAMPLE.json([{role:"user",content:prompt}],{cache:false, modelTier:"default"})
      : await SAMPLE([{role:"user",content:prompt}],{cache:false, modelTier:"default"}).then(function(x){ var m=String(x.text||"").match(/\{[\s\S]*\}/); return m? JSON.parse(m[0]) : {}; });
    var add=[]; ((j&&j.answers)||[]).forEach(function(x){
      var qq=open[(+x.q)-1], cv=convs[(+x.note)-1]; if(!qq || !x.answer) return;
      if(add.some(function(a){ return qaNorm(a.q)===qaNorm(qq.q); })) return;
      add.push({q:qq.q, scope:qq.scope, sid:qq.sid, a:String(x.answer).trim(), convId:cv? cv.id : "", date:cv? cv.date : "", at:today()});
    });
    var cur=roles.find(function(x){return x.id===r.id;})||r;
    if(add.length) qaSetSuggest(cur,(cur.qSuggest||[]).concat(add));
    toast(add.length? add.length+(add.length===1? " question" : " questions")+" answered in your notes — see Questions on "+(r.company||"the role") : (quiet? "" : "No answers found in your notes"));
  }catch(e){ console.warn("qa match",e); if(!quiet) toast(e&&e.code==="not_granted"? "Claude wasn't allowed to check" : "Couldn't check your notes — try again",true); }
  finally{ QA_BUSY[r.id]=false; render(); }
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act^="qa_"]'); if(!b) return;
  ev.preventDefault();
  var act=b.dataset.act, f=b.closest(".qaform");
  if(act==="qa_open"){ QA_OPEN[qaKey(b.dataset.scope,b.dataset.sid,b.dataset.q)]=1; render();
    setTimeout(function(){ var t=document.querySelector('.qaform[data-q="'+CSS.escape(b.dataset.q)+'"] textarea'); if(t) t.focus(); },0); return; }
  if(act==="qa_cancel" && f){ var ck=qaKey(f.dataset.scope,f.dataset.sid,f.dataset.q); delete QA_OPEN[ck]; delete QA_DRAFT[ck]; render(); return; }
  if(act==="qa_save" && f){ var v=f.querySelector("textarea").value.trim(); if(!v){ f.querySelector("textarea").focus(); return; }
    var sk=qaKey(f.dataset.scope,f.dataset.sid,f.dataset.q); delete QA_OPEN[sk]; delete QA_DRAFT[sk]; qaWrite(f.dataset.scope,f.dataset.sid,f.dataset.q,v,"you"); return; }
  if(act==="qa_clear"){ qaWrite(b.dataset.scope,b.dataset.sid,b.dataset.q,"",""); return; }
  if(act==="qa_rm"){ qaRemoveAsk(b); return; }
  if(act==="qa_star"){ var srm={k:b.dataset.rk,id:b.dataset.rid}, sr=roles.find(function(x){return x.id===b.dataset.role;});
    qaSetStar(srm,sr,b.dataset.q,b.getAttribute("aria-pressed")!=="true"); return; }
  if(act==="qa_edit" || act==="qa_add"){ QA_EDIT={}; QA_ADD={};
    if(act==="qa_edit") QA_EDIT[qaEKey(b.dataset.rk,b.dataset.rid,b.dataset.q)]=1; else QA_ADD[qaEKey(b.dataset.rk,b.dataset.rid,null)]=1;
    render(); qaFocusE(); return; }
  var ef=b.closest(".qaeform");
  if(act==="qa_esave" && ef){ qaESave(ef); return; }
  if(act==="qa_ecancel" && ef){ var xk=qaEKey(ef.dataset.rk,ef.dataset.rid,ef.dataset.mode==="edit"? ef.dataset.q : null); delete QA_EDIT[xk]; delete QA_ADD[xk]; delete QA_EDRAFT[xk]; render(); return; }
  var r=roles.find(function(x){return x.id===b.dataset.id;}); if(!r) return;
  if(act==="qa_check"){ qaMatch(r,convsShown(r),false); return; }
  var arr=(r.qSuggest||[]).slice(), x=arr[+b.dataset.i]; if(!x) return;
  if(act==="qa_acc"){
    /* A suggestion without sid files on its role, or the role's company (QA 14 Oct); if neither is found it stays. */
    var sc=x.scope==="company"? "company" : "role", sd=x.sid || (sc==="company"? coIdOfRole(r) : r.id);
    if(!qaDoc(sc,sd)){ toast("Couldn't file that answer: its "+sc+" isn't on the board",true); return; }
    qaWrite(sc,sd,x.q,x.a,"notes",x.convId);
  }
  arr.splice(+b.dataset.i,1);
  qaSetSuggest(r,arr);
});

/* Tab count: open questions only. */
function qCount(r){ return qaOpenFor(r).length; }
function questionsPanel(r){
  var e=r.enrich||{}, co=coOf(r), cs=convsShown(r);
  var oq=e.openQuestions||[], asks=asksOf(cs), cq=(co&&co.questions)||[];
  /* One full-width card per group of questions (1 Oct, night). */
  function qcard(t,sub,right,inner){ return '<div class="fithd qcard">'+boxHead(t,sub,right)+inner+'</div>'; }
  /* An Edit in every card; company and sector edits say they reach other roles (1 Oct, night). */
  function ed(k,id,lab,tip){ return '<button type="button" class="btn ghost edbtn" data-act="ed_open" data-k="'+k+'" data-id="'+esc(id)+'"'+(tip? ' title="'+esc(tip)+'"' : "")+'>'+esc(lab||"Edit")+'</button>'; }
  var sc=secOfCo(co), sq=(sc&&sc.questions)||[], cn=(co&&co.name)||r.company;
  function stc(rm,qs,scope,sid){ var n=qaStarCount(rm,r,qs,scope,sid); return n? " \u00b7 \u2605 "+n+" starred" : ""; }
  var check = cs.length? '<div class="qacheck"><span class="statushint">Answers in your meeting notes are found when you log them.</span>'+
    '<button type="button" class="linkbtn" data-act="qa_check" data-id="'+esc(r.id)+'"'+(QA_BUSY[r.id]?" disabled":"")+'>'+(QA_BUSY[r.id]? "Checking…" : "Check all my notes now")+'</button></div>' : "";
  return '<div class="qcards">'+check+qaSuggestCard(r)+
      qcard("About this role","Questions about this seat"+stc({k:"role",id:r.id},oq,"role",r.id),qaAddBtn("role",r.id,r),
        qaAddRow("role",r.id,r)+qaList(r,"role",r.id,oq,"None recorded.",{k:"role",id:r.id}))+
      (asks.length? qcard("From your meeting notes","Questions that came up in your meeting notes — edits change the notes too"+stc({k:"asks",id:r.id},asks,"role",r.id),
        '<button type="button" class="linkbtn" data-act="ctab" data-id="'+esc(r.id)+'" data-k="prep">Go to Interviews</button>',qaList(r,"role",r.id,asks,"",{k:"asks",id:r.id})) : "")+
      (co? qcard("About "+cn,"Ask once, covers every role at "+cn+" — adding, editing or starring here changes them all"+stc({k:"company",id:co.id},cq,"company",co.id),
        qaAddBtn("company",co.id,r),
        qaAddRow("company",co.id,r)+qaList(r,"company",co.id,cq,"None yet.",{k:"company",id:co.id})) : "")+
      (sc? qcard(sc.name||"This sector","Ask in every interview in this sector · answers are kept per company"+stc({k:"sector",id:sc.id},sq,"company",co.id),
        qaAddBtn("sector",sc.id,r),
        qaAddRow("sector",sc.id,r)+qaList(r,"company",co.id,sq,"None yet.",{k:"sector",id:sc.id})) : "")+
    '</div>';
}
/* A booked interview attaches to the first stage that has no meeting and is not done, so its notes
   show under that stage straight away rather than after the morning task (1 Oct). */
function linkStage(roleId,cid){
  var rr=rawRoles.find(function(x){return x.id===roleId;}); if(!rr || !DB) return;
  var ip=rr.interviewPrep||{};
  var k=Object.keys(ip).sort().filter(function(k){ var p=ip[k]||{};
    if(p.commitmentId || p.status==="done") return false;
    return !(p.type==="screen" && rr.screenPrep && rr.screenPrep.status==="done"); })[0];
  if(!k) return;
  var patch={interviewPrep:{}}; patch.interviewPrep[k]={commitmentId:cid};   /* status stays derived from the meeting */
  DB.doc("roles/"+roleId).update(patch).catch(function(e){ console.warn("link stage",e&&e.code); });
}
/* ---------- Interviewing: stages ---------- */
var STAGE_ST = {done:["Done","strong"], scheduled:["Scheduled","warm"], notplanned:["Not planned",""]};
function screenCommit(r){
  return sessionsFor(r.id).filter(function(c){return c.type==="interview" && /screen/i.test((c.title||"")+" "+(c.detail||""));})[0];
}
function stagesOf(r){
  var out=[], ip=r.interviewPrep||{}, keys=Object.keys(ip).sort();
  var hasScreen=keys.some(function(k){return (ip[k]||{}).type==="screen";});
  if(r.screenPrep && !hasScreen) out.push({k:"screen", sp:r.screenPrep, label:"Recruiter screen", type:"screen", status:r.screenPrep.status, cmt:screenCommit(r)});
  keys.forEach(function(k){
    var p=ip[k]||{};
    var cmt=p.commitmentId? commitments.find(function(x){return x.id===p.commitmentId;}) : (p.type==="screen"? screenCommit(r) : null);
    out.push({k:k, p:p, label:p.round||k, type:p.type, status:p.status, cmt:cmt});
  });
  out.forEach(function(s){
    var st=s.status;
    if(!STAGE_ST[st]){
      st = s.cmt? (s.cmt.state==="done"? "done" : s.cmt.state==="booked"? "scheduled" : "notplanned") : "notplanned";
    }
    s.st=st;
  });
  return out;
}
document.addEventListener("toggle",function(ev){
  var d=ev.target; if(!d || !d.classList || !d.classList.contains("stage")) return;
  STAGEOPEN[d.dataset.sk]=d.open;
},true);
var STATUS_OPTS=[["","Automatic — from the linked meeting"],["done","Done"],["scheduled","Scheduled"],["notplanned","Not planned"]];
EDIT_SPEC.general = {coll:"roles", find:roleOfSec, key:[
  ["interviewGeneral.themes","Themes to land every time — one per line","list"],
  ["interviewGeneral.stories","Stories to reuse — one per line","list"],
  ["interviewGeneral.avoid","Avoid in every round — one per line","list"],
  ["interviewGeneral.askThem","Keep asking — one per line","list"],
  ["interviewGeneral.notes","Notes","area"]], more:[]};
EDIT_SPEC.oq = {coll:"roles", find:roleOfSec, key:[["enrich.openQuestions","Questions about this role — one short question per line","list"]], more:[]};
/* Questions-only editors for the company and sector cards on a role's Questions tab (1 Oct, night). */
EDIT_SPEC.coq = {coll:"companies", find:function(id){return companies.find(function(x){return x.id===id;});},
  key:[["questions","Ask once, covers every role at this company — one per line","list"]], more:[]};
EDIT_SPEC.secq = {coll:"sectors", find:function(id){return sectors.find(function(x){return x.id===id;});},
  key:[["questions","Ask in every interview in this sector — one per line","list"]], more:[]};
EDIT_SPEC.research.key = [
  ["enrich.culture","How the role is written","area"],
  ["enrich.seatPackage","Package — this seat","area"],["location","Location","text"],["office","In office","text"],
  ["postingAge","Posting age","text"],["g2Note","Shortlist note","area"]];
EDIT_SPEC.facts.dyn = function(id){
  var r=roleOfSec(id)||{}, k=EDIT_SPEC.facts.base.slice();
  if(r.stage==="parked") k.push(["parkUntil","Parked until","date"]);
  if(r.stage==="closed"||/rejected/.test(r.stage||"")) k.push(["closedNote","Close-out note","area"],["rejectNote","Rejection note","area"]);
  return {key:k, more:[]};
};
EDIT_SPEC.conversation.dyn = function(id){
  var c=conversations.find(function(x){return x.id===id;})||{};
  var opts=[["","Not a booked meeting"]].concat(c.roleId? sessionsFor(c.roleId).map(function(m){return [m.id,(m.title||m.id)+(m.date?" · "+m.date:"")];}) : []);
  return {key: EDIT_SPEC.conversation.key.map(function(k){ return k[0]==="meetingId"? ["meetingId","Meeting it belongs to","select",opts] : k; }), more:[]};
};
EDIT_SPEC.facts.base = [
  ["title","Title","text"],["company","Company name as shown","text"],
  ["companyId","Linked company record","company"],["url","Posting URL","text"],
  ["sectorIds","Also counts on these sector cards — beyond its company’s own","sectors",{wide:1}],
  ["enrich.summary","Summary","area"],
  ["office","Remote / hybrid — in office","text"],
  ["salary","Base / salary","text"],["enrich.seatPackage","Package — this seat","area"],
  ["closing","Closing date","date"],["referral","Referral — who, and where it stands (blank = not referred)","text",{wide:1}],
  ["red","Red flags — one per line","list"],["green","Upside flags — one per line","list"]];
EDIT_SPEC.facts.key = EDIT_SPEC.facts.base;
(function(){
  var base=EDIT_SPEC.prep.dyn;
  EDIT_SPEC.prep.dyn=function(id){
    var d=base(id), parts=String(id).split("~"), k=parts[1], rid=parts[0];
    var pre = k==="screen"? "screenPrep." : "interviewPrep."+k+".";
    var meets=[["","Not linked to a meeting"]].concat(sessionsFor(rid).map(function(c){return [c.id,(c.title||c.id)+(c.date?" · "+c.date:"")];}));
    d.key=[[pre+"status","Status","select",STATUS_OPTS]].concat(k==="screen"? [] : [[pre+"commitmentId","Linked meeting","select",meets]]).concat(d.key);
    d.more=[];
    return d;
  };
})();

/* Longlist order is held while you stay on the page (02: g1Frozen); switching page releases it (4 Oct). */
showTab=(function(orig){ return function(t){ var fresh=t!==tab; if(fresh) G1FREEZE=null; orig(t); if(fresh && t==="gate1"){ try{ renderG1(); }catch(e){} } }; })(showTab);
