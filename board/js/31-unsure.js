"use strict";
/* ===== "Don't know" on the longlist (5 Oct) =====
   A ? beside Fun 1–5 and Shot 1–5, on the longlist only: "no gut feel yet, the research should tell me".
   Stored as no number plus a flag (`funUnsure` / `shotUnsure` on the role), never as a fake 3, so Fun × Shot,
   Mix and the quadrant stats keep treating it as unknown. A ? counts as an answer for Send to shortlist
   (the score-first pop-up and Mass review). At the shortlist the card's scorer already treats a role with no
   longlist number as getting its first score there; once the research is in (g2At), Waiting on you says
   "Score it" instead of "Decide". Send to prep still needs real numbers. Any number clears the flag. */

var UNS_FIELD={fun:"funUnsure", shot:"shotUnsure"};
function unsOf(r,base){ return !!(r && r[UNS_FIELD[base]] && r[base]==null); }
function unsBtn(id,f,on,cls){
  return '<button type="button" class="unsq'+(cls? " "+cls : "")+'" data-act="score" data-id="'+esc(id)+'" data-f="'+f+'" data-v="?" aria-pressed="'+on+'" '+
    'title="Don\'t know yet: the shortlist research should tell you" aria-label="'+(f==="fun"? "Fun" : "Shot")+' not sure">?</button>';
}
function unsRole(id){ return rawRoles.find(function(x){ return x.id===id; })||null; }

/* The pips: a ? on longlist fields. */
pips=(function(orig){ return function(id,field,val){
  var h=orig.apply(this,arguments), r=unsRole(id);
  if(!r || r.stage!=="proposed" || !UNS_FIELD[field]) return h;
  return h.replace(/<\/div>$/, unsBtn(id,field,unsOf(r,field))+'</div>');
}; })(pips);
rowPips=(function(orig){ return function(id,f,v){
  var h=orig.apply(this,arguments), r=unsRole(id);
  if(!r || r.stage!=="proposed" || !UNS_FIELD[f]) return h;
  return h.replace(/<\/span>$/, unsBtn(id,f,unsOf(r,f))+'</span>');
}; })(rowPips);
/* Later stages: a chip saying it still needs its first score. */
scoreChipOf=(function(orig){ return function(r){
  var h=orig.apply(this,arguments);
  if(r && r.stage!=="proposed" && (unsOf(r,"fun") || unsOf(r,"shot")) && (r.fun2==null || r.shot2==null))
    h='<span class="chip mid unschip" title="You marked it ? on the longlist">Score it</span>'+h;
  return h;
}; })(scoreChipOf);

/* Clicks: ? toggles the flag; a number clears it. Capture, so 12's numeric handler never sees a ?. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="score"]'); if(!b) return;
  var f=b.dataset.f, base=f.replace(/2$/,""), r=unsRole(b.dataset.id); if(!r || !UNS_FIELD[base] || !DB) return;
  if(b.dataset.v==="?"){
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
    var on=!unsOf(r,base), p={}; p[UNS_FIELD[base]]=on; p[base]=null;
    Object.assign(r,p); var rr=roles.find(function(x){ return x.id===r.id; }); if(rr) Object.assign(rr,p);
    DB.doc("roles/"+r.id).update(p).catch(function(e){ console.warn(e); el("offline").hidden=false; });
    try{ render(); }catch(e){}
    return;
  }
  if(r[UNS_FIELD[base]]){ var q={}; q[UNS_FIELD[base]]=false; r[UNS_FIELD[base]]=false; DB.doc("roles/"+r.id).update(q).catch(function(){}); }
},true);

/* Send to shortlist: a ? counts as an answer. */
var UNS_CTX="", UNS_FILL="";
needScores=(function(orig){ return function(t){
  var ns=orig.apply(this,arguments); UNS_CTX = ns? (t.dataset.act||"") : ""; UNS_FILL = ns? ns.r.id : "";
  if(!ns || t.dataset.act!=="accept") return ns;
  var fOk= ns.c.f!=null || unsOf(ns.r,"fun"), sOk= ns.c.s!=null || unsOf(ns.r,"shot");
  return (fOk && sOk)? null : ns;
}; })(needScores);
scPaint=(function(orig){ return function(){
  if(UNS_CTX==="accept" && UNS_FILL){   /* once per pop-up: show the ? you already gave */
    var r=unsRole(UNS_FILL); UNS_FILL="";
    if(r){ if(SC_V.f==null && unsOf(r,"fun")) SC_V.f="?"; if(SC_V.s==null && unsOf(r,"shot")) SC_V.s="?"; }
  }
  orig.apply(this,arguments);
  if(UNS_CTX!=="accept") return;
  ["fun","shot"].forEach(function(k){ var v=k==="fun"? SC_V.f : SC_V.s, h=el("sc-"+k); if(!h) return;
    h.insertAdjacentHTML("beforeend",'<button type="button" class="unsq" data-sc="'+k+'" data-n="?" aria-pressed="'+(v==="?")+'" title="Don\'t know yet">?</button>'); });
}; })(scPaint);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-sc][data-n="?"]'); if(!b) return;
  ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
  if(b.dataset.sc==="fun") SC_V.f= SC_V.f==="?"? null : "?"; else SC_V.s= SC_V.s==="?"? null : "?";
  scPaint();
},true);
/* Save and continue: write the flags, and let the pop-up write null in place of ?. */
el("sc-yes").addEventListener("click",function(){
  if(UNS_CTX!=="accept" || (SC_V.f!=="?" && SC_V.s!=="?")) return;
  var rid=el("sc-role").dataset.id, r=rawRoles.find(function(x){ return x.id===rid; });   /* by id: two roles can share company and title */ if(!r || !DB) return;
  var p={}; if(SC_V.f==="?"){ p.funUnsure=true; SC_V.f=null; } if(SC_V.s==="?"){ p.shotUnsure=true; SC_V.s=null; }
  Object.assign(r,p); DB.doc("roles/"+r.id).update(p).catch(function(e){ console.warn(e); });
},true);

/* Mass review: the same ? on both rows. */
mrLoad=(function(orig){ return function(){ orig.apply(this,arguments); var r=mrRole(); MR.fu=!!(r && unsOf(r,"fun")); MR.su=!!(r && unsOf(r,"shot")); }; })(mrLoad);
mrPaint=(function(orig){ return function(){
  orig.apply(this,arguments);
  var b=el("mr-body"); if(!b || !mrRole()) return;
  var rows=b.querySelectorAll(".mr-sc .scrow");
  if(rows[0]) rows[0].insertAdjacentHTML("beforeend",'<button type="button" class="unsq" data-mr="f" data-n="?" aria-pressed="'+!!MR.fu+'" title="Don\'t know yet">?</button>');
  if(rows[1]) rows[1].insertAdjacentHTML("beforeend",'<button type="button" class="unsq" data-mr="s" data-n="?" aria-pressed="'+!!MR.su+'" title="Don\'t know yet">?</button>');
  var acc=b.querySelector('[data-mr="acc"]');
  if(acc){ var ok=(MR.f!=null||MR.fu) && (MR.s!=null||MR.su); acc.disabled=!ok; if(ok) acc.removeAttribute("title"); }
}; })(mrPaint);
function mrUnsPatch(){ var p={}; if(MR.fu){ p.funUnsure=true; p.fun=null; } if(MR.su){ p.shotUnsure=true; p.shot=null; } return p; }
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("#mr [data-mr]"); if(!b) return;
  var k=b.dataset.mr, r=mrRole(); if(!r) return;
  if((k==="f"||k==="s") && b.dataset.n==="?"){
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
    if(k==="f"){ MR.fu=!MR.fu; if(MR.fu) MR.f=null; } else { MR.su=!MR.su; if(MR.su) MR.s=null; }
    mrPaint(); return;
  }
  if(k==="f"){ MR.fu=false; if(r.funUnsure && DB) DB.doc("roles/"+r.id).update({funUnsure:false}).catch(function(){}); return; }
  if(k==="s"){ MR.su=false; if(r.shotUnsure && DB) DB.doc("roles/"+r.id).update({shotUnsure:false}).catch(function(){}); return; }
  if(!DB || !(MR.fu||MR.su)) return;
  if(k==="acc"){
    if(!((MR.f!=null||MR.fu) && (MR.s!=null||MR.su))) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
    var p=Object.assign(mrUnsPatch(),{stage:"consideration", g1At:today()});
    if(MR.f!=null) p.fun=MR.f; if(MR.s!=null) p.shot=MR.s;
    if(MR.busy) return; MR.busy=true;
    DB.doc("roles/"+r.id).update(p).then(function(){ MR.busy=false; mrNext("a"); })
      .catch(function(e){ console.warn(e); MR.busy=false; var h=el("mr-hint"); if(h) h.textContent="Couldn't save — try again."; toast("Couldn't save — try again",true); });
    return;
  }
  if(k==="skip" || k==="rejyes"){ DB.doc("roles/"+r.id).update(mrUnsPatch()).catch(function(){}); }
},true);

/* Waiting on you: a researched shortlist role you marked ? asks to be scored, not decided. */
needsYou=(function(orig){ return function(){
  var out=orig.apply(this,arguments);
  out.forEach(function(x){ var r=x.r;
    if(r && r.stage==="consideration" && r.g2At && x.s==="Decide" && ((unsOf(r,"fun") && r.fun2==null) || (unsOf(r,"shot") && r.shot2==null))) x.s="Score it"; });
  return out;
}; })(needsYou);
