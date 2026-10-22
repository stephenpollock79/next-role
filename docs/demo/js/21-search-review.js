"use strict";
/* ===== The rest of My criteria as rows, and the Search review's evidence (3 Oct) =====
   1. Role shape, Search terms, Preferences, Pluses and Concerns get the deal-breaker treatment: one row each,
      Edit / Add / Remove in a form (#pr-dialog), a line of evidence where the board has some, and every change
      logged in `rulelog` (kind "pref") with undo.
   2. Evidence builders (sources, runs, search terms, rules) and the change log with undo, used by the Search
      review page (22, tab `review`; its reviews are `rulereviews` docs with scope "loop"). */

/* ---------- 1. rows ---------- */
var PR_SPEC={
  shape:{field:"roleShape", str:true, noun:"line", title:"Role shape", fields:[["text","What fits","area"]]},
  search:{field:"searchTerms", key:"group", noun:"search group", title:"Search terms — each runs as its own search",
    fields:[["group","Group","text"],["terms","Terms, comma separated — each runs as its own search","area"]]},
  scored:{field:"scored", key:"id", idp:"S", noun:"preference", title:"Preferences — rated Strong, Middle or Weak, never added up",
    fields:[["name","Name","text"],["bands","What's strong, acceptable and weak","area"],["basis","What it's about","select",[["","Decide from the name"],["company","About the company — checked once, reused for every role there"],["role","About the role"]],"opt"],["stage","Researched at","select",[["","When it's found (the sweep)"],["shortlist","At the shortlist (needs deeper research)"]],"opt"]]},
  upside:{field:"upside", key:"name", noun:"plus", title:"Pluses — bonus points, never a no", fields:[["name","Plus","text"],["note","Note, e.g. own search","text"]]},
  red:{field:"red", key:"name", noun:"concern", title:"Concerns — worth knowing, not a no", fields:[["name","Concern","text"],["note","Judged on","text"]]}
};
function prItems(k){ return ((PREFS && PREFS[PR_SPEC[k].field])||[]).slice(); }
function prKeyOf(k,it){ var s=PR_SPEC[k]; return s.str? String(it) : String((it&&it[s.key])||""); }
/* Flags on role cards are free text "Title — detail", so pluses and concerns are matched to them by name,
   roughly: any distinctive word of the criterion in the flag's title. */
var PR_STOP={with:1,than:1,more:1,above:1,below:1,beyond:1,days:1,being:1,company:1,role:1,roles:1,product:1,team:1,work:1,ways:1,across:1,four:0,three:0,core:1,line:1,start:1,date:1,months:1,reviews:1,volume:1,written:1,"as":1};
function prWords(name){ return String(name||"").toLowerCase().split(/[^a-z0-9+\-]+/).filter(function(w){ return w.length>=4 && !PR_STOP[w]; }).slice(0,3); }
function prFlagRoles(name,list){
  var ws=prWords(name); if(!ws.length) return [];
  /* Flags that report a deal-breaker failing ("<rule id> (<rule name>) fails…") are the rules talking, not this criterion. */
  return rawRoles.filter(function(r){ return (r[list]||[]).some(function(x){ var t=String(x).split(" — ")[0].toLowerCase(); if(/^g\d+\b/.test(t)) return false; return ws.some(function(w){ return t.indexOf(w)>=0; }); }); });
}
function prTurnedDown(r){ var e=endOf(r); return !!(e && e.by==="me"); }
function prEvidence(k,it){
  if(k==="scored"){
    var by={strong:0,mid:0,weak:0}, weakR=[];
    rawRoles.forEach(function(r){ (r.highlights||[]).forEach(function(h){ if(h.code!==it.id) return; var b=h.band==="good"? "mid" : h.band; if(by[b]!=null) by[b]++; if(b==="weak") weakR.push(r); }); });
    var n=by.strong+by.mid+by.weak; if(!n) return {txt:"Not rated on any role yet"};
    var down=weakR.filter(prTurnedDown).length;
    return {txt:"Strong on "+by.strong+" · middle on "+by.mid+" · weak on "+by.weak+(by.weak? " — you turned down "+down : ""), warn:by.weak>=3 && down/by.weak>=0.6};
  }
  if(k==="upside"||k==="red"){
    var rs=prFlagRoles(it.name,k==="upside"? "green" : "red"), far=rs.filter(reachedApply).length, down=rs.filter(prTurnedDown).length;
    if(!rs.length) return {txt:"Not seen on any role yet", tip:"Matched to the flags on role cards by name, roughly"};
    return {txt:"On "+plural(rs.length,"role")+" · "+far+" reached To apply · "+down+" turned down", tip:"Matched to the flags on role cards by name, roughly"};
  }
  if(k==="search"){
    var tracked=rawRoles.some(function(r){return r.searchTerm;}); if(!tracked) return {txt:"Not tracked yet — the sweep doesn't record which term found a role", tip:"Coming with the sweep skill update"};
    var terms=String(it.terms||"").split(",").map(function(t){return t.trim().toLowerCase();}).filter(Boolean);
    var rs2=rawRoles.filter(function(r){ return r.searchTerm && terms.indexOf(String(r.searchTerm).toLowerCase())>=0; });
    var none=terms.filter(function(t){ return !rawRoles.some(function(r){ return String(r.searchTerm||"").toLowerCase()===t; }); });
    return {txt:"Found "+rs2.length+" · "+rs2.filter(reachedApply).length+" reached To apply"+(none.length? " · nothing yet from "+none.length+" term"+(none.length===1?"":"s") : "")};
  }
  return null;
}
function prSectionHtml(k){
  var s=PR_SPEC[k], items=prItems(k);
  var head='<div class="sechead"><span class="eyebrow">'+esc(s.title)+'</span><span class="rusp"></span><button type="button" class="btn sm" data-pr="add:'+k+'">+ Add a '+s.noun+'</button></div>';
  var rows=items.map(function(it,i){
    var key=prKeyOf(k,it), ev=prEvidence(k,it), main, sub;
    if(s.str){ main=""; sub=String(it); }
    else if(k==="search"){ main=it.group||""; sub=""; }
    else { main=(it.name||"")+(k==="scored" && it.basis==="company"? " · about the company" : "")+(k==="scored" && it.stage==="shortlist"? " · at the shortlist" : ""); sub=it.bands||it.note||""; }
    var body= k==="search"? '<div class="row" style="gap:5px;margin-top:4px">'+String(it.terms||"").split(",").map(function(t){ t=t.trim(); return t? '<span class="chip">'+esc(t)+'</span>' : ""; }).join("")+'</div>' : "";
    return '<div class="prrow'+(s.str?" noid":"")+'">'+(it&&it.id? '<span class="pid">'+esc(it.id)+'</span>' : (s.str? "" : '<span class="pid"></span>'))+
      '<div class="rumain">'+(main? '<span class="pn">'+esc(main)+'</span>' : "")+(sub? '<span class="pr">'+esc(sub)+'</span>' : "")+body+
        (ev? '<span class="prev'+(ev.warn?" warn":"")+'"'+(ev.tip? ' title="'+esc(ev.tip)+'"' : "")+'>'+esc(ev.txt)+'</span>' : "")+'</div>'+
      '<button type="button" class="linkbtn ruedit" data-pr="edit:'+k+':'+i+'">Edit</button></div>';
  }).join("") || '<p class="lede" style="font-size:12.5px;margin:0">None yet.</p>';
  return '<div class="card panel prpanel" id="pr-'+k+'">'+head+'<div class="rurows">'+rows+'</div></div>';
}

/* The form: one dialog for every row kind, and for editing a proposal first. */
var PRED=null;   /* {k, i (index or -1), fields, onSave} */
function prOpen(o){
  PRED=o; el("pr-title").textContent=o.title;
  el("pr-fields").innerHTML=o.fields.map(function(f){
    var v=o.values[f[0]]==null? "" : String(o.values[f[0]]);
    if(f[2]==="select") return '<label class="fld">'+esc(f[1])+'<select data-prf="'+f[0]+'">'+f[3].map(function(x){ return '<option value="'+esc(x[0])+'"'+(x[0]===v?" selected":"")+'>'+esc(x[1])+'</option>'; }).join("")+'</select></label>';
    if(f[2]==="area") return '<label class="fld">'+esc(f[1])+'<textarea data-prf="'+f[0]+'" rows="3">'+esc(v)+'</textarea></label>';
    return '<label class="fld">'+esc(f[1])+'<input data-prf="'+f[0]+'" value="'+esc(v)+'"></label>';
  }).join("");
  el("pr-del").hidden=!o.onDelete; el("pr-del").dataset.armed=""; el("pr-del").textContent="Remove";
  el("pr-hint").textContent="";
  var d=el("pr-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  setTimeout(function(){ var f=el("pr-fields").querySelector("[data-prf]"); if(f) f.focus(); },50);
}
function prVals(){ var o={}; Array.prototype.forEach.call(el("pr-fields").querySelectorAll("[data-prf]"),function(x){ o[x.dataset.prf]=x.value.trim(); }); return o; }
async function prApply(k,next,entry){
  if(!DB || !PREFS) throw {code:"not_loaded"};
  var up={}; up[PR_SPEC[k].field]=next; up.updatedAt=today();
  await DB.doc("profile/prefs").update(up);
  try{ await DB.doc("rulelog/rl-"+Date.now()).set(Object.assign({at:new Date().toISOString(), kind:"pref", field:PR_SPEC[k].field, sec:k},entry)); }catch(e){}
}
function prEdit(k,i,prefill,proposal){
  var s=PR_SPEC[k], items=prItems(k), it= i>=0? items[i] : null;
  var vals= s.str? {text:it||""} : Object.assign({}, it||{});
  if(prefill) Object.keys(prefill).forEach(function(x){ if(prefill[x]!=null && prefill[x]!=="") vals[x]=prefill[x]; });
  prOpen({title:(it? "Edit" : "Add a")+" "+s.noun+(it && it.id? " · "+it.id : ""), fields:s.fields, values:vals,
    onSave:async function(v){
      if(s.fields.some(function(f){ return f[0]!=="note" && f[4]!=="opt" && !v[f[0]]; })) throw {msg:"Fill in "+s.fields.filter(function(f){return f[0]!=="note" && f[4]!=="opt";}).map(function(f){return f[1].split(" ")[0].toLowerCase();}).join(" and ")+"."};
      var arr=prItems(k).map(function(x){ return s.str? x : Object.assign({},x); }), before=it==null? null : (s.str? it : Object.assign({},it)), after;
      if(s.str) after=v.text; else { after=Object.assign({}, it||{}); s.fields.forEach(function(f){ after[f[0]]=v[f[0]]; });
        if(!it && s.idp){ var n=arr.reduce(function(m,x){ var q=parseInt(String(x.id||"").replace(/\D/g,""),10); return isNaN(q)? m : Math.max(m,q); },0)+1; after.id=s.idp+n; } }
      if(it!=null) arr[i]=after; else arr.push(after);
      await prApply(k,arr,{ruleId:prKeyOf(k,after), action:it!=null? "edit" : "add", before:before, after:after, via:proposal? "review" : "you", why:proposal? (proposal.p.why||"") : ""});
      toast((it!=null? "Saved" : "Added")+" — live from the next sweep");
    },
    onDelete: it==null? null : async function(){
      var arr=prItems(k).filter(function(x,j){ return j!==i; });
      await prApply(k,arr,{ruleId:prKeyOf(k,it), action:"remove", before:s.str? it : Object.assign({},it), after:null, via:"you", why:""});
      toast("Removed — you can undo it in the change log");
    }});
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-pr]"); if(!b) return;
  ev.preventDefault(); var p=String(b.dataset.pr).split(":");
  if(p[0]==="add") prEdit(p[1],-1); else if(p[0]==="edit") prEdit(p[1],+p[2]);
});
(function(){
  var sv=el("pr-save"), dl=el("pr-del");
  if(sv) sv.addEventListener("click",function(){ if(!PRED) return; var v=prVals();
    Promise.resolve().then(function(){ return PRED.onSave(v); }).then(function(){ closeDlg("pr-dialog"); })
      .catch(function(e){ el("pr-hint").textContent=(e&&e.msg)||"Couldn't save — try again."; }); });
  if(dl) dl.addEventListener("click",function(){ if(!PRED || !PRED.onDelete) return;
    if(dl.dataset.armed!=="1"){ dl.dataset.armed="1"; dl.textContent="Click again to remove"; return; }
    PRED.onDelete().then(function(){ closeDlg("pr-dialog"); }).catch(function(){ el("pr-hint").textContent="Couldn't remove — try again."; }); });
})();

/* ---------- 2. Evidence builders and the change log, used by Search review (22) ---------- */
function srSrc(id){ return srcs.find(function(s){return s.id===id;}); }
/* Evidence per source: finds over time, how far they got, and when it last found anything. */
function srSourceLines(){
  var t=today(), d30=addDays(t,-30), d90=addDays(t,-90), out=[];
  chSorted().forEach(function(ch){
    var rs=rolesOfCh(ch.id), scr=ch.kind==="manual"? 0 : (typeof insScreened==="function"? insScreened().filter(function(s){return s.ch===ch.id;}).length : 0);
    out.push("CHANNEL "+ch.id+" \""+ch.name+"\" — run by "+(ch.kind==="manual"? "the user" : "the sweep")+", status "+(ch.status||"active")+(ch.derived? ", sources derived from "+ch.derived : "")+
      "; found "+rs.length+" (last 30 days "+rs.filter(function(r){return r.seen>=d30;}).length+"), reached shortlist "+rs.filter(function(r){return insReach(r)>=2;}).length+
      ", reached To apply "+rs.filter(reachedApply).length+", the user turned down "+rs.filter(prTurnedDown).length+(scr? ", screened out by rules "+scr : ""));
    if(ch.derived) return;
    chItems(ch).forEach(function(x){
      var xr=rs.filter(function(r){return r.sourceId===x.id;}), last=xr.map(function(r){return r.seen;}).filter(Boolean).sort().pop()||"";
      var lr=ch.kind==="manual" && typeof srcLastRun==="function"? srcLastRun(x) : "";
      out.push("  SOURCE "+x.id+" \""+x.name+"\" status "+(x.status||"active")+"; found "+xr.length+" (30d "+xr.filter(function(r){return r.seen>=d30;}).length+", 30-90d "+xr.filter(function(r){return r.seen<d30 && r.seen>=d90;}).length+
        "), reached To apply "+xr.filter(reachedApply).length+", last found "+(last||"never")+(ch.kind==="manual"? ", last checked by the user "+(lr||"never") : "")+(x.note? "; note: "+x.note : ""));
    });
  });
  return out;
}
function srRunLines(){
  return runs.filter(function(r){return r.type==="sweep";}).sort(function(a,b){return a.date<b.date?1:-1;}).slice(0,6).map(function(r){
    var src=Array.isArray(r.sources)? r.sources.map(function(s){ return (s.name||s.id)+": "+(s.status||"")+(s.found!=null? " "+s.found : ""); }).join("; ") : "";
    return "- "+r.date+": found "+(r.found||0)+", to longlist "+(r.proposed||0)+", screened out "+(r.out||0)+(r.endpointFails? ", endpoint failures "+r.endpointFails : "")+(src? " | per source: "+src : " | per-source results not recorded");
  });
}
function srTermLines(){
  var tracked=rawRoles.some(function(r){return r.searchTerm;});
  return ((PREFS&&PREFS.searchTerms)||[]).map(function(g){
    return "- group \""+g.group+"\": "+g.terms+(tracked? " | found per term: "+String(g.terms||"").split(",").map(function(t){ t=t.trim(); var n=rawRoles.filter(function(r){return String(r.searchTerm||"").toLowerCase()===t.toLowerCase();}).length; return t+"="+n; }).join(", ") : " | which term found each role is not recorded yet");
  });
}
function srRuleLines(){
  var downs=ruTurnDowns();
  return ruRules().map(function(h){ var c=ruCard(h,downs);
    var wantedEx=(typeof scTally==="function"? scTally(h.id).wantedList : RU.checks.filter(function(x){return x.rule===h.id && x.wanted;})).slice(0,3).map(function(x){ return "    - the user WANTED this cut role: "+x.title+" ("+x.company+")"+(x.saw? " — saw: "+x.saw : ""); });
    var ex=ruItems(h.id).slice(0,4).map(function(it){ return "    - cut"+(it.near? " (NEAR MISS)" : "")+": "+it.title+" ("+it.company+")"+(it.saw? " — saw: "+it.saw : ""); });
    return h.id+" | "+h.name+" | "+ruFirm(h).toUpperCase()+" | checked at: "+stageWord(h.fires||"")+" | "+h.rule+"\n  how the sweep checks it (their check note): "+(h.check||"none written")+"\n  reasons it should catch: "+(c.reasons.join(", ")||"none linked")+
      "\n  cut "+c.cut+"; turned down later for those reasons "+c.later.length+"; spot-checked "+c.checks+", wanted "+c.wanted+(ex.length? "\n"+ex.join("\n") : "")+(wantedEx.length? "\n"+wantedEx.join("\n") : ""); });
}
/* One change log for the whole search. */
function srLogHtml(){
  if(!RU.log.length) return "";
  var k="sr-log", A={add:"Added",edit:"Changed",remove:"Removed",undo:"Undid a change to",handled:"Marked handled:",dismissed:"Marked not useful:",monitor:"Monitoring:",unmonitor:"Stopped monitoring:"}, K={rule:"rule",pref:"",source:"source",channel:"channel",company:"company",highlight:"highlight"};
  return '<details class="rulog" data-exp="'+k+'"'+(isOpen(k)?" open":"")+'><summary>Changes to your search<span class="cfmeta">'+RU.log.length+'</span></summary><ul>'+
    RU.log.slice(0,25).map(function(l){
      var kind=l.kind||"rule", nm=((l.after||l.before)||{}); nm= typeof nm==="string"? nm.slice(0,60) : (nm.name||nm.group||"");
      var idTxt= (kind==="pref" && !/^S\d/.test(l.ruleId)) || kind==="highlight"? "" : l.ruleId;
      var what=[A[l.action]||l.action, K[kind]||(PR_SPEC[l.sec]? PR_SPEC[l.sec].noun : ""), idTxt].filter(Boolean).map(esc).join(" ")+(nm? " · "+esc(nm) : "");
      return '<li><span class="d">'+esc(niceShort(String(l.at).slice(0,10)))+'</span><span class="w">'+what+
        '<small>'+esc(l.via==="review"? "From Claude's review" : l.via==="card"? "From a Highlights suggestion" : l.via==="ruleout"? "From Rule out roles like this" : l.via==="undo"? "Undo" : "By you")+(l.why? " — "+esc(l.why) : "")+'</small>'+
        (kind==="rule" && l.action!=="undo"? '<small class="eff">'+esc(ruEffect(l))+'</small>' : "")+'</span>'+
        (l.action!=="undo" && !l.undone? '<button type="button" class="linkbtn" data-sr="undo:'+esc(l.id)+'">Undo</button>' : '<span class="u">'+(l.undone?"Undone":"")+'</span>')+'</li>';
    }).join("")+'</ul></details>';
}
async function srLog(entry){ try{ await DB.doc("rulelog/rl-"+Date.now()).set(Object.assign({at:new Date().toISOString()},entry)); }catch(e){} }
function srDocSnap(coll,id){ var x= coll==="sources"? srSrc(id) : coll==="companies"? companies.find(function(c){return c.id===id;}) : chById(id); if(!x) return null; var o=Object.assign({},x); delete o.id; return o; }
async function srUndo(logId){
  var l=RU.log.find(function(x){return x.id===logId;}); if(!l) return;
  var kind=l.kind||"rule"; if(kind==="rule") return ruUndo(logId);
  try{
    if(kind==="highlight"){
      if(l.action==="unmonitor" && l.before) await DB.doc("hlstate/"+hlId(l.ruleId)).set(l.before);
      else await DB.doc("hlstate/"+hlId(l.ruleId)).delete();
      await srLog({kind:kind, ruleId:l.ruleId, action:"undo", before:l.after, after:null, via:"undo", why:"Undid the "+niceShort(String(l.at).slice(0,10))+" mark"});
      await DB.doc("rulelog/"+logId).update({undone:true}); toast(l.action==="unmonitor"? "Undone — monitoring again" : "Undone — the highlight is back"); return;
    }
    if(kind==="source"||kind==="channel"||kind==="company"){
      var coll=kind==="source"? "sources" : kind==="company"? "companies" : "channels", cur=srDocSnap(coll,l.ruleId);
      if(l.before) await DB.doc(coll+"/"+l.ruleId).set(l.before); else await DB.doc(coll+"/"+l.ruleId).delete();
      await srLog({kind:kind, ruleId:l.ruleId, action:"undo", before:cur, after:l.before, via:"undo", why:"Undid the "+niceShort(String(l.at).slice(0,10))+" change"});
    } else {
      var k=l.sec || Object.keys(PR_SPEC).find(function(x){return PR_SPEC[x].field===l.field;}), s=PR_SPEC[k], arr=prItems(k).map(function(x){ return s.str? x : Object.assign({},x); });
      var keyA=l.after==null? null : prKeyOf(k,l.after), idx= keyA==null? -1 : arr.findIndex(function(x){ return prKeyOf(k,x)===keyA; });
      if(l.action==="add"){ if(idx>=0) arr.splice(idx,1); }
      else if(l.action==="remove"){ if(l.before!=null) arr.push(l.before); }
      else if(idx>=0) arr[idx]=l.before; else if(l.before!=null) arr.push(l.before);
      await prApply(k,arr,{ruleId:l.ruleId, action:"undo", before:l.after, after:l.before, via:"undo", why:"Undid the "+niceShort(String(l.at).slice(0,10))+" change"});
    }
    await DB.doc("rulelog/"+logId).update({undone:true}); toast("Undone");
  }catch(e){ toast("Couldn't undo — try again",true); }
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-sr^="undo:"]'); if(!b) return;
  ev.preventDefault(); ev.stopPropagation(); srUndo(String(b.dataset.sr).slice(5));
},true);
