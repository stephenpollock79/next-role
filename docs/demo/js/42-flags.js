"use strict";
/* ===== One ! for anything worth a look, and same-role pairs (11 Oct) =====
   1. The ! before a role's title now covers more than a closing date. Red: closes in 3 days or less (or the
      date has passed) — still the only thing that sorts a role to the top. Amber: something else worth a look,
      for now "may be the same role as another one" (the role's `maybeSameAs`). Clicking it opens a small pop-up
      listing each issue; nothing is decided there.
   2. Data health › Duplicates gains "Possibly the same role": every role with `maybeSameAs` (written by the sweep's
      same-seat check) that the older "Possible matches for roles you added" check doesn't already show. Same role /
      Not the same, with undo. What Same role does depends on the earlier role:
        live (Longlist to Applied) → keep the earlier one, take the new link if it's checked live or the earlier has
                                     none, delete the new row;
        turned down (endBy me or them), or folded → close the new one with the earlier reason;
        pulled or filled (endBy neither) → keep the new one: the role looks reopened.
      Not the same → `notSameAs` on the new role, `maybeSameAs` cleared; never asked again.
   `maybeSameAs` is a role id, or "folded:<urlKey or company|title>" for a role folded into `decided`, with the
   folded role's facts in `sameAsNote` {title, company, by, reason, at}. */

var FLG_LIVE={proposed:1, consideration:1, parked:1, prep:1, applied:1, offer:1};
function flgOther(r){
  var m=r && r.maybeSameAs; if(!m) return null;
  var nots=r.notSameAs||[];
  if(nots.indexOf(m)>=0) return null;
  if(String(m).indexOf("folded:")===0){ var n=r.sameAsNote||{}; return {folded:true, key:m, title:n.title||"", company:n.company||"", by:n.by||"", reason:n.reason||"", at:n.at||""}; }
  var o=rawRoles.find(function(x){ return x.id===m; }); if(!o || o.id===r.id) return null;
  if((o.notSameAs||[]).indexOf(r.id)>=0) return null;
  return {role:o};
}
function flgDupLine(r){
  if(!r || !FLG_LIVE[r.stage]) return null;
  var o=flgOther(r); if(!o) return null;
  if(o.folded) return "May be the same role as one you turned down"+(o.at? " on "+niceShort(String(o.at).slice(0,10)) : "")+": "+o.title+" · "+o.company;
  var a=o.role, st=(typeof HY_STG!=="undefined" && HY_STG[a.stage])||a.stage;
  return "May be the same role as "+(a.ref? "#"+a.ref+" " : "")+(a.title||"")+" · "+(a.company||"")+" ("+st+")";
}
function flgIssues(r){
  var out=[], d=closeSoon(r);
  if(d!=null){ var when=niceShort(r.closing);
    out.push({k:"close", t: d<0? "Closing date passed ("+when+") — check it’s still open" : d===0? "Closes today ("+when+")" : "Closes in "+d+" day"+(d===1?"":"s")+" ("+when+")"}); }
  var dl=flgDupLine(r); if(dl) out.push({k:"dup", t:dl});
  return out;
}
closeBang=function(r){
  var is=flgIssues(r); if(!is.length) return "";
  var red=is.some(function(x){ return x.k==="close"; }), t=is.map(function(x){ return x.t; }).join(" · ");
  return '<span class="closebang'+(red? "" : " amb")+'" role="button" tabindex="0" data-flg="'+esc(r.id)+'" title="'+esc(t)+'" aria-label="'+esc(t)+'">!</span>';
};

/* ---------- the pop-up ---------- */
function flgClose(){ var p=el("flg-pop"); if(p) p.remove(); }
function flgOpen(b){
  flgClose();
  var id=b.getAttribute("data-flg"), r=rawRoles.find(function(x){ return x.id===id; }); if(!r) return;
  var is=flgIssues(r); if(!is.length) return;
  var p=document.createElement("div"); p.id="flg-pop"; p.className="flgpop"; p.setAttribute("role","dialog");
  p.innerHTML='<div class="flgh">'+esc((r.ref? "#"+r.ref+" " : "")+(r.title||""))+'</div>'+is.map(function(x){
    return '<div class="flgi '+x.k+'"><span class="flgd"></span><span>'+esc(x.t)+
      (x.k==="dup"? '<br><a href="#" data-flggo="1">Same role or not? Decide in Data health →</a>' : "")+'</span></div>'; }).join("");
  document.body.appendChild(p);
  var rc=b.getBoundingClientRect(), w=Math.min(320, window.innerWidth-24);
  p.style.width=w+"px";
  var left=Math.max(12, Math.min(rc.left+window.scrollX, window.scrollX+window.innerWidth-w-12));
  p.style.left=left+"px"; p.style.top=(rc.bottom+window.scrollY+6)+"px";
}
["mousedown","pointerdown","keydown"].forEach(function(evt){ document.addEventListener(evt,function(ev){
  var b=ev.target.closest && ev.target.closest("[data-flg]");
  if(b){ ev.stopPropagation(); if(evt==="keydown" && (ev.key==="Enter"||ev.key===" ")){ ev.preventDefault(); flgOpen(b); }
    else if(evt==="keydown" && ev.key==="Escape") flgClose(); return; }
  if(evt==="keydown" && ev.key==="Escape") flgClose();
  else if(evt!=="keydown" && !(ev.target.closest && ev.target.closest("#flg-pop"))) flgClose();
},true); });
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-flg]");
  if(b){ ev.preventDefault(); ev.stopPropagation(); if(el("flg-pop") && el("flg-pop").dataset.for===b.getAttribute("data-flg")){ flgClose(); return; } flgOpen(b); var p=el("flg-pop"); if(p) p.dataset.for=b.getAttribute("data-flg"); return; }
  var g=ev.target.closest && ev.target.closest("[data-flggo]");
  if(g){ ev.preventDefault(); ev.stopPropagation(); flgClose(); try{ if(typeof spClose==="function") spClose(); }catch(e){} showTab("health");
    setTimeout(function(){ var want=(typeof HY_SEC_PLAIN!=="undefined" && HY_SEC_PLAIN.Duplicates)||"Duplicates";
      var h=[].slice.call(document.querySelectorAll("#hy-body .hyc h3")).find(function(x){ return x.textContent.trim()===want; });
      if(h && h.scrollIntoView) h.scrollIntoView({block:"center"}); },120); }
},true);
window.addEventListener("scroll",flgClose,{passive:true});
window.addEventListener("resize",flgClose);

/* ---------- Data health: Possibly the same role ---------- */
var FLG_CHECK="Possibly the same role";
HY_PLAIN[FLG_CHECK]=[FLG_CHECK,"Found through different routes or under a different title. Same role keeps one record; only you can say.","you"];
if(typeof HY_YOUDO!=="undefined") HY_YOUDO[FLG_CHECK]="Same role or not?";
function flgPairs(){
  var covered={};
  try{ matchPairs().forEach(function(x){ covered[x.b.id]=1; covered[x.a.id]=1; }); }catch(e){}
  return rawRoles.filter(function(r){ return FLG_LIVE[r.stage] && !covered[r.id] && flgOther(r); })
    .map(function(r){ return {k:"dup", id:r.id, b:r, o:flgOther(r), label:(r.ref? "#"+r.ref+" " : "")+(r.title||"")}; });
}
hygiene=(function(orig){ return function(){
  var out=orig(), its=flgPairs();
  out.push({sec:"Duplicates", title:FLG_CHECK, why:HY_PLAIN[FLG_CHECK][1], items:its, sev:"fix"});
  return out;
}; })(hygiene);
/* Each side of a pair carries an icon link to its ad, so both can be checked before deciding (19 Oct). */
var FLG_ADIC='<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function flgAdUrl(u){ u=String(u||"").trim(); return /^https?:\/\//i.test(u)? u : ""; }
function flgAdA(u){ return '<a class="flgad" href="'+esc(u)+'" target="_blank" rel="noopener" title="Open the ad — '+esc(hostOf(u))+'" aria-label="Open the ad">'+FLG_ADIC+'</a>'; }
function flgAdRole(r){
  var u=flgAdUrl(r && r.url); if(u) return flgAdA(u);
  var h=(typeof postLink==="function")? postLink(r) : "";
  return h? h.replace('class="postlink','class="postlink flgad') : '<span class="flgad none" title="No link to the ad on this role">'+FLG_ADIC+'</span>';
}
function flgAdFolded(key){
  var k=String(key||"").replace(/^folded:/,"");
  var m=/^linkedin:(\d+)$/i.exec(k); if(m) return flgAdA("https://www.linkedin.com/jobs/view/"+m[1]);
  if(/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(k) && k.indexOf("|")<0) return flgAdA("https://"+k);
  return '<span class="flgad none" title="No link kept for this folded role">'+FLG_ADIC+'</span>';
}
function flgSide(o){
  if(o.folded) return '<span>'+flgAdFolded(o.key)+'<b>'+esc(o.title)+'</b> · '+esc(o.company)+' — folded'+(o.reason? ", "+esc(o.reason) : "")+'</span>';
  var a=o.role, st=(typeof HY_STG!=="undefined" && HY_STG[a.stage])||a.stage;
  return '<span>'+flgAdRole(a)+'<a href="#" data-act="role_go" data-id="'+esc(a.id)+'"><b>'+esc(refTxt(a)+(a.title||""))+'</b></a> · '+esc(a.company||"")+' — '+esc(st)+'</span>';
}
hyItem=(function(orig){ return function(x){
  if(x && x.k==="pair") return '<div class="hypair"><span>'+flgAdRole(x.a)+'<a href="#" data-act="role_go" data-id="'+esc(x.a.id)+'"><b>'+esc(refTxt(x.a)+(x.a.title||""))+'</b></a> · '+esc(x.a.company||"")+' — added by you</span><span>↔</span>'+
    '<span>'+flgAdRole(x.b)+'<a href="#" data-act="role_go" data-id="'+esc(x.b.id)+'"><b>'+esc(refTxt(x.b)+(x.b.title||""))+'</b></a> · '+esc(srcLabel(x.b)||"an advert")+'</span>'+
    '<span class="hyacts"><button type="button" class="btn sm primary" data-act="pm_merge" data-id="'+esc(x.a.id)+'" data-cid="'+esc(x.b.id)+'">Same role, merge</button>'+
    '<button type="button" class="btn sm ghost" data-act="pm_not" data-id="'+esc(x.a.id)+'" data-cid="'+esc(x.b.id)+'">Not the same</button></span></div>';
  if(!x || x.k!=="dup") return orig(x);
  var b=x.b;
  return '<div class="hypair">'+flgSide(x.o)+'<span>↔</span>'+
    '<span>'+flgAdRole(b)+'<a href="#" data-act="role_go" data-id="'+esc(b.id)+'"><b>'+esc(refTxt(b)+(b.title||""))+'</b></a> · '+esc(srcLabel(b)||b.company||"")+' — new</span>'+
    '<span class="hyacts"><button type="button" class="btn sm primary" data-dup="same" data-id="'+esc(b.id)+'">Same role</button>'+
    '<button type="button" class="btn sm ghost" data-dup="not" data-id="'+esc(b.id)+'">Not the same</button></span></div>';
}; })(hyItem);

function flgEnded(o){ if(o.folded) return {by:o.by||"me", reason:o.reason||""}; var e=endOf(o.role); return e? {by:e.by, reason:e.reason||""} : null; }
function flgSnap(r,keys){ var s={}; keys.forEach(function(k){ s[k]=(r[k]===undefined)? null : r[k]; }); return s; }
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-dup]"); if(!b || !DB) return;
  ev.preventDefault(); ev.stopPropagation();
  var r=rawRoles.find(function(x){ return x.id===b.dataset.id; }); if(!r) return;
  var o=flgOther(r); if(!o) return;
  var key=o.folded? o.key : o.role.id, tag=(r.ref? "#"+r.ref+" " : "");
  b.disabled=true;
  function fail(e){ console.warn("same role",e); b.disabled=false; toast("Couldn't save — try again",true); }
  if(b.dataset.dup==="not"){
    var before=flgSnap(r,["notSameAs","maybeSameAs"]);
    DB.doc("roles/"+r.id).update({notSameAs:(r.notSameAs||[]).concat([key]), maybeSameAs:""}).then(function(){
      toastUndo(tag+"kept as a different role", function(){ DB.doc("roles/"+r.id).update(before).catch(function(e){ console.warn(e); }); });
    }).catch(fail);
    return;
  }
  /* Same role */
  var a=o.folded? null : o.role, live=a && FLG_LIVE[a.stage];
  if(live){
    var copy=Object.assign({},r); delete copy.id;
    var take=r.url && (!a.url || (r.linkChecked && r.linkMethod && !a.linkChecked));
    var patch={mergedFrom:r.id, mergedAt:today(), altUrls:(a.altUrls||[]).concat(r.url && r.url!==a.url? [r.url] : [])};
    if(take){ patch.url=r.url; patch.linkChecked=r.linkChecked||""; patch.linkMethod=r.linkMethod||""; patch.altUrls=(a.altUrls||[]).concat(a.url? [a.url] : []); }
    ["closing","salary","postingAge"].forEach(function(f){ if(!a[f] && r[f]) patch[f]=r[f]; });
    var aBefore=flgSnap(a,Object.keys(patch));
    /* Meetings, notes and materials on the merged role move to the kept one (QA 14 Oct). */
    var moves=[];
    commitments.forEach(function(c){ var p={}, b={};
      if(c.roleId===r.id){ p.roleId=a.id; b.roleId=r.id; }
      if(c.forKind==="role" && c.forId===r.id){ p.forId=a.id; b.forId=r.id; }
      if((c.tagRoles||[]).indexOf(r.id)>=0){ p.tagRoles=c.tagRoles.map(function(x){ return x===r.id? a.id : x; }); b.tagRoles=c.tagRoles.slice(); }
      if(Object.keys(p).length) moves.push({coll:"commitments", id:c.id, p:p, b:b}); });
    conversations.forEach(function(c){ if(c.roleId===r.id) moves.push({coll:"conversations", id:c.id, p:{roleId:a.id}, b:{roleId:r.id}}); });
    (typeof materials!=="undefined"? materials : []).forEach(function(m){ if(m.roleId===r.id) moves.push({coll:"materials", id:m.id, p:{roleId:a.id}, b:{roleId:r.id}}); });
    function mv(back){ return Promise.all(moves.map(function(m){ return DB.doc(m.coll+"/"+m.id).update(back? m.b : m.p); })); }
    DB.doc("roles/"+a.id).update(patch).then(function(){ return mv(false); }).then(function(){ return DB.doc("roles/"+r.id).delete(); }).then(function(){
      toastUndo(tag+"merged into "+(a.ref? "#"+a.ref : "the earlier role"), function(){
        DB.doc("roles/"+r.id).set(copy).then(function(){ return DB.doc("roles/"+a.id).update(aBefore); }).then(function(){ return mv(true); }).catch(function(e){ console.warn(e); }); });
    }).catch(fail);
    return;
  }
  var e=flgEnded(o)||{by:"me", reason:""};
  if(e.by==="neither"){
    var bf=flgSnap(r,["maybeSameAs","sameAs"]);
    DB.doc("roles/"+r.id).update({maybeSameAs:"", sameAs:key}).then(function(){
      toastUndo(tag+"kept — the role looks reopened", function(){ DB.doc("roles/"+r.id).update(bf).catch(function(x){ console.warn(x); }); });
    }).catch(fail);
    return;
  }
  var ll=r.stage==="proposed", t=today(), why=(END_LISTS[e.by==="them"? "them" : "me"]||[]).indexOf(e.reason)>=0? e.reason : (e.by==="them"? e.reason||"Other" : "Other");
  var cp={stage: ll? "g1_rejected" : "g2_rejected", endBy: e.by==="them"? "them" : "me", endReason: why,
    endNote:"Same role as "+(a && a.ref? "#"+a.ref : "one folded earlier")+(e.reason && why!==e.reason? " ("+e.reason+")" : ""),
    endStage: ll? "Gate 1" : "Gate 2", endAt:t, maybeSameAs:"", sameAs:key};
  if(ll){ cp.g1Reason=why; cp.g1At=t; } else if(!r.g2At){ cp.g2At=t; }
  var cb=flgSnap(r,Object.keys(cp));
  DB.doc("roles/"+r.id).update(cp).then(function(){
    toastUndo(tag+"closed as the same role: "+why, function(){ DB.doc("roles/"+r.id).update(cb).catch(function(x){ console.warn(x); }); });
  }).catch(fail);
},true);

(function(){ var st=document.createElement("style");
  st.textContent=".closebang{cursor:pointer}.closebang.amb{background:#D97706}"+
    ".flgpop{position:absolute;z-index:1000;background:var(--surface,#fff);color:var(--ink,inherit);border:1px solid var(--line,#ddd);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:10px 12px;font-size:13px;line-height:1.4;box-sizing:border-box}"+
    ".flgh{font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
    ".flgi{display:flex;gap:8px;align-items:flex-start;padding:3px 0}.flgd{flex:none;width:8px;height:8px;border-radius:50%;margin-top:6px;background:#D97706}.flgi.close .flgd{background:#DC2626}"+
    ".flgi a{color:var(--accent,inherit)}"+
    ".flgad{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:6px;vertical-align:-6px;border:1px solid var(--line,#ddd);border-radius:6px;color:var(--accent,inherit);background:transparent;padding:0;gap:0}"+
    "a.flgad:hover{background:var(--line,#eee)}.flgad>span{display:none}.flgad.none,.flgad.nolink{opacity:.35;cursor:default}";
  document.head.appendChild(st); })();
try{ render(); }catch(e){}
