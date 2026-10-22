"use strict";
/* ===== Data health: plain words, a two-column layout and Suggest fixes (3 Oct) =====
   Data health is worked out live from the data on every render; nothing runs in the background to fill it.
   Each check says who can fix it: the board, right now (dates it can work out, links to deleted things); or only you
   (decisions and scores), in which case it explains and links. Suggest fixes is a pop-up with tick boxes. */

var HY_PLAIN={
  "Past the longlist with no shortlist date":["Roles missing the day you shortlisted them","Without it, the board can't tell how long you take to decide.","board"],
  "At To apply or later with no To apply date":["Roles missing the day you chose to apply","It's how the board times getting a CV out.","board"],
  "Applied with no applied date":["Roles missing the day you applied","Without it, the board can't tell how long companies take to reply, or count your pace.","board"],
  "Ended with no end date":["Closed roles with no closing date","They count as closed, but in no week or month.","board"],
  "Live roles with no posting link":["Live roles with no link to the job ad","Nobody can check they're still open. Add the link on the role.","you"],
  "Roles to confirm with the person":["Roles only someone's word says are open","It's been two weeks. Ask the recruiter or contact if they're still going.","you"],
  "Postings the morning run couldn't read":["Job ads that couldn't be opened","Paste the ad's text on the role so the research can run.","you"],
  "Links not checked live in over two weeks":["Job ads not checked for over two weeks","Counted from the last check, or from when the role arrived or was shortlisted. They may have closed. Claude can re-check them: copy the request.","copy"],
  "Live roles with no Fun or Shot":["Live roles you haven't scored","Your Fun and Shot scores set the order and the mix. Only you can give them.","you"],
  "Shortlist or later with no Them score":["Roles with no Role Fit score","Claude can score your CV against the ad: copy the request.","copy"],
  "Live roles with no company card":["Live roles with no company card","Company research, your rating and warm routes can't show. Claude can make the cards: copy the request.","copy"],
  "Roles whose source has been removed":["Roles from a source that isn't on your list","Usually alert emails from a site you haven't added as a source. The board can add the site to Sourcing, on Trial, so its roles count towards it.","board"],
  "Meetings or tasks linked to a role that's gone":["Meetings or tasks pointing at a deleted role","The board can unlink them and keep them.","board"],
  "Notes linked to something that's gone":["Notes pointing at something deleted","The board can unlink them and keep the notes.","board"],
  "Notes not attached to anything":["Notes not attached to anything","Attach each to a role, company or sector so it shows up where it's useful.","you"],
  "People linked to a company card that's gone":["People pointing at a deleted company","The board can unlink them; the company name stays.","board"],
  "Companies linked to a sector card that's gone":["Companies pointing at a deleted sector","The board can unlink them.","board"],
  "Sweep overdue":["The sweep is overdue","No sweep for longer than its usual gap. Check its scheduled task is still on and its last run didn't fail.","you"],
  "Parked roles past their review date":["Parked roles due a second look","You parked them until a date that has now passed.","you"],
  "Meetings in the past that aren't logged":["Past meetings with no notes","Log how it went so the next prep uses it, or mark it done.","you"],
  "On the shortlist over two weeks without a decision":["Shortlist roles waiting over two weeks","Roles close. Decide, park or reject.","you"],
  "Possible matches for roles you added":["Adverts that may match roles you added","Only you can say if they're the same role.","you"],
  "Possible duplicate roles":["Possible duplicate roles","Same link, or the same company and title. Only you can say.","you"]
};
var HY_SEC_PLAIN={Dates:"Dates", Links:"Job ads and links", Scores:"Scores", Orphans:"Loose links", Stale:"Waiting too long", Duplicates:"Duplicates"};
var HYOPEN={};
function hyWho(x){ return (HY_PLAIN[x.title]||[])[2]||"you"; }

/* ---------- what the board can work out ---------- */
function hyRole(id){ return rawRoles.find(function(r){return r.id===id;}); }
function hyFirstMeet(r){ return commitments.filter(function(c){ return c.roleId===r.id && c.date && mtItem(c)!=="task"; }).map(function(c){return c.date;}).sort()[0]||""; }
function hyBoardFix(x,it){
  var t=x.title, r=it.id && hyRole(it.id), lab=esc(it.label||"");
  function d(v,src){ return v? {v:v, src:src} : null; }
  if(t==="Past the longlist with no shortlist date" && r){ var g=d(r.g2At,"the day you chose to apply")||d(r.appliedAt,"the day you applied")||d(r.endAt||r.closedAt,"the day it closed")||d(r.seen,"the day it was found");
    return g && {coll:"roles", id:r.id, set:{g1At:g.v}, who:lab, txt:"shortlisted on <b>"+esc(niceShort(g.v))+"</b> <em>from "+g.src+"</em>"}; }
  if(t==="At To apply or later with no To apply date" && r){ var g2=d(r.appliedAt,"the day you applied")||d(r.endAt||r.closedAt,"the day it closed")||d(r.g1At,"the day you shortlisted it");
    return g2 && {coll:"roles", id:r.id, set:{g2At:g2.v}, who:lab, txt:"chose to apply on <b>"+esc(niceShort(g2.v))+"</b> <em>from "+g2.src+"</em>"}; }
  if(t==="Applied with no applied date" && r){ var m=hyFirstMeet(r), g3=d(r.g2At,"the day you chose to apply")||d(m,"your first meeting with them, so no later than that");
    return g3 && {coll:"roles", id:r.id, set:{appliedAt:g3.v}, who:lab, txt:"applied on <b>"+esc(niceShort(g3.v))+"</b> <em>from "+g3.src+"</em>"}; }
  if(t==="Ended with no end date" && r){ var last=[r.closedAt,r.appliedAt,r.g2At,r.g1At,r.seen].filter(Boolean).sort().pop();
    return last && {coll:"roles", id:r.id, set:{endAt:last}, who:lab, txt:"closed on <b>"+esc(niceShort(last))+"</b> <em>the last date it has</em>"}; }
  if(t==="Roles whose source has been removed" && r){ var sid=r.sourceId, ch=r.channelId||"alerts";
    var nm=String(sid).replace(/[-_]+/g," ").replace(/\b\w/g,function(c){ return c.toUpperCase(); });
    /* A no-op update on the role plus a source created first (hyGo), so its roles link up; undo deletes the source. */
    return {coll:"roles", id:r.id, set:{sourceId:sid}, who:lab, create:{coll:"sources", id:sid, data:{name:nm, url:"", channelId:ch, status:"trial", why:"Found in your alert emails", note:"",
      order:(srcs||[]).length+1, setup:{read:"alerts"}, createdVia:"health", addedAt:today()}},
      txt:"add <b>"+esc(nm)+"</b> as a source, on Trial, under <b>"+esc((chById(ch)||{}).name||ch)+"</b>"}; }
  if(t==="Meetings or tasks linked to a role that's gone") return {coll:"commitments", id:it.id, set:{roleId:""}, who:lab, txt:"unlink it from the deleted role and keep it"};
  if(t==="Notes linked to something that's gone"){ var v=conversations.find(function(c){return c.id===it.id;}); if(!v) return null;
    var up={}; if(v.roleId && !hyRole(v.roleId)) up.roleId=""; if(v.companyId && !companies.some(function(c){return c.id===v.companyId;})) up.companyId=""; if(v.sectorId && !sectors.some(function(s){return s.id===v.sectorId;})) up.sectorId="";
    return {coll:"conversations", id:it.id, set:up, who:lab, txt:"unlink it and keep the notes"}; }
  if(t==="People linked to a company card that's gone") return {coll:"people", id:it.id, set:{companyId:""}, who:lab, txt:"unlink the deleted company; the name stays"};
  if(t==="Companies linked to a sector card that's gone") return {coll:"companies", id:it.id, set:{sectorId:""}, who:lab, txt:"unlink the deleted sector"};
  return null;
}
function hyPlan(){
  var all=hygiene(), board=[], you=[];
  all.forEach(function(x){ if(!x.items.length) return; var w=hyWho(x);
    if(w==="board") x.items.forEach(function(it){ var f=hyBoardFix(x,it); if(f && Object.keys(f.set).length){ f.title=x.title; f.note=it.note||""; board.push(f); } else you.push({x:x, it:it}); });
    else you.push({x:x}); });
  var youChecks={}; you.forEach(function(y){ var k=y.x.title; youChecks[k]=youChecks[k]||{x:y.x, n:0, items:[]}; if(y.it){ youChecks[k].n++; youChecks[k].items.push(y.it); } else { youChecks[k].n+=y.x.items.length; youChecks[k].items=youChecks[k].items.concat(y.x.items); } });
  return {board:board, you:Object.keys(youChecks).map(function(k){return youChecks[k];})};
}

/* ---------- check corrections (3 Oct) ----------
   - "People whose company has no card" is gone: recruiters and warm contacts aren't target
     companies. A card only matters when a role is there, which "Live roles with no company card" covers.
   - The link check counted "never checked" as overdue, so roles found this week showed up. The 14 days now run
     from the latest of: last checked, found, shortlisted, chose to apply.
   - Every role item carries a note saying where it is (its stage), so "which and where" is always answered. */
var HY_STG={proposed:"Longlist", consideration:"Shortlist", parked:"Parked", prep:"To apply", applied:"Applied", offer:"Offer", closed:"Closed"};
function hyLastCheck(r){ return [r.linkChecked, r.seen, r.g1At, r.g2At].filter(Boolean).sort().pop()||""; }
var _hyBase=hygiene;
hygiene=function(){
  var t=today(), out=_hyBase().filter(function(x){ return x.title!=="People with a company but no company card"; });
  var lc=out.find(function(x){ return x.title==="Links not checked live in over two weeks"; });
  if(lc) lc.items=roles.filter(function(r){ var l=hyLastCheck(r); return (r.stage==="consideration"||r.stage==="prep") && r.url && l && dayGap(l,t)>14; })
    .map(function(r){ return {k:"role", id:r.id, label:(r.ref? "#"+r.ref+" " : "")+(r.title||"Untitled")+" · "+(r.company||""),
      note:(HY_STG[r.stage]||r.stage)+" · "+(r.linkChecked? "last checked "+niceShort(r.linkChecked) : "not checked since "+niceShort(hyLastCheck(r)))}; });
  out.forEach(function(x){ x.items.forEach(function(it){ if((it.k==="role"||it.k==="rej") && !it.note){ var r=hyRole(it.id); if(r) it.note=HY_STG[r.stage]||(DEAD[r.stage]? "Rejected" : r.stage)||""; } }); });
  return out;
};
var _hyItem=hyItem;
hyItem=function(x){ var h=_hyItem(x); return x.note? h.replace(/<\/a>$/,' <span class="hyin">'+esc(x.note)+'</span></a>') : h; };
/* What "needs you" asks for, as a short verb on each item. */
var HY_YOUDO={"Live roles with no posting link":"Add the link","Roles to confirm with the person":"Ask if it's still open","Postings the morning run couldn't read":"Paste the ad's text",
  "Live roles with no Fun or Shot":"Score Fun & Shot","Notes not attached to anything":"Attach it","Parked roles past their review date":"Look again","Sweep overdue":"Check the scheduled task",
  "Meetings in the past that aren't logged":"Log notes or mark done","On the shortlist over two weeks without a decision":"Decide, park or reject",
  "Possible matches for roles you added":"Same role or not?","Possible duplicate roles":"Same role or not?"};
/* How the system fixes each kind, shown under the problem heading in Suggest fixes. */
function hyHow(title){
  if(/no shortlist date|no To apply date|no applied date|no end date/.test(title)) return "The board fills each one in from the nearest date it already has.";
  if(title==="Roles whose source has been removed") return "The board adds each site to Sourcing, on Trial, so these roles link to it. Keep or drop it there.";
  if(/gone|removed/.test(title)) return "The board unlinks them and keeps everything else.";
  return (HY_PLAIN[title]||[])[1]||"";
}

/* ---------- the page ---------- */
var HY_GO={"Sweep overdue":"routine","Live roles with no Fun or Shot":"gate1","Parked roles past their review date":"gate2","On the shortlist over two weeks without a decision":"gate2","Meetings in the past that aren't logged":"week","Postings the morning run couldn't read":"gate2"};
/* Each problem's action (3 Oct): a button that opens the fixes pop-up for just that problem, so the
   row says what to press. Board fixes: "Fix these N". */
function hyRowAct(x,w,P){
  if(w==="you") return '<span class="hywho w-you">Needs you</span>';
  var n=P.board.filter(function(f){return f.title===x.title;}).length;
  if(!n) return '<span class="hywho w-you">Needs you</span>';
  var lab= n===1? "Fix this" : "Fix these "+n;
  return '<button type="button" class="btn primary hyact" data-hy="openk" data-k="'+esc(x.title)+'">'+lab+'</button>';
}
renderHygiene=function(){
  /* One set of numbers (3 Oct): every item shown is "to do" (can be fixed + needs you). The sidebar badge
     is "to do"; the strip adds up to what the cards show; zeros are hidden. */
  var all=hygiene();
  var nTodo=0; all.forEach(function(x){ nTodo+=x.items.length; });
  setCount("tc-health", nTodo); var tb=el("tc-health"); if(tb) tb.classList.toggle("hot", nTodo>0);
  var box=el("hy-body"); if(!box) return;
  var P=hyPlan(), nF=P.board.length, nY=nTodo-nF;
  function sn(n,cls,lab){ return n? '<div class="hysn"><b'+(cls? ' class="'+cls+'"' : "")+'>'+n+'</b><span>'+lab+'</span></div>' : ""; }
  var strip='<div class="hystrip">'+
    (nTodo? sn(nTodo,"","to do")+(nF && nY? sn(nF,"b","can be fixed for you")+sn(nY,"y",(nY===1? "needs" : "need")+" you") : "") : '<div class="hysn"><b class="b">✓</b><span>Nothing to do</span></div>')+
    (nF? '<button type="button" class="btn primary" data-hy="open">Fix all</button>' : "")+'</div>';
  var ok=[], cards=[];
  HY_SECS.forEach(function(sname){
    var rows=all.filter(function(x){return x.sec===sname && x.items.length;}), n=rows.reduce(function(m,x){return m+x.items.length;},0);
    if(!n){ ok.push(HY_SEC_PLAIN[sname]||sname); return; }
    cards.push('<section class="hyc"><div class="hych"><h3>'+esc(HY_SEC_PLAIN[sname]||sname)+'</h3><span class="hycn">'+n+'</span></div>'+rows.map(function(x){
      var P2=HY_PLAIN[x.title]||[x.title,x.why,"you"], w=P2[2], k=x.title, open=!!HYOPEN[k], items=open? x.items : x.items.slice(0,6);
      return '<div class="hyrow"><div class="hyrl"><span class="hyst '+x.sev+'">'+x.items.length+'</span></div><div class="hyrm">'+
        '<div class="hyrt"><b>'+esc(P2[0])+'</b>'+hyRowAct(x,w,P)+'</div>'+
        '<p class="hyw">'+esc(P2[1])+'</p>'+
        '<div class="hyitems">'+items.map(hyItem).join("")+
          (x.items.length>6? '<button type="button" class="linkbtn hyall" data-hy="more" data-k="'+esc(k)+'">'+(open? "Show fewer" : "+ "+(x.items.length-6)+" more")+'</button>' : "")+
          (HY_GO[x.title]? '<a href="#" class="linkbtn hyall" data-gotab="'+HY_GO[x.title]+'">Go there →</a>' : "")+'</div></div></div>'; }).join("")+'</section>');
  });
  box.innerHTML=strip+'<div class="hylist">'+cards.join("")+(ok.length? '<p class="hyclear"><span>✓</span> Also checked, all good: '+ok.map(esc).join(" · ")+'</p>' : "")+'</div>';
};

/* ---------- Suggest fixes ---------- */
var HYF=null;
function hyOpen(k){
  var P=hyPlan();
  if(k) P={board:P.board.filter(function(f){return f.title===k;}), you:[]};
  HYF={P:P, done:null, k:k||""};
  var h=document.querySelector("#hf-dialog .modal-head h3"); if(h) h.textContent= k? ((HY_PLAIN[k]||[k])[0]) : "Fix all";
  hyDraw(); var d=el("hf-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
}
function hyDraw(){
  var b=el("hf-body"); if(!b||!HYF) return; var P=HYF.P;
  if(HYF.done){ var D=HYF.done;
    b.innerHTML='<div class="hfdone"><p><b>'+(D.fixed? plural(D.fixed,"fix","fixes")+" made." : "Nothing changed on the board.")+'</b>'+(D.failed? ' <span class="bad">'+plural(D.failed,"fix","fixes")+' couldn\'t be saved — try again.</span>' : "")+'</p>'+
      (D.fixed? '<button type="button" class="btn" data-hy="undo">Undo the fixes</button>' : "")+'<button type="button" class="btn primary" data-close="hf-dialog">Close</button></div>';
    return; }
  function cap(t){ t=String(t||""); return t.charAt(0).toUpperCase()+t.slice(1); }
  /* Two groups (3 Oct): what the system can fix (each row tagged now / next morning) and what needs you.
     Inside each, a sub-heading per problem says what's wrong before the rows say what will happen. */
  function byTitle(list){ var o=[], ix={}; list.forEach(function(f){ if(!(f.title in ix)){ ix[f.title]=o.length; o.push({title:f.title, rows:[]}); } o[ix[f.title]].rows.push(f); }); return o; }
  var fix=[]; P.board.forEach(function(f,i){ fix.push(Object.assign({key:"b:"+i, when:"Now"},f)); });
  var fixHtml= fix.length? '<section class="hfg"><div class="hfgh"><span class="hfgi k-b"></span><div><h4>We can fix these for you <span class="hfgn">'+fix.length+'</span></h4>'+
      (HYF.k? '</div>' : '<p class="hfs">Some are fixed now and can be undone straight after. Others need a look-up: copy them for Claude and paste into a chat in your Next Role project.</p></div>')+
      '<button type="button" class="linkbtn hfall" data-hfall="1">Select none</button></div>'+
      byTitle(fix).map(function(g){ var P2=HY_PLAIN[g.title]||[g.title];
        return '<div class="hfp"><div class="hfph"><b>'+esc(P2[0])+'</b> <span class="hfgn">'+g.rows.length+'</span><span class="hfphw">'+esc(hyHow(g.title))+'</span></div><div class="hfl">'+
          g.rows.map(function(f){ return '<label class="hfrow"><input type="checkbox" data-hf="'+f.key+'" checked><span class="hfw"><b>'+f.who+'</b><span>'+cap(f.txt)+'</span></span><span class="hftag '+(f.when==="Now"? "now" : "later")+'">'+f.when+'</span></label>'; }).join("")+'</div></div>'; }).join("")+'</section>' : "";
  var youHtml= P.you.length? '<section class="hfg"><div class="hfgh"><span class="hfgi k-y"></span><div><h4>These need you <span class="hfgn">'+P.you.reduce(function(m,y){return m+y.n;},0)+'</span></h4><p class="hfs">Decisions, scores and things only you know. Click one to open it.</p></div></div>'+
      P.you.map(function(y){ var P2=HY_PLAIN[y.x.title]||[y.x.title,""], todo=HY_YOUDO[y.x.title]||"", its=y.items.slice(0,8);
        return '<div class="hfp"><div class="hfph"><b>'+esc(P2[0])+'</b> <span class="hfgn">'+y.n+'</span><span class="hfphw">'+esc(P2[1])+'</span></div><div class="hfl">'+
          its.map(function(it){ return '<div class="hfrow ny hfyou"><span></span><span class="hfw">'+hyItem(it)+'</span>'+(todo? '<span class="hftag you">'+esc(todo)+'</span>' : '<span></span>')+'</div>'; }).join("")+
          (y.items.length>8? '<div class="hfrow ny hfmore"><span></span><a href="#" class="linkbtn" data-hy="goto" data-tab="health">+ '+(y.items.length-8)+' more on Data health</a><span></span></div>' : "")+'</div></div>'; }).join("")+'</section>' : "";
  b.innerHTML='<p class="hfi">Tick what you want done. Nothing changes until you press the button below.</p>'+fixHtml+youHtml+
    '<div class="hffoot"><button type="button" class="btn primary" data-hy="go">'+hyGoLabel()+'</button><button type="button" class="btn ghost" data-close="hf-dialog">Cancel</button></div>';
  hyAllLabels();
}
function hyPicked(){
  var sel={b:[]}; Array.prototype.forEach.call(document.querySelectorAll("#hf-body [data-hf]:checked"),function(x){ var p=x.dataset.hf.split(":"); sel[p[0]].push(+p[1]); });
  return sel;
}
function hyGoLabel(){ var body=el("hf-body"), s= body && body.querySelector("[data-hf]")? hyPicked() : {b:HYF.P.board.map(function(x,i){return i;})};
  return s.b.length? "Fix "+s.b.length+" now" : "Nothing selected"; }
async function hyGo(){
  if(!DB || !HYF) return; var s=hyPicked(), P=HYF.P, undo=[], fixed=0, failed=0;
  for(var i=0;i<s.b.length;i++){ var f=P.board[s.b[i]]; var cur=(f.coll==="roles"? rawRoles : f.coll==="commitments"? commitments : f.coll==="conversations"? conversations : f.coll==="people"? people : companies).find(function(x){return x.id===f.id;});
    if(!cur) continue; var before={}; Object.keys(f.set).forEach(function(k){ before[k]= cur[k]==null? {__delete__:true} : cur[k]; });
    if(f.create && !(srcs||[]).some(function(x){ return x.id===f.create.id; }) && !undo.some(function(u){ return u.del && u.coll===f.create.coll && u.id===f.create.id; })){
      try{ await DB.doc(f.create.coll+"/"+f.create.id).set(f.create.data); undo.push({coll:f.create.coll, id:f.create.id, del:true}); }catch(e){ console.warn("fix create",e); failed++; continue; } }
    try{ await DB.doc(f.coll+"/"+f.id).update(f.set); undo.push({coll:f.coll, id:f.id, before:before}); fixed++; }catch(e){ console.warn("fix",e); failed++; } }
  HYF.done={fixed:fixed, failed:failed, undo:undo}; hyDraw();
}
async function hyUndo(){
  var u=(HYF&&HYF.done&&HYF.done.undo)||[];
  for(var i=0;i<u.length;i++){ if(u[i].del){ try{ await DB.doc(u[i].coll+"/"+u[i].id).delete(); }catch(e){} continue; } var b={}; Object.keys(u[i].before).forEach(function(k){ var v=u[i].before[k]; b[k]=(v && v.__delete__)? "" : v; });
    try{ await DB.doc(u[i].coll+"/"+u[i].id).update(b); }catch(e){} }
  HYF.done.undo=[]; HYF.done.fixed=0; toast("Fixes undone"); hyDraw();
}
document.addEventListener("click",function(ev){
  var sa=ev.target.closest && ev.target.closest("[data-hfall]");
  if(sa){ ev.preventDefault(); var boxes=sa.closest(".hfg").querySelectorAll("[data-hf]"), on=!Array.prototype.every.call(boxes,function(x){return x.checked;});
    Array.prototype.forEach.call(boxes,function(x){ x.checked=on; }); hyAllLabels(); return; }
  var b=ev.target.closest && ev.target.closest("[data-hy]"); if(!b) return;
  ev.preventDefault(); var a=b.dataset.hy;
  if(a==="open") return hyOpen();
  if(a==="openk") return hyOpen(b.dataset.k);
  if(a==="more"){ HYOPEN[b.dataset.k]=!HYOPEN[b.dataset.k]; renderHygiene(); return; }
  if(a==="go") return hyGo();
  if(a==="undo") return hyUndo();
  if(a==="goto"){ closeDlg("hf-dialog"); showTab(b.dataset.tab); return; }
});
document.addEventListener("click",function(ev){
  var a=ev.target.closest && ev.target.closest("#hf-body .hfyou [data-act], #hf-body .hfyou [data-gotab]"); if(a) closeDlg("hf-dialog");
},true);
document.addEventListener("change",function(ev){
  var t=ev.target; if(!t || !t.closest || !t.closest("#hf-body")) return;
  hyAllLabels();
});
function hyAllLabels(){
  Array.prototype.forEach.call(document.querySelectorAll("#hf-body [data-hfall]"),function(sa){ var boxes=sa.closest(".hfg").querySelectorAll("[data-hf]");
    sa.textContent=Array.prototype.every.call(boxes,function(x){return x.checked;})? "Select none" : "Select all"; });
  var g=document.querySelector('#hf-body [data-hy="go"]'); if(g){ g.textContent=hyGoLabel(); g.disabled=/^Nothing/.test(g.textContent); }
}
try{ renderHygiene(); }catch(e){}

/* + New stays at the top bar's right edge on every page (3 Oct, replacing the 2 Oct alignment with the
   content's edge, which moved it on narrower pages such as Mock interview). Overrides 18's alignNew. */
alignNew=function(){ var nm=el("newmenu"); if(nm) nm.style.marginRight=""; };
try{ alignNew(); }catch(e){}
