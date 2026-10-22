"use strict";
/* ---------- interview materials (1 Oct, late) ----------
   What a company gives the user to prepare: a link, pasted text or a file. Each applies to the whole
   company (every role there), one role (all its interviews) or one meeting. One `materials` doc each;
   files live in the artifact's asset store, the doc keeps the id. Files over 5 MB and text over 20,000
   characters are refused here: Claude reads those in chat and saves a short version instead.
   next-role-interview-prep writes `digest` (format, what they assess, questions, key points) — the
   mock interviewer reads the digest, never the whole file. */
var materials=[], ASSETS=null, MA=null, MA_DEL={};
var MA_MAXFILE=5*1024*1024, MA_MAXTEXT=20000;
var MA_TYPES={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",txt:"text/plain",md:"text/markdown"};
/* Word files are converted to Markdown in the browser before they are stored (1 Oct, night): the file
   store takes no Word files, and Markdown is what Claude reads best. The original can be bigger than
   5 MB because only the converted text is kept. PowerPoint is sent to PDF instead: slides lose their
   meaning as plain text. */
var MA_WORD_MAX=20*1024*1024;
function maRoleCo(r){ return r? (coIdOfRole(r)||"") : ""; }
function maForRole(r){
  var co=maRoleCo(r);
  return materials.filter(function(m){
    if(m.scopeKind==="company") return co && m.companyId===co;
    return m.roleId===r.id;
  }).sort(maSort);
}
function maForCompany(cid){ return materials.filter(function(m){ return m.companyId===cid; }).sort(maSort); }
function maForMeeting(cid){ return materials.filter(function(m){ return m.scopeKind==="meeting" && m.meetingId===cid; }); }
function maSort(a,b){ var o={company:0,role:1,meeting:2}; return (o[a.scopeKind]-o[b.scopeKind]) || String(b.addedAt||"").localeCompare(String(a.addedAt||"")); }
function maScopeLab(m){
  if(m.scopeKind==="company") return "All roles at "+(mtForName("company",m.companyId)||"the company");
  if(m.scopeKind==="role") return "All interviews";
  var c=commitments.find(function(x){return x.id===m.meetingId;});
  return c? (mtLabel(c)+(c.date? " · "+niceShort(c.date) : "")) : "A removed meeting";
}
function maKindLab(m){
  if(m.kind==="link") return "Link";
  if(m.kind!=="file") return "Text";
  if(m.converted) return "Word → Markdown";
  var t=(m.file&&m.file.type)||"";
  return /pdf/.test(t)? "PDF" : /^image\//.test(t)? "Image" : /markdown|text\/plain/.test(t)? "Text file" : "File";
}
function maSize(n){ n=+n||0; return n>=1048576? (n/1048576).toFixed(1)+" MB" : Math.max(1,Math.round(n/1024))+" KB"; }
function maRow(m,ctx){
  ctx=ctx||{};
  var key="ma~"+(ctx.scope||"")+"~"+m.id, g=m.digest||{};
  var content = m.kind==="link"? '<p style="margin:0;font-size:13px;overflow-wrap:anywhere"><a href="'+esc(m.url||"")+'" target="_blank" rel="noopener">'+esc(m.url||"")+'</a></p>'
    : m.kind==="file"? (m.file&&m.file.id? '<p style="margin:0;font-size:13px">'+assetLink(m.file,"Open "+esc(m.file.name||"the file"),"",m.title)+' <span class="statushint">'+esc(maSize(m.file.size))+'</span></p>'+
        (m.converted? '<p class="statushint" style="margin:0">Converted from '+esc(m.converted.name||"a Word file")+' ('+esc(maSize(m.converted.size))+'). The original Word file isn’t kept.</p>' : "") : '<p class="lede">File missing.</p>')
    : '<div class="matext">'+esc(clip(m.text||"",4000))+'</div>';
  var dg = (g.points||g.assesses||g.questions||g.format)
    ? '<div class="stsec"><span class="eyebrow">What Claude took from it'+(g.builtAt? " · "+esc(niceShort(g.builtAt)) : "")+'</span>'+
        (g.format? '<p style="margin:0;font-size:13px"><b>Format:</b> '+esc(g.format)+'</p>' : "")+
        listSec("What they assess",g.assesses)+listSec("Questions or tasks they name",g.questions)+listSec("Key points",g.points)+'</div>'
    : '<p class="statushint" style="margin:0">Claude hasn’t read this yet — the next morning run will, or ask Claude to “prep the interview for #N”.</p>';
  var del = MA_DEL[m.id]
    ? '<span class="statushint">Remove it for good?</span><button class="btn" data-act="ma_delyes" data-id="'+esc(m.id)+'">Remove</button><button class="btn ghost" data-act="ma_delno" data-id="'+esc(m.id)+'">Keep</button>'
    : '<button class="btn ghost" data-act="ma_edit" data-id="'+esc(m.id)+'">Edit</button><button class="btn ghost" data-act="ma_del" data-id="'+esc(m.id)+'">Remove</button>';
  return '<details class="stage mamat" data-mtk="'+esc(key)+'"'+(MTOPEN[key]?" open":"")+'><summary class="stsum">'+
      '<span class="stname" title="'+esc(m.title||"")+'">'+esc(m.title||"Untitled")+'</span>'+
      /* Claude's reading is the normal state, so no pill (2 Oct); only say so while it's waiting. */
      (m.digest? "" : '<span class="ststat mawait" title="Interview advice and mock interviews use it once Claude has read it">Claude reads it overnight</span>')+
      '<span class="sttype"><span class="chip">'+esc(maScopeLab(m))+'</span></span>'+
      '<span class="chip code stwhen">'+esc(maKindLab(m))+'</span>'+
    '</summary><div class="stbody">'+
      (m.note? '<p style="margin:0;font-size:13px;color:var(--ink-2)">'+esc(m.note)+'</p>' : "")+content+dg+
      '<div class="stacts">'+del+'</div>'+
    '</div></details>';
}
function maBlock(kind,id,ms){
  var unread=ms.filter(function(m){return !m.digest;}).length;
  /* Live roles add from the card's "+ Add" menu (2 Oct); an empty list keeps a quiet link. */
  var ra = kind==="role" && typeof CARD_ACT_ST!=="undefined" && CARD_ACT_ST[((roles.find(function(x){return x.id===id;})||{}).stage)];
  var addB='<button type="button" class="'+(ra? "linkbtn" : "btn sm")+'" data-act="ma_add" data-k="'+esc(kind)+'" data-id="'+esc(id)+'">'+(ra? "Add material" : "+ Add material")+'</button>';
  return '<div class="ivsec">'+
    /* Add stays in the header once materials exist (6 Oct): it used to move to the card's + Add menu only. */
    ivHead("Prep materials", unread? '<span class="spill sm mid">'+unread+' not read yet</span>' : "", addB)+
    '<p class="secintro">Anything the company gives you about their hiring process: a prep guide, case brief, interview format or a link. Claude uses it for interview advice and mock interviews.</p>'+
    (ms.length? '<div class="stages">'+ms.map(function(m){return maRow(m,{scope:kind+id});}).join("")+'</div>' : '<p class="emptyline">None yet.</p>')+
  '</div>';
}
/* Role card › Interviews: materials first. Company card: on its Meetings & tasks tab. */
/* Role materials now sit inside the Prep group on the Interviews tab (interviewsPanel). */
/* Company cards: Prep materials now sit inside mtBlock, after Meetings and Tasks (1 Oct, night). */
mtMeetRow=(function(orig){ return function(c,ctx){
  var h=orig(c,ctx), ms=maForMeeting(c.id); if(!ms.length) return h;
  var line='<p class="statushint" style="margin:0">Materials for this one: '+ms.map(function(m){return esc(m.title||"Untitled");}).join(" · ")+' — under Prep below.</p>';
  var at=h.indexOf('<div class="stbody">'); return at<0? h : h.slice(0,at+20)+line+h.slice(at+20);
}; })(mtMeetRow);

/* The mock interviewer reads what Claude took from each material (or a short slice of pasted text). */
var MK_MEET="";
openMockFor=(function(orig){ return function(roleId,cid){ MK_MEET=cid||""; return orig(roleId,cid); }; })(openMockFor);
roleBrief=(function(orig){ return function(r){
  var s=orig(r); if(!r) return s;
  /* Meeting materials (6 Oct): only the round being practised — the meeting the mock was opened from, else the
     role's next round. Other rounds' materials stay out. With no round known, all are used. */
  var mm=MK_MEET, mc=mm? commitments.find(function(c){ return c.id===mm; }) : null;
  if(!mc || (typeof mkrForRole==="function" && !mkrForRole(mc,r))) mm=(typeof mkrInfo==="function"? ((mkrInfo(r).next||{}).id||"") : "");
  var ms=maForRole(r).filter(function(m){ return m.scopeKind!=="meeting" || !mm || m.meetingId===mm; });
  if(!ms.length) return s;
  var lines=ms.map(function(m){
    var g=m.digest, bits=[];
    if(g){ if(g.format) bits.push("format: "+g.format); if((g.assesses||[]).length) bits.push("they assess: "+g.assesses.join("; "));
      if((g.questions||[]).length) bits.push("questions or tasks they name: "+g.questions.join("; ")); if((g.points||[]).length) bits.push("key points: "+g.points.join("; ")); }
    else if(m.kind==="text") bits.push(clip(m.text||"",1500));
    else bits.push("(not read yet)");
    return "- "+(m.title||"Material")+" ["+maScopeLab(m)+"]: "+clip(bits.join(" | "),1500);
  });
  return s+"\nThe company's OWN interview materials (the most authoritative source on how they interview — use their format, criteria and named questions or tasks):\n"+lines.join("\n");
}; })(roleBrief);

/* ---- the Add / Edit material dialog ---- */
(function(){
  var d=document.createElement("dialog"); d.id="ma-dialog"; d.className="mtmodal";
  d.className="modal mtmodal"; d.setAttribute("aria-labelledby","ma-head");
  d.innerHTML='<div class="modal-head"><h3 id="ma-head">Add material</h3><button type="button" class="btn ghost" id="ma-close">Close</button></div>'+
    '<div id="ma-body" class="mtform"></div>'+
    '<div class="row mtfoot"><span id="ma-hint" class="statushint" role="status"></span><button class="btn primary" id="ma-save" style="margin-left:auto">Save</button></div>';
  document.body.appendChild(d);
})();
function maScopes(m){
  if(m.from==="company") return [["company:"+m.companyId,"All roles at "+(mtForName("company",m.companyId)||"this company")]];
  var r=roles.find(function(x){return x.id===m.roleId;})||rawRoles.find(function(x){return x.id===m.roleId;});
  var out=[], co=maRoleCo(r);
  out.push(["role:"+m.roleId,"All interviews for this role"]);
  if(co) out.push(["company:"+co,"Every role at "+(mtForName("company",co)||"this company")]);
  commitments.filter(function(c){ return mtItem(c)==="meeting" && (c.roleId===m.roleId || (c.tagRoles||[]).indexOf(m.roleId)>=0); }).sort(mtSort)
    .forEach(function(c){ out.push(["meeting:"+c.id,"Only: "+(c.title||mtLabel(c))+(c.date? " · "+niceShort(c.date) : " · not planned")]); });
  return out;
}
function maPaint(){
  var m=MA, body="";
  el("ma-head").textContent=m.id? "Edit material" : "Add material";
  body+='<label class="fld">What it is<input id="ma-title" value="'+esc(m.title)+'" placeholder="e.g. Candidate prep guide, case study brief"></label>';
  body+='<label class="fld">Use it for'+mtSel("ma-scope",maScopes(m),m.scope)+'</label>';
  if(!m.id) body+='<div class="mtfld"><span class="mtlab">Add it as</span>'+
    '<div class="mtseg" role="radiogroup">'+[["text","Pasted text"],["link","A link"],["file","A file"]].map(function(o){
      return '<button type="button" class="pill" data-maseg="'+o[0]+'" aria-pressed="'+(m.kind===o[0])+'">'+o[1]+'</button>'; }).join("")+'</div>'+
    '<p class="statushint" style="margin:0">PDF or Markdown reads best. Word files are converted to Markdown for you. For PowerPoint, save it as a PDF first.</p></div>';
  if(m.kind==="link") body+='<label class="fld">Link<input id="ma-url" type="url" value="'+esc(m.url)+'" placeholder="https://"></label>';
  if(m.kind==="text") body+='<label class="fld">Paste the text<textarea id="ma-text" rows="8">'+esc(m.text)+'</textarea></label>';
  if(m.kind==="file"){
    if(m.id) body+='<p class="statushint" style="margin:0">'+esc((m.file&&m.file.name)||"File")+' · '+esc(maSize(m.file&&m.file.size))+'. To swap the file, remove this one and add the new one.</p>';
    else if(!ASSETS) body+='<p class="notice" style="margin:0;font-size:12.5px">Files can’t be uploaded in this view. Paste the text or add a link instead — or send the file to Claude in chat.</p>';
    else body+='<label class="fld">PDF, image, Markdown, text or Word file — up to 5 MB (Word up to 20 MB)<input id="ma-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.docx"></label>';
  }
  body+='<label class="fld">Note — optional<input id="ma-note" value="'+esc(m.note)+'" placeholder="e.g. sent by the recruiter after the screen"></label>';
  el("ma-body").innerHTML=body; el("ma-hint").textContent=m.err||"";
}
function maRefNum(m){
  var r=m.roleId && (roles.find(function(x){return x.id===m.roleId;})||rawRoles.find(function(x){return x.id===m.roleId;}));
  return r&&r.ref? " for #"+r.ref : "";
}
function maTooBig(m,what){
  return what+" Ask Claude in chat to “summarise this interview material"+maRefNum(m)+"” and attach it — Claude saves a short version here with the key points.";
}
function maOpen(o){
  var x=o.id? materials.find(function(y){return y.id===o.id;}) : null;
  if(x){ MA={id:x.id, title:x.title||"", kind:x.kind, url:x.url||"", text:x.text||"", file:x.file||null, note:x.note||"",
      scope:x.scopeKind+":"+(x.scopeKind==="company"? x.companyId : x.scopeKind==="role"? x.roleId : x.meetingId),
      from:x.scopeKind==="company" && !x.roleId? "company" : "role", roleId:x.roleId||"", companyId:x.companyId||"", err:""};
    if(MA.from==="role" && !MA.roleId) MA.from="company";
  } else {
    MA={id:"", title:"", kind:"text", url:"", text:"", file:null, note:"", err:"",
      from:o.k, roleId:o.k==="role"? o.id : "", companyId:o.k==="company"? o.id : ""};
    MA.scope=o.k==="company"? "company:"+o.id : "role:"+o.id;
  }
  maPaint(); var d=el("ma-dialog"); if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); }
}
function maGrab(){
  var m=MA; if(!m) return;
  ["title","url","text","note"].forEach(function(k){ var f=el("ma-"+k); if(f) m[k]=f.value; });
  var sc=el("ma-scope"); if(sc) m.scope=sc.value;
}
function maSave(){
  var m=MA; if(!m) return; maGrab();
  function stop(msg){ m.err=msg; el("ma-hint").textContent=msg; }
  if(!DB) return stop("Stored data isn’t available in this view, so nothing can be saved.");
  if(!m.title.trim()) return stop("Give it a name.");
  var parts=m.scope.split(":"), sk=parts[0], sid=parts.slice(1).join(":");
  var r=m.roleId && (roles.find(function(x){return x.id===m.roleId;})||rawRoles.find(function(x){return x.id===m.roleId;}));
  var meet=sk==="meeting"? commitments.find(function(c){return c.id===sid;}) : null;
  var doc={title:m.title.trim(), kind:m.kind, note:m.note.trim(), scopeKind:sk,
    companyId: sk==="company"? sid : (maRoleCo(r)||m.companyId||""),
    roleId: sk==="company"? "" : (m.roleId || (meet&&meet.roleId) || ""),
    meetingId: sk==="meeting"? sid : ""};
  if(m.kind==="link"){ if(!/^https?:\/\/\S+$/.test(m.url.trim())) return stop("Add the full link, starting https://"); doc.url=m.url.trim(); }
  if(m.kind==="text"){ var t=m.text.trim(); if(!t) return stop("Paste the text first.");
    if(t.length>MA_MAXTEXT) return stop(maTooBig(m,"That’s too long to keep here (over 20,000 characters).")); doc.text=t; }
  var file=null;
  if(m.kind==="file" && !m.id){
    if(!ASSETS) return stop("Files can’t be uploaded in this view — paste the text or add a link.");
    var fi=el("ma-file"); file=fi && fi.files && fi.files[0];
    if(!file) return stop("Choose the file.");
    var ext=String(file.name.split(".").pop()||"").toLowerCase(), ty=MA_TYPES[ext], isWord=ext==="docx";
    if(!ty && !isWord) return stop(/^pptx?$|^key$/.test(ext)? "PowerPoint files can’t be stored. In PowerPoint choose File › Export › PDF, then upload the PDF." :
      ext==="doc"? "Older .doc files can’t be converted. Save it as .docx or PDF, then upload that." :
      "That kind of file can’t be stored — use a PDF, image, Markdown, text or Word file.");
    if(isWord && file.size>MA_WORD_MAX) return stop(maTooBig(m,"That Word file is over 20 MB — too big to convert here."));
    if(!isWord && file.size>MA_MAXFILE) return stop(maTooBig(m,"That file is over 5 MB — too big for the board."));
  }
  var id=m.id || (slug(doc.title).slice(0,40)+"-"+Date.now().toString(36).slice(-5));
  var hint=el("ma-hint");
  (async function(){
    try{
      if(file){
        var upBlob=file, upName=file.name, upType=MA_TYPES[String(file.name.split(".").pop()).toLowerCase()];
        if(/\.docx$/i.test(file.name)){
          hint.textContent="Converting the Word file…";
          var md=await maWordToMd(file);
          if(!md.trim()) throw {code:"empty_convert"};
          upName=file.name.replace(/\.docx$/i,"")+".md"; upType="text/markdown";
          upBlob=new Blob([md],{type:"text/markdown"});
          if(upBlob.size>MA_MAXFILE) throw {code:"too_large"};
          doc.converted={from:"docx", name:file.name, size:file.size};
        }
        hint.textContent="Uploading…";
        var up=await ASSETS.upload(upBlob,{type:upType});
        doc.file={id:up.id, name:upName, size:up.sizeBytes||upBlob.size, type:up.contentType||upType};
      }
      hint.textContent="Saving…";
      if(m.id) await DB.doc("materials/"+id).update(doc);
      else { doc.addedAt=today(); await DB.doc("materials/"+id).set(doc); }
      MA=null; closeDlg("ma-dialog"); toast("Saved"); if(file) storeRefresh();
    }catch(e){
      var c=e&&e.code;
      if(c==="quota_or_state"){ STORE.fileFull=true; storeLive(true); }
      stop(c==="convert_failed"||c==="empty_convert"? "Couldn’t read that Word file. Save it as a PDF and upload that instead." :
           c==="too_large"? maTooBig(m,"That file is too big for the board.") :
           c==="unsupported_type"? "That kind of file can’t be stored — use a PDF, image or text file." :
           c==="rate_limited"? "Too many uploads at once — wait a moment and try again." :
           c==="quota_or_state"? "The board’s file storage is full — remove an old file, or paste the text instead." :
           "Not saved — "+(c||"the write failed")+". Your entries are still here.");
    }
  })();
}
el("ma-dialog").addEventListener("click",function(ev){
  var s=ev.target.closest("[data-maseg]"); if(s && MA){ maGrab(); MA.kind=s.dataset.maseg; MA.err=""; maPaint(); }
});
el("ma-close").addEventListener("click",function(){ MA=null; closeDlg("ma-dialog"); });
el("ma-save").addEventListener("click",function(){ maSave(); });
document.addEventListener("click",function(ev){
  var t=ev.target.closest('[data-act^="ma_"]'); if(!t) return;
  var a=t.dataset.act, id=t.dataset.id;
  ev.preventDefault(); ev.stopPropagation();
  if(a==="ma_add") return maOpen({k:t.dataset.k, id:id});
  if(a==="ma_edit") return maOpen({id:id});
  if(a==="ma_del"){ MA_DEL[id]=1; render(); return; }
  if(a==="ma_delno"){ delete MA_DEL[id]; render(); return; }
  if(a==="ma_delyes"){
    var m=materials.find(function(x){return x.id===id;}); delete MA_DEL[id];
    if(!m||!DB) return;
    DB.doc("materials/"+id).delete().then(function(){
      if(m.file && m.file.id && ASSETS) ASSETS.delete(m.file.id).then(function(){ STORE.fileFull=false; storeRefresh(); }).catch(function(e){ console.warn("asset delete",e&&e.code); });
      toast("Removed");
    }).catch(function(e){ toast("Not removed — "+((e&&e.code)||"the write failed")); });
  }
},true);

/* ---------- Word to Markdown, in the browser (1 Oct, night) ----------
   mammoth turns the .docx into clean HTML (headings, lists, tables, bold and italic, links); a small
   walker turns that into Markdown. Loaded only when someone picks a Word file. */
async function maWordToMd(file){
  try{
    if(!window.mammoth) await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js");
    var res=await window.mammoth.convertToHtml({arrayBuffer: await file.arrayBuffer()});
    return htmlToMd(res.value||"");
  }catch(e){ console.warn("word convert",e); throw {code:"convert_failed"}; }
}
function htmlToMd(html){
  var root=new DOMParser().parseFromString("<div>"+html+"</div>","text/html").body.firstChild;
  function inline(n){
    if(n.nodeType===3) return n.textContent.replace(/\s+/g," ");
    if(n.nodeType!==1) return "";
    var t=n.tagName.toLowerCase(), inner=Array.prototype.map.call(n.childNodes,inline).join("");
    if(t==="strong"||t==="b") return inner.trim()? "**"+inner.trim()+"** " : "";
    if(t==="em"||t==="i") return inner.trim()? "*"+inner.trim()+"* " : "";
    if(t==="br") return "\n";
    if(t==="a"){ var h=n.getAttribute("href")||""; return /^https?:/.test(h) && inner.trim()? "["+inner.trim()+"]("+h+")" : inner; }
    if(t==="img") return "";
    return inner;
  }
  function list(n,depth){
    var ordered=n.tagName.toLowerCase()==="ol", i=0, out=[];
    Array.prototype.forEach.call(n.children,function(li){
      if(li.tagName.toLowerCase()!=="li") return; i++;
      var own=[], subs=[];
      Array.prototype.forEach.call(li.childNodes,function(c){ if(c.nodeType===1 && /^(ul|ol)$/i.test(c.tagName)) subs.push(c); else own.push(inline(c)); });
      out.push(new Array(depth+1).join("  ")+(ordered? i+". " : "- ")+own.join("").replace(/\s+/g," ").trim());
      subs.forEach(function(s){ out.push(list(s,depth+1)); });
    });
    return out.join("\n");
  }
  function table(n){
    var rows=Array.prototype.map.call(n.querySelectorAll("tr"),function(tr){
      return Array.prototype.map.call(tr.children,function(td){ return inline(td).replace(/\|/g,"/").replace(/\s+/g," ").trim(); }); });
    if(!rows.length) return "";
    var w=Math.max.apply(null,rows.map(function(r){return r.length;}));
    rows=rows.map(function(r){ while(r.length<w) r.push(""); return "| "+r.join(" | ")+" |"; });
    rows.splice(1,0,"|"+new Array(w+1).join(" --- |"));
    return rows.join("\n");
  }
  var blocks=[];
  Array.prototype.forEach.call(root.childNodes,function(n){
    if(n.nodeType===3){ if(n.textContent.trim()) blocks.push(n.textContent.trim()); return; }
    if(n.nodeType!==1) return;
    var t=n.tagName.toLowerCase(), h=t.match(/^h([1-6])$/);
    if(h){ var tx=inline(n).replace(/\*\*/g,"").trim(); if(tx) blocks.push(new Array(+h[1]+1).join("#")+" "+tx); return; }
    if(t==="ul"||t==="ol"){ blocks.push(list(n,0)); return; }
    if(t==="table"){ blocks.push(table(n)); return; }
    var p=inline(n).replace(/[ \t]+\n/g,"\n").replace(/[ \t]{2,}/g," ").trim(); if(p) blocks.push(p);
  });
  return blocks.filter(Boolean).join("\n\n").replace(/\n{3,}/g,"\n\n")+"\n";
}

/* ---------- Storage meter on Under the hood (1 Oct, night) ----------
   Files: the real budget from the file store (bytes and file count against its quota), shown only to
   people who can edit the board. Board data: its size and record count, estimated from what the page
   has loaded plus a one-off read of the big records it does not load (packs, finals). The overall
   board-data cap isn't published, so it shows as a size, not a bar; the one cap that is known, 256 KB
   a record, is a bar for the largest record. Recalculated when Under the hood opens, after an upload
   or removal here, on Refresh, and live from the board's own data while the tab is open. */
var STORE={assets:null, aErr:"", at:"", dbFull:"", fileFull:false, extra:{}, busy:false}, RAWDB=null, STORE_T=null;
var STOR_RECORD_MAX=256*1024; var STOR_DOC_MAX=25000;
function storBytes(o){ try{ return new TextEncoder().encode(JSON.stringify(o)).length; }catch(e){ return 0; } }
function storCap(n){ return n>=1073741824? (n/1073741824).toFixed(n%1073741824? 1 : 0)+" GB" : maSize(n); }
function storDb(){
  var rec=[];
  function coll(name,arr){ (arr||[]).forEach(function(o){ var c=Object.assign({},o); var id=c.id; delete c.id; rec.push([name+"/"+id, storBytes(c)]); }); }
  coll("roles",rawRoles); coll("companies",companies); coll("runs",runs); coll("screened",screened); coll("decided",decided);
  coll("commitments",commitments); coll("conversations",conversations); coll("mocks",mocks); coll("people",people);
  coll("channels",channels); coll("sources",srcs); coll("materials",materials); coll("sectors",sectors);
  [["profile/me",PROFILE],["profile/prefs",PREFS],["profile/skills",SKILLS],["profile/brief",HOOD.brief]].forEach(function(x){ if(x[1]) rec.push([x[0],storBytes(x[1])]); });
  Object.keys(HOOD.refs||{}).forEach(function(k){ rec.push(["refs/"+k,storBytes(HOOD.refs[k])]); });
  Object.keys(TEMPLATES||{}).forEach(function(k){ rec.push(["templates/"+k,storBytes(TEMPLATES[k])]); });
  Object.keys(STORE.extra).forEach(function(c){ (STORE.extra[c]||[]).forEach(function(x){ rec.push([c+"/"+x[0],x[1]]); }); });
  var total=0, big=["",0]; rec.forEach(function(r){ total+=r[1]; if(r[1]>big[1]) big=r; });
  return {total:total, n:rec.length, big:big, extraDone:Object.keys(STORE.extra).length>0};
}
function storBar(pct,full){ var cls= full||pct>=0.95? "full" : pct>=0.8? "warn" : ""; return '<div class="storbar '+cls+'"><i style="width:'+Math.min(100,Math.max(0,pct*100)).toFixed(1)+'%"></i></div>'; }
function storageHtml(){
  var d=storDb(), u=STORE.assets, out='<div class="storhead"><b>Storage</b><span class="statushint">'+(STORE.at? "Updated "+esc(STORE.at)+" · " : "")+
    '<button type="button" class="linkbtn" data-act="stor_refresh">Refresh</button></span></div>';
  if(STORE.dbFull) out+='<div class="storfull"><b>Board data is full:</b> '+esc(STORE.dbFull)+'. New records can’t be saved until old ones are removed or made smaller. Ask Claude to move large files out of the board data.</div>';
  if(STORE.fileFull) out+='<div class="storfull"><b>The file store is full.</b> Remove an old material file, or paste text instead of uploading.</div>';
  var f;
  if(!ASSETS) f='<p class="stornote">File storage is only shown to people who can edit the board.</p>';
  else if(STORE.aErr) f='<p class="stornote">Couldn’t read file storage ('+esc(STORE.aErr)+'). Press Refresh to try again.</p>';
  else if(!u) f='<p class="stornote">Checking…</p>';
  else f='<div class="storhead"><b>Files</b><span class="sv">'+esc(maSize(u.bytes))+' of '+esc(storCap(u.maxBytes))+' · '+u.files+' of '+u.maxFiles+' files</span></div>'+
    storBar(u.maxBytes? u.bytes/u.maxBytes : 0, STORE.fileFull)+
    '<p class="stornote">Interview materials and the final CVs and letters you upload.</p>';
  out+='<div class="storrow">'+(u? f : '<div class="storhead"><b>Files</b></div>'+f)+'</div>';
  /* The board's database holds up to 25,000 documents (the service reported it on 2 Oct). */
  out+='<div class="storrow"><div class="storhead"><b>Board data</b><span class="sv">'+d.n.toLocaleString("en-GB")+' of 25,000 records · ~'+esc(maSize(d.total))+'</span></div>'+
    storBar(d.n/STOR_DOC_MAX,!!STORE.dbFull)+
    '<p class="stornote">Roles, companies, notes, CVs and everything else, one record each. The count is worked out from what the board has loaded, so it can be a record or two out.'+
    (d.extraDone? "" : ' CVs and final versions aren’t counted yet; press Refresh.')+'</p></div>';
  if(d.big[1]) out+='<div class="storrow"><div class="storhead"><b>Largest record · '+esc(d.big[0])+'</b><span class="sv">'+esc(maSize(d.big[1]))+' of 256 KB</span></div>'+
    storBar(d.big[1]/STOR_RECORD_MAX,false)+'<p class="stornote">No single record can be over 256 KB.</p></div>';
  return out;
}
function hoodVisible(){ return tab==="help" && CTAB.help==="hood"; }
function storeLive(now){
  clearTimeout(STORE_T);
  STORE_T=setTimeout(function(){ var b=el("stor-box"); if(b && hoodVisible()) b.innerHTML=storageHtml(); }, now? 0 : 700);
}
async function storeRefresh(){
  if(STORE.busy) return; STORE.busy=true;
  try{
    if(ASSETS){ try{ var l=await ASSETS.list(); STORE.assets=l.usage; STORE.aErr=""; if(l.usage && l.usage.bytes<l.usage.maxBytes && l.usage.files<l.usage.maxFiles) STORE.fileFull=false; }
      catch(e){ STORE.aErr=(e&&e.code)||"error"; } }
    if(RAWDB){ for(var c of ["packs","finals"]){ try{ var q=await RAWDB.collection(c).get();
        STORE.extra[c]=(q.docs||[]).map(function(dd){ return [dd.id, storBytes(dd.data())]; }); }catch(e){ console.warn("storage read",c,e&&e.code); } } }
    var n=new Date(); STORE.at=("0"+n.getHours()).slice(-2)+":"+("0"+n.getMinutes()).slice(-2);
  } finally { STORE.busy=false; storeLive(true); }
}
document.addEventListener("click",function(ev){
  var t=ev.target.closest && ev.target.closest('[data-act="stor_refresh"],[data-act="ctab"][data-id="help"][data-k="hood"]'); if(!t) return;
  if(t.dataset.act==="stor_refresh"){ ev.preventDefault(); storeRefresh(); return; }
  setTimeout(storeRefresh,0);
});
showTab=(function(orig){ return function(t){ orig(t); if(t==="help" && CTAB.help==="hood") storeRefresh(); }; })(showTab);
render=(function(orig){ return function(){ orig(); if(hoodVisible()) storeLive(); }; })(render);
