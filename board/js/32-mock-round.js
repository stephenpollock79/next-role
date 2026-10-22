"use strict";
/* ===== Mock interview knows the round (5 Oct) =====
   The board works out where a role's process is from its meetings, so there is no "first interview" switch.
   Only real interview rounds for THIS role count (MKR_IV types, or the older "interview" type): informal chats,
   coffees, info interviews, recruiter catch-ups and company-level meetings never do. A round counts once it is
   done or its date has passed. The next booked round prefills the round type and focus from its own `prep`
   (written on the meeting by next-role-interview-prep). The interviewer is told the stage, so a first round
   doesn't behave as if you've met before. */
var MKR_IV={screen:1, hm:1, domain:1, sense:1, competency:1, culture:1, panel:1, livecase:1, casepres:1, exec:1, test:1};
var MKR_TYPE={screen:"screen", hm:"pm", sense:"pm", panel:"pm", exec:"pm", test:"pm", competency:"culture", culture:"culture", domain:"domain", livecase:"livecase", casepres:"takehome"};
var MKR_LAB_FIRST="Focus — what to practise";
var MKR_LAB_LATER="Focus — what to probe, what they asked last time";
function mkrForRole(c,r){ return c.roleId===r.id || c.forId===r.id || (c.tagRoles||[]).indexOf(r.id)>=0; }
function mkrIsRound(c){ return mtItem(c)!=="task" && (MKR_IV[c.type] || c.type==="interview"); }
function mkrInfo(r){
  var t=today(), cid=coIdOfRole(r);
  var mine=commitments.filter(function(c){ return mkrForRole(c,r) && mtItem(c)!=="task"; });
  var prev=mine.filter(function(c){ return mkrIsRound(c) && c.state!=="cancelled" && (c.state==="done" || (c.date && c.date<t)); })
    .sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  var next=mine.filter(function(c){ return mkrIsRound(c) && c.state==="booked" && c.date && c.date>=t; })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); })[0]||null;
  /* Not booked yet still counts (6 Oct): the next round can be planned before a date is set. Lowest `order` first. */
  if(!next) next=mine.filter(function(c){ return mkrIsRound(c) && c.state!=="done" && c.state!=="booked" && !c.date; })
    .sort(function(a,b){ return (+a.order||99)-(+b.order||99); })[0]||null;
  /* Earlier contact that wasn't an interview: the role's own non-round meetings, and the company's meetings. */
  var chats=commitments.filter(function(c){
      if(mtItem(c)==="task" || mkrIsRound(c) || c.state==="cancelled" || !(c.state==="done" || (c.date && c.date<t))) return false;
      if(mkrForRole(c,r)) return true;
      return !c.roleId && ((c.forKind==="company" && c.forId===cid) || (cid && slug(c.org||"")===cid));
    }).sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  return {prev:prev, next:next, chats:chats};
}
function mkrLabel(text){
  var ta=el("mk-focus"), lab=ta && ta.closest("label"); if(!lab) return;
  var n=lab.firstChild; if(n && n.nodeType===3) n.nodeValue=text; else lab.insertBefore(document.createTextNode(text),ta);
}
function mkrFocusFrom(p){
  var q=(p.likelyQuestions||[]).slice(0,6);
  return q.length? "Ask what they're likely to ask: "+q.join("; ")+"." : "";
}
function mkrPaint(){
  var box=el("mk-suggest"), r=roles.find(function(x){ return x.id===el("mk-role").value; });
  if(!r){ mkrLabel(MKR_LAB_LATER); return; }
  var I=mkrInfo(r), first=!I.prev.length, lines=[];
  mkrLabel(first? MKR_LAB_FIRST : MKR_LAB_LATER);
  el("mk-focus").placeholder= first? "e.g. my career story in 90 seconds; why I'm moving; salary expectations" : "e.g. they pushed on metrics last time; probe experimentation design";
  if(first) lines.push("<b>First interview round</b> for this role"+(I.chats.length? " — earlier "+esc(I.chats[0].title||"chat")+" ("+esc(niceShort(I.chats[0].date))+") was informal and doesn't count as a round" : "")+".");
  else { var l=I.prev[0], logged=conversations.some(function(c){ return c.meetingId===l.id; });
    lines.push("<b>Last round:</b> "+esc(l.title||"Interview")+" · "+esc(niceShort(l.date))+(logged? "" : ' · <span style="color:var(--warn)">no notes logged</span>')+(I.prev.length>1? " · "+I.prev.length+" rounds so far" : "")); }
  if(I.next){
    var nts=mkTypesGuess(I.next, I.next.prep||{}), hasP=I.next.prep && typeof I.next.prep==="object" && Object.keys(I.next.prep).length;
    lines.push("<b>Next:</b> "+esc(I.next.title||"Interview")+" · "+(I.next.date? esc(niceShort(I.next.date))+(I.next.time? " "+esc(I.next.time) : "") : "not booked yet")+
      (nts.length? " · covers <b>"+esc(mkTypesLabel(nts,true))+"</b>" : "")+(hasP? " · prep ready" : ""));
  }
  if(box) box.insertAdjacentHTML("afterbegin",'<div class="secintro" style="display:flex;flex-direction:column;gap:4px;margin-bottom:4px">'+lines.map(function(b){ return "<div>"+b+"</div>"; }).join("")+'</div>');
}
function mkrApply(cid){
  var c=commitments.find(function(x){ return x.id===cid; }); if(!c) return;
  var ts=mkTypesGuess(c, c.prep||{}); if(ts.length) mkSetTypes(ts);
  var f=c.prep? mkrFocusFrom(c.prep) : ""; if(f) el("mk-focus").value=f;
}
mockSuggest=(function(orig){ return function(){ orig(); try{ mkrPaint(); }catch(e){ console.warn("mock round",e); } }; })(mockSuggest);
openMockFor=(function(orig){ return function(roleId,cid){ orig(roleId,cid);
  if(MK.on) return; if(!cid){ try{ mkrPrefill(); }catch(e){} return; } var c=commitments.find(function(x){ return x.id===cid; });
  var r=roles.find(function(x){ return x.id===roleId; }); if(c && c.prep && !(r && r.interviewPrep && r.interviewPrep[cid])) mkrApply(cid); }; })(openMockFor);
/* The stage line, shared by the interviewer (mockRules) and the feedback (13 mkFeedback). */
function mkrStage(r){
  if(!r) return "";
  var I=mkrInfo(r);
  if(!I.prev.length) return "Where this sits in their process: this is the candidate's FIRST interview round for this role. You have not interviewed them before; do not refer to earlier rounds."+
    (I.chats.length? " Earlier informal contact, not an interview: "+I.chats.slice(0,3).map(function(c){ return (c.title||"chat")+" on "+c.date; }).join("; ")+"." : "");
  return "Where this sits in their process: earlier interview rounds for this role: "+I.prev.slice(0,4).map(function(c){ return (c.title||"interview")+" on "+c.date; }).join("; ")+". You may refer to them as a real interviewer would.";
}
/* The candidate's own plan for the round being practised (the next booked round, else the latest one), from the
   meeting's prep: the feedback judges against it. */
function mkrPlan(r){
  if(!r) return "";
  var I=mkrInfo(r), cands=[I.next].concat(I.prev).filter(Boolean), c=cands.find(function(x){ return x.prep && typeof x.prep==="object" && Object.keys(x.prep).length; });
  if(!c) return "";
  var p=c.prep, out=["=== THE CANDIDATE'S OWN PLAN FOR THIS ROUND ("+(c.title||"interview")+") ==="];
  if(p.salary) out.push("Pay approach: "+clip(p.salary,600));
  if(p.logistics) out.push("Logistics: "+clip(p.logistics,400));
  if((p.avoid||[]).length) out.push("Things they planned not to say: "+p.avoid.join(" | "));
  if((p.askThem||[]).length) out.push("Questions they planned to ask: "+p.askThem.join(" | "));
  return out.length>1? out.join("\n") : "";
}
mockRules=(function(orig){ return function(){
  var s=orig(), stage=mkrStage(MK.role); if(!stage) return s;
  var k=s.lastIndexOf("\nBegin now:");
  return k>-1? s.slice(0,k)+"\n"+stage+s.slice(k) : s+"\n"+stage;
}; })(mockRules);
/* When the interviewer asks for your questions, say they can all go in one reply. */
mkAsk=(function(orig){ return async function(){
  await orig();
  var last=MK.turns[MK.turns.length-1];
  if(MK.on && last && last.who==="them" && /questions?\s+(do|have)\s+you|what\s+questions|any\s+questions/i.test(last.text) && !/\[END\]/.test(last.text))
    el("mk-shint").textContent="Ask all your questions in one reply if you like — the interviewer answers each one.";
}; })(mkAsk);
/* Leaving the page closes any feedback on show, so you come back to the setup form. */
showTab=(function(orig){ return function(t){
  var was=(typeof tab!=="undefined")? tab : "";
  orig(t);
  if(was==="mock" && t!=="mock" && !MK.on && typeof mkCloseFb==="function" && !el("mock-feedback").hidden) mkCloseFb();
}; })(showTab);
try{ if(el("mk-role")) mockSuggest(); }catch(e){}
/* Picking a role preselects every type its next round covers (6 Oct). Only on a role change, so a manual pick
   isn't overwritten by a redraw. The focus is drafted by 37. */
function mkrPrefill(){
  var r=roles.find(function(x){ return x.id===el("mk-role").value; }); if(!r || MK.on) return;
  var n=mkrInfo(r).next, ts=n? mkTypesGuess(n, n.prep||{}) : [];
  if(!ts.length && !mkrInfo(r).prev.length && r.stage==="applied") ts=["screen"];
  if(ts.length) mkSetTypes(ts);
}
if(el("mk-role")) el("mk-role").addEventListener("change",function(){ try{ mkrPrefill(); }catch(e){ console.warn("mock prefill",e); } });

/* After a mock (5 Oct): offer to tick the next round's prep task on Week ahead. Asked, never automatic — a mock
   is one piece of prep and "done" is the user's call. Not yet only hides it for this feedback. */
function mkrPrepAsk(r){
  if(!r) return;
  var c=mkrInfo(r).next, bar=document.querySelector("#mock-feedback .mkfbbar");
  if(!c || !bar || c.prepDone || c.prepLead===0) return;
  bar.insertAdjacentHTML("afterend",'<div class="mkprepask notice"><span>Prep for <b>'+esc(c.title||"the next round")+'</b> ('+esc(niceShort(c.date))+(c.time? " "+esc(c.time) : "")+'): mark as done?</span>'+
    '<button type="button" class="btn primary sm" data-mkprep="'+esc(c.id)+'">Mark prepped</button>'+
    '<button type="button" class="btn ghost sm" data-mkprepno="1">Not yet</button></div>');
}
document.addEventListener("click",function(ev){
  var no=ev.target.closest && ev.target.closest("[data-mkprepno]");
  if(no){ var q=no.closest(".mkprepask"); if(q) q.remove(); return; }
  var b=ev.target.closest && ev.target.closest("[data-mkprep]"); if(!b || !DB) return;
  var cid=b.dataset.mkprep, box=b.closest(".mkprepask"); b.disabled=true;
  DB.doc("commitments/"+cid).update({prepDone:true, prepNow:false, preppedAt:today()}).then(function(){
    if(box) box.innerHTML='<span>Prep marked as done.</span>';
    toastUndo("Marked prepped",function(){ DB.doc("commitments/"+cid).update({prepDone:false, preppedAt:""}).catch(function(e){ console.warn(e); }); });
  }).catch(function(){ b.disabled=false; toast("Couldn't save — try again",true); });
});

/* "How to use it" fold on the mock page (11 Oct): closed by default, its open/closed state remembered in this browser. */
(function(){
  var d=el("mk-how"); if(!d) return;
  try{ if(localStorage.getItem("nr.mkHowOpen")==="1") d.open=true; }catch(e){}
  d.addEventListener("toggle",function(){ try{ localStorage.setItem("nr.mkHowOpen", d.open? "1" : "0"); }catch(e){} });
})();
