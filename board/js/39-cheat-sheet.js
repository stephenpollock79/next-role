"use strict";
/* ---------- Interview cheat sheet (6 Oct) ----------
   One page, big type, glanced at during a live interview. Made on request only: a "Make cheat sheet" button on
   an interview round asks Claude in the page (SAMPLE) to condense what the board already holds for that round —
   its prep, the role and ad, Role Fit, the user's notes, the latest mock for the round type, starred questions,
   profile/me and the CV — into `sheet` on the meeting {builtAt, at, opener, proof, whyRole, whyCompany, land[3],
   gap, watch[2], askThem[], noPrep, mockId}. `sheet` sits on the meeting itself, not inside `prep`, so a sheet for
   a meeting with no prep never makes the board think the meeting is prepped. (Older sheets in `prep.sheet` still
   read.) The header (people, time, round) is read live from the meeting. Once made: Cheat sheet (view) and
   Download PDF (made in the browser with jsPDF, one A4 page, never stored); Rebuild sits in the view.
   Wrappers: gcalBtn (Week ahead card / pop-up), mtMeetRow (role Interviews tab). Loads last. */
var CS_ID="", CS_BUSY={}, CS_ERR={}, CS_JSPDF="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
function csSheet(c){ var s=c && (c.sheet || (c.prep && c.prep.sheet)); return (s && typeof s==="object")? s : null; }
function csIsMeet(c){ return !!c && (typeof mtItem!=="function" || mtItem(c)==="meeting"); }
function csCan(c){ return csIsMeet(c) && c.state!=="done" && !!c.roleId && (typeof mkrIsRound!=="function" || mkrIsRound(c)); }
function csHas(c){ return csIsMeet(c) && c.state!=="done" && !!csSheet(c); }
function csRole(c){ return c && c.roleId? roles.find(function(r){ return r.id===c.roleId; })||null : null; }
function csButtons(c){
  if(!csCan(c) && !csHas(c)) return "";
  var id=esc(c.id);
  /* One button per round (8 Oct): it opens the cheat sheet pop-up, where downloading, rebuilding and closing live. */
  if(CS_BUSY[c.id]) return '<button class="btn ghost csbtn" data-cs="view:'+id+'">Making cheat sheet…</button>';
  var err=CS_ERR[c.id]? '<span class="cserr">'+esc(CS_ERR[c.id])+'</span>' : "";
  if(csHas(c)) return '<button class="btn ghost csbtn" data-cs="view:'+id+'" title="One page to keep open during the interview: view it, download it as PDF or Word">Cheat sheet</button>'+err;
  return '<button class="btn ghost csbtn" data-cs="make:'+id+'" title="Claude condenses this round’s prep, your notes and your last mock into one page. About 15 seconds; uses your Claude usage.">Make cheat sheet</button>'+err;
}
function csRepaint(){ try{ render(); }catch(e){} var d=el("cs-dialog"); if(d && d.open && CS_ID){ var c=commitments.find(function(x){return x.id===CS_ID;}); if(c){ el("cs-page").innerHTML=csSheet(c) && !CS_BUSY[c.id]? csHtml(c) : csWait(c); csBar(c); } } }
function csList(v){ return (Array.isArray(v)? v : (v? [v] : [])).map(function(x){ return String(x||"").trim(); }).filter(Boolean); }
function csWho(c){
  var ids=c.personIds||[], out=[];
  ids.forEach(function(i){ var p=people.find(function(x){return x.id===i;}); if(p) out.push({name:p.name||"", role:p.role||""}); });
  if(!out.length && c.person) out.push({name:c.person, role:c.relationship||""});
  return out;
}
function csWhen(c){ var b=[]; if(c.date) b.push(niceDay(c.date)); if(c.time) b.push(mtNormTime(c.time)); if(c.duration) b.push(mtDurLab(c.duration)); return b.join(" · "); }
function csSections(c){
  var s=csSheet(c)||{}, why=[];
  if(s.whyRole) why.push("Role: "+s.whyRole);
  if(s.whyCompany) why.push("Company: "+s.whyCompany);
  return [["Opener",csList(s.opener)],["Proof point",csList(s.proof)],["Why them",why],["Land these 3",csList(s.land).slice(0,3)],
    ["Gap answer",csList(s.gap)],["Watch-outs",csList(s.watch).slice(0,2)],["Ask them",csList(s.askThem).slice(0,4)]]
    .filter(function(x){ return x[1].length; });
}
function csStale(c){ var s=csSheet(c), b=c.prep&&c.prep.builtAt; return !!(s && b && s.builtAt && b>s.builtAt); }
function csHtml(c){
  var who=csWho(c), s=csSheet(c)||{};
  var head='<div class="cshead"><div class="cswho">'+(who.length? who.map(function(p){
      return '<div class="csp"><span class="csn">'+esc(p.name)+'</span>'+(p.role? '<span class="csr">'+esc(p.role)+'</span>' : "")+'</div>'; }).join("")
    : '<div class="csp"><span class="csn csnone">Interviewer not added</span></div>')+'</div>'+
    '<div class="csmeta">'+esc([csWhen(c), c.title||mtLabel(c)].filter(Boolean).join(" · "))+'</div></div>';
  var n=0, body=csSections(c).map(function(sec){
    var ask=sec[0]==="Ask them", num=ask? "" : '<span class="csnum">'+(++n)+'</span>';
    var items=sec[1].length>1? '<ul>'+sec[1].map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul>' : '<p>'+esc(sec[1][0])+'</p>';
    return '<section class="cssec'+(ask? " csask" : "")+'"><h3>'+num+esc(sec[0])+'</h3>'+items+'</section>';
  }).join("");
  var notes=[];
  if(s.noPrep) notes.push("built without round prep");
  notes.push(s.mockId? "used your latest mock"+(s.mockType? " ("+esc(s.mockType)+")" : "") : "no mock for this role");
  if(csStale(c)) notes.push('<b>prep has changed since — Rebuild</b>');
  var foot='<div class="csfoot">Built '+esc(s.builtAt? niceShort(s.builtAt) : "—")+' · '+notes.join(" · ")+'</div>';
  return head+'<div class="csbody">'+body+'</div>'+foot;
}
function csDlg(){
  var d=el("cs-dialog"); if(d) return d;
  d=document.createElement("dialog"); d.id="cs-dialog"; d.className="csdlg";
  d.innerHTML='<div class="csbar" id="cs-bar"></div><div class="cspage" id="cs-page"></div>';
  document.body.appendChild(d);
  return d;
}
function csBar(c){
  var b=el("cs-bar"); if(!b) return;
  var busy=c && CS_BUSY[c.id];
  if(c && !csSheet(c)){ b.innerHTML='<span class="cstitle">Cheat sheet</span><span class="cssp"></span>'+
    (!busy && CS_ERR[c.id]? '<button class="btn primary" data-csact="rebuild">Try again</button>' : "")+'<button class="btn ghost" data-csact="close">Close</button>'; return; }
  b.innerHTML='<span class="cstitle">Cheat sheet</span><span class="cssp"></span>'+
    '<button class="btn ghost" data-csact="rebuild"'+(busy? " disabled" : "")+'>'+(busy? "Rebuilding…" : "Rebuild")+'</button>'+
    '<button class="btn primary" data-csact="pdf">Download PDF</button><button class="btn ghost" data-csact="docx" title="An editable copy to add your own notes to">Download Word</button><button class="btn ghost" data-csact="close">Close</button>';
}
/* While Claude writes it (or if it failed), the pop-up says so instead of the sheet. */
function csWait(c){
  return CS_BUSY[c.id]? '<div class="cswait"><div class="csspin"></div><p><b>Making your cheat sheet…</b></p><p>Claude is condensing this round\'s advice, your notes and your last mock into one page. About 15 seconds; you can close this and come back.</p></div>'
    : '<div class="cswait"><p><b>Couldn\'t make the cheat sheet.</b></p><p>'+esc(CS_ERR[c.id]||"Try again.")+'</p></div>';
}
function csOpen(id){
  var c=commitments.find(function(x){return x.id===id;}); if(!c) return;
  if(!csSheet(c) && !CS_BUSY[id] && !CS_ERR[id]){ toast("No cheat sheet for this meeting yet",true); return; }
  CS_ID=id; var d=csDlg(); csBar(c); el("cs-page").innerHTML=csSheet(c) && !CS_BUSY[id]? csHtml(c) : csWait(c);
  if(d.showModal){ if(!d.open) d.showModal(); } else d.setAttribute("open","");
}
function csClose(){ var d=el("cs-dialog"); if(d){ if(d.close) d.close(); else d.removeAttribute("open"); } CS_ID=""; }

/* ---------- making the sheet (Claude in the page) ---------- */
function csMockType(c){ var p=c.prep||{}; return p.type || (p.mock&&p.mock.type) || (typeof MKR_TYPE!=="undefined" && MKR_TYPE[c.type]) || ""; }
function csLatestMock(r,c){
  /* The latest mock of this round's type; if there is none, the role's latest mock of any type. */
  var t=csMockType(c), mine=(mocks||[]).filter(function(m){ return m.roleId===r.id && m.feedback; })
    .sort(function(a,b){ return String(b.date||b.id).localeCompare(String(a.date||a.id)); });
  return mine.filter(function(m){ return !t || m.type===t || (m.types||[]).indexOf(t)>=0; })[0] || mine[0] || null;
}
function csNorm(q){ return String(q||"").toLowerCase().replace(/\s+/g," ").trim(); }
function csQuestions(r){
  var co=(typeof coOf==="function" && coOf(r))||{}, ans={};
  [].concat(r.qAnswers||[], co.qAnswers||[]).forEach(function(a){ if(a && a.q) ans[csNorm(a.q)]=1; });
  var own=[].concat((r.enrich&&r.enrich.openQuestions)||[]);
  convsShown(r).forEach(function(v){ own=own.concat(v.nextQuestions||[]); });
  var star=[].concat(r.qStar||[], co.qStar||[]).map(csNorm);
  var all=own.concat(co.questions||[]).filter(function(q,i,a){ return q && !ans[csNorm(q)] && a.findIndex(function(x){ return csNorm(x)===csNorm(q); })===i; });
  return {starred:all.filter(function(q){ return star.indexOf(csNorm(q))>=0; }), open:all.filter(function(q){ return star.indexOf(csNorm(q))<0; })};
}
var CS_LAND={screen:"fit signals: scope match, motivation, salary or logistics stance", pm:"three competencies the ad prizes, each tied to a story",
  domain:"three domain proofs the role needs", culture:"three values they name, each with a story hook",
  livecase:"a framework prompt, the metric to anchor on, and \"clarifying questions first\"", takehome:"three headline points, plus the likely challenge to pre-empt"};
function csJson(t){ t=String(t||"").replace(/```[a-z]*|```/g,""); var a=t.indexOf("{"), b=t.lastIndexOf("}"); if(a<0||b<a) throw {code:"empty"}; return JSON.parse(t.slice(a,b+1)); }
function csClip(s){ s=String(s||"").replace(/\s+/g," ").trim(); return s.length>90? s.slice(0,88).replace(/\s+\S*$/,"")+"…" : s; }
async function csMake(id){
  var c=commitments.find(function(x){return x.id===id;}), r=csRole(c);
  if(!c || !r || CS_BUSY[id]) return;
  if(!SAMPLE){ CS_ERR[id]= SAMPLE_READY? "Asking Claude isn't available in this view." : "Still connecting to Claude, try again in a moment."; csRepaint(); return; }
  CS_BUSY[id]=true; delete CS_ERR[id]; csRepaint();
  try{
    var p=(c.prep && typeof c.prep==="object")? Object.assign({},c.prep) : {}; delete p.sheet;
    var noPrep=!Object.keys(p).filter(function(k){ return k!=="builtAt" && k!=="kind"; }).length;
    var mt=csMockType(c), lm=csLatestMock(r,c), Q=csQuestions(r), cvr={text:"",from:""};
    try{ cvr=await mkCvText(r); }catch(e){}
    var prompt=[
      "Write a one-page interview CHEAT SHEET the candidate keeps open during a live interview and glances at for under two seconds.",
      "It CONDENSES the material below. Use only facts, stories and numbers that appear below; never invent experience, and never imply anything the candidate lacks.",
      "Return ONLY a JSON object, no prose, with exactly these keys:",
      '{"opener":"", "proof":"", "whyRole":"", "whyCompany":"", "land":["","",""], "gap":"", "watch":["",""], "askThem":["","",""]}',
      "Rules:",
      "- Keywords, not sentences. Every string under 60 characters, never over 80. No full stops at the end.",
      "- opener: the first line of their 60-90 second story. proof: the one best-fit story with its numbers.",
      "- whyRole and whyCompany: one line each.",
      "- land: exactly three things to get across in THIS round. Round type \""+(mt||"unknown")+"\": "+(CS_LAND[mt]||"the three things this round most tests")+". If the latest mock shows they skipped something this round tests, make it one of the three.",
      (mt==="livecase"||mt==="takehome")? "- This is a case round: put one combined line in opener and leave proof as \"\"." : "",
      "- gap: honest framing for the must-have gap most likely to come up (from Role Fit and the prep's avoid list); if none, the next most likely probe.",
      "- watch: exactly two. First the single biggest miss from the latest mock (as a reminder, e.g. \"Name the consultancy fit early\"), then the top trap. No mock: the top two traps.",
      "- When sources compete, the most specific wins: the candidate's notes from real rounds, then the latest mock, then employer-specific traps in the prep (job ad, Role Fit gaps), then their generic watch-outs.",
      "- askThem: 3 or 4 questions. Every starred question first, word for word; then the most important open ones. Never a question already answered.",
      "",
      "=== THE ROUND ===",
      (c.title||"Interview")+(c.date? " on "+c.date : " (not booked yet)")+(c.detail? ". Detail: "+c.detail : ""),
      mkrStage(r),
      noPrep? "No prep has been written for this round yet: work from the role, the ad, Role Fit, the notes and the mock." : "Its prep: "+clip(JSON.stringify(p),3500),
      "", "=== STARRED QUESTIONS (must ask, word for word) ===", Q.starred.length? Q.starred.join("\n") : "(none)",
      "=== OTHER OPEN QUESTIONS ===", Q.open.length? Q.open.slice(0,12).join("\n") : "(none)",
      "", "=== LATEST MOCK FOR THIS ROLE ===",
      lm? "Type "+(lm.type||"?")+(lm.type && mt && lm.type!==mt? " (a different round type: use its points that still apply)" : "")+"; date "+(lm.date||"")+csMockLines(lm.feedback||{}) : "(none)",
      "", "=== THE ROLE AND COMPANY ===", roleBrief(r),
      "", "=== THE CANDIDATE ===", profileBrief(),
      "", "=== THEIR CV ("+(cvr.from||"none")+") ===", cvr.text? clip(cvr.text,5000) : "(none on the board)",
      "", mkCritBrief(r)
    ].filter(function(x){ return x!==""; }).join("\n");
    var res=await SAMPLE([{role:"user",content:prompt}],{cache:false, modelTier:"default"});
    var j=csJson(res.text);
    var one=function(v){ return csClip(Array.isArray(v)? v[0] : v); }, many=function(v,n){ return csList(v).map(csClip).filter(Boolean).slice(0,n); };
    var sheet={builtAt:today(), at:new Date().toISOString(), opener:one(j.opener), proof:one(j.proof), whyRole:one(j.whyRole), whyCompany:one(j.whyCompany),
      land:many(j.land,3), gap:one(j.gap), watch:many(j.watch,2), askThem:many(j.askThem,4), noPrep:noPrep, mockId:lm? lm.id : "", mockType:lm? (lm.type||"") : ""};
    if(!sheet.land.length && !sheet.opener) throw {code:"empty"};
    await DB.doc("commitments/"+id).update({sheet:sheet});
    c.sheet=sheet;
    toast("Cheat sheet ready");
  }catch(e){ CS_ERR[id]= e&&e.code==="empty"? "Claude sent nothing usable back. Try again." : (typeof sampleErr==="function"? sampleErr(e) : "Couldn't make it — try again"); }
  finally{ delete CS_BUSY[id]; csRepaint(); }
}

/* ---------- PDF ---------- */
/* jsPDF's built-in Helvetica only has the WinAnsi characters; map the rest so nothing prints as junk. */
function csTxt(s){
  return String(s||"").replace(/[→⇒]/g,"->").replace(/←/g,"<-").replace(/≥/g,">=").replace(/≤/g,"<=")
    .replace(/≈/g,"~").replace(/[−‐‑]/g,"-").replace(/ /g," ").replace(/[^\x00-\xff–—‘’“”•…€£]/g,"");
}
async function csPdf(id){
  var c=commitments.find(function(x){return x.id===(id||CS_ID);}); if(!c || !csSheet(c)) return;
  if(!DOWNLOADS){ toast("Downloads aren't available in this view",true); return; }
  try{
    if(!(window.jspdf && window.jspdf.jsPDF)) await loadScript(CS_JSPDF);
    var J=window.jspdf.jsPDF, W=210, H=297, M=16, CW=W-2*M;
    var who=csWho(c), secs=csSections(c), s=csSheet(c)||{};
    /* Shrink the body type until the page fits: one page is the point. */
    function lay(doc,fs,draw){
      var y=M, lh=fs*0.42;
      doc.setFont("helvetica","bold"); doc.setFontSize(fs+8);
      (who.length? who : [{name:"Interviewer not added",role:""}]).forEach(function(p){
        var w=doc.splitTextToSize(csTxt(p.name)+(p.role? "  -  "+csTxt(p.role) : ""),CW); if(draw) doc.text(w,M,y+(fs+8)*0.35); y+=w.length*(fs+8)*0.42; });
      doc.setFont("helvetica","normal"); doc.setFontSize(fs-2);
      var meta=doc.splitTextToSize(csTxt([csWhen(c), c.title||mtLabel(c)].filter(Boolean).join(" · ")),CW);
      if(draw){ doc.setTextColor(90); doc.text(meta,M,y+fs*0.35); doc.setTextColor(0); }
      y+=meta.length*(fs-2)*0.42+3;
      if(draw){ doc.setDrawColor(0); doc.setLineWidth(0.6); doc.line(M,y,W-M,y); }
      y+=5;
      var n=0;
      secs.forEach(function(sec){
        var ask=sec[0]==="Ask them";
        doc.setFont("helvetica","bold"); doc.setFontSize(fs-5);
        if(draw){ doc.setTextColor(ask? 0 : 70); doc.text((ask? "" : (++n)+"  ")+sec[0].toUpperCase(),M,y+(fs-5)*0.35); doc.setTextColor(0); }
        y+=(fs-5)*0.45+1;
        doc.setFont("helvetica","normal"); doc.setFontSize(fs);
        sec[1].forEach(function(it){
          var bul=sec[1].length>1, ind=bul? 5 : 0, w=doc.splitTextToSize(csTxt(it),CW-ind);
          if(draw){ if(bul) doc.text("•",M,y+fs*0.35); doc.text(w,M+ind,y+fs*0.35); }
          y+=w.length*lh+1.2;
        });
        y+=3.2;
      });
      return y;
    }
    var fs=20; for(; fs>11; fs--){ if(lay(new J({unit:"mm",format:"a4"}),fs,false)<=H-M-6) break; }
    var doc=new J({unit:"mm",format:"a4"}); lay(doc,fs,true);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(140); doc.text(csTxt("Built "+(s.builtAt||"")),M,H-8);
    await DOWNLOADS.save({filename:csFileName(c)+".pdf", data:new Uint8Array(doc.output("arraybuffer"))});
  }catch(e){ if(!e || e.code!=="declined") toast("Couldn't make the PDF — "+((e&&(e.code||e.message))||"try again"),true); }
}

/* The latest mock's feedback for the sheet: the short form (v2: headline, keep, improve, answers to fix) or the older one. */
function csMockLines(f){
  if(f.v===2){
    var fx=(f.perAnswer||[]).filter(function(a){ return a.rating==="fix"||a.rating==="average"; }).map(function(a){ return (a.q||"")+" -> "+(a.change||""); });
    return "\nHeadline: "+(f.headline||"-")+"\nKeep: "+((f.keep||[]).join(" | ")||"-")+"\nImprove: "+((f.improve||[]).join(" | ")||"-")+
      "\nAnswers to change: "+(fx.join(" | ")||"-")+"\nPractise next: "+(f.nextFocus||"-");
  }
  return "\nMissed: "+((f.missed||[]).map(function(m){ return (m.q||"")+" -> "+(m.use||""); }).join(" | ")||"-")+
    "\nImprove: "+((f.improve||[]).join(" | ")||"-")+"\nWatch-outs: "+((f.watchOuts||[]).join(" | ")||"-")+"\nPractise next: "+(f.nextFocus||"-");
}
function csFileName(c){
  var co=c.org||((csRole(c)||{}).company)||"", tt=c.title||mtLabel(c);
  if(co && String(tt).toLowerCase().indexOf(String(co).toLowerCase())>=0) co="";
  var nm=[co, tt, "cheat sheet"].filter(Boolean).join(" - ").replace(/[\\\/:*?"<>|]+/g,"").replace(/\s+/g," ").trim();
  return nm||"cheat sheet";
}
/* ---------- Word (8 Oct) ----------
   The same sheet as an editable .docx, built in the browser with JSZip (the library 11 already loads), so you can
   add your own notes. Same order and wording as the PDF; it isn't squeezed to one page. Nothing is stored. */
function csX(s){ return String(s==null? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function csRun(t,o){ o=o||{};
  return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'+(o.b? '<w:b/>' : "")+(o.caps? '<w:caps/>' : "")+
    (o.color? '<w:color w:val="'+o.color+'"/>' : "")+'<w:sz w:val="'+(o.sz||24)+'"/><w:szCs w:val="'+(o.sz||24)+'"/></w:rPr>'+
    '<w:t xml:space="preserve">'+csX(t)+'</w:t></w:r>'; }
function csPara(runs,o){ o=o||{};
  return '<w:p><w:pPr><w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null? 80 : o.after)+'"/>'+
    (o.ind? '<w:ind w:left="'+o.ind+'" w:hanging="'+(o.hang||0)+'"/>' : "")+(o.rule? '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="000000"/></w:pBdr>' : "")+
    '</w:pPr>'+runs+'</w:p>'; }
async function csDocx(id){
  var c=commitments.find(function(x){return x.id===(id||CS_ID);}); if(!c || !csSheet(c)) return;
  if(!DOWNLOADS){ toast("Downloads aren't available in this view",true); return; }
  try{
    if(!window.JSZip) await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
    var who=csWho(c), secs=csSections(c), s=csSheet(c)||{}, body="";
    (who.length? who : [{name:"Interviewer not added",role:""}]).forEach(function(p){
      body+=csPara(csRun(p.name,{b:true,sz:36})+(p.role? csRun("  –  "+p.role,{sz:28,color:"555555"}) : ""),{after:40}); });
    body+=csPara(csRun([csWhen(c), c.title||mtLabel(c)].filter(Boolean).join(" · "),{sz:20,color:"5A5A5A"}),{after:200,rule:true});
    var n=0;
    secs.forEach(function(sec){
      var ask=sec[0]==="Ask them";
      body+=csPara(csRun((ask? "" : (++n)+"  ")+sec[0],{b:true,caps:true,sz:18,color:ask? "000000" : "464646"}),{before:160,after:60});
      sec[1].forEach(function(it){
        body+= sec[1].length>1? csPara(csRun("•",{sz:24})+'<w:r><w:tab/></w:r>'+csRun(it,{sz:24}),{ind:360,hang:360,after:60}) : csPara(csRun(it,{sz:24}),{after:60});
      });
    });
    body+=csPara(csRun("My notes",{b:true,caps:true,sz:18,color:"464646"}),{before:280,after:60})+csPara("",{after:60});
    body+=csPara(csRun("Built "+(s.builtAt? niceShort(s.builtAt) : ""),{sz:16,color:"8C8C8C"}),{before:240,after:0});
    var doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="907" w:right="907" w:bottom="907" w:left="907" w:header="454" w:footer="454" w:gutter="0"/></w:sectPr>'+
      '</w:body></w:document>';
    var z=new window.JSZip();
    z.file("[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    z.file("_rels/.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    z.file("word/document.xml",doc);
    var bytes=await z.generateAsync({type:"uint8array",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    await DOWNLOADS.save({filename:csFileName(c)+".docx", data:bytes});
  }catch(e){ if(!e || e.code!=="declined") toast("Couldn't make the Word file — "+((e&&(e.code||e.message))||"try again"),true); }
}

/* ---------- wiring ---------- */
gcalBtn=(function(orig){ return function(c){ return csButtons(c)+orig(c); }; })(gcalBtn);
mtMeetRow=(function(orig){ return function(c,ctx){
  var h=orig(c,ctx), b=csButtons(c);
  return b? h.replace('<div class="mtbar">','<div class="csrow">'+b+'</div><div class="mtbar">') : h;
}; })(mtMeetRow);
document.addEventListener("click",function(e){
  var b=e.target.closest && e.target.closest("[data-cs]");
  if(b){ e.preventDefault(); e.stopPropagation();
    var v=b.getAttribute("data-cs"), k=v.split(":")[0], id=v.slice(k.length+1);
    if(k==="view") csOpen(id); else if(k==="pdf") csPdf(id); else if(k==="docx") csDocx(id);
    else if(k==="make"){ var p0=csMake(id); csOpen(id); return p0; }
    return; }
  var d=el("cs-dialog"); if(!d || !d.contains(e.target)) return;
  /* Clicks inside the sheet stay inside it, so the side panel behind doesn't read them as outside clicks. */
  e.stopPropagation();
  var a=e.target.closest("[data-csact]");
  if(a){ e.preventDefault(); var x=a.getAttribute("data-csact");
    if(x==="close") csClose(); else if(x==="pdf") csPdf(CS_ID); else if(x==="docx") csDocx(CS_ID); else if(x==="rebuild") csMake(CS_ID); return; }
  if(e.target===d){ var r=d.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) csClose(); }
},true);
(function(){
  var st=document.createElement("style");
  st.textContent=".cswait{max-width:520px;margin:60px auto;text-align:center;font-size:15px;line-height:1.5;color:var(--ink-2,#444)}.cswait p{margin:6px 0}"+
    ".csspin{width:28px;height:28px;margin:0 auto 14px;border:3px solid var(--line,#ddd);border-top-color:var(--accent,#0f766e);border-radius:50%;animation:csspin .9s linear infinite}@keyframes csspin{to{transform:rotate(360deg)}}"+
    
    ".csrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}.csrow .cserr,.cserr{font-size:12px;color:var(--bad,#b42318)}"+
    ".csdlg{width:min(860px,100vw);max-width:100vw;max-height:100vh;height:100vh;margin:0 auto;padding:0;border:0;background:#fff;color:#111}"+
    ".csdlg::backdrop{background:rgba(0,0,0,.55)}"+
    ".csbar{position:sticky;top:0;display:flex;align-items:center;gap:8px;padding:10px 16px;background:#fff;border-bottom:1px solid #ddd;z-index:1}"+
    ".csbar .cstitle{font-weight:600;font-size:14px;color:#555}.csbar .cssp{flex:1}"+
    ".cspage{padding:20px 28px 40px;font-size:22px;line-height:1.3}"+
    ".cshead{border-bottom:3px solid #111;padding-bottom:10px;margin-bottom:14px}"+
    ".cswho .csp{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}"+
    ".cswho .csn{font-size:34px;font-weight:700;letter-spacing:-.01em}.cswho .csnone{color:#999}"+
    ".cswho .csr{font-size:22px;color:#444}.csmeta{font-size:18px;color:#555;margin-top:4px}"+
    ".cssec{margin:0 0 14px}.cssec h3{margin:0 0 2px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;display:flex;gap:8px;align-items:center}"+
    ".cssec .csnum{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#111;color:#fff;font-size:11px;letter-spacing:0}"+
    ".cssec p{margin:0}.cssec ul{margin:0;padding-left:1.1em}.cssec li{margin:0 0 2px}"+
    ".csask{border-top:2px solid #111;padding-top:10px;margin-top:6px}.csask h3{color:#111}"+
    ".csfoot{margin-top:18px;font-size:12px;color:#888}.csfoot b{color:#b42318;font-weight:600}"+
    "@media (max-width:560px){.cspage{padding:14px 16px 30px;font-size:19px}.cswho .csn{font-size:28px}.cswho .csr{font-size:18px}.csbar{flex-wrap:wrap}}"+
    "@media print{body>*:not(#cs-dialog){display:none!important}.csbar{display:none}.csdlg{position:static;height:auto}}";
  document.head.appendChild(st);
})();
