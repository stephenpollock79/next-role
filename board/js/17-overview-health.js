"use strict";
/* ---------- Sort on Longlist, Shortlist, To apply and Applied (1 Oct, night) ----------
   Suggested is the board's own order and the default. The choice is remembered per tab in this browser.
   Longlist: the queue still picks the batch of 30, and sorting reorders those 30. Applied keeps its two
   groups and sorts inside each. Ties fall back to newest first. */
var SORTS=[["suggested","Suggested"],["closing","Closing soonest"],["me","Me fit"],["them","Them fit"],
  ["rating","Company rating"],["funshot","Fun + Shot"],["company","Company A–Z"],["newest","Newest"]];
var SORT={}; try{ SORT=JSON.parse(localStorage.getItem("gb.sort")||"{}")||{}; }catch(e){ SORT={}; }
function sortNewest(a,b){ return (+b.ref||0)-(+a.ref||0); }
function sortThemVal(r){ var x=fitOf(r); return x? x.pct-(x.rough? 0.5 : 0) : -1; }
var SORTFN={
  closing:function(a,b){ var x=days(a.closing), y=days(b.closing); x=(x==null||x<0)? 1e9 : x; y=(y==null||y<0)? 1e9 : y; return x-y; },
  me:function(a,b){ var R={strong:0,mixed:1,fails:2,unknown:3}; return (R[myCrit(a).state]-R[myCrit(b).state]) || (sortThemVal(b)-sortThemVal(a)); },
  them:function(a,b){ return sortThemVal(b)-sortThemVal(a); },
  rating:function(a,b){ return priRank(coOf(a))-priRank(coOf(b)); },
  funshot:function(a,b){ function t(r){ var c=curScores(r); return (c.f==null||c.s==null)? -1 : c.f+c.s; } return t(b)-t(a); },
  company:function(a,b){ return String(a.company||"").localeCompare(String(b.company||"")) || String(a.title||"").localeCompare(String(b.title||"")); },
  newest:sortNewest
};
function sortRoles(tab,list,get){
  var k=SORT[tab]||"suggested", f=SORTFN[k]; if(!f) return list;
  get=get||function(x){return x;};
  return list.slice().sort(function(a,b){ var ra=get(a), rb=get(b); return closeFirst(ra,rb) || f(ra,rb) || sortNewest(ra,rb); });
}
/* Companies and People have their own sort options (2 Oct). */
var SORTSETS={
  companies:[["suggested","Suggested"],["priority","Priority"],["roles","Most roles"],["warm","Warm routes first"],["researched","Recently researched"],["name","Name A–Z"]],
  people:[["company","Company"],["last","Last spoke"],["warm","Warm routes first"],["added","Recently added"],["name","Name A–Z"]]};
function paintSortbars(){
  Array.prototype.forEach.call(document.querySelectorAll("[data-sortbar]"),function(box){
    var tab=box.dataset.sortbar, set=SORTSETS[tab]||SORTS, cur=SORT[tab]||set[0][0];
    if(!box.firstChild) box.innerHTML='<label class="sortbar"><span>Sort</span><select id="sort-'+tab+'" data-sorttab="'+tab+'" aria-label="Sort this list">'+
      set.map(function(o){ return '<option value="'+o[0]+'">'+esc(o[1])+'</option>'; }).join("")+'</select></label>';
    var sel=box.querySelector("select"); if(sel && sel.value!==cur) sel.value=cur;
  });
}
document.addEventListener("change",function(ev){
  var cf=ev.target.closest && ev.target.closest("[data-cof]");
  if(cf){ CO_F[cf.dataset.cof]=cf.value; try{ localStorage.setItem("gb.cof",JSON.stringify(CO_F)); }catch(e){} renderCompanies(); return; }
  var s=ev.target.closest && ev.target.closest("[data-sorttab]"); if(!s) return;
  SORT[s.dataset.sorttab]=s.value; try{ localStorage.setItem("gb.sort",JSON.stringify(SORT)); }catch(e){}
  render();
});
render=(function(orig){ return function(){ paintSortbars(); orig(); pageheadSync(); }; })(render);
/* Header extras that live outside each tab's own render (2 Oct): the Longlist count, and About me's
   section switch, which its render builds inside the page and is moved up beside the title. */
function pageheadSync(){
  var n=document.querySelectorAll("#g1-list article.role").length, c=el("cnt-g1");
  if(c) c.textContent = n+(n===1?" role":" roles");
  var sw=el("about-sw"), ab=el("about-body");
  if(sw && ab){ var t=ab.querySelector(":scope > .ctabs.sub"); if(t){ sw.innerHTML=""; sw.appendChild(t); } }
}

/* ===================== Overview, the rail and Data health =====================
   List pages get a rail of widgets that stays put as you switch stage. The Overview is the landing page:
   This week, Waiting on you and Funnel health, then Looking back (19 adds Highlights and Pace around it).
   Everything here only reads the board; it writes nothing. */
var V2={period:"7", group:"ch"};
var RAIL_TABS={gate1:1, gate2:1, toapply:1, inplay:1, rejected:1};
var TEXT_TABS={about:1, help:1, mock:1};
/* Live applications band (2 Oct): about ten at once, 5–10 beyond applied. Under it the odds drop;
   over it prep suffers. */
var LOAD_BAND=[5,10];
var LIVE_ST={proposed:1, consideration:1, parked:1, prep:1, applied:1, offer:1};
var STAGE_TAB={consideration:"gate2", parked:"gate2", prep:"toapply", applied:"inplay", offer:"inplay"};
function v2Page(){ document.body.dataset.page = RAIL_TABS[tab]? "rail" : TEXT_TABS[tab]? "text" : "wide"; }
function inLast(d,n){ if(!d) return false; var g=dayGap(d,today()); return g!=null && g>=0 && g<n; }
function inPrev(d,n){ if(!d) return false; var g=dayGap(d,today()); return g!=null && g>=n && g<2*n; }
function v2median(a){ a=a.filter(function(x){return x!=null && !isNaN(x);}).sort(function(x,y){return x-y;}); if(!a.length) return null;
  var m=Math.floor(a.length/2); return a.length%2? a[m] : Math.round((a[m-1]+a[m])/2); }
function plural(n,one,many){ return n+" "+(n===1? one : (many||one+"s")); }

/* ---- what needs you: roles from the shortlist on (the longlist is a single line, 2 Oct) ---- */
function needsYou(){
  var t=today(), out=[];
  roles.forEach(function(r){
    var it=null;
    if(r.stage==="consideration"){ var gm=g2Meet(r);
      /* Waiting on a booked meeting: not on you until it has happened (3 Oct). */
      it = (gm && gm.k==="before") || (!gm && g2Pending(r))? null : needsRead(r)? {s:"Paste the ad", at:r.g1At||r.seen} : {s:"Decide", at:(gm? gm.c.date : r.g1At||r.seen)}; }
    else if(r.stage==="parked" && r.parkUntil && r.parkUntil<=t) it={s:"Park review due", at:r.parkUntil};
    else if(r.stage==="prep" && packReady(r)) it={s:"CV ready, apply", at:r.g2At||r.seen};
    else if(r.stage==="applied"||r.stage==="offer"){ var f=flowOf(r); if(f.mine) it={s:f.label, at:lastContact(r)||r.appliedAt}; }
    if(it){ it.r=r; it.age=it.at? Math.max(0,dayGap(it.at,t)||0) : null; it.tab=STAGE_TAB[r.stage]; out.push(it); }
  });
  return out.sort(function(a,b){ return (b.age||0)-(a.age||0); });
}
function nyRow(x){
  return '<li><a href="#" data-act="role_go" data-id="'+esc(x.r.id)+'" title="Open this role"><span class="nyt">'+closeBang(x.r)+esc(x.r.title||"Untitled role")+'</span>'+
    '<span class="nyc">'+esc(x.r.company||"")+'</span></a><span class="nys">'+esc(x.s)+'</span><span class="nya">'+(x.age==null? "" : x.age+"d")+'</span></li>';
}
function longlistLine(){
  var t=today(), ll=roles.filter(function(r){return r.stage==="proposed";});
  var old=ll.reduce(function(m,r){ var g=r.seen? dayGap(r.seen,t) : 0; return Math.max(m,g||0); },0);
  return '<p class="rwline"><a href="#" data-gotab="gate1">Longlist · '+ll.length+' to review'+(ll.length? " · oldest "+old+"d" : "")+' →</a></p>';
}
function loadInfo(){
  var n=roles.filter(function(r){return r.stage==="applied"||r.stage==="offer";}).length, lo=LOAD_BAND[0], hi=LOAD_BAND[1];
  var s = n<lo? {cls:"mid", msg:"Below your "+lo+"–"+hi+" band. Push more through to keep the odds up."}
        : n>hi? {cls:"weak", msg:"Above your "+lo+"–"+hi+" band. Prep for each one may suffer."}
        : {cls:"strong", msg:"Inside your "+lo+"–"+hi+" band."};
  return {n:n, lo:lo, hi:hi, cls:s.cls, msg:s.msg};
}

/* ---- one day's diary, the same reading as Week ahead ---- */
/* Type tag on each line (2 Oct): the Week ahead categories, with the exact type on hover. */
var DAY_CAT={interview:"Interview", meeting:"Meeting", task:"Task", recurring:"Repeating task", prep:"Prep", deadline:"Deadline"};
function dayItems(d){
  var t=today(), out=[];
  commitments.forEach(function(c){
    var on=((c.state==="booked"||c.state==="done"||c.state==="cancelled") && c.date===d && !(mtItem(c)==="task" && c.state==="booked" && d<t)) ||
      (d===t && mtItem(c)==="task" && c.state==="booked" && c.date && c.date<t);
    if(on) out.push({time:c.time||"", title:c.title||mtLabel(c), done:c.state!=="booked", skip:!!cmtClosedAs(c), late:(mtItem(c)==="task" && c.state==="booked" && c.date<t), cat:wkCat(c), sub:mtLabel(c), for:dayFor(c), wk:"wk-"+c.id});
    if(runsOn(c,d)) out.push({time:c.time||"", title:c.title||"Repeating task", done:taskDoneOn(c,d), skip:skipOn(c,d), cat:"recurring", sub:mtLabel(c), for:dayFor(c), wk:"wk-task-"+c.id+"-"+d});
  });
  commitments.forEach(function(c){ if(c.state!=="done" && prepShowDate(c,t)===d) out.push({time:"", title:"Prep — "+(c.title||""), done:!!c.prepDone, cat:"prep", for:dayFor(c), wk:"wk-prep-"+c.id}); });
  mtDeadlines().forEach(function(x){ if(x.date===d) out.push({time:"", title:x.title, dl:true, cat:"deadline", wk:"wk-"+x.id}); });
  return out.sort(function(a,b){ return (a.done?1:0)-(b.done?1:0) || String(a.time||"zz").localeCompare(String(b.time||"zz")); });
}
/* What a diary item is for, in a word or two: the role's company, the company, or the person. */
function dayFor(c){
  var f=mtFor(c);
  if(f.k==="role"){ var r=roles.find(function(x){return x.id===f.id;}); if(r) return r.company||""; }
  if(f.k==="company"){ var co=companies.find(function(x){return x.id===f.id;}); if(co) return co.name||""; }
  return c.org||c.person||"";
}
function dayList(items){
  /* Two-line rows, all the same height (2 Oct): the title on line 1, clipped with … and in full on
     hover; time · type · what it's for on line 2. A thin bar in the type colour on the left. */
  return items.length? '<ul class="dl">'+items.map(function(x){
      var when=x.time||(x.dl?"Due":"Any time"), type=DAY_CAT[x.cat]||"";
      /* A click opens the item's pop-up, the same as on Week ahead (2 Oct). */
      return '<li class="dli k-'+(x.cat||"task")+(x.done?" done":"")+(x.skip?" skip":"")+'"'+(x.wk? ' data-wkopen="'+esc(x.wk)+'" role="button" tabindex="0"' : "")+'>'+
        '<span class="dn" title="'+esc(x.title)+'">'+esc(x.title)+'</span>'+
        '<span class="dm"><span class="dt">'+esc(when)+'</span>'+
          (type? ' · <span class="dk"'+(x.sub && x.sub!==type? ' title="'+esc(x.sub)+'"' : "")+'>'+esc(type)+'</span>' : "")+
          (x.for? ' · <span class="df">'+esc(x.for)+'</span>' : "")+
          (x.late? ' <span class="tag">overdue</span>' : "")+'</span></li>'; }).join("")+'</ul>'
    : '<p class="dlempty">Nothing booked.</p>';
}

/* ---- Fun & Shot ---- */
function quadCounts(list, withDecided){
  var q={hh:0,hl:0,lh:0,ll:0}, n=0, un=0;
  list.forEach(function(r){ var c=curScores(r);
    if(c.f!=null && c.s!=null){ q[quadOf(c.f,c.s)]++; n++; } else if(LIVE_ST[r.stage]) un++; });
  if(withDecided) decided.forEach(function(d){ var dq=d.quadrants||{}; ["hh","hl","lh","ll"].forEach(function(k){ q[k]+=(+dq[k]||0); n+=(+dq[k]||0); }); });
  return {q:q, n:n, un:un};
}

/* ---- the sweep ---- */
/* The sweep's rhythm comes from its own run history (4 Oct), never from a fixed schedule: whatever days
   the scheduled task runs on, the board learns them. Gaps are counted between sweep days (the last six,
   ignoring breaks over three weeks). Overdue = longer since the last sweep than the longest recent gap,
   plus a day's grace. Next = the gap that followed the last sweep on the same weekday, else the usual
   (median) gap. Under two gaps there is no rhythm yet: a week is allowed. */
function sweepRuns(){ return runs.filter(function(r){return r.type!=="verify" && r.type!=="manual" && r.date;}).sort(function(a,b){return String(a.date).localeCompare(String(b.date));}); }
function sweepCadence(sw){
  var days=[]; sw.forEach(function(r){ var d=String(r.date).slice(0,10); if(days[days.length-1]!==d) days.push(d); });
  var gaps=[]; for(var i=1;i<days.length;i++){ var g=dayGap(days[i-1],days[i]); if(g>0 && g<=21) gaps.push({from:days[i-1], g:g}); }
  gaps=gaps.slice(-6);
  if(gaps.length<2) return {usual:null, usualTxt:"", limit:7, nextGap:7};
  var s=gaps.map(function(x){return x.g;}).sort(function(a,b){return a-b;}), usual=s[Math.floor(s.length/2)];
  var last=days[days.length-1], same=gaps.filter(function(x){ return dowOf(x.from)===dowOf(last); }).pop();
  var lo=s[0], hi=s[s.length-1];
  return {usual:usual, usualTxt: lo===hi? plural(lo,"day") : lo+"–"+hi+" days", limit:hi+1, nextGap: same? same.g : usual};
}
function sweepState(){
  var sw=sweepRuns();
  if(!sw.length) return {k:"Never swept", cls:"mid", last:"", n:0, next:"", warn:"No sweep has run yet."};
  var last=sw[sw.length-1], since=daysSince(last.date), c=sweepCadence(sw), zeros=sw.slice(-3).filter(function(r){ return !(+r.proposed); }).length;
  var over= since!=null && since>c.limit;
  var k = over? "Stale" : zeros>=3? "Quiet" : "Running";
  var nx=addDays(String(last.date).slice(0,10), c.nextGap);
  var warn = over? "No sweep for "+plural(since,"day")+(c.usual? "; they usually run every "+c.usualTxt : "")+". Check its scheduled task is still on."
    : zeros>=3? "The last 3 sweeps added nothing to the longlist." : "";
  return {k:k, cls: k==="Stale"? "weak" : k==="Quiet"? "mid" : "strong", last:last.date, n:sw.length, since:since, usual:c.usual, usualTxt:c.usualTxt, limit:c.limit, next: nx<today()? "" : nx, warn:warn};
}
function nextSweepTxt(S){ S=S||sweepState(); return S.k==="Stale"? "overdue" : S.next? "next "+niceShort(S.next) : "next not known yet"; }

/* ---------- the rail (2 Oct, evening) ----------
   Three widgets: Today & tomorrow, Funnel health, To chase. Needs you is gone from the rail: it repeated
   the list on the left, and the funnel's On me toggle now gives the cross-stage count (it stays on the
   Overview). The rail shows totals and verdicts; the list on the left shows roles. To chase is the one
   list, because its items have no card on the stage you're looking at. */

/* Funnel health: one verdict line, then volume (live applications against the band), the Fun and Shot mix
   for the stage you're on, and the inflow (the sweep and its screening). */
var MIX_STAGES={
  gate1:  {st:["proposed"],                 lab:"longlist",  kind:"supply"},
  gate2:  {st:["consideration","parked"],   lab:"shortlist", kind:"supply"},
  toapply:{st:["prep"],                     lab:"To apply",  kind:"bets"},
  inplay: {st:["applied","offer"],          lab:"Applied",   kind:"bets"}
};
function itThem(n){ return n===1? "it" : "them"; }
function isAre(n){ return n===1? "is" : "are"; }
/* One sentence: the single biggest issue with the mix, or a plain all-clear. */
function mixInsight(Q,M){
  var q=Q.q, n=Q.n, tot=n+Q.un;
  if(!tot) return {cls:"", t: M.all? "No applications yet." : M.lab==="live roles"? "No roles scored yet. Score Fun and Shot in Mass review on the Longlist, and your roles show here." : "Nothing on the "+M.lab+" yet."};
  if(tab==="gate1" && n<3) return {cls:"", t:plural(Q.un,"role")+" not scored yet. Scores come in Mass review."};
  if(tab!=="gate1" && Q.un && Q.un/tot>0.3) return {cls:"mid", q:"un", pre:Q.un+" of "+tot+" unscored", t:", so this mix isn't reliable yet."};
  if(!n) return {cls:"", t:"Nothing scored yet."};
  var shot=q.hh+q.lh, sp=Math.round(q.hl/n*100);
  if(M.kind==="bets"){
    if(tab==="toapply" && q.ll) return {cls:"weak", q:"ll", pre:plural(q.ll,"role"), t:" you scored low on both "+isAre(q.ll)+" in To apply. Reject "+itThem(q.ll)+"?"};
    if(n>=2 && q.hl/n>0.5) return {cls:"weak", q:MIX_STAGES[tab]? "hl" : "", pre:"Too many stretch bets", t:" ("+sp+"%; target up to half). Push a role with a good shot through."};
    if(n>=3 && shot/n<0.25) return {cls:"mid", t:"Low on roles where you have a good shot."};
    if(n>=2 && !q.hh) return {cls:"mid", t:"No roles you'd enjoy and could win. That's the box to fill."};
    return {cls:"strong", t:sp+"% stretch bets, inside the up-to-half target."};
  }
  if(tab==="gate2" && q.ll) return {cls:"mid", q:"ll", pre:plural(q.ll,"role"), t:" scored low on both. Reject "+itThem(q.ll)+"?"};
  if(n>=3 && !q.hh) return {cls:"mid", t:"No roles you'd enjoy and could win on the "+M.lab+". Widen the sweep, don't lower the bar."};
  if(n>=3 && q.hl/n>0.6) return {cls:"mid", q:"hl", pre:"Mostly stretch bets", t:". Look for roles where your shot is better."};
  if(tab==="gate1" && n>=5 && q.ll/n>0.4) return {cls:"mid", q:"ll", pre:"Many longlist roles", t:" score low on both. The search terms may be too wide."};
  return {cls:"strong", q:q.hh? "hh" : "", pre:plural(q.hh,"role"), t:" you'd enjoy and could win. "+(tab==="gate1"? "Review" : "Decide")+" "+itThem(q.hh)+" first."};
}
function funnelVerdict(L){
  /* Before setup is done there is nothing to judge yet (25 Oct): no "below your band" warning on a new board. */
  if(typeof suOn==="function" && suOn()) return {cls:"", t:"Your funnel shows here once setup is done and the first sweep has run."};
  var und=roles.filter(function(r){return r.stage==="consideration" && !g2Pending(r);}).length;
  var ready=roles.filter(function(r){return r.stage==="prep" && packReady(r);}).length;
  var ll=roles.filter(function(r){return r.stage==="proposed";}).length, S=sweepState();
  var head=plural(L.n,"live application")+", ";
  if(L.n<L.lo){
    head+="below your "+L.lo+"–"+L.hi+". ";
    var next = ready? plural(ready,"CV")+" ready to send. Send before anything else."
      : und>=3? und+" shortlist roles waiting on a decision. Decide before sweeping for more."
      : ll>=5? ll+" roles on the longlist to review. That's where the next applications come from."
      : S.k!=="Running"? "The funnel is thin and "+(S.k==="Never swept"? "the sweep hasn't run yet" : "the sweep is "+S.k.toLowerCase())+". Check the sources."
      : "The funnel is thin. Add roles by hand on a manual sweep day.";
    return {cls:"mid", t:head+next};
  }
  if(L.n>L.hi) return {cls:"weak", t:head+"above your "+L.lo+"–"+L.hi+". Hold new applications until some close; prep suffers."};
  return {cls:"strong", t:head+"inside your "+L.lo+"–"+L.hi+". Keep the flow steady."};
}
/* A range bar with a pointer: the band shaded, a marker where you are. */
function rangeBar(L){
  /* The scale always runs past the top of the band, so its end label never sits on the band's own. */
  var max=Math.max(15, L.n+2, L.hi+Math.max(3,Math.ceil(L.hi*0.3))); function p(v){ return (v/max*100).toFixed(1)+"%"; }
  return '<div class="rbar" role="img" aria-label="'+plural(L.n,"live application")+'; your band is '+L.lo+' to '+L.hi+'">'+
    '<div class="rbtrack"><span class="rbband" style="left:'+p(L.lo)+';width:'+p(L.hi-L.lo)+'"></span>'+
    '<span class="rbptr '+L.cls+'" style="left:'+p(Math.min(L.n,max))+'"><i>'+L.n+'</i></span></div>'+
    '<div class="ldscale"><span>0</span><span style="left:'+p(L.lo)+'">'+L.lo+'</span><span style="left:'+p(L.hi)+'">'+L.hi+'</span><span style="left:100%;transform:translateX(-100%)">'+max+'</span></div></div>';
}
/* Funnel health (4 Oct): the verdict, Volume, and the Fun × Shot grid for live roles (shared with Insights,
   19 insQuadGrid) with its one-line verdict. Inflow was dropped: Highlights, Data health and the Sweep status
   card now carry what it said. */
function funnelHealth(){
  var L=loadInfo(), V=funnelVerdict(L);
  /* Unscored longlist roles are normal (scoring is the longlist's job), so they don't count against the mix. */
  var live=roles.filter(function(r){ if(!INS_QST[r.stage]) return false; if(r.stage!=="proposed") return true; var c=curScores(r); return c.f!=null && c.s!=null; }), M={list:live, lab:"live roles", kind:"bets"};
  var I=mixInsight(quadCounts(live,false),M), P=typeof ovQuadParts==="function"? ovQuadParts() : null; if(!P) return "";
  return '<section class="rw fh"><div class="rwh"><h3>Funnel health</h3><a href="#" data-gotab="pipeline">Insights →</a></div>'+
    '<p class="rwline ld '+V.cls+'">'+esc(V.t)+'</p>'+
    '<div class="fhsec"><div class="fhh">Volume<span>live applications</span></div>'+rangeBar(L)+'</div>'+
    '<div class="fhsec fhq"><div class="fhh">Fun × Shot<span>'+plural(P.n,"live role")+(P.un? " · "+P.un+" not scored" : "")+'</span></div>'+
      P.grid.svg+P.grid.key+P.grid.list+
      '<p class="rwline fhi '+I.cls+'">'+esc(I.pre||"")+esc(I.t)+'</p></div>'+
    '</section>';
}

/* To chase: their court, gone quiet. Applied roles the clock has moved to "Chase them" (QUIET_DAYS of no
   contact), and pending messages or meeting requests past their chase-by date, or a week (CHASE_DAYS)
   since sent or last chased when no chase-by is set. A plain message to someone is logged as a pending
   item ("waiting on their reply") in Week ahead. */
function toChase(){
  var t=today(), out=[];
  roles.forEach(function(r){
    if(r.stage!=="applied" || flowOf(r).k!=="chase") return;
    var lc=lastContact(r);
    out.push({title:r.title||"Untitled role", sub:r.company||"", age:lc? dayGap(lc,t) : null, roleId:r.id,
      btn:'<button type="button" class="btn sm" data-act="fs_chased" data-id="'+esc(r.id)+'">Chase sent</button>'});
  });
  commitments.forEach(function(c){
    if(c.state!=="offered" || c.court!=="them") return;
    var last=[c.lastChased,c.sentAt].filter(Boolean).sort().pop(), g=last? dayGap(last,t) : null;
    var due = c.chaseBy? c.chaseBy<=t : (g!=null && g>=CHASE_DAYS);
    if(!due) return;
    out.push({title:c.title||"Waiting on a reply", sub:[c.person,c.org].filter(Boolean).join(" · ") || (c.roleId? roleLabel(c.roleId) : ""), age:g,
      btn:wkBtn("cmtchase",c.id,"Chased today","sm")});
  });
  return out.sort(function(a,b){ return (b.age||0)-(a.age||0); });
}
function toChaseWidget(){
  var L=toChase();
  return '<section class="rw"><div class="rwh"><h3>To chase</h3><span class="rwn'+(L.length?" hot":"")+'">'+L.length+'</span></div>'+
    (L.length? '<ul class="tcl">'+L.slice(0,3).map(function(x){
        var nm = x.roleId? '<a href="#" data-act="role_go" data-id="'+esc(x.roleId)+'" title="Open this role"><span class="nyt">'+esc(x.title)+'</span><span class="nyc">'+esc(x.sub)+'</span></a>'
          : '<a href="#" data-gotab="week" title="Open in Week ahead"><span class="nyt">'+esc(x.title)+'</span><span class="nyc">'+esc(x.sub)+'</span></a>';
        return '<li>'+nm+'<span class="nya">'+(x.age==null? "" : x.age+"d")+'</span>'+x.btn+'</li>'; }).join("")+'</ul>'+
      (L.length>3? '<p class="rwmore"><a href="#" data-gotab="week">'+(L.length-3)+' more in Week ahead →</a></p>' : "")
      : '<p class="rwempty">Nothing gone quiet. Applications flag after '+QUIET_DAYS+' days with no contact; messages after '+CHASE_DAYS+'.</p>')+
    '</section>';
}

function renderRail(){
  var box=el("wrail"); if(!box) return;
  var t=today(), tm=addDays(t,1);
  var w1='<section class="rw"><div class="rwh"><h3>Today &amp; tomorrow</h3><a href="#" data-gotab="week">Week ahead →</a></div>'+
    '<div class="rwday">Today · '+esc(niceShort(t))+'</div>'+dayList(dayItems(t))+
    '<div class="rwday">Tomorrow · '+esc(niceShort(tm))+'</div>'+dayList(dayItems(tm))+'</section>';
  box.innerHTML=w1+funnelHealth()+toChaseWidget();
}

/* ---------- Overview ---------- */
function periodCounts(n){
  function inP(d){ return n? inLast(d,n) : !!d; } function inQ(d){ return n? inPrev(d,n) : false; }
  function cnt(fn){ var a=0, b=0; rawRoles.forEach(function(r){ var d=fn(r); if(d){ if(inP(d)) a++; if(inQ(d)) b++; } }); return [a,b]; }
  var P={
    found: cnt(function(r){ return r.seen; }),
    short: cnt(function(r){ return (r.g1At && r.stage!=="g1_rejected" && r.stage!=="proposed")? r.g1At : null; }),
    toap:  cnt(function(r){ return (r.g2At && reachedApply(r))? r.g2At : null; }),
    appl:  cnt(function(r){ return r.appliedAt; }),
    offers:cnt(function(r){ return r.offerAt; })
  };
  var e={a:0,b:0,me:0,them:0,neither:0};
  rawRoles.forEach(function(r){ var x=endOf(r); if(!x || !x.at) return; if(inP(x.at)){ e.a++; e[x.by]=(e[x.by]||0)+1; } if(inQ(x.at)) e.b++; });
  P.ended=e;
  var iv=[0,0], t=today();
  commitments.forEach(function(c){
    if(mtItem(c)!=="meeting" || mtType(c)==="informal") return;
    var f=mtFor(c); if(f.k!=="role" && !c.roleId) return;
    if(!c.date || c.date>t || (c.state!=="done" && c.state!=="booked")) return;
    if(inP(c.date)) iv[0]++; if(inQ(c.date)) iv[1]++;
  });
  P.iv=iv;
  return P;
}
function lbPct(a,b,of){ return b? Math.round(a/b*100)+"% of "+of : ""; }
function lbStep(lab,pair,n,cls,sub,alt){
  var d=pair[0]-pair[1];
  var delta = n? (d===0? '<span class="lbd">same as the '+n+' days before</span>'
    : '<span class="lbd '+(d>0?"up":"down")+'">'+(d>0?"▲ ":"▼ ")+Math.abs(d)+'</span> <span class="lbw">was '+pair[1]+'</span>')
    : '<span class="lbw">'+esc(alt||"\u00a0")+'</span>';
  return '<div class="lbs '+(cls||"")+'"><b>'+pair[0]+'</b><span class="lbl">'+esc(lab)+'</span>'+(delta? '<span class="lbx">'+delta+'</span>' : "")+
    (sub? '<span class="lbsub">'+esc(sub)+'</span>' : "")+'</div>';
}
function segHtml(key,cur){
  return '<div class="seg">'+[["7","7 days"],["30","30 days"],["all","All"]].map(function(o){
    return '<button type="button" class="'+(cur===o[0]?"on":"")+'" data-v2="'+key+'" data-v="'+o[0]+'" aria-pressed="'+(cur===o[0])+'">'+o[1]+'</button>'; }).join("")+'</div>';
}
/* ---- Loose ends (2 Oct): meeting and task actions that need you now ----
   Counted on the Week ahead badge and listed at the top of This week, so the two always match. Role actions
   are not here: they are Waiting on you, which matches the stepper. Nothing booked ahead or waiting on
   someone else counts. */
var LE_LAB={drop:"Called off: role closed", chase:"Chase", book:"Book it", log:"Log it", overdue:"Overdue"};
function looseEnds(){
  var t=today(), out=[], R={drop:0, chase:1, book:2, log:3, overdue:4};
  commitments.forEach(function(c){
    var k=null, age=null;
    if(c.dropped && !c.dropSeen) k="drop";
    else if(c.state==="offered" && chaseDue(c,t)){
      var last=[c.lastChased,c.sentAt].filter(Boolean).sort().pop(), g=last? dayGap(last,t) : null;
      k="chase"; age=g; }
    else if(c.state==="unplanned" && c.firedAt){ k="book"; age=dayGap(c.firedAt,t); }
    else if(c.state==="booked" && c.date && c.date<t){ k= mtItem(c)==="task"? "overdue" : "log"; age=dayGap(c.date,t); }
    if(k) out.push({k:k, c:c, age:age});
  });
  return out.sort(function(a,b){ return (R[a.k]-R[b.k]) || ((b.age||0)-(a.age||0)); });
}
function leRow(x){
  var c=x.c, who=dayFor(c)||c.person||"";
  if(x.k==="drop") return '<li><span class="ley"><span class="nyt">'+esc(c.title||"Item")+'</span><span class="nyc">'+esc(c.dropNote||"")+'</span></span>'+
    '<span class="nys">'+esc(LE_LAB.drop)+'</span><button type="button" class="btn sm" data-act="drop_ok" data-cid="'+esc(c.id)+'">OK</button></li>';
  return '<li data-wkopen="wk-'+esc(c.id)+'" role="button" tabindex="0" title="Open"><span class="ley"><span class="nyt">'+esc(c.title||mtLabel(c))+'</span><span class="nyc">'+esc(who)+'</span></span>'+
    '<span class="nys">'+esc(LE_LAB[x.k])+'</span><span class="nya">'+(x.age==null? "" : x.age+"d")+'</span></li>';
}
/* Role actions as short verbs (2 Oct), so each stage's breakdown reads as a to-do list. */
var WY_VERB={"Offer — decide":"Decide on the offer", "Prep the interview":"Prep the interview", "CV ready, apply":"Send the CV",
  "Write up the interview":"Write it up", "Chase them":"Chase", "Paste the ad":"Add the job ad", "Park review due":"Review parked", "Decide":"Decide"};
var WY_RANK={"Decide on the offer":0, "Prep the interview":1, "Send the CV":2, "Write it up":3, "Chase":4, "Add the job ad":5, "Review parked":6, "Decide":7};
var WY_STAGES=[["inplay","Applied"],["toapply","To apply"],["gate2","Shortlist"]];
function wyRank(s){ if(WY_RANK[s]!=null) return WY_RANK[s]; s=String(s||"");
  return /offer/i.test(s)? 0 : /interview|prep|get ready/i.test(s)? 1 : /\bCV\b|apply/i.test(s)? 2 : /write/i.test(s)? 3 : /chase|quiet/i.test(s)? 4 : /job ad/i.test(s)? 5 : /park/i.test(s)? 6 : /decide/i.test(s)? 7 : 9; }
function renderOverview(){
  var box=el("ov-body"); if(!box) return;
  var t=today(), ny=needsYou(), L=loadInfo();
  var dd=el("ov-date"); if(dd) dd.textContent=niceDay(t);
  /* First row (2 Oct): what you need to do and how things are flowing. Three cards: This week
     (anything with a date or time), Waiting on you (decisions with no date, grouped by the action), and
     Funnel health (the rail's widget). Nothing appears in both of the first two. */
  /* Capped so the three cards land at about the same height (2 Oct): today in full, then the
     next three days that have something dated (repeating tasks left out), then a count and a link. */
  var LE=looseEnds(), dayCap= LE.length>=2? 2 : 3;
  var shown=[], more=0, dayN=0;
  for(var i=0;i<7;i++){ var d=addDays(t,i), it=dayItems(d);
    if(i===0){ shown.push({d:d, it:it.filter(function(x){ return !x.late; })}); continue; }
    it=it.filter(function(x){ return !x.done && x.cat!=="recurring"; });
    if(!it.length) continue;
    if(dayN<dayCap){ shown.push({d:d, it:it}); dayN++; } else more+=it.length; }
  var wk='<section class="ovc ovweek"><div class="ovh"><h3>This week</h3><a class="ovmore" href="#" data-gotab="week">Week ahead →</a></div>'+
    (LE.length? '<div class="lends"><div class="rwday">Loose ends <span class="rwn hot">'+LE.length+'</span></div><ul class="nyl le">'+LE.slice(0,3).map(leRow).join("")+'</ul>'+
      (LE.length>3? '<p class="rwmore"><a href="#" data-gotab="week">+ '+(LE.length-3)+' more →</a></p>' : "")+'</div>' : "")+
    shown.map(function(x){ var g=dayGap(t,x.d);
      return '<div class="ovday'+(g===0?" today":"")+'"><div class="rwday">'+esc(g===0? "Today · "+niceShort(x.d) : g===1? "Tomorrow · "+niceShort(x.d) : niceShort(x.d))+'</div>'+dayList(x.it)+'</div>'; }).join("")+
    (shown.length===1? '<p class="rwempty">Nothing else booked in the next seven days.</p>' : "")+
    (more? '<p class="rwmore"><a href="#" data-gotab="week">+ '+plural(more,"more item")+' this week →</a></p>' : "")+
    '<p class="ovwknote" style="margin:10px 0 0;font-size:11.5px;color:var(--faint)">Repeating tasks show here for today only. <a href="#" data-gotab="week">Week ahead</a> has them every day.</p></section>';
  /* Waiting on you (2 Oct): role actions only, grouped by stage, so the total is the stepper's
     "on you" (Longlist aside, which has its own line). Meeting and task actions are Loose ends on This week. */
  var byS={}; ny.forEach(function(x){ (byS[x.tab]=byS[x.tab]||[]).push({r:x.r, s:WY_VERB[x.s]||x.s, age:x.age, tab:x.tab}); });
  var stg=WY_STAGES.filter(function(st){ return byS[st[0]] && byS[st[0]].length; });
  var tot=stg.reduce(function(m,st){ return m+byS[st[0]].length; },0);
  var wy='<section class="ovc ovwait"><div class="ovh"><h3>Waiting on you</h3><span class="rwn'+(tot?" hot":"")+'">'+tot+'</span></div>'+
    (stg.length? stg.map(function(st){
        var g=byS[st[0]].sort(function(a,b){ return closeFirst(a.r,b.r) || (wyRank(a.s)-wyRank(b.s)) || ((b.age||0)-(a.age||0)); });
        var cnt={}, vo=[]; g.forEach(function(x){ if(!cnt[x.s]){ cnt[x.s]=0; vo.push(x.s); } cnt[x.s]++; });
        var key="wy~"+st[0];
        /* No action sub-line (4 Oct): the action is on each row. Rows are soft cards like Today & tomorrow. */
        return '<details class="wyg wy-'+esc(st[0])+'" data-mtk="'+esc(key)+'"'+(MTOPEN[key]===false? "" : " open")+'><summary><b>'+g.length+'</b><span>'+esc(st[1])+'</span></summary><ul class="nyl">'+g.slice(0,3).map(nyRow).join("")+'</ul>'+
          (g.length>3? '<p class="rwmore wymore"><a href="#" data-gotab="'+esc(st[0])+'">+ '+(g.length-3)+' more in '+esc(st[1])+' →</a></p>' : "")+'</details>'; }).join("")
      : '<p class="rwempty">Nothing on the shortlist or later is waiting on you.</p>')+
    longlistLine()+'</section>';
  var fwd='<div class="ovrow3">'+wk+wy+funnelHealth()+'</div>';
  /* Backward: what happened, over 7 days, 30 days or the whole search. */
  var n = V2.period==="all"? 0 : +V2.period, P=periodCounts(n);
  var first=rawRoles.map(function(r){return r.seen;}).filter(Boolean).sort()[0];
  var back='<section class="ovc ovback"><div class="ovh"><h3>Looking back</h3><span class="ovsub">'+(n? "The last "+n+" days" : "Since the first role came in"+(first? ", "+esc(niceShort(first)) : ""))+'</span>'+segHtml("period",V2.period)+'</div>'+
    /* The funnel treatment (2 Oct): the same chevrons as the top bar, in the light theme, with the
       change on the period before under each; Ended sits apart as the exit. */
    /* On All there is no period before, so the line shows conversion from the step before instead and the
       chevrons keep their height (2 Oct). */
    '<div class="lbchev">'+lbStep("Found",P.found,n,"c-first","",first? "since "+niceShort(first) : "")+
      lbStep("Shortlisted",P.short,n,"","",lbPct(P.short[0],P.found[0],"found"))+lbStep("To apply",P.toap,n,"","",lbPct(P.toap[0],P.short[0],"shortlisted"))+
      lbStep("Applied",P.appl,n,"",P.offers[0]? plural(P.offers[0],"offer") : "",lbPct(P.appl[0],P.toap[0],"sent to apply"))+
      lbStep("Interviews",P.iv,n,"c-last","",P.appl[0]? (P.iv[0]/P.appl[0]).toFixed(1).replace(/\.0$/,"")+" per application" : "")+
      lbStep("Ended",[P.ended.a,P.ended.b],n,"c-exit",P.ended.a? (P.ended.me||0)+" you · "+(P.ended.them||0)+" them · "+(P.ended.neither||0)+" went away" : "",lbPct(P.ended.a,P.found[0],"found"))+'</div></section>';
  box.innerHTML=fwd+back;
}

var LVL=[["dir","Director, Head, VP"],["prin","Principal, Staff"],["lead","Lead"],["sen","Senior"],["oth","Other"]];
var DIMLAB={ch:"Channel", sec:"Sector card", quad:"Fun & Shot", me:"Me", them:"Them", lvl:"Level"};
function lvlOf(r){ var t=String(r.title||"");
  return /director|head of|\bvp\b|vice president/i.test(t)? "dir" : /principal|staff|group product/i.test(t)? "prin" : /\blead\b/i.test(t)? "lead" : /senior|\bsr\b/i.test(t)? "sen" : "oth"; }
function dimOf(r,k){
  if(k==="ch"){ var ch=chById(r.channelId||chOfSrc(r.sourceId)); return ch? ch.id : "none"; }
  if(k==="sec"){ var s=secOfCo(coOf(r)), ids=r.sectorIds||[]; return s? s.id : (ids[0]||"none"); }
  if(k==="quad"){ var c=curScores(r); return (c.f!=null && c.s!=null)? quadOf(c.f,c.s) : "un"; }
  if(k==="me") return myCrit(r).state;
  if(k==="them"){ var x=fitOf(r); return x? x.band : "none"; }
  return lvlOf(r);
}

function weekStart(d){ var x=new Date(d+"T12:00:00Z"); x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7)); return x.toISOString().slice(0,10); }

/* ---------- Data health: a hygiene sweep, like a backlog clean-up ---------- */
function hygiene(){
  var t=today(), out=[];
  function add(sec,title,why,items,sev){ out.push({sec:sec, title:title, why:why, items:items, sev:sev||"fix"}); }
  function R(r){ return {k:(DEAD[r.stage]||r.stage==="closed")? "rej" : "role", id:r.id, label:(r.ref? "#"+r.ref+" " : "")+(r.title||"Untitled")+" · "+(r.company||"")}; }
  function M(c){ return {k:"cmt", id:c.id, label:(c.title||mtLabel(c))+(c.date? " · "+niceShort(c.date) : "")}; }
  function V(v){ return {k:"conv", id:v.id, label:(v.date||"")+" · "+(v.who||v.subject||"Notes")}; }
  var rids={}, cids={}, sids={}; rawRoles.forEach(function(r){rids[r.id]=1;}); companies.forEach(function(c){cids[c.id]=1;}); sectors.forEach(function(s){sids[s.id]=1;});
  var LIVEPAST={consideration:1, parked:1, prep:1, applied:1, offer:1};
  add("Dates","Past the longlist with no shortlist date","The explorer can't time the longlist step for these.",
    rawRoles.filter(function(r){ return (LIVEPAST[r.stage]||r.stage==="closed"||r.stage==="g2_rejected") && !r.g1At; }).map(R));
  add("Dates","At To apply or later with no To apply date","",
    rawRoles.filter(function(r){ return (r.stage==="prep"||r.stage==="applied"||r.stage==="offer") && !r.g2At; }).map(R));
  add("Dates","Applied with no applied date","Looking back and the response tracker need it.",
    rawRoles.filter(function(r){ return (r.stage==="applied"||r.stage==="offer") && !r.appliedAt; }).map(R));
  add("Dates","Ended with no end date","Counts as ended, but in no period.",
    rawRoles.filter(function(r){ var e=endOf(r); return e && !e.at; }).map(R),"info");
  add("Links","Live roles with no posting link","Roles with a spec file or pasted text don't count.",
    roles.filter(function(r){ return LIVEPAST[r.stage] && !r.url && !(r.spec&&r.spec.id) && !r.pasted; }).map(R),"info");
  add("Links","Roles to confirm with the person","No link, so liveness is the recruiter's or contact's word. Over 14 days since.",
    roles.filter(function(r){ var L=liveInfo(r); return L && L.stale && LIVEPAST[r.stage]; }).map(R));
  add("Links","Postings the morning run couldn't read","Paste the posting text on the card.",
    roles.filter(function(r){ return GATES[r.stage] && needsRead(r); }).map(R));
  add("Links","Links not checked live in over two weeks","Shortlist and To apply only.",
    roles.filter(function(r){ return (r.stage==="consideration"||r.stage==="prep") && r.url && (!r.linkChecked || dayGap(r.linkChecked,t)>14); }).map(R),"info");
  add("Scores","Live roles with no Fun or Shot","The Fun & Shot mix leaves these out.",
    roles.filter(function(r){ var c=curScores(r); return LIVEPAST[r.stage] && (c.f==null||c.s==null); }).map(R));
  /* Only what won't fix itself (4 Oct): a role the next morning run will research or score is left out —
     a new shortlist role waiting for research, or one that reached To apply or later since yesterday. */
  var yday=addDays(t,-1);
  function selfFixing(r){ return (typeof g2Pending==="function" && g2Pending(r)) || (r.stage==="parked" && !r.g2At && !(typeof needsRead==="function" && needsRead(r))) ||
    ((r.stage==="prep"||r.stage==="applied"||r.stage==="offer") && String(r.appliedAt||r.g2At||"")>=yday); }
  add("Scores","Shortlist or later with no Them score","",
    roles.filter(function(r){ return (r.stage==="consideration"||r.stage==="prep"||r.stage==="applied"||r.stage==="offer") && !fitOf(r) && !selfFixing(r); }).map(R),"info");
  add("Orphans","Live roles with no company card","Company research, priority and warm routes can't show.",
    roles.filter(function(r){ return LIVEPAST[r.stage] && !coOf(r) && !selfFixing(r); }).map(R));
  add("Orphans","Roles whose source has been removed","",
    rawRoles.filter(function(r){ var s=r.sourceId||""; return s && s.indexOf("co:")!==0 && s.indexOf("flag:")!==0 && s.indexOf("ch:")!==0 && !srcs.some(function(x){return x.id===s;}); }).map(R),"info");
  add("Orphans","Meetings or tasks linked to a role that's gone","",
    commitments.filter(function(c){ return c.roleId && !rids[c.roleId]; }).map(M));
  add("Orphans","Notes linked to something that's gone","",
    conversations.filter(function(v){ return (v.roleId && !rids[v.roleId]) || (v.companyId && !cids[v.companyId]) || (v.sectorId && !sids[v.sectorId]); }).map(V));
  add("Orphans","Notes not attached to anything","Attach each to a role, company or sector.",
    conversations.filter(function(v){ return !v.roleId && !v.companyId && !v.sectorId; }).map(V));
  add("Orphans","People linked to a company card that's gone","",
    people.filter(function(p){ return p.companyId && !cids[p.companyId]; }).map(function(p){ return {k:"person", id:p.id, label:p.name}; }));
  add("Orphans","People with a company but no company card","Link them so warm routes show on the company.",
    people.filter(function(p){ return !p.companyId && p.company && !ppCoRec(p); }).map(function(p){ return {k:"person", id:p.id, label:p.name+" · "+p.company}; }),"info");
  add("Orphans","Companies linked to a sector card that's gone","",
    companies.filter(function(c){ return c.sectorId && !sids[c.sectorId]; }).map(function(c){ return {k:"co", id:c.id, label:c.name||c.id}; }));
  var SW=sweepState();
  add("Stale","Sweep overdue","Worked out from when sweeps usually run.",
    SW.k==="Stale"? [{k:"sweep", id:"sweep", label:"Last sweep "+niceShort(SW.last)+" · "+plural(SW.since,"day")+" ago"+(SW.usual? " · usually every "+SW.usualTxt : "")}] : []);
  add("Stale","Parked roles past their review date","",
    roles.filter(function(r){ return r.stage==="parked" && r.parkUntil && r.parkUntil<t; }).map(R));
  add("Stale","Meetings in the past that aren't logged","",
    commitments.filter(function(c){ return c.state==="booked" && c.date && c.date<t && mtItem(c)!=="task"; }).map(M));
  add("Stale","On the shortlist over two weeks without a decision","",
    roles.filter(function(r){ var gm=g2Meet(r); return r.stage==="consideration" && !(gm && gm.k==="before") && r.g1At && dayGap(r.g1At,t)>14; }).map(R),"info");
  var pairs=matchPairs(), inPair={};
  pairs.forEach(function(x){ inPair[x.a.id]=1; inPair[x.b.id]=1; });
  add("Duplicates","Possible matches for roles you added","An advert that looks like a role you added. Merge keeps your role and its source, and takes the advert's link.",
    pairs.map(function(x){ return {k:"pair", a:x.a, b:x.b}; }));
  var seen={}, dups=[];
  rawRoles.forEach(function(r){ if(DEAD[r.stage] || inPair[r.id]) return; var k=roleKey(r)||slug((r.company||"")+"-"+(r.title||""));
    if(seen[k]){ dups.push(R(seen[k])); dups.push(R(r)); } else seen[k]=r; });
  add("Duplicates","Possible duplicate roles","Same posting link, or the same company and title.",
    dups.filter(function(x,i,a){ return a.findIndex(function(y){return y.id===x.id;})===i; }));
  return out;
}
function hyItem(x){
  if(x.k==="pair") return '<div class="hypair"><span><b>'+esc(refTxt(x.a)+(x.a.title||""))+'</b> · '+esc(x.a.company||"")+' — added by you</span><span>↔</span>'+
    '<span><b>'+esc(refTxt(x.b)+(x.b.title||""))+'</b> · '+esc(srcLabel(x.b)||"an advert")+'</span>'+
    '<span class="hyacts"><button type="button" class="btn sm primary" data-act="pm_merge" data-id="'+esc(x.a.id)+'" data-cid="'+esc(x.b.id)+'">Same role, merge</button>'+
    '<button type="button" class="btn sm ghost" data-act="pm_not" data-id="'+esc(x.a.id)+'" data-cid="'+esc(x.b.id)+'">Not the same</button></span></div>';
  if(x.k==="role") return '<a href="#" class="hyi" data-act="role_go" data-id="'+esc(x.id)+'">'+esc(x.label)+'</a>';
  if(x.k==="co") return '<a href="#" class="hyi" data-act="co_go" data-id="'+esc(x.id)+'">'+esc(x.label)+'</a>';
  if(x.k==="person") return '<a href="#" class="hyi" data-act="pp_go" data-id="'+esc(x.id)+'">'+esc(x.label)+'</a>';
  if(x.k==="sweep") return '<a href="#" class="hyi" data-gotab="routine" data-sub="channels">'+esc(x.label)+'</a>';
  if(x.k==="rej") return '<a href="#" class="hyi" data-gotab="rejected">'+esc(x.label)+'</a>';
  if(x.k==="conv") return '<a href="#" class="hyi" data-gotab="inplay">'+esc(x.label)+'</a>';
  return '<a href="#" class="hyi" data-gotab="week">'+esc(x.label)+'</a>';
}
var HY_SECS=["Dates","Links","Scores","Orphans","Stale","Duplicates"];
function renderHygiene(){
  var all=hygiene(), nFix=0;
  all.forEach(function(x){ if(x.sev==="fix") nFix+=x.items.length; });
  setCount("tc-health", nFix); var tb=el("tc-health"); if(tb) tb.classList.toggle("hot", nFix>0);
  var box=el("hy-body"); if(!box) return;
  function sum(s,sev){ return all.filter(function(x){return x.sec===s && x.sev===sev;}).reduce(function(a,x){return a+x.items.length;},0); }
  box.innerHTML='<div class="hysum">'+HY_SECS.map(function(s){ var n=sum(s,"fix"), m=sum(s,"info");
      return '<div class="hyt"><span>'+esc(s)+'</span><b class="'+(n?"warn":"ok")+'">'+(n||"✓")+'</b><small>'+(n? n+" to fix" : "Nothing to fix")+(m? " · "+m+" to look at" : "")+'</small></div>'; }).join("")+'</div>'+
    HY_SECS.map(function(s){
      return '<section class="ovc"><div class="ovh"><h3>'+esc(s)+'</h3></div>'+all.filter(function(x){return x.sec===s;}).map(function(x){
        var n=x.items.length;
        return '<div class="hyr'+(n?"":" clear")+'"><div class="hyrh"><span class="hyst '+(n? x.sev : "ok")+'">'+(n||"✓")+'</span><span class="hytt">'+esc(x.title)+'</span>'+
            (x.why && n? '<span class="hywhy">'+esc(x.why)+'</span>' : "")+'</div>'+
          (n? '<div class="hyitems">'+x.items.slice(0,24).map(hyItem).join("")+(n>24? '<span class="hymore">and '+(n-24)+' more</span>' : "")+'</div>' : "")+'</div>';
      }).join("")+'</section>'; }).join("");
}
