"use strict";
/* ---------- interaction ---------- */
document.addEventListener("click",function(ev){
  var t=ev.target.closest("[data-act]"); if(!t) return;
  var a=t.dataset.act, id=t.dataset.id;
  if(a==="ed_open"||a==="ed_save"||a==="ed_cancel"){ edClick(t); return; }
  if(a==="mockfrom"){ openMockFor(id, t.dataset.cid||""); return; }
  if(a==="ctab"){
    /* A "Go to …" link inside a panel is not in the tab row: press the real tab instead (2 Oct). */
    if(!t.closest(".ctabs")){
      var scope=t.closest(".rbody")||document, real=scope.querySelector('.ctabs [data-act="ctab"][data-id="'+cssq(id)+'"][data-k="'+cssq(t.dataset.k)+'"]');
      if(real){ real.click(); var sb=real.closest(".spb, .wkpopb"); if(sb) sb.scrollTop=0; else real.scrollIntoView({block:"nearest"}); }
      return;
    }
    CTAB[id]=t.dataset.k;
    var bar=t.parentNode; Array.prototype.forEach.call(bar.children,function(x){ x.setAttribute("aria-selected",String(x===t)); });
    var csel=bar.nextElementSibling; if(csel && csel.classList.contains("ctabsel")) csel.value=t.dataset.k;
    var card=bar.parentNode;
    /* The tab row may sit in a wrapper with the card actions (2 Oct): the panels are its siblings. */
    if(card.classList && card.classList.contains("ctabrow")) card=card.parentNode;
    /* Tabs moved into the page header sit outside their panels: look in the whole tab section then. */
    if(card.closest && card.closest(".pagehead")) card=card.closest("section")||document;
    Array.prototype.forEach.call(card.querySelectorAll('.cpanel'),function(pn){ if(pn.dataset.cp===id) pn.hidden = pn.dataset.k!==t.dataset.k; });
    return;
  }
  if(a==="stage_add"){
    var rr=rawRoles.find(function(x){return x.id===id;}); if(!rr||!DB) return;
    var ks=Object.keys(rr.interviewPrep||{}), n=ks.length+1, nk="r"+n+"-stage";
    while(ks.indexOf(nk)>=0){ n++; nk="r"+n+"-stage"; }
    var patch={interviewPrep:{}}; patch.interviewPrep[nk]={round:"Stage "+n, type:"pm", builtAt:""};
    STAGEOPEN[id+"~"+nk]=true;
    DB.doc("roles/"+id).update(patch).then(function(){ openEdDialog("prep", id+"~"+nk, "New interview stage"); })
      .catch(function(e){ console.warn("stage add",e&&e.code); });
    return;
  }
  if(a==="prepsel"){
    PREPSEL[id]=t.dataset.k;
    var r0=roles.find(function(x){return x.id===id;}); var pn=t.closest(".cpanel");
    if(r0 && pn) pn.innerHTML=prepPanel(r0);
    return;
  }
  if(a==="wtab"){
    WTAB=t.dataset.k;
    Array.prototype.forEach.call(document.querySelectorAll('#tab-week .wtabs [data-act="wtab"]'),function(x){ x.setAttribute("aria-selected",String(x===t)); });
    ["cal","pend"].forEach(function(k){ el("wp-"+k).hidden = k!==WTAB; });
    return;
  }
  if(a==="mockview"){ showPastMock(t.dataset.mid); return; }
  if(a==="wk_f"){ WKF=t.dataset.k||"all"; renderWeek(); return; }
  if(a==="wk_prev"||a==="wk_next"||a==="wk_now"){
    weekOff = a==="wk_now"? 0 : weekOff+(a==="wk_next"?1:-1); renderWeek(); return;
  }
  if(a==="taskdone"||a==="taskundo"){
    if(!DB) return;
    var tc=commitments.find(function(x){return x.id===t.dataset.cid;}); if(!tc) return;
    var dd=(tc.doneDates||[]).filter(function(x){return x!==t.dataset.d;});
    if(a==="taskdone") dd.push(t.dataset.d);
    DB.doc("commitments/"+tc.id).update({doneDates:dd.sort()})
      .catch(function(e){ console.warn("task tick",e&&e.code); el("offline").hidden=false; });
    return;
  }
  if(a==="cmtundo"){
    if(!DB) return;
    DB.doc("commitments/"+t.dataset.cid).update({state:"booked",doneAt:""})
      .catch(function(e){ console.warn("undo done",e&&e.code); el("offline").hidden=false; });
    return;
  }

  if(a==="score"){
    var v=+t.dataset.v, f=t.dataset.f;
    var r=roles.find(function(x){return x.id===id;}); if(!r) return;
    var nv = r[f]===v? null : v;
    r[f]=nv;
    var patch={}; patch[f]=nv;
    if(f==="fun2"||f==="shot2"){ var other=f==="fun2"? r.shot2 : r.fun2;
      /* Clearing one rescore keeps the date while the other still stands (QA 15 Oct). */
      patch.rescoredAt = nv!=null? today() : (other!=null? (r.rescoredAt||today()) : ""); r.rescoredAt=patch.rescoredAt; }
    save(id,patch); renderG1(); renderG2(); renderToApply(); renderInPlay(); v2Refresh(); return;
  }
  if(a==="mch"){
    var on = t.getAttribute("aria-pressed")==="true";
    t.setAttribute("aria-pressed", String(!on));
    t.dataset.v = on? "" : "pass";
    var mk=t.querySelector(".mark"); if(mk) mk.textContent = on? "\u00b7" : "\u2713";
    return;
  }
  /* Reject toggles its box and stays lit while it is open (1 Oct). */
  /* From a collapsed row it always opens, never toggles (3 Oct): a box left open last time must not close. */
  if(a==="rejopen"){ var b=el("rej-"+id); if(b){ var on=t.closest(".qacts")? true : !b.classList.contains("open"); b.classList.toggle("open",on);
      Array.prototype.forEach.call(document.querySelectorAll('[data-act="rejopen"][data-id="'+id+'"]'),function(x){ x.setAttribute("aria-pressed",String(on)); }); } return; }
  if(a==="rejcancel"){ var b2=el("rej-"+id); if(b2) b2.classList.remove("open");
      Array.prototype.forEach.call(document.querySelectorAll('[data-act="rejopen"][data-id="'+id+'"]'),function(x){ x.setAttribute("aria-pressed","false"); }); return; }
  if(a==="endwho"){
    var bx0=el("rej-"+id); if(!bx0) return;
    bx0.dataset.who=t.dataset.w;
    Array.prototype.forEach.call(bx0.querySelectorAll('[data-act="endwho"]'),function(x){ x.setAttribute("aria-pressed",String(x===t)); });
    Array.prototype.forEach.call(bx0.querySelectorAll('.reasons'),function(g){
      g.hidden = g.dataset.who!==t.dataset.w;
      Array.prototype.forEach.call(g.querySelectorAll("button"),function(x){ x.setAttribute("aria-pressed","false"); });
    });
    var sv0=bx0.querySelector('[data-act="rejsave"]'); if(sv0) sv0.disabled=true;
    return;
  }
  if(a==="reason"){
    var rbx=t.closest(".rejbox")||t.closest(".reasons");
    Array.prototype.forEach.call(rbx.querySelectorAll('[data-act="reason"]'),function(x){x.setAttribute("aria-pressed","false");});
    t.setAttribute("aria-pressed","true");
    var grp=t.closest(".reasons"); if(rbx.classList.contains("rejbox") && grp && grp.dataset.who) rbx.dataset.who=grp.dataset.who;
    var sv=rbx.querySelector('[data-act="rejsave"]'); if(sv){ sv.disabled=false; sv.removeAttribute("title"); }
    var subw=el("rejsubw-"+id); if(subw) subw.innerHTML=endSubHtml(t.dataset.r,"rejsub-"+id);
    var hn=el("rejhint-"+id); if(hn) hn.textContent="";
    /* The note is optional everywhere (13 Oct) except for Other, and the box says so. */
    var rn=rbx.querySelector('[id^="rejnote-"]')||el("rejnote-"+id);
    if(rn){
      if(!rn.dataset.ph) rn.dataset.ph=rn.placeholder;
      rn.classList.remove("reqbad");
      rn.placeholder = t.dataset.r==="Other"? "Required — say what it was" : rn.dataset.ph;
    }
    return;
  }
  if(a==="rejsave"){
    var kind=t.dataset.kind||"g1";
    var hint=el("rejhint-"+id);
    function say(m){ if(hint) hint.textContent=m; }
    var rr=roles.find(function(x){return x.id===id;}); if(!rr) return;
    var co=coOf(rr);
    var bxw=el("rej-"+id), who=bxw? bxw.dataset.who : "";
    var sel=who? document.querySelector('#rej-'+id+' .reasons[data-who="'+who+'"] button[aria-pressed="true"]') : null;
    var note=el("rejnote-"+id);
    var after=document.querySelector('#rej-'+id+' [data-act="co_after"]');
    var stopWhy=el("costop-"+id);
    var stopping = after && after.value==="stop";

    /* A reason is not optional any more — a rejected row with no reason teaches nothing later. */
    if(!who){ say("Who ended it? Pick one first."); return; }
    if(!sel){ say("Pick a reason first."); return; }
    if(sel.dataset.r==="Other" && !(note && note.value.trim())){ say("Other needs a short note, or it can never be counted."); return; }
    /* 13 Oct: no sentence demanded at the shortlist any more — the reason (and the research behind it) says it.
       Only Other needs a note, as everywhere. */
    var sub=endSubRead(sel.dataset.r,"rejsub-"+id); if(!sub.ok){ say(sub.err); return; }
    if(after && after.dataset.rate==="1" && !after.value){ say("Rate "+((co&&co.name)||rr.company||"the company")+" first \u2014 it decides how often the sweep checks them."); return; }
    if(stopping && !(stopWhy && stopWhy.value.trim())){
      say(co? "Say why you are done with "+(co.name||rr.company||"them")+" \u2014 it becomes the flag on their row."
            : "Say why you are ruling out "+(rr.company||"them")+" \u2014 it is kept on their card."); return;
    }

    var patch;
    var nv=note?note.value.trim():"";
    if(kind==="g1") patch={stage:"g1_rejected", g1Reason:sel.dataset.r, g1Note:nv, g1At:today()};
    else if(kind==="g2") patch={stage:"g2_rejected", g2Reason:sel.dataset.r, rejectNote:nv, g2At:today()};
    else patch={stage:"closed", closedAt:today(), closedReason:sel.dataset.r, closedNote:nv,
                closedAfter:isInterviewing(rr)?"interview":"application"};
    var doneStages = kind==="out"? stagesOf(rr).filter(function(x){return x.st==="done";}).length : 0;
    patch.endBy=who; patch.endReason=sel.dataset.r; patch.endNote=nv; patch.endAt=today();
    patch.endRule=sub.patch.endRule||""; patch.endGap=sub.patch.endGap||""; if(sub.newGap) addGap(sub.newGap);
    patch.endStage = kind==="g1"? "Gate 1" : kind==="g2"? "Gate 2" : (isInterviewing(rr)? "After interviewing" : "After applying");
    patch.endStagesDone = doneStages;
    if(stopping && !co){ var ro=coRuleOutNew(rr,stopWhy.value.trim()); if(!rr.companyId) patch.companyId=ro.id; }
    save(id,patch);

    if(stopping && co){
      var why=stopWhy.value.trim();
      saveCo(co.id,{
        watch:false, listing:"rejected", offNote:why, offAt:today(),
        watchWhy:"Not searched \u2014 you stopped searching them on "+today()+" after "+rr.title+".",
        red:(co.red||[]).concat(["Stopped searching "+today()+", after "+rr.title+": "+why]),
        reconcile:""
      });
    }
    else if(co && after && /^(high|medium|low)$/.test(after.value)){ saveCo(co.id,{priority:after.value, watch:rateWatch(after.value)}); }
    var bx=el("rej-"+id); if(bx) bx.classList.remove("open");
    return;
  }
  if(a==="accept"){ save(id,{stage:"consideration",g1At:today()}); return; }

  if(a==="prepnone"){
    if(!DB) return;
    DB.doc("commitments/"+t.dataset.cid).update({prepLead:0, prepNow:false})
      .catch(function(e){ console.warn("prep none",e&&e.code); el("offline").hidden=false; });
    return;
  }
  if(a==="prepdone"||a==="prepundo"){
    if(!DB) return;
    var pcid=t.dataset.cid;
    DB.doc("commitments/"+pcid)
      .update({prepDone: a==="prepdone", preppedAt: a==="prepdone"? today() : ""})
      .catch(function(e){ console.warn("prep tick",e&&e.code); });
    var pc=commitments.find(function(x){return x.id===pcid;});
    if(pc && pc.roleId){
      var pr=roles.find(function(x){return x.id===pc.roleId;});
      if(pr && (pr.flowStatus==="prep" || pr.flowStatus==="ready"))
        setFlow(pc.roleId, a==="prepdone"? "ready" : "prep");
    }
    return;
  }
  if(a==="pend_reply"||a==="pend_event"){
    if(!DB) return;
    var pcid=t.dataset.cid;
    if(a==="pend_reply"){
      DB.doc("commitments/"+pcid).update({state:"offered",court:"them",sentAt:today(),lastChased:"",chaseBy:addDays(today(),CHASE_DAYS)})
        .catch(function(e){ console.warn("pend reply",e&&e.code); el("offline").hidden=false; });
    } else {
      var wo=el("wo-"+pcid), wv=wo? wo.value.trim() : "";
      if(!wv){ if(wo) wo.focus(); return; }
      DB.doc("commitments/"+pcid).update({state:"conditional",blockedBy:wv,condition:wv,chaseBy:"",court:"me"})
        .catch(function(e){ console.warn("pend event",e&&e.code); el("offline").hidden=false; });
    }
    return;
  }
  if(a==="cmtdone"||a==="cmtdel"||a==="cmtbook"||a==="cmtchase"||a==="cmtlive"||a==="cmtcourt"){
    if(!DB) return;
    var cid=t.dataset.cid, ref=DB.doc("commitments/"+cid);
    var cc=commitments.find(function(x){return x.id===cid;});
    if(a==="cmtdel"){ unlinkMeeting(cid); ref.delete().catch(function(e){console.warn(e);}); return; }
    if(a==="cmtdone"){ ref.update({state:"done",doneAt:today(),closedAs:""}).catch(function(e){console.warn(e);}); return; }
    if(a==="cmtchase"){ ref.update({chaseBy:addDays(today(),CHASE_DAYS),lastChased:today(),court:"them"}).catch(function(e){console.warn(e);}); return; }
    if(a==="cmtlive"){ ref.update({state:"offered",court:"me",chaseBy:addDays(today(),2)}).catch(function(e){console.warn(e);}); return; }
    if(a==="cmtbook"){
      var di=el("bk-"+cid), dv=di?di.value:"";
      if(!dv) { if(di) di.focus(); return; }   /* a booking with no date is the state it came from */
      var tv=el("bkt-"+cid);
      ref.update({state:"booked",date:dv,time:(tv&&tv.value.trim())||cc&&cc.time||"",chaseBy:"",court:"me"}).catch(function(e){console.warn(e);});
      return;
    }
  }
  /* closerole was replaced 28 Sep by the shared close-out block: closing a role now always asks
     for a reason, and asks whether the employer stays in the sweep. */
  if(a==="startprep"||a==="prepdone2"||a==="prepundo2"||a==="sessdone"||a==="chased2"){
    if(!DB) return;
    var kcid=t.dataset.cid; if(!kcid) return;
    var kref=DB.doc("commitments/"+kcid);
    var patch = a==="startprep"  ? {prepNow:true,  prepDone:false}
              : a==="prepdone2"  ? {prepNow:false, prepDone:true,  preppedAt:today()}
              : a==="prepundo2"  ? {prepNow:true,  prepDone:false, preppedAt:""}
              : a==="sessdone"   ? {state:"done", doneAt:today()}
              : /* chased2 */      {chaseBy:addDays(today(),CHASE_DAYS), lastChased:today(), court:"them"};
    kref.update(patch).catch(function(e){ console.warn(a,e&&e.code); el("offline").hidden=false; });
    if(a==="sessdone" && id){
      var sr=roles.find(function(x){return x.id===id;});
      if(sr && (sr.flowStatus==="prep"||sr.flowStatus==="ready"||!sr.flowStatus))
        setFlow(id,"writeup");
    }
    return;
  }
  if(a==="fs_chased"){   setFlow(id,"noreply",{chasedAt:today()}); return; }
  if(a==="fs_offer"){    setFlow(id,"offer",{stage:"offer", offerAt:today()}); return; }
  if(a==="fs_prepped"||a==="fs_notready"){
    var pdone = a==="fs_prepped";
    setFlow(id, pdone? "ready" : "prep");
    /* One prep, one truth — keep Week ahead's tick in step with the role's status. */
    var nsx=nextSessionOf(id);
    if(nsx && DB) DB.doc("commitments/"+nsx.id)
      .update({prepDone:pdone, prepNow:!pdone, preppedAt: pdone? today() : ""})
      .catch(function(e){ console.warn("prep sync",e&&e.code); });
    return;
  }
  if(a==="fs_logit"){
    setFlow(id,"feedback");
    var dl=el("cv-dialog"); if(dl && !dl.open){ if(dl.showModal) dl.showModal(); else dl.setAttribute("open",""); }
    var sl=el("cv-role"); if(sl){ sl.value=id; toggleSubj(); }
    var lk2=el("cv-liked"); if(lk2) setTimeout(function(){lk2.focus();},50);
    return;
  }
  if(a==="sessdel"){
    if(!DB) return;
    var dcid=t.dataset.cid; if(!dcid) return;
    unlinkMeeting(dcid);
    DB.doc("commitments/"+dcid).delete().catch(function(e){ console.warn("sessdel",e&&e.code); });
    return;
  }
  if(a==="logjump"){
    /* One meeting, one set of notes (2 Oct): if this meeting already has notes, edit those. */
    var exN=t.dataset.cid && conversations.find(function(v){ return v.meetingId===t.dataset.cid; });
    if(exN){ openEdDialog("conversation", exN.id, ED_TITLES.conversation); return; }
    /* The form lives on In play. From a Gate 2 or company card, go there first. */
    var rr2=id? roles.find(function(x){return x.id===id;}) : null;
    var d2=el("cv-dialog");
    if(d2 && !d2.open){ if(d2.showModal) d2.showModal(); else d2.setAttribute("open",""); }
    CV_MEET_PICK = t.dataset.cid || null;
    CV_MEET_FREE = (!id && t.dataset.cid)? t.dataset.cid : "";
    var sel2=el("cv-role");
    if(sel2){ sel2.value = rr2? id : ""; if(rr2 && sel2.value!==id) sel2.value=""; toggleSubj(); }
    var cs2=el("cv-co"); if(cs2){ cs2.value = rr2? "" : (t.dataset.co||""); }
    var ss2=el("cv-sec"); if(ss2){ ss2.value = rr2? "" : (t.dataset.sec||""); }
    var lk=el("cv-liked"); if(lk) setTimeout(function(){lk.focus();},50);
    return;
  }
  if(a==="booksession"){
    if(!DB) return;
    var bd=el("bs-d-"+id), dv=bd? bd.value : "";
    /* Pressed from the status row or the Meetings header, the panel is still closed — open it
       and put the cursor in the date. */
    if(!dv && bd && bd.closest("details") && !bd.closest("details").open){
      bd.closest("details").open=true;
      bd.scrollIntoView({block:"center",behavior:"smooth"});
      setTimeout(function(){ bd.focus(); },350);
      return;
    }
    /* A booked session with no date renders nowhere. Refuse rather than store it. */
    if(!dv){ if(bd) bd.focus(); return; }
    var rb=roles.find(function(x){return x.id===id;});
    var tin=el("bs-t-"+id);
    var ttl=(tin&&tin.value||"").trim() || ((rb? rb.company : "Role")+" session");
    var tm=el("bs-tm-"+id), ty=el("bs-ty-"+id);
    var newCid=slug(ttl)+"-"+Date.now().toString(36).slice(-4);
    DB.doc("commitments/"+newCid).set({
      title:ttl, detail: rb? rb.title : "", kind:"external",
      type: ty? ty.value : "interview", state:"booked", date:dv,
      time:(tm&&tm.value||"").trim(), windowText:"", sentAt:"", chaseBy:"",
      condition:"", court:"me", person:"", relationship:"", org: rb? rb.company : "",
      roleId:id, createdAt:today()
    }).then(function(){ setFlow(id,"prep"); if(!ty || ty.value==="interview") linkStage(id,newCid); })
      .catch(function(e){ console.warn("book",e&&e.code); el("offline").hidden=false; });
    return;
  }
  if(a==="offer"){ save(id,{stage:"offer", offerAt:today()}); return; }
  if(a==="reopen"){
    /* Reopen clears the old ending, kept as prevEnd, so the role no longer reads as ended (QA 14 Oct). */
    var ro=rawRoles.find(function(x){return x.id===id;})||{};
    var EK=["endBy","endReason","endNote","endAt","endStage","endStagesDone","endRule","endGap","closedAt","closedReason","closedNote","closedAfter"], pe={};
    EK.forEach(function(k){ if(ro[k]!=null && ro[k]!=="") pe[k]=ro[k]; });
    var rp={stage: (ro.offer && ro.flowStatus==="offer")? "offer" : "applied", prevEnd:pe};
    EK.forEach(function(k){ rp[k]=""; });
    if(ro.flowStatus==="offer" && !ro.offer){ rp.flowStatus="feedback"; rp.flowPrev=""; }
    save(id,rp); return; }
  if(a==="prepback"){ save(id,{stage:"consideration"}); return; }
  if(a==="prepapplied"){ save(id,{stage:"applied",appliedAt:today()}); return; }
  if(a==="prepunapplied"){
    var ru=rawRoles.find(function(x){return x.id===id;})||{}, ub={stage:ru.stage||"applied", appliedAt:ru.appliedAt||"", flowStatus:ru.flowStatus||"", flowPrev:ru.flowPrev||"", flowAt:ru.flowAt||""};
    save(id,{stage:"prep", appliedAt:"", flowStatus:"", flowPrev:"", flowAt:""});
    toastUndo("Back at To apply",function(){ save(id,ub); }); return; }
  if(a==="convdel"){
    if(ED_DLG && ED_DLG.kind==="conversation"){ closeEditor(ED_DLG.key); ED_DLG=null; closeDlg("ed-dialog"); }
    if(DB) DB.doc("conversations/"+t.dataset.cid).delete().catch(function(e){ console.warn("conv delete",e&&e.code); });
    return;
  }

  if(a==="rule"||a==="exp"){
    var r2=roles.find(function(x){return x.id===id;}); if(!r2) return;
    var code=t.dataset.code;
    var e=JSON.parse(JSON.stringify(r2.enrich||{}));
    if(a==="rule"){
      e.gate2Rules=e.gate2Rules||{};
      var cur=e.gate2Rules[code]||"unknown";
      e.gate2Rules[code]= cur==="unknown"?"pass":cur==="pass"?"fail":"unknown";
    }else{
      e.expensive=e.expensive||{};
      var c2=e.expensive[code]||"unknown";
      e.expensive[code]= c2==="unknown"?"strong":c2==="strong"?"ok":c2==="ok"?"weak":"unknown";
    }
    save(id,{enrich:e}); return;
  }
  if(a==="note_edit"){ var nk3=t.dataset.kind, ni=+t.dataset.i;
    var nl3= nk3==="co"? companies : nk3==="sec"? sectors : rawRoles, nx=nl3.find(function(o){return o.id===id;}), cur=nx && (nx.notes||[])[ni];
    if(!cur) return;
    openForm({title:"Edit note", fields:[{id:"t", label:"Note", type:"area", rows:5, value:cur.text||""}],
      onSave:function(v){ if(!v.t) return "Write the note, or use Remove this note."; noteSet(nk3,id,ni,v.t); },
      del:function(){ noteSet(nk3,id,ni,null); }, delLabel:"Remove this note"}); return; }
  if(a==="note_open"){ var nk2=t.dataset.kind;
    openForm({title:"Add a note", fields:[{id:"t", label:"Note", type:"area", rows:5,
      placeholder: nk2==="role"? "A fact worth keeping that has no field" : "Longer-form detail worth keeping"}],
      onSave:function(v){ if(!v.t) return "Write the note first."; noteAdd(nk2,id,v.t); }}); return; }
  if(a==="src_open"){ var chn=chById(id);
    openForm({title:"Add a source"+(chn? " to "+chn.name : ""), fields:[{id:"n",label:"Name",placeholder:"e.g. Otta"},{id:"u",label:"Link — optional",placeholder:"https://"}],
      onSave:function(v){ if(!v.n) return "It needs a name."; if(!DB) return "Stored data isn't available."; if(srcs.some(function(x){ return x.channelId===id && (x.id===id+"-"+slug(v.n) || slug(x.name||"")===slug(v.n)); })) return "There's already a source with that name here."; addSource(id,v.n,v.u); }}); return; }
  if(a==="rd_open"){
    openForm({title:"Paste the posting text", lede:"Copy the whole job description. The next morning's run researches from it.", ok:"Save and queue for research",
      fields:[{id:"t",label:"Posting text",type:"area",rows:10,placeholder:"The whole description"}],
      onSave:function(v){ if(v.t.length<120) return "Paste the whole description — at least a paragraph.";
        if(DB) DB.doc("roles/"+id).update({pasted:v.t, readState:"waiting", readTries:0, readReason:""}).catch(function(e){ console.warn(e); el("offline").hidden=false; }); }}); return; }
  if(a==="offer_open"){ var ro=rawRoles.find(function(x){return x.id===id;}); openEdDialog("offer",id,(ro? ro.company+" — " : "")+"offer details"); return; }
  if(a==="pp_rm"){ delete EDITING[editKey("person",id)]; if(ED_DLG && ED_DLG.key===editKey("person",id)){ ED_DLG=null; closeDlg("ed-dialog"); }
    if(DB) DB.doc("people/"+id).delete().catch(function(e){ console.warn(e); el("offline").hidden=false; }); return; }
  if(a==="cmp_pick"){
    var ids=cmpIds(), k=ids.indexOf(id);
    if(k>=0) ids.splice(k,1); else { if(ids.length>=3) ids.shift(); ids.push(id); }
    CMP=ids; try{ localStorage.setItem("gb.cmp",JSON.stringify(ids)); }catch(e){}
    renderCompare(); return;
  }
  if(a==="g2needs"){ G2_NEEDS=!G2_NEEDS; renderG2(); return; }
  if(a==="rd_save"){
    var ta=el("rd-"+id), txt=ta && ta.value.trim();
    if(!txt || txt.length<120){ if(ta){ ta.focus(); ta.placeholder="Paste the whole description — at least a paragraph"; } return; }
    if(DB) DB.doc("roles/"+id).update({pasted:txt, readState:"waiting", readTries:0, readReason:""}).catch(function(e){ console.warn(e); el("offline").hidden=false; });
    return;
  }
  if(a==="ch_rm"){
    if(!DB) return;
    var chh=el("chrm-"+id);
    if(t.dataset.armed!=="1"){ t.dataset.armed="1"; t.textContent="Confirm — remove for good";
      if(chh) chh.textContent="Its sources go too. Roles keep their record but show it as removed."; return; }
    srcs.filter(function(x){return x.channelId===id;}).forEach(function(x){ DB.doc("sources/"+x.id).delete().catch(function(e){console.warn(e);}); });
    DB.doc("channels/"+id).delete().catch(function(e){ console.warn(e); el("offline").hidden=false; });
    return;
  }
  if(a==="src_rm"){
    if(!DB) return;
    if(t.dataset.armed!=="1"){ t.dataset.armed="1"; t.textContent="Confirm"; return; }
    var sx=srcs.find(function(z){return z.id===id;});
    DB.doc("sources/"+id).delete().then(function(){ if(typeof ruLogEntry==="function" && sx){ var sb=Object.assign({},sx); delete sb.id; ruLogEntry({kind:"source", ruleId:id, action:"remove", before:sb, after:null, via:"you", why:""}); } })
      .catch(function(e){ console.warn(e); el("offline").hidden=false; });
    return;
  }
  if(a==="src_add"){
    if(!DB) return;
    var ni=el("srcn-"+id), ui=el("srcu-"+id), nm2=ni&&ni.value.trim(); if(!nm2){ if(ni) ni.focus(); return; }
    var u2=(ui&&ui.value.trim())||""; if(u2 && !/^https?:\/\//i.test(u2)) u2="https://"+u2;
    var ord=Math.max.apply(null,srcs.filter(function(x){return x.channelId===id;}).map(function(x){return x.order||0;}).concat([0]))+1;
    DB.doc("sources/"+id+"-"+slug(nm2)).set({channelId:id, name:nm2, url:u2, status:"active", why:"", note:"", order:ord})
      .catch(function(e){ console.warn(e); el("offline").hidden=false; });
    return;
  }
  if(a==="sec_rm"){
    if(!DB) return;
    var sh=el("secrm-"+id);
    if(t.dataset.armed!=="1"){
      t.dataset.armed="1"; t.textContent="Confirm — remove for good";
      if(sh) sh.textContent = convsForSec(id).length? "Its conversations stay, but lose the link to this sector." : "";
      return;
    }
    unlinkSector(id);
    delete EDITING[editKey("sector",id)]; if(ED_DLG && ED_DLG.key===editKey("sector",id)){ ED_DLG=null; closeDlg("ed-dialog"); }
    DB.doc("sectors/"+id).delete().catch(function(e){ console.warn(e); el("offline").hidden=false; });
    return;
  }
  if(a==="co_filter"){ coFilter=t.dataset.k; renderCompanies(); return; }
  if(a==="co_f"){ var g=t.dataset.g; if(!g){ CO_F={sweep:"",rate:"",flow:""}; Q.co=""; var qi=el("q-co"); if(qi) qi.value=""; } else { CO_F[g] = CO_F[g]===t.dataset.k? "" : t.dataset.k; }
    try{ localStorage.setItem("gb.cof",JSON.stringify(CO_F)); }catch(e){} renderCompanies(); return; }
  if(a==="co_rmopen"){ var cb=el("corm-"+id); if(cb) cb.classList.add("open"); return; }
  if(a==="co_rmno"){ var cb2=el("corm-"+id); if(cb2) cb2.classList.remove("open"); return; }
  if(a==="co_rmyes"){
    if(!DB) return;
    unlinkCompany(id);
    DB.doc("companies/"+id).delete().catch(function(e){ console.warn(e); el("offline").hidden=false; });
    return;
  }
  if(a==="co_note"){
    var ta=el("con-"+id), txt2=ta?ta.value.trim():"";
    if(!txt2) return;
    var cc=companies.find(function(x){return x.id===id;}); if(!cc) return;
    var ns=(cc.notes||[]).slice(); ns.push({at:today(),text:txt2});
    if(ta) ta.value="";
    saveCo(id,{notes:ns}); return;
  }
  if(a==="role_note"){
    var rta=el("rn-"+id), rtx=rta? rta.value.trim() : ""; if(!rtx) return;
    var rr3=rawRoles.find(function(x){return x.id===id;}); if(!rr3) return;
    var rns=(rr3.notes||[]).slice(); rns.push({at:today(),text:rtx}); rta.value="";
    save(id,{notes:rns}); return;
  }
  if(a==="role_delnote"){
    var rr4=rawRoles.find(function(x){return x.id===id;}); if(!rr4) return;
    var rns2=(rr4.notes||[]).slice(); rns2.splice(+t.dataset.i,1);
    save(id,{notes:rns2}); return;
  }
  if(a==="co_delnote"){
    var cc2=companies.find(function(x){return x.id===id;}); if(!cc2) return;
    var ns2=(cc2.notes||[]).slice(); ns2.splice(+t.dataset.i,1);
    saveCo(id,{notes:ns2}); return;
  }
  if(a==="ch_seg"){ var chx=channels.find(function(x){return x.id===id;}); if(!chx || (chx.status||"active")===t.dataset.v) return;
    if(DB) DB.doc("channels/"+id).update({status:t.dataset.v}).catch(function(e){ console.warn(e); el("offline").hidden=false; }); return; }
  if(a==="co_sweep"){ var csw=companies.find(function(x){return x.id===id;}); if(!csw) return;
    var want=t.dataset.v==="in"; if(!!csw.watch!==want) saveCo(id,{watch:want}); return; }
  if(a==="co_watch"){
    var cw=companies.find(function(x){return x.id===id;}); if(!cw) return;
    saveCo(id,{watch:!cw.watch}); return;
  }
  if(a==="co_warm"){
    var cc3=companies.find(function(x){return x.id===id;}); if(!cc3) return;
    saveCo(id,{warm:!cc3.warm}); return;
  }
  if(a==="co_target"){
    var cc4=companies.find(function(x){return x.id===id;}); if(!cc4) return;
    saveCo(id,{onTargetList:!cc4.onTargetList}); return;
  }
  if(a==="sec_note"){
    var sta=el("secn-"+id), stx=sta? sta.value.trim() : ""; if(!stx || !DB) return;
    var sx=sectors.find(function(x){return x.id===id;}); if(!sx) return;
    var sn=(sx.notes||[]).slice(); sn.push({at:today(),text:stx}); sta.value="";
    DB.doc("sectors/"+id).update({notes:sn}).catch(function(e){ console.warn(e); el("offline").hidden=false; }); return;
  }
  if(a==="sec_delnote"){
    var sx2=sectors.find(function(x){return x.id===id;}); if(!sx2 || !DB) return;
    var sn2=(sx2.notes||[]).slice(); sn2.splice(+t.dataset.i,1);
    DB.doc("sectors/"+id).update({notes:sn2}).catch(function(e){ console.warn(e); }); return;
  }
  if(a==="co_resolve"){ saveCo(id,{reconcile:""}); return; }
  if(a==="g2park"||a==="g2prep"||a==="g2back"){
    /* The decision note box was removed (1 Oct): g2Note is the research run's log, so moving a role
       must not overwrite it. */
    if(a==="g2prep") save(id,{stage:"prep",g2At:today()});
    if(a==="g2back") save(id,{stage:"consideration"});
    if(a==="g2park"){
      var d=new Date(); d.setDate(d.getDate()+ (5 - ((d.getDay()+2)%7)) || 7);
      var exp=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
      /* Park records parkedAt, never g2At (4 Oct): g2At means "researched", and stamping it here made the
         morning research skip every role parked before its research ran. */
      save(id,{stage:"parked",parkUntil:exp,parkedAt:today()});
    }
    return;
  }
});

document.addEventListener("change",function(ev){
  var ct=ev.target.closest('[data-act="co_pri"]');
  if(ct){ coSetRating(ct.dataset.id,ct.value,ct); return; }
  var cs2=ev.target.closest('[data-cmpslot]');
  if(cs2){ var ids2=cmpIds().slice(), si=+cs2.dataset.cmpslot, v=cs2.value;
    ids2=ids2.map(function(x,j){ return (j!==si && x===v)? "" : x; }); ids2[si]=v;
    CMP=ids2; try{ localStorage.setItem("gb.cmp",JSON.stringify(ids2)); }catch(e){} renderCompare(); return; }
  var chs=ev.target.closest('[data-act="ch_status"]');
  if(chs){ if(DB) DB.doc("channels/"+chs.dataset.id).update({status:chs.value}).catch(function(e){ console.warn(e); }); return; }
  var sst=ev.target.closest('[data-act="sec_stance"]');
  if(sst){ if(DB) DB.doc("sectors/"+sst.dataset.id).update({priority:sst.value}).catch(function(e){ console.warn(e); }); return; }
  var setSel=ev.target.closest('[data-act="fs_set"]');
  if(setSel){
    var sid=setSel.dataset.id, sv=setSel.value;
    var sr2=roles.find(function(x){return x.id===sid;});
    if(sr2 && flowOf(sr2).k!==sv){
      var extra = sv==="offer" ? {stage:"offer", offerAt:today()}
                : (sr2.stage==="offer" ? {stage:"applied"} : null);
      setFlow(sid, sv, extra);
      /* Same as the Prepped / Prep still to do buttons: one prep, one truth (QA 14 Oct). */
      if(sv==="ready"||sv==="prep"){ var nsy=nextSessionOf(sid), pd=sv==="ready";
        if(nsy && DB && !!nsy.prepDone!==pd) DB.doc("commitments/"+nsy.id).update({prepDone:pd, prepNow:!pd, preppedAt: pd? today() : ""}).catch(function(e){ console.warn("prep sync",e&&e.code); }); }
    }
    return;
  }
  var md=ev.target.closest('[data-act="cmtdate"]');
  if(md){
    if(!DB) return;
    var nv=md.value;
    if(!nv) return;   /* clearing the field is not a move — ignore rather than wipe the date */
    DB.doc("commitments/"+md.dataset.cid).update({date:nv})
      .catch(function(e){ console.warn("move date",e&&e.code); el("offline").hidden=false; });
    return;
  }
  var cb=ev.target.closest('[data-act="cmtchaseby"]');
  if(cb){
    if(!DB) return;
    if(!cb.value) return;   /* clearing is not a decision — keep the stored date */
    DB.doc("commitments/"+cb.dataset.cid).update({chaseBy:cb.value})
      .catch(function(e){ console.warn("chase by",e&&e.code); el("offline").hidden=false; });
    return;
  }
  var mt=ev.target.closest('[data-act="cmttime"]');
  if(mt){
    if(!DB) return;
    DB.doc("commitments/"+mt.dataset.cid).update({time:mt.value.trim()})
      .catch(function(e){ console.warn("move time",e&&e.code); el("offline").hidden=false; });
    return;
  }
  var pm=ev.target.closest('[data-act="prepmove"]');
  if(pm){
    if(!DB) return;
    var want=pm.value; if(!want) return;
    var pc0=commitments.find(function(x){return x.id===pm.dataset.cid;});
    if(!pc0 || !pc0.date) return;
    /* A prep moved by hand keeps its own date (prepOn): the meeting never moves with it, and it stays put if the
       meeting moves later. The meeting's own day is allowed. */
    if(want>pc0.date) want=pc0.date;
    /* prepNow pins the row to today whatever the lead says. Moving it by hand is a later, more
       specific instruction than "prep this now", so it clears the pin — otherwise the write
       lands and the row does not budge, which is what made this look broken. */
    DB.doc("commitments/"+pm.dataset.cid).update({prepOn:want, prepNow:false, prepLead:(pc0.prepLead>0? pc0.prepLead : 1)})
      .catch(function(e){ console.warn("prep move",e&&e.code); el("offline").hidden=false; });
    return;
  }
});

function openAdd(mode){
  var last=""; try{ last=localStorage.getItem("gb.pastesrc")||""; }catch(e){}
  spMount("add",last); spMount("paste",last||"ch:manual");
  arReset(false);
  el("paste-hint").textContent=""; el("run-hint").textContent="";
  if(mode){ var mb=document.querySelector('#add-dialog [data-act="ctab"][data-k="'+mode+'"]'); if(mb) mb.click(); }
  var d=el("add-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  if(typeof pastePreview==="function") pastePreview();
}
document.addEventListener("click",function(ev){ var o=ev.target.closest && ev.target.closest("[data-open-add]"); if(!o) return; ev.preventDefault(); openAdd(o.dataset.openAdd); });
el("add-open").addEventListener("click",function(){ openAdd(); return;  var d=el("add-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open",""); setTimeout(function(){el("add-url").focus();},50); });
document.addEventListener("click",function(ev){
  var c=ev.target.closest && ev.target.closest("[data-close]"); if(c){ var d=el(c.dataset.close); if(d&&d.close) d.close(); return; }
  if(ev.target.tagName==="DIALOG" && ev.target.classList.contains("modal") && ev.target.close) ev.target.close();
});
el("add-save").addEventListener("click",function(){ arSave(); });
function addCompany(){
  if(!DB) return;
  var nm=el("co-name").value.trim(); if(!nm) return;
  var id=slug(nm);
  if(companies.some(function(c){ return c.id===id || slug(c.name||"")===id; })){ toast(nm+" is already on your list",true); el("co-name").focus(); return; }
  DB.doc("companies/"+id).set({
    name:nm, aka:"", priority:el("co-pri").value||"unrated",
    listing:"target",
    watch:rateWatch(el("co-pri").value||"unrated"),
    watchWhy:el("co-why").value.trim(),
    warm:!!el("co-warmsel").value, warmNote:"",
    sector:el("co-sector").value.trim(), size:"", hq:"", sites:"",
    health:"", culture:"", comp:"", ai:"", ladder:"",
    green:[], red:[], questions:[], notes:[],
    onTargetList:true, checkedAt:"", reconcile:""
  }).then(function(){ el("co-name").value=""; el("co-sector").value=""; el("co-why").value=""; closeDlg("co-dialog"); })
   .catch(function(e){ console.warn(e); el("offline").hidden=false; });
}
el("co-add").addEventListener("click",addCompany);
["co","sec"].forEach(function(k){ el(k+"-open").addEventListener("click",function(){ var d=el(k+"-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  setTimeout(function(){ var f=el(k+"-name"); if(f) f.focus(); },50); }); });
function closeDlg(id){ var d=el(id); if(d && d.open && d.close) d.close(); }
el("pp-open").addEventListener("click",function(){
  el("pp-how").innerHTML=PP_HOW.map(function(o){return '<option value="'+o[0]+'">'+o[1]+'</option>';}).join("");
  el("pp-co").innerHTML=edOptions(["","","company"],"");
  var d=el("pp-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open",""); setTimeout(function(){ el("pp-name").focus(); },50);
});
/* Open a role on its own tab (from a person's live roles). */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="role_go"]'); if(!b) return; ev.preventDefault();
  var r=roles.find(function(x){return x.id===b.dataset.id;}); if(!r) return;
  var T={proposed:"gate1",consideration:"gate2",parked:"gate2",prep:"toapply",applied:"inplay",offer:"inplay"};
  if(expanded) expanded.add(r.id); showTab(T[r.stage]||"gate2"); render();
  setTimeout(function(){ var d=document.querySelector('details.rcard[data-id="'+r.id+'"]'); if(d) d.scrollIntoView({block:"start",behavior:"smooth"}); },60);
});
/* People tiles: open/close, Spoke today, and the company link (2 Oct). */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="pp_tile"],[data-act="pp_spoke"],[data-act="co_go"]'); if(!b) return;
  if(b.dataset.act==="pp_tile"){
    if(ev.target.closest("a,button,select,input,textarea") && ev.target.closest("a,button,select,input,textarea")!==b) return;
    /* One open at a time (2 Oct): opening a person closes any other. */
    var pid="pp-"+b.dataset.id; if(expanded){ if(expanded.has(pid)) expanded.delete(pid);
      else { Array.from(expanded).forEach(function(k){ if(k.indexOf("pp-")===0) expanded.delete(k); }); expanded.add(pid); } }
    renderPeople();
    if(expanded && expanded.has(pid)) setTimeout(function(){ var d=document.querySelector('#tab-people .ptcard.open[data-id="'+b.dataset.id+'"]'); if(d && d.getBoundingClientRect().top<0) d.scrollIntoView({block:"start",behavior:"smooth"}); },30);
    return; }
  ev.preventDefault(); ev.stopPropagation();
  if(b.dataset.act==="pp_spoke"){ var px=people.find(function(y){return y.id===b.dataset.id;}); if(!px) return; var pxWas=px.lastSpoke; px.lastSpoke=today(); renderPeople();
    if(DB) DB.doc("people/"+px.id).update({lastSpoke:today()}).catch(function(e){ console.warn(e); px.lastSpoke=pxWas||""; renderPeople(); toast("Couldn't save — try again",true); }); return; }
  var cid=b.dataset.id; if(expanded) expanded.add("co-"+cid); showTab("companies"); render();
  setTimeout(function(){ var d=document.querySelector('#tab-companies details.rcard[data-id="co-'+cid+'"]'); if(d) d.scrollIntoView({block:"start",behavior:"smooth"}); },60);
},true);
document.addEventListener("keydown",function(ev){ if((ev.key==="Enter"||ev.key===" ") && ev.target.matches && ev.target.matches('.ptcard[data-act="pp_tile"]')){ ev.preventDefault(); ev.target.click(); } });
/* From a company's People tab: add a person with the company filled in, or open one on People. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="pp_addhere"],[data-act="pp_go"]'); if(!b) return;
  ev.preventDefault();
  if(b.dataset.act==="pp_addhere"){ el("pp-open").click(); setTimeout(function(){ var s=el("pp-co"); if(s){ s.value=b.dataset.id; s.dispatchEvent(new Event("change",{bubbles:true})); } },0); return; }
  if(expanded){ Array.from(expanded).forEach(function(k){ if(k.indexOf("pp-")===0) expanded.delete(k); }); }
  Q.pp=""; var sb=document.querySelector('#tab-people input[type=search], #pp-q'); if(sb) sb.value="";
  showTab("people"); render();
  /* Open the person in the side panel too, as a click on their tile does (QA 15 Oct). */
  setTimeout(function(){ var d=document.querySelector('#tab-people .ptcard[data-id="'+b.dataset.id+'"]'); if(d){ d.scrollIntoView({block:"start",behavior:"smooth"}); d.click(); } },60);
});
/* Roles chart on a company: a stage opens that tab. Remove from the company Edit form opens the card's confirm. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="co_stage"],[data-act="co_rmfromedit"]'); if(!b) return;
  ev.preventDefault();
  if(b.dataset.act==="co_stage"){ showTab(b.dataset.tab); render(); window.scrollTo({top:0,behavior:"smooth"}); return; }
  var id=b.dataset.id; delete EDITING[editKey("company",id)]; if(ED_DLG && ED_DLG.key===editKey("company",id)){ ED_DLG=null; closeDlg("ed-dialog"); }
  if(expanded) expanded.add("co-"+id); render();
  setTimeout(function(){ var cb=el("corm-"+id); if(cb){ cb.classList.add("open"); cb.scrollIntoView({block:"center",behavior:"smooth"}); } },60);
});
el("pp-add").addEventListener("click",function(){
  if(!DB) return;
  var nm=el("pp-name").value.trim(); if(!nm){ el("pp-name").focus(); return; }
  var li=el("pp-li").value.trim(); if(li && !/^https?:\/\//i.test(li)) li="https://"+li;
  DB.doc("people/"+slug(nm)+"-"+Date.now().toString(36).slice(-3)).set({name:nm, how:el("pp-how").value, role:el("pp-role").value.trim(),
    companyId:el("pp-co").value||"", company:"", linkedin:li, note:"", createdAt:today()})
    .then(function(){ ["pp-name","pp-role","pp-li"].forEach(function(k){ el(k).value=""; }); closeDlg("pp-dialog"); })
    .catch(function(e){ console.warn(e); el("offline").hidden=false; });
});
el("ch-open").addEventListener("click",function(){ var d=el("ch-dialog");
  /* New channels default to the tab you are on (3 Oct). */
  var onM=document.querySelector('#tab-routine [data-act="ctab"][data-k="manual"][aria-selected="true"]'); if(el("ch-kind")) el("ch-kind").value=onM? "manual" : "auto"; if(d.showModal) d.showModal(); else d.setAttribute("open",""); setTimeout(function(){ el("ch-name").focus(); },50); });
el("ch-add").addEventListener("click",function(){
  if(!DB) return;
  var nm=el("ch-name").value.trim(); if(!nm){ el("ch-name").focus(); return; }
  var ord=Math.max.apply(null,channels.map(function(c){return c.order||0;}).concat([0]))+1;
  DB.doc("channels/"+slug(nm)).set({name:nm, kind:el("ch-kind").value||"auto", how:el("ch-how").value.trim(), cadence:"", status:"active", why:"", order:ord, createdAt:today()})
    .then(function(){ el("ch-name").value=""; el("ch-how").value=""; closeDlg("ch-dialog"); })
    .catch(function(e){ console.warn(e); el("offline").hidden=false; });
});
document.addEventListener("click",function(ev){
  var g=ev.target.closest && ev.target.closest("[data-gotab]"); if(!g) return;
  ev.preventDefault(); showTab(g.dataset.gotab);
  if(g.dataset.sub){ var sb=document.querySelector('#tab-'+g.dataset.gotab+' [data-act="ctab"][data-k="'+g.dataset.sub+'"]'); if(sb) sb.click(); }
  window.scrollTo(0,0);
});
el("sec-add").addEventListener("click",function(){
  if(!DB) return;
  var nm=el("sec-name").value.trim(); if(!nm) { el("sec-name").focus(); return; }
  if(sectors.some(function(x){ return x.id===slug(nm) || slug(x.name||"")===slug(nm); })){ toast(nm+" already has a sector card",true); el("sec-name").focus(); return; }
  DB.doc("sectors/"+slug(nm)).set({
    name:nm, priority:el("sec-stance").value||"unrated", scope:"", caveat:"",
    transition:"", job:"", rules:[], cvAngle:[], gaps:[], questions:[], help:[], createdAt:today()
  }).then(function(){ el("sec-name").value=""; closeDlg("sec-dialog"); })
   .catch(function(e){ console.warn(e); el("offline").hidden=false; });
});

el("run-save").addEventListener("click",function(){
  if(!DB) return;
  var picked=Array.prototype.slice.call(document.querySelectorAll('#manual-ch [aria-pressed="true"]'));
  if(!picked.length){ el("run-hint").textContent="Tap where you searched."; return; }
  var chs=picked.map(function(x){ return x.querySelector(".lbl").textContent; });
  var d=today();
  DB.doc("runs/"+d+"-manual-"+Date.now().toString(36).slice(-4)).set({
    date:d, type:"manual", channels:chs.join(", "), found:0, out:0, proposed:0, note:el("run-note").value.trim()
  }).then(function(){
    el("run-note").value="";
    picked.forEach(function(x){ x.setAttribute("aria-pressed","false"); x.dataset.v=""; var mk=x.querySelector(".mark"); if(mk) mk.textContent="\u00b7"; });
    closeDlg("add-dialog");
  }).catch(function(e){ console.warn(e); el("offline").hidden=false; });
});

/* The form shows the default rather than hiding it: sent = today, chase = a week later. Changing
   the sent date moves the chase with it until you set the chase date yourself. */
var cmChaseTouched=false;
function cmDefaults(){
  if(!el("cm-sent").value) el("cm-sent").value=today();
  if(!cmChaseTouched) el("cm-chase").value=addDays(el("cm-sent").value||today(),CHASE_DAYS);
}
el("cm-open").addEventListener("click",function(){ var d=el("cm-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open",""); setTimeout(function(){el("cm-title").focus();},50); });
el("cm-sent").addEventListener("change",function(){ if(!cmChaseTouched && el("cm-sent").value) el("cm-chase").value=addDays(el("cm-sent").value,CHASE_DAYS); });
el("cm-chase").addEventListener("change",function(){ cmChaseTouched=!!el("cm-chase").value; });
cmDefaults();
el("cm-save").addEventListener("click",function(){
  if(!DB) return;
  var title=el("cm-title").value.trim();
  if(!title) { el("cm-title").focus(); return; }
  var st=el("cm-state").value;
  var d=el("cm-date").value||"";
  /* A booked thing with no date is not booked. Refuse rather than write a row that renders nowhere. */
  if(st==="booked" && !d){ el("cm-date").focus(); return; }
  /* Sent and chase are prefilled, so only an OFFERED item keeps them — a booked one has no chase. */
  var sent= st==="offered" ? (el("cm-sent").value||today()) : "";
  var id=slug(title)+"-"+Date.now().toString(36).slice(-4);
  DB.doc("commitments/"+id).set({
    title:title, detail:el("cm-detail").value.trim(),
    kind:"external", type: el("cm-type").value,
    state:st, date:d, time:el("cm-time").value.trim(),
    windowText:el("cm-window").value.trim(), sentAt:sent,
    /* Your date if you gave one; otherwise an offered item defaults to a week after it was sent. */
    chaseBy: st==="offered" ? (el("cm-chase").value || addDays(sent,CHASE_DAYS)) : "",
    condition:el("cm-cond").value.trim(), blockedBy:el("cm-blocked").value.trim(), court:el("cm-court").value,
    person:el("cm-person").value.trim(), relationship:el("cm-rel").value,
    org:el("cm-org").value.trim(), roleId:el("cm-roleid").value, createdAt:today()
  }).then(function(){
    if(el("cm-roleid").value && el("cm-type").value==="interview" && st==="booked") linkStage(el("cm-roleid").value, id);
    ["cm-title","cm-detail","cm-time","cm-window","cm-cond","cm-blocked","cm-person","cm-org"].forEach(function(k){ el(k).value=""; });
    cmChaseTouched=false; cmDefaults();
    var cmd=el("cm-dialog"); if(cmd && cmd.open && cmd.close) cmd.close();
  }).catch(function(e){ console.warn(e); el("offline").hidden=false; });
});

el("cv-role").addEventListener("change",toggleSubj);
el("cv-meet").addEventListener("change",meetDate);
el("cv-role").addEventListener("change",function(){ CV_MEET_FREE=""; });
el("cv-close").addEventListener("click",function(){ var d=el("cv-dialog"); if(d.close) d.close(); else d.removeAttribute("open"); });
el("cv-dialog").addEventListener("click",function(ev){ if(ev.target===this && this.close) this.close(); });
el("cv-save").addEventListener("click",function(){
  if(!DB) return;
  var roleId=el("cv-role").value;
  var d=el("cv-date").value||today();
  var liked=el("cv-liked").value.trim(), conc=el("cv-conc").value.trim();
  var qs=el("cv-qs").value.split("\n").map(function(x){return x.trim();}).filter(Boolean);
  /* Questions only (1 Oct). A line without a "?" is a note: move it to Notes and let the user
     look before saving, rather than filing it silently as a question. */
  var notQ=qs.filter(function(q){ return !/\?\s*$/.test(q); });
  if(notQ.length){
    var nb=el("cv-notes"); nb.value=(nb.value.trim()? nb.value.trim()+"\n" : "")+notQ.join("\n");
    el("cv-qs").value=qs.filter(function(q){ return /\?\s*$/.test(q); }).join("\n");
    el("cv-hint").textContent=notQ.length+(notQ.length===1?" line wasn't":" lines weren't")+" a question, so moved to Notes. Check, then Log it again.";
    return;
  }
  var cvNotes=el("cv-notes").value.trim();
  var rsel=roleId? roles.find(function(x){return x.id===roleId;}) : null;
  var companyId = roleId? coIdOfRole(rsel) : (el("cv-co").value||"");
  var sectorId = roleId? "" : (el("cv-sec").value||"");
  var subj=roleId? "" : (el("cv-subj").value.trim() || (companyId? coName(companyId) : sectorId? secName(sectorId) : "Unnamed"));
  /* An entry with none of the three is not a record of anything. */
  if(!liked && !conc && !qs.length && !cvNotes){ el("cv-hint").textContent="Fill in at least one of liked, concerned, questions or notes."; return; }
  el("cv-hint").textContent="";
  var id=d+"-"+slug(roleId||subj)+"-"+Date.now().toString(36).slice(-4);
  DB.doc("conversations/"+id).set({
    date:d, kind:el("cv-kind").value, roleId:roleId, companyId:companyId, sectorId:sectorId, subject:subj,
    who:el("cv-who").value.trim(), liked:liked, concerned:conc, nextQuestions:qs, notes:cvNotes,
    meetingId: roleId? (el("cv-meet").value||"") : (CV_MEET_FREE||""),
    fromMeeting: (typeof cvmDerived==="function")? cvmDerived() : false,
    nextStep:el("cv-next").value.trim(), nextStepDate:el("cv-nextdate").value||""
  }).then(function(){
    el("cv-liked").value=""; el("cv-conc").value=""; el("cv-qs").value=""; el("cv-notes").value=""; CV_MEET_FREE="";
    el("cv-who").value=""; el("cv-next").value=""; el("cv-nextdate").value=""; el("cv-subj").value="";
    el("cv-sec").value="";
    setTimeout(function(){ var d=el("cv-dialog"); if(d && d.open && d.close) d.close(); }, 900);
    /* Look for answers to open questions in what was just logged (1 Oct, night). */
    if(rsel && SAMPLE) qaMatch(rsel,[{id:id, date:d, who:el("cv-who").value, liked:liked, concerned:conc, notes:cvNotes}],true);
    el("cv-hint").textContent= sectorId && !companyId? ("Logged \u2014 it is on the "+secName(sectorId)+" sector card.") : companyId? ("Logged \u2014 it is on the "+coName(companyId)+" card"+(roleId?" and the role card.":" and every role card there.")) : "Logged.";
  }).catch(function(e){ console.warn(e); el("offline").hidden=false; });
});

var TSUB="companies", TARGETS=["companies","sectors"];   /* People is its own tool since 3 Oct */   /* Sweep moved to its own tool, 1 Oct */
function showTab(t){
  if(t==="targets") t=TSUB;
  /* A different page opens at the top, not at the last page's scroll position. */
  if(t!==tab && t!=="roles"){ try{ window.scrollTo({top:0,left:0,behavior:"instant"}); }catch(e){ window.scrollTo(0,0); } }
  if(TARGETS.indexOf(t)>=0) TSUB=t;
  tab=t;
  var inT=TARGETS.indexOf(t)>=0;
  Array.prototype.forEach.call(document.querySelectorAll(".appnav [data-tab]"),function(x){
    x.setAttribute("aria-selected", String(x.dataset.tab===t || (x.dataset.tab==="targets" && inT)));
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-tsub]"),function(x){ x.setAttribute("aria-selected",String(x.dataset.tsub===t)); });
  el("targets-nav").hidden=!inT;
  ["overview","health","week","pipeline","review","gate1","gate2","toapply","inplay","mock","rejected","companies","sectors","people","routine","about","help","compare"].forEach(function(x){ var s=el("tab-"+x); if(s) s.hidden = (x!==t); });
  try{localStorage.setItem("gb.tab",t);}catch(e){}
  syncTabSel();
}
/* Sidebar and top bar both carry [data-tab] buttons (2 Oct). */
Array.prototype.forEach.call(document.querySelectorAll(".appnav"),function(nav){ nav.addEventListener("click",function(ev){
  var b=ev.target.closest("[data-tab]"); if(!b) return; ev.preventDefault(); showTab(b.dataset.tab);
}); });
/* Phone dropdown for the stage tabs (30 Sep). Built from the real tab buttons, so labels, order and
   counts are whatever the stepper shows; choosing one clicks that button. Re-synced from showTab and
   renderCounts, which are the only two places the tab or its counts change. */
function syncTabSel(){
  var s=el("tabsel"); if(!s) return;
  var cur = TARGETS.indexOf(tab)>=0 ? "targets" : tab;
  function opt(b){
    var k=b.dataset.tab, n=b.querySelector(".tcount"), name="";
    Array.prototype.forEach.call(b.childNodes,function(c){ if(c.nodeType===3) name+=c.textContent; });
    if(!name.trim()){ var sp=b.querySelector(".tml b")||b.querySelector("span:not(.tcount)"); name=sp? sp.textContent : k; }
    var c=n && n.textContent.trim();
    var nt=n && n.dataset.note;
    return '<option value="'+esc(k)+'"'+(k===cur?" selected":"")+'>'+esc(name.trim()+(c? " · "+c+(nt? " ("+nt+")" : "") : ""))+'</option>';
  }
  /* Four groups (1 Oct): Planning, Opportunities, Tools, About me. */
  function grp(label,sel){ return '<optgroup label="'+label+'">'+Array.prototype.map.call(document.querySelectorAll(sel),opt).join("")+'</optgroup>'; }
  s.innerHTML = grp("Planning","#sidenav .nv[data-grp=plan]:not([data-tab=roles])")+grp("Opportunities","#tabs .stagebar [data-tab]")+
    grp("Tools","#sidenav .nv[data-grp=tools]")+grp("About me","#sidenav .nv[data-grp=me]");
  s.value=cur;
  var bt=el("tabselbtn"), o=s.options[s.selectedIndex];
  /* Phone (4 Oct): the pill shows the section name and how many items are on you there (.tsbn); the full
     label (.tsbf) stays for 561–1099px. CSS in theme.css picks one. */
  if(bt){
    var full=o? o.textContent : "Sections", mine="";
    var fm=(typeof funnelMine==="function")? funnelMine() : null;
    if(fm && fm.hasOwnProperty(cur)) mine=String(fm[cur]||0);
    else { var tc=document.querySelector('.appnav [data-tab="'+cur+'"] .tcount'); mine=tc? tc.textContent.trim() : ""; }
    var nm=full.split(" \u00b7 ")[0];
    bt.innerHTML='<span class="tsbf">'+esc(full)+'</span><span class="tsbn">'+esc(nm+(mine && mine!=="0"? " \u00b7 "+mine : ""))+'</span>';
    bt.setAttribute("aria-label", full+" — go to section");
    bt.title=full;
  }
}
function tabSheetOpen(){
  var s=el("tabsel"), sh=el("tabsheet"), h=document.querySelector("header.top");
  sh.innerHTML=Array.prototype.map.call(s.querySelectorAll("optgroup"),function(g){
    return '<div class="tsg">'+esc(g.label)+'</div>'+Array.prototype.map.call(g.querySelectorAll("option"),function(o){
      var t=o.textContent, i=t.indexOf(" \u00b7 "), nm=i>=0? t.slice(0,i) : t;
      var src=document.querySelector('.appnav [data-tab="'+o.value+'"] .tcount'), c=src? src.textContent.trim() : "";
      var hot= src && c && !src.classList.contains("quiet");
      return '<button type="button" role="menuitem" data-v="'+esc(o.value)+'" aria-current="'+(o.value===s.value)+'"><span>'+esc(nm)+'</span>'+
        (c? '<span class="ct'+(hot?" hot":"")+'"'+(src.dataset.note? ' title="'+esc(src.dataset.note)+'"' : "")+'>'+esc(c)+'</span>' : "")+'</button>';
    }).join("");
  }).join("");
  sh.style.top=((h? h.getBoundingClientRect().bottom/pgZoom() : 0)+6)+"px";
  sh.hidden=false; sh.scrollTop=0; el("tabselbtn").setAttribute("aria-expanded","true");
}
function tabSheetClose(){ var sh=el("tabsheet"); if(sh.hidden) return; sh.hidden=true; el("tabselbtn").setAttribute("aria-expanded","false"); }
el("tabselbtn").addEventListener("click",function(ev){ ev.stopPropagation(); if(el("tabsheet").hidden) tabSheetOpen(); else tabSheetClose(); });
el("tabsheet").addEventListener("click",function(ev){
  var b=ev.target.closest("[data-v]"); if(!b) return; ev.stopPropagation();
  var s=el("tabsel"); s.value=b.dataset.v; tabSheetClose(); s.dispatchEvent(new Event("change"));
});
document.addEventListener("click",function(ev){ if(!el("tabsheet").hidden && !ev.target.closest("#tabsheet,#tabselbtn")) tabSheetClose(); });
document.addEventListener("keydown",function(ev){ if(ev.key==="Escape") tabSheetClose(); });
window.addEventListener("resize",tabSheetClose);
el("tabsel").addEventListener("change",function(){
  var b=document.querySelector('.appnav .nv[data-tab="'+this.value+'"], .appnav .step[data-tab="'+this.value+'"]'); if(b) b.click();
});
/* In-card tab dropdowns click the matching hidden tab button, so the existing ctab handler runs. */
document.addEventListener("change",function(ev){
  var s=ev.target.closest && ev.target.closest(".ctabsel"); if(!s) return;
  var bar=s.previousElementSibling;
  var b=bar && bar.querySelector('[data-k="'+s.value+'"]'); if(b) b.click();
});
document.addEventListener("click",function(ev){
  var g=ev.target.closest && ev.target.closest("[data-goabout]"); if(!g) return;
  ev.preventDefault(); CTAB["about"]=g.dataset.goabout; showTab("about"); renderAbout(); window.scrollTo(0,0);
});
/* The Companies / Sectors / People switch sits in each Targets page header (2 Oct). */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-tsub]"); if(!b) return; showTab(b.dataset.tsub); render();
});
/* The board always opens on the Overview (2 Oct). */
showTab("overview");
