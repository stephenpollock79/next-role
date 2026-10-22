"use strict";
/* ---------- channels (1 Oct) ---------- */
function chById(id){ return channels.find(function(c){return c.id===id;}); }
function chItems(ch){
  if(!ch) return [];
  if(ch.derived==="companies") return companies.filter(function(c){ return c.watch || c.onTargetList; })
    .sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));})
    .map(function(c){ return {id:"co:"+c.id, name:c.name||c.id, status:c.watch?"active":"dropped", derived:true}; });
  if(ch.derived==="flags"){
    var g=((PREFS&&PREFS.searchTerms)||[]).filter(function(x){ return /^upside/i.test(x.group||""); })[0];
    return String((g&&g.terms)||"").split(",").map(function(t){return t.trim();}).filter(Boolean)
      .map(function(t){ return {id:"flag:"+slug(t), name:t, status:"active", derived:true}; });
  }
  return srcs.filter(function(x){return x.channelId===ch.id;})
    .sort(function(a,b){ return (a.order||99)-(b.order||99) || String(a.name||"").localeCompare(String(b.name||"")); });
}
function chOfSrc(sid){
  if(!sid) return "";
  if(sid.indexOf("co:")===0) return "companies";
  if(sid.indexOf("flag:")===0) return "flags";
  if(sid.indexOf("ch:")===0) return sid.slice(3);
  var x=srcs.find(function(s){return s.id===sid;}); return x? x.channelId : "";
}
function srcLabel(r){
  var ch=chById(r.channelId||chOfSrc(r.sourceId)); if(!ch) return r.channel && r.channel!=="agent"? r.channel : "";
  var it=chItems(ch).find(function(x){return x.id===r.sourceId;});
  return ch.name+(it? " › "+it.name : "");
}
function chSorted(){ return channels.slice().sort(function(a,b){ return (a.order||99)-(b.order||99); }); }
/* One picker for "found through": a channel on its own (ch:<id>) or one of its sources.
   Company careers pages never lists the companies (2 Oct): the source is the role's own company. */
function srcOptions(cur){
  var out='<option value="">Not recorded</option>';
  chSorted().forEach(function(ch){
    var co=ch.derived==="companies";
    out+='<optgroup label="'+esc(ch.name)+'"><option value="ch:'+esc(ch.id)+'"'+(cur==="ch:"+ch.id?" selected":"")+'>'+esc(ch.name)+(co? " — the role’s company" : ' — no particular source')+'</option>'+
      chItems(ch).filter(function(x){ return (x.status!=="dropped" || x.id===cur) && (!co || x.id===cur); }).map(function(x){
        return '<option value="'+esc(x.id)+'"'+(x.id===cur?" selected":"")+'>'+esc(x.name)+'</option>'; }).join("")+'</optgroup>';
  });
  if(cur && out.indexOf('value="'+cur+'"')<0) out+='<option value="'+esc(cur)+'" selected>'+esc(cur)+' (removed)</option>';
  return out;
}
function rolesOfCh(chId){ return rawRoles.filter(function(r){ return (r.channelId||chOfSrc(r.sourceId))===chId; }); }
/* ---------- Found through, as two short lists (2 Oct) ----------
   Add roles used one dropdown of every channel, source and target company. Now: the channel, then the
   firm or source inside it, with "+ Add new" inline so a new recruiter firm never means leaving the form.
   Company careers pages asks nothing more: the source is the company named on the role.
   Mounted into #<p>-sp; the result lands in the hidden #<p>-src (a sourceId, or ch:<id>), so the rest of
   the code reads one value as before. A new firm is only written to `sources` when the role is saved. */
function spQ(p,k){ var b=el(p+"-sp"); return b? b.querySelector('[data-sp="'+k+'"]') : null; }
function spNoun(ch){ return !ch? "source" : ch.id==="recruiters"? "firm" : ch.id==="warm"? "route" : ch.derived==="flags"? "flag term" : "source"; }
function spMount(p,cur){
  var box=el(p+"-sp"); if(!box) return;
  var chId=chOfSrc(cur||"");
  var opts='<option value="">Not recorded</option>'+chSorted().filter(function(c){ return c.status!=="dropped" || c.id===chId; })
    .map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===chId?" selected":"")+'>'+esc(c.name||c.id)+'</option>'; }).join("");
  box.innerHTML='<div class="spgrid">'+
    '<label class="fld">Found through<select data-sp="ch">'+opts+'</select></label>'+
    '<label class="fld" data-sp="srcwrap" hidden><span data-sp="srclab">Which source</span><select data-sp="src"></select></label>'+
    '<label class="fld" data-sp="newwrap" hidden><span data-sp="newlab">New source</span><input data-sp="new" autocomplete="off"></label>'+
    '<p class="statushint" data-sp="cohint" style="margin:0" hidden>The source is the company the role is at. Nothing more to pick.</p>'+
  '</div>';
  spSrc(p,cur);
}
function spSrc(p,cur){
  var ch=chById(spQ(p,"ch").value), sel=spQ(p,"src"), wrap=spQ(p,"srcwrap"), nw=spQ(p,"newwrap");
  spQ(p,"cohint").hidden=!(ch && ch.derived==="companies");
  if(!ch || ch.derived==="companies"){ wrap.hidden=true; nw.hidden=true; sel.innerHTML=""; spPickSync(p); return; }
  var noun=spNoun(ch);
  wrap.hidden=false; spQ(p,"srclab").textContent="Which "+noun;
  var items=chItems(ch).filter(function(x){ return x.status!=="dropped" || x.id===cur; });
  sel.innerHTML='<option value="ch:'+esc(ch.id)+'">No particular '+noun+'</option>'+
    items.map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>'; }).join("")+
    (ch.derived? "" : '<option value="__new">+ Add a new '+noun+'…</option>');
  if(cur && items.some(function(x){return x.id===cur;})) sel.value=cur;
  spQ(p,"newlab").textContent="New "+noun+" — name";
  spQ(p,"new").placeholder= ch.id==="recruiters"? "e.g. a recruitment agency" : "";
  nw.hidden=sel.value!=="__new";
  spPickSync(p);
}
function spCoSrc(){ var c=arCompany(arVal("add-co")); return c? "co:"+c.id : "ch:companies"; }
function spPickSync(p){
  var h=el(p+"-src"); if(!h) return;
  var ch=chById(spQ(p,"ch").value), v="";
  if(ch){
    if(ch.derived==="companies") v= p==="add"? spCoSrc() : "ch:companies";
    else { var s=spQ(p,"src").value; v=(s && s!=="__new")? s : "ch:"+ch.id; }
  }
  if(h.value!==v){ h.value=v; h.dispatchEvent(new Event("change")); }
}
/* null = not adding a new one; "" = adding one but no name yet. */
function spNewName(p){ var s=spQ(p,"src"); return (s && s.value==="__new")? String(spQ(p,"new").value||"").trim() : null; }
function spFirmName(p){ var nm=spNewName(p); if(nm) return nm; var v=el(p+"-src").value, x=srcs.find(function(s){return s.id===v;}); return x? (x.name||"") : ""; }
/* Called on save: writes the new firm or source (or reuses one with the same name) and returns the sourceId. */
async function spResolve(p){
  var nm=spNewName(p);
  if(nm===null){ if(p==="add" && chOfSrc(el("add-src").value)==="companies") return spCoSrc(); return el(p+"-src").value||""; }
  if(!nm) throw {code:"sp_noname"};
  var chId=spQ(p,"ch").value, lo=nm.toLowerCase();
  var ex=srcs.find(function(s){ return s.channelId===chId && String(s.name||"").toLowerCase()===lo; });
  if(ex) return ex.id;
  var base=slug(chId+"-"+nm), id=base, k=2; while(srcs.some(function(s){return s.id===id;})) id=base+"-"+(k++);
  var order=1+Math.max.apply(null,[0].concat(srcs.filter(function(s){return s.channelId===chId;}).map(function(s){return +s.order||0;})));
  await DB.doc("sources/"+id).set({channelId:chId, name:nm, url:"", note:"Added with a role on "+today()+". No site to fetch yet.", order:order, status:"active", why:"", addedAt:today(), addedVia:"role"});
  return id;
}
document.addEventListener("change",function(ev){
  var t=ev.target, k=t && t.dataset && t.dataset.sp; if(!k) return;
  var box=t.closest(".srcpick"); if(!box) return; var p=box.id.replace(/-sp$/,"");
  if(k==="ch") spSrc(p,"");
  else if(k==="src"){ spQ(p,"newwrap").hidden=t.value!=="__new"; if(t.value==="__new") spQ(p,"new").focus(); spPickSync(p); if(p==="add") arPeople(); }
});
document.addEventListener("input",function(ev){
  var t=ev.target; if(!(t && t.dataset && t.dataset.sp==="new")) return;
  var box=t.closest(".srcpick"); if(box && box.id==="add-sp") arPeople();
});
function reachedApply(r){ return !!(FLIGHT[r.stage] || r.appliedAt || r.pack || r.stage==="closed"); }
var CHCLS={active:"strong",trial:"mid",paused:"mid",dropped:"weak"}, CHLAB={active:"Active",trial:"Trial",paused:"Paused",dropped:"Dropped"};
/* Split by who does the work (3 Oct): Auto sweep shows kind "auto", Manual shows kind "manual".
   One channels collection underneath, so Insights still compares them all. Manual wording never says "sweep". */
var CHLAB_M={active:"Working",trial:"Trying",paused:"Paused",dropped:"Dropped"};
function chStLab(st,kind){ return (kind==="manual"? CHLAB_M : CHLAB)[st]||st; }
function srcLastRun(x){
  var lo=String(x.name||"").toLowerCase(), d="";
  runs.forEach(function(r){ if(r.type!=="manual"||!r.date) return; if(String(r.channels||"").split(",").some(function(c){return c.trim().toLowerCase()===lo;}) && r.date>d) d=r.date; });
  rawRoles.forEach(function(r){ if(r.sourceId===x.id && r.seen && r.seen>d) d=r.seen; });
  return d;
}
/* Job-alert stage for a source whose alerts setup created: waiting for the first email, working since,
   or overdue (no email 7+ days after set-up; Data health lists those too). setup.alertSetAt is written by
   next-role-setup, setup.firstAlertAt by the sweep when it first reads an alert email from the source. */
function srcAlertStage(x){
  var s=(x&&x.setup)||{};
  if(s.firstAlertAt) return {k:"ok", t:"Alert emails arriving since "+niceShort(s.firstAlertAt)};
  if(!s.alertSetAt) return null;
  var g=dayGap(s.alertSetAt,today())||0;
  return g>7? {k:"late", t:"No alert email yet, "+g+" days after set-up"} : {k:"wait", t:"Alerts created "+niceShort(s.alertSetAt)+", waiting for the first email"};
}
function renderChannels(){
  var box=el("ch-list"), boxM=el("ch-list-m"), strip=el("src-strip"); if(!box) return;
  var na=channels.filter(function(c){return c.kind!=="manual";}).length, nm=channels.length-na;
  if(strip) strip.innerHTML=plural(na,"auto channel")+' · '+plural(nm,"manual channel")+' · <a href="#" data-gotab="pipeline">See how they all perform in Insights →</a> · <a href="#" data-gotab="review">Search review →</a>';
  if(!channels.length){ box.innerHTML='<div class="card empty"><b>No channels yet.</b>Add one with the button above.</div>'; if(boxM) boxM.innerHTML=""; return; }
  var cardOf=function(ch){
    var cid="ch-"+ch.id, items=chItems(ch), rs=rolesOfCh(ch.id), st=ch.status||"active";
    var live=items.filter(function(x){return x.status!=="dropped";}).length;
    /* Controls like the company and sector cards (2 Oct): Status as a switch, Run by as text,
       a chart of what it found. Remove lives in the Edit form. */
    var man=ch.kind==="manual";
    var CHWHY= man? {active:"You work it.",trial:"On trial — kept if it's worth your time.",paused:"Not working it for now.",dropped:"No longer used."}
      : {active:"The sweep checks it.",trial:"On trial — kept if it finds roles worth having.",paused:"Not checked for now.",dropped:"No longer used."};
    var seg='<span class="seg">'+CH_STATUS.map(function(o){ return '<button type="button" class="'+(o[0]===st?"on":"")+'" data-act="ch_seg" data-id="'+esc(ch.id)+'" data-v="'+o[0]+'" aria-pressed="'+(o[0]===st)+'">'+chStLab(o[0],ch.kind)+'</button>'; }).join("")+'</span>';
    var agg=CO_STAGES.map(function(sg){ return {k:sg[0], label:sg[1], tab:sg[2], n:rs.filter(function(r){return sg[3][r.stage];}).length}; });
    var apN=rs.filter(reachedApply).length;
    var controls='<div class="shead compact cotl coctl">'+
      '<div class="coctl-f"><span class="eyebrow">Status</span>'+seg+'<span class="coctl-why">'+esc((st!=="active" && ch.why) || CHWHY[st] || "")+'</span></div>'+
      '<div class="coctl-f"><span class="eyebrow">Run by</span><span class="cocount"><b>'+(ch.kind==="manual"?"Me":"The sweep")+'</b>'+(ch.cadence? ' · '+esc(ch.cadence) : "")+'</span>'+
        '<span class="coctl-why">'+live+' source'+(live===1?"":"s")+' in use · '+rs.length+' on the board · '+apN+' reached To apply</span></div>'+
      '<div class="coctl-f coctl-chart"><span class="eyebrow">Roles</span>'+coChart(agg)+'</div>'+
    '</div>';
    var details=tc("Details","What it is and how often",editBtn("channel",ch.id),editBox("channel",ch.id)+
      '<div class="facts core">'+fact("What it is",ch.how)+fact("How often",ch.cadence)+(st!=="active"? fact("Why "+chStLab(st,ch.kind).toLowerCase(),ch.why) : "")+'</div>');
    var list;
    if(ch.derived){
      list='<p class="lede" style="font-size:12.5px;margin:0">'+(ch.derived==="companies"?
          'Every company the sweep searches. Add or stop one on <a href="#" data-gotab="companies">Targets › Companies</a>.' :
          'The Upside flags terms. Change them in <a href="#" data-goabout="prefs">About me › My criteria</a>.')+'</p>';
      if(ch.derived==="flags") list+='<div class="row" style="gap:5px;margin-top:6px">'+items.map(function(x){ return '<span class="chip">'+esc(x.name)+'</span>'; }).join("")+'</div>';
      else {
        var hits=items.map(function(x){ var n=rawRoles.filter(function(r){return r.sourceId===x.id;}).length; return {x:x,n:n}; })
          .filter(function(o){return o.n;}).sort(function(a,b){return b.n-a.n;});
        list+= hits.length? '<div style="margin-top:6px">'+hits.map(function(o){
            return '<div class="chsrc"><span class="nm">'+esc(o.x.name)+'</span><span class="meta st">'+o.n+' on the board</span></div>'; }).join("")+'</div>' : "";
      }
    } else {
      list=(items.length? '<div>'+items.map(function(x){
          var fr=rawRoles.filter(function(r){return r.sourceId===x.id;}), ap=fr.filter(reachedApply).length;
          var ss=x.status||"active", ek=editKey("source",x.id), open=!!EDITING[ek];
          /* Status as coloured text beside the name, not a pill; actions as quiet links on the right (2 Oct). */
          return '<div class="chsrc srcrow">'+
            '<span class="nm">'+(x.url? '<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.name)+'</a>' : esc(x.name))+
              '<span class="sst '+(CHCLS[ss]||"")+'">'+esc(chStLab(ss,ch.kind))+'</span></span>'+
            '<span class="acts"><button type="button" class="linkbtn" data-act="ed_open" data-k="source" data-id="'+esc(x.id)+'">Edit</button>'+
              '<button type="button" class="linkbtn danger" data-act="src_rm" data-id="'+esc(x.id)+'">Remove</button></span>'+
            '<span class="meta">'+fr.length+' on the board · '+ap+' to apply'+(man? (function(){ var lr=srcLastRun(x); return ' · last checked '+(lr? niceShort(lr) : "never"); })() : "")+(function(){ var as=srcAlertStage(x); return as? ' · '+(as.k==="late"? '<span class="srcnofit">'+esc(as.t)+'</span>' : esc(as.t)) : ""; })()+(!man && ss!=="dropped" && typeof srcNoFit==="function" && srcNoFit(x.id)? ' · <span class="srcnofit" title="The sweep read listings here in each of its last '+SRC_NOFIT_N+' sweeps, but none passed your rules">Nothing fits in '+SRC_NOFIT_N+' sweeps</span>' : "")+((ss!=="active"? x.why : x.note)? ' · '+esc(ss!=="active"? x.why : x.note) : "")+'</span>'+
          '</div>'; }).join("")+'</div>'
        : '<p class="emptyline">No sources yet.</p>');
    }
    var body=controls+'<div class="tcards" style="margin-top:12px">'+details+
      tc("Sources",items.length+" source"+(items.length===1?"":"s")+" · "+rs.length+" roles on the board",
        ch.derived? "" : '<button type="button" class="btn sm" data-act="src_open" data-id="'+esc(ch.id)+'">+ Add a source</button>',list)+'</div>';
    return '<article class="role cocard"><div class="rail"></div><div class="role-body">'+
      '<details class="rcard" data-id="'+esc(cid)+'"'+(isOpen(cid)?" open":"")+'>'+
        '<summary>'+
          '<span class="rsum-title">'+esc(ch.name||ch.id)+'</span>'+
          '<span class="rsum-status"><span class="eyebrow">Status</span><span class="spill sm '+(CHCLS[st]||"")+'">'+esc(chStLab(st,ch.kind))+'</span></span>'+
          '<span class="rsum-sub"><span class="rsum-co" title="'+esc(ch.how||"")+'">'+esc(ch.how||"")+'</span>'+
            '<span class="copri"><span class="chip" title="Roles from this channel on the board now, at any stage. Not what a sweep read: that is in Sweep status.">'+live+' source'+(live===1?"":"s")+' · '+rs.length+' on the board</span></span></span>'+
        '</summary>'+
        '<div class="rbody">'+body+'</div>'+
      '</details>'+
    '</div></article>';
  };
  var auto=chSorted().filter(function(c){return c.kind!=="manual";}), man=chSorted().filter(function(c){return c.kind==="manual";});
  box.innerHTML=auto.map(cardOf).join("")||'<div class="card empty"><b>No auto channels.</b>Add one with the button above.</div>';
  if(boxM) boxM.innerHTML=man.map(cardOf).join("")||'<div class="card empty"><b>No manual channels.</b>Add one with the button above.</div>';
}
function manualNames(){
  var m=chById("manual"); if(!m) return MANUAL_CHANNELS;
  return chItems(m).filter(function(x){return x.status!=="dropped";}).map(function(x){return x.name;});
}

/* ---------- about me ---------- */
/* What I don't have (4 Oct): things roles require that you lack, e.g. a language or a domain. Picked when you
   turn a role down as "Needs something I don't have"; Role Fit always counts them as gaps, CVs and prep never
   claim them, and one that keeps costing roles becomes a Highlights card. Stored as profile/me `gaps`. */
function gapsPanelHtml(){
  if(!PROFILE) return "";
  var gs=myGaps(), all=rawRoles.concat(typeof insFolded==="function"? insFolded() : []);
  function cost(g){ return all.filter(function(r){ return r.endGap && gapKey(r.endGap)===gapKey(g.name); }).length; }
  return '<div class="card panel gappanel"><div class="sechead"><span class="eyebrow">What I don\'t have</span></div>'+
    '<p class="lede" style="font-size:12.5px;margin:0 0 6px">Things roles ask for that you don\'t have. Role Fit always counts them as gaps, and CVs and interview prep never claim them. Add one here, or when you turn a role down as “Needs something I don\'t have”.</p>'+
    (gs.length? gs.map(function(g){ var n=cost(g);
      return '<div class="gaprow"><div><b>'+esc(g.name)+'</b>'+(g.note? '<span>'+esc(g.note)+'</span>' : "")+'</div>'+
        '<span class="gapn">'+(n? "cost you "+plural(n,"role") : "no roles yet")+'</span>'+
        '<button type="button" class="linkbtn" data-act="gap_rm" data-n="'+esc(g.name)+'" title="Remove it from the list; roles keep their reason">Remove</button></div>'; }).join("")
      : '<p class="lede" style="font-size:12.5px;margin:0">Nothing listed yet.</p>')+
    '<div class="gapadd"><input id="gap-add" placeholder="e.g. Fluent French"><button type="button" class="btn sm" data-act="gap_add">Add</button></div></div>';
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="gap_add"],[data-act="gap_rm"]'); if(!b || !DB) return;
  ev.preventDefault();
  if(b.dataset.act==="gap_add"){ var i=el("gap-add"), v=i? i.value.trim() : ""; if(!v) return; addGap(v); i.value=""; return; }
  var n=b.dataset.n;
  if(b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent="Click again to remove"; setTimeout(function(){ b.dataset.armed=""; b.textContent="Remove"; },3000); return; }
  DB.doc("profile/me").update({gaps:myGaps().filter(function(g){ return gapKey(g.name)!==gapKey(n); })}).catch(function(e){ console.warn("gap rm",e); });
});
function renderAbout(){
  var box=el("about-body"); if(!box) return;
  var P=PROFILE||{}, F=PREFS||{};
  function line(v){ return v? '<p style="margin:0;font-size:13.5px;color:var(--ink-2);white-space:pre-wrap">'+esc(v)+'</p>' : ""; }
  var stat = !PROFILE? '<p class="lede" style="margin:0">No profile on the board yet.</p>' :
    '<div class="card panel">'+secHead("Details","profile","me")+
      '<div class="facts core">'+fact("Name",P.name)+fact("Location",P.location)+fact("Profession",P.profession)+
        fact("Experience",P.experience)+fact("Last role",P.lastRole)+fact("Right to work",P.rightToWork)+'</div>'+
      '<div class="ovsec"><span class="eyebrow">Availability</span>'+line(P.availability||"not stated")+'</div>'+
      '<div class="ovsec"><span class="eyebrow">Right now</span>'+line(P.status||"not stated")+'</div>'+
      '<div class="ovsec"><span class="eyebrow">Headline</span>'+line(P.headline||"not stated")+'</div>'+
      '<p class="lede" style="font-size:12px;margin:0">Career, stories and answers for the mock interviewer live in this record too.</p>'+
    '</div>'+gapsPanelHtml();
  function rows(arr,kind){
    arr=arr||[]; if(!arr.length) return '<span class="lede" style="font-size:12.5px">None yet.</span>';
    return '<div>'+arr.map(function(o){
      if(typeof o==="string") return '<div class="pref-row noid"><span class="pr" style="color:var(--ink)">'+esc(o)+'</span></div>';
      var id=o.id||"", main=o.name||"", sub=o.rule||o.bands||o.note||"";
      return '<div class="pref-row'+(id?"":" noid")+'">'+(id? '<span class="pid">'+esc(id)+'</span>' : "")+
        '<span class="pn">'+esc(main)+(o.fires? '<span class="pf">'+esc(stageWord(o.fires))+'</span>' : "")+'</span>'+
        (sub? '<span class="pr">'+esc(sub)+'</span>' : "")+'</div>';
    }).join("")+'</div>';
  }
  var field={search:"searchTerms",shape:"roleShape",hard:"hardRules",scored:"scored",upside:"upside",red:"red",interview:"interview",decide:"decisions"};
  function rated(list,lab,getP){
    var hi=list.filter(function(x){return getP(x)==="high";}), md=list.filter(function(x){return getP(x)==="medium";});
    function grp(t,a){ return '<div class="ovsec" style="margin-top:8px"><span class="eyebrow">'+t+' · '+a.length+'</span>'+
      (a.length? ulist(a.map(function(x){return x.name||x.id;}).sort()) : '<span class="lede" style="font-size:12.5px">None.</span>')+'</div>'; }
    var k="about-"+lab.toLowerCase();
    return '<details class="card panel cfold" style="display:block" data-exp="'+k+'"'+(isOpen(k)?" open":"")+'>'+
      '<summary>'+lab+': Want it and Would consider<span class="cfmeta">'+(hi.length+md.length)+'</span></summary>'+
      grp("Want it",hi)+grp("Would consider",md)+
      (function(){ var rest=list.length-hi.length-md.length, one=lab==="Companies"?"company":"sector";
        return '<p class="lede" style="font-size:12.5px;margin:8px 0 0">'+(rest? "Plus "+rest+" more "+(rest===1?one:lab.toLowerCase())+" rated If it appears or not yet rated, still in the search. " : "")+
          '<a href="#" data-gotab="'+lab.toLowerCase()+'">Rate them on '+lab+' →</a></p>'; })()+'</details>';
  }
  var prefs = !PREFS? '<p class="lede" style="margin:0">No preferences on the board yet.</p>' :
    '<div class="stack">'+
    '<p class="lede" style="font-size:12.5px;margin:0">The source of truth for the search, v'+esc(F.version||"")+'. Change a rule here and the next sweep uses it.</p>'+
    PREF_SECS.map(function(x){
      /* Deal-breakers have their own panel with evidence and review (20-rules.js, 3 Oct). */
      /* My targets (5 Oct, 28-targets-health.js): the user's own goals the Highlights judge against. */
      if(x.k==="targets") return typeof tgPanelHtml==="function"? tgPanelHtml() : "";
      if(x.k==="hard" && typeof rulesPanelHtml==="function") return rulesPanelHtml();
      /* The other sections as rows too (21-search-review.js, 3 Oct). */
      if(typeof PR_SPEC!=="undefined" && PR_SPEC[x.k] && typeof prSectionHtml==="function") return prSectionHtml(x.k);
      var body = x.k==="search" ? (F.searchTerms||[]).map(function(g){
          return '<div class="ovsec" style="margin-top:6px"><span class="eyebrow">'+esc(g.group||"")+'</span><div class="row" style="gap:5px">'+
            String(g.terms||"").split(",").map(function(t){ t=t.trim(); return t? '<span class="chip">'+esc(t)+'</span>' : ""; }).join("")+'</div></div>';
        }).join("") || '<span class="lede" style="font-size:12.5px">None yet.</span>' : rows(F[field[x.k]],x.k);
      return '<div class="card panel">'+secHead(x.title,"prefs",x.k)+body+'</div>';
    }).join("")+
    rated(companies.filter(function(c){ return ["excluded","defunct","rejected"].indexOf(c.listing||"target")<0; }),"Companies",function(c){return c.priority||"unrated";})+
    rated(sectors,"Sectors",secPri)+
    '</div>';
  var asw=el("about-sw"); if(asw) asw.innerHTML="";
  box.innerHTML = subTabs("about",[{k:"static",label:"Static info",html:stat},{k:"prefs",label:"My criteria",html:prefs},{k:"skills",label:"Skills",html:skillsPanel()},{k:"templates",label:"Templates",html:templatesPanel()}],"static");
  if(typeof pageheadSync==="function") pageheadSync();
}

/* ---------- sectors ---------- */
/* Sector cards on the company-card pattern (1 Oct): name and scope, stance as status, a stance
   picker as the quick control; open = controls, then Overview · Research · Questions · Meetings. */
function renderSectors(){
  var box=el("sec-list"); if(!box) return;
  var ss=el("sec-stance");
  if(ss && !ss.options.length) ss.innerHTML=PRIOPTS.map(function(x){
    return '<option value="'+x[0]+'"'+(x[0]==="unrated"?" selected":"")+'>'+esc(x[1])+'</option>'; }).join("");
  function fp(v){ return v? '<p style="margin:0;font-size:13.5px;color:var(--ink-2);white-space:pre-wrap">'+esc(v)+'</p>' : ""; }
  function fsec(label,body){ return body? '<div class="ovsec"><span class="eyebrow">'+esc(label)+'</span>'+body+'</div>' : ""; }
  function card(x){
    var sid="sec-"+x.id, st=secPri(x), cv=convsForSec(x.id), cos=cosOfSec(x.id);
    var pick='<select class="prisel p-'+esc(st)+'" data-act="sec_stance" data-id="'+esc(x.id)+'" title="How much you want this sector">'+
      PRIOPTS.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===st?" selected":"")+'>'+esc(o[1])+'</option>'; }).join("")+'</select>';
    /* Controls like the company card (2 Oct): Priority, how covered it is by companies, and a
       chart of the roles across them. Remove lives in the Edit form. */
    var cos2=cosOfSec(x.id), live2=cos2.filter(function(c){ return coState(c.id).k!=="none"; }).length, inSw=cos2.filter(function(c){return c.watch;}).length;
    var secRoles=secRolesOf(x.id), direct=secRoles.filter(function(r){ return (r.sectorIds||[]).indexOf(x.id)>=0; }).length;
    var agg=CO_STAGES.map(function(st){ return {k:st[0], label:st[1], tab:st[2], n:secRoles.filter(function(r){return st[3][r.stage];}).length}; });
    var secTop=(function(){ var n={}; agg.forEach(function(a){n[a.k]=a.n;});
      return n.applied? ["Applied","cs-good"] : n.toapply? ["To apply","cs-good"] : n.shortlist? ["Shortlist","cs-acc"] : n.longlist? ["Longlist","cs-acc"] : n.ended? ["Ended","cs-dim"] : ["No roles","cs-dim"]; })();
    var help=(x.help||[]).length;
    var controls='<div class="shead compact cotl coctl">'+
      '<div class="coctl-f"><span class="eyebrow">Priority</span>'+pick+'<span class="coctl-why">How much you want this sector. It orders the Sectors list.</span></div>'+
      '<div class="coctl-f"><span class="eyebrow">Companies</span>'+
        (cos2.length? '<span class="cocount"><b>'+cos2.length+'</b> linked · <b>'+inSw+'</b> in the sweep · <b>'+live2+'</b> with live roles</span>'
          : '<span class="coctl-why" style="margin:0">None linked. Link companies from their Edit form.</span>')+
        (help? '<span class="coctl-why"><b class="cowarm">Help on offer · '+help+'</b></span>' : "")+'</div>'+
      '<div class="coctl-f coctl-chart"><span class="eyebrow">Roles</span>'+coChart(agg)+
        (direct? '<span class="coctl-why">Includes '+direct+' role'+(direct===1?"":"s")+' linked to this card directly</span>' : "")+'</div>'+
      '<span class="statushint" id="secrm-'+esc(x.id)+'"></span></div>';
    var overview = '<div class="tcards">'+
      tc("Details","What this sector is",editBtn("sector",x.id),editBox("sector",x.id)+
        (x.caveat? '<div class="notice warn" style="font-size:12.5px"><b>Weight:</b> '+esc(x.caveat)+'</div>' : "")+
        '<div class="tcols">'+tpara("Summary",x.summary)+tpara("What it covers",x.scope)+'</div>')+
      tc("Companies on this card",cos.length+" linked","",cos.length? '<div class="corows">'+cos.map(function(c){
          var f=coState(c.id); return '<div class="comeet"><span class="cmt-t">'+esc(c.name||c.id)+'</span><span class="cmt-w"></span><span class="spill sm">'+esc(coTop(c.id)[0])+'</span></div>'; }).join("")+'</div>'
        : tnone("None linked yet — set a company’s sector card in its editor."))+'</div>';
    var srsch=tpara("How the sector sees my background",x.transition)+tpara("What the job is like inside",x.job);
    var fields = '<div class="tcards">'+
      tc("Sector research","How it sees you, and what the job is like",editBtn("sector",x.id),editBox("sector",x.id)+(srsch? '<div class="tcols">'+srsch+'</div>' : tnone("Not researched yet.")))+
      tpair(["CV angle","What to lead with","",tlist(x.cvAngle,"pos")||tnone("None yet.")],["Gaps","To close or answer","",tlist(x.gaps,"warn")||tnone("None yet.")])+
      tpair((x.rules||[]).length? ["Rules that apply","Your criteria, as they bite here","",tlist(x.rules)] : null,(x.help||[]).length? ["Help on offer","And what you owe back","",tlist(x.help)] : null)+
      '</div>';
    var notes=x.notes||[];
    var notesTab='<div class="tcards">'+tc("Notes","Anything that doesn’t fit the research",noteBtn("sec",x.id),noteList(notes,"sec_delnote",x.id)||tnone("None yet."))+'</div>';
    var research=subTabs(sid+"/res",[{k:"fields",label:"Fields",html:fields},{k:"notes",label:"Notes",n:notes.length||"",html:notesTab}],"fields");
    var qs=x.questions||[];
    var questions='<div class="tcards">'+tc("Ask in every interview in this sector","Answers are kept on each company’s card",editBtn("secq",x.id,"Edit"),
      editBox("secq",x.id)+(qs.length? '<ul class="qalist">'+qs.map(function(q){ return '<li><div class="qaq"><span>'+esc(q)+'</span><span class="qaacts">'+
        '<button type="button" class="linkbtn qarm" data-act="qa_rm" data-rk="sector" data-rid="'+esc(x.id)+'" data-role="" data-q="'+esc(q)+'">Remove</button></span></div></li>'; }).join("")+'</ul>' : tnone("None recorded.")))+'</div>';
    /* Meetings: each meeting a note points at, collapsed with its notes inside; other notes folded. */
    var used={}, mids=[];
    cv.forEach(function(v){ if(v.meetingId && mids.indexOf(v.meetingId)<0) mids.push(v.meetingId); });
    var mtS=mtBlock("sector",x.id);
    var ms=commitments.filter(function(m){return mids.indexOf(m.id)>=0 && mtItemsFor("sector",x.id).indexOf(m)<0;}).sort(function(a,b){ return String(b.date||"9999").localeCompare(String(a.date||"9999")); });
    Object.keys(mtS.used).forEach(function(k){ used[k]=1; });
    var lab={booked:"Booked",done:"Done",offered:"Waiting",conditional:"Pending"};
    var meetings='<div class="ivtab ivcards">'+mtS.html+(ms.length? '<div class="stages">'+ms.map(function(m){
        var late=m.state==="booked" && m.date && m.date<today();
        var stt=late? "Not logged" : (lab[m.state]||m.state);
        var cls=late? "weak" : m.state==="done"? "strong" : m.state==="booked"? "warm" : m.state==="offered"? "mid" : "";
        var ns=cv.filter(function(v){return v.meetingId===m.id;}); ns.forEach(function(v){used[v.id]=1;});
        var key="sem~"+m.id;
        return '<details class="stage" data-sk="'+esc(key)+'"'+(STAGEOPEN[key]?" open":"")+'><summary class="stsum">'+
            '<span class="stname" title="'+esc(m.title||"")+'">'+esc(m.title||"Meeting")+'</span>'+
            '<span class="spill '+cls+' ststat">'+esc(stt)+'</span>'+
            '<span class="sttype"><span class="chip">'+esc(m.person||m.org||"")+'</span></span>'+
            '<span class="chip code stwhen">'+esc(m.date? niceShort(m.date)+(m.time? " · "+m.time : "") : (m.blockedBy||"no date yet"))+'</span>'+
          '</summary><div class="stbody"><div class="stsec" style="border-top:none;padding-top:0"><span class="eyebrow">Meeting notes · '+ns.length+'</span>'+
            ns.map(function(v){return convEntry(v,false);}).join("")+
            '<div class="statusacts">'+logBtn("","","Add more notes",x.id,m.id)+'</div></div></div></details>';
      }).join("")+'</div>' : "")+
      (function(){ var loose=cv.filter(function(v){return !used[v.id];});
        return loose.length? '<div class="ivsec">'+ivHead("Other notes","",'')+foldRow("secloose~"+x.id,"Not tied to a meeting",String(loose.length),loose.map(function(v){return convEntry(v,false);}).join(""))+'</div>' : ""; })()+
      '</div>';
    var body=cardTabs({id:sid}, controls, [
      {k:"overview",label:"Overview",html:overview},
      {k:"research",label:"Research",html:research},
      {k:"questions",label:"Questions",n:qs.length||"",html:questions},
      {k:"meetings",label:"Meetings & tasks",n:(mtS.n+ms.length)||"",html:meetings}
    ],"overview");
    return '<article class="role cocard"><div class="rail'+((x.help||[]).length?" warmrail":"")+'"></div><div class="role-body">'+
      '<details class="rcard" data-id="'+esc(sid)+'"'+(isOpen(sid)?" open":"")+'>'+
        '<summary>'+
          '<span class="rsum-title">'+esc(x.name||x.id)+'</span>'+
          '<span class="rsum-status"><span class="eyebrow">Roles</span><span class="spill sm '+secTop[1]+'">'+esc(secTop[0])+'</span></span>'+
          '<span class="rsum-sub"><span class="rsum-co" title="'+esc(x.summary||x.scope||"")+'">'+esc(x.summary||x.scope||"")+'</span>'+
            '<span class="copri"><span class="eyebrow">Priority</span>'+pick+'</span></span>'+
        '</summary>'+
        '<div class="rbody">'+body+'</div>'+
      '</details>'+
    '</div></article>';
  }
  var order={high:0,medium:1,low:2,unrated:3};
  var list=sectors.slice().sort(function(a,b){
    var d=order[secPri(a)]-order[secPri(b)]; if(d) return d;
    return String(a.name||"").localeCompare(String(b.name||""));
  });
  box.innerHTML = list.length? list.map(card).join("")
    : '<div class="card empty"><b>No sectors yet.</b>Log a conversation about a sector, or add one below.</div>';
}

function renderCounts(){
  /* Week ahead badge = Loose ends (looseEnds in 17): chases due, unlocked meetings to book, meetings to log,
     overdue tasks, and items called off because their role closed. Today's plan is not counted. */
  var tw=today();
  /* Since 2 Oct  the badge is the Loose ends count: only what needs you now, never today's plan. */
  /* Week ahead badge (5 Oct): today's items not yet done (meetings, tasks, prep, repeats, deadlines, overdue tasks carried to today). */
  setCount("tc-week", dayItems(today()).filter(function(x){ return !x.done; }).length);
  setCount("tc-gate1", nStage("proposed"));
  setCount("tc-gate2", nStage("consideration")+nStage("parked"));
  /* One badge rule (1 Oct): full colour when something there needs you, grey when it is
     all waiting on someone else. Gate 2 needs you only for undecided roles, not parked ones;
     To apply only once a pack is ready to send. */
  var g2b=el("tc-gate2"); if(g2b) g2b.classList.toggle("quiet", !nStage("consideration"));
  var taReady=roles.filter(function(r){ return r.stage==="prep" && packReady(r); }).length, tab2=el("tc-toapply");
  if(tab2){ tab2.classList.toggle("quiet", !taReady); tab2.dataset.note = nStage("prep")? (taReady? taReady+" ready to send" : "CVs coming") : ""; }
  var nRead=roles.filter(function(r){ return GATES[r.stage] && needsRead(r); }).length, tg2=el("tc-gate2");
  if(tg2){ tg2.classList.toggle("hot", nRead>0); tg2.dataset.note = nRead? nRead+" can\'t be read" : ""; }
  setCount("tc-toapply", nStage("prep"));
  /* Counts what is waiting on YOU, not how many are live — Ruled 28 Sep.
     Totals sit on the band headings inside the tab; no number means nothing needs you. */
  /* 30 Sep: show the total so live applications never look like nothing; the badge is
     full strength only when at least one needs the user, and quiet (grey) when all are in their court. */
  var ap=roles.filter(function(r){ return r.stage==="applied"||r.stage==="offer"; });
  var apMine=ap.filter(function(r){ return playStatus(r).mine; }).length;
  setCount("tc-inplay", ap.length);
  var tci=el("tc-inplay");
  if(tci){ tci.classList.toggle("quiet", !apMine);
    tci.dataset.note = ap.length? (apMine? apMine+" needs you" : "none need you") : "";
    tci.title = ap.length? (apMine+" of "+ap.length+" need"+(apMine===1?"s":"")+" you") : ""; }
  var sweeps=runs.filter(function(r){return r.type!=="verify" && r.type!=="manual";})
    .sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
  /* This eyebrow sits on the manual-pass card, so it reports the manual pass.
     The agent's last sweep is on the sourcing-health panel, where it belongs. */
  var mans=runs.filter(function(r){return r.type==="manual";})
    .sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
  renderManualPasses();
  var ns=el("nosweep"); if(ns) ns.hidden = sweeps.length>0;
  /* Channels header (4 Oct): the sweep's last run and expected next one, learnt from its history. */
  var sm=el("ch-sweepmeta"); if(sm){ var SS=sweepState();
    sm.textContent = SS.last? "Last sweep "+niceShort(SS.last)+" · "+nextSweepTxt(SS)+(SS.usual? " · usually every "+SS.usualTxt : "") : "No sweep yet · runs on its scheduled task, or on demand";
    sm.classList.toggle("fhwarn", SS.k==="Stale"); }
  syncTabSel();
}


/* ---------- Pipeline widget (1 Oct) ----------
   Gate 2, To apply and Applied as three read-only columns on Week ahead. Gate 1 stays out: it is
   triage, and Mass review handles it. No dragging: a move needs a gate, a score or a reason.
   Clicking a card opens it in its own tab. Collapsed by default; open state lasts the session. */
function renderPipeW(){
  var host=el("pw-cols"); if(!host) return;
  var t=today();
  function age(d){ if(!d) return ""; var g=dayGap(d,t); return g<=0? "today" : g+"d"; }
  function nx(r){
    if(r.stage==="consideration") return needsRead(r)? {s:"Can't read the ad",mine:true} : g2Pending(r)? {s:"Research tomorrow",mine:false} : {s:"Decide",mine:true};
    if(r.stage==="parked") return {s:"Parked",mine:false};
    if(r.stage==="prep") return packReady(r)? {s:"CV ready, apply",mine:true} : {s:"CV being made",mine:false};
    var f=flowOf(r); return {s:f.label,mine:f.mine};
  }
  var COLS=[
    {k:"gate2",  label:"Shortlist",  st:["consideration","parked"], at:function(r){return r.g1At;}},
    {k:"toapply",label:"To apply",st:["prep"],                     at:function(r){return r.g2At;}},
    {k:"inplay", label:"Applied", st:["applied","offer"],          at:function(r){return r.appliedAt;}}
  ];
  var need=0, sum=[], strip=[];
  host.innerHTML=COLS.map(function(c){
    var rs=roles.filter(function(r){return c.st.indexOf(r.stage)>=0;}).map(function(r){ return {r:r,n:nx(r)}; })
      .sort(function(a,b){ return (b.n.mine?1:0)-(a.n.mine?1:0) || String(c.at(a.r)||"").localeCompare(String(c.at(b.r)||"")); });
    var mine=rs.filter(function(x){return x.n.mine;}).length; need+=mine;
    sum.push(c.label+" <b>"+rs.length+"</b>");
    strip.push('<button type="button" class="pwtile'+(mine?" hot":"")+'" data-act="pw_tab" data-tab="'+c.k+'"><span class="l">'+esc(c.label)+'</span><span class="v">'+rs.length+'</span><span class="s">'+(mine? mine+" need"+(mine===1?"s":"")+" you" : rs.length? "all clear" : "empty")+'</span></button>');
    return '<div class="pwcol"><button type="button" class="pwhead" data-act="pw_tab" data-tab="'+c.k+'"><span>'+esc(c.label)+'</span><span class="n">'+(mine? '<span class="need">'+mine+' need'+(mine===1?'s':'')+' you</span> \u00b7 ' : '')+rs.length+'</span></button>'+
      '<div class="pwlist">'+(rs.length? rs.map(function(x){ var r=x.r;
        return '<button type="button" class="pwcard'+(x.n.mine?" mine":"")+'" data-act="pw_open" data-id="'+esc(r.id)+'" data-tab="'+c.k+'" title="Open this role">'+
          '<span class="t">'+esc(r.title||"Untitled role")+refTag(r)+'</span><span class="c">'+esc(r.company||"")+'</span>'+
          '<span class="m"><span class="nx">'+esc(x.n.s)+'</span><span>'+esc(age(c.at(r)))+'</span></span></button>';
      }).join("") : '<div class="pwempty">Nothing here.</div>')+'</div></div>';
  }).join("");
  el("pw-sum").innerHTML=sum.join(" \u00b7 ");
  var ps=el("pw-strip"); if(ps) ps.innerHTML=strip.join("");
  var nb=el("pw-need"); nb.hidden=!need; nb.textContent=need+" need"+(need===1?"s":"")+" you";
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest('[data-act="pw_open"],[data-act="pw_tab"]'); if(!b) return;
  ev.preventDefault();
  if(b.dataset.act==="pw_open" && expanded) expanded.add(b.dataset.id);
  showTab(b.dataset.tab); render();
  if(b.dataset.act==="pw_open"){
    var id=b.dataset.id;
    setTimeout(function(){
      var d=document.querySelector('#tab-'+b.dataset.tab+' details.rcard[data-id="'+(window.CSS&&CSS.escape? CSS.escape(id) : id)+'"]');
      if(d){ d.open=true; d.scrollIntoView({block:"start",behavior:"smooth"}); }
    },30);
  } else window.scrollTo({top:0,behavior:"smooth"});
});

/* ---------- Rule out roles like this (1 Oct) ----------
   On every reject flow. Claude reads the role, the reason and the note, and drafts either an addition
   to an existing hard rule or a new one. Nothing saves until you press Save; once saved it is live —
   the sweep and Gate 2 read profile/prefs on their next run. */
var RL={id:"", rules:[]};
function rlReason(id){
  if(!el("mr").hidden && MR.ids[MR.i]===id) return {why:MR.why||"", note:(el("mr-note")&&el("mr-note").value.trim())||""};
  var box=el("rej-"+id), p=box && box.querySelector('.reasons:not([hidden]) [aria-pressed="true"]');
  return {why:p? p.dataset.r : "", note:(el("rejnote-"+id)&&el("rejnote-"+id).value.trim())||""};
}
function rlPreview(){
  var t=el("rl-target").value, txt=el("rl-text").value.trim(), cur=RL.rules.find(function(x){return x.id===t;});
  el("rl-newf").hidden = t!=="new";
  el("rl-tlabel").textContent = t==="new"? "Rule" : "What to add to "+t;
  el("rl-prev").textContent = cur && txt? (t+" will read: "+cur.rule+" "+txt) : "";
}
el("rl-target").addEventListener("change",rlPreview);
el("rl-text").addEventListener("input",rlPreview);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="rl_open"]'); if(!b) return;
  ev.preventDefault();
  var r=rawRoles.find(function(x){return x.id===b.dataset.id;}); if(!r) return;
  RL={id:r.id, rules:((PREFS&&PREFS.hardRules)||[]).slice()};
  var why=rlReason(r.id);
  el("rl-lede").textContent=(r.title||"")+" \u2014 "+(r.company||"")+(why.why? " \u00b7 "+why.why : "")+(why.note? " \u00b7 \u201c"+why.note+"\u201d" : "");
  el("rl-target").innerHTML=RL.rules.map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.id+" \u2014 "+x.name)+'</option>'; }).join("")+'<option value="new">New hard rule</option>';
  el("rl-target").value="new"; el("rl-text").value=""; el("rl-name").value=""; el("rl-hint").textContent="";
  el("rl-save").disabled=!DB; rlPreview();
  var d=el("rl-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  if(!SAMPLE){ el("rl-hint").textContent="Claude isn't available in this view \u2014 write the rule yourself."; return; }
  el("rl-hint").textContent="Claude is drafting\u2026"; var ta=el("rl-text"); ta.disabled=true;
  var e=r.enrich||{};
  var prompt="You maintain a job seeker's hard rules: a role that fails any rule is dropped before the user sees it. "+
    "The user just rejected a role and wants to rule out roles like it. Draft the smallest precise rule change.\n\n"+
    "Existing hard rules (id | name | when it fires | rule):\n"+RL.rules.map(function(x){return x.id+" | "+x.name+" | "+x.fires+" | "+x.rule;}).join("\n")+
    "\n\nRejected role: "+(r.title||"")+" at "+(r.company||"")+(r.location? " ("+r.location+")" : "")+
    (e.summary? "\nSummary: "+String(e.summary).slice(0,600) : "")+
    "\nTheir reason: "+(why.why||"not given")+(why.note? "\nTheir note: "+why.note : "")+
    "\n\nRules: prefer extending an existing rule when the new exclusion is the same kind of thing. Say what is out AND what stays in, so it does not over-reach. "+
    "Plain "+engVar()+" English, one or two sentences, no quotes.\n"+
    'Reply with JSON only: {"target":"<existing id> or new","name":"<short name, only for new>","fires":"Search | Search, else Gate 2 | Enrichment","text":"<sentence(s) to append, or the whole rule if new>"}';
  var go = SAMPLE.json? SAMPLE.json([{role:"user",content:prompt}],{cache:false, modelTier:"default"})
                      : SAMPLE([{role:"user",content:prompt}],{cache:false, modelTier:"default"}).then(function(x){ var m=String(x.text||"").match(/\{[\s\S]*\}/); return m? JSON.parse(m[0]) : {}; });
  go.then(function(j){
    if(RL.id!==r.id) return;
    var t = j && j.target && (j.target==="new" || RL.rules.some(function(x){return x.id===j.target;}))? j.target : "new";
    el("rl-target").value=t; ta.value=(j&&j.text)||""; el("rl-name").value=(j&&j.name)||"";
    if(j && j.fires) el("rl-fires").value=j.fires;
    el("rl-hint").textContent="Draft from Claude \u2014 edit before saving."; ta.disabled=false; rlPreview();
  }).catch(function(err){
    ta.disabled=false; el("rl-hint").textContent= err && err.code==="not_granted"? "Claude wasn't allowed \u2014 write the rule yourself." : "Couldn't draft one \u2014 write the rule yourself.";
  });
});
el("rl-save").addEventListener("click",function(){
  var t=el("rl-target").value, txt=el("rl-text").value.trim();
  if(!txt){ el("rl-hint").textContent="Write the rule first."; return; }
  if(!DB || !PREFS){ el("rl-hint").textContent="Preferences haven't loaded."; return; }
  var rules=(PREFS.hardRules||[]).map(function(x){return Object.assign({},x);}), msg, logE;
  if(t==="new"){
    var name=el("rl-name").value.trim(); if(!name){ el("rl-hint").textContent="Give the new rule a short name."; return; }
    var n=rules.reduce(function(m,x){ var k=parseInt(String(x.id).replace(/\D/g,""),10); return isNaN(k)? m : Math.max(m,k); },0)+1;
    rules.push({id:"G"+n, name:name, fires:el("rl-fires").value, rule:txt}); msg="G"+n+" added \u2014 live from the next run";
    logE={ruleId:"G"+n, action:"add", before:null, after:{id:"G"+n, name:name, fires:el("rl-fires").value, rule:txt}, via:"ruleout", why:""};
  } else {
    var x=rules.find(function(y){return y.id===t;}); if(!x) return;
    var b4={id:x.id, name:x.name||"", fires:x.fires||"", rule:x.rule||""};
    x.rule=(String(x.rule||"").trim()+" "+txt).trim(); msg=t+" updated \u2014 live from the next run";
    logE={ruleId:t, action:"edit", before:b4, after:{id:x.id, name:x.name||"", fires:x.fires||"", rule:x.rule}, via:"ruleout", why:""};
  }
  DB.doc("profile/prefs").update({hardRules:rules, updatedAt:today()})
    .then(function(){ toast(msg); closeDlg("rl-dialog"); if(logE && typeof ruLogEntry==="function") ruLogEntry(logE); })
    .catch(function(e){ console.warn(e); el("rl-hint").textContent="Couldn't save \u2014 try again."; });
});
