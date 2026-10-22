"use strict";
/* ===== Closed by the employer (5 Oct) =====
   The daily check (skill next-role-daily-check) closes a Shortlist, parked or To apply role whose ad has gone:
   stage g2_rejected, endBy "neither", endReason "Role pulled or filled", endStage "Gate 2", closedBy "daily-check",
   prevStage (where it was). Longlist roles still close silently, and Applied roles are never closed this way.
   Until you acknowledge one it is on you: a list at the top of the Closed page, a count under the Closed chevron,
   a group in Overview's Waiting on you, and part of the Roles badge (through needsYou and funnelMine).
   Two actions: Acknowledge (ackAt) and Still open, which puts the role back where it was and sets keepOpenAt so
   the daily check leaves it alone. */

var EC_STAGE={consideration:"Shortlist", parked:"Parked", prep:"To apply"};
function ecList(){
  return roles.filter(function(r){ return r.stage==="g2_rejected" && r.closedBy==="daily-check" && !r.ackAt; })
    .sort(function(a,b){ return String(b.endAt||"").localeCompare(String(a.endAt||"")); });
}

/* On you: Waiting on you, the Roles badge and the Roles landing. */
needsYou=(function(orig){ return function(){
  var out=orig.apply(this,arguments), t=today();
  ecList().forEach(function(r){ var at=r.endAt||t; out.push({s:"Acknowledge", at:at, r:r, age:Math.max(0,dayGap(at,t)||0), tab:"rejected"}); });
  return out;
}; })(needsYou);
funnelMine=(function(orig){ return function(){ var n=orig.apply(this,arguments); n.rejected=ecList().length; return n; }; })(funnelMine);
rolesLanding=(function(orig){ return function(){
  var t=orig.apply(this,arguments), m=funnelMine();
  return (m.rejected && !m.gate1 && !m.gate2 && !m.toapply && !m.inplay)? "rejected" : t;
}; })(rolesLanding);
WY_STAGES.push(["rejected","Closed by the employer"]);

/* The Closed chevron: total stays the badge; the line under it says what is on you. */
renderCounts=(function(orig){ return function(){ orig.apply(this,arguments);
  var n=ecList().length, y=document.querySelector('.stagebar .step[data-tab="rejected"] .sty');
  if(y){ y.textContent= n? n+" to acknowledge" : "out of the funnel"; y.classList.toggle("on",!!n); }
  try{ ecPaint(); }catch(e){}
}; })(renderCounts);

/* The list on the Closed page. */
function ecHtml(){
  var L=ecList(); if(!L.length) return "";
  return '<section class="card panel ecl"><div class="eclh"><div><h3>Closed by the employer</h3>'+
      '<span class="lede">The morning check found these ads had gone and closed the roles. Acknowledge each, or say it\'s still open.</span></div>'+
      (L.length>1? '<button type="button" class="btn sm" data-ecl="ackall">Acknowledge all '+L.length+'</button>' : "")+'</div>'+
    '<ul class="ecll">'+L.map(function(r){
      return '<li><div class="eclt"><a href="#" data-act="role_go" data-id="'+esc(r.id)+'"><b>'+esc(r.title||"Untitled role")+'</b></a>'+refTag(r)+
          '<span>'+esc(r.company||"")+' · was at '+esc(EC_STAGE[r.prevStage]||"Shortlist")+(r.endAt? ' · closed '+esc(niceShort(r.endAt)) : "")+'</span>'+
          (r.endNote? '<small>'+esc(r.endNote)+'</small>' : "")+'</div>'+
        '<div class="eclb"><button type="button" class="btn sm primary" data-ecl="ack:'+esc(r.id)+'">Acknowledge</button>'+
          '<button type="button" class="btn sm" data-ecl="open:'+esc(r.id)+'" title="Puts it back where it was; the morning check won\'t close it again">Still open</button></div></li>';
    }).join("")+'</ul></section>';
}
function ecPaint(){
  var tab=el("tab-rejected"); if(!tab) return;
  var host=el("ec-host");
  if(!host){ host=document.createElement("div"); host.id="ec-host"; var rd=el("cl-read"); if(rd) tab.insertBefore(host,rd); else tab.appendChild(host); }
  host.innerHTML=ecHtml();
}
render=(function(orig){ return function(){ orig.apply(this,arguments); if(NRB.busy) return;   /* 29 holds redraws during a snapshot burst */ try{ ecPaint(); }catch(e){ console.warn(e); } }; })(render);

/* Writes. */
async function ecAck(ids){
  if(!DB || !ids.length) return;
  try{ await Promise.all(ids.map(function(id){ return DB.doc("roles/"+id).update({ackAt:today()}); }));
    toastUndo(ids.length===1? "Acknowledged" : ids.length+" acknowledged",function(){ ids.forEach(function(id){ DB.doc("roles/"+id).update({ackAt:""}).catch(function(){}); }); });
  }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
}
async function ecOpen(id){
  var r=rawRoles.find(function(x){ return x.id===id; }); if(!r || !DB) return;
  var before={stage:r.stage, endBy:r.endBy||"", endReason:r.endReason||"", endNote:r.endNote||"", endStage:r.endStage||"", endAt:r.endAt||"",
    closedBy:r.closedBy||"", keepOpenAt:r.keepOpenAt||"", red:(r.red||[]).slice(), g2Reason:r.g2Reason||"", g2Note:r.g2Note||"", g1Reason:r.g1Reason||"", g1Note:r.g1Note||""};
  var patch={stage:r.prevStage||"consideration", endBy:"", endReason:"", endNote:"", endStage:"", endAt:"", closedBy:"", keepOpenAt:today(), g2Reason:"", g2Note:"", g1Reason:"", g1Note:"",
    red:(r.red||[]).filter(function(x){ return !/^Gone from /.test(String(x)); })};
  try{ await DB.doc("roles/"+id).update(patch);
    toastUndo("Back on your "+(EC_STAGE[patch.stage]||"Shortlist"),function(){ DB.doc("roles/"+id).update(before).catch(function(){}); });
  }catch(e){ console.warn(e); toast("Couldn't save — try again",true); }
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-ecl]"); if(!b) return;
  ev.preventDefault();
  var p=b.dataset.ecl.split(":");
  if(p[0]==="ack") return ecAck([p[1]]);
  if(p[0]==="ackall") return ecAck(ecList().map(function(r){ return r.id; }));
  if(p[0]==="open") return ecOpen(p[1]);
});
/* A link to one of these roles (Waiting on you, the list) opens the Closed page, not the Shortlist. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="role_go"]'); if(!b) return;
  var id=b.dataset.id; if(!ecList().some(function(r){ return r.id===id; })) return;
  ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
  showTab("rejected");
  setTimeout(function(){ var h=el("ec-host"); if(h) h.scrollIntoView({block:"start",behavior:"smooth"}); },60);
},true);
