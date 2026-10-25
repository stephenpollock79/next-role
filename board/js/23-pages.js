"use strict";
/* ===== Page rails and Compare header (3 Oct) =====
   Sourcing, Targets › Companies and Targets › Sectors get a right-hand rail (.pgrid / .pgrail in index.html)
   so the cards keep the main column and the page's own numbers stay in view. Compare gets a visual header:
   the role cards' Me / Them gauges, a verdict chip, and one shared Fun × Shot grid. */

function rlCard(title,sub,body,link){
  return '<section class="rlc"><div class="rlh"><h4>'+esc(title)+'</h4>'+(link||"")+'</div>'+(sub? '<p class="rls">'+sub+'</p>' : "")+body+'</section>';
}
function rlList(items,empty){
  return items.length? '<ul class="rll">'+items.join("")+'</ul>' : '<p class="rlempty">'+esc(empty)+'</p>';
}
function rlBar(lab,n,max,extra,cls){
  return '<div class="rlb'+(cls?" "+cls:"")+'"><span class="rlbl">'+lab+'</span><span class="rlbt"><i style="width:'+(max? Math.max(3,n/max*100) : 0)+'%"></i></span><b>'+n+'</b>'+(extra||"")+'</div>';
}

/* ---------- Sourcing › Auto sweep: sweep status ---------- */
/* A sweep's numbers as a funnel that adds up: read = didn't match + already seen + screened out + to longlist.
   Older run records have no offSearch / seen: the rest is shown together as "not a match or already seen". */
function runFunnel(r){
  var read=+r.found||0, out=+r.out||0, to=+r.proposed||0, f={read:read, out:out, to:to, parts:[]};
  if(r.offSearch!=null || r.seen!=null){ f.off=+r.offSearch||0; f.seen=+r.seen||0;
    f.parts=[[f.off,"didn't match your search"],[f.seen,"already seen"]]; }
  else { f.rest=Math.max(0, read-out-to); f.parts=[[f.rest,"not a match or already seen"]]; }
  f.parts=f.parts.concat([[out,"screened out by your deal-breakers"],[to,"to your longlist"]]).filter(function(x){ return x[0]>0; });
  return f;
}
function runFunnelLine(r){ var f=runFunnel(r); return '<b>'+f.read+'</b> read: '+f.parts.map(function(x){ return '<b>'+x[0]+'</b> '+esc(x[1]); }).join(" · "); }
function srcRailStatus(){
  var box=el("src-rail-status"); if(!box) return;
  var S=sweepState(), sw=runs.filter(function(r){return r.type==="sweep";}).sort(function(a,b){return a.date<b.date?1:-1;}), last=sw[0];
  var warn= S.warn? '<p class="rlwarn">'+esc(S.warn)+'</p>' : "";
  box.innerHTML=rlCard("Sweep status", S.last? "Last run "+esc(niceShort(S.last))+" · "+esc(nextSweepTxt(S))+(S.usual? " · usually every "+S.usualTxt : "") : "No sweep yet",
    (last? '<div class="rltiles"><div><b>'+(+last.found||0)+'</b><span>read</span></div><div><b>'+(+last.out||0)+'</b><span>screened out</span></div><div><b>'+(+last.proposed||0)+'</b><span>to longlist</span></div></div>'+
      '<p class="rls">'+runFunnelLine(last)+'</p>' : "")+warn);
}
/* Recent runs, compact (3 Oct): replaces the old run log in the rail, which scrolled inside the rail. */
function srcRailRuns(){
  var box=el("src-rail-runs"); if(!box) return;
  var rs=runs.filter(function(r){return r.date;}).sort(function(a,b){ return a.date<b.date?1 : a.date>b.date? -1 : String(a.id)<String(b.id)?1:-1; }).slice(0,6);
  var K={sweep:"Sweep", verify:"Check", manual:"Your pass"};
  box.innerHTML=rlCard("Recent runs", plural(runs.length,"run")+" recorded",
    rs.length? '<ul class="rlruns">'+rs.map(function(r){ var ty=r.type||"sweep";
      return '<li><span class="rld">'+esc(niceShort(r.date))+'</span><span class="rlk2 k-'+esc(ty)+'">'+esc(K[ty]||ty)+'</span>'+
        (ty==="sweep"? '<span class="rln"><b>'+(+r.found||0)+'</b> read · <b>'+(+r.out||0)+'</b> screened out · <b>'+(+r.proposed||0)+'</b> to longlist</span>'
          : '<span class="rln">'+(ty==="manual"? '<b>'+(+r.proposed||0)+'</b> added' : 'no new roles, by design')+'</span>')+'</li>'; }).join("")+'</ul>' : '<p class="rlempty">No runs yet.</p>');
}
/* ---------- Sourcing › Manual: what's planned ---------- */
function srcRailManual(){
  var box=el("src-rail-manual"); if(!box) return;
  /* A repeating task that names checking sites or jobs counts as a planned check. */
  var t=today(), next="", nm="";
  for(var i=0;i<14 && !next;i++){ var d=addDays(t,i), it=dayItems(d).filter(function(x){ return x.cat==="recurring" && /check|site|manual|linkedin|job|search|board/i.test(String(x.title||"")); });
    if(it.length){ next=d; nm=it[0].title; } }
  box.innerHTML=rlCard("Your checks", next? "Next: "+esc(nm)+" · "+esc(niceShort(next)) : "No repeating check planned yet",
    '<p class="rls">When you check your sites is planned in Week ahead, as repeating tasks.</p><a href="#" class="btn sm" data-gotab="week">Week ahead →</a>');
}

/* ---------- Targets › Companies ---------- */
function coRolesOf(c){ return rawRoles.filter(function(r){ return r.companyId===c.id || (coOf(r)||{}).id===c.id; }); }
var CO_REACH=["Found","Longlist","Shortlist","To apply","Applied","Interview","Offer"];
function coRailHtml(){
  /* By rating (5 Oct): every company on the list, counted by coRating; "checked" = boards the sweep fetches (every sweep or weekly). */
  var all=companies.filter(function(c){ return !coOff(c); }), w=all.filter(coWatch);
  var pri={high:0,medium:0,low:0,unrated:0}; all.forEach(function(c){ var k=coRating(c); pri[k]=(pri[k]||0)+1; });
  var nOff=companies.length-all.length;
  var maxP=Math.max.apply(null,Object.keys(pri).map(function(k){return pri[k];}).concat([1]));
  var glance=rlCard("Your list at a glance", '<b>'+all.length+'</b> on your list · <b>'+w.length+'</b> boards checked by the sweep'+(nOff? ' · '+nOff+' ruled out' : ""),
    ["high","medium","low","unrated"].map(function(k){ return rlBar(esc(PRILABEL[k]),pri[k],maxP); }).join(""));
  var live=companies.map(function(c){ var rs=coRolesOf(c).filter(function(r){ return !DEAD[r.stage] && r.stage!=="closed"; }); return {c:c, n:rs.length}; }).filter(function(x){return x.n;}).sort(function(a,b){return b.n-a.n;});
  var hiring=rlCard("Hiring now", plural(live.length,"company","companies")+" with live roles on your board",
    rlList(live.slice(0,6).map(function(x){ return '<li><a href="#" data-act="co_go" data-id="'+esc(x.c.id)+'">'+esc(x.c.name||x.c.id)+'</a><span>'+plural(x.n,"role")+'</span></li>'; }),"None right now."));
  /* Live roles at companies you haven't rated (3 Oct: replaces "Best so far"). Rating is yours alone,
     and it orders the queue, so these are the ones worth a moment. */
  var unr=live.filter(function(x){ return !x.c.priority || x.c.priority==="unrated"; });
  var bestC=rlCard("Live roles, not rated yet", unr.length? plural(unr.length,"company","companies")+" with live roles have no priority. Your rating orders the queue." : "Every company with a live role has your rating.",
    rlList(unr.slice(0,6).map(function(x){ return '<li><a href="#" data-act="co_go" data-id="'+esc(x.c.id)+'">'+esc(x.c.name||x.c.id)+'</a><span>'+plural(x.n,"role")+'</span></li>'; }),"None."));
  var blind=w.filter(function(c){ return c.boardAts==="linkedin-alert" || c.boardAts==="manual-check" || !c.boardUrl; });
  var cant=rlCard("Can't be read directly", plural(blind.length,"watched company","watched companies")+" the sweep can't read on their own site",
    '<p class="rls">Their roles only reach you through alert emails, so check them yourself now and then.</p>'+
    rlList(blind.slice(0,6).map(function(c){ return '<li><a href="#" data-act="co_go" data-id="'+esc(c.id)+'">'+esc(c.name||c.id)+'</a><span>'+(c.boardAts==="linkedin-alert"? "alerts only" : c.boardAts==="manual-check"? "you check it" : "no board found")+'</span></li>'; }),"None.")+
    (blind.length>6? '<p class="rlmore">and '+(blind.length-6)+' more</p>' : ""));
  var warmC=companies.filter(function(c){ return c.warm || people.some(function(p){return p.companyId===c.id;}); });
  var warm=rlCard("Warm routes", plural(warmC.length,"company","companies")+" where you know someone",
    rlList(warmC.slice(0,6).map(function(c){ var n=people.filter(function(p){return p.companyId===c.id;}).length; return '<li><a href="#" data-act="co_go" data-id="'+esc(c.id)+'">'+esc(c.name||c.id)+'</a><span>'+(n? plural(n,"person","people") : "warm")+'</span></li>'; }),"None yet."),
    '<a href="#" class="rlk" data-gotab="people">People →</a>');
  var off=companies.filter(function(c){ return !coWatch(c) && !coOff(c); })
    .map(function(c){ var rs=coRolesOf(c), k=Math.max.apply(null,[-1].concat(rs.map(function(r){return typeof insReach==="function"? insReach(r) : 0;}))); return {c:c, k:k, n:rs.length}; })
    .filter(function(x){ return x.n && x.k>=2; }).sort(function(a,b){return b.k-a.k || b.n-a.n;});
  var board=rlCard("Arrived from job boards", "Not rated for the sweep, but their roles did well. Worth rating?",
    rlList(off.slice(0,6).map(function(x){ return '<li><a href="#" data-act="co_go" data-id="'+esc(x.c.id)+'">'+esc(x.c.name||x.c.id)+'</a><span class="rlchip">'+esc(CO_REACH[x.k])+'</span>'+
      '<span class="rlrate"><button type="button" class="linkbtn" data-rlrate="high" data-id="'+esc(x.c.id)+'" title="Board checked every sweep">Want it</button> · '+
      '<button type="button" class="linkbtn" data-rlrate="medium" data-id="'+esc(x.c.id)+'" title="Board checked once a week">Would consider</button></span></li>'; }),"None right now."));
  return glance+hiring+bestC+board+warm+cant;
}
/* ---------- Targets › Sectors ---------- */
function secRailHtml(){
  var by={high:[],medium:[],low:[],unrated:[]}; sectors.forEach(function(s){ (by[secPri(s)]||by.unrated).push(s); });
  var stance=rlCard("By your stance","",["high","medium","low","unrated"].map(function(k){
      var rs=[]; by[k].forEach(function(s){ rs=rs.concat(secRolesOf(s.id)); });
      return '<div class="rlst"><span>'+esc(PRILABEL[k])+'</span><b>'+by[k].length+'</b><small>'+rs.length+' roles · '+rs.filter(reachedApply).length+' to apply</small></div>'; }).join(""));
  var rows=sectors.map(function(s){ var rs=secRolesOf(s.id); return {s:s, f:rs.length, sh:rs.filter(function(r){return (typeof insReach==="function"? insReach(r) : 0)>=2;}).length, ap:rs.filter(function(r){return r.appliedAt;}).length}; })
    .filter(function(x){return x.f;}).sort(function(a,b){return b.f-a.f;}).slice(0,6);
  var mx=Math.max.apply(null,rows.map(function(x){return x.f;}).concat([1]));
  var conv=rlCard("Which sectors go somewhere","Found → shortlisted → applied",
    rows.length? rows.map(function(x){ return '<div class="rlcv"><span class="rlbl">'+esc(x.s.name||x.s.id)+'</span><span class="rlbt3"><i class="a" style="width:'+(x.f/mx*100)+'%"></i><i class="b" style="width:'+(x.sh/mx*100)+'%"></i><i class="c" style="width:'+(x.ap/mx*100)+'%"></i></span><b>'+x.f+' · '+x.sh+' · '+x.ap+'</b></div>'; }).join("")+
      '<p class="rlkey"><i class="a"></i>found <i class="b"></i>shortlisted <i class="c"></i>applied</p>' : '<p class="rlempty">No roles linked to sectors yet.</p>');
  var gaps=sectors.filter(function(s){ var p=secPri(s); return (p==="high"||p==="medium") && cosOfSec(s.id).filter(function(c){return c.watch;}).length<2; });
  var gap=rlCard("Gaps","Sectors you want with fewer than two watched companies",
    rlList(gaps.map(function(s){ var n=cosOfSec(s.id).filter(function(c){return c.watch;}).length; return '<li><span>'+esc(s.name||s.id)+'</span><span>'+n+' watched</span></li>'; }),"None — every sector you want has companies to watch."),
    '<a href="#" class="rlk" data-gotab="companies">Companies →</a>');
  var loose={}; companies.forEach(function(c){ if(!c.sectorId && c.sector){ var k=String(c.sector).trim(); if(k) loose[k]=(loose[k]||0)+1; } });
  var lk=Object.keys(loose).sort(function(a,b){return loose[b]-loose[a];});
  var unc=rlCard("No sector card yet","Sectors your companies are in that have no card",
    rlList(lk.slice(0,6).map(function(k){ return '<li><span>'+esc(k)+'</span><span>'+plural(loose[k],"company","companies")+'</span></li>'; }),"None."));
  return stance+conv+gap+unc;
}
renderCompanies=(function(orig){ return function(){ orig(); var r=el("co-rail"); if(r){ try{ r.innerHTML=coRailHtml(); }catch(e){ console.warn("co rail",e); } } }; })(renderCompanies);
renderSectors=(function(orig){ return function(){ orig(); var r=el("sec-rail"); if(r){ try{ r.innerHTML=secRailHtml(); }catch(e){ console.warn("sec rail",e); } } }; })(renderSectors);
renderChannels=(function(orig){ return function(){ orig(); try{ srcRailStatus(); srcRailRuns(); srcRailManual(); }catch(e){ console.warn("src rail",e); } }; })(renderChannels);

/* ---------- Scrolling: the role pages' pattern (3 Oct) ----------
   One page scroll. The page header (and the Companies toolbar) pin under the top bar; the rail never scrolls on
   its own: when it fits it stays put, when it is taller than the window it moves with the page until its bottom
   (going down) or its top (going up) is in view, then stays — as railPin does for the role pages' rail. */
var PGPIN={last:0, cur:null, raf:0, el:null};
function pgRailPin(){
  var sec=el("tab-"+tab), r=sec && sec.querySelector(".pgrail");
  if(r && !r.offsetParent){ var all=sec.querySelectorAll(".pgrail"); r=null; for(var i=0;i<all.length;i++){ if(all[i].offsetParent){ r=all[i]; break; } } }
  if(r!==PGPIN.el){ if(PGPIN.el) PGPIN.el.style.top=""; PGPIN.el=r; PGPIN.cur=null; }
  if(!r) return;
  if(!window.matchMedia("(min-width:1201px)").matches){ r.style.top=""; PGPIN.cur=null; return; }
  var hh=layoutVars(), top0=hh+(RAILPIN.pt!=null? RAILPIN.pt : 22);
  Array.prototype.forEach.call(sec.querySelectorAll(":scope > .pagehead, :scope > .toolbar"),function(x){ var cs=getComputedStyle(x); if(cs.position==="sticky") top0=Math.max(top0, (parseFloat(cs.top)||0)+x.offsetHeight+12); });
  var z=pgZoom(), min=window.innerHeight/z-r.offsetHeight-16, y=window.scrollY/z, d=y-PGPIN.last; PGPIN.last=y;
  if(min>=top0 || PGPIN.cur==null) PGPIN.cur=top0; else PGPIN.cur=Math.max(min, Math.min(top0, PGPIN.cur-d));
  r.style.top=PGPIN.cur+"px";
}
function pgRailPinSoon(){ if(PGPIN.raf) return; PGPIN.raf=requestAnimationFrame(function(){ PGPIN.raf=0; pgRailPin(); }); }
window.addEventListener("scroll", pgRailPinSoon, {passive:true});
window.addEventListener("resize", pgRailPinSoon);
render=(function(orig){ return function(){ orig(); pgRailPinSoon(); }; })(render);
showTab=(function(orig){ return function(t){ PGPIN.cur=null; orig(t); document.body.dataset.tab=tab; pgRailPinSoon(); }; })(showTab);
document.addEventListener("click",function(ev){ if(ev.target.closest && ev.target.closest('#tab-routine [data-act="ctab"]')) setTimeout(pgRailPinSoon,30); });
if(typeof tab!=="undefined") document.body.dataset.tab=tab;
document.addEventListener("click",function(ev){
  /* The rating decides the sweep; this sets it, like the company card (QA 14 Oct, replaces "Watch it"). */
  var b=ev.target.closest && ev.target.closest("[data-rlrate]"); if(!b || !DB) return;
  ev.preventDefault(); var id=b.dataset.id, v=b.dataset.rlrate, c=companies.find(function(x){return x.id===id;}); if(!c) return;
  var before={priority:c.priority||"unrated", watch:!!c.watch, watchWhy:c.watchWhy||""};
  DB.doc("companies/"+id).update({priority:v, watch:rateWatch(v), watchWhy:c.watchWhy||"Its roles did well after arriving from a job board."})
    .then(function(){ toastUndo((c.name||id)+" rated "+(v==="high"? "Want it" : "Would consider")+" — "+(RATE_CAD[v]||{}).txt,function(){ DB.doc("companies/"+id).update(before); }); })
    .catch(function(){ toast("Couldn't save — try again",true); });
});

/* ---------- Compare (3 Oct, later): the separate header of cards and the Fun × Shot grid are gone. Each table
   column header carries the role's gauges, Fun and Shot (08), and the grid moved to Insights as a chart of every role. */
renderCompare=(function(orig){ return function(){ orig(); var host=el("cmp-head"); if(host) host.innerHTML=""; }; })(renderCompare);
