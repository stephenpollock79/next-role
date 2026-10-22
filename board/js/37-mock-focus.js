"use strict";
/* ===== Mock interview: the focus drafts itself (6 Oct) =====
   Picking a role fills Focus with a short draft built from the board (instant, no Claude usage): what the round
   tests and its likely questions, what the interview materials say they assess, what the last round's notes left
   open, where the CV is thin against the ad (Role Fit partials and gaps), deal-breakers still unknown, and what the
   last mock said to practise. A "From:" line names what it used. The draft only fills an empty box or one still
   holding an untouched draft; once you type, nothing overwrites it. "Sharpen with Claude" is the only thing that
   calls Claude: since 12 Oct it reads only the CV, the job ad and the round's interview materials (what the real
   interviewer would have, via mkfBrief) and writes 3-6 bullets naming areas to probe, never the user's own stories,
   asking first if you've edited the box. The interviewer reads all the material either way; Focus only steers. */
var MKF={role:"", cid:"", draft:"", by:"", busy:false, sure:false, err:""};
function mkfRole(){ var v=el("mk-role")&&el("mk-role").value; return v? roles.find(function(x){ return x.id===v; })||null : null; }
/* The round being practised: the meeting a mock was opened from, else the role's next round. */
function mkfRound(r){
  var I=mkrInfo(r), c=null, p={};
  if(MKF.cid==="screen") return {I:I, c:null, p:r.screenPrep||{}, lab:"screen"};
  if(MKF.cid) c=commitments.find(function(x){ return x.id===MKF.cid; })||null;
  if(!c) c=I.next;
  if(c){ if(r.interviewPrep && r.interviewPrep[c.id]) p=Object.assign({},r.interviewPrep[c.id]);
    if(c.prep && typeof c.prep==="object") p=Object.assign(p,c.prep); }
  return {I:I, c:c, p:p, lab:"round"};
}
function mkfMats(r,c){
  if(typeof maForRole!=="function") return [];
  return maForRole(r).filter(function(m){ return m.scopeKind!=="meeting" || !c || m.meetingId===c.id; });
}
function mkfLastMock(r){
  return (mocks||[]).filter(function(m){ return m.roleId===r.id && m.feedback; })
    .sort(function(a,b){ return String(b.id).localeCompare(String(a.id)); })[0]||null;
}
/* The round type leads (8 Oct): the draft opens with what the chosen types cover, and the company's own angle from the
   round's advice is one line that colours the round rather than steering it. */
var MKF_CORE={screen:"my story, motivation, why this role, pay and logistics", culture:"behavioural examples: conflict, failure, feedback, ownership",
  pm:"product management itself: how I do the job, my views on the craft, and how AI is changing PM", domain:"the market, customers, business model and metrics in this space",
  livecase:"a live product case, thinking out loud", takehome:"presenting and defending my take-home"};
function mkfBoard(r){
  var R=mkfRound(r), p=R.p, b=[], from=[];
  var ts=(MKT && MKT.sel && MKT.sel.length)? MKT.sel : [], sp=ts.length>1 && typeof mkSplit==="function"? mkSplit() : null;
  if(ts.length) b.push("Mostly "+ts.map(function(t){ return (sp? sp[t]+" on " : "")+(MKF_CORE[t]||MOCKTYPES[t]||t); }).join("; then ")+".");
  var lq=(p.likelyQuestions||[]).filter(Boolean).slice(0,2);
  if(p.tests||lq.length){ b.push("Company angle, as colour only: "+clip([p.tests? clip(p.tests,110) : "", lq.length? "e.g. "+lq.join("; ") : ""].filter(Boolean).join(". "),200)); from.push(R.lab==="screen"? "screen prep" : "round prep"); }
  var as=[]; mkfMats(r,R.c).forEach(function(m){ ((m.digest||{}).assesses||[]).forEach(function(a){ if(a && as.indexOf(a)<0) as.push(a); }); });
  if(as.length){ b.push("Their materials say they assess: "+as.slice(0,4).join("; ")); from.push("interview materials"); }
  var last=R.I.prev[0], cv=last && conversations.find(function(x){ return x.meetingId===last.id; });
  if(cv){ var said=[cv.notes,cv.concerned].concat(cv.nextQuestions||[]).filter(Boolean).join(" ").replace(/\s+/g," ").trim();
    if(said){ b.push("Follow up on the last round ("+clip(last.title||"interview",50)+"): "+clip(said,200)); from.push("last round's notes"); } }
  var reqs=((r.fit||{}).reqs||[]).filter(function(q){ return q && q.text && (q.match==="gap"||q.match==="partial"); })
    .sort(function(a,b){ return ((b.must?1:0)-(a.must?1:0)) || ((a.match==="gap"?0:1)-(b.match==="gap"?0:1)); }).slice(0,3);
  if(reqs.length){ b.push("Probe where my CV is thin for this ad: "+reqs.map(function(q){ return clip(q.text,70)+" ("+q.match+")"; }).join("; ")); from.push("Role Fit"); }
  var res=(r.enrich&&r.enrich.gate2Rules)||{};
  var unk=((PREFS&&PREFS.hardRules)||[]).filter(function(h){ return h && h.id && (!res[h.id] || res[h.id]==="unknown"); }).slice(0,3);
  if(unk.length && MKT.sel.some(function(t){ return ASKSQUESTIONS[t]; })){ b.push("Leave time for my questions on: "+unk.map(function(h){ return h.name||h.id; }).join(", ")); from.push("your deal-breakers"); }
  var lm=mkfLastMock(r);
  if(lm && lm.feedback.nextFocus){ b.push("From my last mock: "+clip(lm.feedback.nextFocus,170)); from.push("last mock"); }
  return {text:b.map(function(x){ return "- "+x; }).join("\n"), from:from};
}
/* Everything Claude can read for this role, for the From line after a sharpen. */
function mkfAll(r){
  var R=mkfRound(r), a=[];
  if(TEMPLATES && TEMPLATES.cv && TEMPLATES.cv.text || (r.final && r.final.cv)) a.push("CV");
  if(r.adSummary && !r.adSummary.removed || ((r.fit||{}).reqs||[]).length) a.push("job ad");
  if(mkfMats(r,R.c).length) a.push("interview materials");
  return a;
}
function mkfFill(force){
  var box=el("mk-focus"); if(!box || MK.on) return;
  var r=mkfRole(), untouched=!box.value.trim() || box.value===MKF.draft;
  if(!r){ if(untouched && MKF.by){ box.value=""; MKF.draft=""; MKF.by=""; } MKF.role=""; mkfPaint(); return; }
  var changed=r.id!==MKF.role;
  if(force || (untouched && (changed || MKF.by!=="claude"))){
    var d=mkfBoard(r); box.value=d.text; MKF.draft=d.text; MKF.by=d.text? "board" : "";
  }
  if(changed){ MKF.sure=false; MKF.err=""; }
  MKF.role=r.id; mkfPaint();
}
function mkfPaint(){
  var box=el("mk-focus"); if(!box) return;
  var lab=box.closest("label"), r=mkfRole();
  var tag=el("mk-fsrc"); if(!tag && lab){ lab.insertBefore(Object.assign(document.createElement("span"),{id:"mk-fsrc",className:"mkfsrc"}),box); tag=el("mk-fsrc"); }
  var bar=el("mk-fbar"); if(!bar && lab){ lab.insertAdjacentHTML("afterend",'<div class="mkfbar" id="mk-fbar"></div>'); bar=el("mk-fbar"); }
  var mine=box.value.trim() && box.value!==MKF.draft;
  if(tag){ tag.textContent= !box.value.trim()? "" : mine? "edited by you" : MKF.by==="claude"? "sharpened by Claude" : MKF.by==="board"? "draft from your board" : "";
    tag.className="mkfsrc"+(MKF.by==="claude" && !mine? " ai" : ""); }
  if(!bar) return;
  if(!r){ bar.innerHTML=""; bar.hidden=true; return; }
  bar.hidden=false;
  var from= MKF.by==="claude"? mkfAll(r) : mkfBoard(r).from;
  bar.innerHTML='<div class="mkffrom">'+(from.length? "From: "+esc(from.join(" · ")) : "Nothing on the board for this round yet. Write your own, or let Claude draft one from the role and your CV.")+'</div>'+
    '<div class="mkfrow"><button type="button" class="btn sm" id="mk-fai"'+(MKF.busy? " disabled" : "")+'>'+
      (MKF.busy? "Sharpening…" : MKF.sure? "Replace my text? Click again" : MKF.by==="claude" && !mine? "Sharpen again" : "Sharpen with Claude")+'</button>'+
    '<span class="mkfdesc">'+(MKF.err? '<span class="mkferr">'+esc(MKF.err)+'</span> ' : "")+
      'The draft above is pulled straight from your board. Sharpen reads only what the real interviewer would have (your CV, the job ad and the company\'s interview materials) and writes a focus that names areas to probe, never your own stories or numbers. About 10 seconds; uses your Claude usage.</span></div>';
}
/* What the real interviewer would have (12 Oct): the CV, the job ad and the company's own interview materials for this
   round. Nothing from the user's stories, prep, notes, Role Fit evidence, deal-breakers or past mocks, so a sharpened
   focus names areas to probe, never the candidate's own projects or numbers. */
function mkfBrief(r,c){
  var out=["Role: "+r.title+" at "+r.company+(r.location? " ("+r.location+")" : "")], ad=r.adSummary;
  if(ad && typeof ad==="object" && !ad.removed){
    var ab=[];
    if(ad.purpose) ab.push("Why the role exists: "+ad.purpose);
    if(ad.scope) ab.push("Scope and team: "+ad.scope);
    if(ad.product) ab.push("Product and users: "+ad.product);
    if((ad.responsibilities||[]).length) ab.push("Responsibilities: "+ad.responsibilities.join("; "));
    if(ad.success) ab.push("What success looks like: "+ad.success);
    if(ad.process) ab.push("Hiring process: "+ad.process);
    if((ad.notable||[]).length) ab.push("Also in the ad: "+ad.notable.join("; "));
    if(ab.length) out.push("The job ad:\n- "+clip(ab.join("\n- "),2600));
  }
  var fr=((r.fit||{}).reqs||[]).filter(function(q){ return q && q.text && q.match!=="na"; });
  if(fr.length) out.push("What the job asks for: "+fr.map(function(q){ return q.text+(q.must? " [must]" : ""); }).join(" | "));
  var ms=mkfMats(r,c);
  if(ms.length) out.push("The company's own interview materials for this round (their format, what they assess, named questions or tasks):\n"+ms.map(function(m){
    var g=m.digest, bits=[];
    if(g){ if(g.format) bits.push("format: "+g.format); if((g.assesses||[]).length) bits.push("they assess: "+g.assesses.join("; "));
      if((g.questions||[]).length) bits.push("questions or tasks: "+g.questions.join("; ")); }
    else if(m.kind==="text") bits.push(clip(m.text||"",1500));
    return "- "+(m.title||"Material")+": "+clip(bits.join(" | "),1500);
  }).join("\n"));
  return out.join("\n");
}
async function mkfSharpen(){
  var box=el("mk-focus"), r=mkfRole(); if(!box || !r || MKF.busy) return;
  if(!SAMPLE){ MKF.err= SAMPLE_READY? "Asking Claude isn't available in this view." : "Still connecting to Claude, try again in a moment."; mkfPaint(); return; }
  var mine=box.value.trim() && box.value!==MKF.draft;
  if(mine && !MKF.sure){ MKF.sure=true; mkfPaint(); return; }
  MKF.sure=false; MKF.err=""; MKF.busy=true; mkfPaint();
  try{
    var R=mkfRound(r), cvr={text:"",from:""};
    try{ cvr=await mkCvText(r); }catch(e){}
    var sp=MKT.sel.length>1? mkSplit() : null;
    var prompt=[
      "You are setting up a mock job interview. Write the FOCUS note the mock interviewer will follow for this round: which areas to cover, how to weight them, where to push, and when to leave time for the candidate's questions.",
      "The mock must feel like the real interview, so you know only what the real interviewer would know: the job ad, the company's interview materials and the candidate's CV.",
      "Rules:",
      "- 4 to 7 bullets, each starting \"- \", one line each, under 150 words in all.",
      "- Write it as the candidate's own request to the interviewer, in the first person (e.g. \"Push me on ...\").",
      "- Frame every bullet around what the job ad asks for and what the interview materials say they assess.",
      "- When the materials list what the round assesses, cover EVERY listed area: none dropped, none folded into another as a sub-point. Put the most heavily weighted areas first, each in its own bullet; lighter areas may share a bullet, but name each one in the materials' own words. If there are more areas than bullets allow, use the extra bullets for the light ones together.",
      "- Name areas, never the candidate's answers: do not name any project, product, story, experiment, initiative, metric or number from the CV. The interviewer finds those out by asking. \"Ask for an experiment I ran and make me name the metric, guardrail and result\" is right; naming which experiment is wrong.",
      "- How to probe is fine to state: open questions first, then follow-ups on what I personally decided (not \"we\"), the numbers, the trade-offs and what I'd change.",
      "- The round type sets the format (e.g. a depth interview digs into past experience; a case asks a hypothetical). The subject comes from the ad and the materials, not from the round type's general topics.",
      "- Include one hypothetical question about the company's own product or the team's remit (as the ad describes it), e.g. how I would approach the team's main problem there. Only one, and only when the ad or materials describe the product or remit.",
      "- Last bullet: how many minutes to leave for my questions. Don't list the questions.",
      "- Plain text only: no heading, no preamble, nothing after the bullets.",
      "",
      "Round type: "+mkTypesLabel(MKT.sel)+(sp? " (main questions: "+MKT.sel.map(function(t){ return sp[t]+" "+MOCKTYPES[t]; }).join(", ")+")" : "")+".",
      R.c? "The round being practised: "+(R.c.title||"interview")+(R.c.duration? ", "+R.c.duration+" minutes" : "")+"." : "",
      mine? "The candidate's own notes so far. Keep their intent unless it names their own projects or numbers:\n"+clip(box.value,1200) : "",
      "", "=== THE ROLE: JOB AD AND INTERVIEW MATERIALS ===", mkfBrief(r,R.c),
      "", "=== THE CANDIDATE'S CV ("+(cvr.from||"none")+"), to know their background only ===", cvr.text? clip(cvr.text,6000) : "(none on the board)"
    ].filter(function(x){ return x!==""; }).join("\n");
    var res=await SAMPLE([{role:"user",content:prompt}],{cache:false, modelTier:"default"});
    var t=String(res.text||"").replace(/```[a-z]*|```/g,"").trim();
    var ls=t.split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean).map(function(x){ return /^[-•*]\s*/.test(x)? "- "+x.replace(/^[-•*]\s*/,"") : "- "+x; });
    if(!ls.length) throw {code:"empty"};
    if((mkfRole()||{}).id!==r.id || MK.on) return;   /* the role changed while Claude was writing */
    box.value=ls.slice(0,7).join("\n"); MKF.draft=box.value; MKF.by="claude";
  }catch(e){ MKF.err= e&&e.code==="empty"? "Claude sent nothing back. Try again." : sampleErr(e); }
  finally{ MKF.busy=false; mkfPaint(); }
}
mockSuggest=(function(orig){ return function(){ orig(); try{ mkfFill(false); }catch(e){ console.warn("mock focus",e); } }; })(mockSuggest);
/* Practise from a meeting (or the screen) drafts the focus for that round, replacing what was there. */
openMockFor=(function(orig){ return function(roleId,cid){ orig(roleId,cid);
  if(MK.on) return; MKF.cid=cid||""; try{ mkfFill(true); }catch(e){ console.warn("mock focus",e); } }; })(openMockFor);
document.addEventListener("change",function(ev){ if(ev.target && ev.target.id==="mk-role"){ MKF.cid=""; } },true);
document.addEventListener("input",function(ev){ if(ev.target && ev.target.id==="mk-focus"){ if(MKF.sure){ MKF.sure=false; } mkfPaint(); } });
document.addEventListener("click",function(ev){ var b=ev.target.closest && ev.target.closest("#mk-fai"); if(b){ ev.preventDefault(); mkfSharpen(); } });
/* Changing the round types can change the questions line (screen and take-home don't ask), so redraw an untouched board draft. */
document.addEventListener("click",function(ev){ if(ev.target.closest && ev.target.closest("[data-mkt]") && MKF.by==="board"){ try{ mkfFill(false); }catch(e){} } });
try{ if(el("mk-role")) mkfFill(false); }catch(e){}
/* Fresh start on arrival (12 Oct): coming to Mock interview from another page clears the role, so Past mocks lists
   every mock instead of staying filtered to the last role. Practise (openMockFor) still works: it switches page first,
   then sets its role. A running mock or an open feedback view is left alone. */
var MKF_TAB="";
showTab=(function(orig){ return function(t){
  var from=MKF_TAB; orig.apply(this,arguments); MKF_TAB=t;
  if(t!=="mock" || from==="mock") return;
  try{
    var sel=el("mk-role"); if(!sel || MK.on || MK.viewing || !sel.value) return;
    var box=el("mk-focus"), untouched=box && (!box.value.trim() || box.value===MKF.draft);
    sel.value=""; MKF.cid="";
    if(untouched){ box.value=""; MKF.draft=""; MKF.by=""; }
    mockSuggest(); renderPastMocks();
  }catch(e){ console.warn("mock reset",e); }
}; })(showTab);
