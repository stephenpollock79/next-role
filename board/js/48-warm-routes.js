"use strict";
/* ===== Warm routes (Tools › Warm routes, tab `warm`) =====
   Finds the companies where you know someone and that fit what you want, from your LinkedIn connections export.
   1. You upload Connections.csv. It is read in the browser (wrParse); nothing is stored yet.
   2. Go: connections are grouped by company (wrNorm), matched to company cards, ruled-out companies and
      self-employment dropped, and each contact scored on how useful their role is for getting in (wrRel —
      their job title, never closeness, which the export can't tell). Every company is reviewed by Claude with
      your company-level deal-breakers and preferences, job titles only (no names): companies on your board go
      straight to the final pick; above WR_ONE others, a first pass in batches keeps each batch's best. Claude
      then picks the best 10 or 20 with why, a short summary and a verdict.
   3. Saved to `warmroutes/current` with up to WR_CONTACTS contacts per company (names kept only for these).
   4. Each company: who you know, roles already on the board there, a rating, and Add company (the company and its
      rating only). Each contact is added to People on its own (Add to People), because only you know who would
      vouch for you; adding one marks the company as a warm route.
      Open roles come through the sweep: Want it or Would consider puts the company's job board in it. */

var WR={conns:null, file:"", nConn:0, nCo:0, size:20, busy:false, err:"", step:null, doc:null, showHidden:false, fold:false};
var WR_CONTACTS=6;
var WR_STG={proposed:"Longlist", consideration:"Shortlist", parked:"Parked", prep:"To apply", applied:"Applied", offer:"Offer", closed:"Closed",
  g1_rejected:"Dropped", g2_rejected:"Dropped", rejected:"Closed"};
var WR_RATE=[["","Rate it…"],["high","Want it"],["medium","Would consider"],["low","If it appears"]];
var WR_VERDICT={strong:["Strong fit","strong"], good:["Good fit","mid"], stretch:["Worth a look","weak"]};

/* ---------- reading the export ---------- */
function wrCsv(text){
  var rows=[], row=[], f="", q=false, i=0, c;
  text=String(text||"").replace(/^﻿/,"");
  for(;i<text.length;i++){
    c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=c; continue; }
    if(c==='"'){ q=true; continue; }
    if(c===","){ row.push(f); f=""; continue; }
    if(c==="\n"||c==="\r"){ if(c==="\r" && text[i+1]==="\n") i++; row.push(f); rows.push(row); row=[]; f=""; continue; }
    f+=c;
  }
  if(f || row.length){ row.push(f); rows.push(row); }
  return rows;
}
/* LinkedIn's Connections.csv starts with a few lines of notes before the header row. */
function wrParse(text){
  var rows=wrCsv(text), h=-1;
  for(var i=0;i<Math.min(rows.length,30);i++){ var low=rows[i].map(function(x){ return String(x).trim().toLowerCase(); });
    if(low.indexOf("first name")>=0 && low.indexOf("company")>=0){ h=i; break; } }
  if(h<0) return null;
  var H=rows[h].map(function(x){ return String(x).trim().toLowerCase(); });
  var col=function(n){ return H.indexOf(n); }, cF=col("first name"), cL=col("last name"), cU=col("url"), cC=col("company"), cP=col("position"), cD=col("connected on");
  var out=[];
  rows.slice(h+1).forEach(function(r){
    var co=String(r[cC]||"").trim(), nm=(String(r[cF]||"").trim()+" "+String(r[cL]||"").trim()).trim();
    if(!nm && !co) return;
    var d=String(r[cD]||""), y=(d.match(/\b(19|20)\d{2}\b/)||[""])[0];
    if(!y){ var y2=d.match(/\b(\d{2})$/); if(y2) y="20"+y2[1]; }
    out.push({name:nm, url:String(r[cU]||"").trim(), company:co, position:String(r[cP]||"").trim(), year:y});
  });
  return out;
}

/* ---------- grouping and scoring ---------- */
var WR_SUFFIX=/\s+(ltd|limited|plc|inc|llc|llp|lp|group|holdings|uk|gmbh|sa|sas|bv|ag|ab|as|oy|co|corp|corporation|company|technologies|technology|software|labs)$/;
function wrNorm(s){
  var t=String(s||"").toLowerCase();
  try{ t=t.normalize("NFD").replace(/[̀-ͯ]/g,""); }catch(e){}
  t=t.replace(/&/g," and ").replace(/\(.*?\)/g," ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim().replace(/^the /,"");
  var prev; do{ prev=t; t=t.replace(WR_SUFFIX,"").trim(); }while(t!==prev && t.indexOf(" ")>0);
  return t;
}
var WR_JUNK=/^(self[ -]?employed|freelance|freelancer|independent|stealth|stealth startup|retired|confidential|career break|sabbatical|none|n a|various|consultant|contractor|looking for|open to work|student)\b/;
function wrRel(pos){
  var p=String(pos||"").toLowerCase(), s=0;
  if(/talent|recruit|people partner|hiring|head of people|chief people|hr business partner/.test(p) && !/agency/.test(p)) s=Math.max(s,4);
  /* Leaders in the user's own field count most, then peers in it (22 Oct: the field is profile/me fieldTerm, not
     always product; product keeps its own wording, e.g. CPO and PM). */
  var F=fieldTerm(), lead, peer;
  if(!F || F==="product"){ lead=/\bcpo\b|chief product|vp,? product|vice president,? product|head of product|director of product|product director|group product|principal product|product lead|lead product/; peer=/product (manager|owner)|\bpm\b/; }
  else { var e=F.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); lead=new RegExp("chief "+e+"|vp,? "+e+"|vice president,? "+e+"|head of "+e+"|director of "+e+"|"+e+" director|principal "+e+"|"+e+" lead|lead "+e); peer=new RegExp("\\b"+e+"\\b"); }
  if(lead.test(p)) s=Math.max(s,5);
  else if(peer.test(p)) s=Math.max(s,3);
  if(/\bceo\b|\bcto\b|\bcoo\b|founder|chief|\bvp\b|vice president|managing director|general manager|\bgm\b/.test(p)) s=Math.max(s,4);
  else if(/head of|director/.test(p)) s=Math.max(s,3);
  if(/engineering manager|design lead|head of design|lead designer|staff engineer/.test(p)) s=Math.max(s,2);
  if(!s && p) s=1;
  return s;
}
function wrCoIndex(){
  var m={};
  companies.forEach(function(c){
    [c.name, c.id].concat(String(c.aka||"").split(/[,;\/]/)).forEach(function(n){ var k=wrNorm(n); if(k && !m[k]) m[k]=c; });
  });
  return m;
}
function wrGroups(conns){
  var idx=wrCoIndex(), g={};
  conns.forEach(function(x){
    var k=wrNorm(x.company); if(!k || WR_JUNK.test(k)) return;
    var c=idx[k]||null;
    if(c && coOff(c)) return;
    var key=c? "co:"+c.id : "n:"+k;
    var G=g[key]||(g[key]={key:key, company:c? (c.name||c.id) : x.company, companyId:c? c.id : "", people:[], best:0});
    x.rel=wrRel(x.position); G.people.push(x); if(x.rel>G.best) G.best=x.rel;
  });
  return Object.keys(g).map(function(k){ var G=g[k];
    G.people.sort(function(a,b){ return b.rel-a.rel || String(b.year).localeCompare(String(a.year)); });
    var c=G.companyId? companies.find(function(x){ return x.id===G.companyId; }) : null, pr=c? coRating(c) : "";
    G.score=G.best*10+Math.min(G.people.length,10)+(pr==="high"? 6 : pr==="medium"? 4 : c? 2 : 0);
    return G; }).sort(function(a,b){ return b.score-a.score; });
}

/* ---------- roles at a company ---------- */
function wrRolesAt(res){
  var k=wrNorm(res.company);
  return rawRoles.filter(function(r){ return (res.companyId && r.companyId===res.companyId) || (k && wrNorm(r.company)===k); })
    .filter(function(r){ return !DEAD[r.stage] && r.stage!=="closed"; })
    .sort(function(a,b){ return (a.ref||0)-(b.ref||0); });
}
function wrCo(res){ return res.companyId? companies.find(function(c){ return c.id===res.companyId; })||null : (companies.find(function(c){ return wrNorm(c.name)===wrNorm(res.company); })||null); }
function wrLi(u){ return String(u||"").toLowerCase().replace(/^https?:\/\/(www\.)?/,"").replace(/[?#].*$/,"").replace(/\/+$/,""); }
function wrPerson(p){
  var li=wrLi(p.url), nm=String(p.name||"").toLowerCase();
  return people.find(function(x){ return (li && wrLi(x.linkedin)===li) || (nm && String(x.name||"").toLowerCase()===nm); })||null;
}

/* ---------- asking Claude ---------- */
function wrCriteria(){
  var P=PREFS||{}, hr=(P.hardRules||[]).filter(function(r){ return r && (r.basis==="company" || r.type==="employer"); });
  var sc=(P.scored||[]).filter(function(s){ return s && s.basis==="company"; });
  var terms=(P.searchTerms||[]).filter(function(t){ return /domain/i.test(t.group||""); }).map(function(t){ return t.terms; }).join("; ");
  return "Deal-breakers about the company (fail one and it's out):\n"+(hr.map(function(r){ return "- "+r.id+" "+(r.name||"")+": "+clip(r.rule||"",260); }).join("\n")||"- none")+
    "\n\nPreferences about the company (Strong / Middle / Weak):\n"+(sc.map(function(s){ var b=s.bands||{}; return "- "+s.id+" "+(s.name||"")+(b.strong? ": strong = "+clip(b.strong,160) : ""); }).join("\n")||"- none")+
    (terms? "\n\nProduct domains they like: "+terms : "")+
    "\n\nRole they want: "+((P.roleShape||[]).map(function(x){ return x.name||x; }).join("; ")||(PROFILE&&PROFILE.profession)||"not stated")+
    "\nPluses: "+((P.upside||[]).map(function(x){ return x.name; }).join("; ")||"none")+
    "\nConcerns: "+((P.red||[]).map(function(x){ return x.name; }).join("; ")||"none");
}
/* One line per company for Claude: id | company | count | contacts' job titles (never names) | notes. */
function wrLine(G){
  var c=G.companyId? companies.find(function(x){ return x.id===G.companyId; }) : null, live=wrRolesAt(G).length;
  return G.cid+" | "+G.company+" | "+plural(G.people.length,"connection")+" | "+G.people.slice(0,4).map(function(p){ return p.position||"(no title)"; }).join("; ")+
    (c? " | on their list: "+PRILABEL[coRating(c)]+(c.sector? ", "+c.sector : "") : "")+(live? " | "+plural(live,"live role")+" on their board" : "");
}
function wrWho(){ var me=PROFILE||{}; return "Who they are: "+clip(me.headline||me.profession||"a job seeker",300)+(me.location? "\nBased in: "+me.location : ""); }
var WR_WEIGH="Weigh: the company fits their deal-breakers and preferences (from what you know of it; drop any that clearly fail a deal-breaker), "+
  "it plausibly hires for the role they want {WHERE}, and the contacts could help (leaders in their field, talent, founders and execs count most, but anyone there is a way in). "+
  "Leave out recruitment agencies, universities, charities with no roles like theirs, and companies you don't recognise unless the contacts make a strong case.";
/* First pass over a batch: just the ids worth a closer look. Default tier. */
function wrBatchPrompt(list,k){
  return "A job seeker wants warm routes into their next role: companies where they already know someone, that fit what they want.\n\n"+wrWho()+"\n\n"+wrCriteria()+
    "\n\nSome of their LinkedIn connections, grouped by current employer (id | company | count | their contacts' job titles | notes):\n"+list.map(wrLine).join("\n")+
    "\n\nThis is a first pass over one batch: return the ids of up to "+k+" companies worth a closer look for warm routes, best first. "+locText(WR_WEIGH)+
    ' Reply with JSON only: {"ids":["C<n>", ...]}.';
}
function wrPrompt(pool,n){
  return "A job seeker wants warm routes into their next role: companies where they already know someone, that fit what they want.\n\n"+wrWho()+"\n\n"+wrCriteria()+
    "\n\nTheir LinkedIn connections, grouped by current employer (id | company | count | their contacts' job titles | notes):\n"+pool.map(wrLine).join("\n")+
    "\n\nPick the best "+n+" companies for warm routes. "+locText(WR_WEIGH)+" Rank best first.\n\n"+
    'Reply with JSON only: {"picks":[{"id":"C<n>","verdict":"strong|good|stretch","why":"<under 25 words: why it fits what they want, written to them as you>",'+
    '"summary":"<under 20 words: what the company does and its shape; say if you are unsure>","sector":"<2-4 words>"}],"note":"<one sentence on what you left out and why>"}. '+
    engVar()+" English. Never state a fact you're unsure of as certain.";
}
/* Every company is reviewed. Companies already on your board go straight to the final pick; the rest, when there are
   more than WR_ONE, get a first pass in batches of WR_BATCH, each keeping its best WR_KEEP. */
var WR_ONE=300, WR_BATCH=300, WR_KEEP=15;
async function wrRun(){
  if(WR.busy || !WR.conns) return;
  if(!DB){ toast("The board hasn't loaded yet",true); return; }
  var groups=wrGroups(WR.conns);
  if(!groups.length){ WR.err="None of your connections list a company the board can use."; renderWarm(); return; }
  groups.forEach(function(G,i){ G.cid="C"+(i+1); });
  var byId={}; groups.forEach(function(G){ byId[G.cid]=G; });
  var onBoard=groups.filter(function(G){ return G.companyId; }), rest=groups.filter(function(G){ return !G.companyId; }), n=WR.size;
  var batches=[]; if(rest.length>WR_ONE) for(var b=0;b<rest.length;b+=WR_BATCH) batches.push(rest.slice(b,b+WR_BATCH));
  WR.busy=true; WR.err=""; WR.step={total:batches.length, done:0, nCo:groups.length, phase:batches.length? "batch" : "final"}; renderWarm();
  var missed=0;
  try{
    var pool=onBoard.slice();
    if(!batches.length) pool=pool.concat(rest);
    else {
      /* Three batches at a time: quicker than one by one, gentle on usage limits. */
      var queue=batches.slice(), seen={};
      var worker=async function(){
        while(queue.length){
          var bt=queue.shift(), ans=null;
          try{ ans=await rvAsk([{role:"user", content:wrBatchPrompt(bt,WR_KEEP)}],"default"); }
          catch(e){ try{ ans=await rvAsk([{role:"user", content:wrBatchPrompt(bt,WR_KEEP)}],"default"); }catch(e2){ ans=null; } }
          if(!ans){ missed+=bt.length; }
          else (ans.ids||[]).slice(0,WR_KEEP).forEach(function(id){ var G=byId[id]; if(G && !G.companyId && !seen[id] && bt.indexOf(G)>=0){ seen[id]=1; pool.push(G); } });
          WR.step.done++; wrProgPaint();
        }
      };
      await Promise.all([worker(),worker(),worker()]);
      if(missed===rest.length && !onBoard.length) throw {code:"batches"};
    }
    WR.step.phase="final"; wrProgPaint();
    var ans2=await rvAsk([{role:"user", content:wrPrompt(pool,n)}],"complex");
    var seen2={}, results=[];
    (ans2 && ans2.picks||[]).forEach(function(p){
      var G=p && byId[p.id]; if(!G || seen2[G.key]) return; seen2[G.key]=1;
      results.push({key:G.key, company:G.company, companyId:G.companyId||"", verdict:WR_VERDICT[p.verdict]? p.verdict : "good",
        why:clip(p.why||"",220), summary:clip(p.summary||"",200), sector:clip(p.sector||"",40), rating:"", hidden:false,
        contacts:G.people.slice(0,WR_CONTACTS).map(function(x){ return {name:x.name, position:x.position, url:/^https?:\/\//i.test(x.url)? x.url : "", year:x.year||""}; }),
        nContacts:G.people.length});
    });
    results=results.slice(0,n);
    if(!results.length) throw {code:"empty"};
    await DB.doc("warmroutes/current").set({at:new Date().toISOString(), day:today(), file:WR.file, nConn:WR.nConn, nCo:groups.length, pool:pool.length,
      batches:batches.length, missed:missed, size:n, note:clip((ans2&&ans2.note)||"",300), results:results});
    WR.fold=false;
    toast("Your warm routes are ready");
  }catch(e){
    console.warn("warm routes",e);
    WR.err= e && e.code==="empty"? "Claude didn't pick any companies. Try again, or try the other size." :
      e && e.code==="batches"? "Claude couldn't look at your companies. Try again in a few minutes." : rvErr(e);
  }finally{ WR.busy=false; WR.step=null; renderWarm(); }
}
function wrProgPaint(){ var p=document.querySelector("#wr-root .rvprog"); if(p) p.innerHTML=wrProgHtml(); }
function wrProgHtml(){
  var S=WR.step||{total:0,done:0,phase:"final"}, out=[], cls=function(on,done){ return done? "done" : on? "on" : ""; };
  out.push('<li class="done">Grouped your connections into '+esc(plural(S.nCo||0,"company","companies"))+'</li>');
  if(S.total) out.push('<li class="'+cls(S.phase==="batch", S.phase!=="batch")+'">First look at every company: '+S.done+' of '+S.total+' batches done</li>');
  out.push('<li class="'+cls(S.phase==="final",false)+'">Picking your top '+WR.size+'</li>');
  return out.join("");
}
/* Criteria changed since the list was made: rules or preferences edited after it (20's change log). */
function wrStale(){
  if(!WR.doc || !WR.doc.at || typeof RU==="undefined") return null;
  var ch=(RU.log||[]).filter(function(x){ return x && !x.undone && (!x.kind || x.kind==="rule" || x.kind==="pref") && String(x.at||"")>String(WR.doc.at); });
  return ch.length? ch.length : null;
}
window.addEventListener("beforeunload",function(ev){ if(WR.busy){ ev.preventDefault(); ev.returnValue=""; } });

/* ---------- saving ---------- */
function wrResults(){ return (WR.doc && WR.doc.results)||[]; }
async function wrPatch(i,patch){
  var list=wrResults().map(function(r,j){ return j===i? Object.assign({},r,patch) : r; });
  WR.doc=Object.assign({},WR.doc,{results:list}); renderWarm();
  try{ await DB.doc("warmroutes/current").update({results:list}); }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
}
async function wrAddPerson(p,coId,coName){
  var ex=wrPerson(p);
  if(ex){ if(coId && !ex.companyId) await DB.doc("people/"+ex.id).update({companyId:coId, company:""}); return ex.id; }
  var base=slug(p.name||"contact"), id=base, k=2; while(people.some(function(x){ return x.id===id; })) id=base+"-"+(k++);
  await DB.doc("people/"+id).set({name:p.name||"", how:"", role:p.position||"", companyId:coId||"", company:coId? "" : (coName||""),
    linkedin:p.url||"", note:"LinkedIn connection"+(p.year? " since "+p.year : "")+". Added from Warm routes.", createdAt:today()});
  return id;
}
/* Add company (16 Oct): the company and its rating only. LinkedIn can't tell a colleague who'd vouch for you from
   someone who just accepted an invite, so people are added one at a time with wrAddOne, and only that marks the
   company as a warm route. */
async function wrAdd(i){
  var res=wrResults()[i]; if(!res || !DB) return;
  if(wrCo(res)) return;
  try{
    var id=slug(res.company); if(companies.some(function(x){ return x.id===id; })) id=id+"-"+Date.now().toString(36).slice(-3);
    var v=res.rating||"unrated", ppl=wrLinkedHere(res,null);
    await DB.doc("companies/"+id).set({name:res.company, aka:"", priority:v, listing:"target", watch:rateWatch(v), watchWhy:res.why||"",
      warm:ppl.length>0, warmNote:ppl.map(wrWarmLabel).join(", "),
      sector:res.sector||"", summary:res.summary||"", size:"", hq:"", sites:"", health:"", culture:"", comp:"", ai:"", ladder:"",
      green:[], red:[], questions:[], notes:[], onTargetList:true, checkedAt:"", reconcile:"", createdVia:"warm-routes", createdAt:today()});
    /* Contacts already added to People with the company as typed text now point at the new card. */
    for(var j=0;j<ppl.length;j++){ var x=wrPerson(ppl[j]); if(x && !x.companyId) await DB.doc("people/"+x.id).update({companyId:id, company:""}); }
    await wrPatch(i,{companyId:id, added:today()});
    toastUndo(res.company+" added",function(){
      DB.doc("companies/"+id).delete().catch(function(){});
      wrPatch(i,{companyId:"", added:""});
    });
  }catch(e){ console.warn(e); toast("Couldn't add it — try again",true); }
}
function wrWarmLabel(p){ return p.name+(p.position? " ("+p.position+")" : ""); }
/* The result's contacts already on People (linked to this company card, or typed with no card). */
function wrLinkedHere(res,c){
  return res.contacts.filter(function(p){ var x=wrPerson(p); return x && (c? x.companyId===c.id : true); });
}
/* Add to People (16 Oct): one contact, linked to the company card when it's on the board. That makes the company a
   warm route and adds the person to its warm note. */
async function wrAddOne(i,j){
  var res=wrResults()[i], p=res && res.contacts[j]; if(!p || !DB) return;
  var c=wrCo(res), ex=wrPerson(p), isNew=!ex, prevCo=ex? {companyId:ex.companyId||"", company:ex.company||""} : null, before=c? {warm:!!c.warm, warmNote:c.warmNote||""} : null;
  try{
    var pid=await wrAddPerson(p,c? c.id : "",c? c.name : res.company);
    if(c){ var note=String(c.warmNote||""), lab=wrWarmLabel(p);
      await DB.doc("companies/"+c.id).update({warm:true, warmNote: note.indexOf(p.name)>-1? note : (note? note+", " : "")+lab}); }
    renderWarm();
    toastUndo(p.name+(isNew? " added to People" : " linked to "+(c? c.name||res.company : res.company))+(c && !before.warm? " · "+(c.name||res.company)+" is now a warm route" : ""),function(){
      if(isNew) DB.doc("people/"+pid).delete().catch(function(){});
      else if(prevCo && !prevCo.companyId && c) DB.doc("people/"+pid).update(prevCo).catch(function(){});
      if(c) DB.doc("companies/"+c.id).update(before).catch(function(){});
    });
  }catch(e){ console.warn(e); toast("Couldn't add them — try again",true); }
}
function wrRate(i,v){
  var res=wrResults()[i]; if(!res) return;
  var c=wrCo(res);
  if(c){ if(v) coSetRating(c.id,v); return; }
  wrPatch(i,{rating:v});
}
/* ---------- drawing ---------- */
function wrIntroHtml(){
  return '<div class="rvcard rvintro"><h3>Who do you know who could get you in?</h3>'+
    '<p>Upload your LinkedIn connections and Claude finds the companies where you know someone <b>and</b> that fit what you want: your company deal-breakers and preferences from My criteria. '+
    'You get the top 10 or 20, who you know at each, why it\'s a good match, and any of their roles already on your board. Rate the ones you like and add the company. Add a contact to People only if they\'d recommend you: LinkedIn can\'t tell a close colleague from someone who just accepted an invite. Want it or Would consider puts the company\'s job board in the sweep, so its open roles reach your longlist.</p>'+
    '<p class="rvsafe">Your file is read in this browser. Only company names and job titles go to Claude, never names. Names are kept only for the companies picked.</p></div>';
}
function wrStepsHtml(){
  var has=!!WR.doc;
  var how='<ol class="wrhow">'+
    '<li>On LinkedIn, open <b>Me</b> (your photo) → <b>Settings &amp; Privacy</b> → <b>Data privacy</b> → <b>Get a copy of your data</b>.</li>'+
    '<li>Request all your data. LinkedIn emails you when it\'s ready; this can take up to a day.</li>'+
    '<li>Download it from the email link and unzip it. You get several CSV files: pick <b>Connections.csv</b>.</li></ol>'+
    '<p><a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener">Open LinkedIn\'s download page ↗</a></p>';
  var up;
  if(WR.busy){
    up='<p><b>Claude is picking your top '+WR.size+'.</b> It can take a few minutes, longer for a big network. Please wait: keep this browser tab open. You can use other pages of the board meanwhile; closing or reloading the tab stops it.</p><ul class="rvprog">'+wrProgHtml()+'</ul>'+
      (WR.doc? '<p class="statushint">Your current list stays below until the new one is ready.</p>' : "");
  } else {
    up='<label class="wrdrop" id="wr-drop"><input type="file" id="wr-file" accept=".csv,text/csv" hidden>'+
      (WR.conns? '<b>'+esc(WR.file)+'</b><span>'+plural(WR.nConn,"connection")+' at '+plural(WR.nCo,"company","companies")+' · choose another file</span>'
        : '<b>Drop Connections.csv here</b><span>or click to choose it</span>')+'</label>'+
      (WR.err? '<p class="wrerr">'+esc(WR.err)+'</p>' : "")+
      '<div class="rvacts"><span class="wrseg" role="group" aria-label="How many companies">'+
        [10,20].map(function(n){ return '<button type="button" class="cof'+(WR.size===n?" on":"")+'" data-wr="size:'+n+'">Top '+n+'</button>'; }).join("")+'</span>'+
        '<button type="button" class="btn primary" data-act="wr_go" data-wr="go"'+(WR.conns? "" : " disabled")+'>Go</button>'+
        (WR.conns? '<span class="statushint">Takes a few minutes. Every company is looked at.</span>' : '<span class="statushint">Choose your file first.</span>')+'</div>';
  }
  var inner='<div class="wrsteps"><div class="rvcard"><h4>1 · Get your connections from LinkedIn</h4>'+how+'</div>'+
    '<div class="rvcard"><h4>2 · Upload them and press Go</h4>'+up+'</div></div>';
  /* With a list already made, the steps fold away as Run it again. The file stays loaded until the page reloads,
     so a rerun after changing your criteria is just Go; after a reload, choose the file again. */
  if(has && !WR.busy && !WR.err) return '<details class="card panel cfold wrfold" data-wrfold'+(WR.fold? " open" : "")+'><summary>Run it again<span class="cfmeta">'+
    esc(WR.conns? "Your file is loaded: press Go" : "New export or changed criteria")+'</span></summary>'+inner+'</details>';
  return inner;
}
function wrChip(t,cls,title){ return '<span class="chip'+(cls? " "+cls : "")+'"'+(title? ' title="'+esc(title)+'"' : "")+'>'+esc(t)+'</span>'; }
function wrCardHtml(res,i,rank){
  var c=wrCo(res), v=WR_VERDICT[res.verdict]||WR_VERDICT.good, onBoard=wrRolesAt(res);
  var rating=c? coRating(c) : (res.rating||"");
  var status= c? wrChip("On your list · "+(PRILABEL[coRating(c)]||"Unrated"),"","Already a company on your board") : wrChip("New to your board","warm");
  var who='<ul class="wrwho">'+res.contacts.map(function(p,j){ var x=wrPerson(p);
    /* On People and linked here: a chip. On People with no link to this card: Link. Not on People: Add to People. */
    var act= x && (!c || x.companyId===c.id)? wrChip("On People","strong")
      : '<button type="button" class="linkbtn wrpadd" data-wr="addp:'+i+':'+j+'" title="Only if they would recommend you">'+(x? "Link to "+esc(c.name||res.company) : "Add to People")+'</button>';
    return '<li>'+(p.url? '<a href="'+esc(p.url)+'" target="_blank" rel="noopener">'+esc(p.name)+'</a>' : '<b>'+esc(p.name)+'</b>')+
      '<span>'+esc(p.position||"")+(p.year? ' · since '+esc(p.year) : "")+'</span>'+act+'</li>'; }).join("")+
    (res.nContacts>res.contacts.length? '<li class="wrmore">and '+(res.nContacts-res.contacts.length)+' more there</li>' : "")+'</ul>';
  var roles='';
  onBoard.forEach(function(r){ roles+='<li><a href="#" data-act="role_go" data-id="'+esc(r.id)+'">'+esc(r.title||"Role")+'</a>'+(r.ref? ' <span class="rref">#'+esc(r.ref)+'</span>' : "")+wrChip(WR_STG[r.stage]||r.stage,"code")+'</li>'; });
  var rolesHtml= roles? '<ul class="wrroles">'+roles+'</ul>' :
    '<p class="wrnone">'+(c && (coRating(c)==="high"||coRating(c)==="medium")? "None on your board yet. Its job board is in the sweep, so new roles reach your longlist." : "None on your board yet. Rate it Want it or Would consider and add it, and the sweep checks its job board.")+'</p>';
  var sel='<select class="wrrate" data-wrrate="'+i+'" aria-label="Your rating for '+esc(res.company)+'">'+WR_RATE.map(function(o){
      return '<option value="'+o[0]+'"'+(rating===o[0] || (!o[0] && (rating==="unrated"||!rating))? " selected" : "")+'>'+esc(o[1])+'</option>'; }).join("")+'</select>';
  var add= !c? '<button type="button" class="btn primary sm" data-wr="add:'+i+'">Add company</button>' : "";
  return '<article class="rvcard wrcard'+(res.hidden?" wrhid":"")+'">'+
    '<div class="wrhead"><span class="wrrank">'+rank+'</span><h3>'+(c? '<a href="#" data-act="co_go" data-id="'+esc(c.id)+'">'+esc(c.name||res.company)+'</a>' : esc(res.company))+'</h3>'+
      wrChip(v[0],v[1])+status+(res.sector? '<span class="wrsec">'+esc(res.sector)+'</span>' : "")+'</div>'+
    (res.why? '<p>'+esc(res.why)+'</p>' : "")+(res.summary? '<p class="wrsum">'+esc(res.summary)+'</p>' : "")+
    '<div class="wrcols"><div><h4>Who you know · '+res.nContacts+'</h4><p class="wrpnote">Add only the people who would recommend you.</p>'+who+'</div><div><h4>Roles on your board</h4>'+rolesHtml+'</div></div>'+
    '<div class="rvacts wracts">'+sel+add+'<button type="button" class="linkbtn" data-wr="'+(res.hidden? "unhide" : "hide")+':'+i+'">'+(res.hidden? "Show again" : "Not for me")+'</button></div></article>';
}
function wrResultsHtml(){
  var D=WR.doc; if(!D) return "";
  var list=wrResults().map(function(r,i){ return {r:r,i:i}; }), shown=list.filter(function(x){ return !x.r.hidden; }), hid=list.filter(function(x){ return x.r.hidden; });
  var head='<div class="wrrhead"><div><h3>Your top '+shown.length+' warm routes</h3><p class="statushint">From '+plural(D.nConn||0,"connection")+' at '+plural(D.nCo||0,"company","companies")+', '+esc(niceShort(D.day||""))+'.'+
      (D.note? ' '+esc(D.note) : "")+(D.missed? ' '+plural(D.missed,"company","companies")+" couldn't be looked at this time." : "")+'</p></div>'+
    '</div>';
  var st=wrStale();
  if(st && !WR.busy) head+='<p class="notice wrstale">You\'ve changed your criteria '+plural(st,"time")+' since this list was made. <button type="button" class="linkbtn" data-wr="again">Run it again</button> to refresh it'+(WR.conns? "" : " (choose the file again)")+'.</p>';
  return head+'<div class="stack wrlist">'+shown.map(function(x,k){ return wrCardHtml(x.r,x.i,k+1); }).join("")+'</div>'+
    (hid.length? '<details class="card panel cfold"'+(WR.showHidden? " open" : "")+' data-wrhid><summary>Not for me<span class="cfmeta">'+hid.length+'</span></summary><div class="stack">'+
      hid.map(function(x){ return wrCardHtml(x.r,x.i,"–"); }).join("")+'</div></details>' : "");
}
function renderWarm(){
  var host=el("wr-root"); if(!host || tab!=="warm") return;
  var a=document.activeElement; if(a && host.contains(a) && a.tagName==="SELECT") return;   /* don't redraw under an open rating menu */
  host.innerHTML=wrIntroHtml()+wrStepsHtml()+wrResultsHtml();
}

/* ---------- events ---------- */
function wrFile(file){
  if(!file) return;
  if(!/\.csv$/i.test(file.name||"") && file.type!=="text/csv"){ WR.err="That isn't a .csv file. Unzip the LinkedIn download and choose Connections.csv."; renderWarm(); return; }
  var rd=new FileReader();
  rd.onload=function(){
    var c=wrParse(rd.result);
    if(!c){ WR.conns=null; WR.err="That doesn't look like LinkedIn's Connections.csv: no First Name and Company columns."; renderWarm(); return; }
    if(!c.length){ WR.conns=null; WR.err="The file has no connections in it."; renderWarm(); return; }
    WR.conns=c; WR.file=file.name; WR.nConn=c.length; WR.nCo=wrGroups(c).length; WR.err=""; renderWarm();
  };
  rd.onerror=function(){ WR.err="Couldn't read that file."; renderWarm(); };
  rd.readAsText(file);
}
document.addEventListener("change",function(ev){
  var t=ev.target; if(!t) return;
  if(t.id==="wr-file"){ wrFile(t.files && t.files[0]); return; }
  if(t.dataset && t.dataset.wrrate!=null){ var i=+t.dataset.wrrate; t.blur(); wrRate(i,t.value); }
});
["dragover","dragenter"].forEach(function(n){ document.addEventListener(n,function(ev){ var d=ev.target.closest && ev.target.closest("#wr-drop"); if(!d) return; ev.preventDefault(); d.classList.add("on"); }); });
document.addEventListener("dragleave",function(ev){ var d=ev.target.closest && ev.target.closest("#wr-drop"); if(d) d.classList.remove("on"); });
document.addEventListener("drop",function(ev){ var d=ev.target.closest && ev.target.closest("#wr-drop"); if(!d) return; ev.preventDefault(); d.classList.remove("on");
  wrFile(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]); });
document.addEventListener("toggle",function(ev){ var t=ev.target; if(!t || !t.hasAttribute) return; if(t.hasAttribute("data-wrhid")) WR.showHidden=t.open; if(t.hasAttribute("data-wrfold")) WR.fold=t.open; },true);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-wr]"); if(!b) return;
  ev.preventDefault();
  var v=b.getAttribute("data-wr"), p=v.split(":"), a=p[0];
  if(a==="size"){ WR.size=+p[1]||20; renderWarm(); return; }
  if(a==="go") return wrRun();
  if(a==="again"){ WR.fold=true; renderWarm(); var f=document.querySelector("#wr-root [data-wrfold]"); if(f) f.scrollIntoView({block:"start",behavior:"smooth"}); return; }
  if(a==="add") return wrAdd(+p[1]);
  if(a==="addp") return wrAddOne(+p[1],+p[2]);
  if(a==="hide") return wrPatch(+p[1],{hidden:true});
  if(a==="unhide") return wrPatch(+p[1],{hidden:false});
});
/* Go over an existing list asks first: the new run replaces it. */
CONFIRM.wr_go=function(t){ if(!WR.doc || !wrResults().length) return null;
  return {title:"Replace your current warm routes?", msg:"The new list replaces the one from "+niceShort(WR.doc.day||"")+". Companies and people you already added stay on the board.", ok:"Replace it"}; };

/* ---------- page wiring ---------- */
showTab=(function(orig){ return function(t){ orig(t); var s=el("tab-warm"); if(s) s.hidden=(tab!=="warm"); if(tab==="warm") renderWarm(); }; })(showTab);
render=(function(orig){ return function(){ orig(); if(typeof NRB!=="undefined" && NRB.busy) return; if(tab==="warm"){ try{ renderWarm(); }catch(e){ console.warn("warm routes",e); } } }; })(render);
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.collection("warmroutes").onSnapshot(function(s){
    var d=s.docs.find(function(x){ return x.id==="current"; }); WR.doc=d? d.data() : null; renderWarm();
  },function(e){ console.warn("warmroutes sub",e&&e.code); });
})();
try{ HP_PAGES.forEach(function(g){ if(g.grp!=="Tools") return; var k=g.items.findIndex(function(x){ return x.tab==="people"; });
  g.items.splice(k<0? g.items.length : k+1, 0, {tab:"warm", n:"Warm routes", what:"Upload your LinkedIn connections and get the 10 or 20 companies where you know someone and that fit what you want: who you know there, why it's a match, and any of their roles already on your board.",
    use:["Request all your data from LinkedIn (Settings & Privacy › Data privacy › Get a copy of your data); when it arrives, unzip it and pick Connections.csv from the CSV files.","Rate the ones you like and add the company. Add a contact to People only if they'd recommend you. Want it or Would consider puts its job board in the sweep, so its roles reach your longlist."]}); });
  HP_FAQ.forEach(function(g){ if(g.c!=="Your search setup") return; g.q.push(
    ["How do I find warm routes from my LinkedIn connections?","Open "+'<a href="#" data-gotab="warm">Warm routes</a>'+". Request all your data from LinkedIn (Settings & Privacy › Data privacy › Get a copy of your data), unzip the download, pick Connections.csv from the CSV files, drop it on the page and press Go. Claude picks the 10 or 20 companies where you know someone and that fit your company deal-breakers and preferences, and says why. Rate the ones you like and press Add company: it goes on your list with that rating. Add a contact with Add to People only if they'd recommend you; that links them to the company and marks it as a warm route."],
    ["What does Warm routes send to Claude?","Only company names and your contacts' job titles, plus your criteria. Never names. The file is read in your browser and isn't stored; names are kept only for the companies picked, so the page can show who you know."],
    ["How do roles at a warm-route company reach me?","Through the sweep. Rating a company Want it puts its job board in every sweep, Would consider once a week, so new roles there land on your longlist. Roles already on your board show under the company on the Warm routes page."],
    ["How long does Warm routes take, and can I leave the page?","A few minutes, longer for a big network: Claude looks at every company, a few hundred at a time, then picks the top 10 or 20. Keep the browser tab open. You can use other pages of the board meanwhile, but closing or reloading the tab stops it. Your previous list stays until the new one is ready."],
    ["Can I run Warm routes again after changing my criteria?","Yes. Open Run it again and press Go. While the page stays open your file is still loaded; after a reload, choose Connections.csv again. The new list replaces the old one; companies and people you already added stay on the board. The page tells you when your deal-breakers or preferences have changed since the list was made."],
    ["Does Warm routes know how well I know someone?","No. LinkedIn's export doesn't say. It ranks your contacts by how much their role could help (leaders in your field, talent, founders and executives first). You know which ones you'd actually message, so people are added one at a time with Add to People, never with the company."]); }); }catch(e){}
(function(){ var st=document.createElement("style");
  st.textContent=
  ".wrsteps{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}@media(max-width:900px){.wrsteps{grid-template-columns:1fr}}"+
  ".wrhow{margin:0;padding-left:20px;font-size:13.5px;line-height:1.55;color:var(--ink)}.wrhow li{margin:2px 0}"+
  ".wrdrop{display:flex;flex-direction:column;gap:3px;align-items:center;justify-content:center;text-align:center;border:1.5px dashed var(--line);border-radius:12px;padding:22px 14px;cursor:pointer;background:var(--surface-2)}"+
  ".wrdrop:hover,.wrdrop.on{border-color:var(--accent);background:var(--accent-soft)}.wrdrop b{font-size:14px}.wrdrop span{font-size:12.5px;color:var(--muted)}"+
  ".wrseg{display:inline-flex;gap:4px}.wrerr{color:var(--bad)!important;font-size:13px!important}"+
  ".wrfold{margin:14px 0}.wrfold .wrsteps{margin:10px 0 0}"+
  ".wrrhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:22px 0 12px;flex-wrap:wrap}.wrrhead h3{margin:0 0 3px;font-size:18px}"+
  ".wrlist{gap:12px}.wrhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.wrhead h3{margin:0;font-size:16px}.wrhead h3 a{color:inherit;text-decoration:none}.wrhead h3 a:hover{text-decoration:underline}"+
  ".wrrank{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;min-width:24px;height:24px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent-ink)}"+
  ".wrsec{font-size:12px;color:var(--muted)}.wrsum{color:var(--ink-2)!important;font-size:13px!important}"+
  ".wrcols{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.wrcols{grid-template-columns:1fr}}"+
  ".wrpnote{margin:2px 0 0;font-size:12px;color:var(--muted)}.wrpadd{font-size:12.5px}"+
  ".wrwho,.wrroles{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}"+
  ".wrwho li,.wrroles li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:13px}.wrwho li span,.wrroles li span{color:var(--muted);font-size:12.5px}"+
  ".wrmore{color:var(--muted)}.wrnone{font-size:12.5px!important;color:var(--muted)!important;margin-top:6px!important}"+
  ".wracts{border-top:1px solid var(--line-2);padding-top:10px}.wrrate{width:auto!important;flex:0 0 auto;max-width:100%;font:inherit;font-size:13px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}"+
  ".wrhid{opacity:.75}.wrstale{margin:0 0 12px;font-size:13px}";
  document.head.appendChild(st); })();
