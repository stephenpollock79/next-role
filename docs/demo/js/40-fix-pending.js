"use strict";
/* ===== Fixed by Claude, waiting to confirm (8 Oct) =====
   Some Data health checks read run records (the sweep's per-source results, scheduled task runs), so a fix only
   shows once the next run records it. Until then the item would sit in your to-do list though it's already fixed.
   next-role-fix now writes `fixes/<item id>` {item, kind, date, at, what, by} when it fixes one of these. While no
   run has happened since the fix, the item leaves the to-do count and Copy for Claude and is listed under
   "Fixed, waiting for the next run to confirm". Once a later run exists: if the check passes, it's gone; if not, it
   is back on the list, saying Claude's fix didn't hold. Only run-based items are held (FXP_RUN); checks that read
   a role or company clear by themselves the moment the data changes. */

var FIXES={}, FXP_LIST=[];
/* The newest run an item's check reads, as YYYY-MM-DD. Runs record a date only, so a run on the day of the fix
   counts as before it, and the item waits for the next one. */
function fxpEvidence(id){
  id=String(id||"");
  if(/^(sb-|sq-)/.test(id) || id==="gm" || id==="gl" || id==="lim-sweep" || id==="cap"){
    var sw=typeof hySweepRuns==="function"? hySweepRuns() : []; return sw.length? String(sw[0].date||"") : "";
  }
  var m=id.match(/^(?:tr|lim|tc)-(.+)$/);
  if(m){ var d=""; (typeof TR!=="undefined"? TR : []).forEach(function(x){ if(x.type===m[1] && x.date && x.date>d) d=x.date; }); return d; }
  return null;   /* not a run-based check: never held */
}
function fxpState(it){
  var f=FIXES[it && it.id]; if(!f || !f.date) return null;
  var ev=fxpEvidence(it.id); if(ev===null) return null;
  return (!ev || ev<=f.date)? {k:"wait", f:f} : {k:"failed", f:f};
}
hygiene=(function(orig){ return function(){
  var out=orig(); FXP_LIST=[];
  out.forEach(function(x){
    x.items=(x.items||[]).filter(function(it){
      var s=fxpState(it); if(!s) return true;
      if(s.k==="wait"){ FXP_LIST.push({title:x.title, it:it, f:s.f}); return false; }
      if(!it.fxpNoted){ it.label=String(it.label||"")+" · Claude fixed this "+niceShort(s.f.date)+" but the run since still shows it"; it.fxpNoted=true; }
      return true;
    });
  });
  return out;
}; })(hygiene);

renderHygiene=(function(orig){ return function(){
  orig();
  var list=el("hy-body") && el("hy-body").querySelector(".hylist"); if(!list || !FXP_LIST.length) return;
  var rows=FXP_LIST.map(function(p){
    var P2=HY_PLAIN[p.title]||[p.title];
    return '<div class="hyrow hydone"><div class="hyrl"><span class="hyst fxpok">✓</span></div><div class="hyrm">'+
      '<div class="hyrt"><b>'+esc(P2[0])+'</b></div>'+
      '<div class="hyitems">'+hyItem(p.it)+'</div>'+
      '<p class="hyw">Fixed '+niceShort(p.f.date)+(p.f.what? ": "+esc(clip(String(p.f.what),160)) : "")+'. Clears for good once the next run reads it.</p></div></div>';
  }).join("");
  list.insertAdjacentHTML("beforeend",'<section class="hyc hydone fxpc"><div class="hych"><h3>Fixed by Claude, waiting for the next run to confirm</h3><span class="hycn">'+FXP_LIST.length+'</span></div>'+rows+'</section>');
}; })(renderHygiene);

(function(){ var st=document.createElement("style");
  st.textContent=".fxpc .hyst.fxpok{background:color-mix(in srgb,var(--accent,#2DD4BF) 18%,transparent);color:var(--accent,#0f766e)}";
  document.head.appendChild(st); })();
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.collection("fixes").onSnapshot(function(s){ FIXES={}; s.docs.forEach(function(d){ var o=Object.assign({},d.data()); o.id=d.id; FIXES[o.item||d.id]=o; }); try{ renderHygiene(); }catch(e){} },function(e){ console.warn("fixes sub",e&&e.code); });
})();
