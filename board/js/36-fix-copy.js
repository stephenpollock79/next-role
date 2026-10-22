"use strict";
/* ===== Data health: three routes to a fix (6 Oct) =====
   1. Board fix: the board does it now, with undo (24's "Fix these" pop-up; unchanged).
   2. Copy for Claude: checks the board can't fix, or can't fix in real time. A button copies a short request to
      paste into a chat with Claude; the next-role-fix skill holds how each kind is done (FX_KIND names the kind).
      Replaces the overnight queue ("Queue for tonight"): no check is "claude" any more. Jobs already in
      `fixqueue` are still worked by next-role-daily-check.
   3. Needs you: decisions and scores; links to the place, buttons where the board can record the answer.
   Also: "Companies that need a LinkedIn alert" only counts companies rated Want it or Would consider — the sweep
   never reads boards for If it appears or unrated companies, so a board it can't read there is no gap. */

var FX_KIND={
  "Companies that need a LinkedIn alert":"linkedin-alert",
  "Postings the morning run couldn't read":"read-posting",
  "Live roles with no posting link":"find-link",
  "Links not checked live in over two weeks":"recheck-link",
  "Shortlist or later with no Them score":"role-fit",
  "Live roles with no company card":"company-card",
  "To apply with no CV draft after a morning run":"build-pack",
  "Interviews soon with no prep":"interview-prep",
  "Scheduled tasks overdue or failed":"task-run",
  "Sweeps that hit their limits":"run-limits",
  "Sources that went quiet":"source-quiet",
  "Sources the sweep couldn't read":"source-access",
  "Sweep overdue":"sweep-overdue",
  "Board errors":"board-error"
};
var FX_TEXT={
  "Companies that need a LinkedIn alert":["Companies that need a LinkedIn alert","Their job board can't be fetched, so their roles only reach you through a LinkedIn alert. Claude adds them to one in your browser and marks Alert set."],
  "Postings the morning run couldn't read":["Job ads that couldn't be opened","Claude finds the ad on the employer's own site or reads it in your browser. If neither works, it asks you to paste the text."],
  "Live roles with no posting link":["Live roles with no link to the job ad","Claude looks for the role on the employer's own site and adds the link, so it can be checked."],
  "Links not checked live in over two weeks":["Job ads not checked for over two weeks","Counted from the last check, or from when the role arrived or was shortlisted. Claude re-checks them now."],
  "Shortlist or later with no Them score":["Roles with no Role Fit score","Claude scores your CV against the ad."],
  "Live roles with no company card":["Live roles with no company card","Company research, your rating and warm routes can't show. Claude builds the cards."],
  "To apply with no CV draft after a morning run":["Roles at To apply with no CV draft","The morning run should have built one. Claude builds the pack now."],
  "Interviews soon with no prep":["Interviews in the next two days with no prep notes","Claude preps the next round now."],
  "Scheduled tasks overdue or failed":["Scheduled tasks overdue or failed","A task missed its usual run or its last run failed. Claude checks the scheduled task, says why, and runs it again."],
  "Sweeps that hit their limits":["Runs that keep stopping early","The same scheduled run stopped before finishing three times in a row without catching up. Claude finds out why and proposes a lasting fix."],
  "Sources that went quiet":["Sources that went quiet","They usually return listings, but the sweep read none from them in the last two sweeps. Claude tests each one and fixes the setting, or says what's needed. (A source that reads fine but has nothing that fits shows in Highlights instead.)"],
  "Sources the sweep couldn't read":["Sources the sweep couldn't read","Blocked or failing on the last two sweeps, or the job-alert email couldn't be read. Claude tests them and fixes what it can; some need you (e.g. reconnect Gmail)."],
  "Sweep overdue":["The sweep is overdue","No sweep for longer than its usual gap. Claude checks its scheduled task and runs it."],
  "Board errors":["Board errors","Something on this page failed in the last week. Claude looks at it and fixes it."]
};
Object.keys(FX_TEXT).forEach(function(k){ HY_PLAIN[k]=[FX_TEXT[k][0], FX_TEXT[k][1], "copy"]; });

/* Alerts only for companies the sweep would read. */
function fxSwept(c){ var k=typeof coRating==="function"? coRating(c) : (c.priority||"unrated"); return k==="high"||k==="medium"; }
hygiene=(function(orig){ return function(){
  var out=orig();
  out.forEach(function(x){ if(x.title==="Companies that need a LinkedIn alert") x.items=x.items.filter(function(it){ var c=companies.find(function(y){return y.id===it.id;}); return c && fxSwept(c); }); });
  return out;
}; })(hygiene);

/* The plan: copy checks get their own group instead of "needs you". */
hyPlan=(function(orig){ return function(){
  var P=orig(); P.copy=P.you.filter(function(y){ return hyWho(y.x)==="copy"; }); P.you=P.you.filter(function(y){ return hyWho(y.x)!=="copy"; });
  return P;
}; })(hyPlan);

/* ---------- the copied request ---------- */
function fxItemLine(it){ var id=it.id||it.k||""; return "- "+id+" · "+String(it.label||"").replace(/\s+/g," ").trim()+(it.note? " ("+String(it.note).replace(/\s+/g," ").trim()+")" : ""); }
function fxText(groups){
  var lines=["Run next-role-fix on my Next Role board"+boardRef()+". Work each kind below, then tell me what you did and anything left for me.",""];
  groups.forEach(function(g){ if(!g.items.length) return;
    lines.push((FX_KIND[g.title]||"other")+" — "+((HY_PLAIN[g.title]||[g.title])[0])+":");
    g.items.forEach(function(it){ lines.push(fxItemLine(it)); });
    lines.push(""); });
  return lines.join("\n").trim();
}
function fxGroups(k){
  return hygiene().filter(function(x){ return x.items.length && hyWho(x)==="copy" && (!k || x.title===k); }).map(function(x){ return {title:x.title, items:x.items}; });
}
function fxShow(txt,n){
  var d=el("fx-dialog");
  if(!d){ d=document.createElement("dialog"); d.id="fx-dialog"; d.className="modal hfdlg"; d.setAttribute("aria-label","Copy for Claude");
    d.innerHTML='<div class="modal-head"><h3>Copy for Claude</h3><button type="button" class="btn ghost" data-close="fx-dialog">Close</button></div><div id="fx-body"></div>';
    document.body.appendChild(d); }
  el("fx-body").innerHTML='<p class="hfi">Copy this and paste it into a <b>new chat in your Next Role project</b> in Claude. That\'s where Claude has the board and its skills; it works through '+plural(n,"fix","fixes")+' and tells you what it did.</p>'+
    '<textarea class="fxta" readonly rows="14"></textarea><div class="hffoot"><button type="button" class="btn primary" data-fxcopy="1">Copy</button><button type="button" class="btn ghost" data-close="fx-dialog">Close</button></div>';
  d.querySelector(".fxta").value=txt;
  if(d.showModal) d.showModal(); else d.setAttribute("open","");
}
function fxClip(txt,ok,bad){
  function legacy(){ try{ var t=document.querySelector("#fx-dialog .fxta"); if(t){ t.focus(); t.select(); if(document.execCommand("copy")) return ok(); } }catch(e){} bad(); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, legacy); else legacy();
}
/* Always a pop-up (6 Oct): you see the request and where to paste it, then press Copy. */
function fxCopy(k){
  var g=fxGroups(k), n=g.reduce(function(m,x){return m+x.items.length;},0); if(!n){ toast("Nothing for Claude to fix"); return; }
  fxShow(fxText(g),n);
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-fxcopy]"); if(!b) return;
  ev.preventDefault(); var t=document.querySelector("#fx-dialog .fxta"); if(!t) return;
  fxClip(t.value,function(){ b.textContent="Copied ✓"; toast("Copied — paste it into a new chat in your Next Role project"); },
    function(){ t.focus(); t.select(); b.textContent="Select and copy by hand"; });
});

/* ---------- Runs that keep stopping early (6 Oct) ----------
   A run that hits its cap once is usually a backlog being worked through (e.g. job boards 25 a day), so it isn't a
   problem. Flag a scheduled run only when its last three runs all stopped early and the work left (`left`, a count
   the run records) didn't shrink over them; with no counts recorded, three in a row is enough. Replaces 28's
   "the last two sweeps" and "any capped task" rules. */
function fxLimitItem(key,lab,rs){
  var r3=rs.slice(0,3); if(r3.length<3 || !r3.every(function(r){ return r.capped; })) return null;
  var L=r3.map(function(r){ return (r.left===0||+r.left>0)? +r.left : null; });
  var counted=L[0]!=null && L[2]!=null;
  if(counted && L[0]<L[2]) return null;   /* still catching up */
  return {k:"task", id:"lim-"+key, label:lab+" · stopped early "+r3.slice().reverse().map(function(r){ return niceShort(r.date); }).join(", ")+
    (counted? " · "+L[2]+" → "+L[0]+" left" : "")+(r3[0].cappedNote? " · "+clip(String(r3[0].cappedNote),90) : "")};
}
function fxLimits(){
  var out=[], byT={};
  (typeof TR!=="undefined"? TR : []).forEach(function(x){ if(x.type && x.date) (byT[x.type]=byT[x.type]||[]).push(x); });
  Object.keys(byT).forEach(function(k){ var rs=byT[k].sort(function(a,b){ return a.date<b.date? 1 : a.date>b.date? -1 : String(a.at||"")<String(b.at||"")? 1 : -1; });
    var it=fxLimitItem(k,(typeof TR_LAB!=="undefined" && TR_LAB[k])||k,rs); if(it) out.push(it); });
  var sw=typeof hySweepRuns==="function"? hySweepRuns() : [], it=fxLimitItem("sweep","Sweep",sw); if(it) out.push(it);
  return out;
}
hygiene=(function(orig){ return function(){
  var out=orig(); out.forEach(function(x){ if(x.title==="Sweeps that hit their limits") x.items=fxLimits(); }); return out;
}; })(hygiene);

/* ---------- the page ---------- */
hyRowAct=(function(orig){ return function(x,w,P){
  if(w==="copy") return '<button type="button" class="btn primary hyact" data-fx="one" data-k="'+esc(x.title)+'" title="Copies a request to paste into a chat with Claude">Copy for Claude</button>';
  return orig(x,w,P);
}; })(hyRowAct);
renderHygiene=(function(orig){ return function(){
  orig();
  var s=document.querySelector("#hy-body .hystrip"); if(!s) return;
  var P=hyPlan(), nB=P.board.length, nC=P.copy.reduce(function(m,y){return m+y.n;},0), nY=P.you.reduce(function(m,y){return m+y.n;},0), nT=nB+nC+nY;
  function sn(n,cls,lab){ return n? '<div class="hysn"><b'+(cls? ' class="'+cls+'"' : "")+'>'+n+'</b><span>'+lab+'</span></div>' : ""; }
  var parts=[nB? 1:0, nC? 1:0, nY? 1:0].reduce(function(a,b){return a+b;},0);
  s.innerHTML=(nT? sn(nT,"","to do")+(parts>1? sn(nB,"b","the board can fix now")+sn(nC,"b","Claude can fix")+sn(nY,"y",(nY===1? "needs" : "need")+" you") : "")
      : '<div class="hysn"><b class="b">✓</b><span>Nothing to do</span></div>')+
    (nB? '<button type="button" class="btn primary" data-hy="open">Fix all</button>' : "")+
    (nC? '<button type="button" class="btn'+(nB? "" : " primary")+'" data-fx="all" title="Copies one request for every fix Claude can do">Copy all for Claude</button>' : "");
}; })(renderHygiene);

/* Fix all: a group for Claude's fixes, between the board's and yours. */
hyDraw=(function(orig){ return function(){
  orig();
  if(!HYF || HYF.done || HYF.k || !HYF.P.copy || !HYF.P.copy.length) return;
  var b=el("hf-body"); if(!b) return;
  var n=HYF.P.copy.reduce(function(m,y){return m+y.n;},0);
  var html='<section class="hfg"><div class="hfgh"><span class="hfgi k-b"></span><div><h4>Claude can fix these <span class="hfgn">'+n+'</span></h4>'+
    '<p class="hfs">They need a look-up, the web or your browser. Copy the request and paste it into a chat with Claude.</p></div>'+
    '<button type="button" class="btn sm" data-fx="all">Copy for Claude</button></div>'+
    HYF.P.copy.map(function(y){ var P2=HY_PLAIN[y.x.title]||[y.x.title,""], its=y.items.slice(0,8);
      return '<div class="hfp"><div class="hfph"><b>'+esc(P2[0])+'</b> <span class="hfgn">'+y.n+'</span><span class="hfphw">'+esc(P2[1])+'</span></div><div class="hfl">'+
        its.map(function(it){ return '<div class="hfrow ny hfyou"><span></span><span class="hfw">'+hyItem(it)+'</span><span></span></div>'; }).join("")+
        (y.items.length>8? '<div class="hfrow ny hfmore"><span></span><span class="hfw">+ '+(y.items.length-8)+' more</span><span></span></div>' : "")+'</div></div>'; }).join("")+'</section>';
  var you=b.querySelector(".hfgi.k-y"), foot=b.querySelector(".hffoot"), at=you? you.closest(".hfg") : foot;
  if(at) at.insertAdjacentHTML("beforebegin",html); else b.insertAdjacentHTML("beforeend",html);
}; })(hyDraw);

document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-fx]"); if(!b) return;
  ev.preventDefault(); fxCopy(b.dataset.fx==="one"? b.dataset.k : "");
});
(function(){ var st=document.createElement("style");
  st.textContent=".fxta{width:100%;box-sizing:border-box;font:12.5px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:10px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--bg-2,transparent);color:inherit;resize:vertical}"+
    ".hystrip [data-fx]{margin-left:8px}";
  document.head.appendChild(st); })();
try{ renderHygiene(); }catch(e){}
