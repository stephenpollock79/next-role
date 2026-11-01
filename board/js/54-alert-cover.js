"use strict";
/* Job alerts cut off in their emails. A digest email (LinkedIn's, for one) states how many roles matched but shows
   only a few; the sweep can't open the rest. The sweep records each saved search's totals on its run record
   (`runs` `alertCoverage` [{source, search, emails, stated, shown}]). An alert counts as cut off when it showed
   fewer than it stated in each of the last ACOV_N sweeps that recorded coverage. One Highlights card lists them, with
   Copy for Claude (next-role-fix kind `alert-split`). Loads last; wraps 28's insHlExtra. */
var ACOV_N=2;
function acovKey(c){ return String(c.source||"")+"|"+String(c.search||"").trim().toLowerCase(); }
function acovCut(){
  /* Only the latest ACOV_N sweeps that recorded coverage: an alert split or deleted since drops out at once. */
  var SW=hySweepRuns().filter(function(r){ return Array.isArray(r.alertCoverage); }).slice(0,ACOV_N), by={}, order=[];
  SW.forEach(function(r){ r.alertCoverage.forEach(function(c){ if(!c || !c.search) return;
    var k=acovKey(c); if(!by[k]){ by[k]=[]; order.push(k); } if(by[k].length<ACOV_N) by[k].push(c); }); });
  return order.map(function(k){ var L=by[k];
    if(L.length<ACOV_N || !L.every(function(c){ return (+c.stated||0)>(+c.shown||0); })) return null;
    var st=L.reduce(function(m,c){ return m+(+c.stated||0); },0), sh=L.reduce(function(m,c){ return m+(+c.shown||0); },0);
    return {source:L[0].source||"", search:L[0].search, stated:st, shown:sh, hidden:st-sh};
  }).filter(Boolean).sort(function(a,b){ return b.hidden-a.hidden; });
}
function acovSrcName(id){ var s=(typeof srcs!=="undefined"? srcs : []).find(function(x){ return x.id===id; }); return (s && s.name)||id||""; }
function acovText(){
  var L=acovCut(); if(!L.length) return "";
  var lines=["Run next-role-fix on my Next Role board"+boardRef()+". Work each kind below, then tell me what you did and anything left for me.","",
    "alert-split — Job alerts cut off in their emails:"];
  L.forEach(function(c){ lines.push("- "+(c.source||"alerts")+" · "+c.search+" ("+acovSrcName(c.source)+": "+c.shown+" of "+c.stated+" shown in the last "+ACOV_N+" sweeps)"); });
  return lines.join("\n");
}
insHlExtra=(function(orig){ return function(){
  var out=orig(), L=acovCut(); if(!L.length) return out;
  var hid=L.reduce(function(m,c){ return m+c.hidden; },0);
  out.push(tgCard({key:"alertcut", score:30+Math.min(20,Math.round(hid/5)), n:hid, metric:String(hid),
    title:plural(L.length,"job alert")+" cut off in "+(L.length===1? "its" : "their")+" emails",
    text:L.slice(0,3).map(function(c){ return "“"+c.search+"”: "+c.shown+" of "+c.stated+" shown"; }).join("; ")+(L.length>3? "; and "+(L.length-3)+" more" : "")+
      ", over the last "+ACOV_N+" sweeps. The sweep can't see the rest. Split each into narrower alerts: one title per alert, your area and remote apart.",
    act:"fx:alertsplit", actLab:"Copy for Claude"}));
  return out;
}; })(insHlExtra);
/* A setup fix done through Claude, not Suggest a change (no board lever changes a job site's alert). */
insHlType=(function(orig){ return function(h){ return h && h.key==="alertcut"? "setup" : orig(h); }; })(insHlType);
window.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-ins="fx:alertsplit"],[data-ovins="fx:alertsplit"]'); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var t=acovText(), n=acovCut().length; if(!t){ toast("No job alerts are cut off now"); return; }
  fxShow(t,n);
},true);
