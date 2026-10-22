"use strict";
/* ---------- Meetings & tasks (1 Oct evening) ----------
   One record kind (a commitment) covers both. item = "meeting" (time, duration, people) or "task"
   (due date only). Each has one main "for" — a role, company, sector, person, a meeting (tasks only)
   or nothing — and a meeting can also tag roles so it shows on those role cards too.
   Interview stages are gone: an interview not yet booked is a role meeting with state "unplanned".
   Prep advice lives on the meeting itself, in c.prep (kind "screen" or "round"). */
var MT_MEET = {
  role:[["informal","Informal chat"],["screen","Recruiter screen"],["hm","Hiring manager interview"],["domain","Domain interview"],
        ["sense","Product sense / design interview"],["competency","Competency interview"],["culture","Culture / fit interview"],
        ["panel","Panel interview"],["livecase","Live case study"],["casepres","Case study presentation"],
        ["exec","Exec / founder chat"],["test","Test / assessment"],["ref","Reference / offer call"]],
  company:[["coffee","Coffee chat"],["info","Info interview"]],
  sector:[["event","Event / meetup"],["info","Info interview"]],
  person:[["recintro","Recruiter intro"],["recchk","Recruiter check-in"],["catchup","Catch-up"]],
  none:[["training","Training"],["mentoring","Mentoring"],["mock","Mock interview"],["other","Other"]]
};
var MT_TASK = [["prep","Prep"],["takehome","Take-home case study"],["onlinetest","Online test"],["pack","CV and cover letter"],
  ["followup","Follow-up / thank-you"],["chase","Chase"],["research","Research"],["practice","Practice / training"],["othertask","Other"]];
var MT_LABEL = {interview:"Interview", conversation:"Informal chat", "prep-session":"Prep session", task:"Task"};
(function(){ Object.keys(MT_MEET).forEach(function(k){ MT_MEET[k].forEach(function(o){ MT_LABEL[o[0]]=o[1]; }); });
  MT_TASK.forEach(function(o){ MT_LABEL[o[0]]=o[1]; }); })();
var MT_TASKTYPES = {task:1,"prep-session":1};
MT_TASK.forEach(function(o){ MT_TASKTYPES[o[0]]=1; });
/* Which practice interview each meeting type warms up for. */
var MT_MOCK = {screen:"screen", informal:"screen", hm:"pm", sense:"pm", panel:"pm", exec:"pm", interview:"pm",
  domain:"domain", competency:"culture", culture:"culture", livecase:"livecase", casepres:"takehome", mock:"pm"};
var MT_FORLAB = {role:"Role", company:"Company", sector:"Sector", person:"Person", meeting:"Meeting", none:"Nothing"};
var MT_DUR = [15,30,45,60,90,120];

function mtItem(c){ if(c.item) return c.item; if(c.state==="recurring") return "task"; return MT_TASKTYPES[c.type]? "task" : "meeting"; }
function mtType(c){ var t=c.type||"conversation"; return t==="conversation"? "informal" : t; }
function mtLabel(c){ return MT_LABEL[mtType(c)] || mtType(c); }
function mtFor(c){
  if(c.forKind) return {k:c.forKind, id:c.forId||""};
  if(c.roleId) return {k:"role", id:c.roleId};
  if(c.org){ var co=companies.find(function(x){ return slug(c.org)===x.id || String(x.name||"").toLowerCase()===String(c.org).toLowerCase(); });
    if(co) return {k:"company", id:co.id}; }
  return {k:"none", id:""};
}
function mtForName(k,id){
  if(!id) return "";
  if(k==="role"){ var r=roles.find(function(x){return x.id===id;}); return r? r.company+" — "+r.title : ""; }
  if(k==="company"){ var c=companies.find(function(x){return x.id===id;}); return c? c.name : ""; }
  if(k==="sector"){ var s=sectors.find(function(x){return x.id===id;}); return s? s.name : ""; }
  if(k==="person"){ var p=people.find(function(x){return x.id===id;}); return p? p.name : ""; }
  if(k==="meeting"){ var m=commitments.find(function(x){return x.id===id;}); return m? m.title : ""; }
  return "";
}
function mtPeople(c){
  var ids=c.personIds||[];
  var ps=ids.map(function(i){ return people.find(function(x){return x.id===i;}); }).filter(Boolean);
  return ps.length? ps.map(function(p){return p.name;}) : (c.person? [c.person] : []);
}
function mtNormTime(s){ s=String(s||"").trim().replace(".",":"); var m=s.match(/^(\d{1,2}):?(\d{2})$/); return m? ("0"+m[1]).slice(-2)+":"+m[2] : s; }
function mtTimes(){ var out=[]; for(var h=7;h<=20;h++){ for(var q=0;q<60;q+=15){ if(h===20&&q>0) break; out.push(("0"+h).slice(-2)+":"+("0"+q).slice(-2)); } } return out; }
function mtDurLab(n){ n=+n; if(!n) return ""; return n<60? n+" min" : (n%60? Math.floor(n/60)+"h "+(n%60)+"m" : (n/60)+(n===60?" hour":" hours")); }

/* Status for any item, the same words everywhere. */
function mtStatus(c){
  var t=today(), task=mtItem(c)==="task";
  if(c.state==="done") return [task? "Done" : "Done","strong"];
  if(c.state==="unplanned") return [task? "No date" : "Not planned",""];
  if(c.state==="offered") return ["Waiting","mid"];
  if(c.state==="conditional") return ["Pending",""];
  if(c.state==="recurring") return ["Repeating",""];
  if(c.date && c.date<t) return task? ["Overdue","weak"] : ["Not logged","weak"];
  return task? ["To do","mid"] : ["Booked","warm"];
}
function mtWhen(c){
  if(!c.date) return c.state==="offered"? "awaiting a date" : c.state==="conditional"? (c.blockedBy||"waiting") : "no date yet";
  var task=mtItem(c)==="task";
  return (task? "due " : "")+niceShort(c.date)+(c.time&&!task? " · "+c.time : "")+(c.duration&&!task? " · "+mtDurLab(c.duration) : "");
}
function mtPrepView(c){ var p=c.prep; if(!p) return null; return p.kind==="screen"? {sp:p} : {p:p}; }

/* ---------- which items belong where ---------- */
function mtRoleItems(rid){
  return commitments.filter(function(c){ if(c.state==="recurring") return false;
    var f=mtFor(c); return (f.k==="role" && f.id===rid) || c.roleId===rid || (c.tagRoles||[]).indexOf(rid)>=0; });
}
function mtIsStage(c,rid){ var f=mtFor(c); return mtItem(c)==="meeting" && f.k==="role" && f.id===rid && mtType(c)!=="informal"; }
function mtStages(r){
  var t=today();
  return mtRoleItems(r.id).filter(function(c){return mtIsStage(c,r.id);}).sort(mtSort);
}
/* Dated first, by date and time; then the undated in the order you set. */
function mtSort(a,b){
  var ad=a.date||"", bd=b.date||"";
  if(!!ad!==!!bd) return ad? -1 : 1;
  if(ad) return ad.localeCompare(bd) || String(a.time||"zz").localeCompare(String(b.time||"zz"));
  return (a.order||0)-(b.order||0) || String(a.createdAt||"").localeCompare(String(b.createdAt||""));
}
function mtTasksOfRole(rid){
  return commitments.filter(function(c){
    if(mtItem(c)!=="task" || c.state==="recurring") return false;
    var f=mtFor(c); if(f.k==="role" && f.id===rid) return true;
    if(f.k==="meeting"){ var m=commitments.find(function(x){return x.id===f.id;}); return !!(m && (m.roleId===rid || mtFor(m).id===rid)); }
    return false;
  }).sort(mtSort);
}

/* ---------- small renderers ---------- */
function mtBtn(act,cid,label,cls,extra){ return '<button type="button" class="btn '+(cls||"")+'" data-act="'+act+'" data-cid="'+esc(cid)+'"'+(extra||"")+'>'+esc(label)+'</button>'; }
/* A task as one tidy line: what, when, status, Done. */
/* Tasks on a role card are bordered rows like meetings and materials (2 Oct): title and status on
   top, type and due date below. A click opens the same pop-up as on Week ahead; the tick marks it done. */
function mtTaskBox(o){
  return '<div class="stage taskrow'+(o.done?" st-done":"")+(o.skip?" st-skip":"")+'" data-wkopen="'+esc(o.key)+'" data-cid="'+esc(o.cid)+'" role="button" tabindex="0" title="Open">'+
    '<div class="stsum">'+
      '<span class="stname">'+esc(o.title)+'</span>'+
      '<span class="spill sm '+o.cls+' ststat">'+esc(o.status)+'</span>'+
      '<span class="sttype"><span class="chip">'+esc(o.type)+'</span></span>'+
      '<span class="chip code stwhen">'+esc(o.when||"No date")+'</span>'+
      '<button type="button" class="tktick'+(o.done?" on":"")+'" data-act="'+o.act+'" data-cid="'+esc(o.cid)+'" data-id="'+esc(o.cid)+'" title="'+(o.done? "Mark not done" : "Mark done")+'" aria-label="'+(o.done? "Mark not done" : "Mark done")+'">✓</button>'+
    '</div></div>';
}
function mtTaskRow(c){
  var st=mtStatus(c), done=c.state==="done";
  return mtTaskBox({key:"wk-"+c.id, cid:c.id, title:c.title||mtLabel(c), status:st[0], cls:st[1], type:mtLabel(c),
    when: c.date? "due "+niceShort(c.date) : (c.state==="conditional"? "when it happens" : ""), done:done, skip:!!cmtClosedAs(c), act: done? "cmtundo" : "cmtdone"});
}
/* The derived prep for a booked meeting, shown as a task line. */
function mtPrepRow(c){
  var pd=prepDateOf(c); if(!pd) return "";
  var t=today(), carried=!c.prepDone && pd<t;
  return mtTaskBox({key:"wk-prep-"+c.id, cid:c.id, title:"Prep — "+(c.title||mtLabel(c)), status: c.prepDone?"Done":carried?"Overdue":"To do",
    cls: c.prepDone?"strong":carried?"weak":"mid", type:"Prep", when:"due "+niceShort(pd), done:!!c.prepDone, act: c.prepDone? "prepundo" : "prepdone"});
}
/* A meeting as a collapsed row: what it is and status on top, people and date below; inside, the
   actions, then notes, then the advice for it. Used on role, company, sector and people cards. */
var MTOPEN={};
function mtMeetRow(c,ctx){
  ctx=ctx||{};
  var key="mt~"+(ctx.scope||"")+"~"+c.id, open=!!MTOPEN[key];
  var st=mtStatus(c), ps=mtPeople(c), mock=MT_MOCK[mtType(c)] || (c.prep&&(c.prep.type||(c.prep.mock&&c.prep.mock.type)));
  var rid=c.roleId||(mtFor(c).k==="role"? mtFor(c).id : "");
  /* Action bar, tidied (2 Oct): quiet actions left, the one that matters now on the right —
     Practise before an interview, Mark done once it has happened, Book it while it is pending. */
  var t0=today(), past = c.state==="booked" && c.date && c.date<t0;
  var quiet=[mtBtn("mt_edit",c.id,"Edit","ghost edbtn")], main=[];
  if(ctx.reorder && !c.date){ quiet.push(mtBtn("mt_up",c.id,"\u2191","ghost",' aria-label="Move up" data-scope="'+esc(ctx.reorder)+'"'));
    quiet.push(mtBtn("mt_down",c.id,"\u2193","ghost",' aria-label="Move down" data-scope="'+esc(ctx.reorder)+'"')); }
  quiet.push(mtBtn("sessdel",c.id,"Remove","ghost"));
  var prac = (mock && rid && c.state!=="done" && c.state!=="cancelled")? '<button class="btn'+(past? "" : " primary")+'" data-act="mockfrom" data-id="'+esc(rid)+'" data-cid="'+esc(c.id)+'">Practise</button>' : "";
  if(c.state==="unplanned"||c.state==="offered"||c.state==="conditional") main.push(prac, mtBtn("mt_book",c.id,"Book it","primary"));
  /* Cancelled (12 Oct, js/43): kept greyed, with Reopen. */
  if(c.state==="booked") quiet.push(mtBtn("cmtcancel",c.id,"Cancelled","ghost",' title="It didn\u2019t happen. Keeps it instead of removing it."'));
  if(c.state==="cancelled") main.push(mtBtn("cmtreopen",c.id,"Reopen",""));
  else if(c.state==="booked") main.push(prac, '<button class="btn'+(past||!prac? " primary" : "")+'" data-act="sessdone" data-id="'+esc(rid)+'" data-cid="'+esc(c.id)+'">Mark done</button>');
  /* A done meeting has nothing pressing; undoing a mistaken Done is the toast's job (2 Oct). */
  var acts='<div class="mtbar"><div class="mtq">'+quiet.join("")+'</div><div class="mtp">'+main.join("")+'</div></div>';
  /* Notes as a section with its action in the header, as in the pop-up (2 Oct). */
  var ns=notesOfMeeting(c), ahead = c.state==="booked" && c.date && c.date>t0;
  var notes='<div class="wkp-sec mtnotes"><div class="wkp-sh"><span class="wkp-st">Meeting notes</span>'+(ns.length? '<span class="pbn">'+ns.length+'</span>' : "")+
    (ns.length? "" : '<span class="secacts">'+logBtn(rid,"","+ Add notes","",c.id)+'</span>')+'</div>'+
    (ns.length? ns.map(function(v){return convEntry(v,false);}).join("") : '<p class="emptyline">'+(ahead? "Nothing yet. Add notes after the meeting." : "No notes yet.")+'</p>')+'</div>';
  var pv=mtPrepView(c), adv="";
  if(ctx.advice){
    adv='<div class="stsec">'+secHead("Advice for this one","mprep",c.id)+
      (pv? roundBody({id:rid},pv)+((c.prep.builtAt)? '<div class="statushint">Built '+esc(niceShort(c.prep.builtAt))+'.</div>' : "")
         : '<p class="lede" style="margin:0;font-size:12.5px">No advice yet — Edit to add it, or ask Claude to prep it.</p>')+'</div>';
  }
  var tagged = !ctx.roleId || mtFor(c).id===ctx.roleId ? "" : mtFor(c).k==="company"? '<span class="chip code">company</span>' : '<span class="chip code">tagged</span>';
  /* On a person's own card, don't repeat their name (2 Oct): drop it from the title and the
     people chip; a title that was only their name becomes the meeting type and organisation. */
  var title=c.title||mtLabel(c);
  if(ctx.personId){
    var pp=people.find(function(x){return x.id===ctx.personId;}), pn=pp? String(pp.name||"") : "";
    if(pn){
      ps=ps.filter(function(n){ return String(n).toLowerCase()!==pn.toLowerCase(); });
      var t2=String(title).replace(new RegExp("\\s*[—–-]?\\s*"+pn.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*[—–-]?\\s*","i")," ").replace(/\s+/g," ").trim();
      title = (t2 && t2.toLowerCase()!==pn.toLowerCase())? t2 : (mtLabel(c)+(c.org? " · "+c.org : ""));
    }
  }
  return '<details class="stage mt st-'+esc(st[0].toLowerCase().replace(/ /g,""))+'" data-mtk="'+esc(key)+'"'+(open?" open":"")+'>'+
    '<summary class="stsum">'+
      '<span class="stname" title="'+esc(c.title||"")+'">'+esc(ctx.short? mtLabel(c) : title)+'</span>'+
      '<span class="spill '+st[1]+' ststat">'+esc(st[0])+'</span>'+
      '<span class="sttype">'+(ps.length? '<span class="chip">'+esc(ps.join(", "))+'</span>' : (ctx.short||ctx.personId? "" : '<span class="chip">'+esc(mtLabel(c))+'</span>'))+tagged+'</span>'+
      '<span class="chip code stwhen">'+esc(mtWhen(c))+'</span>'+
    '</summary>'+
    '<div class="stbody">'+
      acts+
      (c.detail? '<div class="wkfacts">'+wkField("Details",esc(c.detail))+'</div>' : "")+
      notes+adv+
    '</div></details>';
}
document.addEventListener("toggle",function(ev){
  var d=ev.target; if(d && d.dataset && d.dataset.mtk) MTOPEN[d.dataset.mtk]=d.open;
},true);

/* ---------- the Interviews tab on a role card ---------- */
/* ---------- shared section pieces (1 Oct, night): the four style rules ----------
   1 empty states are plain lines; tinted boxes only for what needs you. 2 a section's actions sit in its
   header, on the right. 3 anything that opens is a bordered row with a chevron. 4 static rows aren't boxes. */
function ivHead(title,meta,acts){
  return '<div class="sechead ivhead"><span class="eyebrow">'+esc(title)+'</span>'+(meta||"")+
    (acts? '<span class="secacts">'+acts+'</span>' : "")+'</div>';
}
function foldRow(key,title,meta,body){
  return '<details class="stage fold" data-mtk="'+esc(key)+'"'+(MTOPEN[key]?" open":"")+'><summary class="stsum">'+
    '<span class="stname">'+esc(title)+'</span>'+(meta!=null && meta!==""? '<span class="spill sm ststat">'+meta+'</span>' : "")+
    '</summary><div class="stbody">'+body+'</div></details>';
}
function noteBtn(kind,id){ return '<button type="button" class="btn sm" data-act="note_open" data-kind="'+kind+'" data-id="'+esc(id)+'">+ Add a note</button>'; }
/* Each note can be edited (2 Oct: adding one was a dead end); removing it lives in the edit form,
   as with meeting notes. act is the old delete action, which also names the kind: role_ / co_ / sec_. */
function noteList(ns,act,id){
  var kind = act? act.split("_")[0] : "";
  return ns.length? '<ul class="notelist">'+ns.map(function(nt,i){
      return '<li><div class="nlt">'+esc(nt.text)+'</div><span class="nld">'+esc(nt.at? niceShort(nt.at) : "")+'</span>'+
        (kind? '<button type="button" class="btn ghost sm" data-act="note_edit" data-kind="'+kind+'" data-id="'+esc(id)+'" data-i="'+i+'">Edit</button>' : "")+'</li>'; }).join("")+'</ul>'
    : '<p class="emptyline">Nothing yet.</p>';
}
function interviewsPanel(r){
  /* Rebuilt 1 Oct, night : four sections with the same header pattern, each action in its own
     header; empty states are plain lines, not boxes; anything bordered opens. Order (1 Oct, night):
     Interviews, Tasks, Prep materials, Advice across the process, then other notes. */
  var st=mtStages(r), all=mtRoleItems(r.id).filter(function(c){return mtItem(c)==="meeting";});
  var other=all.filter(function(c){return st.indexOf(c)<0;}).sort(mtSort);
  var tasks=mtTasksOfRole(r.id), done=st.filter(function(c){return c.state==="done";});
  var preps=all.filter(function(c){return c.state==="booked" && prepDateOf(c);});
  var g=r.interviewGeneral||{}, pw=(PROFILE&&PROFILE.watchOuts)||[];
  var gHas=(g.themes||[]).length||(g.stories||[]).length||(g.avoid||[]).length||(g.askThem||[]).length||g.notes;
  var co=coOf(r), ii=co&&co.interviewIntel;
  var head=ivHead;
  function addBtn(item,label,cls,extra){
    return '<button type="button" class="btn sm '+(cls||"")+'" data-act="mt_add" data-item="'+item+'" data-fk="role" data-fid="'+esc(r.id)+'"'+(extra||"")+'>'+label+'</button>';
  }
  function row(c){ return mtMeetRow(c,{scope:r.id, advice:true, reorder:r.id, roleId:r.id}); }

  /* 1. Interviews */
  var fold=done.length>2, live=fold? st.filter(function(c){return c.state!=="done";}) : st;
  var iv='<div class="ivsec">'+
    head("Interviews",'<span class="secmeta">'+done.length+' of '+st.length+' done</span>',
      /* Schedule and Log a conversation are the card's own actions (2 Oct); only closed roles,
         which have none, keep a button here. */
      (typeof CARD_ACT_ST!=="undefined" && CARD_ACT_ST[r.stage]? "" : addBtn("meeting","+ Schedule interview","",' data-type="screen"')))+
    (ii&&(ii.stages||[]).length? '<p class="secintro">Their usual process: '+esc(ii.stages.join(" → "))+'</p>' : "")+
    (st.length
      ? (live.length? '<div class="stages">'+live.map(row).join("")+'</div>' : "")+
        (fold? '<details class="stage donefold"'+(MTOPEN["done~"+r.id]?" open":"")+' data-mtk="done~'+esc(r.id)+'"><summary class="stsum"><span class="stname">Done</span><span class="spill strong ststat">'+done.length+'</span></summary>'+
          '<div class="stbody"><div class="stages">'+done.map(row).join("")+'</div></div></details>' : "")
      : '<p class="emptyline">None yet. Add each interview as you hear about it. With no date it shows as Not planned until it’s booked.'+
          ((typeof CARD_ACT_ST!=="undefined" && CARD_ACT_ST[r.stage])? ' <button type="button" class="linkbtn" data-act="mt_add" data-item="meeting" data-type="screen" data-fk="role" data-fid="'+esc(r.id)+'">Add an interview</button>' : "")+'</p>')+

  '</div>';

  /* 2. Prep materials */
  var ms=maForRole(r), unread=ms.filter(function(m){return !m.digest;}).length;
  var pm=maBlock("role",r.id,ms);

  /* 3. Advice across the process */
  var adv='<div class="ivsec">'+secHead("Advice across the process","general",r.id)+
    (gHas? '<div class="cols advice">'+listSec("Themes to land every time",g.themes)+listSec("Stories to reuse",g.stories)+
        listSec("Avoid in every round",g.avoid,"avoid")+listSec("Keep asking",g.askThem)+'</div>'+para("Notes",g.notes)
      : '<p class="emptyline">Nothing yet. The morning run writes it with the first round prep.</p>'+
        (pw.length? listSec("From your profile: watch-outs for every interview",pw,"avoid") : ""))+
  '</div>';

  /* 4. Tasks */
  var dl=mtDeadlinesOf(r);
  var raLive=(typeof CARD_ACT_ST!=="undefined" && CARD_ACT_ST[r.stage]);
  var tk='<div class="ivsec">'+head("Tasks for this role","",raLive? "" : addBtn("task","+ Task",""))+
    ((tasks.length||preps.length||dl.length)? '<div class="mtrows tasklist">'+preps.map(mtPrepRow).join("")+tasks.map(mtTaskRow).join("")+dl.map(mtDeadlineRow).join("")+'</div>'
      : '<p class="emptyline">None yet.'+(raLive? ' <button type="button" class="linkbtn" data-act="mt_add" data-item="task" data-fk="role" data-fid="'+esc(r.id)+'">Add a task</button>' : "")+'</p>')+
  '</div>';

  /* 2. Conversations (2 Oct): every non-interview meeting for this role and for its company — a chat
     with a contact at the company is filed on the company, so it never showed here and its notes looked
     loose. Each is a meeting row with its notes inside; notes with no meeting at all close the section. */
  var cid=coIdOfRole(r), seen={};
  var conv=other.concat(cid? mtItemsFor("company",cid).filter(function(c){ return mtItem(c)==="meeting"; }) : [])
    .filter(function(c){ if(seen[c.id]) return false; seen[c.id]=1; return true; })
    .sort(function(a,b){ return mtSort(b,a); });
  var cs=convsShown(r), used={}; all.concat(conv).forEach(function(c){ notesOfMeeting(c).forEach(function(v){used[v.id]=1;}); });
  var loose=cs.filter(function(v){ return !used[v.id] && !(v.meetingId && commitments.some(function(c){return c.id===v.meetingId;})); });
  var on=(conv.length||loose.length)? '<div class="ivsec">'+head("Conversations",'<span class="secmeta">'+(conv.length+loose.length)+'</span>',"")+
      (conv.length? '<div class="stages">'+conv.map(function(c){return mtMeetRow(c,{scope:r.id, roleId:r.id});}).join("")+'</div>' : "")+
      (loose.length? '<p class="secsub">Notes without a meeting</p>'+loose.map(function(v){return convEntry(v);}).join("") : "")+'</div>' : "";

  return '<div class="ivtab ivcards">'+iv+on+tk+pm+adv+'</div>';   /* each section a full-width card (1 Oct, night) */
}
function mtInterviewCount(r){ return mtRoleItems(r.id).length || ""; }

/* ---------- company, sector and people cards ---------- */
function mtItemsFor(fk,fid,extraRoleIds){
  extraRoleIds=extraRoleIds||[];
  return commitments.filter(function(c){
    if(c.state==="recurring") return false;
    var f=mtFor(c);
    if(f.k===fk && f.id===fid) return true;
    if(fk==="person" && (c.personIds||[]).indexOf(fid)>=0) return true;
    if(fk==="person" && !(c.personIds||[]).length){ var p=people.find(function(x){return x.id===fid;}); var pn=p && String(p.name||"").toLowerCase();
      if(pn && (String(c.person||"").toLowerCase()===pn || String(c.title||"").toLowerCase().indexOf(pn)>=0)) return true; }
    if(extraRoleIds.length && (extraRoleIds.indexOf(c.roleId)>=0 || (c.tagRoles||[]).some(function(x){return extraRoleIds.indexOf(x)>=0;}))) return true;
    return false;
  });
}
function mtBlock(fk,fid,extraRoleIds){
  var its=mtItemsFor(fk,fid,extraRoleIds), used={};
  var ms=its.filter(function(c){return mtItem(c)==="meeting";}).sort(function(a,b){ return mtSort(b,a); });
  var ts=its.filter(function(c){return mtItem(c)==="task";}).sort(mtSort);
  ms.forEach(function(c){ notesOfMeeting(c).forEach(function(v){used[v.id]=1;}); });
  function add(item,label,cls){ return '<button type="button" class="btn sm '+(cls||"")+'" data-act="mt_add" data-item="'+item+'" data-fk="'+esc(fk)+'" data-fid="'+esc(fid||"")+'">'+label+'</button>'; }
  var log = fk==="company"? '<button type="button" class="btn sm" data-act="logjump" data-id="" data-co="'+esc(fid)+'" data-sec="">Log a conversation</button>'
          : fk==="sector"? '<button type="button" class="btn sm" data-act="logjump" data-id="" data-co="" data-sec="'+esc(fid)+'">Log a conversation</button>' : "";
  var html='<div class="ivsec">'+ivHead("Meetings","",add("meeting","+ Meeting","primary")+log)+
      (ms.length? '<div class="stages">'+ms.map(function(c){return mtMeetRow(c,{scope:fk+fid, personId: fk==="person"? fid : ""});}).join("")+'</div>' : '<p class="emptyline">None yet.</p>')+'</div>'+
    '<div class="ivsec">'+ivHead("Tasks","",add("task","+ Task",""))+
      (ts.length? '<div class="mtrows tasklist">'+ts.map(mtTaskRow).join("")+'</div>' : '<p class="emptyline">None yet.</p>')+'</div>'+
    (fk==="company"? maBlock("company",fid,maForCompany(fid)) : "");
  return {html:html, used:used, n:its.length};
}

/* ---------- automatic deadlines: closing dates and offer decisions ---------- */
function mtDeadlinesOf(r){
  var out=[];
  if(r.closing && /^\d{4}-\d{2}-\d{2}$/.test(r.closing) && (r.stage==="prep"||r.stage==="consideration"))
    out.push({id:"close-"+r.id, roleId:r.id, date:r.closing, title:"Apply by — "+r.company, sub:"Closing date · "+r.title});
  var od=r.offer&&r.offer.deadline;
  if(od && r.stage==="offer") out.push({id:"offer-"+r.id, roleId:r.id, date:od, title:"Decide on the offer — "+r.company, sub:"Offer decision deadline · "+r.title});
  return out;
}
function mtDeadlines(){ var out=[]; roles.forEach(function(r){ out=out.concat(mtDeadlinesOf(r)); }); return out; }
function mtDeadlineRow(d){
  var late=d.date<today();
  if(d.roleId) return mtTaskBox({key:"wk-"+d.id, cid:"", title:d.title, status: late? "Passed" : "Deadline", cls: late? "weak" : "mid", type:"Deadline", when:niceShort(d.date), done:false, act:""}).replace(/<button type="button" class="tktick[\s\S]*?<\/button>/,"");
  return '<div class="mtrow"><div class="mtrow-main"><span class="mtrow-t">'+esc(d.title)+'</span><span class="mtrow-s">'+esc(d.sub)+' · '+esc(niceShort(d.date))+'</span></div>'+
    '<span class="spill sm '+(late?"weak":"mid")+'">'+(late?"Passed":"Deadline")+'</span><span class="mtrow-a"></span></div>';
}
function mtDeadlineCard(d){
  var late=d.date<today();
  return wkCard({key:d.id, title:d.title, rail:"r-task", cat:"task", sub:d.sub, status: late? "Passed" : "Deadline", cls: late? "weak" : "mid",
    body: wkDetail(["Set automatically from the role. Change the date on the role card."], ""), primary:[], secondary:[], quick:[]});
}

/* ---------- the form ---------- */
var MT=null;
function mtBlank(o){
  return {cid:"", item:o.item||"meeting", forK:o.fk||"none", forId:o.fid||"", type:"", title:"", titleTouched:false,
    when:"booked", date:"", time:"", dur:"", people:[], newPeople:[], tags:[], detail:"",
    prep:true, prepDate:"", every:"week", days:[], mday:"", start:"", end:"", window:"", sentAt:today(), chaseBy:addDays(today(),CHASE_DAYS), cond:"", blocked:"", court:"them", np:null, err:"",
    trole: o.fk==="role"? (o.fid||"") : "", tev:""};
}
function mtFromDoc(c){
  var f=mtFor(c), m=mtBlank({item:mtItem(c), fk:f.k, fid:f.id});
  m.cid=c.id; m.type=mtType(c); if(m.type==="interview") m.type="";   /* old generic interview: pick a real type */
  if(m.item==="task" && !MT_TASKTYPES[m.type]) m.type="othertask";
  if(m.type==="task") m.type="othertask"; if(m.type==="prep-session") m.type="prep";
  m.title=c.title||""; m.titleTouched=true; m.keepType=m.type;
  var tg=c.trigger||{}; m.trole=tg.roleId||c.roleId||""; m.tev=tg.ev||""; m.legacyUndated = m.item==="task" && c.state==="unplanned";
  m.when = c.state==="unplanned"? "unplanned" : c.state==="offered"? "offered" : c.state==="conditional"? "conditional" : "booked";
  m.done = c.state==="done";
  m.date=c.date||""; m.time=mtNormTime(c.time); m.dur=c.duration? String(c.duration) : "";
  m.people=(c.personIds||[]).slice(); m.legacyPerson=(!m.people.length && c.person)? c.person : "";
  if(m.item==="meeting" && m.forK==="person" && m.forId){ m.people=m.people.filter(function(x){return x!==m.forId;}); m.people.unshift(m.forId); }   /* For = the first under With (13 Oct) */
  m.tags=(c.tagRoles||[]).slice(); m.detail=c.detail||"";
  var lead=prepLeadOf(c); m.prep = lead>0; m.prepDate = c.date && lead>0? (c.prepOn||addDays(c.date,-lead)) : ""; m.prepManual=!!c.prepOn;
  m.window=c.windowText||""; m.sentAt=c.sentAt||today(); m.chaseBy=c.chaseBy||addDays(today(),CHASE_DAYS);
  m.cond=c.condition||""; m.blocked=c.blockedBy||""; m.court=c.court||"them";
  if(c.state==="recurring"){ m.when="recurring"; m.every=c.repeatEvery||"week"; m.days=(c.repeatDays||[]).slice();
    m.mday=c.repeatDate? String(c.repeatDate) : ""; m.start=c.startsOn||""; m.end=c.endsOn||""; }
  return m;
}
function mtTypeOpts(m){
  var o = m.item==="task"? MT_TASK : (MT_MEET[m.forK]||MT_MEET.none);
  /* An existing item keeps its own type even if it is not usual for its "for" (an informal chat with a recruiter, say). */
  if(m.keepType && MT_LABEL[m.keepType] && !o.some(function(x){return x[0]===m.keepType;})) o=o.concat([[m.keepType,MT_LABEL[m.keepType]]]);
  return o;
}
function mtForChoices(m){ return m.item==="task"? ["role","company","sector","person","meeting","none"] : ["role","company","sector","person","none"]; }
/* Closed and rejected roles are left out of the pickers; `keep` (the item's current role) stays listed so an old item still shows its role. */
function mtTargets(k,keep){
  if(k==="role") return roles.filter(function(r){return (keep && r.id===keep) || !/rejected|closed/.test(r.stage||"");})
    .sort(function(a,b){return String(a.company).localeCompare(String(b.company));})
    .map(function(r){return [r.id, r.company+" — "+r.title+(r.stage==="closed"?" (closed)":"")];});
  if(k==="company") return companies.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).map(function(c){return [c.id,c.name||c.id];});
  if(k==="sector") return sectors.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).map(function(s){return [s.id,s.name||s.id];});
  if(k==="person") return people.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).map(function(p){return [p.id,p.name+(ppCo(p)?" — "+ppCo(p):"")];});
  if(k==="meeting") return commitments.filter(function(c){return mtItem(c)==="meeting" && c.state!=="done";}).sort(mtSort)
    .map(function(c){return [c.id,(c.title||mtLabel(c))+(c.date?" · "+niceShort(c.date):" · not planned")];});
  return [];
}
function mtCompanyOf(m){
  if(m.forK==="company") return m.forId;
  if(m.forK==="role"){ var r=rawRoles.find(function(x){return x.id===m.forId;}); return r? coIdOfRole(r) : ""; }
  if(m.forK==="person"){ var p=people.find(function(x){return x.id===m.forId;}); return p? p.companyId||"" : ""; }
  if(m.forK==="meeting"){ var c=commitments.find(function(x){return x.id===m.forId;}); var f=c? mtFor(c) : null;
    if(f && f.k==="company") return f.id; if(f && f.k==="role"){ var rr=rawRoles.find(function(x){return x.id===f.id;}); return rr? coIdOfRole(rr) : ""; } }
  return "";
}
function mtAutoTitle(m){
  var lab=MT_LABEL[m.type]||"", who=mtForName(m.forK,m.forId);
  if(!who && m.forK==="person"){ var npw=m.newPeople.find(function(x){return x.tmp===m.forId;}); if(npw) who=npw.name; }
  if(m.forK==="role"){ var r=roles.find(function(x){return x.id===m.forId;}); who=r? r.company : ""; }
  if(m.forK==="meeting"){ return lab+(who? " — "+who : ""); }
  return [who,lab].filter(Boolean).join(" — ");
}
function mtSel(id,opts,cur,blank){
  return '<select id="'+id+'" data-mt="'+id.replace("mt-","")+'">'+(blank!=null? '<option value="">'+esc(blank)+'</option>' : "")+
    opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(cur)?" selected":"")+'>'+esc(o[1])+'</option>'; }).join("")+'</select>';
}
function mtSeg(name,opts,cur){
  return '<div class="mtseg" role="radiogroup">'+opts.map(function(o){
    return '<button type="button" class="pill" data-mtseg="'+name+'" data-v="'+esc(o[0])+'" aria-pressed="'+(o[0]===cur)+'">'+esc(o[1])+'</button>'; }).join("")+'</div>';
}
/* A meeting for a person is for whoever is first under With (13 Oct): no separate person picker. */
function mtSyncFor(m){ if(m && m.item==="meeting" && m.forK==="person") m.forId=m.people[0]||""; }
function mtPaint(){
  var m=MT, task=m.item==="task", body="";
  mtSyncFor(m);
  if(!m.type || !mtTypeOpts(m).some(function(o){return o[0]===m.type;})) m.type=mtTypeOpts(m)[0][0];
  if(!m.titleTouched) m.title=mtAutoTitle(m);
  el("mt-head").textContent=(m.cid? "Edit " : "Add a ")+(task? "task" : "meeting");
  body+= m.cid? "" : mtSeg("item",[["meeting","Meeting"],["task","Task"]],m.item);
  body+='<div class="mtfld"><span class="mtlab">For</span>'+mtSeg("forK",mtForChoices(m).map(function(k){return [k,MT_FORLAB[k]];}),m.forK)+
    (m.forK==="person" && !task? '<span class="statushint" style="margin:0">'+(m.forId? "For "+esc(mtForName("person",m.forId)||((m.newPeople.find(function(x){return x.tmp===m.forId;})||{}).name)||"")+", the first person under With" : "Add who it’s with under With — the first person is who it’s for")+'</span>'
    : m.forK!=="none"? mtSel("mt-forId",mtTargets(m.forK,m.forId).concat(m.forK==="person"? m.newPeople.map(function(p){return [p.tmp,p.name+" — new"];}) : []),m.forId,"Choose…") : "")+'</div>';
  body+='<div class="mtgrid">'+
    '<label class="fld">Type'+mtSel("mt-type",mtTypeOpts(m),m.type)+'</label>'+
    '<label class="fld">Title<input id="mt-title" data-mt="title" value="'+esc(m.title)+'"></label></div>';
  /* When */
  /* Every task has a date or a trigger (2 Oct): "No date yet" is offered only on an old undated task. */
  var whens = task? [["booked","Due date"],["conditional","When something happens"],["recurring","Repeats"]].concat(m.legacyUndated? [["unplanned","No date (old)"]] : [])
    : [["booked","Booked"],["unplanned","Not planned yet"],["offered","Waiting on their reply"],["conditional","Waiting on an event"],["recurring","Repeats"]];
  if(!whens.some(function(w){return w[0]===m.when;})) m.when="booked";
  body+='<div class="mtfld"><span class="mtlab">When</span>'+mtSeg("when",whens,m.when)+'</div>';
  if(m.when==="booked"){
    var tms=mtTimes(); if(m.time && tms.indexOf(m.time)<0) tms.push(m.time);
    body+='<div class="mtgrid">'+
      '<label class="fld">'+(task?"Due":"Date")+'<input type="date" id="mt-date" data-mt="date" value="'+esc(m.date)+'"></label>'+
      (task? "" : '<label class="fld">Time'+mtSel("mt-time",tms.map(function(x){return [x,x];}),m.time,"—")+'</label>'+
        '<label class="fld">Duration'+mtSel("mt-dur",MT_DUR.map(function(n){return [String(n),mtDurLab(n)];}),m.dur,"—")+'</label>')+
    '</div>';
  } else if(m.when==="recurring"){
    body+=mtRepeatFields(m,task);
  } else if(m.when==="offered"){
    body+='<div class="mtgrid">'+
      '<label class="fld">Window offered<input id="mt-window" data-mt="window" value="'+esc(m.window)+'" placeholder="Thursday or Friday"></label>'+
      '<label class="fld">Message sent<input type="date" id="mt-sentAt" data-mt="sentAt" value="'+esc(m.sentAt)+'"></label>'+
      '<label class="fld">Chase by<input type="date" id="mt-chaseBy" data-mt="chaseBy" value="'+esc(m.chaseBy)+'"></label></div>';
  } else if(m.when==="conditional"){
    /* A trigger the board can see (2 Oct): a role reaching a point. It comes back to you by itself when that
       happens, and closes itself if the role closes first. Meetings can still wait on something described in words. */
    body+='<div class="mtgrid">'+
      '<label class="fld">When this role'+mtSel("mt-trole",mtTargets("role").filter(function(o){ var r=roles.find(function(x){return x.id===o[0];}); return r && !TRIG_DEAD[r.stage]; }),m.trole,task? "Choose a role…" : "Not about a role")+'</label>'+
      (m.trole? '<label class="fld">Reaches'+mtSel("mt-tev",TRIG_EVS,m.tev,"Choose…")+'</label>' : "")+'</div>'+
      (!m.trole && !task? '<div class="mtgrid">'+
        '<label class="fld">Or waiting on<input id="mt-cond" data-mt="cond" value="'+esc(m.cond)+'" placeholder="their budget being signed off"></label>'+
        '<label class="fld">In two or three words<input id="mt-blocked" data-mt="blocked" value="'+esc(m.blocked)+'" placeholder="Budget"></label></div>' : "")+
      '<p class="statushint" style="margin:0">'+(m.trole? "It comes back to you when that happens"+(task? ", dated that day" : ", ready to book")+". If the role closes first, it closes too and tells you." : "The board can't see this happen, so check it at your weekly review.")+'</p>';
  }
  /* People — meetings only */
  if(!task){
    var chosen=m.people.map(function(pid){
      var p=people.find(function(x){return x.id===pid;}) || m.newPeople.find(function(x){return x.tmp===pid;});
      return p? '<span class="mtchip">'+esc(p.name)+(p.role? ' <span class="mtchip-r">'+esc(p.role)+'</span>' : "")+
        '<button type="button" data-mtrm="'+esc(pid)+'" aria-label="Remove '+esc(p.name)+'">×</button></span>' : ""; }).join("");
    if(m.legacyPerson) chosen+='<span class="mtchip">'+esc(m.legacyPerson)+' <span class="mtchip-r">not on People yet</span><button type="button" data-mtrm="__legacy" aria-label="Remove">×</button></span>';
    var coId=mtCompanyOf(m), avail=people.filter(function(p){return m.people.indexOf(p.id)<0;});
    var here=avail.filter(function(p){return coId && p.companyId===coId;}), rest=avail.filter(function(p){return here.indexOf(p)<0;});
    function og(lab,list){ return list.length? '<optgroup label="'+esc(lab)+'">'+list.sort(function(a,b){return String(a.name).localeCompare(String(b.name));})
      .map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name+(p.role?" — "+p.role:"")+(ppCo(p)&&!here.length?" · "+ppCo(p):""))+'</option>';}).join("")+'</optgroup>' : ""; }
    body+='<div class="mtfld"><span class="mtlab">With</span><div class="mtchips">'+(chosen||'<span class="lede" style="font-size:12.5px">Nobody yet</span>')+'</div>'+
      '<select id="mt-addp" data-mt="addp"><option value="">Add a person…</option><option value="__new">+ New person</option>'+
        og("At "+(mtForName("company",coId)||"this company"),here)+og(here.length?"Everyone else":"People",rest)+'</select>';
    if(m.np){
      var rolesKnown={}; people.forEach(function(p){ if(p.role) rolesKnown[p.role]=1; }); m.newPeople.forEach(function(p){ if(p.role) rolesKnown[p.role]=1; });
      ["Recruiter","Talent partner","Hiring manager","Head of Product","Product Director","Engineering manager","Panel member"].forEach(function(x){rolesKnown[x]=1;});
      body+='<div class="mtnp"><div class="mtgrid">'+
        '<label class="fld">Name<input id="mt-npname" data-mt="npname" value="'+esc(m.np.name||"")+'"></label>'+
        /* A pick list with "+ New role…" (6 Oct): the old type-ahead hid that a new role could be typed. */
        '<label class="fld">Their role<select id="mt-nprolesel" data-mt="nprolesel"><option value="">Pick a role…</option>'+
          Object.keys(rolesKnown).sort().map(function(x){return '<option value="'+esc(x)+'"'+(!m.np.roleNew && m.np.role===x?" selected":"")+'>'+esc(x)+'</option>';}).join("")+
          '<option value="__new"'+(m.np.roleNew?" selected":"")+'>+ New role…</option></select>'+
          (m.np.roleNew? '<input id="mt-nprole" data-mt="nprole" value="'+esc(m.np.role||"")+'" placeholder="Type the new role" style="margin-top:6px">' : "")+'</label>'+
        '<label class="fld">How you know them'+mtSel("mt-nphow",PP_HOW,m.np.how||"")+'</label>'+
        /* Company (13 Oct): defaults to the meeting's company; another on the board, none, or one typed in. */
        '<label class="fld">Company<select id="mt-npco" data-mt="npcosel"><option value="">No company</option>'+
          companies.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).map(function(c){return '<option value="'+esc(c.id)+'"'+(!m.np.coOther && m.np.co===c.id?" selected":"")+'>'+esc(c.name||c.id)+'</option>';}).join("")+
          '<option value="__other"'+(m.np.coOther?" selected":"")+'>+ Not on the board…</option></select>'+
          (m.np.coOther? '<input id="mt-npcotext" data-mt="npcotext" value="'+esc(m.np.coText||"")+'" placeholder="Type the company" style="margin-top:6px">' : "")+'</label></div>'+
        '<div class="row"><button type="button" class="btn primary" data-mtnp="add">Add them</button><button type="button" class="btn ghost" data-mtnp="cancel">Cancel</button>'+
        '<span class="statushint">They’re added to People when you save.</span></div></div>';
    }
    body+='</div>';
    if(m.forK!=="role"){
      var tagOpts=mtTargets("role").filter(function(o){return m.tags.indexOf(o[0])<0;});
      body+='<div class="mtfld"><span class="mtlab">Also show on roles</span><div class="mtchips">'+
        m.tags.map(function(rid){ return '<span class="mtchip">'+esc(mtForName("role",rid)||rid)+'<button type="button" data-mttag="'+esc(rid)+'" aria-label="Remove">×</button></span>'; }).join("")+'</div>'+
        mtSel("mt-addtag",tagOpts,"","Tag a role…")+'</div>';
    }
  }
  body+='<label class="fld">Detail — one line<input id="mt-detail" data-mt="detail" value="'+esc(m.detail)+'"></label>';
  if(!task && m.when==="booked" && m.date){
    if(!m.prepDate) m.prepDate=prevBiz(m.date);
    body+='<div class="mtfld mtprep"><label class="mtcheck"><input type="checkbox" id="mt-prep" data-mt="prep"'+(m.prep?" checked":"")+'> Add a prep task</label>'+
      (m.prep? '<label class="fld" style="max-width:220px">Prep by<input type="date" id="mt-prepDate" data-mt="prepDate" value="'+esc(m.prepDate)+'" max="'+esc(m.date)+'"></label>' : "")+
      (m.prep? '<span class="wkfaint" style="align-self:end">'+(m.prepManual? "Set by you: stays put if the meeting moves." : "Follows the meeting if it moves.")+'</span>' : "")+'</div>';
  }
  if(!task && m.forK==="role" && m.forId && MT_MOCK[m.type] && m.type!=="informal"){
    var rr0=roles.find(function(x){return x.id===m.forId;});
    if(rr0 && (rr0.stage==="applied"||rr0.stage==="offer")) body+='<p class="statushint" style="margin:0">Advice for this interview arrives with tomorrow morning\u2019s run. Want it now? Ask Claude to \u201cprep the interview for #'+esc(rr0.ref||"")+'\u201d.</p>';
  }
  if(!m.cid && m.forK==="role" && !task){ var dup=mtUnplannedTwin(m); if(dup) body+='<p class="notice" style="margin:0;font-size:12.5px">There is already a not-planned <b>'+esc(mtLabel(dup))+'</b> for this role — saving books that one rather than adding a second.</p>'; }
  el("mt-body").innerHTML=body;
  el("mt-hint").textContent=m.err||"";
}
function mtUnplannedTwin(m){
  if(m.when==="unplanned"||m.when==="recurring") return null;
  return commitments.find(function(c){ return c.state==="unplanned" && mtType(c)===m.type && mtFor(c).k==="role" && mtFor(c).id===m.forId; }) || null;
}
function openMT(o){
  MT = o.cid? mtFromDoc(commitments.find(function(x){return x.id===o.cid;})||{}) : mtBlank(o);
  if(o.book) MT.when="booked";
  if(o.type && !o.cid) MT.type=o.type;
  if(o.cid && !commitments.some(function(x){return x.id===o.cid;})) return;
  mtPaint();
  var d=el("mt-dialog"); if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
}
/* Text fields update the draft without a repaint (a repaint would steal the cursor). */
el("mt-dialog").addEventListener("input",function(ev){
  var f=ev.target.dataset && ev.target.dataset.mt; if(!f||!MT) return;
  if(f==="title"){ MT.title=ev.target.value; MT.titleTouched=true; return; }
  if(["detail","window","cond","blocked"].indexOf(f)>=0){ MT[f]=ev.target.value; return; }
  if(MT.np && f==="npname"){ MT.np.name=ev.target.value; return; }
  if(MT.np && f==="nprole"){ MT.np.role=ev.target.value; return; }
  if(MT.np && f==="npcotext"){ MT.np.coText=ev.target.value; return; }
});
el("mt-dialog").addEventListener("change",function(ev){
  var t=ev.target, f=t.dataset && t.dataset.mt; if(!f||!MT) return;
  var v=t.type==="checkbox"? t.checked : t.value;
  if(f==="addp"){ if(v==="__new") MT.np={name:"",role:"",how:"",co:mtCompanyOf(MT)||""}; else if(v){ MT.people.push(v); mtForDefault(v); } mtPaint(); return; }
  if(f==="nprolesel" && MT.np){ var hw=el("mt-nphow"); if(hw) MT.np.how=hw.value;
    if(v==="__new"){ MT.np.roleNew=true; MT.np.role=""; } else { MT.np.roleNew=false; MT.np.role=v; }
    mtPaint(); if(MT.np.roleNew && el("mt-nprole")) el("mt-nprole").focus(); return; }
  if(f==="npcosel" && MT.np){ var hw2=el("mt-nphow"); if(hw2) MT.np.how=hw2.value;
    if(v==="__other"){ MT.np.coOther=true; MT.np.co=""; } else { MT.np.coOther=false; MT.np.co=v; }
    mtPaint(); if(MT.np.coOther && el("mt-npcotext")) el("mt-npcotext").focus(); return; }
  if(f==="addtag"){ if(v) MT.tags.push(v); mtPaint(); return; }
  if(f==="date"){ var old=MT.date; MT.date=v;
    /* Prep follows the meeting, keeping its gap, until you set the prep date yourself. */
    if(!MT.prepManual){ var gap=(old && MT.prepDate)? dayGap(MT.prepDate,old) : null; MT.prepDate=v? (gap>0? addDays(v,-gap) : prevBiz(v)) : ""; }
    mtPaint(); return; }
  if(f==="prepDate"){ MT.prepDate=v; MT.prepManual=!!v; mtPaint(); return; }
  if(f==="forId"){ MT.forId=v; mtPaint(); return; }
  if(f==="type"){ MT.type=v; mtPaint(); return; }
  if(f==="prep"){ MT.prep=v; mtPaint(); return; }
  if(f==="time"||f==="dur"||f==="sentAt"||f==="chaseBy"||f==="mday"||f==="start"||f==="end"){ MT[f]=v; return; }
  if(f==="title"||f==="detail"||f==="window"||f==="cond"||f==="blocked"){ return; }
});
el("mt-dialog").addEventListener("click",function(ev){
  if(!MT) return;
  var s=ev.target.closest("[data-mtseg]");
  if(s){ var k=s.dataset.mtseg, v=s.dataset.v;
    if(k==="item"){ MT.item=v; if(v==="meeting" && MT.forK==="meeting") MT.forK="none"; MT.type=""; }
    if(k==="forK"){ if(MT.forK!==v){ MT.forK=v; MT.forId=""; if(MT.item==="meeting") MT.type=""; if(v==="person" && MT.people.length) mtForDefault(MT.people[0]); } }
    if(k==="when"){ MT.when=v; if(v==="recurring" && !MT.start) MT.start=today(); }
    if(k==="every") MT.every=v;
    mtPaint(); return; }
  var dy=ev.target.closest("[data-mtday]");
  if(dy){ var n=+dy.dataset.mtday, i=MT.days.indexOf(n); if(i>=0) MT.days.splice(i,1); else MT.days.push(n); mtPaint(); return; }
  var rm=ev.target.closest("[data-mtrm]");
  if(rm){ var id=rm.dataset.mtrm; if(id==="__legacy") MT.legacyPerson=""; else { MT.people=MT.people.filter(function(x){return x!==id;}); MT.newPeople=MT.newPeople.filter(function(x){return x.tmp!==id;}); if(MT.forK==="person" && MT.forId===id) MT.forId=""; } mtPaint(); return; }
  var tg=ev.target.closest("[data-mttag]");
  if(tg){ MT.tags=MT.tags.filter(function(x){return x!==tg.dataset.mttag;}); mtPaint(); return; }
  var np=ev.target.closest("[data-mtnp]");
  if(np){
    if(np.dataset.mtnp==="cancel"){ MT.np=null; mtPaint(); return; }
    var nm=el("mt-npname").value.trim(); if(!nm){ el("mt-npname").focus(); return; }
    var ex=people.find(function(p){return String(p.name).toLowerCase()===nm.toLowerCase();});
    if(ex){ if(MT.people.indexOf(ex.id)<0) MT.people.push(ex.id); mtForDefault(ex.id); MT.np=null; mtPaint(); return; }   /* already on People */
    var tmp="new:"+Date.now().toString(36);
    MT.newPeople.push({tmp:tmp, name:nm, role:String(MT.np.roleNew? (el("mt-nprole")? el("mt-nprole").value : MT.np.role) : (MT.np.role||"")).trim(), how:el("mt-nphow").value,
      co:MT.np.coOther? "" : (el("mt-npco")? el("mt-npco").value : (MT.np.co||"")), coText:MT.np.coOther? String(el("mt-npcotext")? el("mt-npcotext").value : (MT.np.coText||"")).trim() : ""});
    MT.people.push(tmp); mtForDefault(tmp); MT.np=null; mtPaint(); return;
  }
});
/* For = Person with nobody chosen yet: the first person added under With fills it (8 Oct), new or existing. */
function mtForDefault(pid){ if(MT && MT.forK==="person" && !MT.forId && pid) MT.forId=pid; }
el("mt-close").addEventListener("click",function(){ MT=null; closeDlg("mt-dialog"); });
el("mt-save").addEventListener("click",function(){ mtSave(); });
function mtSave(){
  var m=MT; if(!m) return;
  function stop(msg,focus){ m.err=msg; el("mt-hint").textContent=msg; if(focus&&el(focus)) el(focus).focus(); }
  var task=m.item==="task";
  mtSyncFor(m);
  if(!task && m.forK==="person" && !m.forId) return stop(m.np? "Finish adding the new person first — Add them, or Cancel." : "Add who it’s with under With.", m.np? "mt-npname" : "mt-addp");
  if(m.forK!=="none" && !m.forId) return stop("Choose which "+MT_FORLAB[m.forK].toLowerCase()+" it is for — or pick Nothing.","mt-forId");
  if(!String(m.title||"").trim()) return stop("It needs a title.","mt-title");
  if(m.when==="booked" && !m.date) return stop(task? "Add a due date — or pick When something happens." : "Add a date — or pick Not planned yet.","mt-date");
  if(m.when==="conditional" && m.trole && !m.tev) return stop("Pick what the role has to reach.","mt-tev");
  if(m.when==="conditional" && task && !m.trole) return stop("A task needs a date or a trigger: pick the role it waits on.","mt-trole");
  if(m.when==="conditional" && !m.trole && !String(m.cond||"").trim()) return stop("Say what it's waiting on, or pick a role.","mt-cond");
  if(m.when==="recurring" && m.every!=="month" && !m.days.length) return stop("Pick at least one day it repeats on.");
  if(m.when==="recurring" && m.every==="month" && !m.mday) return stop("Pick the day of the month.","mt-mday");
  if(m.when==="recurring" && m.end && m.start && m.end<m.start) return stop("It ends before it starts.","mt-end");
  if(m.np) return stop("Finish adding the new person first — Add them, or Cancel.","mt-npname");
  if(!DB) return stop("Stored data isn't available in this view, so nothing can be saved.");
  var coId=mtCompanyOf(m), co=companies.find(function(x){return x.id===coId;});
  /* New people first, so the meeting can point at them. */
  var newIds={}, writes=[];
  m.newPeople.forEach(function(p){
    var base=slug(p.name), id=base, n=2; while(people.some(function(x){return x.id===id;})||Object.keys(newIds).some(function(k){return newIds[k]===id;})) id=base+"-"+(n++);
    newIds[p.tmp]=id;
    writes.push(DB.doc("people/"+id).set({name:p.name, role:p.role||"", how:p.how||"", companyId:(p.co!=null? p.co : (coId||"")), company:p.coText||"", linkedin:"", note:"", addedAt:today()}));
  });
  var pids=m.people.map(function(x){return newIds[x]||x;}).filter(function(x){return x.indexOf("new:")!==0;});
  var names=pids.map(function(id){ var p=people.find(function(x){return x.id===id;}); if(p) return p.name; var q=m.newPeople.find(function(x){return newIds[x.tmp]===id;}); return q? q.name : ""; }).filter(Boolean);
  if(m.legacyPerson) names.push(m.legacyPerson);
  var first=pids[0] && (people.find(function(x){return x.id===pids[0];})||m.newPeople.find(function(x){return newIds[x.tmp]===pids[0];}));
  var roleId = m.forK==="role"? m.forId : (m.forK==="meeting"? ((commitments.find(function(x){return x.id===m.forId;})||{}).roleId||"") : "");
  var state = m.when;
  var doc={
    item:m.item, type:m.type, title:m.title.trim(), detail:m.detail.trim(),
    forKind:m.forK, forId:newIds[m.forId]||m.forId, roleId:roleId, tagRoles:task? [] : m.tags.slice(),
    org: co? co.name : (m.forK==="none"||m.forK==="sector"? "" : ""),
    personIds:task? [] : pids, person:task? "" : names.join(", "), relationship: first? (first.how||"") : "",
    state:state, date: (state==="booked")? m.date : (state==="unplanned"? "" : (m.date||"")),
    time: task||state!=="booked"? "" : (m.time||""), duration: task||state!=="booked"? "" : (m.dur? +m.dur : ""),
    windowText: state==="offered"? m.window.trim() : "", sentAt: state==="offered"? (m.sentAt||today()) : "",
    chaseBy: state==="offered"? (m.chaseBy||addDays(m.sentAt||today(),CHASE_DAYS)) : "", court: state==="offered"? "them" : "me",
    condition: state==="conditional"? (m.trole&&m.tev? trigText(m.trole,m.tev) : m.cond.trim()) : "",
    blockedBy: state==="conditional"? (m.trole&&m.tev? trigShort(m.trole,m.tev) : m.blocked.trim()) : "",
    trigger: state==="conditional" && m.trole && m.tev? {roleId:m.trole, ev:m.tev} : null,
    kind:"external"
  };
  /* Prep is due from one day to a fortnight before; never on the day itself. */
  if(!task && state==="booked"){
    if(m.prep && m.prepManual && m.prepDate){ doc.prepOn=m.prepDate; doc.prepLead=Math.max(1,Math.min(14,dayGap(m.prepDate,m.date)||1)); }
    else { doc.prepLead = m.prep? Math.max(1,Math.min(14,dayGap(m.prepDate||prevBiz(m.date),m.date)||1)) : 0; doc.prepOn=""; }
  }
  if(m.done && state==="booked") doc.state="done";
  if(state==="recurring"){
    doc.date=""; doc.time=task? "" : (m.time||""); doc.duration=task? "" : (m.dur? +m.dur : "");
    doc.repeatEvery=m.every; doc.repeatDays=m.every==="month"? [] : m.days.slice().sort();
    doc.repeatDate=m.every==="month"? +m.mday : ""; doc.startsOn=m.start||today(); doc.endsOn=m.end||"";
  }
  var twin = !m.cid && m.forK==="role" && !task ? mtUnplannedTwin(m) : null;
  var cid = m.cid || (twin && twin.id) || (slug(doc.title).slice(0,48)+"-"+Date.now().toString(36).slice(-4));
  if(!m.cid && !twin){ doc.createdAt=today();
    if(state==="unplanned"){ var sib=commitments.filter(function(c){return c.state==="unplanned" && mtFor(c).k===m.forK && mtFor(c).id===m.forId;});
      doc.order=Math.max.apply(null,sib.map(function(c){return c.order||0;}).concat([0]))+1; } }
  /* Read the old state BEFORE writing: the local snapshot updates as soon as the write lands, so
     checking afterwards always saw "booked" and the status never moved to Prep (8 Oct). */
  var wasBooked = ((m.cid||twin)? (commitments.find(function(x){return x.id===cid;})||{}).state : "")==="booked";
  var ref=DB.doc("commitments/"+cid);
  writes.push((m.cid||twin)? ref.update(doc) : ref.set(doc));
  el("mt-hint").textContent="Saving…";
  Promise.all(writes).then(function(){
    /* Booking an interview on an applied role means prep is owed now — same as before. */
    if(!task && state==="booked" && roleId && !wasBooked){
      var rr=roles.find(function(x){return x.id===roleId;});
      if(rr && (rr.stage==="applied"||rr.stage==="offer") && mtType(doc)!=="informal") setFlow(roleId,"prep");
    }
    MT=null; closeDlg("mt-dialog"); toast("Saved");
  }).catch(function(e){ console.warn("mt save",e&&e.code); stop("Not saved — "+((e&&e.code)||"the write failed")+". Your entries are still here."); el("offline").hidden=false; });
}
/* Every Add / Edit / Book-it button for meetings and tasks, wherever it sits. Runs before the
   board's own click handler so the old meeting editor never opens. */
document.addEventListener("click",function(ev){
  var t=ev.target.closest("[data-act], #cm-open"); if(!t) return;
  var a=t.id==="cm-open"? "mt_add" : t.dataset.act;
  if(a==="ed_open" && t.dataset.k==="commitment"){ ev.stopPropagation(); ev.preventDefault(); openMT({cid:t.dataset.id}); return; }
  if(a==="mt_add"){ ev.stopPropagation(); ev.preventDefault(); openMT({item:t.dataset.item||"meeting", fk:t.dataset.fk||"none", fid:t.dataset.fid||"", type:t.dataset.type||""}); return; }
  if(a==="mt_edit"){ ev.stopPropagation(); openMT({cid:t.dataset.cid}); return; }
  if(a==="mt_book"){ ev.stopPropagation(); openMT({cid:t.dataset.cid, book:true}); return; }
  if(a==="mt_up"||a==="mt_down"){
    ev.stopPropagation(); if(!DB) return;
    var c=commitments.find(function(x){return x.id===t.dataset.cid;}); if(!c) return;
    var f=mtFor(c), sib=commitments.filter(function(x){ return !x.date && x.state!=="done" && mtItem(x)===mtItem(c) && mtFor(x).k===f.k && mtFor(x).id===f.id; }).sort(mtSort);
    var i=sib.indexOf(c), j=a==="mt_up"? i-1 : i+1; if(i<0||j<0||j>=sib.length) return;
    sib.splice(j,0,sib.splice(i,1)[0]);
    sib.forEach(function(x,n){ if((x.order||0)!==n+1) DB.doc("commitments/"+x.id).update({order:n+1}).catch(function(e){console.warn(e);}); });
    return;
  }
},true);

/* ---------- prep advice now edits on the meeting ---------- */
EDIT_SPEC.mprep = {coll:"commitments", find:function(id){return commitments.find(function(x){return x.id===id;});}, dyn:function(id){
  var c=commitments.find(function(x){return x.id===id;})||{};
  if(c.prep && c.prep.kind==="screen") return {key:[
    ["prep.tellMe","Tell me about yourself","area"],["prep.proofPoint","Proof point","area"],
    ["prep.whyRole","Why this role — one per line","list"],["prep.whyCompany","Why this company — one per line","list"],
    ["prep.likelyQuestions","Likely questions — one per line","list"],["prep.avoid","Avoid saying — one per line","list"],
    ["prep.askThem","Ask them — one per line","list"],["prep.salary","Salary","area"],["prep.logistics","Logistics","area"]], more:[]};
  return {key:[
    ["prep.kind","Kind","select",[["round","Interview round"],["screen","Recruiter screen"]]],
    ["prep.tests","What it really tests","area"],
    ["prep.focus","Lead with — one per line","list"],["prep.stories","Stories to have ready — one per line","list"],
    ["prep.avoid","Avoid saying — one per line","list"],["prep.likelyQuestions","Likely questions — one per line","list"],
    ["prep.askThem","Ask them — one per line","list"],["prep.mock.focus","Practice interview focus","area"]], more:[]};
}};
ED_TITLES.mprep="Edit advice";

/* ---------- prep lookups, now from meetings (replaces the stage versions) ---------- */
function mtPrepMeetings(r){ return mtRoleItems(r.id).filter(function(c){return c.prep && mtItem(c)==="meeting";}); }
roundPrepFor = function(r){
  var ms=mtPrepMeetings(r).filter(function(c){return c.state!=="done";}).sort(mtSort), t=today();
  var nx=ms.filter(function(c){return c.state==="booked" && c.date>=t;})[0] || ms[0];
  if(!nx || nx.prep.kind==="screen") return null;
  var p=Object.assign({round:nx.title},nx.prep); p.type=p.type||MT_MOCK[mtType(nx)];
  return {cid:nx.id, p:p, sess:nx.date? nx : null};
};
prepTop = function(r){
  var ms=mtPrepMeetings(r).filter(function(c){return c.state!=="done";}).sort(mtSort), t=today();
  var nx=ms.filter(function(c){return c.state==="booked" && c.date>=t;})[0] || ms[0];
  if(!nx) return null;
  if(nx.prep.kind==="screen") return {k:nx.id, sp:nx.prep, sess:nx};
  return {k:nx.id, p:Object.assign({round:nx.title},nx.prep), sess:nx};
};
stagesOf = function(r){ return mtStages(r).map(function(c){ return {k:c.id, st:c.state==="done"? "done" : c.state==="booked"? "scheduled" : "notplanned", cmt:c}; }); };
linkStage = function(){};
openMockFor = (function(orig){ return function(roleId,cid){
  orig(roleId, (cid==="screen")? "screen" : "");
  var c=cid && commitments.find(function(x){return x.id===cid;}); if(!c) return;
  var mt=(c.prep&&c.prep.mock&&c.prep.mock.type) || (c.prep&&MOCKTYPES[c.prep.type]&&c.prep.type) || MT_MOCK[mtType(c)];
  var ts=mkTypesGuess(c, c.prep||{}); if(!ts.length && mt) ts=[mt]; if(ts.length) mkSetTypes(ts);
  if(el("mk-focus")) el("mk-focus").value=(c.prep&&c.prep.mock&&c.prep.mock.focus)||"";
}; })(openMockFor);

/* ---------- self-heal: prep written the old way moves onto meetings ----------
   Until the interview-prep skill is updated, a run may still write screenPrep / interviewPrep on the
   role. The board moves it onto a meeting (the linked one, or a new not-planned one) and clears it
   from the role. Same ids every time, so two open tabs cannot duplicate it. */
var MT_HEALING={}, MT_LOADED={};
function mtHeal(){
  if(!DB) return;
  rawRoles.forEach(function(r){
    var jobs=[];
    if(r.screenPrep && typeof r.screenPrep==="object") jobs.push({k:"screen", p:r.screenPrep});
    Object.keys(r.interviewPrep||{}).forEach(function(k){ if(r.interviewPrep[k]) jobs.push({k:k, p:r.interviewPrep[k]}); });
    jobs.forEach(function(j){
      var hk=r.id+"~"+j.k; if(MT_HEALING[hk]) return; MT_HEALING[hk]=1;
      var src=Object.assign({},j.p), isScreen=j.k==="screen"||src.type==="screen";
      var screenShape=j.k==="screen" || !!(src.tellMe||src.proofPoint||src.salary);   /* which advice layout it was written in */
      var linked=src.commitmentId && commitments.find(function(x){return x.id===src.commitmentId;});
      if(!linked && isScreen) linked=commitments.find(function(c){return (c.roleId===r.id) && /screen/i.test((c.title||"")+" "+(c.type||""));});
      if(!linked && j.k!=="screen") linked=commitments.find(function(x){return x.id===j.k;});   /* old rounds were keyed by meeting id */
      var prep=Object.assign({}, src, {kind:screenShape? "screen" : "round"});
      ["commitmentId","status","next","round"].forEach(function(f){ delete prep[f]; });
      var mtype = isScreen? "screen" : ({pm:"hm",culture:"culture",domain:"domain",livecase:"livecase",takehome:"casepres",screen:"screen"}[src.type]||"hm");
      var w;
      if(linked){
        var patch={prep:prep, item:"meeting", forKind:"role", forId:r.id, roleId:r.id};
        if(!linked.type || linked.type==="interview" || linked.type==="conversation") patch.type=mtype;
        w=DB.doc("commitments/"+linked.id).update(patch);
      } else {
        w=DB.doc("commitments/"+r.id+"-"+slug(j.k)).set({item:"meeting", type:mtype, title:(r.company||"")+" — "+(src.round||MT_LABEL[mtype]),
          forKind:"role", forId:r.id, roleId:r.id, state:src.status==="done"? "done" : "unplanned", date:"", time:"", duration:"",
          personIds:[], person:"", relationship:"", tagRoles:[], org:r.company||"", detail:"", kind:"external", prep:prep,
          createdAt:today(), order:(isScreen? 0 : (parseInt(String(j.k).replace(/\D/g,""),10)||5))});
      }
      w.then(function(){ return mtClearRole(r.id, j.k); }).catch(function(e){ console.warn("heal",e&&e.code); });
    });
  });
}
function mtClearRole(rid,k){
  /* null rather than a missing key: the runtime merges updates, so a key left out would survive. */
  if(k==="screen") return DB.doc("roles/"+rid).update({screenPrep:null});
  var patch={interviewPrep:{}}; patch.interviewPrep[k]=null;
  return DB.doc("roles/"+rid).update(patch);
}


/* A "session" is a meeting that is booked, pending or done: not a task, and not one still unplanned.
   Status, last contact and "interviewing" read sessions, so a planned-but-unbooked round never counts
   as contact with the employer. */
sessionsFor = function(id){ return commitments.filter(function(c){ return c.roleId===id && c.state!=="unplanned" && mtItem(c)!=="task"; }); };
/* Undoing Done on something that never had a date returns it to Not planned, not to a dateless booking. */
document.addEventListener("click",function(ev){
  var t=ev.target.closest && ev.target.closest('[data-act="cmtundo"]'); if(!t || !DB) return;
  var c=commitments.find(function(x){return x.id===t.dataset.cid;}); if(!c || c.date) return;
  ev.stopPropagation();
  DB.doc("commitments/"+c.id).update({state:"unplanned",doneAt:""}).catch(function(e){ console.warn(e); el("offline").hidden=false; });
},true);


/* ---------- Under the hood (1 Oct, evening) ----------
   Read-only views of the board docs that no other screen shows: profile/brief (the rules every
   Claude session follows), refs/skills (the skills that work this board) and the other refs docs. */
var HOOD={brief:null, refs:{}};
function mdInline(t){
  return esc(t).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<i>$2</i>').replace(/\[\[([^\]]+)\]\]/g,'$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function mdToHtml(md){
  var L=String(md||"").replace(/\r/g,"").split("\n"), out=[], i=0;
  while(i<L.length){
    var l=L[i];
    if(/^```/.test(l)){ var buf=[]; i++; while(i<L.length && !/^```/.test(L[i])){ buf.push(L[i]); i++; } i++;
      out.push('<pre class="hoodpre">'+esc(buf.join("\n"))+'</pre>'); continue; }
    var h=l.match(/^(#{1,4})\s+(.*)$/); if(h){ var n=Math.min(4,h[1].length+2); out.push('<h'+n+' class="hoodh">'+mdInline(h[2])+'</h'+n+'>'); i++; continue; }
    if(/^\s*\|/.test(l)){ var rows=[]; while(i<L.length && /^\s*\|/.test(L[i])){ rows.push(L[i]); i++; }
      var cells=function(r){ return r.trim().replace(/^\||\|$/g,"").split("|").map(function(c){return c.trim();}); };
      var body=rows.filter(function(r){return !/^\s*\|?\s*:?-{2,}/.test(r);});
      out.push('<div class="hoodtbl"><table><thead><tr>'+cells(body[0]).map(function(c){return '<th>'+mdInline(c)+'</th>';}).join("")+'</tr></thead><tbody>'+
        body.slice(1).map(function(r){return '<tr>'+cells(r).map(function(c){return '<td>'+mdInline(c)+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table></div>'); continue; }
    if(/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)){ var ol=/^\s*\d+\./.test(l), items=[];
      while(i<L.length && (/^\s*[-*]\s+/.test(L[i]) || /^\s*\d+\.\s+/.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))){
        if(/^\s*([-*]|\d+\.)\s+/.test(L[i])) items.push(L[i].replace(/^\s*([-*]|\d+\.)\s+/,"")); else items[items.length-1]+=" "+L[i].trim(); i++; }
      out.push('<'+(ol?"ol":"ul")+' class="qlist">'+items.map(function(x){return '<li>'+mdInline(x)+'</li>';}).join("")+'</'+(ol?"ol":"ul")+'>'); continue; }
    if(!l.trim()){ i++; continue; }
    var para=[l]; i++; while(i<L.length && L[i].trim() && !/^(#|```|\s*\||\s*[-*]\s|\s*\d+\.\s)/.test(L[i])){ para.push(L[i]); i++; }
    out.push('<p>'+mdInline(para.join(" "))+'</p>');
  }
  return out.join("");
}
function hoodDoc(key,title,sub,html){
  var k="hood-"+key;
  return '<details class="card panel cfold hooddoc" style="display:block" data-exp="'+k+'"'+(isOpen(k)?" open":"")+'>'+
    '<summary>'+esc(title)+'<span class="cfmeta">'+esc(sub||"")+'</span></summary>'+
    '<div class="hoodmd">'+html+'</div></details>';
}
function renderHood(){
  var box=el("hood-body"); if(!box) return;
  var S=HOOD.refs.skills, sk=(S&&S.skills)||[];
  var skills = sk.length? '<div class="hoodskills">'+sk.map(function(x){
      return '<div class="hoodskill"><div class="row" style="gap:8px"><code>'+esc(x.name)+'</code><span class="chip">'+esc(x.trigger||"")+'</span></div>'+
        '<p>'+esc(x.does||"")+'</p>'+
        '<div class="hoodrw"><span class="eyebrow">Reads</span><span>'+esc((x.reads||[]).join(" · "))+'</span>'+
        '<span class="eyebrow">Writes</span><span>'+esc((x.writes||[]).join(" · "))+'</span></div></div>'; }).join("")+'</div>'+
      (S.md? mdToHtml(S.md) : "")
    : '<p class="lede" style="margin:0;font-size:12.5px">No skills manifest on the board yet.</p>';
  var docs=[["screen-prep-baseline","Interview prep reads it as the model screen prep"],["ats-endpoints","The sweep reads it to list each employer\u2019s open roles"]];
  var B=HOOD.brief;
  box.innerHTML='<p class="lede" style="font-size:12.5px;margin:0 0 12px">What Claude reads when it works on the board. Read-only here; to change anything, ask Claude.</p>'+
    '<div class="card panel stormeter" id="stor-box">'+storageHtml()+'</div>'+
    hoodDoc("skills","Skills","the skills that work this board"+(S&&S.updatedAt? " \u00b7 updated "+niceShort(S.updatedAt) : ""),skills)+
    hoodDoc("brief","Board rules","profile/brief"+(B&&B.updatedAt? " \u00b7 updated "+niceShort(B.updatedAt) : ""), B&&B.md? mdToHtml(B.md) : '<p class="lede">Not on the board.</p>')+
    docs.map(function(d){ var x=HOOD.refs[d[0]];
      return x? hoodDoc(d[0],x.title||d[0],"refs/"+d[0]+" \u00b7 "+d[1],mdToHtml(x.md||"")) : ""; }).join("")+
    (HOOD.refs.redline? hoodDoc("redline","redline.py","refs/redline \u00b7 the application-pack script, checked by its fingerprint before every run",
      '<p class="statushint" style="margin:0">sha256 '+esc(HOOD.refs.redline.sha256||"")+'</p><pre class="hoodpre">'+esc(HOOD.refs.redline.py||"")+'</pre>') : "");
}

/* ---------- repeating tasks and meetings: weekly, fortnightly, monthly (1 Oct, late) ----------
   Same series model as before (one commitment, state "recurring", occurrences derived per day, ticks in
   doneDates). New: repeatEvery = week | fortnight | month. Fortnightly counts weeks from startsOn's
   week; monthly repeats on repeatDate (a month without that day uses its last day). */
function mtRepeatFields(m,task){
  var days=[1,2,3,4,5,6,0].map(function(n){
    return '<button type="button" class="pill" data-mtday="'+n+'" aria-pressed="'+(m.days.indexOf(n)>=0)+'">'+DOW[n]+'</button>'; }).join("");
  var mdays=[]; for(var i=1;i<=31;i++) mdays.push([String(i),ordinal(i)]);
  var tms=mtTimes(); if(m.time && tms.indexOf(m.time)<0) tms.push(m.time);
  return '<div class="mtfld"><span class="mtlab">Every</span>'+mtSeg("every",[["week","Week"],["fortnight","Two weeks"],["month","Month"]],m.every)+'</div>'+
    (m.every==="month"
      ? '<label class="fld" style="max-width:220px">On the'+mtSel("mt-mday",mdays,m.mday,"Choose…")+'</label>'
      : '<div class="mtfld"><span class="mtlab">On</span><div class="mtseg mtdays" role="group">'+days+'</div></div>')+
    '<div class="mtgrid">'+
      '<label class="fld">'+(m.every==="fortnight"? "Starting the week of" : "Starts")+'<input type="date" id="mt-start" data-mt="start" value="'+esc(m.start||"")+'"></label>'+
      '<label class="fld">Ends — optional<input type="date" id="mt-end" data-mt="end" value="'+esc(m.end||"")+'"></label>'+
      (task? "" : '<label class="fld">Time'+mtSel("mt-time",tms.map(function(x){return [x,x];}),m.time,"—")+'</label>'+
        '<label class="fld">Duration'+mtSel("mt-dur",MT_DUR.map(function(n){return [String(n),mtDurLab(n)];}),m.dur,"—")+'</label>')+
    '</div>'+
    (m.every==="month"? '<p class="statushint" style="margin:0">A month without that day uses its last day.</p>' : "");
}
function ordinal(n){ var s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function mondayMs(s){ var d=new Date(s+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return d.getTime(); }
runsOn=function(c,d){
  if(c.state!=="recurring") return false;
  if(c.startsOn && d<c.startsOn) return false;
  if(c.endsOn && d>c.endsOn) return false;
  var ev=c.repeatEvery||"week";
  if(ev==="month"){
    var n=+c.repeatDate||0; if(!n) return false;
    var dt=new Date(d+"T12:00:00Z"), last=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();
    return dt.getUTCDate()===Math.min(n,last);
  }
  if((c.repeatDays||[]).indexOf(dowOf(d))<0) return false;
  if(ev==="fortnight"){
    var wks=Math.round((mondayMs(d)-mondayMs(c.startsOn||c.createdAt||d))/(7*864e5));
    return ((wks%2)+2)%2===0;
  }
  return true;
};
function rptLabel(c){
  var ev=c.repeatEvery||"week";
  if(ev==="month") return "Monthly on the "+ordinal(+c.repeatDate||1);
  var days=(c.repeatDays||[]).slice().sort(function(a,b){return ((a+6)%7)-((b+6)%7);}).map(function(n){return DOW[n];}).join(" & ");
  return (ev==="fortnight"? "Every other " : "Repeats every ")+days;
}
taskCard=(function(orig){ return function(c,d){
  var days=(c.repeatDays||[]).slice().sort(function(a,b){return ((a+6)%7)-((b+6)%7);}).map(function(n){return DOW[n];}).join(" & ");
  var h=orig(c,d), lab=rptLabel(c);
  if(mtItem(c)==="meeting" && c.duration) lab+=" · "+mtDurLab(+c.duration);
  return h.split(esc("Repeats every "+days)).join(esc(lab));
}; })(taskCard);
