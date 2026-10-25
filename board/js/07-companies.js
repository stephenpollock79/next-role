"use strict";
/* ---------- companies ---------- */
var LISTLABEL = {queue:"seat unverified", ruling:"needs your ruling", excluded:"deal-breaker",
                 defunct:"employer may be gone", rejected:"you rejected it", offlist:"off-list"};
var LISTWHY = {
  queue:   "In the research queue — no suitable role for you verified there yet. It is still searched, because a suitable role appearing on their own board answers that question for free.",
  ruling:  "A rule does not map onto how this employer staffs roles, so it needs a decision from you rather than a lookup. Still searched in the meantime.",
  excluded:"The whole business trips a deal-breaker — region, sector or ethics. This is the ONLY reason a company stops being searched, because a staffing fact can change and these cannot.",
  defunct: "The employer may not exist or is reportedly closing, so searching it cannot produce a row. Not a rule failure — it goes back to searched on any sign of trading and hiring.",
  rejected:"Rejected by you. Nothing else reaches this state: an agent may flag a concern but it may not reject a company.",
  offlist: "Arrived from a job board rather than the company-led axis, so its priority does not feed the queue ordering."
};
/* Targets cards (2 Oct): every sub-tab is cards with a header row, full width by default,
   two half-width cards side by side when a pair is short enough to share a row. */
function tc(t,sub,right,inner,half){ return '<div class="fithd tcard'+(half?" half":"")+'">'+boxHead(t,sub,right)+inner+'</div>'; }
function tpair(a,b){   /* a, b: [title, sub, right, inner] or null — two halves, or one full */
  if(a && b) return tc(a[0],a[1],a[2],a[3],true)+tc(b[0],b[1],b[2],b[3],true);
  var x=a||b; return x? tc(x[0],x[1],x[2],x[3]) : "";
}
function tpara(label,v){ return v? '<div><span class="eyebrow">'+esc(label)+'</span><p style="margin:3px 0 0;font-size:13.5px;color:var(--ink-2);white-space:pre-wrap">'+esc(v)+'</p></div>' : ""; }
function tlist(arr,cls){ arr=(arr||[]).filter(Boolean); return arr.length? '<ul class="qlist tbul'+(cls?" "+cls:"")+'">'+arr.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul>' : ""; }
function tnone(t){ return '<p class="emptyline">'+esc(t)+'</p>'; }
function renderCompanies(){
  var box=el("co-list"); if(!box) return;
  /* No count on Companies. Every other number in that row is work waiting on you; the company
     figure is scale, and in the same style it read as the same kind of number. The counts that
     matter are on the filter chips inside the tab, where they say what they are. */

  /* A snapshot on any collection re-renders this tab, so carry any half-typed note across. */
  var drafts={};
  Array.prototype.forEach.call(box.querySelectorAll("textarea[id^='con-']"),function(t){
    if(t.value) drafts[t.id]=t.value;
  });

  var needs=companies.filter(function(c){return c.reconcile;});
  var rb=el("co-recon");
  if(rb) rb.innerHTML = needs.length
    ? '<div class="card panel" style="margin-bottom:18px;border-color:var(--accent)">'+
      '<div class="eyebrow" style="margin-bottom:6px">'+needs.length+' need'+(needs.length===1?"s":"")+' a decision from you</div>'+
      '<ul class="qlist">'+needs.map(function(c){
        return '<li><strong>'+esc(c.name)+'</strong> — '+esc(c.reconcile)+'</li>';}).join("")+'</ul></div>'
    : "";

  /* Four groups, each answering a different question — which is the whole point of retiring
     tier. In flight and In the gates are DERIVED from role state, so a closed posting drops a
     company out without anyone editing it. Watching is your standing decision. Researched only
     is the cache: kept so the research is never repeated, even when nothing is live. */
  /* FILTERS, not partitions. 28 Sep: "i feel a company need to be able to appear in a few
     places. In flight. but also in watching for new roles. These should not be exclusive." The user is
     right — role state and watch state are independent, so every card carries both as chips and
     these narrow the list rather than dividing it. One card per company, so there is never a
     question of which copy you are editing. */
  var FILTERS = [
    {k:"all",     label:"All",              test:function(){ return true; }},
    {k:"flight",  label:"To apply or applied", test:function(c){ return coState(c.id).k==="flight"; }},
    {k:"gates",   label:"Longlist or shortlist", test:function(c){ return coState(c.id).k==="gates"; }},
    {k:"watch",   label:"Searched",         test:function(c){ return coWatch(c); }},
    {k:"rated",   label:"Prioritised",      test:function(c){ return (c.priority||"unrated")!=="unrated"; }},
    {k:"unrated", label:"Unrated",          test:function(c){ return (c.priority||"unrated")==="unrated"; }},
    {k:"warm",    label:"Warm route",       test:function(c){ return coWarm(c); }},
    {k:"flagged", label:"Needs a decision", test:function(c){ return !!c.reconcile; }},
    {k:"nosearch",label:"Not searched",     test:function(c){ return !coWatch(c); }}
  ];
  function coSort(a,b){
    /* live work first, then appetite, then a warm route, then alphabetical */
    var ar=({flight:0,gates:1,none:2})[coState(a.id).k], br=({flight:0,gates:1,none:2})[coState(b.id).k];
    if(ar!==br) return ar-br;
    var aw=coWatch(a)?0:1, bw=coWatch(b)?0:1; if(aw!==bw) return aw-bw;
    var ap=priRank(a), bp=priRank(b); if(ap!==bp) return ap-bp;
    if(!!b.warm!==!!a.warm) return b.warm?1:-1;
    return String(a.name||"").localeCompare(String(b.name||""));
  }

  /* Company card on the role-card pattern (1 Oct): name and sector, status top right, priority
     as the quick control; open = controls block, then Overview · Research · Questions · Meetings. */
  function card(c){
    var st=coState(c.id), rs=st.all, live=st.roles, cid="co-"+c.id;
    var stat = coTop(c.id);
    /* Rating (5 Oct): your view of the company, settable on every company, off-list ones included.
       The sweep's behaviour is worked out from it (coCadence); there is no separate Sweep In/Out. */
    var pv = coRating(c);
    var pri = '<select class="prisel p-'+esc(pv)+'" data-act="co_pri" data-id="'+esc(c.id)+'" title="Your rating — it also sets how often the sweep checks their job board">'+
      RATE_ORDER.map(function(k){ return '<option value="'+k+'"'+(pv===k?" selected":"")+'>'+esc(PRILABEL[k])+'</option>'; }).join("")+'</select>';
    var L=c.listing||"target";

    /* Controls (5 Oct): Rating (which sets how often the sweep checks the board), How it's read, and a small
       chart of its roles by stage. Warm route is worked out from People; Remove lives in the Edit form. */
    var chart=coChart(coStages(c.id));
    var cad=coCadence(c), rd=coReadOf(c);
    var controls='<div class="shead compact cotl coctl">'+
      '<div class="coctl-f"><span class="eyebrow">Rating</span>'+pri+
        '<span class="coctl-why">'+esc(cad.txt)+(coWarm(c)? ' · <b class="cowarm">Warm route</b>' : "")+'</span>'+
        (coOff(c)? '<span class="coctl-why cooffwhy">'+esc(coOffWhy(c))+'</span>' : "")+'</div>'+
      '<div class="coctl-f"><span class="eyebrow">How it’s read</span>'+
        '<span class="coread r-'+esc(rd.k)+'">'+esc(rd.lab)+'</span>'+
        '<span class="coctl-why">'+esc(rd.txt)+'</span>'+
        (rd.k==="needs"? '<button type="button" class="btn sm" data-coalert="'+esc(c.id)+'">Alert set</button>' : "")+'</div>'+
      '<div class="coctl-f coctl-chart"><span class="eyebrow">Roles</span>'+chart+'</div>'+
      '<div class="rejbox" id="corm-'+esc(c.id)+'">'+
        '<span class="statushint">'+(live.length? "Roles here still use this research. Removing it loses that." : "This removes the company research for good.")+'</span>'+
        '<div class="statusacts">'+sbtn("co_rmyes",c.id,"Remove "+(c.name||""),"danger")+sbtn("co_rmno",c.id,"Keep it","")+'</div></div>'+
    '</div>';

    /* Overview */
    var stLab={proposed:"Longlist",consideration:"Shortlist",parked:"Parked",prep:"To apply",applied:"Applied",offer:"Offer",closed:"Closed",g1_rejected:"Dropped from longlist",g2_rejected:"Dropped from shortlist"};
    var sc=secOfCo(c);
    var searchCard = (c.watch||c.watchWhy||L!=="target")? [c.watch? "Why it’s searched" : "Why it’s not searched", c.watch? "The sweep looks for roles here" : "The sweep skips it", "",
        (c.watch||c.watchWhy? '<p style="margin:0;font-size:13.5px;color:var(--ink-2)">'+esc(c.watchWhy||"No reason recorded.")+'</p>' : "")+
        (L!=="target"? '<p style="margin:0;font-size:13px;color:var(--ink-2)"><b>'+esc(LISTLABEL[L]||L)+'.</b> '+esc(LISTWHY[L]||"")+'</p>' : "")] : null;
    var rolesCard = ["Roles here","On the board","", rs.length? '<div class="corows">'+rs.map(function(r){
          return '<div class="comeet"><span class="cmt-t">'+esc(r.title)+refTag(r)+'</span><span class="cmt-w"></span><span class="spill sm">'+esc(stLab[r.stage]||r.stage)+'</span></div>'; }).join("")+'</div>'
        : tnone("None on the board.")];
    var overview = '<div class="tcards">'+
      tc("Details","Who they are",editBtn("company",c.id),editBox("company",c.id)+
        (c.reconcile? '<div class="notice warn" style="font-size:12.5px"><b>Needs a decision:</b> '+esc(c.reconcile)+'</div>' : "")+
        (c.summary? '<p style="margin:0;font-size:13.5px;color:var(--ink-2)">'+esc(c.summary)+'</p>' : "")+
        '<div class="facts">'+fact("Sector",c.sector)+(sc? fact("Sector card",sc.name) : "")+fact("Size",c.size)+fact("HQ",c.hq)+fact("Sites",c.sites)+fact("Office days",coOfficeTxt(c))+
          fact("Researched",c.checkedAt||"not yet")+(coWarm(c)? fact("Warm route",coWarmPeople(c).map(function(x){return x.name;}).join(", ")||c.warmNote||"yes") : "")+'</div>')+
      tpair(rolesCard,searchCard)+'</div>';

    /* Research: Fields (collapsed sections) and Notes */
    /* Plain sections, not collapsible (1 Oct): the fields are short now. Collapse only lists that can grow. */
    function fsec(label,body){ return body? '<div class="ovsec"><span class="eyebrow">'+esc(label)+'</span>'+body+'</div>' : ""; }
    function fp(v){ return v? '<p style="margin:0;font-size:13.5px;color:var(--ink-2)">'+esc(v)+'</p>' : ""; }
    var ii=c.interviewIntel||{};
    var rsch=[tpara("Company health",c.health),tpara("What it is like inside",c.culture),tpara("Pay",c.comp),tpara("The ladder",c.ladder),tpara("AI",c.ai)].join("");
    var fields = '<div class="tcards">'+
      tc("Company research","What it’s like to work there",editBtn("company",c.id),editBox("company",c.id)+
        (rsch? '<div class="tcols">'+rsch+'</div>' : tnone("Not researched yet — this fills in when a role here reaches the shortlist.")))+
      tpair(["Pluses","What counts in its favour","",tlist(c.green,"pos")||tnone("None noted yet.")],["Concerns","What counts against it","",tlist(c.red,"neg")||tnone("None noted yet.")])+
      (((ii.stages||[]).length||ii.notes)? tc("How they interview","Their usual process","",
        ((ii.stages||[]).length? '<p style="margin:0;font-size:13.5px;color:var(--ink)">'+esc(ii.stages.join(" → "))+'</p>' : "")+fp(ii.notes)) : "")+
      '</div>';
    var notes=(c.notes||[]);
    var notesTab = '<div class="tcards">'+tc("Notes","Anything that doesn’t fit the research",noteBtn("co",c.id),noteList(notes,"co_delnote",c.id)||tnone("None yet."))+'</div>';
    var research = subTabs(cid+"/res",[
      {k:"fields", label:"Fields", html: fields},
      {k:"notes", label:"Notes", n: notes.length||"", html: notesTab}
    ],"fields");

    /* Questions */
    var cq=c.questions||[], sq=(sc&&sc.questions)||[];
    var questions = '<div class="tcards">'+
      tc("Ask once, covers every role here","Answers here show on every "+(c.name||"")+" role",editBtn("coq",c.id,"Edit"),
        editBox("coq",c.id)+qaList(null,"company",c.id,cq,"None recorded.",{k:"company",id:c.id}))+
      (sc? tc(sc.name||"This sector","Ask in every interview in this sector · answers kept for "+(c.name||"this company"),editBtn("secq",sc.id,"Edit for the sector"),
        editBox("secq",sc.id)+qaList(null,"company",c.id,sq,"None yet.",{k:"sector",id:sc.id})) : "")+'</div>';

    /* Meetings: about the company only (1 Oct). Role meetings stay on the role cards. */
    var isCo=function(m){ return !m.roleId && m.org && (slug(m.org)===c.id || String(m.org).toLowerCase()===String(c.name||"").toLowerCase()); };
    /* Also any meeting a company note points at, even if it was filed under a role (1 Oct). */
    var noteMeets=conversations.filter(function(v){ return v.companyId===c.id && !v.roleId && v.meetingId; }).map(function(v){return v.meetingId;});
    /* Meetings and tasks (1 Oct, evening): the company's own, plus every one on its roles. */
    var cms=[];
    var mtB=mtBlock("company",c.id,rs.map(function(r){return r.id;}));
    var ccv=conversations.filter(function(v){ return v.companyId===c.id && !v.roleId; }).sort(byDateDesc);
    var rids=rs.map(function(r){return r.id;});
    var roleMeets=commitments.filter(function(m){ return m.state!=="recurring" && rids.indexOf(m.roleId)>=0; }).length;
    var lab={booked:"Booked",done:"Done",offered:"Waiting",conditional:"Pending"};
    /* Each meeting is a collapsed row like an interview stage — what it is and status on top, date
       below — with its notes inside. Notes not tied to a meeting sit in their own collapsed section. */
    var used=mtB.used;
    var meetings = '<div class="ivtab ivcards">'+mtB.html+(cms.length? '<div class="stages">'+cms.map(function(m){
          var late=m.state==="booked" && m.date && m.date<today();
          var stt=late? "Not logged" : (lab[m.state]||m.state);
          var cls=late? "weak" : m.state==="done"? "strong" : m.state==="booked"? "warm" : m.state==="offered"? "mid" : "";
          var ns=notesOfMeeting(m).concat(ccv.filter(function(v){ return !v.meetingId && v.date && v.date===m.date; }));
          ns.forEach(function(v){ used[v.id]=1; });
          var key="com~"+m.id;
          return '<details class="stage" data-sk="'+esc(key)+'"'+(STAGEOPEN[key]?" open":"")+'><summary class="stsum">'+
              '<span class="stname" title="'+esc(m.title||"")+'">'+esc(m.title||"Meeting")+'</span>'+
              '<span class="spill '+cls+' ststat">'+esc(stt)+'</span>'+
              '<span class="sttype"><span class="chip">'+esc(m.person||m.org||"")+'</span></span>'+
              '<span class="chip code stwhen">'+esc(m.date? niceShort(m.date)+(m.time? " · "+m.time : "") : (m.blockedBy||"no date yet"))+'</span>'+
            '</summary><div class="stbody">'+
              '<div class="stsec" style="border-top:none;padding-top:0"><span class="eyebrow">Meeting notes'+(ns.length? " · "+ns.length : " · none yet")+'</span>'+
                ns.map(function(v){return convEntry(v,false);}).join("")+
                '<div class="statusacts">'+logBtn("",c.id,ns.length? "Add more notes" : "Add notes","",m.id)+'</div></div>'+
              (m.detail? '<div class="stsec"><span class="eyebrow">Detail</span><p style="margin:0;font-size:13px;color:var(--ink-2)">'+esc(m.detail)+'</p></div>' : "")+
            '</div></details>';
        }).join("")+'</div>' : "")+
      (function(){ var loose=ccv.filter(function(v){return !used[v.id];});
        return loose.length? '<div class="ivsec">'+ivHead("Other notes","",'')+foldRow("coloose~"+c.id,"Not tied to a meeting",String(loose.length),loose.map(function(x){return convEntry(x,false);}).join(""))+'</div>' : ""; })()+
      '</div>';
    var nMeet=mtB.n;

    var body=cardTabs({id:cid}, controls, [
      {k:"overview", label:"Overview", html: overview},
      {k:"research", label:"Research", html: research},
      {k:"questions", label:"Questions", n:(cq.length+sq.length)||"", html: questions},
      {k:"meetings", label:"Meetings & tasks", n: nMeet||"", html: meetings},
      {k:"people", label:"People", n: peopleOfCo(c.id).length||"", html: '<div class="tcards">'+tc("People at "+(c.name||""),"Who you know there",
        '<button type="button" class="btn sm" data-act="pp_addhere" data-id="'+esc(c.id)+'">+ Add a person</button>',coPeople(c,true))+'</div>'}
    ], "overview");

    return '<article class="role cocard"><div class="rail '+(coWarm(c)?"warmrail":"")+'"></div><div class="role-body">'+
      '<details class="rcard" data-id="'+esc(cid)+'"'+(isOpen(cid)?" open":"")+'>'+
        '<summary>'+
          '<span class="rsum-title">'+esc(c.name)+'</span>'+
          '<span class="rsum-status"><span class="eyebrow">Roles</span><span class="spill sm '+stat[1]+'">'+esc(stat[0])+'</span></span>'+
          '<span class="rsum-sub">'+
            '<span class="rsum-co" title="'+esc(c.sector||"")+'">'+esc(c.sector||"")+'</span>'+
            '<span class="copri"><span class="eyebrow">Rating</span>'+pri+'</span>'+
          '</span>'+
        '</summary>'+
        '<div class="rbody">'+body+'</div>'+
      '</details>'+
    '</div></article>';
  }

  var searched = companies.filter(function(c){return c.watch;}).length;
  var done     = companies.filter(function(c){return c.checkedAt;}).length;
  var unrated  = companies.filter(function(c){return (c.priority||"unrated")==="unrated";}).length;
  var summary = "";   /* counts live on the filter chips (1 Oct) */

  /* Two filter rows (1 Oct). Sweep: what the search does with a company. Roles: where its most
     advanced role sits, exclusive so the steps add up to the total. Warm route, researched and
     needs-a-decision filters were dropped; a decision shows as the banner above when one exists. */
  function flowOf2(c){ var st=coState(c.id); return st.k==="flight"? "flight" : st.k==="gates"? "gates" : st.all.length? "ended" : "none"; }
  var T={
    sweep:{every:function(c){return coCadence(c).k==="every";}, weekly:function(c){return coCadence(c).k==="weekly";}, never:function(c){return coCadence(c).k==="never";}},
    rate:{rated:function(c){return (c.priority||"unrated")!=="unrated";}, unrated:function(c){return (c.priority||"unrated")==="unrated";}},
    flow:{none:function(c){return flowOf2(c)==="none";}, gates:function(c){return flowOf2(c)==="gates";}, flight:function(c){return flowOf2(c)==="flight";}, ended:function(c){return flowOf2(c)==="ended";}}
  };
  var hco=qHit(Q.co);
  /* Toolbar filters (2 Oct): three dropdowns — Sweep, Roles, Priority — with counts in each menu. */
  T.rate={high:function(c){return coRating(c)==="high";}, medium:function(c){return coRating(c)==="medium";}, low:function(c){return coRating(c)==="low";},
    unrated:function(c){return coRating(c)==="unrated";}, off:function(c){return coOff(c);}};
  if(CO_F.rate && !T.rate[CO_F.rate]) CO_F.rate="";
  function pass(c){ return (!Q.co || hco(c.name, c.aka||"", c.sector||"")) && ["sweep","rate","flow"].every(function(g){ return !CO_F[g] || T[g][CO_F[g]](c); }); }
  function fsel(g,label,opts){
    var n=function(k){ return companies.filter(T[g][k]).length; };
    return '<label class="tbsel'+(CO_F[g]?" on":"")+'"><span>'+esc(label)+'</span><select data-cof="'+g+'" aria-label="'+esc(label)+'">'+
      '<option value="">Any</option>'+opts.map(function(o){ return '<option value="'+o[0]+'"'+(CO_F[g]===o[0]?" selected":"")+'>'+esc(o[1])+' · '+n(o[0])+'</option>'; }).join("")+'</select></label>';
  }
  var fb=el("co-filters");
  if(fb) fb.innerHTML=fsel("sweep","Board checked",[["every","Every sweep"],["weekly","Once a week"],["never","Never"]])+
    fsel("flow","Roles",[["none","No roles"],["gates","Longlist or shortlist"],["flight","To apply or applied"],["ended","Ended"]])+
    fsel("rate","Rating",[["high","Want it"],["medium","Would consider"],["low","If it appears"],["unrated","Unrated"],["off","Ruled out"]]);
  var COSORT={suggested:coSort,
    priority:function(a,b){ return (priRank(a)-priRank(b)) || String(a.name||"").localeCompare(String(b.name||"")); },
    roles:function(a,b){ return (rolesOfCo(b.id).length-rolesOfCo(a.id).length) || coSort(a,b); },
    warm:function(a,b){ return ((coWarm(b)?1:0)-(coWarm(a)?1:0)) || coSort(a,b); },
    researched:function(a,b){ return String(b.checkedAt||"").localeCompare(String(a.checkedAt||"")) || coSort(a,b); },
    name:function(a,b){ return String(a.name||"").localeCompare(String(b.name||"")); }};
  var shown  = companies.filter(pass).slice().sort(COSORT[SORT.companies||"suggested"]||coSort);
  var cc=el("cnt-co"); if(cc) cc.innerHTML=(shown.length===companies.length? companies.length+" companies" : shown.length+" of "+companies.length)+
    ((CO_F.sweep||CO_F.rate||CO_F.flow||Q.co)? ' · <button type="button" class="linkbtn" data-act="co_f" data-g="" data-k="">Clear</button>' : "");
  var chips="";

  box.innerHTML = companies.length
    ? summary + chips +
      (function(){
        /* Off the list (5 Oct): kept, never deleted, in a collapsed section at the bottom. Change the rating to bring one back. */
        var on=shown.filter(function(c){return !coOff(c);}), off=shown.filter(coOff);
        if(!shown.length) return '<p class="lede" style="margin:0">Nothing matches that filter.</p>';
        return on.map(card).join("")+(off.length? '<details class="cooff" id="co-offlist"'+(CO_OFF_OPEN||CO_F.rate==="off"? " open" : "")+'><summary><span>Ruled out</span><span class="cooffn">'+off.length+'</span>'+
          '<span class="cooffs">Never searched. Kept so the research and your reasons stay; change the rating to bring one back.</span></summary>'+off.map(card).join("")+'</details>' : "");
      })()
    : '<p class="lede" style="margin:0">No companies yet. They get created by a shortlist research pass, or add one below.</p>';
  Object.keys(drafts).forEach(function(k){ var t=el(k); if(t) t.value=drafts[k]; });
}

/* ---------- confirm before anything destructive (1 Oct) ----------
   Intercepts the click in the capture phase, asks, and on yes replays it on the same button (found
   again by its attributes, in case a data refresh re-rendered it meanwhile). */
var CF_PASS=null, CF_DO=null;
function cfName(list,id){ var x=(list||[]).find(function(o){return o.id===id;}); return x? (x.name||x.title||"") : ""; }
var CONFIRM = {
  cmtdel: function(t){ var series=/series/i.test(t.textContent);
    return {title: series? "Remove every occurrence?" : "Remove this meeting?", msg: (cfName(commitments,t.dataset.cid)? "“"+cfName(commitments,t.dataset.cid)+"”. " : "")+"Notes logged against it stay, but lose the link."}; },
  sessdel: function(t){ return {title:"Remove this session?", msg:"Notes logged against it stay, but lose the link."}; },
  convdel: function(){ return {title:"Remove these meeting notes?", msg:"This can't be undone."}; },
  co_delnote: function(){ return {title:"Remove this note?", msg:"This can't be undone."}; },
  sec_delnote: function(){ return {title:"Remove this note?", msg:"This can't be undone."}; },
  pp_rm: function(t){ return {title:"Remove "+(cfName(people,t.dataset.id)||"this person")+"?", msg:"Meetings with them stay."}; },
  role_delnote: function(){ return {title:"Remove this note?", msg:"This can't be undone."}; },
  src_rm: function(t){ return {title:"Remove "+(cfName(srcs,t.dataset.id)||"this source")+"?", msg:"Roles it found keep their record, shown as a removed source.", armed:1}; },
  ch_rm: function(t){ return {title:"Remove the "+(cfName(channels,t.dataset.id)||"")+" channel?", msg:"Its sources go too. Roles keep their record, shown as removed.", armed:1}; },
  sec_rm: function(t){ return {title:"Remove "+(cfName(sectors,t.dataset.id)||"this sector")+"?", msg:"Its research goes for good. Conversations stay, but lose the link.", armed:1}; },
  co_rmopen: function(t){ var live=rolesOfCo(t.dataset.id).length;
    return {title:"Remove "+(cfName(companies,t.dataset.id)||"this company")+"?", msg:(live? "Roles here still use this research. Removing it loses that." : "This removes the company research for good."),
      replay: function(){ return document.querySelector('#corm-'+t.dataset.id.replace(/"/g,"")+' [data-act="co_rmyes"]'); }}; },
  ed_cancel: function(t){ var box=t.closest(".editbox"), d=box && DRAFTS[box.dataset.edkey];
    return d && Object.keys(d).length? {title:"Discard your changes?", msg:"What you've typed in this editor will be lost.", ok:"Discard"} : null; },
  sk_rm: function(t){ var it=SKILLS&&(SKILLS.items||[]).find(function(x){return x.id===t.dataset.id;}); return {title:"Remove "+(it? it.name : "this skill")+"?", msg:"The Role Fit score and packs stop using it."}; },
  fit_rm: function(){ return {title:"Remove this requirement?", msg:"The fit score is worked out again without it."}; },
  pm_merge: function(t){ var b=rawRoles.find(function(x){return x.id===t.dataset.cid;}), a=rawRoles.find(function(x){return x.id===t.dataset.id;});
    return {title:"Merge these two roles?", msg:"Your role"+(a? " “"+(a.title||"")+"”" : "")+" keeps its source, notes and scores, and takes the advert’s link. The advert row"+(b&&b.ref? " #"+b.ref : "")+" is removed.", ok:"Merge"}; }
};
function cfFind(t){
  var sel=["act","id","cid","i","d"].filter(function(k){return t.dataset[k]!=null;})
    .map(function(k){ return '[data-'+k+'="'+String(t.dataset[k]).replace(/"/g,'\\"')+'"]'; }).join("");
  return (t.isConnected? t : null) || (sel? document.querySelector(sel) : null) || (t.id? el(t.id) : null);
}
document.addEventListener("click",function(ev){
  var t=ev.target.closest && ev.target.closest("[data-act]"); if(!t) return;
  if(t===CF_PASS){ CF_PASS=null; return; }
  var ns=needScores(t);
  if(ns){
    ev.preventDefault(); ev.stopImmediatePropagation();
    SC_V={f:ns.c.f, s:ns.c.s}; el("sc-role").textContent=ns.r.company+" — "+ns.r.title; el("sc-role").dataset.id=ns.r.id; scPaint();
    SC_DO=function(){
      var patch={}; if(ns.c.f==null) patch[ns.c.ff]=SC_V.f; if(ns.c.s==null) patch[ns.c.sf]=SC_V.s;
      if(!DB) return;
      DB.doc("roles/"+ns.r.id).update(patch).then(function(){
        Object.assign(ns.r,patch); var bb=cfFind(t); if(!bb) return; CF_PASS=bb; bb.click(); CF_PASS=null;
      }).catch(function(e){ console.warn(e); el("offline").hidden=false; });
    };
    var sd=el("sc-dialog"); if(sd.showModal) sd.showModal(); else sd.setAttribute("open","");
    return;
  }
  var f=CONFIRM[t.dataset.act]; if(!f) return;
  var c=f(t); if(!c) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  el("cf-title").textContent=c.title; el("cf-msg").textContent=c.msg||""; el("cf-yes").textContent=c.ok||"Remove";
  CF_DO=function(){
    var b = c.replay? c.replay() : cfFind(t); if(!b) return;
    if(c.armed) b.dataset.armed="1";
    CF_PASS=b; b.click(); CF_PASS=null;
  };
  var d=el("cf-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  setTimeout(function(){ el("cf-no").focus(); },30);
},true);
el("cf-no").addEventListener("click",function(){ CF_DO=null; closeDlg("cf-dialog"); });
el("cf-yes").addEventListener("click",function(){ var go=CF_DO; CF_DO=null; closeDlg("cf-dialog"); if(go) go(); });
el("cf-dialog").addEventListener("close",function(){ CF_DO=null; });

/* ---------- pasted links (1 Oct) ----------
   Every link in the pasted text becomes a Gate 2 role. LinkedIn links carry title and company in the
   address; careers-site links carry the company. Text of 200+ characters after a link is kept as that
   role's posting text — the fallback for LinkedIn-only roles. The morning run does the rest. */
var SMALLW={and:1,of:1,the:1,at:1,in:1,for:1,to:1,a:1,"&":1};
var UPW={ai:"AI",crm:"CRM",uk:"UK",ux:"UX",ui:"UI",b2b:"B2B",b2c:"B2C",ii:"II",iii:"III",sr:"Sr",vp:"VP",api:"API",ml:"ML",emea:"EMEA",saas:"SaaS",hr:"HR",it:"IT",ios:"iOS",pm:"PM"};
function titleCase(sl){ return String(sl||"").split(/[-_ ]+/).filter(Boolean).map(function(w,i){
  var l=w.toLowerCase(); if(UPW[l]) return UPW[l]; if(i && SMALLW[l]) return l; return l.charAt(0).toUpperCase()+l.slice(1); }).join(" "); }
function slugClean(sl){ var t=String(sl||""); try{ t=decodeURIComponent(t); }catch(e){} return t.replace(/[®™©]/g,"").replace(/[^\w\s-]+/g,"").trim(); }
function coFromSlug(sl){
  sl=slugClean(sl);
  var bare=sl.replace(/\d+$/,"");
  var c=companies.find(function(x){ return x.boardUrl && new RegExp("[/.]"+sl.replace(/[^a-z0-9-]/gi,"")+"([/.?]|$)","i").test(x.boardUrl); }) ||
    companies.find(function(x){ return [sl,bare].some(function(k){ return x.id===k || slug(x.name||"")===k || (x.aka && slug(x.aka)===k); }); });
  sl=bare||sl;
  return c? {name:c.name, id:c.id} : {name:titleCase(sl), id:slug(sl)};
}
function parseJobUrl(raw){
  var u; try{ u=new URL(raw); }catch(e){ return null; }
  var h=u.hostname.replace(/^www\./,""), path=u.pathname.split("/").filter(Boolean), out={url:raw, title:"", co:null, key:""};
  if(/(^|\.)linkedin\.com$/.test(h)){
    var jid=u.searchParams.get("currentJobId"), slugPart="";
    var vi=path.indexOf("view"); if(vi>=0 && path[vi+1]){ var m=path[vi+1].match(/^(.*?)-?(\d{6,})$/); if(m){ slugPart=m[1]; jid=m[2]; } else if(/^\d+$/.test(path[vi+1])) jid=path[vi+1]; }
    if(!jid) return out;
    out.key="li:"+jid; out.url="https://www.linkedin.com/jobs/view/"+(slugPart? slugPart+"-" : "")+jid+"/";
    if(slugPart){ var at=slugPart.lastIndexOf("-at-"); if(at>0){ out.title=titleCase(slugPart.slice(0,at)); out.co=coFromSlug(slugPart.slice(at+4)); } else out.title=titleCase(slugPart); }
    return out;
  }
  out.url=u.origin+u.pathname+(u.searchParams.get("gh_jid")? "?gh_jid="+u.searchParams.get("gh_jid") : "");
  /* The key keeps query values that name the job (id=, jk=, jobId=, req=…), so ads served from one path with
     ?id=123 don't all share a key (25 Oct: nine different roles were flagged as duplicates of each other). */
  var idq=[]; u.searchParams.forEach(function(v,k){ if(/^(gh_jid|id|jk|vjk|jobid|job_id|job|jid|req|reqid|requisitionid|posting|postingid|vacancy|vacancyid|ref|pid)$/i.test(k) && v) idq.push(k.toLowerCase()+"="+v); });
  out.key=(u.origin+u.pathname).replace(/\/+$/,"").toLowerCase()+(idq.length? "?"+idq.sort().join("&").toLowerCase() : "");
  var sub=h.split(".")[0], csl="";
  if(/greenhouse\.io$/.test(h)||/lever\.co$/.test(h)||/ashbyhq\.com$/.test(h)) csl=path[0]||"";
  else if(/workable\.com$/.test(h)) csl= path[0]==="j"? "" : (path[0]||"");
  else if(/(teamtailor|recruitee|bamboohr|breezy|personio|applytojob|pinpointhq|workday)/.test(h)) csl=sub;
  else if(pasteSrcFor(raw)){
    /* A job board you check (5 Oct): the site isn't the employer. Take the title from the path where it is
       written out (…/job/product-manager-ai/11068548); the company comes from the morning read. */
    var ji=path.findIndex(function(x){ return /^jobs?$/i.test(x); }), seg=ji>=0? path[ji+1] : "";
    if(seg && /[a-z].*-/i.test(seg) && !/^\d+$/.test(seg)) out.title=titleCase(slugClean(seg));
    return out;
  }
  else csl=h.replace(/^(careers|jobs|apply|join)\./,"").split(".")[0];
  if(csl) out.co=coFromSlug(csl);
  return out;
}
function roleKey(r){ var p=r.url? parseJobUrl(r.url) : null; return p? p.key : ""; }
/* Each pasted link credits the site it came from (5 Oct): a link whose web address matches one of the sites you check
   yourself (a source in a channel run by you, not dropped) goes to that source; only the rest take "Found through". */
function pasteHost(u){ try{ return new URL(u).hostname.toLowerCase().replace(/^www\./,""); }catch(e){ return ""; } }
function pasteKey(v){ return String(v||"").toLowerCase().replace(/[^a-z0-9]/g,""); }
/* The site's own name, ignoring subdomain and ending (8 Oct): app.acmejobs.com and uk.acmejobs.com
   are both "acmejobs"; acme.co and acme.com are both "acme". Two-part endings (co.uk and the like) skipped. */
var PASTE_SFX2={"co.uk":1,"org.uk":1,"ac.uk":1,"gov.uk":1,"me.uk":1,"com.au":1,"co.nz":1,"co.in":1,"com.br":1,"co.za":1};
function pasteBrand(h){ var p=String(h||"").split(".").filter(Boolean); if(p.length<2) return "";
  var k=(p.length>=3 && PASTE_SFX2[p.slice(-2).join(".")])? p.length-3 : p.length-2; return pasteKey(p[k]||""); }
function pasteSrcFor(u){
  var lh=pasteHost(u); if(!lh) return null;
  var hit=null;
  /* Boards that link straight to the employer's page tag the link instead (5 Oct): ref= or utm_source=, e.g.
     ref=acmejobs. Matched against each manual source's site name (acmejobs.com -> acmejobs) or its name. */
  var tag=""; try{ var q=new URL(u).searchParams; tag=pasteKey(q.get("ref")||q.get("utm_source")||""); }catch(e){}
  if(tag) srcs.forEach(function(x){
    if(hit || x.status==="dropped") return;
    var ch=chById(x.channelId); if(!ch || ch.kind!=="manual") return;
    var h=pasteHost(x.url||""), stem=pasteKey(h.split(".")[h.split(".").length>2? 1 : 0]);
    if((stem && stem.length>=4 && (tag===stem || tag.indexOf(stem)===0)) || tag===pasteKey(x.name)) hit=x;
  });
  if(hit) return hit;
  srcs.forEach(function(x){
    if(hit || (!x.url && !(x.hosts||[]).length) || x.status==="dropped") return;
    var ch=chById(x.channelId); if(!ch || ch.kind!=="manual") return;
    [pasteHost(x.url||"")].concat(x.hosts||[]).forEach(function(h){ if(hit || !h) return;
      if(lh===h || lh.slice(-h.length-1)==="."+h || h.slice(-lh.length-1)==="."+lh) hit=x; });
  });
  if(hit) return hit;
  /* Same site name, different subdomain or ending. Names of four letters or more only, so short ones don't collide. */
  var lb=pasteBrand(lh); if(!lb || lb.length<4) return null;
  srcs.forEach(function(x){
    if(hit || (!x.url && !(x.hosts||[]).length) || x.status==="dropped") return;
    var ch=chById(x.channelId); if(!ch || ch.kind!=="manual") return;
    [pasteHost(x.url||"")].concat(x.hosts||[]).forEach(function(h){ if(!hit && h && pasteBrand(h)===lb) hit=x; });
  });
  return hit;
}
async function pasteAdd(){
  if(!DB) return;
  var txt=el("paste-box").value||"", src=el("paste-src").value||"", hint=el("paste-hint");
  var re=/https?:\/\/[^\s<>"')\]]+/g, m, hits=[];
  while((m=re.exec(txt))) hits.push({u:m[0].replace(/[.,;]+$/,""), at:m.index, end:m.index+m[0].length});
  if(!hits.length){ hint.textContent="No links found in that text."; return; }
  hits.forEach(function(h){ h.det=pasteSrcFor(h.u); });
  var unk=hits.filter(function(h){ return !h.det; }).length;
  if(unk){
    /* Each unrecognised link has its own pick (5 Oct): PASTE_PICK[url], set from the list under the box. */
    var miss=hits.filter(function(h){ return !h.det && !PASTE_PICK[h.u]; }).length;
    if(miss){ hint.textContent="Pick where you found "+(miss===1? "the link" : "each of the "+miss+" links")+" listed above."; return; }
    var lastPick=PASTE_PICK[hits.filter(function(h){ return !h.det; }).pop().u];
    try{ localStorage.setItem("gb.pastesrc",lastPick); }catch(e){}
  }
  var tally={};
  var have={}; rawRoles.forEach(function(r){ var k=roleKey(r); if(k) have[k]=1; });
  var added=0, dup=0, seenNow={}, writes=[];
  hits.forEach(function(h,i){
    var p=parseJobUrl(h.u); if(!p) return;
    if(p.key && (have[p.key]||seenNow[p.key])){ dup++; return; }
    if(p.key) seenNow[p.key]=1;
    var after=txt.slice(h.end, i+1<hits.length? hits[i+1].at : txt.length).trim();
    var co=p.co||{name:"Unknown company", id:""}, title=p.title||"New role";
    var pick=PASTE_PICK[h.u]||src;
    var rsrc=h.det? h.det.id : (pick==="ch:companies" && co.id)? "co:"+co.id : pick;
    var tk=h.det? h.det.name : pasteSrcName(pick); tally[tk]=(tally[tk]||0)+1;
    var id=slug(co.name+"-"+title)+"-"+Date.now().toString(36).slice(-3)+i;
    writes.push(DB.doc("roles/"+id).set({
      title:title, company:co.name, companyId:co.id||slug(co.name), url:p.url, linkChecked:"", source:"self", seen:today(),
      stage:"proposed", sourceId:rsrc, channelId:chOfSrc(rsrc), readState:"waiting", readTries:0, readReason:"",
      pasted: after.length>=200? after : "", titleGuess: !p.title, addedVia:"paste",
      fun:null, shot:null, highlights:[], green:[], red:[], enrich:{}, referral:""
    }));
    added++;
  });
  writes=writes.concat(pasteRemember(hits));
  Promise.all(writes).then(function(){
    var tl=Object.keys(tally).map(function(k){ return tally[k]+" "+k; }).join(", ");
    hint.textContent= added? (added+" added"+(tl? ": "+tl : "")+(dup? ". "+dup+" already on the board" : "")+".") : (dup? "All "+dup+" are already on the board." : "Nothing added.");
    if(added){ el("paste-box").value=""; setTimeout(pastePreview,2300); setTimeout(function(){ closeDlg("add-dialog"); },2200); }
  }).catch(function(e){ console.warn(e); el("offline").hidden=false; hint.textContent="Not saved — "+((e&&e.code)||"the write failed")+"."; });
}
el("paste-add").addEventListener("click",pasteAdd);
/* Live read of the paste box (5 Oct): say which links were recognised; list each one that isn't, with its own
   dropdown of channels and sources (default: the last one used). The single "Found through" picker stays hidden. */
var PASTE_PICK={}, PASTE_KEEP={};
function pasteSrcName(id){
  if(!id) return "";
  if(id.indexOf("ch:")===0){ var c=chById(id.slice(3)); return c? c.name : id.slice(3); }
  var x=srcs.find(function(z){ return z.id===id; }); return x? x.name : id;
}
function pasteOpts(sel){
  return chSorted().filter(function(c){ return c.status!=="dropped" && c.derived!=="flags"; }).sort(function(a,b){ return (a.kind==="manual"?0:1)-(b.kind==="manual"?0:1); }).map(function(c){
    var items= c.derived? [] : chItems(c).filter(function(x){ return x.status!=="dropped"; });
    var o='<option value="ch:'+esc(c.id)+'"'+(sel==="ch:"+c.id? " selected" : "")+'>'+esc(c.name)+(c.derived==="companies"? " (the company's own site)" : items.length? " — other" : "")+'</option>';
    return '<optgroup label="'+esc(c.name)+'">'+items.map(function(x){ return '<option value="'+esc(x.id)+'"'+(sel===x.id? " selected" : "")+'>'+esc(x.name)+'</option>'; }).join("")+o+'</optgroup>';
  }).join("");
}
function pasteShort(u){ try{ var x=new URL(u), p=x.pathname.replace(/\/$/,"").split("/").filter(Boolean); return x.hostname.replace(/^www\./,"")+(p.length? " / "+p.slice(-2).join("/") : ""); }catch(e){ return u; } }
function pastePreview(){
  var box=el("paste-sp"), txt=el("paste-box").value||"", re=/https?:\/\/[^\s<>"')\]]+/g, m, n=0, tally={}, unk=[];
  while((m=re.exec(txt))){ n++; var u=m[0].replace(/[.,;]+$/,""), x=pasteSrcFor(u); if(x) tally[x.name]=(tally[x.name]||0)+1; else if(unk.indexOf(u)<0) unk.push(u); }
  var info=el("paste-det");
  if(!info){ info=document.createElement("div"); info.id="paste-det"; box.parentNode.insertBefore(info,box); }
  box.hidden=true;
  if(!n){ info.innerHTML=""; return; }
  var last=""; try{ last=localStorage.getItem("gb.pastesrc")||""; }catch(e){}
  if(last && !pasteSrcName(last)) last="";
  unk.forEach(function(u){ if(!PASTE_PICK[u] && last) PASTE_PICK[u]=last; });
  var known=Object.keys(tally).map(function(k){ return tally[k]+" "+k; }).join(", ");
  info.innerHTML='<p class="statushint" style="margin:0 0 6px">'+(unk.length? (known? "Recognised: "+esc(known)+". " : "")+"Where did you find "+(unk.length===1? "this one" : "these "+unk.length)+"?" : "All "+n+" recognised: "+esc(known)+". No source to pick.")+'</p>'+
    (unk.length? '<div class="pastepick">'+unk.map(function(u){
      return '<div class="pprow"><span class="ppurl" title="'+esc(u)+'">'+esc(pasteShort(u))+'</span>'+
        '<select data-ppu="'+esc(u)+'"><option value="">Pick a source…</option>'+pasteOpts(PASTE_PICK[u]||"")+'</select>'+
        /* Only once a real source is picked (8 Oct): remembering ties this site to that source. */
        '<label class="ppkeep" data-ppkeepl="'+esc(u)+'" title="Recognise links from '+esc(pasteHost(u))+' as this source from now on"'+(pasteRealSrc(PASTE_PICK[u])? "" : " hidden")+'><input type="checkbox" data-ppkeep="'+esc(u)+'"'+(PASTE_KEEP[u]? " checked" : "")+'> Remember '+esc(pasteHost(u))+' for next time</label></div>';
    }).join("")+'<p class="statushint" style="margin:4px 0 0">Not listed? Add the source under Sourcing first.</p></div>' : "");
}
document.addEventListener("change",function(ev){ var t=ev.target; if(!t || !t.matches) return;
  if(t.matches("select[data-ppu]")){ var u=t.dataset.ppu; PASTE_PICK[u]=t.value;
    var row=t.closest(".pprow"), lab=row && row.querySelector("[data-ppkeepl]"), real=pasteRealSrc(t.value);
    if(lab){ lab.hidden=!real; if(real && PASTE_KEEP[u]===undefined){ PASTE_KEEP[u]=true; var cb=lab.querySelector("input"); if(cb) cb.checked=true; } } }
  if(t.matches("input[data-ppkeep]")) PASTE_KEEP[t.dataset.ppkeep]=t.checked; });
/* Remember this site: add the link's site to the chosen source's `hosts`, so it's recognised next time.
   Only a real source can remember a site (not "<channel> — other"). */
function pasteRealSrc(id){ return !!id && id.indexOf("ch:")!==0 && srcs.some(function(z){ return z.id===id; }); }
function pasteRemember(hits){
  var add={};
  hits.forEach(function(h){ var pick=PASTE_PICK[h.u]; if(h.det || !PASTE_KEEP[h.u] || !pick || pick.indexOf("ch:")===0) return;
    var host=pasteHost(h.u); if(host) (add[pick]=add[pick]||{})[host]=1; });
  return Object.keys(add).map(function(id){ var x=srcs.find(function(z){ return z.id===id; }); if(!x) return null;
    var hs=(x.hosts||[]).slice(); Object.keys(add[id]).forEach(function(k){ if(hs.indexOf(k)<0) hs.push(k); });
    x.hosts=hs; return DB.doc("sources/"+id).update({hosts:hs}); }).filter(Boolean);
}
el("paste-box").addEventListener("input",pastePreview);


/* Manual passes, worked out: a day you added roles yourself, plus any "nothing new" taps. */
function renderManualPasses(){
  var box=el("manual-passes"), eb=el("lastrun"); if(!box) return;
  var days={};
  rawRoles.forEach(function(r){ if(r.source!=="self" || !r.seen) return;
    var d=days[r.seen]=days[r.seen]||{n:0,src:{},note:""}; d.n++;
    var lab=srcLabel(r); if(lab) d.src[lab.split(" › ").pop()]=1; });
  runs.forEach(function(x){ if(x.type!=="manual" || !x.date) return;
    var d=days[x.date]=days[x.date]||{n:0,src:{},note:""};
    String(x.channels||"").split(",").forEach(function(c){ c=c.trim(); if(c) d.src[c]=1; });
    d.n+=(+x.proposed||0); if(x.note) d.note=x.note; });
  var ks=Object.keys(days).sort().reverse();
  if(eb) eb.textContent = ks[0]? "last on "+niceShort(ks[0]) : "none yet";
  box.innerHTML = ks.length? '<div class="mplist">'+ks.slice(0,30).map(function(k){ var d=days[k];
      return '<div class="mpass"><span class="d">'+esc(niceShort(k))+'</span><span class="s">'+esc(Object.keys(d.src).join(", ")||"Not recorded")+(d.note? '<span class="mnote">'+esc(d.note)+'</span>' : "")+'</span>'+
        '<span class="n'+(d.n? "" : " zero")+'">'+(d.n? d.n+" added" : "Nothing new")+'</span></div>'; }).join("")+'</div>'
    : '<p class="emptyline">None yet. Roles you add yourself show up here by day.</p>';
}

/* Read states for links you added (1 Oct): waiting → read, or needs you with a reason. */
var READWHY={login:"Login wall", gone:"Page gone", blocked:"Blocked", notfound:"Not found elsewhere"};
function needsRead(r){ return r.readState==="needs"; }
function readBox(r){
  if(r.readState==="waiting"){ var what=r.pasted? "the posting text you pasted" : r.spec? "the spec file" : "the link";
    return '<p class="emptyline" style="margin-bottom:10px">Queued for research. The next morning\u2019s run reads '+what+', then researches it.</p>'; }
  if(!needsRead(r)) return "";
  var why=READWHY[r.readReason]||r.readReason||"Couldn\'t read it";
  return '<div class="readbox needs"><span class="eyebrow" style="color:var(--warn)">Needs you · '+esc(why)+'</span>'+
    '<span style="font-size:13px">The morning run couldn\'t read this posting. Paste its text and it will research from that.</span>'+
    '<div class="statusacts"><button class="btn primary" data-act="rd_open" data-id="'+esc(r.id)+'">Paste the posting text</button>'+
    (r.readReason==="gone"? sbtn("rejopen",r.id,"Close — posting gone","ghost") : "")+'</div></div>';
}
var G2_NEEDS=false;
