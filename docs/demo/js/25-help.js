"use strict";
/* ===== How to use, overhauled (3 Oct) =====
   Adds Start here (what the board does, a role's journey, the week's rhythm, three promises), Pages (every page
   grouped as the sidebar is, with how things connect), and a detailed FAQ; keeps Set up, Running it and Under the
   hood from index.html. A search box above the sub-tabs searches every part of How to use, and "Ask Claude" answers
   from the same text when search isn't enough. In How to use it's fine to name Claude. */

var HP={q:"", cat:"all", ai:null, aiq:"", open:false, all:false};
function hpA(tab,txt,sub){ return '<a href="#" data-gotab="'+tab+'"'+(sub? ' data-sub="'+sub+'"' : "")+'>'+txt+'</a>'; }
function hpAb(k,txt){ return '<a href="#" data-goabout="'+k+'">'+txt+'</a>'; }

/* ---------- Start here ---------- */
var HP_DOES=[
  ["find","Finds roles while you sleep","Twice a week the sweep reads your job-alert emails, job boards and your target companies' careers pages, applies your deal-breakers and leaves a longlist."],
  ["research","Does the homework","Every role you shortlist is researched overnight: the company, the seat, the pay, and how well your CV fits the ad."],
  ["write","Drafts your application","When you choose to apply, a tailored CV and cover letter are waiting the next morning as tracked changes, ready for you to finish."],
  ["prep","Gets you ready to interview","Before each round: prep from the job ad, the CV you sent, the company's own interview materials and your notes; a mock interview to practise against it; and a one-page cheat sheet to keep open during the call."],
  ["plan","Keeps you on track","Overview and Week ahead show what's on you today, who you're waiting on, and which roles have gone quiet."],
  ["learn","Shows what's working","Insights shows where roles drop out and which channels lead somewhere; Search review talks it through with you and tunes the setup."]
];
var HP_IC={
  find:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  research:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>',
  write:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  prep:'<path d="M4 6h16v10H8l-4 4z"/><path d="M8 10h8M8 13h5"/>',
  plan:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M9 3v4M15 3v4"/>',
  learn:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
function hpIcon(k){ return '<svg viewBox="0 0 24 24" aria-hidden="true" class="hpic">'+(HP_IC[k]||"")+'</svg>'; }

var HP_JOURNEY=[
  {st:"Found", tab:"routine", auto:"The sweep reads alerts, boards and careers pages, twice a week on its scheduled task. Your deal-breakers cut the rest.", you:"On your manual-search days, add what you find: + Add roles on the Longlist, or + New › Add roles. Every role you add goes to the Longlist.", when:"twice a week"},
  {st:"Longlist", tab:"gate1", auto:"Arrives from the sweep with a rough Role Fit. Each morning the daily check makes sure every ad is still open and closes the ones that have gone.", you:"Mass review: score Fun and Shot, then send on or reject. About a minute a role.", when:"e.g. Mon & Thu"},
  {st:"Shortlist", tab:"gate2", auto:"The next morning: company and role research, pay, open questions and a full Role Fit. Until then it shows Queued for research.", you:"Read it and decide: apply, park or reject.", when:"e.g. Tue & Fri"},
  {st:"To apply", tab:"toapply", auto:"The next morning: a CV and cover letter drafted from your base CV and letter, as tracked changes.", you:"Finish the drafts, send the application, upload the finals, mark Applied.", when:"within days"},
  {st:"Applied", tab:"inplay", auto:"Within a day of applying: screen prep. After each round: prep for the next one, from the job ad, the company's materials and your notes. A one-page cheat sheet whenever you ask.", you:"Add each interview and any materials they send, star must-ask questions, practise with a mock, make the cheat sheet, log every conversation, chase when it goes quiet.", when:"ongoing"}
];
function hpJourneyHtml(){
  return '<div class="hpj" role="img" aria-label="A role\'s journey: Found, Longlist, Shortlist, To apply, Applied. For each stage, what happens automatically and what you do.">'+
    '<div class="hpjlab"><span></span><span class="hpjl a">Happens for you</span><span class="hpjl y">You do</span></div>'+
    HP_JOURNEY.map(function(s,i){
      return '<div class="hpjc"><a href="#" class="hpjst" data-gotab="'+s.tab+'"><span class="hpjn">'+(i+1)+'</span>'+esc(s.st)+'<em>'+esc(s.when)+'</em></a>'+
        '<div class="hpjb a"><span class="hpjm">Happens for you</span>'+esc(s.auto)+'</div><div class="hpjb y"><span class="hpjm">You do</span>'+esc(s.you)+'</div></div>'; }).join("")+
    '</div><p class="hpcap">Any role can end at any stage: you said no, they said no, or it went away. It moves to '+hpA("rejected","Closed")+' with the reason, which feeds '+hpA("pipeline","Insights")+'. '+
    '<b>Parked</b> is "not now": it waits with a review date. If it hasn\u2019t been researched yet, the morning research still does it once.</p>'+
    '<p class="hpcap">The days are an example. Set your own review days as repeating tasks in '+hpA("week","Week ahead")+'; the one rule of thumb is to review each list the day after its work lands.</p>';
}
var HP_WEEK=[["Mon",["you:Longlist review","you:Manual search"]],["Tue",["you:Shortlist review"]],["Wed",["auto:Sweep, evening","you:Apply block"]],["Thu",["you:Longlist review","you:Manual search"]],["Fri",["you:Shortlist review"]],["Sat",[]],["Sun",["auto:Sweep, evening","you:Weekly glance at Insights"]]];
function hpWeekHtml(){
  return '<div class="hpw" role="img" aria-label="An example week: the morning run every day; the sweep on Sunday and Wednesday evening; longlist review and a manual search on Monday and Thursday; shortlist review on Tuesday and Friday; an apply block on Wednesday; a weekly glance at Insights.">'+
    HP_WEEK.map(function(d){ return '<div class="hpwd"><b>'+d[0]+'</b></div>'; }).join("")+
    '<div class="hpwbar"><span>Morning run, every day: still-open checks, research, Role Fit, CV drafts, interview prep, overnight fixes</span></div>'+
    HP_WEEK.map(function(d){ return '<div class="hpwc" data-day="'+d[0]+'">'+d[1].map(function(x){ var p=x.split(":"); return '<span class="hpwe '+(p[0]==="auto"? "a" : "y")+'">'+esc(p[1])+'</span>'; }).join("")+'</div>'; }).join("")+
    '</div><div class="hpleg"><span><i class="a"></i>Happens for you</span><span><i class="y"></i>You</span><span>Plus whatever your repeating tasks in '+hpA("week","Week ahead")+' say: sites you check by hand, warm contacts to nudge.</span></div>';
}
function hpStartHtml(){
  return '<div class="hpstart" data-hs="Start here" data-hst="What the board is">'+
    '<div class="card panel hphero"><div class="hpherot"><span class="eyebrow">Next Role</span><h3>Your job search, run like a product.</h3>'+
      '<p>One board for the whole search. Claude does the legwork on a schedule, finding roles, researching them, drafting applications and prepping interviews, '+
      'so your time goes on the decisions only you can make and the conversations that get you hired.</p>'+
      '<div class="hpcta"><a href="#" class="btn primary" data-hpgo="setup">Set it up</a><a href="#" class="btn" data-hpgo="run">How a week runs</a><a href="#" class="btn ghost" data-hpgo="faq">FAQ</a></div></div>'+
      '<ul class="hpstats"><li><b>2×</b><span>sweeps a week, while you sleep</span></li><li><b>Daily</b><span>research, fit scores, CVs and prep</span></li><li><b>0</b><span>applications sent without you</span></li></ul></div>'+
    '<h3 class="hph">What it does for you</h3>'+
    '<div class="hpdoes">'+HP_DOES.map(function(d){ return '<div class="hpdo" data-hs="'+esc(d[1])+'" data-hst="Start here"><span class="hpdoi">'+hpIcon(d[0])+'</span><b>'+esc(d[1])+'</b><p>'+esc(d[2])+'</p></div>'; }).join("")+'</div>'+
    '<div class="card panel hpblock" data-hs="A role\'s journey" data-hst="Start here"><div class="hpbh"><h3>A role\'s journey</h3><span class="chip">click a stage to go there</span></div>'+
      '<p class="lede hplede">Every role moves left to right. At each stage some work happens for you overnight, and one decision is yours.</p>'+hpJourneyHtml()+'</div>'+
    '<div class="card panel hpblock" data-hs="An example week" data-hst="Start here"><div class="hpbh"><h3>An example week</h3><span class="chip">about 3–5 hours of your time</span></div>'+
      '<p class="lede hplede">One way to run it. Most of the work runs on a schedule; your days fit around it. Each review sits the day after its work lands: the longlist the morning after a sweep, the shortlist the morning after its research. Pick your own days and set them as repeating tasks in Week ahead.</p>'+hpWeekHtml()+'</div>'+
    '<div class="card panel hpblock" data-hs="Three promises" data-hst="Start here"><h3>Three promises</h3><div class="hpprom">'+
      '<div><b>It never applies or sends anything.</b><span>CVs, letters and emails are drafts. You send them.</span></div>'+
      '<div><b>It never decides for you.</b><span>Moving a role on, rejecting it, or choosing to apply is always your call. The one exception: a longlist role whose ad has gone from the employer\'s own site is closed for you, because the employer has already decided.</span></div>'+
      '<div><b>It never scores your appetite.</b><span>Fun, Shot and how much you rate a company are yours alone. It researches; you judge.</span></div></div></div>'+
  '</div>';
}

/* ---------- Pages ---------- */
var HP_PAGES=[
  {grp:"Planning", items:[
    {tab:"overview", n:"Overview", what:"Where the board opens. This week, what's waiting on you by stage, highlights and a look back with your pace.", use:["Start every session here.","Click a highlight to open Insights with it applied."]},
    {tab:"roles", n:"Roles", what:"The five stage pages, opening at the first one with something on you. The stepper at the top moves between them; its badge is the total on you.", use:["Longlist: score Fun and Shot in Mass review, then send on or reject.","Shortlist: read the research and decide.","To apply: finish the drafts and send.","Applied: interviews, prep, mock practice, cheat sheets and notes.","Closed: everything that ended, and why."]},
    {tab:"week", n:"Week ahead", what:"Meetings and tasks by day, replies you're waiting on, repeating tasks and what isn't planned yet.", use:["Every task has a date or a trigger, e.g. \"two days after I apply\".","A prep line appears the working day before each booked interview.","Booked meetings have Add to Google Calendar.","Click any item to open it; done items drop off.","Not going to do one? Skip a repeating task for that day (the series carries on), mark a task Won\u2019t do, or a meeting Cancelled. They stay greyed with their label, not counted as done, and Reopen brings them back."]},
    {tab:"pipeline", n:"Insights", what:"The whole search end to end: highlights, the funnel, why roles end, breakdowns, trends and pace.", use:["Pick a period and compare with the one before.","Set Outcome to see only closed roles (or only the ones they said no to); the whole page follows it.","In Breakdown, pick any two of channel, fit, Fun & Shot, sector, level, outcome, reason or where it ended; show counts or % of row or column, and click a number to list its roles."]}
  ]},
  {grp:"Tools", items:[
    {tab:"routine", n:"Sourcing", what:"How roles reach you. Auto sweep holds the channels the sweep reads; Manual holds the sites and routes you work yourself.", use:["Trial, pause or drop a source.","See when the sweep last ran and when the next is due.","See what each sweep found and what it screened out with your rules."]},
    {tab:"review", n:"Search review", what:"A guided conversation with Claude about where the search is stuck: finding, deciding, applying or interviews.", use:["Answer its question, then keep, change, turn down or ask about each suggestion.","Nothing changes until you press Apply; every change can be undone."]},
    {tab:"companies", n:"Targets", what:"Companies (what's known about each, and your rating, which decides how often the sweep reads its job board) and Sectors (your stance and how each changes your pitch).", use:["Rate each company: Want it (its board read every sweep), Would consider (weekly), If it appears (alerts and searches only) or Ruled out. Unrated companies aren't searched until you rate them. Only you set it.","How it's read says whether a company's board can be read directly or needs a LinkedIn alert; press Alert set once you've made one."]},
    {tab:"people", n:"People", what:"Who you know and how. Warm routes are the strongest channel there is.", use:["Link people to companies so warm routes show on the roles there."]},
    {tab:"compare", n:"Compare", what:"Up to three roles side by side: fit, Fun and Shot, pay and the open questions.", use:["Pay is tagged as an offer, stated or an estimate."]},
    {tab:"mock", n:"Mock interview", what:"Practise a round for a real role with Claude as the interviewer. It knows which round you're preparing for and reads the role, the job ad, your CV, the prep and the company's materials.", use:["Press Practise on an interview to open it set up for that round.","Blend up to three round types, e.g. PM and domain.","Focus drafts itself from your board; Sharpen with Claude tightens it.","Feedback is short: a headline, what to keep and what to improve, with every answer rated Good, Average or Fix underneath. No score or pass/fail; Practise this next sets up the rerun.","Ctrl or ⌘ + Enter sends your answer."]},
    {tab:"health", n:"Data health", what:"Small gaps that make the numbers less accurate: missing dates and links, unscored roles, records pointing at something deleted, an overdue sweep.", use:["Each problem says how it gets fixed: the board fixes it now (Fix all, with undo), Claude fixes it when you ask (Copy for Claude, then paste it into a chat in your Next Role project), or it needs you."]}
  ]},
  {grp:"You", items:[
    {tab:"about", n:"About me", what:"Who you are, your skills, what you want (My criteria) and your base CV and cover letter. Everything else reads it.", use:["My criteria: deal-breakers, preferences, pluses, concerns, search terms and role shape, each with its evidence.","My CV & letter: every tailored CV starts from yours, and Claude reads your CV as evidence of your experience."]},
    {tab:"help", n:"How to use", what:"This page. Start here, Set up, Running it, Pages, FAQ and Under the hood, with search.", use:[]}
  ]}
];
function hpMapSvg(){
  function box(x,y,w,t,s,tab,acc){ return '<a href="#" data-gotab="'+tab+'"><g class="lpbox'+(acc? " lpacc2" : "")+'"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="56" rx="12"/><text x="'+(x+16)+'" y="'+(y+25)+'" class="lpt">'+t+'</text><text x="'+(x+16)+'" y="'+(y+44)+'" class="lps">'+s+'</text></g></a>'; }
  function ln(x1,y1,x2,y2,lab,lx,ly){ return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" class="lpl"/>'+(lab? '<text x="'+lx+'" y="'+ly+'" text-anchor="middle" class="lpe">'+lab+'</text>' : ""); }
  return '<figure class="loopfig hpmap"><svg viewBox="0 0 820 330" role="img" aria-label="How things connect: a role sits at the centre. It belongs to a company, which belongs to a sector. People link to companies as warm routes. Meetings, tasks and notes hang off a role. Each role came from a source inside a channel. A role at To apply gets a CV pack built from your base CV and letter.">'+
    ln(410,165,170,60,"",0,0)+ln(410,165,650,60,"",0,0)+ln(410,165,170,270,"",0,0)+ln(410,165,650,270,"",0,0)+ln(410,165,410,282,"",0,0)+ln(410,165,410,48,"",0,0)+
    box(320,137,180,"Role","the centre of it all","roles",true)+
    box(80,32,180,"Company","research, your rating","companies")+
    box(320,20,180,"Sector","your stance, pitch","sectors")+
    box(560,32,180,"People","warm routes","people")+
    box(80,242,180,"Source · channel","where it came from","routine")+
    box(320,254,180,"Meetings, notes","one set of notes per meeting","week")+
    box(560,242,180,"CV pack","from your CV & letter","toapply")+
    '<text x="250" y="110" class="lpe">belongs to</text><text x="520" y="110" class="lpe">know someone there</text><text x="250" y="226" class="lpe">came from</text><text x="520" y="226" class="lpe">built for it</text>'+
  '</svg><figcaption>A role sits at the centre. Company facts live once on the company and are shared by every role there; your notes and meetings hang off the role. Click a box to go there.</figcaption></figure>';
}
function hpPagesHtml(){
  return '<div class="card panel hpblock" data-hs="How things connect" data-hst="Pages"><h3>How things connect</h3>'+hpMapSvg()+
      '<ul class="keylist hpmapalt"><li><b>Role</b> — the centre. It belongs to a <b>company</b> (shared research, your rating), which sits in a <b>sector</b>.</li><li><b>People</b> link to companies as warm routes.</li><li><b>Meetings, tasks and notes</b> hang off a role; one set of notes per meeting.</li><li>Every role came from a <b>source</b> inside a <b>channel</b>; at To apply it gets a <b>CV pack</b>.</li></ul></div>'+
    HP_PAGES.map(function(g){ return '<h3 class="hph">'+esc(g.grp)+'</h3><div class="hppages">'+g.items.map(function(p){
      return '<div class="hppg" data-hs="'+esc(p.n)+'" data-hst="Pages"><div class="hppgh"><b>'+esc(p.n)+'</b><a href="#" data-gotab="'+p.tab+'">Open →</a></div><p>'+esc(p.what)+'</p>'+
        (p.use.length? '<ul>'+p.use.map(function(u){ return '<li>'+esc(u)+'</li>'; }).join("")+'</ul>' : "")+'</div>'; }).join("")+'</div>'; }).join("")+
    '<div class="card panel hpblock" data-hs="Keyboard and shortcuts" data-hst="Pages"><h3>Shortcuts</h3><div class="hpkeys">'+
      '<div><kbd>J</kbd> <kbd>K</kbd><span>Next / previous role in the side panel</span></div><div><kbd>Esc</kbd><span>Close the side panel, a menu or a pop-up</span></div>'+
      '<div><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd><span>Send an answer in Mock interview</span></div><div><b>+ New</b><span>Add roles, a meeting, a task, notes, a company or a person, from any page</span></div></div></div>';
}

/* ---------- FAQ ---------- */
var HP_FAQ=[
 {c:"Getting started", q:[
  ["What is Next Role?","A board that runs your job search end to end. A set of Claude skills works it on a schedule: finding roles, researching them, scoring how well your CV fits, drafting CVs and cover letters, and preparing you for interviews. You make the decisions; it does the legwork and keeps the record."],
  ["What do I need before I start?","A Claude account with Gmail connected (the sweep reads your job-alert emails), a Claude project for your job-search chats, and this board bookmarked. Claude in Chrome on desktop is optional: it's only needed to set up job alerts on sites that need you signed in. See "+'<a href="#" data-hpgo="setup">Set up</a>'+"."],
  ["How long does setup take?","About five hours of your time, spread over a day: an hour telling Claude about yourself, a few minutes uploading your CV and letter, checking your skills and criteria, and setting up alerts for sites the sweep can't read. Claude spends two to three hours researching your target companies and sectors in between. You can stop and come back at any point."],
  ["Does my computer need to be on?","No. The sweep, the research, the CV drafts and the interview prep run in the cloud as scheduled tasks. Use the board from any device."],
  ["Can I use it on my phone?","Yes. Every page works on a phone. On iPhone or Android, Add to Home Screen gives one-tap access. The sidebar becomes a menu at the top."],
  ["Who can see my board?","Only you, unless you share it. The data lives in the board's own database, not in a file anyone else can open."]
 ]},
 {c:"Roles and stages", q:[
  ["What are the stages?","Longlist → Shortlist → To apply → Applied. The <b>Longlist</b> is what the sweep found and your deal-breakers let through. The <b>Shortlist</b> is what you chose to look at properly; it gets researched overnight. <b>To apply</b> means you've decided to apply and a CV is being drafted. <b>Applied</b> is everything sent. Roles that end go to <b>Closed</b>; roles you want to come back to are <b>Parked</b>."],
  ["Why does a new Shortlist role say Queued for research?","Shortlist research runs in the morning. Until it has, there's nothing to decide on, so the role waits as Queued for research and isn't counted as on you. Next morning it shows the research and asks you to decide."],
  ["What's the difference between the Longlist and the Shortlist?","The longlist is cheap: a title, a company, a rough fit and the ad. You give each about a minute. The shortlist is expensive: full company and role research, pay, open questions and a proper Role Fit. Only shortlisted roles get that, so the longlist is where you filter hard."],
  ["What do Fun and Shot mean?","Two scores from 1 to 5 that only you give. <b>Fun</b> is how much you'd want the job. <b>Shot</b> is your honest chance of getting it, including any warm route. Together they place a role in one of four boxes: apply as a priority (high both), stretch bets (high Fun, low Shot), safe fallbacks (low Fun, high Shot) and do not apply. A healthy mix is up to half stretch bets."],
  ["What if I don't know a Fun or Shot score yet?","On the longlist, press <b>?</b> beside 1 to 5. It means no gut feel yet, so the research should tell you: it is not a 3. A ? lets you send the role to the shortlist, and it counts as unknown in Fun × Shot and Mix, so your real scores stay clean. Once the shortlist research is in, the role asks you to <b>Score it</b> instead of decide, and you can't send it to To apply without real numbers."],
  ["What's the difference between My fit and Their fit?","<b>My fit</b> is the role against what you want: your deal-breakers, preferences, pluses and concerns. It shows as strong, mixed or fails. <b>Their fit</b> is Role Fit: your CV against the ad's requirements, each met, partly met or a gap, with evidence, giving a percentage and a band. A role can be great for you and a stretch for them, or the other way round."],
  ["What is Mass review?","The fastest way through the longlist: one role at a time, full screen. Score Fun and Shot, then send it on or reject it with a reason. Aim for about a minute a role, on your longlist review days, ideally the day after each sweep (for example Monday and Thursday)."],
  ["How do I add a role I found myself?","<b>+ New › Add roles</b>. Paste one or more links, or use <b>One role</b> to add a single role with a link, the ad's text, a file, or just a title and a note if it came from a conversation. Pasted links land on the Longlist; the next morning they're read and checked against your deal-breakers, preferences and Role Fit, like the sweep's finds. A role added with One role (a link, the ad's text, a file, or just a title and a note) goes there too and gets the same treatment."],
  ["I pasted a link and the role says Needs you. Why?","The morning run couldn't read the ad: a login wall, a page that blocks automated reading, or a LinkedIn-only post. Open the role and paste the ad's text; it's read the next morning. It only flags a link after two failed mornings, unless the page has clearly gone."],
  ["What does Park do?","Park is \"not now\". Give it a review date and the role waits on the Shortlist without nagging you. If it hasn't been researched yet, the morning research still does it once, so it's ready when you come back to it. When the date passes, Data health reminds you to look again."],
  ["How do I reject or close a role?","Use Reject (or Close on an application) and say who ended it: you, them, or neither (it went away), plus a reason from the list. The reasons aren't admin: they show in Insights, and Search review uses them to tell when a deal-breaker should have caught a role earlier. Two reasons ask one more thing: <b>Fails one of my must-haves</b> asks which deal-breaker it fails (or lets you add one), so the board knows which check the sweep is missing; <b>Needs something I don't have</b> asks what, from About me › What I don't have."],
  ["What's \"What I don't have\" in About me?","Things roles ask for that you don't have, like a language or a domain. Role Fit always counts them as gaps, and CVs and interview prep never claim them. When one keeps costing you roles, a Highlights card asks whether the sweep should screen roles that need it out."],
  ["Why did a role disappear from my Longlist?","Every morning each longlist ad is checked against the employer's own job board. If it's gone, the role is closed for you with \"Role pulled or filled\". Look in "+hpA("rejected","Closed")+". Shortlist, parked and To apply roles whose ad has gone are closed too, but you see them: they wait at the top of "+hpA("rejected","Closed")+" under <b>Closed by the employer</b>, counted under the Closed step and in Waiting on you, until you <b>Acknowledge</b> them. If the role is in fact still open, <b>Still open</b> puts it back where it was and the morning check leaves it alone. Applied roles are never closed this way."],
  ["What does \"on you\" mean in the stepper?","How many roles at that stage are waiting for something from you: a score, a decision, a CV to send, notes to log. The Roles badge in the sidebar is the total."],
  ["A role I turned down came back. What now?","If the sweep finds a role you've already turned down, Data health lists it with how the earlier one ended. <b>Reject again</b> closes it with the earlier reason. <b>Keep…</b> keeps it, with a reason such as “it’s changed”, and flags it on the role."],
  ["I think two roles are the same. What do I do?","Data health lists possible duplicates (same link, or the same company and title) and adverts that may match a role you added yourself. Only you can say if they're the same; merging keeps your role and takes the advert's link."]
 ]},
 {c:"What runs automatically", q:[
  ["When does the sweep run?","When its scheduled task runs: twice a week works well, for example Sunday and Wednesday evening. Sourcing › Auto sweep shows when it last ran and when the next is due. Overview and Data health warn you if one is overdue, worked out from when sweeps usually run, so there's no fixed day to set. It reads your job-alert emails, the job boards in your channels, the careers pages of the companies you rate Want it (every sweep) and Would consider (weekly), and your search terms, applies your deal-breakers, and writes what's left to the longlist. Each run is logged in "+hpA("routine","Sourcing › Auto sweep","channels")+"."],
  ["What does the ! on a role mean?","Something about the role is worth a look. Click it to see what. A red ! means it closes in 3 days or less, or its closing date has passed; those roles go to the top of their list and of Waiting on you. An amber ! means something else, for now that it may be the same role as another one (found through a different site, or under a different title); you decide that in Data health \u203a Duplicates with Same role or Not the same. Closing dates are only taken from the employer\u2019s own ad, and most ads don\u2019t give one, so no ! doesn\u2019t mean there\u2019s no deadline."],
  ["What does the morning run do?","Every morning, early: the daily check makes sure longlist, Shortlist (parked included) and To apply ads are still open, folds week-old longlist rejections and does any fixes you queued in Data health; then the longlist research reads links you pasted and gives every new Longlist role its deal-breaker results, preferences and Role Fit; then the shortlist research researches newly shortlisted roles and their companies and scores a full Role Fit; drafts CVs and letters for roles at To apply; and prepares you for upcoming interviews."],
  ["Why didn't a role I saw come through the sweep?","Usually one of three things. The sweep screened it out with a deal-breaker: check \"Cut by your rules\" in Sourcing › Auto sweep, and the rule's evidence in "+hpAb("prefs","My criteria")+". The site isn't one of your sources: add it, or set up alerts if it needs a login. Or the ad wasn't live on the employer's own site when the sweep checked."],
  ["The scheduled tasks keep waiting for my approval.","In Claude, open Scheduled tasks, open the task, and turn on Automatically approve in its settings. Without it, a run stops and waits for you whenever it needs approval. If your organisation doesn't allow it, a run that needs approval waits until you give it."],
  ["Will Claude ever apply, email or message anyone for me?","No. CVs, cover letters and emails are drafts. It never applies, sends or contacts anyone."],
  ["How does it know an ad is still open?","Only from the employer's own job board or a real browser. A page that loads isn't proof: closed ads often still show a full job description and a working form. When it can't check, it leaves the role marked unchecked rather than guessing."],
  ["How do I run something now instead of waiting?","Ask in your Next Role project: \"run the job sweep\", \"run the daily check\", \"run the shortlist\", \"build the pack for #12\", \"prep the interview for #7\", \"cheat sheet for #7\" or \"score the fit for #9\". The same skills run on demand."]
 ]},
 {c:"Your search setup", q:[
  ["What's the difference between a deal-breaker, a preference, a plus and a concern?","A <b>deal-breaker</b> is a hard no: the sweep cuts any role that fails it. A <b>preference</b> is something scored, strong to weak, like seniority or pay. A <b>plus</b> earns bonus points but is never a no. A <b>concern</b> is worth knowing about but isn't a no either. All live in "+hpAb("prefs","About me › My criteria")+"."],
  ["What do \"about the company\" and \"at the shortlist\" mean on a rule?","<b>About the company</b>: the rule or preference is a fact about the employer, like its sector or office policy, so it's checked once per company and reused for every role there. Otherwise it's judged role by role. <b>At the shortlist</b>: a preference that needs proper research, like total package or team culture, is scored by the shortlist research rather than the sweep."],
  ["How do I add or change a deal-breaker?","Press + Add a rule in My criteria (or Edit on a rule) and say in your own words what should never get through, or what should change, and how firm it is. Claude drafts the rule, how the sweep checks it and when; if it fits inside a rule you already have, it suggests updating that one instead. Save, edit or cancel. Changes apply from the next sweep and go in the change log, where you can undo them."],
  ["How do I know if a deal-breaker is too strict?","You don't have to read what it screened out. Each week Claude picks about five screen-outs for you to check (see the weekly screen-out check). When a role was screened out correctly but made you question the rule, mark it <b>Rule worth revisiting</b>. After three such flags on one rule, the check asks you to decide: keep it as it is, add a narrow exception, or drop it. Separately, if your checks keep finding <b>wrong cuts</b>, the rule says <b>Sweep may misread it</b> and offers Suggest a change to how the sweep checks it. If you keep turning roles down later for a reason it should catch, it says it may be too loose. You can also open a rule on <a href=\"#\" data-goabout=\"prefs\">My criteria</a> and check any of its screen-outs yourself."],
  ["What is the weekly screen-out check?","Once a week a scheduled task picks about five roles the sweep screened out that week: the ones most likely to be wrong, plus one at random so its own picking gets checked. It re-reads each ad and says what it thinks. It takes a slot in the week's Highlights until you've answered it. For each role you answer one question, did the sweep apply your rules correctly: <b>Correct</b>, <b>Wrong cut</b> (no rule should have screened it out; if it's still open it can go straight onto your longlist), <b>Wrong reason</b> (it should be out, but for a different rule, which you pick) or <b>Can't verify</b> (the ad has gone; it doesn't count either way). On a correct call you can also mark <b>Rule worth revisiting</b>, with an optional note: the role stays screened out, and three flags on one rule bring the rule to you for a decision. Nothing changes a rule automatically. A week with nothing screened out has no check."],
  ["What's a channel and what's a source?","A <b>channel</b> is a way roles reach you: alert emails, job boards, company careers pages, sites you check, warm routes. A <b>source</b> is one specific thing inside it, like one job board. Auto sweep channels are read for you; Manual ones you work yourself."],
  ["How do I add a job site?","In "+hpA("routine","Sourcing")+", add it as a source under the right channel. Mark it Trial while you see whether it brings anything. If the site needs you signed in, the sweep can't read it, but it can read its alert emails. See Set up › Sites the sweep can't read."],
  ["What do Trial, Active, Paused and Dropped mean on a source?","<b>Active</b> sources are read every sweep. <b>Trial</b> is a new one being given a few weeks to prove itself. <b>Paused</b> is skipped for now. <b>Dropped</b> is no longer read, but the roles it found stay on the board and in Insights. Manual ones read Working, Trying, Paused and Dropped."],
  ["What does a company's rating do?","It decides how often the sweep reads that company's own job board. <b>Want it</b>: every sweep. <b>Would consider</b>: once a week. <b>If it appears</b>: never, though its roles still arrive through alerts and searches. <b>Ruled out</b>: never, and its roles are screened out. Rule one out from its rating, or when you reject a role there. <b>Unrated</b> companies aren't searched until you rate them. Each company's <b>How it's read</b> line says whether its board can be read directly or needs a LinkedIn alert; once you've set one up, press <b>Alert set</b>."],
  ["Who sets a company's rating?","Only you. Claude researches companies but never rates them. Unrated is a fine answer until you've formed a view."],
  ["When should I use Search review?","When something feels off: after about ten applications, when the longlist is thin or full of the wrong roles, or when applications stop turning into interviews. It reads the whole search, says where it's stuck (and not everything is a search problem), and suggests changes with the numbers behind them. Nothing changes until you apply it."]
 ]},
 {c:"Applying and interviews", q:[
  ["Where do the CV and cover letter come from?","Your own CV and letter in "+hpAb("templates","About me › My CV & letter")+". For each role at To apply, the morning run tailors them to the ad as tracked changes in a Word file, so you can see every edit and accept or reject it. Treat it as a strong first draft."],
  ["What does Claude use my CV for besides tailoring?","It reads it as evidence of your experience. Role Fit checks your Skills first, then your CV, then About me before calling anything a gap. Interview prep reads the CV you sent that company (or the tailored draft, or your base CV if neither is uploaded). Mock interview feedback uses it to say which of your real examples you could have raised. About me keeps the facts the board uses as settings, plus what your CV doesn't say."],
  ["What do I do after I apply?","Upload the files you actually sent and mark the role Applied. If you sent the proposed draft as it was, press <b>Use the proposed one</b> on Final versions: it accepts every tracked change and saves that as what you sent. The Applied date starts the clock on chasing, and Insights uses it for your pace. Screen prep follows within a day."],
  ["What's The job ad on a role's Overview?","When a role reaches To apply, Claude saves a summary of the ad (why the role exists, scope, responsibilities, what success looks like, the stated process), because ads often come down before the interviews. Open <b>The job ad</b> under the role's summary to read or edit it. The CV draft, interview prep and mock interview all read it. If it's wrong, remove it and it won't be rebuilt."],
  ["How do I add an interview?","On the role's Interviews tab, or <b>+ New › Schedule a meeting or interview</b>. Or tell Claude in your project, e.g. \"book the screen for #7 on Tuesday at 2 with their talent lead\". Booked meetings have <b>Add to Google Calendar</b>."],
  ["Where's my interview prep?","On the interview itself: open the role's Interviews tab, then the interview, and read <b>Advice for this one</b>. Before the screen it's screen prep: your 60 to 90 second story, why this role and company, the one story to tell, traps to avoid, salary and logistics, and questions to ask. After it, each round gets what it's really testing, what to lead with, the stories to tell, likely questions and questions to ask. Week ahead shows a prep line the working day before a booked interview."],
  ["When is prep built, and for which rounds?","The morning run builds screen prep within a day of you marking a role Applied, because recruiters call fast. Once the screen is done it builds prep for the <b>next round only</b>, as soon as that round is known (from your notes, their materials or research), even before it's booked. Later rounds wait for your notes from the one before. Prep is rebuilt when something new arrives, like a company guide or the CV you sent. To get it now, ask “prep the interview for #7” in your Next Role project."],
  ["How do I add a company's interview materials?","On the role's Interviews tab, under Prep, press <b>Add material</b>: a link to their “how we interview” page, pasted text, or a file (PDF, image, Markdown or Word). Say whether it applies to every role at the company, all of this role's interviews, or one meeting. The next morning Claude reads it and shows <b>What Claude took from it</b>: the format, what they assess and the questions they name. Their own materials outrank anything found online, and the mock interviewer reads them too. Too big for the board, or a PowerPoint? Attach it in a chat and ask “summarise this interview material for #7”."],
  ["What does starring a question do?","On a role's Questions tab, star the questions you must ask. Interviews rarely leave time for everything, so starred questions always go first, word for word, in every prep's questions to ask and on the cheat sheet. Answer a question once you know, and it drops out of both."],
  ["How do I log notes after a call?","<b>+ New › Log a conversation</b>, or open the meeting and add notes. There's one set of notes per meeting; editing adds to it. Messy notes are fine: paste or dictate them to Claude and it files each fact in the right place."],
  ["How do Mock interviews work?","Press <b>Practise</b> on an interview, or open Mock interview and pick a role. It's set up for that round: the round types it covers (blend up to three, e.g. craft and domain) and a focus drafted from your board, which <b>Sharpen with Claude</b> can tighten. Claude interviews you as that company would, using the job ad, your CV, the prep and their materials, and follows up when an answer is vague. Press End for feedback: a two-line headline, what to keep doing and what to improve, and, under <b>Details</b>, each answer rated Good, Average or Fix with what to keep and change, and your questions with sharper ones to ask. There is no score and no pass or fail. <b>Practise this next</b> sets up a rerun, and you can mark the round prepped. Past mocks are kept, and your latest one feeds the cheat sheet."],
  ["What's a cheat sheet?","One page of must-remembers for an interview, in big type, to keep open during a video call or read just before an in-person one. On the interview, press <b>Make cheat sheet</b>: in about 15 seconds Claude condenses the round's prep, your notes, your latest mock and your starred questions. It shows the interviewer's name at the top, then your opener, proof point, why them, three things to land in that type of round, your gap answer, two watch-outs (the first is what you missed in your last mock) and three or four questions to ask. <b>Download PDF</b> saves it as one A4 page: download it before the call. Added more prep since? Press <b>Rebuild</b>. It's only made when you ask, so it's always built from the latest state."],
  ["What are Role Fit suggestions after a meeting?","When you log notes from an interview, the next prep may suggest changes to the role's Role Fit requirements: something they said matters, something they said doesn't, or something new. They wait on the Role Fit tab for you to accept or dismiss; Claude never changes the requirements itself."],
  ["How do I compare offers or close calls?","Put up to three roles in "+hpA("compare","Compare")+": fit gauges, Fun and Shot, pay (tagged as an offer, stated or an estimate) and the open questions, side by side."]
 ]},
 {c:"Insights and data", q:[
  ["What are the Highlights?","Up to six things worth your attention this week, on Overview and Insights. They're patterns in how your search is going, never a chore about one role (those are in Waiting on you) and never something broken (that's Data health). Each card says what it asks of you: <b>Fix the setup</b> (a rule, channel or search term; Claude can draft the change), <b>Your move</b> (something to do differently) or <b>FYI</b> (worth knowing, nothing to change). The week's set is picked the first time you open the board each week: at most one card per area (outcomes first, then supply, your decisions, the filter, foundations), plus the weekly screen-out check while it waits. A card you handle drops off and isn't replaced until next Monday, and nothing outside the six is shown anywhere, so the board never becomes a to-do list about itself. They're judged against <a href=\"#\" data-goabout=\"prefs\">My targets</a>."],
  ["What are My targets?","Your own goals for the search, in About me › My criteria: how many live applications you want, the fewest new roles a week before supply counts as low, the interview rate you're aiming for, how many days you give yourself to decide at each stage, and how many long shots you'll take. They're the only thresholds you set; everything else Highlights use is a fixed amount of evidence, so a card never fires on one or two roles."],
  ["How do I act on a Highlight?","When the fix is a setting — a deal-breaker, how the sweep checks one, your sources, search terms or company ratings — the card has <b>Suggest a change</b>: Claude reads the evidence and drafts one change, picking the right lever. Accept it, edit it or reject it with a reason; every change is logged with undo. If a fix needs a skill changed, you get a prompt to paste into Claude in your Next Role project. When the fix is something you do — stuck roles, quiet applications, too few applications — the card links to the page where you do it. For your information cards link to that view in Insights."],
  ["What do Handled, Monitor and Not useful do?","Use <b>Mark as…</b> on a card. <b>Handled</b>: you've dealt with it, with a note of what you did; it only comes back if the pattern happens again after that date. <b>Monitor</b>: it hides now and comes back when its number grows, showing the number then and now; <b>Monitoring</b> above the cards lists them with their number then and now: <b>Suggest a change</b> if you want to fix it after all, leave it there to keep watching, or <b>Happy with it</b> to close it as Handled. <b>Not useful</b>: hidden for 30 days. All three are in Changes to your search, with undo."],
  ["How do I look at just the roles I turned down, or the ones they said no to?","On Insights, set <b>Outcome</b> in the filter bar: Ended (any), You turned down, They said no, Went away or Live. Everything on the page follows it. <b>Break these down</b> on Why roles end does it in one click and lays reasons against who ended them. In Breakdown pick Rows and Columns (sector, My fit, Their fit, Fun &amp; Shot, Reason, Ended at and the rest), switch Show to <b>% of row</b> to compare like with like, and click any number to list the roles behind it. <b>Filter to these</b> turns that cell into page filters. Reason and Ended at are also under More filters."],
  ["Why do Overview and Insights show different numbers?","Overview's Looking back uses its own period with no filters. Insights uses whatever period, filters and scope you've set there. Clear the filters and match the period, and they agree."],
  ["What is Data health for?","Small gaps that make the numbers less accurate: a missing date, a link nobody can check, a role pointing at a company card that's gone, a sweep that's overdue. Each problem says how it gets fixed: <b>Fix all</b> for what the board can do now (with undo); <b>Copy for Claude</b> for what needs a look-up, the web or your browser, which you paste into a new chat in your Next Role project in Claude; or it needs you."],
  ["What does Copy for Claude do?","It copies a short request naming the fix and the items. Paste it into a new chat in your Next Role project in Claude (that's where it has the board and the skills) and it does them there and then, using the next-role-fix skill: re-checking ads, scoring Role Fit, making company cards, adding companies to your LinkedIn alert in your browser, finding out why a run keeps stopping early, and the rest. Each problem disappears from Data health once fixed."]
 ]},
 {c:"Working with Claude", q:[
  ["Can I just tell Claude things instead of filling in forms?","Yes, and for anything big or messy it's quicker. In your Next Role project, dictate it as it comes: two new meetings, a recruiter's email, notes from a call, a pile of links. Claude puts each fact in the right place on the board. The forms are for quick single changes."],
  ["Will Claude overwrite my edits?","No. Your scores, ratings, notes and anything you've edited are yours. Research passes add alongside them. If Claude thinks something you wrote is wrong, it says so rather than changing it."],
  ["How do I change how the board itself works?","Ask Claude. To add, change or remove a feature, or fix a bug, describe what you want in your project."],
  ["What's in Under the hood?","The rules Claude follows on the board, the skills that work it, the reference docs they read, the settings the skills run with, and how much storage your files use. Read-only."],
  ["How do I make the board use less of my Claude usage?","Ask Claude in your Next Role project, for example: \"the sweep is using too much of my plan — how can we cut it back?\" Claude explains the trade-off and changes the settings for you. What costs the most: the sweep (how many searches, pages and sub-agents each run may use), how deep the shortlist research goes, and how often the scheduled tasks run. You can see the current limits under "+'<a href="#" data-hpgo="hood">Under the hood › Settings</a>'+". Check your usage in Claude's settings after a week or two, and ask again if it's more than you want."],
  ["Can I change how the skills behave?","Mostly by changing the board, not the skills: your deal-breakers and how each is checked (its check note), your preferences, search terms, sources and companies. Facts about you that CVs and prep use (your fixed title, links, writing voice, things never to claim) live in About me. Limits such as how much a sweep may search live in the settings, which Claude changes for you when you ask. The skills themselves read all of this every run."]
 ]},
 {c:"Troubleshooting", q:[
  ["The board looks out of date or half-changed.","Reload the page. After an update your browser may still hold the old version for a moment."],
  ["An alert site never sends anything.","If no alert with listings arrives within two days, the signup didn't take. Check the site's alert settings and your spam folder, and keep the source on Trial until it works."],
  ["A number on a badge doesn't match the page.","Badges count what's on you; pages also show things in hand (queued fixes, roles waiting on others). If they still disagree after a reload, tell Claude: it's a bug."],
  ["The board says the sweep is overdue.","No sweep has run for longer than its usual gap. Check the sweep's scheduled task in Claude is still on and its last run didn't stop with an error. To catch up now, ask in your project: \"run the job sweep\"."],
  ["Something went wrong when saving.","Check your connection and try again; nothing is half-saved. If it keeps happening, tell Claude what you were doing."]
 ]}
];
function hpFaqHtml(){
  var cats=HP_FAQ.map(function(g){ return g.c; });
  return '<div class="hpfaqbar" role="tablist">'+['all'].concat(cats).map(function(c){ return '<button type="button" class="ipill'+(HP.cat===c? " on" : "")+'" data-hpcat="'+esc(c)+'" aria-pressed="'+(HP.cat===c)+'">'+(c==="all"? "All" : esc(c))+'</button>'; }).join("")+'</div>'+
    HP_FAQ.map(function(g){ if(HP.cat!=="all" && HP.cat!==g.c) return "";
      return '<section class="hpfaq"><h3 class="hph">'+esc(g.c)+'</h3><div class="hpfl">'+g.q.map(function(q){
        return '<details class="hpq" data-hs="'+esc(q[0])+'" data-hst="FAQ · '+esc(g.c)+'"><summary>'+esc(q[0])+'</summary><div class="hpqa">'+q[1]+'</div></details>'; }).join("")+'</div></section>'; }).join("")+
    '<p class="hpcap">Not here? Search above, or '+'<a href="#" data-hpfocus="1">ask Claude</a>.</p>';
}

/* ---------- search ---------- */
function hpText(e){ var d=document.createElement("textarea"); d.innerHTML=e.innerHTML.replace(/<(svg|style)[\s\S]*?<\/\1>/g," ").replace(/<[^>]+>/g," "); return d.value.replace(/\s+/g," ").replace(/\s+([.,;:?!])/g,"$1").trim(); }
function hpUnits(){
  var out=[];
  Array.prototype.forEach.call(document.querySelectorAll('#tab-help .cpanel'),function(pn){
    var k=pn.dataset.k; if(k==="hood") return;
    var tagged=pn.querySelectorAll("[data-hs]");
    Array.prototype.forEach.call(tagged,function(u){ if(u.classList.contains("hpstart")) return; out.push({k:k, el:u, t:u.dataset.hs, s:u.dataset.hst||"", x:hpText(u)}); });
    /* Static markup (Set up, Running it): every step, bullet and stage card is a unit. */
    Array.prototype.forEach.call(pn.querySelectorAll(".card.panel"),function(c){
      var h=c.querySelector("h3"); if(!h || c.closest("[data-hs]") || c.querySelector("[data-hs]")) return;
      out.push({k:k, el:c, t:h.textContent, s:(k==="setup"? "Set up" : "Running it"), x:hpText(c)}); });
    Array.prototype.forEach.call(pn.querySelectorAll(".steps > li, .keylist > li, .lpcard"),function(u){
      if(u.closest("[data-hs]")) return;
      var b=u.querySelector("b, h4"), card=u.closest(".card"), h=card && card.querySelector("h3");
      out.push({k:k, el:u, t:(b? b.textContent : u.textContent.slice(0,60)).replace(/[.:]$/,""), s:(k==="setup"? "Set up" : "Running it")+(h? " · "+h.textContent : ""), x:hpText(u)}); });
  });
  return out;
}
/* Search words (3 Oct): filler words are dropped, words match from their start only, and a
   trailing plural "s" is ignored. Highlighting is one pass over whole words. */
var HP_STOP={};
("a an and are as at be but by can do does did for from get go has have how i if in into is it its me my "+
 "no not of on or our so than that the their them then there these they this to up was we were what when "+
 "where which who why will with would you your yours i'm i've it's what's how's there's").split(" ").forEach(function(w){ HP_STOP[w]=1; });
/* Word forms (QA 14 Oct): chase, chased, chasing and chases all search as "chas", matched from the start of a word. */
function hpStem(w){
  if(w.length>5 && /ing$/.test(w)) w=w.slice(0,-3);
  else if(w.length>4 && /ed$/.test(w)) w=w.slice(0,-2);
  else if(w.length>3 && /s$/.test(w) && !/ss$/.test(w)) w=w.slice(0,-1);
  if(w.length>4 && /e$/.test(w)) w=w.slice(0,-1);
  return w; }
function hpWords(q){
  var all=q.toLowerCase().replace(/[’']/g,"'").split(/[^a-z0-9']+/).map(function(w){ return w.replace(/^'+|'+$/g,""); }).filter(function(w){ return w.length>1; });
  var keep=all.filter(function(w){ return !HP_STOP[w]; });
  return (keep.length? keep : all).map(function(w){ return hpStem(w.replace(/'s$/,"").replace(/'/g,"")); }).filter(Boolean);
}
function hpRe(words,flags){ return new RegExp("\\b("+words.map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join("|")+")\\w*", flags||"i"); }
function hpFind(q){
  var words=hpWords(q); if(!words.length) return [];
  var res=words.map(function(w){ return hpRe([w]); }), phrase=q.toLowerCase().trim();
  return hpUnits().map(function(u){ var sc=0;
      for(var i=0;i<res.length;i++){ if(!res[i].test(u.x) && !res[i].test(u.t)) return null; sc+= res[i].test(u.t)? 5 : 1; }
      if(u.t.toLowerCase().indexOf(phrase)>=0) sc+=6; if(/^FAQ/.test(u.s)) sc+=1; u.sc=sc; return u; })
    .filter(Boolean).sort(function(a,b){ return b.sc-a.sc; }).slice(0,10);
}
function hpSnip(x,q,t){
  var words=hpWords(q); if(!words.length) return esc(x.slice(0,170));
  /* Skip the title when the text repeats it (FAQ items start with their question). */
  if(t && x.indexOf(t)===0) x=x.slice(t.length).replace(/^[\s?:.]+/,"");
  var m=hpRe(words).exec(x), i=m? m.index : 0, a=Math.max(0,i-60);
  if(a){ var sp=x.lastIndexOf(" ",a); a= sp>0 && a-sp<20 ? sp+1 : a; }
  var s=(a? "…" : "")+x.slice(a,a+170)+(x.length>a+170? "…" : "");
  return esc(s).replace(hpRe(words,"ig"),"<mark>$&</mark>");
}
var HP_RES=[];
/* Search is a dropdown (3 Oct): results float under the box and close on a pick, a tab change,
   a click outside or Esc. The words stay in the box; focusing it reopens the same results. */
var HP_TOP=6;
function hpDrawSearch(){
  var box=el("hp-res"); if(!box) return; var q=HP.q.trim();
  var clr=el("hp-clear"); if(clr) clr.hidden=!HP.q;
  if(!HP.open || (q.length<2 && !HP.ai)){ box.hidden=true; box.innerHTML=""; hpAria(false); return; }
  HP_RES= q.length>=2? hpFind(q) : [];
  var shown= HP.all? HP_RES : HP_RES.slice(0,HP_TOP);
  box.hidden=false; hpAria(true);
  box.innerHTML=(q.length>=2? (HP_RES.length? '<ul class="hprl" role="listbox" aria-label="Search results">'+shown.map(function(u,i){ return '<li><a href="#" role="option" data-hpres="'+i+'"><span class="hprs">'+esc(u.s)+'</span><b>'+esc(u.t)+'</b><span class="hprx">'+hpSnip(u.x,q,u.t)+'</span></a></li>'; }).join("")+'</ul>'+
        (HP_RES.length>shown.length? '<button type="button" class="linkbtn hpall" data-hpall="1">Show all '+HP_RES.length+' results</button>' : "")
      : '<p class="hpnone">Nothing in How to use matches "'+esc(q)+'".</p>') : "")+
    '<div class="hpask">'+(HP.ai? '<div class="hpai"><span class="eyebrow">Claude · on "'+esc(HP.aiq)+'"</span>'+HP.ai+'</div>' : "")+
      (q.length>=2 && HP.aiq!==q? '<button type="button" class="btn" data-hpask="1">Ask Claude: "'+esc(q.length>60? q.slice(0,60)+"…" : q)+'"</button><span class="hpaskn">Answers from this guide and says if it isn\'t covered.</span>' : "")+'</div>';
}
function hpAria(on){ var i=el("hp-q"); if(i) i.setAttribute("aria-expanded",on? "true" : "false"); }
function hpClose(){ if(!HP.open) return; HP.open=false; HP.all=false; hpDrawSearch(); }
function hpGoSub(k){ var b=document.querySelector('#tab-help .ctabs [data-k="'+k+'"]'); if(b) b.click(); }
function hpJump(u){
  hpClose(); var inp=el("hp-q"); if(inp) inp.blur();
  hpGoSub(u.k);
  if(u.el.tagName==="DETAILS"){ if(HP.cat!=="all"){ HP.cat="all"; hpRender(); var again=Array.prototype.find.call(document.querySelectorAll('#tab-help [data-hs]'),function(e){ return e.dataset.hs===u.t; }); if(again) u.el=again; } u.el.open=true; }
  setTimeout(function(){ u.el.scrollIntoView({block:"center", behavior:"smooth"}); u.el.classList.remove("hpflash"); void u.el.offsetWidth; u.el.classList.add("hpflash"); },30);
}
async function hpAsk(){
  var q=HP.q.trim(); if(q.length<2) return;
  var sample=null; try{ sample=window.claude && window.claude.use? await window.claude.use("sample") : null; }catch(e){ sample=null; }
  if(!sample){ toast("Asking Claude isn't available in this view",true); return; }
  var corpus=hpUnits().map(function(u){ return "["+u.s+"] "+u.t+": "+u.x; }).join("\n").slice(0,30000);
  HP.aiq=q; HP.ai='<p class="hpthink">Reading the guide…</p>'; hpDrawSearch();
  try{
    var res=await sample("You answer questions about a personal job-search board called Next Role, using only the guide below. Answer in plain "+engVar()+" English, in 2 to 5 short sentences or bullets, "+
      "and name the page or button to use. If the guide doesn't cover it, say so in one sentence and suggest asking in the Next Role project chat.\n\nQuestion: "+q+"\n\nGuide:\n"+corpus,{modelTier:"quick"});
    var txt=String((res&&res.text)||"").trim();
    var lines=txt.split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean);
    var bul=lines.filter(function(l){ return /^[-•*]\s/.test(l); }).length>1;
    HP.ai= bul? '<ul>'+lines.map(function(l){ return '<li>'+esc(l.replace(/^[-•*\d.)\s]+/,"")).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")+'</li>'; }).join("")+'</ul>'
      : lines.map(function(l){ return '<p>'+esc(l).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")+'</p>'; }).join("");
  }catch(e){ HP.ai=null; HP.aiq=""; if(!e || (e.code!=="cancelled" && e.code!=="not_granted")) toast("Couldn't reach Claude — "+((e&&e.code)||"try again"),true); }
  hpDrawSearch();
}

/* ---------- render and wiring ---------- */
function hpRender(){
  var s=el("hp-start"); if(s && !s.dataset.done){ s.innerHTML=hpStartHtml(); s.dataset.done="1"; }
  var p=el("hp-pages"); if(p && !p.dataset.done){ p.innerHTML=hpPagesHtml(); p.dataset.done="1"; }
  var f=el("hp-faq"); if(f){ var open={}; Array.prototype.forEach.call(f.querySelectorAll("details[open]"),function(d){ open[d.dataset.hs]=1; });
    f.innerHTML=hpFaqHtml(); Array.prototype.forEach.call(f.querySelectorAll("details"),function(d){ if(open[d.dataset.hs]) d.open=true; }); }
  /* Set up and Running it are static markup: tag their cards so search can label them. */
  var sb=el("hp-searchbox"); if(sb && !sb.dataset.done){ sb.dataset.done="1";
    sb.innerHTML='<div class="hpsrch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'+
      '<input type="search" id="hp-q" placeholder="Search How to use — e.g. park, deal-breaker, alerts" autocomplete="off" aria-label="Search How to use" aria-controls="hp-res" aria-expanded="false">'+
      '<button type="button" class="hpclr" id="hp-clear" data-hpclear="1" aria-label="Clear search" hidden>×</button></div><div id="hp-res" class="hpres" hidden></div>'; }
}
document.addEventListener("input",function(ev){ if(ev.target && ev.target.id==="hp-q"){ HP.q=ev.target.value; HP.open=true; HP.all=false; if(HP.aiq && HP.q.trim()!==HP.aiq){ HP.ai=null; HP.aiq=""; } hpDrawSearch(); } });
document.addEventListener("focusin",function(ev){ if(ev.target && ev.target.id==="hp-q" && !HP.open && (HP.q.trim().length>1 || HP.ai)){ HP.open=true; hpDrawSearch(); } });
/* Close on any click outside the search box and its results, and when a How to use sub-tab is chosen. */
document.addEventListener("click",function(ev){
  if(!HP.open || !ev.target.closest) return;
  if(!ev.target.closest(".hpsb") || ev.target.closest('[data-act="ctab"][data-id="help"]')) hpClose();
},true);
document.addEventListener("keydown",function(ev){
  if(ev.target && ev.target.id==="hp-q"){
    if(ev.key==="Enter"){ ev.preventDefault(); if(HP_RES.length) hpJump(HP_RES[0]); else if(HP.q.trim().length>1) hpAsk(); }
    else if(ev.key==="Escape"){ ev.preventDefault(); if(HP.open) hpClose(); else { ev.target.value=""; HP.q=""; HP.ai=null; HP.aiq=""; hpDrawSearch(); } }
    else if(ev.key==="ArrowDown"){ var f=document.querySelector("#hp-res [data-hpres]"); if(f){ ev.preventDefault(); f.focus(); } }
    return;
  }
  /* Arrow keys move through the results; Esc goes back to the box. */
  if(ev.target && ev.target.closest && ev.target.closest("#hp-res")){
    var items=Array.prototype.slice.call(document.querySelectorAll("#hp-res [data-hpres]")), at=items.indexOf(ev.target), inp=el("hp-q");
    if(ev.key==="ArrowDown" && at>-1 && at<items.length-1){ ev.preventDefault(); items[at+1].focus(); }
    else if(ev.key==="ArrowUp" && at>-1){ ev.preventDefault(); if(at>0) items[at-1].focus(); else if(inp) inp.focus(); }
    else if(ev.key==="Escape"){ ev.preventDefault(); hpClose(); if(inp) inp.focus(); }
  }
});
document.addEventListener("click",function(ev){
  var t=ev.target.closest && ev.target.closest("[data-hpres],[data-hpask],[data-hpcat],[data-hpgo],[data-hpfocus],[data-hpall],[data-hpclear]"); if(!t) return;
  ev.preventDefault();
  if(t.dataset.hpres!=null){ var u=HP_RES[+t.dataset.hpres]; if(u) hpJump(u); return; }
  if(t.dataset.hpask){ hpAsk(); return; }
  if(t.dataset.hpall){ HP.all=true; hpDrawSearch(); return; }
  if(t.dataset.hpclear){ var ci=el("hp-q"); HP.q=""; HP.ai=null; HP.aiq=""; HP.all=false; if(ci){ ci.value=""; ci.focus(); } hpDrawSearch(); return; }
  if(t.dataset.hpcat){ HP.cat=t.dataset.hpcat; hpRender(); return; }
  if(t.dataset.hpgo){ hpGoSub(t.dataset.hpgo); var top=el("tab-help"); if(top) top.scrollIntoView({block:"start"}); return; }
  if(t.dataset.hpfocus){ var i=el("hp-q"); if(i){ i.focus(); i.scrollIntoView({block:"center"}); } }
});
showTab=(function(orig){ return function(t){ hpClose(); orig(t); if(t==="help"){ try{ hpRender(); }catch(e){ console.warn("help",e); } } }; })(showTab);
try{ hpRender(); }catch(e){}
/* Sticky tabs and search (3 Oct): the FAQ pills pin under the search box, so publish its height. */
function hpStickyVars(){ var sb=el("hp-searchbox"); if(sb && sb.offsetHeight) document.documentElement.style.setProperty("--hsb", sb.offsetHeight+"px"); }
showTab=(function(orig){ return function(t){ orig(t); if(t==="help"){ layoutVars(); setTimeout(hpStickyVars,0); } }; })(showTab);
window.addEventListener("resize",function(){ if(tab==="help") hpStickyVars(); });

/* ===== Settings the skills run with (3 Oct) =====
   profile/settings holds the limits and switches the skills read (sweep budget, alert label…). Shown read-only in
   Under the hood; to change one, ask Claude. Each value may carry a line of help in settings.help[<path>]. */
var HOOD_SET=null;
function hoodSettingsHtml(){
  var S=HOOD_SET; if(!S) return '<p class="lede" style="margin:0;font-size:12.5px">No settings on the board yet — the skills use their defaults.</p>';
  var help=S.help||{}, rows=[];
  (function walk(o,pre){ Object.keys(o).forEach(function(k){ if(k==="help"||k==="updatedAt"||k==="title") return; var v=o[k], path=pre? pre+"."+k : k;
    if(v && typeof v==="object" && !Array.isArray(v)) walk(v,path); else rows.push([path,v]); }); })(S,"");
  return '<div class="hoodtbl"><table><thead><tr><th>Setting</th><th>Value</th><th>What it does</th></tr></thead><tbody>'+rows.map(function(r){
      return '<tr><td><code>'+esc(r[0])+'</code></td><td><b>'+esc(Array.isArray(r[1])? r[1].join(", ") : String(r[1]))+'</b></td><td>'+esc(help[r[0]]||"")+'</td></tr>'; }).join("")+'</tbody></table></div>'+
    '<p class="statushint" style="margin:6px 0 0">To change one, ask Claude in your project, e.g. "let the sweep use fewer searches".</p>';
}
renderHood=(function(orig){ return function(){ orig(); var box=el("hood-body"); if(!box) return;
  var d=document.createElement("div"); d.innerHTML=hoodDoc("settings","Settings","profile/settings · limits and switches the skills read"+(HOOD_SET&&HOOD_SET.updatedAt? " · updated "+niceShort(typeof HOOD_SET.updatedAt==="number"? new Date(HOOD_SET.updatedAt).toISOString().slice(0,10) : String(HOOD_SET.updatedAt).slice(0,10)) : ""),hoodSettingsHtml());
  var sk=box.querySelector('[data-exp="hood-brief"]'); if(sk) sk.after(d.firstChild); else box.appendChild(d.firstChild); }; })(renderHood);
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.doc("profile/settings").onSnapshot(function(s){ HOOD_SET=s.exists? s.data() : null; try{ renderHood(); }catch(e){} }, function(e){ console.warn("settings sub",e&&e.code); });
})();
