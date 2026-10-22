"use strict";
/* ===== Starter records and Start again (22 Oct) =====
   A board opened for the first time with nothing in it creates the basics itself, so setup starts from a working
   board: default settings (with the standard turn-down reasons; setup adds the person's own), empty profile records (me, prefs with My targets
   defaults, skills) and the standard channels (ST_CHANNELS, plus an empty "Sites I check"). It runs only when profile/settings, profile/prefs,
   profile/me and roles are all missing or empty, so it never touches a board that has data. The reference docs
   (skills list, job sites, CV-editing script) and the brief come from the installation, not from here.
   A board whose profile/settings has board.kind "test" also gets Start again on How to use › Under the hood:
   it deletes every record on the board except the brief and the reference docs, then the starters come back. No other board shows it. */
var ST_SETTINGS={
  alerts:{gmailLabel:"Job Alerts"},
  fit:{bands:{Perfect:90, High:75, Good:60, Stretch:40}, reqsProper:"5-8", reqsRough:"3-5", weights:{must:2, nice:1}},
  materials:{digestItems:8, maxTextChars:20000, summaryChars:3000},
  meetings:{dayStart:"07:00", dayEnd:"20:00", durationShort:30, durationLong:60, prepLeadDefault:1, prepLeadMax:14, timeStepMinutes:15},
  pack:{cvEditsMin:3, cvEditsMax:8, finalsToCompare:3, letterMaxPages:1},
  research:{companyFreshDays:60, interviewIntelFreshDays:60, interviewSources:["Glassdoor interview reviews","Reddit"], paySources:[]},
  roles:{foldAfterDays:7, maxListingAgeDays:45, unnamedEmployerAdverts:"include",
    endReasons:{me:["Pay below my bar","Level or scope wrong","Company concern","Fails one of my must-haves","Needs something I don't have","Chose another route","Other"],
      them:["No reason given","Went quiet","Domain experience","Level mismatch","Stronger or internal candidate","Pay or location","Other"],
      neither:["Role pulled or filled","Posting expired","Hiring freeze","Other"]},
    endGloss:{"Pay below my bar":"the pay is under what you'll accept","Fails one of my must-haves":"it breaks one of your deal-breakers, so the sweep should have screened it out",
      "Needs something I don't have":"the role requires something you don't have, like a language, a qualification or specific experience",
      "Level or scope wrong":"too junior or too senior, or not the kind of role you want","Company concern":"something about the company itself: health, culture, ethics",
      "Chose another route":"you went after it another way, or picked a different role there"}},
  sweep:{maxToolCalls:350, maxSubagents:2, maxWebSearches:12, maxFullPostings:40},
  sweepCheck:{size:5, maxPostings:10},
  daily:{maxBoardFinds:25},
  help:{
    "alerts.gmailLabel":"The Gmail label the sweep reads job-alert emails from.",
    "fit.bands":"The lowest % for each Role Fit band; below Stretch is Low.",
    "fit.reqsProper":"How many requirements a full Role Fit scores from the ad.",
    "fit.reqsRough":"How many requirements a rough Role Fit (from the listing) scores.",
    "fit.weights":"How much a must-have counts against a nice-to-have in the Role Fit %.",
    "materials.digestItems":"Most items in each list of a material's digest.",
    "materials.maxTextChars":"Longest text copy kept of an interview material file.",
    "materials.summaryChars":"Longest summary of an interview material.",
    "meetings.dayEnd":"Latest time a meeting can be booked.",
    "meetings.dayStart":"Earliest time a meeting can be booked.",
    "meetings.durationLong":"Default length in minutes of other interviews.",
    "meetings.durationShort":"Default length in minutes of screens and informal chats.",
    "meetings.prepLeadDefault":"Days before an interview its prep task is due, by default.",
    "meetings.prepLeadMax":"Most days before an interview a prep task can be set.",
    "meetings.timeStepMinutes":"Meeting times snap to this many minutes.",
    "pack.cvEditsMax":"Most tracked changes a tailored CV usually makes.",
    "pack.cvEditsMin":"Fewest tracked changes a tailored CV usually makes.",
    "pack.finalsToCompare":"How many of your recently sent CVs and letters the pack learns from.",
    "pack.letterMaxPages":"Longest a cover letter may be, in pages.",
    "research.companyFreshDays":"Company research younger than this many days is reused instead of redone.",
    "research.interviewIntelFreshDays":"A company's interview-process research younger than this many days is reused.",
    "research.interviewSources":"Where interview prep looks for what a company's interviews are like.",
    "research.paySources":"Where the shortlist research looks up a pay estimate when the ad gives none, in order. Set from your country at setup.",
    "roles.foldAfterDays":"Longlist rejections are folded into a daily record once they are this many days old, so you have time to undo one.",
    "roles.maxListingAgeDays":"Job-board listings older than this are dropped unless the employer's own board shows the role open.",
    "roles.unnamedEmployerAdverts":"Recruiter adverts that don't name the employer: include (as unconfirmed) or skip.",
    "roles.endReasons":"Your turn-down reasons, most used first, for each of who ended it: me (I said no), them (they said no), neither (it went away). Fails one of my must-haves, Needs something I don't have, Chose another route, Went quiet, Role pulled or filled and Other are always kept.",
    "roles.endGloss":"What each of your own turn-down reasons means, shown on hover when you reject a role.",
    "sweep.maxFullPostings":"Most full job postings a sweep reads, to check office days, location and whether the role is still open.",
    "sweep.maxSubagents":"Most helper agents a sweep may start at once. Each one adds usage.",
    "sweep.maxToolCalls":"Most tool calls one sweep may make. Lower it to use less of your Claude usage.",
    "sweep.maxWebSearches":"Most web searches per sweep.",
    "sweepCheck.maxPostings":"Most job ads the weekly screen-out check opens and reads in one run.",
    "sweepCheck.size":"How many of the week's screen-outs the weekly screen-out check asks you to confirm (one of them picked at random).",
    "daily.maxBoardFinds":"Most new company job boards the daily check looks for in one run.",
    "board.url":"This board's link. The requests the board copies for Claude include it, so the skills work on the right board.",
    "board.kind":"\"test\" on a board kept for trying out setup: it shows Start again under How to use › Under the hood."}
};
/* The standard channels every board runs. Their "how" is read by the sweep as instructions, so it stays
   neutral: the person's location, label and pluses come from their own profile and settings. */
var ST_CHANNELS=[
  ["alerts",{name:"Alert emails", kind:"auto", order:1, how:"Job-alert emails under the Gmail label in Settings (alerts.gmailLabel), everything since the last run. The route into sites that need a login or block automated reading."}],
  ["boards",{name:"Public boards", kind:"auto", order:2, how:"Public job sites, fetched directly. No account needed."}],
  ["companies",{name:"Company careers pages", kind:"auto", order:3, derived:"companies", how:"Each company rated Want it or Would consider: straight to its own jobs page where it can be read; otherwise through LinkedIn company alerts."}],
  ["careers",{name:"Careers-site search", kind:"auto", order:4, how:"Companies not on the list: site-scoped web searches of Greenhouse, Ashby and Lever job boards, using the location in About me and the location strings in refs/ats-endpoints. Shares the sweep's web-search budget."}],
  ["flags",{name:"Flag searches", kind:"auto", order:5, derived:"flags", how:"One search per plus in About me › My criteria."}],
  ["recruiters",{name:"Recruiters", kind:"auto", order:6, how:"Recruitment agencies for the person's field and area. Fetched where the site allows."}],
  ["warm",{name:"Warm routes", kind:"manual", order:8, cadence:"As they come", how:"Referrals and contacts, from People and Warm routes."}],
  ["aggregators",{name:"Other job sites", kind:"auto", order:9, status:"trial", cadence:"When a search hits one", why:"Never the source of record", how:"Aggregators the sweep's web searches land on. Discovery only; the employer's own posting is the record."}]
];
function stDocs(){
  var t=today();
  return [
    ["profile","settings", Object.assign(JSON.parse(JSON.stringify(ST_SETTINGS)),{updatedAt:t, createdVia:"starter"})],
    ["profile","prefs", {hardRules:[], scored:[], red:[], upside:[], roleShape:[], searchTerms:[], retiredRules:[],
      targets:{band:TG_DEF.band.slice(), floor:TG_DEF.floor, ivRate:TG_DEF.ivRate, wait:Object.assign({},TG_DEF.wait), stretchMax:TG_DEF.stretchMax, setAt:t},
      updatedAt:t, createdVia:"starter"}],
    ["profile","me", {name:"", headline:"", profession:"", roleShort:"", fieldTerm:"", location:"", country:"", timezone:"", spelling:"",
      status:"", availability:"", rightToWork:"", lastRole:"", experience:"", career:[], stories:[], answers:{}, watchOuts:[], gaps:[], links:{},
      updatedAt:t, createdVia:"starter"}],
    ["profile","skills", {items:[], left_out:[], note:"", createdVia:"starter"}],
    ["channels","manual", {name:"Sites I check", kind:"manual", how:"Job sites you check yourself.", cadence:"", order:7, status:"active", why:"", createdAt:t, createdVia:"starter"}]
  ].concat(ST_CHANNELS.map(function(c){ return ["channels",c[0],Object.assign({cadence:"Each sweep", status:"active", why:"", createdAt:t, createdVia:"starter"},c[1])]; }));
}
var ST={db:null, seen:{}, done:false, busy:false};
/* Every collection a board holds, for Start again (keep in step with the architecture doc's Data section). */
var ST_COLLS=["roles","companies","people","sectors","commitments","conversations","channels","sources","warmroutes","runs","screened","decided",
  "taskruns","errlog","fixqueue","fixes","rulechecks","ruleaudit","rulerevisit","rulesuggest","rulelog","rulereviews","hlweek","hlstate",
  "templates","packs","finals","finalsprev","materials","mocks","refs","profile"];
/* Start again keeps what the installation brings: the brief and the reference docs. */
function stKeep(c,id){ return c==="refs" || (c==="profile" && id==="brief"); }
function stIsTest(){ return !!(SETTINGS && SETTINGS.board && SETTINGS.board.kind==="test"); }
/* Wait until the four signals are in, then decide once. */
function stCheck(){
  var s=ST.seen; if(ST.done || ST.busy || !ST.db) return;
  if(!("settings" in s && "prefs" in s && "me" in s && "roles" in s)) return;
  ST.done=true;
  if(s.settings || s.prefs || s.me || s.roles) return;
  ST.busy=true;
  var db=ST.db;
  Promise.all(stDocs().map(function(d){ return db.doc(d[0]+"/"+d[1]).get().then(function(x){ return x && x.exists? null : db.doc(d[0]+"/"+d[1]).set(d[2]); }); }))
    .then(function(){ ST.busy=false; try{ toast("Your board is ready to set up"); }catch(e){} })
    .catch(function(e){ ST.busy=false; console.warn("starter records",e&&e.code); });
}
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return; ST.db=db;
  function once(path,key){ var off=null, fired=false;
    off=db.doc(path).onSnapshot(function(d){ if(fired) return; fired=true; ST.seen[key]=!!(d && d.exists); stCheck(); try{ if(typeof off==="function") off(); }catch(e){} },
      function(){ ST.seen[key]=true; stCheck(); }); }
  once("profile/settings","settings"); once("profile/prefs","prefs"); once("profile/me","me");
  var offR=null, firedR=false;
  offR=db.collection("roles").onSnapshot(function(s){ if(firedR) return; firedR=true; ST.seen.roles=!!(s && s.docs && s.docs.length); stCheck(); try{ if(typeof offR==="function") offR(); }catch(e){} },
    function(){ ST.seen.roles=true; stCheck(); });
})();

/* ---------- Start again (test boards only) ---------- */
function stResetHtml(){
  if(!stIsTest()) return "";
  return '<div class="card panel streset" style="margin-top:16px"><h3>Start again</h3>'+
    '<p class="lede" style="font-size:12.5px;margin:0">This is a test board. Start again deletes every record on it (roles, companies, your profile, criteria and settings), '+
    'then the board recreates its starter records so setup can run from the beginning. It keeps what the installation brings: the brief and the reference docs (skills list, job sites, CV-editing script). Files in the board\'s file store stay too.</p>'+
    '<div class="row" style="margin-top:10px"><button type="button" class="btn danger" data-streset="1">Start again</button><span class="statushint" id="st-hint"></span></div></div>';
}
async function stReset(){
  if(!stIsTest() || !ST.db) return;
  var db=ST.db, n=0, hint=el("st-hint");
  if(hint) hint.textContent="Deleting…";
  for(var i=0;i<ST_COLLS.length;i++){
    var c=ST_COLLS[i];
    var docs=await new Promise(function(res){ var off=null, fired=false; off=db.collection(c).onSnapshot(function(s){ if(fired) return; fired=true; res((s&&s.docs)||[]); try{ if(typeof off==="function") off(); }catch(e){} }, function(){ res([]); }); });
    for(var j=0;j<docs.length;j++){ if(stKeep(c,docs[j].id)) continue; try{ await db.doc(c+"/"+docs[j].id).delete(); n++; }catch(e){ console.warn("reset",c,docs[j].id,e&&e.code); } }
  }
  if(hint) hint.textContent="Deleted "+n+" records. Recreating the starters…";
  ST.done=false; ST.busy=false; ST.seen={settings:false, prefs:false, me:false, roles:false}; stCheck();
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-streset]"); if(!b) return; ev.preventDefault();
  if(b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent="Click again to delete everything on this board"; return; }
  b.disabled=true; stReset();
});
renderHood=(function(orig){ return function(){ orig.apply(this,arguments);
  var h=el("hood-body"); if(!h) return; var old=h.querySelector(".streset"); if(old) old.remove();
  var x=stResetHtml(); if(x) h.insertAdjacentHTML("beforeend",x); }; })(renderHood);
/* Settings arrive after Under the hood may have drawn, so redraw it when they do (Start again shows only on a test board). */
applySettings=(function(orig){ return function(){ orig.apply(this,arguments); try{ if(typeof renderHood==="function") renderHood(); }catch(e){} }; })(applySettings);
