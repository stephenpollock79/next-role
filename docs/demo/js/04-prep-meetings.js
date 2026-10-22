"use strict";
/* ---------- PREP & CONVERSATIONS ----------
   Three fields per entry, chosen deliberately over a transcript: what I liked, what concerned me,
   what to ask next time. A verbatim record of what they asked is more complete and does not get
   written at 5pm; a judgment does, and it is the thing a later decision actually needs. */
function convsFor(roleId){
  return conversations.filter(function(c){return c.roleId===roleId;})
    .sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
}
/* Company-level conversations (29 Sep). Feedback: "Nearly all our chat was more on company than a
   specific role." A conversation now carries companyId as well as roleId. It shows on the company
   card, and on every role card at that company. The flow logic (last contact, interviewing) still
   reads convsFor, which is role-only on purpose: a chat about the company is not contact on a
   specific application and must not move its status. */
function coIdOfRole(r){ return r ? (r.companyId || slug(r.company||"")) : ""; }
function byDateDesc(a,b){ return String(b.date).localeCompare(String(a.date)); }
function convsShown(r){
  var cid=coIdOfRole(r);
  return conversations.filter(function(c){ return c.roleId===r.id || (!c.roleId && cid && c.companyId===cid); })
    .sort(byDateDesc);
}
function secName(sid){ var x=sectors.find(function(s){return s.id===sid;}); return x? (x.name||sid) : sid; }
function convsForSec(sid){ return conversations.filter(function(c){ return c.sectorId===sid; }).sort(byDateDesc); }
/* Deleting a record clears the links that point at it, so nothing is left dangling (audit, 1 Oct). */
function unlinkMeeting(cid){
  if(!DB) return;
  rawRoles.forEach(function(r){
    var ip=r.interviewPrep||{}, patch=null;
    Object.keys(ip).forEach(function(k){ if((ip[k]||{}).commitmentId===cid){ patch=patch||{interviewPrep:{}}; patch.interviewPrep[k]={commitmentId:""}; } });
    if(patch) DB.doc("roles/"+r.id).update(patch).catch(function(e){ console.warn("unlink stage",e&&e.code); });
  });
  conversations.forEach(function(c){ if(c.meetingId===cid) DB.doc("conversations/"+c.id).update({meetingId:""}).catch(function(){}); });
}
function unlinkSector(sid){
  if(!DB) return;
  conversations.forEach(function(c){ if(c.sectorId===sid) DB.doc("conversations/"+c.id).update({sectorId:""}).catch(function(){}); });
  companies.forEach(function(c){ if(c.sectorId===sid) DB.doc("companies/"+c.id).update({sectorId:""}).catch(function(){}); });
}
function unlinkCompany(cid){
  if(!DB) return;
  /* A company-only conversation would vanish from every card; keep it, as a loose one on Applied. */
  conversations.forEach(function(c){ if(c.companyId===cid && !c.roleId) DB.doc("conversations/"+c.id).update({companyId:"", subject:c.subject||coName(cid)}).catch(function(){}); });
  /* Roles and people keep the company as typed text, so nothing points at a deleted card (QA 14 Oct). */
  var nm=coName(cid);
  rawRoles.forEach(function(r){ if(r.companyId===cid) DB.doc("roles/"+r.id).update({companyId:"", company:r.company||nm}).catch(function(){}); });
  people.forEach(function(p){ if(p.companyId===cid) DB.doc("people/"+p.id).update({companyId:"", company:p.company||nm}).catch(function(){}); });
}
/* Company -> sector card, via company.sectorId (added 1 Oct). */
function secOfCo(co){ return co && co.sectorId? (sectors.find(function(s){return s.id===co.sectorId;})||null) : null; }
function cosOfSec(sid){ return companies.filter(function(c){return c.sectorId===sid;}); }
function coName(cid){ var c=companies.find(function(x){return x.id===cid;}); return c? (c.name||cid) : cid; }
function convAbout(c){
  if(c.roleId){ var rl=roleLabel(c.roleId); return rl? '<span class="chip">'+esc(rl)+'</span>' : ""; }
  if(c.companyId) return '<span class="chip warm">'+esc(coName(c.companyId))+' · company</span>';
  if(c.sectorId) return '<span class="chip warm">'+esc(secName(c.sectorId))+' · sector</span>';
  return "";
}
function logBtn(roleId,coId,label,secId,cid){
  return '<button type="button" class="btn" data-act="logjump" data-id="'+esc(roleId||"")+'" data-co="'+esc(coId||"")+'" data-sec="'+esc(secId||"")+'"'+(cid? ' data-cid="'+esc(cid)+'"' : "")+'>'+
    esc(label||"Log a conversation")+'</button>';
}
/* Several lines become bullets; one line stays a sentence (2 Oct: blank lines made big gaps). */
function convText(t){
  var ls=String(t||"").split(/\n+/).map(function(x){return x.trim();}).filter(Boolean);
  return ls.length>1? '<ul class="convlist">'+ls.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>' : '<p>'+esc(ls[0]||"")+'</p>';
}
function convEntry(c,showAbout){
  var qs=(c.nextQuestions||[]).filter(Boolean);
  return '<div class="conv">'+
    '<div class="conv-head">'+
      '<span class="chip code">'+esc(c.date? niceShort(c.date) : "")+'</span>'+
      '<span class="chip">'+esc(c.kind||"Conversation")+'</span>'+
      (c.who?'<span class="conv-who">'+esc(c.who)+'</span>':"")+
      (showAbout===true? convAbout(c) : (!c.roleId && c.companyId && showAbout!==false ? convAbout(c) : ""))+
      /* Edit only (2 Oct): removing the notes lives inside the edit pop-up. */
      '<button class="conv-del" style="margin-left:auto" data-act="ed_open" data-k="conversation" data-id="'+esc(c.id)+'">'+
        "Edit"+'</button>'+
    '</div>'+
    editBox("conversation",c.id)+
    (c.liked?'<div class="conv-col good"><span class="eyebrow">What I liked</span>'+convText(c.liked)+'</div>':"")+
    (c.concerned?'<div class="conv-col bad"><span class="eyebrow">What concerned me</span>'+convText(c.concerned)+'</div>':"")+
    (c.notes?'<div class="conv-col"><span class="eyebrow">Notes</span>'+convText(c.notes)+'</div>':"")+
    (qs.length?'<div class="conv-col"><span class="eyebrow">Questions to ask them</span><ul class="qlist" style="margin-top:5px">'+
      qs.map(function(q){return "<li>"+esc(q)+"</li>";}).join("")+'</ul></div>':"")+
    (c.nextStep?'<div class="convnext"><span class="eyebrow">Next step</span><span>'+esc(c.nextStep)+'</span>'+
      (c.nextStepDate?'<span class="convby">by '+esc(niceShort(c.nextStepDate))+'</span>':"")+'</div>':"")+
  '</div>';
}

/* The application pack (30 Sep). The morning task's job-apply-pack skill copies the CV and cover
   letter templates into a folder for the role, tailors both as Word tracked changes, and writes
   `pack` back here. This block is the "what changed" the user reads before opening Word. Read-only:
   the decisions happen in Word, accepting or rejecting each change. */
function packBlock(r,noFinal){
  /* Cards, like the other tabs (1 Oct, night): CV, Cover letter, Gaps when there are any, Final
     versions. Each card edits its own part. */
  var p=r.pack;
  function card(title,meta,ek,inner){
    return '<div class="ivsec">'+ivHead(title,meta||"",ek? editBtn(ek,r.id,"Edit") : "")+(ek? editBox(ek,r.id) : "")+inner+'</div>';
  }
  var fin = noFinal? "" : card("Final versions","",null,finalBox(r,false,true));
  if(!packReady(r)){
    return '<div class="ivtab ivcards">'+card("CV and cover letter","",null,
      '<p class="emptyline">No tailored CV yet. The morning run builds one for every role here: the CV and cover letter tailored as Word tracked changes. '+
      'To have it sooner, ask Claude to build the CV for this role.</p>')+fin+'</div>';
  }
  var ch=(p.cvChanges||[]), gaps=(p.gaps||[]);
  var built = p.builtAt? '<span class="chip code">built '+esc(niceShort(p.builtAt))+'</span>' : "";
  return '<div class="ivtab ivcards">'+
    card("CV",built,"packcv",
      '<p class="secintro">Tailored for this role. Every edit is a tracked change in the Word file — finish it outside the board, then upload what you send.</p>'+
      (p.stored==="board"? packFileRow(r,"cv","Tailored draft",p.cv) : fact("Tailored draft",p.cv))+
      (ch.length? '<div><span class="eyebrow">What changed · '+ch.length+'</span>'+
        '<ul class="qlist" style="margin-top:6px">'+ch.map(function(c){
          return '<li><b style="font-weight:500;color:var(--ink)">'+esc(c.what||"")+'</b>'+
            (c.why? '<span style="color:var(--muted)"> — '+esc(c.why)+'</span>' : "")+'</li>';
        }).join("")+'</ul></div>' : "")+
      (p.stored!=="board" && p.folder? '<div class="facts" style="border:none;padding:0">'+fact("Folder",p.folder)+'</div>' : ""))+
    card("Cover letter","","packlet",
      (p.stored==="board"? packFileRow(r,"letter","Tailored draft",p.letter) : fact("Tailored draft",p.letter))+
      (p.letterAngle? '<div><span class="eyebrow">The argument</span>'+
        '<p style="margin:3px 0 0;font-size:13.5px;color:var(--ink-2)">'+esc(p.letterAngle)+'</p></div>' : ""))+
    /* Gaps and Final versions side by side when both show (1 Oct, night). */
    (gaps.length && fin? '<div class="cvpair">' : "")+
    (gaps.length? card("Gaps to check",'<span class="secmeta">'+gaps.length+'</span>',"packgaps",
      '<p class="secintro">Not covered up — worth a look before sending.</p>'+
      '<ul class="qlist gapl">'+gaps.map(function(g){return "<li>"+esc(g)+"</li>";}).join("")+'</ul>') : "")+
    fin+(gaps.length && fin? '</div>' : "")+
  '</div>';
}
function cvPanel(r){
  var sent=finalCount(r)>0 || r.stage==="applied" || r.stage==="offer" || r.stage==="closed";
  if(!sent) return packBlock(r);
  return '<div class="ivtab ivcards"><div class="ivsec">'+ivHead("Final versions","","")+finalBox(r,true,true)+'</div>'+
    (r.pack? '<div class="ivsec">'+ivHead("The tailored draft","","")+foldRow("cvdraft:"+r.id,"Show the draft CV and cover letter","",packBlock(r,true))+'</div>' : "")+'</div>';
}
function applyCard(r){
  var cs=convsShown(r), p=r.pack, ready=packReady(r);
  var why = ready? ('The CV is ready'+((p.cvChanges||[]).length? ' \u2014 '+p.cvChanges.length+' CV changes' : "")+
      ((p.gaps||[]).length? ', <b style="color:var(--warn);font-weight:500">'+p.gaps.length+' gap'+(p.gaps.length===1?"":"s")+' to check</b>' : "")+
      '. Download it, finish it with Claude in Word or in a chat, apply, upload what you sent, then mark it applied.')
    : 'The morning task builds the CV and cover letter as tracked changes. Ask Claude for it now if it cannot wait.';
  var summary=statusHead({label: ready? "Ready to apply" : "CV being built", cls: ready? "strong" : "mid", mine: ready, why:why,
      primary:[sbtn("prepapplied",r.id,"Mark applied","primary")],
      secondary:[sbtn("prepback",r.id,"Back to shortlist","ghost")],
      outcome:[sbtn("rejopen",r.id,"Reject","danger")],
      after:closeBlock(r,"g2")});
  var body=cardTabs(r, summary, [
    {k:"details", label:"Overview", html: overviewPanel(r)},
    {k:"fit", label:"Fit", html: fitTab(r)},
    {k:"cv", label:"CV", html: cvPanel(r)},
    {k:"company", label:"Company", html: researchPanel(r)},
    {k:"questions", label:"Questions", n: qCount(r)||"", html: questionsPanel(r)},
    {k:"prep", label:"Interviews", n: mtInterviewCount(r), html: interviewsPanel(r)},
    {k:"notes", label:"Notes", n: notesCount(r), html: notesPanel(r,coOf(r))}
  ], "details");
  var lead='';
  var quick='<span class="qacts">'+sbtn("prepapplied",r.id,"Mark applied","primary")+
    sbtn("prepback",r.id,"Back","",' title="Back to shortlist"')+sbtn("rejopen",r.id,"Reject","danger",' title="Opens the card to pick a reason"')+'</span>';
  return roleShell(r, null, lead, body, quick);
}

/* ---------- meetings on a role card ----------
   The diary is a fact; the status is a judgement. They are shown separately on purpose. Prep is a
   status button on the role, not a tick per meeting, so there is only ever one place to press it. */
function niceShort(str){
  var d=new Date(str+"T12:00:00Z"); if(isNaN(d)) return str;
  var wd=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
  var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return wd+" "+d.getUTCDate()+" "+mo;
}
function nextSessionOf(id){
  var t=today();
  return sessionsFor(id).filter(function(c){return c.state==="booked" && c.date && c.date>=t;})
    .sort(function(a,b){return String(a.date).localeCompare(String(b.date));})[0];
}
function nextLabel(c){ return niceShort(c.date)+(c.time? " \u00b7 "+c.time : ""); }
function dayGap(a,b){
  var x=Date.parse(a+"T12:00:00Z"), y=Date.parse(b+"T12:00:00Z");
  if(isNaN(x)||isNaN(y)) return null;
  return Math.round((y-x)/86400000);
}
