"use strict";
/* ===== Mock interview: the case box (16 Oct) =====
   Live case and take-home rounds run from one box instead of Focus and Length:
   - Take-home: the brief the candidate was sent. The panel uses it as written; the mock is practice at presenting it.
     Required: Start says "Add the brief to start" while the box is empty.
   - Live case: how the invite says the exercise runs (the case itself is given on the day). The interviewer writes a
     mock case that fits. Empty is allowed: a standard 45-minute product case.
   The box fills itself in this order: the round's interview materials (a case-looking one, or one for this meeting),
   then, for a live case only, what the board knows about the round (meeting details, round prep, the company's
   interview research, the ad's hiring process). A take-home never prefills from the board: that isn't the brief.
   Upload reads Word (via 16's maWordToMd), PDF (pdf.js from cdnjs), Markdown or text into the box.
   "Save to this round's interview materials" (on by default) keeps what was pasted or uploaded as a text material,
   scoped to the round's meeting (else the role), so prep, the cheat sheet and the next mock read it too. */
var CB={key:"", auto:"", src:"", srcLab:"", matId:"", busy:false, err:"", minsTouched:false, minsAuto:""};
var CB_RE=/case|take[- ]?home|brief|exercise|assignment|presentation|whiteboard|task/i;
function cbKind(){ var s=(MKT&&MKT.sel)||[]; return s.length===1 && MK_CASE[s[0]]? s[0] : ""; }
function cbRole(){ var v=el("mk-role") && el("mk-role").value; return v? roles.find(function(x){ return x.id===v; })||null : null; }
function cbMeet(r){
  if(!r) return null;
  try{ var R=mkfRound(r); return R.c||null; }catch(e){ return (mkrInfo(r).next)||null; }
}
/* Interview materials that look like this round's case: meeting-scoped ones for this round first, then any whose
   title, format or points read like a case brief or exercise instructions. */
function cbMats(r,c){
  if(!r || typeof maForRole!=="function") return [];
  var ms=maForRole(r).filter(function(m){ return m.kind!=="link" && (m.scopeKind!=="meeting" || !c || m.meetingId===c.id); });
  function looks(m){ var g=m.digest||{}; return CB_RE.test([m.title, m.note, g.format].concat(g.points||[]).join(" ")); }
  return ms.filter(function(m){ return (c && m.scopeKind==="meeting" && m.meetingId===c.id) || looks(m); })
    .sort(function(a,b){ return ((b.scopeKind==="meeting")-(a.scopeKind==="meeting")) || ((looks(b)?1:0)-(looks(a)?1:0)); });
}
function cbDigestText(m){
  var g=m.digest||{}, b=[];
  if(g.format) b.push("Format: "+g.format);
  if((g.questions||[]).length) b.push("Questions or tasks: "+g.questions.join("; "));
  if((g.assesses||[]).length) b.push("What they assess: "+g.assesses.join("; "));
  if((g.points||[]).length) b.push("Key points:\n- "+g.points.join("\n- "));
  return b.join("\n");
}
/* What the board knows about how a live case runs, for when there's no material. */
function cbBoardText(r,c){
  if(!r) return "";
  var b=[], co=coOf(r)||{}, intel=co.interviewIntel||{}, ad=r.adSummary, p={};
  try{ p=mkfRound(r).p||{}; }catch(e){}
  if(c){ var h=[c.title, c.duration? c.duration+" minutes" : ""].filter(Boolean).join(", "); if(h) b.push("The round: "+h);
    if(c.detail) b.push("Meeting details: "+c.detail); }
  if(p.tests) b.push("What the round tests: "+p.tests);
  if(intel.notes) b.push("How they interview: "+clip(intel.notes,600));
  if(ad && typeof ad==="object" && !ad.removed && ad.process) b.push("Hiring process in the ad: "+ad.process);
  return b.join("\n");
}
/* Fills the box when the role, round or type changes, unless the user has typed in it. */
async function cbFill(force){
  var k=cbKind(), box=el("mk-case"); if(!box || MK.on) return;
  var r=cbRole(), c=cbMeet(r), key=k+"|"+(r? r.id : "")+"|"+(c? c.id : "");
  var untouched=!box.value.trim() || box.value===CB.auto;
  if(!force && key===CB.key) return;
  CB.key=key; CB.err="";
  if(!k){ cbPaint(); return; }
  if(!untouched && !force){ cbPaint(); return; }
  var text="", src="", lab="", mid="";
  var m=cbMats(r,c)[0];
  if(m){
    mid=m.id;
    if(m.kind==="text" && m.text){ text=m.text; src="mat"; lab="From your interview materials: "+(m.title||"Untitled"); }
    else if(m.kind==="file" && m.file && m.file.id && /markdown|text\/plain/.test(m.file.type||"")){
      try{ var res=await fetch("/_blob/"+m.file.id); if(res.ok){ text=await res.text(); src="mat"; lab="From your interview materials: "+(m.title||m.file.name||"Untitled"); } }catch(e){}
    }
    if(!text && m.digest){ text=cbDigestText(m); src="matsum"; lab="Claude's summary of "+(m.title||"your material")+" — paste the full "+(k==="takehome"? "brief" : "instructions")+" for the best mock"; }
    if(!text){ src=""; lab=""; mid=""; }
  }
  if(!text && k==="livecase"){ text=cbBoardText(r,c); if(text){ src="board"; lab="From your board — check it against the invite"; } }
  if(CB.key!==key || MK.on) return;   /* the role or type changed while a file was being read */
  box.value=text; CB.auto=text; CB.src=src; CB.srcLab=lab; CB.matId=mid;
  cbTimer(c,k);
  cbPaint();
}
/* The timer follows the round's own length (else 45 for a live case, 60 for a take-home) until it's changed by hand. */
function cbTimer(c,k){
  var sel=el("mk-mins"); if(!sel || CB.minsTouched) return;
  var want=(c && +c.duration) || (k==="takehome"? 60 : 45);
  var opts=Array.prototype.map.call(sel.options,function(o){ return +o.value; }).filter(function(v){ return v>0; }).sort(function(a,b){ return a-b; });
  var pick=opts.find(function(v){ return v>=want; })||opts[opts.length-1];
  if(pick){ sel.value=String(pick); CB.minsAuto=String(pick); }
}
function cbPaint(){
  var k=cbKind(), wrap=el("mk-casewrap"); if(!wrap) return;
  wrap.hidden=!k;
  /* Focus, its Sharpen bar and Length hide by a class on the form (CSS), so 37's own redraws can't bring them back. */
  var fl=el("mk-focus") && el("mk-focus").closest("label"); if(fl) fl.classList.add("mkfoc");
  var ms=el("mock-setup"); if(ms) ms.classList.toggle("mkcasemode",!!k);
  if(!k){ return; }
  var r=cbRole(), box=el("mk-case"), t=box.value.trim();
  el("mk-caselab").textContent= k==="takehome"? "Case study brief — paste it from the invite" : "How the exercise runs — paste the invite's instructions";
  box.placeholder= k==="takehome"? "Paste the brief exactly as they sent it: the context, the ask, the deliverables, how long you present for." :
    "e.g. 45 minutes on a whiteboard with two PMs: a product improvement case, 10 minutes to prepare, then discussion. The case itself is given on the day.";
  var src=el("mk-casesrc"), edited=t && box.value!==CB.auto;
  src.textContent= CB.busy? "Reading the file…" : edited? (CB.src==="file"? CB.srcLab+" · edited by you" : CB.auto? "Edited by you" : "") : (CB.srcLab||"");
  src.className="mkcsrc"+(CB.err? " err" : "");
  if(CB.err) src.textContent=CB.err;
  var help=el("mk-casehelp");
  if(k==="takehome") help.textContent= t? "The panel uses this as written. You present it, then take their questions; feedback covers your delivery as well as the content." :
    "Nothing in this round's interview materials. Paste the brief or upload the file (Word, PDF, Markdown or text) — the mock needs your real brief to start.";
  else help.textContent= t? "The interviewer writes a mock case that fits these rules, set in the company's own product. You won't see the case until it starts." :
    "Nothing found for this round. Paste the invite's instructions, or leave it empty for a standard 45-minute product case.";
  var sw=el("mk-casesavewrap"), canSave= !!r && !!DB && !!t && (CB.src!=="mat" || edited) && t.length<=MA_MAXTEXT;
  sw.hidden=!canSave;
  var c=cbMeet(r);
  if(canSave) sw.lastChild.nodeValue=" Save to "+(c? "this round's" : "this role's")+" interview materials";
  var up=el("mk-caseup"); if(up) up.classList.toggle("disabled",CB.busy);
  var hint=el("mk-hint");
  if(hint && hint.dataset.cb && (t || k!=="takehome")){ hint.textContent=""; delete hint.dataset.cb; }
}
/* Called by 13's mkStart. Returns false to stop the start. */
function cbBeforeStart(){
  var k=cbKind(); MK.caseKind=k; MK.caseText="";
  if(!k) return true;
  var box=el("mk-case"), t=(box.value||"").trim(), hint=el("mk-hint");
  if(CB.busy){ hint.textContent="Still reading the file — one moment."; return false; }
  if(k==="takehome" && !t){ hint.textContent="Add the brief to start: paste it, or upload the file."; hint.dataset.cb="1"; box.focus(); return false; }
  MK.caseText=t;
  var sw=el("mk-casesavewrap");
  if(t && sw && !sw.hidden && el("mk-casesave").checked) cbSave(t,k);
  return true;
}
function cbSave(t,k){
  var r=cbRole(); if(!r || !DB) return;
  var c=cbMeet(r), title=k==="takehome"? "Case study brief" : "Live case instructions";
  var doc={title:title, kind:"text", note:"Added from Mock interview", scopeKind:c? "meeting" : "role",
    companyId:maRoleCo(r)||"", roleId:r.id, meetingId:c? c.id : "", text:t.slice(0,MA_MAXTEXT), addedAt:today()};
  var id=slug(title)+"-"+Date.now().toString(36).slice(-5);
  DB.doc("materials/"+id).set(doc).then(function(){
    CB.auto=el("mk-case").value; CB.src="mat"; CB.matId=id; CB.srcLab="From your interview materials: "+title;
    toast("Saved to "+(c? "this round's" : "this role's")+" interview materials");
    cbPaint();
  }).catch(function(e){ toast("Couldn't save it to interview materials ("+((e&&e.code)||"write failed")+") — the mock still runs",true); });
}
/* Upload: Word, PDF, Markdown or text, read into the box (nothing is stored until Start, and only as text). */
var CB_PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
async function cbPdfText(file){
  if(!window.pdfjsLib) await loadScript(CB_PDFJS);
  var lib=window.pdfjsLib; if(!lib) throw {code:"pdf_failed"};
  lib.GlobalWorkerOptions.workerSrc=CB_PDFJS.replace("pdf.min.js","pdf.worker.min.js");
  var pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise, out=[];
  for(var i=1;i<=pdf.numPages;i++){
    var tc=await (await pdf.getPage(i)).getTextContent(), line="", lines=[], lastY=null;
    tc.items.forEach(function(it){ var y=it.transform? Math.round(it.transform[5]) : null;
      if(lastY!==null && y!==null && Math.abs(y-lastY)>2){ lines.push(line.trim()); line=""; }
      line+=(line && !/\s$/.test(line)? " " : "")+it.str; lastY=y; });
    if(line.trim()) lines.push(line.trim());
    out.push(lines.filter(Boolean).join("\n"));
  }
  return out.join("\n\n").replace(/[ \t]{2,}/g," ").trim();
}
async function cbRead(file){
  var ext=String(file.name.split(".").pop()||"").toLowerCase();
  if(ext==="docx") return await maWordToMd(file);
  if(ext==="pdf") return await cbPdfText(file);
  if(ext==="md" || ext==="txt") return await file.text();
  throw {code:"type", msg: /^pptx?$|^key$/.test(ext)? "PowerPoint can't be read here. Export it as a PDF, then upload that." : "Use a Word, PDF, Markdown or text file."};
}
async function cbUpload(file){
  if(!file || CB.busy) return;
  if(file.size>MA_WORD_MAX){ CB.err="That file is over 20 MB — too big to read here. Paste the text instead."; cbPaint(); return; }
  CB.busy=true; CB.err=""; cbPaint();
  try{
    var t=String(await cbRead(file)||"").trim();
    if(!t) throw {code:"empty", msg:"No text came out of that file (a scanned PDF?). Paste the text instead."};
    if(MK.on) return;
    el("mk-case").value=t; CB.auto=t; CB.src="file"; CB.srcLab="From "+file.name+" — check it reads right"; CB.matId="";
    if(t.length>MA_MAXTEXT) CB.srcLab+=" (too long to save to materials; the mock reads the first part)";
  }catch(e){
    CB.err=(e&&e.msg) || (e&&e.code==="convert_failed"? "Couldn't read that Word file. Save it as a PDF or paste the text." : "Couldn't read that file. Paste the text instead.");
  }finally{ CB.busy=false; cbPaint(); }
}
/* Hooks: role change and round prefill (mockSuggest), type changes (mkTypesPaint), Practise from a meeting (openMockFor). */
mockSuggest=(function(orig){ return function(){ orig(); try{ cbFill(false); }catch(e){ console.warn("case box",e); } }; })(mockSuggest);
mkTypesPaint=(function(orig){ return function(){ orig(); try{ cbFill(false); }catch(e){ console.warn("case box",e); } }; })(mkTypesPaint);
openMockFor=(function(orig){ return function(roleId,cid){ orig(roleId,cid); if(MK.on) return; CB.minsTouched=false; try{ cbFill(true); }catch(e){ console.warn("case box",e); } }; })(openMockFor);
if(el("mk-role")) el("mk-role").addEventListener("change",function(){ CB.minsTouched=false; });
if(el("mk-mins")) el("mk-mins").addEventListener("change",function(){ CB.minsTouched=true; });
if(el("mk-case")) el("mk-case").addEventListener("input",function(){ CB.err=""; cbPaint(); });
if(el("mk-casefile")) el("mk-casefile").addEventListener("change",function(ev){ var f=ev.target.files && ev.target.files[0]; ev.target.value=""; cbUpload(f); });
try{ cbFill(true); }catch(e){}
