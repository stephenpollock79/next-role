"use strict";
/* ===== Data health: Noted (28 Oct) =====
   Some items can't be fixed: a run that logged badly, or gaps left by a past break that can only be fixed going
   forward. "Noted…" on any Data health item hides that one item with a reason, and changes nothing else.
   Each note is one doc in `noted` {key, title, item, label, reason, mode, until, date, at, by}, keyed by the
   check and the item, so anything new that breaks still shows. When it comes back (`mode`):
   - "run": after the next run of what the check reads (run-based checks only; 40's fxpEvidence), if still there;
   - "keep": stays hidden until you undo it;
   - "date": comes back on `until`, if still there.
   Default: "run" for run-based checks, "keep" for the rest. Noted items leave the to-do count, Fix all and Copy for
   Claude, and are listed in a "Noted by you" fold at the bottom of Data health with Undo. */

var NOTED={}, NT_LIST=[], NT_OPEN=false, NT_FORM=null;
function ntItemKey(it){
  if(!it) return "";
  if(it.k==="pair" && it.a && it.b) return "pair:"+it.a.id+"+"+it.b.id;
  if(it.k==="dgroup" && it.roles) return "group:"+it.roles.map(function(r){ return r.id; }).sort().join("+");
  return it.id? String(it.id) : String(it.label||"");
}
function ntKey(title,it){ return String(title)+"|"+ntItemKey(it); }
/* A short, path-safe doc id for a key. */
function ntDocId(key){ var h=5381; for(var i=0;i<key.length;i++){ h=((h<<5)+h+key.charCodeAt(i))>>>0; } return "n-"+h.toString(36)+"-"+key.length.toString(36); }
function ntRunBased(it){ return typeof fxpEvidence==="function" && fxpEvidence(it && it.id)!==null; }
/* Still hidden? */
function ntActive(n,it){
  if(!n) return false;
  if(n.mode==="keep") return true;
  if(n.mode==="date") return !n.until || today()<n.until;
  if(n.mode==="run"){ var ev=typeof fxpEvidence==="function"? fxpEvidence(it && it.id) : null; if(ev===null) return true; return !ev || ev<=String(n.date||""); }
  return false;
}
function ntBackTxt(n){
  if(n.mode==="keep") return "Hidden until you undo it";
  if(n.mode==="date") return "Back on "+niceShort(n.until)+" if it's still there";
  return "Back after the next run if it's still there";
}

/* Go there follows the roles (28 Oct): for a check about roles, it opens the stage where most of them are,
   not a fixed page (Live roles you haven't scored are never on the Longlist). */
var NT_STAGE_TAB={proposed:"gate1", consideration:"gate2", parked:"gate2", prep:"toapply", applied:"inplay", offer:"inplay", closed:"rejected", g1_rejected:"rejected", g2_rejected:"rejected"};
var NT_GO0=null;
function ntGoTab(x){
  var n={}, best="", bn=0;
  (x.items||[]).forEach(function(it){ if(it.k!=="role" || !it.id) return; var r=rawRoles.find(function(y){ return y.id===it.id; }); var t=r && NT_STAGE_TAB[r.stage]; if(t) n[t]=(n[t]||0)+1; });
  ["gate1","gate2","toapply","inplay","rejected"].forEach(function(t){ if((n[t]||0)>bn){ bn=n[t]; best=t; } });
  return best;
}
hygiene=(function(orig){ return function(){
  var out=orig(); NT_LIST=[];
  if(!NT_GO0) NT_GO0=Object.assign({},HY_GO);
  out.forEach(function(x){ var t=ntGoTab(x); if(t && NT_GO0[x.title]) HY_GO[x.title]=t; });
  out.forEach(function(x){
    x.items=(x.items||[]).filter(function(it){
      var key=ntKey(x.title,it), n=NOTED[key];
      if(n && ntActive(n,it)){ NT_LIST.push({title:x.title, it:it, n:n}); return false; }
      it.ntKey=key; it.ntTitle=x.title;
      if(n && !it.ntBack){ it.label=String(it.label||"")+" · you noted this "+niceShort(n.date)+", and it's still there"; it.ntBack=true; }
      return true;
    });
  });
  return out;
}; })(hygiene);

/* The Noted… button on each item, only on the Data health page itself. */
hyItem=(function(orig){ return function(x){
  var h=orig.apply(this,arguments);
  if(!x || !x.ntKey || !NT_PAGE) return h;
  var blk=/^\s*<div/.test(h);
  return '<span class="ntwrap'+(blk? " ntblk" : "")+'">'+h+'<button type="button" class="ntbtn" data-nt="open" aria-label="Note this and hide it" data-key="'+esc(x.ntKey)+'" title="Hide this one item with a reason. Changes nothing else.">Noted</button></span>';
}; })(hyItem);

var NT_PAGE=false;
renderHygiene=(function(orig){ return function(){
  NT_PAGE=true; try{ orig.apply(this,arguments); } finally { NT_PAGE=false; }
  var list=el("hy-body") && el("hy-body").querySelector(".hylist"); if(!list) return;
  /* Go there sits in the row's header as a button, beside Copy for Claude or Fix these. */
  list.querySelectorAll(".hyrow").forEach(function(row){
    var go=row.querySelector(".hyitems > a.hyall[data-gotab]"), hd=row.querySelector(".hyrt"); if(!go || !hd) return;
    go.className="btn sm hygo"; go.textContent="Go there →";
    var act=hd.querySelector(".hyact, .hywho, [data-fx]"); if(act) hd.insertBefore(go,act); else hd.appendChild(go);
  });
  if(!NT_LIST.length) return;
  var rows=NT_LIST.map(function(p){
    var P2=HY_PLAIN[p.title]||[p.title];
    return '<li><div class="ntl"><b>'+esc(P2[0])+'</b><span>'+esc(String(p.it.label||ntItemKey(p.it)))+'</span>'+
      '<small>“'+esc(p.n.reason||"")+'” · noted '+esc(niceShort(p.n.date))+' · '+esc(ntBackTxt(p.n))+'</small></div>'+
      '<button type="button" class="btn sm" data-nt="undo" data-key="'+esc(p.n.key)+'">Undo</button></li>';
  }).join("");
  list.insertAdjacentHTML("beforeend",'<details class="hyc ntc"'+(NT_OPEN? " open" : "")+'><summary class="hych"><h3>Noted by you</h3><span class="hycn">'+NT_LIST.length+'</span></summary>'+
    '<p class="hyw">Hidden with your reason. Nothing else was changed.</p><ul class="ntlist">'+rows+'</ul></details>');
}; })(renderHygiene);

/* ---------- the form ---------- */
function ntFind(key){
  var all=hygiene(), hit=null;
  all.forEach(function(x){ (x.items||[]).forEach(function(it){ if(!hit && it.ntKey===key) hit={title:x.title, it:it}; }); });
  return hit;
}
function ntDlg(){
  var d=el("nt-dialog"); if(d) return d;
  d=document.createElement("dialog"); d.id="nt-dialog"; d.className="modal"; d.setAttribute("aria-label","Note it");
  d.innerHTML='<div class="modal-head"><h3>Note it and hide it</h3><button type="button" class="btn ghost" data-close="nt-dialog">Close</button></div><div id="nt-body"></div>';
  document.body.appendChild(d); return d;
}
function ntOpen(key){
  var f=ntFind(key); if(!f) return;
  var run=ntRunBased(f.it), P2=HY_PLAIN[f.title]||[f.title];
  NT_FORM={key:key, title:f.title, it:f.it, run:run};
  var mode=run? "run" : "keep";
  function opt(v,lab,extra){ return '<label class="ntopt"><input type="radio" name="nt-mode" value="'+v+'"'+(v===mode? " checked" : "")+'> <span>'+lab+'</span>'+(extra||"")+'</label>'; }
  el("nt-body")||ntDlg();
  el("nt-body").innerHTML='<p class="lede" style="margin:0 0 10px;font-size:13px"><b>'+esc(P2[0])+'</b><br>'+esc(String(f.it.label||ntItemKey(f.it)).replace(/ · you noted this.*$/,""))+'</p>'+
    '<label class="fld">Why — required<textarea id="nt-reason" rows="2" placeholder="e.g. The run logged it wrongly; the source reads fine"></textarea></label>'+
    '<div class="fld"><span>Bring it back</span>'+
      (run? opt("run","After the next run, if it's still there") : "")+
      opt("keep","Keep it hidden until I undo it")+
      opt("date","On a date, if it's still there",' <input type="date" id="nt-until" min="'+addDays(today(),1)+'">')+'</div>'+
    '<p class="statushint" style="margin:6px 0 0">Only this item is hidden. Nothing on the board changes.</p>'+
    '<div class="statusacts" style="margin-top:12px"><button type="button" class="btn primary" data-nt="save">Save</button><button type="button" class="btn ghost" data-close="nt-dialog">Cancel</button><span class="statushint" id="nt-hint"></span></div>';
  var d=ntDlg(); if(d.showModal) d.showModal(); else d.setAttribute("open","");
  setTimeout(function(){ var t=el("nt-reason"); if(t) t.focus(); },30);
}
async function ntSave(){
  var F=NT_FORM; if(!F || !DB) return;
  var reason=(el("nt-reason")||{}).value||"", m=document.querySelector('#nt-body input[name="nt-mode"]:checked'), mode=m? m.value : (F.run? "run" : "keep");
  var until=(el("nt-until")||{}).value||"", hint=el("nt-hint");
  reason=reason.trim();
  if(!reason){ if(hint) hint.textContent="Add a reason."; var t=el("nt-reason"); if(t) t.focus(); return; }
  if(mode==="date" && !/^\d{4}-\d{2}-\d{2}$/.test(until)){ if(hint) hint.textContent="Pick a date."; return; }
  var id=ntDocId(F.key), doc={key:F.key, title:F.title, item:ntItemKey(F.it), label:String(F.it.label||"").replace(/ · you noted this.*$/,""),
    reason:reason, mode:mode, until: mode==="date"? until : "", date:today(), at:new Date().toISOString(), by:"you"};
  try{
    await DB.doc("noted/"+id).set(doc);
    NOTED[F.key]=Object.assign({id:id},doc);
    var d=el("nt-dialog"); if(d && d.close) d.close();
    try{ renderHygiene(); }catch(e){}
    toastUndo("Noted and hidden",function(){ ntUndo(F.key); });
  }catch(e){ console.warn(e); if(hint) hint.textContent="Couldn't save — try again."; }
}
async function ntUndo(key){
  var n=NOTED[key]; if(!n || !DB) return;
  try{ await DB.doc("noted/"+(n.id||ntDocId(key))).delete(); delete NOTED[key]; try{ renderHygiene(); }catch(e){} toast("Back on the list"); }
  catch(e){ console.warn(e); toast("Couldn't undo — try again",true); }
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-nt]"); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var a=b.dataset.nt;
  if(a==="open") return ntOpen(b.dataset.key);
  if(a==="save") return ntSave();
  if(a==="undo") return ntUndo(b.dataset.key);
});
document.addEventListener("toggle",function(ev){ var t=ev.target; if(t && t.classList && t.classList.contains("ntc")) NT_OPEN=t.open; },true);

(function(){ var st=document.createElement("style");
  st.textContent=
    /* An item and its Noted button read as one pill: the item opens it, Noted on the right hides it. */
    ".ntwrap{display:inline-flex;align-items:stretch;max-width:100%;border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden}"+
    ".ntwrap:hover{border-color:var(--accent)}"+
    ".ntwrap>.hyi{border:0!important;border-radius:0!important;background:none!important;min-width:0;white-space:normal;display:block}"+
    ".ntbtn{flex:none;border:0;border-left:1px solid var(--line);background:var(--surface-2);font:inherit;font-size:11.5px;font-weight:500;padding:3px 10px;color:var(--ink-2);cursor:pointer;white-space:nowrap}"+
    ".ntbtn:hover,.ntbtn:focus-visible{background:var(--accent-soft);color:var(--accent-ink);outline:none}"+
    ".ntwrap.ntblk{display:flex;flex-direction:column;align-items:flex-start;gap:4px;border:0;border-radius:0;background:none;overflow:visible;width:100%}"+
    ".ntblk>.ntbtn{border:1px solid var(--line);border-radius:99px;padding:2px 10px}"+
    ".hyrt .hygo{margin-left:auto;white-space:nowrap;margin-top:-4px;margin-bottom:-4px;text-decoration:none}.hyrt .hygo:hover{border-color:var(--accent);color:var(--accent-ink)}"+
    ".hyrt .hygo~.hyact,.hyrt .hygo~.hywho,.hyrt .hygo~[data-fx]{margin-left:0}"+
    ".ntc>summary{cursor:pointer;list-style:none}.ntc>summary::-webkit-details-marker{display:none}"+
    ".ntc>summary h3::after{content:\" ▸\";color:var(--muted);font-weight:400}.ntc[open]>summary h3::after{content:\" ▾\"}"+
    ".ntlist{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}"+
    ".ntlist li{display:flex;gap:10px;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:8px}"+
    ".ntl{display:flex;flex-direction:column;gap:2px;min-width:0;font-size:13px}.ntl small{color:var(--muted);font-size:12px}"+
    ".ntopt{display:flex;align-items:center;gap:6px;font-size:13px;margin-top:4px}.ntopt input[type=radio]{width:auto;margin:0}.ntopt input[type=date]{width:auto}";
  document.head.appendChild(st); })();
(async function(){
  var db=null; try{ db=window.claude && window.claude.use? await window.claude.use("db") : null; }catch(e){ db=null; }
  if(!db) return;
  db.collection("noted").onSnapshot(function(s){ NOTED={}; s.docs.forEach(function(d){ var o=Object.assign({},d.data()); o.id=d.id; if(o.key) NOTED[o.key]=o; }); try{ renderHygiene(); }catch(e){} },function(e){ console.warn("noted sub",e&&e.code); });
})();
