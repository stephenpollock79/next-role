"use strict";
/* ===== Run now: Copy for Claude on each stage (8 Oct) =====
   For when a role can't wait for the morning run. Each stage gets a button on the role's status line that opens a
   pop-up with a ready request to paste into a new chat in the Next Role project, like Data health's Copy for
   Claude. Nothing runs from the board itself: a skill needs a full Claude session (web, files), which a page can't
   host. Labels say Redo when the work already exists.
     Longlist  → next-role-longlist-research   (done: llAt)
     Shortlist → next-role-shortlist           (done: enrich.summary + enrich.gate2Rules), parked included
     To apply  → next-role-apply-pack          (done: packReady)
     Applied   → next-role-interview-prep, screen prep, until the first interview round has happened
                 (done: screenPrep, or prep on a screen meeting)
     Interview round (any meeting for a role that is a round and not done) → next-role-interview-prep for that round
                 (done: the meeting's prep)
   Each stage page header also gets one button for every role there still waiting, as one request. */

var RN_STAGE={
  proposed:{skill:"next-role-longlist-research", label:"Research now", what:"Longlist research"},
  consideration:{skill:"next-role-shortlist", label:"Research now", what:"Shortlist research"},
  parked:{skill:"next-role-shortlist", label:"Research now", what:"Shortlist research"},
  prep:{skill:"next-role-apply-pack", label:"Build CV pack now", what:"CV and cover letter pack"},
  applied:{skill:"next-role-interview-prep", label:"Interview advice", what:"Interview advice", noRedo:true},
  offer:null
};
function rnHasObj(o){ return !!(o && typeof o==="object" && Object.keys(o).length); }
/* Every screen meeting for the role, including "Not planned yet" ones: interview prep writes the screen prep onto an
   unplanned screen meeting it creates (sessionsFor leaves unplanned meetings out, so it can't be used here). */
function rnScreenMeets(r){ return commitments.filter(function(c){ return c.type==="screen" && (c.roleId===r.id || c.forId===r.id) && (typeof mtItem!=="function" || mtItem(c)!=="task"); }); }
/* Applied only offers screen prep before any interview round has happened; after that, each round has its own button. */
function rnApplicable(r){
  if(!r || !RN_STAGE[r.stage]) return false;
  if(r.stage==="applied"){ try{ return !mkrInfo(r).prev.length; }catch(e){ return true; } }
  return true;
}
function rnDone(r){
  var e=r.enrich||{};
  switch(r.stage){
    case "proposed": return !!r.llAt;
    case "consideration": case "parked": return !!(e.summary && rnHasObj(e.gate2Rules)) && e.rulesFrom!=="longlist" && e.rulesFrom!=="quick";
      /* The shortlist skill's own test (QA 15 Oct): rules from the longlist research or a quick check are provisional, not shortlist research. */
    case "prep": return typeof packReady==="function" && packReady(r);
    case "applied": return rnHasObj(r.screenPrep) || rnScreenMeets(r).some(function(c){ return rnHasObj(c.prep); });
  }
  return false;
}
function rnRoleLine(r){ return "- "+r.id+" · "+(r.ref? "#"+r.ref+" " : "")+(r.title||"Untitled")+" · "+(r.company||""); }
function rnIntro(skill,what){
  return "Run "+skill+" on my Next Role board"+boardRef()+" now for "+what+", then tell me what you did and anything left for me.";
}
function rnTextRoles(list,redo){
  var S=RN_STAGE[list[0].stage];
  var lines=[rnIntro(S.skill, list.length===1? "this role" : "these "+list.length+" roles")];
  if(list[0].stage==="applied") lines[0]=rnIntro(S.skill,"the screen ("+(list.length===1? "prep the screen for this role" : "prep the screen for each of these roles")+")");
  if(redo) lines.push("It has been done before: redo it from scratch with what's on the board now.");
  lines.push("");
  list.forEach(function(r){ lines.push(rnRoleLine(r)); });
  return lines.join("\n");
}
function rnTextRound(c,r,redo){
  var lines=[rnIntro("next-role-interview-prep","this interview round (prep the interview for "+(r.ref? "#"+r.ref : r.id)+")")];
  if(redo) lines.push("It has prep already: redo it from scratch with what's on the board now (notes, materials, starred questions).");
  lines.push("", rnRoleLine(r), "- meeting "+c.id+" · "+(c.title||"Interview")+(c.date? " · "+c.date+(c.time? " "+c.time : "") : " · not booked yet"));
  return lines.join("\n");
}
function rnShow(title,txt,n){
  var d=el("rn-dialog");
  if(!d){ d=document.createElement("dialog"); d.id="rn-dialog"; d.className="modal hfdlg"; d.setAttribute("aria-label","Copy for Claude");
    d.innerHTML='<div class="modal-head"><h3 id="rn-title">Copy for Claude</h3><button type="button" class="btn ghost" data-close="rn-dialog">Close</button></div><div id="rn-body"></div>';
    document.body.appendChild(d); }
  el("rn-title").textContent=title;
  el("rn-body").innerHTML='<p class="hfi">Copy this and paste it into a <b>new chat in your Next Role project</b> in Claude. That\'s where Claude has the board and its skills; it works on '+
    (n>1? n+" roles" : "it")+' straight away and you can watch and steer. It uses your Claude usage, the same as the morning run doing it.</p>'+
    '<textarea class="fxta" readonly rows="10"></textarea><div class="hffoot"><button type="button" class="btn primary" data-rncopy="1">Copy</button><button type="button" class="btn ghost" data-close="rn-dialog">Close</button></div>';
  d.querySelector(".fxta").value=txt;
  if(d.showModal) d.showModal(); else d.setAttribute("open","");
}
function rnBtn(r){
  if(!rnApplicable(r)) return "";
  var S=RN_STAGE[r.stage], redo=rnDone(r);
  /* Applied (8 Oct): only while the advice is missing, so the button itself shows which roles still need it; redo lives on the round. */
  if(redo && S.noRedo) return "";
  return '<button type="button" class="btn ghost rnbtn" data-rn="role:'+esc(r.id)+'" title="Copies a request to paste into a chat with Claude: '+esc(S.what)+' for this role now, instead of waiting for the morning run">'+
    esc(redo? (S.redo||"Redo: "+(/^[A-Z][A-Z]/.test(S.what)? S.what : S.what.charAt(0).toLowerCase()+S.what.slice(1))) : S.label)+'</button>';
}
/* Interview rounds: the meeting's own button. */
function rnRoundBtn(c){
  if(!c || !c.roleId || c.state==="done" || typeof mkrIsRound!=="function" || !mkrIsRound(c)) return "";
  var redo=rnHasObj(c.prep);
  return '<button type="button" class="btn ghost rnbtn" data-rn="round:'+esc(c.id)+'" title="Copies a request to paste into a chat with Claude: write the interview advice for this round now">'+(redo? "Redo interview advice" : "Interview advice")+'</button>';
}

/* ---------- placing the buttons ---------- */
/* On the status line, just before the stage moves on the right (Longlist, Shortlist, To apply and Applied cards). */
cardTabs=(function(orig){ return function(r,summary,tabs,dflt){
  try{
    var b=rnBtn(r), k='<div class="bgroup outcome">', i=summary? summary.indexOf(k) : -1;
    if(b && i>=0) summary=summary.slice(0,i)+b+summary.slice(i);
  }catch(e){ console.warn("run now",e); }
  return orig(r,summary,tabs,dflt);
}; })(cardTabs);
mtMeetRow=(function(orig){ return function(c,ctx){
  var h=orig(c,ctx), b=rnRoundBtn(c); if(!b) return h;
  if(h.indexOf('<div class="csrow">')>=0) return h.replace('<div class="csrow">','<div class="csrow">'+b);
  return h.replace('<div class="mtbar">','<div class="csrow">'+b+'</div><div class="mtbar">');
}; })(mtMeetRow);
/* The Interview rounds also show on Week ahead cards (39 adds the cheat sheet there through gcalBtn). */
gcalBtn=(function(orig){ return function(c){ return rnRoundBtn(c)+orig(c); }; })(gcalBtn);

/* Page headers: one request for every role on that stage still waiting. */
var RN_PAGES=[["gate1",["proposed"]],["gate2",["consideration","parked"]],["toapply",["prep"]],["inplay",["applied"]]];
function rnWaiting(stages){ return roles.filter(function(r){ return stages.indexOf(r.stage)>=0 && rnApplicable(r) && !rnDone(r) && !(typeof needsRead==="function" && needsRead(r) && r.stage!=="proposed"); }); }
function rnPaintHeads(){
  RN_PAGES.forEach(function(p){
    var head=document.querySelector("#tab-"+p[0]+" .pagehead"); if(!head) return;
    var n=rnWaiting(p[1]).length, b=head.querySelector(".rnall");
    if(!n){ if(b) b.remove(); return; }
    var S=RN_STAGE[p[1][0]], W=rnWaiting(p[1]), lab=(p[0]==="inplay"? "Interview advice for "+n : S.label.replace(" now","")+" all now ("+n+")");
    if(!b){ head.insertAdjacentHTML("beforeend",'<button type="button" class="btn rnall" data-rn="page:'+p[0]+'"></button>'); b=head.querySelector(".rnall"); }
    b.textContent=lab; b.title="Copies one request for "+W.map(function(r){ return r.company||r.title; }).join(", ")+" (still waiting for "+S.what.toLowerCase()+"), to paste into a chat with Claude";
  });
}
render=(function(orig){ return function(){ orig(); if(NRB.busy) return;   /* 29 holds redraws during a snapshot burst */ try{ rnPaintHeads(); }catch(e){ console.warn("run now heads",e); } }; })(render);

/* ---------- clicks ---------- */
document.addEventListener("click",function(ev){
  var cp=ev.target.closest && ev.target.closest("[data-rncopy]");
  if(cp){ ev.preventDefault(); var t=document.querySelector("#rn-dialog .fxta"); if(!t) return;
    var ok=function(){ cp.textContent="Copied ✓"; toast("Copied — paste it into a new chat in your Next Role project"); };
    var bad=function(){ t.focus(); t.select(); cp.textContent="Select and copy by hand"; };
    var legacy=function(){ try{ t.focus(); t.select(); if(document.execCommand("copy")) return ok(); }catch(e){} bad(); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(ok,legacy); else legacy();
    return; }
  var b=ev.target.closest && ev.target.closest("[data-rn]"); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var v=b.getAttribute("data-rn"), k=v.split(":")[0], id=v.slice(k.length+1);
  if(k==="role"){ var r=roles.find(function(x){ return x.id===id; }); if(!r || !RN_STAGE[r.stage]) return;
    rnShow(RN_STAGE[r.stage].what+" now"+(r.ref? " · #"+r.ref : ""), rnTextRoles([r], rnDone(r)), 1); return; }
  if(k==="round"){ var c=commitments.find(function(x){ return x.id===id; }); if(!c) return; var rr=rawRoles.find(function(x){ return x.id===c.roleId; }); if(!rr) return;
    rnShow("Interview prep now · "+(c.title||"round"), rnTextRound(c,rr,rnHasObj(c.prep)), 1); return; }
  if(k==="page"){ var pg=RN_PAGES.find(function(p){ return p[0]===id; }); if(!pg) return; var list=rnWaiting(pg[1]);
    if(!list.length){ toast("Nothing here is waiting"); return; }
    rnShow(RN_STAGE[list[0].stage].what+" now · "+list.length+(list.length===1? " role" : " roles"), rnTextRoles(list,false), list.length); return; }
},true);
(function(){ var st=document.createElement("style");
  st.textContent=".rnbtn{white-space:nowrap}.pagehead .rnall{margin-left:8px}";
  document.head.appendChild(st); })();
try{ rnPaintHeads(); }catch(e){}

/* ---------- Applied status names the interview (8 Oct) ----------
   "Prep the interview" read like Claude's advice; it is your own getting ready. With an interview booked the status
   says so with its date: "Interview Fri 9 Oct – get ready", and "Ready – Fri 9 Oct" once you press Prepped. */
FLOW.prep.label="Get ready for the interview";
flowOf=(function(orig){ return function(r){
  var st=orig(r);
  try{ var nx=nextSessionOf(r.id);
    if(nx && nx.date){ if(st.k==="prep") st.label="Interview "+niceShort(nx.date)+" – get ready"; else if(st.k==="ready") st.label="Ready – "+niceShort(nx.date); }
  }catch(e){}
  return st;
}; })(flowOf);
playStatus=function(r){ return flowOf(r); };
flowSelect=(function(orig){ return function(r,st,extra){
  st=st||playStatus(r);
  var h=orig(r,st,extra), f=FLOW[st.k];
  if(f && st.label!==f.label) h=h.replace('<option value="'+st.k+'" selected>'+esc(f.label)+'</option>','<option value="'+st.k+'" selected>'+esc(st.label)+'</option>');
  return h;
}; })(flowSelect);

/* ---------- Advice state on Applied cards (8 Oct) ----------
   On the company line, so it never adds height: green "Advice ready" (for the next conversation: the screen, or the
   next booked round, as "Advice ready · interview <date>" so the date reads as the interview, not when the advice lands), amber "Advice due tomorrow" while the morning run still has to write it, nothing
   once there's no next conversation. Clicking it opens the role on its Interviews tab. */
function rnAdvice(r){
  if(!r || (r.stage!=="applied" && r.stage!=="offer")) return null;
  var nx=null; try{ nx=nextSessionOf(r.id); }catch(e){}
  if(nx && typeof mkrIsRound==="function" && !mkrIsRound(nx)) nx=null;
  if(nx) return rnHasObj(nx.prep)? {k:"ok", t:"Advice ready \u00b7 interview "+niceShort(nx.date)} : {k:"due", t:"Advice due tomorrow"};
  var I=null; try{ I=mkrInfo(r); }catch(e){ I={prev:[], next:null}; }
  if(!I.prev.length) return rnDone(r)? {k:"ok", t:"Advice ready"} : {k:"due", t:"Advice due tomorrow"};
  if(I.next && rnHasObj(I.next.prep)) return {k:"ok", t:"Advice ready"};
  return null;
}
roleShell=(function(orig){ return function(r,idx,lead,body,quick){
  var h=orig(r,idx,lead,body,quick), a=null; try{ a=rnAdvice(r); }catch(e){}
  if(!a) return h;
  var co='<span class="rsum-co" title="'+esc(r.company)+'">'+esc(r.company)+'</span>';
  /* Inside the company span (it is one grid cell of the row), so it flows after the name and never overlaps the scores. */
  return h.replace(co, co.slice(0,-7)+'<span class="rnadv '+a.k+'" role="button" tabindex="0" data-rnadv="'+esc(r.id)+'" title="Open the interview advice">'+esc(a.t)+'</span></span>');
}; })(roleShell);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-rnadv]"); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var id=b.getAttribute("data-rnadv");
  try{ spOpen(id,"rcard"); }catch(e){ return; }
  setTimeout(function(){ var t=document.querySelector('#sp-body [data-act="ctab"][data-k="prep"]'); if(t) t.click(); },80);
},true);
["mousedown","keydown"].forEach(function(evt){ document.addEventListener(evt,function(ev){ if(ev.target.closest && ev.target.closest("[data-rnadv]")) ev.stopPropagation(); },true); });
(function(){ var st=document.createElement("style");
  st.textContent=".rnadv{font-size:12px;padding-left:6px;cursor:pointer;white-space:nowrap}"+
    ".rnadv::before{content:'· ';color:var(--muted,#888)}.rnadv.ok{color:var(--good,#15803d)}.rnadv.due{color:var(--warn,#b45309)}.rnadv:hover{text-decoration:underline}";
  document.head.appendChild(st); })();
