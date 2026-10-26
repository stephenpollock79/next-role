"use strict";
/* ===== Weekly screen-out check (5 Oct) =====
   Nobody reads hundreds of screen-outs, so a weekly scheduled task (skill next-role-sweep-check) picks about five
   of the week's screen-outs — the ones most likely to be wrong, plus one at random as a control on Claude's own
   flagging — re-reads each posting independently, and writes them to `ruleaudit`. The board shows them as:
   - an Act card on Highlights (Overview and Insights) every week a check is waiting, gone once all are answered
     (it takes a fixed slot in the week's six; since 5 Oct it is no longer listed in Data health);
   - a pop-up: each role with what the sweep saw and Claude's view, and Fine to screen out / Would have wanted.
   An answer is an ordinary spot-check (`rulechecks`, via "audit"), so the rules panel counts it too.
   The running tally per rule (scTally) counts spot-checks since the rule last changed, across weeks. When it
   passes 5 checks with at least one in five wanted, the pop-up offers Suggest a change for that rule (hsOpen, 22);
   "Not now" (`rulesuggest/<rule id>`) keeps it quiet until a new "wanted" mark arrives or the rule changes. The
   rule's tag on My criteria ("May be too strict", or "Sweep may misread it" for a fixed rule) is its lasting home.
   Outcomes (5 Oct, second pass): the check now answers one question, did the sweep apply the rules correctly?
   Correct · Wrong cut · Wrong reason (should be out, but for another rule, picked from a list) · Can't verify (ad
   gone: no spot-check is written, so it never counts either way). Only a wrong cut counts as "wanted" in the tally.
   Separately, a Correct answer on a non-fixed rule can carry a "Rule worth revisiting" flag with an optional note:
   the role stays screened out; the flag is feedback on the rule. Flags count per rule since the later of the rule's
   last change and your last "Keep as is" (`rulerevisit/<rule>`). At SC_FLAGS (3) the pop-up, and Highlights while
   the check is otherwise answered, ask you to decide: Keep as is (recorded, flags cleared), Add an exception (rule
   editor, ask mode, prefilled) or Drop the rule (rule editor with Delete). An edit or delete clears the flags,
   because they count from the rule's last change. Nothing changes a rule automatically. */

var SC={items:[], decl:[], rev:[], busy:{}, added:{}, other:{}};
var SC_MIN=5, SC_WANT=0.2, SC_FLAGS=3;
var SC_OUT=[
  ["correct","Correct","Right rule, right call"],
  ["wrong","Wrong cut","No rule should have screened it out"],
  ["other","Wrong reason","Should be out, but for a different rule"],
  ["unverified","Can't verify","The ad has gone, so it can't be checked"]
];
/* Answers saved before the four outcomes were only wanted / not wanted. */
function scOutcome(x){ return x.outcome || (x.status==="done"? (x.wanted? "wrong" : "correct") : ""); }
var SC_VERDICT={
  misapplied:["Looks like a wrong cut","w"],
  strict:["The rule applies, but you might want it","s"],
  correct:["Looks right to screen out","c"]
};

/* ---------- the tally ---------- */
/* When a rule last changed: the newest rule entry in the change log (edits, undos and accepted suggestions all count). */
function scRuleChangedAt(id){
  var d=""; ((typeof RU!=="undefined" && RU.log)||[]).forEach(function(l){ if((l.kind||"rule")==="rule" && l.ruleId===id){ var a=String(l.at||""); if(a>d) d=a; } });
  return d;
}
function scTally(id){
  var ch=scRuleChangedAt(id);
  var cks=((typeof RU!=="undefined" && RU.checks)||[]).filter(function(c){ return c.rule===id && (!ch || String(c.atIso||c.at||"")>ch); });
  var w=cks.filter(function(c){ return c.wanted; });
  return {n:cks.length, wanted:w.length, wantedList:w, since:ch, strict: cks.length>=SC_MIN && w.length/cks.length>=SC_WANT};
}
function scRule(id){ return (typeof ruRules==="function"? ruRules() : []).find(function(h){ return h.id===id; })||null; }
function scRuleTag(id){ var h=scRule(id); return h? (typeof insRuleTag==="function"? insRuleTag(h) : (h.name||id)+" ("+id+")") : id; }
function scFixed(id){ var h=scRule(id); return !!(h && typeof ruFirm==="function" && ruFirm(h)==="fixed"); }
/* "Not now" holds until a new wanted mark or a rule change. */
function scDeclined(id,T){
  var d=SC.decl.find(function(x){ return x.id===id; }); if(!d) return false;
  if(T.since && String(d.at||"")<T.since) return false;
  return T.wanted<=(+d.wanted||0);
}
function scSuggestFor(id){ var T=scTally(id); return (T.strict && !scDeclined(id,T))? T : null; }
/* ---------- "Rule worth revisiting" flags ---------- */
function scRevDoc(id){ return SC.rev.find(function(x){ return x.rule===id; })||null; }
function scRevFrom(id){ var a=scRuleChangedAt(id), d=scRevDoc(id), b=d? String(d.at||"") : ""; return b>a? b : a; }
function scFlags(id){
  var from=scRevFrom(id);
  return ((typeof RU!=="undefined" && RU.checks)||[]).filter(function(c){ return c.rule===id && c.revisit && (!from || String(c.revisitAt||c.atIso||c.at||"")>from); });
}
function scFlagRules(){
  var ids={}; ((typeof RU!=="undefined" && RU.checks)||[]).forEach(function(c){ if(c.revisit && c.rule) ids[c.rule]=1; });
  return Object.keys(ids).map(function(id){ return {id:id, list:scFlags(id)}; }).filter(function(r){ return r.list.length; })
    .sort(function(a,b){ return b.list.length-a.list.length; });
}
function scDueRules(){ return scFlagRules().filter(function(r){ return r.list.length>=SC_FLAGS && !scFixed(r.id); }); }
/* The card handed to Suggest a change: what the evidence says, with up to four roles you'd have wanted. */
function scCard(id){
  var T=scTally(id), fx=scFixed(id), tag=scRuleTag(id);
  var ex=T.wantedList.slice(0,4).map(function(c){ return (c.title||"a role")+" at "+(c.company||"an unnamed company")+(c.saw? " (the sweep saw: "+c.saw+")" : ""); }).join("; ");
  return {key:"scwant:"+id, group:"act", kind:"act", fix:true, n:T.wanted, metric:T.wanted+"/"+T.n,
    title: fx? "The sweep may be misreading "+tag : tag+" may screen out roles you want",
    text:"Since the rule last changed, the user checked "+T.n+" of its screen-outs and found "+T.wanted+" wrong cuts (the rule didn't apply on the facts in the ad): "+ex+"."+
      (fx? " It is a fixed rule, so the fix is how the sweep checks it (its check note), never loosening it." : "")};
}

/* ---------- this week's items ---------- */
function scWeek(){ var w=""; SC.items.forEach(function(x){ if(String(x.week||"")>w) w=String(x.week); }); return w; }
function scThis(){ var w=scWeek(); return w? SC.items.filter(function(x){ return x.week===w; }).sort(function(a,b){ return (+a.order||0)-(+b.order||0); }) : []; }
function scOpenList(){ return scThis().filter(function(x){ return x.status!=="done"; }); }

/* ---------- Highlights: the check takes a fixed slot while it waits (5 Oct) ----------
   It sits first and counts in the six; the week's set (19) holds at most five, so six is never passed. It is the one
   chore in Highlights: its purpose is improving the setup, it comes weekly, and it's finished once answered. It
   lives only here: Data health is kept for things that are broken. */
insHighlights=(function(orig){ return function(){
  var H=orig.apply(this,arguments), n=scOpenList().length;
  if(!n){ var due=scDueRules(); if(!due.length) return H;
    var r0=due[0], cd={key:"sweepcheck", group:"act", kind:"act", type:"you", area:"filter", noMark:true, score:99, n:r0.list.length, metric:String(r0.list.length),
      title:"Decide on "+scRuleTag(r0.id),
      text:"You've flagged "+plural(r0.list.length,"screen-out")+" under this rule as worth revisiting. Keep it as it is, add a narrow exception, or drop it."+(due.length>1? " "+(due.length-1)+" more rule"+(due.length>2?"s":"")+" also waiting." : ""),
      act:"sweepcheck", actLab:"Decide"};
    INS_HLMAP[cd.key]=cd; return [cd].concat(H).slice(0,6); }
  var c={key:"sweepcheck", group:"act", kind:"act", type:"you", area:"filter", noMark:true, score:99, n:n, metric:String(n),
    title:plural(n,"screen-out")+" to check this week",
    text:"Claude picked "+(n===scThis().length? "these" : "the rest of these")+" from this week's screen-outs: the ones most likely to be wrong, plus one at random. Say whether each should have been screened out. About two minutes.",
    act:"sweepcheck", actLab:"Check them"};
  INS_HLMAP[c.key]=c;
  return [c].concat(H).slice(0,6);
}; })(insHighlights);
/* A chore, not a finding: no Mark as… menu. */
insHlCard=(function(orig){ return function(h,go,attr){ return h && h.noMark? orig(Object.assign({},h,{key:"none"}),go,attr) : orig(h,go,attr); }; })(insHlCard);

/* ---------- the pop-up ---------- */
function scOpenDlg(){
  var d=el("swc-dialog"); if(!d) return;
  scDraw();
  if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
}
function scRowHtml(x){
  var V=SC_VERDICT[x.verdict]||null, done=x.status==="done", out=done? scOutcome(x) : "", busy=!!SC.busy[x.id];
  var link= x.url? '<a href="'+esc(x.url)+'" target="_blank" rel="noopener" class="wscpost">Job ad ↗</a>' : "";
  var added=SC.added[x.id] || rawRoles.some(function(r){ return r.rescuedFrom && r.rescuedFrom.audit===x.id; });
  var canAdd= done && out==="wrong" && x.url && x.live!==false;
  var dis=busy? " disabled" : "";
  var btns=SC_OUT.map(function(o){ return '<button type="button" class="ruckb o-'+o[0]+(out===o[0]? " on" : "")+'" data-swc="out:'+esc(x.id)+':'+o[0]+'" title="'+esc(o[2])+'"'+dis+'>'+o[1]+'</button>'; }).join("");
  /* Wrong reason: pick the rule that should have screened it out. */
  var other="";
  if(SC.other[x.id] || out==="other"){
    var rs=(typeof ruRules==="function"? ruRules() : []).filter(function(h){ return h.id!==x.rule; });
    other='<label class="wscother">Should be out for <select data-swcother="'+esc(x.id)+'"'+dis+'><option value="">Pick a deal-breaker…</option>'+
      rs.map(function(h){ return '<option value="'+esc(h.id)+'"'+(x.otherRule===h.id? " selected" : "")+'>'+esc(scRuleTag(h.id))+'</option>'; }).join("")+'</select></label>';
  }
  /* The flag: only on a correct call, never on a fixed rule. */
  var flag="";
  if(out==="correct" && !scFixed(x.rule)){
    flag='<div class="wscflag'+(x.revisit? " on" : "")+'"><button type="button" class="wscflagb" data-swc="flag:'+esc(x.id)+'" aria-pressed="'+(x.revisit?"true":"false")+'"'+dis+
      ' title="The cut was right under the rule as written, but the rule may be too broad. The role stays screened out; three flags prompt you to review the rule.">'+(x.revisit? "✓ " : "")+'Rule worth revisiting</button>'+
      (x.revisit? '<input type="text" class="wscnote" data-swcnote="'+esc(x.id)+'" maxlength="200" placeholder="What should the rule let through? (optional)" value="'+esc(x.revisitNote||"")+'">' : "")+'</div>';
  }
  return '<li class="wscrow'+(done? " done" : "")+'">'+
    '<div class="wsctop"><b>'+esc(x.title||"Untitled")+'</b><span>'+esc(x.company||"")+(x.date? " · "+esc(niceShort(x.date)) : "")+'</span>'+link+'</div>'+
    '<div class="wscmeta"><span class="wscrule">Screened out for '+esc(scRuleTag(x.rule))+'</span>'+(x.saw? '<span class="wscsaw">The sweep saw: '+esc(x.saw)+'</span>' : "")+'</div>'+
    (V? '<div class="wscview v-'+V[1]+'"><span class="wscvl">Claude: '+esc(V[0])+'</span>'+(x.why? '<span class="wscvw">'+esc(x.why)+'</span>' : "")+'</div>' : "")+
    (x.live===false? '<p class="wscgone">The ad had closed when Claude checked it.</p>' : "")+
    '<div class="wscbtns">'+btns+
      (canAdd? (added? '<span class="wscadded">On your longlist</span>' : '<button type="button" class="btn sm primary" data-swc="add:'+esc(x.id)+'">Add to longlist</button>') : "")+
      (out==="unverified"? '<span class="wscnocount" title="No spot-check is saved, so it doesn\'t count either way">Not counted</span>' : "")+'</div>'+
    other+flag+'</li>';
}
/* Suggestions for any rule this week's answers touch, worked out from every check since the rule last changed. */
function scSuggestHtml(list){
  var seen={}, out=[];
  list.forEach(function(x){ if(!x.rule || seen[x.rule]) return; seen[x.rule]=1; var T=scSuggestFor(x.rule); if(!T) return;
    var tag=scRuleTag(x.rule);
    out.push('<div class="wscsug"><div><b>'+esc("The sweep may be misreading "+tag)+'</b>'+
      '<span>Since it last changed you\'ve checked '+T.n+' of its screen-outs and found '+plural(T.wanted,"wrong cut")+'. The fix is how the sweep checks it.</span></div>'+
      '<div class="wscsugb"><button type="button" class="btn sm primary" data-swc="sug:'+esc(x.rule)+'">Suggest a change</button>'+
      '<button type="button" class="linkbtn" data-swc="decl:'+esc(x.rule)+'" title="Hidden until you mark another wrong cut, or the rule changes">Not now</button></div></div>'); });
  return out.join("");
}
/* Flags per rule: one line each; at SC_FLAGS, a decision. */
function scRevisitHtml(){
  var rs=scFlagRules(); if(!rs.length) return "";
  return '<div class="wscrev"><span class="eyebrow">Rules worth revisiting</span>'+rs.map(function(r){
    var n=r.list.length, due=n>=SC_FLAGS && !scFixed(r.id), tag=scRuleTag(r.id);
    var who=r.list.map(function(c){ return esc(c.company||c.title||"a role")+(c.revisitNote? ' <i>('+esc(c.revisitNote)+')</i>' : ""); }).join(", ");
    return '<div class="wscrevr'+(due? " due" : "")+'"><div><b>'+esc(tag)+': '+n+' flagged</b><span>'+who+'</span>'+
      (due? '<span>That\'s enough to decide. Your call is recorded with the rule and the flags start again.</span>' : '<span>'+(SC_FLAGS-n)+' more and you\'ll be asked to decide.</span>')+'</div>'+
      (due? '<div class="wscsugb"><button type="button" class="btn sm" data-swc="rv:keep:'+esc(r.id)+'">Keep as is</button>'+
        '<button type="button" class="btn sm primary" data-swc="rv:exc:'+esc(r.id)+'">Add an exception</button>'+
        '<button type="button" class="btn sm" data-swc="rv:drop:'+esc(r.id)+'">Drop the rule</button></div>' : "")+'</div>';
  }).join("")+'</div>';
}
function scDraw(){
  var b=el("swc-body"); if(!b) return;
  var list=scThis(), open=list.filter(function(x){ return x.status!=="done"; }).length, rv=scRevisitHtml();
  if(!list.length){ b.innerHTML=(rv||'<p class="lede" style="margin:0;font-size:13px">Nothing to check this week.</p>'); return; }
  b.innerHTML='<p class="wscintro">Picked by Claude from the screen-outs of the week to '+esc(niceShort(scWeek()))+': the ones most likely to be wrong, plus one at random so its picking gets checked too. '+
      'For each, did the sweep apply your rules correctly? <b>'+(open? (list.length-open)+" of "+list.length+" checked" : "All "+list.length+" checked")+'</b></p>'+
    rv+scSuggestHtml(list)+'<ul class="wsclist">'+list.map(scRowHtml).join("")+'</ul>'+
    '<div class="wscfoot"><span class="lede">Answers count as spot-checks on My criteria; Can\'t verify doesn\'t count. You can change one until next week\'s check.</span><button type="button" class="btn primary" data-close="swc-dialog">'+(open? "Finish later" : "Done")+'</button></div>';
}
function scKeyOf(x){ return typeof ruKey==="function"? ruKey(x) : slug(x.rule+"-"+x.company+"-"+x.title).slice(0,90); }
async function scAnswer(id,out,otherRule){
  var x=SC.items.find(function(i){ return i.id===id; }); if(!x || !DB) return;
  if(out==="other" && !otherRule){ SC.other[id]=true; scDraw(); return; }   /* pick the rule first */
  delete SC.other[id];
  SC.busy[id]=true; scDraw();
  var k=scKeyOf(x), now=new Date().toISOString(), keepFlag= out==="correct" && !!x.revisit;
  try{
    if(out==="unverified"){ await DB.doc("rulechecks/"+k).delete().catch(function(){}); }
    else await DB.doc("rulechecks/"+k).set({rule:x.rule||"", wanted: out==="wrong", outcome:out, otherRule: out==="other"? otherRule : "",
      title:x.title||"", company:x.company||"", saw:x.saw||"", date:x.date||"", at:today(), atIso:now, via:"audit", audit:id, claude:x.verdict||"", pick:x.pick||"",
      revisit:keepFlag, revisitNote: keepFlag? (x.revisitNote||"") : "", revisitAt: keepFlag? (x.revisitAt||now) : ""});
    await DB.doc("ruleaudit/"+id).update({status:"done", outcome:out, wanted: out==="wrong", otherRule: out==="other"? otherRule : "",
      revisit:keepFlag, revisitNote: keepFlag? (x.revisitNote||"") : "", answeredAt:now});
  }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
  delete SC.busy[id]; scDraw();
}
async function scFlag(id){
  var x=SC.items.find(function(i){ return i.id===id; }); if(!x || !DB || scOutcome(x)!=="correct") return;
  var on=!x.revisit, now=new Date().toISOString(), k=scKeyOf(x);
  SC.busy[id]=true; scDraw();
  try{
    await DB.doc("rulechecks/"+k).update({revisit:on, revisitAt: on? now : "", revisitNote: on? (x.revisitNote||"") : ""});
    await DB.doc("ruleaudit/"+id).update({revisit:on, revisitAt: on? now : "", revisitNote: on? (x.revisitNote||"") : ""});
  }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
  delete SC.busy[id]; scDraw();
}
async function scNote(id,txt){
  var x=SC.items.find(function(i){ return i.id===id; }); if(!x || !DB || !x.revisit) return;
  txt=String(txt||"").trim().slice(0,200); if(txt===(x.revisitNote||"")) return;
  try{ await DB.doc("rulechecks/"+scKeyOf(x)).update({revisitNote:txt}); await DB.doc("ruleaudit/"+id).update({revisitNote:txt}); }
  catch(e){ console.warn(e); toast("Couldn't save the note — try again",true); }
}
/* Keep as is: recorded with the rule; flags count again from now. */
async function scKeep(rule){
  if(!DB) return; var L=scFlags(rule), d=scRevDoc(rule), now=new Date().toISOString();
  var entry={decision:"keep", at:now, n:L.length, flags:L.map(function(c){ return {title:c.title||"", company:c.company||"", note:c.revisitNote||""}; })};
  try{
    await DB.doc("rulerevisit/"+slug(rule)).set({rule:rule, decision:"keep", at:now, n:L.length, flags:entry.flags, history:((d&&d.history)||[]).concat([entry]).slice(-20)});
    toast(scRuleTag(rule)+" kept as it is");
  }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
}
/* Exception / drop go through the rule editor; saving there changes the rule, which clears the flags. */
function scChange(rule,kind){
  if(typeof ruOpenEditor!=="function") return;
  var d=el("swc-dialog"); if(d && d.open) d.close();
  if(kind==="drop"){ ruOpenEditor(rule,null,null,"fields"); var h=el("ru-hint"); if(h) h.textContent="To drop this rule, use Delete. Your flagged roles are on the screen-out check."; return; }
  ruOpenEditor(rule,null,null,SAMPLE? "ask" : "fields");
  var L=scFlags(rule), t=el("ru-asktext");
  if(t && SAMPLE) t.value="Add a narrow exception so roles like these get through: "+L.map(function(c){ return (c.title||"a role")+" at "+(c.company||"an unnamed company")+(c.revisitNote? " ("+c.revisitNote+")" : ""); }).join("; ")+".";
}
/* A wrongly screened-out role, still open, goes onto the longlist as the sweep would have put it there. */
async function scAdd(id){
  var x=SC.items.find(function(i){ return i.id===id; }); if(!x || !DB || SC.added[id]) return;
  var key=x.url && typeof parseJobUrl==="function"? (parseJobUrl(x.url)||{}).key : "";
  var dup=rawRoles.find(function(r){ return (key && roleKey(r)===key) || (slug(r.company)===slug(x.company) && slug(r.title)===slug(x.title)); });
  if(dup){ SC.added[id]=true; scDraw(); toast("Already on the board"+(dup.ref? " as #"+dup.ref : "")); return; }
  var ch=typeof insScrCh==="function"? insScrCh(x.source) : "", rid=slug((x.company||"role")+"-"+(x.title||""))+"-"+Date.now().toString(36).slice(-4);
  SC.added[id]=true; scDraw();
  try{
    await DB.doc("roles/"+rid).set({title:x.title||"New role", company:x.company||"Unknown company", companyId:slug(x.company||""), url:x.url||"", linkChecked:"",
      source:"agent", seen:x.date||today(), stage:"proposed", sourceId: ch? "ch:"+ch : "", channelId:ch||"", readState:"waiting", readTries:0, readReason:"",
      addedVia:"sweep-check", rescuedFrom:{rule:x.rule||"", saw:x.saw||"", sweep:x.date||"", audit:id},
      fun:null, shot:null, highlights:[], green:[], red:[], enrich:{}, referral:""});
    toastUndo("Added to your longlist",function(){ DB.doc("roles/"+rid).delete().catch(function(){}); SC.added[id]=false; scDraw(); });
  }catch(e){ console.warn(e); SC.added[id]=false; scDraw(); toast("Couldn't add it — try again",true); }
}
async function scDecline(rule){
  if(!DB) return; var T=scTally(rule);
  try{ await DB.doc("rulesuggest/"+slug(rule)).set({rule:rule, at:new Date().toISOString(), wanted:T.wanted, n:T.n}); }
  catch(e){ toast("Couldn't save — try again",true); }
}
/* Window capture, so these run before the Overview and Insights click handlers on the document. */
window.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-swc],[data-ins="sweepcheck"],[data-ovins="sweepcheck"],[data-ovins="card:sweepcheck"]'); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var v=b.dataset.swc||"open", p=v.split(":"), a=p[0];
  if(a==="open") return scOpenDlg();
  if(a==="out") return scAnswer(p[1], p[2]);
  if(a==="flag") return scFlag(p[1]);
  if(a==="rv"){ if(p[1]==="keep") return scKeep(p[2]); return scChange(p[2], p[1]); }
  if(a==="add") return scAdd(p[1]);
  if(a==="decl") return scDecline(p[1]);
  if(a==="sug"){ if(typeof hsOpen==="function") hsOpen(scCard(p[1])); return; }
},true);
document.addEventListener("change",function(ev){
  var t=ev.target; if(!t || !t.dataset) return;
  if(t.dataset.swcother!==undefined && t.value) scAnswer(t.dataset.swcother,"other",t.value);
  if(t.dataset.swcnote!==undefined) scNote(t.dataset.swcnote,t.value);
});

/* ---------- data ---------- */
function scRefresh(){ try{ hlRedraw(); }catch(e){} var d=el("swc-dialog"); if(d && d.open) scDraw(); }
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.collection("ruleaudit").onSnapshot(function(s){ SC.items=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; }); scRefresh(); },
    function(e){ console.warn("ruleaudit sub",e&&e.code); });
  db.collection("rulesuggest").onSnapshot(function(s){ SC.decl=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=o.rule||d.id; return o; }); scRefresh(); try{ renderAbout(); }catch(e){} },
    function(e){ console.warn("rulesuggest sub",e&&e.code); });
  db.collection("rulerevisit").onSnapshot(function(s){ SC.rev=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.rule=o.rule||d.id; return o; }); scRefresh(); },
    function(e){ console.warn("rulerevisit sub",e&&e.code); });
})();
/* Spot-checks and the change log arrive through 20's subscriptions; redraw an open pop-up when they do. */
renderAbout=(function(orig){ return function(){ orig.apply(this,arguments); var d=el("swc-dialog"); if(d && d.open) scDraw(); }; })(renderAbout);
