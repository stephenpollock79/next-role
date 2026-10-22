"use strict";
renderManualChannels();

el("cv-date").value=today();
el("cm-date").value=today();

/* ---------- Interview prep on the In play card (30 Sep) ----------
   Written by the morning task's job-interview-prep pass: screenPrep when a role is applied,
   interviewPrep[<commitment id>] when a round is booked. The board only shows it and offers Practice. */
var mocks=[], PROFILE=null, PREFS=null, SAMPLE=null, SAMPLE_READY=false;
var MOCKTYPES={
  screen:"Recruiter screen", culture:"Culture & fit", pm:"Product management",
  domain:"Domain expertise", livecase:"Live case", takehome:"Take-home presentation"
};
/* ---------- Round types can blend (6 Oct) ----------
   Real rounds mix types ("PM and domain interview"), so a mock takes 1-3 types. Recruiter screen, live case and
   take-home stand alone (their own flow and timing): picking one clears the rest. The main questions are split across the types
   (even by default, extras to the first; nudged with − / +), each question is tagged with its type and graded against
   that type's rubric. MK.type stays the first type, for older readers and saved mocks; MK.types holds them all. */
var MK_SOLO={screen:1, livecase:1, takehome:1}, MK_ORDER=["screen","culture","pm","domain","livecase","takehome"], MKT_MAX=3;
var MK_SHORT={screen:"Screen", culture:"Culture & fit", pm:"PM", domain:"Domain", livecase:"Live case", takehome:"Take-home"};
/* Case rounds (16 Oct): live case and take-home run from the case box (49), not from questions and a focus. */
var MK_CASE={livecase:1, takehome:1};
var MKT={sel:["screen"], split:null, hint:""};
function mkTypesNorm(arr){
  var a=MK_ORDER.filter(function(t){ return (arr||[]).indexOf(t)>-1; });
  var reg=a.filter(function(t){ return !MK_SOLO[t]; });
  if(reg.length) return reg.slice(0,MKT_MAX);       /* a standalone type mixed with others: keep the others */
  return a.length? [a[a.length-1]] : [];
}
/* What a round covers, from everything known about it: the meeting's own type, its prep, and the words in its
   title or prep round name ("Round 1: PM and domain interview" → PM + Domain). */
var MKT_WORDS=[["screen",/\bscreen(ing)?\b|recruiter|talent partner/],["culture",/culture|values|behaviou?ral|competenc/],
  ["pm",/\bpm\b|product (management|manager|sense|craft)|\bcraft\b|hiring manager/],["domain",/\bdomain\b/],
  ["livecase",/whiteboard|live case|on[- ]the[- ]fly|case interview/],["takehome",/take[- ]?home|case study/]];
function mkTypesGuess(c,p){
  c=c||{}; p=p||c.prep||{}; var out=[], m=p.mock||{};
  (m.types||p.types||[]).forEach(function(t){ out.push(t); });
  if(m.type) out.push(m.type);
  if(MOCKTYPES[p.type]) out.push(p.type);
  var mm=(typeof MT_MOCK!=="undefined" && MT_MOCK[c.type]) || (typeof MKR_TYPE!=="undefined" && MKR_TYPE[c.type]);
  if(mm && c.type!=="informal" && c.type!=="interview" && c.type!=="mock") out.push(mm);
  var txt=[c.title,p.round,c.detail].filter(Boolean).join(" ").toLowerCase();
  MKT_WORDS.forEach(function(w){ if(w[1].test(txt)) out.push(w[0]); });
  if(!out.length && mm) out.push(mm);
  /* Two standalone types guessed (a "Live Case Study" title reads as take-home too): the meeting's own type wins. */
  var n=mkTypesNorm(out);
  if(mm && MK_SOLO[mm] && n.length===1 && MK_SOLO[n[0]] && n[0]!==mm && c.type!=="informal" && c.type!=="interview" && c.type!=="mock") return [mm];
  return n;
}
function mkTypesLabel(arr,short){ arr=(arr&&arr.length)? arr : ["pm"]; return arr.map(function(t){ return (short? MK_SHORT : MOCKTYPES)[t]||t; }).join(" + "); }
function mkSplit(){
  var n=+((el("mk-len")||{}).value)||5, s=MKT.sel, k=s.length;
  if(MKT.split && MKT.split.n===n && MKT.split.k===s.join()) return MKT.split.v;
  var v={}; s.forEach(function(t,i){ v[t]=Math.floor(n/k)+(i<n%k? 1 : 0); });
  MKT.split={n:n, k:s.join(), v:v}; return v;
}
function mkSetTypes(arr){
  var a=mkTypesNorm(arr); if(!a.length) return;
  MKT.sel=a; MKT.split=null; MKT.hint=""; mkTypesPaint();
}
function mkTypesPaint(){
  var box=el("mk-types"); if(!box) return;
  box.innerHTML=MK_ORDER.map(function(t){
    var on=MKT.sel.indexOf(t)>-1;
    return '<button type="button" class="mkt'+(MK_SOLO[t]? " solo" : "")+'" data-mkt="'+t+'" aria-pressed="'+on+'"'+(MK_SOLO[t]? ' title="Stands alone: picking it clears the others"' : "")+'>'+esc(MOCKTYPES[t])+'</button>';
  }).join("");
  var sp=el("mk-split"); if(!sp) return;
  if(MKT.sel.length<2){ sp.innerHTML=MKT.hint? '<span class="mkthint">'+esc(MKT.hint)+'</span>' : ""; return; }
  var v=mkSplit(), n=MKT.split.n;
  sp.innerHTML='<span class="mksn">'+n+' questions:</span>'+MKT.sel.map(function(t){
    return '<span class="mksp"><button type="button" class="mksb" data-mks="-'+t+'" aria-label="One fewer '+esc(MOCKTYPES[t])+'"'+(v[t]<=1? " disabled" : "")+'>−</button>'+
      '<b>'+v[t]+'</b> '+esc(MK_SHORT[t])+
      '<button type="button" class="mksb" data-mks="+'+t+'" aria-label="One more '+esc(MOCKTYPES[t])+'"'+(v[t]>=n-(MKT.sel.length-1)? " disabled" : "")+'>+</button></span>';
  }).join('<span class="mksdot">·</span>')+(MKT.hint? '<span class="mkthint">'+esc(MKT.hint)+'</span>' : "");
}
function mkTypeClick(t){
  var s=MKT.sel.slice(), i=s.indexOf(t); MKT.hint="";
  if(MK_SOLO[t]) s=[t];
  else if(i>-1){ if(s.length>1) s.splice(i,1); else { MKT.hint="Pick at least one type."; } }
  else { s=s.filter(function(x){ return !MK_SOLO[x]; });
    if(s.length>=MKT_MAX) MKT.hint="Up to "+MKT_MAX+" types in one round."; else s.push(t); }
  var n=mkTypesNorm(s); if(n.length) MKT.sel=n; MKT.split=null; mkTypesPaint();
}
function mkSplitNudge(code){
  var up=code.charAt(0)==="+", t=code.slice(1), v=mkSplit(), s=MKT.sel, i=s.indexOf(t);
  if(up){ /* take one from the largest other type */
    var from=s.filter(function(x){ return x!==t && v[x]>1; }).sort(function(a,b){ return v[b]-v[a]; })[0]; if(!from) return;
    v[from]--; v[t]++;
  }else{ if(v[t]<=1) return; v[t]--; v[s[(i+1)%s.length]]++; }
  mkTypesPaint();
}
/* Prompt pieces, single type or blended. */
function mkTypeLine(){
  var s=MK.types||[MK.type];
  if(s.length<2) return "Round type: "+MOCKTYPES[s[0]]+". "+TYPEBRIEF[s[0]];
  var v=MK.split||{};
  return ["Round type: one blended round covering "+mkTypesLabel(s)+", as this company runs it. What each part tests:"]
    .concat(s.map(function(t){ return "- "+MOCKTYPES[t]+": "+TYPEBRIEF[t]; }))
    .concat(["Split of the main questions: "+s.map(function(t){ return (v[t]||1)+" on "+MOCKTYPES[t]; }).join(", ")+". Move between the parts naturally, as one interviewer would, not as separate interviews."]).join("\n");
}
/* The round type decides the subject (8 Oct): a PM mock at a consultancy became a consultancy interview, because the
   company context and the focus note outweighed the type. Now every main question must be about its type's subject;
   context and focus only colour it. */
function mkTypeRule(){
  if(MK.caseKind) return "";
  return "THE ROUND TYPE DECIDES WHAT YOU ASK. Every main question must be about the subject of its part of the round, as described above, in the split given. "+
    "The company, its business model (e.g. a consultancy or agency), its materials and the candidate's focus note only colour a question: use them for a setting or an example, but never let them replace the subject. "+
    "For example, in "+(isProductField()? "a product-management part ask about product management itself" : "the craft part ask about the craft itself")+" (how they do it, their views, how AI is changing it), and at most one main question may be framed around the company's particular way of working.";
}
function mkPatternLine(){
  var s=MK.types||[MK.type];
  if(MK.caseKind==="takehome") return "";
  if(MK.caseKind==="livecase") return MK.caseText? "" : "Case shapes to choose from if nothing else fits this company: "+TYPEPATTERNS.livecase.join("; ")+".";
  if(s.length<2) return "Question patterns to draw from and vary (pick what fits this company and role; do not ask them all): "+TYPEPATTERNS[s[0]].join("; ")+".";
  return "Question patterns to draw from and vary (pick what fits this company and role; do not ask them all): "+s.map(function(t){ return MOCKTYPES[t]+": "+TYPEPATTERNS[t].join("; "); }).join(" || ")+".";
}
function mkAsksQ(){ return (MK.types||[MK.type]).some(function(t){ return ASKSQUESTIONS[t]; }); }
function ulist(arr,cls){
  arr=(arr||[]).filter(Boolean); if(!arr.length) return "";
  return '<ul class="qlist'+(cls?" "+cls:"")+'" style="margin-top:5px">'+arr.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul>';
}
function prepSec(label,body,cls){ return body? '<div class="'+(cls||"")+'"><span class="eyebrow">'+label+'</span>'+body+'</div>' : ""; }
function prepPara(s){ return s? '<p style="margin:4px 0 0;font-size:13.5px;color:var(--ink-2)">'+esc(s)+'</p>' : ""; }
function roundPrepFor(r){
  var ip=r.interviewPrep||{}, nx=nextSessionOf(r.id);
  if(nx && ip[nx.id]) return {cid:nx.id, p:ip[nx.id], sess:nx};
  var byC=nx? Object.keys(ip).filter(function(k){return (ip[k]||{}).commitmentId===nx.id;})[0] : null;
  if(byC) return {cid:byC, p:ip[byC], sess:nx};
  var nk=Object.keys(ip).filter(function(k){return (ip[k]||{}).next;})[0];
  if(nk){ var cc=ip[nk].commitmentId? commitments.find(function(x){return x.id===ip[nk].commitmentId;}) : null; return {cid:nk, p:ip[nk], sess:cc||null}; }
  /* Otherwise the most recently built round, so an unbooked-but-prepped round still shows. */
  var keys=Object.keys(ip).sort(function(a,b){return String((ip[b]||{}).builtAt||"").localeCompare(String((ip[a]||{}).builtAt||""));});
  if(!keys.length) return null;
  var c=commitments.find(function(x){return x.id===keys[0];})||null;
  return {cid:keys[0], p:ip[keys[0]], sess:c};
}

/* ---------- Mock interview tab ----------
   Interviewer turns run on the viewer's Claude usage via `sample` (default tier); the feedback
   runs once on the complex tier. The page never retries a failed call by itself. */
var MK={ on:false, role:null, type:"pm", focus:"", len:5, mins:30, turns:[], started:0, ctl:null, tick:null, busy:false, brief:"", savedId:"", cv:"", cvFrom:"" };
/* Their CV in the mock (3 Oct): the CV the user sent this company when it is a Word file on the board, else the base
   CV text from My CV & letter (`templates/cv.text`). The interviewer has it in front of them, and the feedback
   uses it to say which of their real examples the user could have raised. PDFs and tailored drafts are not read here. */
async function mkCvText(r){
  if(r && r.final && r.final.cv && /\.docx$/i.test(r.final.cv.name||"")){
    try{ var f=await fileOf("final:"+r.id,"cv");
      /* Finals are in the file store since 5 Oct (`assetId`); older records still carry b64. */
      var blob=null;
      if(f && f.assetId){ var res=await fetch("/_blob/"+f.assetId); if(res.ok) blob=await res.blob(); }
      else if(f && f.b64) blob=new Blob([b64ToBytes(f.b64)]);
      if(blob){ var md=await docTextOf(blob); if(md && md.trim()) return {text:md, from:"the CV the candidate sent to "+(r.company||"this company")}; } }
    catch(e){ console.warn("sent CV text",e); }
  }
  var t=TEMPLATES && TEMPLATES.cv && TEMPLATES.cv.text;
  return t? {text:t, from:"their base CV"} : {text:"", from:""};
}
function mkCvBlock(){ return MK.cv? clip(MK.cv,9000) : "(No CV text on the board — upload it in About me › My CV & letter.)"; }
function mockRoles(){
  var order={offer:0,applied:1,prep:2,consideration:3};
  return roles.filter(function(r){ return order[r.stage]!==undefined; })
    .sort(function(a,b){ return order[a.stage]-order[b.stage] || String(a.company).localeCompare(String(b.company)); });
}
function renderMockSetup(){
  var sel=el("mk-role"); if(!sel) return;
  var cur=sel.value, rs=mockRoles();
  var stLabel={offer:"offer",applied:"applied",prep:"to apply",consideration:"Shortlist"};
  sel.innerHTML='<option value="">— General practice, no role —</option>'+rs.map(function(r){
    return '<option value="'+esc(r.id)+'">'+esc(r.company+" — "+r.title)+' ('+stLabel[r.stage]+')</option>';
  }).join("");
  if(cur && rs.some(function(r){return r.id===cur;})) sel.value=cur;
  mockSuggest();
}
function mockSuggest(){
  var box=el("mk-suggest"); if(!box) return;
  var r=roles.find(function(x){return x.id===el("mk-role").value;});
  if(!r){ box.innerHTML=""; return; }
  var rp=roundPrepFor(r), co=coOf(r), intel=co&&co.interviewIntel;
  var bits=[];
  /* The next round is described once, by 32's Next line (6 Oct); its types and the focus draft fill in by themselves. */
  if(r.screenPrep && !nextSessionOf(r.id)) bits.push('Screen prep is ready — a <b>Recruiter screen</b> mock fits.');
  if(intel && (intel.stages||[]).length) bits.push('<b>'+esc(co.name||r.company)+' process:</b> '+esc(intel.stages.join(" → ")));
  else bits.push('<span style="color:var(--faint)">No interview-process research for '+esc(r.company)+' yet — the morning task adds it once a round is booked.</span>');
  box.innerHTML='<div class="secintro" style="display:flex;flex-direction:column;gap:4px">'+bits.map(function(b){return "<div>"+b+"</div>";}).join("")+'</div>';
}
function openMockFor(roleId,cid){
  var tb=document.querySelector('#sidenav [data-tab="mock"]'); if(tb) tb.click();
  if(MK.on){ el("mk-hint").textContent="A mock is already running — end or abandon it first."; return; }
  el("mk-role").value=roleId; mockSuggest();
  var r=roles.find(function(x){return x.id===roleId;});
  if(r){
    if(cid==="screen"){ mkSetTypes(["screen"]); el("mk-focus").value=""; }
    else if(cid && r.interviewPrep && r.interviewPrep[cid]){
      var m=r.interviewPrep[cid].mock||{};
      var cc=commitments.find(function(x){return x.id===cid;}), g=mkTypesGuess(cc||{}, r.interviewPrep[cid]);
      mkSetTypes(g.length? g : [m.type||r.interviewPrep[cid].type||"pm"]);
      el("mk-focus").value=m.focus||"";
    }
  }
  window.scrollTo({top:el("tab-mock").offsetTop-20,behavior:"smooth"});
}

function clip(s,n){ s=String(s==null?"":s); return s.length>n? s.slice(0,n)+"…" : s; }
function profileBrief(){
  var p=PROFILE; if(!p) return "(No profile document on the board — use only what the candidate says.)";
  var lines=["Headline: "+p.headline,"Career:"].concat((p.career||[]).map(function(c){return "- "+c;}));
  lines.push("Stories (numbers are exact; do not invent others):");
  (p.stories||[]).forEach(function(s){ lines.push("- "+s.title+": "+s.detail); });
  var a=p.answers||{};
  /* Every standard answer on profile/me, whatever its key (camelCase key -> words). */
  var ak=Object.keys(a); if(ak.length) lines.push("Standard answers: "+ak.map(function(k){ return k.replace(/([A-Z])/g," $1").toLowerCase()+" — "+clip(typeof a[k]==="string"? a[k] : JSON.stringify(a[k]),600); }).join(" | "));
  lines.push("Known watch-outs (things the candidate should NOT say or imply): "+(p.watchOuts||[]).join(" | "));
  return lines.join("\n");
}
function roleBrief(r){
  if(!r){ var P=PROFILE||{}, pos=(P.positioning&&P.positioning.title)||P.profession||"job"; return "No specific role: a general "+pos+" interview"+(P.location? " for a company near "+P.location : "")+"."; }
  var co=coOf(r)||{}, e=r.enrich||{}, out=[];
  out.push("Role: "+r.title+" at "+r.company+(r.location?" ("+r.location+")":""));
  if(r.url) out.push("Posting: "+r.url);
  if(e.summary) out.push("Role research: "+clip(e.summary,1800));
  /* The ad itself (6 Oct): the summary next-role-apply-pack stores at To apply, and the ad's requirements from
     Role Fit with how the candidate's CV meets each, so the interviewer knows what the ad asks for and where to probe. */
  var ad=r.adSummary;
  if(ad && typeof ad==="object"){
    var ab=[];
    if(ad.purpose) ab.push("Why the role exists: "+ad.purpose);
    if(ad.scope) ab.push("Scope and team: "+ad.scope);
    if(ad.product) ab.push("Product and users: "+ad.product);
    if((ad.responsibilities||[]).length) ab.push("Responsibilities: "+ad.responsibilities.join("; "));
    if(ad.success) ab.push("What success looks like: "+ad.success);
    if(ad.process) ab.push("Stated hiring process: "+ad.process);
    if((ad.notable||[]).length) ab.push("Also notable: "+ad.notable.join("; "));
    if(ab.length) out.push("The job ad, summarised:\n- "+clip(ab.join("\n- "),2200));
  }
  var fr=((r.fit||{}).reqs||[]).filter(function(q){ return q && q.text && q.match!=="na"; });
  if(fr.length) out.push("What the ad asks for, and how the candidate's CV meets it (probe the partials and gaps): "+fr.map(function(q){
    return q.text+(q.must?" [must]":"")+" — "+(q.match||"?")+(q.evidence? " ("+clip(q.evidence,120)+")" : "");
  }).join(" | "));
  if((e.openQuestions||[]).length) out.push("Open questions about the role: "+e.openQuestions.join(" | "));
  if(r.green) out.push("Strengths for this role: "+clip(r.green,600));
  if(r.red) out.push("Concerns for this role: "+clip(r.red,600));
  if(co.ai) out.push("Company AI stance: "+clip(co.ai,600));
  if(co.culture) out.push("Company culture: "+clip(co.culture,600));
  /* Was matching sector ids against the free-text sector description, so it never found one (audit, 1 Oct). */
  var sec=secOfCo(co);
  if(sec && (sec.gaps||sec.questions)) out.push("Sector ("+(sec.name||sec.id)+") gaps/questions: "+clip([].concat(sec.gaps||[],sec.questions||[]).join(" | "),600));
  var intel=co.interviewIntel;
  if(intel){
    if((intel.stages||[]).length) out.push("Their interview process: "+intel.stages.join(" -> "));
    if(intel.notes) out.push("How they interview: "+clip(intel.notes,600));
    if((intel.reported||[]).length) out.push("Questions candidates report (anecdotal): "+intel.reported.slice(0,15).map(function(q){return q.q+(q.stage?" ["+q.stage+"]":"");}).join(" | "));
  }
  var cs=convsShown(r).slice(0,4);
  if(cs.length) out.push("Notes from real conversations with them (most important context): "+cs.map(function(c){
    return c.date+" "+(c.kind||"")+": liked "+clip(c.liked,200)+"; concerned "+clip(c.concerned,200)+"; open "+(c.nextQuestions||[]).join("; ");
  }).join(" || "));
  return out.join("\n");
}
var TYPEBRIEF={
  screen:"A 30-minute recruiter or talent-partner screen. Motivation, why this company and role, career story, why they left their last role (and any gap or change of level), salary expectations, notice and logistics, other processes. Friendly but probing; a recruiter checks for red flags and a clear, short story.",
  culture:"A culture-and-values interview. Behavioural questions (tell me about a time...) on conflict, failure, feedback, collaboration, ambiguity, ownership and learning. Push for specifics with STAR follow-ups: what exactly did YOU do, what happened, what would you do differently.",
  pm:"A product-management craft interview with a hiring manager or senior PM. The subject is product management itself: how the candidate does the job and how they think about it. Cover a spread of the craft: what a great PM does and how they spend their time, discovery and finding the real problem, prioritisation and deciding what not to build, metrics and experimentation, strategy and roadmaps, working with engineering and design, stakeholder influence, and how AI is changing their own work and the PM role. Mix 'how do you...' and 'what's your view on...' questions with one or two product-sense cases. Ask for trade-offs and an example, but stay at the level of the craft, not the minutiae of one past project.",
  domain:"A domain-expertise interview for this company's space. Test real understanding of the market, customers, competitors, business model, regulation and the metrics that matter here. Probe where their experience transfers and where it does not; do not accept vague transfer claims.",
  livecase:"A live case round. The candidate has NOT seen the case: you write it. Follow how the company runs the exercise (given below, when known) for the format, timing, any prep period and the kind of case, and set ONE realistic mock case prompt that fits those rules, in this company's own product, users and market. If the instructions give a prep period, set the case, then tell the candidate to say when they are ready. Let the candidate ask clarifying questions and answer them with plausible facts. Expect structure: goal, users, pains, options, prioritisation, a pick, metrics, risks. Timebox, push the candidate to commit to a recommendation, then challenge it. Treat it as a first meeting: on core asks (their position or recommendation, the one or two measures that matter, the first steps) keep pushing until they answer, and a provisional hypothesis with how and when they would test it counts as an answer. On second-order detail (exact thresholds, error rates, measurement design), push once; if they park it with a named follow-up, accept that and move on.",
  takehome:"A take-home case presentation. The candidate was sent the brief below and has prepared it: never write or change a brief. First turn: greet them as the panel, confirm the time for the presentation and the Q&A, and invite them to present. The candidate presents in their answers, pasting their slide content into their answers; they may present across several turns, so while they are clearly mid-presentation reply only with a brief neutral 'Go on' and hold questions until they finish. Then run panel Q&A that tests the presentation against the brief's own ask, deliverables and constraints: challenge assumptions, evidence, prioritisation, metrics, risks and trade-offs, and anything the brief asked for that they skipped."
};
/* Question patterns per round type — written for this board, so the interviewer varies its
   questions instead of asking the same five every time. Not taken from any question bank. */
var TYPEPATTERNS={
  screen:["career story in 90 seconds","why this company / why this role","why leaving the last job (and any gap)","level and scope fit","salary expectations","notice, location, office days","other processes","a quick 'biggest achievement' check"],
  culture:["disagreement with a senior stakeholder","a failure and what changed after","feedback you received and acted on","helping a struggling colleague","working in ambiguity","a decision you made with incomplete data","how you celebrate success / build team energy","how you keep learning"],
  pm:["product sense: improve an existing product","product sense: design for a new user segment","prioritisation with conflicting stakeholders","north-star metric and guardrails","designing an experiment and reading an unexpected result","roadmap and phasing an MVP","discovery: how you found the real problem","saying no to a senior request","using AI in your product work","what a great PM does, and how you spend your week","how you decide what not to build","how you work with engineering and design","how AI is changing product management, and what you'd change because of it","your product philosophy: a view you hold that others disagree with"],
  domain:["how the business model makes money","the key competitors and how this company wins","the metrics that matter in this market","regulation or partner constraints","where your experience transfers and where it does not","a trend that will change the market in two years"],
  livecase:["improve a funnel step","fix a falling metric","feature for a new segment","launch into a new market","monetise without hurting trust"],
  takehome:["loyalty or retention mechanic","growth experiment plan","prioritise a messy backlog","new product bet with an MVP"]
};
/* Any profession (22 Oct). The product-management wording above is used when the user's field is product (profile/me
   fieldTerm, or a profession naming product); otherwise the craft round, live case and take-home are described from
   their profession. Run when profile/me loads or changes (18). */
var MK_PROD=null;
function mkProfSync(){
  if(!MK_PROD) MK_PROD={name:MOCKTYPES.pm, short:MK_SHORT.pm, brief:TYPEBRIEF.pm, live:TYPEBRIEF.livecase,
    pat:TYPEPATTERNS.pm.slice(), livePat:TYPEPATTERNS.livecase.slice(), takePat:TYPEPATTERNS.takehome.slice(),
    core:(typeof MKF_CORE!=="undefined")? {pm:MKF_CORE.pm, livecase:MKF_CORE.livecase} : null};
  var P=PROFILE||{}, prod=isProductField(), prof=String(P.profession||"").split(/[—|,(]/)[0].trim(), who=prof||"their field";
  MOCKTYPES.pm= prod? MK_PROD.name : (P.roleShort? P.roleShort+" craft" : prof? prof+" craft" : "Role craft");
  MK_SHORT.pm= P.roleShort || (prod? MK_PROD.short : "Craft");
  TYPEBRIEF.pm= prod? MK_PROD.brief : "A craft interview with a hiring manager or a senior "+who+". The subject is the job itself: how the candidate does it and how they think about it. "+
    "Cover a spread of the craft for a "+who+": what great looks like and how they spend their time, how they plan and approach their work, the trade-offs and judgement calls the job involves, "+
    "how they measure the quality and impact of their work, working with other teams, influencing stakeholders, and how AI is changing their own work and the role. "+
    "Mix 'how do you...' and 'what's your view on...' questions with one or two practical scenarios. Ask for trade-offs and an example, but stay at the level of the craft, not the minutiae of one past project.";
  TYPEBRIEF.livecase= prod? MK_PROD.live : MK_PROD.live.replace("Expect structure: goal, users, pains, options, prioritisation, a pick, metrics, risks.",
    "Expect a clear structure: the goal, what matters most, the options, a recommendation, how they would know it worked, and the risks.");
  TYPEPATTERNS.pm= prod? MK_PROD.pat.slice() : ["how you approach a typical piece of work","a hard trade-off you made","how you measure good work","working with other teams",
    "saying no to a senior request","what great looks like in your role, and how you spend your week","how you decide what not to do","how AI is changing your work, and what you'd change because of it",
    "a view on your craft that others disagree with"];
  TYPEPATTERNS.livecase= prod? MK_PROD.livePat.slice() : ["solve a problem the team faces now","plan a piece of work against a deadline","fix something that is going wrong","make the case for a change","trade off quality, cost and time"];
  TYPEPATTERNS.takehome= prod? MK_PROD.takePat.slice() : ["a plan for a real problem the team faces","an analysis with a recommendation","prioritise competing demands","a proposal for something new"];
  if(typeof MKF_CORE!=="undefined" && MK_PROD.core){
    MKF_CORE.pm= prod? MK_PROD.core.pm : "the craft itself: how I do the job, my views on it, and how AI is changing my field";
    MKF_CORE.livecase= prod? MK_PROD.core.livecase : "a live case, thinking out loud";
  }
  if(typeof MOCKTYPE_OPTS!=="undefined") MOCKTYPE_OPTS.forEach(function(o){ if(MOCKTYPES[o[0]]) o[1]=MOCKTYPES[o[0]]; });
  var fo=el("mk-focus"); if(fo){ if(!MK_PROD.ph) MK_PROD.ph=fo.placeholder; fo.placeholder= prod? MK_PROD.ph : "e.g. probe how I plan my work; ask about a hard trade-off I made"; }
  try{ if(typeof mkTypesPaint==="function" && typeof MKT!=="undefined") mkTypesPaint(); }catch(e){}
}
var ASKSQUESTIONS={screen:1,culture:1,pm:1,domain:1,livecase:1,takehome:1};
/* Feedback rules (5 Oct, after the first real mock): calibrated scores, a four-way verdict, trust the candidate's
   own claims, ignore speech-to-text spelling of anything but the target company, and no marks off for how the text
   mock works (bundled questions, time used). */
var MKFB_RULES=[
  "Ratings, not scores: every answer (and each area and their questions) is rated good (keep it as it is), average (a mix: say what to keep and what to change) or fix (change it, and say what to do instead). Rate honestly as this panel would: most competent answers with one fixable flaw are average, not fix. No overall score, no verdict and no prediction of the outcome: this is read just before a real interview, so it says what to keep and what to change, never whether they would pass.",
  "Candid, not harsh: never soften a rating to protect feelings, but word every point as what to do, not a judgement of the person.",
  "Short: every list item and every keep/change line is one sentence of 25 words at most. 3-5 items in keep and in improve, never more.",
  "Trust the candidate: accept anything they say about themselves, their history and their relationships as true unless it contradicts their CV or profile. You may still comment on timing or tact (e.g. naming referees too early), but never call a claim an overclaim without a contradiction.",
  "The transcript is dictated through speech-to-text. Ignore misspellings and garbled forms of the candidate's former employers, products, places and jargon: they said them correctly. The ONE exception: if the target company's own name comes out wrong, flag it, because that may be how they really say it.",
  "Do not mark down how this text mock works: asking several questions in one reply is fine, and do not judge the minutes used against the slot (typed answers are faster than speech).",
  "What an interview is for: finding out the candidate's experience, their impact and how they think (their judgement, trade-offs and patterns of reasoning). It is not a memory test. Grade those three things; recall of exact details is not one of them.",
  "Numbers in proportion: a well-told story (the situation, what they personally did, the outcome and what they learned) is a good answer without exact figures. A headline outcome with a number or an honest range is better, so a missing headline figure can be one fix; a missing detail figure (a threshold, a minor metric, something from years ago) is never a fault. Never let missing numbers alone make an answer a fix, and never list 'no number' as a weakness more than once in the whole feedback. An honest 'I don't recall the exact figure, but it roughly doubled' is a good answer.",
  "Case rounds: never mark down the minutes used. For a take-home presentation, judge its length by its word count, at about 130 words a minute, against the time the brief allows.",
  "Respect deliberate choices: declining to rank this role against others or to name other processes, and a short reason for a start date (e.g. things to tidy up first), are acceptable answers, not faults. Where the candidate's own plan for this round is given below, judge against that plan."
].join("\n");
/* Case-round feedback (16 Oct): fixes stay inside the scenario, a provisional hypothesis counts as committing,
   and parking second-order detail on a first meeting is fine. */
var MK_CASE_FB=[
  "Case rounds are a role-play of a client or product situation. Every keep, improve and change line stays inside the scenario: principles, how they would run the work, what they would say in the room. Never suggest raising a personal or side project, and never make a CV story the fix; at most, an optional one-line mention of relevant professional experience for credibility.",
  "Committing: a provisional hypothesis or working assumption, stated with what would test it and when, counts as committing to a recommendation; credit it. Mark down a position given only as a timeline, or a working assumption that comes only after a refusal, and say how leading with the position would land better.",
  "First meeting: parking second-order detail (exact thresholds, error rates, measurement design) with a named follow-up is good practice, not a gap. Mark down only a parked item their own recommendation depends on that never came back."
].join("\n");
function mockRules(){
  var r=MK.role;
  return [
    "You are running a realistic mock job interview. You are the INTERVIEWER, not a coach.",
    mkTypeLine(),
    mkTypeRule(),
    MK.focus? "The candidate asked you to focus on: "+MK.focus : "",
    mkPaceLine(),
    "Your aim is to find out the candidate's experience, their impact and how they think: their judgement, trade-offs and patterns of reasoning. It is not a memory test, so probe reasoning and personal contribution rather than exact recall.",
    "Stay in character: sound like a real interviewer at this company. Do NOT give feedback, praise, hints or model answers during the interview (a brief neutral acknowledgement is fine).",
    "What you know about the candidate is ONLY their CV below, plus whatever they say in this interview. Probe what the CV claims and follow up on their answers. Never mention or ask about a project, experiment, metric, product, employer or result that is not in the CV or in their own answers so far: a real interviewer cannot know it. You may ask open questions (e.g. 'tell me about an experiment you ran').",
    MK.focus? "The focus note above is the candidate's own steer on what to practise within the round type; it never changes the round's subject, and it is not information about them." : "",
    mkPatternLine(),
    mkAsksQ()
      ? "When the "+(MK.caseKind? "case discussion is" : "main questions are")+" done, ask exactly: 'We have a few minutes left - what questions do you have for me?' The candidate may ask several questions in one reply: if so, answer EVERY one of them in that turn, briefly and realistically in character (if you would not know, say so as a real interviewer would). Then ask if they have anything else; allow up to three rounds of questions. Then close politely and put the exact marker [END] on its own line at the end."
      : "When the case discussion is done, close politely and put the exact marker [END] on its own line at the end.",
    "Keep each turn short (1-4 sentences), except when you set a live case. Plain text, no markdown headings.",
    mkCaseBlock(12000),
    "",
    "=== THE ROLE AND YOUR COMPANY (what you know as the interviewer) ===", mkIvBrief(r),
    "",
    "=== THEIR CV ("+(MK.cvFrom||"none")+") — the only thing you know about them; you have read it, as a real interviewer would ===", mkCvBlock(),
    "",
    MK.caseKind==="takehome"? "Begin now: greet the candidate as the panel, confirm the timings, and invite them to present." :
    MK.caseKind==="livecase"? "Begin now: greet the candidate, say briefly how the exercise will run, then set the case." :
    "Begin now: greet the candidate briefly and ask your first question."
  ].filter(function(x){return x!=="";}).join("\n");
}
/* The round's own materials and depth mode (12 Oct). mkRoundMats: the company's interview materials for the round
   being practised, scoped as in mkIvBrief. mkAreas: what those materials say they assess (feedback scores each).
   mkIsDepth: a deep-dive round (the meeting title, a material's title, or the format of a material for this meeting
   says depth / deep dive / expertise),
   where the interviewer digs 3-4 layers into fewer main questions instead of moving on after two follow-ups. */
function mkRoundMeet(r){
  if(!r) return null;
  var mm=(typeof MK_MEET!=="undefined"? MK_MEET : ""), mc=mm? commitments.find(function(c){ return c.id===mm; }) : null;
  if(!mc || (typeof mkrForRole==="function" && !mkrForRole(mc,r))) mc=(typeof mkrInfo==="function"? (mkrInfo(r).next||null) : null);
  return mc;
}
function mkRoundMats(r){
  if(!r || typeof maForRole!=="function") return [];
  var mc=mkRoundMeet(r), mm=mc? mc.id : "";
  return maForRole(r).filter(function(m){ return m.scopeKind!=="meeting" || !mm || m.meetingId===mm; });
}
/* Areas come from materials for THIS meeting when any of them name areas. A role-wide pack describes the whole
   process, so its areas are used only when nothing is meeting-scoped and the round is not a case (a case round
   then falls back to the case areas in mkFeedback). */
function mkAreas(r){
  var mats=mkRoundMats(r), mc=mkRoundMeet(r), mid=mc? mc.id : "";
  var has=function(m){ return ((m.digest||{}).assesses||[]).some(Boolean); };
  var own=mats.filter(function(m){ return mid && m.scopeKind==="meeting" && m.meetingId===mid && has(m); });
  var isCase=!!(MK.caseKind || (MK.types||[]).some(function(t){ return MK_CASE[t]; }));
  var src=own.length? own : (isCase? [] : mats);
  var a=[]; src.forEach(function(m){ ((m.digest||{}).assesses||[]).forEach(function(x){ if(x && a.indexOf(x)<0) a.push(x); }); });
  return a.slice(0,8);
}
var MK_DEPTH_RE=/depth|deep[- ]?dive|expertise/i;
function mkIsDepth(r){
  var mc=mkRoundMeet(r), bits=[mc? mc.title||"" : ""];
  /* Only materials for this meeting say how this round runs; a role-wide pack describes the whole process
     (e.g. "talent chat, deep dive, values"), so it counts only when its own title says depth. */
  mkRoundMats(r).forEach(function(m){ bits.push(m.title||"");
    if(m.scopeKind==="meeting"){ if(m.digest) bits.push(m.digest.format||""); else if(m.kind==="text") bits.push(String(m.text||"").slice(0,600)); } });
  return MK_DEPTH_RE.test(bits.join(" | "));
}
/* What the interviewer knows (8 Oct): only what a real interviewer at the company would. The job ad, the company,
   its interview process and its own materials for the round. Never the candidate's private board: no profile or
   stories, no Role Fit evidence, no strengths or concerns notes, no open questions, no meeting notes. The feedback
   (mkFeedback) still reads everything, so "You could have used" works. */
function mkIvBrief(r){
  if(!r) return roleBrief(r);
  var co=coOf(r)||{}, out=[], ad=r.adSummary;
  out.push("Role: "+r.title+" at "+r.company+(r.location?" ("+r.location+")":""));
  if(ad && typeof ad==="object" && !ad.removed){
    var ab=[];
    if(ad.purpose) ab.push("Why the role exists: "+ad.purpose);
    if(ad.scope) ab.push("Scope and team: "+ad.scope);
    if(ad.product) ab.push("Product and users: "+ad.product);
    if((ad.responsibilities||[]).length) ab.push("Responsibilities: "+ad.responsibilities.join("; "));
    if(ad.success) ab.push("What success looks like: "+ad.success);
    if(ad.process) ab.push("Hiring process: "+ad.process);
    if(ab.length) out.push("The job ad:\n- "+clip(ab.join("\n- "),2200));
  }
  var fr=((r.fit||{}).reqs||[]).filter(function(q){ return q && q.text && q.match!=="na"; });
  if(fr.length) out.push("What the job asks for: "+fr.map(function(q){ return q.text+(q.must?" [must]":""); }).join(" | "));
  if(co.culture) out.push("Your company's culture: "+clip(co.culture,500));
  if(co.ai) out.push("Your company and AI: "+clip(co.ai,400));
  var intel=co.interviewIntel;
  if(intel){
    if((intel.stages||[]).length) out.push("Your interview process: "+intel.stages.join(" -> "));
    if(intel.notes) out.push("How you interview: "+clip(intel.notes,600));
    if((intel.reported||[]).length) out.push("Questions your company is known to ask: "+intel.reported.slice(0,15).map(function(q){return q.q+(q.stage?" ["+q.stage+"]":"");}).join(" | "));
  }
  if(typeof maForRole==="function"){
    var mm=(typeof MK_MEET!=="undefined"? MK_MEET : ""), mc=mm? commitments.find(function(c){ return c.id===mm; }) : null;
    if(!mc || (typeof mkrForRole==="function" && !mkrForRole(mc,r))) mm=(typeof mkrInfo==="function"? ((mkrInfo(r).next||{}).id||"") : "");
    var ms=maForRole(r).filter(function(m){ return m.scopeKind!=="meeting" || !mm || m.meetingId===mm; });
    if(ms.length) out.push("Your company's own interview materials for this round (use their format, criteria and named questions or tasks):\n"+ms.map(function(m){
      var g=m.digest, bits=[];
      if(g){ if(g.format) bits.push("format: "+g.format); if((g.assesses||[]).length) bits.push("you assess: "+g.assesses.join("; "));
        if((g.questions||[]).length) bits.push("questions or tasks: "+g.questions.join("; ")); }
      else if(m.kind==="text") bits.push(clip(m.text||"",1500));
      return "- "+(m.title||"Material")+": "+clip(bits.join(" | "),1500);
    }).join("\n"));
  }
  return out.join("\n");
}
/* Time management (8 Oct): a 30-minute mock ran to an hour on follow-ups. The interviewer gets a time budget per
   main question, a cap on follow-ups, and pitches questions at the level a round of this length allows. */
function mkMinsPlanned(){ return MK.mins || (MK.caseKind==="takehome"? 60 : MK.caseKind==="livecase"? 45 : Math.max(20, MK.len*7+10)); }
/* The case box (49) as the prompts see it: the take-home brief as sent, or how the live case is run. */
function mkCaseBlock(n){
  if(MK.caseKind==="takehome") return "\n=== THE CASE STUDY BRIEF THE CANDIDATE WAS SENT (they have prepared it; use it as written, never replace it) ===\n"+clip(MK.caseText,n);
  if(MK.caseKind==="livecase") return MK.caseText? "\n=== HOW THE COMPANY RUNS THIS EXERCISE (from the invite; the candidate has not seen the case itself) ===\n"+clip(MK.caseText,n)
    : "\nNo instructions were given for this exercise: run a standard 45-minute "+(isProductField()? "product case (improve a product, or fix a falling metric)" : "case on a realistic problem for the role")+" set in this company's own product and market.";
  return "";
}
var MK_CLOCK_RULE="Each candidate turn ends with an [Interview clock] line from the board: watch it, and when time is short, move on, then to their questions or close. Never mention the clock line itself.";
function mkPaceLine(){
  if(MK.caseKind){
    var cm=mkMinsPlanned();
    if(MK.caseKind==="takehome") return "Length and pace: a "+cm+"-minute session. Use the timings in the brief when it gives them; otherwise about "+Math.max(10,Math.round(cm*0.35))+" minutes for the presentation, then panel Q&A, and the last 5 minutes for the candidate's questions. In the Q&A ask ONE question per turn, with at most two follow-ups each. "+MK_CLOCK_RULE;
    return "Length and pace: a "+cm+"-minute live case. Use the timings in the exercise instructions when they give them; otherwise roughly: set the case, about 5 minutes of clarifying questions, about "+Math.max(10,cm-25)+" minutes working it through, a recommendation, about 5-10 minutes of challenge, and the last 5 minutes for the candidate's questions. Keep your turns short and let the candidate drive. "+MK_CLOCK_RULE;
  }
  var mins=mkMinsPlanned(), qs=mkAsksQ(), end=qs? Math.max(mins-5,Math.round(mins*0.8)) : mins-2, per=Math.max(3,Math.round((end-3)/Math.max(1,MK.len)));
  return "Length and pace: this is a "+mins+"-minute interview with about "+MK.len+" main questions, so about "+per+" minutes per main question"+(qs? ", and the candidate's questions from about minute "+end : "")+". "+
    "Ask ONE question per turn. "+
    (mkIsDepth(MK.role)
      ? "This is a DEPTH round: depth over breadth. Ask open main questions and let the candidate choose the example; then dig three or four layers into it before moving on: what they personally decided and why, the options they rejected, the metric and the actual number, what went wrong, what they would change. Every time an answer says \"we\" for a decision, ask what they personally did. Ask for the scale of the headline outcome once per story (a number, a range or an order of magnitude is all fine); if they can't recall a figure, accept the direction and what they learned, and move on: never chase a small detail's number or ask for the same number twice. Follow-ups don't count against the main questions, but keep to the time per main question. "
      : "Allow at most two follow-ups on any main question, and only when an answer is vague, gives no sense of the outcome's scale or avoids the question; otherwise move on. Never press twice for the same number. ")+
    (mins<=35 && !mkIsDepth(MK.role)? "In a round this short, go for breadth, not depth: ask at the level a real "+mins+"-minute round would, one or two layers down at most, and never turn one topic into a deep dive. " : "")+
    "Each candidate turn ends with an [Interview clock] line from the board: watch it, and when you are behind, cut follow-ups and move to the next main question; when time is up, move to their questions or close. Never mention the clock line itself.";
}
function mkClock(){
  var used=Math.max(0,Math.round((Date.now()-MK.started)/60000)), mins=mkMinsPlanned(), asked=MK.turns.filter(function(t){ return t.who==="them"; }).length;
  if(MK.caseKind) return "[Interview clock: "+used+" of "+mins+" minutes used.]";
  return "[Interview clock: "+used+" of "+mins+" minutes used; you have asked "+asked+" question"+(asked===1?"":"s")+" so far (main questions planned: "+MK.len+").]";
}
function mkHist(){
  /* sample needs user-first alternation ending on a user turn: rules first, then the dialogue. */
  var msgs=[{role:"user",content:mockRules()}];
  MK.turns.forEach(function(t){ msgs.push({role: t.who==="them"?"assistant":"user", content:t.text}); });
  /* The clock goes on the latest candidate turn only, as sent; it isn't stored in the transcript. */
  var last=msgs[msgs.length-1]; if(msgs.length>1 && last.role==="user") last.content=last.content+"\n\n"+mkClock();
  return msgs;
}
function mkRenderLog(pendingText){
  var log=el("mk-log");
  log.innerHTML=MK.turns.map(function(t){
    var txt=t.text; if(t.who==="me"){ var i=txt.indexOf("\n\nSCRATCH PAD:"); if(i>-1) txt=txt.slice(0,i)+"\n\n[+ scratch pad]"; }
    return '<div class="msg '+t.who+'"><span class="who">'+(t.who==="them"?"Interviewer":"You")+'</span>'+esc(txt.replace(/\n?\[END\]\s*$/,""))+'</div>';
  }).join("")+(pendingText!=null? '<div class="msg them'+(pendingText?"":" pending")+'"><span class="who">Interviewer</span>'+(pendingText? esc(pendingText) : "Thinking…")+'</div>' : "");
  log.scrollTop=log.scrollHeight;
}
function sampleErr(e){
  var c=e&&e.code;
  return ({
    not_granted:"Claude access was not allowed for this page — allow it when asked, then try again.",
    rate_limited:"Your Claude usage limit or rate limit was hit. Wait a bit, then press Send again.",
    prompt_too_large:"The interview has got too long to send. End it and get feedback.",
    session_expired:"Sign in to Claude again, then retry.",
    refused:"Claude declined that turn. Rephrase your answer and send again.",
    sampling_disabled:"Asking Claude is turned off for this account or view.",
    capability_disabled:"Asking Claude is not available in this view.",
    not_declared:"This version of the board cannot ask Claude."
  })[c] || ("That turn failed ("+(c||"error")+"). Press Send again to retry.");
}
async function mkAsk(){
  if(!SAMPLE){ el("mk-shint").textContent="Asking Claude is not available here."; return; }
  MK.busy=true; MK.ctl=new AbortController();
  el("mk-send").disabled=true; el("mk-stop").hidden=false; mkRenderLog("");
  try{
    var res=await SAMPLE(mkHist(),{cache:false, modelTier:"default", signal:MK.ctl.signal,
      onText:function(u){ mkRenderLog(u.text); }});
    MK.turns.push({who:"them", text:res.text});
    mkRenderLog(); el("mk-shint").textContent= /\[END\]\s*$/.test(res.text)? "The interviewer has closed. Press End and get feedback." : "Ctrl/⌘ + Enter sends.";
  }catch(e){
    if(e && e.code==="cancelled" && e.text){ MK.turns.push({who:"them",text:e.text+" …"}); }
    mkRenderLog(); el("mk-shint").textContent= e&&e.code==="cancelled"? "Stopped." : sampleErr(e);
  }finally{
    MK.busy=false; el("mk-send").disabled=false; el("mk-stop").hidden=true; MK.ctl=null;
  }
}
function mkTimer(){
  var s=Math.floor((Date.now()-MK.started)/1000), t=el("mk-timer");
  if(MK.mins){ var left=MK.mins*60-s; var a=Math.abs(left);
    t.textContent=(left<0?"+":"")+Math.floor(a/60)+":"+String(a%60).padStart(2,"0")+(left<0?" over":" left");
    t.classList.toggle("over",left<0);
  }else{ t.textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
}
async function mkStart(){
  if(!SAMPLE){ el("mk-hint").textContent= SAMPLE_READY? "Asking Claude is not available in this view." : "Still connecting to Claude — try again in a moment."; return; }
  var rid=el("mk-role").value;
  MK.caseKind=""; MK.caseText="";
  if(typeof cbBeforeStart==="function" && !cbBeforeStart()) return;   /* 49: the case box; a take-home needs its brief */
  MK.role=rid? roles.find(function(x){return x.id===rid;}) : null;
  MK.types=MKT.sel.slice(); MK.type=MK.types[0]; MK.focus=MK.caseKind? "" : el("mk-focus").value.trim();
  MK.len=+el("mk-len").value; MK.mins=+el("mk-mins").value;
  MK.split= MK.types.length>1? Object.assign({},mkSplit()) : null;
  el("mk-hint").textContent="Reading your CV…";
  try{ var cvr=await mkCvText(MK.role); MK.cv=cvr.text; MK.cvFrom=cvr.from; }catch(e){ MK.cv=""; MK.cvFrom=""; }
  el("mk-hint").textContent="";
  MK.turns=[]; MK.on=true; MK.started=Date.now(); MK.savedId="";
  el("mk-title").textContent=mkTypesLabel(MK.types)+(MK.role? " · "+MK.role.company+" — "+MK.role.title : " · general");
  el("mk-in").value="";
  el("mock-setup").hidden=true; el("mock-session").hidden=false; el("mock-feedback").hidden=true;
  mkTimer(); MK.tick=setInterval(mkTimer,1000);
  mkAsk();
}
function mkSend(){
  if(!MK.on || MK.busy) return;
  var a=el("mk-in").value.trim();
  var last=MK.turns[MK.turns.length-1];
  /* A failed turn leaves the dialogue ending on the candidate (or empty): Send with nothing new retries. */
  if(!a && (!last || last.who==="me")){ mkAsk(); return; }
  if(!a){ el("mk-shint").textContent="Write an answer first."; return; }
  if(last && last.who==="me"){ last.text=last.text+"\n\n"+a; }
  else MK.turns.push({who:"me", text:a});
  el("mk-in").value="";
  mkAsk();
}
function mkStopAll(){
  MK.on=false; if(MK.tick) clearInterval(MK.tick); MK.tick=null;
  if(MK.ctl) MK.ctl.abort();
}
function parseJsonLoose(t){
  var m=String(t).match(/```(?:json)?\s*([\s\S]*?)```/); var s=m? m[1] : t;
  var i=s.indexOf("{"), j=s.lastIndexOf("}"); if(i<0||j<i) throw {code:"invalid_json"};
  return JSON.parse(s.slice(i,j+1));
}
async function mkFeedback(){
  if(!MK.turns.some(function(t){return t.who==="me";})){ el("mk-shint").textContent="Answer at least one question before asking for feedback."; return; }
  var dur=Math.floor((Date.now()-MK.started)/1000);
  mkStopAll();
  var fb=el("mock-feedback"); fb.hidden=false;
  fb.innerHTML='<div class="card panel"><b>Grading the interview…</b><span class="statushint">One longer call on the more capable model — usually 30–90 seconds.</span></div>';
  el("mk-end").disabled=true; el("mk-send").disabled=true;
  var transcript=MK.turns.map(function(t){return (t.who==="them"?"INTERVIEWER: ":"CANDIDATE: ")+t.text;}).join("\n\n");
  var prompt=[
    "You are a demanding senior interview coach reviewing a mock interview. Be candid and specific; do not flatter. Judge as the hiring panel for this role would.",
    MKFB_RULES,
    mkTypeLine(),
    MK.focus? "The candidate wanted to practise: "+MK.focus : "",
    (typeof mkrStage==="function"? mkrStage(MK.role) : ""),
    (typeof mkrPlan==="function"? mkrPlan(MK.role) : ""),
    mkCritBrief(MK.role),
    mkCaseBlock(8000),
    MK.caseKind==="takehome"? "This was a take-home presentation: grade the DELIVERY as well as the content. Did it answer the brief's ask and cover each deliverable; structure and storyline; clarity; length for the time allowed; evidence behind the claims; how they handled the panel's challenge. In perAnswer, make the presentation itself the first item (q: \"The presentation\"), then one item per Q&A question." :
    MK.caseKind==="livecase"? "This was a live case: grade how they worked it. Clarifying questions; structure; focus on the user and the problem; options and prioritisation; committing to a recommendation; metrics; risks; handling pushback. In perAnswer, use one item per stage of the case (e.g. clarifying, structure, recommendation, challenge)." : "",
    MK.caseKind? MK_CASE_FB : "",
    mkAreas(MK.role).length? "The company says this round assesses: "+mkAreas(MK.role).join(" | ")+". Rate EVERY one of these areas in \"areas\", in this order, as their panel would: good, average or fix, with one line on what to keep or change; an area no question covered is rated untested with an empty note." :
    "Leave \"areas\" as an empty list: the company has not said what this round assesses.",
    (MK.types||[]).length>1? "This round blended "+mkTypesLabel(MK.types)+". Rate each answer against the rubric of the type its question tested (what each part tests is above), never one rubric for all, and tag it with that type." : "",
    "", "=== ROLE ===", roleBrief(MK.role),
    "", "=== CANDIDATE FACTS (with their CV below; take anything the candidate says about themselves as true unless it contradicts these; flag a contradiction or a tripped watch-out) ===", profileBrief(),
    "", "=== THEIR CV ("+(MK.cvFrom||"none")+") ===", mkCvBlock(),
    "", "=== TRANSCRIPT ===", transcript,
    "", "Return ONLY a JSON object, no prose around it:",
    '{"v":2,"headline":"2 sentences at most: what landed, then the one change that would make the biggest difference in the real round",',
    '"keep":["3-5 things they did well and should repeat, most important first"],',
    '"improve":["3-5 changes, most important first, each saying what to do instead; include anything they said that they should not have (a claim that contradicts their CV or profile, a tripped watch-out, negativity, the target company name wrong) and anything they agreed to that breaks one of THEIR OWN deal-breakers (name the rule in words)"],',
    '"perAnswer":[{"q":"the question or stage, shortened",'+((MK.types||[]).length>1? '"type":"which part it tested, exactly one of: '+MK.types.map(function(t){return MOCKTYPES[t];}).join(" | ")+'",' : "")+'"rating":"good | average | fix","keep":"what to keep, one line; empty for a fix with nothing worth keeping","change":"what to change and what to do instead, one line'+(MK.caseKind? ', inside the case scenario' : ', using their real examples where one fits')+'; empty for good"}],',
    '"areas":[{"area":"one of the areas the company says it assesses, in their words","rating":"good | average | fix | untested","note":"one line: what to keep or change; empty when untested"}],',
    mkAsksQ()? '"yourQuestions":{"rating":"good | average | fix","asked":["their questions, shortened"],"note":"one line: what they signalled well or badly - generic, answerable on the website, self-serving or badly timed (asking several in one reply is fine)","better":["1-3 sharper questions for this role and interviewer"]},' : "",
    '"unasked":["deal-breakers still unknown for this role, or concerns flagged on it, that their questions should have probed and did not, each as a short question; empty list if none"],',
    '"nextFocus":"the one thing to practise next, one sentence"}'
  ].filter(function(x){return x!=="";}).join("\n");
  try{
    var res=await SAMPLE([{role:"user",content:prompt}],{cache:false, modelTier:"complex"});
    var f=parseJsonLoose(res.text);
    await mkSave(f,dur);
    MK.viewing=MK.savedId||"";
    fb.innerHTML=feedbackHtml(f,dur,{type:mkTypesLabel(MK.types), company:MK.role? MK.role.company : "General", date:today(), saved:!!MK.savedId});
    el("mock-session").hidden=true; el("mock-setup").hidden=true; renderPastMocks();
    if(typeof mkrPrepAsk==="function") mkrPrepAsk(MK.role);
    fb.scrollIntoView({behavior:"smooth",block:"start"});
    el("mk-end").disabled=false; el("mk-send").disabled=false;
    return;
  }catch(e){
    fb.innerHTML='<div class="card panel"><div class="notice warn">'+esc(e&&e.code==="invalid_json"? "The feedback came back in a shape the board could not read." : sampleErr(e))+'</div>'+
      '<div class="row"><button class="btn primary" id="mk-refb">Try the feedback again</button>'+
      '<button class="btn" id="mk-savenofb">Save the transcript without feedback</button></div></div>';
    el("mk-refb").onclick=function(){ MK.started=Date.now()-dur*1000; mkFeedback(); };
    el("mk-savenofb").onclick=function(){ mkSave(null,dur).then(function(){ fb.innerHTML='<div class="card panel">Saved without feedback.</div>'; mkReset(); }); };
    return;
  }finally{ el("mk-end").disabled=false; el("mk-send").disabled=false; }
  mkReset();
}
function mkReset(){
  el("mock-session").hidden=true; el("mock-setup").hidden=false;
}
function mkVerdictCls(v){ return /^strong progress/i.test(v)? "strong" : /^marginal progress/i.test(v)? "mid" : /^marginal reject/i.test(v)? "warm" : /reject/i.test(v)? "weak" : ""; }
/* The candidate's own criteria (6 Oct), for the feedback only: the interviewer never sees them. Deal-breakers with
   this role's results, concerns flagged on the role, and weak preferences, so the coach can catch a promise that
   breaks a rule and a question that should have been asked. */
function mkCritBrief(r){
  var rules=((PREFS&&PREFS.hardRules)||[]).filter(function(h){ return h && h.id && h.rule; });
  if(!rules.length) return "";
  var res=(r && r.enrich && r.enrich.gate2Rules)||{}, out=["=== THE CANDIDATE'S OWN CRITERIA (for your feedback only; the interviewer did not know them) ==="];
  out.push("Deal-breakers: "+rules.map(function(h){ var v=res[h.id]; return h.name+" ("+h.id+"): "+clip(h.rule,180)+(v? " [this role: "+v+"]" : ""); }).join(" | "));
  var red=((r&&r.red)||[]).filter(Boolean); if(red.length) out.push("Concerns flagged on this role: "+red.map(function(x){ return clip(x,120); }).join(" | "));
  var weak=((r&&r.highlights)||[]).filter(function(h){ return h.band==="weak"; }); if(weak.length) out.push("Weak preferences on this role: "+weak.map(function(h){ return h.label||h.code; }).join(" | "));
  return out.join("\n");
}
/* Scored areas as cards; areas the mock didn't cover (score null) as one line with no advice. */
function mkAreasHtml(areas){
  areas=(areas||[]).filter(function(a){ return a && a.area; });
  if(!areas.length) return "";
  var done=areas.filter(function(a){ return a.score!=null; }), skip=areas.filter(function(a){ return a.score==null; });
  return '<div><span class="eyebrow">By what they assess</span>'+
    (done.length? '<div class="fbgrid" style="margin-top:6px">'+done.map(function(a){
      return '<div class="fbans"><span class="q">'+esc(a.area)+'</span>'+
        '<span class="chip code" style="align-self:flex-start">'+esc(a.score)+'/5</span>'+
        (a.evidence? '<span>'+esc(a.evidence)+'</span>' : "")+
        (a.fix? '<span style="color:var(--ink-2)"><b style="font-weight:500">Fix:</b> '+esc(a.fix)+'</span>' : "")+'</div>';
    }).join("")+'</div>' : "")+
    (skip.length? '<p class="statushint" style="margin:8px 0 0">Not covered in this mock: '+esc(skip.map(function(a){ return a.area; }).join(" · "))+'</p>' : "")+
  '</div>';
}
/* Feedback, short form (16 Oct, `v:2`): headline, then keep / improve, then the details folded — answer by answer
   (good / average / fix with keep and change lines), the company's areas, your questions with sharper ones, and
   deal-breakers still to find out. No score and no verdict. Older mocks (no `v`) render with feedbackHtmlV1. */
var MKR_LAB={good:"Good", average:"Average", fix:"Fix", untested:"Not covered"}, MKR_CLS={good:"strong", average:"mid", fix:"weak", untested:""};
function mkRateChip(r){ r=String(r||"").toLowerCase(); return MKR_LAB[r]? '<span class="chip '+MKR_CLS[r]+' mkrate">'+MKR_LAB[r]+'</span>' : ""; }
function mkKC(keep,change){
  return (keep? '<span><b style="font-weight:500">Keep:</b> '+esc(keep)+'</span>' : "")+
    (change? '<span style="color:var(--ink-2)"><b style="font-weight:500">Change:</b> '+esc(change)+'</span>' : "");
}
function feedbackHtml(f,dur,meta){
  f=f||{}; meta=meta||{};
  if(f.v!==2) return feedbackHtmlV1(f,dur,meta);
  var per=f.perAnswer||[], areas=(f.areas||[]).filter(function(a){ return a && a.area; }), yq=f.yourQuestions, un=f.unasked||[];
  var nFix=per.filter(function(a){ return a.rating==="fix"; }).length;
  var tested=areas.filter(function(a){ return a.rating!=="untested"; }), skipped=areas.filter(function(a){ return a.rating==="untested"; });
  var det=
    (per.length? '<div><span class="eyebrow">Answer by answer</span><div class="fbgrid" style="margin-top:6px">'+per.map(function(a){
      return '<div class="fbans"><span class="q">'+esc(a.q||"")+'</span>'+
        '<span class="row" style="gap:6px">'+mkRateChip(a.rating)+(a.type? '<span class="chip mkqt">'+esc(a.type)+'</span>' : "")+'</span>'+
        mkKC(a.keep, a.change)+'</div>';
    }).join("")+'</div></div>' : "")+
    (tested.length? '<div><span class="eyebrow">What they assess</span><div class="fbgrid" style="margin-top:6px">'+tested.map(function(a){
      return '<div class="fbans"><span class="q">'+esc(a.area)+'</span>'+mkRateChip(a.rating)+(a.note? '<span>'+esc(a.note)+'</span>' : "")+'</div>';
    }).join("")+'</div>'+
      (skipped.length? '<p class="statushint" style="margin:8px 0 0">Not covered in this mock: '+esc(skipped.map(function(a){ return a.area; }).join(" · "))+'</p>' : "")+'</div>'
      : (skipped.length? '<p class="statushint" style="margin:0">Not covered in this mock: '+esc(skipped.map(function(a){ return a.area; }).join(" · "))+'</p>' : ""))+
    (yq? '<div class="fbans"><span class="q">Your questions for them</span>'+mkRateChip(yq.rating)+
      ulist(yq.asked)+(yq.note? '<span>'+esc(yq.note)+'</span>' : "")+
      ((yq.better||[]).length? '<span class="eyebrow" style="margin-top:4px">Ask these too</span>'+ulist(yq.better) : "")+'</div>' : "")+
    (un.length? prepSec("Still to find out",ulist(un)) : "");
  return '<div class="card panel mkfb2">'+
    '<div class="mkfbbar"><span class="mkfbmeta">'+esc([meta.type, meta.company, meta.date? niceShort(meta.date) : "", dur? Math.round(dur/60)+" min" : ""].filter(Boolean).join(" · "))+
      (meta.saved? ' <span class="statushint">· saved to Past mocks</span>' : "")+'</span>'+
      '<button type="button" class="btn primary sm" data-mkclose="1">Close</button></div>'+
    (f.headline? '<p class="mkhead">'+esc(f.headline)+'</p>' : "")+
    '<div class="grid2" style="gap:12px">'+
      prepSec("Keep doing",ulist(f.keep))+
      prepSec("Improve",ulist(f.improve))+
    '</div>'+
    (f.nextFocus? '<div class="notice" style="font-size:13px"><b>Practise next:</b> '+esc(f.nextFocus)+
      ' <button type="button" class="btn sm" data-mknext="'+esc(f.nextFocus)+'">Practise this next</button></div>' : "")+
    (det? '<details class="mkfbdet"><summary>Details'+
      (per.length? ' <span class="statushint">· '+plural(per.length,"answer")+(nFix? ", "+nFix+" to fix" : "")+'</span>' : "")+'</summary>'+
      '<div class="mkfbdetb">'+det+'</div></details>' : "")+
  '</div>';
}
function feedbackHtmlV1(f,dur,meta){
  f=f||{}; meta=meta||{};
  var per=(f.perAnswer||[]);
  return '<div class="card panel">'+
    '<div class="mkfbbar"><span class="mkfbmeta">'+esc([meta.type, meta.company, meta.date? niceShort(meta.date) : ""].filter(Boolean).join(" · "))+
      (meta.saved? ' <span class="statushint">· saved to Past mocks</span>' : "")+'</span>'+
      '<button type="button" class="btn primary sm" data-mkclose="1">Close</button></div>'+
    '<div class="sesshead"><span class="eyebrow">Feedback</span>'+
      (dur? '<span class="chip code">'+Math.round(dur/60)+' min</span>' : "")+
    '</div>'+
    (f.overall? '<p style="margin:0;font-size:14.5px;color:var(--ink)">'+esc(f.overall)+'</p>' : "")+
    mkAreasHtml(f.areas)+
    '<div class="grid2" style="gap:12px">'+
      prepSec("What worked",ulist(f.strengths))+
      prepSec("Fix next time",ulist(f.improve))+
    '</div>'+
    ((f.watchOuts||[]).length? prepSec("Said what you should not have",ulist(f.watchOuts),"avoid") : "")+
    ((f.criteria && (f.criteria.clashes||[]).length)? prepSec("Clashes with your own deal-breakers",ulist(f.criteria.clashes),"avoid") : "")+
    ((f.criteria && (f.criteria.unasked||[]).length)? prepSec("Still to find out — ask next time",ulist(f.criteria.unasked)) : "")+
    (f.yourQuestions? '<div class="fbans"><span class="q">Your questions for them</span>'+
      ulist(f.yourQuestions.asked)+
      (f.yourQuestions.good? '<span><b style="font-weight:500">Good:</b> '+esc(f.yourQuestions.good)+'</span>':"")+
      (f.yourQuestions.fix? '<span style="color:var(--ink-2)"><b style="font-weight:500">Fix:</b> '+esc(f.yourQuestions.fix)+'</span>':"")+
      ((f.yourQuestions.better||[]).length? '<span class="eyebrow" style="margin-top:4px">Sharper questions</span>'+ulist(f.yourQuestions.better) : "")+'</div>' : "")+
    (per.length? '<div><span class="eyebrow">Answer by answer</span><div class="fbgrid" style="margin-top:6px">'+per.map(function(a){
      return '<div class="fbans"><span class="q">'+esc(a.q||"")+'</span>'+
        (a.type? '<span class="chip mkqt" style="align-self:flex-start">'+esc(a.type)+'</span>' : "")+
        (a.good? '<span><b style="font-weight:500">Good:</b> '+esc(a.good)+'</span>':"")+
        (a.fix? '<span style="color:var(--ink-2)"><b style="font-weight:500">Fix:</b> '+esc(a.fix)+'</span>':"")+'</div>';
    }).join("")+'</div></div>' : "")+
    ((f.missed||[]).length? '<div><span class="eyebrow">You could have used</span><div class="fbgrid" style="margin-top:6px">'+f.missed.map(function(m){
      return '<div class="fbans"><span class="q">'+esc(m.q||"")+'</span><span>'+esc(m.use||"")+'</span></div>';
    }).join("")+'</div></div>' : "")+
    (f.rewrite&&f.rewrite.better? '<div class="askbox"><span class="eyebrow">A stronger answer to: '+esc(f.rewrite.q||"")+'</span>'+prepPara(f.rewrite.better)+'</div>' : "")+
    (f.nextFocus? '<div class="notice" style="font-size:13px"><b>Next mock:</b> '+esc(f.nextFocus)+
      ' <button type="button" class="btn sm" data-mknext="'+esc(f.nextFocus)+'">Practise this next</button></div>' : "")+
    '<div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-mkclose="1">Close feedback</button></div>'+
  '</div>';
}
async function mkSave(f,dur){
  if(!DB) return;
  var id=today()+"-"+slug((MK.role&&MK.role.company)||"general")+"-"+MK.type+"-"+Date.now().toString(36).slice(-4);
  try{
    await DB.doc("mocks/"+id).set({
      roleId: MK.role? MK.role.id : "", company: MK.role? MK.role.company : "", type:MK.type, types:MK.types||[MK.type], split:MK.split||null, focus:MK.focus,
      date:today(), durationSec:dur, turns:MK.turns, feedback:f||null, caseBrief:MK.caseText||""
    });
    MK.savedId=id;
  }catch(e){ console.warn("mock save",e); el("offline").hidden=false; }
}
function renderPastMocks(){
  var box=el("mk-past"); if(!box) return;
  var rid=el("mk-role")? el("mk-role").value : "";
  var list=mocks.filter(function(m){ return !rid || m.roleId===rid; })
    .sort(function(a,b){ return String(b.id).localeCompare(String(a.id)); });
  el("mk-pastmeta").textContent= list.length+(rid? " for this role" : " in all")+(mocks.length&&rid? " · "+mocks.length+" in all" : "");
  if(!list.length){ box.innerHTML='<p class="lede" style="margin:0">None yet'+(rid?" for this role":"")+'.</p>'; return; }
  box.innerHTML=list.slice(0,20).map(function(m){
    var f=m.feedback||{};
    return '<div class="card" style="padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<span class="chip code">'+esc(niceShort(m.date||""))+'</span>'+
      '<b style="font-weight:500">'+esc(m.types&&m.types.length>1? mkTypesLabel(m.types) : (MOCKTYPES[m.type]||m.type))+'</b>'+
      '<span style="color:var(--muted)">'+esc(m.company||"General")+'</span>'+
      (m.feedback? "" : '<span class="chip">no feedback</span>')+
      (f.nextFocus? '<span class="statushint" style="flex:1 1 240px">Next: '+esc(f.nextFocus)+'</span>' : '<span style="flex:1"></span>')+
      (MK.viewing===m.id? '<button class="btn edbtn" data-mkclose="1" onclick="mkCloseFb()">Showing · Close</button></div>'
        : '<button class="btn edbtn" data-act="mockview" data-mid="'+esc(m.id)+'">Open</button></div>');
  }).join("");
}
function showPastMock(mid){
  var m=mocks.find(function(x){return x.id===mid;}); if(!m) return;
  var fb=el("mock-feedback"); fb.hidden=false;
  var tx=(m.turns||[]).map(function(t){
    return '<div class="msg '+t.who+'"><span class="who">'+(t.who==="them"?"Interviewer":"You")+'</span>'+esc(String(t.text).replace(/\n?\[END\]\s*$/,""))+'</div>';
  }).join("");
  MK.viewing=mid; el("mock-setup").hidden=true;
  var tl=m.types&&m.types.length>1? mkTypesLabel(m.types) : (MOCKTYPES[m.type]||m.type);
  var meta={type:tl, company:m.company||"General", date:m.date};
  fb.innerHTML=(m.feedback? feedbackHtml(m.feedback,m.durationSec,meta) : '<div class="card panel"><div class="mkfbbar"><span class="mkfbmeta">'+esc([meta.type,meta.company,niceShort(meta.date||"")].join(" · "))+'</span><button type="button" class="btn primary sm" data-mkclose="1">Close</button></div>No feedback was saved for this mock.</div>')+
    '<details class="card panel cfold" style="display:block;margin-top:12px"><summary>Transcript · '+esc(tl)+' · '+esc(m.company||"General")+' · '+esc(niceShort(m.date||""))+'</summary>'+
    '<div class="chatlog" style="max-height:none">'+tx+'</div>'+
    (m.caseBrief? '<div><span class="eyebrow">'+(m.type==="takehome"? "The brief" : "How the exercise runs")+'</span><pre style="white-space:pre-wrap;font-size:12.5px">'+esc(m.caseBrief)+'</pre></div>' : "")+
    (m.scratch? '<div><span class="eyebrow">Scratch pad</span><pre style="white-space:pre-wrap;font-size:12.5px">'+esc(m.scratch)+'</pre></div>' : "")+
    '</details>';
  renderPastMocks();
  fb.scrollIntoView({behavior:"smooth",block:"start"});
}
/* Closing the feedback (5 Oct): back to the setup form; the mock stays in Past mocks. */
function mkCloseFb(){
  var fb=el("mock-feedback"); fb.hidden=true; fb.innerHTML=""; MK.viewing="";
  if(!MK.on){ el("mock-session").hidden=true; el("mock-setup").hidden=false; }
  renderPastMocks();
}
el("mock-feedback").addEventListener("click",function(ev){
  if(ev.target.closest("[data-mkclose]")){ mkCloseFb(); window.scrollTo({top:el("tab-mock").offsetTop-20,behavior:"smooth"}); return; }
  var n=ev.target.closest("[data-mknext]"); if(n){ mkCloseFb(); el("mk-focus").value=n.dataset.mknext; el("mk-focus").focus(); }
});
el("mk-role").addEventListener("change",function(){ mockSuggest(); renderPastMocks(); });
el("mk-suggest").addEventListener("click",function(ev){
  var b=ev.target.closest("#mk-usesug"); if(!b) return;
  if(b.dataset.t) mkSetTypes(b.dataset.t.split(","));
  el("mk-focus").value=b.dataset.f||"";
});
el("mk-start").addEventListener("click",mkStart);
el("mk-types").addEventListener("click",function(ev){ var b=ev.target.closest("[data-mkt]"); if(b) mkTypeClick(b.dataset.mkt); });
el("mk-split").addEventListener("click",function(ev){ var b=ev.target.closest("[data-mks]"); if(b && !b.disabled) mkSplitNudge(b.dataset.mks); });
el("mk-len").addEventListener("change",function(){ MKT.split=null; mkTypesPaint(); });
mkTypesPaint();
el("mk-send").addEventListener("click",mkSend);
el("mk-in").addEventListener("keydown",function(ev){ if(ev.key==="Enter" && (ev.metaKey||ev.ctrlKey)){ ev.preventDefault(); mkSend(); } });
el("mk-stop").addEventListener("click",function(){ if(MK.ctl) MK.ctl.abort(); });
el("mk-end").addEventListener("click",function(){ if(!MK.busy) mkFeedback(); else el("mk-shint").textContent="Wait for the interviewer to finish, or press Stop reply."; });
el("mk-abandon").addEventListener("click",function(){
  if(MK.turns.some(function(t){return t.who==="me";}) && !MK.confirmAbandon){ MK.confirmAbandon=true; el("mk-abandon").textContent="Press again to discard"; return; }
  MK.confirmAbandon=false; el("mk-abandon").textContent="Abandon";
  mkStopAll(); MK.turns=[]; mkReset(); mkCloseFb();
});
(async function(){
  try{ SAMPLE = window.claude && window.claude.use ? await window.claude.use("sample") : null; }catch(e){ SAMPLE=null; }
  SAMPLE_READY=true;
  if(!SAMPLE){ var o=el("mock-off"); o.hidden=false; o.textContent="Asking Claude is not available in this view, so mocks cannot run here. Open the board on claude.ai while signed in."; el("mk-start").disabled=true; }
})();
