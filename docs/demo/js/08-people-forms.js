"use strict";
var PP_OPEN_HTML="", PP_OPEN_ID="";
/* ---------- people (1 Oct) ---------- */
function peopleOfCo(cid){ return people.filter(function(x){return x.companyId===cid;}); }
function ppHow(k){ var x=PP_HOW.filter(function(o){return o[0]===k;})[0]; return x&&k? x[1] : ""; }
function ppCo(x){ var c=x.companyId && companies.find(function(o){return o.id===x.companyId;}); return c? c.name : (x.company||""); }
/* Person helpers for the People tiles (2 Oct). */
function ppCoRec(x){ return companies.find(function(c){ return c.id===x.companyId || (x.company && slug(x.company)===c.id); }) || null; }
function ppLast(x){
  var d=ppMeets(x).filter(function(m){return m.date && m.date<=today();}).map(function(m){return m.date;}).concat(x.lastSpoke? [x.lastSpoke] : []).sort().pop();
  return d||"";
}
function ppNext(x){
  var n=String(x.name||"").toLowerCase();
  return commitments.filter(function(c){ return c.state==="booked" && c.date && c.date>=today() &&
      ((c.personIds||[]).indexOf(x.id)>=0 || (n && (String(c.person||"").toLowerCase().indexOf(n)>=0 || String(c.title||"").toLowerCase().indexOf(n)>=0))); })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); })[0] || null;
}
function ppMeets(x){
  var n=String(x.name||"").toLowerCase(); if(!n) return [];
  var ms=commitments.filter(function(c){ return String(c.person||"").toLowerCase()===n || String(c.title||"").toLowerCase().indexOf(n)>=0; })
    .filter(function(c){ return c.state==="done" || (c.date && c.date<today()); })   /* a meeting later today is not "spoke" yet */
    .map(function(c){ return {date:c.date||"", what:c.title||"Meeting"}; });
  conversations.forEach(function(v){ if(String(v.who||"").toLowerCase().indexOf(n)>=0 && !ms.some(function(m){return m.date===v.date;})) ms.push({date:v.date||"", what:"Notes logged"}); });
  return ms.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
}
function coPeople(c,inCard){
  var ps=peopleOfCo(c.id);
  /* Person tiles (2 Oct): initials, job, how you know them only when it adds something, when you
     last spoke. A warm route is amber. Click opens the person; the dashed tile adds one here. */
  if(inCard){
    var WARM=["referrer","friend","excolleague","ex-colleague","peer"];
    function tile(x){
      var how=ppHow(x.how)||"", role=x.role||"", warm=WARM.indexOf(String(x.how||"").toLowerCase())>=0;
      var ini=String(x.name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w.charAt(0).toUpperCase();}).join("");
      var ms=ppMeets(x), last=ms.filter(function(m){return m.date && m.date<=today();})[0];
      var showHow = how && qaNorm(how)!==qaNorm(role);
      return '<button type="button" class="ptile" data-act="pp_go" data-id="'+esc(x.id)+'" title="Open '+esc(x.name||"")+'">'+
        '<span class="pav'+(warm?" warm":"")+'">'+esc(ini)+'</span><span class="ptx">'+
        '<span class="pnm">'+esc(x.name||x.id)+'</span>'+
        '<span class="pmt">'+esc(role||"Role not known")+'</span>'+
        '<span class="pmt">'+(last? "Last spoke "+esc(niceShort(last.date)) : "Not spoken yet")+'</span>'+
        (showHow? '<span class="ptag'+(warm?" warm":"")+'">'+esc(how)+(warm? " · warm route" : "")+'</span>' : "")+
      '</span></button>';
    }
    return '<div class="ptiles">'+ps.map(tile).join("")+
      '<button type="button" class="ptile padd" data-act="pp_addhere" data-id="'+esc(c.id)+'">+ '+(ps.length? "Someone else here" : "Add someone you know here")+'</button></div>';
  }
  return (ps.length? '<div>'+ps.map(function(x){ return '<div class="chsrc"><span class="nm">'+(x.linkedin? '<a href="'+esc(x.linkedin)+'" target="_blank" rel="noopener">'+esc(x.name)+'</a>' : esc(x.name))+'</span>'+
      '<span class="st">'+(ppHow(x.how)? '<span class="spill sm">'+esc(ppHow(x.how))+'</span>' : "")+'</span><span class="meta">'+esc(x.role||"")+'</span></div>'; }).join("")+'</div>'
    : '<span class="lede" style="font-size:12.5px">Nobody yet.</span>')+
    '<p class="lede" style="font-size:12.5px;margin:8px 0 0"><a href="#" data-gotab="people">Add or edit on Targets › People →</a></p>';
}
function renderPeople(){
  var box=el("pp-list"); if(!box) return;
  if(!people.length){ box.innerHTML='<div class="card empty"><b>Nobody yet.</b>Add the people you know at companies you want.</div>'; return; }
  var hpp=qHit(Q.pp);
  function lastOf(x){ return ppLast(x); }
  var byCo=function(a,b){ return ppCo(a).localeCompare(ppCo(b)) || String(a.name).localeCompare(String(b.name)); };
  var PPSORT={company:byCo,
    last:function(a,b){ return lastOf(b).localeCompare(lastOf(a)) || byCo(a,b); },
    warm:function(a,b){ return ((WARM_HOW[String(b.how||"").toLowerCase()]?1:0)-(WARM_HOW[String(a.how||"").toLowerCase()]?1:0)) || byCo(a,b); },
    added:function(a,b){ return String(b.addedAt||"").localeCompare(String(a.addedAt||"")) || byCo(a,b); },
    name:function(a,b){ return String(a.name||"").localeCompare(String(b.name||"")); }};
  var list=people.filter(function(x){ return !Q.pp || hpp(x.name, ppCo(x), x.role||"", ppHow(x.how)); })
    .sort(PPSORT[SORT.people||"company"]||byCo);
  var cp=el("cnt-pp"); if(cp) cp.textContent = list.length===people.length? people.length+(people.length===1?" person":" people") : list.length+" of "+people.length;
  if(!list.length){ box.innerHTML='<div class="card empty"><b>No match.</b>Nobody matches “'+esc(Q.pp)+'”.</div>'; return; }
  /* Tiles (2 Oct): what matters about a person at a glance — warm route, the live roles at their
     company, when you last spoke and what's next. Click a tile to open it full width. */
  function tile(x){
    var pid="pp-"+x.id, open=isOpen(pid), co=ppCoRec(x), how=ppHow(x.how)||"", role=x.role||"";
    var warm=!!WARM_HOW[String(x.how||"").toLowerCase()];
    var ini=String(x.name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w.charAt(0).toUpperCase();}).join("");
    var live=co? rolesOfCo(co.id).filter(function(r){ return FLIGHT[r.stage]||GATES[r.stage]; }).length : 0;
    var last=ppLast(x), nx=ppNext(x), note=String(x.note||"").split("\n")[0];
    var coHtml = co? '<a href="#" class="pco" data-act="co_go" data-id="'+esc(co.id)+'">'+esc(co.name||ppCo(x))+'</a>' : esc(ppCo(x));
    var tags=(how && (warm || qaNorm(how)!==qaNorm(role))? '<span class="ptag'+(warm?" warm":"")+'">'+esc(how)+(warm? " · warm route" : "")+'</span>' : "")+
      (live? '<span class="ptag live">'+live+' live role'+(live===1?"":"s")+' there</span>' : "");
    var head='<div class="pttop"><span class="pav'+(warm?" warm":"")+'">'+esc(ini)+'</span><span class="ptx"><span class="pnm">'+esc(x.name||x.id)+'</span>'+
      '<span class="pmt">'+esc(role||"Role not known")+(ppCo(x)? ' · '+coHtml : "")+'</span></span>'+
      (x.linkedin? '<a class="pli" href="'+esc(x.linkedin)+'" target="_blank" rel="noopener" title="LinkedIn">in</a>' : "")+'</div>';
    var foot='<div class="ptft"><span>'+(last===today()? "Spoke today" : last? "Last spoke "+esc(niceShort(last)) : "Not spoken yet")+
      (last===today()? "" : ' · <button type="button" class="linkbtn" data-act="pp_spoke" data-id="'+esc(x.id)+'">Spoke today</button>')+'</span>'+
      '<span'+(nx?' class="pnext"':"")+'>'+(nx? "Next: "+esc(niceShort(nx.date)) : "Nothing booked")+'</span></div>';
    /* The open card shows in the side panel (2 Oct); the list keeps the tile, highlighted. */
    var closedH='<div class="ptcard'+(open?" sp-on":"")+'" data-act="pp_tile" data-id="'+esc(x.id)+'" tabindex="0" role="button" aria-expanded="'+open+'">'+head+
      '<div class="ptags">'+tags+'</div><p class="pnote" title="'+esc(note)+'">'+esc(note)+'</p>'+foot+'</div>';
    if(!open) return closedH;
    /* Open card (2 Oct): one header with the actions; About on the left (only what's known, the
       live roles at their company, your note); meetings and tasks on the right. Remove is in the Edit form. */
    var mt=mtBlock("person",x.id).html;
    var stageLab={proposed:"Longlist",consideration:"Shortlist",parked:"Parked",prep:"To apply",applied:"Applied",offer:"Offer"};
    var liveRoles=co? rolesOfCo(co.id).filter(function(r){ return FLIGHT[r.stage]||GATES[r.stage]; }) : [];
    /* Left column in the same pattern as the right (2 Oct): titled sections, fields as label over value. */
    function f(k,v,na){ return '<div class="fact"><div class="k">'+esc(k)+'</div><div class="v'+(v?"":" na")+'">'+(v||esc(na||"not known"))+'</div></div>'; }
    /* Cards, as on the role tabs (2 Oct): an About card on the left, Meetings and Tasks cards on the right. */
    var about='<div class="ivsec ptaboutc"><div class="sechead ivhead"><span class="eyebrow">About</span></div>'+
      '<div class="facts pffacts">'+
        ((how && qaNorm(how)===qaNorm(role))? "" : f("How you know them",how? esc(how) : ""))+f("Their role",role? esc(role) : "")+
        f("Last spoke",last? esc(niceShort(last))+(last===today()? " (today)" : "") : "","not yet")+
        f("Next meeting",nx? esc(niceShort(nx.date)===niceShort(today())? "Today" : niceShort(nx.date))+(nx.time? " · "+esc(String(nx.time).replace(".",":")) : "") : "","nothing booked")+'</div>'+
      '</div>'+
      /* Live roles and the note are cards of their own (2 Oct). */
      '<div class="ivsec"><div class="sechead ivhead"><span class="eyebrow">Live roles'+(ppCo(x)? " at "+esc((co&&co.name)||ppCo(x)) : "")+'</span>'+(liveRoles.length? '<span class="secmeta">'+liveRoles.length+'</span>' : "")+'</div>'+
        (liveRoles.length? '<div class="pfroles">'+liveRoles.map(function(r){
          return '<a href="#" class="pfrole" data-act="role_go" data-id="'+esc(r.id)+'"><span>'+esc(r.title)+'</span><span class="spill sm">'+esc(stageLab[r.stage]||r.stage)+'</span></a>'; }).join("")+'</div>'
          : '<p class="emptyline">'+(co? "No live roles there." : ppCo(x)? "No live roles. "+esc(ppCo(x))+" isn’t a company on the board yet." : "No company recorded.")+'</p>')+'</div>'+
      '<div class="ivsec"><div class="sechead ivhead"><span class="eyebrow">Note</span><span class="secacts">'+(x.note? editBtn("person",x.id) : '<button type="button" class="btn sm" data-act="ed_open" data-k="person" data-id="'+esc(x.id)+'">Add a note</button>')+'</span></div>'+
        (x.note? '<p class="pfnote">'+esc(x.note)+'</p>' : '<p class="emptyline">None yet.</p>')+'</div>';
    var acts=(last===today()? '<span class="pfdone">Spoke today</span>' : '<button type="button" class="btn sm" data-act="pp_spoke" data-id="'+esc(x.id)+'">Spoke today</button>')+
      (x.linkedin? '<a class="btn sm" href="'+esc(x.linkedin)+'" target="_blank" rel="noopener">LinkedIn</a>' : "")+
      editBtn("person",x.id)+
      '<button type="button" class="btn ghost sm ptx2" data-act="pp_tile" data-id="'+esc(x.id)+'" aria-label="Close">✕</button>';
    PP_OPEN_HTML='<div class="ptcard open" data-id="'+esc(x.id)+'">'+
      '<div class="ptoh"><div class="pttop" data-act="pp_tile" data-id="'+esc(x.id)+'"><span class="pav'+(warm?" warm":"")+'">'+esc(ini)+'</span><span class="ptx">'+
        '<span class="pnml"><span class="pnm">'+esc(x.name||x.id)+'</span>'+tags+'</span>'+
        '<span class="pmt">'+esc(role||"Role not known")+(ppCo(x)? ' · '+coHtml : "")+'</span></span></div><span class="ptacts">'+acts+'</span></div>'+
      editBox("person",x.id)+
      '<div class="ivtab ivcards ptgrid">'+about+mt+'</div></div>';
    PP_OPEN_ID=x.id;
    return closedH;
  }
  var grouped = false, html="", lastCo=null;   /* headings tried 2 Oct: one-person companies left half-empty rows */
  list.forEach(function(x){
    if(grouped){ var cn=ppCo(x)||"No company"; if(cn!==lastCo){ lastCo=cn;
      var n=list.filter(function(y){ return (ppCo(y)||"No company")===cn; }).length;
      html+='<div class="ptgrp">'+esc(cn)+' <span>· '+n+(n===1?" person":" people")+'</span></div>'; } }
    html+=tile(x);
  });
  box.className="pptiles"; box.innerHTML=html;
}

/* ---------- compare (1 Oct) ---------- */
var CMP_STAGES={consideration:1, parked:1, prep:1, applied:1, offer:1};
function cmpIds(){
  if(!CMP){ try{ CMP=JSON.parse(localStorage.getItem("gb.cmp")||"null"); }catch(e){} }
  var live=rawRoles.filter(function(r){return CMP_STAGES[r.stage];});
  if(!rawRoles.length) return CMP||[];
  if(!CMP) CMP=live.filter(function(r){return r.stage==="applied"||r.stage==="offer";}).slice(0,3).map(function(r){return r.id;});
  CMP=[0,1,2].map(function(i){ var id=CMP[i]; return id && live.some(function(r){return r.id===id;})? id : ""; });
  return CMP;
}
/* Compare scorers: higher is better; null means nothing to compare. */
var CMPS={
  me: function(r){ return {strong:2,mixed:1,fails:0}[myCrit(r).state]; },
  them: function(r){ var x=fitOf(r); return x? x.pct : null; },
  funshot: function(r){ var c=curScores(r); return (c.f==null||c.s==null)? null : c.f+c.s; },
  rating: function(r){ var c=coOf(r); return {high:3,medium:2,low:1,unrated:null}[(c&&c.priority)||"unrated"]; },
  base: function(r){ var x=payOf(r,"base"); return x? payNum(x.v) : null; },
  total: function(r){ var x=payOf(r,"total"); return x? payNum(x.v) : null; },
  /* Same counting as the Deal-breakers cell, so the highlight matches what it says. */
  rules: function(r){ var g=((r.enrich||{}).gate2Rules)||{}, g9=payState(r), pid=payRuleId(), f=0, u=0;
    ruleIdsOf(g).map(function(id){return [id];}).forEach(function(x){ var v=pid && x[0]===pid && (g9==="pass"||g9==="fail")? g9 : g[x[0]];
      if(v==="fail") f++; else if(!v||v==="unknown") u++; }); return -(f*10+u); }
};
/* Fun and Shot as read-only pips, as on a collapsed role row. */
function cmpPips(r){ var c=curScores(r);
  function row(lab,v){ var h=""; for(var i=1;i<=5;i++) h+='<i class="'+(v===i?"on":"")+'">'+i+'</i>'; return '<span class="cmpfr"><span class="lab">'+lab+'</span><span class="cmppips">'+h+'</span></span>'; }
  return '<span class="cmpfs" title="'+esc((c.f==null||c.s==null)? "Not scored yet" : "Fun "+c.f+" · Shot "+c.s)+'">'+row("Fun",c.f)+row("Shot",c.s)+'</span>'; }
function renderCompare(){
  var pk=el("cmp-pick"), tb=el("cmp-table"); if(!pk||!tb) return;
  var live=rawRoles.filter(function(r){return CMP_STAGES[r.stage];}).sort(function(a,b){
    var o={offer:0,applied:1,prep:2,consideration:3,parked:4}; return o[a.stage]-o[b.stage]; });
  var ids=cmpIds();
  /* Three slots, each a dropdown grouped by stage (1 Oct): chips stop working once there
     are dozens of live roles. */
  var GRP=[["offer","Offer"],["applied","Applied"],["prep","To apply"],["consideration","Shortlist"],["parked","Parked"]];
  /* Each column picks its own role (3 Oct): the picker sits in the column header, so it always lines up
     with the role it controls; a free slot is a narrow "+ Add a role" column on the right. */
  function slotSel(i,cur,first){
    return '<select class="cmpsel" data-cmpslot="'+i+'" aria-label="'+(cur? "Change role "+(i+1) : "Add a role")+'"><option value="">'+(cur? "Remove from compare" : first)+'</option>'+
      GRP.map(function(g){ var rs=live.filter(function(r){return r.stage===g[0];}); if(!rs.length) return "";
        return '<optgroup label="'+g[1]+'">'+rs.map(function(r){ return '<option value="'+esc(r.id)+'"'+(r.id===cur?" selected":"")+'>'+esc((r.company||"No company")+" — "+clip(r.title,40))+'</option>'; }).join("")+'</optgroup>'; }).join("")+'</select>'; }
  pk.innerHTML="";
  var slots=[0,1,2].filter(function(i){ return ids[i] && rawRoles.some(function(r){return r.id===ids[i];}); });
  var rs=slots.map(function(i){ return rawRoles.find(function(r){return r.id===ids[i];}); });
  var free=[0,1,2].filter(function(i){ return slots.indexOf(i)<0; })[0];
  if(!rs.length){ tb.innerHTML= live.length? '<div class="cmpnone"><p class="lede" style="margin:0">Pick up to three roles to compare.</p>'+slotSel(0,"","Choose a role…")+'</div>' : '<p class="lede" style="margin:0">No live processes yet.</p>'; el("cmp-edit").innerHTML=""; return; }
  var addCol= free!=null && live.length>rs.length;
  function val(r,okey,from){ var o=r.offer||{}; if(o[okey]) return esc(o[okey])+payTag("offer"); return from? esc(clip(from,70)) : '<span style="color:var(--faint)">—</span>'; }
  function rules(r){
    var g=((r.enrich||{}).gate2Rules)||{}, all=ruleIdsOf(g).map(function(id){return [id,ruleName(id)];});
    var fails=all.filter(function(x){return g[x[0]]==="fail";}), unk=all.filter(function(x){return !g[x[0]]||g[x[0]]==="unknown";});
    var g9=payState(r), pid=payRuleId(), plab=payLabel();
    if(pid && g9==="fail" && !fails.some(function(x){return x[0]===pid;})) fails=fails.concat([[pid,plab]]);
    unk=unk.filter(function(x){ return !(pid && x[0]===pid && (g9==="pass"||g9==="fail")); });
    return (fails.length? '<span class="bad">Fails '+fails.map(function(x){return x[0]+" ("+esc(x[1])+")";}).join(", ")+'</span>'
      : unk.length? "Still open: "+unk.map(function(x){return x[0]+" ("+esc(x[1])+")";}).join(", ") : '<span style="color:var(--accent)">All pass</span>')+
      (pid && g9==="risk"? '<div class="psrc" style="color:var(--warn)">'+esc(pid+" ("+plab.charAt(0).toLowerCase()+plab.slice(1)+")")+' at risk on the estimate</div>' : "");
  }
  /* Stage and role moved into the column header; rows grouped into sections (2 Oct). */
  var rows=[
    ["§","Fit"],
    /* The two fit headlines lead the comparison (1 Oct), then your own Fun and Shot. */
    ["My criteria", CMPS.me, function(r){ var m=myCrit(r);
      return chip(ME_CLS[m.state]==="none"?"":ME_CLS[m.state], ME_LAB[m.state])+(m.catches.length? '<div class="psrc">'+esc(m.catches[0])+'</div>' : (m.strong.length? '<div class="psrc">'+esc(m.strong.slice(0,2).map(function(h){return h.label;}).join(", "))+'</div>' : "")); }],
    ["Their criteria", CMPS.them, function(r){ var x=fitOf(r), gaps=((r.fit||{}).reqs||[]).filter(function(q){return q.must && q.match==="gap";});
      return (x? '<span class="chip '+x.cls+'">'+(x.rough?"~":"")+x.pct+'% · '+x.band+'</span>'+'<div class="psrc">'+(gaps.length? "Gap: "+esc(gaps[0].text) : "No must-have gaps")+'</div>' : '<span style="color:var(--faint)">Not scored</span>'); }],
    ["Rating", CMPS.rating, function(r){ var c=coOf(r); return esc(PRILABEL[(c&&c.priority)||"unrated"]); }],
    ["§","Money"],
    ["Base", CMPS.base, function(r){ return payCell(r,"base"); }],
    ["Total package", CMPS.total, function(r){ return payCell(r,"total"); }],
    ["Bonus, equity", function(r){ return val(r,"bonus",""); }],
    ["Pension", function(r){ return val(r,"pension",""); }],
    ["Holiday", function(r){ return val(r,"holiday",""); }],
    ["§","Practicalities"],
    ["Office", function(r){ return val(r,"office",r.office); }],
    ["Location", function(r){ return esc(r.location||"—"); }],
    ["Start", function(r){ return val(r,"start",""); }],
    ["Deadline", function(r){ var d=(r.offer||{}).deadline; return d? '<b>'+esc(niceShort(d))+'</b>' : '<span style="color:var(--faint)">—</span>'; }],
    ["§","Deal-breakers"],
    ["Still to clear", CMPS.rules, rules],
    ["", function(r){ return '<button class="btn ghost" style="padding:3px 9px;font-size:12px" data-act="offer_open" data-id="'+esc(r.id)+'">Offer<span class="lg"> details</span></button>'; }]
  ];
  function cell(html){
    var k=html.indexOf('<div class="psrc"'), main=k>=0? html.slice(0,k) : html, sub=k>=0? html.slice(k) : "";
    var tip=(main+" "+sub).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    return '<div class="cv" title="'+tip.replace(/"/g,"&quot;")+'"><span class="cvm">'+main+'</span>'+sub+'</div>';
  }
  var N=rs.length+1+(addCol?1:0), addTd= addCol? '<td class="cmpaddc"></td>' : "";
  tb.innerHTML='<table class="cmpt n'+rs.length+'"><colgroup><col class="cmpk">'+rs.map(function(){return '<col>';}).join("")+(addCol? '<col class="cmpaddk">' : "")+'</colgroup>'+
    '<thead><tr><th></th>'+rs.map(function(r,ci){ return '<td><div class="cmph">'+
      '<label class="cmpchg"><span>Change</span>'+slotSel(slots[ci],r.id,"")+'</label>'+
      '<span class="cmpco">'+esc(r.company||"")+'</span>'+
      '<span class="cmprole" title="'+esc(r.title)+'">'+esc(r.title)+'</span>'+
      '<span class="cmpmeta">'+(r.ref? '<span class="cmpref">#'+esc(r.ref)+'</span>' : "")+stageStatusChip(r)+'</span>'+
      /* One header per role (3 Oct): the fit gauges, Fun and Shot as pips, and the quadrant — the old card row is gone. */
      '<div class="cmpviz">'+fitGauges(r)+'<div class="cmpfsw">'+cmpPips(r)+(function(){ var k=mixKeyOf(r); return '<span class="chip mx-'+esc(k)+'">'+esc(k==="un"? "Not scored" : mixLabel(k))+'</span>'; })()+'</div></div></div></td>'; }).join("")+
    (addCol? '<td class="cmpaddc"><div class="cmpadd"><span>+ Add a role</span>'+slotSel(free,"","Choose a role…")+'</div></td>' : "")+'</tr></thead><tbody>'+
    rows.map(function(row){
      if(row[0]==="§") return '<tr class="cmpsec"><th colspan="'+N+'">'+esc(row[1])+'</th></tr>';
      /* A row may carry a scorer (higher is better). The best cell is highlighted, but only when the
         roles actually differ and at least two have a value (1 Oct). */
      var sc=typeof row[1]==="function" && row.length===3? row[1] : null, fn=row.length===3? row[2] : row[1];
      var vals=sc? rs.map(function(r){ var v=sc(r); return (v==null||isNaN(v))? null : v; }) : [];
      var have=vals.filter(function(v){return v!=null;}), best=have.length>=2? Math.max.apply(null,have) : null;
      var differ=have.length>=2 && have.some(function(v){return v!==best;});
      /* Pay: a stated figure and an estimate aren't comparable, so no "best" unless they're the same kind. */
      if(differ && (row[0]==="Base" || row[0]==="Total package")){ var pk=row[0]==="Base"? "base" : "total";
        var kinds={}; rs.forEach(function(r){ var x=payOf(r,pk); if(x) kinds[x.kind==="estimate"? "est" : "firm"]=1; }); if(Object.keys(kinds).length>1) differ=false; }
      return '<tr'+(row[0]? "" : ' class="cmpfoot"')+'><th>'+esc(row[0])+'</th>'+rs.map(function(r,i){
        var top=differ && vals[i]===best;
        return '<td'+(top?' class="best"':'')+'>'+(row[0]? cell(fn(r)) : fn(r))+'</td>'; }).join("")+addTd+'</tr>'; }).join("")+'</tbody></table>';
  el("cmp-edit").innerHTML="";
}

/* ---------- search boxes (1 Oct) ---------- */
[["q-g1","g1",function(){ renderG1(); }],["q-co","co",function(){ renderCompanies(); }],["q-pp","pp",function(){ renderPeople(); }]].forEach(function(x){
  var i=el(x[0]); if(!i) return; i.addEventListener("input",function(){ Q[x[1]]=i.value.trim(); x[2](); });
});

/* ---------- "Saved" confirmation (1 Oct) ----------
   Every write to the board says whether it landed. One quiet note at the bottom, never a stack. */
var TOAST_T=null;
var QUOTA_T=0;
function toast(msg,bad){
  var t=el("toast"); if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  if(!bad && t.classList.contains("on") && t.querySelector(".toastbtn")) return;
  if(bad && /^Couldn.t save/.test(msg) && Date.now()-QUOTA_T<4000) return;   /* keep the storage-full message */
  t.textContent=msg; t.classList.toggle("bad",!!bad); t.classList.add("on");
  clearTimeout(TOAST_T); TOAST_T=setTimeout(function(){ t.classList.remove("on"); }, bad? 4000 : 1600);
}
function wrapDB(db){
  return { doc:function(path){
    var r=db.doc(path), w={};
    ["set","update","delete"].forEach(function(m){
      w[m]=function(){ var pr=r[m].apply(r,arguments);
        if(pr && pr.then) pr.then(function(){ var off=el("offline"); if(off && !off.hidden && !STORE.dbFull) off.hidden=true; toast(m==="delete"? "Removed" : "Saved"); }, function(e){
          if(e && e.code==="quota_exceeded"){ QUOTA_T=Date.now(); STORE.dbFull=e.message||"a storage cap was reached"; toast("Board storage is full — see How to use › Under the hood",true); storeLive(true); }
          else toast("Not saved — try again",true); });
        return pr; };
    });
    ["get","onSnapshot"].forEach(function(m){ if(typeof r[m]==="function") w[m]=function(){ return r[m].apply(r,arguments); }; });
    return w;
  } };
}

/* ---------- status pills mean one thing everywhere (1 Oct) ----------
   Amber = needs you · grey = waiting on them or the clock · green = done or going well · red = ended.
   Applied after every render, from the pill's own words, so no screen can drift from the scale. */
var PILL_RE=[
  ["mid", /^(gate 1 — gut check|gate 2 — decide|needs you|to do|prep$|prep due|ready to apply|chase|your move|book|score|send|decide|reply due)/i],
  ["weak", /^(dropped|rejected|closed|posting gone|ended|withdrew|turned down)/i],
  ["strong", /^(active|done|prepped|in flight|offer|live roles|accepted)/i],
  ["", /^(booked|waiting|pending|parked|queued for research|watching|in the gates|not planned|every stage|applied|to apply|trial|not searched|the sweep|me|scheduled|interview booked|—|referrer|friend|ex-colleague|recruiter|agency recruiter|talent acquisition|hiring manager|peer \/ advisor|other|unlinked)/i]
];
/* Collapsed Applied dropdown hugs its chosen option. Browsers without field-sizing size a select to its
   longest option, so measure the chosen text instead. */
var RSEL_FS = window.CSS && CSS.supports && CSS.supports("field-sizing","content");
function rselSize(e){
  if(RSEL_FS || !e.classList.contains("rsel")) return;
  var m=document.createElement("span"), cs=getComputedStyle(e);
  m.style.cssText="position:absolute;visibility:hidden;white-space:nowrap;font:"+cs.fontWeight+" "+cs.fontSize+" "+cs.fontFamily;
  m.textContent=(e.options[e.selectedIndex]||{}).text||""; document.body.appendChild(m);
  e.style.width=Math.ceil(m.getBoundingClientRect().width+28)+"px"; m.remove();
}
function pillFix(e){
  if(e.tagName==="SELECT") rselSize(e);
  var t=e.tagName==="SELECT"? (e.options[e.selectedIndex]||{}).text||"" : e.textContent.trim();
  for(var i=0;i<PILL_RE.length;i++){ if(PILL_RE[i][1].test(t)){
    e.classList.remove("warm","mid","strong","weak"); if(PILL_RE[i][0]) e.classList.add(PILL_RE[i][0]); return; } }
}
function pillsAll(root){ Array.prototype.forEach.call((root||document).querySelectorAll(".spill, .spillsel"),pillFix); }
new MutationObserver(function(ms){
  ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes,function(n){ if(n.nodeType!==1) return;
    if(n.matches && n.matches(".spill, .spillsel")) pillFix(n); if(n.querySelectorAll) pillsAll(n); }); });
}).observe(document.body,{childList:true,subtree:true});
document.addEventListener("change",function(ev){ if(ev.target.classList && ev.target.classList.contains("spillsel")) pillFix(ev.target); });

/* ---------- pop-up forms (1 Oct) ---------- */
var FM=null;
function openForm(o){
  FM=o; el("fm-title").textContent=o.title; el("fm-save").textContent=o.ok||"Save"; el("fm-hint").textContent="";
  el("fm-body").innerHTML=(o.lede? '<p class="lede" style="margin:0;font-size:12.5px">'+esc(o.lede)+'</p>' : "")+o.fields.map(function(f){
    return '<label class="fld">'+esc(f.label)+(f.type==="area"? '<textarea id="fm-'+f.id+'" rows="'+(f.rows||4)+'" placeholder="'+esc(f.placeholder||"")+'">'+esc(f.value||"")+'</textarea>'
      : '<input id="fm-'+f.id+'" placeholder="'+esc(f.placeholder||"")+'" value="'+esc(f.value||"")+'">')+'</label>'; }).join("");
  /* Remove sits on the Save row, at the left (2 Oct). */
  var oldDel=el("fm-del"); if(oldDel) oldDel.remove();
  if(o.del){ el("fm-save").insertAdjacentHTML("beforebegin",'<button type="button" class="btn ghost edrm" id="fm-del" style="margin-right:auto">'+esc(o.delLabel||"Remove")+'</button>');
    el("fm-del").addEventListener("click",function(){ var b=el("fm-del"); if(!b.dataset.arm){ b.dataset.arm="1"; b.textContent="Click again to remove"; b.classList.add("danger"); setTimeout(function(){ if(b.isConnected){ delete b.dataset.arm; b.textContent=o.delLabel||"Remove"; b.classList.remove("danger"); } },4000); return; }
      var fn=FM&&FM.del; FM=null; closeDlg("fm-dialog"); if(fn) fn(); }); }
  var d=el("fm-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  setTimeout(function(){ var f=el("fm-"+o.fields[0].id); if(f) f.focus(); },40);
}
el("fm-save").addEventListener("click",function(){
  if(!FM) return; var v={}; FM.fields.forEach(function(f){ var n=el("fm-"+f.id); v[f.id]=n? n.value.trim() : ""; });
  var err=FM.onSave(v); if(err){ el("fm-hint").textContent=err; return; }
  FM=null; closeDlg("fm-dialog");
});
/* Edit-in-a-pop-up: the same editor as everywhere else, hosted in a dialog. Save and Cancel close it. */
function openEdDialog(kind,id,title){
  ED_DLG={key:editKey(kind,id), kind:kind, id:id}; EDITING[ED_DLG.key]=true;
  el("ed-title").textContent=title; syncEdDialog(true);
  var d=el("ed-dialog"); if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
  render();
}
function syncEdDialog(force){
  if(!ED_DLG) return;
  if(!EDITING[ED_DLG.key]){ ED_DLG=null; closeDlg("ed-dialog"); return; }
  var body=el("ed-body"); if(force || !body.querySelector(".editbox")) body.innerHTML=(editBox(ED_DLG.kind,ED_DLG.id,true) || '<p class="lede" style="margin:0">Loading…</p>')+
    (ED_DLG.kind==="conversation"? '<div class="edfoot"><button type="button" class="btn ghost edrm" data-act="convdel" data-cid="'+esc(ED_DLG.id)+'">Remove these notes</button></div>' : "");
}
el("ed-close").addEventListener("click",function(){ if(ED_DLG){ closeEditor(ED_DLG.key); ED_DLG=null; } closeDlg("ed-dialog"); render(); });
el("ed-dialog").addEventListener("close",function(){ if(ED_DLG){ closeEditor(ED_DLG.key); ED_DLG=null; render(); } });
function noteSet(kind,id,i,text){   /* text null removes the note */
  var coll= kind==="co"? "companies" : kind==="sec"? "sectors" : "roles";
  var list= kind==="co"? companies : kind==="sec"? sectors : rawRoles;
  var x=list.find(function(o){return o.id===id;}); if(!x || !DB) return;
  var ns=(x.notes||[]).slice(); if(!ns[i]) return;
  if(text==null) ns.splice(i,1); else ns[i]=Object.assign({},ns[i],{text:text});
  DB.doc(coll+"/"+id).update({notes:ns}).catch(function(e){ console.warn(e); el("offline").hidden=false; });
}
function noteAdd(kind,id,text){
  var coll= kind==="co"? "companies" : kind==="sec"? "sectors" : "roles";
  var list= kind==="co"? companies : kind==="sec"? sectors : rawRoles;
  var x=list.find(function(o){return o.id===id;}); if(!x || !DB) return;
  var ns=(x.notes||[]).slice(); ns.push({at:today(),text:text});
  DB.doc(coll+"/"+id).update({notes:ns}).catch(function(e){ console.warn(e); el("offline").hidden=false; });
}
function addSource(chId,name,url){
  if(url && !/^https?:\/\//i.test(url)) url="https://"+url;
  var ord=Math.max.apply(null,srcs.filter(function(x){return x.channelId===chId;}).map(function(x){return x.order||0;}).concat([0]))+1;
  DB.doc("sources/"+chId+"-"+slug(name)).set({channelId:chId, name:name, url:url||"", status:"active", why:"", note:"", order:ord})
    .catch(function(e){ console.warn(e); el("offline").hidden=false; });
}

/* ---------- Mass review (1 Oct) ----------
   Gate 1 one role at a time, in queue order, a batch of thirty. Accept needs Fun and Shot; Reject needs
   a reason (Other needs a note). Skip leaves it undecided, scores kept. Exit at any point. */
var MR={ids:[], i:0, f:null, s:null, rej:false, why:"", done:{a:0,r:0,k:0}};
function mrRole(){ return rawRoles.find(function(x){return x.id===MR.ids[MR.i];}); }
function mrOpen(){
  var list=roles.filter(function(r){return r.stage==="proposed";}).sort(orderG1).slice(0,30);
  MR={ids:list.map(function(r){return r.id;}), i:0, f:null, s:null, rej:false, why:"", done:{a:0,r:0,k:0}};
  el("mr").hidden=false; document.body.classList.add("mr-on"); window.scrollTo(0,0); mrLoad(); mrPaint();
}
Array.prototype.forEach.call(document.querySelectorAll(".appnav"),function(nav){
  nav.addEventListener("click",function(ev){ if(!el("mr").hidden && ev.target.closest("[data-tab],button,a")) mrClose(); },true);
  nav.addEventListener("change",function(){ if(!el("mr").hidden) mrClose(); },true);
});
function mrClose(){ el("mr").hidden=true; document.body.classList.remove("mr-on"); render(); }
function mrLoad(){ var r=mrRole(); var c=r? curScores(r) : {}; MR.f=r? c.f : null; MR.s=r? c.s : null; MR.rej=false; MR.why=""; MR.sub=""; }
function mrNext(k){ MR.done[k]++; MR.i++; mrLoad(); mrPaint(); window.scrollTo(0,0); }
function mrPaint(){
  var n=MR.ids.length, r=mrRole();
  el("mr-count").textContent = r? ((MR.i+1)+" of "+n) : (n? "Done" : "Empty");
  el("mr-prog").style.width = (n? Math.round(100*Math.min(MR.i,n)/n) : 0)+"%";
  if(!r){
    el("mr-body").innerHTML='<div class="mr-card"><div class="mr-sec"><h2 class="mr-title">'+(n? "Batch done" : "Nothing to review")+'</h2>'+
      '<p class="mr-sum">'+MR.done.a+' sent to the shortlist · '+MR.done.r+' rejected · '+MR.done.k+' skipped.</p></div>'+
      '<div class="mr-sec mr-foot"><span class="sp"></span><button class="btn primary" data-mr="exit">Back to longlist</button></div></div>';
    return;
  }
  var e=r.enrich||{}, sc=function(k,v){ return [1,2,3,4,5].map(function(x){ return '<button type="button" data-mr="'+k+'" data-n="'+x+'" aria-pressed="'+(v===x)+'">'+x+'</button>'; }).join(""); };
  var kf=keyFacts(r).replace(/^<div class="row" style="gap:5px">|<\/div>$/g,""), hl=highlightRow(r), src=srcLabel(r);
  el("mr-body").innerHTML='<div class="mr-card">'+
    '<div class="mr-sec"><div class="mr-th"><h2 class="mr-title">'+esc(r.title)+refTag(r)+'</h2>'+postLink(r)+'<span class="mrchips">'+meChip(r)+fitChip(r)+'</span></div>'+
      '<div class="mr-co">'+esc(r.company)+(src? '<span class="mr-src"> · via '+esc(src)+'</span>' : "")+'</div>'+
      ((kf||hl)? '<div class="mr-chips">'+kf+hl+'</div>' : "")+
      (e.summary? '<p class="mr-sum">'+esc(clip(e.summary,400))+'</p>' : "")+
      (closingLabel(r)? '<span class="eyebrow" style="display:block;margin-top:10px">'+esc(closingLabel(r))+'</span>' : "")+'</div>'+
    '<div class="mr-sec"><div class="mr-gh"><span class="eyebrow">Gut check</span><span class="hint">Fun to do · shot at getting it</span></div>'+
      '<div class="mr-sc"><div class="mr-scl"><span class="eyebrow">Fun</span><span class="scrow">'+sc("f",MR.f)+'</span></div>'+
      '<div class="mr-scl"><span class="eyebrow">Shot</span><span class="scrow">'+sc("s",MR.s)+'</span></div></div></div>'+
    (MR.rej? '<div class="mr-sec mr-rej"><span class="eyebrow">Your call</span><div class="reasons">'+END_LISTS.me.map(function(x){
        return '<button type="button" data-mr="why" data-r="'+esc(x)+'" aria-pressed="'+(MR.why===x)+'"'+endGlossAttr(x)+'>'+esc(x)+'</button>'; }).join("")+'</div>'+
        endSubHtml(MR.why,"mr-sub",{v:MR.sub, nw:MR.subNew})+
        '<span class="eyebrow">Or it\u2019s gone</span><div class="reasons">'+END_LISTS.neither.filter(function(x){return x!=="Other";}).map(function(x){
        return '<button type="button" data-mr="why" data-r="'+esc(x)+'" aria-pressed="'+(MR.why===x)+'">'+esc(x)+'</button>'; }).join("")+'</div>'+
        '<input id="mr-note" placeholder="Note — needed for Other" style="font-size:14px">'+
        (function(){ var c=coOf(r);
          /* No card yet (11 Oct): offer Rule out, which creates a bare off-list card. */
          if(!c && coNameOk(r)) return '<label class="fld" style="margin-top:4px">And '+esc(r.company)+'?<select id="mr-corate" data-new="1">'+
            '<option value="keep">Keep seeing roles from '+esc(r.company)+'</option><option value="stop">Rule out '+esc(r.company)+' — no more roles from them</option></select></label>'+
            '<input id="mr-costop" placeholder="Why rule them out? — needed if you do" style="font-size:14px">';
          if(!c || coOff(c) || coRating(c)!=="unrated") return "";
          /* Rating at rejection (5 Oct): an unrated company is rated before its role can be rejected. */
          return '<label class="fld" style="margin-top:4px">Rate '+esc(c.name||r.company||"the company")+' — required<select id="mr-corate" data-id="'+esc(c.id)+'">'+
            '<option value="">Pick one</option><option value="high">Want it — board checked every sweep</option><option value="medium">Would consider — board checked weekly</option>'+
            '<option value="low">If it appears — alerts and searches only</option><option value="stop">Ruled out — no more roles from them</option></select></label>'+
            '<input id="mr-costop" placeholder="Why rule them out? — needed if you do" style="font-size:14px">'; })()+
        '<div><button type="button" class="btn sm" data-act="rl_open" data-id="'+esc(r.id)+'" title="Claude drafts a deal-breaker from this reason; you edit and save">Rule out roles like this</button></div>'+
        '<span class="statushint" id="mr-hint"></span></div>'+
        '<div class="mr-sec mr-foot"><button class="btn ghost" data-mr="rejback">Back</button><span class="sp"></span><button class="btn danger primary" data-mr="rejyes"'+(MR.why?"":" disabled")+'>Reject role</button></div>'
     : '<div class="mr-sec mr-foot"><button class="btn ghost" data-mr="skip" title="Decide later">Skip</button><span class="sp"></span>'+
        '<button class="btn danger" data-mr="rej">Reject</button>'+
        '<button class="btn primary" data-mr="acc"'+((MR.f!=null&&MR.s!=null)?"":" disabled title=\"Score Fun and Shot first\"")+'>Send to shortlist</button></div>')+
  '</div>';
}
el("mr-open").addEventListener("click",mrOpen);
el("mr-exit").addEventListener("click",mrClose);
el("mr").addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-mr]"); if(!b) return;
  var k=b.dataset.mr, r=mrRole();
  if(k==="exit"){ mrClose(); return; }
  if(!r) return;
  var c=curScores(r);
  function scorePatch(){ var p={}; if(MR.f!=null && MR.f!==c.f) p[c.ff]=MR.f; if(MR.s!=null && MR.s!==c.s) p[c.sf]=MR.s; return p; }
  if(k==="f"){ MR.f=+b.dataset.n; mrPaint(); return; }
  if(k==="s"){ MR.s=+b.dataset.n; mrPaint(); return; }
  if(k==="rej"){ MR.rej=true; mrPaint(); return; }
  if(k==="rejback"){ MR.rej=false; MR.why=""; mrPaint(); return; }
  if(k==="why"){ if(MR.why!==b.dataset.r){ MR.sub=""; MR.subNew=""; } MR.why=b.dataset.r; var nt=el("mr-note"), keep=nt? nt.value : "", kr=el("mr-corate")? el("mr-corate").value : "", kw=el("mr-costop")? el("mr-costop").value : ""; mrPaint(); if(el("mr-note")) el("mr-note").value=keep; if(el("mr-corate")) el("mr-corate").value=kr; if(el("mr-costop")) el("mr-costop").value=kw; return; }
  if(!DB) return;
  if(k==="skip"){ var sp=scorePatch(); if(Object.keys(sp).length) DB.doc("roles/"+r.id).update(sp).catch(function(e){console.warn(e);}); mrNext("k"); return; }
  if(k==="acc"){
    if(MR.f==null||MR.s==null) return;
    if(MR.busy) return; MR.busy=true;
    DB.doc("roles/"+r.id).update(Object.assign(scorePatch(),{stage:"consideration", g1At:today()})).then(function(){ MR.busy=false; mrNext("a"); })
      .catch(function(e){ console.warn(e); MR.busy=false; var h=el("mr-hint"); if(h) h.textContent="Couldn't save — try again."; toast("Couldn't save — try again",true); });
    return;
  }
  if(k==="rejyes"){
    var nv=(el("mr-note")&&el("mr-note").value.trim())||"";
    if(!MR.why) return;
    if(MR.why==="Other" && !nv){ el("mr-hint").textContent="Other needs a short note."; return; }
    var sub=endSubRead(MR.why,"mr-sub"); if(!sub.ok){ el("mr-hint").textContent=sub.err; return; }
    var cr=el("mr-corate"), crv=cr? cr.value : "", cwhy=(el("mr-costop")&&el("mr-costop").value.trim())||"";
    if(cr && !crv){ el("mr-hint").textContent="Rate the company first — it decides how often the sweep checks them."; return; }
    if(crv==="stop" && !cwhy){ el("mr-hint").textContent="Say why you are ruling the company out."; return; }
    if(sub.newGap) addGap(sub.newGap);
    var newCo={};
    if(cr && cr.dataset.new==="1"){ if(crv==="stop"){ var ro=coRuleOutNew(r,cwhy); if(!r.companyId) newCo.companyId=ro.id; } }
    else if(cr && crv){ var cid=cr.dataset.id;
      if(crv==="stop") saveCo(cid,{watch:false, listing:"rejected", offNote:cwhy, offAt:today(), watchWhy:"Not searched \u2014 "+cwhy});
      else saveCo(cid,{priority:crv, watch:rateWatch(crv)}); }
    if(MR.busy) return; MR.busy=true;
    DB.doc("roles/"+r.id).update(Object.assign(scorePatch(),newCo,{stage:"g1_rejected", g1Reason:MR.why, g1Note:nv, g1At:today(),
      endBy:(END_LISTS.neither.indexOf(MR.why)>=0 && MR.why!=="Other")? "neither" : "me", endReason:MR.why, endNote:nv, endRule:sub.patch.endRule||"", endGap:sub.patch.endGap||"", endAt:today(), endStage:"Gate 1", endStagesDone:0})).then(function(){ MR.busy=false; mrNext("r"); })
      .catch(function(e){ console.warn(e); MR.busy=false; var h=el("mr-hint"); if(h) h.textContent="Couldn't save — try again."; toast("Couldn't save — try again",true); });
    return;
  }
});
document.addEventListener("keydown",function(ev){ if(ev.key==="Escape" && !el("mr").hidden) mrClose(); });

/* ---------- Fun and Shot before a role moves on (1 Oct) ----------
   Accept at Gate 1 and Send to prep at Gate 2 ask for both scores first, in a pop-up, then carry on. */
var SC_DO=null, SC_V={f:null,s:null};
function scPaint(){
  ["fun","shot"].forEach(function(k){ var v=k==="fun"? SC_V.f : SC_V.s;
    el("sc-"+k).innerHTML=[1,2,3,4,5].map(function(n){ return '<button type="button" data-sc="'+k+'" data-n="'+n+'" aria-pressed="'+(v===n)+'">'+n+'</button>'; }).join(""); });
  el("sc-yes").disabled = SC_V.f==null || SC_V.s==null;
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-sc]"); if(!b) return;
  if(b.dataset.sc==="fun") SC_V.f=+b.dataset.n; else SC_V.s=+b.dataset.n; scPaint();
});
function needScores(t){
  var a=t.dataset.act; if(a!=="accept" && a!=="g2prep") return null;
  var r=rawRoles.find(function(x){return x.id===t.dataset.id;}); if(!r) return null;
  var c=curScores(r); return (c.f==null||c.s==null)? {r:r,c:c} : null;
}
el("sc-no").addEventListener("click",function(){ SC_DO=null; closeDlg("sc-dialog"); });
el("sc-yes").addEventListener("click",function(){ var go=SC_DO; SC_DO=null; closeDlg("sc-dialog"); if(go) go(); });
