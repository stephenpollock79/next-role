"use strict";
/* ---------- PIPELINE ---------- */
/* ---- instruments ---- */
function daysSince(d){ if(!d) return null; return dayGap(d, today()); }

var MANUAL_SIG="";
function renderManualChannels(){
  var h=el("manual-ch"); if(!h) return;
  /* Only rebuild when the names change, so taps already made survive a data refresh. */
  var sig=manualNames().join("|"); if(sig===MANUAL_SIG && h.children.length) return; MANUAL_SIG=sig;
  h.innerHTML=manualNames().map(function(c){
    return '<button type="button" class="rulechk" data-act="mch" aria-pressed="false">'+
      '<span class="mark">\u00b7</span><span class="lbl">'+esc(c)+'</span></button>';
  }).join("");
}

/* ---------- the collapsed row ---------- */
/* Every chip says what it is in words and carries WHY it matters on hover. the user's own rule about
   their numbered schemes applies here too: a bare code or a bare "warm" means nothing without the
   document open, and the few extra characters cost nothing. */
function chip(cls,label,why){
  return '<span class="chip '+cls+'"'+(why?' title="'+esc(why)+'"':"")+'>'+label+'</span>';
}
var WHY={
  warm:  "Someone inside would put your name forward. The largest single input to Shot \u2014 nothing else on the row carries it.",
  close: "A closing date outranks every other ordering key \u2014 it is the only one where waiting destroys the option.",
  red:   "Concern \u2014 worth knowing; its absence means nothing.",
  green: "Plus \u2014 rare, positive, and it only ever adds.",
  link:  "No link to the employer's own board. Aggregators discover, boards verify \u2014 the Viator listing outlasted its source.",
  unsc:  "No Fun or Shot entered yet.",
  score: "Fun: does this sound like a job you would want to do. Shot: how likely they are to hire you \u2014 not whether you would do it well.",
  band:  "A preference, rated. It describes the role; nothing is added up and nothing is ranked by it."
};
function roleShell(r, idx, lead, body, quick){
  /* The rail marks a referral and nothing else. Company priority still orders the queue; it is
     not shown, because a label whose meaning lives in another document is noise on a row. */
  var rail=r.warm?"warmrail":"";
  return '<article class="role"><div class="rail '+rail+'"></div><div class="role-body">'+
    '<details class="rcard" data-id="'+esc(r.id)+'"'+(isOpen(r.id)?" open":"")+'>'+
      '<summary>'+
        (idx!=null? '<span class="role-idx">'+String(idx).padStart(2,"0")+'</span>' : "")+
        '<span class="rsum-title" title="'+esc(r.title)+'">'+closeBang(r)+'<span class="rtt">'+esc(r.title)+'</span>'+refTag(r)+'</span>'+postLink(r)+scoreChipOf(r)+liveChipOf(r)+meChip(r)+fitChip(r)+fitDuo(r)+fitGauges(r)+
        '<span class="rsum-status"><span class="eyebrow">Status</span>'+stageStatusChip(r)+
          ((r.stage==="applied"||r.stage==="offer")? flowSelect(r,null,"rsel") : "")+'</span>'+
        /* Collapsed row, every stage (30 Sep): role + ad link and company on the left, status
           top right, actions bottom right. No tags — they live in the open card. */
        '<span class="rsum-sub">'+
          '<span class="rsum-co" title="'+esc(r.company)+'">'+esc(r.company)+'</span>'+
          (quick||"")+
        '</span>'+
      '</summary>'+
      '<div class="rbody">'+
        body+'</div>'+
    '</details>'+
  '</div></article>';
}
/* A control inside <summary> opens and closes the card on every interaction unless the event is
   stopped before the summary sees it. */
["click","mousedown","keydown"].forEach(function(evt){
  document.addEventListener(evt,function(ev){
    if(ev.target.closest && ev.target.closest(".prisel,.postlink,.rsel")) ev.stopPropagation();
  },true);
});
/* Collapsed-row Gate 1 buttons: cancel the summary's open/close, but let the click reach the main
   handler (it listens on document too, so stopping propagation here would stop the action). Reject
   needs a reason, so it opens the card at the existing reason picker. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest(".qacts [data-act]"); if(!b) return;
  ev.preventDefault();
  if(b.dataset.act==="rejopen"){
    var d=b.closest("details.rcard"); if(d) d.open=true;
    setTimeout(function(){ var bx=el("rej-"+b.dataset.id); if(bx) bx.scrollIntoView({block:"center",behavior:"smooth"}); },0);
  }
},true);

/* toggle does not bubble — capture it */
document.addEventListener("toggle",function(ev){
  var d=ev.target;
  if(!d || !d.classList || !d.classList.contains("rcard") || !expanded) return;
  if(d.open) expanded.add(d.dataset.id); else expanded.delete(d.dataset.id);
},true);
/* About me's folded company and sector lists keep their state across re-renders. */
document.addEventListener("toggle",function(ev){
  var d=ev.target; if(!d || !d.dataset || !d.dataset.exp || !expanded) return;
  if(d.open) expanded.add(d.dataset.exp); else expanded.delete(d.dataset.exp);
},true);

/* A role is "interviewing" when something has actually been booked or logged against it.
   Derived, never stored — a stage you have to remember to move is a stage that goes stale. */
function sessionsFor(id){ return commitments.filter(function(c){return c.roleId===id;}); }
/* Only a meeting that happened (done, or booked in the past) or logged notes count (QA 14 Oct): an offered or
   unplanned slot used to make a close read "after interviewing". */
function isInterviewing(r){ var t=today();
  return sessionsFor(r.id).some(function(c){ return c.state==="done" || (c.state==="booked" && c.date && c.date<=t); }) || convsFor(r.id).length>0; }

function quadOf(f,s){ return (f>=4?"h":"l")+(s>=4?"h":"l"); }

/* ---------- Closed (was Rejected; 2 Oct) ----------
   "Rejected" read as "they turned me down"; Closed covers all three endings. Three levels:
     1. two matching bar charts, where it ended and how it ended, and the one-line read;
     2. the three endings side by side, each with its reasons;
     3. one table of every closed role, collapsed, filtered by Where → How → Reason. Any bar sets the
        filters and opens the table.
   Rows come from closed roles plus the folded longlist records (decided.items: title, company, reason
   word, Fun, Shot; dated by the fold, read-only). Older folds kept only as counts still count in the
   charts but have no rows. */
var CL_STAGES=["Gate 1","Gate 2","After applying","After interviewing"];
var CL_HOW={me:"I said no", them:"They said no", neither:"Went away"};
var CL_TITLE={me:"I said no", them:"They said no", neither:"Ended another way"};
var CLF={where:"", how:"", reason:""};
function closedData(){
  var rows=[];
  roles.forEach(function(r){ var e=endOf(r); if(!e) return;
    var c=curScores(r);
    rows.push({id:r.id, ref:r.ref, title:r.title||"", company:r.company||"", where:e.stage, how:e.by||"me", reason:e.reason||"Other",
      note:e.note||"", at:e.at||"", f:c.f, s:c.s, live:r.stage==="closed"}); });
  var extra={};   /* counts with no row: "how|reason" -> n */
  decided.forEach(function(d){
    var rs=d.reasons||{}, seen={};
    (d.items||[]).forEach(function(it){ var lw=legacyEnd(it.reason,"me");
      rows.push({id:"", ref:"", title:it.title||"", company:it.company||"", where:"Gate 1", how:lw[0], reason:lw[1], note:it.note||"",
        at:d.date||"", f:it.fun, s:it.shot, folded:true});
      var k=lw[0]+"|"+lw[1]; seen[k]=(seen[k]||0)+1; });
    var tot={};
    Object.keys(rs).forEach(function(w){ var v=+rs[w]||0; if(!v) return; var lw=legacyEnd(w,"me"), k=lw[0]+"|"+lw[1]; tot[k]=(tot[k]||0)+v; });
    Object.keys(tot).forEach(function(k){ var left=tot[k]-(seen[k]||0); if(left>0) extra[k]=(extra[k]||0)+left; });
  });
  return {rows:rows, extra:extra};
}
function closedTotal(){ var D=closedData(), n=D.rows.length; Object.keys(D.extra).forEach(function(k){ n+=D.extra[k]; }); return n; }
function clBars(items, attr){
  var max=Math.max.apply(null, items.map(function(x){return x.n;}).concat([1]));
  return '<div class="cbars">'+items.map(function(x){
    var on=x.on? " on" : "";
    return '<button type="button" class="cbar'+on+'" '+attr(x)+(x.n? "" : " disabled")+' title="'+(x.n? "Show these roles" : "None")+'">'+
      '<span class="cbl">'+esc(x.label)+'</span>'+
      '<span class="cbt"><span class="cbf" style="width:'+(x.n? Math.max(2,Math.round(x.n/max*100)) : 0)+'%"></span></span><span class="cbn">'+x.n+'</span></button>';
  }).join("")+'</div>';
}
function renderRejected(){
  var host=el("cl-where"); if(!host) return;
  var D=closedData(), rows=D.rows;
  function cnt(fn){ return rows.filter(fn).length; }
  function extraOf(how,reason){ var n=0; Object.keys(D.extra).forEach(function(k){ var p=k.split("|"); if((!how||p[0]===how) && (!reason||p[1]===reason)) n+=D.extra[k]; }); return n; }

  /* Level 1 */
  host.innerHTML=clBars(CL_STAGES.map(function(st){ return {key:st, label:stageWord(st), n:cnt(function(x){return x.where===st;})+(st==="Gate 1"? extraOf("","") : 0), on:CLF.where===st}; }),
    function(x){ return 'data-clw="'+esc(x.key)+'"'; });
  var tot={}; ["me","them","neither"].forEach(function(w){ tot[w]=cnt(function(x){return x.how===w;})+extraOf(w,""); });
  el("cl-how").innerHTML=clBars(["me","them","neither"].map(function(w){ return {key:w, label:CL_HOW[w], n:tot[w], on:CLF.how===w && !CLF.reason}; }),
    function(x){ return 'data-clh="'+x.key+'"'; });
  var afterInt=cnt(function(x){return x.how==="them" && x.where==="After interviewing";});
  el("cl-read").textContent =
    !(tot.me+tot.them+tot.neither) ? "Nothing has closed yet."
    : !tot.them ? "Nothing has turned you down yet. Every ending so far is your own filter or a role going away, which says how you're screening and nothing yet about how you're landing."
    : tot.them<4 ? "Too few turn-downs to read a pattern into: "+tot.them+" so far."
    : afterInt > tot.them-afterInt ? "Most turn-downs come after an interview rather than at screening: the application is working, and the room is where it goes."
    : "Most turn-downs come before interview: that points at the application and the CV rather than the interviews.";

  /* Level 2 */
  el("cl-three").innerHTML=["me","them","neither"].map(function(w){
    var counts={}; END_LISTS[w].forEach(function(k){ counts[k]=0; });
    rows.forEach(function(x){ if(x.how===w) counts[x.reason]=(counts[x.reason]||0)+1; });
    Object.keys(D.extra).forEach(function(k){ var p=k.split("|"); if(p[0]===w) counts[p[1]]=(counts[p[1]]||0)+D.extra[k]; });
    var keys=Object.keys(counts).filter(function(k){return counts[k];}).sort(function(a,b){return counts[b]-counts[a];});
    return '<div class="card panel clcard"><div class="clh"><h3>'+CL_TITLE[w]+'</h3><span class="eyebrow">'+(tot[w]? tot[w]+" in all" : "none yet")+'</span></div>'+
      (keys.length? clBars(keys.map(function(k){ return {key:k, label:k, n:counts[k], on:CLF.how===w && CLF.reason===k}; }),
          function(x){ return 'data-clh="'+w+'" data-clr="'+esc(x.key)+'"'; })
        : '<p class="clempty">'+(w==="them"? "Nothing yet. This fills once applications come back." : "Nothing yet.")+'</p>')+
      (w==="them"? themMixLine(rows) : "")+'</div>';
  }).join("");

  /* Level 3 */
  var list=rows.filter(function(x){ return (!CLF.where || x.where===CLF.where) && (!CLF.how || x.how===CLF.how) && (!CLF.reason || x.reason===CLF.reason); })
    .sort(function(a,b){ return String(b.at).localeCompare(String(a.at)) || String(a.title).localeCompare(String(b.title)); });
  el("cl-count").textContent = (CLF.where||CLF.how||CLF.reason)? list.length+" of "+rows.length : rows.length+(rows.length===1?" role":" roles");
  function sel(k,lab,opts,disabled){
    return '<label class="sortbar"><span>'+lab+'</span><select data-clsel="'+k+'"'+(disabled?" disabled":"")+'><option value="">All</option>'+
      opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(CLF[k]===o[0]?" selected":"")+'>'+esc(o[1])+'</option>'; }).join("")+'</select></label>';
  }
  var reasonOpts = CLF.how? END_LISTS[CLF.how].map(function(k){ return [k,k]; }) : [];
  el("cl-filters").innerHTML='<div class="clfil">'+
    sel("where","Where",CL_STAGES.map(function(s){ return [s,stageWord(s)]; }))+
    sel("how","How",["me","them","neither"].map(function(w){ return [w,CL_HOW[w]]; }))+
    sel("reason","Reason",reasonOpts,!CLF.how)+
    ((CLF.where||CLF.how||CLF.reason)? '<button type="button" class="linkbtn" data-clclear="1">Clear filters</button>' : "")+'</div>';
  var left=extraOf("","");
  el("cl-table").innerHTML = (list.length? '<div class="tablewrap cltable"><table><thead><tr><th>Role</th><th>Company</th><th>Where</th><th>How</th><th>Reason</th><th>Date</th><th>Fun · Shot</th><th></th></tr></thead><tbody>'+
      list.map(function(x){
        return '<tr'+(x.folded?' class="fold"':"")+'><td title="'+esc(x.note||"")+'">'+esc(x.title)+(x.ref? ' <span class="rref">#'+esc(x.ref)+'</span>' : "")+'</td>'+
          '<td>'+esc(x.company)+'</td><td>'+esc(stageWord(x.where))+'</td><td>'+esc(CL_HOW[x.how]||"")+'</td><td>'+esc(x.reason)+'</td>'+
          '<td class="num">'+esc(x.at? niceShort(x.at) : "—")+'</td>'+
          '<td class="num">'+(x.f!=null && x.s!=null? x.f+" · "+x.s : "—")+'</td>'+
          '<td>'+(x.live? '<button type="button" class="btn sm" data-act="reopen" data-id="'+esc(x.id)+'">Reopen</button>' : "")+'</td></tr>';
      }).join("")+'</tbody></table></div>'
    : '<p class="clempty">No closed roles match these filters.</p>')+
    '<p class="statushint" style="margin:8px 0 0">Longlist passes folded into a daily record are read-only and dated by the fold.'+
      (left? ' '+plural(left,"older pass","older passes")+' kept as counts only '+(left===1?"has":"have")+' no row.' : "")+'</p>';
}
/* Turn-downs by Shot (2 Oct): silent until 5 or more scored turn-downs exist, then one line. Long shots
   turned down are expected; good-shot roles turned down point at the CV, the level or the interviews.
   Worded for anyone using the board. */
function themMixLine(rows){
  var sc=rows.filter(function(x){ return x.how==="them" && x.f!=null && x.s!=null; }), n=sc.length;
  if(n<5) return "";
  var good=sc.filter(function(x){ return x.s>=4; }).length, longs=n-good;
  var t, cls;
  if(good>=3 && good/n>=0.5){ cls="weak"; t=good+" of "+n+" turn-downs were roles you rated a good shot (Shot 4–5). Worth a look at the CV, the level you're applying at, or the interviews."; }
  else if(longs/n>=0.6){ cls="ok"; t=longs+" of "+n+" turn-downs were long shots (Shot 1–3). That's expected."; }
  else { cls=""; t="Turn-downs are mixed: "+plural(longs,"long shot")+", "+plural(good,"good shot")+"."; }
  return '<p class="clmix '+cls+'">'+esc(t)+'</p>';
}
function clSet(patch){
  Object.keys(patch).forEach(function(k){ CLF[k]=patch[k]; });
  renderRejected();
  var d=el("cl-tablewrap"); if(d && (CLF.where||CLF.how||CLF.reason)){ d.open=true; setTimeout(function(){ d.scrollIntoView({block:"start",behavior:"smooth"}); },30); }
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest(".cbar"); 
  if(b && !b.disabled){ ev.preventDefault();
    if(b.dataset.clw!=null){ clSet({where:CLF.where===b.dataset.clw? "" : b.dataset.clw}); return; }
    if(b.dataset.clr!=null){ var same=CLF.how===b.dataset.clh && CLF.reason===b.dataset.clr; clSet({how:same? "" : b.dataset.clh, reason:same? "" : b.dataset.clr}); return; }
    if(b.dataset.clh!=null){ var same2=CLF.how===b.dataset.clh && !CLF.reason; clSet({how:same2? "" : b.dataset.clh, reason:""}); return; }
  }
  var c=ev.target.closest && ev.target.closest("[data-clclear]");
  if(c){ ev.preventDefault(); CLF={where:"",how:"",reason:""}; renderRejected(); }
});
document.addEventListener("change",function(ev){
  var s=ev.target.closest && ev.target.closest("[data-clsel]"); if(!s) return;
  var p={}; p[s.dataset.clsel]=s.value; if(s.dataset.clsel==="how") p.reason="";
  Object.keys(p).forEach(function(k){ CLF[k]=p[k]; }); renderRejected();
});

function renderScreened(){
  var tally={}, total=0;
  screened.forEach(function(d){
    var r=d.rules||{};
    Object.keys(r).forEach(function(k){ var n=+r[k]||0; tally[k]=(tally[k]||0)+n; total+=n; });
  });
  var keys=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a];});
  var meta=el("screened-meta"), host=el("dropoff"), note=el("dropoff-note");

  if(!keys.length){
    meta.textContent = screened.length? (screened.length+" sweep"+(screened.length===1?"":"s")+" · nothing screened out")
                                      : "no sweeps recorded";
    host.innerHTML="";
    note.innerHTML='<div class="empty" style="padding:22px"><b>Nothing screened out yet.</b>'+
      'A sweep writes its rejects here as one document per run — the rule that fired, the value it saw and the source. '+
      'Kept, never deleted: a silent automatic rejection is the false negative this design most fears.</div>';
    el("screened-detail").hidden=true;
    return;
  }

  meta.textContent = total+" removed across "+screened.length+" sweep"+(screened.length===1?"":"s");
  var max=tally[keys[0]]||1;
  host.innerHTML=keys.map(function(k,i){
    return '<div class="frow"><span><span class="mono" style="color:var(--faint);font-size:11px">'+esc(k)+
      '</span> '+esc(ruleName(k))+'</span>'+
      '<div class="fbar"><span class="'+(i===0?"top":"")+'" style="width:'+
      Math.round(tally[k]/max*100)+'%"></span></div><span class="n">'+tally[k]+'</span></div>';
  }).join("");
  note.innerHTML='<div class="notice" style="margin-top:10px;font-size:12.5px">'+
    '<b class="mono">'+esc(keys[0])+'</b> — '+esc(ruleName(keys[0]))+
    ' — is the binding constraint at '+tally[keys[0]]+' of '+total+'. '+
    'If the queue is too thin, this is the only rule loosening may touch. Never the sector refusals, '+
    'the title rules or the region rule.</div>';

  var det=el("screened-detail"); det.hidden=false;
  el("screened-list").innerHTML = screened.slice()
    .sort(function(a,b){return String(b.date).localeCompare(String(a.date));})
    .map(function(d){
      var items=(d.items||[]);
      return '<div><span class="eyebrow">'+esc(d.date)+' · '+items.length+' rows</span>'+
        '<div class="tablewrap" style="border:none;margin-top:6px"><table><thead><tr>'+
        '<th>Role</th><th>Company</th><th>Rule</th><th>What it saw</th></tr></thead><tbody>'+
        (items.length? items.map(function(x){
          return "<tr><td>"+(x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.title)+'</a>':esc(x.title))+
            "</td><td>"+esc(x.company)+"</td><td class='num'>"+esc(x.rule)+"</td><td>"+esc(x.saw||"")+"</td></tr>";
        }).join("") : "<tr><td colspan='4' style='color:var(--muted)'>Counts recorded, rows not retained for this sweep.</td></tr>")+
        '</tbody></table></div></div>';
    }).join("");
}

function nStage(st){ return roles.filter(function(r){return r.stage===st;}).length; }
function setCount(id,n){
  var e=el(id); if(!e) return;
  e.textContent = n? String(n) : "";
}
