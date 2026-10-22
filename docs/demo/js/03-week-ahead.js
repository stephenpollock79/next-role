"use strict";
/* ---------- WEEK AHEAD ----------
   One record for every dated thing. Three states, and Offered is the one that justifies the view:
   a slot proposed and not yet confirmed has no home in a calendar and no owner until it is chased.
   Ruled on 2026-09-28 that their own dated work sits here too, against a recommendation to
   keep it in the plan doc; the compromise written into the form is that only HARD dates qualify. */
/* Default gap before a chase: a week from the message (30 Sep). Was 2 days on add and 3 after
   "Chased today". Any single item can be moved with its own chase-by date. */
var CHASE_DAYS = 7;
/* One chase rule for Week ahead and Overview (QA 14 Oct): waiting on them, and the chase-by date has come, or with no
   chase-by, a week since you sent it or last chased. */
function chaseDue(c,t){ t=t||today(); if(!c || c.state!=="offered" || c.court==="me") return false;
  if(c.chaseBy) return c.chaseBy<=t;
  var last=[c.lastChased,c.sentAt].filter(Boolean).sort().pop(), g=last? dayGap(last,t) : null; return g!=null && g>=CHASE_DAYS; }
function addDays(s,n){ var d=new Date(String(s||"").slice(0,10)+"T12:00:00Z"); if(isNaN(d)) return String(s||""); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function niceDay(s){
  var d=new Date(s+"T12:00:00Z");
  if(isNaN(d)) return s;
  var wd=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getUTCDay()];
  var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return wd+" "+d.getUTCDate()+" "+mo;
}
function roleLabel(id){
  var r=roles.find(function(x){return x.id===id;});
  return r? (r.company+" — "+r.title) : "";
}
function typeOf(c){ return c.type || "conversation"; }
/* ---------- Week ahead cards (1 Oct) ----------
   Same shell as the role cards: collapsed row = title + status on top, who/what + the one quick
   action below; expanded = the status block with every action, then the detail. */
/* Four types for the Week ahead (2 Oct). Interview = any role meeting except an informal chat
   (screens, presentations, case studies, panels, tests, offer calls). Meeting = talking to people
   that is not an interview. Prep rows and deadlines are tasks. */
var WKCAT={interview:"Interview", meeting:"Meeting", task:"Task", recurring:"Recurring"};
var WKF="all";
function wkCat(c){
  if(c.state==="recurring") return "recurring";
  if(mtItem(c)==="task") return "task";
  var t=mtType(c), isRole=MT_MEET.role.some(function(o){return o[0]===t;});
  return (t==="interview" || (isRole && t!=="informal"))? "interview" : "meeting";
}
function wkKeep(cat){ return WKF==="all" || WKF===cat; }
function wkBtn(act,cid,label,cls,extra){
  return '<button type="button" class="btn '+(cls||"")+'" data-act="'+act+'" data-cid="'+esc(cid)+'"'+(extra||"")+'>'+esc(label)+'</button>';
}
function wkCard(o){
  var key="wk-"+o.key;
  return '<article class="role wk'+(o.done?" wkdone":"")+(o.skip?" wkskip":"")+'"'+(o.cat? ' data-cat="'+esc(o.cat)+'"' : "")+'><div class="rail '+(o.rail||"")+'"></div><div class="role-body">'+
    '<details class="rcard" data-id="'+esc(key)+'"'+(isOpen(key)?" open":"")+'>'+
      '<summary>'+
        '<span class="rsum-title" title="'+esc((o.cat? WKCAT[o.cat]+" · " : "")+o.title)+'">'+(o.cat? '<span class="wktype t-'+esc(o.cat)+'">'+esc(WKCAT[o.cat])+'</span>' : "")+esc(o.title)+'</span>'+
        '<span class="rsum-status"><span class="eyebrow">Status</span><span class="spill sm '+(o.cls||"")+'">'+esc(o.status)+'</span></span>'+
        /* Date and time sit bottom left, on the button's row (1 Oct). */
        '<span class="rsum-sub"><span class="rsum-co" title="'+esc(o.sub||"")+'">'+(o.when? '<span class="wkwhen">'+esc(o.when)+'</span>' : "")+esc(o.sub||"")+'</span>'+
          (o.quick&&o.quick.length? '<span class="qacts">'+o.quick.join("")+'</span>' : "")+'</span>'+
      '</summary>'+
      '<div class="rbody">'+
        '<div class="shead compact"><div class="srow">'+
          '<span class="eyebrow">Status</span><span class="spill '+(o.cls||"")+'">'+esc(o.status)+'</span>'+
          (o.primary||[]).join("")+
          ((o.secondary||[]).length? '<div class="bgroup outcome">'+o.secondary.join("")+'</div>' : "")+
        '</div></div>'+
        ((o.controls||o.switcher||(o.facts&&o.facts.length))? '<div class="wkfacts">'+(o.controls||"")+(o.switcher||"")+
          (o.facts||[]).map(function(f){ return wkField(f[0],f[1],f[2]); }).join("")+'</div>' : "")+
        (o.body||"")+
        (o.editId? editBox("commitment",o.editId) : "")+
      '</div>'+
    '</details></div></article>';
}
/* Notes logged against this meeting, on the Week ahead card itself (1 Oct). Shown for meetings that
   have happened or are booked; on a pending one only once something is logged. */
function notesOfMeeting(c){
  return conversations.filter(function(v){ return v.meetingId? v.meetingId===c.id : (c.roleId && v.roleId===c.roleId && v.date && v.date===c.date); });
}
function meetNotesWk(c){
  if(typeOf(c)==="task") return "";
  var ns=notesOfMeeting(c), pending = c.state==="offered"||c.state==="conditional";
  if(pending && !ns.length) return "";
  var ahead = c.state==="booked" && c.date && c.date>today();
  return '<div class="wkp-sec"><div class="wkp-sh"><span class="wkp-st">Meeting notes</span>'+(ns.length? '<span class="pbn">'+ns.length+'</span>' : "")+
    (ns.length? "" : '<span class="secacts">'+logBtn(c.roleId||"","","+ Add notes","",c.id)+'</span>')+'</div>'+
    (ns.length? ns.map(function(v){return convEntry(v,false);}).join("")
      : '<p class="emptyline">'+(ahead? "Nothing yet. Add notes after the meeting." : "No notes yet.")+'</p>')+'</div>';
}
/* Pop-up fields (2 Oct): one label column, values beside it. */
function wkField(label,html,cls){ return '<div class="wkf'+(cls? " "+cls : "")+'"><span class="wkfl">'+esc(label)+'</span><span class="wkfv">'+html+'</span></div>'; }
function wkSub(c){
  /* Type, who, and what it is for (1 Oct, evening). */
  var bits=[mtLabel(c)], ps=mtPeople(c), f=mtFor(c);
  if(ps.length) bits.push(ps.join(", "));
  var fn= f.k==="role"? ((roles.find(function(x){return x.id===f.id;})||{}).company||c.org||"") : mtForName(f.k,f.id);
  if(fn && bits.indexOf(fn)<0) bits.push(fn);
  return bits.filter(Boolean).join(" · ");
}
function wkDetail(lines,meta){
  lines=lines.filter(Boolean);
  return (lines.length? '<div class="wkdet">'+lines.map(function(x){return '<p>'+x+'</p>';}).join("")+'</div>' : "")+
    (meta? '<div class="wkdet meta">'+meta+'</div>' : "");
}
/* Add to Google Calendar (6 Oct): a link that opens a new Google Calendar event, filled in. One-way: a copy
   at the moment it's pressed; moving the meeting on the board later doesn't move the calendar event. A meeting
   with a time uses its duration (60 min when none); a meeting with no time, or a task, is an all-day event.
   Only booked meetings and dated tasks that aren't done, from today on. */
function gcalUrl(c){
  if(!c || !c.date || c.state==="done" || c.date<today()) return "";
  var isTask=mtItem(c)==="task";
  if(!isTask && c.state!=="booked") return "";
  var d=String(c.date).replace(/-/g,""), dates, tm=isTask? "" : mtNormTime(c.time);
  var m=/^(\d{2}):(\d{2})$/.exec(tm||"");
  if(m){
    var st=(+m[1])*60+(+m[2]), en=st+(+c.duration||60), ed=c.date;
    while(en>=1440){ en-=1440; ed=addDays(ed,1); }
    function hm(x){ return ("0"+Math.floor(x/60)).slice(-2)+("0"+(x%60)).slice(-2)+"00"; }
    dates=d+"T"+hm(st)+"/"+String(ed).replace(/-/g,"")+"T"+hm(en);
  } else dates=d+"/"+String(addDays(c.date,1)).replace(/-/g,"");
  var ps=mtPeople(c), rl=c.roleId? roleLabel(c.roleId) : "", lines=[];
  lines.push(mtLabel(c)+(ps.length? " with "+ps.join(", ") : ""));
  if(rl) lines.push("Role: "+rl);
  if(c.detail) lines.push(c.detail);
  if(c.prep) lines.push("Prep notes are on your Next Role board.");
  var q="action=TEMPLATE&text="+encodeURIComponent(c.title||"Meeting")+"&dates="+dates+
    (m && calTz()? "&ctz="+encodeURIComponent(calTz()) : "")+"&details="+encodeURIComponent(lines.join("\n"));
  return "https://calendar.google.com/calendar/render?"+q;
}
function gcalBtn(c){
  var u=gcalUrl(c); if(!u) return "";
  return '<a class="btn ghost gcalbtn" href="'+esc(u)+'" target="_blank" rel="noopener" title="Opens Google Calendar with the event filled in. A copy: moving it here later won’t move it there.">Add to Google Calendar</a>';
}
function cmtCard(c,mode){
  var t=today(), id=c.id, typ=typeOf(c);
  var isTask=mtItem(c)==="task", mty=mtType(c);
  var cat=wkCat(c);
  var rail = isTask? "r-task" : cat==="interview"? "r-int" : "r-conv";
  var when = (mode==="day")? [c.time||"", c.duration&&!isTask? mtDurLab(c.duration) : ""].filter(Boolean).join(" · ") : (mode==="late"||mode==="later")? niceShort(c.date) : "";
  var ed = sbtn("ed_open",id,"Edit","ghost",' data-k="commitment"');
  var rm = wkBtn("cmtdel",id,"Remove","ghost");
  var o={key:id, title:c.title, when:when, rail:rail, cat:cat, sub:wkSub(c), editId:id, secondary:[ed,rm], primary:[], quick:[]};
  /* Bottom left says what matters for the tab (1 Oct): how long it has been waiting since
     the last contact, or what it is blocked by in as few words as possible. */
  /* Pending (1 Oct): bottom left says what it is waiting on. Waiting on a person shows how
     long since the last contact; waiting on an event names it in a few words. */
  if(c.state==="offered"){
    var lastC=[c.lastChased,c.sentAt].filter(Boolean).sort().pop();
    var wd=lastC? daysSince(lastC) : null;
    var who=(c.person||c.org||"Their").split(" ")[0];
    o.sub = who+"\u2019s reply"+(wd==null? "" : " \u00b7 "+(wd===0? "today" : wd+" day"+(wd===1?"":"s")));
  } else if(c.state==="conditional"){
    o.sub = (c.trigger && typeof trigSub==="function")? trigSub(c) : (c.blockedBy || clip(c.condition||"",28));
  }
  var lines=[], fx0=[];
  var bookCtl=wkField("Book for",'<input type="date" id="bk-'+esc(id)+'" aria-label="Date agreed">'+
    '<input class="mvtime" id="bkt-'+esc(id)+'" placeholder="Time" aria-label="Time">');
  if(c.state==="offered" || c.state==="conditional"){
    var reply = c.state==="offered";
    var due = reply && chaseDue(c,t);
    o.status = due? "Chase now" : reply? "Waiting" : "Pending"; o.cls = due? "weak" : reply? "mid" : "";
    o.quick=[];
    o.primary=[wkBtn("cmtbook",id,"Book a date","primary")];
    if(reply) o.secondary.unshift(wkBtn("cmtchase",id,"Chased today","ghost"));
    o.controls=bookCtl+
      (reply? wkField("Chase by",'<input type="date" data-act="cmtchaseby" data-cid="'+esc(id)+'" value="'+esc(c.chaseBy||"")+'" title="When this should move to Chase now">') : "");
    o.switcher = reply
        ? wkField("Now waiting on",'<input id="wo-'+esc(id)+'" placeholder="e.g. Screen feedback" aria-label="Now waiting on">'+wkBtn("pend_event",id,"Set",""))
        : wkField("Switch to",wkBtn("pend_reply",id,"Waiting on their reply","",' title="You have been in touch; starts the waiting count"'));
    if(reply){
      if(c.sentAt){ var ago=daysSince(c.sentAt);
        fx0.push(["Sent",esc(niceDay(c.sentAt))+(ago==null? "" : ' <span class="wkfaint">\u00b7 '+(ago===0? "today" : ago+" day"+(ago===1?"":"s")+" ago")+'</span>')]); }
      if(c.lastChased) fx0.push(["Last chased",esc(niceDay(c.lastChased))]);
      if(c.windowText) fx0.push(["Offered",esc(c.windowText)]);
    } else if(c.condition) fx0.push(["Waiting on",esc(c.condition)]);
  } else if(cmtClosedAs(c)){
    /* Closed without doing it (12 Oct): Won't do (a task) or Cancelled (a meeting). Greyed, not struck through. */
    o.status=SKIP_LAB[cmtClosedAs(c)]; o.cls="skipst"; o.skip=true;
    o.primary=[wkBtn("cmtreopen",id,"Reopen","")];
  } else if(c.state==="done"){
    o.status="Done"; o.cls="strong"; o.done=true;
    o.primary=[];
  } else if(c.state==="unplanned"){
    o.status=isTask? "No date" : "Not planned"; o.cls="";
    o.primary=[wkBtn("mt_book",id,isTask? "Set a due date" : "Book it","primary")];
    o.quick=[];
  } else if(isTask){
    var od = c.date && c.date<t;
    o.status = od? "Overdue" : "To do"; o.cls = od? "weak" : "mid";
    o.primary=[wkBtn("cmtdone",id,"Mark done","primary"), wkBtn("cmtwontdo",id,"Won\u2019t do","ghost",' title="Close it without doing it. Not counted as done."')];
    o.quick=[wkBtn("cmtdone",id,"Done",""), wkBtn("cmtwontdo",id,"Won\u2019t do","ghost")];
    o.controls=wkField("Due",'<input type="date" data-act="cmtdate" data-cid="'+esc(id)+'" value="'+esc(c.date||"")+'">');
    if(od) lines.push('<b style="color:var(--bad)">Was due '+esc(niceDay(c.date))+'</b>');
  } else {
    var late = c.date && c.date<t;
    o.status = late? "Not logged" : "Booked"; o.cls = late? "weak" : "warm";
    o.primary=[wkBtn("cmtdone",id,"Mark done","primary"), wkBtn("cmtcancel",id,"Cancelled","ghost",' title="It didn\u2019t happen. Keeps it, greyed, instead of removing it."')];
    o.quick=[wkBtn("cmtdone",id,"Done","")];
    o.controls=wkField("When",'<input type="date" data-act="cmtdate" data-cid="'+esc(id)+'" value="'+esc(c.date||"")+'" aria-label="Date">'+
      '<input class="mvtime" data-act="cmttime" data-cid="'+esc(id)+'" value="'+esc(c.time||"")+'" placeholder="Time" aria-label="Time">');
  }
  /* Pending rows (16 Oct): Book it, Edit and Remove on the collapsed row. Remove has an Undo toast (js/50). */
  if(mode==="wait" && (c.state==="offered"||c.state==="conditional"||c.state==="unplanned"))
    o.quick=[wkBtn("mt_book",id,isTask? "Set a date" : "Book it","primary"), wkBtn("mt_edit",id,"Edit",""), wkBtn("pend_rm",id,"Remove","ghost")];
  var ps=mtPeople(c), fx=[];
  if(c.detail) fx.push(["Details",esc(c.detail)]);
  if(ps.length || c.relationship) fx.push(["With",esc(ps.join(", "))+(c.relationship? (ps.length? ' <span class="wkfaint">· ' : '<span>')+esc(c.relationship)+'</span>' : "")]);
  if(c.roleId){ var rl=roleLabel(c.roleId); if(rl) fx.push(["Role",esc(rl)]); }
  o.facts=fx0.concat(fx);
  var gc=gcalBtn(c); if(gc) o.secondary.unshift(gc);
  o.body=wkDetail(lines,"")+meetNotesWk(c);
  return wkCard(o);
}
/* Prep is DERIVED from the session, never a record of its own: a stored prep row can outlive the
   thing it prepares for, and then it is a chore with no reason. Only the tick and the lead are
   stored, on the session itself. An unfinished prep does not sink into the past — it carries
   forward to today, because a prep you skipped is still a prep you owe. */
/* Prep defaults to the last working day before the session (2 Oct): a Monday interview preps on Friday. */
function prevBiz(d){ var x=addDays(d,-1); while(dowOf(x)===0||dowOf(x)===6) x=addDays(x,-1); return x; }
function prepLeadOf(c){ return c.prepLead!=null ? +c.prepLead : (c.date? Math.max(1,dayGap(prevBiz(c.date),c.date)||1) : 1); }
/* Tasks never get a prep line (6 Oct): only meetings are prepped for. */
function prepIsTask(c){ return typeof mtItem==="function"? mtItem(c)!=="meeting" : (c.item==="task"||c.state==="recurring"); }
/* Prep follows its meeting (prepLead days before) until you move the prep yourself: then `prepOn` holds its own
   date, which a later change to the meeting never moves. Prep may be on the meeting's own day. Moving the prep
   never moves the meeting. A prep left after its meeting is flagged on its row, not quietly fixed (prepAfter). */
function prepDateOf(c){
  if(prepIsTask(c)) return "";
  var n=prepLeadOf(c);
  if(!c.date || c.state!=="booked" || n<=0) return "";
  if(c.prepOn) return c.prepOn;
  return addDays(c.date,-n);
}
function prepAfter(c){ return !!(c.prepOn && c.date && c.prepOn>c.date && !c.prepDone); }
function prepShowDate(c,t){
  if(prepIsTask(c)) return "";
  var pd=prepDateOf(c);
  if(c.prepNow && !c.prepDone && c.date && c.date>=t) return t;   /* asked for now, show today */
  if(!pd) return "";
  if(c.date < t) return "";             // the session is behind us; prep is moot
  if(c.prepDone) return pd;             // done prep stays on the day it was due
  return pd < t ? t : pd;               // undone prep is carried to today
}
function prepRow(c,t){
  var r = c.roleId? roles.find(function(x){return x.id===c.roleId;}) : null;
  var pd=prepDateOf(c), carried = !c.prepDone && pd < t;
  var lo = c.prepDone ? (pd||t) : t, hi = c.date || "", stuck = !hi || hi < lo;
  var o={key:"prep-"+c.id, title:"Prep — "+c.title, rail:"r-prep", cat:"task", done:!!c.prepDone,
    sub:"For "+niceShort(c.date)+(c.time? " at "+c.time : "")+(c.person? " · "+c.person : ""),
    status: c.prepDone? "Done" : carried? "Overdue" : "To do", cls: c.prepDone? "strong" : carried? "weak" : "mid",
    primary: c.prepDone? [] : [wkBtn("prepdone",c.id,"Mark prepped","primary"), wkBtn("prepwontdo",c.id,"Won\u2019t do","ghost",' title="No prep for this one. Removes the prep row; the meeting keeps its own card."')],
    quick: c.prepDone? [] : [wkBtn("prepdone",c.id,"Prepped",""), wkBtn("prepwontdo",c.id,"Won\u2019t do","ghost")],
    secondary:[wkBtn("mt_edit",c.id,"Edit meeting","ghost")],
    controls: stuck? "" : wkField("Prep on",'<input type="date" data-act="prepmove" data-cid="'+esc(c.id)+'" value="'+esc(prepShowDate(c,t)||pd||"")+'" min="'+esc(lo)+'" max="'+esc(hi)+'" title="Anywhere from today to the day of the meeting. Moving the prep never moves the meeting, and a prep you have moved stays put if the meeting moves.">'),
    facts: [["For",esc(niceDay(c.date))+(c.time? " at "+esc(c.time) : "")+(c.person? ' <span class="wkfaint">· '+esc(c.person)+'</span>' : "")]]};
  var lines=[];
  if(carried) lines.push('<b style="color:var(--bad)">Was due '+esc(niceDay(pd))+'</b>');
  if(prepAfter(c)){ o.status="After the meeting"; o.cls="weak"; lines.push('<b style="color:var(--bad)">Prep is on '+esc(niceDay(pd))+', after the meeting on '+esc(niceDay(c.date))+'. Move it.</b>'); }
  /* Hidden when the pop-up was opened from that card (2 Oct); from anywhere else it links there. */
  if(r) o.facts.push(["Prep lives on",'<a href="#" data-act="role_go" data-id="'+esc(r.id)+'">The '+esc(r.company)+' card \u2192</a> <span class="wkfaint">Interviews and Questions tabs</span>',"wkf-where"]);
  o.body=wkDetail(lines,"");
  return wkCard(o);
}

/* ---------- repeating tasks (30 Sep) ----------
   One commitment per series, state "recurring", repeatDays = weekday numbers (0 Sun .. 6 Sat).
   Occurrences are DERIVED per day, never stored; only the ticked dates are, in doneDates. A missed
   one does not pile into "Happened, not logged" — it simply shows unticked on its own day. */
var DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function dowOf(s){ return new Date(s+"T12:00:00Z").getUTCDay(); }
function runsOn(c,d){
  if(c.state!=="recurring") return false;
  if(c.startsOn && d<c.startsOn) return false;
  if(c.endsOn && d>c.endsOn) return false;
  return (c.repeatDays||[]).indexOf(dowOf(d))>=0;
}
function taskDoneOn(c,d){ return (c.doneDates||[]).indexOf(d)>=0; }
/* A repeating task skipped for that day (43 writes skipDates). Lives here because 03, 17 and 18 call it during load-time renders. */
var SKIP_LAB={skip:"Skipped", wontdo:"Won’t do", cancelled:"Cancelled"};
function skipOn(c,d){ return (c.skipDates||[]).indexOf(d)>=0; }
/* "" for open or done; "wontdo" or "cancelled" for an item closed without being done. */
function cmtClosedAs(c){
  if(!c) return "";
  if(c.state==="cancelled") return "cancelled";
  if(c.state==="done" && c.closedAs==="wontdo") return "wontdo";
  return "";
}
function taskCard(c,d){
  var sk=skipOn(c,d), done=taskDoneOn(c,d) && !sk;
  var days=(c.repeatDays||[]).slice().sort(function(a,b){return ((a+6)%7)-((b+6)%7);}).map(function(n){return DOW[n];}).join(" & ");
  var dA=' data-d="'+esc(d)+'"';
  var o={key:"task-"+c.id+"-"+d, title:c.title, when:c.time||"", rail:"r-rec", cat:"recurring", done:done, skip:sk,
    sub:"Repeats every "+days, status: sk? SKIP_LAB.skip : done? "Done" : "To do", cls: sk? "skipst" : done? "strong" : "mid", editId:c.id,
    /* Skip (12 Oct) closes this day only; the series carries on. */
    primary: sk? [wkBtn("taskunskip",c.id,"Not skipped after all","",dA)] : done? [wkBtn("taskundo",c.id,"Not done after all","",dA)]
      : [wkBtn("taskdone",c.id,"Mark done","primary",dA), wkBtn("taskskip",c.id,"Skip","ghost",dA+' title="Skip today only. The task still repeats."')],
    quick: (done||sk)? [] : [wkBtn("taskdone",c.id,"Done","",dA), wkBtn("taskskip",c.id,"Skip","ghost",dA)],
    secondary:[sbtn("ed_open",c.id,"Edit","ghost",' data-k="commitment"'),
               wkBtn("cmtdel",c.id,"Remove series","ghost",' title="Removes every occurrence, not just this day"')]};
  o.body=wkDetail([c.detail? esc(c.detail) : ""],"");
  return wkCard(o);
}
var weekOff=0, WTAB="cal";

function band(hostId,cls,title,why,items,mode){
  var host=el(hostId); if(!host) return;
  if(!items.length){ host.innerHTML=""; return; }
  host.innerHTML='<div class="band '+cls+'">'+(title? '<h3>'+title+'</h3>' : "")+
    '<div class="stack">'+items.map(function(c){return cmtCard(c,mode);}).join("")+'</div></div>';
}
/* Pending holds only meetings and tasks you were offered or added (16 Oct). Not shown: a round the company's
   process says comes next but nobody has offered yet (`expected`, while still unplanned; it lives on the role's
   Interviews tab), and anything for a role that has ended (js/50 cancels those). */
var ROLE_ENDED={closed:1, g1_rejected:1, g2_rejected:1};
function cmtRoleOf(c){ var f=(typeof mtFor==="function")? mtFor(c) : {}; return c.roleId || (f.k==="role"? f.id : ""); }
function cmtRoleEnded(c){ var rid=cmtRoleOf(c), r=rid? roles.find(function(x){ return x.id===rid; }) : null; return !!(r && ROLE_ENDED[r.stage]); }
function cmtExpected(c){ return !!(c && c.expected && c.state==="unplanned"); }
function pendShown(c){ return !cmtExpected(c) && !cmtRoleEnded(c); }
function renderWeek(){
  var t=today(), end=addDays(t,6), cur=(weekOff===0);
  var start=addDays(t,7*weekOff), stop=addDays(start,6);
  var nav=el("week-nav");
  if(nav) nav.innerHTML='<div class="weeknav">'+
    '<span class="range">'+esc(niceShort(start))+' \u2013 '+esc(niceShort(stop))+
      (cur? '' : ' <span class="eyebrow" style="margin-left:6px">'+(weekOff<0? (-weekOff)*7+' days back' : weekOff*7+' days ahead')+'</span>')+'</span>'+
    '<button class="btn" data-act="wk_prev">\u2190 Previous<span class="lg"> 7 days</span></button>'+
    (cur? '' : '<button class="btn primary" data-act="wk_now">Back to today</button>')+
    '<button class="btn" data-act="wk_next">Next<span class="lg"> 7 days</span> \u2192</button></div>';
  var live=commitments.filter(function(c){return c.state!=="done";});

  /* 1. Chase now — offered, their court, chase date reached */
  var chase=live.filter(function(c){ return chaseDue(c,t) && pendShown(c); })
    .sort(function(a,b){return String(a.chaseBy).localeCompare(String(b.chaseBy));});
  /* The bands are about NOW, so they show only on the current seven days. */
  /* Pending grouped by what each item waits on (2 Oct); a group with nothing in it has no header. */
  function pband(title,who,items){ return items.length? '<div class="band wait pband"><h3>'+esc(title)+'<span class="pbn">'+items.length+'</span><span class="pbwho">'+esc(who)+'</span></h3>'+
    '<div class="stack">'+items.map(function(c){return cmtCard(c,"wait");}).join("")+'</div></div>' : ""; }
  var bc=el("band-chase"); if(bc) bc.innerHTML=pband("Chase now","Your move: their reply is overdue",chase);

  /* 2. Happened, not logged — a booked thing in the past that was never closed off */
  var lateAll=live.filter(function(c){ return (c.state==="booked") && c.date && c.date<t && mtItem(c)!=="task"; });
  var late=lateAll.filter(function(c){ return wkKeep(wkCat(c)); })
    .sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  band("band-late","late","Happened, not logged","These are in the past and still open. Log what you liked, what concerned you and what to ask next time on the Prep tab, then mark them done.",late,"late");

  /* 3. The seven days — a window you can page through, seven at a time */
  var host=el("week-days"), out="", tally={interview:0,meeting:0,task:0,recurring:0};
  for(var i=0;i<7;i++){
    var d=addDays(start,i), gap=dayGap(t,d);
    /* An unfinished task does not sink into the past: it is carried to today, like prep. */
    var items=commitments.filter(function(c){ return ((c.state==="booked"||c.state==="done"||c.state==="cancelled") && c.date===d && !(mtItem(c)==="task" && c.state==="booked" && d<t)) ||
        (d===t && mtItem(c)==="task" && c.state==="booked" && c.date && c.date<t); })
      .sort(function(a,b){ var ad=a.state!=="booked"?1:0, bd=b.state!=="booked"?1:0; if(ad!==bd) return ad-bd;
        return String(a.time||"zz").localeCompare(String(b.time||"zz")); });
    var tasks=commitments.filter(function(c){ return runsOn(c,d); })
      .sort(function(a,b){ return (taskDoneOn(a,d)?1:0)-(taskDoneOn(b,d)?1:0) || String(a.title).localeCompare(String(b.title)); });
    var preps=live.filter(function(c){ return prepShowDate(c,t)===d; })
      .sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
    out+='<div class="dayhead'+(gap===0?" isnow":"")+'"><span class="dnum">'+esc(niceDay(d))+'</span>'+
      '<span class="dsub">'+(gap===0?"today":gap===1?"tomorrow":gap===-1?"yesterday":(gap>0?"+":"")+gap)+'</span><span class="dayrule"></span></div>';
    var dls=mtDeadlines().filter(function(x){return x.date===d;});
    var all = dls.map(function(x){return {cat:"task", h:function(){return mtDeadlineCard(x);}};})
      .concat(preps.map(function(c){return {cat:"task", h:function(){return prepRow(c,t);}};}))
      .concat(tasks.map(function(c){return {cat:"recurring", h:function(){return taskCard(c,d);}};}))
      .concat(items.map(function(c){return {cat:wkCat(c), h:function(){return cmtCard(c,"day");}};}));
    all.forEach(function(r){ tally[r.cat]++; });
    var rows = all.filter(function(r){return wkKeep(r.cat);}).map(function(r){return r.h();});
    out+= rows.length? '<div class="stack" style="gap:8px">'+rows.join("")+'</div>'
                     : '<div class="emptyday">'+(all.length? "no "+WKCAT[WKF].toLowerCase()+(WKF==="recurring"? " tasks" : "s") : "nothing booked")+'</div>';
  }
  host.innerHTML=out;
  if(nav){ var tot=tally.interview+tally.meeting+tally.task+tally.recurring;
    nav.insertAdjacentHTML("beforeend",'<div class="cofrow wkfilter"><span class="cofseg" role="group" aria-label="Show">'+
      [["all","All",tot],["interview","Interviews",tally.interview],["meeting","Meetings",tally.meeting],["task","Tasks",tally.task],["recurring","Recurring",tally.recurring]]
      .map(function(f){ return '<button type="button" class="cof'+(WKF===f[0]?" on":"")+'" data-act="wk_f" data-k="'+f[0]+'" aria-pressed="'+(WKF===f[0])+'">'+f[1]+'<span class="tcount">'+f[2]+'</span></button>'; }).join("")+
      '</span></div>'); }

  /* 4. Pending — waiting on a reply (not yet due a chase) or on an event. Longest-waiting first. */
  var wait=live.filter(function(c){ return c.state==="offered" && !chaseDue(c,t) && pendShown(c); })
    .sort(function(a,b){return String(a.lastChased||a.sentAt||"zz").localeCompare(String(b.lastChased||b.sentAt||"zz"));});
  var cond=live.filter(function(c){return c.state==="conditional" && pendShown(c);});
  var bw=el("band-wait"); if(bw) bw.innerHTML=pband("Waiting on a reply","Their move",wait)+pband("Waiting on something to happen","Comes back by itself when it happens",cond);

  /* 6. Beyond the week */
  var later=live.filter(function(c){ return c.state==="booked" && c.date && c.date>end && wkKeep(wkCat(c)); })
    .sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
  band("band-later","late","Further out","Booked, beyond the next seven days.",later,"later");
  var dlLater=mtDeadlines().filter(function(x){return x.date>end && wkKeep("task");}).sort(function(a,b){return a.date.localeCompare(b.date);});
  if(dlLater.length){ var bl=el("band-later");
    if(!later.length) bl.innerHTML='<div class="band late"><h3>Further out</h3><div class="stack"></div></div>';
    var st0=bl.querySelector(".stack"); if(st0) st0.insertAdjacentHTML("beforeend",dlLater.map(function(x){ return mtDeadlineCard(Object.assign({},x,{sub:x.sub+" · "+niceShort(x.date)})); }).join("")); }
  /* Not planned yet — meetings known about but not booked, and tasks with no date. */
  var unpl=live.filter(function(c){return c.state==="unplanned" && pendShown(c);}).sort(mtSort);
  var ub=el("band-unplanned");
  if(ub) ub.innerHTML=pband("Not planned yet","Book it when you know the date",unpl);

  /* Tab counts and empty states (1 Oct). */
  function wc(id,n){ var e=el(id); if(e) e.textContent=n? String(n) : ""; }
  wc("wt-cal", lateAll.length); wc("wt-pend", chase.length+wait.length+cond.length+unpl.length);
  if(!chase.length && !wait.length && !cond.length && !unpl.length) el("band-wait").innerHTML='<div class="emptyday">Nothing pending.</div>';
  fillCmtRoleSelect();
}
function fillCmtRoleSelect(){
  var sel=el("cm-roleid"); if(!sel) return;
  var cur=sel.value;
  sel.innerHTML='<option value="">Not attached to a role</option>'+
    roles.filter(function(r){return r.stage!=="g1_rejected"&&r.stage!=="g2_rejected"&&r.stage!=="closed";})
      .map(function(r){return '<option value="'+esc(r.id)+'">'+esc(refTxt(r)+r.company)+' — '+esc(r.title)+'</option>';}).join("");
  if(cur){ sel.value=cur; if(sel.value!==cur) sel.value=""; }
}

/* Calendar links use the viewer's own time zone (22 Oct), never a fixed one. */
function calTz(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||""; }catch(e){ return ""; } }
