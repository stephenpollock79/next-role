"use strict";
/* ===== Came-back roles and the morning read (5 Oct) =====
   1. Data health › Roles you turned down that came back: each item gets Reject again and Keep. Reject again
      closes the new role with the earlier reason (undo toast). Keep asks why (CB_REASONS, optional note), stores
      `cameBack` {keptAt, reason, note, prevId} on the role and a green flag "Came back — <reason>", and 28 then
      leaves it out of the check.
   2. Roles waiting for the morning read (pasted, added, or rescued by the screen-out check) wait on the Longlist; until it has run they aren't on you, so they
      leave the Longlist's "on you" count, the Roles badge, the app headline and Overview's Longlist line. */
var CB_REASONS=["Requirements changed (e.g. now remote)","Reconsidered — my view changed","Different team, level or scope","Pay or package changed","Rejected by mistake","Other"];
var CB_OPEN={};

/* ---------- 1. Reject again / Keep ---------- */
hyItem=(function(orig){ return function(x){
  var h=orig(x);
  if(!x || !x.cb) return h;
  var id=x.id, open=CB_OPEN[id];
  return '<div class="hycb">'+h+'<span class="hyacts">'+
    '<button type="button" class="btn sm" data-cb="rej" data-id="'+esc(id)+'" data-prev="'+esc(x.cb)+'">Reject again</button>'+
    '<button type="button" class="btn sm ghost" data-cb="keep" data-id="'+esc(id)+'" aria-expanded="'+(open? "true" : "false")+'">Keep…</button></span>'+
    (open? '<span class="cbform"><select data-cbr="'+esc(id)+'"><option value="">Why keep it?</option>'+CB_REASONS.map(function(r){ return '<option>'+esc(r)+'</option>'; }).join("")+'</select>'+
      '<input data-cbn="'+esc(id)+'" placeholder="Note — optional, e.g. now remote" maxlength="140">'+
      '<button type="button" class="btn sm primary" data-cb="save" data-id="'+esc(id)+'" data-prev="'+esc(x.cb)+'">Keep it</button></span>' : "")+
  '</div>';
}; })(hyItem);
/* Not `cbRole`: 49 has a global of that name. The earlier role may be folded into `decided`, so look there too (tgHist, 28). */
function cbBackRole(id){ if(!id) return null; var f=function(r){ return r.id===id; }; return rawRoles.find(f)||(typeof tgHist==="function"? tgHist().find(f) : null)||null; }
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-cb]"); if(!b || !DB) return;
  ev.preventDefault(); ev.stopPropagation();
  var a=b.dataset.cb, id=b.dataset.id, r=cbBackRole(id), prev=cbBackRole(b.dataset.prev); if(!r) return;
  if(a==="keep"){ CB_OPEN[id]=!CB_OPEN[id]; render(); return; }
  if(a==="rej"){
    var o=(prev? endOf(prev) : null)||{}, sl=r.stage==="proposed", st=sl? "g1_rejected" : "g2_rejected";
    var why=(END_LISTS.me.indexOf(o.reason)>=0)? o.reason : "Other", t=today();
    var before={stage:r.stage, endBy:r.endBy||"", endReason:r.endReason||"", endNote:r.endNote||"", endStage:r.endStage||"", endAt:r.endAt||"", endRule:r.endRule||"", endGap:r.endGap||""};
    var patch={stage:st, endBy:"me", endReason:why, endNote:"Came back; turned down before"+(prev && prev.ref? " as #"+prev.ref : "")+(o.reason && why==="Other"? " ("+o.reason+")" : ""), endStage: sl? "Gate 1" : "Gate 2", endAt:t};
    if(why!=="Other"){ patch.endRule=(prev&&prev.endRule)||""; patch.endGap=(prev&&prev.endGap)||""; }
    if(sl){ patch.g1Reason=why; patch.g1At=t; } else { patch.g2Reason=why; if(!r.g2At) patch.g2At=t; }
    b.disabled=true;
    DB.doc("roles/"+id).update(patch).then(function(){
      toastUndo((r.ref? "#"+r.ref+" " : "")+"rejected again: "+why, function(){ DB.doc("roles/"+id).update(before).catch(function(e){ console.warn(e); }); });
    }).catch(function(){ b.disabled=false; toast("Couldn't save — try again",true); });
    return;
  }
  if(a==="save"){
    var sel=document.querySelector('select[data-cbr="'+cssq(id)+'"]'), nt=document.querySelector('input[data-cbn="'+cssq(id)+'"]');
    var reason=sel? sel.value : "", note=nt? nt.value.trim() : "";
    if(!reason){ if(sel) sel.focus(); toast("Pick why you're keeping it",true); return; }
    var green=(r.green||[]).slice(); green.push("Came back — "+reason+(note? ": "+note : ""));
    b.disabled=true;
    DB.doc("roles/"+id).update({cameBack:{keptAt:today(), reason:reason, note:note, prevId:b.dataset.prev||""}, green:green}).then(function(){
      delete CB_OPEN[id];
      toastUndo((r.ref? "#"+r.ref+" " : "")+"kept: "+reason, function(){ DB.doc("roles/"+id).update({cameBack:null, green:r.green||[]}).catch(function(e){ console.warn(e); }); });
    }).catch(function(){ b.disabled=false; toast("Couldn't save — try again",true); });
  }
},true);

/* ---------- 2. Waiting for the morning read isn't on you ---------- */
/* Any Longlist role the card calls "Queued for research" (readState waiting), however it arrived: pasted, added, or rescued by the screen-out check. */
function llWaiting(r){ return r.stage==="proposed" && r.readState==="waiting"; }
funnelMine=(function(orig){ return function(){
  var n=orig(); if(n && n.gate1!=null) n.gate1=Math.max(0, n.gate1-roles.filter(llWaiting).length); return n;
}; })(funnelMine);
longlistLine=function(){
  var t=today(), all=roles.filter(function(r){ return r.stage==="proposed"; }), ll=all.filter(function(r){ return !llWaiting(r); }), w=all.length-ll.length;
  var old=ll.reduce(function(m,r){ var g=r.seen? dayGap(r.seen,t) : 0; return Math.max(m,g||0); },0);
  return '<p class="rwline"><a href="#" data-gotab="gate1">Longlist · '+ll.length+' to review'+(ll.length? " · oldest "+old+"d" : "")+(w? " · "+w+" waiting for the morning read" : "")+' →</a></p>';
};
