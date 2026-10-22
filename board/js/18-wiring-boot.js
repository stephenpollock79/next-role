"use strict";
/* ---------- wiring ---------- */
var V2T=null;
function v2Paint(){ try{ renderRail(); renderOverview(); renderHygiene(); }catch(e){ console.warn("v2 paint",e); } }
function v2Refresh(){ clearTimeout(V2T); V2T=setTimeout(v2Paint,40); }
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-v2]"); if(!b) return; ev.preventDefault();
  var k=b.dataset.v2;
  if(k==="period") V2.period=b.dataset.v;
  try{ localStorage.setItem("gb.v2",JSON.stringify({period:V2.period, group:V2.group})); }catch(e){}
  v2Paint();
});
try{ var v2s=JSON.parse(localStorage.getItem("gb.v2")||"null"); if(v2s){ if(v2s.period) V2.period=v2s.period; if(v2s.group && DIMLAB[v2s.group]) V2.group=v2s.group; } }catch(e){}
render=(function(orig){ return function(){ orig(); v2Paint(); }; })(render);
renderCounts=(function(orig){ return function(){ orig(); v2Refresh(); }; })(renderCounts);
renderScreened=(function(orig){ return function(){ orig(); v2Refresh(); }; })(renderScreened);
showTab=(function(orig){ return function(t){ orig(t); v2Page(); renderRail(); }; })(showTab);
v2Page();

/* ===================== Manual role intake (2 Oct) =====================
   Spec: project doc claude/manual-role-intake-spec.md. A role you add goes straight to the shortlist. The
   posting is optional (link, spec file, pasted text, any mix, or none); company is required. Roles found
   through Recruiters or Warm routes name the person and whether they have submitted you. Quick check asks
   Claude for a provisional read on every hard rule and a rough fit; the morning run replaces it. */
var AR={fun:null, shot:null, sub:"", qc:null};
var AR_LED={recruiters:1, warm:1};
function arLed(src){ return !!AR_LED[chOfSrc(src||"")]; }
function arVal(id){ var e=el(id); return e? String(e.value||"").trim() : ""; }
function arHint(m){ var h=el("ar-hint"); if(h) h.textContent=m||""; }
function arScores(){
  ["fun","shot"].forEach(function(k){ var v=AR[k], box=el("ar-"+k); if(!box) return;
    box.innerHTML=[1,2,3,4,5].map(function(n){ return '<button type="button" data-arsc="'+k+'" data-n="'+n+'" aria-pressed="'+(v===n)+'">'+n+'</button>'; }).join(""); });
}
function arPeople(){
  var sel=el("ar-person"); if(!sel) return; var cur=sel.value;
  /* People at the chosen firm first (2 Oct), so picking a person means picking their firm, then them. */
  var firm=el("add-sp")? spFirmName("add") : "", fl=firm.toLowerCase(), fs=slug(firm);
  var all=people.slice().sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));});
  function opt(p){ return '<option value="'+esc(p.id)+'">'+esc((p.name||p.id)+(p.role? " — "+p.role : "")+(ppCo(p)? " · "+ppCo(p) : ""))+'</option>'; }
  var at=firm? all.filter(function(p){ return String(ppCo(p)).toLowerCase()===fl || p.companyId===fs; }) : [];
  var rest=all.filter(function(p){ return at.indexOf(p)<0; });
  sel.innerHTML='<option value="">Choose…</option><option value="__new">+ New person'+(firm? " at "+esc(firm) : "")+'</option>'+
    (at.length? '<optgroup label="At '+esc(firm)+'">'+at.map(opt).join("")+'</optgroup><optgroup label="Everyone else">'+rest.map(opt).join("")+'</optgroup>' : rest.map(opt).join(""));
  if(cur){ sel.value=cur; if(sel.value!==cur) sel.value=""; }
  el("ar-np").hidden = sel.value!=="__new";
}
function arLedPaint(){ var b=el("ar-pblock"); if(b) b.hidden=!arLed(el("add-src")&&el("add-src").value); }
function arReset(clear){
  if(clear!==false || !el("ar-person").options.length){
    ["add-url","ar-paste","add-title","add-co","ar-note","ar-npname","ar-nprole"].forEach(function(k){ var e=el(k); if(e) e.value=""; });
    var f=el("ar-file"); if(f) f.value="";
    AR={fun:null, shot:null, sub:"", qc:null};
    el("ar-qcout").innerHTML=""; el("ar-person").value="";
    Array.prototype.forEach.call(document.querySelectorAll("[data-arsub]"),function(b){ b.setAttribute("aria-pressed","false"); });
  }
  el("ar-colist").innerHTML=companies.map(function(c){ return '<option value="'+esc(c.name||c.id)+'">'; }).join("");
  arPeople(); arScores(); arLedPaint();
  el("ar-filewrap").hidden=!ASSETS; el("ar-filenote").hidden=!!ASSETS;
  el("ar-qcwrap").hidden=!SAMPLE;
  arHint("");
}
function arCompany(name){
  var n=String(name||"").trim(), sl=slug(n), lo=n.toLowerCase();
  return companies.find(function(c){ return String(c.name||"").toLowerCase()===lo || c.id===sl || (c.aka && slug(c.aka)===sl); }) || null;
}
/* Same file rules as interview materials, so the wording and limits never drift apart. */
function arFileCheck(file){
  if(!file) return "";
  if(!ASSETS) return "Files can’t be uploaded in this view — paste the text or add a link.";
  var ext=String(file.name.split(".").pop()||"").toLowerCase(), isWord=ext==="docx";
  if(!MA_TYPES[ext] && !isWord) return /^pptx?$|^key$/.test(ext)? "PowerPoint files can’t be stored. Export it as a PDF and upload that." :
    ext==="doc"? "Older .doc files can’t be converted. Save it as .docx or PDF." : "That kind of file can’t be stored — use a PDF, image, Markdown, text or Word file.";
  if(isWord && file.size>MA_WORD_MAX) return "That Word file is over 20 MB — too big to convert here. Paste the text instead.";
  if(!isWord && file.size>MA_MAXFILE) return "That file is over 5 MB — too big for the board. Paste the text instead.";
  return "";
}
async function arUpload(file){
  var blob=file, name=file.name, type=MA_TYPES[String(file.name.split(".").pop()).toLowerCase()], conv=null;
  if(/\.docx$/i.test(file.name)){
    arHint("Converting the Word file…");
    var md=await maWordToMd(file); if(!md.trim()) throw {code:"empty_convert"};
    name=file.name.replace(/\.docx$/i,"")+".md"; type="text/markdown"; blob=new Blob([md],{type:type});
    if(blob.size>MA_MAXFILE) throw {code:"too_large"};
    conv={from:"docx", name:file.name, size:file.size};
  }
  arHint("Uploading the spec…");
  var up=await ASSETS.upload(blob,{type:type});
  var spec={id:up.id, name:name, size:up.sizeBytes||blob.size, type:up.contentType||type};
  if(conv) spec.converted=conv;
  return spec;
}
async function arSave(){
  if(!DB) return arHint("Stored data isn’t available in this view, so nothing can be saved.");
  var url=arVal("add-url"), title=arVal("add-title"), co=arVal("add-co"), src=el("add-src").value||"";
  var paste=arVal("ar-paste"), note=arVal("ar-note"), fi=el("ar-file"), file=fi && fi.files && fi.files[0];
  if(!title){ el("add-title").focus(); return arHint("It needs a title."); }
  if(!co){ el("add-co").focus(); return arHint("It needs a company. If they won’t name it yet, add a task on the person’s card to ask, and add the role once you know."); }
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;
  var led=arLed(src), pid=led? el("ar-person").value : "", npName=arVal("ar-npname");
  if(spNewName("add")===""){ spQ("add","new").focus(); return arHint("Give the new "+spNoun(chById(chOfSrc(src)))+" a name."); }
  if(led && !pid){ el("ar-person").focus(); return arHint("Who is it from? Pick the recruiter or contact, or add them."); }
  if(led && pid==="__new" && !npName){ el("ar-npname").focus(); return arHint("Give the new person a name."); }
  var bad=arFileCheck(file); if(bad) return arHint(bad);
  var btn=el("add-save"); btn.disabled=true; var spec=null;
  try{
    var firm=spFirmName("add");
    src=await spResolve("add");
    spec=file? await arUpload(file) : null;
    arHint("Saving…");
    var c=arCompany(co), coId=c? c.id : slug(co);
    if(led && pid==="__new"){
      var base=slug(npName), nid=base, k=2; while(people.some(function(x){return x.id===nid;})) nid=base+"-"+(k++);
      await DB.doc("people/"+nid).set({name:npName, role:arVal("ar-nprole"), how:chOfSrc(src)==="recruiters"? "agency recruiter" : "", companyId:"", company:chOfSrc(src)==="recruiters"? firm : "", linkedin:"", note:"", addedAt:today()});
      pid=nid;
    }
    var doc={title:title, company:c? (c.name||co) : co, companyId:coId, url:url, source:"self", seen:today(), stage:"proposed",
      addedVia:"form", sourceId:src, channelId:chOfSrc(src), readState:(url||spec||paste)? "waiting" : "", readTries:0, readReason:"",
      pasted:paste, intakeNote:note, titleGuess:false, linkChecked:"", linkMethod:"",
      fun:AR.fun, shot:AR.shot, highlights:[], green:[], red:[], enrich:{}, referral:""};
    if(spec) doc.spec=spec;
    if(led){ doc.contact={personId:pid, submitted:AR.sub||"unknown"};
      /* No link: the person's word is the liveness check, dated, with its method (spec decision 9). */
      if(!url){ doc.linkChecked=today(); doc.linkMethod="recruiter"; } }
    if(AR.qc){ doc.enrich={gate2Rules:AR.qc.rules, rulesFrom:"quick"};
      if(AR.qc.fit!=null){ var fb=fitBand(AR.qc.fit); doc.fit={pct:AR.qc.fit, band:fb[1], rough:true, basis:"quick", at:today(), reqs:[], note:AR.qc.fitNote||""}; }
      if(AR.qc.summary) doc.quickSummary=AR.qc.summary; }
    var id=slug(coId+"-"+title)+"-"+Date.now().toString(36).slice(-4);
    await DB.doc("roles/"+id).set(doc);
    arReset(true); closeDlg("add-dialog"); toast("Added to the longlist");
  }catch(e){
    if(spec && spec.id && ASSETS) ASSETS.delete(spec.id).catch(function(){});   /* no orphaned upload (QA 14 Oct) */
    var cd=e&&e.code;
    arHint(cd==="convert_failed"||cd==="empty_convert"? "Couldn’t read that Word file. Save it as a PDF and upload that instead." :
      cd==="too_large"? "That file is too big for the board. Paste the text instead." :
      cd==="quota_or_state"? "The board’s file storage is full — paste the text instead." :
      "Not saved — "+(cd||"the write failed")+". Your entries are still here.");
  }finally{ btn.disabled=false; }
}
function arQcClear(){ if(AR.qc){ AR.qc=null; el("ar-qcout").innerHTML='<p class="statushint" style="margin:0">Changed since the check — run it again if you want it saved with the role.</p>'; } }
async function arQuick(){
  var out=el("ar-qcout"), btn=el("ar-qc");
  if(!SAMPLE){ out.innerHTML='<p class="statushint">Asking Claude isn’t available in this view.</p>'; return; }
  var title=arVal("add-title"), co=arVal("add-co"); if(!title||!co){ arHint("Add the title and company first."); return; }
  var rules=((PREFS&&PREFS.hardRules)||[]).filter(function(x){return x&&x.id;});
  if(!rules.length){ out.innerHTML='<p class="statushint">Your hard rules haven’t loaded yet — try again in a moment.</p>'; return; }
  var fi=el("ar-file"), file=fi && fi.files && fi.files[0], ftext="", fnote="";
  btn.disabled=true; out.innerHTML='<p class="statushint">Checking…</p>';
  try{
    if(file){ var ext=String(file.name.split(".").pop()||"").toLowerCase();
      if(ext==="docx") ftext=await maWordToMd(file);
      else if(ext==="md"||ext==="txt") ftext=await file.text();
      else fnote="Quick check doesn’t read PDFs or images yet. Paste the text if you want it in the check; the morning run reads the file either way."; }
    var body=[arVal("ar-paste"), ftext].filter(Boolean).join("\n\n").slice(0,14000), note=arVal("ar-note");
    var sk=((SKILLS&&SKILLS.items)||[]).slice(0,20).map(function(x){ return "- "+x.name+" ("+(x.level||"")+"): "+clip(x.evidence||"",140); }).join("\n");
    var prompt="A job seeker is adding a role to their shortlist by hand and wants a quick provisional read before the full research runs tomorrow.\n\n"+
      "Their hard rules (id | name | rule):\n"+rules.map(function(x){ return x.id+" | "+(x.name||"")+" | "+clip(x.rule||"",300); }).join("\n")+
      "\n\nStanding rule: absence of data never fails a hard rule. If the text doesn't settle a rule, the result is unknown.\n\n"+
      "Who the user is: "+clip((PROFILE&&(PROFILE.headline||PROFILE.profession))||"(no profile on the board yet)",400)+(PROFILE&&PROFILE.location? "\nBased in: "+PROFILE.location : "")+"\nTheir top skills:\n"+(sk||"(not loaded)")+
      "\n\nThe role: "+title+" at "+co+(arVal("add-url")? "\nLink (not fetched): "+arVal("add-url") : "")+
      (note? "\nTheir notes: "+clip(note,1500) : "")+(body? "\nPosting text:\n"+body : "\n(No posting text — title, company and notes only.)")+
      '\n\nReply with JSON only: {"rules":[{"id":"<rule id>","result":"pass|fail|unknown","why":"<a few words, from the text>"}],'+
      '"fit":<0-100 how well their CV matches what the role asks for, or null if there is too little to judge>,"fitNote":"<one short sentence>","summary":"<one sentence on what the job is>"}. Include every rule id.';
    var j = SAMPLE.json? await SAMPLE.json([{role:"user",content:prompt}],{cache:false, modelTier:"default"})
      : await SAMPLE([{role:"user",content:prompt}],{cache:false, modelTier:"default"}).then(function(x){ var m=String(x.text||"").match(/\{[\s\S]*\}/); return m? JSON.parse(m[0]) : {}; });
    var got={}, why={}; ((j&&j.rules)||[]).forEach(function(x){ if(x && x.id) { got[x.id]=/^(pass|fail)$/.test(x.result)? x.result : "unknown"; why[x.id]=x.why||""; } });
    var res={}; rules.forEach(function(x){ res[x.id]=got[x.id]||"unknown"; });
    var fit=(j && j.fit!=null && !isNaN(+j.fit))? Math.max(0,Math.min(100,Math.round(+j.fit))) : null;
    AR.qc={rules:res, why:why, fit:fit, fitNote:(j&&j.fitNote)||"", summary:(j&&j.summary)||""};
    var ids=Object.keys(res), fails=ids.filter(function(k){return res[k]==="fail";}), unk=ids.filter(function(k){return res[k]==="unknown";}), pass=ids.length-fails.length-unk.length;
    function row(k,cls,lab){ return '<div class="qcrow"><span class="chip '+cls+'">'+lab+'</span><span><b style="font-weight:500">'+esc(k+" ("+ruleName(k)+")")+'</b>'+(why[k]? ' <span class="qcwhy">— '+esc(why[k])+'</span>' : "")+'</span></div>'; }
    var fb=fit!=null? fitBand(fit) : null;
    out.innerHTML='<div class="qcbox">'+(AR.qc.summary? '<p style="margin:0">'+esc(AR.qc.summary)+'</p>' : "")+
      '<div class="qcrow"><span class="chip '+(fb? fb[2] : "")+'">'+(fb? "~"+fit+"%" : "Fit ?")+'</span><span>'+(fb? "Rough fit · "+esc(fb[1]) : "Too little to judge the fit")+(AR.qc.fitNote? ' <span class="qcwhy">— '+esc(AR.qc.fitNote)+'</span>' : "")+'</span></div>'+
      fails.map(function(k){return row(k,"weak","Fails");}).join("")+unk.map(function(k){return row(k,"","Unknown");}).join("")+
      '<p class="statushint" style="margin:0">'+pass+' pass. Provisional: it’s saved with the role and the morning run replaces it. Nothing is rejected; you decide.</p>'+
      (fnote? '<p class="statushint" style="margin:0">'+esc(fnote)+'</p>' : "")+'</div>';
  }catch(e){
    out.innerHTML='<p class="statushint">'+esc(e&&e.code==="not_granted"? "Claude wasn’t allowed to check — allow it when asked, then try again." : e&&e.code==="convert_failed"? "Couldn’t read that Word file." : "Couldn’t run the check — try again.")+'</p>';
  }finally{ btn.disabled=false; }
}
el("ar-qc").addEventListener("click",arQuick);
el("add-src").addEventListener("change",function(){ arLedPaint(); arPeople(); });
el("add-co").addEventListener("input",function(){ if(el("add-sp")) spPickSync("add"); });
el("ar-person").addEventListener("change",function(){ el("ar-np").hidden=this.value!=="__new"; if(this.value==="__new") el("ar-npname").focus(); });
["add-url","ar-paste","add-title","add-co","ar-note"].forEach(function(k){ el(k).addEventListener("input",arQcClear); });
el("ar-file").addEventListener("change",arQcClear);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-arsc],[data-arsub]"); if(!b) return;
  if(b.dataset.arsc){ var k=b.dataset.arsc, n=+b.dataset.n; AR[k]= AR[k]===n? null : n; arScores(); return; }
  AR.sub=b.dataset.arsub;
  Array.prototype.forEach.call(document.querySelectorAll("[data-arsub]"),function(x){ x.setAttribute("aria-pressed",String(x===b)); });
});

/* ---------- on the card: posting, liveness, To score ---------- */
/* Collapsed row (2 Oct): the Fun and Shot pips themselves, clickable without opening the card,
   on every list stage, desktop only. Phones keep the "To score" chip on unscored shortlist roles.
   Fields follow the card's own scorer: the longlist writes fun/shot; later stages write fun/shot the first
   time and fun2/shot2 (a dated re-score kept beside it) after that. Same data-act="score" handler. */
var MIX_CHIP_ST={proposed:1, consideration:1, parked:1, prep:1, applied:1, offer:1};
function rowPips(id,f,v){
  var h=''; for(var i=1;i<=5;i++) h+='<button type="button" data-act="score" data-id="'+esc(id)+'" data-f="'+f+'" data-v="'+i+'" aria-pressed="'+(v===i)+'" aria-label="'+(f.indexOf("fun")===0?"Fun":"Shot")+' '+i+'">'+i+'</button>';
  return '<span class="pips">'+h+'</span>';
}
function scoreChipOf(r){
  if(!MIX_CHIP_ST[r.stage]) return "";
  var c=curScores(r), un=(c.f==null||c.s==null);
  var first = r.stage==="proposed" || (r.fun==null && r.shot==null);
  var ff=first? "fun" : "fun2", sf=first? "shot" : "shot2";
  var chip = un && (r.stage==="consideration"||r.stage==="parked")? '<span class="chip mid scorechip mobonly" title="Fun or Shot missing — score it on the card">To score</span>' : "";
  return chip+'<span class="fspips" title="'+esc(un? "Not scored yet" : mixLabel(quadOf(c.f,c.s)))+'">'+
    '<span class="fsr"><span class="lab">Fun</span>'+rowPips(r.id,ff,c.f)+'</span>'+
    '<span class="fsr"><span class="lab">Shot</span>'+rowPips(r.id,sf,c.s)+'</span></span>';
}
/* A button inside <summary> toggles the card unless the default is cancelled; the click still reaches
   the main handler. */
document.addEventListener("click",function(ev){ if(ev.target.closest && ev.target.closest(".fspips")) ev.preventDefault(); },true);
/* Person-led roles with no link: confirmed with the person, stale after 14 days. A Still live press, a
   meeting with them or notes about the role all count as a fresh confirmation. */
function liveInfo(r){
  if(!r || r.url) return null;
  var ct=r.contact||{}; if(!ct.personId && r.linkMethod!=="recruiter") return null;
  var p=ct.personId? people.find(function(x){return x.id===ct.personId;}) : null, nm=p? String(p.name||"") : "", lo=nm.toLowerCase(), t=today();
  var ds=[]; if(r.linkMethod==="recruiter" && r.linkChecked) ds.push(r.linkChecked);
  commitments.forEach(function(c){ if(!c.date || c.date>t || mtItem(c)==="task") return;
    if((c.personIds||[]).indexOf(ct.personId)>=0 || (lo && String(c.person||"").toLowerCase().indexOf(lo)>=0)) ds.push(c.date); });
  conversations.forEach(function(v){ if(!v.date || v.date>t) return;
    if(v.roleId===r.id || (lo && String(v.who||"").toLowerCase().indexOf(lo)>=0)) ds.push(v.date); });
  var last=ds.sort().pop()||"", gap=last? dayGap(last,t) : null;
  return {name:nm||"the recruiter", personId:ct.personId||"", last:last, stale: gap==null || gap>14};
}
function liveChipOf(r){
  var L=liveInfo(r); if(!L || !L.stale || !(LIVE_ST[r.stage])) return "";
  return '<span class="chip weak livechip" title="No link, so the role is live on their word — last confirmed '+esc(L.last? niceShort(L.last) : "never")+'">Confirm with '+esc(L.name.split(" ")[0])+'</span>';
}
function postingCell(r){
  var v;
  if(r.url) v='<a href="'+esc(r.url)+'" target="_blank" rel="noopener">Job ad · '+esc(hostOf(r.url))+'</a>';
  else if(r.spec && r.spec.id) v=assetLink(r.spec,"Job spec · "+esc(r.spec.name||"file"),"","Job spec \u2014 "+(r.company||""));
  else if(r.pasted) v="Posting pasted";
  else v='<span style="color:var(--faint)">None — from a conversation</span>';
  return '<div class="fact"><div class="k">Posting</div><div class="v">'+v+'</div></div>';
}
function liveCell(r){
  var out="", L=liveInfo(r), ct=r.contact;
  if(L) out+='<div class="fact"><div class="k">Live</div><div class="v livebox">'+
    (L.stale? '<span class="chip weak">Confirm with '+esc(L.name)+'</span>' : '<span class="chip strong">Confirmed by '+esc(L.name)+', '+esc(niceShort(L.last))+'</span>')+
    '<button type="button" class="btn sm" data-act="live_still" data-id="'+esc(r.id)+'" title="'+esc(L.name)+' says it’s still open">Still live</button></div></div>';
  if(ct && ct.personId){ var p=people.find(function(x){return x.id===ct.personId;});
    out+='<div class="fact"><div class="k">They’ve submitted me</div><div class="v">'+esc({yes:"Yes",no:"No",unknown:"Don’t know"}[ct.submitted]||"Don’t know")+(p? ' · '+esc(p.name) : "")+'</div></div>'; }
  return out;
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="live_still"]'); if(!b) return;
  ev.preventDefault(); save(b.dataset.id,{linkChecked:today(), linkMethod:"recruiter"});
});

/* ---------- possible matches: an advert that looks like a role you added ---------- */
function matchPairs(){
  function live(r){ return !DEAD[r.stage] && r.stage!=="closed"; }
  function ck(r){ return r.companyId || slug(r.company||""); }
  function nt(t){ return slug(String(t||"").replace(/\bsr\b\.?/i,"senior")); }
  var mine=rawRoles.filter(function(r){ return r.source==="self" && live(r); }), out=[], seen={};
  rawRoles.forEach(function(b){ if(!live(b)) return;
    mine.forEach(function(a){
      if(a.id===b.id || (a.notSameAs||[]).indexOf(b.id)>=0 || seen[a.id+"|"+b.id]) return;
      var hit = b.maybeSameAs===a.id || (!a.url && b.url && b.source!=="self" && ck(a)===ck(b) && nt(a.title)===nt(b.title));
      if(hit){ seen[a.id+"|"+b.id]=1; out.push({a:a,b:b}); }
    }); });
  return out;
}
document.addEventListener("click",function(ev){
  var t=ev.target.closest && ev.target.closest('[data-act="pm_merge"],[data-act="pm_not"]'); if(!t || !DB) return;
  ev.preventDefault();
  var a=rawRoles.find(function(x){return x.id===t.dataset.id;}), b=rawRoles.find(function(x){return x.id===t.dataset.cid;}); if(!a||!b) return;
  if(t.dataset.act==="pm_not"){
    DB.doc("roles/"+a.id).update({notSameAs:(a.notSameAs||[]).concat([b.id])}).catch(function(e){ console.warn(e); });
    if(b.maybeSameAs===a.id) DB.doc("roles/"+b.id).update({maybeSameAs:""}).catch(function(e){ console.warn(e); });
    return;
  }
  var patch={url:b.url||"", linkChecked:b.linkChecked||"", linkMethod:b.linkMethod||"", mergedFrom:b.id, mergedAt:today()};
  ["closing","location","office","salary","postingAge"].forEach(function(f){ if(!a[f] && b[f]) patch[f]=b[f]; });
  if(!a.pasted && !(a.spec&&a.spec.id) && !((a.enrich||{}).summary)) { patch.readState="waiting"; patch.readTries=0; patch.readReason=""; }
  DB.doc("roles/"+a.id).update(patch).then(function(){ return DB.doc("roles/"+b.id).delete(); })
    .catch(function(e){ console.warn("merge",e); toast("Couldn't merge — try again",true); });
});

/* ---------- funnel counts: All / On me (2 Oct) ----------
   All = how many roles sit in each stage (renderCounts' own numbers).
   On me = only those waiting on Feedback: the whole longlist (each needs a review), then the same items
   as the rail's Needs you, grouped by stage — so the On me numbers and Needs you always agree.
   The choice is per viewer, kept in localStorage. */
/* The All / On me toggle is gone (2 Oct): each chevron shows the total and, under it, what is on
   you. FUNNEL_MODE stays "all" so the count code below keeps working. */
var FUNNEL_MODE="all";
function funnelMine(){
  var n={gate1:roles.filter(function(r){return r.stage==="proposed";}).length, gate2:0, toapply:0, inplay:0};
  needsYou().forEach(function(x){ if(n[x.tab]!=null && x.tab!=="gate1") n[x.tab]++; });
  return n;
}
function paintFunnelMode(){
  Array.prototype.forEach.call(document.querySelectorAll("[data-fmode]"),function(b){ b.setAttribute("aria-pressed", String(b.dataset.fmode===FUNNEL_MODE)); });
  var nav=el("tabs"); if(nav) nav.dataset.fmode=FUNNEL_MODE;
  /* Closed: the total in All; nothing in On me, since nothing there waits on you (2 Oct). */
  var tcr=el("tc-rejected"); if(tcr){ var nc=FUNNEL_MODE==="me"? 0 : closedTotal(); tcr.textContent=nc? String(nc) : ""; tcr.classList.add("quiet"); }
  if(FUNNEL_MODE!=="me") return;
  var n=funnelMine();
  ["gate1","gate2","toapply","inplay"].forEach(function(k){
    var b=el("tc-"+k); if(!b) return;
    b.textContent = n[k]? String(n[k]) : "";
    b.classList.remove("quiet");
    b.title = n[k]? (n[k]+" waiting on you") : "";
  });
}
renderCounts=(function(orig){ return function(){ orig(); paintFunnelMode(); }; })(renderCounts);
/* The phone section pill shows the number on you (4 Oct), so it re-syncs once the counts are painted. */
renderCounts=(function(orig){ return function(){ orig(); if(typeof syncTabSel==="function") syncTabSel(); }; })(renderCounts);
/* The "on you" line in each chevron. */
function paintOnYou(){
  var n=funnelMine();
  ["gate1","gate2","toapply","inplay"].forEach(function(k){
    var y=el("ty-"+k); if(!y) return;
    y.textContent = n[k]? n[k]+" on you" : "none on you";
    y.classList.toggle("on", !!n[k]);
  });
}
renderCounts=(function(orig){ return function(){ orig(); paintOnYou(); }; })(renderCounts);
/* Every funnel badge shows a number, 0 included, in grey (2 Oct): steadier and clearer than a gap. */
renderCounts=(function(orig){ return function(){ orig();
  ["gate1","gate2","toapply","inplay","rejected"].forEach(function(k){
    var b=el("tc-"+k); if(!b) return;
    if(b.textContent===""){ b.textContent="0"; b.classList.add("quiet"); b.classList.remove("hot"); }
    else if(k==="gate1" && FUNNEL_MODE!=="me") b.classList.remove("quiet");
  });
}; })(renderCounts);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-fmode]"); if(!b) return;
  ev.preventDefault();
  FUNNEL_MODE = b.dataset.fmode==="me"? "me" : "all";
  try{ localStorage.setItem("nr-funnel-mode",FUNNEL_MODE); }catch(e){}
  renderCounts();
});

/* ---------- Mix filter on the four list stages (2 Oct) ----------
   A Mix dropdown beside Sort, a note above the list while it's on, and the rail's Mix boxes and insight
   count as shortcuts. Per stage, and not remembered on reload: a forgotten filter hiding roles is worse
   than one more click. It filters through sortRoles, which every list stage already calls, so the
   Longlist filters its batch of 30 after the batch is picked. Same quadrant rules as the grid. */
var MIXF={};
var MIXQ=[["hh","Apply, priority"],["hl","Stretch bets"],["lh","Safe fallbacks"],["ll","Do not apply"],["un","Unscored"]];
var MIX_TABS={gate1:1, gate2:1, toapply:1, inplay:1};
function mixKeyOf(r){ var c=curScores(r); return (c.f==null || c.s==null)? "un" : quadOf(c.f,c.s); }
function mixLabel(k){ var m=MIXQ.filter(function(x){return x[0]===k;})[0]; return m? m[1] : ""; }
function mixFilter(t,list,get){
  var k=MIX_TABS[t] && MIXF[t]; if(!k) return list;
  get=get||function(x){return x;};
  return list.filter(function(x){ return mixKeyOf(get(x))===k; });
}
sortRoles=(function(orig){ return function(t,list,get){ return mixFilter(t, orig(t,list,get), get); }; })(sortRoles);
var MIX_WHERE={gate1:"on the longlist", gate2:"on the shortlist", toapply:"in To apply", inplay:"in Applied"};
function mixRolesOf(t){ var M=MIX_STAGES[t]; return M? roles.filter(function(r){ return M.st.indexOf(r.stage)>=0; }) : []; }
function mixCounts(t){
  var c={hh:0,hl:0,lh:0,ll:0,un:0, all:0};
  mixRolesOf(t).forEach(function(r){ c[mixKeyOf(r)]++; c.all++; });
  return c;
}
function paintMixbars(){
  Array.prototype.forEach.call(document.querySelectorAll("[data-mixbar]"),function(box){
    var t=box.dataset.mixbar, cur=MIXF[t]||"", c=mixCounts(t);
    /* Counts in the options; empty ones disabled, so a filter never starts out empty (2 Oct). */
    box.innerHTML='<label class="sortbar"><span>Mix</span><select data-mixtab="'+t+'" aria-label="Filter by Fun and Shot mix">'+
      '<option value="">All ('+c.all+')</option>'+MIXQ.map(function(o){
        return '<option value="'+o[0]+'"'+(!c[o[0]] && cur!==o[0]? " disabled" : "")+(cur===o[0]? " selected" : "")+'>'+esc(o[1])+' ('+c[o[0]]+')</option>'; }).join("")+'</select></label>';
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-mixnote]"),function(n){
    var t=n.dataset.mixnote, k=MIXF[t], c=mixCounts(t);
    n.hidden=!k;
    if(k) n.innerHTML='Showing '+c[k]+' of '+c.all+': <b>'+esc(mixLabel(k))+'</b>. <button type="button" class="linkbtn" data-mixclear="'+t+'">Show all ×</button>';
  });
}
var MIX_MEANING={
  hh:"None you'd enjoy and could win. That's what the next sweep should find.",
  hl:"No stretch bets here.", lh:"No safe fallbacks here.",
  ll:"Nothing you scored low on both.", un:"Everything here is scored."
};
/* After the lists render: one filtered empty state in place of the stage's own empty message, and the
   Parked section hidden when nothing parked is showing (nothing parked at all, or nothing matching the filter). */
function mixEmpty(){
  ["gate1","gate2","toapply","inplay"].forEach(function(t){
    var k=MIXF[t], host=el({gate1:"g1-list", gate2:"g2-list", toapply:"toapply-list", inplay:"inplay-list"}[t]); if(!host) return;
    if(t==="gate2"){
      var pl=el("park-list"), ph=pl && pl.previousElementSibling;
      /* No filter: shown only when something is parked (22 Oct); no "Nothing parked" card on an empty section. */
      var pn=k? roles.filter(function(r){ return r.stage==="parked" && mixKeyOf(r)===k; }).length : (pl && !pl.querySelector(".card.empty")? 1 : 0);
      if(pl) pl.hidden=!pn; if(ph) ph.hidden=!pn;
    }
    if(!k) return;
    var main = t==="gate2"? roles.filter(function(r){ return r.stage==="consideration" && mixKeyOf(r)===k; }).length : mixCounts(t)[k];
    if(main) return;
    var c=mixCounts(t), alts=MIXQ.filter(function(o){ return o[0]!==k && c[o[0]]; });
    var parkedN = t==="gate2"? roles.filter(function(r){ return r.stage==="parked" && mixKeyOf(r)===k; }).length : 0;
    host.innerHTML='<div class="card empty mixempty"><b>No '+esc(mixLabel(k))+' roles '+MIX_WHERE[t]+'.</b>'+
      (parkedN? (parkedN===1? "1 is parked, below." : parkedN+" are parked, below.") : esc(MIX_MEANING[k]||""))+
      '<div class="mixalt">'+alts.map(function(o){ return '<button type="button" class="cof" data-mixset="'+t+':'+o[0]+'">'+esc(o[1])+' · '+c[o[0]]+'</button>'; }).join("")+
      '<button type="button" class="linkbtn" data-mixclear="'+t+'">Show all</button></div></div>';
  });
}
function setMix(t,k){ if(!MIX_TABS[t]) return; if(k) MIXF[t]=k; else delete MIXF[t]; render(); }
render=(function(orig){ return function(){ paintMixbars(); orig(); mixEmpty(); }; })(render);
document.addEventListener("change",function(ev){
  var s=ev.target.closest && ev.target.closest("[data-mixtab]"); if(!s) return;
  setMix(s.dataset.mixtab, s.value);
});
function mixClick(ev){
  var c=ev.target.closest && ev.target.closest("[data-mixclear]");
  if(c){ ev.preventDefault(); setMix(c.dataset.mixclear,""); return; }
  var ms=ev.target.closest && ev.target.closest("[data-mixset]");
  if(ms){ ev.preventDefault(); var p=ms.dataset.mixset.split(":"); setMix(p[0],p[1]); return; }
  var q=ev.target.closest && ev.target.closest("[data-mixq]"); if(!q || !MIX_TABS[tab]) return;
  ev.preventDefault();
  setMix(tab, MIXF[tab]===q.dataset.mixq? "" : q.dataset.mixq);
}
document.addEventListener("click",mixClick);
document.addEventListener("keydown",function(ev){ if((ev.key==="Enter"||ev.key===" ") && ev.target.matches && ev.target.matches(".qm[data-mixq]")) mixClick(ev); });

/* ---------- vertical scroll: pinned header heights and the rail (2 Oct) ----------
   --hdr and --ph feed the sticky page header and Longlist toolbar. railPin keeps the rail in view without
   an inner scroll: if it fits, it sits under the header; if not, its top moves with the page between
   "top in view" and "bottom in view", following the scroll direction (the X / Facebook sidebar pattern). */
var RAILPIN={cur:null, last:0, raf:0};
function layoutVars(){
  var root=document.documentElement, h=document.querySelector("header.top");
  var hh=h? Math.round(h.getBoundingClientRect().height/pgZoom()) : 0;
  root.style.setProperty("--hdr", hh+"px");
  var sec=el("tab-"+tab), ph=sec && sec.querySelector(":scope > .pagehead");
  /* Include the gap under the page header (4 Oct): the toolbar pins below it and the header's shadow covers
     the gap, so cards no longer show through between the two while scrolling. */
  var phm=ph? Math.round(parseFloat(getComputedStyle(ph).marginBottom)||0) : 0;
  root.style.setProperty("--ph", (ph? ph.offsetHeight+phm : 0)+"px"); root.style.setProperty("--phm", phm+"px");
  /* The page's own top padding: sticky things pin exactly where they already sit, so nothing moves. */
  var mw=document.querySelector(".mainwrap"), pt=mw? Math.round(parseFloat(getComputedStyle(mw).paddingTop)||0) : 22;
  root.style.setProperty("--pt", pt+"px");
  RAILPIN.pt=pt;
  return hh;
}
/* + New lines up with the right edge of the page's content (2 Oct): the rail on list pages, the
   section itself elsewhere. Desktop only; phones and mid widths keep the header's own layout. */
function alignNew(){
  var nm=el("newmenu"); if(!nm) return;
  nm.style.marginRight="";
  if(!window.matchMedia("(min-width:1100px)").matches) return;
  var sec=el("tab-"+tab), rr=el("wrail"), right=0;
  if(sec && !sec.hidden) right=sec.getBoundingClientRect().right;
  if(rr && getComputedStyle(rr).display!=="none" && rr.offsetWidth) right=Math.max(right, rr.getBoundingClientRect().right);
  if(!right) return;
  var d=nm.getBoundingClientRect().right-right;
  if(d>0) nm.style.marginRight=Math.round(d/pgZoom())+"px";
}
function railPin(){
  alignNew();
  var r=el("wrail"); if(!r) return;
  var hh=layoutVars();
  if(document.body.dataset.page!=="rail" || !window.matchMedia("(min-width:1600px)").matches){ r.style.top=""; RAILPIN.cur=null; return; }
  var top0=hh+(RAILPIN.pt!=null? RAILPIN.pt : 22), z=pgZoom(), min=window.innerHeight/z-r.offsetHeight-16, y=window.scrollY/z, d=y-RAILPIN.last;
  RAILPIN.last=y;
  if(min>=top0 || RAILPIN.cur==null) RAILPIN.cur=top0;
  else RAILPIN.cur=Math.max(min, Math.min(top0, RAILPIN.cur-d));
  r.style.top=RAILPIN.cur+"px";
}
function railPinSoon(){ if(RAILPIN.raf) return; RAILPIN.raf=requestAnimationFrame(function(){ RAILPIN.raf=0; railPin(); }); }
window.addEventListener("scroll", railPinSoon, {passive:true});
window.addEventListener("resize", railPinSoon);
if(window.ResizeObserver){ var railRO=new ResizeObserver(railPinSoon); var wr0=el("wrail"); if(wr0) railRO.observe(wr0);
  var hd0=document.querySelector("header.top"); if(hd0) railRO.observe(hd0); }
render=(function(orig){ return function(){ orig(); railPinSoon(); }; })(render);
showTab=(function(orig){ return function(t){ RAILPIN.cur=null; orig(t); railPinSoon(); }; })(showTab);

/* ---------- create actions (2 Oct) ----------
   Two verbs everywhere: Schedule (something that will happen: meeting, interview, task) and Log (notes from
   something that happened). A "+ New" menu in the top bar on every page; one action row on every open live
   role card (Schedule · Log a conversation · Practise once an interview exists); a first-run prompt on an
   empty Overview. The existing contextual buttons stay. */
function nmToggle(open){
  var l=el("nm-list"), b=el("nm-btn"); if(!l||!b) return;
  if(open==null) open=l.hidden;
  l.hidden=!open; b.setAttribute("aria-expanded",String(open));
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("#nm-btn");
  if(b){ ev.preventDefault(); nmToggle(); return; }
  var inMenu=ev.target.closest && ev.target.closest("#nm-list");
  if(inMenu){
    var c=ev.target.closest("[data-nmclick]");
    if(c){ ev.preventDefault(); var x=el(c.dataset.nmclick); if(x) x.click(); }
    if(ev.target.closest("button")) setTimeout(function(){ nmToggle(false); },0);
    return;
  }
  if(!el("nm-list") || el("nm-list").hidden) return;
  nmToggle(false);
});
document.addEventListener("keydown",function(ev){ if(ev.key==="Escape" && el("nm-list") && !el("nm-list").hidden){ nmToggle(false); el("nm-btn").focus(); } });
/* Some menu items' own handlers stop the click before the listener above sees it, which left the menu open behind the
   form they open (QA 15 Oct). Close it on the way down instead. */
document.addEventListener("click",function(ev){ if(ev.target.closest && ev.target.closest("#nm-list button")) setTimeout(function(){ nmToggle(false); },0); },true);

var CARD_ACT_ST={consideration:1, parked:1, prep:1, applied:1, offer:1};
var CA_IC={
  cal:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  log:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H8l-3 2.5V11H3.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  mic:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="2" width="4" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'};
/* Practise shows an open book, closer to prep than the microphone (2 Oct). */
CA_IC.book='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.5C6.5 3.4 4.6 3 2.5 3.2v9c2.1-.2 4 .2 5.5 1.3 1.5-1.1 3.4-1.5 5.5-1.3v-9C11.4 3 9.5 3.4 8 4.5z M8 4.5v9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
CA_IC.plus='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
CA_IC.task='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
CA_IC.doc='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h5l3 3v8H4z M9 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
CA_IC.note='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10v9H3z M5.5 6.5h5 M5.5 9h3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
CA_IC.q='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5 M8 12v.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
/* One place to add to a role (2 Oct): an "+ Add" menu, plus Practise. Sections inside the card keep
   only a quiet link when they are empty; editing and status stay on each row. */
function raItem(cls,icon,title,sub,attrs){
  return '<button type="button" role="menuitem" class="nmit '+cls+'" '+attrs+'><i class="nmi" aria-hidden="true">'+icon+'</i>'+
    '<span class="nmt"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span></button>';
}
function cardActs(r){
  if(!r || !CARD_ACT_ST[r.stage]) return "";
  var hasIv = typeof mtStages==="function" && mtStages(r).length>0;
  var applied = r.stage==="applied"||r.stage==="offer";
  var top = hasIv && typeof prepTop==="function"? prepTop(r) : null;
  var role=' data-fk="role" data-fid="'+esc(r.id)+'"';
  var items=
    (applied? raItem("k-meet",CA_IC.cal,"Interview","A round with "+(r.company||"them"),'data-act="mt_add" data-item="meeting" data-type="screen"'+role) : "")+
    raItem("k-meet",CA_IC.cal,applied? "Other meeting" : "Meeting","A chat about this role",'data-act="mt_add" data-item="meeting"'+role)+
    raItem("k-task",CA_IC.task,"Task","Something to do, by a date or when something happens",'data-act="mt_add" data-item="task"'+role)+
    raItem("k-log",CA_IC.log,"Log a conversation","Notes from something that happened",'data-act="logjump" data-id="'+esc(r.id)+'"')+
    raItem("k-roles",CA_IC.doc,"Prep material","A prep guide, case brief or link from them",'data-act="ma_add" data-k="role" data-id="'+esc(r.id)+'"')+
    raItem("k-task",CA_IC.note,"Note","Anything that doesn’t fit the research",'data-act="note_open" data-kind="role" data-id="'+esc(r.id)+'"')+
    raItem("k-task",CA_IC.q,"Question","Something to ask them",'data-act="ra_q" data-id="'+esc(r.id)+'"');
  return '<div class="cardacts">'+
    '<div class="ramenu"><button type="button" class="cabtn ra-btn" aria-haspopup="true" aria-expanded="false" title="Add to this role">'+CA_IC.plus+'<span class="ralab">Add</span></button>'+
      '<div class="ra-list nmlist" role="menu" hidden>'+items+'</div></div>'+
    (hasIv? '<button type="button" class="cabtn" data-act="mockfrom" data-id="'+esc(r.id)+'" data-cid="'+esc(top? top.k : "")+'" title="Practise '+(top? "the next round" : "an interview")+'">'+CA_IC.book+'<span class="ralab">Practise</span></button>' : "")+
  '</div>';
}
function raClose(except){ document.querySelectorAll(".ra-list:not([hidden])").forEach(function(l){ if(l!==except){ l.hidden=true; var b=l.parentNode.querySelector(".ra-btn"); if(b) b.setAttribute("aria-expanded","false"); } }); }
document.addEventListener("click",function(ev){
  var t=ev.target; if(!t || !t.closest) return;
  var b=t.closest(".ra-btn");
  if(b){ ev.preventDefault(); var l=b.parentNode.querySelector(".ra-list"); raClose(l); l.hidden=!l.hidden; b.setAttribute("aria-expanded",String(!l.hidden)); return; }
  if(t.closest(".ra-list")){ if(t.closest("button")) setTimeout(function(){ raClose(); },0); return; }
  raClose();
});
document.addEventListener("keydown",function(ev){ if(ev.key==="Escape") raClose(); });
/* Add › Question: open the Questions tab and its editor for this role. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="ra_q"]'); if(!b) return; ev.preventDefault();
  var id=b.dataset.id, root=document.getElementById("sp-body") && document.getElementById("sp-body").querySelector(".rbody")? document.getElementById("sp-body") : document;
  var tb=root.querySelector('[data-act="ctab"][data-id="'+cssq(id)+'"][data-k="questions"]'); if(tb) tb.click();
  setTimeout(function(){ var root2=document.getElementById("sp-body") && document.getElementById("sp-body").querySelector(".rbody")? document.getElementById("sp-body") : document;
    /* The add form is the Questions tab's "+ Add a question" button now (QA 15 Oct; the old oq editor is gone). */
    var e=root2.querySelector('[data-act="qa_add"][data-role="'+cssq(id)+'"]')||root2.querySelector('[data-act="ed_open"][data-k="oq"][data-id="'+cssq(id)+'"]'); if(e) e.click(); },60);
});
/* The actions sit on the tab row, right-aligned (2 Oct): one line instead of two. */
cardTabs=(function(orig){ return function(r,summary,tabs,dflt){
  var html=orig(r, summary, tabs, dflt), acts=cardActs(r);
  if(!acts) return html;
  var k='<div class="ctabs" role="tablist">', i=html.indexOf(k); if(i<0) return html;
  var j=html.indexOf('</div>', i)+6;
  return html.slice(0,i)+'<div class="ctabrow">'+html.slice(i,j)+acts+'</div>'+html.slice(j);
}; })(cardTabs);

renderOverview=(function(orig){ return function(){
  orig();
  var box=el("ov-body"); if(!box || rawRoles.length) return;
  box.insertAdjacentHTML("afterbegin",'<div class="ovc ovfirst"><h3>Start by adding roles</h3>'+
    '<p>Paste links to job ads you like, or add a role someone told you about. Everything else on the board builds from these.</p>'+
    '<div class="row"><button type="button" class="btn primary" data-open-add="paste">Add your first roles</button>'+
    '<a href="#" data-gotab="help">How the board works →</a></div></div>');
}; })(renderOverview);

/* ---------- triggered tasks (2 Oct) ----------
   A task has a date or a trigger. A trigger is a role reaching a point the board can see. When it happens,
   a task gets that day as its due date and a meeting becomes ready to book; both carry firedAt. If the role
   closes first, the item closes with dropped:true and shows once in Loose ends (This week) until dismissed.
   "Passes the screen" means a later round is booked or done (not merely added: rounds are often added early). */
var TRIG_EVS=[["applied","Applied"],["screendone","Screen done"],["screenpass","Passes the screen"],["offer","Offer"]];
var TRIG_DEAD={closed:1, g1_rejected:1, g2_rejected:1};
var TRIG_DONE={};
function trigEvLabel(ev){ var m=TRIG_EVS.filter(function(x){return x[0]===ev;})[0]; return m? m[1].toLowerCase() : ev; }
function trigRole(id){ return rawRoles.find(function(r){return r.id===id;}); }
function trigText(rid,ev){ var r=trigRole(rid)||{}; return (r.company||"the role")+" — "+trigEvLabel(ev); }
function trigShort(rid,ev){ var r=trigRole(rid)||{}; return (r.company||"Role")+" "+({applied:"application",screendone:"screen",screenpass:"next round",offer:"offer"}[ev]||ev); }
function trigHit(r,ev){
  var ms=commitments.filter(function(c){ return mtItem(c)==="meeting" && mtFor(c).k==="role" && mtFor(c).id===r.id; });
  if(ev==="applied") return !!(r.appliedAt || r.stage==="applied" || r.stage==="offer");
  if(ev==="offer") return r.stage==="offer";
  if(ev==="screendone") return ms.some(function(c){ return mtType(c)==="screen" && c.state==="done"; });
  if(ev==="screenpass") return ms.some(function(c){ var t=mtType(c); return t!=="screen" && t!=="informal" && (c.state==="booked"||c.state==="done") && MT_MEET.role.some(function(o){return o[0]===t;}); });
  return false;
}
function trigSub(c){ var r=trigRole(c.trigger.roleId)||{};
  return "Unlocks when "+(r.company||"the role")+" "+({applied:"is applied for",screendone:"finishes the screen",screenpass:"passes the screen",offer:"makes an offer"}[c.trigger.ev]||c.trigger.ev); }
function trigCheck(){
  if(!DB || !MT_LOADED.c || !MT_LOADED.r) return;
  var t=today();
  commitments.forEach(function(c){
    if(c.state!=="conditional" || !c.trigger || !c.trigger.roleId || TRIG_DONE[c.id]) return;
    var r=trigRole(c.trigger.roleId), patch=null;
    if(!r || TRIG_DEAD[r.stage]) patch={state:"done", doneAt:t, dropped:true, dropNote:(r? (r.company||"The role")+" closed" : "The role was removed")+", so this closed too."};
    else if(trigHit(r,c.trigger.ev)) patch = mtItem(c)==="task"? {state:"booked", date:t, firedAt:t} : {state:"unplanned", firedAt:t};
    if(!patch) return;
    TRIG_DONE[c.id]=1;
    DB.doc("commitments/"+c.id).update(patch).catch(function(e){ console.warn("trigger",e); delete TRIG_DONE[c.id]; });
  });
}
render=(function(orig){ return function(){ orig(); trigCheck(); }; })(render);
document.addEventListener("change",function(ev){
  var f=ev.target && ev.target.dataset && ev.target.dataset.mt; if(!MT || (f!=="trole" && f!=="tev")) return;
  MT[f]=ev.target.value; if(f==="trole") MT.tev=""; mtPaint();
});
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="drop_ok"]'); if(!b || !DB) return; ev.preventDefault();
  DB.doc("commitments/"+b.dataset.cid).update({dropSeen:true}).catch(function(e){ console.warn(e); });
});

/* ---------- Week ahead as a week board (2 Oct) ----------
   Desktop: one column per day from the window's first day, Saturday and Sunday merged into one Weekend
   column (narrow when empty), compact two-line cards, timed items first, repeating tasks quietest. Clicking a
   card opens it to edit; Done and Prepped sit on the card. The list stays available (List) and is what
   phones and narrow windows get. The bands (overdue, further out, pending) are unchanged. */
var WKVIEW="board"; try{ if(localStorage.getItem("nr-wkview")==="list") WKVIEW="list"; }catch(e){}
function wbBoardOn(){ return WKVIEW==="board" && window.matchMedia("(min-width:1100px)").matches; }
function wbItems(d,t){
  var out=[], live=commitments.filter(function(c){return c.state!=="done";});
  mtDeadlines().forEach(function(x){ if(x.date===d) out.push({cat:"task", k:"deadline", title:x.title, time:"", sub:x.sub, done:false, open:'data-act="role_go" data-id="'+esc(x.roleId)+'"', acts:""}); });
  live.forEach(function(c){ if(prepShowDate(c,t)!==d) return;
    var carried=!c.prepDone && prepDateOf(c) && prepDateOf(c)<t;
    out.push({cat:"task", k:"prep", title:"Prep — "+c.title, time:"", sub:"For "+niceShort(c.date)+(c.time? " "+c.time : ""), done:!!c.prepDone, late:carried,
      open:'data-wkopen="wk-prep-'+esc(c.id)+'"', acts:c.prepDone? "" : wkBtn("prepwontdo",c.id,"Won\u2019t do","sm ghost")+wkBtn("prepdone",c.id,"Prepped","sm")}); });
  /* Skip / Won't do / Cancelled (12 Oct, js/43): closed without doing it, greyed with its label. */
  commitments.forEach(function(c){ if(!runsOn(c,d)) return; var dn=taskDoneOn(c,d), sk=skipOn(c,d), dA=' data-d="'+esc(d)+'"';
    out.push({cat:"recurring", k:"rec", title:c.title, time:c.time||"", sub:"Repeating", done:dn, skip:sk?"skip":"", open:'data-wkopen="wk-task-'+esc(c.id)+'-'+d+'"',
      acts:dn? "" : wkBtn("taskskip",c.id,"Skip","sm ghost",dA)+wkBtn("taskdone",c.id,"Done","sm",dA)}); });
  commitments.forEach(function(c){
    var on=((c.state==="booked"||c.state==="done"||c.state==="cancelled") && c.date===d && !(mtItem(c)==="task" && c.state==="booked" && d<t)) ||
      (d===t && mtItem(c)==="task" && c.state==="booked" && c.date && c.date<t);
    if(!on) return;
    var cat=wkCat(c), isTask=mtItem(c)==="task", past=c.date<t, open=c.state==="booked";
    out.push({cat:cat, k:"item", title:c.title||mtLabel(c), time:c.time||"", sub:wkSub(c), done:!open, skip:cmtClosedAs(c), late:isTask && past && open,
      open:'data-wkopen="wk-'+esc(c.id)+'"',
      acts:!open? "" : isTask? wkBtn("cmtwontdo",c.id,"Won\u2019t do","sm ghost")+wkBtn("cmtdone",c.id,"Done","sm")
        : (past || d===t? wkBtn("cmtcancel",c.id,"Cancelled","sm ghost")+wkBtn("cmtdone",c.id,"Done","sm") : "")}); });
  var R={interview:0, meeting:1, task:2, recurring:3};
  return out.sort(function(a,b){ return (a.done?1:0)-(b.done?1:0) || (a.cat==="recurring"?1:0)-(b.cat==="recurring"?1:0) ||
    String(a.time||"zz").localeCompare(String(b.time||"zz")) || R[a.cat]-R[b.cat]; });
}
function wbCard(x,dayLab){
  var typ=x.k==="prep"? "Prep" : x.k==="deadline"? "Deadline" : WKCAT[x.cat];
  return '<div class="wbc k-'+x.cat+(x.k==="prep"?" k-prep":"")+(x.done?" done":"")+(x.skip?" skip":"")+(x.late?" late":"")+'">'+
    '<button type="button" class="wbo" '+x.open+' title="'+esc(x.title)+'">'+
      '<span class="wbt">'+(dayLab? '<b>'+dayLab+'</b> · ' : "")+esc(x.time||"Any time")+' · <span class="wbk">'+esc(typ)+'</span>'+(x.late? ' · <span class="wbl">overdue</span>' : "")+(x.skip? ' · <span class="wbsk">'+esc(SKIP_LAB[x.skip]||"")+'</span>' : "")+'</span>'+
      '<span class="wbn">'+esc(x.title)+'</span>'+(x.sub? '<span class="wbs">'+esc(x.sub)+'</span>' : "")+'</button>'+
    (x.acts? '<div class="wba">'+x.acts+'</div>' : "")+'</div>';
}
function renderWeekBoard(){
  var host=el("week-board"), list=el("week-days"); if(!host || !list) return;
  var nav=el("week-nav");
  if(nav && !nav.querySelector(".wkview")){
    var f=nav.querySelector(".wkfilter");
    var tg='<span class="cofseg wkview" role="group" aria-label="View"><button type="button" class="cof'+(WKVIEW==="board"?" on":"")+'" data-wkview="board">Board</button>'+
      '<button type="button" class="cof'+(WKVIEW==="list"?" on":"")+'" data-wkview="list">List</button></span>';
    if(f) f.insertAdjacentHTML("beforeend",tg);
  }
  if(!wbBoardOn()){ host.innerHTML=""; host.hidden=true; list.hidden=false; return; }
  host.hidden=false; list.hidden=true;
  var t=today(), start=addDays(t,7*weekOff), cols=[];
  for(var i=0;i<7;i++){ var d=addDays(start,i), w=dowOf(d), we=(w===0||w===6);
    var last=cols[cols.length-1];
    if(we && last && last.we) last.days.push(d); else cols.push({we:we, days:[d]}); }
  var html=cols.map(function(cl){
    var items=[], isToday=cl.days.indexOf(t)>=0;
    cl.days.forEach(function(d){ wbItems(d,t).forEach(function(x){ if(wkKeep(x.cat)){ x.dayLab=cl.we? DOW[dowOf(d)] : ""; items.push(x); } }); });
    var g=dayGap(t,cl.days[0]);
    var head= cl.we? '<b>Weekend</b><span>'+cl.days.map(function(d){ return niceShort(d).replace(/^\w+ /,""); }).join(" – ")+'</span>'
      : '<b>'+esc(niceShort(cl.days[0]).split(" ")[0])+' '+esc(niceShort(cl.days[0]).split(" ").slice(1).join(" "))+'</b><span>'+(g===0? "today" : g===1? "tomorrow" : g===-1? "yesterday" : "")+'</span>';
    return '<div class="wbcol'+(cl.we?" we":"")+(cl.we && !items.length?" empty":"")+(isToday?" today":"")+'"><div class="wbh">'+head+'</div>'+
      (items.length? items.map(function(x){ return wbCard(x,x.dayLab); }).join("") : '<p class="wbe">'+(cl.we? "Free" : "Nothing booked")+'</p>')+'</div>';
  }).join("");
  host.innerHTML='<div class="wboard" style="grid-template-columns:'+cols.map(function(cl){ return cl.we? (cl.days.some(function(d){ return wbItems(d,t).some(function(x){return wkKeep(x.cat);}); })? "minmax(0,1fr)" : "minmax(0,.45fr)") : "minmax(0,1fr)"; }).join(" ")+'">'+html+'</div>';
}
renderWeek=(function(orig){ return function(){ orig(); renderWeekBoard(); }; })(renderWeek);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-wkview]"); if(!b) return; ev.preventDefault();
  WKVIEW=b.dataset.wkview; try{ localStorage.setItem("nr-wkview",WKVIEW); }catch(e){} renderWeek();
});
window.addEventListener("resize",function(){ if(tab==="week") renderWeekBoard(); });

/* "Marked done · Undo" (2 Oct): the undo for a mistaken Done lives here for a few seconds, instead
   of a permanent "Not done after all" button on every finished meeting. */
var TOAST_UNDO_T=null;
function toastUndo(msg,undo){
  var t=el("toast"); if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  /* Inside an open pop-up, the toast has to live in it to show above the backdrop. */
  var host=document.querySelector("dialog[open]")||document.body; if(t.parentNode!==host) host.appendChild(t);
  t.innerHTML=esc(msg)+' <button type="button" class="toastbtn">Undo</button>'; t.classList.remove("bad"); t.classList.add("on");
  t.querySelector(".toastbtn").onclick=function(){ undo(); t.classList.remove("on"); };
  clearTimeout(TOAST_T); clearTimeout(TOAST_UNDO_T); TOAST_UNDO_T=setTimeout(function(){ t.classList.remove("on"); if(t.parentNode!==document.body) document.body.appendChild(t); },6000);
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="cmtdone"],[data-act="sessdone"],[data-act="prepdone"]'); if(!b || !DB) return;
  var cid=b.dataset.cid, a=b.dataset.act; if(!cid) return;
  setTimeout(function(){
    if(a==="prepdone") toastUndo("Marked prepped",function(){ DB.doc("commitments/"+cid).update({prepDone:false, preppedAt:""}).catch(function(e){console.warn(e);}); });
    else toastUndo("Marked done",function(){ DB.doc("commitments/"+cid).update({state:"booked", doneAt:""}).catch(function(e){console.warn(e);}); });
  },0);
});

/* ---------- side panel and meeting pop-up (2 Oct) ----------
   Roles, companies, sectors, channels and people open in a panel from the right instead of expanding in the
   list; meetings and tasks on Week ahead open in a pop-up. Nothing is rendered twice: the card's own body
   (its .rbody) is moved into the panel or pop-up, so every button and id keeps working, and after any
   re-render the fresh body is moved across again. People render their open card as HTML (PP_OPEN_HTML).
   Previous / next (and J / K) walk the list; Escape closes; the panel's width is draggable and remembered. */
var SP={id:null, kind:null, node:null, home:null};
var SP_TABS={gate1:1, gate2:1, toapply:1, inplay:1, companies:1, sectors:1, routine:1};
function cssq(v){ return String(v).replace(/(["\\])/g,"\\$1"); }
function spBuild(){
  if(el("sidepanel")) return;
  var w=""; try{ w=localStorage.getItem("nr-spw")||""; }catch(e){}
  if(w) document.documentElement.style.setProperty("--spw",w);
  document.body.insertAdjacentHTML("beforeend",
    '<aside id="sidepanel" class="sidepanel" hidden aria-label="Details"><div class="spgrip" title="Drag to resize"></div>'+
      '<div class="sph"><div class="spht"><b id="sp-title"></b><span id="sp-sub"></span></div>'+
      '<span class="spacts" id="sp-acts"></span>'+
      '<button type="button" class="spnav" data-sp="prev" title="Previous (K)" aria-label="Previous">\u2191</button>'+
      '<button type="button" class="spnav" data-sp="next" title="Next (J)" aria-label="Next">\u2193</button>'+
      '<button type="button" class="spnav spx" data-sp="close" title="Close (Esc)" aria-label="Close">\u2715</button></div>'+
      '<div class="spb" id="sp-body"></div></aside>'+
    '<dialog id="wkpop" class="modal wkpop" aria-labelledby="wkpop-title"><div class="modal-head"><div class="wkph"><span class="wktype" id="wkpop-type"></span><h3 id="wkpop-title"></h3><p id="wkpop-sub"></p></div>'+
      /* Status top right, as on every row; actions in the footer (2 Oct). */
      '<div class="row" style="gap:8px;align-items:center"><span id="wkpop-st"></span><button type="button" class="spnav spx" id="wkpop-close" title="Close (Esc)" aria-label="Close">\u2715</button></div></div>'+
      '<div id="wkpop-body" class="wkpopb"></div></dialog>');
  var grip=document.querySelector("#sidepanel .spgrip");
  grip.addEventListener("mousedown",function(e){ e.preventDefault();
    function mv(ev){ var z=pgZoom(), vw=window.innerWidth/z, w=Math.max(420, Math.min(vw-320, vw-ev.clientX/z)); document.documentElement.style.setProperty("--spw",w+"px"); }
    function up(){ document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up);
      try{ localStorage.setItem("nr-spw",getComputedStyle(document.documentElement).getPropertyValue("--spw").trim()); }catch(err){} }
    document.addEventListener("mousemove",mv); document.addEventListener("mouseup",up); });
  el("wkpop-close").addEventListener("click",function(){ spClose(); });
  el("wkpop").addEventListener("close",function(){ if(SP.kind==="wk" && !el("wkpop").open) spClose(true); });
}
function spHome(){ return SP.kind==="wk"? document.querySelector('#tab-week details.rcard[data-id="'+cssq(SP.id)+'"]')
  : document.querySelector('main details.rcard[data-id="'+cssq(SP.id)+'"]'); }
/* A meeting or task opened from inside a role's panel (2 Oct): the panel stays as it is underneath, and comes
   back when the pop-up closes. */
var SP_BACK=null;
function spOpen(id,kind){
  spBuild();
  if(SP.id && (SP.id!==id || SP.kind!==kind)){
    if(kind==="wk" && SP.kind==="rcard"){ SP_BACK={id:SP.id, kind:SP.kind, node:SP.node, home:SP.home, stage:SP.stage}; SP={id:null, kind:null, node:null, home:null}; }
    else spClose(true);
  }
  SP.id=id; SP.kind=kind;
  /* The stage it was opened at (5 Oct): the panel only closes itself when the role has really moved on. */
  var r0=kind==="rcard"? rawRoles.find(function(x){return x.id===id;}) : null; SP.stage=r0? r0.stage : null;
  if(kind==="wk"){ var d=el("wkpop"); if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); d.tabIndex=-1; d.focus(); } }
  else { el("sidepanel").hidden=false; document.body.classList.add("sp-open"); }
  spSync(true);
  /* A panel always opens on its first tab (3 Oct), not the last one used on that card. */
  if(kind==="rcard"){ var body=el("sp-body"), first=body && body.querySelector('.ctabs:not(.sub) [data-act="ctab"]');
    if(first && first.getAttribute("aria-selected")!=="true") first.click();
    if(body) body.scrollTop=0; }
}
function spClose(quiet){
  var id=SP.id, kind=SP.kind;
  /* Closing the panel cancels any question being added, reworded or answered (3 Oct). */
  var qaBusy=false;
  [QA_EDIT, QA_ADD, QA_EDRAFT, QA_OPEN, QA_DRAFT].forEach(function(o){ Object.keys(o).forEach(function(k){ qaBusy=true; delete o[k]; }); });
  if(qaBusy) setTimeout(render,0);
  /* A reject box left open closes with the panel (3 Oct), so the next open starts clean. */
  if(SP.node) SP.node.querySelectorAll(".rejbox.open").forEach(function(x){ x.classList.remove("open");
    document.querySelectorAll('[data-act="rejopen"][data-id="'+cssq(x.id.slice(4))+'"]').forEach(function(y){ y.setAttribute("aria-pressed","false"); }); });
  if(SP.node && SP.home && SP.home.isConnected && !SP.home.querySelector(":scope > .rbody")) SP.home.appendChild(SP.node);
  SP={id:null, kind:null, node:null, home:null};
  document.querySelectorAll(".sp-on").forEach(function(x){ x.classList.remove("sp-on"); });
  if(kind==="wk"){ var d=el("wkpop"); if(d && d.open && !quiet) d.close(); if(el("wkpop-body")) el("wkpop-body").innerHTML="";
    if(SP_BACK){ SP=SP_BACK; SP_BACK=null; spSync(true); if(SP.id) return; }
  }
  SP_BACK=null;
  var p=el("sidepanel"); if(p){ p.hidden=true; el("sp-body").innerHTML=""; }
  document.body.classList.remove("sp-open");
  if(kind==="person" && expanded && expanded.has("pp-"+id)){ expanded.delete("pp-"+id); renderPeople(); }
}
function spSync(force){
  if(!SP.id) return;
  var body = SP.kind==="wk"? el("wkpop-body") : el("sp-body");
  if(SP.kind==="person"){
    if(PP_OPEN_ID!==SP.id){ spClose(true); return; }
    var st=body.scrollTop; body.innerHTML=PP_OPEN_HTML; body.scrollTop=st;
    var p=people.find(function(x){return x.id===SP.id;})||{};
    el("sp-title").textContent=p.name||""; el("sp-sub").textContent=ppCo(p)||"";
    el("sidepanel").classList.add("sp-person");
    document.querySelectorAll(".sp-on").forEach(function(x){ x.classList.remove("sp-on"); });
    var t=document.querySelector('#tab-people .ptcard[data-id="'+cssq(SP.id)+'"]'); if(t) t.classList.add("sp-on");
    return;
  }
  if(el("sidepanel")) el("sidepanel").classList.remove("sp-person");
  if(SP.kind!=="wk") spActs();
  var det=spHome();
  /* A redraw can leave the card out of the list for a moment (search, Mix filter, the batch cut) while the role
     itself hasn't moved. Keep the panel then; close it only when the role changed stage or was removed (5 Oct). */
  if(!det){ if(SP.kind==="rcard" && SP.node && SP.stage){ var rs=rawRoles.find(function(x){return x.id===SP.id;}); if(rs && rs.stage===SP.stage) return; }
    spClose(); return; }
  var rb=det.querySelector(":scope > .rbody");
  if(rb && (rb!==SP.node || force)){
    var st2=body.scrollTop; body.innerHTML=""; body.appendChild(rb); body.scrollTop=st2;
    SP.node=rb; SP.home=det;
  }
  var tt=det.querySelector("summary .rsum-title"), sb=det.querySelector("summary .rsum-co");
  var title="", refT=""; if(tt){ var cl=tt.cloneNode(true); cl.querySelectorAll(".rref,.wktype,.closebang").forEach(function(x){x.remove();}); title=cl.textContent.trim();
    var rf=tt.querySelector(".rref"); if(rf && SP.kind!=="wk") refT=rf.textContent; }
  if(SP.kind==="wk"){ el("wkpop-title").textContent=title||"Meeting";
    var bst=el("wkpop-body").querySelector(".shead .srow > .spill"), hst=el("wkpop-st");
    if(bst){ hst.className=bst.className.replace(/\bsm\b/,"")+" wkpst"; hst.textContent=bst.textContent; } else { hst.className=""; hst.textContent=""; }
    el("wkpop").classList.toggle("from-panel", !!SP_BACK);
    var wt=det.querySelector("summary .wktype"), ty=el("wkpop-type");
    ty.className="wktype"+(wt? " "+[].slice.call(wt.classList).filter(function(x){return /^t-/.test(x);}).join(" ") : ""); ty.textContent=wt? wt.textContent : ""; ty.hidden=!wt;
    var sc=sb? sb.cloneNode(true) : null; if(sc) sc.querySelectorAll(".wkwhen").forEach(function(x){x.remove();});
    /* No sub-line in the pop-up (2 Oct): the fields already say when, who and what for. */
    el("wkpop-sub").textContent=""; }
  /* The role number has its own slot after the title (5 Oct): a long title is cut short, the number never is. */
  else { var spt=el("sp-title"); spt.innerHTML='<i class="sptt"></i>'+(refT? '<span class="spref" title="Role number"></span>' : ""); spt.firstChild.textContent=title||"";
    if(refT) spt.querySelector(".spref").textContent=refT;
    /* The posting link sits beside the role number in the panel header too (3 Oct). */
    var pl=det.querySelector("summary .postlink"); if(pl){ var plc=pl.cloneNode(true); plc.classList.add("sppost"); spt.appendChild(plc); }
    el("sp-sub").textContent=sb? sb.textContent : ""; }
  document.querySelectorAll(".sp-on").forEach(function(x){ x.classList.remove("sp-on"); });
  var art=det.closest("article"); if(art && SP.kind!=="wk") art.classList.add("sp-on");
}
/* The card's actions (Schedule, Log a conversation, Practise) sit in the panel header as icon buttons
   (2 Oct), so the tab row has the full width and the actions stay put while you scroll. The
   copies keep the data attributes, so the same click handlers run them. */
function spActs(){
  var box=el("sp-acts"); if(!box) return;
  var src=SP.node? SP.node.querySelector(".cardacts") : null;
  box.innerHTML="";
  if(src) [].forEach.call(src.children,function(ch){ var c=ch.cloneNode(true);
    var btn=c.classList.contains("ramenu")? c.querySelector(".ra-btn") : c;
    btn.classList.add("spnav","spact"); btn.classList.remove("cabtn");
    var lab=(btn.querySelector(".ralab")||{}).textContent||""; btn.setAttribute("aria-label",lab);
    box.appendChild(c); });
  box.hidden=!src;
}
function spStep(dir){
  if(!SP.id || SP.kind==="wk") return;
  if(SP.kind==="person"){
    var ts=[].slice.call(document.querySelectorAll('#tab-people .ptcard[data-id]')), i=ts.findIndex(function(x){return x.dataset.id===SP.id;}), nx=ts[i+dir];
    if(nx) nx.click(); return; }
  var sec=document.querySelector('main section[id^="tab-"]:not([hidden])');
  var ds=sec? [].slice.call(sec.querySelectorAll("details.rcard[data-id]")) : [];
  var j=ds.findIndex(function(x){return x.dataset.id===SP.id;}), n=ds[j+dir];
  if(n){ spOpen(n.dataset.id,"rcard"); var a=n.closest("article"); if(a) a.scrollIntoView({block:"nearest",behavior:"smooth"}); }
}
document.addEventListener("toggle",function(ev){
  var d=ev.target; if(!d || !d.classList || !d.classList.contains("rcard") || !d.open) return;
  var sec=d.closest('main section[id^="tab-"]'); if(!sec) return;
  var tb=sec.id.slice(4), kind = tb==="week"? "wk" : SP_TABS[tb]? "rcard" : null;
  if(!kind) return;
  if(expanded) expanded.delete(d.dataset.id);
  d.open=false;
  spOpen(d.dataset.id, kind);
},true);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-sp]");
  if(b){ ev.preventDefault(); var a=b.dataset.sp; if(a==="close") spClose(); else spStep(a==="next"? 1 : -1); return; }
  var w=ev.target.closest && ev.target.closest("[data-wkopen]");
  if(w){
    var inner=ev.target.closest("button,a,input,select,textarea"); if(inner && inner!==w && w.contains(inner)) return;   /* the row's own tick */
    ev.preventDefault(); ev.stopPropagation(); wkOpenOrEdit(w); }
},true);
document.addEventListener("keydown",function(ev){
  if(ev.key!=="Enter" && ev.key!==" ") return;
  var w=ev.target.closest && ev.target.closest("li[data-wkopen], .taskrow[data-wkopen]"); if(!w || ev.target!==w) return;
  ev.preventDefault(); wkOpenOrEdit(w);
});
/* Week ahead holds most items; an older done task may not be there, so open its edit form instead (2 Oct). */
function wkOpenOrEdit(w){
  var k=w.dataset.wkopen;
  /* The Week ahead filter can hide the item; clear it so the click always opens something (QA 14 Oct). */
  if(!document.querySelector('#tab-week details.rcard[data-id="'+cssq(k)+'"]') && typeof WKF!=="undefined" && WKF!=="all"){ WKF="all"; try{ renderWeek(); }catch(e){} }
  if(document.querySelector('#tab-week details.rcard[data-id="'+cssq(k)+'"]')) spOpen(k,"wk");
  else if(w.dataset.cid) openMT({cid:w.dataset.cid});
}
document.addEventListener("keydown",function(ev){
  if(!SP.id || SP.kind==="wk") return;
  if(document.querySelector("dialog[open]")) return;
  if(ev.target.closest && ev.target.closest("input,textarea,select,[contenteditable]")) return;
  if(ev.key==="Escape"){ spClose(); }
  else if(ev.key==="j"||ev.key==="J"){ ev.preventDefault(); spStep(1); }
  else if(ev.key==="k"||ev.key==="K"){ ev.preventDefault(); spStep(-1); }
});
/* Clicking outside the panel closes it (2 Oct). A click on another row swaps it instead, and clicks
   inside a pop-up, the menu, or on something a re-render just removed are ignored. */
document.addEventListener("click",function(ev){
  if(!SP.id || SP.kind==="wk") return;
  var t=ev.target; if(!t || !t.isConnected || !t.closest) return;
  if(t.closest("#sidepanel, dialog, #nm-list, #nm-btn, .tabsheet, #mr")) return;
  /* Upload buttons click a hidden file input outside the panel; that isn't an outside click (3 Oct). */
  if(t.matches && t.matches('input[type="file"]')) return;
  if(t.closest("main details.rcard > summary, #tab-people .ptcard")) return;
  spClose();
});
renderPeople=(function(orig){ return function(){
  PP_OPEN_ID=""; PP_OPEN_HTML=""; orig();
  if(PP_OPEN_ID){ if(SP.id!==PP_OPEN_ID || SP.kind!=="person") spOpen(PP_OPEN_ID,"person"); else spSync(); }
  else if(SP.kind==="person"){ SP.id=null; spClose(true); }
}; })(renderPeople);
showTab=(function(orig){ return function(t){ if(SP.id) spClose(); orig(t); }; })(showTab);
(function(){ var m=document.querySelector("main"); if(!m || !window.MutationObserver) return; var q=0;
  new MutationObserver(function(){ if(q || !SP.id || SP.kind==="person") return; q=requestAnimationFrame(function(){ q=0; spSync(); }); }).observe(m,{childList:true, subtree:true}); })();

/* Roles in the sidebar (3 Oct): the stepper stays as it is, but new users look to the sidebar for
   pages. "Roles" opens the first stage with something on you, else the first stage with any roles, and stays
   highlighted on every stage page. Its badge is the total on you, the sum of the stepper's "on you" lines. */
var ROLE_TABS=["gate1","gate2","toapply","inplay","rejected"];
function rolesLanding(){
  var mine=funnelMine(), k=["gate1","gate2","toapply","inplay"], i;
  for(i=0;i<k.length;i++) if(mine[k[i]]) return k[i];
  for(i=0;i<k.length;i++){ var b=el("tc-"+k[i]); if(b && parseInt(b.textContent,10)>0) return k[i]; }
  return "gate1";
}
function paintRolesNav(){
  var b=document.querySelector('#sidenav .nv[data-tab="roles"]'); if(b) b.setAttribute("aria-selected", String(ROLE_TABS.indexOf(tab)>=0));
}
showTab=(function(orig){ return function(t){ if(t==="roles") t=rolesLanding(); orig(t); paintRolesNav(); }; })(showTab);
renderCounts=(function(orig){ return function(){ orig();
  var n=funnelMine(), sum=0; Object.keys(n).forEach(function(k){ sum+=n[k]||0; });
  var c=el("tc-roles"); if(c){ c.textContent=sum? String(sum) : ""; c.title=sum? sum+" waiting on you" : ""; }
  /* App headline: one number, the same as the badge and the funnel's "on you" lines added up. */
  var hl=el("apphl"); if(hl){ hl.hidden=false;
    el("apphl-t").textContent= sum? sum+(sum===1? " role needs you" : " roles need you") : "You\u2019re all up to date";
    var nx=""; if(!sum && typeof sweepState==="function"){ var S=sweepState(); nx= S.k==="Stale"? "The sweep is overdue" : S.next? "Next sweep "+niceShort(S.next) : ""; }
    el("apphl-s").textContent=nx; el("apphl-s").hidden=!nx; hl.classList.toggle("zero",!sum); }
  paintRolesNav();
}; })(renderCounts);

/* ---------- boot ---------- */
/* Every form lives at the top of the page (1 Oct, late). Several were written inside a tab's section,
   so on any other tab they opened invisibly — "Book it" on a role card did nothing. */
Array.prototype.forEach.call(document.querySelectorAll("section dialog"),function(d){ document.body.appendChild(d); });
/* Snapshot batching (5 Oct). nrSnap queues a callback; nrFlush runs everything queued in one go with
   redraws held (NRB.busy, honoured by 29's outermost render wrapper), then redraws once. Waits for 29
   to load (NRB.ready) so the first burst is never drawn piecemeal. */
var NRB={q:[], t:0, busy:false, want:false, ready:false, ms:60};
function nrSnap(cb){ return function(s){ NRB.q.push([cb,s]); if(!NRB.t) NRB.t=setTimeout(nrFlush, NRB.ms); }; }
function nrFlush(){
  NRB.t=0; if(!NRB.ready){ NRB.t=setTimeout(nrFlush, NRB.ms); return; }
  var q=NRB.q; NRB.q=[]; NRB.busy=true; NRB.want=false;
  try{ q.forEach(function(x){ try{ x[0](x[1]); }catch(e){ setTimeout(function(){ throw e; },0); } });   /* rethrown so the error log still sees it */ }
  finally{ NRB.busy=false; }
  if(NRB.want) render();
}
render();
(async function(){
  var db = window.claude && window.claude.use ? await window.claude.use("db") : null;
  if(!db){ el("offline").hidden=false; return; }
  /* Never mutate the runtime's db object (1 Oct): doing so stopped the board loading at all. Writes go
     through a thin wrapper; reads keep using db directly. */
  DB=db; RAWDB=db; try{ DB=wrapDB(db); }catch(e){ console.warn("save notes off",e); DB=db; }
  /* Snapshots arrive in bursts (about 20 on load, several after a skill run). Each used to redraw the
     whole board, which blocked taps for a second or more on a phone (5 Oct). They now go through
     nrSnap (29), which runs a burst's callbacks together and redraws once. A thin local view over the
     runtime's db: the runtime's object itself is untouched. */
  { var db0=db;
    db={ collection:function(n){ var c=db0.collection(n); return { onSnapshot:function(cb,er){ return c.onSnapshot(nrSnap(cb),er); } }; },
         doc:function(p){ var d=db0.doc(p); return { onSnapshot:function(cb,er){ return d.onSnapshot(nrSnap(cb),er); } }; } }; }
  db.collection("roles").onSnapshot(function(s){
    rawRoles = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    assignRefs();
    MT_LOADED.r=1; if(MT_LOADED.c) mtHeal();
    hydrate(); render();
  },function(e){ console.warn("roles sub",e&&e.code); el("offline").hidden=false; });
  db.collection("companies").onSnapshot(function(s){
    companies = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    hydrate(); render();
  },function(e){ console.warn("companies sub",e&&e.code); });
  db.collection("runs").onSnapshot(function(s){
    runs = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    renderCounts();
  },function(e){ console.warn("runs sub",e&&e.code); });
  db.collection("screened").onSnapshot(function(s){
    screened = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    renderScreened();
  },function(e){ console.warn("screened sub",e&&e.code); });
  db.collection("decided").onSnapshot(function(s){
    decided = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    v2Refresh();
  },function(e){ console.warn("decided sub",e&&e.code); });
  db.collection("commitments").onSnapshot(function(s){
    commitments = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    MT_LOADED.c=1; if(MT_LOADED.r) mtHeal();
    /* Meetings and tasks show on every card kind now, not only Week ahead and In play. */
    render();
  },function(e){ console.warn("commitments sub",e&&e.code); });
  db.collection("conversations").onSnapshot(function(s){
    conversations = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    /* Conversations now show on Gate 2 and company cards as well. */
    renderG2(); renderToApply(); renderInPlay(); renderCompanies(); renderSectors(); renderCounts();
  },function(e){ console.warn("conversations sub",e&&e.code); });
  db.collection("mocks").onSnapshot(function(s){
    mocks = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    renderPastMocks();
  },function(e){ console.warn("mocks sub",e&&e.code); });
  db.doc("profile/me").onSnapshot(function(d){
    PROFILE = d && d.exists ? d.data() : null; if(typeof mkProfSync==="function") mkProfSync(); renderAbout();
  },function(e){ console.warn("profile sub",e&&e.code); });
  db.collection("people").onSnapshot(function(s){
    people = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    hydrate(); render();   /* warm routes follow the people (2 Oct) */
  },function(e){ console.warn("people sub",e&&e.code); });
  db.collection("channels").onSnapshot(function(s){
    channels = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    renderChannels(); renderManualChannels();
  },function(e){ console.warn("channels sub",e&&e.code); });
  db.collection("sources").onSnapshot(function(s){
    srcs = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    renderChannels(); renderManualChannels();
  },function(e){ console.warn("sources sub",e&&e.code); });
  db.collection("templates").onSnapshot(function(s){
    TEMPLATES={}; s.docs.forEach(function(d){ TEMPLATES[d.id]=d.data(); }); renderAbout();
  },function(e){ console.warn("templates sub",e&&e.code); });
  db.doc("profile/skills").onSnapshot(function(d){
    SKILLS = d && d.exists ? d.data() : null; renderAbout();
  },function(e){ console.warn("skills sub",e&&e.code); });
  db.doc("profile/prefs").onSnapshot(function(d){
    /* The rule lists, the pay rule and the answer nudges read PREFS, so the whole board redraws (22 Oct). */
    PREFS = d && d.exists ? d.data() : null; renderAbout(); render();
  },function(e){ console.warn("prefs sub",e&&e.code); });
  /* profile/settings (22 Oct): the turn-down reasons and the board's own link live here (applySettings, 01). */
  db.doc("profile/settings").onSnapshot(function(d){
    applySettings(d && d.exists ? d.data() : null); render();
  },function(e){ console.warn("settings sub",e&&e.code); });
  db.doc("profile/brief").onSnapshot(function(d){
    HOOD.brief = d && d.exists ? d.data() : null; renderHood();
  },function(e){ console.warn("brief sub",e&&e.code); });
  db.collection("refs").onSnapshot(function(s){
    HOOD.refs={}; s.docs.forEach(function(d){ HOOD.refs[d.id]=d.data(); }); renderHood();
  },function(e){ console.warn("refs sub",e&&e.code); });
  db.collection("materials").onSnapshot(function(s){
    materials = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    render();
  },function(e){ console.warn("materials sub",e&&e.code); });
  /* File store for interview materials: writer-only, null elsewhere (then upload is hidden). */
  if(window.claude.use) window.claude.use("assets").then(function(a){ ASSETS=a||null; }).catch(function(){ ASSETS=null; });
  db.collection("sectors").onSnapshot(function(s){
    sectors = s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
    render();   /* sector questions now appear on role cards' Questions tabs */
  },function(e){ console.warn("sectors sub",e&&e.code); });
})();


/* Open the date/time picker on a click anywhere in the field, not just the calendar icon. */
document.addEventListener('click', function(e){
  var el = e.target;
  if (!el || el.tagName !== 'INPUT') return;
  if (!/^(date|time|datetime-local|month|week)$/.test(el.type)) return;
  if (el.disabled || el.readOnly || typeof el.showPicker !== 'function') return;
  try { el.showPicker(); } catch(_) {}
});
