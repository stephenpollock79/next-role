"use strict";
/* ---------- Word files on the board (1 Oct, cloud move) ----------
   Templates live in `templates/cv` and `templates/letter`; a role's pack lives in `packs/<roleId>` as
   {cv:{name,size,sha256,b64}, letter:{...}, builtAt}. The role keeps the small `pack` summary
   (stored:"board"). Bytes round-trip unchanged: base64 in, base64 out. */
var TEMPLATES={}, DOWNLOADS=null;
(async function(){ try{ DOWNLOADS = window.claude && window.claude.use ? await window.claude.use("downloads") : null; }catch(e){ DOWNLOADS=null; } })();
function packReady(r){ var p=r&&r.pack; return !!(p && (p.folder || p.stored==="board")); }
function b64ToBytes(b){ var s=atob(b), u=new Uint8Array(s.length); for(var i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
function bytesToB64(u){ var out="", CH=0x8000; for(var i=0;i<u.length;i+=CH) out+=String.fromCharCode.apply(null,u.subarray(i,i+CH)); return btoa(out); }
async function sha256hex(u){ var h=await crypto.subtle.digest("SHA-256",u); return Array.prototype.map.call(new Uint8Array(h),function(x){return ("0"+x.toString(16)).slice(-2);}).join(""); }
function kb(n){ return n? (n>=1024? Math.round(n/1024)+" KB" : n+" B") : ""; }
async function fileOf(src,kind){
  if(src==="tpl") return TEMPLATES[kind]||null;
  if(String(src).indexOf("final:")===0){ var fs=await DB.doc("finals/"+src.slice(6)).get(); var fd=fs&&fs.exists? fs.data() : null; return fd? fd[kind] : null; }
  var snap=await DB.doc("packs/"+src).get(); var d=snap&&snap.exists? snap.data() : null; return d? d[kind] : null;
}
async function saveDoc(f){
  if(!f || (!f.b64 && !f.assetId)){ toast("Not on the board yet",true); return; }
  if(!DOWNLOADS){ toast("Downloads aren't available in this view",true); return; }
  try{
    var data;
    if(f.assetId){ var res=await fetch("/_blob/"+f.assetId); if(!res.ok){ toast("This file is missing from the file store — upload it again",true); return; } data=new Uint8Array(await res.arrayBuffer()); }
    else data=b64ToBytes(f.b64);
    await DOWNLOADS.save({filename:f.name||"document.docx", data:data}); }
  catch(e){ if(!e || e.code!=="declined") toast("Couldn't download — "+((e&&e.code)||"try again"),true); }
}
var PV_FILE=null;
function loadScript(u){ return new Promise(function(ok,no){ var x=document.createElement("script"); x.src=u; x.onload=ok; x.onerror=no; document.head.appendChild(x); }); }
async function previewDoc(f,title){
  PV_FILE=f; el("pv-title").textContent=title||"Preview"; el("pv-body").innerHTML=""; el("pv-hint").textContent="Loading…";
  var d=el("pv-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  if(!f||(!f.b64 && !f.assetId)){ el("pv-hint").textContent="Not on the board yet."; return; }
  try{
    if(!window.JSZip) await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
    if(!window.docx) await loadScript("https://cdn.jsdelivr.net/npm/docx-preview@0.3.5/dist/docx-preview.min.js");
    /* Final versions live in the file store since 5 Oct (`assetId`); packs and templates still carry b64. */
    var buf;
    if(f.assetId){ var res=await fetch("/_blob/"+f.assetId); if(!res.ok){ el("pv-hint").textContent="This file is missing from the file store. Upload it again."; return; } buf=await res.arrayBuffer(); }
    else buf=b64ToBytes(f.b64).buffer;
    await window.docx.renderAsync(buf, el("pv-body"), null, {inWrapper:true, renderChanges:true, ignoreLastRenderedPageBreak:true, experimental:true});
    fitPreview();
    el("pv-hint").textContent="Tracked changes show as insertions and deletions. Download to accept or reject them in Word.";
  }catch(e){ console.warn(e); el("pv-hint").textContent="Couldn't preview this file here. Download it to open in Word."; }
}
el("pv-dl").addEventListener("click",function(){ saveDoc(PV_FILE); });
/* Uploaded files (prep materials, job specs) open here, not in a new tab (2 Oct): an asset's
   "/_blob/<id>" path only resolves inside the board, so a new tab showed "not found". Markdown and text
   are rendered; images and PDFs are shown inline; Download saves the original. */
async function previewAsset(id,name,type,title){
  PV_FILE={assetId:id, name:name||"file"}; el("pv-title").textContent=title||name||"File"; el("pv-body").innerHTML=""; el("pv-body").classList.remove("fit");
  el("pv-hint").textContent="Loading…";
  var d=el("pv-dialog"); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  var u="/_blob/"+id, t=String(type||"").toLowerCase(), n=String(name||"").toLowerCase();
  try{
    if(/^image\//.test(t)){ el("pv-body").innerHTML='<img class="pvimg" alt="" src="'+esc(u)+'">'; el("pv-hint").textContent=""; return; }
    if(t==="application/pdf" || /\.pdf$/.test(n)){ el("pv-body").innerHTML='<iframe class="pvpdf" title="'+esc(name||"PDF")+'" src="'+esc(u)+'"></iframe>'; el("pv-hint").textContent="If the PDF doesn't show here, use Download."; return; }
    var res=await fetch(u); if(!res.ok) throw new Error("http "+res.status);
    var txt=await res.text();
    var md=false;
    if(t==="text/markdown" || /\.md$/.test(n)){
      try{
        if(!window.marked) await loadScript("https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js");
        if(!window.DOMPurify) await loadScript("https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js");
        el("pv-body").innerHTML='<div class="pvtext md">'+window.DOMPurify.sanitize(window.marked.parse(txt))+'</div>'; md=true;
      }catch(e2){ console.warn("markdown renderer",e2); }   /* falls back to plain text */
    }
    if(!md) el("pv-body").innerHTML='<pre class="pvtext">'+esc(txt)+'</pre>';
    el("pv-hint").textContent="";
  }catch(e){ console.warn("asset preview",e); el("pv-hint").textContent="Couldn't show this file here. Use Download to open it."; }
}
document.addEventListener("click",function(ev){
  var a=ev.target.closest && ev.target.closest('[data-act="asset_open"]'); if(!a) return;
  ev.preventDefault(); ev.stopPropagation();
  previewAsset(a.dataset.aid, a.dataset.name, a.dataset.type, a.dataset.title);
},true);
function assetLink(f,label,cls,title){
  return '<a href="#" data-act="asset_open" data-aid="'+esc(f.id)+'" data-name="'+esc(f.name||"")+'" data-type="'+esc(f.type||"")+'" data-title="'+esc(title||f.name||"")+'"'+(cls? ' class="'+cls+'"' : "")+'>'+label+'</a>';
}
/* Word pages are a fixed A4 width; shrink the whole page to the box instead of clipping or reflowing it. */
function fitPreview(){
  var body=el("pv-body"), wr=body && body.querySelector(".docx-wrapper"), sec=wr && wr.querySelector("section.docx");
  if(!sec) return;
  wr.style.transform=""; wr.style.marginBottom=""; wr.style.width="";
  var w=sec.offsetWidth, avail=body.clientWidth-12, sc=Math.min(1, avail/w);
  wr.style.width=w+"px";
  if(sc<1){ wr.style.transform="scale("+sc+")"; wr.style.marginBottom=(-(1-sc)*wr.offsetHeight)+"px"; body.classList.add("fit"); }
  else body.classList.remove("fit");
}
window.addEventListener("resize",function(){ var d=el("pv-dialog"); if(d && d.open) fitPreview(); });
/* My CV & letter (3 Oct; was "Templates"). The base CV is a tailoring base AND evidence: on upload its text is
   kept beside the file (`text`, `textAt`), and Role Fit, interview prep and mock-interview feedback read it
   (evidence order: profile/skills -> CV text -> profile/me). About me keeps the facts the board uses as
   settings (name, location, profession, right to work...) plus what the CV doesn't say. `cvCheck` flags when
   the CV and About me disagree on name, city or last employer; it never overwrites About me. */
/* Word file to plain Markdown for reading as evidence. CVs are often laid out in tables (a side column of
   skills, a main column of roles); the shared converter squashes each cell onto one line, so layout tables
   are unwrapped into their cells' content first. */
async function docTextOf(blob){
  if(!window.mammoth) await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js");
  var res=await window.mammoth.convertToHtml({arrayBuffer: await blob.arrayBuffer()});
  var root=new DOMParser().parseFromString("<div>"+(res.value||"")+"</div>","text/html").body.firstChild, t;
  while((t=root.querySelector("table"))){
    var frag=document.createDocumentFragment();
    t.querySelectorAll(":scope > tbody > tr > td, :scope > tr > td, :scope > thead > tr > td").forEach(function(td){ while(td.firstChild) frag.appendChild(td.firstChild); });
    t.parentNode.replaceChild(frag,t);
  }
  return htmlToMd(root.innerHTML).trim();
}
function cvCheck(){
  var t=TEMPLATES.cv && TEMPLATES.cv.text, p=PROFILE; if(!t||!p) return [];
  var low=t.toLowerCase(), out=[];
  function chk(label,val){ val=String(val||"").trim(); if(val && low.indexOf(val.toLowerCase())<0) out.push(label+" “"+val+"”"); }
  chk("Name",p.name);
  chk("Location",String(p.location||"").split(",")[0]);
  var lr=String(p.lastRole||""), emp=lr.indexOf(",")>-1? lr.slice(lr.lastIndexOf(",")+1) : "";
  chk("Last employer",emp);
  return out;
}
function templatesPanel(){
  function row(k,label){
    var t=TEMPLATES[k];
    var txt=t? (t.text? ' · text read'+(t.textAt? ' '+esc(niceShort(t.textAt)) : "") : ' · <span style="color:var(--warn,#b45309)">text not read — Replace to read it</span>') : "";
    return '<div class="docrow"><div class="dn"><b>'+esc(label)+'</b><span>'+(t? esc(t.name)+' · '+kb(t.size)+(t.updatedAt? ' · updated '+esc(niceShort(t.updatedAt)) : "")+txt : "Not uploaded yet")+'</span></div>'+
      '<div class="row">'+(t? '<button type="button" class="btn sm" data-act="doc_pv" data-src="tpl" data-kind="'+k+'">Preview</button><button type="button" class="btn sm" data-act="doc_dl" data-src="tpl" data-kind="'+k+'">Download</button>' : "")+
      '<button type="button" class="btn sm" data-act="tpl_up" data-kind="'+k+'">'+(t? "Replace" : "Upload")+'</button></div></div>';
  }
  var mis=cvCheck();
  return '<div class="card panel"><div class="sechead"><span class="eyebrow">My CV &amp; letter</span></div>'+
    '<p class="lede" style="font-size:12.5px;margin:0 0 4px">Your base CV and cover letter. Every tailored CV starts from them, as tracked changes. '+
    'Claude also reads your CV as evidence of your experience: for Role Fit, interview prep and mock-interview feedback. '+
    'Put what your CV doesn’t say (skills you leave off, fuller stories, watch-outs) in <a href="#" data-goabout="static">Static info</a> or <a href="#" data-goabout="skills">Skills</a>. Replacing a file keeps the old version as a backup.</p>'+
    (mis.length? '<div class="notice warn" style="font-size:12.5px">Your CV and About me disagree: '+esc(mis.join(" · "))+' isn’t in the CV. Check which is right; nothing is changed for you.</div>' : "")+
    row("cv","CV")+row("letter","Cover letter")+'</div>';
}
function packFileRow(r,k,label,name){
  return '<div class="docrow"><div class="dn"><b>'+esc(label)+'</b><span>'+esc(name||"")+'</span></div>'+
    '<div class="row"><button type="button" class="btn sm" data-act="doc_pv" data-src="'+esc(r.id)+'" data-kind="'+k+'">Preview</button>'+
    '<button type="button" class="btn sm primary" data-act="doc_dl" data-src="'+esc(r.id)+'" data-kind="'+k+'">Download</button></div></div>';
}
/* Final versions (1 Oct, evening). The pack is the starting draft; the user iterates in Word with
   Claude, sends, and uploads what the user actually sent. Bytes in `finals/<roleId>` {cv,letter};
   the role keeps a small `final` summary for rendering. Interview prep reads the finals.
   Replaces the old "Notes for Claude" box (packNotes stays stored, unused). */
function finalCount(r){ var f=r.final||{}; return (f.cv?1:0)+(f.letter?1:0); }
function finalBox(r,sentView,bare){
  var f=r.final||{}, hasPack=!!(r.pack && r.pack.stored==="board");
  function row(k,label){
    var t=f[k], src="final:"+r.id, isDocx=t && /\.docx$/i.test(t.name||"");
    /* "Use the proposed one" (5 Oct): when what you sent is the tailored draft as it stands, copy it in instead of uploading it. */
    var canPack=!t && hasPack && !!r.pack[k];
    var meta=t? esc(t.name)+' · '+kb(t.size)+(t.at? (t.fromPack? ' · the proposed draft, marked sent ' : ' · uploaded ')+esc(niceShort(t.at)) : "") : "Not uploaded yet";
    return '<div class="docrow"><div class="dn"><b>'+esc(label)+'</b><span>'+meta+'</span></div>'+
      '<div class="row">'+(t? (isDocx? '<button type="button" class="btn sm" data-act="doc_pv" data-src="'+src+'" data-kind="'+k+'">Preview</button>' : "")+
        '<button type="button" class="btn sm" data-act="doc_dl" data-src="'+src+'" data-kind="'+k+'">Download</button>' : "")+
      (canPack? '<button type="button" class="btn sm primary" data-act="fin_pack" data-id="'+esc(r.id)+'" data-kind="'+k+'" title="You sent the tailored draft as proposed: keep it as the final version, tracked changes accepted">Use the proposed one</button>' : "")+
      '<button type="button" class="btn sm'+(t||canPack? "" : " primary")+'" data-act="fin_up" data-id="'+esc(r.id)+'" data-kind="'+k+'">'+(t? "Replace" : "Upload")+'</button></div></div>';
  }
  var coN=esc(coOf(r)&&coOf(r).name || r.company || "this company");
  return '<div class="finalbox ovsec">'+(bare? "" : '<span class="eyebrow">Final version — what you sent</span>')+
    (sentView? '<p class="secintro" style="margin:2px 0 4px">The CV and cover letter that went to '+coN+'. Interview prep reads these, so upload them if they’re not here yet.</p>'
    : '<p class="secintro" style="margin:2px 0 4px">Download the CV and letter above and treat them as the starting draft. '+
      'Iterate on them with Claude in Word, or attach them to a Claude chat. When they’re ready and sent, upload the final versions here. '+
      'Interview prep reads these, and they’re the record of what went to '+coN+'.</p>')+
    row("cv","Final CV")+row("letter","Final cover letter")+
    '<div class="statushint">Word or PDF, up to '+FIN_MAX_MB+' MB each. Sent the tailored draft as it stands? Use the proposed one instead of uploading. Replacing keeps the previous version as a backup.</div></div>';
}
var FIN_TGT=null, FIN_MAX_MB=10;
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="fin_up"]'); if(!b) return;
  ev.preventDefault(); FIN_TGT={id:b.dataset.id, kind:b.dataset.kind};
  var fi=el("final-file"); fi.value=""; fi.click();
});
/* Saving a final, shared by Upload and "Use the proposed one". Files go to the artifact's file store (5 Oct);
   `finals/<roleId>` keeps only a pointer per file {name, mime, size, sha256, assetId, at, source, fromPack?}, so the
   256 KiB record cap no longer limits it. Older records may still carry `b64`; every reader handles both. The previous
   version's pointer moves to `finalsprev/<roleId>`; the one before that is deleted from the file store, since nothing
   points at it. */
/* 5 Oct fix: the file store refuses Word files (`unsupported_type`; it takes PDFs, images and text only), so a
   .docx final is kept in the record as base64, as before version 454; PDFs still go to the file store. Every
   reader already handles both shapes. FIN_B64_MAX keeps the CV and letter together under the 256 KiB record cap. */
var FIN_B64_MAX=240000;
var FIN_DOCX="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
async function finSave(t,u,name,mime,source,fromPack){
  var sha=await sha256hex(u);
  var snap=await DB.doc("finals/"+t.id).get(), cur=snap&&snap.exists? snap.data() : {};
  var rec={name:name, mime:mime, size:u.length, sha256:sha, at:today(), source:source};
  if(mime===FIN_DOCX){
    var b64=bytesToB64(u), other=cur[t.kind==="cv"? "letter" : "cv"], otherLen=other&&other.b64? other.b64.length : 0;
    if(b64.length+otherLen>FIN_B64_MAX){ var big=new Error("too_big"); big.code="too big for a Word file — upload it as a PDF"; throw big; }
    rec.b64=b64;
  } else {
    if(!ASSETS){ var na=new Error("no_assets"); na.code="needs edit access"; throw na; }
    var up=await ASSETS.upload(new Blob([u],{type:mime}), {type:mime}); rec.assetId=up.id;
  }
  if(fromPack) rec.fromPack=true;
  var drop=null;
  if(cur[t.kind]){ try{ var pp={}; pp[t.kind]=cur[t.kind]; var ps=await DB.doc("finalsprev/"+t.id).get(), pd=ps&&ps.exists? ps.data() : {};
    if(pd[t.kind] && pd[t.kind].assetId && pd[t.kind].assetId!==(cur[t.kind].assetId||"")) drop=pd[t.kind].assetId;
    if(ps&&ps.exists) await DB.doc("finalsprev/"+t.id).update(pp); else await DB.doc("finalsprev/"+t.id).set(pp); }
    catch(e1){ console.warn("backup of previous final skipped",e1); drop=null; } }
  var nd=Object.assign({},cur); delete nd.cvPrev; delete nd.letterPrev; nd[t.kind]=rec;
  try{ await DB.doc("finals/"+t.id).set(nd); }
  catch(ef){ if(rec.assetId && ASSETS) ASSETS.delete(rec.assetId).catch(function(){}); throw ef; }   /* no orphaned upload */
  if(drop) ASSETS.delete(drop).catch(function(e2){ console.warn("old final not removed",e2&&e2.code); });
  var sum={final:{}}; sum.final[t.kind]={name:name, size:u.length, at:today()}; if(fromPack) sum.final[t.kind].fromPack=true;
  await DB.doc("roles/"+t.id).update(sum);
}
el("final-file").addEventListener("change",async function(){
  var file=this.files&&this.files[0], t=FIN_TGT; if(!file||!t||!DB) return;
  var isPdf=/\.pdf$/i.test(file.name);
  if(!/\.(docx|pdf)$/i.test(file.name)){ toast("Upload a Word .docx or a PDF",true); return; }
  if(!ASSETS){ toast("Uploading needs edit access to the board",true); return; }
  if(file.size>FIN_MAX_MB*1024*1024){ toast("Too big — up to "+FIN_MAX_MB+" MB per file",true); return; }
  try{
    var mime=isPdf? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await finSave(t, new Uint8Array(await file.arrayBuffer()), file.name, mime, "Uploaded on the board", false);
    toast("Final "+(t.kind==="cv"? "CV" : "cover letter")+" saved");
  }catch(e){ console.warn(e); toast("Upload failed"+(e&&e.code? " ("+e.code+")" : "")+" — try again",true); }
});
/* Accept every tracked change in a .docx (5 Oct): what you sent is the draft with its changes accepted. Insertions
   are kept, deletions dropped, and formatting-change records removed, in the document body and its headers,
   footers, footnotes and endnotes. Comments are left alone. */
var W_NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
function wAcceptXml(xml){
  var doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length) throw new Error("xml");
  function all(tag){ return Array.prototype.slice.call(doc.getElementsByTagNameNS(W_NS,tag)); }
  ["del","moveFrom"].forEach(function(tag){ all(tag).forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); }); });
  ["ins","moveTo"].forEach(function(tag){ all(tag).forEach(function(n){ var p=n.parentNode; if(!p) return; while(n.firstChild) p.insertBefore(n.firstChild,n); p.removeChild(n); }); });
  ["rPrChange","pPrChange","sectPrChange","tblPrChange","trPrChange","tcPrChange","tblGridChange","numberingChange",
   "moveFromRangeStart","moveFromRangeEnd","moveToRangeStart","moveToRangeEnd"].forEach(function(tag){ all(tag).forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); }); });
  /* A paragraph whose mark was a deletion (w:rPr/w:del inside w:pPr) is already gone with the del removal above. */
  return new XMLSerializer().serializeToString(doc);
}
async function docxAcceptAll(bytes){
  if(!window.JSZip) await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
  var zip=await window.JSZip.loadAsync(bytes);
  var parts=Object.keys(zip.files).filter(function(n){ return /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n); });
  for(var i=0;i<parts.length;i++){ var x=await zip.file(parts[i]).async("string"); zip.file(parts[i], wAcceptXml(x)); }
  return new Uint8Array(await zip.generateAsync({type:"uint8array", compression:"DEFLATE"}));
}
document.addEventListener("click",async function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="fin_pack"]'); if(!b) return;
  ev.preventDefault(); if(!DB) return;
  var t={id:b.dataset.id, kind:b.dataset.kind}, lab=t.kind==="cv"? "CV" : "cover letter";
  if(!ASSETS){ toast("This needs edit access to the board",true); return; }
  if(b.dataset.busy) return; b.dataset.busy="1"; b.disabled=true; var was=b.textContent; b.textContent="Saving…";
  try{
    var f=await fileOf(t.id,t.kind);
    if(!f || (!f.b64 && !f.assetId)){ toast("The proposed "+lab+" isn't on the board",true); return; }
    var raw=f.assetId? new Uint8Array(await (await fetch("/_blob/"+f.assetId)).arrayBuffer()) : b64ToBytes(f.b64);
    if(f.sha256 && (await sha256hex(raw))!==f.sha256){ toast("The proposed "+lab+" didn't check out — upload what you sent instead",true); return; }
    var clean=await docxAcceptAll(raw);
    var name=String(f.name||("Proposed "+lab+".docx")).replace(/\s+v\d+(?=\.docx$)/i,"");
    await finSave(t, clean, name, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "The proposed draft, tracked changes accepted", true);
    toast("Final "+lab+" saved: the proposed draft");
  }catch(e){ console.warn("use proposed",e); toast("Couldn't save it"+(e&&e.code? " ("+e.code+")" : "")+" — try again, or upload what you sent",true); }
  finally{ delete b.dataset.busy; b.disabled=false; b.textContent=was; }
});
var TPL_KIND=null;
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest('[data-act="doc_pv"],[data-act="doc_dl"],[data-act="tpl_up"]'); if(!b) return;
  ev.preventDefault(); var a=b.dataset.act;
  if(a==="doc_pv"||a==="doc_dl"){
    var lab=b.dataset.kind==="cv"? "CV" : "Cover letter";
    fileOf(b.dataset.src,b.dataset.kind).then(function(f){ if(a==="doc_pv") previewDoc(f,lab+(f&&f.name? " — "+f.name : "")); else saveDoc(f); })
      .catch(function(e){ console.warn(e); toast("Couldn't load it — try again",true); });
    return;
  }
  if(a==="tpl_up"){ TPL_KIND=b.dataset.kind; var fi=el("tpl-file"); fi.value=""; fi.click(); return; }
});
el("tpl-file").addEventListener("change",async function(){
  var f=this.files&&this.files[0]; if(!f||!TPL_KIND||!DB) return;
  if(!/\.docx$/i.test(f.name)){ toast("That isn't a Word .docx file",true); return; }
  if(f.size>700*1024){ toast("Too big for the board (over 700 KB)",true); return; }
  var u=new Uint8Array(await f.arrayBuffer()), sha=await sha256hex(u), k=TPL_KIND, old=TEMPLATES[k], b64=bytesToB64(u);
  /* Read the text now so the skills get clean text, not a .docx to parse (3 Oct). */
  var text="";
  try{ text=await docTextOf(f); }catch(e0){ console.warn("template text",e0); }
  /* One db document is capped at 256 KiB: file and text together must fit. */
  if(b64.length+new TextEncoder().encode(text).length > 245*1024){ toast("Too big to store with its text — save a smaller .docx (under about 170 KB) and try again",true); return; }
  try{
    if(old) await DB.doc("templates/"+k+"-prev").set(old);
    var rec={kind:k, name:f.name, mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size:u.length, sha256:sha, b64:b64, updatedAt:today(), source:"Uploaded on the board"};
    if(text){ rec.text=text; rec.textAt=today(); }
    await DB.doc("templates/"+k).set(rec);
    toast(text? (k==="cv"? "CV saved and read" : "Cover letter saved and read") : "Saved, but its text couldn't be read — Claude won't use it as evidence until it can",!text);
  }catch(e){ console.warn(e); toast("Upload failed — try again",true); }
});
function render(){
  syncEdDialog();
  renderCounts(); renderWeek(); renderPipeW(); renderG1(); renderG2(); renderToApply(); renderInPlay(); renderScreened();
  renderCompanies(); renderSectors(); renderRejected(); renderMockSetup(); renderPastMocks(); renderAbout(); renderChannels(); renderPeople(); renderCompare();
}
