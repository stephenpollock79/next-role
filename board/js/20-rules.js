"use strict";
/* ===== Deal-breakers: edit, evidence and review (3 Oct) =====
   A rule can be wrong two ways, and both are shown together so a change is never judged on one side:
   - too strict: it cuts roles you would have wanted. Evidence: what the sweep screened out (`screened`,
     with what it saw), and your spot-check of those cuts (`rulechecks`).
   - too loose: roles get through that you turn down by hand. Evidence: your longlist and shortlist
     rejections whose reason this rule is meant to catch (rule.reasons, else the defaults for the rule's type).
   Rules stay in profile/prefs hardRules {id, name, fires, rule}, plus an optional `reasons` list the
   skills ignore. Every change is logged in `rulelog` with before and after, so it can be undone and its
   effect seen. */

var RU={open:{}, chk:{}, checks:[], log:[], reviews:[], loaded:false};
var RULE_FIRES=["Search","Search, else Gate 2","Enrichment"];
/* Reasons you give that a rule could have caught. "Chose another route" and "Other" never can. */
/* Firmness (3 Oct): how far a rule can bend. Fixed = a fact of life or law (right to work, region,
   office travel): never suggested for loosening anywhere. Firm = a strong preference: only questioned when your
   own spot-checks say its cuts were roles you wanted. Tunable = open to evidence. Stored as `firm` on the rule;
   rules without one take these defaults. */
/* Rules without a stored firmness take their type's default (RULE_TYPE_FIRM, in 01), else Tunable. */
var RULE_FIRM_LAB={fixed:"Fixed", firm:"Firm", tunable:"Tunable"};
var RULE_FIRM_TIP={fixed:"A fact of your life or the law. Never suggested for loosening; if it cuts a lot, the fix is on the sourcing side.",
  firm:"A strong preference. Only questioned when your spot-checks say it cut roles you wanted.",
  tunable:"Open to evidence. Suggestions can tighten or loosen it."};
function ruFirm(h){ return h && RULE_FIRM_LAB[h.firm]? h.firm : (h && RULE_TYPE_FIRM[h.type]) || "tunable"; }
function ruFirmChip(h){ var f=ruFirm(h); return '<span class="rufirm f-'+f+'" title="'+esc(RULE_FIRM_TIP[f])+'">'+RULE_FIRM_LAB[f]+'</span>'; }
/* The two "pick the thing" reasons (END_SUB) link by `endRule` / `endGap`, never through a rule's reasons list. */
function ruReasonList(){ return END_LISTS.me.filter(function(x){ return x!=="Chose another route" && x!=="Other" && !END_SUB[x]; }); }
function ruRules(){ return ((PREFS && PREFS.hardRules)||[]).filter(function(x){ return x && x.id; }); }
function ruReasons(h){ return Array.isArray(h.reasons)? h.reasons : (RULE_TYPE_REASONS[h.type]||[]).filter(function(x){ return END_LISTS.me.indexOf(x)>=0; }); }
function ruTypeOk(x){ return RULE_TYPES.some(function(r){ return r[0]===x; }); }
function ruTypeLab(x){ var r=RULE_TYPES.find(function(r){ return r[0]===x; }); return r? r[1] : ""; }
/* The pay floor as stored on a rule: {amount, currency, basis}; anything else is dropped. */
function ruFloorClean(f){ if(!f || !(+f.amount>0)) return null; return {amount:+f.amount, currency:String(f.currency||"GBP").toUpperCase().slice(0,3), basis:f.basis==="base"? "base" : "total"}; }

/* ---------- evidence ---------- */
function ruSweeps(){ return screened.filter(function(d){return d.date;}).slice().sort(function(a,b){ return a.date<b.date? -1 : 1; }); }
function ruCutN(d,id){ var n=d.rules && d.rules[id]; if(n!=null) return +n||0; return (d.items||[]).filter(function(it){return it.rule===id;}).length; }
function ruCuts(id){ return ruSweeps().reduce(function(m,d){ return m+ruCutN(d,id); },0); }
function ruItems(id){
  var out=[]; ruSweeps().slice().reverse().forEach(function(d){ (d.items||[]).forEach(function(it){ if(it.rule===id) out.push(Object.assign({date:d.date},it)); }); });
  /* Near-misses first (the sweep flags them from 3 Oct): they are the cuts most worth a look. */
  return out.filter(function(x){return x.near;}).concat(out.filter(function(x){return !x.near;}));
}
function ruKey(it){ return slug((it.rule||"")+"-"+(it.company||"")+"-"+(it.title||"")).slice(0,90) || "x"; }
function ruCheckOf(it){ var k=ruKey(it); return RU.checks.find(function(c){return c.id===k;}); }
/* Your own rejections at the longlist and shortlist, with the reason you gave. */
function ruTurnDowns(){
  return roles.concat(typeof insFolded==="function"? insFolded() : []).map(function(r){
    if(r.stage!=="g1_rejected" && r.stage!=="g2_rejected") return null;
    var e=endOf(r); if(!e || e.by!=="me") return null;
    return {title:r.title||"", company:r.company||"", reason:e.reason, at:e.at||"", where:r.stage==="g1_rejected"? "Longlist" : "Shortlist", id:r.folded? "" : r.id, rule:r.endRule||"", gap:r.endGap||""};
  }).filter(Boolean);
}
function ruCard(h,downs){
  var rs=ruReasons(h), later=downs.filter(function(x){ return x.rule===h.id || (!x.rule && rs.indexOf(x.reason)>=0); });
  /* Spot-checks count only since the rule last changed (5 Oct): marks about the old wording aren't evidence
     about the new one. scTally (27) is the one place this is worked out; the weekly check uses it too. */
  var T= typeof scTally==="function"? scTally(h.id) : {n:0, wanted:0, strict:false};
  var checks={length:T.n}, wanted=T.wanted;
  var cut=ruCuts(h.id), hint="";
  /* A fixed rule is never too strict: wanted screen-outs mean the sweep misreads it, so its check note is the fix. */
  if(T.strict) hint= ruFirm(h)==="fixed"? "misread" : "strict";
  else if(later.length>=5) hint="loose";
  return {cut:cut, later:later, checks:checks.length, wanted:wanted, hint:hint, reasons:rs};
}
/* Effect of a change: cuts per sweep before and since, and turn-downs since. */
function ruEffect(entry){
  var id=entry.ruleId, at=String(entry.at||"").slice(0,10), sw=ruSweeps();
  var before=sw.filter(function(d){return d.date<at;}).slice(-4), after=sw.filter(function(d){return d.date>=at;});
  function avg(a){ return a.length? Math.round(a.reduce(function(m,d){return m+ruCutN(d,id);},0)/a.length) : null; }
  var b=avg(before), a=avg(after);
  if(!after.length) return "No sweep since";
  return "Cut per sweep: "+(b==null? "—" : b)+" → "+a+" ("+plural(after.length,"sweep")+" since)";
}

/* ---------- the panel inside About me › My criteria ---------- */
function rulesPanelHtml(){
  var rules=ruRules(), downs=ruTurnDowns();
  var head='<div class="sechead"><span class="eyebrow">Deal-breakers — fail one and it\'s a no</span>'+
    '<span class="rusp"></span><button type="button" class="btn sm" data-ru="add">+ Add a rule</button>'+
    '<a href="#" class="ovmore" data-gotab="review" title="Talk through where your job search is stuck, rules included">Search review →</a></div>';
  var intro='<p class="lede rulede">Each rule shows both sides: what the sweep <b>screened out</b> with it before your longlist, and what <b>you turned down</b> at the longlist or shortlist for a reason it should catch. '+
    'Each week Claude picks five screen-outs for you to confirm (Highlights show when they\'re ready); you can also open a rule and check any of its screen-outs. Edits are live from the next sweep. Each rule is <b>Fixed</b> (a fact of life or law, never suggested for loosening), <b>Firm</b> (questioned only on your spot-checks) or <b>Tunable</b>.</p>';
  var rows=rules.map(function(h){
    var c=ruCard(h,downs), open=!!RU.open[h.id];
    var hint= (c.hint==="strict"||c.hint==="misread")? '<span class="ruhint s" title="Since the rule last changed, you marked '+c.wanted+' of '+c.checks+' checked screen-outs as roles you\'d have wanted'+(c.hint==="misread"? ". It\'s a fixed rule, so the sweep is reading it wrong" : "")+'">'+(c.hint==="misread"? "Sweep may misread it" : "May be too strict")+'</span>'+
        (typeof hsOpen==="function"? '<button type="button" class="linkbtn rusug" data-swc="sug:'+esc(h.id)+'" title="Claude drafts one change for you to accept, edit or reject">Suggest a change</button>' : "")
      : c.hint==="loose"? '<span class="ruhint l" title="'+c.later.length+' roles got through and you turned them down for a reason this rule covers">May be too loose</span>' : "";
    var stats='<div class="rustats">'+
      '<span title="Screened out by the sweep with this rule, across all sweeps"><b>'+c.cut+'</b> screened out</span>'+
      '<span title="'+(c.reasons.length? "Your reasons it covers: "+esc(c.reasons.join(", ")) : "No rejection reasons linked — set them in Edit")+'"><b>'+((c.reasons.length||c.later.length)? c.later.length : "–")+'</b> you turned down</span>'+
      '<span title="Screened-out roles you checked since the rule last changed, and how many you\'d have wanted"><b>'+(c.checks? c.wanted+"/"+c.checks : "–")+'</b> wanted</span></div>';
    var detail="";
    if(open){
      var items=ruItems(h.id).slice(0,8);
      var cuts=items.length? items.map(function(it){ var ck=ruCheckOf(it), k=ruKey(it);
          return '<li><div class="ruit"><b>'+esc(it.title||"")+'</b><span>'+esc(it.company||"")+(it.date? ' · '+esc(niceShort(it.date)) : "")+'</span>'+
            (it.saw? '<em>'+(it.near? '<span class="runear">Near miss</span> ' : "")+'Saw: '+esc(it.saw)+'</em>' : "")+'</div>'+
            '<div class="ruck"><button type="button" class="ruckb'+(ck && !ck.wanted?" on":"")+'" data-ru="ck:'+esc(h.id)+':0" data-k="'+esc(k)+'" title="Right to screen it out">Fine to screen out</button>'+
            '<button type="button" class="ruckb w'+(ck && ck.wanted?" on":"")+'" data-ru="ck:'+esc(h.id)+':1" data-k="'+esc(k)+'" title="It shouldn\'t have been screened out">Would have wanted</button></div></li>'; }).join("")
        : '<li class="ruempty">Nothing screened out by this rule in the recorded sweeps.</li>';
      var later=c.later.slice().sort(function(a,b){return a.at<b.at?1:-1;}).slice(0,8);
      var lat= (!c.reasons.length && !c.later.length)? '<li class="ruempty">Nothing turned down for this rule yet. Pick it under “Fails one of my must-haves” when you reject a role.</li>'
        : later.length? later.map(function(x){ return '<li><div class="ruit"><b>'+esc(x.title)+'</b><span>'+esc(x.company)+' · '+esc(x.where)+(x.at? ' · '+esc(niceShort(x.at)) : "")+'</span><em>'+esc(x.reason)+'</em></div></li>'; }).join("")
        : '<li class="ruempty">Nothing turned down for '+esc(c.reasons.join(" or "))+'.</li>';
      detail='<div class="rudet"><div><h5>Screened out by the sweep <small>latest '+items.length+' of '+c.cut+'</small></h5><ul class="rul">'+cuts+'</ul></div>'+
        '<div><h5>You turned down at the longlist or shortlist <small>'+c.later.length+'</small></h5><ul class="rul">'+lat+'</ul></div></div>';
    }
    return '<div class="rurow'+(open?" open":"")+'"><button type="button" class="rux" data-ru="open:'+esc(h.id)+'" aria-expanded="'+open+'" title="'+(open?"Hide":"Show")+' the evidence">'+(open?"▾":"▸")+'</button>'+
      '<span class="pid">'+esc(h.id)+'</span>'+
      '<div class="rumain"><div class="rutop"><span class="pn">'+esc(h.name||"")+'<span class="pf">'+esc(stageWord(h.fires||""))+(h.basis==="company"? " · about the company" : "")+'</span></span>'+ruFirmChip(h)+hint+'</div>'+
        '<span class="pr">'+esc(h.rule||"")+'</span>'+(h.check? '<details class="rucheck" data-rck="'+esc(h.id)+'"'+(RU.chk[h.id]? " open" : "")+'><summary title="The sweep reads this every run: how to test the rule">How the sweep checks it</summary><span>'+esc(h.check)+'</span></details>' : "")+'</div>'+
      stats+'<button type="button" class="linkbtn ruedit" data-ru="edit:'+esc(h.id)+'">Edit</button>'+detail+'</div>';
  }).join("") || '<p class="lede" style="font-size:12.5px;margin:0">No deal-breakers yet. Add one, or ask Claude to suggest some.</p>';
  /* Ruled-out companies (11 Oct): a second way roles get screened out, kept on each company's card, not here. */
  var nRo=companies.filter(coOff).length;
  var roHtml='<p class="lede rulede rucofyi" style="margin-top:12px">Roles at '+(nRo? '<b>'+nRo+'</b> compan'+(nRo===1?"y":"ies")+' you’ve ruled out' : 'companies you rule out')+
    ' are screened out too, from every source. Rule one out from its rating, or when you reject a role there. '+
    '<a href="#" data-gotab="companies" data-cooff="1">'+(nRo? "See them on Targets › Companies →" : "Targets › Companies →")+'</a></p>';
  return '<div class="card panel rupanel" id="ru-panel">'+head+intro+'<div class="rurows">'+rows+'</div>'+roHtml+ruLogHtml()+'</div>';
}


/* ---------- writes: every change goes through here and is logged ---------- */
async function ruApply(next,entry){
  if(!DB || !PREFS) throw {code:"not_loaded"};
  await DB.doc("profile/prefs").update({hardRules:next, updatedAt:today()});
  try{ await DB.doc("rulelog/rl-"+Date.now()).set(Object.assign({at:new Date().toISOString(), kind:"rule"},entry)); }catch(e){ console.warn("rule log",e); }
}
function ruClone(){ return ruRules().map(function(h){ return Object.assign({},h); }); }
function ruNextId(rs){ var n=rs.reduce(function(m,x){ var k=parseInt(String(x.id).replace(/\D/g,""),10); return isNaN(k)? m : Math.max(m,k); },0)+1; return "G"+n; }
function ruStrip(h){ if(!h) return null; var o={id:h.id, name:h.name||"", fires:h.fires||"", rule:h.rule||""}; if(Array.isArray(h.reasons)) o.reasons=h.reasons.slice(); if(RULE_FIRM_LAB[h.firm]) o.firm=h.firm; if(h.check) o.check=String(h.check); if(h.basis==="company"||h.basis==="role") o.basis=h.basis; if(ruTypeOk(h.type)) o.type=h.type; var fl=ruFloorClean(h.floor); if(fl) o.floor=fl; return o; }

/* ---------- the change log ---------- */
function ruLogHtml(){
  var LOG=RU.log.filter(function(l){ return !l.kind || l.kind==="rule"; });
  if(!LOG.length) return "";
  var k="ru-log", A={add:"Added",edit:"Changed",remove:"Removed",undo:"Undid a change to"};
  return '<details class="rulog" data-exp="'+k+'"'+(isOpen(k)?" open":"")+'><summary>Change log<span class="cfmeta">'+LOG.length+'</span></summary><ul>'+
    LOG.slice(0,20).map(function(l){
      var what=(A[l.action]||l.action)+" "+esc(l.ruleId)+((l.after||l.before)? " · "+esc((l.after||l.before).name||"") : "");
      return '<li><span class="d">'+esc(niceShort(String(l.at).slice(0,10)))+'</span><span class="w">'+what+
        '<small>'+esc(l.via==="review"? "From Claude's review" : l.via==="card"? "From a Highlights suggestion" : l.via==="ruleout"? "From Rule out roles like this" : l.via==="undo"? "Undo" : "By you")+(l.why? " — "+esc(l.why) : "")+'</small>'+
        (l.action!=="undo"? '<small class="eff">'+esc(ruEffect(l))+'</small>' : "")+'</span>'+
        (l.action!=="undo" && !l.undone? '<button type="button" class="linkbtn" data-ru="undo:'+esc(l.id)+'">Undo</button>' : '<span class="u">'+(l.undone?"Undone":"")+'</span>')+'</li>';
    }).join("")+'</ul></details>';
}

/* ---------- the editor dialog ---------- */
var RUED=null;   /* {id|null, proposal:{rv,i}|null} */
function ruOpenEditor(id,prefill,proposal,mode){
  var h=id? ruRules().find(function(x){return x.id===id;}) : null;
  if(prefill) Object.keys(prefill).forEach(function(k){ if(prefill[k]===undefined) delete prefill[k]; });
  var v=Object.assign({name:"", fires:"Search, else Gate 2", rule:"", reasons:[], firm:"tunable", check:"", basis:"", type:"", floor:null}, h? ruStrip(h) : {}, prefill||{});
  if(h && !RULE_FIRM_LAB[h.firm]) v.firm=ruFirm(h);
  if(h && !Array.isArray(h.reasons) && !(prefill&&prefill.reasons)) v.reasons=ruReasons(h);
  RUED={id:id||null, proposal:proposal||null};
  el("ru-title").textContent= id? "Edit "+id+(h&&h.name? " · "+h.name : "") : "Add a deal-breaker";
  el("ru-name").value=v.name; el("ru-rule").value=v.rule; if(el("ru-checknote")) el("ru-checknote").value=v.check||"";
  var fs=RULE_FIRES.slice(); if(v.fires && fs.indexOf(v.fires)<0) fs.push(v.fires);
  el("ru-fires").innerHTML=fs.map(function(f){ return '<option value="'+esc(f)+'"'+(f===v.fires?" selected":"")+'>'+esc(stageWord(f))+'</option>'; }).join("");
  el("ru-reasons").innerHTML=ruReasonList().map(function(r){ var on=(v.reasons||[]).indexOf(r)>=0;
    return '<label class="ruchk"><input type="checkbox" value="'+esc(r)+'"'+(on?" checked":"")+'> '+esc(r)+'</label>'; }).join("");
  /* Basis (3 Oct): a rule about the company is checked once per company and reused for every role there. */
  var bs=el("ru-basis"); if(bs){ bs.innerHTML=[["","Decide from the name"],["company","About the company — checked once, reused for every role there"],["role","About the role"]].map(function(x){ return '<option value="'+x[0]+'"'+((v.basis||"")===x[0]?" selected":"")+'>'+esc(x[1])+'</option>'; }).join(""); }
  /* Type (22 Oct): what the rule is about; a pay rule also holds its floor. */
  var ty=el("ru-type"); if(ty){ ty.innerHTML=[["","Pick one…"]].concat(RULE_TYPES).map(function(x){ return '<option value="'+x[0]+'"'+((v.type||"")===x[0]?" selected":"")+'>'+esc(x[1])+'</option>'; }).join(""); }
  var fl=v.floor||{}; if(el("ru-flamt")){ el("ru-flamt").value=fl.amount||""; el("ru-flcur").value=fl.currency||ruDefCur(); el("ru-flbasis").value=fl.basis||"total"; }
  ruFloorShow();
  var fm=el("ru-firm"); if(fm){ fm.innerHTML=["fixed","firm","tunable"].map(function(k){ return '<option value="'+k+'"'+(v.firm===k?" selected":"")+'>'+RULE_FIRM_LAB[k]+' — '+esc(RULE_FIRM_TIP[k])+'</option>'; }).join(""); }
  el("ru-del").hidden=!id; el("ru-hint").textContent=""; el("ru-check").hidden=!SAMPLE; el("ru-lint").innerHTML="";
  /* Describe first (4 Oct); a review proposal or a prefill goes straight to the fields. */
  var af=el("ru-askfirm"); if(af) af.innerHTML=["fixed","firm","tunable"].map(function(k){ return '<option value="'+k+'"'+(v.firm===k?" selected":"")+'>'+RULE_FIRM_LAB[k]+' — '+esc(RULE_FIRM_TIP[k])+'</option>'; }).join("");
  el("ru-asktext").value=""; el("ru-askhint").textContent="";
  el("ru-asklab").textContent= id? "What should change?" : "What should never get through?";
  el("ru-asktext").placeholder= id? "In your own words, e.g. allow up to 3 office days a month in Manchester" : "In your own words, e.g. roles that need a language other than English";
  if(!mode) RU_DRAFT=null;
  var cur=el("ru-askcur"); cur.hidden=!h; cur.innerHTML= h? '<span class="eyebrow">Now</span><p>'+esc(h.rule||"")+'</p>' : "";
  ruMode(mode || ((prefill||proposal||!SAMPLE)? "fields" : "ask"));
  if(!SAMPLE && !mode) el("ru-hint").textContent="Claude isn't available in this view, so write it yourself.";
  var d=el("ru-dialog"); if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
  setTimeout(function(){ var f= RU_MODE==="ask"? el("ru-asktext") : el(id? "ru-rule" : "ru-name"); if(f) f.focus(); },50);
}
var RU_MODE="fields", RU_DRAFT=null;
function ruMode(m){ RU_MODE=m; el("ru-ask").hidden=m!=="ask"; el("ru-draft").hidden=m!=="draft"; el("ru-fields").hidden=m!=="fields"; el("ru-fieldacts").hidden=m!=="fields";
  el("ru-fields").style.display= m==="fields"? "flex" : "none"; }
/* Claude drafts the whole rule from your words, against every rule you have. */
async function ruDraft(){
  var txt=el("ru-asktext").value.trim(), firm=el("ru-askfirm").value, editId=RUED&&RUED.id;
  if(!txt){ el("ru-askhint").textContent= editId? "Say what should change." : "Say what should never get through."; return; }
  if(!SAMPLE){ ruMode("fields"); return; }
  el("ru-askhint").textContent="Claude is drafting…"; el("ru-draftbtn").disabled=true;
  var rules=ruRules().map(function(h){ return h.id+" | "+(h.name||"")+" | checked at: "+(h.fires||"")+" | "+ruFirm(h)+" | about: "+(h.basis||"?")+" | type: "+(h.type||"?")+" | "+(h.rule||"")+(h.check? " | sweep check: "+h.check : ""); }).join("\n");
  var prompt="You maintain a job seeker's deal-breakers. The sweep drops any role that fails one before the user sees it; a role it can't judge from the advert is checked later by the shortlist research.\n\n"+
    "Existing deal-breakers (id | name | when checked | firmness | about | type | rule | sweep check):\n"+rules+"\n\n"+
    (editId? "The user wants to CHANGE "+editId+". What should change, in their words: "+txt+"\nRewrite "+editId+" to include it. action must be \"update\" with target "+editId+"."
      : "The user wants to ADD a deal-breaker. In their words: "+txt+"\nIf it is the same kind of thing as an existing rule, propose updating that rule (action \"update\", target its id) and ALSO give the standalone version in asNew. Otherwise action \"new\".")+
    "\nFirmness the user chose: "+firm+".\n\nWrite:\n- name: two or three words.\n- rule: what is out AND what stays in, so it doesn't over-reach. Plain "+engVar()+" English, one to four sentences.\n"+
    "- check: how the sweep should test it from an advert (where to look, what counts, what to do when the advert is silent). One to three sentences.\n"+
    "- For an UPDATE, rule and check are the COMPLETE new wording of that rule: keep everything it already excludes and keeps in, word for word where you can, and add the new part. Never drop anything the rule already covers. asNew holds only the new part on its own.\n"+
    "- fires: \"Search\" when an advert always shows it; \"Search, else Gate 2\" when the advert usually shows it but research may be needed; \"Enrichment\" when only company research can tell.\n"+
    "- basis: \"company\" when it's a fact about the employer (decided once per company), else \"role\".\n"+
    "- type: what the rule is about, exactly one of: "+RULE_TYPES.map(function(x){ return x[0]+" ("+x[1]+")"; }).join(", ")+".\n"+
    "- floor: only when type is pay: the minimum as {\"amount\":<number, yearly>,\"currency\":\"<ISO code, e.g. GBP>\",\"basis\":\"total|base\"}; otherwise null.\n"+
    "- reasons: which of these turn-down reasons the rule should catch, if any: "+ruReasonList().join(", ")+".\n"+
    "- why: one short sentence on why you chose new or update.\n\n"+
    'Reply with JSON only: {"action":"new|update","target":"<id or empty>","name":"","rule":"","check":"","fires":"","basis":"","type":"","floor":null,"reasons":[],"why":"","asNew":{"name":"","rule":"","check":"","fires":"","basis":"","type":"","floor":null,"reasons":[]}}';
  try{
    var j = SAMPLE.json? await SAMPLE.json([{role:"user",content:prompt}],{cache:false, modelTier:"default"})
      : await SAMPLE([{role:"user",content:prompt}],{cache:false}).then(function(x){ var m=String(x.text||"").match(/\{[\s\S]*\}/); return m? JSON.parse(m[0]) : {}; });
    if(!j || !j.rule) throw {code:"empty"};
    if(editId){ j.action="update"; j.target=editId; }
    if(j.action==="update" && !ruRules().some(function(h){ return h.id===j.target; })) j.action="new";
    /* Guard (4 Oct): an update must keep what the rule already says. If the draft drops most of it, join the
       old wording and the new part instead, so nothing is lost by pressing Update. */
    if(j.action==="update"){ var oh=ruRules().find(function(x){ return x.id===j.target; });
      if(oh && !ruKeeps(oh.rule, j.rule)){ j.rule=String(oh.rule||"").trim()+" "+String(j.rule).trim(); if(oh.check && j.check && !ruKeeps(oh.check, j.check)) j.check=String(oh.check).trim()+" "+String(j.check).trim(); j.joined=true; } }
    j.firm=firm; RU_DRAFT=j; ruDrawDraft(); ruMode("draft");
  }catch(e){ el("ru-askhint").textContent= e && e.code==="not_granted"? "Claude wasn't allowed. Use Edit the fields yourself." : "Couldn't draft it. Try again, or edit the fields yourself."; }
  el("ru-draftbtn").disabled=false;
}
/* Does the new wording keep most of the old one's distinctive words? */
function ruKeeps(oldT,newT){ var w=String(oldT||"").toLowerCase().match(/[a-z][a-z-]{4,}/g)||[], n=String(newT||"").toLowerCase(); if(!w.length) return true;
  var u=w.filter(function(x,i){ return w.indexOf(x)===i; }); return u.filter(function(x){ return n.indexOf(x)>=0; }).length/u.length >= 0.6; }
function ruDraftVals(asNew){ var j=RU_DRAFT||{}, s=asNew? Object.assign({},j.asNew||{}) : j;
  var fs=RULE_FIRES.indexOf(s.fires)>=0? s.fires : "Search, else Gate 2";
  var o={name:s.name||"", rule:s.rule||"", check:s.check||"", fires:fs, basis:(s.basis==="company"||s.basis==="role")? s.basis : "", firm:j.firm||"tunable",
    type:ruTypeOk(s.type)? s.type : "", floor:s.type==="pay"? ruFloorClean(s.floor) : null,
    reasons:(s.reasons||[]).filter(function(r){ return ruReasonList().indexOf(r)>=0; })};
  /* An update keeps whatever the draft leaves blank. */
  if(!asNew && j.action==="update"){ ["name","check","basis","type","floor"].forEach(function(k){ if(!o[k]) delete o[k]; }); if(!o.reasons.length) delete o.reasons;
    /* Folding a new idea into an existing rule keeps that rule's firmness; editing a rule uses the one you picked. */
    if(!(RUED && RUED.id)) delete o.firm; }
  return o; }
function ruDrawDraft(){
  var j=RU_DRAFT, up=j.action==="update", h=up? ruRules().find(function(x){ return x.id===j.target; }) : null, v=ruDraftVals(false);
  if(h) v=Object.assign({firm:ruFirm(h), reasons:ruReasons(h)}, ruStrip(h), v); v.reasons=v.reasons||[]; v.firm=v.firm||"tunable";
  var asNew=up && !(RUED&&RUED.id) && j.asNew && j.asNew.rule;
  el("ru-draft").innerHTML=
    (up && !(RUED&&RUED.id)? '<div class="rufold"><b>This fits inside '+esc(h.name||j.target)+' ('+esc(j.target)+').</b> '+esc(j.why||"")+'</div>' : "")+
    (j.joined? '<p class="rusmall">Claude\'s wording left out part of what '+esc(j.target)+' says now, so the new part is added after the current wording. Use Edit to tidy it.</p>' : "")+
    (up? '<div class="rudiff"><div><span class="eyebrow">Now</span><p>'+esc(h.rule||"")+'</p></div><div><span class="eyebrow">Suggested</span><p>'+esc(v.rule)+'</p></div></div>'
       : '<div class="rudr"><span class="eyebrow">Name</span><p><b>'+esc(v.name)+'</b></p><span class="eyebrow">The rule</span><p>'+esc(v.rule)+'</p></div>')+
    (v.check? '<div class="rudr"><span class="eyebrow">How the sweep checks it</span><p>'+esc(v.check)+'</p></div>' : "")+
    '<p class="rusmall">'+(v.type? esc(ruTypeLab(v.type))+(v.type==="pay" && v.floor? " "+esc(fmtMoney(v.floor.amount,v.floor.currency))+(v.floor.basis==="base"? " base" : " total") : "")+' · ' : "")+esc(stageWord(v.fires))+' · '+(v.basis==="company"? "about the company" : v.basis==="role"? "about the role" : "decided from the name")+' · '+RULE_FIRM_LAB[v.firm]+
      (v.reasons.length? ' · catches turn-downs for '+esc(v.reasons.join(", ")) : "")+'</p>'+
    '<div class="statusacts"><button type="button" class="btn primary" data-rud="save">'+(up? "Update "+esc(j.target) : "Save rule")+'</button>'+
      (asNew? '<button type="button" class="btn" data-rud="new">Add as a new rule anyway</button>' : "")+
      '<button type="button" class="btn" data-rud="edit">Edit</button><button type="button" class="btn ghost" data-rud="back">Back</button><button type="button" class="btn ghost" data-close="ru-dialog">Cancel</button>'+
      '<span class="statushint" id="ru-drhint"></span></div>';
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-rud]"); if(!b || !RU_DRAFT) return;
  ev.preventDefault(); var a=b.dataset.rud, j=RU_DRAFT;
  if(a==="back"){ ruMode("ask"); return; }
  var asNew=a==="new", v=ruDraftVals(asNew), target=(!asNew && j.action==="update")? j.target : null;
  if(a==="edit"){ ruOpenEditor(target, v, null, "fields"); return; }
  ruOpenEditor(target, v, null, "fields"); ruEdSave();
});
/* The currency a new pay floor starts in: an existing pay rule's, else pounds. */
function ruDefCur(){ var f=payFloor(); return f? f.currency : "GBP"; }
function ruFloorShow(){ var w=el("ru-floorwrap"), ty=el("ru-type"), on=!!(ty && ty.value==="pay"); if(w){ w.hidden=!on; w.style.display=on? "" : "none"; } }
document.addEventListener("change",function(ev){ if(ev.target && ev.target.id==="ru-type") ruFloorShow(); });
function ruEdFloor(){ var ty=(el("ru-type")||{}).value; if(ty!=="pay" || !el("ru-flamt")) return null;
  return ruFloorClean({amount:String(el("ru-flamt").value||"").replace(/[^\d.]/g,""), currency:el("ru-flcur").value, basis:el("ru-flbasis").value}); }
function ruEdVals(){
  return {type:(el("ru-type")||{}).value||"", floor:ruEdFloor(), name:el("ru-name").value.trim(), fires:el("ru-fires").value, rule:el("ru-rule").value.trim(), firm:(el("ru-firm")||{}).value||"tunable", check:((el("ru-checknote")||{}).value||"").trim(), basis:(el("ru-basis")||{}).value||"",
    reasons:Array.prototype.map.call(el("ru-reasons").querySelectorAll("input:checked"),function(x){return x.value;})};
}
async function ruEdSave(){
  var v=ruEdVals(); if(!v.name || !v.rule){ el("ru-hint").textContent="Give it a name and the rule."; return; }
  var rs=ruClone(), before=null, after, id=RUED.id;
  function tidy(o){ if(!o.type) delete o.type; if(!o.floor || o.type!=="pay") delete o.floor; return o; }
  if(id){ var h=rs.find(function(x){return x.id===id;}); if(!h) return; before=ruStrip(h); tidy(Object.assign(h,v)); after=ruStrip(h); }
  else { id=ruNextId(rs); after=tidy(Object.assign({id:id},v)); rs.push(after); }
  var via=RUED.proposal? "review" : "you", why=RUED.proposal? (RUED.proposal.p.why||"") : "";
  try{
    await ruApply(rs,{ruleId:id, action:before? "edit" : "add", before:before, after:after, via:via, why:why});
    /* Added from a reject picker: select the new rule there (4 Oct). */
    if(END_SUB_NEW){ var ss=el(END_SUB_NEW); if(ss){ if(!ss.querySelector('option[value="'+id+'"]')){ var o=document.createElement("option"); o.value=id; o.textContent=id+" · "+v.name; ss.insertBefore(o, ss.querySelector('option[value="__new"]')); } ss.value=id; if(ss.id==="mr-sub" && typeof MR!=="undefined") MR.sub=id; } }
    END_SUB_NEW=null;
    closeDlg("ru-dialog"); toast(id+(before? " updated" : " added")+" — live from the next sweep");
  }catch(e){ console.warn(e); el("ru-hint").textContent="Couldn't save — try again."; }
}
async function ruEdDelete(){
  var id=RUED.id; if(!id) return;
  if(el("ru-del").dataset.armed!=="1"){ el("ru-del").dataset.armed="1"; el("ru-del").textContent="Click again to remove "+id; return; }
  var rs=ruClone(), h=rs.find(function(x){return x.id===id;});
  try{ await ruApply(rs.filter(function(x){return x.id!==id;}),{ruleId:id, action:"remove", before:ruStrip(h), after:null, via:"you", why:"", idx:rs.indexOf(h)});
    closeDlg("ru-dialog"); toast(id+" removed — you can undo it in the change log"); }
  catch(e){ el("ru-hint").textContent="Couldn't remove — try again."; }
}
/* Check the wording: can the sweep test it from an advert, and does it overlap another rule? */
async function ruEdCheck(){
  var v=ruEdVals(); if(!v.rule){ el("ru-hint").textContent="Write the rule first."; return; }
  var sample=SAMPLE; if(!sample) return;
  el("ru-lint").innerHTML='<p class="lede" style="margin:0;font-size:12.5px">Checking…</p>';
  var others=ruRules().filter(function(h){return h.id!==RUED.id;}).map(function(h){return h.id+" | "+h.name+" | "+h.rule;}).join("\n");
  var prompt="A job-search sweep drops any role that fails a deal-breaker, testing it at this stage: "+stageWord(v.fires)+
    " ('Search' = from the advert; 'Search, else shortlist' = from the advert if it says, else at research; 'Enrichment' = from company research).\n"+
    "Check this rule. 1) Can it be tested reliably at that stage? 2) Is it ambiguous — would two people apply it differently? 3) Does it overlap an existing rule? 4) Does it say what stays in as well as what is out?\n\n"+
    "Rule: "+v.name+" — "+v.rule+"\n\nOther rules:\n"+others+
    '\n\nReply with JSON only: {"ok":true|false,"issues":["<short issue>"],"suggestion":"<a better wording, or empty if fine>"}';
  try{
    var j = sample.json? await sample.json([{role:"user",content:prompt}],{cache:false, modelTier:"default"})
      : await sample([{role:"user",content:prompt}],{cache:false}).then(function(x){ var m=String(x.text||"").match(/\{[\s\S]*\}/); return m? JSON.parse(m[0]) : {}; });
    var iss=(j&&j.issues)||[];
    el("ru-lint").innerHTML= (j&&j.ok && !iss.length)? '<p class="rulintok">Looks testable and clear.</p>' :
      '<div class="rulint"><ul>'+iss.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>'+
      (j&&j.suggestion? '<p><b>Suggested:</b> '+esc(j.suggestion)+'</p><button type="button" class="btn sm" id="ru-usesug">Use this wording</button>' : "")+'</div>';
    var u=el("ru-usesug"); if(u) u.onclick=function(){ el("ru-rule").value=j.suggestion; el("ru-lint").innerHTML=""; };
  }catch(e){ el("ru-lint").innerHTML='<p class="lede" style="margin:0;font-size:12.5px">Couldn\'t check — '+esc((e&&e.code)||"try again")+'.</p>'; }
}

async function ruUndo(logId){
  var l=RU.log.find(function(x){return x.id===logId;}); if(!l) return;
  var rs=ruClone(), id=l.ruleId, cur=rs.find(function(x){return x.id===id;});
  if(l.action==="add") rs=rs.filter(function(x){return x.id!==id;});
  else if(l.action==="remove"){ if(!cur && l.before){ var at=(typeof l.idx==="number" && l.idx>=0 && l.idx<=rs.length)? l.idx : rs.length; rs.splice(at,0,Object.assign({},l.before)); } }
  else if(l.before){ if(cur) Object.keys(cur).forEach(function(k){ delete cur[k]; }), Object.assign(cur,l.before); else rs.push(Object.assign({},l.before)); }
  try{ await ruApply(rs,{ruleId:id, action:"undo", before:ruStrip(cur), after:ruStrip(rs.find(function(x){return x.id===id;})), via:"undo", why:"Undid the "+niceShort(String(l.at).slice(0,10))+" change"});
    await DB.doc("rulelog/"+logId).update({undone:true}); toast("Undone"); }
  catch(e){ toast("Couldn't undo — try again",true); }
}

/* ---------- events ---------- */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-ru]"); if(!b) return;
  ev.preventDefault();
  var p=String(b.dataset.ru).split(":"), a=p[0];
  if(a==="open"){ RU.open[p[1]]=!RU.open[p[1]]; renderAbout(); return; }
  if(a==="add") return ruOpenEditor(null);
  if(a==="edit") return ruOpenEditor(p[1]);
  if(a==="ck"){
    var k=b.dataset.k, it=ruItems(p[1]).find(function(x){return ruKey(x)===k;}); if(!it || !DB) return;
    var wanted=p[2]==="1", ck=ruCheckOf(it);
    var go= (ck && !!ck.wanted===wanted)? DB.doc("rulechecks/"+k).delete()
      : DB.doc("rulechecks/"+k).set({rule:p[1], wanted:wanted, title:it.title||"", company:it.company||"", saw:it.saw||"", date:it.date||"", at:today(), atIso:new Date().toISOString(), via:"panel"});
    go.catch(function(){ toast("Couldn't save — try again",true); }); return;
  }
  if(a==="undo") return ruUndo(p[1]);
});
(function(){
  var s=el("ru-save"), d=el("ru-del"), c=el("ru-check");
  if(s) s.addEventListener("click",ruEdSave);
  if(d) d.addEventListener("click",ruEdDelete);
  if(c) c.addEventListener("click",ruEdCheck);
  var db2=el("ru-draftbtn"), tf=el("ru-tofields");
  if(db2) db2.addEventListener("click",ruDraft);
  if(tf) tf.addEventListener("click",function(){ ruMode("fields"); setTimeout(function(){ var f=el(RUED&&RUED.id? "ru-rule" : "ru-name"); if(f) f.focus(); },30); });
  var dl=el("ru-dialog"); if(dl) dl.addEventListener("close",function(){ var x=el("ru-del"); if(x){ x.dataset.armed=""; x.textContent="Remove this rule"; } RUED=null;
    if(END_SUB_NEW){ var ss=el(END_SUB_NEW); if(ss && ss.value==="__new") ss.value=""; END_SUB_NEW=null; } });
})();

/* ---------- data ---------- */
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  function sub(coll,key,sort){
    db.collection(coll).onSnapshot(function(s){
      RU[key]=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
      if(sort) RU[key].sort(function(a,b){ return String(a.at)<String(b.at)? 1 : -1; });
      renderAbout();
    },function(e){ console.warn(coll+" sub",e&&e.code); });
  }
  sub("rulechecks","checks"); sub("rulelog","log",true); sub("rulereviews","reviews",true);
})();

/* "Rule out roles like this" (09) saves through its own path and calls this to log the change. */
function ruLogEntry(entry){ if(!DB) return; DB.doc("rulelog/rl-"+Date.now()).set(Object.assign({at:new Date().toISOString()},entry)).catch(function(){}); }

/* Remember which "How the sweep checks it" notes are open across re-renders (4 Oct). */
document.addEventListener("toggle",function(ev){ var d=ev.target; if(d && d.matches && d.matches("details[data-rck]")) RU.chk[d.dataset.rck]=d.open; },true);
