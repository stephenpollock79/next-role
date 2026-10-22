"use strict";
/* ===== My targets, pattern cards and "Is it running" (5 Oct) =====
   1. My targets: the user's own goals, the only thresholds they set (profile/prefs `targets`). Everything else the
      Highlights use is fixed evidence: minimum counts and change sizes, never shown as settings.
   2. insHlExtra(): the pattern cards the weekly top 6 (19) chooses from, beside insHlRaw's. Patterns only, never a
      chore about one role: those are in Waiting on you.
   3. Data health › Is it running: tasks overdue or failed, runs that hit their limits, sources gone silent or
      unreadable, board errors; plus missing prep and turned-down roles that came back. */

/* ---------- 1. My targets ---------- */
var TG_DEF={band:[5,10], floor:10, ivRate:20, wait:{longlist:7, shortlist:7, toApply:5}, stretchMax:50};
function TG(){
  var t=(PREFS && PREFS.targets)||{}, w=t.wait||{};
  var band=Array.isArray(t.band) && t.band.length===2? [+t.band[0]||TG_DEF.band[0], +t.band[1]||TG_DEF.band[1]] : TG_DEF.band.slice();
  return {band:band, floor:+t.floor||TG_DEF.floor, ivRate:+t.ivRate||TG_DEF.ivRate, stretchMax:t.stretchMax!=null? +t.stretchMax : TG_DEF.stretchMax,
    wait:{longlist:+w.longlist||TG_DEF.wait.longlist, shortlist:+w.shortlist||TG_DEF.wait.shortlist, toApply:+w.toApply||TG_DEF.wait.toApply}, set:!!(PREFS && PREFS.targets)};
}
/* The application band drives older code through LOAD_BAND (17); keep it in step with My targets. */
function tgSyncBand(){ var b=TG().band; LOAD_BAND[0]=b[0]; LOAD_BAND[1]=b[1]; }
render=(function(orig){ return function(){ try{ tgSyncBand(); }catch(e){} return orig.apply(this,arguments); }; })(render);
var TG_ROWS=[
  {k:"band", name:"Application band", why:"How many live applications at once feels right. Below it, Highlights say where the funnel is thin; above it, prep may suffer.",
    show:function(T){ return T.band[0]+"–"+T.band[1]+" live applications"; },
    fields:function(T){ return [{id:"lo", label:"Fewest", value:String(T.band[0])},{id:"hi", label:"Most", value:String(T.band[1])}]; },
    read:function(v){ var lo=parseInt(v.lo,10), hi=parseInt(v.hi,10); if(!(lo>=1 && hi>=lo && hi<=50)) return "Give two whole numbers, the first no bigger than the second."; return {band:[lo,hi]}; }},
  {k:"floor", name:"New roles a week", why:"The fewest new roles reaching your longlist in a week before Highlights flag low supply, and say whether it's your rules, channels or the market.",
    show:function(T){ return T.floor+" or more a week"; },
    fields:function(T){ return [{id:"n", label:"New longlist roles a week", value:String(T.floor)}]; },
    read:function(v){ var n=parseInt(v.n,10); if(!(n>=1 && n<=500)) return "Give a whole number."; return {floor:n}; }},
  {k:"ivRate", name:"Interview rate", why:"The share of applications that should reach an interview. Below it, Highlights compare the ones that did with the ones that didn't.",
    show:function(T){ return T.ivRate+"% of applications reach an interview"; },
    fields:function(T){ return [{id:"n", label:"Percent", value:String(T.ivRate)}]; },
    read:function(v){ var n=parseInt(v.n,10); if(!(n>=1 && n<=100)) return "Give a percentage from 1 to 100."; return {ivRate:n}; }},
  {k:"wait", name:"How long you take to decide", why:"Your pace at each stage. Highlights flag it when your median time to decide runs over.",
    show:function(T){ return "Longlist "+T.wait.longlist+" days · Shortlist "+T.wait.shortlist+" · To apply "+T.wait.toApply; },
    fields:function(T){ return [{id:"l", label:"Longlist, days", value:String(T.wait.longlist)},{id:"s", label:"Shortlist, days", value:String(T.wait.shortlist)},{id:"a", label:"To apply, days", value:String(T.wait.toApply)}]; },
    read:function(v){ var l=parseInt(v.l,10), s=parseInt(v.s,10), a=parseInt(v.a,10); if(!(l>=1 && s>=1 && a>=1 && l<=60 && s<=60 && a<=60)) return "Give whole numbers of days."; return {wait:{longlist:l, shortlist:s, toApply:a}}; }},
  {k:"stretchMax", name:"Long shots", why:"The most of your applications that can be stretch bets (high Fun, low Shot). Lower it if you need a job soon.",
    show:function(T){ return "Up to "+T.stretchMax+"% stretch bets"; },
    fields:function(T){ return [{id:"n", label:"Percent", value:String(T.stretchMax)}]; },
    read:function(v){ var n=parseInt(v.n,10); if(!(n>=0 && n<=100)) return "Give a percentage from 0 to 100."; return {stretchMax:n}; }}
];
function tgPanelHtml(){
  var T=TG();
  return '<div class="card panel tgpanel" id="tg-panel"><div class="sechead"><span class="eyebrow">My targets — what a healthy search looks like for you</span></div>'+
    '<p class="lede rulede">Highlights judge your search against these. They\'re yours to set'+(T.set? "" : ': these are the starting values until you change one')+'.</p>'+
    '<div class="tgrows">'+TG_ROWS.map(function(r){
      return '<div class="tgrow"><div class="tgmain"><span class="pn">'+esc(r.name)+'</span><b class="tgv">'+esc(r.show(T))+'</b><span class="pr">'+esc(r.why)+'</span></div>'+
        '<button type="button" class="linkbtn" data-tg="'+r.k+'">Edit</button></div>'; }).join("")+'</div></div>';
}
function tgEdit(k){
  var r=TG_ROWS.find(function(x){return x.k===k;}); if(!r || !DB) return; var T=TG();
  openForm({title:r.name, lede:r.why, ok:"Save", fields:r.fields(T), onSave:function(v){
    var ch=r.read(v); if(typeof ch==="string") return ch;
    var before=Object.assign({},(PREFS && PREFS.targets)||{}), after=Object.assign({},before,ch,{setAt:today()});
    if(!before.band) after=Object.assign({band:T.band, floor:T.floor, ivRate:T.ivRate, wait:T.wait, stretchMax:T.stretchMax},after);
    DB.doc("profile/prefs").update({targets:after}).then(function(){
      var T2=Object.assign({},T,ch); if(ch.wait) T2.wait=ch.wait;
      if(typeof ruLogEntry==="function") ruLogEntry({kind:"target", ruleId:"", field:"targets", action:"edit", before:before, after:{name:r.name+": "+r.show(T2), targets:after}, via:"you", why:""});
      toast(r.name+" saved");
    }).catch(function(){ toast("Couldn't save — try again",true); });
  }});
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-tg]"); if(!b) return;
  ev.preventDefault(); tgEdit(b.dataset.tg);
});
/* Undo of a targets change from the change log puts the old targets back. */
srUndo=(function(orig){ return async function(logId){
  var l=((typeof RU!=="undefined" && RU.log)||[]).find(function(x){return x.id===logId;});
  if(!l || l.kind!=="target") return orig.apply(this,arguments);
  try{ await DB.doc("profile/prefs").update({targets:l.before||{}}); await DB.doc("rulelog/"+logId).update({undone:true}); toast("Undone"); }
  catch(e){ toast("Couldn't undo — try again",true); }
}; })(srUndo);

/* ---------- 2. Pattern cards for the weekly top 6 ---------- */
function tgHist(){ return rawRoles.concat(typeof insFolded==="function"? insFolded() : []); }
function tgMed(a){ a=a.slice().sort(function(x,y){return x-y;}); if(!a.length) return null; var m=Math.floor(a.length/2); return a.length%2? a[m] : Math.round((a[m-1]+a[m])/2); }
function tgIn(d,a,b){ return !!d && d>=a && d<=b; }
function tgCard(o){ return Object.assign({kind:"act", group:"act", score:10, cohort:false, n:null, fix:false, metric:"", act:"", actLab:"Go there", extra:true},o); }
function tgDecideLL(r){ if(r.source==="self") return null; var e=endOf(r);
  if(r.g1At) return {a:r.seen, b:r.g1At}; if(e && e.stage==="Gate 1" && e.by==="me") return {a:r.seen, b:String(e.at||"").slice(0,10)}; return null; }
function tgDecideSL(r){ var e=endOf(r), a=r.g1At||(r.source==="self"? r.seen : "");
  if(!a) return null;
  if(e && e.stage==="Gate 2" && e.by==="me") return {a:a, b:String(e.at||"").slice(0,10)};
  if(r.g2At && (r.stage==="prep"||r.stage==="applied"||r.stage==="offer"||r.appliedAt)) return {a:a, b:r.g2At};
  return null; }
function tgDecideTA(r){ return (r.g2At && r.appliedAt)? {a:r.g2At, b:r.appliedAt} : null; }
function tgRoundOf(r){
  var ivs=commitments.filter(function(c){ return c.roleId===r.id && mtItem(c)==="meeting" && wkCat(c)==="interview" && c.date; }).sort(function(a,b){ return a.date<b.date? 1 : -1; });
  var end=String((endOf(r)||{}).at||"").slice(0,10), c=ivs.find(function(x){ return !end || x.date<=end; })||ivs[0]; if(!c) return "Interview";
  var ip=r.interviewPrep||{}, k=Object.keys(ip).find(function(x){ return x===c.id || (ip[x]||{}).commitmentId===c.id; });
  var ty=(k && ip[k].type) || (/screen/i.test((c.title||"")+" "+(c.detail||""))? "screen" : "");
  return ty && typeof MOCKTYPES!=="undefined" && MOCKTYPES[ty]? MOCKTYPES[ty] : ty==="screen"? "Recruiter screen" : "Interview";
}
/* Per-source counts in a sweep record: `read` = listings read from the source, `passed` = reached the longlist.
   Older records have only `found`, which mixed the two: read falls back to it, passed stays unknown (null). */
function srcRead(s){ return s && s.read!=null? (+s.read||0) : (+(s && s.found)||0); }
function srcPassed(s){ return s && s.passed!=null? (+s.passed||0) : null; }
var SRC_NOFIT_N=4, SRC_NOFIT_MIN=5;
/* No fit: the source's last SRC_NOFIT_N sweep results each read at least SRC_NOFIT_MIN listings and passed none.
   Only records with `passed` count. Also shown on the source's row in Sourcing (09). */
function srcNoFit(id){
  var SW=hySweepRuns(), recs=[];
  for(var i=0; i<SW.length && recs.length<SRC_NOFIT_N; i++){ var s=(SW[i].sources||[]).find(function(x){ return x.id===id; }); if(s) recs.push(s); }
  if(recs.length<SRC_NOFIT_N || !recs.every(function(s){ return srcPassed(s)===0 && srcRead(s)>=SRC_NOFIT_MIN; })) return null;
  return {n:recs.length, read:recs.reduce(function(m,s){ return m+srcRead(s); },0)};
}
function insHlExtra(){
  var T=TG(), t=today(), out=[], H=tgHist(), days=typeof insBoardDays==="function"? insBoardDays() : 0;
  var live=roles.filter(function(r){ return r.stage==="applied"||r.stage==="offer"; });
  /* --- Outcomes --- */
  /* Below the band, with where the funnel is thin, downstream first: the nearest place more applications can come from. */
  if(live.length<T.band[0]){
    var prep=roles.filter(function(r){return r.stage==="prep";}), sl=roles.filter(function(r){return r.stage==="consideration";}), ll=roles.filter(function(r){return r.stage==="proposed";});
    var d28=addDays(t,-27), lld=H.map(tgDecideLL).filter(function(x){ return x && tgIn(x.b,d28,t); }), llPass=H.filter(function(r){ return r.g1At && tgIn(r.g1At,d28,t) && r.source!=="self"; }).length;
    var new7=H.filter(function(r){ return tgIn(r.seen,addDays(t,-6),t) && !insIsBacklog(r); }).length, why, go="tab:toapply", lab="To apply";
    if(prep.length){ why=plural(prep.length,"role")+" at To apply: sending "+(prep.length===1? "it" : "them")+" is the quickest way back into your band."; }
    else if(sl.length>=2){ why=plural(sl.length,"role")+" on your shortlist waiting for a decision."; go="tab:gate2"; lab="Shortlist"; }
    else if(lld.length>=10 && llPass/lld.length<0.1){ why="You sent "+insPct(llPass,lld.length)+"% of longlist roles on to the shortlist in the last four weeks ("+llPass+" of "+lld.length+"). The longlist is where it's thin: either the roles are wrong or you're being strict."; go="tab:gate1"; lab="Longlist"; }
    else if(new7<T.floor){ why="Only "+new7+" new roles reached your longlist this week, under your "+T.floor+": supply is the bottleneck."; go="tab:routine"; lab="Sourcing"; }
    else { why=plural(ll.length,"role")+" waiting on your longlist."; go="tab:gate1"; lab="Longlist"; }
    out.push(tgCard({key:"band", score:40, n:T.band[0]-live.length, title:"Below your application band", text:live.length+" live applications against your "+T.band[0]+"–"+T.band[1]+". "+why, metric:String(live.length), act:go, actLab:lab}));
  } else if(live.length>T.band[1])
    out.push(tgCard({key:"bandhi", score:22, n:live.length, title:"Above your application band", text:live.length+" live applications against your "+T.band[0]+"–"+T.band[1]+". Prep for each one may suffer: hold new applications for now.", metric:String(live.length), act:"tab:inplay", actLab:"Applied"}));
  var ap=roles.filter(function(r){ return (r.stage==="applied"||r.stage==="offer"||r.stage==="prep") && mixKeyOf(r)!=="un"; });
  if(ap.length>=4){ var st=ap.filter(function(r){return mixKeyOf(r)==="hl";}).length, sp=Math.round(st/ap.length*100);
    if(sp>T.stretchMax) out.push(tgCard({key:"stretch", score:18, n:sp, title:"Too many stretch bets", text:sp+"% of your scored roles from To apply on are stretch bets (high Fun, low Shot), against your limit of "+T.stretchMax+"%.", metric:sp+"%", act:"f:quad:hl", actLab:"Filter to them"})); }
  /* Applications reaching interview, against your target; with which ones did. */
  var due=H.filter(function(r){ return r.appliedAt && dayGap(r.appliedAt,t)>=14; });
  if(due.length>=8){
    var iv=due.filter(insInterviewed), rate=Math.round(iv.length/due.length*100);
    if(rate<T.ivRate){
      var by={}; due.forEach(function(r){ var f=insFit(r); f=(!f||f==="none")? "Not scored" : f; var x=by[f]=by[f]||{n:0,i:0}; x.n++; if(insInterviewed(r)) x.i++; });
      var parts=Object.keys(by).sort(function(a,b){ return by[b].i/by[b].n - by[a].i/by[a].n; }).map(function(f){ return f+" "+by[f].i+"/"+by[f].n; });
      out.push(tgCard({key:"ivrate", score:36, n:rate, title:"Fewer applications reaching interview than you want", text:iv.length+" of "+due.length+" applications sent at least two weeks ago reached an interview ("+rate+"%, against your "+T.ivRate+"%). By Role Fit: "+parts.join(", ")+". Apply where you convert, and check the CV and letter against the ones that did.", metric:rate+"%", act:"tab:inplay", actLab:"Applied"}));
    } else out.push(tgCard({key:"ivrate-fyi", group:"fyi", kind:"good", score:8, title:"Applications are reaching interview", text:iv.length+" of "+due.length+" applications sent at least two weeks ago reached an interview ("+rate+"%), at or above your "+T.ivRate+"%.", metric:rate+"%"}));
  }
  /* Losing at the same kind of round, and the same reason given repeatedly. */
  var lost=H.filter(function(r){ var e=endOf(r); return e && e.by==="them" && insInterviewed(r); }), byR={};
  lost.forEach(function(r){ var k=tgRoundOf(r); byR[k]=(byR[k]||0)+1; });
  Object.keys(byR).forEach(function(k){ if(byR[k]>=3) out.push(tgCard({key:"ivloss:"+k, score:30+byR[k], n:byR[k], title:"Lost at the "+k.toLowerCase()+" "+byR[k]+" times", text:"That's where you most often drop out. Practise that round in Mock interview, and reread your notes from those rounds for what they had in common.", metric:String(byR[k]), act:"tab:mock", actLab:"Mock interview"})); });
  var byNo={}; H.forEach(function(r){ var e=endOf(r); if(!e || e.by!=="them" || /^(No reason given|Went quiet|Other)$/.test(e.reason)) return; byNo[e.reason]=(byNo[e.reason]||0)+1; });
  Object.keys(byNo).forEach(function(k){ if(byNo[k]>=3) out.push(tgCard({key:"theyno:"+k, score:24+byNo[k], n:byNo[k], title:"They said “"+k+"” "+byNo[k]+" times", text:"The same reason keeps coming back. Worth weighing before you apply to similar roles, and worth addressing head-on in the CV or the first conversation.", metric:String(byNo[k]), act:"tab:rejected", actLab:"Closed"})); });
  /* --- Supply --- */
  if(days>=14){
    var a7=addDays(t,-6), p0=addDays(t,-13), p1=addDays(t,-7), q0=addDays(t,-27);
    var nowR=H.filter(function(r){ return tgIn(r.seen,a7,t) && !insIsBacklog(r); }), prevR=H.filter(function(r){ return tgIn(r.seen,p0,p1) && !insIsBacklog(r); });
    if(nowR.length<T.floor){
      var scrIn=function(a,b){ return (typeof insScreened==="function"? insScreened() : []).filter(function(x){ return tgIn(x.date,a,b) && !(typeof insScrBacklog==="function" && insScrBacklog(x)); }).length; };
      var sN=scrIn(a7,t), sP=scrIn(p0,p1), shN=(sN+nowR.length)? sN/(sN+nowR.length) : 0, shP=(sP+prevR.length)? sP/(sP+prevR.length) : 0;
      var ch={}; H.forEach(function(r){ if(insIsBacklog(r)) return; var k=insCh(r); if(!k) return; var x=ch[k]=ch[k]||{now:0, before:0};
        if(tgIn(r.seen,a7,t)) x.now++; else if(tgIn(r.seen,q0,p1)) x.before++; });
      var ks=Object.keys(ch).filter(function(k){ return ch[k].before/3>=1; }), fell=ks.filter(function(k){ return ch[k].now < 0.6*ch[k].before/3; });
      var base=nowR.length+" new roles reached your longlist in the last 7 days, under your "+T.floor+". ";
      if(ks.length>=3 && fell.length/ks.length>=0.6 && shN-shP<0.15)
        out.push(tgCard({key:"floor", group:"fyi", kind:"watch", score:38, n:T.floor-nowR.length, title:"Fewer roles coming in, across the board", text:base+"Finds fell in "+fell.length+" of "+ks.length+" channels at once, with your rules screening out no more than before. That looks like the market, not your setup: hold your rules for now.", metric:String(nowR.length)}));
      else if(shN-shP>=0.15)
        out.push(tgCard({key:"floor", fix:true, score:38, n:T.floor-nowR.length, title:"Fewer roles coming in: your rules are screening out more", text:base+"The sweep screened out "+Math.round(shN*100)+"% of what it found, against "+Math.round(shP*100)+"% the week before. A deal-breaker may have got stricter or be misread.", metric:String(nowR.length)}));
      else if(fell.length)
        out.push(tgCard({key:"floor", fix:true, score:38, n:T.floor-nowR.length, title:"Fewer roles coming in from "+fell.slice(0,2).map(function(k){ return insLc(insDimLab("ch",k)); }).join(" and "), text:base+"Those channels found less than usual; the rest held up. Check their sources and search terms, or add a channel.", metric:String(nowR.length)}));
      else
        out.push(tgCard({key:"floor", fix:true, score:36, n:T.floor-nowR.length, title:"Fewer roles coming in than you want", text:base+"No single cause stands out: more channels, sources or search terms would widen the net.", metric:String(nowR.length)}));
    }
    /* Arrivals outrunning decisions on the longlist. */
    var a14=addDays(t,-13), arr=H.filter(function(r){ return r.source!=="self" && tgIn(r.seen,a14,t) && !insIsBacklog(r); }).length;
    var dec=H.map(tgDecideLL).filter(function(x){ return x && tgIn(x.b,a14,t); }).length, llN=roles.filter(function(r){return r.stage==="proposed";}).length;
    if(llN>=20 && arr>1.5*Math.max(dec,1))
      out.push(tgCard({key:"toomany", group:"fyi", kind:"watch", score:26, n:llN, title:"Your longlist is growing faster than you clear it", text:arr+" roles arrived in the last two weeks and you decided on "+dec+"; "+llN+" are waiting. Review more often, or tighten what gets through.", metric:String(llN), act:"tab:gate1", actLab:"Longlist"}));
  }
  /* Search terms that found nothing in four weeks, once the sweep records which term found each role. */
  if(days>=28){
    var c28=addDays(t,-27), tagged=H.filter(function(r){ return r.searchTerm && tgIn(r.seen,c28,t); });
    if(tagged.length>=10){
      var hit={}; tagged.forEach(function(r){ hit[String(r.searchTerm).toLowerCase().trim()]=1; });
      var terms=[]; ((PREFS && PREFS.searchTerms)||[]).forEach(function(g){ String(g.terms||"").split(",").forEach(function(x){ x=x.trim(); if(x) terms.push(x); }); });
      var dead=terms.filter(function(x){ return !hit[x.toLowerCase()]; });
      if(dead.length && dead.length<terms.length) out.push(tgCard({key:"staleterms", fix:true, score:16+dead.length, n:dead.length, title:plural(dead.length,"search term")+" found nothing in four weeks", text:dead.slice(0,6).join(", ")+(dead.length>6? " and "+(dead.length-6)+" more" : "")+". Reword or drop them so the sweep spends its effort where roles are.", metric:String(dead.length)}));
    }
  }
  /* Watched companies the sweep can read that produced nothing in 60 days. */
  if(days>=60){
    var c60=addDays(t,-59), seenCo={};
    H.forEach(function(r){ if(tgIn(r.seen,c60,t)){ seenCo[slug(r.company||"")]=1; if(r.companyId) seenCo[r.companyId]=1; } });
    (typeof insScreened==="function"? insScreened() : []).forEach(function(x){ if(tgIn(x.date,c60,t)) seenCo[slug(x.company||"")]=1; });
    var quietCo=companies.filter(function(c){ return c.watch && c.boardUrl && c.boardAts!=="linkedin-alert" && !seenCo[c.id] && !seenCo[slug(c.name||"")]; });
    if(quietCo.length>=3) out.push(tgCard({key:"staletargets", fix:true, score:14+quietCo.length, n:quietCo.length, title:plural(quietCo.length,"watched company","watched companies")+" with no roles in 60 days", text:quietCo.slice(0,5).map(function(c){return c.name||c.id;}).join(", ")+(quietCo.length>5? " and "+(quietCo.length-5)+" more" : "")+". Swap some for companies that are hiring.", metric:String(quietCo.length)}));
  }
  /* Sources the sweep reads fine but where nothing passes your rules: a keep-or-drop decision, not a fault. */
  var nofit=srcs.filter(function(x){ return x.status!=="dropped"; }).map(function(x){ var f=srcNoFit(x.id); return f? {x:x, f:f} : null; }).filter(Boolean);
  if(nofit.length) out.push(tgCard({key:"srcnofit", fix:true, score:15+nofit.length, n:nofit.length, title:plural(nofit.length,"source")+" with nothing that fits in "+SRC_NOFIT_N+" sweeps", text:nofit.slice(0,4).map(function(o){ return o.x.name||o.x.id; }).join(", ")+(nofit.length>4? " and "+(nofit.length-4)+" more" : "")+". The sweep reads them, but nothing has passed your rules. Move them to Manual, drop them, or keep them on trial.", metric:String(nofit.length)}));
  /* --- Your decisions: your pace against your targets, and roles that closed while you decided --- */
  var d28b=addDays(t,-27);
  [["longlist",tgDecideLL,"gate1","longlist roles"],["shortlist",tgDecideSL,"gate2","shortlist roles"],["toApply",tgDecideTA,"toapply","sending applications"]].forEach(function(s){
    var ds=H.map(s[1]).filter(function(x){ return x && tgIn(x.b,d28b,t) && x.a; }).map(function(x){ return Math.max(0,dayGap(x.a,x.b)||0); });
    var m=tgMed(ds), w=T.wait[s[0]];
    if(ds.length>=5 && m>w) out.push(tgCard({key:"speed:"+s[0], score:20+(m-w), n:m, title:"You take "+m+" days to decide on "+s[3], text:"Your median over the last four weeks ("+ds.length+" decisions), against your "+w+". Roles close while they wait: a fixed review slot in Week ahead helps.", metric:m+"d", act:"tab:"+s[2], actLab:"Go there"}));
  });
  var gone=H.filter(function(r){ var e=endOf(r); return e && e.by==="neither" && /pulled|filled|expired/i.test(e.reason) && (e.stage==="Gate 2" || /apply/i.test(e.stage||"") || (r.stage==="closed" && !r.appliedAt)) && tgIn(String(e.at||"").slice(0,10),d28b,t); });
  if(gone.length>=2) out.push(tgCard({key:"closingmiss", score:28+gone.length, n:gone.length, title:plural(gone.length,"role")+" closed while you were deciding", text:"In the last four weeks, "+gone.slice(0,3).map(function(r){return r.company||r.title;}).join(", ")+(gone.length>3? " and "+(gone.length-3)+" more" : "")+" were filled or pulled before you applied. Watch the red ! on roles closing soon.", metric:String(gone.length), act:"tab:gate2", actLab:"Shortlist"}));
  return out;
}

/* ---------- 3. Data health › Is it running ---------- */
var TR=[], ERRL=[], TR_CAD={"daily-check":1, "longlist-research":1, "shortlist":1, "apply-pack":1, "interview-prep":1, "sweep-check":7};
var TR_LAB={"daily-check":"Daily check", "longlist-research":"Longlist research", "shortlist":"Shortlist research", "apply-pack":"CV packs", "interview-prep":"Interview prep", "sweep-check":"Weekly screen-out check"};
HY_SECS.unshift("Running");
HY_SEC_PLAIN.Running="Is it running";
Object.assign(HY_PLAIN,{
  "Scheduled tasks overdue or failed":["Scheduled tasks overdue or failed","A task missed its usual run or its last run failed. Check its scheduled task is on and look at its last run.","you"],
  "Sources that went quiet":["Sources that went quiet","They usually return listings, but the sweep read none from them in the last two sweeps. Check they still work. (A source that reads fine but has nothing that fits shows in Highlights instead.)","you"],
  "Sweep not on the model you chose":["Sweep not on the model you chose","You chose Sonnet for the sweep to save usage, but the last sweep ran on another model. In Claude, open Scheduled tasks, open the sweep task and set its model to Sonnet.","you"],
  "Alerts that never arrived":["Job alerts that never arrived","Alerts were set up for these sites over a week ago, but no alert email from them has reached the sweep. Check the alert still exists on the site and that your Gmail filter labels its emails.","you"],
  "Sources the sweep couldn't read":["Sources the sweep couldn't read","Blocked or failing on the last two sweeps, or the job-alert email couldn't be read. Reconnect Gmail, fix the label, or move the site to Manual.","you"],
  "Board errors":["Board errors","Something on this page failed in the last week. Ask Claude to look at it.","you"],
  "To apply with no CV draft after a morning run":["Roles at To apply with no CV draft","The morning run should have built one. Ask Claude to build the pack for the role.","you"],
  "Interviews soon with no prep":["Interviews in the next two days with no prep notes","No prep notes on the meeting yet. Ask Claude to prep the interview, or check the morning run.","you"],
  "Roles you turned down that came back":["Roles you turned down that came back","The same company and title as one you already closed. Reject it again, or keep it if something changed.","you"]
});
Object.assign(HY_YOUDO,{"Scheduled tasks overdue or failed":"Check the task","Sweeps that hit their limits":"Raise limits or drop channels","Sources that went quiet":"Check the source","Sources the sweep couldn't read":"Fix access","Alerts that never arrived":"Check the alert","Sweep not on the model you chose":"Change the model","Board errors":"Ask Claude","To apply with no CV draft after a morning run":"Ask for the pack","Interviews soon with no prep":"Ask for prep","Roles you turned down that came back":"Same role or not?"});
HY_GO["Sources that went quiet"]="routine"; HY_GO["Alerts that never arrived"]="routine"; HY_GO["Sources the sweep couldn't read"]="routine"; HY_GO["Sweeps that hit their limits"]="routine";
function hySweepRuns(){ return runs.filter(function(r){ return r.type==="sweep" && r.date; }).sort(function(a,b){ return a.date<b.date? 1 : a.date>b.date? -1 : String(a.id)<String(b.id)? 1 : -1; }); }
hygiene=(function(orig){ return function(){
  var out=orig(), t=today(), SW=hySweepRuns(), last2=SW.slice(0,2), older=SW.slice(2,8);
  function add(sec,title,items){ out.push({sec:sec, title:title, why:"", items:items, sev:"fix"}); }
  /* Tasks: from the run records each scheduled task writes (`taskruns`); a type is only judged once it has one. */
  var byT={}; TR.forEach(function(x){ if(!x.type || !x.date) return; if(!byT[x.type] || x.date>byT[x.type].date || (x.date===byT[x.type].date && String(x.at||"")>String(byT[x.type].at||""))) byT[x.type]=x; });
  add("Running","Scheduled tasks overdue or failed",Object.keys(byT).map(function(k){ var x=byT[k], cad=TR_CAD[k]||7, gap=dayGap(x.date,t)||0;
      if(x.status==="failed") return {k:"task", id:"tr-"+k, label:(TR_LAB[k]||k)+" · last run failed "+niceShort(x.date)+(x.note? ": "+clip(String(x.note),80) : "")};
      if(gap>cad+1) return {k:"task", id:"tr-"+k, label:(TR_LAB[k]||k)+" · last ran "+niceShort(x.date)+", "+plural(gap,"day")+" ago"};
      return null; }).filter(Boolean));
  add("Running","Sweeps that hit their limits",[]);   /* items filled by 36's fxLimits */
  /* Sources: from the per-source results each sweep records. */
  function srcOf(r,id){ return (r.sources||[]).find(function(s){ return s.id===id; }); }
  var ids={}; SW.slice(0,8).forEach(function(r){ (r.sources||[]).forEach(function(s){ if(s.id) ids[s.id]=s.name||s.id; }); });
  var quiet=[], bad=[];
  if(last2.length===2){
    Object.keys(ids).forEach(function(id){
      var a=srcOf(last2[0],id), b=srcOf(last2[1],id); if(!a || !b) return;
      var isBad=function(s){ return s.status==="blocked"||s.status==="error"; };
      if(isBad(a) && isBad(b)) return bad.push({k:"sweep", id:"sb-"+id, label:ids[id]+" · "+a.status+(a.note? ": "+clip(String(a.note),70) : "")});
      var prev=older.map(function(r){ return srcOf(r,id); }).filter(Boolean), avg=prev.length? prev.reduce(function(m,s){return m+srcRead(s);},0)/prev.length : 0;
      if(prev.length>=2 && avg>=3 && !srcRead(a) && !srcRead(b)) quiet.push({k:"sweep", id:"sq-"+id, label:ids[id]+" · nothing read in the last two sweeps, usually about "+Math.round(avg)});
    });
    /* The job-alert email: an error reading it, or no alert email reaching the sweep at all for two sweeps. */
    var al=function(r){ return (r.sources||[]).filter(function(s){ return /^alerts-/.test(s.id||""); }); };
    var errA=al(last2[0]).filter(function(s){ return s.status==="error"; });
    if(errA.length && !bad.some(function(x){ return x.id==="sb-"+errA[0].id; })) bad.unshift({k:"sweep", id:"gm", label:"Job-alert email couldn't be read · reconnect Gmail to Claude"});
    var noneA=last2.every(function(r){ var a=al(r); return a.length && a.every(function(s){ return !srcRead(s); }); }), hadA=older.some(function(r){ return al(r).some(function(s){ return srcRead(s)>0; }); });
    if(noneA && hadA) bad.push({k:"sweep", id:"gl", label:"No job-alert emails reached the sweep in two runs · check the Gmail label and filter"});
  }
  var mw=((typeof SETTINGS!=="undefined" && SETTINGS && SETTINGS.sweep)||{}).modelWanted, ls=SW[0];
  add("Running","Sweep not on the model you chose",(mw && ls && ls.model && String(ls.model).toLowerCase().indexOf(String(mw).toLowerCase())<0)?
    [{k:"task", id:"sm-"+(ls.id||ls.date), label:"Last sweep "+niceShort(ls.date)+" ran on "+ls.model+", not "+mw.charAt(0).toUpperCase()+mw.slice(1)}] : []);
  add("Running","Alerts that never arrived",(srcs||[]).filter(function(x){ var as=typeof srcAlertStage==="function"? srcAlertStage(x) : null; return as && as.k==="late" && x.status!=="dropped"; })
    .map(function(x){ return {k:"sweep", id:"na-"+x.id, label:(x.name||x.id)+" · alerts set up "+niceShort(x.setup.alertSetAt)+", no email since"}; }));
  add("Running","Sources that went quiet",quiet);
  add("Running","Sources the sweep couldn't read",bad);
  var w7=addDays(t,-6), errs=ERRL.filter(function(x){ return x.day>=w7; }).sort(function(a,b){ return a.day<b.day? 1 : -1; });
  add("Running","Board errors",errs.map(function(x){ var m=(x.msgs||[])[0]||{}; return {k:"task", id:"er-"+x.day, label:niceShort(x.day)+" · "+plural(+x.n||1,"error")+(m.msg? " · "+clip(String(m.msg),90)+(m.where? " ("+m.where+")" : "") : "")}; }));
  /* Prep that should exist by now. */
  function R(r){ return {k:"role", id:r.id, label:(r.ref? "#"+r.ref+" " : "")+(r.title||"Untitled")+" · "+(r.company||"")}; }
  add("Stale","To apply with no CV draft after a morning run",roles.filter(function(r){ return r.stage==="prep" && r.g2At && (dayGap(r.g2At,t)||0)>=2 && !packReady(r); }).map(R));
  var soon=addDays(t,2);
  add("Stale","Interviews soon with no prep",commitments.filter(function(c){ return mtItem(c)==="meeting" && wkCat(c)==="interview" && c.state==="booked" && tgIn(c.date,t,soon) && !c.prepDone && !(c.prep && typeof c.prep==="object" && Object.keys(c.prep).length); }).map(function(c){
      var r=rawRoles.find(function(x){return x.id===c.roleId;}); if(!r) return null;
      var ip=r.interviewPrep||{}, has=Object.keys(ip).some(function(k){ return k===c.id || (ip[k]||{}).commitmentId===c.id; }) || (r.screenPrep && /screen/i.test((c.title||"")+" "+(c.detail||"")));
      return has? null : {k:"role", id:r.id, label:(c.title||"Interview")+" · "+niceShort(c.date)+(r.company? " · "+r.company : "")}; }).filter(Boolean));
  /* Turned down before, back again. */
  /* Placeholders never match (8 Oct): a pasted link waits for the morning read as "New role · Unknown company", so every
     such role looked like a comeback of an earlier one. Both sides must have a real title and company. */
  function hyPlaceholder(r){ return !r || (r.titleGuess && r.readState!=="read") || !r.title || !r.company || /^new role$/i.test(String(r.title).trim()) || /^unknown company$/i.test(String(r.company).trim()); }
  var ended={}; tgHist().forEach(function(r){ if(endOf(r) && !hyPlaceholder(r)) ended[slug(r.company||"")+"|"+slug(r.title||"")]=r; });
  add("Duplicates","Roles you turned down that came back",roles.filter(function(r){ if(!/^(proposed|consideration|parked|prep)$/.test(r.stage)) return false;
      if(r.cameBack && r.cameBack.keptAt) return false;   /* you chose to keep it (34) */
      if(hyPlaceholder(r)) return false;
      var e=ended[slug(r.company||"")+"|"+slug(r.title||"")]; if(!e || e.id===r.id || e.origId===r.id) return false; var ea=String((endOf(e)||{}).at||"").slice(0,10); return !ea || !r.seen || r.seen>=ea; }).map(function(r){
      /* Say how the earlier one ended (5 Oct): who, where, when and the reason, so you can decide without opening it. */
      var it=R(r), e=ended[slug(r.company||"")+"|"+slug(r.title||"")], o=endOf(e)||{};
      var who=o.by==="them"? "They said no" : o.by==="neither"? "It went away" : "You turned it down";
      var at={"Gate 1":"at the Longlist","Gate 2":"at the Shortlist"}[o.stage]||(o.stage? String(o.stage).toLowerCase() : "");
      var when=o.at? String(o.at).slice(0,10) : "";
      it.note=(HY_STG[r.stage]||r.stage)+" now · before: "+who+(at? " "+at : "")+(when? " on "+niceShort(when) : "")+(o.reason? ": "+o.reason : "")+(o.note? " — "+clip(String(o.note),90) : "");
      it.cb=e.id; return it; }));
  return out;
}; })(hygiene);
hyItem=(function(orig){ return function(x){
  if(x && x.k==="task") return '<span class="hyi">'+esc(x.label)+'</span>';
  return orig(x);
}; })(hyItem);

/* Board errors: written once per page load per message, at most five a load, into `errlog/<day>`. */
var ERRQ={sent:{}, n:0, busy:false};
function nrErrFlush(){
  if(!DB || ERRQ.busy || ERRQ.n>=5 || typeof NR_ERRS==="undefined" || !NR_ERRS.length) return;
  var e=NR_ERRS.shift(), key=e.msg+"|"+e.where; if(ERRQ.sent[key]){ if(NR_ERRS.length) nrErrFlush(); return; }
  ERRQ.sent[key]=1; ERRQ.n++; ERRQ.busy=true; var day=today();
  DB.doc("errlog/"+day).get().then(function(d){
    var o=d && d.exists? d.data() : {day:day, n:0, msgs:[]}, msgs=(o.msgs||[]).filter(function(m){ return m.msg+"|"+m.where!==key; });
    msgs.unshift({msg:e.msg, where:e.where, at:new Date().toISOString()});
    return DB.doc("errlog/"+day).set({day:day, n:(+o.n||0)+1, msgs:msgs.slice(0,10)});
  }).catch(function(){}).then(function(){ ERRQ.busy=false; if(NR_ERRS.length) nrErrFlush(); });
}
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.collection("taskruns").onSnapshot(function(s){ TR=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; }); try{ renderHygiene(); }catch(e){} },function(e){ console.warn("taskruns sub",e&&e.code); });
  db.collection("errlog").onSnapshot(function(s){ ERRL=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; }); try{ renderHygiene(); }catch(e){} },function(e){ console.warn("errlog sub",e&&e.code); });
  setTimeout(nrErrFlush,4000);
})();
try{ tgSyncBand(); renderHygiene(); }catch(e){}
