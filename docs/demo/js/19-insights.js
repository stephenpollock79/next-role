"use strict";
/* ======================= Insights (3 Oct) =======================
   One end-to-end analysis page, replacing Pipeline and Sweep › Performance. It answers four questions:
   where are roles leaking, which sources are worth it, am I applying enough and to the right mix, and is
   it getting better.

   Counting: the funnel, breakdown and "why roles end" are COHORT counts — roles found in the timeframe,
   and how far they got. Trends are ACTIVITY counts — what happened in each week. Small numbers show the
   count beside any %, and a % with fewer than 5 roles behind it is greyed.

   Filters pick which roles (channel and source, My fit, Their fit, Fun & Shot; more: sector, level, added by).
   Scope picks which part of the funnel (from stage to stage); everything below re-bases to it.
   Screened-out roles are recorded per sweep with a rule and an axis, not as roles: they count in the
   Found step, filter by channel only, and drop out when any other filter is on.

   Shared charts: endWhereBars() draws "where roles end" here and on the Closed page. */

var INS={period:"all", cmp:false, f:{ch:"",src:"",me:"",fit:"",quad:"",sec:"",lvl:"",who:"",out:"",why:"",end:""}, from:0, to:6, dim:"ch", open:{}, tm:"found", more:false, col:"stages", cst:"all", qst:"live", pof:"prev", cpct:"n", dd:""};
var IST=["Found","Longlist","Shortlist","To apply","Applied","Interview","Offer"];
var INS_PRESETS=[["Whole funnel",0,6],["Sourcing",0,1],["Decisions",1,3],["Applications",3,5],["Interviews",4,6]];
var INS_WHO={me:"You said no", them:"They said no", neither:"Went away", rules:"Your rules"};
var INS_DIMS=[["ch","Channel"],["me","My fit"],["fit","Their fit"],["quad","Fun & Shot"],["sec","Sector"],["lvl","Level"],["who","Added by"],["out","Outcome"],["why","Reason"],["end","Ended at"]];
/* Outcome, Reason and Ended at (7 Oct): how a role ended, so closed roles can be cut by sector, fit, Fun & Shot and the rest.
   Live roles read "Live" / "Still open". The Outcome filter in the bar re-scopes the whole page. */
var INS_OUT_F=[["ended","Ended (any)"],["me","You turned down"],["them","They said no"],["neither","Went away"],["live","Live"]];
function insOutOf(r){ if(INS_QST[r.stage]) return "live"; var e=insEnd(r); return e? e.by : "none"; }
function insWhyOf(r){ if(INS_QST[r.stage]) return "none"; var e=insEnd(r); return e? e.reason : "none"; }
function insEndAtOf(r){ if(INS_QST[r.stage]) return "none"; return insEnd(r)? String(insReach(r)) : "none"; }
function insGraded(k){ return k==="me"||k==="fit"||k==="quad"||k==="lvl"||k==="out"||k==="end"; }
function insCatFits(k,v){ var o=INS.f.out; if(k==="out" && o) return o==="ended"? v!=="live" : v===o; if(k==="end" && o==="live") return false; return true; }
var INS_N=5;   /* a % with fewer roles behind it is greyed */

/* ---------- reading roles ---------- */
function insWho(r){ return r.source==="self"? "me" : "agent"; }
function insCh(r){ return (r.folded&&!r.full)? "" : (r.channelId||chOfSrc(r.sourceId)||""); }
/* Two fits (3 Oct): My fit is My criteria (Strong / Mixed / Fails), worked out from the role as it is
   now; Their fit is the Role Fit band (CV against the ad). Same words as the Me / Them gauges on the cards. */
var INS_ME_TIP="My criteria: does the role fit what you want. Worked out from the role as it is now, not when you decided.";
var INS_THEM_TIP="Role Fit: how your CV matches the job ad, as a band.";
function insMe(r){ if(r.folded&&!r.full) return "none"; var st=myCrit(r).state; return st==="unknown"? "none" : st; }
function insFit(r){ var x=(r.folded&&!r.full)? null : fitOf(r); return x? x.band : "none"; }
function insInterviewed(r){ return commitments.some(function(c){ return c.roleId===r.id && mtItem(c)==="meeting" && wkCat(c)==="interview" && (c.state==="booked"||c.state==="done"); }); }
/* The furthest stage a role reached, 1 Longlist … 6 Offer. A role that ended, ended there. */
function insReach(r){
  if(r.folded) return 1;
  var i=1;
  if(r.stage!=="proposed" && r.stage!=="g1_rejected") i=2;
  if(reachedApply(r) && r.stage!=="g2_rejected") i=Math.max(i,3);
  if(r.appliedAt || r.stage==="applied" || r.stage==="offer" || r.stage==="closed") i=Math.max(i,4);
  if(i>=4 && insInterviewed(r)) i=5;
  if(r.stage==="offer" || r.offerAt || (r.offer && r.offer.at)) i=6;
  return i;
}
function insEnd(r){ var e=endOf(r); return e? {by:e.by||"me", reason:e.reason||"Other", at:e.at||""} : null; }
/* Longlist passes folded into a daily record become role rows again, so they count where they ended. A fold
   keeps the whole role as `rec` (4 Oct); older folds kept only a few fields and come back as light rows. */
function insFolded(){
  var out=[];
  decided.forEach(function(d){ (d.items||[]).forEach(function(it,i){
    if(it.rec){ out.push(Object.assign({},it.rec,{id:"fold-"+d.id+"-"+i, origId:it.rec.id||"", folded:true, full:true, stage:"g1_rejected"})); return; }
    var lw=legacyEnd(it.reason,"me");
    out.push({id:"fold-"+d.id+"-"+i, folded:true, title:it.title||"", company:it.company||"", seen:it.seen||d.date||"", sourceId:it.sourceId||"", stage:"g1_rejected",
      endBy:lw[0], endReason:lw[1], endAt:d.date||"", fun:it.fun, shot:it.shot}); }); });
  return out;
}
/* Screened-out items: the sweep's axis, mapped to a channel as well as it can be. */
function insScrCh(src){
  /* A screen-out's source is a source id (boards-acme-jobs, co:acme), a channel id (flags, companies) or a
     free-text label; work the channel out in that order, so public boards and flag searches aren't "Not recorded" (QA 15 Oct). */
  var raw=String(src||""), byId=raw? chOfSrc(raw) : "";
  if(byId) return byId;
  if(channels.some(function(c){return c.id===raw;})) return raw;
  var s=raw.toLowerCase();
  if(/^flags?\b|flag search/.test(s)) return "flags";
  if(/alert/.test(s)) return "alerts";
  if(/role-led/.test(s)) return "careers";
  if(/company|careers search|board index|\.jobs/.test(s)) return "companies";
  return "";
}
function insScreened(){
  var out=[];
  screened.forEach(function(d){ (d.items||[]).forEach(function(it){ out.push({date:d.date||"", rule:it.rule||"", ch:insScrCh(it.source), title:it.title||"", company:it.company||""}); }); });
  return out;
}

/* ---------- filters, timeframe, scope ---------- */
function insWin(prev){
  if(INS.period==="all") return prev? null : {a:"", b:""};
  var n=+INS.period, t=today(), b=addDays(t,1), a=addDays(t,1-n);
  return prev? {a:addDays(a,-n), b:a} : {a:a, b:b};
}
function insIn(d,w){ return !w.a || (d && d>=w.a && d<w.b); }
function insOtherFilters(){ var f=INS.f; return !!(f.src||f.me||f.fit||f.quad||f.sec||f.lvl||f.who||f.out||f.why||f.end); }
function insPass(r,skip){
  var f=INS.f; skip=skip||"";
  if(f.ch && skip!=="ch" && (insCh(r)||"none")!==f.ch) return false;
  if(f.src && skip!=="ch" && r.sourceId!==f.src) return false;
  if(f.me && skip!=="me" && insMe(r)!==f.me) return false;
  if(f.fit && skip!=="fit" && insFit(r)!==f.fit) return false;
  if(f.quad && skip!=="quad" && mixKeyOf(r)!==f.quad) return false;
  if(f.sec && skip!=="sec" && ((r.folded&&!r.full)? "none" : dimOf(r,"sec"))!==f.sec) return false;
  if(f.lvl && skip!=="lvl" && lvlOf(r)!==f.lvl) return false;
  if(f.who && skip!=="who" && insWho(r)!==f.who) return false;
  if(f.out && skip!=="out"){ var o=insOutOf(r); if(f.out==="ended"? (o==="live") : o!==f.out) return false; }
  if(f.why && skip!=="why" && insWhyOf(r)!==f.why) return false;
  if(f.end && skip!=="end" && insEndAtOf(r)!==f.end) return false;
  return true;
}
function insDimOf(r,k){
  if(k==="ch") return insCh(r)||"none";
  if(k==="src") return r.sourceId||"none";
  if(k==="me") return insMe(r);
  if(k==="fit") return insFit(r);
  if(k==="quad") return mixKeyOf(r);
  if(k==="sec") return (r.folded&&!r.full)? "none" : dimOf(r,"sec");
  if(k==="lvl") return lvlOf(r);
  if(k==="out") return insOutOf(r);
  if(k==="why") return insWhyOf(r);
  if(k==="end") return insEndAtOf(r);
  return insWho(r);
}
function insDimLab(k,v){
  if(k==="out"){ var oo=INS_OUT_F.find(function(x){return x[0]===v;}); return oo? oo[1] : "Not recorded"; }
  if(v==="none" && (k==="why"||k==="end")) return "Still open";
  if(k==="end") return IST[+v]||v;
  if(v==="none") return k==="fit"? "Not scored" : k==="me"? "Not enough known" : k==="sec"? "No sector card" : "Not recorded";
  if(k==="ch"){ var c=chById(v); return c? c.name : v; }
  if(k==="src"){ if(String(v).indexOf("ch:")===0) return "No particular source";
    var ch=chById(chOfSrc(v)), it=ch && chItems(ch).find(function(x){return x.id===v;}); return it? it.name : String(v).replace(/^co:/,""); }
  if(k==="me") return ME_LAB[v]||v;
  if(k==="quad") return mixLabel(v)||"Unscored";
  if(k==="sec"){ var s=sectors.find(function(x){return x.id===v;}); return s? s.name : v; }
  if(k==="lvl"){ var l=LVL.find(function(x){return x[0]===v;}); return l? l[1] : v; }
  if(k==="who") return v==="me"? "You" : "The sweep";
  return v;
}
function insOpts(k){
  if(k==="me") return [["strong","Strong"],["mixed","Mixed"],["fails","Fails"],["none","Not enough known"]];
  if(k==="fit") return FIT_BANDS.map(function(b){return [b[1],b[1]];}).concat([["none","Not scored"]]);
  if(k==="quad") return MIXQ.map(function(x){return [x[0],x[1]];});
  if(k==="sec") return sectors.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).map(function(s){return [s.id,s.name||s.id];}).concat([["none","No sector card"]]);
  if(k==="lvl") return LVL;
  if(k==="who") return [["agent","The sweep"],["me","You"]];
  if(k==="out") return [["live","Live"],["me","You turned down"],["them","They said no"],["neither","Went away"]];
  if(k==="end") return [1,2,3,4,5,6].map(function(i){ return [String(i),IST[i]]; });
  if(k==="why"){ var c={}; roles.concat(insFolded()).forEach(function(r){ var w=insWhyOf(r); if(w!=="none") c[w]=(c[w]||0)+1; });
    return Object.keys(c).sort(function(a,b){ return c[b]-c[a] || a.localeCompare(b); }).map(function(w){ return [w,w]; }); }
  return [];
}

/* ---------- the model: one pass over the cohort ---------- */
function insModel(w){
  var all=roles.concat(insFolded());
  var rs=all.filter(function(r){ return insIn(r.seen,w) && insPass(r); });
  var scr = insOtherFilters()? [] : insScreened().filter(function(s){ return insIn(s.date,w) && (!INS.f.ch || (s.ch||"none")===INS.f.ch); });
  if(INS._act){ rs=rs.filter(function(r){ return !insIsBacklog(r); });
    scr=scr.filter(function(x){ if(insScrBacklog(x)) return false; var d=insRuleChanged(x.rule), dc=x.ch? insChChanged(x.ch) : ""; if(dc>d) d=dc; return !d || x.date>d; }); }
  var c=[0,0,0,0,0,0,0], ex=[]; for(var i=0;i<7;i++) ex.push({me:0,them:0,neither:0,rules:0});
  c[0]=rs.length+scr.length; ex[0].rules=scr.length;
  rs.forEach(function(r){ var k=insReach(r); r._k=k; for(var j=1;j<=k;j++) c[j]++; var e=insEnd(r); if(e){ r._e=e; ex[k][e.by]=(ex[k][e.by]||0)+1; } else r._e=null; });
  return {rs:rs, scr:scr, c:c, ex:ex};
}
function insExTot(x){ return (x.me||0)+(x.them||0)+(x.neither||0)+(x.rules||0); }
function insPct(a,b){ return b? Math.round(a/b*100) : null; }
function insPctHtml(a,b,suffix){ var p=insPct(a,b); if(p==null) return '<span class="ipz">—</span>';
  return '<span class="'+(b<INS_N? "ipz" : "ipp")+'" title="'+a+' of '+b+'">'+(p===0 && a>0? "&lt;1" : p)+'%'+(suffix||"")+'</span>'; }

/* ---------- highlights: rules over the same numbers ----------
   Reworked 3 Oct . Every card is one of two groups: ACT (there is a lever you can pull) or FYI (worth
   knowing, nothing to change). Deal-breakers carry a firmness (20: fixed / firm / tunable): a fixed rule is
   never offered for loosening — when it cuts or ends a lot, the card points at the sweep (it should have caught
   the role) or at sourcing (where the wrong roles come from), or it is FYI.
   Each card has a stable `key`, so it can be marked handled or not useful (hlstate). A handled card about the
   cohort (cohort:true) is worked out again from roles found since it was handled and only comes back if the
   pattern recurs; a card about the current state comes back when its number grows. */
var HLS=[];   /* hlstate docs: {key, state handled|dismissed, note, at, until, title, n} */
function insHlState(key){ return HLS.find(function(x){ return x.key===key; })||null; }
/* 20 (deal-breakers) loads after this file; until it has, there are no rules to read. */
function insRules(){ return typeof ruRules==="function"? ruRules() : []; }
function insFirmOf(h){ return typeof ruFirm==="function"? ruFirm(h) : "tunable"; }
function insRuleFirm(id){ var h=insRules().find(function(x){return x.id===id;}); return h? insFirmOf(h) : "tunable"; }
function insReasonRules(reason){ return insRules().filter(function(h){ return ruReasons(h).indexOf(reason)>=0; }); }
/* History guard (3 Oct): no card may claim a span longer than the board has data for. The board starts at the
   earliest role, run or sweep log it holds; a card with `span` (days) is dropped until that much history exists. */
/* Lower-case a name's first letter for use mid-sentence, unless it reads as a proper name (LinkedIn, ITJobsWatch). */
function insLc(x){ x=String(x||""); return /^[A-Z][a-z]/.test(x)? x.charAt(0).toLowerCase()+x.slice(1) : x; }
/* ---------- First reads and recent changes (3 Oct) ----------
   A source's first read brings in its whole backlog of live postings (the board's first sweep, a newly watched
   company, a new board), which later reads never repeat. Those roles are "first reads": Act cards and pace leave
   them out; For your information counts them and says so. Manual sites and roles you added aren't backlog. */
var INS_FR={key:"", m:{}};
function insSrcKey(r){ if(r.source==="self") return ""; var ch=insCh(r); if(ch && (chById(ch)||{}).kind==="manual") return ""; return r.sourceId || ch || ""; }
function insFirstReads(){
  var key=rawRoles.length+":"+decided.length+":"+screened.length; if(INS_FR.key===key) return INS_FR.m;
  var m={}; rawRoles.concat(insFolded()).forEach(function(r){ var k=insSrcKey(r); if(k && r.seen && (!m[k] || r.seen<m[k])) m[k]=r.seen; });
  var d0=""; screened.forEach(function(x){ if(x.date && (!d0 || x.date<d0)) d0=x.date; }); m["__scr"]=d0;
  INS_FR={key:key, m:m}; return m;
}
function insIsBacklog(r){ var k=insSrcKey(r); return !!(k && r.seen && insFirstReads()[k]===r.seen); }
function insScrBacklog(x){ var d0=insFirstReads()["__scr"]; return !!(d0 && x.date===d0); }
/* The day a rule, or a channel's setup (its status, its sources, or watched companies for company pages), last changed. */
function insLogDay(test){ var d=""; ((typeof RU!=="undefined" && RU.log)||[]).forEach(function(l){ if(test(l)){ var x=String(l.at||"").slice(0,10); if(x>d) d=x; } }); return d; }
function insRuleChanged(id){ return insLogDay(function(l){ return (l.kind||"rule")==="rule" && l.ruleId===id; }); }
function insChChanged(ch){ return insLogDay(function(l){ var k=l.kind||"rule";
  if(k==="channel") return l.ruleId===ch; if(k==="source"){ var x=srcs.find(function(y){return y.id===l.ruleId;}); return !!(x && x.channelId===ch) || String(l.ruleId).indexOf(ch+"-")===0; }
  if(k==="company") return ch==="companies"; return false; }); }
var INS_ACT_DAYS=14;
function insActWin(){ var t=today(); return {a:addDays(t,1-INS_ACT_DAYS), b:addDays(t,1)}; }
/* A rule as a card names it: its name with its id, e.g. "<rule name> (<rule id>)". */
function insRuleTag(h){ return (h.name||h.id)+" ("+h.id+")"; }
function insBoardStart(){
  var d="9999"; rawRoles.forEach(function(r){ if(r.seen && r.seen<d) d=r.seen; });
  runs.forEach(function(r){ if(r.date && r.date<d) d=r.date; }); screened.forEach(function(x){ if(x.date && x.date<d) d=x.date; });
  return d==="9999"? today() : String(d).slice(0,10);
}
function insBoardDays(){ return dayGap(insBoardStart(),today())||0; }
function insHlRaw(M,M0,since,act){
  var out=[], from=INS.from, to=INS.to, t=today(), N=(since||act)? 3 : INS_N;
  function add(o){ out.push(Object.assign({kind:"watch", group:"act", score:10, metric:"", act:"", actLab:"Show me", cohort:false, n:null, span:0, fix:false},o)); }
  /* Leaks: roles you turned down for a reason a deal-breaker should have caught. The sweep let them through, so
     the fix is how the sweep checks the rule, never loosening it. Grouped by the rules a reason belongs to. */
  if(from<=2 && to>=1){
    var lk={};
    M.rs.forEach(function(r){ if(!r._e || r._e.by!=="me" || r._k>2) return; var hs=r.endRule? insRules().filter(function(h){ return h.id===r.endRule; }) : insReasonRules(r._e.reason); if(!hs.length) return;
      if(act){ var ch0=hs.reduce(function(m,h){ var d=insRuleChanged(h.id); return d>m? d : m; },""); if(ch0 && !(r.seen>ch0)) return; }
      var k=hs.map(function(h){return h.id;}).join("+"), x=lk[k]=lk[k]||{hs:hs, n:0, ll:0, sl:0, rs:{}}; x.n++; if(r._k>=2) x.sl++; else x.ll++; x.rs[r._e.reason]=(x.rs[r._e.reason]||0)+1; });
    Object.keys(lk).forEach(function(k){ var x=lk[k]; if(x.n<N) return;
      var names=x.hs.map(insRuleTag).join(" or "), why=Object.keys(x.rs).sort(function(a,b){return x.rs[b]-x.rs[a];}).map(function(r){return r.toLowerCase();}).join(", ");
      var hard=x.hs.every(function(h){ return insFirmOf(h)!=="tunable"; });
      add({key:"leak:"+k, kind:"act", score:32+x.n, cohort:true, n:x.n, title:plural(x.n,"role")+" passed the sweep but fail "+names,
        text:"You turned them down for "+why+": "+[x.ll? x.ll+" at the longlist" : "", x.sl? x.sl+" at the shortlist" : ""].filter(Boolean).join(", ")+". "+(hard? "The sweep should have screened them out, so it isn't catching "+(x.hs.length>1? "these rules" : "this rule")+" reliably."
          : "Either the sweep isn't catching "+(x.hs.length>1? "these rules" : "this rule")+", or "+(x.hs.length>1? "they don't" : "it doesn't")+" say what you actually turn down."),
        metric:String(x.n), fix:true}); });
  }
  /* Their must-haves you don't have (4 Oct): roles turned down as "Needs something I don't have", grouped by the
     thing (`endGap`). Once one thing has cost 3 roles, the card asks whether the sweep should screen roles that
     require it out before your longlist; Suggest a change drafts that deal-breaker. Counted over every
     turn-down on the board; the card goes when a deal-breaker names the thing. */
  if(act && from<=2 && to>=1){
    var lk2={};
    rawRoles.concat(insFolded()).forEach(function(r){ if(!r.endGap) return; var e=endOf(r); if(!e || e.by!=="me") return;
      var k2=gapKey(r.endGap); (lk2[k2]=lk2[k2]||{name:r.endGap, rs:[]}).rs.push(r); });
    var ruleTxt=insRules().map(function(h){ return gapKey((h.name||"")+" "+(h.rule||"")); }).join(" | ");
    Object.keys(lk2).forEach(function(k2){ var x=lk2[k2]; if(x.rs.length<3 || ruleTxt.indexOf(k2)>=0) return;
      var who=x.rs.slice(0,4).map(function(r){ return (r.company||r.title||"a role")+((r.endNote||r.g1Note)? " (“"+clip(String(r.endNote||r.g1Note).trim(),60)+"”)" : ""); });
      add({key:"lack:"+k2, kind:"act", score:27+x.rs.length, cohort:true, n:x.rs.length, fix:true,
        title:plural(x.rs.length,"role")+" needed "+x.name+", which you don't have",
        text:"You turned down "+who.join(", ")+(x.rs.length>4? " and "+(x.rs.length-4)+" more" : "")+" because they need "+x.name+". "+
          "If you'll never have it, a deal-breaker can screen out roles that require it before they reach your longlist: Suggest a change drafts one. If you might get it, or it's only sometimes a blocker, mark this Not useful.",
        metric:String(x.rs.length)}); });
  }
  /* Channels: volume without outcome (ACT, with the main reason) and the winner (FYI). */
  if(!INS.f.ch && from<=1 && to>=2){
    var g={}; M.rs.forEach(function(r){ var k=insCh(r)||"none"; if(act && k!=="none"){ var dc=insChChanged(k); if(dc && !(r.seen>dc)) return; } var x=g[k]=g[k]||{n:0,s:0,ended:[]}; x.n++; if(r._k>=2) x.s++; else if(r._e) x.ended.push(r); });
    var tot=M.rs.length, sh=M.rs.filter(function(r){return r._k>=2;}).length, avg=tot? sh/tot : 0;
    var ks=Object.keys(g).filter(function(k){return k!=="none";});
    ks.forEach(function(k){ var x=g[k], share=x.n/(tot||1);
      if(x.n>=8 && share>=0.2 && x.s/x.n < avg*0.5){
        var tr=insTopReason(x.ended), hs=tr? insReasonRules(tr.lab) : [], fixed=hs.some(function(h){return insFirmOf(h)==="fixed";});
        add({key:"chlow:"+k, kind:"act", score:share*80+20, cohort:true, title:insDimLab("ch",k)+": lots in, little through",
          text:Math.round(share*100)+"% of roles found ("+x.n+"), but only "+x.s+" made the shortlist ("+insPct(x.s,x.n)+"% against "+Math.round(avg*100)+"% overall)."+
            (tr? " Mostly "+tr.lab.toLowerCase()+" ("+tr.n+")"+(fixed? ", which your "+hs.filter(function(h){return insFirmOf(h)==="fixed";}).map(insRuleTag).join(" and ")+" deal-breaker will never allow." : ".") : ""),
          metric:x.s+"/"+x.n, n:x.n-x.s, fix:true}); } });
    var win=ks.filter(function(k){ return g[k].n>=N && g[k].s/g[k].n >= Math.max(avg*1.5, 0.15); }).sort(function(a,b){ return g[b].s/g[b].n - g[a].s/g[a].n; })[0];
    if(win) add({key:"chbest:"+win, kind:"good", group:"fyi", score:25, cohort:true, title:insDimLab("ch",win)+" is your best channel",
      text:g[win].s+" of "+g[win].n+" reached the shortlist ("+insPct(g[win].s,g[win].n)+"% against "+Math.round(avg*100)+"% overall). Worth more of its sources.",
      metric:insPct(g[win].s,g[win].n)+"%", act:"f:ch:"+win, actLab:"Filter to it"});
  }
  /* The sweep's rules. A fixed or firm rule is never "the rule to look at": if one channel brings most of what it
     cuts, that channel is the lever (ACT); otherwise it's FYI. "This rule may screen out roles you want" is no
     longer a card (5 Oct): the weekly screen-out check (27) suggests that change inside its own pop-up, and the
     rule's "May be too strict" tag on My criteria keeps it. */
  if(from===0 && M.scr.length>=((since||act)? 5 : 10)){
    var rc={}; M.scr.forEach(function(x){ rc[x.rule]=(rc[x.rule]||0)+1; });
    var trl=Object.keys(rc).sort(function(a,b){return rc[b]-rc[a];})[0];
    if(trl && rc[trl]/M.scr.length>=0.35){
      var fm=insRuleFirm(trl), lab=insRuleLab(trl)+" ("+trl+")", pc=insPct(rc[trl],M.scr.length)+"%";
      var bc={}; M.scr.forEach(function(x){ if(x.rule===trl && x.ch) bc[x.ch]=(bc[x.ch]||0)+1; });
      var tch=Object.keys(bc).sort(function(a,b){return bc[b]-bc[a];})[0], chShare=tch? bc[tch]/rc[trl] : 0;
      if(fm!=="tunable" && tch && chShare>=0.5 && rc[trl]>=10)
        add({key:"scrsrc:"+trl+":"+tch, kind:"act", score:22, cohort:true, title:"The sweep screened out "+bc[tch]+" for "+lab+(chShare>=0.995? ", all" : ", mostly")+" from "+insLc(insDimLab("ch",tch)),
          text:bc[tch]+" of the "+rc[trl]+" roles it screened out for "+lab+" came from "+insLc(insDimLab("ch",tch))+" ("+Math.round(chShare*100)+"%). You never saw them."+(function(){
              var cc={}; M.scr.forEach(function(s2){ if(s2.rule===trl && s2.ch===tch && s2.company) cc[s2.company]=(cc[s2.company]||0)+1; });
              var top=Object.keys(cc).sort(function(a2,b2){return cc[b2]-cc[a2];}).slice(0,3);
              return (top.length? " Mostly "+top.map(function(k2){return k2+" ("+cc[k2]+")";}).join(", ")+"." : "")+
                " The rule is right; those searches are finding roles you can't take."; })(),
          metric:Math.round(chShare*100)+"%", n:bc[tch], fix:true});
      else
        add({key:"scr:"+trl, group:"fyi", score:18, cohort:true, n:rc[trl], title:"The "+lab+" rule screens out the most",
          text:rc[trl]+" of the "+M.scr.length+" roles the sweep screened out ("+pc+"). "+(fm==="fixed"? "It's a fixed rule, so this is for information." : fm==="firm"? "It's a firm rule; the weekly screen-out check tells you if it screens out roles you want." : "The weekly screen-out check samples its screen-outs for you to confirm."),
          metric:pc, act:"", actLab:""});
    }
  }
  if(!since){
    /* Sites you check by hand that found nothing in four weeks. Only a source the board has known for 28 days or
       more, that you logged checking at least twice in that time, counts: a quiet site you never checked isn't
       evidence, and a board younger than four weeks can't say "four weeks". */
    if(from<=1 && insBoardDays()>=28){
      var c28=addDays(t,-28), bs=insBoardStart(), dead=[];
      channels.filter(function(ch){ return ch.kind==="manual"; }).forEach(function(ch){
        chItems(ch).forEach(function(x){ if(x.status==="dropped"||x.status==="paused") return;
          if((x.addedAt||bs)>c28) return;
          var lo=String(x.name||"").toLowerCase(), checks=runs.filter(function(r){ return r.type==="manual" && r.date && r.date>=c28 && String(r.channels||"").split(",").some(function(c){return c.trim().toLowerCase()===lo;}); }).length;
          var found=rawRoles.some(function(r){ return r.sourceId===x.id && r.seen && r.seen>=c28; });
          if(!found && checks>=2) dead.push({name:x.name||x.id, n:checks}); }); });
      if(dead.length) add({key:"manquiet", kind:"act", score:14+dead.length, n:dead.length, span:28, fix:true, title:plural(dead.length,"site")+" you check found nothing in 4 weeks",
        text:dead.slice(0,4).map(function(d){ return d.name+" (checked "+d.n+"×)"; }).join(", ")+(dead.length>4? " and "+(dead.length-4)+" more" : "")+".",
        metric:String(dead.length)});
    }
    /* New (3 Oct): live applications with a weak Their fit (Role Fit band Stretch or Low). */
    if(to>=4){
      var lv=roles.filter(function(r){ return r.stage==="applied"||r.stage==="offer"; }), low=lv.filter(function(r){ var f=insFit(r); return f==="Stretch"||f==="Low"; });
      if(lv.length>=3 && low.length>=2 && low.length/lv.length>=0.5)
        add({key:"lowfit", score:19, n:low.length, title:plural(low.length,"live application")+" with a weak Role Fit",
          text:low.length+" of "+lv.length+" live applications are Stretch or Low on Role Fit (your CV against the ad). Prep the gaps before interviews, and weigh it when choosing what to send next.",
          metric:low.length+"/"+lv.length, act:"f:fit:"+(low.some(function(r){return insFit(r)==="Low";})? "Low" : "Stretch"), actLab:"Filter to them"});
    }
  }
  var have=insBoardDays();
  return out.filter(function(h){ return !h.span || have>=h.span; });
}
/* ---------- The weekly top 6 (5 Oct) ----------
   Highlights are patterns, never a chore about one role (those live in Waiting on you), and never a breakage (Data
   health). Every candidate card is worked out on fixed windows, whatever the period buttons say: Act-style cards on
   the last INS_ACT_DAYS days of finds, FYI on the last 30 days, and the extra pattern cards (28) on their own spans.
   Each card has an area; the week shows at most one per area, outcomes first, so at most five, plus the weekly
   screen-out check (27) when it waits: six at most. The set is chosen the first time the board is opened in a week
   (Monday-based) and kept in `hlweek/<monday>`; a card you handle, or that stops qualifying, drops off and is not
   replaced until next Monday. Cards that don't make the set are shown nowhere (Search review still reads them all). */
var INS_AREAS=["outcomes","supply","decisions","filter","foundations"];
function insArea(key){
  key=String(key||"");
  if(/^(band|bandhi|stretch|lowfit|ivrate|ivrate-fyi|ivloss|theyno)\b/.test(key)) return "outcomes";
  if(/^(floor|toomany|chlow|chbest|manquiet|staleterms|staletargets|srcnofit)\b/.test(key)) return "supply";
  if(/^(speed|closingmiss)\b/.test(key)) return "decisions";
  if(/^(leak|scrsrc|scr)\b/.test(key)) return "filter";
  if(/^(lack)\b/.test(key)) return "foundations";
  return "supply";
}
/* What the card asks of you: change the setup (Claude can draft it), change what you do, or just know it. */
function insHlType(h){ return h.group==="fyi"? "fyi" : h.fix? "setup" : "you"; }
function insWeekStart(t){ t=t||today(); var d=new Date(t+"T12:00:00Z").getUTCDay(); return addDays(t,-((d+6)%7)); }
var HLW={docs:{}, ready:false, writing:false}, HLS_READY=false, INS_T0=Date.now();
/* Every candidate, with Handled / Not useful / Monitor applied. */
function insHlAll(){
  var t=today(), keep=[]; INS_HLMONC={};
  var aw=insActWin(); INS._act=true; var Ma; try{ Ma=insModel(aw); } finally { INS._act=false; }
  var F=insClean("30",function(){ return {M:insModel(insWin()), M0:insModel(insWin(true)), w:insWin()}; });
  var raw=insHlRaw(Ma,null,false,true).filter(function(h){return h.group==="act";})
    .concat(insHlRaw(F.M,F.M0).filter(function(h){return h.group==="fyi";}))
    .concat(typeof insHlExtra==="function"? insHlExtra() : []);
  raw.forEach(function(h){
    h.per="30"; h.area=insArea(h.key); h.type=insHlType(h);
    var s=insHlState(h.key);
    if(!s) return keep.push(h);
    if(s.state==="dismissed"){ if(s.until && s.until>t) return; return keep.push(h); }
    if(s.state==="monitor"){ var cur=h.n; INS_HLMONC[h.key]=Object.assign({},h,{nowN:cur}); if(cur!=null && hlMonGrown(s.n,cur)){ h.monitor={at:s.at, from:s.n, to:cur}; keep.push(h); } return; }
    if(h.cohort){
      var isAct=h.group==="act", ww=isAct? aw : F.w;
      var since={a:(ww.a && ww.a>s.at)? ww.a : s.at, b:ww.b||"9999-12-31"}, M2;
      if(isAct){ INS._act=true; try{ M2=insModel(since); } finally { INS._act=false; } } else M2=insClean("30",function(){ return insModel(since); });
      var h2=insHlRaw(M2,null,true,isAct).find(function(x){return x.key===h.key;});
      if(h2){ h2.handled=s; h2.per="30"; h2.area=h.area; h2.type=insHlType(h2); keep.push(h2); }
    } else if((h.n||0)>(s.n||0)){ h.handled=s; keep.push(h); }
  });
  /* Problems before good news, then by score; at most three leak cards so one rule can't flood the evidence. */
  var nLeak=0;
  return keep.sort(function(a,b){ return INS_AREAS.indexOf(a.area)-INS_AREAS.indexOf(b.area) || (a.kind==="good")-(b.kind==="good") || b.score-a.score; })
    .filter(function(h){ if(String(h.key).indexOf("leak:")!==0) return true; return ++nLeak<=3; });
}
/* One per area, in area order. */
function insHlPick(all){
  var seen={}, out=[];
  all.forEach(function(h){ if(seen[h.area]) return; seen[h.area]=1; out.push(h); });
  return out.slice(0,5);
}
/* The data is in once roles, highlight marks and the week's record have all arrived. */
function insHlReady(){ return HLS_READY && HLW.ready && rawRoles.length>0 && Date.now()-INS_T0>3500; }
function insHighlights(){
  var all=insHlAll(), map={}; all.forEach(function(h){ map[h.key]=h; });
  var wk=insWeekStart(), doc=HLW.docs[wk], H;
  if(doc && Array.isArray(doc.keys)) H=doc.keys.map(function(k){ return map[k]; }).filter(Boolean);
  else {
    H=insHlPick(all);
    if(insHlReady() && !HLW.writing && DB){
      HLW.writing=true;
      DB.doc("hlweek/"+wk).get().then(function(d){
        if(d && d.exists) return;
        return DB.doc("hlweek/"+wk).set({week:wk, keys:H.map(function(h){return h.key;}), titles:H.map(function(h){return h.title;}), at:new Date().toISOString()});
      }).catch(function(e){ console.warn("hlweek",e&&e.code); }).then(function(){ HLW.writing=false; });
    }
  }
  INS_HLMAP={}; H.forEach(function(h){ if(h.key) INS_HLMAP[h.key]=h; });
  return H;
}
var INS_HLMAP={}, INS_HLMONC={};   /* INS_HLMONC: monitored cards as they are now, hidden or not, for the Monitoring list */
/* Monitor (3 Oct): the card hides and comes back when its number grows by 5, or by a quarter when that's less
   (at least 1). Cards no longer follow the period (5 Oct), so the number is the card's own. */
function hlMonGrown(a,b){ a=+a||0; return b-a >= Math.max(1, Math.min(5, Math.ceil(a*0.25))); }
function insRuleLab(id){ return String(ruleName(id)||id).replace(/^[A-Z](?=[a-z])/,function(c){return c.toLowerCase();}); }
function insTopReason(list){
  var c={}, by={}; list.forEach(function(r){ var e=r._e||insEnd(r); if(!e) return; c[e.reason]=(c[e.reason]||0)+1; by[e.reason]=by[e.reason]||{}; by[e.reason][e.by]=(by[e.reason][e.by]||0)+1; });
  var k=Object.keys(c).sort(function(a,b){return c[b]-c[a];})[0];
  if(!k) return null; var w=Object.keys(by[k]).sort(function(a,b){return by[k][b]-by[k][a];})[0];
  return {lab:k, n:c[k], by:w};
}

/* ---------- shared chart: where roles end (also on the Closed page) ---------- */
function endWhereBars(items,opts){
  opts=opts||{}; var max=Math.max.apply(null,items.map(insExTot).concat([1]));
  return '<div class="ewb">'+items.map(function(x){ var t=insExTot(x);
    return '<div class="ewr'+(t? "" : " z")+'"'+(x.act? ' data-ins="'+esc(x.act)+'" role="button" tabindex="0"' : "")+'><span class="ewl">'+esc(x.label)+'</span>'+
      '<div class="ewt">'+["rules","me","them","neither"].map(function(k){ return x[k]? '<i class="ew-'+k+'" style="width:'+(x[k]/max*100)+'%" title="'+esc(INS_WHO[k])+': '+x[k]+'"></i>' : ""; }).join("")+'</div>'+
      '<span class="ewn">'+t+'</span></div>'; }).join("")+'</div>'+
    (opts.legend===false? "" : '<div class="ewk">'+["me","them","neither","rules"].filter(function(k){ return opts.rules!==false || k!=="rules"; }).map(function(k){ return '<span><i class="ew-'+k+'"></i>'+INS_WHO[k]+'</span>'; }).join("")+'</div>');
}

/* ---------- pieces of the page ---------- */
function insSel(key,lab,opts,cur,tip){
  return '<label class="isel'+(cur?" on":"")+'"'+(tip? ' title="'+esc(tip)+'"' : "")+'><span>'+esc(lab)+'</span><select data-insel="'+key+'"><option value="">All</option>'+
    opts.map(function(o){ return o[2]? '<optgroup label="'+esc(o[1])+'">'+o[2].map(function(p){ return '<option value="'+esc(p[0])+'"'+(cur===p[0]?" selected":"")+'>'+esc(p[1])+'</option>'; }).join("")+'</optgroup>'
      : '<option value="'+esc(o[0])+'"'+(cur===o[0]?" selected":"")+'>'+esc(o[1])+'</option>'; }).join("")+'</select></label>';
}
function insChOpts(){
  return chSorted().map(function(ch){
    var used={}; roles.forEach(function(r){ if(insCh(r)===ch.id && r.sourceId) used[r.sourceId]=1; });
    var srcs=Object.keys(used).map(function(s){ return ["src:"+s, insDimLab("src",s)]; }).sort(function(a,b){return a[1].localeCompare(b[1]);});
    return [null, ch.name, [["ch:"+ch.id, "All of "+ch.name]].concat(srcs)];
  });
}
function insBar(){
  var f=INS.f, chips=[];
  if(f.ch) chips.push(["ch",insDimLab("ch",f.ch)+(f.src? " › "+insDimLab("src",f.src) : "")]);
  ["out","me","fit","quad","sec","lvl","who","why","end"].forEach(function(k){ if(f[k]) chips.push([k, (INS_DIMS.find(function(d){return d[0]===k;})||[])[1]+": "+insDimLab(k,f[k])]); });
  var nMore=["sec","lvl","who","why","end"].filter(function(k){return f[k];}).length;
  var per=[["7","7 days"],["30","30 days"],["90","90 days"],["all","All"]];
  return '<div class="insbar"><div class="ibr">'+
      '<div class="seg iseg">'+per.map(function(p){ return '<button type="button" class="'+(INS.period===p[0]?"on":"")+'" data-ins="period:'+p[0]+'" aria-pressed="'+(INS.period===p[0])+'">'+p[1]+'</button>'; }).join("")+'</div>'+
      (INS.period!=="all"? '<label class="icmp"><input type="checkbox" data-insel="cmp"'+(INS.cmp?" checked":"")+'> Compare to previous</label>' : "")+
      insSel("chsrc","Channel",insChOpts(), f.src? "src:"+f.src : f.ch? "ch:"+f.ch : "")+
      insSel("me","My fit",insOpts("me"),f.me,INS_ME_TIP)+insSel("fit","Their fit",insOpts("fit"),f.fit,INS_THEM_TIP)+insSel("quad","Fun & Shot",insOpts("quad"),f.quad)+
      insSel("out","Outcome",INS_OUT_F,f.out,"Live roles, or how a role ended. Re-scopes the whole page: funnel, why roles end, breakdown, trends, pace and Fun × Shot")+
      '<button type="button" class="btn sm imore'+(INS.more||nMore?" on":"")+'" data-ins="more" aria-expanded="'+INS.more+'">More filters'+(nMore? " · "+nMore : "")+'</button>'+
      '<button type="button" class="btn sm ireset" data-ins="reset"'+(insIsDefault()? " disabled" : "")+' title="Period, compare, filters, scope and breakdown back to the defaults">Reset</button>'+
    '</div>'+
    (INS.more? '<div class="ibr imorer">'+insSel("sec","Sector",insOpts("sec"),f.sec)+insSel("lvl","Level",insOpts("lvl"),f.lvl)+insSel("who","Added by",insOpts("who"),f.who)+insSel("why","Reason",insOpts("why"),f.why)+insSel("end","Ended at",insOpts("end"),f.end)+'</div>' : "")+
    '<div class="ibr iscope"><span class="isl">Scope</span>'+INS_PRESETS.map(function(p){ var on=INS.from===p[1] && INS.to===p[2];
        return '<button type="button" class="ipill'+(on?" on":"")+'" data-ins="range:'+p[1]+':'+p[2]+'">'+p[0]+'</button>'; }).join("")+
      '<span class="isep"></span>'+
      '<label class="isel"><span>From</span><select data-insel="from">'+IST.map(function(s,i){ return '<option value="'+i+'"'+(INS.from===i?" selected":"")+'>'+s+'</option>'; }).join("")+'</select></label>'+
      '<label class="isel"><span>To</span><select data-insel="to">'+IST.map(function(s,i){ return '<option value="'+i+'"'+(INS.to===i?" selected":"")+(i<INS.from?" disabled":"")+'>'+s+'</option>'; }).join("")+'</select></label>'+
      (chips.length? '<span class="ichips">'+chips.map(function(c){ return '<button type="button" class="ichip" data-ins="clr:'+c[0]+'" title="Remove this filter">'+esc(c[1])+' <b>×</b></button>'; }).join("")+
        '<button type="button" class="linkbtn" data-ins="clrall">Clear all</button></span>' : "")+
    '</div></div>';
}
/* One card, shared by Insights and Overview (attr = the Overview card's open-in-Insights attributes). */
var INS_TYPE_LAB={setup:"Fix the setup", you:"Your move", fyi:"FYI"};
function insHlLab(h){ var ty=h.type||insHlType(h); return ty==="fyi"? (h.kind==="good"? "Good news" : "FYI") : INS_TYPE_LAB[ty]; }
function insHlCard(h,go,attr){
  var hs=h.handled;
  return '<div class="ihc k-'+h.kind+(h.group==="fyi"? " fyi" : "")+'"'+(attr? attr(h) : "")+'><div class="ihtop"><span class="iht">'+esc(insHlLab(h))+'</span><b class="ihm">'+esc(h.metric)+'</b></div>'+
    '<div class="ihtt">'+esc(h.title)+'</div><p>'+esc(h.text)+'</p>'+
    (hs? '<p class="ihback" title="Worked out from roles found since you marked it handled">Marked handled '+esc(niceShort(hs.at))+(hs.note? ': “'+esc(hs.note)+'”' : "")+'. Back since then.</p>' : "")+
    (h.monitor? '<p class="ihback" title="It came back because the number grew">Monitoring since '+esc(niceShort(h.monitor.at))+': '+esc(String(h.monitor.from))+' → '+esc(String(h.monitor.to))+'.</p>' : "")+
    '<div class="ihfoot">'+(h.act? '<button type="button" class="linkbtn ihgo" '+go+'="'+esc(h.act)+'">'+esc(h.actLab)+' →</button>' : "")+
      (h.fix && typeof hsOpen==="function"? '<button type="button" class="linkbtn ihfix" data-hl="fix:'+esc(h.key)+'" title="Claude drafts one change for you to accept, edit or reject">Suggest a change</button>' : "")+
      (h.key && h.key!=="none"? '<span class="ihx"><button type="button" class="linkbtn" data-hl="menu:'+esc(h.key)+'" aria-haspopup="true" aria-expanded="false">Mark as…</button>'+
        '<span class="ihmenu" hidden role="menu"><button type="button" role="menuitem" data-hl="done:'+esc(h.key)+'"><b>Handled</b><small>You\'ve dealt with it. Back only if it happens again.</small></button>'+
        (h.n!=null? '<button type="button" role="menuitem" data-hl="mon:'+esc(h.key)+'"><b>Monitor</b><small>Hide it; back if the number grows.</small></button>' : "")+
        '<button type="button" role="menuitem" data-hl="no:'+esc(h.key)+'"><b>Not useful</b><small>Hide it for 30 days.</small></button></span></span>' : "")+'</div></div>';
}
var INS_HLMON=false;
function insHlGroups(H,go,attr){
  /* One row of up to six cards (5 Oct): the Act / FYI toggle is gone; each card says what it asks of you. */
  var mon=HLS.filter(function(x){return x.state==="monitor";});
  var wk=insWeekStart(), set=!!HLW.docs[wk];
  var note='<span class="ihnote">'+(H.length? "This week's "+(H.length===1? "one thing" : H.length+" things")+" to look at"+(set? ", set "+esc(niceShort(wk)) : "")+". One per area; handled ones aren't replaced until next Monday." : "")+'</span>';
  var tog='<div class="ihtogr">'+note+(mon.length? '<button type="button" class="linkbtn ihmonl" data-hlmon="1" aria-expanded="'+INS_HLMON+'" title="Cards you chose to monitor">Monitoring '+mon.length+(INS_HLMON? " ▴" : " ▾")+'</button>' : "")+'</div>';
  /* Each monitored item: its card as it is now, and three choices (3 Oct): Suggest a change, leave it (do
     nothing), or Happy with it — which turns it into Handled, so it comes back only if the pattern recurs. */
  var monList= INS_HLMON && mon.length? '<div class="ihmon"><p class="ihmonh">Hidden while you watch them. Each comes back if its number grows. Leave one here to keep watching.</p><ul>'+mon.map(function(x){
      var c=INS_HLMONC[x.key], now=c? c.nowN : null;
      return '<li><span><b>'+esc((c&&c.title)||x.title||x.key)+'</b><small>Since '+esc(niceShort(x.at))+(x.n!=null? ' · marked at '+esc(String(x.n))+(now!=null? ', now '+esc(String(now)) : c? "" : ', not showing now') : "")+(x.note? ' · '+esc(x.note) : "")+'</small></span>'+
        '<span class="ihmonb">'+(c && c.fix && typeof hsOpen==="function"? '<button type="button" class="linkbtn" data-hl="fixm:'+esc(x.key)+'" title="Claude drafts one change for you to accept, edit or reject">Suggest a change</button>' : "")+
        '<button type="button" class="linkbtn" data-hl="okm:'+esc(x.id)+'" title="Stop watching it. It comes back only if it happens again in roles found from now on">Happy with it</button></span></li>'; }).join("")+'</ul></div>' : "";
  return tog+monList+(H.length? '<div class="ihg">'+H.map(function(h){ return insHlCard(h,go,attr); }).join("")+'</div>' : '<p class="ihnone">Nothing to look at this week. Get on with the roles.</p>');
}
document.addEventListener("click",function(ev){
  var m=ev.target.closest && ev.target.closest("[data-hlmon]");
  if(m){ ev.preventDefault(); ev.stopPropagation(); INS_HLMON=!INS_HLMON; hlRedraw(); return; }
},true);
function insHlHtml(H){
  return '<section class="inshl"><div class="ish"><h3>Highlights</h3><span class="ovsub">This week · not affected by the period or filters</span>'+
      '</div>'+insHlGroups(H,"data-ins")+'</section>';
}
function insFunnelHtml(M,M0){
  var from=INS.from, to=INS.to, base=M.c[from]||0, max=Math.max(base,1);
  var rows="";
  for(var i=from;i<=to;i++){
    var v=M.c[i], prev=i>from? M.c[i-1] : null, x=M.ex[i], et=insExTot(x), live = i<6? Math.max(0, v-(M.c[i+1]||0)-et) : v-et;
    var w=v? Math.max(3, v/max*100) : 0;
    var dl= (M0 && INS.cmp)? (function(){ var d=v-M0.c[i]; return d? '<em class="'+(d>0?"up":"dn")+'">'+(d>0?"▲ ":"▼ ")+Math.abs(d)+' on before</em>' : '<em class="eq">same as before</em>'; })() : "";
    rows+='<div class="ifr s'+i+(INS.from===i && INS.to===i?" on":"")+'" data-ins="scope:'+i+'" role="button" tabindex="0" title="Zoom into '+IST[i]+'">'+
      '<span class="ifl">'+IST[i]+(i===0? '<small>incl. screened out</small>' : live>0 && i<6? '<small>'+live+' here now</small>' : "")+'</span>'+
      '<div class="ifb"><i style="width:'+w+'%"><b>'+v+'</b></i></div>'+
      '<span class="ifc">'+(i===from? '<span class="ipp">100%</span><small>base</small>' : insPctHtml(v,prev)+'<small>'+insPctHtml(v,base)+' of '+IST[from]+'</small>')+dl+'</span>'+
      '<div class="ife">'+(et? '<div class="ifeb">'+["rules","me","them","neither"].map(function(k){ return x[k]? '<i class="ew-'+k+'" style="flex:'+x[k]+'" title="'+esc(INS_WHO[k])+': '+x[k]+'"></i>' : ""; }).join("")+'</div><span>'+et+' closed</span>' : '<span class="ipz">none closed</span>')+'</div>'+
    '</div>';
    /* Only roles that closed count as a drop; roles still at the stage are in progress, not lost (3 Oct). */
    if(i<to){ rows+='<div class="ifd"><span>'+(v? (et? '<b>▼ '+insPct(et,v)+'% closed · '+et+'</b>' : "") + (live? '<em>'+(et?" · ":"")+live+' in progress</em>' : "") + (!et && !live? "all moved on" : "") : "")+'</span></div>'; }
  }
  var noPrev = INS.cmp && !M0 && INS.period!=="all";
  return '<section class="ovc insfun"><div class="ovh"><h3>Funnel</h3><span class="ovsub">'+plural(base,"role")+' in '+IST[from]+(INS.period==="all"? "" : " · found in the last "+INS.period+" days")+(noPrev? " · nothing in the period before to compare with" : "")+' · click a stage to zoom in</span></div>'+
    '<div class="ifh"><span>Stage</span><span>Reached</span><span>Step · overall</span><span>Closed here</span></div>'+
    '<div class="ifun">'+rows+'</div>'+
    '<div class="ewk"><span><i class="ew-me"></i>'+INS_WHO.me+'</span><span><i class="ew-them"></i>'+INS_WHO.them+'</span><span><i class="ew-neither"></i>'+INS_WHO.neither+'</span>'+(from===0? '<span><i class="ew-rules"></i>'+INS_WHO.rules+'</span>' : "")+'</div>'+
    (insOtherFilters() && from===0? '<p class="inote">Screened-out roles only filter by channel, so they are left out of Found while other filters are on.</p>' : "")+'</section>';
}
function insEndHtml(M){
  var from=INS.from, to=INS.to, items=[];
  for(var i=from;i<=to;i++){ var x=M.ex[i]; items.push({label:"At "+IST[i], me:x.me, them:x.them, neither:x.neither, rules:x.rules, act:"scope:"+i}); }
  var ended=M.rs.filter(function(r){ return r._e && r._k>=from && r._k<=to; });
  var who={me:0,them:0,neither:0}; ended.forEach(function(r){ who[r._e.by]=(who[r._e.by]||0)+1; });
  var rc={}; ended.forEach(function(r){ var k=r._e.by+"|"+r._e.reason; rc[k]=(rc[k]||0)+1; });
  if(from===0) M.scr.forEach(function(s){ var k="rules|"+insRuleLab(s.rule).replace(/^./,function(c){return c.toUpperCase();}); rc[k]=(rc[k]||0)+1; });
  var rs=Object.keys(rc).map(function(k){ var p=k.split("|"); return {w:p[0], r:p[1], n:rc[k]}; }).sort(function(a,b){return b.n-a.n;}).slice(0,6);
  var rmax=Math.max.apply(null,rs.map(function(x){return x.n;}).concat([1]));
  var tot=insExTotAll(M,from,to);
  var mix=themMixLine(ended.filter(function(r){return r._e.by==="them";}).map(function(r){ var c=(r.folded&&!r.full)? {f:r.fun,s:r.shot} : curScores(r); return {how:"them", f:c.f, s:c.s}; }));
  return '<section class="ovc insend"><div class="ovh"><h3>Why roles end</h3><span class="ovsub">'+plural(tot,"role")+' closed in this scope</span><button type="button" class="linkbtn ovmore" data-ins="endbd" title="Show only closed roles and break them down by reason and who ended them">Break these down ↓</button><a href="#" class="ovmore" data-gotab="rejected">Closed list →</a></div>'+
    '<div class="iwho">'+["me","them","neither"].map(function(k){ return '<div class="iwc w-'+k+'"><b>'+(who[k]||0)+'</b><span>'+INS_WHO[k]+'</span></div>'; }).join("")+
      (from===0? '<div class="iwc w-rules"><b>'+M.scr.length+'</b><span>'+INS_WHO.rules+'</span></div>' : "")+'</div>'+
    '<div class="ish2">Where they end</div>'+endWhereBars(items,{legend:false})+
    '<div class="ish2">Top reasons</div>'+
    (rs.length? '<ul class="irs">'+rs.map(function(x){ return '<li><span class="irw w-'+x.w+'">'+INS_WHO[x.w]+'</span><span class="irl">'+esc(x.r)+'</span><span class="irb"><i style="width:'+(x.n/rmax*100)+'%"></i></span><b>'+x.n+'</b></li>'; }).join("")+'</ul>'
      : '<p class="inote">Nothing has closed in this scope.</p>')+
    (mix? mix.replace('class="clmix','class="clmix imix') : "")+'</section>';
}
function insExTotAll(M,from,to){ var n=0; for(var i=from;i<=to;i++) n+=insExTot(M.ex[i]); return n; }

/* Breakdown: one row per value of the chosen dimension; channels open to their sources. */
function insGroup(list,scr,k){
  var g={}; function row(v){ return g[v]=g[v]||{v:v, c:[0,0,0,0,0,0,0], rs:[]}; }
  list.forEach(function(r){ var x=row(insDimOf(r,k)); x.rs.push(r); for(var j=1;j<=r._k;j++) x.c[j]++; x.c[0]++; });
  if(k==="ch") scr.forEach(function(s){ row(s.ch||"none").c[0]++; });
  /* Graded dimensions keep their own order, best first, with the unscored row last (3 Oct). */
  var ord=insOpts(k).map(function(o){return o[0];}), graded=insGraded(k);
  return Object.keys(g).map(function(v){return g[v];}).sort(function(a,b){
    if(graded){ var ia=ord.indexOf(a.v), ib=ord.indexOf(b.v); return (ia<0?99:ia)-(ib<0?99:ib); }
    return b.c[INS.from]-a.c[INS.from] || b.c[0]-a.c[0]; });
}
function insSpark(rs){
  var w0=weekStart(today()), wk=[]; for(var i=7;i>=0;i--) wk.push(addDays(w0,-7*i));
  var v=wk.map(function(w){ var e=addDays(w,7); return rs.filter(function(r){ return r.seen && r.seen>=w && r.seen<e; }).length; });
  var mx=Math.max.apply(null,v.concat([1]));
  return '<span class="ispk" title="Found per week, last 8 weeks">'+v.map(function(n){ return '<i style="height:'+(n? Math.max(12,n/mx*100) : 4)+'%"'+(n?"":' class="z"')+'></i>'; }).join("")+'</span>';
}
function insBreakdownHtml(M){
  if(INS.col && INS.col!=="stages" && INS.col!==INS.dim) return insCrossHtml(M);
  var from=INS.from, to=INS.to, k=INS.dim, cols=[]; for(var i=from;i<=to;i++) cols.push(i);
  var groups=insGroup(M.rs,M.scr,k), colMax=cols.map(function(i){ return Math.max.apply(null,groups.map(function(g){return g.c[i];}).concat([1])); });
  /* % of the previous step (default) or of the first stage in scope (3 Oct). */
  function cells(c){ return cols.map(function(i,j){ var v=c[i], prev=j? (INS.pof==="first"? c[cols[0]] : c[cols[j-1]]) : null;
    return '<td class="num ibc"><span class="ibh" style="width:'+(v/colMax[j]*100)+'%"></span><b>'+v+'</b>'+(j? '<small>'+insPctHtml(v,prev)+'</small>' : "")+'</td>'; }).join(""); }
  function e2e(c){ return '<td class="num">'+insPctHtml(c[to],c[from])+'</td>'; }
  var body=groups.map(function(g){
    var canOpen=k==="ch" && g.v!=="none", open=canOpen && INS.open[g.v];
    var kids="";
    if(open){ kids=insGroup(g.rs,[], "src").map(function(s){
        return '<tr class="ibkid" data-ins="f:src:'+esc(g.v)+':'+esc(s.v)+'" title="Filter to this source"><td><span class="ibn">'+esc(insDimLab("src",s.v))+'</span></td>'+cells(s.c)+e2e(s.c)+'<td>'+insSpark(s.rs)+'</td></tr>'; }).join(""); }
    return '<tr class="ibrow" data-ins="f:'+k+':'+esc(g.v)+'" title="Filter to this">'+
      '<td>'+(canOpen? '<button type="button" class="ibx" data-ins="open:'+esc(g.v)+'" aria-expanded="'+!!open+'" title="Show its sources">'+(open?"▾":"▸")+'</button>' : '<span class="ibx0"></span>')+'<span class="ibn">'+esc(insDimLab(k,g.v))+'</span></td>'+
      cells(g.c)+e2e(g.c)+'<td>'+insSpark(g.rs)+'</td></tr>'+kids;
  }).join("");
  return '<section class="ovc insbd"><div class="ovh"><h3>Breakdown</h3><span class="ovsub">Click a row to filter'+(k==="ch"? "; open a channel to see its sources" : "")+'</span></div>'+insBdCtl(false)+
    '<div class="tablewrap"><table class="ibt ibf"><colgroup><col class="ixk">'+cols.map(function(){return '<col>';}).join("")+'<col class="ibe"><col class="ibs"></colgroup><thead><tr><th>'+esc((INS_DIMS.find(function(d){return d[0]===k;})||[])[1])+'</th>'+
      cols.map(function(i){ return '<th class="num">'+IST[i]+'</th>'; }).join("")+'<th class="num" title="'+IST[to]+' as a share of '+IST[from]+'">End to end</th><th>Last 8 weeks</th></tr></thead><tbody>'+
    (body || '<tr><td colspan="'+(cols.length+3)+'">Nothing in this view.</td></tr>')+'</tbody></table></div></section>';
}

/* ---------- Breakdown as a cross-tab (3 Oct) ----------
   Columns can be the funnel (default) or a second dimension. A cross-tab shows counts, shaded where most roles
   are, filtered by Status (INS.cst: all, live, ended, or ended by you / them / went away). Large dimensions keep
   their top values and group the rest as Other. Click a cell to filter to both. */
/* Status filter for the count views (3 Oct): which roles a cross-tab or Fun × Shot counts. */
var INS_STATUS=[["all","All"],["live","Live"],["ended","Ended"],["me","You turned down"],["them","They said no"],["neither","Went away"]];
function insStatusPass(r,st){ var live=!!INS_QST[r.stage]; if(st==="all") return true; if(st==="live") return live; if(live) return false;
  if(st==="ended") return true; return !!(r._e && r._e.by===st); }
function insStatusSel(key,cur){ return '<label class="isel'+(cur!=="all"?" on":"")+'"><span>Status</span><select data-insel="'+key+'">'+INS_STATUS.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===cur?" selected":"")+'>'+esc(x[1])+'</option>'; }).join("")+'</select></label>'; }
function insStatusLab(st){ return (INS_STATUS.find(function(x){return x[0]===st;})||INS_STATUS[0])[1]; }
/* One control line above the table (3 Oct): Rows × Columns as labelled dropdowns, then % of (funnel)
   or Show (cross-tab), and Live | All on the right for a cross-tab. */
function insBdCtl(cross,CM,live){
  var col=INS.col||"stages";
  function opt(v,l,cur,dis){ return '<option value="'+esc(v)+'"'+(v===cur?" selected":"")+(dis?" disabled":"")+'>'+esc(l)+(dis?" (rows)":"")+'</option>'; }
  var rows='<label class="isel on"><span>Rows</span><select data-insel="dim">'+INS_DIMS.map(function(d){ return opt(d[0],d[1],INS.dim,false); }).join("")+'</select></label>';
  var cols='<label class="isel on"><span>Columns</span><select data-insel="col">'+[["stages","Funnel stages"]].concat(INS_DIMS).map(function(d){ return opt(d[0],d[1],col,d[0]===INS.dim); }).join("")+'</select></label>';
  var mid= cross? '<span class="isl">Show</span><div class="seg iseg">'+INS_CPCT.map(function(x){ var on=(INS.cpct||"n")===x[0]; return '<button type="button" class="'+(on?"on":"")+'" data-ins="cpct:'+x[0]+'" aria-pressed="'+on+'" title="'+esc(x[2])+'">'+esc(x[1])+'</button>'; }).join("")+'</div>'
    : '<span class="isl">% of</span><div class="seg iseg">'+[["prev","Previous step"],["first","First stage ("+IST[INS.from]+")"]].map(function(x){ var on=(INS.pof||"prev")===x[0]; return '<button type="button" class="'+(on?"on":"")+'" data-ins="pof:'+x[0]+'" aria-pressed="'+on+'">'+esc(x[1])+'</button>'; }).join("")+'</div>';
  var lv="";
  return '<div class="ixctl">'+rows+'<span class="ixx">×</span>'+cols+'<span class="isep"></span>'+mid+lv+'</div>';
}
/* Graded dimensions (My fit, Their fit, Fun & Shot) read best-first down the rows and best-last across the
   columns, so the best value sits at the right, next to All, with unknowns at the far left (3 Oct). */
function insCrossVals(list,k,max,asCol){
  var X=insCrossVals0(list,k,max);
  if(asCol && (k==="me"||k==="fit"||k==="quad")){ var u=X.vs.filter(function(v){return v==="none"||v==="un";}), g=X.vs.filter(function(v){return v!=="none"&&v!=="un";}).reverse(); X.vs=u.concat(g); }
  return X;
}
function insCrossVals0(list,k,max){
  var c={}; list.forEach(function(r){ var v=insDimOf(r,k); c[v]=(c[v]||0)+1; });
  /* Every category of a graded dimension shows, even at 0 (3 Oct); unknown only when some role has it. */
  /* Outcome and Ended at only add a category the filter leaves room for (7 Oct). */
  if(insGraded(k)) insOpts(k).forEach(function(o){ if(o[0]!=="none" && o[0]!=="un" && c[o[0]]==null && insCatFits(k,o[0])) c[o[0]]=0; });
  var ord=insOpts(k).map(function(o){return o[0];}), graded=insGraded(k);
  var vs=Object.keys(c).sort(function(a,b){ if(a==="none") return 1; if(b==="none") return -1;
    if(graded){ var ia=ord.indexOf(a), ib=ord.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); } return c[b]-c[a]; });
  if(vs.length<=max) return {vs:vs, other:{}};
  var keep=vs.filter(function(v){return v!=="none";}).slice(0,max-1), other={};
  if(vs.indexOf("none")>=0 && keep.length<max-1) keep.push("none");
  vs.forEach(function(v){ if(keep.indexOf(v)<0) other[v]=1; });
  return {vs:keep.concat(["__other"]), other:other};
}
/* Cross-tab (reworked 7 Oct): counts the roles the page's filters leave (the Outcome filter replaced the
   table's own Status dropdown). Show: Count, % of row or % of column; a % with fewer than INS_N roles behind it
   is greyed. Click any number, totals included, to list its roles under the table (INS.dd = [row, col],
   "*" = any); "Filter to these" applies both values as page filters. */
var INS_CPCT=[["n","Count","How many roles"],["row","% of row","Each cell as a share of its row, e.g. of fintech roles, how many ended each way"],["col","% of column","Each cell as a share of its column, e.g. of the roles they said no to, how many were fintech"]];
function insCrossHtml(M){
  var rk=INS.dim, ck=INS.col, pm=INS.cpct||"n", list=M.rs;
  var R=insCrossVals(list,rk,12), Cc=insCrossVals(list,ck,7,true);
  function key(r,k,X){ var v=insDimOf(r,k); return X.other[v]? "__other" : v; }
  function lab(k,v){ return v==="__other"? "All others" : insDimLab(k,v); }
  var grid={}, rowL={}, colL={};
  list.forEach(function(r){ var a=key(r,rk,R), b=key(r,ck,Cc); r._xa=a; r._xb=b;
    (grid[a+"\u0001"+b]=grid[a+"\u0001"+b]||[]).push(r); (rowL[a]=rowL[a]||[]).push(r); (colL[b]=colL[b]||[]).push(r); });
  /* Unknown and Other aren't results: they get no shading and don't set the scale (3 Oct). */
  function unk(v){ return v==="none" || v==="un" || v==="__other"; }
  var maxN=1; Object.keys(grid).forEach(function(g){ var pr=g.split("\u0001"); if(!unk(pr[0]) && !unk(pr[1]) && grid[g].length>maxN) maxN=grid[g].length; });
  var dd=Array.isArray(INS.dd)? INS.dd : null;
  if(dd && ((dd[0]!=="*" && R.vs.indexOf(dd[0])<0) || (dd[1]!=="*" && Cc.vs.indexOf(dd[1])<0))) dd=null;
  function cell(L,rv,cv,tot){
    L=L||[]; var n=L.length, den= pm==="row"? (rowL[rv]||[]).length : pm==="col"? (colL[cv]||[]).length : 0;
    var pct= pm!=="n" && !tot && den? n/den : null, thin= pm!=="n" && !tot && den<INS_N, u=!tot && (unk(rv) || unk(cv));
    var shade= pm==="n"? n/maxN : (pct||0);
    var txt= (pm==="n" || tot)? String(n) : den? ((n && pct<0.01)? "&lt;1" : Math.round(pct*100))+"%" : "";
    var r0=rv||"*", c0=cv||"*", on=dd && dd[0]===r0 && dd[1]===c0;
    var click= n? ' data-ins="dd" data-ddr="'+esc(r0)+'" data-ddc="'+esc(c0)+'" role="button" tabindex="0" title="'+(pct!=null? n+' of '+den+' · ' : "")+'List '+(n===1? "this role" : "these "+n+" roles")+'"' : "";
    return '<td class="num ixc'+(tot?" tot":"")+(thin?" thin":"")+(u?" unk":"")+(!n? " zero" : "")+(on?" on":"")+'"'+click+
      (n && !thin && !tot && !u? ' style="background:color-mix(in srgb, var(--accent) '+Math.round(8+shade*42)+'%, var(--surface))"' : "")+'>'+txt+'</td>';
  }
  var body=R.vs.map(function(rv){
    return '<tr><td><span class="ibn">'+esc(lab(rk,rv))+'</span></td>'+Cc.vs.map(function(cv){ return cell(grid[rv+"\u0001"+cv],rv,cv); }).join("")+cell(rowL[rv],rv,"",true)+'</tr>'; }).join("");
  var foot='<tr class="ixtot"><td><span class="ibn">All</span></td>'+Cc.vs.map(function(cv){ return cell(colL[cv],"",cv,true); }).join("")+cell(list,"","",true)+'</tr>';
  var ddHtml= dd? insDdHtml(list.filter(function(r){ return (dd[0]==="*" || r._xa===dd[0]) && (dd[1]==="*" || r._xb===dd[1]); }),rk,ck,dd,lab,unk) : "";
  var sub=(INS.f.out? insDimLab("out",INS.f.out) : "All roles")+' · '+insDimLab_k(rk)+' by '+insDimLab_k(ck)+(pm==="row"? " · % of each row" : pm==="col"? " · % of each column" : "")+' · click a number to list its roles';
  return '<section class="ovc insbd"><div class="ovh"><h3>Breakdown</h3><span class="ovsub">'+esc(sub)+'</span></div>'+
    insBdCtl(true)+
    '<div class="tablewrap"><table class="ibt ixt"><colgroup><col class="ixk">'+Cc.vs.map(function(){return '<col>';}).join("")+'<col class="ixa"></colgroup><thead><tr><th>'+esc(insDimLab_k(rk))+'</th>'+Cc.vs.map(function(cv){ return '<th class="num">'+esc(lab(ck,cv))+'</th>'; }).join("")+'<th class="num">All</th></tr></thead><tbody>'+
    (list.length? body+foot : '<tr><td colspan="'+(Cc.vs.length+2)+'">Nothing in this view.</td></tr>')+'</tbody></table></div>'+ddHtml+'</section>';
}
/* The roles behind one number: company, title, where it is or how it ended, the reason and the date. */
function insDdHtml(L,rk,ck,dd,lab,unk){
  var head=[dd[0]!=="*"? insDimLab_k(rk)+": "+lab(rk,dd[0]) : "", dd[1]!=="*"? insDimLab_k(ck)+": "+lab(ck,dd[1]) : ""].filter(Boolean).join(" · ")||"Every role in this view";
  function fil(k,v){ return v==="*" || (!unk(v) && k!=="who"); }
  var canF=fil(rk,dd[0]) && fil(ck,dd[1]) && !(dd[0]==="*" && dd[1]==="*");
  function when(r){ return (r._e && r._e.at) || r.seen || ""; }
  var rows=L.slice().sort(function(a,b){ return String(when(b)).localeCompare(String(when(a))); }).map(function(r){
    var st=INS_QST[r.stage], chip= st? INS_QLAB[st] : (r._e? insDimLab("out",r._e.by) : "Ended");
    var why= r._e? '<span class="ixddw">'+esc(r._e.reason)+(r._k? ' · at '+esc(IST[r._k]) : "")+'</span>' : "";
    var d=when(r);
    var inner='<span class="iqr">'+esc(r.company||"")+'<small>'+esc(clip(r.title||"",70))+'</small></span>'+why+'<span class="ixddd">'+(d? esc(niceShort(d)) : "")+'</span><span class="iqst2 s-'+(st||"end")+'">'+esc(chip)+'</span>';
    return '<li>'+(r.folded? '<span class="iqrow" title="Folded into the longlist record; no card to open">'+inner+'</span>' : '<a href="#" class="iqrow" data-act="role_go" data-id="'+esc(r.id)+'">'+inner+'</a>')+'</li>'; }).join("");
  return '<div class="iqlist ixdd"><div class="iqlh"><b>'+esc(head)+' · '+plural(L.length,"role")+'</b><span>'+
    (canF? '<button type="button" class="linkbtn" data-ins="ddf" title="Apply these as filters for the whole page">Filter to these</button> · ' : "")+
    '<button type="button" class="linkbtn" data-ins="ddx">Close</button></span></div><ul>'+rows+'</ul></div>';
}
function insDimLab_k(k){ return (INS_DIMS.find(function(d){return d[0]===k;})||[])[1]||k; }

/* Stage detail: when the scope is one stage, what matters at that stage. */
function insTile(lab,val,sub,cls){ return '<div class="itl'+(cls?" "+cls:"")+'"><span>'+esc(lab)+'</span><b>'+val+'</b>'+(sub? '<small>'+sub+'</small>' : "")+'</div>'; }
function insList(title,items,empty){
  var mx=Math.max.apply(null,items.map(function(x){return x.n;}).concat([1]));
  return '<div class="ilst"><div class="ish2">'+esc(title)+'</div>'+(items.length? '<ul class="irs">'+items.map(function(x){
      return '<li'+(x.act? ' data-ins="'+esc(x.act)+'" class="clk"' : "")+'>'+(x.w? '<span class="irw w-'+x.w+'">'+INS_WHO[x.w]+'</span>' : "")+'<span class="irl">'+esc(x.lab)+'</span><span class="irb"><i style="width:'+(x.n/mx*100)+'%"></i></span><b>'+x.n+'</b></li>'; }).join("")+'</ul>'
    : '<p class="inote">'+esc(empty||"Nothing yet.")+'</p>')+'</div>';
}
function insCount(list,fn,lab){ var c={}; list.forEach(function(r){ var k=fn(r); if(k==null) return; c[k]=(c[k]||0)+1; });
  return Object.keys(c).map(function(k){ return {key:k, lab:lab? lab(k) : k, n:c[k]}; }).sort(function(a,b){return b.n-a.n;}); }
function insMed(list,fa,fb){ return v2median(list.map(function(r){ var a=fa(r), b=fb(r); return (a&&b)? dayGap(a,b) : null; })); }
function insStageHtml(M){
  var s=INS.from, rs=M.rs, at=rs.filter(function(r){return r._k>=s;}), ended=rs.filter(function(r){return r._k===s && r._e;});
  var tiles="", L1="", L2="";
  var reasons=insCount(ended,function(r){return r._e.by+"|"+r._e.reason;}).map(function(x){ var p=x.key.split("|"); return {w:p[0], lab:p[1], n:x.n}; }).slice(0,6);
  if(s===0){
    var rc=insCount(M.scr,function(x){return x.rule;}, function(k){ return insRuleLab(k).replace(/^./,function(c){return c.toUpperCase();})+" ("+k+")"; });
    var bych={}; rs.forEach(function(r){ var k=insCh(r)||"none"; bych[k]=bych[k]||{n:0,s:0}; bych[k].n++; }); M.scr.forEach(function(x){ var k=x.ch||"none"; bych[k]=bych[k]||{n:0,s:0}; bych[k].s++; });
    var sw=runs.filter(function(r){return r.type==="sweep" && insIn(r.date,insWin());});
    tiles=insTile("Found",M.c[0],"by the sweep and you")+insTile("Screened out",M.scr.length,insPctHtml(M.scr.length,M.c[0])+" by your rules")+insTile("Reached the longlist",M.c[1],insPctHtml(M.c[1],M.c[0])+" of found")+
      insTile("Sweeps run",sw.length,sw.length? "last "+esc(niceShort(sw.map(function(r){return r.date;}).sort().pop())) : "none in this timeframe");
    L1=insList("Screened out, by rule",rc.slice(0,7).map(function(x){return {lab:x.lab, n:x.n, w:"rules"};}),"Nothing screened out in this view.");
    L2=insList("Found, by channel",Object.keys(bych).map(function(k){ return {lab:insDimLab("ch",k)+" · "+bych[k].n+" through, "+bych[k].s+" screened", n:bych[k].n+bych[k].s, act:k!=="none"? "f:ch:"+k : ""}; }).sort(function(a,b){return b.n-a.n;}));
  } else if(s===1){
    var dec=at.filter(function(r){ return r.stage!=="proposed"; }), pass=at.filter(function(r){return r._k>=2;});
    tiles=insTile("On the longlist",at.length)+insTile("Decided",dec.length,at.filter(function(r){return r.stage==="proposed";}).length+" still waiting")+
      insTile("Passed to shortlist",pass.length,insPctHtml(pass.length,dec.length)+" of decided")+insTile("Days to decide",insMed(dec,function(r){return r.seen;},function(r){return r.g1At||r.endAt;})!=null? insMed(dec,function(r){return r.seen;},function(r){return r.g1At||r.endAt;})+"d" : "—","median");
    L1=insList("Why longlist roles end",reasons,"Nothing ended here in this view.");
    L2=insList("Passed, by Fun & Shot",insCount(pass,function(r){return mixKeyOf(r);}).map(function(x){return {lab:mixLabel(x.key)||"Unscored", n:x.n, act:"f:quad:"+x.key};}));
  } else if(s===2){
    var moved=at.filter(function(r){return r._k>=3;}), res=at.filter(function(r){ return r.g2At || (r.enrich&&r.enrich.summary); });
    tiles=insTile("Reached the shortlist",at.length)+insTile("Researched",res.length,insPctHtml(res.length,at.length))+insTile("Moved to To apply",moved.length,insPctHtml(moved.length,at.length))+
      insTile("Days to To apply",(function(m){return m!=null? m+"d" : "—";})(insMed(moved,function(r){return r.g1At;},function(r){return r.g2At;})),"median");
    L1=insList("Their fit",insCount(at,function(r){return insFit(r);}).map(function(x){ return {lab:insDimLab("fit",x.key), n:x.n, act:"f:fit:"+x.key}; }));
    L2=insList("Why shortlist roles end",reasons,"Nothing ended here in this view.");
  } else if(s===3){
    var sent=at.filter(function(r){return r._k>=4;}), ready=at.filter(function(r){return r.stage==="prep" && packReady(r);});
    tiles=insTile("Reached To apply",at.length)+insTile("Applied",sent.length,insPctHtml(sent.length,at.length))+insTile("CVs ready, not sent",ready.length,"",ready.length? "warn" : "")+
      insTile("Days to apply",(function(m){return m!=null? m+"d" : "—";})(insMed(sent,function(r){return r.g2At;},function(r){return r.appliedAt;})),"median");
    L1=insList("Fun & Shot",insCount(at,function(r){return mixKeyOf(r);}).map(function(x){return {lab:mixLabel(x.key)||"Unscored", n:x.n, act:"f:quad:"+x.key};}));
    L2=insList("Why roles end here",reasons,"Nothing ended here in this view.");
  } else if(s===4){
    var iv=at.filter(function(r){return r._k>=5;}), th=at.filter(function(r){return r._e && r._e.by==="them";}), wait=at.filter(function(r){return r.stage==="applied" && !(flowOf(r).mine);});
    tiles=insTile("Applied",at.length)+insTile("Got an interview",iv.length,insPctHtml(iv.length,at.length))+insTile("Turned down",th.length,insPctHtml(th.length,at.length))+insTile("Waiting on them",wait.length);
    L1=insList("Where each application is",insCount(at.filter(function(r){return r.stage==="applied"||r.stage==="offer";}),function(r){return flowOf(r).label;}).map(function(x){return {lab:x.lab, n:x.n};}),"No live applications.");
    L2=insList("Why applications end",reasons,"Nothing ended here in this view.");
  } else {
    var rounds=commitments.filter(function(c){ return at.some(function(r){return r.id===c.roleId;}) && mtItem(c)==="meeting" && wkCat(c)==="interview"; });
    tiles=insTile(IST[s],at.length)+insTile("Rounds held",rounds.filter(function(c){return c.state==="done";}).length)+insTile("Rounds booked",rounds.filter(function(c){return c.state==="booked";}).length)+insTile("Offers",M.c[6],insPctHtml(M.c[6],at.length));
    L1=insList("Rounds, by type",insCount(rounds,function(c){return mtLabel(c);}).map(function(x){return {lab:x.lab, n:x.n};}),"No rounds yet.");
    L2=insList("Why roles end here",reasons,"Nothing ended here in this view.");
  }
  return '<section class="ovc insst"><div class="ovh"><h3>'+IST[s]+' in detail</h3><span class="ovsub">The numbers that matter at this stage</span><button type="button" class="linkbtn ovmore" data-ins="range:0:6">Whole funnel</button></div>'+
    '<div class="itls">'+tiles+'</div><div class="ilsts">'+L1+L2+'</div></section>';
}

/* Trends: activity per week, split by the breakdown dimension (top four and the rest). */
var INS_TM=[["found","Found",function(r){return r.seen;}],["short","Shortlisted",function(r){return r._k>=2? r.g1At : null;}],["applied","Applied",function(r){return r.appliedAt;}],
  ["ended","Closed",function(r){return r._e? r._e.at : null;}]];
function insTrendHtml(){
  var all=roles.concat(insFolded()).filter(function(r){ return insPass(r); }); all.forEach(function(r){ r._k=insReach(r); r._e=insEnd(r); });
  var first=all.map(function(r){return r.seen;}).filter(Boolean).sort()[0]||today(), w0=weekStart(today());
  var n= INS.period==="all"? Math.min(12, Math.max(4, Math.ceil((dayGap(weekStart(first),w0)||0)/7)+1)) : Math.max(4, Math.ceil(+INS.period/7));
  n=Math.min(n,13); var weeks=[]; for(var i=n-1;i>=0;i--) weeks.push(addDays(w0,-7*i));
  var M=INS_TM.find(function(x){return x[0]===INS.tm;})||INS_TM[0], k=INS.dim==="ch"||INS.dim==="src"? "ch" : INS.dim;
  var ev=all.map(function(r){ return {d:M[2](r), v:insDimOf(r,k)}; }).filter(function(x){return x.d;});
  var tot={}; ev.forEach(function(x){ if(x.d>=weeks[0]) tot[x.v]=(tot[x.v]||0)+1; });
  var keys=Object.keys(tot).sort(function(a,b){return tot[b]-tot[a];}), top=keys.slice(0,4), rest=keys.length>4;
  var series=top.concat(rest? ["other"] : []);
  var data=weeks.map(function(w){ var e=addDays(w,7), o={}; series.forEach(function(s){o[s]=0;});
    ev.forEach(function(x){ if(x.d>=w && x.d<e){ var s=top.indexOf(x.v)>=0? x.v : "other"; if(o[s]!=null) o[s]++; } }); return o; });
  var max=Math.max.apply(null,data.map(function(o){ return series.reduce(function(m,s){return m+o[s];},0); }).concat([1]));
  var sum=data.reduce(function(m,o){ return m+series.reduce(function(a,s){return a+o[s];},0); },0);
  var half=Math.floor(weeks.length/2), a=0, b=0; data.forEach(function(o,i){ var t=series.reduce(function(m,s){return m+o[s];},0); if(i<half) a+=t; else b+=t; });
  var dir = sum<4? "" : b>a*1.25? '<span class="itd up">▲ rising</span>' : b<a*0.75? '<span class="itd dn">▼ falling</span>' : '<span class="itd">steady</span>';
  function lab(s){ return s==="other"? "Everything else" : insDimLab(k,s); }
  return '<section class="ovc instr"><div class="ovh"><h3>Trends</h3><span class="ovsub">'+esc(M[1])+' per week, by '+esc(((INS_DIMS.find(function(d){return d[0]===k;})||[])[1]||"").toLowerCase())+' · '+sum+' in all</span>'+dir+'</div>'+
    '<div class="seg iseg itm">'+INS_TM.map(function(x){ return '<button type="button" class="'+(INS.tm===x[0]?"on":"")+'" data-ins="tm:'+x[0]+'">'+x[1]+'</button>'; }).join("")+'</div>'+
    '<div class="itc" role="img" aria-label="'+esc(M[1])+' per week">'+
      '<div class="itgrid"><span>'+max+'</span><span>'+Math.round(max/2)+'</span><span>0</span></div>'+
      '<div class="itcols">'+data.map(function(o,i){ var t=series.reduce(function(m,s){return m+o[s];},0);
        return '<div class="itcol" title="Week of '+esc(niceShort(weeks[i]))+': '+t+'">'+(t? '<span class="itv">'+t+'</span>' : "")+'<div class="itst" style="height:'+(t/max*100)+'%">'+
          series.map(function(s,j){ return o[s]? '<i class="c'+j+'" style="flex:'+o[s]+'"></i>' : ""; }).join("")+'</div><span class="itw">'+esc(niceShort(weeks[i]).replace(/^\w+ /,""))+'</span></div>'; }).join("")+'</div></div>'+
    '<div class="itk">'+series.map(function(s,j){ return '<span><i class="c'+j+'"></i>'+esc(lab(s))+'</span>'; }).join("")+'</div></section>';
}
/* Pace: median days through each step, this timeframe against the one before. */
function insPaceHtml(M,M0){
  var P=[["Decide on the longlist",function(r){return r.seen;},function(r){return r._k>=2? r.g1At : null;}],
         ["Shortlist to To apply",function(r){return r.g1At;},function(r){return r._k>=3? r.g2At : null;}],
         ["To apply to applied",function(r){return r.g2At;},function(r){return r.appliedAt;}],
         ["Applied to first interview",function(r){return r.appliedAt;},function(r){ var d=commitments.filter(function(c){ return c.roleId===r.id && mtItem(c)==="meeting" && wkCat(c)==="interview" && c.date; }).map(function(c){return c.date;}).sort()[0]; return d||null; }]];
  return '<section class="ovc inspace"><div class="ovh"><h3>Pace</h3><span class="ovsub">Median days through each step'+(M0? " · against the period before" : "")+'</span></div>'+
    '<div class="ipc">'+P.map(function(p){ var m=insMed(M.rs,p[1],p[2]), n=M.rs.filter(function(r){return p[1](r) && p[2](r);}).length, m0=M0? insMed(M0.rs,p[1],p[2]) : null;
      var d= (m!=null && m0!=null && m!==m0)? '<em class="'+(m<m0?"up":"dn")+'">'+(m<m0? "▼ "+(m0-m)+"d faster" : "▲ "+(m-m0)+"d slower")+'</em>' : "";
      return '<div class="ipr"><span>'+esc(p[0])+'</span><b>'+(m!=null? m+'<small>d</small>' : "—")+'</b><small>'+(n? "from "+plural(n,"role") : "no data yet")+'</small>'+d+'</div>'; }).join("")+'</div></section>';
}

/* ---------- Fun × Shot (3 Oct, moved from Compare) ----------
   Every scored role in this view on one 5 × 5 grid, coloured by stage. Follows the period and every filter.
   Live roles by default (longlist to Applied); "Show ended roles too" adds the rest in grey. Click a dot to open it. */
var INS_QST={proposed:"ll", consideration:"sl", parked:"sl", prep:"ta", applied:"ap", offer:"ap"};
var INS_QLAB={ll:"Longlist", sl:"Shortlist", ta:"To apply", ap:"Applied", end:"Ended"};
/* The grid itself is shared (4 Oct): insQuadGrid draws it from a list of points, and two thin callers decide
   which roles go in. Insights passes its filtered model and the Status dropdown; Overview's Funnel health
   passes live roles only, ignoring Insights' period and filters. Change the grid here and both follow. */
var INS_QGROUPS={
  live:[["dec","Deciding",function(p){return p.st==="ll"||p.st==="sl";}],["app","Applying",function(p){return p.st==="ta"||p.st==="ap";}]],
  all:[["live","Live",function(p){return p.st!=="end";}],["end","Ended",function(p){return p.st==="end";}]]
};
function insQuadPoint(r){ var st=INS_QST[r.stage]||"end", c=curScores(r); return (c.f==null||c.s==null)? null : {r:r, f:+c.f, s:+c.s, st:st}; }
/* pts: [{r,f,s,st}]; G: two groups at most; selKey: the open square ("f-s") or ""; attr: the click attribute,
   e.g. 'data-ins="qcell:' (Insights) or 'data-ovq="' (Overview). Returns {svg, key, list}. */
function insQuadGrid(pts,G,selKey,attr){
  var X0=34, Y0=8, C=50;   /* cell size; Shot 1–5 left to right, Fun 5–1 top to bottom */
  function cx(sv){ return X0+(sv-1)*C; } function cy(fv){ return Y0+(5-fv)*C; }
  var cells={}; pts.forEach(function(p){ var k=p.f+"-"+p.s; (cells[k]=cells[k]||[]).push(p); });
  var dots=Object.keys(cells).map(function(k){ var L=cells[k], f=+k.split("-")[0], sv=+k.split("-")[1], x0=cx(sv), y0=cy(f);
    var ns=G.map(function(g){ return [g[0], L.filter(g[2]).length]; }).filter(function(x){return x[1];});
    var tip=G.map(function(g){ return L.filter(g[2]).length+" "+g[1].toLowerCase(); }).join(", ")+" · Fun "+f+", Shot "+sv+" · click for the roles";
    var txt=ns.map(function(x,i){ var xx= ns.length===1? x0+C/2 : x0+C*(i===0? 0.3 : 0.7); return '<text x="'+xx+'" y="'+(y0+C/2+6)+'" class="qnum g-'+x[0]+'">'+x[1]+'</text>'; }).join("");
    return '<g class="qcell'+(selKey===k?" on":"")+'" '+attr+k+'" role="button" tabindex="0"><rect x="'+(x0+2)+'" y="'+(y0+2)+'" width="'+(C-4)+'" height="'+(C-4)+'" rx="6" class="qhit"/>'+txt+'<title>'+esc(tip)+'</title></g>'; }).join("");
  var sel=selKey && cells[selKey]? cells[selKey] : null;
  /* Quadrants split at 4 (quadOf): Fun 4–5 is high, Shot 4–5 is high. */
  var qs='<rect x="'+X0+'" y="'+Y0+'" width="'+(3*C)+'" height="'+(2*C)+'" class="qq hl"/><rect x="'+(X0+3*C)+'" y="'+Y0+'" width="'+(2*C)+'" height="'+(2*C)+'" class="qq hh"/>'+
    '<rect x="'+X0+'" y="'+(Y0+2*C)+'" width="'+(3*C)+'" height="'+(3*C)+'" class="qq ll"/><rect x="'+(X0+3*C)+'" y="'+(Y0+2*C)+'" width="'+(2*C)+'" height="'+(3*C)+'" class="qq lh"/>';
  var grid=""; for(var i=1;i<5;i++){ grid+='<line x1="'+(X0+i*C)+'" y1="'+Y0+'" x2="'+(X0+i*C)+'" y2="'+(Y0+5*C)+'" class="qg"/><line x1="'+X0+'" y1="'+(Y0+i*C)+'" x2="'+(X0+5*C)+'" y2="'+(Y0+i*C)+'" class="qg"/>'; }
  var ax=""; for(var v=1;v<=5;v++){ ax+='<text x="'+(cx(v)+C/2)+'" y="'+(Y0+5*C+14)+'" class="qn">'+v+'</text><text x="'+(X0-8)+'" y="'+(cy(v)+C/2+4)+'" class="qn" text-anchor="end">'+v+'</text>'; }
  var lab='<text x="'+(X0+6)+'" y="'+(Y0+14)+'" class="ql">Stretch bets</text><text x="'+(X0+5*C-6)+'" y="'+(Y0+14)+'" class="ql" text-anchor="end">Apply, priority</text>'+
    '<text x="'+(X0+6)+'" y="'+(Y0+5*C-6)+'" class="ql">Do not apply</text><text x="'+(X0+5*C-6)+'" y="'+(Y0+5*C-6)+'" class="ql" text-anchor="end">Safe fallbacks</text>';
  var svg='<svg viewBox="0 0 '+(X0+5*C+8)+' '+(Y0+5*C+40)+'" class="iqsvg" role="img" aria-label="Fun against Shot for every scored role in this view">'+qs+grid+lab+ax+
    '<text x="'+(X0+2.5*C)+'" y="'+(Y0+5*C+32)+'" class="qa">Shot →</text><text x="10" y="'+(Y0+2.5*C)+'" class="qa" transform="rotate(-90 10 '+(Y0+2.5*C)+')">Fun →</text>'+dots+'</svg>';
  var key=G.map(function(g){ return '<span><i class="qk g-'+g[0]+'"></i>'+g[1]+'</span>'; }).join("");
  var list= sel? '<div class="iqlist"><div class="iqlh"><b>Fun '+selKey.split("-")[0]+' · Shot '+selKey.split("-")[1]+'</b><button type="button" class="linkbtn" '+attr+selKey+'">Close</button></div><ul>'+
      sel.slice().sort(function(a,b){ return ["ap","ta","sl","ll","end"].indexOf(a.st)-["ap","ta","sl","ll","end"].indexOf(b.st); }).map(function(p){
        var inner='<span class="iqr">'+esc(p.r.company||"")+'<small>'+esc(clip(p.r.title||"",60))+'</small></span><span class="iqst2 s-'+p.st+'">'+esc(p.st==="end"? (INS_WHO[(p.r._e||{}).by]||"Ended") : INS_QLAB[p.st])+'</span>';
        return '<li>'+(p.r.folded? '<span class="iqrow">'+inner+'</span>' : '<a href="#" class="iqrow" data-act="role_go" data-id="'+esc(p.r.id)+'">'+inner+'</a>')+'</li>'; }).join("")+'</ul></div>' : "";
  return {svg:svg, key:'<div class="iqkey">'+key+'</div>', list:list};
}
/* Insights caller: follows the period, every filter and the Status dropdown. */
function insQuadHtml(M){
  var pts=[], un=0, qst=INS.f.out? "all" : (INS.qst||"live");
  M.rs.forEach(function(r){ var st=INS_QST[r.stage]||"end"; if(!insStatusPass(r,qst)) return;
    var p=insQuadPoint(r); if(!p){ if(st!=="end") un++; return; } pts.push(p); });
  var G=INS_QGROUPS[qst] || [["end",insStatusLab(qst),function(){return true;}]];
  var Q=insQuadGrid(pts,G,INS.qcell,'data-ins="qcell:');
  var nEnd=pts.filter(function(p){return p.st==="end";}).length;
  var sub= qst==="all"? plural(pts.length,"role")+(nEnd? ", "+nEnd+" ended" : "") : qst==="live"? plural(pts.length,"live role") : plural(pts.length,"role")+" · "+insStatusLab(qst).toLowerCase();
  return '<section class="ovc insquad"><div class="ovh"><h3>Fun × Shot</h3><span class="ovsub">'+sub+(un? " · "+un+" live not scored" : "")+'</span>'+
      '<div class="iqseg">'+(INS.f.out? '<span class="ovsub" title="Set by the Outcome filter at the top">'+esc(insDimLab("out",INS.f.out))+'</span>' : insStatusSel("qst",qst))+'</div></div>'+Q.svg+Q.key+Q.list+'</section>';
}
/* Overview caller (Funnel health): live roles only, whatever Insights is set to. */
var OVQ={cell:""};
function ovQuadParts(){
  var pts=[], un=0;
  roles.forEach(function(r){ var st=INS_QST[r.stage]; if(!st) return; var p=insQuadPoint(r); if(p) pts.push(p); else un++; });
  return {grid:insQuadGrid(pts,INS_QGROUPS.live,OVQ.cell,'data-ovq="'), n:pts.length, un:un};
}
document.addEventListener("click",function(ev){
  var g=ev.target.closest && ev.target.closest("[data-ovq]"); if(!g) return;
  ev.preventDefault(); var k=g.getAttribute("data-ovq"); OVQ.cell= OVQ.cell===k? "" : k;
  if(typeof renderRail==="function") renderRail(); if(typeof renderOverview==="function" && tab==="overview") renderOverview();
});

/* ---------- render ---------- */
function renderInsights(){
  var host=el("ins-root"); if(!host || tab!=="pipeline") return;
  var w=insWin(), M=insModel(w), M0=(INS.period!=="all")? insModel(insWin(true)) : null;
  /* Highlights follow the period only, never the filters or scope (3 Oct): same cards as Overview for the same period. */
  var H=insHighlights();
  var sy=window.scrollY;
  host.innerHTML='<div class="ins">'+insBar()+insHlHtml(H)+
    /* Comparing against an empty period only says "+N" everywhere, so it stays quiet then. */
    '<div class="insrow">'+insFunnelHtml(M,(INS.cmp && M0 && M0.c[0])? M0 : null)+insEndHtml(M)+'</div>'+
    (INS.from===INS.to? insStageHtml(M) : insBreakdownHtml(M))+
    '<div class="insrow b">'+insTrendHtml()+insPaceHtml(M,(INS.cmp && M0 && M0.c[0])? M0 : null)+insQuadHtml(M)+'</div></div>';
  window.scrollTo(0,sy);
}
render=(function(orig){ return function(){ orig(); try{ renderInsights(); }catch(e){ console.warn("insights",e); } }; })(render);
showTab=(function(orig){ return function(t){ orig(t); if(t==="pipeline"){ try{ renderInsights(); }catch(e){ console.warn("insights",e); } } }; })(showTab);

/* ---------- interaction ---------- */
function insSet(fn){ fn(); renderInsights(); }
/* Reset (3 Oct): every Insights setting back to how the page first opens. */
function insDefaults(){ return {period:"all", cmp:false, f:{ch:"",src:"",me:"",fit:"",quad:"",sec:"",lvl:"",who:"",out:"",why:"",end:""}, from:0, to:6, dim:"ch", open:{}, tm:"found", more:false, qst:"live", qcell:"", col:"stages", cst:"all", pof:"prev", cpct:"n", dd:""}; }
function insIsDefault(){ var d=insDefaults(); return INS.period===d.period && !INS.cmp && INS.from===0 && INS.to===6 && INS.dim===d.dim && INS.tm===d.tm && !INS.more && (INS.qst||"live")==="live" && (INS.col||"stages")==="stages" && (INS.cst||"all")==="all" && (INS.pof||"prev")==="prev" && (INS.cpct||"n")==="n" &&
  !Object.keys(INS.f).some(function(k){return INS.f[k];}) && !Object.keys(INS.open||{}).some(function(k){return INS.open[k];}); }
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("#ins-root [data-ins]"); if(!b) return;
  ev.preventDefault();
  var p=String(b.dataset.ins).split(":"), a=p[0];
  if(a==="qcell") return insSet(function(){ var k=p[1]; INS.qcell= INS.qcell===k? "" : k; });
  if(a==="dd") return insSet(function(){ var r=b.dataset.ddr, c=b.dataset.ddc, d=INS.dd; INS.dd= (Array.isArray(d) && d[0]===r && d[1]===c)? "" : [r,c]; });
  if(a==="ddx") return insSet(function(){ INS.dd=""; });
  if(a==="ddf") return insSet(function(){ var d=INS.dd; if(!Array.isArray(d)) return; [[INS.dim,d[0]],[INS.col,d[1]]].forEach(function(x){ if(x[1]==="*") return; if(x[0]==="ch"){ INS.f.ch=x[1]; INS.f.src=""; } else INS.f[x[0]]=x[1]; }); INS.dd=""; });
  if(a==="cpct") return insSet(function(){ INS.cpct=p[1]; });
  if(a==="endbd"){ insSet(function(){ if(!INS.f.out || INS.f.out==="live") INS.f.out="ended"; INS.dim="why"; INS.col= INS.f.out==="ended"? "out" : "sec"; INS.from=0; INS.to=6; INS.dd=""; });
    var bd=document.querySelector("#ins-root .insbd"); if(bd) bd.scrollIntoView({behavior:"smooth", block:"start"}); return; }
  if(a==="period") return insSet(function(){ INS.period=p[1]; if(p[1]==="all") INS.cmp=false; });
  if(a==="more") return insSet(function(){ INS.more=!INS.more; });
  if(a==="range") return insSet(function(){ INS.from=+p[1]; INS.to=+p[2]; });
  if(a==="scope") return insSet(function(){ var i=+p[1]; if(INS.from===i && INS.to===i){ INS.from=0; INS.to=6; } else { INS.from=i; INS.to=i; } });
  if(a==="open") return insSet(function(){ INS.open[p[1]]=!INS.open[p[1]]; });
  if(a==="tm") return insSet(function(){ INS.tm=p[1]; });
  if(a==="dim") return insSet(function(){ INS.dim=p[1]; INS.dd=""; if(INS.col===p[1]) INS.col="stages"; });
  if(a==="col") return insSet(function(){ INS.col=p[1]; INS.dd=""; });
  if(a==="pof") return insSet(function(){ INS.pof=p[1]; });
  if(a==="fx") return insSet(function(){ INS.dd=""; [[p[1],p[2]],[p[3],p[4]]].forEach(function(x){ if(x[0]==="ch"){ INS.f.ch=x[1]; INS.f.src=""; } else INS.f[x[0]]=x[1]; }); });
  if(a==="clr") return insSet(function(){ INS.dd=""; INS.f[p[1]]=""; if(p[1]==="ch") INS.f.src=""; });
  if(a==="reset") return insSet(function(){ Object.assign(INS,insDefaults()); });
  if(a==="clrall") return insSet(function(){ INS.dd=""; Object.keys(INS.f).forEach(function(k){INS.f[k]="";}); });
  if(a==="f") return insSet(function(){ INS.dd="";
    if(p[1]==="src"){ INS.f.ch=p[2]; INS.f.src=p.slice(3).join(":"); }
    else if(p[1]==="ch"){ INS.f.ch = INS.f.ch===p[2] && !INS.f.src? "" : p[2]; INS.f.src=""; }
    else { var v=p.slice(2).join(":"); INS.f[p[1]] = INS.f[p[1]]===v? "" : v; } });
  if(a==="tab"){ showTab(p[1]); render(); return; }
  if(a==="about"){ var g=document.querySelector('[data-goabout="'+p[1]+'"]'); if(g) g.click(); else showTab("about"); return; }
},true);
document.addEventListener("keydown",function(ev){
  if(ev.key!=="Enter" && ev.key!==" ") return;
  var b=ev.target.closest && ev.target.closest("#ins-root [data-ins][role=button]"); if(!b || ev.target!==b) return;
  ev.preventDefault(); b.click();
});
document.addEventListener("change",function(ev){
  var s=ev.target.closest && ev.target.closest("#ins-root [data-insel]"); if(!s) return;
  var k=s.dataset.insel, v=s.value;
  insSet(function(){
    if(k!=="cmp") INS.dd="";
    if(k==="cmp") INS.cmp=s.checked;
    else if(k==="qst"){ INS.qst=v; INS.qcell=""; }
    else if(k==="chsrc"){ if(!v){ INS.f.ch=""; INS.f.src=""; } else if(v.indexOf("src:")===0){ var sid=v.slice(4); INS.f.src=sid; INS.f.ch=chOfSrc(sid)||INS.f.ch; } else { INS.f.ch=v.slice(3); INS.f.src=""; } }
    else if(k==="from"){ INS.from=+v; if(INS.to<INS.from) INS.to=INS.from; }
    else if(k==="to"){ INS.to=Math.max(+v,INS.from); }
    else if(k==="dim"){ INS.dim=v; if(INS.col===v) INS.col="stages"; }
    else if(k==="col") INS.col=v;
    else INS.f[k]=v;
  });
});
if(typeof tab!=="undefined" && tab==="pipeline"){ try{ renderInsights(); }catch(e){} }

/* ---------- Overview: Highlights row, and Pace beside Looking back (3 Oct) ----------
   Same functions as the Insights page, run with no filters over Looking back's period. The period buttons move
   up into the Highlights header and drive both rows. Nothing here asks Claude. */
function insClean(period,fn){
  var keep={period:INS.period, f:INS.f, from:INS.from, to:INS.to};
  INS.period=period||"all"; INS.f={ch:"",src:"",me:"",fit:"",quad:"",sec:"",lvl:"",who:"",out:"",why:"",end:""}; INS.from=0; INS.to=6;
  try{ return fn(); } finally { INS.period=keep.period; INS.f=keep.f; INS.from=keep.from; INS.to=keep.to; }
}
function ovHlHtml(H,n){
  var act=H.filter(function(h){return h.group!=="fyi";}).length, fyi=H.length-act;
  var chips="";
  return '<section class="ovc ovhl"><div class="ovh"><h3>Highlights</h3><span class="ovhcs">'+chips+'</span>'+
      '<span class="ovsub">This week</span><span class="ovhsp"></span>'+
      '<a href="#" class="ovmore" data-ovins="open">All insights →</a></div>'+
    insHlGroups(H,"data-ovins",function(h){ return ' role="button" tabindex="0" data-ovins="card:'+esc(h.act||"")+'" title="Open in Insights"'; })+'</section>';
}
function ovInsights(){
  var box=el("ov-body"), back=box && box.querySelector(".ovback"); if(!back) return;
  var per=(typeof V2!=="undefined" && V2.period)||"all", n=per==="all"? 0 : +per;
  var R=insClean(per,function(){ var M=insModel(insWin()), M0=per!=="all"? insModel(insWin(true)) : null;
    return {H:insHighlights(), pace:insPaceHtml(M,(M0 && M0.c[0])? M0 : null)}; });
  var hl=document.createElement("div"); hl.innerHTML=ovHlHtml(R.H,n); hl=hl.firstChild;
  /* The period buttons stay with Looking back (5 Oct): Highlights are this week's, whatever the period. */
  back.parentNode.insertBefore(hl,back);
  var row=document.createElement("div"); row.className="ovrow2"; back.parentNode.insertBefore(row,back); row.appendChild(back);
  var pc=document.createElement("div"); pc.innerHTML=R.pace; pc=pc.firstChild;
  pc.classList.add("ovpace"); pc.setAttribute("data-ovins","pace"); pc.setAttribute("role","button"); pc.setAttribute("tabindex","0"); pc.title="Open in Insights";
  var h=pc.querySelector(".ovh"), sub=h && h.querySelector(".ovsub"); if(sub) sub.textContent="Median days per step";
  if(h) h.insertAdjacentHTML("beforeend",'<a href="#" class="ovmore" data-ovins="pace">Insights →</a>');
  row.appendChild(pc);
}
renderOverview=(function(orig){ return function(){ orig(); try{ ovInsights(); }catch(e){ console.warn("overview insights",e); } }; })(renderOverview);
/* A click on Overview opens Insights over the same period with no other filters, then applies the highlight's
   own filter. "Go there" style actions go to their page instead. */
function ovInsGo(act,card){
  var per=(typeof V2!=="undefined" && V2.period)||"all", p=String(act||"").split(":"), a=p[0];
  if(!card && a==="tab"){ showTab(p[1]); render(); return; }
  if(!card && a==="about"){ var g=document.querySelector('[data-goabout="'+p[1]+'"]'); if(g) g.click(); else showTab("about"); return; }
  INS.period=per; INS.cmp=false; INS.f={ch:"",src:"",me:"",fit:"",quad:"",sec:"",lvl:"",who:"",out:"",why:"",end:""}; INS.from=0; INS.to=6;
  if(a==="f"){ if(p[1]==="src"){ INS.f.ch=p[2]; INS.f.src=p.slice(3).join(":"); } else INS.f[p[1]]=p.slice(2).join(":"); }
  else if(a==="range"){ INS.from=+p[1]; INS.to=+p[2]; }
  else if(a==="scope"){ INS.from=+p[1]; INS.to=+p[1]; }
  showTab("pipeline"); window.scrollTo(0,0);
  if(a==="pace") setTimeout(function(){ var s=document.querySelector("#ins-root .inspace"); if(s) s.scrollIntoView({block:"center"}); },60);
}
document.addEventListener("click",function(ev){
  if(ev.target.closest && ev.target.closest("[data-hl]")) return;
  var b=ev.target.closest && ev.target.closest("#ov-body [data-ovins]"); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var v=b.dataset.ovins;
  if(v==="open") return ovInsGo("",true);
  if(v==="pace") return ovInsGo("pace",true);
  if(v.indexOf("card:")===0) return ovInsGo(v.slice(5),true);
  ovInsGo(v,false);
},true);
document.addEventListener("keydown",function(ev){
  if(ev.key!=="Enter" && ev.key!==" ") return;
  var b=ev.target.closest && ev.target.closest("#ov-body [data-ovins][role=button]"); if(!b || ev.target!==b) return;
  ev.preventDefault(); b.click();
});
if(typeof tab!=="undefined" && tab==="overview"){ try{ renderOverview(); }catch(e){} }

/* ---------- the Closed page: one compact chart from the shared function, then the list (3 Oct) ---------- */
renderRejected=(function(orig){ return function(){
  orig();
  var host=el("cl-compact"); if(!host) return;
  var all=roles.concat(insFolded()), ex=[]; for(var i=0;i<7;i++) ex.push({me:0,them:0,neither:0,rules:0});
  var n=0; all.forEach(function(r){ var e=insEnd(r); if(!e) return; ex[insReach(r)][e.by]++; n++; });
  var scr=insScreened().length; ex[0].rules=scr;
  var items=[]; for(var j=0;j<7;j++){ if(j===6 && !insExTot(ex[j])) continue; items.push({ix:j, label:"At "+IST[j], me:ex[j].me, them:ex[j].them, neither:ex[j].neither, rules:ex[j].rules}); }
  host.innerHTML='<div class="ovh"><h3>Where roles end</h3><span class="ovsub">'+plural(n,"role")+' closed, plus '+scr+' screened out by your rules</span>'+
    '<a href="#" class="ovmore" data-gotab="pipeline" data-insscope="1">See why roles end →</a></div>'+endWhereBars(items);
  /* Each stage row filters the list below, as the old bars did (QA 14 Oct). Found is screen-outs: no filter. */
  var CLW={1:"Gate 1", 2:"Gate 2", 3:"Gate 2", 4:"After applying", 5:"After interviewing", 6:"After interviewing"};
  Array.prototype.forEach.call(host.querySelectorAll(".ewr"),function(row,i){ var w=CLW[items[i] && items[i].ix]; if(!w || row.classList.contains("z")) return;
    row.classList.add("cbar"); row.setAttribute("data-clw",w); row.setAttribute("role","button"); row.setAttribute("tabindex","0"); row.title="Show these in the list";
    if(typeof CLF!=="undefined" && CLF.where===w) row.classList.add("on"); });
}; })(renderRejected);

/* ---------- Handled and Not useful (3 Oct) ----------
   hlstate/<slug of key>: {key, state handled|dismissed, note, at, until, title, n}. Every mark is logged in the
   change log (rulelog kind "highlight") and can be undone there or from the toast. */
function hlRedraw(){ try{ renderInsights(); }catch(e){} if(typeof tab!=="undefined" && tab==="overview"){ try{ renderOverview(); }catch(e){} } }
function hlId(key){ return String(key||"x").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,140)||"x"; }
async function hlSet(h,state,note){
  if(!DB) return;
  var t=today(), id=hlId(h.key), doc={key:h.key, state:state, note:note||"", at:t, until:state==="dismissed"? addDays(t,30) : "", title:h.title||"", n:h.n==null? null : h.n, per:h.per||"all"};
  try{
    await DB.doc("hlstate/"+id).set(doc);
    if(typeof ruLogEntry==="function") ruLogEntry({kind:"highlight", ruleId:h.key, action:state, before:null, after:{name:h.title||"", note:note||""}, via:"you", why:note||""});
    toastUndo(state==="handled"? "Marked handled — it comes back only if it happens again" : state==="monitor"? "Monitoring — it comes back if the number grows" : "Hidden for 30 days", function(){ DB.doc("hlstate/"+id).delete().catch(function(){}); });
  }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-hl]"); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var p=String(b.dataset.hl), i=p.indexOf(":"), a=p.slice(0,i), key=p.slice(i+1);
  if(a==="okm") return hlMonDone(key);
  if(a==="fixm"){ var hm=INS_HLMONC[key]; if(hm && typeof hsOpen==="function") hsOpen(hm); return; }
  var h=INS_HLMAP[key]; if(!h) return;
  if(a==="menu"){ var mn=b.parentNode.querySelector(".ihmenu"), open=mn && mn.hidden; hlMenusClose(); if(mn && open){ mn.hidden=false; b.setAttribute("aria-expanded","true"); } return; }
  hlMenusClose();
  if(a==="fix"){ if(typeof hsOpen==="function") hsOpen(h); return; }
  if(a==="mon") return openForm({title:"Monitor", lede:h.title+" — hidden until its number grows (now "+h.n+").", ok:"Monitor it",
    fields:[{id:"note", label:"Note — optional", type:"area", rows:2, placeholder:"e.g. Tightened the check on 3 Oct; see if it holds"}],
    onSave:function(v){ hlSet(h,"monitor",v.note); }});
  if(a==="done") openForm({title:"Mark handled", lede:h.title, ok:"Mark handled",
    fields:[{id:"note", label:"What you did about it", type:"area", rows:3, placeholder:"e.g. Tightened the sweep's office-days check"}],
    onSave:function(v){ if(!v.note) return "Say what you did, so you know later why it was closed."; hlSet(h,"handled",v.note); }});
  else if(a==="no") openForm({title:"Not useful", lede:h.title+" — hidden for 30 days.", ok:"Hide it",
    fields:[{id:"note", label:"Why — optional", type:"area", rows:2, placeholder:"e.g. I'll never change this"}],
    onSave:function(v){ hlSet(h,"dismissed",v.note); }});
},true);
function hlMenusClose(){ Array.prototype.forEach.call(document.querySelectorAll(".ihmenu:not([hidden])"),function(m){ m.hidden=true; var b=m.parentNode.querySelector('[aria-expanded="true"]'); if(b) b.setAttribute("aria-expanded","false"); }); }
document.addEventListener("click",function(ev){ if(!(ev.target.closest && ev.target.closest(".ihx"))) hlMenusClose(); });
document.addEventListener("keydown",function(ev){ if(ev.key==="Escape") hlMenusClose(); });
/* Happy with it: the monitor mark becomes Handled from today, keeping its note. */
async function hlMonDone(id){
  var s=HLS.find(function(x){return x.id===id;}); if(!s || !DB) return;
  var c=INS_HLMONC[s.key], h={key:s.key, title:(c&&c.title)||s.title, n:c&&c.nowN!=null? c.nowN : s.n, per:s.per};
  await hlSet(h,"handled",(s.note? s.note+" — " : "")+"Monitored from "+niceShort(s.at)+"; happy with how it's working");
}
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.collection("hlweek").onSnapshot(function(s){ HLW.docs={}; s.docs.forEach(function(d){ HLW.docs[d.id]=d.data(); }); HLW.ready=true; hlRedraw(); },
    function(e){ HLW.ready=true; console.warn("hlweek sub",e&&e.code); });
  db.collection("hlstate").onSnapshot(function(s){ HLS=s.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; }); HLS_READY=true; hlRedraw(); },
    function(e){ console.warn("hlstate sub",e&&e.code); });
})();
