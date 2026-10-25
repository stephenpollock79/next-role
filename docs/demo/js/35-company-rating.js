"use strict";
/* ===== Rating drives the sweep (5 Oct) =====
   One rating per company, set on the Companies list (collapsed row or open card), off-list companies included.
   Want it = board checked every sweep · Would consider = once a week · If it appears and Unrated = never fetched,
   roles reach the user through alerts and searches · Off the list = never searched, kept in a collapsed section.
   Helpers live in 01 (RATE_ORDER, coOff, coRating, rateWatch, coWatch, coCadence, coOffWhy, coReadOf) because
   07 renders before this file loads. `watch` is written in step with the rating so older readers keep working. */

var CO_OFF_REASONS=[["rejected","Not for me"],["excluded","Fails a deal-breaker"],["defunct","Employer may be gone"]];

function coSetRating(id,v,sel){
  var c=companies.find(function(x){return x.id===id;}); if(!c || !DB) return;
  var was=coRating(c);
  if(v===was) return;
  var before={priority:c.priority||"unrated", listing:c.listing||"target", watch:!!c.watch, watchWhy:c.watchWhy||"", offNote:c.offNote||"", offAt:c.offAt||""};
  if(v==="off"){
    if(sel) sel.value=was;   /* stays as it was until the reason is saved */
    openForm({title:"Rule out "+(c.name||"this company"), ok:"Rule it out",
      lede:"It won't be searched, and its roles from alerts are dropped. Its research and history are kept in Ruled out at the bottom; change the rating to bring it back.",
      fields:[{id:"why", label:"Why — a few words, shown on its row", placeholder:"e.g. only hires in Tel Aviv"}],
      onSave:function(val){
        var r=el("fm-offr"); var reason=r? r.value : "rejected";
        if(!val.why) return "Say why, in a few words.";
        DB.doc("companies/"+id).update({listing:reason, watch:false, offNote:val.why, offAt:today(), watchWhy:"Not searched — "+val.why})
          .then(function(){ toastUndo((c.name||id)+" is ruled out",function(){ DB.doc("companies/"+id).update(before); }); })
          .catch(function(){ toast("Couldn't save — try again",true); });
      }});
    var b=el("fm-body"); if(b) b.insertAdjacentHTML("beforeend",'<label class="fld">Reason<select id="fm-offr">'+
      CO_OFF_REASONS.map(function(o){ return '<option value="'+o[0]+'">'+esc(o[1])+'</option>'; }).join("")+'</select></label>');
    return;
  }
  var patch={priority:v, watch:rateWatch(v)};
  if(coOff(c)){ patch.listing="target"; patch.offNote=""; patch.offAt=""; patch.watchWhy=""; }
  DB.doc("companies/"+id).update(patch)
    .then(function(){ if(was==="off") toastUndo((c.name||id)+" is back on the list",function(){ DB.doc("companies/"+id).update(before); }); })
    .catch(function(){ if(sel) sel.value=was; toast("Couldn't save — try again",true); });
}

/* Alert set: the user has added the company to their LinkedIn alert search. */
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-coalert]"); if(!b || !DB) return;
  ev.preventDefault(); var id=b.dataset.coalert, c=companies.find(function(x){return x.id===id;}); if(!c) return;
  var before={boardAts:c.boardAts||"", boardNeedsAlert:!!c.boardNeedsAlert, boardStatus:c.boardStatus||"", boardAlert:c.boardAlert||""};
  DB.doc("companies/"+id).update({boardAts:"linkedin-alert", boardNeedsAlert:false, boardStatus:"alert", boardAlert:"LinkedIn alert (set "+today()+")"})
    .then(function(){ toastUndo((c.name||id)+" now comes through your LinkedIn alert",function(){ DB.doc("companies/"+id).update(before); }); })
    .catch(function(){ toast("Couldn't save — try again",true); });
});
/* My criteria's ruled-out line (11 Oct) opens Companies with the Ruled out section open. Capture, so it runs before 12's data-gotab handler. */
document.addEventListener("click",function(ev){ var a=ev.target.closest && ev.target.closest("[data-cooff]"); if(a) CO_OFF_OPEN=true; },true);
/* Remember whether Off the list is open across redraws. */
document.addEventListener("toggle",function(ev){ var t=ev.target; if(t && t.id==="co-offlist") CO_OFF_OPEN=t.open; },true);

/* Data health: companies whose board can't be fetched and that aren't on the alert yet. */
HY_PLAIN["Companies that need a LinkedIn alert"]=["Companies that need a LinkedIn alert","Their job board can't be fetched, so roles only reach you if they're in your LinkedIn alert search. Add them there, then press Alert set on the company.","you"];
HY_YOUDO["Companies that need a LinkedIn alert"]="Add to your alert";
HY_PLAIN["Companies you haven't rated"]=["Companies you haven't rated","Unrated companies aren't searched; their roles only reach you through alerts and searches. Rate each one: Want it or Would consider puts its job board in the sweep.","you"];
HY_YOUDO["Companies you haven't rated"]="Rate it";
hygiene=(function(orig){ return function(){
  var out=orig();
  out.push({sec:"Scores", title:"Companies you haven't rated", why:"", sev:"fix",
    items:companies.filter(function(c){ return !coOff(c) && coRating(c)==="unrated"; })
      .map(function(c){ return {k:"co", id:c.id, label:(c.name||c.id)+(c.sector? " · "+c.sector : "")}; })});
  out.push({sec:"Links", title:"Companies that need a LinkedIn alert", why:"", sev:"fix",
    items:companies.filter(function(c){ return !coOff(c) && c.boardNeedsAlert && c.boardAts!=="linkedin-alert"; })
      .map(function(c){ return {k:"co", id:c.id, label:(c.name||c.id)+" · "+PRILABEL[coRating(c)]}; })});
  return out;
}; })(hygiene);

/* Search jumps to the top (5 Oct): typing in any page's search box scrolls the page back to the top, so the
   filtered results are in view instead of above the fold. The search boxes sit in pinned headers, so they stay put. */
document.addEventListener("input",function(ev){
  var t=ev.target; if(!t || !t.matches || !t.matches('input[type="search"]')) return;
  if(t.closest && t.closest("dialog")) return;
  if(window.scrollY>0) window.scrollTo({top:0, behavior:"auto"});
});

/* Rate from Data health (21 Oct): each unrated company in "Companies you haven't rated" carries the rating
   buttons, so you rate the list in place instead of opening each company. The row drops off once the rating saves. */
var HY_RATE_BTNS=[["high","Want it"],["medium","Would consider"],["low","If it appears"],["off","Rule out…"]];
hygiene=(function(orig){ return function(){
  var out=orig();
  out.forEach(function(x){ if(x.title==="Companies you haven't rated") x.items.forEach(function(it){ it.rate=1; }); });
  return out;
}; })(hygiene);
hyItem=(function(orig){ return function(x){
  var h=orig(x); if(!x || !x.rate) return h;
  return '<div class="hyrate">'+h+'<span class="hyrbtns">'+HY_RATE_BTNS.map(function(b){
    return '<button type="button" class="btn sm'+(b[0]==="off"? " ghost" : "")+'" data-hyrate="'+b[0]+'" data-id="'+esc(x.id)+'" title="'+esc((RATE_CAD[b[0]]||{}).txt||"")+'">'+esc(b[1])+'</button>'; }).join("")+'</span></div>';
}; })(hyItem);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-hyrate]"); if(!b || !DB) return;
  ev.preventDefault(); ev.stopPropagation();
  var id=b.dataset.id, v=b.dataset.hyrate, c=companies.find(function(x){return x.id===id;}); if(!c) return;
  if(v==="off"){ coSetRating(id,"off"); return; }
  var before={priority:c.priority||"unrated", watch:!!c.watch};
  var row=b.closest(".hyrate"); if(row) Array.prototype.forEach.call(row.querySelectorAll("button"),function(x){ x.disabled=true; });
  DB.doc("companies/"+id).update({priority:v, watch:rateWatch(v)})
    .then(function(){ toastUndo((c.name||id)+" rated "+PRILABEL[v]+" — "+((RATE_CAD[v]||{}).txt||""),function(){ DB.doc("companies/"+id).update(before); }); })
    .catch(function(){ if(row) Array.prototype.forEach.call(row.querySelectorAll("button"),function(x){ x.disabled=false; }); toast("Couldn't save — try again",true); });
},true);
(function(){ var st=document.createElement("style");
  st.textContent=".hyrate{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;width:100%;padding:4px 0}"+
    ".hyrate .hyrbtns{display:inline-flex;flex-wrap:wrap;gap:6px}.hyrate .btn.sm{padding:3px 10px;font-size:12px}";
  document.head.appendChild(st); })();

/* I'll check it myself (25 Oct): for someone who doesn't use LinkedIn or Gmail alerts. The company stops needing
   an alert (boardAts "manual-check"), and its jobs page joins Sites I check, so the weekly "Check the sites you
   search yourself" task covers it. Its rating, and so its place in the search, stays as it is. Undo puts both back.
   52's no-Gmail move calls coSelfCheckAll for every rated company that needed an alert. */
function coSelfUrl(c){ return c.boardUrl || c.careersUrl || c.url || c.website || ""; }
async function coSelfCheck(c,quiet){
  var before={boardAts:c.boardAts||"", boardNeedsAlert:!!c.boardNeedsAlert, boardStatus:c.boardStatus||"", boardAlert:c.boardAlert||""};
  var u=coSelfUrl(c), sid="co-"+c.id+"-jobs", made=false;
  await DB.doc("companies/"+c.id).update({boardAts:"manual-check", boardNeedsAlert:false, boardStatus:"manual", boardAlert:"You check its jobs page yourself (set "+today()+")"});
  if(!(srcs||[]).some(function(s){ return s.id===sid; })){
    await DB.doc("sources/"+sid).set({name:(c.name||c.id)+" jobs page", url:u, channelId:"manual", status:"active", why:"You check this company's jobs page yourself", note:u? "" : "No jobs page link yet: search for it",
      order:(srcs||[]).length+1, companyId:c.id, createdVia:"selfcheck", addedAt:today()}); made=true; }
  var undo=async function(){ await DB.doc("companies/"+c.id).update(before); if(made) await DB.doc("sources/"+sid).delete(); };
  if(!quiet) toastUndo((c.name||c.id)+" added to Sites I check: you check its jobs page yourself",function(){ undo().catch(function(){}); });
  return undo;
}
async function coSelfCheckAll(){
  var cs=companies.filter(function(c){ return !coOff(c) && c.boardNeedsAlert && c.boardAts!=="linkedin-alert" && (c.priority==="high"||c.priority==="medium"); }), n=0;
  for(var i=0;i<cs.length;i++){ try{ await coSelfCheck(cs[i],true); n++; }catch(e){} }
  return n;
}
hygiene=(function(orig){ return function(){
  var out=orig();
  out.forEach(function(x){ if(x.title==="Companies that need a LinkedIn alert") x.items.forEach(function(it){ it.selfchk=1; }); });
  return out;
}; })(hygiene);
hyItem=(function(orig){ return function(x){
  var h=orig(x); if(!x || !x.selfchk) return h;
  return '<div class="hyrate">'+h+'<span class="hyrbtns"><button type="button" class="btn sm ghost" data-coself="'+esc(x.id)+'" title="No LinkedIn? The company joins Sites I check instead; its rating stays as it is">I\'ll check it myself</button></span></div>';
}; })(hyItem);
document.addEventListener("click",function(ev){
  var b=ev.target.closest && ev.target.closest("[data-coself]"); if(!b || !DB) return;
  ev.preventDefault(); ev.stopPropagation();
  var c=companies.find(function(x){ return x.id===b.dataset.coself; }); if(!c) return; b.disabled=true;
  coSelfCheck(c).catch(function(){ b.disabled=false; toast("Couldn't save — try again",true); });
},true);
