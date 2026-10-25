"use strict";
/* ===== Setup wizard (22 Oct) =====
   Takes a new person from an installed, empty board to a first longlist and a weekly rhythm. A pop-up over the
   board with a step list on the left; progress is kept in `profile/onboarding`, so it resumes on any computer.
   Steps 0-5 and 10-11 run in the page (Claude drafts through `sample`, the person confirms); steps 6-9 hand work
   to Claude in the person's Next Role project: Copy for Claude, and the next-role-setup skill marks the step on
   the board (`h_<step>`: working, done or failed), which this page shows live.
   It opens by itself only on a fresh board (no roles, empty profile) or a setup already started and not finished;
   never on a board that was in use before setup existed. Desktop only: on a phone the card says to continue on a
   computer. Every save that changes the profile, criteria or settings is logged in `rulelog` (kind "setup") with
   Undo, so "Redo this step" from About me is safe.
   onboarding doc: {startedAt, step, status{k: todo|doing|done|skipped}, drafts{about, skills, want}, cvPaste,
     req_<k> {reqId, copiedAt} (written here), h_<k> {status, reqId, startedAt, doneAt, summary, error} (written by
     the skill), rhythm {...}, rhythmTasks [ids], noGmail, doneAt, updatedAt}. */

var SU_STEPS=[
  {k:"welcome",  n:"Welcome",                 t:"2 min"},
  {k:"plan",     n:"The plan",                t:"1 min"},
  {k:"cv",       n:"Your CV and cover letter",t:"5 min"},
  {k:"about",    n:"About you",               t:"15 min"},
  {k:"skills",   n:"Skills",                  t:"15 min"},
  {k:"want",     n:"What you want",           t:"30–45 min"},
  {k:"companies",n:"Companies",   t:"You 20 min · Claude 15–30 min", hand:true},
  {k:"sources",  n:"Where roles come from",   t:"You 15 min · Claude 10–20 min", hand:true},
  {k:"testsweep",n:"Test sweep",              t:"You 10 min · Claude 15–25 min", hand:true, skip:true},
  {k:"alerts",   n:"Job alerts",              t:"You and Claude, about 5 min a site", hand:true, skip:true},
  {k:"rhythm",   n:"Your rhythm",             t:"15 min"},
  {k:"done",     n:"Done",                    t:"5 min"}
];
var SU_WHY={
  welcome:"What the board does for you, and what it never does.",
  plan:"How long setup takes and how it works. Stop whenever you like; it picks up where you left off.",
  cv:"Your CV is the starting point for everything: your profile, your skills, Role Fit, every tailored CV and interview prep.",
  about:"The facts the board works from: where you are, what you do, how you present yourself. Claude drafts it from your CV; you correct it.",
  skills:"Your top 20 skills, each with a line of proof from your CV. Role Fit, CV packs and interview prep all lean on these.",
  want:"What rules a role out, and what makes one better. The sweep screens every role against this, so it's the most important step.",
  companies:"The companies you want. Claude works out the sectors that suit you and proposes companies in them; your rating decides how often the sweep reads each company's own jobs page.",
  sources:"The job sites and alerts the sweep reads, and the ones you'll check yourself.",
  testsweep:"One sweep now, to see whether your rules and sources find the right roles before the schedule takes over.",
  alerts:"Some sites can only be read through their job-alert emails. This sets those alerts up, site by site.",
  rhythm:"Your goal for live applications, when the scheduled runs happen, and the repeating tasks that keep the search moving.",
  done:"How a week runs from here, and what to try first."
};
var SU_HAND_TIME={companies:"usually 15–30 minutes", sources:"usually 10–20 minutes", testsweep:"usually 15–25 minutes", alerts:"as long as the sites take: about 5 minutes each", schedule:"a few minutes"};
var SU_CORE_ME=["Pay below my bar","Level or scope wrong","Company concern","Fails one of my must-haves","Needs something I don't have","Chose another route","Other"];

var SU={db:null, doc:null, loaded:false, rolesKnown:false, rolesN:0, step:null, busy:"", err:"", draft:{}, auto:false, wantPhase:null, redo:false};

function suDone(){ return !!(SU.doc && SU.doc.doneAt); }
function suStarted(){ return !!SU.doc; }
function suStatus(k){ return ((SU.doc&&SU.doc.status)||{})[k]||"todo"; }
function suStepIx(k){ for(var i=0;i<SU_STEPS.length;i++) if(SU_STEPS[i].k===k) return i; return 0; }
function suStepOf(k){ return SU_STEPS[suStepIx(k)]; }
function suNDone(){ return SU_STEPS.filter(function(s){ var x=suStatus(s.k); return x==="done"||x==="skipped"; }).length; }
function suNextOpen(){ var s=SU_STEPS.find(function(s){ var x=suStatus(s.k); return x!=="done" && x!=="skipped"; }); return s? s.k : "done"; }
// A phone is narrow AND touch-first: a narrow window or side panel on a computer is not a phone.
function suPhone(){ return !!(window.matchMedia && window.matchMedia("(max-width: 760px) and (pointer: coarse)").matches); }
/* A board is fresh when nothing has been set up: no roles, no name, no deal-breakers. */
function suFresh(){
  var P=PROFILE||{}, F=PREFS||{};
  return SU.rolesKnown && !SU.rolesN && !rawRoles.length && !String(P.name||"").trim() && !((F.hardRules||[]).length);
}
/* Setup is "on" (card, Resume button) when started and not finished, or on a fresh board. */
function suOn(){ if(suDone()) return false; if(suStarted()) return true; return suFresh(); }
function suIsTest(){ return !!(SETTINGS && SETTINGS.board && SETTINGS.board.kind==="test"); }
function suHand(k){ return (SU.doc && SU.doc["h_"+k])||null; }
function suReq(k){ return (SU.doc && SU.doc["req_"+k])||null; }

/* ---------- saving ---------- */
async function suSave(patch){
  if(!SU.db) throw {code:"no_db"};
  patch=Object.assign({}, patch, {updatedAt:new Date().toISOString()});
  if(SU.doc){ await SU.db.doc("profile/onboarding").update(patch); SU.doc=Object.assign({},SU.doc,patch); }
  else { var d=Object.assign({startedAt:new Date().toISOString(), status:{}, step:"welcome"}, suFresh()? {} : {doneAt:new Date().toISOString(), legacy:true}, patch); await SU.db.doc("profile/onboarding").set(d); SU.doc=d; }
}
async function suSetStatus(k,v,extra){
  var st=Object.assign({}, (SU.doc&&SU.doc.status)||{}); st[k]=v;
  await suSave(Object.assign({status:st}, extra||{}));
}
async function suKeepDrafts(){ try{ await suSave({drafts:JSON.parse(JSON.stringify(SU.draft||{}))}); }catch(e){ console.warn("setup drafts",e&&e.code); } }
/* Change log with undo: the whole document before, so Undo puts it back exactly. */
async function suLog(path,before,label){
  if(!DB) return;
  try{ await DB.doc("rulelog/rl-"+Date.now()+"-"+Math.floor(Math.random()*1000)).set({at:new Date().toISOString(), kind:"setup", ruleId:"", doc:path, action:"edit",
    before:before? JSON.parse(JSON.stringify(before)) : null, after:{name:label}, via:"setup", why:SU.redo? "Redone in setup" : "From setup"}); }catch(e){}
}
async function suDocNow(path){ try{ var s=await DB.doc(path).get(); return s && s.exists? s.data() : null; }catch(e){ return null; } }
srUndo=(function(orig){ return async function(logId){
  var l=((typeof RU!=="undefined" && RU.log)||[]).find(function(x){return x.id===logId;});
  if(!l || l.kind!=="setup") return orig.apply(this,arguments);
  try{
    if(l.before) await DB.doc(l.doc).set(l.before); else await DB.doc(l.doc).delete();
    await DB.doc("rulelog/"+logId).update({undone:true}); toast("Undone");
  }catch(e){ toast("Couldn't undo — try again",true); }
}; })(srUndo);

/* ---------- Claude in the page ---------- */
/* The CV and letter as the step sees them: its own subscription first (it updates as soon as an upload lands), else the board's. */
function suTpl(k){ return (SU.tpl && SU.tpl[k]) || TEMPLATES[k] || null; }
function suCvText(){ var c=suTpl("cv"), t=(c && c.text) || (SU.doc && SU.doc.cvPaste) || ""; return String(t).slice(0,16000); }
function suLetterText(){ var l=suTpl("letter"); return String((l && l.text)||"").slice(0,5000); }
function suProfileText(){
  var P=PROFILE||{}, keys=[["name","Name"],["headline","Headline"],["profession","Profession"],["location","Location"],["country","Country"],["rightToWork","Right to work"],
    ["availability","Availability"],["lastRole","Last role"],["experience","Experience"],["status","Right now"]];
  return keys.map(function(k){ return P[k[0]]? k[1]+": "+P[k[0]] : ""; }).filter(Boolean).join("\n")||"(not filled in yet)";
}
async function suAsk(prompt,tier){ return rvAsk([{role:"user",content:prompt}], tier||"complex"); }

/* ---------- the dialog ---------- */
function suEnsureDlg(){
  var d=el("su-dialog"); if(d) return d;
  document.body.insertAdjacentHTML("beforeend",'<dialog id="su-dialog" class="modal sudlg" aria-label="Set up Next Role"><div class="suwrap">'+
    '<nav class="sunav" id="su-nav" aria-label="Setup steps"></nav>'+
    '<section class="sumain"><header class="suhead"><div><span class="eyebrow" id="su-kicker"></span><h3 id="su-title"></h3><p class="lede" id="su-why"></p></div>'+
      '<button type="button" class="btn ghost" data-su="later">Save and finish later</button></header>'+
      '<div class="subody" id="su-body"></div>'+
      '<footer class="sufoot" id="su-foot"></footer></section></div></dialog>');
  d=el("su-dialog");
  d.addEventListener("close",function(){ document.documentElement.classList.remove("su-lock"); SU.open=false; suKeepDrafts(); suPaintOutside(); });
  d.addEventListener("cancel",function(){ SU.open=false; });
  return d;
}
function suOpen(k,redo){
  if(suPhone()){ toast("Setup works on a computer. Open the board there to carry on."); return; }
  document.documentElement.classList.add("su-lock");
  var d=suEnsureDlg();
  SU.redo=!!redo;
  SU.draft=JSON.parse(JSON.stringify((SU.doc&&SU.doc.drafts)||{}));
  SU.step=k || (SU.doc&&SU.doc.step) || suNextOpen();
  SU.err=""; SU.busy=""; SU.wantPhase=null; SU.chatTried=false;
  if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
  SU.open=true;
  suPaint();
  if(!SU.doc) suSave({step:SU.step}).catch(function(){});
}
function suClose(){ var d=el("su-dialog"); if(d && d.open) d.close(); }
async function suGo(k){
  await suKeepDrafts();
  SU.step=k; SU.err=""; SU.busy=""; SU.wantPhase=null;
  suPaint();
  var b=el("su-body"); if(b) b.scrollTop=0;
  try{ var extra={step:k}; if(suStatus(k)==="todo") await suSetStatus(k,"doing",extra); else await suSave(extra); }catch(e){}
}
async function suFinishStep(k,status){
  await suSetStatus(k,status||"done");
  var i=suStepIx(k), nx=SU_STEPS[i+1];
  if(SU.redo && status!=="skipped"){ toast(suStepOf(k).n+" saved"); }
  if(nx) suGo(nx.k); else suPaint();
}

function suPaint(){
  if(!SU.open) return;
  var s=suStepOf(SU.step), i=suStepIx(SU.step);
  el("su-kicker").textContent="Setup · step "+(i+1)+" of "+SU_STEPS.length+" · "+s.t;
  el("su-title").textContent=s.n;
  el("su-why").textContent=SU_WHY[s.k]||"";
  suPaintNav();
  var fn=SU_R[s.k];
  /* How this step works sits at the top of every step Claude does a part of; it folds shut once that part is done. */
  var hk= s.k==="rhythm"? "schedule" : (s.hand? s.k : ""), hh=hk? suHand(hk) : null;
  el("su-body").innerHTML=(SU.err? '<div class="notice warn suerr">'+esc(SU.err)+'</div>' : "")+(hk? suHowHtml(hk, (hh && hh.status==="done") || (hk==="schedule" && SU.doc && SU.doc.schedSelf)) : "")+(fn? fn() : "");
  el("su-foot").innerHTML=suFootHtml(s.k);
}
function suPaintNav(){
  var n=el("su-nav"); if(!n) return;
  var done=suNDone();
  n.innerHTML='<div class="suprog"><b>'+done+' of '+SU_STEPS.length+'</b><span>steps done</span><i style="--p:'+Math.round(done/SU_STEPS.length*100)+'%"></i></div><ol>'+
    SU_STEPS.map(function(s,i){
      var st=suStatus(s.k), h=s.hand? suHand(s.k==="rhythm"?"schedule":s.k) : null, cur=s.k===SU.step;
      var ic= st==="done"? "✓" : st==="skipped"? "–" : String(i+1);
      var sub= h && h.status==="working"? "Claude is working on it" : st==="skipped"? "Skipped" : s.t;
      return '<li class="'+(cur?"cur ":"")+"st-"+st+'"><button type="button" data-su="go:'+s.k+'"'+(cur?' aria-current="step"':"")+'><span class="suic">'+ic+'</span>'+
        '<span class="sunm">'+esc(s.n)+'<small>'+esc(sub)+'</small></span></button></li>';
    }).join("")+'</ol>';
}
function suFootHtml(k){
  var i=suStepIx(k), prev=SU_STEPS[i-1], s=SU_STEPS[i];
  var back=prev && k!=="welcome"? '<button type="button" class="btn ghost" data-su="go:'+prev.k+'">Back</button>' : "";
  var skip=s.skip && suStatus(k)!=="done" && !(s.hand && suHand(k) && suHand(k).status==="done")? '<button type="button" class="linkbtn" data-su="skip:'+k+'">Skip this step</button>' : "";
  var main=SU_MAIN[k]? SU_MAIN[k]() : "";
  return back+'<span class="suspace"></span>'+skip+main;
}
function suBtn(act,label,primary,dis){ return '<button type="button" class="btn'+(primary?" primary":"")+'" data-su="'+act+'"'+(dis?" disabled":"")+'>'+esc(label)+'</button>'; }
function suBusyHtml(msg){ return '<div class="subusy"><span class="suspin" aria-hidden="true"></span>'+esc(msg)+'</div>'; }

/* Draft fields: data-suf="about.name", "skills.items.3.level", "want.criteria.hardRules.0.firm". */
function suGetPath(o,p){ return String(p).split(".").reduce(function(a,k){ return a==null? undefined : a[k]; },o); }
function suSetPath(o,p,v){ var ks=String(p).split("."), a=o; for(var i=0;i<ks.length-1;i++){ if(a[ks[i]]==null) a[ks[i]]= /^\d+$/.test(ks[i+1])? [] : {}; a=a[ks[i]]; } a[ks[ks.length-1]]=v; }
function suIn(path,label,opts){
  opts=opts||{}; var v=suGetPath(SU.draft,path); v=v==null? "" : v;
  var miss=opts.req && !String(v).trim();
  var input= opts.area? '<textarea data-suf="'+path+'" rows="'+(opts.rows||3)+'" placeholder="'+esc(opts.ph||"")+'">'+esc(v)+'</textarea>'
    : opts.sel? '<select data-suf="'+path+'">'+opts.sel.map(function(o){ return '<option value="'+esc(o[0])+'"'+(String(v)===o[0]?" selected":"")+'>'+esc(o[1])+'</option>'; }).join("")+'</select>'
    : '<input data-suf="'+path+'" value="'+esc(v)+'" placeholder="'+esc(opts.ph||"")+'"'+(opts.num?' inputmode="numeric"':"")+'>';
  return '<label class="fld'+(miss?" sumiss":"")+(opts.wide?" suwide":"")+'"><span class="sulab">'+esc(label)+(opts.tag||"")+'</span>'+input+(opts.hint? '<small class="suhint">'+esc(opts.hint)+'</small>' : "")+'</label>';
}
document.addEventListener("input",function(ev){
  var f=ev.target.closest && ev.target.closest("#su-dialog [data-suf]"); if(!f) return;
  var v= f.type==="checkbox"? f.checked : f.value;
  suSetPath(SU.draft,f.dataset.suf,v);
  var lab=f.closest(".sumiss"); if(lab && String(v).trim()) lab.classList.remove("sumiss");
});
document.addEventListener("change",function(ev){
  var f=ev.target.closest && ev.target.closest("#su-dialog [data-suf]"); if(!f) return;
  suSetPath(SU.draft,f.dataset.suf, f.type==="checkbox"? f.checked : f.value);
  if(f.dataset.surepaint) suPaint();
});

/* ---------- handoffs: Copy for Claude, then the skill marks the step ---------- */
var SU_HAND_ASK={
  companies:function(){ return ["Work out the sectors that suit me, then propose up to 25 companies in them that fit my criteria, best fits first, each with one line on why (say what the company does if it isn't well known) and a suggested rating. "+
    "Include the companies I've already added. Research each company: its own jobs page and how many office days it asks for. Mark those whose roles can only be read through a LinkedIn alert."]; },
  sources:function(){ return ["Recommend the job sites, recruitment agencies and careers-site searches for my level, field and location. Label each job site: read automatically, through alert emails (only if the site offers them), or I check it by hand. Add them to the board as Trial for me to choose."]; },
  testsweep:function(){ return ["Run one sweep now as a test, with next-role-sweep, on everything it can read. Then summarise what it found per source, which sources came back empty or blocked, and what each deal-breaker cut."].concat(suIsTest()? ["This is a test board: read the alert emails only."] : []); },
  alerts:function(){ return ["Set up job alerts: LinkedIn job alerts for each of my search terms, for the places my Where I can work rule allows (my area, remote, or both), the sources the test sweep couldn't read and the ones marked as needing alert emails, plus a LinkedIn company alert for companies whose job page can't be read. "+
    "Check my Gmail first for alerts I already get, and don't duplicate them. "+
    "I've signed up to the sites on the board's checklist and I'm signed in to them in Chrome. Create the alerts there with Claude in Chrome, and set up the Gmail filter into my job-alerts label (or give me exact steps if you can't create the filter). "+
    "Don't wait for me in the chat: if I'm not signed in to a site, skip it and mark it on the board as needing me to sign in. Show each site's progress on the board as you go."].concat(SU.alertsOnly && SU.alertsOnly.length? ["Only these sites this time (the others are done): "+SU.alertsOnly.join(", ")+"."] : []).concat(suIsTest()? ["This is a test board, so a dry run: list the alerts and the filter you would create, but don't sign up, create alerts, change Gmail or open the browser to change anything."] : []); },
  schedule:function(){ var r=(SU.doc&&SU.doc.rhythm)||SU.draft.rhythm||{};
    return ["Create my scheduled tasks: "+suRhythmText(r)+"."].concat(r.sweepModel!=="same"? ["I want the sweep task to run on Sonnet, to save my usage: set its model to Sonnet once it's created."] : []).concat(suIsTest()? ["This is a test board: show me the scheduled tasks you would create, with their prompts, but don't create them."] : []); }
};
function suHandText(k,reqId){
  var url=SETTINGS && SETTINGS.board && SETTINGS.board.url, s=k==="schedule"? {n:"Scheduled tasks"} : suStepOf(k);
  return ["Run next-role-setup on my Next Role board"+(url? " ("+url+")" : "")+".",
    "Setup step: "+k+" ("+s.n+")",
    "Request: "+reqId].concat(SU_HAND_ASK[k]()).concat(["When it's done, mark the step on the board and tell me to go back to it."]).join("\n");
}
/* How each Claude step works, shown before the request is copied and kept below the status box after. */
var SU_HAND_HOW={
  companies:["Paste the request into a new chat in your Next Role project. You don't need to stay in the chat.",
    "Companies appear in the list below as Claude adds them, each with a suggested rating and why. The sectors Claude looked in are listed above them.",
    "Rate each one here (or in Targets › Companies), while Claude is still working if you like. Rate the ones you know and move on when you're ready; the rest count as If it appears until you rate them.",
    "Companies whose jobs page Claude can't read are tagged Needs a LinkedIn alert. Nothing to do now: step 10, Job alerts, sets those alerts up with you.",
    "When Claude finishes, this box says Complete, and its last message in the chat tells you to come back here."],
  sources:["Paste the request into a new chat in your Next Role project. You don't need to stay in the chat.",
    "Sources appear in the list below as Claude adds them, each labelled read automatically, needs alert emails, or you check by hand.",
    "Choose Active, Trial or Not now for each.",
    "When Claude finishes, this box says Complete, and its last message in the chat tells you to come back here."],
  testsweep:["Paste the request into a new chat in your Next Role project. You don't need to stay in the chat.",
    "Claude runs one full sweep. The roles it finds land on your Longlist.",
    "When it finishes, this box says Complete with what it found and what your deal-breakers cut."],
  alerts:["Sign up to each site in the checklist below, then tick it.",
    "Copy the request and paste it into a new chat in your Next Role project. You don't need to stay in the chat.",
    "Claude checks Gmail for alerts you already get, then sets up the rest: a LinkedIn alert for each of your search terms (your area, remote, or both, as you said in What you want), alerts on the other sites, LinkedIn company alerts, and one Gmail filter that files them all under your job-alerts label.",
    "Each site's progress shows in the checklist. A site you weren't signed in to is skipped and marked; sign in, then copy a request for just those.",
    "Needs Gmail connected to Claude, and Claude in Chrome.",
    "TEST:This is a test board, so it's a dry run: nothing is created."],
  schedule:["Part 1: choose your goal, the times Claude runs and your reminders, then press Save. Save creates your repeating tasks in Week ahead.",
    "Part 2: copy the request and paste it into a new chat in your Next Role project.",
    "Claude creates four scheduled tasks in your Claude account, at the times you saved in part 1: the sweep, the morning run (two tasks, 45 minutes apart) and the screen-out check.",
    "When they exist, this box says Complete and Continue opens. Change a time later? Save changes in part 1, then copy the request again.",
    "If a task would stop to ask your approval on each run, Claude says so here, and you turn on Automatically approve for it straight away, once. Then the runs never wait for you.",
    "TEST:This is a test board, so Claude only lists the tasks it would create."]
};
function suHowHtml(k,shut){ var h=(SU_HAND_HOW[k]||[]).filter(function(x){ return x.indexOf("TEST:")!==0 || suIsTest(); }).map(function(x){ return x.replace(/^TEST:/,""); }); if(!h.length) h=null; return h? '<details class="enrich suhow"'+(shut?"":" open")+'><summary>How this step works</summary><ol>'+h.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ol></details>' : ""; }
function suHandHtml(k){ return suHandBox(k); }
function suHandBox(k){
  var h=suHand(k), q=suReq(k), st=h && (!q || h.reqId===q.reqId || !h.reqId)? h.status : "", t=SU_HAND_TIME[k]||"";
  var copy='<button type="button" class="btn primary" data-su="copy:'+k+'">Copy for Claude</button>';
  if(st==="done") return '<div class="suhand ok"><b>Complete</b>'+(h.summary? '<p>'+esc(h.summary)+'</p>' : "")+
    '<small>Finished '+esc(suWhen(h.doneAt))+'. Want Claude to do it again? <button type="button" class="linkbtn" data-su="copy:'+k+'">Copy the request again</button></small></div>';
  if(st==="failed") return '<div class="suhand bad"><b>Claude couldn\'t finish this</b><p>'+esc(h.error||"No reason was given.")+'</p>'+copy+'<small>Copy it again and paste it into a new chat to try again.</small></div>';
  if(st==="working"){
    var stale=h.startedAt && (Date.now()-Date.parse(h.startedAt) > 3*3600*1000);
    return '<div class="suhand run">'+suBusyHtml("Claude is working on this")+'<p>Started '+esc(suWhen(h.startedAt))+(t? ", "+esc(t) : "")+'. You can carry on with other steps, or close setup: this updates by itself when Claude finishes.</p>'+
      (stale? '<small>No word from Claude for over three hours. If the chat stopped, <button type="button" class="linkbtn" data-su="copy:'+k+'">copy the request again</button>.</small>' : "")+'</div>';
  }
  if(q) return '<div class="suhand wait"><b>Copied. Now paste it into a new chat in your Next Role project.</b><p>This step updates by itself as soon as Claude starts. '+(t? "It takes "+esc(t)+"." : "")+'</p>'+
    '<small>Not copied properly? <button type="button" class="linkbtn" data-su="copy:'+k+'">Copy again</button> · <button type="button" class="linkbtn" data-su="showreq:'+k+'">Show the request</button></small>'+
    (SU.showReq===k? '<textarea class="sureq" readonly rows="6">'+esc(suHandText(k,q.reqId))+'</textarea>' : "")+'</div>';
  return '<div class="suhand"><p>Claude does this part in your Next Role project, where it can search the web and use your connections. Copy the request, paste it into a new chat there, and come back: '+
    'this step updates by itself as Claude works, and says when it\'s done.</p>'+copy+'</div>';
}
function suWhen(iso){ if(!iso) return "just now"; var d=new Date(iso); if(isNaN(d)) return String(iso); var t=d.toTimeString().slice(0,5);
  return (d.toISOString().slice(0,10)===new Date().toISOString().slice(0,10)? "today at " : niceShort(d.toISOString().slice(0,10))+" at ")+t; }
async function suCopy(k){
  var reqId="su-"+k+"-"+Date.now().toString(36), txt=suHandText(k,reqId);
  var o={}; o["req_"+k]={reqId:reqId, copiedAt:new Date().toISOString()};
  fxClip(txt,function(){ toast("Copied. Paste it into a new chat in your Next Role project"); },function(){ SU.showReq=k; toast("Couldn't copy by itself: select the request and copy it",true); });
  try{ await suSave(o); }catch(e){}
  suPaint();
}

/* ---------- steps ---------- */
var SU_R={}, SU_MAIN={};

SU_R.welcome=function(){
  var does=(typeof HP_DOES!=="undefined"? HP_DOES : []).slice(0,6);
  return '<div class="suhero"><h2>Your job search, run like a product.</h2><p>One board for the whole search. Claude does the legwork on a schedule, finding roles, researching them, '+
    'drafting applications and prepping interviews, so your time goes on the decisions only you can make.</p></div>'+
    (does.length? '<div class="sudoes">'+does.map(function(d){ return '<div><span class="hpdoi">'+(typeof hpIcon==="function"? hpIcon(d[0]) : "")+'</span><b>'+esc(d[1])+'</b><p>'+esc(d[2])+'</p></div>'; }).join("")+'</div>' : "")+
    '<div class="supromise"><b>Three promises</b><ul><li>It never applies or sends anything. CVs, letters and emails are drafts; you send them.</li>'+
    '<li>It never decides for you. Moving a role on, rejecting it or applying is always your call.</li><li>It never scores your appetite. How much you want a role or a company is yours alone.</li></ul></div>';
};
SU_MAIN.welcome=function(){ return suBtn("next:welcome","Let's set it up",true); };

SU_R.plan=function(){
  return '<p class="sulede">Setup takes <b>about 4–5 hours of your time over a day or two</b>. Where a step shows Claude&rsquo;s time too, that part runs in the background while you do something else. '+
    'Everything is saved as you go: close it whenever you like, on any computer, and carry on from where you stopped.</p>'+
    '<ol class="suplan">'+SU_STEPS.filter(function(s){ return s.k!=="welcome" && s.k!=="plan"; }).map(function(s){
      return '<li><b>'+esc(s.n)+'</b><span>'+esc(s.t)+'</span><small>'+esc(SU_WHY[s.k])+'</small></li>'; }).join("")+'</ol>'+
    '<p class="lede" style="font-size:12.5px">Claude drafts every step from your CV and your answers; you check and correct. Nothing is ever applied for or sent.</p>';
};
SU_MAIN.plan=function(){ return suBtn("next:plan","Start now",true); };

SU_R.cv=function(){
  var cv=suTpl("cv"), lt=suTpl("letter"), paste=SU.doc && SU.doc.cvPaste;
  function row(k,label,t,opt){
    return '<div class="docrow"><div class="dn"><b>'+esc(label)+(opt? ' <small>optional</small>' : "")+'</b><span>'+(t? esc(t.name)+(t.text? " · read ✓" : " · couldn't read its text") : "Not uploaded yet")+'</span></div>'+
      '<div class="row"><button type="button" class="btn sm'+(t?"":" primary")+'" data-act="tpl_up" data-kind="'+k+'">'+(t? "Replace" : "Upload")+'</button></div></div>';
  }
  return '<p class="sulede">Upload your CV as a Word file (.docx). It becomes your base CV: every tailored CV starts from it as tracked changes, and Claude reads it to draft your profile and skills. '+
    'A cover letter, if you have one, helps Claude match how you write.</p>'+
    row("cv","CV",cv)+row("letter","Cover letter",lt,true)+
    (!cv? '<details class="enrich sudet"'+(paste?" open":"")+'><summary>No Word CV? Paste your CV or LinkedIn profile text instead</summary>'+
      '<p class="lede" style="font-size:12.5px;margin:6px 0">On LinkedIn, More › Save to PDF on your profile gives you the text to copy. Claude drafts from it; you\'ll still want a Word CV before applying.</p>'+
      '<textarea id="su-cvpaste" rows="8" placeholder="Paste the text here">'+esc(paste||"")+'</textarea>'+
      '<div class="row" style="margin-top:6px">'+suBtn("cvpaste","Use this text")+'</div></details>' : "")+
    '<div class="suside"><b>While you\'re here: ask LinkedIn for your data</b><p>Warm routes uses your LinkedIn connections to find companies where you know someone. LinkedIn takes about a day to send them, so ask now: '+
    'Settings › Data privacy › Get a copy of your data › Connections. Skip it if you don\'t use LinkedIn.</p></div>';
};
SU_MAIN.cv=function(){ var c=suTpl("cv"), ok=!!((c && c.text) || (SU.doc && SU.doc.cvPaste)); return suBtn("next:cv","Continue",true,!ok); };

/* About you */
var SU_ABOUT_F=[
  ["name","Name",{req:1,g:"you"}],["headline","How you present yourself",{req:1,wide:1,g:"you",ph:"Your target title and experience, in one line"}],
  ["profession","Profession and level",{req:1,g:"you",ph:"e.g. Senior Data Analyst"}],["lastRole","Last role",{g:"you",ph:"Title, Employer"}],
  ["experience","Experience",{g:"you",ph:"e.g. 8 years in data analytics"}],
  ["linkedin","LinkedIn profile link (optional)",{g:"you",ph:"https://www.linkedin.com/in/…"}],
  ["roleShort","Short name for your craft",{g:"hidden"}],["fieldTerm","Your field in one word",{g:"hidden"}],
  ["location","Where you live",{req:1,g:"where",ph:"City, Country"}],["country","Country",{req:1,g:"where",hint:"Sets the pay and interview-report sites Claude uses"}],
  ["timezone","Time zone",{req:1,g:"where",ph:"e.g. Europe/London"}],["spelling","English for drafts",{g:"where",sel:[["UK","UK English"],["US","US English"]]}],
  ["rightToWork","Right to work",{req:1,g:"work",ph:"e.g. UK, no sponsorship needed"}],["availability","Availability",{g:"work",ph:"e.g. One month's notice"}],
  ["status","Right now: what you're doing, and why you're moving",{area:1,wide:1,g:"story"}],["career","Career summary, one line per role, newest first",{area:1,rows:5,wide:1,g:"story"}]];
/* roleShort and fieldTerm are worked out from the profession and saved without being shown (group "hidden"). */
var SU_ABOUT_G=[["you","You"],["where","Where you are"],["work","Right to work and availability"],["story","Your story"]];
/* Where each drafted field came from, shown beside its label. */
var SU_SRC={cv:"From your CV", worked:"Worked out: check it", board:"On your board"};
/* Fields a CV never states in so many words: always worked out. */
var SU_WORKED=["roleShort","fieldTerm","timezone","spelling"];
SU_R.about=function(){
  suSeed("about"); var a=SU.draft.about;
  if(!a) return SU.busy==="about"? suBusyHtml("Claude is reading your CV…") :
    '<p class="sulede">Claude drafts this from your CV. You check it and fill the gaps.</p>'+suBtn("draft:about","Draft it from my CV",true);
  return (SU.busy==="about"? suBusyHtml("Redrafting…") : "")+
    '<p class="sulede">Check each field. Each one says where it came from; anything your CV didn\'t say is highlighted.</p>'+
    SU_ABOUT_G.map(function(g){ return '<div class="susec"><h4>'+esc(g[1])+'</h4><div class="sugrid">'+
      SU_ABOUT_F.filter(function(f){ return f[2].g===g[0]; }).map(function(f){ var s=(a._src||{})[f[0]], v=String(a[f[0]]||"").trim();
        return suIn("about."+f[0],f[1],Object.assign({},f[2],{tag: s && v && SU_SRC[s]? '<span class="susrc s-'+s+'">'+SU_SRC[s]+'</span>' : ""})); }).join("")+'</div></div>'; }).join("")+
    '<p class="lede" style="font-size:12px">'+(a.voice? "How you write, from your CV and letter: "+esc(a.voice)+" " : "")+'<button type="button" class="linkbtn" data-su="draft:about">Redraft from my CV</button></p>';
};
SU_MAIN.about=function(){ return SU.draft.about? suBtn("save:about","Save and continue",true,SU.busy) : ""; };
async function suDraftAbout(){
  var cv=suCvText(); if(!cv){ SU.err="Upload your CV first (step 3)."; suPaint(); return; }
  SU.busy="about"; SU.err=""; suPaint();
  try{
    var j=await suAsk("You are drafting the 'About you' part of a job-search profile from the person's CV"+(suLetterText()? " and cover letter" : "")+". Use only what the documents say; "+
      "leave a field as \"\" when they don't say it. Reply with JSON only, these keys:\n"+
      '{"name":"","headline":"how they present themselves: target title and years of experience, one line","profession":"their profession and level, e.g. Senior Data Analyst",'+
      '"roleShort":"a short label for their craft, e.g. PM, Analyst, Designer, Engineer","fieldTerm":"one lower-case word for their field, e.g. product, data, design, engineering, marketing",'+
      '"location":"City, Country","country":"","timezone":"IANA name for where they live, e.g. Europe/London","spelling":"UK or US",'+
      '"rightToWork":"","availability":"","lastRole":"Title, Employer","experience":"e.g. 8 years in data analytics","status":"what they are doing now, if stated",'+
      '"linkedin":"their LinkedIn profile link, if the CV gives one, as a full https link","career":["one line per role, newest first: dates: title, employer - one result"],"voice":"one line on how they write: sentence length, person, tone",'+
      '"worked_out":["the keys above you inferred rather than read in the documents, e.g. timezone from the city"]}\n'+
      "roleShort, fieldTerm and timezone are always worked out: from the profession and the city.\n"+
      "spelling: US if they live in the US or the CV uses US spelling, else UK.\n\nCV:\n<<<\n"+cv+"\n>>>"+(suLetterText()? "\n\nCover letter:\n<<<\n"+suLetterText()+"\n>>>" : ""));
    var a={}; SU_ABOUT_F.forEach(function(f){ var v=j[f[0]]; a[f[0]]= Array.isArray(v)? v.join("\n") : String(v==null?"":v); });
    a.voice=String(j.voice||"");
    var wk=(Array.isArray(j.worked_out)? j.worked_out.map(String) : []).concat(SU_WORKED), src={};
    SU_ABOUT_F.forEach(function(f){ if(String(a[f[0]]||"").trim()) src[f[0]]= wk.indexOf(f[0])>=0? "worked" : "cv"; });
    if(!a.timezone){ try{ a.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||""; if(a.timezone) src.timezone="worked"; }catch(e){} }
    if(a.spelling!=="US") a.spelling="UK"; src.spelling="worked";
    var P=PROFILE||{}; SU_ABOUT_F.forEach(function(f){ if(!a[f[0]] && P[f[0]]){ a[f[0]]= Array.isArray(P[f[0]])? P[f[0]].join("\n") : String(P[f[0]]); src[f[0]]="board"; } });
    if(!a.linkedin && P.links && P.links.linkedin){ a.linkedin=String(P.links.linkedin); src.linkedin="board"; }
    a._src=src; a._prof0=a.profession;
    SU.draft.about=a; suKeepDrafts();
  }catch(e){ SU.err=rvErr(e); }
  SU.busy=""; suPaint();
}
async function suSaveAbout(){
  var a=SU.draft.about||{}, miss=SU_ABOUT_F.filter(function(f){ return f[2].req && !String(a[f[0]]||"").trim(); });
  if(miss.length){ SU.err="Fill in: "+miss.map(function(f){return f[1].toLowerCase();}).join(", ")+"."; suPaint(); return; }
  SU.busy="save"; suPaint();
  try{
    var before=await suDocNow("profile/me"), patch={};
    SU_ABOUT_F.forEach(function(f){ var v=String(a[f[0]]||"").trim(); patch[f[0]]= f[0]==="career"? v.split("\n").map(function(x){return x.trim();}).filter(Boolean) : v; });
    if(a.voice) patch.voice=a.voice;
    var li=String(patch.linkedin||"").trim(); delete patch.linkedin;
    if(li && !/^https?:\/\//i.test(li)) li="https://"+li.replace(/^\/+/,"");
    patch.links=Object.assign({}, (before&&before.links)||{}, {linkedin:li});
    if(!li) delete patch.links.linkedin;
    /* The short craft name and field word were worked out from the drafted profession: if it changed, let the board work them out again. */
    if(a._prof0!=null && String(a.profession||"").trim()!==String(a._prof0||"").trim()){ patch.roleShort=""; patch.fieldTerm= /product/i.test(a.profession||"")? "product" : ""; }
    patch.updatedAt=today();
    if(before) await DB.doc("profile/me").update(patch); else await DB.doc("profile/me").set(patch);
    await suLog("profile/me",before,"Setup: About you");
    suPaySites(patch.country);
    SU.busy=""; await suFinishStep("about");
  }catch(e){ SU.busy=""; SU.err="Couldn't save — "+((e&&e.code)||"try again")+"."; suPaint(); }
}
/* Country sets where pay estimates and interview reports come from. Quietly; the skills fall back if it fails. */
async function suPaySites(country){
  if(!country || !DB) return;
  try{
    var j=await suAsk("For a job seeker in "+country+", name the websites most used for (1) salary and pay data for professional jobs and (2) interview reports and company reviews. "+
      'Only well-known, real sites. JSON only: {"paySources":["up to 3 site names"],"interviewSources":["up to 3 site names"]}',"default");
    var S=await suDocNow("profile/settings")||{}, r=Object.assign({},S.research||{});
    if(Array.isArray(j.paySources) && j.paySources.length) r.paySources=j.paySources.slice(0,3).map(String);
    if(Array.isArray(j.interviewSources) && j.interviewSources.length) r.interviewSources=j.interviewSources.slice(0,3).map(String);
    await DB.doc("profile/settings").update({research:r});
    await suLog("profile/settings",S,"Setup: pay and interview sites for "+country);
  }catch(e){ console.warn("setup pay sites",e&&e.code); }
}

/* A step opened on a board that already has the facts starts from them, not from a blank draft. */
function suSeed(k){
  if(k==="about" && !SU.draft.about && PROFILE && String(PROFILE.name||"").trim()){ var a={};
    SU_ABOUT_F.forEach(function(f){ var v=PROFILE[f[0]]; a[f[0]]= Array.isArray(v)? v.join("\n") : String(v==null?"":v); }); a.voice=PROFILE.voice||""; a.linkedin=(PROFILE.links&&PROFILE.links.linkedin)||""; if(a.spelling!=="US") a.spelling="UK"; a._src={}; SU_ABOUT_F.forEach(function(f){ a._src[f[0]]="board"; }); SU.draft.about=a; }
  if(k==="skills" && !SU.draft.skills && SKILLS && (SKILLS.items||[]).length) SU.draft.skills={items:SKILLS.items.map(function(x){ return Object.assign({},x); }), left_out:(SKILLS.left_out||[]).slice()};
  if(k==="want" && !(SU.draft.want && SU.draft.want.criteria) && PREFS && ((PREFS.hardRules||[]).length || (PREFS.scored||[]).length)){
    var w=suWant(), F=PREFS, gl=(((SETTINGS||{}).roles||{}).endGloss)||{};
    w.criteria={hardRules:(F.hardRules||[]).map(function(h){ return {keep:true, id:h.id, name:h.name||"", rule:h.rule||"", type:h.type||"other", firm:h.firm||(RULE_TYPE_FIRM[h.type]||"tunable"), fires:h.fires||"Search", basis:h.basis||"role", check:h.check||"", floor:h.floor||null}; }),
      scored:(F.scored||[]).map(function(s){ return {keep:true, id:s.id, name:s.name||"", bands:s.bands||"", basis:s.basis||"role", stage:s.stage||"", type:s.type||""}; }),
      red:(F.red||[]).map(function(x){ return {keep:true, name:x.name||"", note:x.note||""}; }), upside:(F.upside||[]).map(function(x){ return {keep:true, name:x.name||"", note:x.note||""}; }),
      roleShape:(F.roleShape||[]).map(function(x){ return {keep:true, text:String(x)}; }), searchTerms:(F.searchTerms||[]).map(function(x){ return {keep:true, group:x.group||"", terms:x.terms||""}; }),
      reasons:suPersonalNow().map(function(x){ return {keep:true, name:x, gloss:gl[x]||""}; })};
    w.seeded=true;
  }
}

/* Skills */
SU_R.skills=function(){
  suSeed("skills"); var s=SU.draft.skills;
  if(!s) return SU.busy==="skills"? suBusyHtml("Claude is picking your top 20 skills from your CV…") :
    '<p class="sulede">Claude picks your top 20 skills, each with a line of proof from your CV. You fix the levels and the evidence.</p>'+suBtn("draft:skills","Draft my skills",true);
  var items=s.items||[];
  return '<p class="sulede">Strongest first. Expert: you could teach it. Strong: you do it well, often. Working: you can do it. Evidence is one line from your CV that proves it.</p>'+
    '<div class="suskills">'+items.map(function(it,i){
      return '<div class="suskill"><input data-suf="skills.items.'+i+'.name" value="'+esc(it.name||"")+'" aria-label="Skill">'+
        '<select data-suf="skills.items.'+i+'.level" aria-label="Level">'+["Expert","Strong","Working"].map(function(l){ return '<option'+(l===it.level?" selected":"")+'>'+l+'</option>'; }).join("")+'</select>'+
        '<input data-suf="skills.items.'+i+'.evidence" value="'+esc(it.evidence||"")+'" aria-label="Evidence" placeholder="One line of proof from your CV">'+
        '<button type="button" class="linkbtn danger" data-su="rmskill:'+i+'" aria-label="Remove">Remove</button></div>'; }).join("")+'</div>'+
    '<div class="row" style="margin-top:8px">'+suBtn("addskill","Add a skill")+'<button type="button" class="linkbtn" data-su="draft:skills">Redraft from my CV</button></div>'+
    ((s.left_out||[]).length? '<p class="lede" style="font-size:12.5px">Often asked for in your field, but not in your CV: '+esc(s.left_out.join(", "))+'. Add any you can back up.</p>' : "");
};
SU_MAIN.skills=function(){ return SU.draft.skills? suBtn("save:skills","Save and continue",true,SU.busy) : ""; };
async function suDraftSkills(){
  var cv=suCvText(); if(!cv){ SU.err="Upload your CV first (step 3)."; suPaint(); return; }
  SU.busy="skills"; SU.err=""; suPaint();
  try{
    var P=PROFILE||{};
    var j=await suAsk("From this CV, list the person's top 20 skills for the roles they want"+(P.headline? " ("+P.headline+")" : "")+". For each: name (2 to 4 words), group (a short category), "+
      "level (Expert, Strong or Working), evidence (one line from the CV that proves it, naming the employer), alsoEvidence (a second line, or \"\"). Strongest first. "+
      "Then left_out: up to 10 skills often asked for in this profession that the CV gives no evidence for.\nJSON only: "+
      '{"items":[{"name":"","group":"","level":"","evidence":"","alsoEvidence":""}],"left_out":[""]}\n\nCV:\n<<<\n'+cv+"\n>>>");
    var items=(j.items||[]).slice(0,25).map(function(x){ return {name:String(x.name||""), group:String(x.group||""), level:["Expert","Strong","Working"].indexOf(x.level)>=0? x.level : "Strong",
      evidence:String(x.evidence||""), alsoEvidence:String(x.alsoEvidence||"")}; });
    SU.draft.skills={items:items, left_out:(j.left_out||[]).map(String).slice(0,10)}; suKeepDrafts();
  }catch(e){ SU.err=rvErr(e); }
  SU.busy=""; suPaint();
}
async function suSaveSkills(){
  var s=SU.draft.skills||{}, items=(s.items||[]).filter(function(x){ return String(x.name||"").trim(); });
  if(!items.length){ SU.err="Add at least one skill."; suPaint(); return; }
  SU.busy="save"; suPaint();
  try{
    var before=await suDocNow("profile/skills");
    var doc={items:items.map(function(x,i){ return {id:"s"+("0"+(i+1)).slice(-2), name:String(x.name).trim(), group:x.group||"", level:x.level||"Strong", evidence:x.evidence||"", alsoEvidence:x.alsoEvidence||""}; }),
      left_out:s.left_out||[], note:(before&&before.note)||"", title:"Skills", updatedAt:today()};
    await DB.doc("profile/skills").set(doc);
    await suLog("profile/skills",before,"Setup: Skills");
    SU.busy=""; await suFinishStep("skills");
  }catch(e){ SU.busy=""; SU.err="Couldn't save — "+((e&&e.code)||"try again")+"."; suPaint(); }
}

/* What you want: a short conversation, then rows to keep or edit. */
function suWant(){ if(!SU.draft.want) SU.draft.want={chat:[], criteria:null}; return SU.draft.want; }
SU_R.want=function(){
  suSeed("want"); var w=suWant(), phase=SU.wantPhase || (w.criteria? "review" : "chat");
  if(SU.busy==="draft") return '<div class="suhand run">'+suBusyHtml("Claude is drafting your criteria from the conversation")+
    '<p>Deal-breakers, preferences, search terms and your own reasons for turning roles down. This usually takes under a minute; keep this open.</p></div>';
  if(SU.busy==="save") return suBusyHtml("Saving your criteria…");
  return phase==="review"? suWantReview(w) : suWantChat(w);
};
function suWantChat(w){
  var log=(w.chat||[]).map(function(m){ return '<div class="sumsg '+(m.role==="you"?"you":"cl")+'">'+esc(m.text)+'</div>'; }).join("");
  if(!w.chat.length && !SU.busy && !SU.chatTried){ SU.chatTried=true; setTimeout(function(){ if(SU.step==="want" && !suWant().chat.length && !SU.busy) suChat(""); },0); }
  return '<p class="sulede">A short conversation about what you want. Answer in your own words; Claude turns it into rows you can check. Say "skip" to anything you don\'t mind about.</p>'+
    '<div class="suchat" id="su-chat">'+log+(SU.busy==="chat"? '<div class="sumsg cl">'+suBusyHtml("Thinking…")+'</div>' : "")+'</div>'+
    '<div class="suchatin"><textarea id="su-chatin" rows="3" placeholder="Your answer. Ctrl/⌘ + Enter sends."'+(SU.busy?" disabled":"")+'></textarea>'+suBtn("chat","Send",false,SU.busy)+'</div>'+
    (!w.chat.length && !SU.busy? '<p>'+suBtn("chatstart","Start the conversation",true)+'</p>' : "")+
    (w.criteria? '<p class="lede" style="font-size:12.5px">Your conversation so far is kept. <b>Update my criteria</b> keeps your rows and your edits, and only changes what you add here. <button type="button" class="linkbtn" data-su="wantreview">Back to the drafted rows</button> · '+
      '<button type="button" class="linkbtn" data-su="wantfresh">'+(SU.freshArm? 'Click again to redraft every row from scratch: your edits will be lost' : 'Start again from scratch')+'</button></p>' : "");
}
SU_MAIN.want=function(){
  var w=suWant(), phase=SU.wantPhase || (w.criteria? "review" : "chat");
  if(phase==="review") return suBtn("wantchat","Add to the conversation")+suBtn("save:want","Save my criteria",true,SU.busy);
  var answered=(w.chat||[]).filter(function(m){return m.role==="you";}).length;
  if(SU.busy==="draft") return suBtn("draft:want","Drafting…",true,true);
  if(w.criteria) return suBtn("draft:want","Update my criteria",true, SU.busy || (w.chat||[]).length<=(w.draftN||0));
  return suBtn("draft:want",w.done? "Draft my criteria" : "Draft my criteria now",!!w.done || answered>=6, SU.busy || !answered);
};
function suWantContext(){
  return "Their profile:\n"+suProfileText()+(SU.draft.about && SU.draft.about.headline && !(PROFILE||{}).headline? "\nHeadline: "+SU.draft.about.headline : "")+
    "\n\nTheir CV starts:\n"+suCvText().slice(0,3000);
}
async function suChat(text){
  var w=suWant(); if(text) w.chat.push({role:"you", text:text});
  SU.busy="chat"; SU.err=""; suPaint(); suChatScroll();
  try{
    var cur=suCurrentCriteriaText();
    var j=await suAsk("You are helping someone set up their job search. In a short conversation, find out what they want from their next role, so a job sweep can screen roles for them. "+
      "Ask ONE short question at a time (one or two sentences), in plain everyday words: no business or recruiting jargon (say \"how big or established the company is: a startup, a growing company or a large established one\", not \"company stage\"), and give a short example whenever a term could be unclear. Cover, skipping anything their profile already answers: where they can work, always asked as what is IN, never as what to rule out (nobody can list every place they won't work): where they live and how far they'd travel to an office, how many office days they'd accept, and whether they'd work remotely and from where; then, as its own question, whether they'd relocate for the right role and, if so, where (named cities, anywhere in a country, e.g. \"anywhere in the US\", or other countries) and whether they'd need visa sponsorship there; "+
      "right to work; minimum pay (amount, currency, and whether that is total package or base salary); contract types they will take (permanent, fixed-term, contractor or freelance, part-time) and hours; "+
      "the level and job titles they want and don't want; sectors or kinds of company they won't work for, including on ethical grounds, and any named employers; what makes a role better or worse for them; "+
      "concerns; the shape of the role they want. About 8 to 12 questions in all; combine topics where natural. "+
      "Two kinds of limit, and say which you are asking about: a DEAL-BREAKER means the sweep screens the role out and they never see it (where they'll work, right to work, minimum pay, contract, titles and sectors they won't take); "+
      "a CONCERN is a warning only: the role still reaches them, flagged. Ask about deal-breakers first. When you ask about concerns, say in a few words that these roles still reach them with a warning, "+
      "and never ask again about something they've already given as a deal-breaker. If they repeat one, say it's already a deal-breaker and move on. Briefly acknowledge an answer before the next question. "+
      "When you have enough, say so in one sentence, tell them to press Draft my criteria, and set done to true.\n\n"+suWantContext()+(cur? "\n\nThey already have these criteria; ask what to change, add or drop:\n"+cur : "")+
      "\n\nThe conversation so far:\n"+(w.chat.length? w.chat.map(function(m){ return (m.role==="you"? "THEM: " : "YOU: ")+m.text; }).join("\n") : "(none yet: open with a one-line welcome and your first question)")+
      '\n\nReply with JSON only: {"say":"your next message","done":false}',"default");
    w.chat.push({role:"claude", text:String(j.say||"")}); w.done=!!j.done; suKeepDrafts();
  }catch(e){ SU.err=rvErr(e); if(text){ w.chat.pop(); var t=el("su-chatin"); SU.lastIn=text; } }
  SU.busy=""; suPaint(); suChatScroll();
  var ti=el("su-chatin"); if(ti){ if(SU.lastIn){ ti.value=SU.lastIn; SU.lastIn=""; } ti.focus(); }
}
function suChatScroll(){ var c=el("su-chat"); if(c) c.scrollTop=c.scrollHeight; }
function suCurrentCriteriaText(){
  var F=PREFS||{}; if(!(F.hardRules||[]).length && !(F.scored||[]).length) return "";
  return JSON.stringify({hardRules:(F.hardRules||[]).map(function(h){ return {id:h.id,name:h.name,rule:h.rule,type:h.type||"",firm:h.firm||"",fires:h.fires||"",basis:h.basis||"",check:h.check||"",floor:h.floor||null}; }),
    scored:(F.scored||[]).map(function(s){ return {id:s.id,name:s.name,bands:s.bands,basis:s.basis||"",stage:s.stage||"",type:s.type||""}; }),
    red:F.red||[], upside:F.upside||[], roleShape:F.roleShape||[], searchTerms:F.searchTerms||[]});
}
// Redrafting after Add to the conversation keeps the person's rows and edits (merge); fresh=true redrafts every row from the conversation.
function suWantRowsText(c){
  var out={}, off=[];
  SU_WANT_SECS.forEach(function(k){
    out[k]=(c[k]||[]).filter(function(x){ return x.keep!==false; }).map(function(x){ var o={}; Object.keys(x).forEach(function(f){ if(f!=="keep") o[f]=x[f]; }); return k==="roleShape"? o.text : o; });
    (c[k]||[]).forEach(function(x){ if(x.keep===false) off.push(x.name||x.text||x.terms||""); });
  });
  return {rows:JSON.stringify(out), off:off.filter(Boolean)};
}
var SU_WANT_SECS=["hardRules","scored","red","upside","roleShape","searchTerms","reasons"];
function suWantKeepOff(prev,next){
  SU_WANT_SECS.forEach(function(k){
    var have={}; (next[k]||[]).forEach(function(x){ have[String(x.name||x.text||x.terms||"").toLowerCase()]=1; });
    (prev[k]||[]).forEach(function(x){ if(x.keep===false && !have[String(x.name||x.text||x.terms||"").toLowerCase()]) (next[k]=next[k]||[]).push(x); });
  });
  return next;
}
async function suDraftWant(fresh){
  var w=suWant(); SU.busy="draft"; SU.err=""; SU.freshArm=false; suPaint();
  var merge=!!(w.criteria && !fresh), prev=w.criteria, since=merge? (w.draftN||0) : 0;
  try{
    var cur=suCurrentCriteriaText(), coreR=SU_CORE_ME.concat(END_CORE.me||[]), mine=merge? suWantRowsText(prev) : null;
    var j=await suAsk("Turn this job-search conversation into criteria a job sweep can apply.\n\n"+
      "hardRules are deal-breakers: a role that fails one is screened out. Each: name (2 to 4 words); rule (what's out, and what stays in, one or two sentences); "+
      "type, one of: "+RULE_TYPES.map(function(t){return t[0];}).join(", ")+"; firm: fixed (a fact of their life or the law: right to work, where they can live, how far they will travel), "+
      "firm (a strong preference: sectors refused, contract type, minimum pay) or tunable (open to evidence: titles, seniority words, company size, domains); "+
      "fires: \"Search\" when the job listing alone usually shows it (title, location, contract), \"Search, else Gate 2\" when it often needs the full ad or company research (office days, pay), \"Enrichment\" when only research shows it (company ethics, size); "+
      "basis: role or company; check: one line on how a sweep should check it (where to look, what counts). The pay rule has floor {amount: yearly number, currency: ISO code, basis: total or base} and its rule says roles that state no pay pass. "+
      "Other rules have floor null. One rule per idea; only what they actually said rules a role out.\n"+
      "WHERE THEY WORK is always ONE inclusion rule (name like \"Where I can work\", type location, basis role, firm fixed, fires \"Search, else Gate 2\"): it lists what passes and everything else is out, because nobody can list every city they won't work in. "+
      "Its rule says what passes, e.g. \"Fully remote from <their country>; any office pattern within about <their travel limit> of <their town>; elsewhere only <the most office days they'd accept, e.g. occasional travel>. Everything else is out.\" "+
      "Its check says how a sweep reads a listing: within range: name the towns and cities in reach of their home; any office days pass. "+
      "A named city or town outside that range that doesn't say remote counts as office-based and fails, unless the full ad shows remote from <their country> or office days within what they'd accept. "+
      "A country-wide location (just the country name) usually means remote: read the full ad; if it can't be read it passes as unknown. If the ad is silent on office days, the company's office days decide. "+
      "Fill in their own place, country and limits from the profile and conversation; if they'd take remote only, say so and nothing in an office passes. If they'd relocate, the places they'd move to pass too, at any office pattern: add them to the rule (e.g. \"; roles based in <the cities or countries they named> (would relocate)\") and to the check's list of places in range.\n"+
      "Right to work, when they mention it, is a separate rule; its check: a location naming only other countries or regions fails; \"Remote\" with no country needs the full ad read, and passes as unknown if it can't be.\n"+
      "scored are preferences that make a role better or worse without ruling it out: name, bands (\"x strong · y acceptable · z weak\"), basis role or company, stage longlist or shortlist (shortlist when it needs research), type (same list).\n"+
      "red: concerns {name, note}: warnings only, the role still reaches them. upside: pluses {name, note}. "+
      "Each idea appears once: never repeat a deal-breaker as a concern, preference or plus, even if they mentioned it twice. Write every note to the person (\"your gaming work\"), never \"he\" or \"his\". roleShape: short lines on the shape of role they want. "+
      "searchTerms: groups {group, terms (comma-separated)}: the job titles to search for, and domain words if they have a domain.\n"+
      "reasons: 3 to 5 personal reasons they might turn a role down, suggested by what they said, that the sweep can't check cleanly (judgement calls, not one per rule), each {name (2 to 5 words), gloss (what it means, one line)}. "+
      "Don't repeat these standard ones: "+coreR.join(", ")+".\n"+
      (suPersonalNow().length? "Their current personal reasons, keep those still relevant: "+suPersonalNow().join(", ")+".\n" : "")+
      (merge? "\nTHEY ALREADY HAVE A DRAFT they have checked and edited (below, JSON by section). Return EVERY row of it word for word, with its id, unless something they said after the line \"--- NEW SINCE THE LAST DRAFT ---\" changes it. "+
        "Change only the rows that new part affects, add rows only for new ideas in it, and remove a row only if they ask. Their wording wins over yours.\n"+mine.rows+"\n"+
        (mine.off.length? "They turned these down; leave them out unless the new part asks for them: "+mine.off.join("; ")+".\n" : "")
      : (cur? "\nTheir current criteria are below, with ids. Keep the id on a row you keep or change; leave id empty on a new row; leave out rows they no longer want.\n"+cur+"\n" : ""))+
      "\n"+suWantContext()+"\n\nThe conversation:\n"+(w.chat||[]).map(function(m,i){ return (merge && i===since? "--- NEW SINCE THE LAST DRAFT ---\n" : "")+(m.role==="you"? "THEM: " : "YOU: ")+m.text; }).join("\n")+
      '\n\nReply with JSON only: {"hardRules":[{"id":"","name":"","rule":"","type":"","firm":"","fires":"","basis":"","check":"","floor":null}],"scored":[{"id":"","name":"","bands":"","basis":"","stage":"","type":""}],'+
      '"red":[{"name":"","note":""}],"upside":[{"name":"","note":""}],"roleShape":[""],"searchTerms":[{"group":"","terms":""}],"reasons":[{"name":"","gloss":""}]}');
    var nc=suCleanCriteria(j); w.criteria=merge? suWantKeepOff(prev,nc) : nc; w.draftN=(w.chat||[]).length; SU.wantPhase="review"; suKeepDrafts();
    if(merge) toast("Updated. Your other rows and edits are kept");
  }catch(e){ SU.err=rvErr(e); }
  SU.busy=""; suPaint();
}
function suPersonalNow(){ var me=(((SETTINGS||{}).roles||{}).endReasons||{}).me||[]; return me.filter(function(x){ return SU_CORE_ME.indexOf(x)<0 && (END_CORE.me||[]).indexOf(x)<0; }); }
function suCleanCriteria(j){
  var types=RULE_TYPES.map(function(t){return t[0];});
  function str(x){ return String(x==null?"":x).trim(); }
  return {
    hardRules:(j.hardRules||[]).map(function(h){ var t=types.indexOf(h.type)>=0? h.type : "other";
      var f=h.floor && +h.floor.amount? {amount:Math.round(+h.floor.amount), currency:str(h.floor.currency).toUpperCase().slice(0,3)||"GBP", basis:h.floor.basis==="base"? "base" : "total"} : null;
      return {keep:true, id:str(h.id), name:str(h.name), rule:str(h.rule), type:t, firm:["fixed","firm","tunable"].indexOf(h.firm)>=0? h.firm : (RULE_TYPE_FIRM[t]||"tunable"),
        fires:RULE_FIRES.indexOf(h.fires)>=0? h.fires : "Search", basis:h.basis==="company"? "company" : "role", check:str(h.check), floor:t==="pay"? f : null}; }).filter(function(h){return h.name;}),
    scored:(j.scored||[]).map(function(s){ return {keep:true, id:str(s.id), name:str(s.name), bands:str(s.bands), basis:s.basis==="company"? "company" : "role", stage:s.stage==="shortlist"? "shortlist" : "", type:types.indexOf(s.type)>=0? s.type : ""}; }).filter(function(s){return s.name;}),
    red:(j.red||[]).map(function(x){ return {keep:true, name:str(x.name), note:str(x.note)}; }).filter(function(x){return x.name;}),
    upside:(j.upside||[]).map(function(x){ return {keep:true, name:str(x.name), note:str(x.note)}; }).filter(function(x){return x.name;}),
    roleShape:(j.roleShape||[]).map(function(x){ return {keep:true, text:str(x)}; }).filter(function(x){return x.text;}),
    searchTerms:(j.searchTerms||[]).map(function(x){ return {keep:true, group:str(x.group), terms:str(x.terms)}; }).filter(function(x){return x.terms;}),
    reasons:(j.reasons||[]).map(function(x){ return {keep:true, name:str(x.name), gloss:str(x.gloss)}; }).filter(function(x){return x.name;}).slice(0,6)
  };
}
function suWantReview(w){
  var c=w.criteria||{};
  function keep(path,on){ return '<label class="sukeep"><input type="checkbox" data-suf="'+path+'.keep"'+(on!==false?" checked":"")+'> Keep</label>'; }
  function sec(title,lede,rows,add){ return '<div class="susec"><h4>'+esc(title)+'</h4>'+(lede? '<p class="lede">'+esc(lede)+'</p>' : "")+(rows||'<p class="lede">None.</p>')+(add? '<button type="button" class="linkbtn" data-su="addrow:'+add+'">Add one</button>' : "")+'</div>'; }
  var P="want.criteria.";
  var hard=(c.hardRules||[]).map(function(h,i){ var p=P+"hardRules."+i;
    return '<div class="surow'+(h.keep===false?" off":"")+'"><div class="surowh">'+keep(p,h.keep)+'<input class="sunm" data-suf="'+p+'.name" value="'+esc(h.name)+'" aria-label="Name">'+
      '<select data-suf="'+p+'.type" data-surepaint="1" aria-label="Type">'+RULE_TYPES.map(function(t){ return '<option value="'+t[0]+'"'+(t[0]===h.type?" selected":"")+'>'+esc(t[1])+'</option>'; }).join("")+'</select>'+
      '<select data-suf="'+p+'.firm" aria-label="How firm" title="Fixed: never suggested for loosening. Firm: only questioned if your spot-checks show it cutting roles you wanted. Tunable: open to change.">'+["fixed","firm","tunable"].map(function(k){ return '<option value="'+k+'"'+(k===h.firm?" selected":"")+'>'+RULE_FIRM_LAB[k]+'</option>'; }).join("")+'</select></div>'+
      '<textarea data-suf="'+p+'.rule" rows="2" aria-label="The rule">'+esc(h.rule)+'</textarea>'+
      (h.type==="pay"? '<div class="sufloor"><label>Minimum, yearly<input data-suf="'+p+'.floor.amount" inputmode="numeric" value="'+esc(h.floor? h.floor.amount : "")+'"></label>'+
        '<label>Currency<input data-suf="'+p+'.floor.currency" maxlength="3" value="'+esc(h.floor? h.floor.currency : "")+'"></label>'+
        '<label>Counts<select data-suf="'+p+'.floor.basis"><option value="total"'+(!h.floor||h.floor.basis!=="base"?" selected":"")+'>Total package</option><option value="base"'+(h.floor&&h.floor.basis==="base"?" selected":"")+'>Base salary</option></select></label></div>' : "")+
      (h.check? '<small class="ruhelp">How the sweep checks it: '+esc(h.check)+'</small>' : "")+'</div>'; }).join("");
  var scored=(c.scored||[]).map(function(s,i){ var p=P+"scored."+i;
    return '<div class="surow'+(s.keep===false?" off":"")+'"><div class="surowh">'+keep(p,s.keep)+'<input class="sunm" data-suf="'+p+'.name" value="'+esc(s.name)+'" aria-label="Name"></div>'+
      '<input data-suf="'+p+'.bands" value="'+esc(s.bands)+'" aria-label="What counts as strong, acceptable, weak"></div>'; }).join("");
  function pair(arr,key,a,b,ph){ return (arr||[]).map(function(x,i){ var p=P+key+"."+i;
    return '<div class="surow sm'+(x.keep===false?" off":"")+'"><div class="surowh">'+keep(p,x.keep)+'<input class="sunm" data-suf="'+p+'.'+a+'" value="'+esc(x[a])+'">'+
      '<input data-suf="'+p+'.'+b+'" value="'+esc(x[b])+'" placeholder="'+esc(ph||"")+'"></div></div>'; }).join(""); }
  var shape=(c.roleShape||[]).map(function(x,i){ var p=P+"roleShape."+i; return '<div class="surow sm'+(x.keep===false?" off":"")+'"><div class="surowh">'+keep(p,x.keep)+'<input class="sunm" data-suf="'+p+'.text" value="'+esc(x.text)+'"></div></div>'; }).join("");
  return '<p class="sulede">'+(w.seeded && !w.chat.length? 'These are your current criteria. Edit them here, or press Add to the conversation to change them with Claude. Untick anything you no longer want' : 'Here\'s what Claude drafted. Untick anything wrong')+', edit the wording, and check how firm each deal-breaker is. You can change all of it later in About me › My criteria.</p>'+
    sec("Deal-breakers","Screened out: a role that fails one never reaches you.",'<div class="sulegend"><p><b>What it\'s about</b> (Pay, Location…) tells the board which kind of rule it is.</p>'+
      '<p><b>How firm</b> decides whether the board will ever suggest loosening it: <b>Fixed</b>, a fact of your life or the law, never suggested; '+
      '<b>Firm</b>, a strong preference, only questioned if your own spot-checks show it cutting roles you wanted; <b>Tunable</b>, open to change when the numbers point that way.</p></div>'+hard,"hardRules")+
    sec("Preferences","Make a role better or worse without ruling it out.",scored,"scored")+
    sec("Search terms","The titles and words the sweep searches for.",pair(c.searchTerms,"searchTerms","group","terms","comma-separated"),"searchTerms")+
    sec("Shape of the role",null,shape,"roleShape")+
    sec("Concerns","Warnings only: the role still reaches you, flagged. Don't repeat a deal-breaker here.",pair(c.red,"red","name","note","note"),"red")+
    sec("Pluses","Make a role more attractive; never rule one out.",pair(c.upside,"upside","name","note","note"),"upside")+
    sec("Your own reasons for turning a role down","Offered alongside the standard ones ("+SU_CORE_ME.slice(0,-1).join(", ")+") whenever you reject a role.",pair(c.reasons,"reasons","name","gloss","what it means"),"reasons");
}
function suAddRow(key){
  var c=suWant().criteria; if(!c) return;
  var blank={hardRules:{keep:true,id:"",name:"",rule:"",type:"other",firm:"tunable",fires:"Search",basis:"role",check:"",floor:null}, scored:{keep:true,id:"",name:"",bands:"",basis:"role",stage:"",type:""},
    red:{keep:true,name:"",note:""}, upside:{keep:true,name:"",note:""}, roleShape:{keep:true,text:""}, searchTerms:{keep:true,group:"",terms:""}, reasons:{keep:true,name:"",gloss:""}}[key];
  if(!blank) return; (c[key]=c[key]||[]).push(blank); suPaint();
}
async function suSaveWant(){
  var c=suWant().criteria; if(!c) return;
  function kept(a){ return (a||[]).filter(function(x){ return x.keep!==false; }); }
  var hard=kept(c.hardRules).filter(function(h){return String(h.name).trim() && String(h.rule).trim();});
  var payBad=hard.find(function(h){ return h.type==="pay" && !(h.floor && +h.floor.amount); });
  if(payBad){ SU.err="Give the minimum pay on “"+payBad.name+"” as a yearly number, or change its type."; suPaint(); return; }
  SU.busy="save"; suPaint();
  try{
    var before=await suDocNow("profile/prefs"), F=before||{}, oldH=F.hardRules||[], oldS=F.scored||[];
    function nextId(pref,olds,news){ var n=0; olds.concat(news).forEach(function(x){ var m=String(x.id||"").match(new RegExp("^"+pref+"(\\d+)$")); if(m) n=Math.max(n,+m[1]); }); return function(){ n++; return pref+n; }; }
    var hNew=[], gid=nextId("G",oldH,hard);
    hard.forEach(function(h){ var o=oldH.find(function(x){return x.id===h.id;});
      var r=Object.assign({}, o||{}, {id:o? h.id : gid(), name:h.name.trim(), rule:h.rule.trim(), type:h.type, firm:h.firm, fires:h.fires, basis:h.basis, check:h.check||""});
      if(h.type==="pay") r.floor={amount:Math.round(+h.floor.amount), currency:String(h.floor.currency||"").toUpperCase().slice(0,3), basis:h.floor.basis==="base"? "base" : "total"}; else delete r.floor;
      hNew.push(r); });
    var sk=kept(c.scored).filter(function(s){return String(s.name).trim();}), sid=nextId("S",oldS,sk), sNew=[];
    sk.forEach(function(s){ var o=oldS.find(function(x){return x.id===s.id;});
      var r=Object.assign({}, o||{}, {id:o? s.id : sid(), name:s.name.trim(), bands:s.bands, basis:s.basis||"role"}); if(s.stage) r.stage=s.stage; else delete r.stage; if(s.type) r.type=s.type; sNew.push(r); });
    var gone=oldH.filter(function(o){ return !hNew.some(function(x){return x.id===o.id;}); }).concat(oldS.filter(function(o){ return !sNew.some(function(x){return x.id===o.id;}); }));
    var retired=(F.retiredRules||[]).concat(gone.map(function(g){ return {id:g.id, name:g.name}; }));
    var patch={hardRules:hNew, scored:sNew, retiredRules:retired,
      red:kept(c.red).filter(function(x){return x.name;}).map(function(x){return {name:x.name, note:x.note||""};}),
      upside:kept(c.upside).filter(function(x){return x.name;}).map(function(x){return {name:x.name, note:x.note||""};}),
      roleShape:kept(c.roleShape).map(function(x){return String(x.text||"").trim();}).filter(Boolean),
      searchTerms:kept(c.searchTerms).filter(function(x){return x.terms;}).map(function(x){return {group:x.group||"Search terms", terms:x.terms};}),
      updatedAt:today()};
    if(before) await DB.doc("profile/prefs").update(patch); else await DB.doc("profile/prefs").set(patch);
    await suLog("profile/prefs",before,"Setup: What you want");
    /* Personal turn-down reasons go in front of the standard ones. */
    var reasons=kept(c.reasons).filter(function(x){return x.name;});
    var S=await suDocNow("profile/settings")||{}, R=Object.assign({}, S.roles||{}), er=Object.assign({}, R.endReasons||{}), gl=Object.assign({}, R.endGloss||{});
    var std=SU_CORE_ME.concat((END_CORE.me||[]).filter(function(x){ return SU_CORE_ME.indexOf(x)<0; })).filter(function(x){ return x!=="Other"; });
    er.me=reasons.map(function(x){return x.name;}).concat(std.filter(function(x){ return !reasons.some(function(r){return r.name===x;}); })).concat(["Other"]);
    reasons.forEach(function(x){ if(x.gloss) gl[x.name]=x.gloss; });
    R.endReasons=er; R.endGloss=gl;
    await DB.doc("profile/settings").update({roles:R});
    await suLog("profile/settings",S,"Setup: your reasons for turning roles down");
    SU.busy=""; await suFinishStep("want");
  }catch(e){ console.warn(e); SU.busy=""; SU.err="Couldn't save — "+((e&&e.code)||"try again")+"."; suPaint(); }
}

/* Companies: Claude works out sectors, then proposes and researches companies (handoff); you rate every one here. */
function suCos(){ return companies.filter(function(c){ return !coOff(c); }); }
function suUnrated(){ return suCos().filter(function(c){ return coRating(c)==="unrated"; }); }
var SU_TAG_ALERT="Claude can't read this company's own jobs page automatically (it needs a login or blocks automated reading), so its roles reach you through a LinkedIn job alert for the company instead. Step 10, Job alerts, sets that up with you, for companies you rate Want it or Would consider.";
var SU_TAG_NONE="Claude hasn't looked for this company's jobs page yet. If it's still unchecked when this step is done, the morning run looks for it, for companies you rate Want it or Would consider.";
var SU_TAG_MISS="Claude's research didn't settle whether this company's jobs page can be read. The morning run looks again for companies you rate Want it or Would consider.";
function suHandDone(k){ var h=suHand(k); return !!(h && h.status==="done"); }
var SU_TAG_FOUND="Claude found this company's own jobs page and the sweep can read it directly, as often as your rating says.";
var SU_RATE_HELP='<div class="sulegend surates"><p><b>How ratings work.</b> You give every company one rating. It says how much you want it, and decides whether the sweep reads the company\'s own jobs page:</p><ul>'+
  '<li><b>Want it</b>: a company you\'d move for. Its jobs page is read <b>every sweep</b>.</li>'+
  '<li><b>Would consider</b>: worth a look if the role fits. Its jobs page is read <b>once a week</b>.</li>'+
  '<li><b>If it appears</b>: unlikely, but don\'t rule it out. Its jobs page is <b>never read</b>; its roles still reach you through job alerts and the sweep\'s searches.</li>'+
  '<li><b>Ruled out</b>: never, whatever the role. Its roles are <b>dropped from every source</b>; you give a reason.</li></ul>'+
  '<p>Claude suggests a rating for each, with why; nothing is saved as yours until you choose. You can change any rating later in Targets › Companies. '+
  'Rate the ones you know and move on whenever you like: unrated companies are treated like If it appears until you rate them.</p>'+
  '<p><b>What the tags mean.</b> <b>Jobs page found</b>: the sweep can read the company\'s own jobs page. <b>Needs a LinkedIn alert</b>: it can\'t (the page needs a login or blocks automated reading), '+
  'so that company\'s roles reach you through a LinkedIn job alert instead. You don\'t need to do anything now: step 10, Job alerts, sets those up with you, for the companies you rate Want it or Would consider. '+
  '<b>Not checked yet</b> / <b>Jobs page not found yet</b>: no answer yet on its jobs page; the morning run looks again for the ones you rate Want it or Would consider.</p></div>';
SU_R.companies=function(){ return suHandHtml("companies")+SU_RATE_HELP+'<div id="su-list">'+suCoList()+'</div>'; };
function suCoList(){
  var cos=companies.slice().sort(function(a,b){ var o={unrated:0,high:1,medium:2,low:3,off:4}; return (o[coRating(a)]-o[coRating(b)]) || String(a.name||"").localeCompare(String(b.name||"")); });
  var un=suUnrated().length, secs=(typeof sectors!=="undefined"? sectors : []);
  var add='<div class="suadd"><label class="fld suwide">Add your own companies — one per line, or separated by commas<textarea id="su-addcos" rows="2" placeholder="e.g. Acme, Brightwell"></textarea></label>'+suBtn("addcos","Add them")+'</div>';
  var secHtml= secs.length? '<p class="sulooked"><b>Claude looked in:</b> '+esc(secs.map(function(x){ return x.name||x.id; }).join(", "))+'. You can rate sectors later on Targets › Sectors; nothing here depends on it.</p>' : "";
  if(!cos.length) return secHtml+add+'<p class="lede">No companies yet. They appear here as Claude adds them, or add your own.</p>';
  return secHtml+'<div class="susec"><h4>Companies <span class="cfmeta">'+cos.length+(un? " · "+un+" to rate" : " · all rated")+'</span></h4>'+
    '<p class="lede">Pick a rating for each company, or press Claude\'s suggestion to accept it. Any order is fine, and you can rate while Claude is still working. '+
    '<b>Remove</b> takes a company off your list (with Undo); to have its roles actively dropped, rate it Ruled out instead.</p>'+

    '<div class="sucos">'+cos.map(function(c){ var pv=coRating(c), sg=c.setupSuggest||null;
      var sel='<select class="prisel p-'+esc(pv)+'" data-act="co_pri" data-id="'+esc(c.id)+'" aria-label="Rating">'+RATE_ORDER.map(function(k){ return '<option value="'+k+'"'+(pv===k?" selected":"")+'>'+esc(PRILABEL[k])+'</option>'; }).join("")+'</select>';
      var sl=PRILABEL[sg&&sg.rating]||(sg&&sg.rating==="off"? "Ruled out" : (sg&&sg.rating)||"");
      var sug= sg && sg.rating && pv==="unrated"? '<small>Claude suggests <b>'+esc(sl)+'</b>'+(sg.why? ": "+esc(sg.why) : "")+' <button type="button" class="btn sm" data-su="userate:'+esc(c.id)+'">Rate it '+esc(sl)+'</button></small>'
        : (c.watchWhy && pv!=="unrated"? "" : (sg&&sg.why? '<small>'+esc(sg.why)+'</small>' : ""));
      var tag= c.boardNeedsAlert || c.boardAts==="linkedin-alert"? '<span class="susrc s-worked" title="'+esc(SU_TAG_ALERT)+'">Needs a LinkedIn alert</span>' : (c.boardUrl? '<span class="susrc s-cv" title="'+esc(SU_TAG_FOUND)+'">Jobs page found</span>' : (suHandDone("companies")? '<span class="susrc" title="'+esc(SU_TAG_MISS)+'">Jobs page not found yet</span>' : '<span class="susrc" title="'+esc(SU_TAG_NONE)+'">Not checked yet</span>'));
      return '<div class="suco'+(pv==="unrated"?" un":"")+'"><b class="suco-n">'+esc(c.name||c.id)+'</b>'+(tag? '<span class="suco-t">'+tag+'</span>' : "")+'<span class="suco-r">'+sel+'<button type="button" class="linkbtn danger" data-su="rmco:'+esc(c.id)+'" title="Take it off your list">Remove</button></span>'+sug+'</div>'; }).join("")+'</div>'+
    (un? '<div class="row suall"><span>Rate all '+un+' remaining as</span><select id="su-rateall">'+[["low","If it appears"],["medium","Would consider"],["high","Want it"]].map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join("")+'</select>'+
      '<button type="button" class="btn sm" data-su="rateall">Rate them</button></div>' : "")+'</div>'+add;
}
SU_MAIN.companies=function(){ var un=suUnrated().length, n=suCos().length;
  return (un? '<span class="sufootnote">'+un+' still unrated: treated like If it appears until you rate them</span>' : "")+suBtn("next:companies","Continue",true,false); };
async function suAddCos(){
  var t=(el("su-addcos")||{}).value||""; var names=t.split(/[\n,]+/).map(function(x){return x.trim();}).filter(Boolean);
  if(!names.length || !DB) return; var n=0;
  for(var i=0;i<names.length;i++){ var nm=names[i], id=slug(nm);
    if(companies.some(function(c){ return c.id===id || String(c.name||"").toLowerCase()===nm.toLowerCase(); })) continue;
    try{ await DB.doc("companies/"+id).set({name:nm, priority:"unrated", listing:"target", watch:false, createdVia:"setup", addedAt:today(), notes:[], red:[], green:[], questions:[]}); n++; }catch(e){}
  }
  toast(n? n+(n===1?" company":" companies")+" added. Claude researches them on its next run." : "Already on the list");
}
/* A source the person adds: into the channel for how it's read (made if missing), on Trial. */
async function suAddSrc(){
  var nm=((el("su-srcname")||{}).value||"").trim(), url=((el("su-srcurl")||{}).value||"").trim(), rd=(el("su-srcread")||{}).value||"manual";
  if(!nm){ toast("Give it a name",true); return; } if(!DB) return;
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;
  var CH={read:{id:"boards", name:"Public boards", kind:"auto", how:"Public job sites, fetched directly. No account needed."},
    alerts:{id:"alerts", name:"Alert emails", kind:"auto", how:"Job-alert emails under the Gmail label in Settings (alerts.gmailLabel), everything since the last run."},
    manual:{id:"manual", name:"Sites I check", kind:"manual", how:"Job sites you check yourself."}}[rd];
  var ch=(channels||[]).find(function(c){ return c.id===CH.id; }) || (rd==="manual"? (channels||[]).find(function(c){return c.kind==="manual";}) :
    (channels||[]).find(function(c){ return c.kind==="auto" && (rd==="alerts"? /alert/i.test(c.name||c.id) : !/alert/i.test(c.name||c.id)); }));
  try{
    if(!ch){ await DB.doc("channels/"+CH.id).set({name:CH.name, kind:CH.kind, how:CH.how, cadence:"", order:(channels||[]).length+1, status:"active", why:"", createdAt:today(), createdVia:"setup"}); ch={id:CH.id}; }
    var id=slug(nm); if((srcs||[]).some(function(s){return s.id===id;})) id=id+"-"+Date.now().toString(36).slice(-3);
    await DB.doc("sources/"+id).set({name:nm, url:url, channelId:ch.id, status:"trial", why:"Added by you in setup", note:"", order:(srcs||[]).length+1,
      setup:{read:rd, why:"Added by you"}, createdVia:"setup", addedAt:today()});
    toast(nm+" added, on Trial");
    ["su-srcname","su-srcurl"].forEach(function(x){ var i=el(x); if(i) i.value=""; });
  }catch(e){ toast("Couldn't add it — try again",true); }
}
async function suRmCo(btn,id){
  if(btn.dataset.armed!=="1"){ btn.dataset.armed="1"; btn.textContent="Click again to remove"; return; }
  var c=companies.find(function(x){return x.id===id;}); if(!c || !DB) return;
  var before=Object.assign({},c); delete before.id;
  try{ await DB.doc("companies/"+id).delete(); toastUndo((c.name||id)+" removed",function(){ DB.doc("companies/"+id).set(before); }); }
  catch(e){ toast("Couldn't remove — try again",true); }
}
async function suRateAll(btn){
  if(btn.dataset.armed!=="1"){ btn.dataset.armed="1"; btn.textContent="Click again to rate "+suUnrated().length+" companies"; return; }
  var v=(el("su-rateall")||{}).value||"low", list=suUnrated();
  for(var i=0;i<list.length;i++){ try{ await DB.doc("companies/"+list[i].id).update({priority:v, watch:rateWatch(v)}); }catch(e){} }
  toast("Rated "+list.length);
}

/* Where roles come from: Claude recommends and adds sources as Trial; you choose Active, Trial or Not now. */
var SU_SRC_HELP='<div class="sulegend"><p><b>What the choices mean.</b></p><ul>'+
  '<li><b>Active</b>: you know it\'s worth it. The sweep reads it every run (or, for a site you check by hand, it\'s on your list of sites to check).</li>'+
  '<li><b>Trial</b>: read exactly the same way, but marked as being tried out. Insights and Search review watch whether it finds roles you keep, and suggest dropping it if not. The safe choice for anything new.</li>'+
  '<li><b>Not now</b>: not read or checked at all. You can switch it on later in Sourcing.</li></ul>'+
  '<p><b>The labels.</b> <b>Read automatically</b>: the sweep reads the site itself. <b>Needs alert emails</b>: the site needs a login or blocks automated reading, so the sweep reads its job-alert emails instead; step 10 sets those alerts up. <b>You check it by hand</b>: no alerts and can\'t be read, so it goes on your own list.</p></div>';
SU_R.sources=function(){ return suHandHtml("sources")+SU_SRC_HELP+'<div id="su-list">'+suSrcList()+'</div>'+suUnnamedHtml(); };
/* Recruiter adverts that don't name the employer: saved straight to profile/settings roles.unnamedEmployerAdverts. */
function suUnnamedHtml(){
  var v=((SETTINGS||{}).roles||{}).unnamedEmployerAdverts||"include";
  return '<div class="susec"><h4>Recruiter adverts that don\'t name the employer</h4><p class="lede">Recruiters often advertise a role without saying who it\'s for ("a leading fintech"). Keep them and they reach your Longlist marked Employer not named, with a reminder to ask the recruiter; your company rules can\'t be checked on them. Or leave them out.</p>'+
    '<label class="fld" style="max-width:340px"><select data-su-unnamed="1">'+[["include","Keep them, marked Employer not named"],["skip","Leave them out"]].map(function(o){ return '<option value="'+o[0]+'"'+(v===o[0]?" selected":"")+'>'+o[1]+'</option>'; }).join("")+'</select></label></div>';
}
document.addEventListener("change",async function(ev){
  var f=ev.target.closest && ev.target.closest("#su-dialog [data-su-unnamed]"); if(!f || !DB) return;
  try{ var S=await suDocNow("profile/settings")||{}, R=Object.assign({},S.roles||{}, {unnamedEmployerAdverts:f.value==="skip"? "skip" : "include"});
    await DB.doc("profile/settings").update({roles:R}); await suLog("profile/settings",S,"Setup: recruiter adverts"); toast("Saved"); }
  catch(e){ toast("Couldn't save — try again",true); }
});
function suSrcList(){
  var list=(srcs||[]).filter(function(s){ return !String(s.id||"").startsWith("co:"); });
  var add='<div class="susec"><h4>Add a source Claude missed</h4><div class="suaddsrc">'+
    '<label class="fld">Name<input id="su-srcname" placeholder="e.g. a job board you use"></label>'+
    '<label class="fld">Link<input id="su-srcurl" placeholder="https://…"></label>'+
    '<label class="fld">How it\'s read<select id="su-srcread"><option value="read">The sweep reads it</option><option value="alerts">Through its alert emails</option><option value="manual">I check it myself</option></select></label>'+
    suBtn("addsrc","Add it")+'</div><p class="lede" style="font-size:12px;margin:0">Not sure how it\'s read? Pick I check it myself; the test sweep in the next step shows whether the sweep can read it. It goes in as Trial.</p></div>';
  if(!list.length) return '<p class="lede">Sources appear here as Claude adds them.</p>'+add;
  var LAB={read:"Read automatically", alerts:"Needs alert emails", manual:"You check it by hand"};
  var byCh={}; list.forEach(function(s){ (byCh[s.channelId||""]=byCh[s.channelId||""]||[]).push(s); });
  return Object.keys(byCh).map(function(cid){ var ch=(channels||[]).find(function(c){return c.id===cid;})||{name:cid||"Other"};
    var why= cid==="careers"? "Searches the sweep runs across companies' own job systems, to find companies not on your list." :
      cid==="recruiters"? "Recruitment agencies' job pages; the sweep reads them where the site allows." :
      ch.kind==="manual"? "The sweep can't read these and they don't send usable alerts, so you check them yourself. Step 11 puts a repeating reminder in Week ahead."
      : /alert/i.test((ch.name||"")+" "+cid)? "The sweep reads their job-alert emails. Step 10 sets the alerts up." : "The sweep reads these sites itself, every run.";
    return '<div class="susec"><h4>'+esc(ch.name||cid)+'</h4><p class="lede">'+esc(why)+'</p><div class="sucos">'+byCh[cid].map(function(s){ var lab=(s.setup&&LAB[s.setup.read])||(ch.kind==="manual"? LAB.manual : "");
      return '<div class="suco"><b>'+esc(s.name||s.id)+'</b><select data-su-src="'+esc(s.id)+'" aria-label="Status">'+[["active","Active"],["trial","Trial"],["dropped","Not now"]].map(function(o){ return '<option value="'+o[0]+'"'+((s.status||"trial")===o[0]?" selected":"")+'>'+o[1]+'</option>'; }).join("")+'</select>'+
        '<small>'+esc([lab, s.why||(s.setup&&s.setup.why)||""].filter(Boolean).join(" · "))+'</small></div>'; }).join("")+'</div></div>'; }).join("")+add;
}
document.addEventListener("change",function(ev){
  var s=ev.target.closest && ev.target.closest("[data-su-src]"); if(!s || !DB) return;
  DB.doc("sources/"+s.dataset.suSrc).update({status:s.value}).then(function(){ toast("Saved"); }).catch(function(){ toast("Couldn't save — try again",true); });
});
SU_MAIN.sources=function(){ var h=suHand("sources"), n=(srcs||[]).filter(function(s){ return !String(s.id||"").startsWith("co:"); }).length;
  return suBtn("next:sources","Continue",true,!n && !(h && h.status==="done")); };

/* Test sweep */
SU_R.testsweep=function(){
  var h=suHand("testsweep");
  return '<p class="sulede">One sweep now, on everything it can read, so you can see whether your deal-breakers and sources find the right roles. '+
    'Recommended. If you skip it, your first scheduled sweep does the same job, and you can come back to Job alerts after it.</p>'+suHandHtml("testsweep")+
    (h && h.status==="done"? '<div class="sunow"><b>What to do now</b><ol>'+
      '<li>Look over the <a href="#" data-gotab="gate1" data-su-close="1">Longlist</a>. Are these the kind of roles you want? You don\'t need to work through them today.</li>'+
      '<li>Check what each rule cut under <a href="#" data-gotab="routine" data-su-close="1">Sourcing › Auto sweep</a>.</li>'+
      '<li>If roles got through that shouldn\'t, or a rule cut ones you\'d want, change the rule in About me › My criteria.</li>'+
      '<li>Then press Continue.</li></ol></div>' : "");
};
SU_MAIN.testsweep=function(){ var h=suHand("testsweep"); return suBtn("next:testsweep","Continue",true,!(h && h.status==="done")); };

/* Job alerts: a checklist of the sites to sign up to (ticks kept on profile/onboarding alertsReady),
   then the handoff; the skill writes each site's progress to h_alerts.sites [{id,name,status,note}]. */
var SU_ASTAT={working:["Claude is on it",""], done:["Created, waiting for first email",""], live:["Working: alert emails arriving","s-cv"], late:["No alert email yet","s-worked"], had:["Already arriving","s-cv"], signin:["Needs you to sign in","s-worked"], failed:["Not possible","s-worked"], planned:["Planned (test only)",""]};
/* A created alert only counts as working once the sweep has read an email from it (setup.firstAlertAt). */
function suAlertSt(x,p){
  if(!p) return null; if(p.status!=="done") return p.status;
  var src=(srcs||[]).find(function(s){ return s.id===x.id || (x.id==="linkedin" && /linkedin/i.test((s.id||"")+" "+(s.name||""))); });
  var as=src && typeof srcAlertStage==="function"? srcAlertStage(src) : null;
  return as? (as.k==="ok"? "live" : as.k==="late"? "late" : "done") : "done";
}
function suAlertSites(){
  var nCo=(companies||[]).filter(function(c){ return (c.boardNeedsAlert || c.boardAts==="linkedin-alert") && (c.priority==="high"||c.priority==="medium"); }).length;
  var li={id:"linkedin", name:"LinkedIn", url:"https://www.linkedin.com/jobs/", why:"Job alerts for your search terms"+(nCo? ", plus "+nCo+" company alert"+(nCo===1?"":"s") : "")+". Usually your biggest source."};
  var list=[li];
  (srcs||[]).forEach(function(x){
    if(/linkedin/i.test((x.id||"")+" "+(x.name||""))){ return; }
    if(x.status==="dropped" || String(x.id||"").startsWith("co:")) return;
    var rd=(x.setup||{}).read; if(rd!=="alerts" && x.channelId!=="alerts") return;
    list.push({id:x.id, name:x.name||x.id, url:x.url||"", why:"Saved searches for your search terms."});
  });
  return list;
}
function suAlertProg(){ var h=suHand("alerts"), m={}; ((h&&h.sites)||[]).forEach(function(x){ if(x&&x.id) m[x.id]=x; if(x&&x.name) m["n:"+String(x.name).toLowerCase()]=x; }); return m; }
function suAlertReady(){ return (SU.doc && SU.doc.alertsReady)||{}; }
function suAlertsAllReady(){ var r=suAlertReady(); return suIsTest() || (SU.doc && SU.doc.alertsGoAhead) || suAlertSites().every(function(x){ return r[x.id]; }); }
function suAlertList(){
  var sites=suAlertSites(), r=suAlertReady(), pg=suAlertProg(), test=suIsTest();
  var nReady=sites.filter(function(x){ return r[x.id]; }).length;
  return '<div class="susec"><h4>1. Sign up to each site</h4>'+
    '<div class="sulegend"><ul>'+
      '<li>Use the <b>Gmail address connected to Claude</b>: alerts go there, and the sweep reads them from there.</li>'+
      '<li>Sign in using the <b>Chrome that Claude in Chrome runs in</b>, and tick <b>Keep me signed in</b> where the site offers it.</li>'+
      '<li>Leave Chrome open while Claude works. Claude never creates accounts or types passwords.</li>'+
      (test? '<li>This is a test board, so it\'s a dry run: you don\'t need to sign up. Claude only lists what it would set up.</li>' : "")+
    '</ul></div>'+
    '<div class="sualerts">'+sites.map(function(x){
      var p=pg[x.id]||pg["n:"+x.name.toLowerCase()], st=p&&SU_ASTAT[suAlertSt(x,p)];
      var tag= st? '<span class="susrc '+st[1]+'">'+esc(st[0])+'</span>' : "";
      return '<div class="sualert'+(r[x.id]?" ok":"")+'"><label class="sukeep"><input type="checkbox" data-su="aready:'+esc(x.id)+'"'+(r[x.id]?" checked":"")+'> <span>Signed up and signed in</span></label>'+
        '<div class="sualert-n"><b>'+esc(x.name)+'</b>'+(x.url? ' <a href="'+esc(x.url)+'" target="_blank" rel="noopener">Open</a>' : "")+'<small>'+esc(x.why)+'</small>'+
        (p&&p.note? '<small class="sualert-note">'+esc(p.note)+'</small>' : "")+'</div>'+tag+'</div>'; }).join("")+'</div>'+
    '<p class="lede" style="font-size:12.5px;margin:0">'+nReady+' of '+sites.length+' ready.'+
      (!test && nReady<sites.length && !(SU.doc&&SU.doc.alertsGoAhead)? ' <button type="button" class="linkbtn" data-su="agoahead">Go ahead without the rest</button> (Claude marks them Needs you to sign in)' : "")+'</p></div>';
}
SU_R.alerts=function(){
  var noG=SU.doc && SU.doc.noGmail, h=suHand("alerts"), q=suReq("alerts"), started=h||q;
  if(noG) return '<p class="sulede">Some job sites need a login or block automated reading, so the sweep reads their job-alert emails instead.</p>'+
    '<div class="notice warn">You said you don\'t use Gmail with Claude. Without it the sweep can\'t read alert emails, so sites like these become ones you check by hand. Connect Gmail later and come back to this step.</div>';
  var need=(suAlertSites().filter(function(x){ var p=suAlertProg()[x.id]; return p && (p.status==="signin"); }));
  var gate= started || suAlertsAllReady(), hasTags=!!(h && (h.sites||[]).length);
  return '<p class="sulede">Some job sites need a login or block automated reading, so the sweep reads their job-alert emails instead. You sign up to each site here first; then Claude creates the alerts in your browser and a Gmail filter that files them under your job-alerts label. Each site stays on Trial until its first alert arrives.</p>'+
    suAlertList()+
    '<div class="susec"><h4>2. Hand it to Claude</h4>'+
    (gate? suHandBox("alerts") : '<div class="suhand"><p>Tick each site once you\'re signed up and signed in, or go ahead without the rest. Then the request is ready to copy.</p></div>')+
    (h && h.status==="done" && need.length? '<div class="sunow"><b>'+need.length+(need.length===1?' site still needs you':' sites still need you')+'</b><ol><li>Sign in to '+esc(need.map(function(x){return x.name;}).join(", "))+' in Chrome.</li><li>'+suBtn("copyrest","Copy the request for just those",true)+'</li></ol></div>'
      : h && h.status==="done"? (suIsTest()? '<div class="sunow"><b>What to do now</b><ol><li>'+(hasTags? 'Read the tags on each site above: that\'s what Claude would set up on a real board.' : 'Read the Complete box above, and Claude\'s last message in the chat for the full list: that\'s what Claude would set up on a real board.')+' Nothing was created.</li><li>Then press Continue.</li></ol></div>'
      : '<div class="sunow"><b>What to do now</b><ol><li>'+(hasTags? 'Check the sites above: each should say Created, waiting for first email, or Already arriving.' : 'Check the Complete box above, and Claude\'s last message in the chat, for anything it couldn\'t set up.')+'</li><li>Look in Gmail: the alert emails will start arriving under your '+esc(((SETTINGS||{}).alerts||{}).gmailLabel||"job-alerts")+' label over the next day or two, not in your inbox. As each site\'s first email lands, its tag here and in Sourcing changes to Working. If one hasn\'t arrived after a week, Data health tells you.</li><li>Then press Continue.</li></ol></div>') : "")+
    '</div>'+
    '<p class="lede" style="font-size:12.5px"><button type="button" class="linkbtn" data-su="nogmail">I don\'t have Gmail connected to Claude</button></p>';
};
SU_MAIN.alerts=function(){ var h=suHand("alerts"); return suBtn("next:alerts","Continue",true,!(h && h.status==="done") && !(SU.doc&&SU.doc.noGmail)); };

/* Your rhythm */
var SU_DOW=[["0","Sun"],["1","Mon"],["2","Tue"],["3","Wed"],["4","Thu"],["5","Fri"],["6","Sat"]];
var SU_TASKS=[["llreview","Longlist review","the day after each sweep"],["slreview","Shortlist review","two days after each sweep"],["manual","Check the sites you search yourself","Mondays"],
  ["insights","Review Insights","Fridays"],["review","Search review","the 1st of each month"]];
function suRhythm(){
  if(!SU.draft.rhythm){ var T=TG(), r=(SU.doc&&SU.doc.rhythm)||{};
    SU.draft.rhythm=Object.assign({liveMin:String(T.band[0]), liveMax:String(T.band[1]), sweepDays:{"0":true,"3":true}, sweepModel:"sonnet", sweepTime:"17:45", morning:"07:00", checkDay:"1", checkTime:"07:20",
      tasks:{llreview:true, slreview:true, manual:true, insights:true, review:true}}, r); }
  return SU.draft.rhythm;
}
function suRhythmText(r){
  var days=SU_DOW.filter(function(d){ return r.sweepDays && r.sweepDays[d[0]]; }).map(function(d){return d[1];});
  var tz=(PROFILE&&PROFILE.timezone)||"";
  return "the sweep on "+(days.join(" and ")||"Sunday and Wednesday")+" at "+(r.sweepTime||"17:45")+"; the morning run daily, part 1 at "+(r.morning||"07:00")+" and part 2 45 minutes later; "+
    "the screen-out check on "+((SU_DOW.find(function(d){return d[0]===String(r.checkDay);})||[0,"Mon"])[1])+"days at "+(r.checkTime||"07:20")+(tz? "; time zone "+tz : "");
}
/* Times in 15-minute steps; a saved time off the grid stays in the list. */
function suTimes(cur){ var o=[]; for(var m=0;m<1440;m+=15){ var t=("0"+Math.floor(m/60)).slice(-2)+":"+("0"+m%60).slice(-2); o.push([t,t]); }
  cur=String(cur||""); if(/^\d{2}:\d{2}$/.test(cur) && !o.some(function(x){ return x[0]===cur; })){ o.push([cur,cur]); o.sort(function(a,b){ return a[0]<b[0]? -1 : 1; }); } return o; }
SU_R.rhythm=function(){
  var r=suRhythm(), saved=!!(SU.doc && SU.doc.rhythm);
  function run(title,what,fields){ return '<div class="surun"><h5>'+esc(title)+'</h5><p>'+what+'</p>'+(fields? '<div class="surun-f">'+fields+'</div>' : "")+'</div>'; }
  return '<h3 class="supart">Part 1 · Choose, then Save</h3>'+
    '<div class="susec"><h4>Your goal</h4><p class="lede">How many live applications you want at once. A <b>live application</b> is a role at Applied or Offer: you\'ve sent it and it hasn\'t ended yet, so you\'re waiting to hear, in interviews, or holding an offer. Roles you\'re still deciding on, or that ended, don\'t count. '+
      'Highlights tell you when you\'re above or below your goal. The other targets start at sensible values; change them any time in My criteria › My targets.</p>'+
    '<div class="sugrid narrow">'+suIn("rhythm.liveMin","At least",{num:1})+suIn("rhythm.liveMax","At most",{num:1})+'</div></div>'+
    '<div class="susec"><h4>Scheduled runs</h4><p class="lede">Three jobs Claude runs for you on a timetable, each as a scheduled task in your Claude account. You set the times here; you can change them later in Claude\'s scheduled tasks.</p>'+
      run("1. The sweep",'Reads your job-alert emails, the job sites and your companies\' jobs pages, screens every role against your deal-breakers, and puts the rest on your Longlist. '+
        '<b>It\'s the heaviest run and uses a good share of your Claude plan\'s usage</b>, so start with two a week; add a day later if you want more roles and have usage to spare. An evening suits most people, so the Longlist is ready in the morning.',
        '<div class="sudays"><span>Days</span>'+SU_DOW.map(function(d){ return '<label><input type="checkbox" data-suf="rhythm.sweepDays.'+d[0]+'"'+(r.sweepDays&&r.sweepDays[d[0]]?" checked":"")+'> '+d[1]+'</label>'; }).join("")+'</div>'+
        '<div class="sugrid narrow">'+suIn("rhythm.sweepTime","Time",{sel:suTimes(r.sweepTime)})+suIn("rhythm.sweepModel","Model",{sel:[["sonnet","Sonnet (recommended)"],["same","Same as my other tasks"]]})+'</div>'+
        '<p class="suhint" style="margin:0">Sonnet makes the same screening calls almost every time and uses much less of your allowance. The weekly screen-out check, on your main model, catches what it misses.</p>')+
      run("2. The morning run",'Every morning, in two parts 45 minutes apart: checks the roles on your board are still open and researches new Longlist roles; then researches Shortlist roles, drafts CVs and cover letters for roles at To apply, and preps your interviews. Lighter than a sweep: most days there\'s little to do.',
        '<div class="sugrid narrow">'+suIn("rhythm.morning","Starts at",{sel:suTimes(r.morning)})+'</div>')+
      run("3. The screen-out check",'Once a week. The sweep rules out roles that fail your deal-breakers before you see them, so a rule that\'s too strict, or a misread ad, can hide a role you\'d want without you knowing. '+
        'This picks a few of the week\'s screen-outs most likely to be wrong, plus one at random, re-reads each ad, and asks you whether it should have reached you. Your answers show whether a rule needs changing.',
        '<div class="sugrid narrow">'+suIn("rhythm.checkDay","Day",{sel:SU_DOW})+suIn("rhythm.checkTime","Time",{sel:suTimes(r.checkTime)})+'</div>')+
      '</div>'+
    '<div class="susec"><h4>Repeating tasks</h4><p class="lede">Reminders that show in Week ahead on their days. Untick any you don\'t want; you can change their days or remove them later in Week ahead.</p>'+
      SU_TASKS.map(function(t){ return '<label class="sutask"><input type="checkbox" data-suf="rhythm.tasks.'+t[0]+'"'+(r.tasks&&r.tasks[t[0]]?" checked":"")+'> <b>'+esc(t[1])+'</b> <span>'+esc(t[2])+'</span></label>'; }).join("")+'</div>'+
    (saved? '<p class="lede" style="font-size:12.5px;margin:0">Saved: your goal and repeating tasks are on the board. Changed something? Press Save changes, then copy the request again so Claude updates the scheduled tasks.</p>' : '<p class="lede" style="font-size:12.5px;margin:0">Save creates your repeating tasks in Week ahead and keeps these times for part 2.</p>')+
    '<h3 class="supart">Part 2 · Create the scheduled tasks in Claude</h3>'+suSchedPart(saved);
};
/* The four scheduled tasks, prompts and all. One source: saved to profile/onboarding schedTasks on Save, read by
   next-role-setup when it creates them, and shown here for people who set them up themselves. The run records
   (`taskruns`, and the extra fields on the sweep's `runs` doc) are what Data health reads to spot a task that
   failed or didn't run, so they must stay in the prompts. */
function suSchedTasks(r){
  var url=(SETTINGS&&SETTINGS.board&&SETTINGS.board.url)||"<your board link>", tz=(PROFILE&&PROFILE.timezone)||"your time zone";
  var days=SU_DOW.filter(function(d){ return r.sweepDays && r.sweepDays[d[0]]; }).map(function(d){ return d[1]; });
  var mo=String(r.morning||"07:00"), m2=(function(){ var x=mo.split(":"), t=(+x[0])*60+(+x[1]||0)+45; return ("0"+Math.floor(t/60)%24).slice(-2)+":"+("0"+t%60).slice(-2); })();
  var cd=(SU_DOW.find(function(d){ return d[0]===String(r.checkDay); })||[0,"Mon"])[1];
  var board="Board: "+url+" — read and write it with the ArtifactData tool (load it with ToolSearch \"select:ArtifactData\" if needed).";
  var rec=function(types,what){ return "Run record (the board's Data health uses these to spot a task that failed, didn't run, or keeps running out of room): after each skill, write one doc to collection `taskruns`, doc id `<YYYY-MM-DD>-<type>` with type "+types+", fields: `type`, `date` (today, "+tz+"), `at` (ISO timestamp), `model` (the model ID this session runs on), `status` (`ok`, `partial` if it finished only part of its work, `failed` if it couldn't run), `capped` (true if it stopped early because of a limit in `profile/settings` or time), `cappedNote` (what was left undone, when capped), `left` (a number: how many items it left undone — "+what+" — when capped; 0 otherwise), `note` (one short line, only when partial or failed). Write it even on a quiet morning with nothing to do (status `ok`, `left: 0`). If a skill can't run at all, still write its record with status `failed` and the reason in `note`, then carry on with the next skill."; };
  return [
    {name:"Next Role sweep", model:(r.sweepModel!=="same"? "sonnet" : ""), when:(days.join(" and ")||"Sun and Wed")+" at "+(r.sweepTime||"17:45")+" ("+tz+")", connectors:"Gmail",
     prompt:"Run the job sweep with the `next-role-sweep` skill, following it exactly. Its limits come from the board's `profile/settings`.\n\n"+board+" Load the Gmail tools with ToolSearch if they aren't loaded.\n\n"+
       "On the run doc the skill writes to `runs`, also make sure of these (the board's Data health reads them): `model` (the model ID this session runs on); `sources` has an entry for every source the sweep tried, each with `id`, `name`, `found` (a number, 0 when none) and `status` (`ok`, `empty`, `blocked` or `error`, with a short `note` when not ok; an error reading Gmail is `error` on each alert source); set `capped: true` with a one-line `cappedNote` when the run stopped before checking everything because of a limit in `profile/settings` or time, otherwise `capped: false`; and `left` (a number: how many sources and company boards it didn't reach when capped; 0 otherwise).\n\nFinish with the report the skill describes."},
    {name:"Next Role morning, part 1", when:"daily at "+mo+" ("+tz+")", connectors:"none",
     prompt:"Daily Next Role morning run, part 1 (upkeep). Part 2 (shortlist, apply packs, interview prep) runs later as its own scheduled task.\n\n"+board+" Files in the board's file store are read with the Artifact tool. No browser is available.\n\n"+
       "Run these skills in order, each followed exactly:\n1. `next-role-daily-check`\n2. `next-role-longlist-research`\n\n"+rec("`daily-check` or `longlist-research`","companies, roles")+"\n\n"+
       "Then keep the skills list in step: compare the `next-role-*` skills available in this session (names and descriptions) with board doc `refs/skills`. If a skill is missing, a listed skill no longer exists, or a description has changed, update that entry (`name`, `trigger`, `does`, `reads`, `writes`, from the skill's own instructions) and `updatedAt`, pinned with `if_version`. Nothing different → write nothing.\n\n"+
       "A quiet morning (nothing to do anywhere) writes only the run records and sends no report. Otherwise finish with one short report made of each skill's own report section, only for what was done."},
    {name:"Next Role morning, part 2", when:"daily at "+m2+" ("+tz+")", connectors:"none",
     prompt:"Daily Next Role morning run, part 2 (research and writing). Part 1 (daily check and longlist research) runs earlier as its own scheduled task.\n\n"+board+" Files in the board's file store are read with the Artifact tool. No browser is available.\n\n"+
       "Run these skills in order, each followed exactly:\n1. `next-role-shortlist`\n2. `next-role-apply-pack`\n3. `next-role-interview-prep`\n\n"+rec("`shortlist`, `apply-pack` or `interview-prep`","companies, roles, packs")+"\n\n"+
       "A quiet morning (nothing to do anywhere) writes only the run records and sends no report. Otherwise finish with one short report made of each skill's own report section, only for what was done."},
    {name:"Next Role screen-out check", when:cd+"days at "+(r.checkTime||"07:20")+" ("+tz+")", connectors:"none",
     prompt:"Run the weekly screen-out check with the `next-role-sweep-check` skill, following it exactly. Its limits come from the board's `profile/settings` (`sweepCheck`).\n\n"+board+" No browser is available; read job ads with WebFetch.\n\n"+
       "If the `next-role-sweep-check` skill isn't available in this session, write nothing except the run record below, and report that in one line.\n\n"+
       "Run record (the board's Data health uses it to spot a check that failed, didn't run, or keeps running out of room): at the end, write one doc to collection `taskruns`, doc id `<YYYY-MM-DD>-sweep-check`, fields `type: \"sweep-check\"`, `date` (today, "+tz+"), `at` (ISO timestamp), `model` (the model ID this session runs on), `status` (`ok`, `partial` or `failed`), `capped` (true if it stopped early because of `sweepCheck.maxPostings` or time), `cappedNote` when capped, `left` (a number: how many picks it didn't check when capped; 0 otherwise), and `note` (one short line, only when partial or failed). Write it on a week with nothing to check too (status `ok`, `left: 0`).\n\n"+
       "Finish with the short report the skill describes. A week with nothing to check writes only the run record and needs no report beyond that one line."}
  ];
}
function suSchedDone(){ var h=suHand("schedule"); return !!((h && h.status==="done" && !suAutoNeed().length) || (SU.doc && SU.doc.schedSelf)); }
/* Tasks Claude created that still ask for approval on every run (the skill writes h_schedule.tasks [{name, auto}]). */
function suAutoNeed(){ var h=suHand("schedule"); if(!h || h.status!=="done" || suIsTest() || (SU.doc && SU.doc.schedAutoOk)) return []; return (h.tasks||[]).filter(function(t){ return t && (t.auto===false || suModelOff(t)); }); }
/* The sweep should be on Sonnet (if chosen) but the skill couldn't set it. */
function suModelOff(t){ var r=(SU.doc&&SU.doc.rhythm)||{}; return /sweep/i.test(t.name||"") && r.sweepModel!=="same" && t.model!=null && !/sonnet/i.test(String(t.model)); }
function suAutoHtml(){
  var need=suAutoNeed(); if(!need.length) return "";
  var ap=need.filter(function(t){ return t.auto===false; }), md=need.filter(suModelOff);
  return '<div class="notice warn suauto"><b>One more thing, now, in Claude\'s Scheduled tasks</b><ol>'+
    (ap.length? '<li>Turn on <b>Automatically approve</b> in the settings of: '+esc(ap.map(function(t){ return t.name; }).join(", "))+'. Without it, '+(ap.length===1? "it stops and waits" : "they stop and wait")+' for you on every run. If your organisation doesn\'t allow it, you\'ll be asked each time a run needs you.</li>' : "")+
    (md.length? '<li>Change the model of <b>'+esc(md[0].name)+'</b> to <b>Sonnet</b> in its settings. Claude couldn\'t change it, and on '+esc(String(md[0].model||"another model"))+' each sweep uses much more of your allowance.</li>' : "")+
    '</ol><p>It takes a minute, once, and then they run on their own.</p>'+suBtn("autook","I've done this",true)+'</div>';
}
function suSchedPart(saved){
  if(!saved) return '<div class="suhand wait"><p>Save part 1 first. Then the request for Claude appears here, with your times in it.</p></div>';
  if(SU.doc && SU.doc.schedSelf && !(suHand("schedule")||{}).status){
    var T=(SU.doc.schedTasks&&SU.doc.schedTasks.length)? SU.doc.schedTasks : suSchedTasks(SU.doc.rhythm||{});
    return '<div class="sunote"><b>You\'re setting them up yourself</b><p>In Claude, open Scheduled tasks and create these four, each with its prompt copied exactly (the run records in them are what Data health reads). Connect Gmail on the sweep only, and turn on <b>Automatically approve</b> in each task\'s settings, or every run stops and waits for you.</p>'+
      T.map(function(t,n){ return '<div class="suself"><b>'+(n+1)+'. '+esc(t.name)+'</b> <span>'+esc(t.when)+(t.connectors==="Gmail"? " · connect Gmail" : "")+(t.model==="sonnet"? " · set its model to Sonnet" : "")+'</span>'+
        '<textarea class="sureq" readonly rows="5" id="su-tp-'+n+'">'+esc(t.prompt)+'</textarea><button type="button" class="btn sm" data-su="copytp:'+n+'">Copy prompt</button></div>'; }).join("")+
      '<small><button type="button" class="linkbtn" data-su="schedclaude">Have Claude do it instead</button></small></div>';
  }
  return '<p class="lede" style="margin:0">Scheduled tasks live in your Claude account, not on the board, so Claude creates them from a request you paste into a chat.</p>'+suHandHtml("schedule")+suAutoHtml()+
    (!suSchedDone() && !((suHand("schedule")||{}).status==="done")? '<p class="lede" style="font-size:12.5px;margin:0"><button type="button" class="linkbtn" data-su="schedself">I\'ll set them up myself</button></p>' : "");
}
SU_MAIN.rhythm=function(){ var saved=!!(SU.doc && SU.doc.rhythm);
  return saved? (!suSchedDone()? '<span class="sufootnote">'+(suAutoNeed().length? "Continue opens once you\'ve done the one more thing" : "Continue opens once the scheduled tasks exist")+'</span>' : "")+suBtn("save:rhythm","Save changes")+suBtn("next:rhythm","Continue",true,!suSchedDone()) : suBtn("save:rhythm","Save",true,SU.busy); };
async function suSaveRhythm(){
  var r=suRhythm(), lo=parseInt(r.liveMin,10), hi=parseInt(r.liveMax,10);
  if(!(lo>=1 && hi>=lo)){ SU.err="Give your live-applications goal as two numbers, the second at least the first."; suPaint(); return; }
  if(!SU_DOW.some(function(d){ return r.sweepDays && r.sweepDays[d[0]]; })){ SU.err="Pick at least one sweep day."; suPaint(); return; }
  if(![r.sweepTime,r.morning,r.checkTime].every(function(t){ return /^\d{1,2}:\d{2}$/.test(String(t||"").trim()); })){ SU.err="Write the times as hh:mm, e.g. 07:00."; suPaint(); return; }
  SU.busy="save"; suPaint();
  try{
    var P=await suDocNow("profile/prefs")||{}, T=TG(), tb=Object.assign({band:T.band, floor:T.floor, ivRate:T.ivRate, wait:T.wait, stretchMax:T.stretchMax}, P.targets||{}, {band:[lo,hi], setAt:today()});
    await DB.doc("profile/prefs").update({targets:tb}); await suLog("profile/prefs",P,"Setup: live applications goal");
    var S=await suDocNow("profile/settings")||{}, SW=Object.assign({},S.sweep||{}, {modelWanted:r.sweepModel!=="same"? "sonnet" : ""});
    if((S.sweep||{}).modelWanted!==SW.modelWanted){ await DB.doc("profile/settings").update({sweep:SW}); await suLog("profile/settings",S,"Setup: sweep model"); }
    var ids=await suMakeTasks(r);
    await suSave({rhythm:JSON.parse(JSON.stringify(r)), rhythmTasks:ids, schedTasks:suSchedTasks(r)});
    SU.busy=""; suPaint(); toast("Saved. Now part 2: create the scheduled tasks in Claude");
  }catch(e){ console.warn(e); SU.busy=""; SU.err="Couldn't save — "+((e&&e.code)||"try again")+"."; suPaint(); }
}
/* Repeating tasks: made once; a re-save adds the ones newly ticked and removes the ones unticked. */
async function suMakeTasks(r){
  var have=(SU.doc && SU.doc.rhythmTasks)||[], out=[];
  var sweep=SU_DOW.filter(function(d){ return r.sweepDays && r.sweepDays[d[0]]; }).map(function(d){ return +d[0]; });
  var spec={llreview:{title:"Longlist review", detail:"Press Mass review on the Longlist: score Fun and Shot, then send on or reject.", days:sweep.map(function(d){return (d+1)%7;})},
    slreview:{title:"Shortlist review", detail:"Read the research on the Shortlist and decide: apply, park or reject.", days:sweep.map(function(d){return (d+2)%7;})},
    manual:{title:"Check the sites I search myself", detail:"The sites under Sourcing › Manual. Add what you find with + New › Add roles; found nothing? Log it with Nothing new.", days:[1]},
    insights:{title:"Review Insights", detail:"Go to Insights and work through this week's Highlights. Each one points to a change that helps Next Role find you better roles: act on it, monitor it, or mark it handled.", days:[5]},
    review:{title:"Search review", detail:"Open Search review and talk through where the search is stuck.", month:1}};
  for(var i=0;i<SU_TASKS.length;i++){ var k=SU_TASKS[i][0], id="setup-"+k, on=!!(r.tasks&&r.tasks[k]), s=spec[k];
    if(on){
      var doc={item:"task", type:"othertask", kind:"own", court:"me", title:s.title, detail:s.detail, forKind:"none", forId:"", roleId:"", tagRoles:[], personIds:[], person:"", org:"",
        state:"recurring", date:"", time:"", duration:"", repeatEvery:s.month? "month" : "week", repeatDays:s.month? [] : Array.from(new Set(s.days)).sort(), repeatDate:s.month||"",
        startsOn:today(), endsOn:"", createdAt:today(), createdVia:"setup"};
      if(have.indexOf(id)>=0){ try{ await DB.doc("commitments/"+id).update({repeatDays:doc.repeatDays, repeatEvery:doc.repeatEvery, repeatDate:doc.repeatDate}); }catch(e){ await DB.doc("commitments/"+id).set(doc); } }
      else await DB.doc("commitments/"+id).set(doc);
      out.push(id);
    } else if(have.indexOf(id)>=0){ try{ await DB.doc("commitments/"+id).delete(); }catch(e){} }
  }
  return out;
}

/* Done */
/* Done: the week as the person set it up (from the saved rhythm), then the other features, each a link. */
var SU_FEATS=[["week","Week ahead","Plan your time: meetings, tasks and your repeating reminders, day by day."],
  ["pipeline","Insights","Where roles drop out, which sources work, and this week's Highlights."],
  ["review","Search review","Automated advice on adjusting your search: talk through where it's stuck and get suggested changes to your rules, sources and search terms."],
  ["warm","Warm routes","Find people who can help you into a company, from your LinkedIn connections."],
  ["compare","Compare","Compare up to three roles side by side."],
  ["mock","Mock interview","Practise a round for a role you've applied to, and get feedback."],
  ["targets","Targets","The companies and sectors you want, and how often the sweep checks each company."],
  ["people","People","Recruiters, referrers, contacts and interviewers in one place."],
  ["routine","Sourcing","Where roles come from: what the sweep reads and what you check yourself."],
  ["health","Data health","Spots missing dates and links and runs that failed; fixes many in one click, or hands them to Claude."],
  ["about","About me","Your profile, skills and criteria. Change a deal-breaker any time."]];
function suNextDay(days,time){ /* the next day (0–6) in days whose time hasn't passed yet today */
  var now=new Date(), hm=String(time||"00:00").split(":"), mins=(+hm[0])*60+(+hm[1]||0), nowM=now.getHours()*60+now.getMinutes();
  for(var k=0;k<8;k++){ var d=(now.getDay()+k)%7; if(days.indexOf(d)>=0 && (k>0 || mins>nowM)) return k; } return -1; }
function suDayWord(k,d){ return k===0? "today" : k===1? "tomorrow" : "on "+["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d]; }
SU_R.done=function(){
  var r=(SU.doc&&SU.doc.rhythm)||suRhythm(), sd=SU_DOW.filter(function(d){ return r.sweepDays && r.sweepDays[d[0]]; });
  var nums=sd.map(function(d){ return +d[0]; }), n=sd.length, often= n===1? "Once a week" : n===2? "Twice a week" : n===7? "Every day" : n+" times a week";
  var when=often+" ("+sd.map(function(d){ return d[1]; }).join(", ")+" at "+(r.sweepTime||"17:45")+")";
  var L=[["Sweep",when+", Claude reads your alerts, job sites and companies' jobs pages, screens every role against your deal-breakers and puts the rest on the Longlist.","Nothing: it runs on its schedule."],
    ["Longlist","Each new role gets a rough Role Fit and its deal-breaker results.","Mass review the day after "+(n===1? "the sweep" : "each sweep")+": score Fun and Shot, send on or reject. About a minute a role."],
    ["Shortlist","Every morning at "+(r.morning||"07:00")+", Claude researches the role and the company.","Read it and decide: apply, park or reject."],
    ["To apply","Claude drafts a tailored CV and cover letter as tracked changes.","Make them yours, send them, upload the finals and mark Applied."],
    ["Applied","Screen prep within a day; prep for each next round; mock interviews and cheat sheets when you ask.","Add each interview, log every conversation, practise before a round."],
    ["Insights","Highlights show where roles drop out and which sources work.","When the search stalls, open Search review and change what isn't working."]];
  var all=[0,1,2,3,4,5,6], km=suNextDay(all,r.morning), ks=suNextDay(nums,r.sweepTime), now=new Date();
  var nxt= !suIsTest() && ((SU.doc && (suHand("schedule")||{}).status==="done") || (SU.doc && SU.doc.schedSelf))?
      '<b>What happens next:</b> the first morning run is '+suDayWord(km,(now.getDay()+km)%7)+' at '+esc(r.morning||"07:00")+', and the first sweep '+(ks>=0? suDayWord(ks,(now.getDay()+ks)%7) : "on its first day")+' at '+esc(r.sweepTime||"17:45")+'. '
      : '<b>What happens next:</b> once your scheduled tasks exist (step 11, part 2), the morning run comes every day at '+esc(r.morning||"07:00")+' and the sweep '+esc(when.charAt(0).toLowerCase()+when.slice(1))+'. ';
  return '<p class="sulede">That\'s it. Here\'s how a week runs from now on.</p><ol class="suloop">'+L.map(function(x){ return '<li><b>'+esc(x[0])+'</b><span><i>Claude:</i> '+esc(x[1])+'</span><span><i>You:</i> '+esc(x[2])+'</span></li>'; }).join("")+'</ol>'+
    '<p class="sulede">'+nxt+'Check the Longlist after the first sweep, and Overview each morning: it shows what\'s waiting on you. If a run is missed, Overview and Data health say so.</p>'+
    '<div class="susec"><h4>Other features</h4><div class="sufeats">'+SU_FEATS.map(function(f){ return '<a href="#" class="sufeat" data-gotab="'+f[0]+'" data-su-close="1"><b>'+esc(f[1])+'</b><span>'+esc(f[2])+'</span></a>'; }).join("")+'</div>'+
    '<p class="lede" style="font-size:12.5px;margin:0">Also: <b>+ New › Add roles</b> to paste links to roles you find yourself, and <b>Run now</b> on any stage to have Claude do it straight away. How to use has the full guide.</p></div>';
};
SU_MAIN.done=function(){ return suDone()? suBtn("close","Close",true) : suBtn("finish","Finish setup",true); };

/* ---------- clicks ---------- */
document.addEventListener("click",function(ev){
  var c=ev.target.closest && ev.target.closest("[data-su-close]"); if(c){ suClose(); return; }
  var r=ev.target.closest && ev.target.closest("[data-su-open]"); if(r){ ev.preventDefault(); suOpen(r.dataset.suOpen||null, r.dataset.suRedo==="1"); return; }
  var b=ev.target.closest && ev.target.closest("#su-dialog [data-su]"); if(!b) return;
  ev.preventDefault();
  var a=String(b.dataset.su), arg=a.indexOf(":")>=0? a.slice(a.indexOf(":")+1) : "", act=arg? a.slice(0,a.indexOf(":")) : a;
  if(act==="go"){ suGo(arg); return; }
  if(act==="later"){ suClose(); toast("Saved. Carry on any time from Resume setup"); return; }
  if(act==="close"){ suClose(); return; }
  if(act==="next"){ suFinishStep(arg); return; }
  if(act==="skip"){ suFinishStep(arg,"skipped"); return; }
  if(act==="cvpaste"){ var t=((el("su-cvpaste")||{}).value||"").trim(); if(t.length<200){ toast("That looks too short for a CV",true); return; } suSave({cvPaste:t.slice(0,30000)}).then(function(){ toast("Saved. Claude will draft from it"); suPaint(); }); return; }
  if(act==="draft"){ if(arg==="about") suDraftAbout(); else if(arg==="skills") suDraftSkills(); else if(arg==="want") suDraftWant(); return; }
  if(act==="save"){ if(arg==="about") suSaveAbout(); else if(arg==="skills") suSaveSkills(); else if(arg==="want") suSaveWant(); else if(arg==="rhythm") suSaveRhythm(); return; }
  if(act==="addskill"){ var s=SU.draft.skills||(SU.draft.skills={items:[],left_out:[]}); s.items.push({name:"",level:"Strong",evidence:""}); suPaint(); return; }
  if(act==="rmskill"){ (SU.draft.skills.items||[]).splice(+arg,1); suPaint(); return; }
  if(act==="chatstart"){ suChat(""); return; }
  if(act==="chat"){ var ti=el("su-chatin"), v=ti? ti.value.trim() : ""; if(v) suChat(v); return; }
  if(act==="wantreview"){ SU.wantPhase="review"; suPaint(); return; }
  if(act==="wantchat"){ var ww=suWant(); if(ww.criteria && ww.draftN==null){ ww.draftN=(ww.chat||[]).length; suKeepDrafts(); } SU.wantPhase="chat"; SU.freshArm=false; suPaint(); suChatScroll(); return; }
  if(act==="wantfresh"){ if(!SU.freshArm){ SU.freshArm=true; suPaint(); return; } suDraftWant(true); return; }
  if(act==="addrow"){ suAddRow(arg); return; }
  if(act==="copy"){ suCopy(arg); return; }
  if(act==="showreq"){ SU.showReq= SU.showReq===arg? null : arg; suPaint(); return; }
  if(act==="addcos"){ suAddCos(); return; }
  if(act==="rateall"){ suRateAll(b); return; }
  if(act==="userate"){ var co=companies.find(function(x){return x.id===arg;}); if(co && co.setupSuggest) coSetRating(co.id, co.setupSuggest.rating); return; }
  if(act==="addsrc"){ suAddSrc(); return; }
  if(act==="rmco"){ suRmCo(b,arg); return; }
  if(act==="copytp"){ var ta=el("su-tp-"+arg); if(ta) fxClip(ta.value,function(){ toast("Prompt copied"); },function(){ ta.select(); toast("Select the prompt and copy it",true); }); return; }
  if(act==="autook"){ suSave({schedAutoOk:true}).then(suPaint); return; }
  if(act==="schedself"){ suSave({schedSelf:true}).then(suPaint); return; }
  if(act==="schedclaude"){ suSave({schedSelf:false}).then(suPaint); return; }
  if(act==="aready"){ var rr=Object.assign({},suAlertReady()); rr[arg]=!rr[arg]; suSave({alertsReady:rr}).then(suPaint); return; }
  if(act==="agoahead"){ suSave({alertsGoAhead:true}).then(suPaint); return; }
  if(act==="copyrest"){ var pg=suAlertProg(); SU.alertsOnly=suAlertSites().filter(function(x){ var p=pg[x.id]; return p && p.status==="signin"; }).map(function(x){ return x.name; }); suCopy("alerts").then(function(){ SU.alertsOnly=null; }); return; }
  if(act==="nogmail"){ suSave({noGmail:true}).then(suPaint); return; }
  if(act==="finish"){ suSave({doneAt:new Date().toISOString(), step:"done", status:Object.assign({},SU.doc.status||{},{done:"done"})}).then(function(){ suClose(); showTab("overview"); toast("Setup done. Your first sweep runs on schedule"); }); return; }
});
document.addEventListener("keydown",function(ev){
  if(ev.target && ev.target.id==="su-chatin" && ev.key==="Enter" && (ev.metaKey||ev.ctrlKey)){ ev.preventDefault(); var v=ev.target.value.trim(); if(v && !SU.busy) suChat(v); }
});

/* ---------- outside the pop-up: Resume button, Overview card, How to use › Set up, About me ---------- */
function suPaintOutside(){
  var on=suOn();
  var tb=el("su-resume");
  if(!tb){ var nm=el("newmenu"); if(nm){ nm.insertAdjacentHTML("beforebegin",'<button type="button" class="btn suresume" id="su-resume" data-su-open="" hidden>Resume setup</button>'); tb=el("su-resume"); } }
  if(tb){ tb.hidden=!on; tb.textContent=suStarted()? "Resume setup" : "Set up the board"; }
  suPaintCard(); suPaintSetupTab();
  if(SU.open){ suPaintNav(); var hb=el("su-body");
    if(hb && SU_STEPS[suStepIx(SU.step)].hand || SU.step==="rhythm"){ var ae=document.activeElement, typing=ae && ae.closest && ae.closest("#su-body") && /INPUT|TEXTAREA/.test(ae.tagName);
      if(!typing){ suPaint(); } }
    else { var f=el("su-foot"); if(f) f.innerHTML=suFootHtml(SU.step); }
  }
}
function suCardHtml(){
  var n=suNDone(), next=suStepOf(suNextOpen()), running=SU_STEPS.concat([{k:"schedule",n:"Scheduled tasks"}]).filter(function(s){ var h=suHand(s.k); return h && h.status==="working"; });
  if(suPhone()) return '<div class="ovc sucard"><h3>Setup '+n+' of '+SU_STEPS.length+'</h3><p>Continue setup on your computer. Everything so far is saved.</p><i class="subar" style="--p:'+Math.round(n/SU_STEPS.length*100)+'%"></i></div>';
  return '<div class="ovc sucard"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h3>'+(suStarted()? "Setup "+n+" of "+SU_STEPS.length : "Set up your board")+'</h3>'+
    '<p>'+(suStarted()? "Next: "+esc(next.n)+"." : "About 4–5 hours of your time over a day or two, saved as you go.")+
    (running.length? " Claude is working on: "+esc(running.map(function(s){return s.n;}).join(", "))+"." : "")+'</p></div>'+
    '<button type="button" class="btn primary" data-su-open="">'+(suStarted()? "Resume" : "Start setup")+'</button></div><i class="subar" style="--p:'+Math.round(n/SU_STEPS.length*100)+'%"></i></div>';
}
function suPaintCard(){
  var box=el("ov-body"); if(!box) return;
  var old=box.querySelector(".sucard"); if(old) old.remove();
  if(!suOn()) return;
  var fr=box.querySelector(".ovfirst"); if(fr) fr.remove();
  box.insertAdjacentHTML("afterbegin",suCardHtml());
}
renderOverview=(function(orig){ return function(){ orig.apply(this,arguments); try{ suPaintCard(); }catch(e){ console.warn("setup card",e); } }; })(renderOverview);
function suPaintSetupTab(){
  var b=el("su-setup"); if(!b) return;
  var n=suNDone();
  if(!suStarted() && !suFresh() && SU.rolesKnown){
    b.innerHTML='<div class="card panel"><h3>Guided setup</h3><p class="lede" style="font-size:12.5px;margin:0">This board was set up before the guided setup existed. You can still open any step on its own: '+
      'it starts from what\'s on the board, and every change is saved with Undo in the change log.</p><ol class="suplan small">'+
      SU_STEPS.filter(function(s){ return ["welcome","plan","done"].indexOf(s.k)<0; }).map(function(s){ return '<li><b>'+esc(s.n)+'</b><span>'+esc(s.t)+'</span><button type="button" class="linkbtn" data-su-open="'+s.k+'" data-su-redo="1">Open</button></li>'; }).join("")+'</ol></div>';
    return;
  }
  b.innerHTML='<div class="card panel"><div class="row" style="justify-content:space-between"><h3>'+(suDone()? "Setup is done" : suStarted()? "Setup: "+n+" of "+SU_STEPS.length+" steps done" : "Set up your board")+'</h3>'+
    (suDone()? "" : '<button type="button" class="btn primary" data-su-open="">'+(suStarted()? "Resume setup" : "Start setup")+'</button>')+'</div>'+
    '<p class="lede" style="font-size:12.5px;margin:0">A guided setup: your CV, what you want, the companies and sources to search, a test sweep and your weekly rhythm. About 4–5 hours of your time over a day or two; it saves as you go. '+
    (suDone()? "Redo any step below; changes are saved with Undo in the change log." : "")+'</p>'+
    '<ol class="suplan small">'+SU_STEPS.map(function(s){ var st=suStatus(s.k);
      return '<li class="st-'+st+'"><b>'+esc(s.n)+'</b><span>'+(st==="done"? "Done" : st==="skipped"? "Skipped" : esc(s.t))+'</span>'+
        (suStarted() && s.k!=="welcome"? '<button type="button" class="linkbtn" data-su-open="'+s.k+'" data-su-redo="'+(st==="done"?"1":"")+'">'+(st==="done"? "Redo" : "Go to it")+'</button>' : "")+'</li>'; }).join("")+'</ol></div>';
}
/* About me: Redo this step, per sub-tab. */
renderAbout=(function(orig){ return function(){ orig.apply(this,arguments);
  try{ if(!suStarted() && !suFresh()) return;
    [["static","about","About you"],["prefs","want","What you want"],["skills","skills","Skills"],["templates","cv","Your CV and cover letter"]].forEach(function(x){
      var p=document.querySelector('#about-body [data-cp="about"][data-k="'+x[0]+'"]'); if(!p || p.querySelector(".suredo")) return;
      p.insertAdjacentHTML("afterbegin",'<p class="suredo"><button type="button" class="linkbtn" data-su-open="'+x[1]+'" data-su-redo="1">Redo '+esc(x[2])+' with setup</button></p>'); });
  }catch(e){ console.warn("setup redo links",e); }
}; })(renderAbout);
/* Companies and sources arrive while the step is open: keep its list current. */
function suRefreshList(){
  if(!(SU.open && (SU.step==="companies"||SU.step==="sources"))) return;
  var l=el("su-list"), ae=document.activeElement;
  if(l && !(ae && ae.closest && ae.closest("#su-list") && /INPUT|TEXTAREA/.test(ae.tagName))) l.innerHTML= SU.step==="companies"? suCoList() : suSrcList();
  var f=el("su-foot"); if(f) f.innerHTML=suFootHtml(SU.step);
}
if(typeof renderChannels==="function") renderChannels=(function(orig){ return function(){ orig.apply(this,arguments); try{ suRefreshList(); }catch(e){} }; })(renderChannels);
render=(function(orig){ return function(){ orig.apply(this,arguments);
  try{ suRefreshList();
    if(SU.open && SU.step==="cv"){ var ae2=document.activeElement; if(!(ae2 && ae2.id==="su-cvpaste")) suPaint(); }
    if(!SU.open) suPaintOutside();
    if(!SU.auto) setTimeout(suMaybeAuto,300); }catch(e){ console.warn("setup render",e); }
}; })(render);

/* ---------- boot ---------- */
function suMaybeAuto(){
  if(SU.auto || !SU.loaded || !SU.rolesKnown || SU.open) return;
  if(!PROFILE && !PREFS && !SU.doc) return;
  SU.auto=true;
  if(suPhone() || suDone()) return;
  if(suStarted() || suFresh()) suOpen(null);
}
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return; SU.db=db;
  db.doc("profile/onboarding").onSnapshot(function(d){
    SU.doc= d && d.exists? d.data() : null; SU.loaded=true;
    try{ suPaintOutside(); }catch(e){ console.warn("setup paint",e); }
    setTimeout(suMaybeAuto,400);
  },function(){ SU.loaded=true; });
  db.collection("templates").onSnapshot(function(s){
    var o={}; ((s&&s.docs)||[]).forEach(function(d){ if(d.id==="cv"||d.id==="letter"){ var x=d.data()||{}; o[d.id]={name:x.name, size:x.size, text:x.text||""}; } });
    SU.tpl=o;
    if(SU.open && SU.step==="cv"){ var ae=document.activeElement; if(!(ae && ae.id==="su-cvpaste")) suPaint(); }
  },function(){});
  var fired=false, off=null;
  off=db.collection("roles").onSnapshot(function(s){ SU.rolesN=(s&&s.docs)? s.docs.length : 0; if(!fired){ fired=true; SU.rolesKnown=true; try{ suPaintOutside(); }catch(e){} setTimeout(suMaybeAuto,800); } },function(){ SU.rolesKnown=true; });
})();
