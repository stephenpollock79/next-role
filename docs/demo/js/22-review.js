"use strict";
/* ===== Search review (3 Oct): a guided conversation about the whole job search =====
   Tools › Search review (tab id "review"). Not a search-settings tool: it diagnoses the whole loop —
   Find (channels, terms, rules), Decide (roles waiting on you), Apply (packs not sent, too few live
   applications), Convert (applications not turning into interviews) — and says so when the fix is an
   action rather than a setting.
   Flow (ranked list, 3 Oct): intro → Claude reads (progress) → a diagnosis and a ranked list of 3–8
   proposals in one go → tick the ones you want (each opens for evidence, Change it, Not this + why, Ask about
   it) → Apply selected, or Accept all. Telling Claude what you see is optional and re-ranks the list. Only
   Apply writes, through the same logged paths as the board (rulelog, undo). Each review is a `rulereviews`
   doc with scope "loop"; it is saved after every step so it can be resumed. Older reviews that stopped at the
   diagnosis question still open there.
   Also here: "Suggest a change" on a Highlights card (hsOpen): one proposal for that card, in the same shape,
   saved as a `rulereviews` doc with scope "card" so a refusal feeds the next Search review. */

var RV={id:null, busy:"", err:"", step:0, edit:false, ask:false, no:false, view:null, prog:0, open:{}};
var RV_AREAS={find:"Finding roles", decide:"Deciding", apply:"Applying", convert:"Interviews", healthy:"Healthy"};
var RV_TABS={gate1:"Longlist", gate2:"Shortlist", toapply:"To apply", inplay:"Applied", week:"Week ahead", routine:"Sourcing", about:"About me", companies:"Targets", pipeline:"Insights"};
var RV_STS=[["active","Active"],["trial","Trial"],["paused","Paused"],["dropped","Dropped"]];
function rvReviews(){ return RU.reviews.filter(function(r){return r.scope==="loop";}).sort(function(a,b){ return String(a.at)<String(b.at)? 1 : -1; }); }
function rvCur(){ return RV.id? RU.reviews.find(function(r){return r.id===RV.id;}) : null; }

/* ---------- what Claude reads ---------- */
function rvCounts(){
  var live=roles.filter(function(r){return r.stage==="applied"||r.stage==="offer";}).length;
  return {roles:rawRoles.length, channels:channels.length, rules:ruRules().length, downs:ruTurnDowns().length, live:live};
}
function rvLoopLines(){
  var ny=needsYou(), by={}; ny.forEach(function(x){ var k=x.tab+" · "+x.s; by[k]=by[k]||{n:0,old:0}; by[k].n++; by[k].old=Math.max(by[k].old,x.age||0); });
  var c=rvCounts(), ll=roles.filter(function(r){return r.stage==="proposed";});
  var ready=roles.filter(function(r){return r.stage==="prep" && packReady(r);}).length, prep=roles.filter(function(r){return r.stage==="prep";}).length;
  var applied=rawRoles.filter(function(r){return r.appliedAt;}), iv=applied.filter(function(r){ return insInterviewed(r); }).length;
  var upcoming=commitments.filter(function(cm){ return mtItem(cm)==="meeting" && wkCat(cm)==="interview" && cm.date && cm.date>=today(); }).length;
  return ["LIVE APPLICATIONS: "+c.live+" (their target band "+LOAD_BAND[0]+"–"+LOAD_BAND[1]+")",
    "WAITING ON THE USER: "+(Object.keys(by).map(function(k){ return k+" "+by[k].n+" (oldest "+by[k].old+"d)"; }).join("; ")||"nothing"),
    "LONGLIST TO REVIEW: "+ll.length,
    "TO APPLY: "+prep+" roles, "+ready+" with a CV pack ready",
    "APPLIED EVER: "+applied.length+", of which reached an interview: "+iv+"; interviews booked ahead: "+upcoming];
}
function rvFacts(){
  var Mall=insClean("all",function(){ return insModel(insWin()); }), M30=insClean("30",function(){ return insModel(insWin()); });
  /* Search review reads every candidate, not just the week's six (5 Oct). */
  var H=insHlAll();
  function fun(M){ return IST.map(function(s,i){ return s+" "+M.c[i]; }).join(" → "); }
  var downs=ruTurnDowns(), byRC={};
  downs.forEach(function(x){ var r=rawRoles.find(function(y){return y.id===x.id;}), ch=r? (chById(r.channelId||chOfSrc(r.sourceId))||{}).name||"unknown" : "unknown";
    var k=x.reason+" @ "+x.where+" via "+ch; byRC[k]=(byRC[k]||0)+1; });
  var past=[]; RU.reviews.forEach(function(rv){ (rv.proposals||[]).forEach(function(p){ var d=p.decision||p.status; if(d==="no"||d==="rejected") past.push("- the user said no to: "+(p.title||p.target||"")+" "+(p.change||"")+(p.feedback? " — their reason: "+p.feedback : "")); }); });
  var recent=RU.log.slice(0,10).map(function(l){ return "- "+String(l.at).slice(0,10)+" "+(l.kind||"rule")+" "+l.ruleId+" "+l.action+((l.kind||"rule")==="rule"? " — "+ruEffect(l) : ""); });
  return "TODAY: "+today()+"\n\nTHE LOOP:\n"+rvLoopLines().join("\n")+
    "\n\nFUNNEL, whole search: "+fun(Mall)+"\nFUNNEL, roles found in the last 30 days: "+fun(M30)+
    "\n\nBOARD HIGHLIGHTS (last 30 days; ACT = a lever the user can pull, FYI = for information):\n"+H.map(function(h){return "- "+(h.group==="fyi"? "FYI" : "ACT")+": "+h.title+" — "+h.text;}).join("\n")+
    "\n\nCHANNELS AND SOURCES:\n"+srSourceLines().join("\n")+"\n\nRECENT SWEEPS:\n"+(srRunLines().join("\n")||"none")+
    "\n\nCOMPANIES:\n"+rvCompanyLines().join("\n")+
    "\n\nSEARCH TERMS:\n"+srTermLines().join("\n")+"\n\nDEAL-BREAKERS WITH EVIDENCE:\n"+srRuleLines().join("\n")+
    "\n\nHIS TURN-DOWNS BY REASON, STAGE AND CHANNEL:\n"+Object.keys(byRC).sort(function(a,b){return byRC[b]-byRC[a];}).slice(0,25).map(function(k){return "- "+k+": "+byRC[k];}).join("\n")+
    (recent.length? "\n\nRECENT CHANGES AND EFFECT:\n"+recent.join("\n") : "")+
    (past.length? "\n\nTHINGS THE USER TURNED DOWN IN EARLIER REVIEWS (don't repeat unless the evidence clearly changed):\n"+past.slice(-15).join("\n") : "")+
    (HLS.length? "\n\nHIGHLIGHTS THE USER HAS ALREADY DEALT WITH (don't raise them again unless the numbers since show it recurring):\n"+HLS.map(function(s){ return "- "+s.at+" "+(s.state==="handled"? "handled" : s.state==="monitor"? "monitoring, hidden until it grows from "+s.n : "marked not useful")+": "+(s.title||s.key)+(s.note? " — "+s.note : ""); }).join("\n") : "")+
    "\n\nRULE FIRMNESS: FIXED rules are facts of their life or the law ("+ruRules().filter(function(h){return ruFirm(h)==="fixed";}).map(function(h){return h.id+" "+h.name;}).join(", ")+
    "). Never propose loosening, moving or removing them; when they cut or end a lot, the fix is the sweep catching them earlier, or sourcing (search terms, sources). You may only propose rewording a fixed rule so the sweep catches it more reliably, with change \"tighten\". FIRM rules: only propose loosening when their spot-checks show it cut roles the user wanted.";
}
/* Companies: the watched list, the ones that did best, and companies that arrived from job boards, did well and
   aren't watched — the natural candidates to add as targets. */
function rvCompanyLines(){
  var w=companies.filter(function(c){return c.watch;}), out=["Watched by the sweep: "+w.length+" companies (company careers pages are their biggest channel)."];
  function reach(c){ return Math.max.apply(null,[-1].concat(coRolesOf(c).map(function(r){return insReach(r);}))); }
  var best=companies.map(function(c){return {c:c,k:reach(c)};}).filter(function(x){return x.k>=2;}).sort(function(a,b){return b.k-a.k;}).slice(0,8);
  if(best.length) out.push("Best so far: "+best.map(function(x){ return x.c.name+" ("+IST[x.k]+(x.c.sector? ", "+x.c.sector : "")+")"; }).join("; "));
  var cand=companies.filter(function(c){ return !c.watch && ["excluded","defunct","rejected"].indexOf(c.listing||"target")<0; }).map(function(c){return {c:c,k:reach(c),n:coRolesOf(c).length};}).filter(function(x){return x.n && x.k>=1;}).sort(function(a,b){return b.k-a.k;}).slice(0,8);
  out.push("Not watched, but roles arrived from job boards: "+(cand.length? cand.map(function(x){ return "id "+x.c.id+" \""+x.c.name+"\" (furthest "+IST[x.k]+", "+plural(x.n,"role")+")"; }).join("; ") : "none"));
  var no=companies.filter(function(c){ return ["excluded","rejected"].indexOf(c.listing||"")>=0; }).map(function(c){return c.name;}).slice(0,20);
  if(no.length) out.push("Excluded or rejected by the user (never suggest): "+no.join(", "));
  return out;
}
/* Who the review is about comes from profile/me, never from code. */
function rvWho(){ var P=PROFILE||{}; var w=P.profession||P.headline||""; return w? "a "+clip(w,160)+(P.location? " based in "+P.location : "") : "a job seeker"; }
function rvRole(){ return "You are reviewing the job search of "+rvWho()+", on their job-search board. "+locText(RV_ROLE_REST); }
var RV_ROLE_REST=""+
  "The search is a loop: FIND roles (channels × search terms × deal-breaker rules) → DECIDE (longlist, shortlist) → APPLY (CV packs, live applications) → CONVERT (interviews, offers). "+
  "Find where the loop is actually stuck. Do not assume it is a search problem: too few applications can come from decisions waiting on the user, or ready CVs not sent. "+
  "Use only the numbers given. Plain {ENG} English, short, no jargon, no preamble. "+
  "The skills that run the search read everything from the board every run — deal-breakers and their check notes, search terms, channels, sources and watched companies — so almost every fix is a board change, never a skill change.";
/* What a proposal can be, shared by Search review and a card's Suggest a change. */
var RV_LEVERS="Three kinds:\n"+
  "- \"action\": something the user does on the board (decide waiting roles, send ready CVs, chase, check sites) — give the page as one of: "+Object.keys(RV_TABS).join(", ")+".\n"+
  "- \"change\": a change to their setup. lever is one of: source (trial a new one, or change a source's status), channel (status), term (rewrite a search group's comma-separated terms), "+
  "rule (reword, loosen, tighten, move, add), check (rewrite a deal-breaker's check note: how the sweep tests the rule, where to look and what counts — the right lever when a rule is right but roles that fail it still get through), "+
  "company (start watching a company's own careers page: one listed as not watched whose roles did well — target its id — or a new one similar to their best companies, target new with its name; or change \"unwatch\" to stop watching a watched company by id). "+
  "New sources and new companies: only real, well-known ones with roles like the one they want {WHERE}; new ones are ideas to try.\n"+
  "- \"skill\": only when no board change can do it because the sweep or another skill needs a new capability (read a new kind of source, record a new field, change a step). Give a short prompt the user can paste into Claude in their Next Role project, saying which skill (next-role-sweep, next-role-daily-check, next-role-shortlist, next-role-role-fit, next-role-apply-pack, next-role-interview-prep, next-role-meetings) and exactly what to change. Rare.\n";
var RV_SHAPE='{"kind":"action|change|skill","title":"<short headline>","why":"<one sentence>","evidence":"<numbers>","effect":"<expected effect>",'+
  '"tab":"<page, for actions>","lever":"source|channel|term|rule|check|company","target":"<source id, channel id, search group name, rule id, company id, or new>","change":"trial|pause|drop|activate|reword|loosen|tighten|move|add|remove|unwatch",'+
  '"channel":"<channel id, new source>","name":"<new source or new rule name>","url":"<new source>","status":"active|trial|paused|dropped","group":"<new search group>","terms":"<full new terms>","fires":"Search | Search, else Gate 2 | Enrichment","rule":"<full new rule text>","check":"<full new check note>","prompt":"<for skill: the prompt to paste>"}';

/* ---------- talking to Claude ---------- */
async function rvSample(){ var s=SAMPLE; if(!s){ try{ s=window.claude && window.claude.use? await window.claude.use("sample") : null; }catch(e){ s=null; } } return s; }
function rvParse(text){
  var t=String(text||"").replace(/```(?:json)?/g,""), a=t.indexOf("{"), b=t.lastIndexOf("}");
  if(a<0||b<=a) throw {code:"invalid_json"};
  return JSON.parse(t.slice(a,b+1));
}
async function rvAsk(turns,tier){
  var s=await rvSample(); if(!s) throw {code:"unavailable"};
  var res=await s(turns,{cache:false, modelTier:tier||"complex"}), txt=String((res&&res.text)||"");
  try{ return rvParse(txt); }
  catch(e){ /* one retry: ask for the same answer as valid JSON only */
    var res2=await s(turns.concat([{role:"assistant",content:txt},{role:"user",content:"That wasn't valid JSON. Reply again with only the JSON object, nothing else."}]),{cache:false, modelTier:"default"});
    return rvParse(res2&&res2.text);
  }
}
function rvErr(e){ return !e? "Something went wrong — try again." : e.code==="not_granted"? "Claude wasn't allowed to run. Start again and allow it when asked." :
  e.code==="unavailable"? "Asking Claude isn't available in this view." : e.code==="invalid_json"? "Claude's answer came back in a form the board couldn't read. Try again." : "Couldn't reach Claude ("+(e.code||"error")+"). Try again."; }
async function rvSave(patch){ if(!RV.id) return; await DB.doc("rulereviews/"+RV.id).update(patch); }
function rvProgress(on){
  clearInterval(RV._pt); RV.prog=0;
  if(on) RV._pt=setInterval(function(){ RV.prog=Math.min(RV.prog+1,4); var p=document.querySelector("#rv-root .rvprog"); if(p) p.innerHTML=rvProgHtml(); },3500);
}
function rvProgHtml(){
  var S=["Reading your funnel and what's waiting on you","Reading your channels and sources","Reading your search terms and rules","Reading what you turned down","Thinking it through"];
  return S.map(function(s,i){ return '<li class="'+(i<RV.prog?"done":i===RV.prog?"on":"")+'">'+esc(s)+'</li>'; }).join("");
}

async function rvStart(){
  if(RV.busy) return;
  if(!DB){ toast("The board hasn't loaded yet",true); return; }
  var id="rv-"+Date.now();
  await DB.doc("rulereviews/"+id).set({at:new Date().toISOString(), scope:"loop", stage:"reading", proposals:[]});
  RV.id=id; RV.busy="diagnosis"; RV.err=""; RV.step=0; RV.view=null; rvProgress(true); renderReview();
  try{
    var j=await rvAsk([{role:"user",content:rvRole()+"\n\n"+rvFacts()+
      "\n\nSay which part of the loop is most stuck and why, with the key numbers. Then give a ranked list of 3 to 8 things to do about it, most valuable first, each with its expected effect. Fewer is fine when the evidence is thin; never pad. "+locText(RV_LEVERS)+
      'Reply with JSON only: {"area":"find|decide|apply|convert|healthy","summary":"<two or three sentences>","evidence":["<short line with a number>","..."],"question":"<one short question to check the diagnosis against what the user sees>","intro":"<one sentence on the list>","proposals":['+RV_SHAPE+']}'}],"complex");
    var dg={area:RV_AREAS[j.area]? j.area : "find", summary:String(j.summary||""), evidence:(j.evidence||[]).slice(0,5).map(String), question:String(j.question||"Does that match what you're seeing?")};
    var ps=(j.proposals||[]).slice(0,8).map(rvClean).filter(Boolean);
    await rvSave({stage:"proposals", diagnosis:dg, intro:String(j.intro||""), proposals:ps, list:true}); RV.open={};
  }catch(e){ RV.err=rvErr(e); try{ await rvSave({stage:"failed"}); }catch(x){} }
  RV.busy=""; rvProgress(false); renderReview();
}
async function rvReply(choice){
  var rv=rvCur(); if(!rv || RV.busy) return;
  var txt=(el("rv-reply")||{}).value||""; if(choice==="Rerank" && !txt.trim()){ RV.err="Say what you're seeing first."; RV._force=true; renderReview(); return; }
  RV.busy="proposals"; RV.err=""; rvProgress(true); RV.prog=4;
  var back=rv.stage; await rvSave({reply:{choice:choice, text:txt.trim()}, stage:"thinking"}); renderReview();
  try{
    var dg=rv.diagnosis||{};
    var j=await rvAsk([{role:"user",content:rvRole()+"\n\n"+rvFacts()+"\n\nYOUR DIAGNOSIS: "+(RV_AREAS[dg.area]||"")+" — "+dg.summary+"\nYOU ASKED: "+dg.question+
      "\nHE ANSWERED: "+choice+(txt.trim()? " — \""+txt.trim()+"\"" : "")+
      "\n\nTake their answer seriously (if the user disagrees, follow their view unless the numbers clearly contradict it). Give a ranked list of 3 to 8 things to do, most valuable first, each with its expected effect. Fewer is fine when the evidence is thin; never pad. "+locText(RV_LEVERS)+
      'Reply with JSON only: {"intro":"<one sentence>","proposals":['+RV_SHAPE+']}'}],"complex");
    var ps=(j.proposals||[]).slice(0,8).map(rvClean).filter(Boolean);
    await rvSave({stage:"proposals", intro:String(j.intro||""), proposals:ps, list:true}); RV.step=0; RV.open={};
  }catch(e){ RV.err=rvErr(e); try{ await rvSave({stage:back==="proposals"? "proposals" : "diagnosis"}); }catch(x){} }
  RV.busy=""; rvProgress(false); renderReview();
}
/* Keep only proposals the board can act on. */
function rvClean(p){
  if(!p) return null;
  var o={kind:p.kind==="action"? "action" : "change", title:String(p.title||""), why:String(p.why||""), evidence:String(p.evidence||""), effect:String(p.effect||""), decision:"", feedback:"", thread:[]};
  if(p.kind==="skill"){ o.kind="skill"; o.prompt=String(p.prompt||""); return o.title && o.prompt? o : null; }
  if(o.kind==="action"){ o.tab=RV_TABS[p.tab]? p.tab : ""; return o.title? o : null; }
  o.lever=String(p.lever||""); o.target=String(p.target||""); o.change=String(p.change||"");
  ["channel","name","url","group","terms","rule","check"].forEach(function(k){ o[k]=String(p[k]||""); });
  /* Check note (3 Oct): how the sweep tests a rule. Any rule, fixed ones included — the rule itself doesn't change. */
  if(o.lever==="check"){ o.change="check"; return ruRules().some(function(h){return h.id===o.target;}) && o.check? o : null; }
  o.newStatus=["active","trial","paused","dropped"].indexOf(p.status)>=0? p.status : ""; o.fires=RULE_FIRES.indexOf(p.fires)>=0? p.fires : "";
  if(o.lever==="rule"){
    /* Firmness (3 Oct): a fixed rule is never loosened, moved or removed; a firm one is loosened only on spot-check evidence. */
    var hr=ruRules().find(function(h){return h.id===o.target;}), fm=hr? ruFirm(hr) : "";
    if(fm==="fixed" && o.change!=="tighten") return null;
    /* Same evidence as the rules panel: only spot-checks since the rule last changed count (scTally, 27). */
    if(fm==="firm" && (o.change==="loosen" || o.change==="remove")){ if(typeof scTally!=="function" || !scTally(hr.id).strict) return null; }
    return (o.target==="new" || hr) && (o.rule || o.change==="remove")? o : null; }
  if(o.lever==="source") return o.target==="new"? (chById(o.channel) && o.name? (o.newStatus=o.newStatus||"trial", o) : null) : (srSrc(o.target) && o.newStatus? o : null);
  if(o.lever==="channel") return chById(o.target) && o.newStatus? o : null;
  if(o.lever==="term") return o.terms && (o.target==="new" || prItems("search").some(function(g){return g.group===o.target;}))? o : null;
  if(o.lever==="company" && o.change==="unwatch"){ var cw=companies.find(function(x){return x.id===o.target;}); return cw && cw.watch? o : null; }
  if(o.lever==="company"){ o.change=""; if(o.target==="new"){ if(!o.name) return null; var ex=companies.find(function(c){ return slug(c.name||"")===slug(o.name) || c.id===slug(o.name); });
      if(ex){ if(ex.watch || ["excluded","rejected"].indexOf(ex.listing||"")>=0) return null; o.target=ex.id; } return o; }
    var c=companies.find(function(x){return x.id===o.target;}); return c && !c.watch && ["excluded","rejected"].indexOf(c.listing||"")<0? o : null; }
  return null;
}
function rvFinal(p){ return Object.assign({},p,p.edited||{}); }
async function rvSetP(i,patch){ var rv=rvCur(); var ps=(rv.proposals||[]).map(function(x){return Object.assign({},x);}); Object.assign(ps[i],patch); await rvSave({proposals:ps}); }
async function rvAskAbout(i){
  var rv=rvCur(), p=rv && rv.proposals[i], q=((el("rv-q")||{}).value||"").trim(); if(!p || !q || RV.busy) return;
  RV.busy="ask"; RV.err=""; var thread=(p.thread||[]).concat([{role:"you",text:q}]); await rvSetP(i,{thread:thread}); renderReview();
  try{
    var j=await rvAsk([{role:"user",content:rvRole()+"\n\n"+rvFacts()+"\n\nYou proposed this to the user:\n"+JSON.stringify(rvFinal(p))+
      "\n\nThe conversation about it so far:\n"+thread.map(function(t){return (t.role==="you"? "USER: " : "YOU: ")+t.text;}).join("\n")+
      '\n\nAnswer their latest message plainly in two or three sentences. If their point changes the proposal, give the revised version (same fields), else null.\nReply with JSON only: {"answer":"...","revised":null}'}],"default");
    var patch={thread:thread.concat([{role:"claude",text:String(j.answer||"")}])};
    if(j.revised){ var rc=rvClean(Object.assign({kind:p.kind},j.revised)); if(rc){ ["kind","title","why","evidence","effect","tab","lever","target","change","channel","name","url","group","terms","rule","check","prompt","newStatus","fires"].forEach(function(k){ if(rc[k]!=null) patch[k]=rc[k]; }); patch.revisedNote="Updated after your question"; patch.edited=null; } }
    await rvSetP(i,patch);
  }catch(e){ RV.err=rvErr(e); }
  RV.busy=""; renderReview();
}
/* Apply: the only step that writes anything to the search. */
async function rvApplyOne(p,via){
  via=via||"review";
  if(p.lever==="check"){
    var rc=ruClone(), hc=rc.find(function(x){return x.id===p.target;}); if(!hc) return;
    var bc=ruStrip(hc); hc.check=p.check; await ruApply(rc,{ruleId:p.target, action:"edit", before:bc, after:ruStrip(hc), via:via, why:p.why}); return;
  }
  if(p.lever==="company" && p.change==="unwatch"){
    var bw=srDocSnap("companies",p.target), uw={watch:false, watchWhy:"Stopped watching: "+(p.why||"")};
    await DB.doc("companies/"+p.target).update(uw); await srLog({kind:"company", ruleId:p.target, action:"edit", before:bw, after:Object.assign({},bw,uw), via:via, why:p.why}); return;
  }
  if(p.lever==="rule"){
    var rs=ruClone(), before=null, after=null, id=p.target;
    if(p.change==="remove"){ var hr=rs.find(function(x){return x.id===id;}); before=ruStrip(hr); rs=rs.filter(function(x){return x.id!==id;}); }
    else if(id==="new"){ id=ruNextId(rs); after={id:id, name:p.name||"New rule", fires:p.fires||"Search, else Gate 2", rule:p.rule}; rs.push(after); }
    else { var h=rs.find(function(x){return x.id===id;}); if(!h) return; before=ruStrip(h); h.rule=p.rule||h.rule; if(p.fires) h.fires=p.fires; after=ruStrip(h); }
    await ruApply(rs,{ruleId:id, action:p.change==="remove"? "remove" : before? "edit" : "add", before:before, after:after, via:via, why:p.why}); return;
  }
  if(p.lever==="source"){
    if(p.target==="new"){
      var sid=slug(p.channel+"-"+p.name), k=2; while(srSrc(sid)) sid=slug(p.channel+"-"+p.name)+"-"+(k++);
      var order=1+Math.max.apply(null,[0].concat(srcs.filter(function(s){return s.channelId===p.channel;}).map(function(s){return +s.order||0;})));
      var doc={channelId:p.channel, name:p.name, url:p.url||"", note:"", order:order, status:p.newStatus||"trial", why:p.why||"", addedAt:today(), addedVia:via==="card"? "highlight" : "review"};
      await DB.doc("sources/"+sid).set(doc); await srLog({kind:"source", ruleId:sid, action:"add", before:null, after:doc, via:via, why:p.why}); return;
    }
    var b4=srDocSnap("sources",p.target), up={status:p.newStatus}; if(p.newStatus!=="active") up.why=p.why||"";
    await DB.doc("sources/"+p.target).update(up); await srLog({kind:"source", ruleId:p.target, action:"edit", before:b4, after:Object.assign({},b4,up), via:via, why:p.why}); return;
  }
  if(p.lever==="channel"){
    var c4=srDocSnap("channels",p.target), cu={status:p.newStatus}; if(p.newStatus!=="active") cu.why=p.why||"";
    await DB.doc("channels/"+p.target).update(cu); await srLog({kind:"channel", ruleId:p.target, action:"edit", before:c4, after:Object.assign({},c4,cu), via:via, why:p.why}); return;
  }
  if(p.lever==="company"){
    if(p.target!=="new"){ var b5=srDocSnap("companies",p.target), cu2={watch:true, listing:"target", watchWhy:(via==="card"? "From a Highlights suggestion: " : "From Search review: ")+(p.why||"")};
      await DB.doc("companies/"+p.target).update(cu2); await srLog({kind:"company", ruleId:p.target, action:"edit", before:b5, after:Object.assign({},b5,cu2), via:via, why:p.why}); return; }
    var cid=slug(p.name), n2=2; while(companies.some(function(c){return c.id===cid;})) cid=slug(p.name)+"-"+(n2++);
    var cdoc={name:p.name, watch:true, listing:"target", watchWhy:"Idea from Search review, on trial: "+(p.why||""), addedAt:today(), addedVia:via==="card"? "highlight" : "review"};
    await DB.doc("companies/"+cid).set(cdoc); await srLog({kind:"company", ruleId:cid, action:"add", before:null, after:cdoc, via:via, why:p.why}); return;
  }
  if(p.lever==="term"){
    var arr=prItems("search").map(function(x){return Object.assign({},x);}), gi=arr.findIndex(function(x){return x.group===p.target;}), before2=gi>=0? Object.assign({},arr[gi]) : null, after2;
    if(p.change==="remove" && gi>=0){ arr.splice(gi,1); after2=null; } else if(gi>=0){ arr[gi].terms=p.terms; after2=Object.assign({},arr[gi]); } else { after2={group:p.group||"New search", terms:p.terms}; arr.push(after2); }
    await prApply("search",arr,{ruleId:(after2||before2).group, action:!before2? "add" : after2? "edit" : "remove", before:before2, after:after2, via:via, why:p.why});
  }
}
async function rvApplyAll(all){
  var rv=rvCur(); if(!rv || RV.busy) return;
  if(rv.list){
    /* Ranked list: the ticked changes (or every change not turned down, for Accept all) become the decisions. */
    var ps0=(rv.proposals||[]).map(function(x){ var y=Object.assign({},x);
      if(y.kind==="change" && y.decision!=="no" && (all || y.sel)) y.decision= y.edited? "change" : "keep";
      if(y.kind!=="change" && y.decision!=="no" && (all || y.sel)) y.decision="keep";
      return y; });
    await rvSave({proposals:ps0}); rv=rvCur()||Object.assign({},rv,{proposals:ps0}); rv.proposals=ps0;
  }
  var keep=(rv.proposals||[]).map(function(p,i){return {p:rvFinal(p), i:i};}).filter(function(x){ return x.p.kind==="change" && (x.p.decision==="keep"||x.p.decision==="change"); });
  RV.busy="apply"; renderReview();
  var done=0;
  for(var k=0;k<keep.length;k++){ try{ await rvApplyOne(keep[k].p); done++; await new Promise(function(r){setTimeout(r,30);}); }catch(e){ console.warn("apply",e); } }
  try{ await rvSave({stage:"done", appliedN:done, doneAt:new Date().toISOString()}); }catch(e){}
  RV.busy=""; toast(done? plural(done,"change")+" applied — live from the next sweep" : "Review finished"); renderReview();
}

/* ---------- the page ---------- */
function rvChangeHtml(p){
  if(p.kind==="skill") return '<div class="rvchg rvskill"><span class="rvlev">Needs a skill change</span><p>No board setting can do this, so a skill has to change. Paste this into Claude in your Next Role project:</p><pre class="rvprompt">'+esc(p.prompt||"")+'</pre><div class="rvacts"><button type="button" class="btn sm" data-rvcopy="1">Copy the prompt</button></div></div>';
  if(p.lever==="check"){ var hk=ruRules().find(function(x){return x.id===p.target;})||{};
    return '<div class="rvchg"><span class="rvlev">How the sweep checks '+esc(p.target+" · "+(hk.name||""))+'</span>'+(hk.check && hk.check!==p.check? '<del>'+esc(hk.check)+'</del>' : "")+'<ins>'+esc(p.check)+'</ins><small>The rule itself stays: '+esc(hk.rule||"")+'</small></div>'; }
  if(p.lever==="company" && p.change==="unwatch"){ var cu=companies.find(function(x){return x.id===p.target;})||{};
    return '<div class="rvchg"><span class="rvlev">Company · watched</span><ins>Stop watching '+esc(cu.name||p.target)+'\'s careers page</ins><small>It stays on your list; turn watching back on from its card.</small></div>'; }
  if(p.kind==="action") return p.tab? '<a href="#" class="btn sm" data-gotab="'+esc(p.tab)+'">Go to '+esc(RV_TABS[p.tab])+' →</a>' : "";
  if(p.lever==="rule"){ var h=ruRules().find(function(x){return x.id===p.target;});
    return '<div class="rvchg"><span class="rvlev">Rule '+esc(p.target==="new"? "· new" : p.target+" · "+((h&&h.name)||""))+'</span>'+(p.change==="remove"? '<p>Remove this rule.</p>' :
      (h && p.target!=="new"? '<del>'+esc(h.rule||"")+'</del>' : "")+'<ins>'+esc(p.rule)+'</ins>'+(p.fires && (!h || p.fires!==h.fires)? '<small>Checked at: '+esc(stageWord(p.fires))+'</small>' : ""))+'</div>'; }
  if(p.lever==="term"){ var g=prItems("search").find(function(x){return x.group===p.target;});
    return '<div class="rvchg"><span class="rvlev">Search terms · '+esc(p.target==="new"? (p.group||"new group") : p.target)+'</span>'+(g? '<del>'+esc(g.terms||"")+'</del>' : "")+'<ins>'+esc(p.terms)+'</ins></div>'; }
  if(p.lever==="company"){ var cc=companies.find(function(x){return x.id===p.target;});
    return '<div class="rvchg"><span class="rvlev">Company · '+(cc? "already on your list" : "new idea")+'</span><ins>Watch '+esc(cc? cc.name : p.name)+'\'s careers page in every sweep</ins><small>'+(cc? "It moves to your targets." : "Added to Targets as a target. Check its card after.")+'</small></div>'; }
  if(p.lever==="source" && p.target==="new") return '<div class="rvchg"><span class="rvlev">New source · '+esc((chById(p.channel)||{}).name||"")+'</span><ins>'+esc(p.name)+(p.url? ' — '+esc(p.url.replace(/^https?:\/\//,"")) : "")+'</ins><small>Added as '+esc(p.newStatus||"trial")+'</small></div>';
  var nm= p.lever==="source"? ((srSrc(p.target)||{}).name||p.target) : ((chById(p.target)||{}).name||p.target), cur= p.lever==="source"? (srSrc(p.target)||{}).status : (chById(p.target)||{}).status;
  return '<div class="rvchg"><span class="rvlev">'+(p.lever==="source"? "Source" : "Channel")+' · '+esc(nm)+'</span><p>Status: <del>'+esc(cur||"active")+'</del> → <b>'+esc(p.newStatus)+'</b></p></div>';
}
function rvEditHtml(p){
  var f=[];
  if(p.kind==="skill") f.push(["prompt","The prompt to paste into Claude","area"]);
  else if(p.lever==="check") f.push(["check","How the sweep checks it","area"]);
  else if(p.lever==="company" && p.change==="unwatch") return '<div class="rvedit"><p class="rls">Nothing to change here: keep it or turn it down.</p><div class="rvacts"><button type="button" class="linkbtn" data-rv="cancel">Back</button></div></div>';
  else if(p.lever==="rule"){ if(p.target==="new") f.push(["name","Name","text"]); f.push(["fires","When it's checked","select",RULE_FIRES.map(function(x){return [x,stageWord(x)];})]); if(p.change!=="remove") f.push(["rule","The rule — what's out, and what stays in","area"]); }
  else if(p.lever==="term"){ if(p.target==="new") f.push(["group","Group","text"]); f.push(["terms","Terms, comma separated","area"]); }
  else if(p.lever==="company"){ if(p.target==="new") f.push(["name","Company name","text"]); else return '<div class="rvedit"><p class="rls">Nothing to change here: keep it or turn it down.</p><div class="rvacts"><button type="button" class="linkbtn" data-rv="cancel">Back</button></div></div>'; }
  else if(p.lever==="source" && p.target==="new"){ f.push(["name","Name","text"],["url","Link","text"],["newStatus","Status","select",RV_STS]); }
  else f.push(["newStatus","Status","select",RV_STS]);
  return '<div class="rvedit">'+f.map(function(x){ var v=p[x[0]]==null? "" : String(p[x[0]]);
    if(x[2]==="select") return '<label class="fld">'+esc(x[1])+'<select data-rvf="'+x[0]+'">'+x[3].map(function(o){ return '<option value="'+esc(o[0])+'"'+(o[0]===v?" selected":"")+'>'+esc(o[1])+'</option>'; }).join("")+'</select></label>';
    if(x[2]==="area") return '<label class="fld">'+esc(x[1])+'<textarea data-rvf="'+x[0]+'" rows="3">'+esc(v)+'</textarea></label>';
    return '<label class="fld">'+esc(x[1])+'<input data-rvf="'+x[0]+'" value="'+esc(v)+'"></label>'; }).join("")+
    '<div class="rvacts"><button type="button" class="btn sm primary" data-rv="editok">Use this version</button><button type="button" class="linkbtn" data-rv="cancel">Cancel</button></div></div>';
}
function rvIntroHtml(){
  var c=rvCounts(), list=rvReviews(), open=list.find(function(r){ return r.stage!=="done" && r.stage!=="failed" && r.stage!=="reading"; });
  return '<div class="rvcard rvintro"><h3>Where is your job search stuck?</h3>'+
    '<p>Claude reads the whole loop — <b>finding</b> roles, <b>deciding</b> on them, <b>applying</b> and <b>interviews</b> — says where it\'s stuck, and gives you a ranked list of what to do about it. Some are settings (a source, a search term, a rule or how the sweep checks it), some are things for you to do. Tick the ones you want and apply them.</p>'+
    '<ul class="rvread"><li><b>'+c.roles+'</b> roles</li><li><b>'+c.channels+'</b> channels</li><li><b>'+c.rules+'</b> deal-breakers</li><li><b>'+c.downs+'</b> roles you turned down</li><li><b>'+c.live+'</b> live applications</li></ul>'+
    '<p class="rvsafe"><b>Nothing changes until you confirm at the end.</b> Every change is logged and can be undone.</p>'+
    '<div class="rvacts"><button type="button" class="btn primary" data-rv="start">Start a review</button>'+(open? '<button type="button" class="btn" data-rv="open:'+esc(open.id)+'">Continue the one from '+esc(niceShort(String(open.at).slice(0,10)))+'</button>' : "")+'</div></div>';
}
function rvStepsHtml(stage){
  var S=[["diagnosis","Diagnosis"],["proposals","Suggestions"],["summary","Done"]], idx= stage==="diagnosis"||stage==="reading"||stage==="thinking"? 0 : stage==="proposals"? 1 : 2;
  return '<ol class="rvsteps">'+S.map(function(s,i){ return '<li class="'+(i<idx?"done":i===idx?"on":"")+'">'+s[1]+'</li>'; }).join("")+'</ol>';
}
/* One proposal's details: what changes, why, evidence, the thread, and the edit / ask / not-this boxes. */
function rvDetailHtml(p,i){
  var here=RV.step===i;
  return (p.revisedNote? '<p class="rvrev">'+esc(p.revisedNote)+'</p>' : "")+
    (here && RV.edit? rvEditHtml(p) : rvChangeHtml(p))+
    '<p><b>Why:</b> '+esc(p.why)+'</p>'+(p.evidence? '<p><b>Evidence:</b> '+esc(p.evidence)+'</p>' : "")+
    ((p.thread||[]).length? '<div class="rvthread">'+p.thread.map(function(t){ return '<div class="rvmsg m-'+t.role+'"><b>'+(t.role==="you"? "You" : "Claude")+'</b> '+esc(t.text)+'</div>'; }).join("")+(here && RV.busy==="ask"? '<div class="rvmsg m-claude"><b>Claude</b> …</div>' : "")+'</div>' : "")+
    (here && RV.ask? '<div class="rvaskbox"><textarea id="rv-q" rows="2" placeholder="Ask Claude about this suggestion"></textarea><div class="rvacts"><button type="button" class="btn sm primary" data-rv="asksend:'+i+'"'+(RV.busy?" disabled":"")+'>Ask</button><button type="button" class="linkbtn" data-rv="cancel">Close</button></div></div>' : "")+
    (here && RV.no? '<div class="rvaskbox"><textarea id="rv-no" rows="2" placeholder="Why not? Claude reads this next time">'+esc(p.feedback||"")+'</textarea><div class="rvacts"><button type="button" class="btn sm" data-rv="nook:'+i+'">Not this</button><button type="button" class="linkbtn" data-rv="cancel">Cancel</button></div></div>' : "")+
    (!(here && (RV.edit||RV.no))? '<div class="rvacts">'+
      (p.kind==="change"? '<button type="button" class="btn sm" data-rv="edit:'+i+'">Change it</button>' : "")+
      (p.decision==="no"? '<button type="button" class="btn sm" data-rv="undecide:'+i+'">Undo “Not this”</button>' : '<button type="button" class="btn sm" data-rv="no:'+i+'">Not this</button>')+
      (!(here && RV.ask)? '<button type="button" class="linkbtn" data-rv="ask:'+i+'">Ask about it</button>' : "")+'</div>' : "");
}
var RV_KIND={change:"A change to your setup", action:"For you to do", skill:"Needs a skill change"};
function rvListHtml(rv){
  var ps=rv.proposals||[];
  if(!ps.length) return '<div class="rvcard"><p>'+esc(rv.intro||"Claude has nothing to suggest right now.")+'</p><div class="rvacts"><button type="button" class="btn" data-rv="apply">Finish</button></div></div>';
  var sel=ps.filter(function(p){return p.kind==="change" && p.sel && p.decision!=="no";}).length, avail=ps.filter(function(p){return p.kind==="change" && p.decision!=="no";}).length;
  var items=ps.map(function(p0,i){ var p=rvFinal(p0), open=!!RV.open[i], no=p.decision==="no";
    var ck= p.kind==="change"? '<label class="rvsel" title="'+(no? "You said not this" : "Tick to apply")+'"><input type="checkbox" data-rvsel="'+i+'"'+(p.sel && !no?" checked":"")+(no||RV.busy?" disabled":"")+'></label>' : '<span class="rvsel"></span>';
    return '<li class="rvli'+(open?" open":"")+(no?" d-no":"")+(p.sel && !no?" on":"")+'">'+ck+'<span class="rvrank">'+(i+1)+'</span>'+
      '<div class="rvlim"><button type="button" class="rvlih" data-rv="tog:'+i+'" aria-expanded="'+open+'"><span class="rvlit"><b>'+esc(p.title||"Suggestion")+'</b>'+
        '<span class="rvkind k-'+esc(p.kind)+'">'+esc(RV_KIND[p.kind]||"")+'</span>'+(p.edited? '<span class="rvdec d-change">Your version</span>' : "")+(no? '<span class="rvdec d-no">Not this'+(p.feedback? ' — “'+esc(p.feedback)+'”' : "")+'</span>' : "")+'</span>'+
        (p.effect? '<span class="rvlie">'+esc(p.effect)+'</span>' : "")+'<span class="rvchev">'+(open?"▴":"▾")+'</span></button>'+
        (p.kind==="action" && !open && p.tab? '<div class="rvacts rvliq">'+rvChangeHtml(p)+'</div>' : "")+
        (open? '<div class="rvlid">'+rvDetailHtml(p,i)+'</div>' : "")+'</div></li>'; }).join("");
  return '<div class="rvcard rvlist"><div class="rvlh"><h3>What to do, most valuable first</h3>'+(rv.intro? '<p class="rvintro2">'+esc(rv.intro)+'</p>' : "")+'</div>'+
    '<ol class="rvlis">'+items+'</ol>'+
    (RV.err? '<p class="rverr">'+esc(RV.err)+'</p>' : "")+
    '<div class="rvacts rvlf"><button type="button" class="btn primary" data-rv="apply"'+(RV.busy||!sel?" disabled":"")+'>'+(RV.busy==="apply"? "Applying…" : "Apply selected"+(sel? " ("+sel+")" : ""))+'</button>'+
      (avail? '<button type="button" class="btn" data-rv="applyall"'+(RV.busy?" disabled":"")+'>Accept all '+plural(avail,"change")+'</button>' : "")+
      '<button type="button" class="linkbtn" data-rv="finish"'+(RV.busy?" disabled":"")+'>Finish without changes</button>'+
      '<span class="rvsafe2">Nothing changes until you apply. Every change is logged and can be undone.</span></div></div>';
}
function rvRunHtml(rv){
  var st=rv.stage, dg=rv.diagnosis||{}, h='<div class="rvhead"><button type="button" class="linkbtn" data-rv="back">← All reviews</button>'+rvStepsHtml(st==="done"? "summary" : st)+'</div>';
  if(RV.busy==="diagnosis"||RV.busy==="proposals") return h+'<div class="rvcard"><h3>'+(RV.busy==="diagnosis"? "Claude is reading your search" : "Claude is re-ranking the list")+'</h3><ol class="rvprog">'+rvProgHtml()+'</ol><p class="lede" style="font-size:12.5px;margin:0">This can take up to a minute.</p></div>';
  if(RV.err && (st==="reading"||st==="failed")) return h+'<div class="rvcard"><p>'+esc(RV.err)+'</p><div class="rvacts"><button type="button" class="btn primary" data-rv="start">Try again</button></div></div>';
  var diag='<div class="rvcard rvdiag"><span class="rvarea a-'+esc(dg.area||"")+'">'+esc(RV_AREAS[dg.area]||"Diagnosis")+'</span><p class="rvsum">'+esc(dg.summary||"")+'</p>'+
    ((dg.evidence||[]).length? '<ul class="rvev">'+dg.evidence.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>' : "");
  if(st==="diagnosis"){
    /* A review from before the ranked list, stopped at the question. */
    return h+diag+'<div class="rvq"><p class="rvask">'+esc(dg.question||"")+'</p>'+
      '<textarea id="rv-reply" rows="2" placeholder="Optional: what you\'re seeing, in your own words"></textarea>'+
      (RV.err? '<p class="rverr">'+esc(RV.err)+'</p>' : "")+
      '<div class="rvacts"><button type="button" class="btn primary" data-rv="reply:Yes">Yes, that\'s it</button><button type="button" class="btn" data-rv="reply:Partly">Partly</button><button type="button" class="btn" data-rv="reply:No">No</button></div></div></div>';
  }
  var ps=rv.proposals||[];
  if(st==="proposals"){
    var you=rv.reply? '<p class="rvyou"><b>You:</b> '+esc(rv.reply.choice==="Rerank"? "" : rv.reply.choice)+(rv.reply.text? (rv.reply.choice==="Rerank"? "" : " — ")+esc(rv.reply.text) : "")+'</p>' : "";
    var refine= RV.refine? '<div class="rvq"><p class="rvask">'+esc(dg.question||"What are you seeing?")+'</p><textarea id="rv-reply" rows="2" placeholder="What you\'re seeing, in your own words. Claude re-ranks the list."></textarea>'+
        '<div class="rvacts"><button type="button" class="btn sm primary" data-rv="reply:Rerank">Re-rank the list</button><button type="button" class="linkbtn" data-rv="refine">Cancel</button></div></div>'
      : '<div class="rvacts"><button type="button" class="linkbtn" data-rv="refine">Doesn\'t match what you see? Tell Claude →</button></div>';
    return h+diag+you+refine+'</div>'+rvListHtml(rv);
  }
  /* finished */
  diag+= rv.reply? '<p class="rvyou"><b>You:</b> '+esc(rv.reply.choice==="Rerank"? "" : rv.reply.choice)+(rv.reply.text? ' '+esc(rv.reply.text) : "")+'</p></div>' : '</div>';
  var keep=ps.map(rvFinal).filter(function(p){return p.kind==="change" && (p.decision==="keep"||p.decision==="change");});
  var acts=ps.map(rvFinal).filter(function(p){return p.kind!=="change" && p.decision!=="no";});
  var skip=ps.map(rvFinal).filter(function(p){return p.decision==="no" || (p.kind==="change" && !p.decision);});
  return h+diag+'<div class="rvcard rvsumc"><h3>Done</h3>'+
    '<h4>Changes applied · '+keep.length+'</h4>'+(keep.length? '<ul class="rvl">'+keep.map(function(p){ return '<li><b>'+esc(p.title)+'</b>'+rvChangeHtml(p)+'</li>'; }).join("")+'</ul>' : '<p class="lede" style="font-size:12.5px;margin:0">None.</p>')+
    (acts.length? '<h4>For you to do · '+acts.length+'</h4><ul class="rvl">'+acts.map(function(p){ return '<li><b>'+esc(p.title)+'</b> '+rvChangeHtml(p)+'</li>'; }).join("")+'</ul>' : "")+
    (skip.length? '<h4>Not done · '+skip.length+'</h4><ul class="rvl dim">'+skip.map(function(p){ return '<li>'+esc(p.title)+(p.feedback? ' — “'+esc(p.feedback)+'”' : p.decision? "" : " (not picked)")+'</li>'; }).join("")+'</ul>' : "")+
    '<p class="rvsafe">'+(rv.appliedN? plural(rv.appliedN,"change")+" applied. Undo any of them in the log below." : "Nothing was changed.")+'</p></div>';
}
function renderReview(){
  var host=el("rv-root"); if(!host || typeof tab==="undefined" || tab!=="review") return;
  var a=document.activeElement; if(a && host.contains(a) && /TEXTAREA|INPUT|SELECT/.test(a.tagName) && a.type!=="checkbox" && !RV._force) return;
  RV._force=false;
  var rv=rvCur(), body;
  if(RV.id && !rv) body='<div class="rvcard"><h3>Claude is reading your search</h3><ol class="rvprog">'+rvProgHtml()+'</ol></div>';
  else if(rv) body=rvRunHtml(rv);
  else {
    var list=rvReviews().filter(function(r){return r.stage!=="reading" && r.stage!=="failed";});
    body=rvIntroHtml()+(list.length? '<div class="rvcard"><h3>Past reviews</h3><ul class="rvpast">'+list.slice(0,10).map(function(r){
        var dg=r.diagnosis||{}, kept=(r.proposals||[]).filter(function(p){return p.decision==="keep"||p.decision==="change";}).length;
        return '<li><button type="button" class="linkbtn" data-rv="open:'+esc(r.id)+'">'+esc(niceShort(String(r.at).slice(0,10)))+'</button><span class="rvarea a-'+esc(dg.area||"")+'">'+esc(RV_AREAS[dg.area]||"—")+'</span>'+
          '<span class="rvps">'+esc((dg.summary||"").slice(0,120))+((dg.summary||"").length>120? "…" : "")+'</span><span class="rvpn2">'+(r.stage==="done"? plural(r.appliedN||0,"change")+" applied" : "Not finished")+'</span></li>'; }).join("")+'</ul></div>' : "");
  }
  host.innerHTML=body+'<div class="rvcard">'+(srLogHtml()||'<p class="lede" style="font-size:12.5px;margin:0">No changes to your search yet.</p>')+'</div>';
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("#rv-root [data-rv]"); if(!b) return;
  ev.preventDefault();
  var p=String(b.dataset.rv).split(":"), a=p[0];
  function go(){ RV._force=true; renderReview(); }
  if(a==="start") return rvStart();
  if(a==="open"){ RV.id=p[1]; RV.step=-1; RV.view=null; RV.err=""; RV.edit=RV.ask=RV.no=RV.refine=false; RV.open={}; var r=rvCur(); if(r && r.stage==="thinking"){ rvSave({stage:r.list? "proposals" : "diagnosis"}); } return go(); }
  if(a==="back"){ RV.id=null; RV.view=null; RV.err=""; RV.edit=RV.ask=RV.no=RV.refine=false; RV.open={}; return go(); }
  if(a==="reply") return rvReply(p[1]);
  if(a==="refine"){ RV.refine=!RV.refine; RV.err=""; go(); if(RV.refine) setTimeout(function(){ var t=el("rv-reply"); if(t) t.focus(); },30); return; }
  if(a==="tog"){ var ti=+p[1]; RV.open[ti]=!RV.open[ti]; if(RV.step===ti){ RV.edit=RV.ask=RV.no=false; } return go(); }
  if(a==="edit"){ RV.step=+p[1]; RV.edit=true; RV.ask=RV.no=false; return go(); }
  if(a==="editok"){ var v={}; Array.prototype.forEach.call(document.querySelectorAll("#rv-root [data-rvf]"),function(x){ v[x.dataset.rvf]=x.value.trim(); });
    var ei=RV.step; rvSetP(ei,{edited:v, sel:true, decision:""}).then(function(){ RV.edit=false; go(); }); return; }
  if(a==="no"){ RV.step=+p[1]; RV.no=true; RV.ask=RV.edit=false; go(); setTimeout(function(){ var t=el("rv-no"); if(t) t.focus(); },30); return; }
  if(a==="nook"){ var fb=((el("rv-no")||{}).value||"").trim(); rvSetP(+p[1],{decision:"no", sel:false, feedback:fb}).then(function(){ RV.no=false; go(); }); return; }
  if(a==="undecide"){ rvSetP(+p[1],{decision:"", feedback:""}).then(go); return; }
  if(a==="ask"){ RV.step=+p[1]; RV.ask=true; RV.no=RV.edit=false; go(); setTimeout(function(){ var t=el("rv-q"); if(t) t.focus(); },30); return; }
  if(a==="asksend") return rvAskAbout(+p[1]);
  if(a==="cancel"){ RV.edit=RV.ask=RV.no=false; return go(); }
  if(a==="apply") return rvApplyAll(false);
  if(a==="applyall") return rvApplyAll(true);
  if(a==="finish"){ var rf=rvCur(); if(!rf) return; rvSave({stage:"done", appliedN:0, doneAt:new Date().toISOString()}).then(go); return; }
});
document.addEventListener("change",function(ev){
  var c=ev.target.closest && ev.target.closest("#rv-root [data-rvsel]"); if(!c) return;
  rvSetP(+c.dataset.rvsel,{sel:c.checked}).then(function(){ RV._force=true; renderReview(); });
});
/* Copy a skill-change prompt (Search review and a card's suggestion). */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-rvcopy]"); if(!b) return;
  ev.preventDefault(); var pre=b.closest(".rvchg") && b.closest(".rvchg").querySelector(".rvprompt"); if(!pre) return;
  var txt=pre.textContent;
  function done(){ toast("Prompt copied — paste it into Claude in your Next Role project"); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done,function(){ hsCopyFallback(pre); done(); });
  else { hsCopyFallback(pre); done(); }
});
function hsCopyFallback(node){ try{ var r=document.createRange(); r.selectNodeContents(node); var sl=window.getSelection(); sl.removeAllRanges(); sl.addRange(r); document.execCommand("copy"); }catch(e){} }
document.addEventListener("keydown",function(ev){
  if(ev.key!=="Enter" || ev.shiftKey) return;
  var t=ev.target; if(!t || !t.id) return;
  if(t.id==="rv-q"){ ev.preventDefault(); var b=document.querySelector('#rv-root [data-rv^="asksend:"]'); if(b) b.click(); }
});
/* Draw on arrival, and when reviews or the log change (but never under someone's typing). */
showTab=(function(orig){ return function(t){ orig(t); if(t==="review"){ RV._force=true; try{ renderReview(); }catch(e){ console.warn("review",e); } } }; })(showTab);
renderAbout=(function(orig){ return function(){ orig(); try{ renderReview(); }catch(e){} }; })(renderAbout);
if(typeof tab!=="undefined" && tab==="review"){ try{ renderReview(); }catch(e){} }

/* ===== Suggest a change, from a Highlights card (3 Oct) =====
   Claude drafts ONE proposal for the card, in the Search review shape (rvClean, so the same firmness limits
   apply). Accept applies it through rvApplyOne (logged, undo in the change log) and marks the card handled;
   Edit changes it first; Reject keeps the reason, which the next Search review reads. A fix that needs a skill
   changed comes back as a prompt to copy into Claude in the Next Role project. Each one is a `rulereviews`
   doc with scope "card". */
var HS={h:null, id:null, busy:false, err:"", edit:false, no:false};
function hsDoc(){ return HS.id? RU.reviews.find(function(r){return r.id===HS.id;}) : null; }
function hsP(){ var d=hsDoc(); return d && d.proposals && d.proposals[0]? rvFinal(d.proposals[0]) : (HS.p||null); }
async function hsOpen(h){
  if(!DB){ toast("The board hasn't loaded yet",true); return; }
  HS={h:h, id:null, busy:true, err:"", edit:false, no:false, p:null};
  var d=el("hs-dialog"); if(!d) return; el("hs-title").textContent="Suggest a change";
  if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
  hsRender();
  try{
    var j=await rvAsk([{role:"user",content:rvRole()+"\n\n"+rvFacts()+
      "\n\nTHE USER IS LOOKING AT THIS HIGHLIGHT ON THEIR BOARD:\n"+(h.group==="fyi"? "FYI" : "ACT")+": "+h.title+" — "+h.text+
      "\n\nPropose exactly ONE thing that deals with this highlight, the most effective one. When roles that fail a deal-breaker still reach the user, the fix is usually the rule's check note (lever check), not the rule. "+
      "When a fixed rule cuts a lot from one channel or company, the fix is sourcing (terms, sources, which companies are watched). "+locText(RV_LEVERS)+
      'Reply with JSON only: {"proposal":'+RV_SHAPE+'}'}],"complex");
    var p=rvClean(j && (j.proposal || (j.proposals||[])[0]));
    if(!p) throw {code:"unusable"};
    var id="hs-"+Date.now();
    HS.p=p; await DB.doc("rulereviews/"+id).set({at:new Date().toISOString(), scope:"card", hl:h.key, hlTitle:h.title||"", stage:"open", proposals:[p]}); HS.id=id;
  }catch(e){ HS.err= e && e.code==="unusable"? "Claude's suggestion wasn't something the board can apply. Try again." : rvErr(e); }
  HS.busy=false; hsRender();
}
function hsRender(){
  var body=el("hs-body"); if(!body || !HS.h) return;
  var h=HS.h, p=hsP(), d=hsDoc(), dec=p && p.decision;
  var head='<div class="hshl"><span class="eyebrow">For this highlight</span><b>'+esc(h.title)+'</b></div>';
  if(HS.busy){ body.innerHTML=head+'<p class="lede" style="margin:0;font-size:13px">Claude is reading the evidence and drafting one change…</p>'; return; }
  if(!p){ body.innerHTML=head+'<p class="rverr">'+esc(HS.err||"Something went wrong.")+'</p><div class="rvacts"><button type="button" class="btn primary" data-hs="again">Try again</button></div>'; return; }
  var edit= HS.edit? rvEditHtml(p).replace(/data-rv="editok"/g,'data-hs="editok"').replace(/data-rv="cancel"/g,'data-hs="cancel"') : rvChangeHtml(p);
  var acts;
  if(dec==="keep"||dec==="change") acts='<p class="rvsafe">'+(p.kind==="change"? "Applied and logged. The card is marked handled; undo it in Changes to your search." : "Noted. The card is marked handled.")+'</p>';
  else if(dec==="no") acts='<p class="rvsafe">Turned down'+(p.feedback? ': “'+esc(p.feedback)+'”' : "")+'. Search review reads this next time.</p><div class="rvacts"><button type="button" class="btn" data-hs="again">Suggest something else</button></div>';
  else if(HS.no) acts='<div class="rvaskbox"><textarea id="hs-no" rows="2" placeholder="Why not? Claude reads this next time"></textarea><div class="rvacts"><button type="button" class="btn sm" data-hs="nook">Reject</button><button type="button" class="linkbtn" data-hs="cancel">Cancel</button></div></div>';
  else if(HS.edit) acts="";
  else acts='<div class="rvacts">'+(p.kind==="change"? '<button type="button" class="btn primary" data-hs="ok"'+(HS.busy?" disabled":"")+'>Accept</button><button type="button" class="btn" data-hs="edit">Edit</button>'
      : '<button type="button" class="btn primary" data-hs="ok">'+(p.kind==="skill"? "Mark handled" : "Got it")+'</button>'+(p.kind==="skill"? '<button type="button" class="btn" data-hs="edit">Edit</button>' : ""))+
    '<button type="button" class="btn" data-hs="no">Reject</button></div>';
  body.innerHTML=head+'<div class="hsp"><div class="rvpn"><span class="rvkind k-'+esc(p.kind)+'">'+esc(RV_KIND[p.kind]||"")+'</span></div><h3>'+esc(p.title||"Suggestion")+'</h3>'+edit+
    '<p><b>Why:</b> '+esc(p.why)+'</p>'+(p.evidence? '<p><b>Evidence:</b> '+esc(p.evidence)+'</p>' : "")+(p.effect? '<p><b>Expected:</b> '+esc(p.effect)+'</p>' : "")+
    (HS.err? '<p class="rverr">'+esc(HS.err)+'</p>' : "")+acts+'</div>';
}
async function hsSet(patch){ var d=hsDoc(); if(!d) return; var ps=(d.proposals||[]).map(function(x){return Object.assign({},x);}); Object.assign(ps[0],patch); await DB.doc("rulereviews/"+d.id).update({proposals:ps, stage:patch.decision? "done" : "open"}); }
async function hsAccept(){
  var p=hsP(); if(!p || HS.busy) return;
  HS.busy=true; HS.err=""; hsRender();
  try{
    if(p.kind==="change") await rvApplyOne(p,"card");
    var d=hsDoc(); await hsSet({decision:d && d.proposals[0].edited? "change" : "keep"});
    var lab=(p.kind==="change"? "Applied: " : p.kind==="skill"? "Skill change prompt copied: " : "Did: ")+(p.title||"");
    if(typeof hlSet==="function") await hlSet(HS.h,"handled",lab);
    if(p.kind==="change") toast("Applied — live from the next sweep. Undo it in Changes to your search");
  }catch(e){ console.warn(e); HS.err="Couldn't apply it — try again."; }
  HS.busy=false; hsRender();
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("#hs-body [data-hs]"); if(!b) return;
  ev.preventDefault(); var a=b.dataset.hs;
  if(a==="again") return hsOpen(HS.h);
  if(a==="ok") return hsAccept();
  if(a==="edit"){ HS.edit=true; HS.no=false; return hsRender(); }
  if(a==="cancel"){ HS.edit=HS.no=false; return hsRender(); }
  if(a==="editok"){ var v={}; Array.prototype.forEach.call(document.querySelectorAll("#hs-body [data-rvf]"),function(x){ v[x.dataset.rvf]=x.value.trim(); });
    hsSet({edited:v}).then(function(){ HS.edit=false; hsRender(); }); return; }
  if(a==="no"){ HS.no=true; HS.edit=false; hsRender(); setTimeout(function(){ var t=el("hs-no"); if(t) t.focus(); },30); return; }
  if(a==="nook"){ var fb=((el("hs-no")||{}).value||"").trim(); hsSet({decision:"no", feedback:fb}).then(function(){ HS.no=false; hsRender(); }); return; }
});
/* The review doc arrives through the rulereviews subscription; redraw when it does. */
renderAbout=(function(orig){ return function(){ orig(); try{ var d=el("hs-dialog"); if(d && d.open && !HS.edit && !HS.no) hsRender(); }catch(e){} }; })(renderAbout);
