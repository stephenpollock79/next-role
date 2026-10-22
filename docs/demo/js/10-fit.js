"use strict";
/* ---------- Role Fit (1 Oct) ----------
   CV against the job ad, nothing else: warm routes, level and culture are Shot's business, and only
   The user scores Shot. Each requirement is met / partial / gap / doesn't matter; must-haves count
   double. The page recomputes the % from the requirements, so an edit after an interview moves the
   score. `adPct` keeps what the ad alone said. */
var FIT_BANDS=[[90,"Perfect","strong"],[75,"High","strong"],[60,"Good","good"],[40,"Stretch","mid"],[0,"Low","weak"]];
var FIT_ST=["met","partial","gap","na"], FIT_LAB={met:"Met",partial:"Partial",gap:"Gap",na:"Not needed"};
var FIT_CLS={met:"strong",partial:"mid",gap:"weak",na:"na"};
function fitBand(p){ for(var i=0;i<FIT_BANDS.length;i++) if(p>=FIT_BANDS[i][0]) return FIT_BANDS[i]; return FIT_BANDS[FIT_BANDS.length-1]; }
function fitCalc(reqs){
  var w=0,got=0;
  (reqs||[]).forEach(function(q){ if(q.match==="na") return; var k=q.must?2:1; w+=k; got+=k*(q.match==="met"?1:q.match==="partial"?0.5:0); });
  return w? Math.round(100*got/w) : null;
}
function fitOf(r){
  var f=r&&r.fit; if(!f) return null;
  var p=(f.reqs&&f.reqs.length)? fitCalc(f.reqs) : f.pct; if(p==null) return null;
  var b=fitBand(p); return {pct:p, band:b[1], cls:b[2], rough:!!f.rough, f:f};
}
function fitChip(r){
  var x=fitOf(r);
  if(!x) return '<span class="chip fitchip none" title="Their criteria — how your CV matches the ad. Not scored yet">Them –</span>';
  return '<span class="chip fitchip '+x.cls+(x.rough?" rough":"")+'" title="Their criteria: '+x.band+' — how your CV matches the ad'+(x.rough?". Rough: from the listing, not the full ad":"")+'">Them · '+(x.rough?"~":"")+x.pct+'%</span>';
}
function fitPanel(r){
  var x=fitOf(r), f=(r.fit||{}), reqs=f.reqs||[];
  var basis={quick:"Provisional — from Quick check when you added it", posting:"From the full job ad", snippet:"Rough — from the listing, not the full ad", interview:"Updated after an interview", edited:"Edited by you"}[f.basis]||"";
  /* Card with a header row and the gauge top right, like the Overview boxes (1 Oct, night). */
  var sub = x? [(x.rough?"~":"")+x.band, basis, f.at? niceShort(f.at) : "", (f.adPct!=null && f.adPct!==x.pct)? "the ad alone said "+f.adPct+"%" : ""].filter(Boolean).join(" · ")
    : "Not scored yet";
  var head = boxHead("Their criteria", "Does your CV match what they ask for", fitGaugeBtn(r,"them"), sub).replace('class="fhtop"','class="fhtop solo"')+
    (x? "" : '<p class="lede" style="font-size:12.5px;margin:0">The sweep gives a rough score on the longlist, and the morning run scores it properly from the full ad on the shortlist.</p>');
  var list = reqs.length? reqs.map(function(q,i){
      return '<div class="fitreq">'+
        '<button type="button" class="chip fst '+FIT_CLS[q.match||"gap"]+'" data-act="fit_cycle" data-id="'+esc(r.id)+'" data-i="'+i+'" title="Tap to change">'+FIT_LAB[q.match||"gap"]+'</button>'+
        '<button type="button" class="mtag'+(q.must?" on":"")+'" data-act="fit_must" data-id="'+esc(r.id)+'" data-i="'+i+'" title="Tap to switch must-have / nice-to-have">'+(q.must?"Must-have":"Nice-to-have")+'</button>'+
        '<div class="ftx" title="'+esc(q.text||"")+'">'+esc(q.text||"")+(q.src==="interview"? '<span class="tag">from interview</span>' : "")+'</div>'+
        (q.evidence? '<div class="fev" title="'+esc(q.evidence)+'">'+esc(q.evidence)+'</div>' : "")+
        (q.src==="interview"? '<button type="button" class="frm" data-act="fit_rm" data-id="'+esc(r.id)+'" data-i="'+i+'">Remove</button>' : "")+
      '</div>';
    }).join("") : "";
  var add = '<div class="fitadd"><input type="text" id="fitadd-'+esc(r.id)+'" placeholder="Something they asked for at interview" aria-label="New requirement">'+
    '<label><input type="checkbox" id="fitmust-'+esc(r.id)+'"> Must-have</label>'+
    '<button type="button" class="btn sm" data-act="fit_add" data-id="'+esc(r.id)+'">Add</button></div>';
  var sug=(f.suggest||[]);
  var sugHtml = sug.length? '<div class="critsec"><h4>Suggested from your meetings<span class="ct">'+sug.length+'</span></h4><div class="askbox" style="margin-top:4px">'+sug.map(function(q,i){
      return '<div class="fitreq"><span class="chip fst '+FIT_CLS[q.match||"gap"]+'">'+FIT_LAB[q.match||"gap"]+'</span>'+
        '<div class="ftx">'+esc(q.text||"")+(q.must? '<span class="tag">must</span>' : "")+'</div>'+
        (q.why? '<div class="fev">'+esc(q.why)+'</div>' : "")+
        '<div class="row" style="grid-column:2;gap:6px"><button type="button" class="btn sm" data-act="fit_sok" data-id="'+esc(r.id)+'" data-i="'+i+'">Accept</button>'+
        '<button type="button" class="btn sm ghost" data-act="fit_sno" data-id="'+esc(r.id)+'" data-i="'+i+'">Dismiss</button></div></div>';
    }).join("")+'</div></div>' : "";
  /* Same shape as My criteria (1 Oct, night): header card, then requirements, then the add form,
     each its own card. */
  return '<div class="fitpanel critwrap"><div class="fithd fitcard">'+head+'</div>'+
    '<div class="critstack">'+sugHtml+
    critSec("Requirements", reqs.length, list)+
    (x||reqs.length? '<div class="critsec"><h4>Add from an interview</h4>'+add+'</div>' : "")+'</div></div>';
}
function fitSave(r, reqs, basis){
  var p=fitCalc(reqs), b=fitBand(p==null?0:p), f=Object.assign({}, r.fit||{});
  if(f.adPct==null && f.pct!=null && !f.rough) f.adPct=f.pct;
  f.reqs=reqs; f.pct=p; f.band=b[1]; f.basis=basis||"edited"; f.rough=false; f.at=today();
  r.fit=f; render();
  if(DB) DB.doc("roles/"+r.id).update({fit:f}).catch(function(e){ console.warn(e); toast("Couldn't save — try again",true); });
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="fit_cycle"],[data-act="fit_add"],[data-act="fit_rm"],[data-act="fit_sok"],[data-act="fit_sno"],[data-act="fit_must"]'); if(!b) return;
  ev.preventDefault();
  var r=roles.find(function(x){return x.id===b.dataset.id;}); if(!r) return;
  var reqs=((r.fit&&r.fit.reqs)||[]).map(function(q){return Object.assign({},q);});
  if(b.dataset.act==="fit_sok" || b.dataset.act==="fit_sno"){
    var sg=((r.fit&&r.fit.suggest)||[]).slice(), one=sg.splice(+b.dataset.i,1)[0]; if(!one) return;
    r.fit=Object.assign({},r.fit,{suggest:sg});
    if(b.dataset.act==="fit_sok"){
      var hit=reqs.find(function(q){return (q.text||"").toLowerCase()===(one.text||"").toLowerCase();});
      if(hit){ hit.match=one.match||hit.match; if(one.must!=null) hit.must=!!one.must; hit.src=hit.src||"interview"; }
      else reqs.push({text:one.text, must:!!one.must, match:one.match||"gap", src:"interview", evidence:one.why||""});
      fitSave(r,reqs,"interview");
    } else { render(); if(DB) DB.doc("roles/"+r.id).update({fit:r.fit}).catch(function(e){ console.warn(e); }); }
    return;
  }
  if(b.dataset.act==="fit_must"){
    var qm=reqs[+b.dataset.i]; if(!qm) return; qm.must=!qm.must; qm.byYou=true; fitSave(r,reqs,"edited"); return;
  }
  if(b.dataset.act==="fit_cycle"){
    var q=reqs[+b.dataset.i]; if(!q) return;
    q.match=FIT_ST[(FIT_ST.indexOf(q.match||"gap")+1)%FIT_ST.length]; q.byYou=true;
    fitSave(r,reqs,"edited");
  } else if(b.dataset.act==="fit_rm"){
    reqs.splice(+b.dataset.i,1); fitSave(r,reqs,"interview");
  } else {
    var t=el("fitadd-"+r.id), m=el("fitmust-"+r.id), v=t&&t.value.trim(); if(!v){ if(t) t.focus(); return; }
    reqs.push({text:v, must:!!(m&&m.checked), match:"gap", src:"interview", evidence:"Added after interview — tap the status to set how you match"});
    fitSave(r,reqs,"interview");
  }
});


/* ---------- Two-way fit (1 Oct) ----------
   My criteria: does the role fit what I want (hard rules, scored bands, flags). Never totalled — one
   weak band or red flag makes it Mixed, so a catch can't hide behind four strengths.
   Their criteria: do I fit what they want (Role Fit, CV against the ad). Fun and Shot stay the user's. */
/* A rule's name comes from the user's criteria; a retired rule (prefs.retiredRules) keeps the name it had. */
function ruleIdsOf(rules){ var ids=g2Rules().map(function(g){return g[0];}); Object.keys(rules||{}).forEach(function(k){ if(ids.indexOf(k)<0) ids.push(k); });
  return ids.sort(function(a,b){ return (parseInt(a.replace(/\D/g,""),10)||0)-(parseInt(b.replace(/\D/g,""),10)||0); }); }
function ruleName(id){ var x=((PREFS&&PREFS.hardRules)||[]).find(function(h){return h.id===id;}); if(x&&x.name) return x.name; var r=prefList("retiredRules").find(function(g){return g.id===id;}); return r&&r.name? r.name : id; }
var G2N_EDIT={}, ME_LAB={strong:"Strong",mixed:"Mixed",fails:"Fails",unknown:"?"}, ME_CLS={strong:"strong",mixed:"mid",fails:"weak",unknown:"none"};
function myCrit(r){
  var hs=r.highlights||[], red=(r.red||[]).filter(Boolean), rules=(r.enrich||{}).gate2Rules||{};
  /* Every rule the results hold counts, not only the six checked at the shortlist (2 Oct): a role you add
     yourself is checked on all of them, region included. */
  var ids=ruleIdsOf(rules);
  var fails=ids.filter(function(id){return rules[id]==="fail";}).map(function(id){return [id,ruleName(id)];});
  var unk=Object.keys(rules).length? ids.filter(function(id){return (rules[id]||"unknown")==="unknown";}).map(function(id){return [id,ruleName(id)];}) : [];
  var weak=hs.filter(function(h){return h.band==="weak";}), strong=hs.filter(function(h){return h.band==="strong";});
  /* Red flags are listed but don't set the state: Gate 2 research writes several on every role, so
     counting them made every card Mixed (1 Oct). A hard-rule fail is its own state. */
  var catches=fails.map(function(g){return "Fails "+g[0]+" ("+ruleName(g[0])+")";})
    .concat(weak.map(function(h){return h.code+" weak: "+h.label;}));   /* fails read "Fails <rule id> (<rule name>)" */
  var state = (!hs.length && !Object.keys(rules).length)? "unknown" : fails.length? "fails" : weak.length? "mixed" : "strong";
  return {state:state, catches:catches, red:red, strong:strong, fails:fails, unk:unk, ruled:Object.keys(rules).length>0};
}
function meChip(r){
  var m=myCrit(r);
  if(m.state==="unknown") return '<span class="chip mechip none" title="My criteria — not enough known yet">Me · ?</span>';
  var why = (m.catches.length? "Catch: "+m.catches.join(" · ") : "No deal-breakers failed, no weak preferences")+(m.red.length? " · "+m.red.length+" concern"+(m.red.length===1?"":"s") : "")+(m.unk.length? " · "+m.unk.length+" unknown" : "");
  return '<span class="chip mechip '+ME_CLS[m.state]+'" title="My criteria — '+esc(why)+'">Me · '+ME_LAB[m.state]+'</span>';
}
/* Phone collapsed row: both directions in one split pill, "Mixed | 73%", to save a line (1 Oct). */
/* ---------- Fit gauges on collapsed role cards (1 Oct, night) ----------
   Desktop only, on Longlist, Shortlist, To apply and Applied. Two small dials in a fixed column so they
   line up down the page. Me (my criteria) has three equal segments and the needle snaps to the middle of
   Fails, Mixed or Strong: it is a category, not a number. Them (how I match their ad) has segments sized
   to the real bands, so the needle sits at the true percentage. Rough scores are pale; unscored is grey. */
function gaugeArc(f0,f1){
  var R=19.5, cx=30, cy=29;
  function pt(f){ var a=Math.PI*(1-f); return (cx+R*Math.cos(a)).toFixed(2)+" "+(cy-R*Math.sin(a)).toFixed(2); }
  return "M"+pt(f0)+" A"+R+" "+R+" 0 0 1 "+pt(f1);
}
function gaugeSvg(segs,needle,pale,label){
  /* Thick bands with clear gaps; the needle runs over them nearly to the outer edge (1 Oct, night). */
  var gap=0.018, paths=segs.map(function(sg){
    return '<path d="'+gaugeArc(sg[0]+(sg[0]>0?gap:0), sg[1]-(sg[1]<1?gap:0))+'" stroke="'+sg[2]+'" stroke-width="13" fill="none"'+(pale?' opacity=".38"':"")+'/>'; }).join("");
  var nd="";
  if(needle!=null){
    var a=Math.PI*(1-Math.max(0,Math.min(1,needle))), c=Math.cos(a), sn=Math.sin(a);
    function P(len,off){ return (30+len*c-off*sn).toFixed(2)+","+(29-len*sn-off*c).toFixed(2); }
    nd='<polygon points="'+P(0,2.8)+' '+P(24.5,0.6)+' '+P(24.5,-0.6)+' '+P(0,-2.8)+'" fill="var(--ink)"/><circle cx="30" cy="29" r="4.6" fill="var(--ink)"/>';
  }
  return '<svg viewBox="0 0 60 34" width="60" height="34" role="img" aria-label="'+esc(label)+'">'+paths+nd+'</svg>';
}
var G_BAD="var(--g-bad)", G_WARN="var(--g-warn)", G_OK="var(--g-ok)", G_GOOD="var(--g-good)", G_NONE="var(--line)";
/* One gauge as a button: k is "me" or "them". Used on the collapsed card and in the open card's
   criteria boxes (1 Oct, night). */
function fitGaugeBtn(r,k){ var g=fitGauges(r,k); return g; }
function fitGauges(r,only){
  var m=myCrit(r), x=fitOf(r);
  var mePos={fails:1/6, mixed:0.5, strong:5/6}[m.state];
  var meSegs = m.state==="unknown"? [[0,1/3,G_NONE],[1/3,2/3,G_NONE],[2/3,1,G_NONE]] : [[0,1/3,G_BAD],[1/3,2/3,G_WARN],[2/3,1,G_GOOD]];
  var meCol={fails:G_BAD, mixed:G_WARN, strong:G_GOOD}[m.state]||"var(--faint)";
  var meVal=m.state==="unknown"? "–" : ME_LAB[m.state];
  var thSegs = x? [[0,0.4,G_BAD],[0.4,0.6,G_WARN],[0.6,0.75,G_OK],[0.75,1,G_GOOD]] : [[0,1,G_NONE]];
  var thCol = !x? "var(--faint)" : x.pct<40? G_BAD : x.pct<60? G_WARN : G_GOOD;
  var thVal = x? (x.rough?"~":"")+x.pct+"%" : "–";
  function one(k,lab,svg,val,col,tip){
    return '<button type="button" class="fgauge" data-act="fitg" data-id="'+esc(r.id)+'" data-k="'+k+'" title="'+esc(tip)+'">'+
      '<span class="fglab">'+lab+'</span>'+svg+'<span class="fgval" style="color:'+col+'">'+esc(val)+'</span></button>';
  }
  if(only==="me") return one("me","Me",gaugeSvg(meSegs,m.state==="unknown"? null : mePos,false,"My criteria: "+meVal),meVal,meCol,
      "My criteria: "+(m.state==="unknown"? "not enough known yet" : ME_LAB[m.state]+(m.catches.length? " — "+m.catches[0] : ""))+". Click for details.");
  if(only==="them") return one("them","Them",gaugeSvg(thSegs,x? x.pct/100 : null,x&&x.rough,"Their criteria: "+thVal),thVal,thCol,
      "Their criteria: "+(x? x.band+" — how your CV matches the ad"+(x.rough? ". Rough: from the listing, not the full ad" : "") : "not scored yet")+". Click for details.");
  return '<span class="fitgauges">'+
    one("me","Me",gaugeSvg(meSegs,m.state==="unknown"? null : mePos,false,"My criteria: "+meVal),meVal,meCol,
      "My criteria: "+(m.state==="unknown"? "not enough known yet" : ME_LAB[m.state]+(m.catches.length? " — "+m.catches[0] : ""))+". Click for details.")+
    one("them","Them",gaugeSvg(thSegs,x? x.pct/100 : null,x&&x.rough,"Their criteria: "+thVal),thVal,thCol,
      "Their criteria: "+(x? x.band+" — how your CV matches the ad"+(x.rough? ". Rough: from the listing, not the full ad" : "") : "not scored yet")+". Click for details.")+
  '</span>';
}
/* Clicking a gauge opens the card on its Fit tab, on the matching sub-tab. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="fitg"]'); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  CTAB[b.dataset.id]="fit"; CTAB[b.dataset.id+"/fit"]=b.dataset.k;
  if(expanded) expanded.add(b.dataset.id);
  render();
},true);
function fitDuo(r){
  var m=myCrit(r), x=fitOf(r);
  var a = [ME_CLS[m.state], ME_LAB[m.state]];
  var b = x? [x.cls+(x.rough?" rough":""), (x.rough?"~":"")+x.pct+"%"] : ['none','–'];
  return '<span class="fitduo" title="Me (my criteria): '+a[1]+' · Them (how I match their ad): '+b[1]+'"><span class="chip '+a[0]+'">'+a[1]+'</span><span class="chip '+b[0]+'">'+b[1]+'</span></span>';
}
function fitHeads(r){
  var m=myCrit(r), x=fitOf(r), f=r.fit||{};
  var rulesLine = !m.ruled? "" : m.fails.length? "<b>Deal-breakers:</b> "+esc(m.fails.map(function(g){return g[0]+" ("+ruleName(g[0])+")";}).join(", "))+" failed" :
    "<b>Deal-breakers:</b> none failed"+(m.unk.length? " ("+m.unk.length+" unknown)" : "");
  /* Header row (1 Oct, night): title and a line on what it measures, the gauge top right,
     a rule under it, then the detail. */
  function hd(t,sub,k){ return '<div class="fhtop"><div class="fhtl"><span class="fhtitle">'+t+'</span><span class="fhsub">'+sub+'</span></div>'+fitGaugeBtn(r,k)+'</div>'; }
  var me='<div class="fithd">'+hd("My criteria","Does it give you what you want","me")+
    (rulesLine? '<div class="fhline">'+rulesLine+'</div>' : "")+
    (m.strong.length? '<div class="fhline"><b>Strengths:</b> '+esc(m.strong.slice(0,3).map(function(h){return h.label;}).join(", "))+'</div>' : "")+
    (m.catches.length? '<div class="fhline"><b>Catch:</b> '+esc(m.catches.slice(0,2).join(" · "))+'</div>' : "")+
    (m.red.length? '<div class="fhline"><b>Concerns:</b> '+m.red.length+' — see Details</div>' : "")+
    '<a href="#" data-act="fitgo" data-id="'+esc(r.id)+'" data-k="me">Details →</a></div>';
  var gaps=(f.reqs||[]).filter(function(q){return q.must && q.match==="gap";});
  var them='<div class="fithd">'+hd("Their criteria","Does your CV match what they ask for","them")+
    (x? '<div class="fhline">'+(gaps.length? "<b>Biggest gap:</b> "+esc(gaps[0].text) : "<b>No must-have gaps.</b>")+'</div>'
       : '<div class="fhline">Not scored yet — the morning run scores it from the ad.</div>')+
    '<a href="#" data-act="fitgo" data-id="'+esc(r.id)+'" data-k="them">Details →</a></div>';
  return '<div class="ovsec"><div class="fitheads">'+me+them+'</div></div>';
}
function myCritPanel(r){
  /* Styled like Their criteria (1 Oct): one row per criterion, a status you can tap, the fact
     behind it. Hard rules and expensive scores tap through the same states as the old Rules tab. */
  var m=myCrit(r), e=r.enrich||{}, rules=e.gate2Rules||{}, exp=e.expensive||{};
  function nm(list,id){ var x=((PREFS&&PREFS[list])||[]).find(function(h){return h.id===id;}); return x? x.name : ""; }
  function row(btn,text,ev,cls){ var tt=String(text).replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    return '<div class="fitreq'+(cls? " "+cls : "")+'">'+btn+'<div class="ftx" title="'+esc(tt)+'">'+text+'</div>'+(ev? '<div class="fev" title="'+esc(ev)+'">'+esc(ev)+'</div>' : "")+'</div>'; }
  /* The rule's code trails its name, quietly (2 Oct: one type style per role in the row). */
  function code(c){ return '<span class="fcode">'+esc(c)+'</span>'; }
  var RL={pass:["Pass","strong"],fail:["Fail","weak"],unknown:["Unknown","na"]};
  var ruleIds=g2Rules().map(function(g){return g[0];}); Object.keys(rules).forEach(function(k){ if(ruleIds.indexOf(k)<0) ruleIds.push(k); });
  var ruleFact={}; prefList("hardRules").forEach(function(h){ if(h.type==="office") ruleFact[h.id]=r.office||r.location; else if(h.type==="pay") ruleFact[h.id]=(payOf(r,"total")||payOf(r,"base")||{}).v; });
  var hard=ruleIds.map(function(id){
    var g=g2Rules().find(function(x){return x[0]===id;}), v=rules[id]||"unknown", L=RL[v]||RL.unknown;
    return row('<button type="button" class="chip fst '+L[1]+'" data-act="rule" data-id="'+esc(r.id)+'" data-code="'+esc(id)+'" data-v="'+v+'" title="Tap to change">'+L[0]+'</button>',
      esc(nm("hardRules",id)||(g?g[1]:""))+code(id), ruleFact[id]? String(ruleFact[id]) : "");
  }).join("");
  var BL={strong:["Strong","strong"],mid:["Middle","mid"],weak:["Weak","weak"]};
  var dims=(r.highlights||[]).map(function(h){ var L=BL[h.band]||["Scored",""];
    return row('<span class="chip fst '+L[1]+'">'+L[0]+'</span>', esc(nm("scored",h.code)||h.code)+code(h.code), h.label);
  }).join("");
  var hcodes=(r.highlights||[]).map(function(h){return h.code;});
  var EL={strong:["Strong","strong"],ok:["Middle","mid"],weak:["Weak","weak"],unknown:["Unknown","na"]};
  var expRows=expRules().filter(function(g){return hcodes.indexOf(g[0])<0;});
  var exps=expRows.map(function(g){ var v=exp[g[0]]||"unknown", L=EL[v]||EL.unknown;
    return row('<button type="button" class="chip fst '+L[1]+'" data-act="exp" data-id="'+esc(r.id)+'" data-code="'+g[0]+'" title="Tap to change">'+L[0]+'</button>', esc(nm("scored",g[0])||g[1])+code(g[0]), "");
  }).join("");
  var nRed=(r.red||[]).filter(Boolean).length, nGreen=(r.green||[]).filter(Boolean).length;
  /* Concerns and pluses are written "Title — detail" (2 Oct): the title takes the name style and the
     rest the grey detail line, like every other column. Text without the separator shows as a title only. */
  function td(f){ var i=String(f).indexOf(" \u2014 "); return i>0? [f.slice(0,i).trim(), f.slice(i+3).trim()] : [String(f),""]; }
  var red=(r.red||[]).filter(Boolean).map(function(f){ var x=td(f); return row('<span class="fdot neg" aria-hidden="true"></span>', esc(x[0]), x[1], "fnote"+(x[1]? " fsplit" : "")); }).join("");
  var green=(r.green||[]).filter(Boolean).map(function(f){ var x=td(f); return row('<span class="fdot pos" aria-hidden="true"></span>', esc(x[0]), x[1], "fnote"+(x[1]? " fsplit" : "")); }).join("");
  var nWeak=m.catches.length-m.fails.length, nUnk=m.unk.length;
  var line=[m.fails.length? m.fails.length+" deal-breaker"+(m.fails.length===1?"":"s")+" failed" : "", nWeak? nWeak+" weak preference"+(nWeak===1?"":"s") : "",
    nRed? nRed+" concern"+(nRed===1?"":"s") : "", nUnk? nUnk+" unknown" : ""].filter(Boolean).join(" · ");
  /* Header card, then one tall card per section side by side (1 Oct, night). */
  if(e.rulesFrom==="quick") line=(line? line+" · " : "")+"provisional, from Quick check — the morning run replaces it";
  return '<div class="fitpanel critwrap"><div class="fithd fitcard">'+boxHead("My criteria","Does it give you what you want",fitGaugeBtn(r,"me"),line).replace('class="fhtop"','class="fhtop solo"')+'</div>'+
    '<div class="critcols">'+
    critSec("Deal-breakers", ruleIds.length, hard)+
    critSec("Preferences", (r.highlights||[]).length+expRows.length, dims+exps)+
    critSec("Concerns", nRed, red)+
    critSec("Pluses", nGreen, green)+
  '</div></div>';
}
/* One style for every section header in the Fit tab (1 Oct): a title and a count, no text under it. */
function critSec(t,n,html){ return html? '<div class="critsec"><h4>'+esc(t)+'<span class="ct">'+n+'</span></h4><div class="fitlist">'+html+'</div></div>' : ""; }
function fitTab(r){
  return subTabs(r.id+"/fit", [
    {k:"me", label:"My criteria", html: myCritPanel(r)},
    {k:"them", label:"Their criteria", html: fitPanel(r)}
  ], "me");
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="fitgo"],[data-act="g2n_edit"]'); if(!b) return;
  ev.preventDefault();
  if(b.dataset.act==="g2n_edit"){
    G2N_EDIT[b.dataset.id]=true;
    var v=el("g2nv-"+b.dataset.id), f=el("g2nf-"+b.dataset.id); if(v) v.hidden=true; if(f){ f.hidden=false; var ta=f.querySelector("textarea"); if(ta) ta.focus(); }
    return;
  }
  CTAB[b.dataset.id]="fit"; CTAB[b.dataset.id+"/fit"]=b.dataset.k; render();
});

/* ---------- About me › Skills (1 Oct) ---------- */
var SKILLS=null, SK_EDIT=null;
function skillsPanel(){
  var S=SKILLS, items=(S&&S.items)||[];
  if(!S) return '<div class="card panel"><p class="lede" style="margin:0">No skills on the board yet.</p></div>';
  var groups=[]; items.forEach(function(it){ if(groups.indexOf(it.group||"Other")<0) groups.push(it.group||"Other"); });
  function row(it){
    var lv='<span class="skl"><select data-act="sk_lv" data-id="'+esc(it.id)+'" aria-label="Level">'+["Expert","Strong","Working"].map(function(l){return '<option'+(l===it.level?" selected":"")+'>'+l+'</option>';}).join("")+'</select></span>';
    if(SK_EDIT===it.id) return '<div class="skrow"><span class="skn">'+esc(it.name)+'</span>'+lv+
      '<div class="skedit"><input type="text" id="sk-ev-'+esc(it.id)+'" value="'+esc(it.evidence||"")+'" aria-label="Evidence from the CV">'+
      '<button type="button" class="btn sm primary" data-act="sk_save" data-id="'+esc(it.id)+'">Save</button>'+
      '<button type="button" class="btn sm ghost" data-act="sk_cancel">Cancel</button>'+
      '<button type="button" class="btn sm danger" data-act="sk_rm" data-id="'+esc(it.id)+'">Remove</button></div></div>';
    return '<div class="skrow"><span class="skn">'+esc(it.name)+'</span>'+lv+
      '<div class="ske">'+esc(it.evidence||"No CV evidence yet")+(it.alsoEvidence? ' · '+esc(it.alsoEvidence) : "")+
      ' <a href="#" data-act="sk_edit" data-id="'+esc(it.id)+'">Edit</a></div></div>';
  }
  return '<div class="stack">'+
    '<p class="lede" style="font-size:12.5px;margin:0">Your top '+items.length+' skills, each tied to one line of CV evidence. The Role Fit score, packs and interview prep all read this list.</p>'+
    groups.map(function(g){
      var its=items.filter(function(it){return (it.group||"Other")===g;});
      return '<div class="card panel"><div class="sechead"><span class="eyebrow">'+esc(g)+' · '+its.length+'</span></div>'+its.map(row).join("")+'</div>';
    }).join("")+
    '<div class="card panel"><div class="sechead"><span class="eyebrow">Add a skill</span></div><div class="fitadd">'+
      '<input type="text" id="sk-new-name" placeholder="Skill" aria-label="Skill name" style="flex:1 1 160px">'+
      '<input type="text" id="sk-new-ev" placeholder="One line of CV evidence" aria-label="Evidence" style="flex:2 1 240px">'+
      '<button type="button" class="btn sm" data-act="sk_add">Add</button></div></div>'+
    ((S.left_out||[]).length? '<p class="statushint">Left out on purpose: '+esc(S.left_out.join(", "))+'.</p>' : "")+
  '</div>';
}
function skSave(items){
  SKILLS.items=items; SK_EDIT=null; renderAbout();
  if(DB) DB.doc("profile/skills").update({items:items, updatedAt:today()}).catch(function(e){ console.warn(e); toast("Couldn't save — try again",true); });
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act^="sk_"]'); if(!b || b.tagName==="SELECT" || !SKILLS) return;
  ev.preventDefault();
  var a=b.dataset.act, items=(SKILLS.items||[]).map(function(x){return Object.assign({},x);});
  if(a==="sk_edit"){ SK_EDIT=b.dataset.id; renderAbout(); return; }
  if(a==="sk_cancel"){ SK_EDIT=null; renderAbout(); return; }
  if(a==="sk_save"){ var it=items.find(function(x){return x.id===b.dataset.id;}), v=el("sk-ev-"+b.dataset.id); if(it&&v) it.evidence=v.value.trim(); skSave(items); return; }
  if(a==="sk_rm"){ skSave(items.filter(function(x){return x.id!==b.dataset.id;})); return; }
  if(a==="sk_add"){
    var n=el("sk-new-name"), e=el("sk-new-ev"), nv=n&&n.value.trim(); if(!nv){ if(n) n.focus(); return; }
    var mx=0; items.forEach(function(x){ var k=parseInt(String(x.id).replace(/\D/g,""),10); if(k>mx) mx=k; });
    items.push({id:"s"+String(mx+1).padStart(2,"0"), name:nv, group:"Other", level:"Strong", evidence:(e&&e.value.trim())||""});
    skSave(items);
  }
});
document.addEventListener("change",function(ev){
  var t=ev.target; if(!t || t.dataset.act!=="sk_lv" || !SKILLS) return;
  var items=(SKILLS.items||[]).map(function(x){return Object.assign({},x);}), it=items.find(function(x){return x.id===t.dataset.id;});
  if(it){ it.level=t.value; skSave(items); }
});
