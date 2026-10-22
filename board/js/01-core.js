"use strict";
/* Board errors (5 Oct): caught from the first script on and kept here until 28 writes them to `errlog`, so Data
   health can say the board itself is misbehaving. Only errors from the board's own files are kept. */
var NR_ERRS=[];
window.addEventListener("error",function(ev){ try{ var f=String(ev.filename||""); if(f && !/\/js\/\d\d-/.test(f)) return;
  NR_ERRS.push({msg:String(ev.message||"Error").slice(0,200), where:(f.split("/").pop()||"").split("?")[0]+(ev.lineno? ":"+ev.lineno : "")}); if(typeof nrErrFlush==="function") nrErrFlush(); }catch(e){} });
window.addEventListener("unhandledrejection",function(ev){ try{ var r=ev.reason, m=r && (r.message||r.code)||String(r||""); if(!r || r.code==="cancelled" || r.code==="not_granted") return;
  NR_ERRS.push({msg:("Promise: "+m).slice(0,200), where:""}); if(typeof nrErrFlush==="function") nrErrFlush(); }catch(e){} });
var coFilter="all", CO_F={sweep:"",rate:"",flow:""};
try{ CO_F=Object.assign(CO_F, JSON.parse(localStorage.getItem("gb.cof")||"{}")||{}); }catch(e){}
var DB=null, roles=[], rawRoles=[], companies=[], runs=[], screened=[], decided=[], conversations=[], commitments=[], sectors=[], tab="overview";
/* Expansion is per-session and in memory: a card you opened stays open across re-renders, and
   everything starts collapsed on a fresh load. A thin row is the default because a sitting is a
   list you scan, not a stack of essays. */
var expanded = (typeof Set!=="undefined") ? new Set() : null;
function isOpen(id){ return !!(expanded && expanded.has(id)); }

/* ---------- why a role ended (1 Oct) ----------
   Two separate facts: who ended it, and why. Six reasons per side plus Other (which needs a note).
   The stage it ended at is recorded automatically. Old reason words are read through LEGACY, so the
   history counts alongside new entries without rewriting any stored row. */
var END_WHO={me:"I said no", them:"They said no", neither:"It went away"};
var END_LISTS={
  /* Most used first (3 Oct audit). Too technical, Wrong country and Missing a must-have added; Location split into
     Office days or commute and Wrong country. "Domain doesn't excite me" also covers sectors you avoid. */
  me:["Office days or commute","Wrong country","Domain doesn't excite me","Too technical","Pay below my bar","Fails one of my must-haves","Needs something I don't have","Level or scope wrong","Company concern","Chose another route","Other"],
  them:["No reason given","Went quiet","Domain experience","Level mismatch","Stronger or internal candidate","Pay or location","Other"],
  neither:["Role pulled or filled","Posting expired","Hiring freeze","Other"]
};
/* What each "I said no" reason means (4 Oct), shown on hover in the reject picker and spelled out in Highlights. */
var END_GLOSS={
  "Office days or commute":"too many office days, or too far to travel",
  "Wrong country":"the job is based somewhere you can't or won't work",
  "Domain doesn't excite me":"the product or sector doesn't interest you",
  "Too technical":"aimed at a more technical or engineering-led candidate",
  "Pay below my bar":"the pay is under what you'll accept",
  "Fails one of my must-haves":"it breaks one of your deal-breakers, so the sweep should have screened it out",
  "Needs something I don't have":"the role requires something you don't have, like a language, a qualification or specific experience",
  "Level or scope wrong":"too junior or too senior, or not really a product role",
  "Company concern":"something about the company itself: health, culture, ethics",
  "Chose another route":"you went after it another way, or picked a different role there"
};
/* Two reasons ask for the specific thing (4 Oct). "Fails one of my must-haves": which deal-breaker it fails
   (`endRule`), or a new one; it got past the sweep, so the rule's check is what to improve. "Needs something I
   don't have": what they require that you lack (`endGap`), picked from About me › What I don't have or added there. */
var END_SUB={"Fails one of my must-haves":"rule","Needs something I don't have":"gap"};
function myGaps(){ return ((PROFILE&&PROFILE.gaps)||[]).map(function(g){ return typeof g==="string"? {name:g} : g; }).filter(function(g){ return g && g.name; }); }
function gapKey(s){ return String(s||"").trim().toLowerCase(); }
function endSubHtml(reason,pfx,cur){
  var k=END_SUB[reason]; if(!k) return ""; cur=cur||{};
  if(k==="rule"){
    var rs=((PREFS&&PREFS.hardRules)||[]).filter(function(h){ return h && h.id; });
    return '<label class="fld endsub">Which of your deal-breakers does it fail?<select id="'+pfx+'" data-sub="rule"><option value="">Pick one…</option>'+
      rs.map(function(h){ return '<option value="'+esc(h.id)+'"'+(cur.v===h.id?" selected":"")+'>'+esc(h.id+" · "+(h.name||""))+'</option>'; }).join("")+
      '<option value="__new">+ New deal-breaker…</option></select><span class="statushint">It got past the sweep. Naming the rule tells the board which check to improve.</span></label>';
  }
  var gs=myGaps();
  return '<label class="fld endsub">What do they need that you don\'t have?<select id="'+pfx+'" data-sub="gap"><option value="">Pick one…</option>'+
    gs.map(function(g){ return '<option value="'+esc(g.name)+'"'+(cur.v && gapKey(cur.v)===gapKey(g.name)?" selected":"")+'>'+esc(g.name)+'</option>'; }).join("")+
    '<option value="__new"'+(cur.v==="__new"?" selected":"")+'>+ Something new…</option></select>'+
    '<input id="'+pfx+'-new" placeholder="e.g. Fluent French"'+(cur.v==="__new"? "" : " hidden")+' value="'+esc(cur.nw||"")+'">'+
    '<span class="statushint">It goes on About me › What I don\'t have, so Role Fit always counts it as a gap.</span></label>';
}
function endSubRead(reason,pfx){
  var k=END_SUB[reason]; if(!k) return {ok:true, patch:{}};
  var s=el(pfx), v=s? s.value : "";
  if(k==="rule"){ if(!v || v==="__new") return {ok:false, err:"Pick the deal-breaker it fails, or add a new one."}; return {ok:true, patch:{endRule:v}}; }
  if(v==="__new"){ var n=((el(pfx+"-new")||{}).value||"").trim(); if(!n) return {ok:false, err:"Say what they need that you don't have."}; return {ok:true, patch:{endGap:n}, newGap:n}; }
  if(!v) return {ok:false, err:"Pick what they need that you don't have."};
  return {ok:true, patch:{endGap:v}};
}
function addGap(name){
  if(!DB || !name) return; var gs=myGaps(); if(gs.some(function(g){ return gapKey(g.name)===gapKey(name); })) return;
  DB.doc("profile/me").update({gaps:gs.concat([{name:name, addedAt:today()}])}).catch(function(e){ console.warn("gap add",e); });
}
var END_SUB_NEW=null;   /* id of the select waiting for a new deal-breaker from the editor */
document.addEventListener("change",function(ev){
  var s=ev.target; if(!s || !s.matches || !s.matches("select[data-sub]")) return;
  if(s.dataset.sub==="gap"){ var nw=el(s.id+"-new"); if(nw){ nw.hidden=s.value!=="__new"; if(!nw.hidden) nw.focus(); } }
  if(s.dataset.sub==="rule" && s.value==="__new" && typeof ruOpenEditor==="function"){ END_SUB_NEW=s.id; ruOpenEditor(null); }
  if(s.id==="mr-sub" && typeof MR!=="undefined") MR.sub=s.value;
});
function endGlossAttr(x){ var g=END_GLOSS[x]; return g? ' title="'+esc(g.charAt(0).toUpperCase()+g.slice(1))+'"' : ""; }
var LEGACY={
  "wrong level":["me","Level or scope wrong"], "level wrong":["me","Level or scope wrong"], "scope not product":["me","Level or scope wrong"],
  "wrong location":["me","Office days or commute"], "office days":["me","Office days or commute"], "Location or office days":["me","Office days or commute"],
  "comp below bar":["me","Pay below my bar"], "Missing a must-have":["me","Needs something I don't have"],
  "dull product":["me","Domain doesn't excite me"], "domain dull":["me","Domain doesn't excite me"],
  "sector no":["me","Company concern"], "too early-stage":["me","Company concern"], "company health":["me","Company concern"], "culture concern":["me","Company concern"],
  "recruiter spam":["me","Other"], "withdrew":["me","Other"], "offer declined":["me","Chose another route"],
  "posting gone":["neither","Posting expired"], "posting closed":["neither","Posting expired"], "role pulled":["neither","Role pulled or filled"],
  "rejected after screening":["them","No reason given"], "rejected after interview":["them","No reason given"], "rejected after final":["them","No reason given"],
  "went quiet":["them","Went quiet"]
};
/* Reasons renamed after rows were stored with the old words (3 Oct). */
var END_RENAMED={"Location or office days":"Office days or commute"};
function legacyEnd(word, dflt){
  if(!word) return [dflt||"me","Other"];
  if(LEGACY[word]) return LEGACY[word];
  for(var w in END_LISTS){ if(END_LISTS[w].indexOf(word)>=0) return [w,word]; }
  return [dflt||"me","Other"];
}
/* Stored words stay "Gate 1" / "Gate 2" (endStage, rule fires); the screen says longlist / shortlist (1 Oct, late). */
function stageWord(t){ return String(t).replace(/Gate 1/g,"Longlist").replace(/Gate 2/g,"Shortlist").replace(/else Longlist|else Shortlist/,function(m){return m.toLowerCase();}); }
function endOf(r){
  if(r.stage!=="g1_rejected" && r.stage!=="g2_rejected" && r.stage!=="closed") return null;
  var stage = r.stage==="g1_rejected"? "Gate 1" : r.stage==="g2_rejected"? "Gate 2" :
    (r.endStage || ((r.closedAfter==="interview" || /interview|final/.test(r.closedReason||""))? "After interviewing" : "After applying"));
  if(r.endBy) return {by:r.endBy, reason:(END_RENAMED[r.endReason]||r.endReason||"Other"), note:r.endNote||"", stage:stage, at:r.endAt||r.closedAt||r.g2At||r.g1At||""};
  var word = r.stage==="g1_rejected"? r.g1Reason : r.stage==="g2_rejected"? r.g2Reason : r.closedReason;
  var lw = legacyEnd(word, r.stage==="closed"? "me" : "me");
  return {by:lw[0], reason:lw[1], note:r.rejectNote||r.closedNote||r.g1Note||"", stage:stage, at:r.closedAt||r.g2At||r.g1At||""};
}

/* ---------- closing a role out ----------
   28 Sep: "When I reject a role anywhere in the artifact it should ask for a reason. And also
   ask if company moves to non search. ie I need to be able to reject (or fail in an interview) for a
   role and decide if im open to more roles from that company or not."

   Two decisions, and they are genuinely separate: this role is over, and whether the employer is.
   A rejection at one company is usually not a verdict on the company — so "keep searching" is the
   default and stopping needs a reason, the same bar as anywhere else a company leaves the sweep. */
function closeBlock(r, kind){
  var c = coOf(r), cname = (c&&c.name) || r.company || "this company";
  var stillOn = !c || c.watch;
  /* Who first, then why (1 Oct). Before applying it can only be you or neither; once applied, all three. */
  var whos = kind==="out"? ["them","me","neither"] : ["me","neither"];
  var dflt = kind==="out"? "" : "me";
  /* Before applying there is no "they said no", so no who-picker (1 Oct: "Neither" read
     oddly with nothing to be neither of). One list in two groups; the group a reason sits in records who. */
  if(kind!=="out"){
    return '<div class="rejbox" id="rej-'+esc(r.id)+'" data-who="">'+
      '<div class="eyebrow">Your call</div>'+
      '<div class="reasons" data-who="me">'+END_LISTS.me.map(function(x){
        return '<button type="button" data-act="reason" data-id="'+esc(r.id)+'" data-r="'+esc(x)+'" aria-pressed="false"'+endGlossAttr(x)+'>'+esc(x)+'</button>'; }).join("")+'</div>'+
      '<div class="eyebrow" style="margin-top:4px">Or it\u2019s gone</div>'+
      '<div class="reasons" data-who="neither">'+END_LISTS.neither.filter(function(x){return x!=="Other";}).map(function(x){
        return '<button type="button" data-act="reason" data-id="'+esc(r.id)+'" data-r="'+esc(x)+'" aria-pressed="false"'+endGlossAttr(x)+'>'+esc(x)+'</button>'; }).join("")+'</div>'+
      rejTail(r,kind,c,cname,stillOn)+'</div>';
  }
  return '<div class="rejbox" id="rej-'+esc(r.id)+'" data-who="'+dflt+'">'+
    '<div class="endwho">'+whos.map(function(w){
      return '<button type="button" data-act="endwho" data-id="'+esc(r.id)+'" data-w="'+w+'" aria-pressed="'+(w===dflt)+'">'+esc(END_WHO[w])+'</button>';
    }).join("")+'</div>'+
    whos.map(function(w){
      return '<div class="reasons" data-who="'+w+'"'+(w===dflt? "" : " hidden")+'>'+END_LISTS[w].map(function(x){
        return '<button type="button" data-act="reason" data-id="'+esc(r.id)+'" data-r="'+esc(x)+'" aria-pressed="false"'+endGlossAttr(x)+'>'+esc(x)+'</button>';
      }).join("")+'</div>';
    }).join("")+rejTail(r,kind,c,cname,stillOn)+'</div>';
}
function rejTail(r,kind,c,cname,stillOn){
  return '<div class="rejsub" id="rejsubw-'+esc(r.id)+'"></div>'+
    /* Its own field, deliberately. The Gate 2 textarea above holds the RESEARCH note and arrives
       pre-filled — validating that it is non-empty validates nothing, and reusing it as the
       rejection reason would overwrite research with a verdict. */
    '<input placeholder="'+(kind==="g1" ? "Optional \u2014 four words is enough"
                          : kind==="g2" ? "Optional \u2014 a line if it adds to the reason"
                          : "What actually happened \u2014 a line is plenty")+'" id="rejnote-'+esc(r.id)+'">'+
    '<div><button type="button" class="btn sm" data-act="rl_open" data-id="'+esc(r.id)+'" title="Claude drafts a deal-breaker from this reason; you edit and save">Rule out roles like this</button></div>'+
    '<div class="statusacts" style="align-items:flex-start;flex-direction:column;gap:6px;'+
      'border-top:1px solid var(--line-2);padding-top:9px;margin-top:2px">'+
      '<div class="eyebrow">And '+esc(cname)+' itself?</div>'+
      (function(){
        /* Stopping the search while another role there is still live is almost never what you mean. */
        var others = c ? rolesOfCo(c.id).filter(function(x){
          return x.id!==r.id && !DEAD[x.stage] && x.stage!=="closed"; }) : [];
        return others.length
          ? '<div class="statushint" style="color:var(--bad)">'+others.length+
            ' other role'+(others.length===1?"":"s")+' at '+esc(cname)+' '+(others.length===1?"is":"are")+
            ' still live \u2014 '+esc(others.map(function(x){return x.title;}).join(", "))+
            '. Stopping the search does not close those.</div>'
          : "";
      })()+
      /* Rating at rejection (5 Oct): an unrated company must be rated before the role can be rejected, so
         companies stop piling up unrated. "stop" is Off the list (it reuses the why-stop box). */
      (function(){
        var sel0='<label class="setwrap" style="margin-left:0"><select data-act="co_after" data-id="'+esc(r.id)+'"';
        var why='<input id="costop-'+esc(r.id)+'" hidden placeholder="Why rule them out? \u2014 required, shown on their row">';
        /* No card yet (11 Oct): the company was never on a list, so the choice is to rule it out, not take it
           off. "stop" creates a bare off-list card (coRuleOutNew) so the sweep screens its roles out. */
        if(!c){
          if(!coNameOk(r)) return '<div class="statushint">The company isn’t known yet, so it can’t be ruled out here.</div>';
          return sel0+' data-nocard="1">'+
            '<option value="keep" selected>Keep seeing roles from '+esc(cname)+'</option>'+
            '<option value="stop">Rule out '+esc(cname)+' — no more roles from them</option>'+
          '</select></label>'+why;
        }
        if(coOff(c)) return '<div class="statushint">'+esc(cname)+' is already ruled out, so nothing changes there.</div>';
        if(coRating(c)==="unrated") return sel0+' data-rate="1">'+
            '<option value="" selected>Rate '+esc(cname)+' \u2014 pick one (required)</option>'+
            '<option value="high">Want it \u2014 board checked every sweep</option>'+
            '<option value="medium">Would consider \u2014 board checked weekly</option>'+
            '<option value="low">If it appears \u2014 alerts and searches only</option>'+
            '<option value="stop">Ruled out \u2014 no more roles from them</option>'+
          '</select></label>'+why;
        return sel0+'>'+
            '<option value="keep" selected>Keep '+esc(cname)+' as '+esc(PRILABEL[coRating(c)]||"rated")+'</option>'+
            '<option value="stop">Rule out '+esc(cname)+' \u2014 no more roles from them</option>'+
          '</select></label>'+why;
      })()+
    '</div>'+
    '<div class="statushint" id="rejhint-'+esc(r.id)+'"></div>'+
    '<div class="row"><button class="btn danger primary" data-act="rejsave" data-id="'+esc(r.id)+'" data-kind="'+esc(kind)+'" disabled title="Pick a reason first">'+(kind==="out"? "Close role" : "Reject role")+'</button>'+
    '<button class="btn ghost" data-act="rejcancel" data-id="'+esc(r.id)+'">Cancel</button></div>';
}
/* Deal-breakers shown on Shortlist research and the Fit tab: every rule checked at the search or, failing that,
   by the shortlist research ("Search, else Gate 2"), as [id, name]. Read from profile/prefs, never a fixed list. */
function g2Rules(){ return prefList("hardRules").filter(function(h){ return h.fires==="Search, else Gate 2"; }).map(function(h){ return [h.id, h.name||h.id]; }); }
var people=[], CMP=null;
/* Pay with its provenance (1 Oct): offer (in writing) > stated (ad, recruiter, interviewer)
   > estimate (salary data, source named). role.pay.{base,total} = {value, kind, source}. */
var PAYKINDS=[["","—"],["stated","Stated — the ad, a recruiter or interviewer"],["estimate","Estimate — salary data"]];
var PAYTAG={offer:["Offer","strong"], stated:["Stated",""], estimate:["Est.","mid"]};
function payOf(r,k){
  var o=r.offer||{}; if(o[k]) return {v:o[k], kind:"offer", src:"In writing"};
  var p=(r.pay||{})[k]; if(p && p.value) return {v:p.value, kind:p.kind||"", src:p.source||""};
  if(k==="base" && r.salary && !/^not stated|competitive/i.test(r.salary)) return {v:r.salary, kind:"", src:""};
  return null;
}
function payTag(kind){ var t=PAYTAG[kind]; return t? ' <span class="ptag '+t[1]+'">'+t[0]+'</span>' : ""; }
function payCell(r,k){
  var x=payOf(r,k); if(!x) return '<span style="color:var(--faint)">—</span>';
  return esc(clip(x.v,70))+payTag(x.kind)+(x.src && x.kind!=="offer"? '<div class="psrc">'+esc(clip(x.src,70))+'</div>' : "");
}
/* Money (22 Oct): the pay deal-breaker carries its own floor {amount, currency, basis: total | base}. A figure is
   read only in that currency and as a yearly amount: another currency, or a day or hourly rate, is not judged
   ("check it"), never converted. A figure with no currency marker is taken to be in the floor's currency. */
var CUR_SYM={GBP:"£", USD:"$", EUR:"€"};
var CUR_RE={GBP:/£|\bgbp\b/i, USD:/\$|\busd\b/i, EUR:/€|\beur\b/i};
function payNum(v,cur){
  v=String(v||""); cur=cur||(payFloor()||{}).currency||"GBP";
  if(/\bper\s*(day|hour|hr)\b|\/\s*(day|hour|hr|d|h)\b|\bday rate\b|\bdaily\b|\bhourly\b|\bp\/?d\b|\bp\/?h\b/i.test(v)) return null;
  var found=Object.keys(CUR_RE).filter(function(k){ return CUR_RE[k].test(v); });
  if(found.length && found.indexOf(cur)<0) return null;
  var src=v;
  if(found.length>1){
    /* Several currencies in one figure: keep only the amounts written with the floor's currency. */
    var keep=[]; v.replace(/(£|\$|€)?\s*(\d[\d,]*(?:\.\d+)?\s*k?)\s*(gbp|usd|eur)?/gi,function(m,sym,n,code){
      var c= sym? Object.keys(CUR_SYM).filter(function(k){ return CUR_SYM[k]===sym; })[0] : code? code.toUpperCase() : "";
      if(c===cur) keep.push(n); return m; });
    src=keep.join(" ");
  }
  var ns=[]; src.replace(/(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi,function(m,n,k){ var x=parseFloat(n.replace(/,/g,"")); if(k) x*=1000; if(x>=20000) ns.push(x); return m; });
  return ns.length? Math.max.apply(null,ns) : null;
}
/* What a deal-breaker is about (22 Oct). The type, not the rule's number, is how the board knows which rule is
   the pay one, the office one and so on: it sets the default firmness, the turn-down reasons a rule catches and the
   answer nudges. Set when the rule is drafted; one of these keys. Preferences carry the same types. */
var RULE_TYPES=[["pay","Pay"],["office","Office days"],["location","Location"],["rtw","Right to work"],["contract","Contract"],["hours","Hours"],
  ["level","Level"],["roletype","Role type"],["sector","Sector and domain"],["company","Company"],["employer","Named employers"],["other","Other"]];
var RULE_TYPE_FIRM={rtw:"fixed", location:"fixed"};
var RULE_TYPE_REASONS={pay:["Pay below my bar"], office:["Office days or commute"], location:["Wrong country"], rtw:["Wrong country"],
  level:["Level or scope wrong"], roletype:["Level or scope wrong"], sector:["Domain doesn't excite me"], company:["Company concern"], employer:["Company concern"]};
function prefList(k){ return ((typeof PREFS!=="undefined"&&PREFS&&PREFS[k])||[]).filter(function(x){ return x && x.id; }); }
/* Ids of the deal-breakers, then the preferences, of the given types. */
function prefIdsOfType(types){ return prefList("hardRules").concat(prefList("scored")).filter(function(x){ return types.indexOf(x.type)>=0; }).map(function(x){ return x.id; }); }
function payRule(){ return prefList("hardRules").filter(function(h){ return h.type==="pay"; })[0]||null; }
function payRuleId(){ var h=payRule(); return h? h.id : ""; }
function payFloor(){ var h=payRule(), f=h&&h.floor; return f && +f.amount>0? {amount:+f.amount, currency:f.currency||"GBP", basis:f.basis==="base"? "base" : "total"} : null; }
function fmtMoney(n,cur){ n=+n||0; var s=CUR_SYM[cur]||((cur||"")+" "); return s+(n>=1000 && n%1000===0? (n/1000)+"k" : n.toLocaleString("en-GB")); }
/* e.g. "Total package ≥ £50k": the pay rule's name and its floor. */
function payLabel(){ var h=payRule(), f=payFloor(); if(!h) return ""; return (h.name||h.id)+(f? " ≥ "+fmtMoney(f.amount,f.currency) : ""); }
/* The pay deal-breaker, judged on pay with its provenance: below the floor on a stated figure or an offer fails;
   on an estimate it is only at risk. */
function payState(r){
  var f=payFloor(); if(!f) return "unknown";
  var x= f.basis==="base"? payOf(r,"base") : (payOf(r,"total")||payOf(r,"base")); if(!x) return "unknown";
  var n=payNum(x.v,f.currency); if(n==null) return "unknown";
  if(n>=f.amount) return "pass";
  return (x.kind==="offer"||x.kind==="stated")? "fail" : "risk";
}
/* profile/settings, loaded at boot (18). The turn-down reasons and their hover text come from roles.endReasons and
   roles.endGloss; the code's lists are only the fallback. The reasons the board relies on are always kept. */
var SETTINGS=null;
var END_CORE={me:["Fails one of my must-haves","Needs something I don't have","Chose another route","Other"], them:["Went quiet","Other"], neither:["Role pulled or filled","Other"]};
var END_DEFAULT=null;
function applySettings(S){
  SETTINGS=S||null;
  if(!END_DEFAULT) END_DEFAULT={lists:JSON.parse(JSON.stringify(END_LISTS)), gloss:Object.assign({},END_GLOSS)};
  var R=(S&&S.roles)||{}, L=R.endReasons, G=R.endGloss;
  ["me","them","neither"].forEach(function(k){
    var list=(L && Array.isArray(L[k]) && L[k].length)? L[k].slice() : END_DEFAULT.lists[k].slice();
    END_CORE[k].forEach(function(c){ if(list.indexOf(c)<0) list.push(c); });
    END_LISTS[k]=list.filter(function(x){ return x!=="Other"; }).concat(["Other"]);
  });
  var g=(G && typeof G==="object")? G : END_DEFAULT.gloss;
  Object.keys(END_GLOSS).forEach(function(k){ delete END_GLOSS[k]; }); Object.keys(g).forEach(function(k){ END_GLOSS[k]=g[k]; });
}
/* Where and how the user works, from profile/me, for the prompts the board sends Claude. */
function engVar(){ var P=(typeof PROFILE!=="undefined"&&PROFILE)||{}; return /^us/i.test(P.spelling||"")? "American" : "British"; }
function whereText(){ var P=(typeof PROFILE!=="undefined"&&PROFILE)||{}, c=P.country||P.location||""; if(/^(united |netherlands|philippines|czech republic|bahamas|gambia)/i.test(c)) c="the "+c; return c? "in "+c+" or remote from there" : "where they can work"; }
function locText(s){ return String(s||"").replace(/\{ENG\}/g,engVar()).replace(/\{WHERE\}/g,whereText()); }
/* The user's own field, for wording that would otherwise assume a product manager: profile/me roleShort ("PM") and
   fieldTerm ("product"). isProductField() keeps the product-specific interview material for product roles. */
function fieldTerm(){ var P=(typeof PROFILE!=="undefined"&&PROFILE)||{}; return String(P.fieldTerm||(/product/i.test(P.profession||"")? "product" : "")||"").toLowerCase(); }
/* Before the profile loads, product (so a product board never flashes generic wording); a profile with no profession yet is generic. */
function isProductField(){ if(typeof PROFILE==="undefined" || !PROFILE) return true; return fieldTerm()==="product"; }
/* The board's own link, from profile/settings board.url, for the requests copied to Claude. */
function boardRef(){ var u=SETTINGS&&SETTINGS.board&&SETTINGS.board.url; return u? " ("+u+")" : ""; }
var channels=[], srcs=[];   /* declared early: the manual-pass chips render at start-up */
/* Falls back to this list until the manual sites channel ("Sites I check", id manual) exists on the board. */
var MANUAL_CHANNELS=[];
/* Preferences researched at the shortlist (stage "shortlist"), as [id, name]. */
function expRules(){ return prefList("scored").filter(function(s){ return s.stage==="shortlist"; }).map(function(s){ return [s.id, s.name||s.id]; }); }

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function el(id){return document.getElementById(id);}
/* LOCAL calendar date, not UTC. toISOString() reports UTC, so between midnight and 1am British
   Summer Time the whole board ran a day behind the person looking at it: "today" was yesterday,
   things booked for today did not appear under today, and the Week ahead count came out empty.
   Found 29 Sep at 00:48 BST, when the count went blank with three things genuinely due. */
function today(){ var d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
/* Both of these compared a date-only string (parsed as UTC midnight) against the current instant,
   so they drifted by a day near midnight for the same reason, and rounded a part-day difference
   into a whole one. Whole calendar days against the local today, via the same helper everything
   else uses. */
function days(d){ if(!d) return null; return dayGap(today(), d); }
function slug(s){return String(s||"role").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"role";}

/* ---------- ordering: sequence of keys, never a total ---------- */
function bands(r){
  var s=0,w=0,h=(r.highlights||[]);
  for(var i=0;i<h.length;i++){ if(h[i].band==="strong") s++; else if(h[i].band==="weak") w++; }
  return {strong:s,weak:w};
}
function orderG1(a,b){
  var au=(a.fun!=null||a.shot!=null)?0:1, bu=(b.fun!=null||b.shot!=null)?0:1;
  if(au!==bu) return au-bu;                                  // touched-but-undecided returns to the front
  var cf=closeFirst(a,b); if(cf) return cf;
  if(!!b.warm!==!!a.warm) return b.warm?1:-1;                // warm route
  /* Ordering key 2 is now company PRIORITY — your appetite, which does not decay. Tier was
     retired 28 Sep: it stacked five different axes into one number and its top band was a
     fact that expired. */
  var at=priRank(coOf(a)), bt=priRank(coOf(b)); if(at!==bt) return at-bt;
  var ab=bands(a), bb=bands(b);
  if(ab.weak!==bb.weak) return ab.weak-bb.weak;
  if(ab.strong!==bb.strong) return bb.strong-ab.strong;
  return String(b.seen||"").localeCompare(String(a.seen||""));
}

/* ---------- the company join ----------
   Company facts live once, in the companies collection, and are merged onto each role in memory.
   Every call site that used r.sector / r.size / r.warm keeps working unchanged, and there
   is exactly one place doing the join. A value on the role itself always wins, so a Gate 1 row that
   carries its own thin sector/size before any company research exists still renders. */
var PRI = {high:1, medium:2, low:3, unrated:4};
var PRILABEL = {high:"Want it", medium:"Would consider", low:"If it appears", unrated:"Unrated"};
/* unrated sorts last, and an unset priority is treated as unrated rather than guessed.
   Priority is the user's field: on 28 Sep 45 of them had been filled in by an agent, which is how
   TLC ended up at "Want it" for a company the user had never reviewed. */
function priRank(x){ return PRI[(x&&x.priority)||"unrated"] || 4; }

/* ---------- Rating drives the sweep (5 Oct) ----------
   One rating per company, the user's alone. Off the list = listing excluded | defunct | rejected (kept, never deleted).
   How often the sweep fetches a company's board is worked out from the rating; `watch` is kept in step on every
   rating change so older readers still work, but it is no longer set on its own. Only Want it and Would consider
   are fetched; Unrated is not searched until rated (5 Oct, later), so the fetched list only grows by a decision. */
PRILABEL.off="Ruled out";
var RATE_ORDER=["unrated","high","medium","low","off"];
var CO_OFFLIST={excluded:1, defunct:1, rejected:1};
var CO_OFF_OPEN=false;
function coOff(c){ return !!(c && CO_OFFLIST[c.listing||""]); }
function coRating(c){ return coOff(c)? "off" : ((c&&c.priority)||"unrated"); }
function rateWatch(v){ return v==="high" || v==="medium"; }   /* unrated is not searched (5 Oct) */
function coWatch(c){ return !coOff(c) && rateWatch(coRating(c)); }
var RATE_CAD={
  high:   {k:"every",  txt:"Board checked every sweep"},
  medium: {k:"weekly", txt:"Board checked once a week"},
  unrated:{k:"never",  txt:"Not searched until you rate it · roles reach you through alerts and searches"},
  low:    {k:"never",  txt:"Board not checked · roles reach you through alerts and searches"},
  off:    {k:"never",  txt:"Never searched"}
};
function coCadence(c){ return RATE_CAD[coRating(c)]||RATE_CAD.unrated; }
var CO_OFFLAB={excluded:"Fails a deal-breaker", defunct:"Employer may be gone", rejected:"Not for you"};
function coOffWhy(c){ if(!coOff(c)) return ""; var w=String(c.offNote||c.watchWhy||"").replace(/^Not searched\s*[—-]\s*/,"");
  var t=(CO_OFFLAB[c.listing]||"Ruled out")+(w? ": "+w : ""); if(!/[.!?]$/.test(t)) t+=".";
  return t+(c.listing==="excluded"? " Rating it back on won't stop the sweep dropping roles that fail that rule." : ""); }
/* How the sweep reads a company's roles: its own job board, a LinkedIn alert, or not known yet. */
function coReadOf(c){
  if(!c) return {k:"unknown", lab:"Not checked yet", txt:""};
  if(c.boardAts==="linkedin-alert") return {k:"alert", lab:"LinkedIn alert", txt:"The board can't be fetched, so its roles come by alert email."};
  if(c.boardNeedsAlert) return {k:"needs", lab:"Needs a LinkedIn alert", txt:"The board can't be fetched. Add the company to your LinkedIn alert search, then press Alert set."};
  if(c.boardUrl && c.boardAts && c.boardAts!=="none") return {k:"direct", lab:"Read directly", txt:(c.boardAts==="html"? "Careers page" : c.boardAts.charAt(0).toUpperCase()+c.boardAts.slice(1))+(c.boardSeen? " · last read "+niceShort(c.boardSeen) : "")};
  return {k:"unknown", lab:"Not checked yet", txt:"The next morning run looks for its job board."};
}

/* A company's live state is DERIVED from the roles collection, never stored.
   Tier 1 used to mean "live role at the right level" and went stale the moment a posting
   closed — TLC and Viator both sat there with dead requisitions. Nothing to remember now. */
var DEAD = {g1_rejected:1, g2_rejected:1, rejected:1};
var FLIGHT = {prep:1, applied:1, offer:1};
var GATES = {proposed:1, consideration:1, parked:1};
function coState(cid){
  var rs = rolesOfCo(cid);
  var flight = rs.filter(function(r){return FLIGHT[r.stage];});
  var gates  = rs.filter(function(r){return GATES[r.stage];});
  var dead   = rs.filter(function(r){return DEAD[r.stage];});
  if(flight.length) return {k:"flight", label:"In flight", roles:flight, all:rs, dead:dead};
  if(gates.length)  return {k:"gates",  label:"In the gates", roles:gates, all:rs, dead:dead};
  return {k: "none", label:"", roles:[], all:rs, dead:dead};
}

/* Company roles by stage, and the furthest live one (2 Oct: "In flight / In the gates" retired). */
var CO_STAGES=[["longlist","Longlist","gate1",{proposed:1}],["shortlist","Shortlist","gate2",{consideration:1,parked:1}],
  ["toapply","To apply","toapply",{prep:1}],["applied","Applied","inplay",{applied:1,offer:1}],["ended","Ended","rejected",{closed:1,g1_rejected:1,g2_rejected:1,rejected:1}]];
function coStages(cid){ var rs=rolesOfCo(cid); return CO_STAGES.map(function(st){ return {k:st[0], label:st[1], tab:st[2], n:rs.filter(function(r){return st[3][r.stage];}).length}; }); }
function coTop(cid){
  var c=coStages(cid), n={}; c.forEach(function(x){ n[x.k]=x.n; });
  if(n.applied) return ["Applied","cs-good"]; if(n.toapply) return ["To apply","cs-good"];
  if(n.shortlist) return ["Shortlist","cs-acc"]; if(n.longlist) return ["Longlist","cs-acc"];
  if(n.ended) return ["Ended","cs-dim"]; return ["No roles","cs-dim"];
}
/* Warm route is worked out (2 Oct): anyone there you know as a referrer, friend or ex-colleague,
   or a warm flag the research wrote. */
var WARM_HOW={"referrer":1,"friend":1,"ex-colleague":1};
function coWarmPeople(c){ return c? people.filter(function(x){ return (x.companyId===c.id || slug(x.company||"")===c.id) && WARM_HOW[String(x.how||"").toLowerCase()]; }) : []; }
function coWarm(c){ return !!c && (coWarmPeople(c).length>0 || !!c.warm); }
/* Roles on a sector card: at its companies, plus roles linked to it directly (sectorIds). */
function secRolesOf(sid){
  var cids=cosOfSec(sid).map(function(c){return c.id;}), seen={}, out=[];
  roles.forEach(function(r){ var co=coOf(r);
    if(((co && cids.indexOf(co.id)>=0) || (r.sectorIds||[]).indexOf(sid)>=0) && !seen[r.id]){ seen[r.id]=1; out.push(r); } });
  return out;
}
function coChart(stg){
  var mx=Math.max.apply(null,stg.map(function(x){return x.n;}).concat([1]));
  return '<div class="cochart" role="group" aria-label="Roles by stage">'+stg.map(function(x){
    return '<button type="button" class="cobar '+x.k+(x.n?"":" zero")+'" data-act="co_stage" data-tab="'+x.tab+'" title="'+x.n+' '+esc(x.label)+(x.n? " — show them" : "")+'"'+(x.n?"":" disabled")+'>'+
      '<span class="cbn">'+x.n+'</span><span class="cbb"><i style="height:'+(x.n? Math.max(14,Math.round(x.n/mx*100)) : 0)+'%"></i></span><span class="cbl">'+esc(x.label)+'</span></button>';
  }).join("")+'</div>';
}
function coOf(r){
  if(!r) return null;
  var cid = r.companyId || slug(r.company||"");
  return companies.find(function(c){return c.id===cid;}) || null;
}
function hydrate(){
  roles = rawRoles.map(function(r){
    var o=Object.assign({},r), c=coOf(r);
    if(!c) return o;
    o._co      = c;
    o.sector   = r.sector || c.sector || "";
    o.size     = r.size   || c.size   || "";
    o.warm     = (r.warm!=null) ? !!r.warm : coWarm(c);
    /* seat-specific referral state beats the company's "a route exists" note */
    o.warmNote = r.referral || r.warmNote || c.warmNote || "";
    return o;
  });
}
function rolesOfCo(cid){
  return rawRoles.filter(function(r){ return (r.companyId||slug(r.company||""))===cid; });
}

/* Rule out a company that has no card (11 Oct). Creates a bare company row already off the list
   (`listing: rejected`), so the sweep screens out its roles from every source. No research is done;
   rating it again on the Companies page brings it back. Returns {id, p} (p = the write's promise). */
function coNameOk(r){ var n=String((r&&r.company)||"").trim(); return !!n && !/^unknown company$/i.test(n); }
function coRuleOutNew(r,why){
  var nm=String(r.company||"").trim(), id=r.companyId || slug(nm);
  if(!DB || !nm) return {id:id, p:Promise.resolve()};
  var p=DB.doc("companies/"+id).set({
    name:nm, aka:"", priority:"unrated", listing:"rejected", watch:false,
    watchWhy:"Not searched — ruled out on "+today()+" after "+(r.title||"a role")+".",
    offNote:why, offAt:today(), createdVia:"rejection",
    warm:false, warmNote:"", sector:r.sector||"", size:"", hq:"", sites:"",
    health:"", culture:"", comp:"", ai:"", ladder:"",
    green:[], red:["Ruled out "+today()+", after "+(r.title||"a role")+": "+why], questions:[], notes:[],
    onTargetList:false, checkedAt:"", reconcile:""
  }).catch(function(e){ console.warn("company create failed",e&&e.code); el("offline").hidden=false; });
  return {id:id, p:p};
}

/* ---------- writes ---------- */
function saveCo(id,patch){
  if(!DB) return Promise.resolve();
  return DB.doc("companies/"+id).update(patch).catch(function(e){
    console.warn("company write failed",e&&e.code);
    if(e&&(e.code==="invalid_argument"||e.code==="not_granted")) el("offline").hidden=false;
  });
}
function save(id,patch){
  if(!DB) return Promise.resolve();
  return DB.doc("roles/"+id).update(patch).catch(function(e){
    console.warn("write failed",e&&e.code);
    if(e&&(e.code==="invalid_argument"||e.code==="not_granted")) el("offline").hidden=false;
  });
}


/* ---------- editing any item ----------
   29 Sep: "I need a way to edit the items ... any of them." One editor for every kind of
   record — commitments, roles, companies and logged conversations — driven by a field list per
   kind, so a field added later is one line here rather than a new form.

   What is deliberately NOT editable here: stage, Fun/Shot, gate dates, flow status, priority and
   the watch/warm/target toggles. Each already has its own control that records WHEN and WHY it
   moved; a free-text field for them would let a role jump a gate without the reason being asked.

   Values are read from the STORED document, never the hydrated one — a role's sector shown on its
   card is inherited from the company, and saving the editor must not copy it onto the role.

   The editor survives re-renders: a snapshot on any collection rebuilds the tab, so which editors
   are open and what has been typed live in memory and are painted back in. */
var EDITING = {}, DRAFTS = {};
var CMT_STATES = [["booked","Booked — date is fixed"],["offered","Offered — waiting on their reply"],
                  ["conditional","Conditional — waiting on an outcome"],["done","Done"],["recurring","Repeating task"]];
var CMT_TYPES  = [["conversation","Conversation"],["interview","Interview"],["prep-session","Prep session"],["task","Task"]];
var RELS = ["","referrer","talent acquisition","agency recruiter","hiring manager","peer / advisor","friend","other"];
var CONV_KINDS = ["Recruiter screen","Hiring manager","Panel or onsite","Informal chat","Agency recruiter","Follow-up","Other"];
var LISTINGS = [["target","Target list — searched"],["queue","Research queue — seat unverified"],
                ["revisit","Revisit only — fails a rule today"],["ruling","Needs your ruling"],
                ["excluded","Excluded — deal-breaker"],["defunct","Employer may be gone"],
                ["rejected","You rejected it"],["offlist","Off-list"]];

/* [field path, label, type, options]. type: text | area | date | select | list | role | company.
   "list" is an array edited one item per line. A dotted path writes inside a nested object. */

/* One rating scale for companies and sectors (1 Oct): "Two schemes doesn't add value. Use
   the company ones." Older sector records carry a stance; secPri() reads it until rewritten. */
var PRIOPTS=[["high","Want it"],["medium","Would consider"],["low","If it appears"],["unrated","Unrated"]];
var STANCE2PRI={domain:"high",strong:"high",good:"medium",acceptable:"medium",lower:"low",refused:"low",unrated:"unrated"};
function secPri(x){ return x.priority || STANCE2PRI[x.stance] || "unrated"; }
var EDIT_SPEC = {
  commitment: {coll:"commitments", find:function(id){return commitments.find(function(x){return x.id===id;});},
    key:[["title","What","text",{wide:1}],["detail","Detail","area",{wide:1}],
         ["state","State","select",CMT_STATES],["type","Type","select",CMT_TYPES],
         ["date","Date","date"],["time","Time","text"],
         ["condition","Unlocks on — conditional only","text",{wide:1}],
         ["blockedBy","Blocked by — two or three words, e.g. Screen feedback","text"],
         ["person","Person","text"],["relationship","Relationship","select",RELS],
         ["org","Organisation","text"],["roleId","Attached to a role","role"]],
    more:[["windowText","Offered window — what you proposed","text"],["sentAt","Message sent","date"],
          ["chaseBy","Chase by","date"],["court","Whose court","select",[["them","Them"],["me","Me"]]]]},
  role: {coll:"roles", find:function(id){return rawRoles.find(function(x){return x.id===id;});},
    key:[["title","Title","text"],["company","Company name as shown","text"],
         ["companyId","Linked company record","company"],["url","Posting URL","text"],
         ["location","Location","text"],["office","In office","text"],
         ["salary","Base / salary","text"],["closing","Closing date","date"],
         ["referral","Referral — who, and where it stands","text",{wide:1}],
         ["enrich.summary","Summary","area",{wide:1}]],
    more:[["enrich.seatPackage","Package — this seat","area",{wide:1}],["enrich.health","Company health","area",{wide:1}],
          ["enrich.culture","How the role is written","area",{wide:1}],
          ["enrich.openQuestions","Open questions — one per line","list",{wide:1}],
          ["red","Concerns — one per line","list",{wide:1}],["green","Pluses — one per line","list",{wide:1}],
          ["g2Note","Shortlist note","area",{wide:1}],["g1Note","Longlist note","text"],
          ["pay.base.value","Base pay","text"],["pay.base.kind","Base — where from","select",PAYKINDS],["pay.base.source","Base — source and date","text",{wide:1}],
          ["pay.total.value","Total package","text"],["pay.total.kind","Total — where from","select",PAYKINDS],["pay.total.source","Total — source and date","text",{wide:1}],
          ["rejectNote","Rejection note","area"],["closedNote","Close-out note","area"],
          ["parkUntil","Parked until","date"],["postingAge","Posting age","text"],
          ["source","Found by","select",[["agent","Agent"],["self","Me"]]],
          ["sourceId","Found through — channel and source","srcpick"]]},
  company: {coll:"companies", find:function(id){return companies.find(function(x){return x.id===id;});},
    key:[["name","Name","text"],["summary","Summary — two lines, verdict first","area",{wide:1}],["aka","Also known as / legal entity","text"],
         ["sector","Sector — description","text"],["sectorId","Sector card it belongs to","sector"],["size","Size","text"],["hq","HQ","text"],["sites","Sites","text"],
         ["officeDays","Office days a week — 0 for remote","num"],["officeNote","Office policy — detail","text",{wide:1}],
         ["listing","Kind","select",LISTINGS],["warmNote","Warm route — who","text"],
         ["watchWhy","Why watched / not searched","text",{wide:1}],
         ["reconcile","Needs a decision — blank clears it","area",{wide:1}]],
    more:[["health","Company health","area",{wide:1}],["culture","What it is like inside","area",{wide:1}],
          ["comp","Pay picture","area",{wide:1}],["ladder","The ladder","area",{wide:1}],
          ["ai","AI","area",{wide:1}],["green","Pluses — one per line","list",{wide:1}],
          ["red","Concerns — one per line","list",{wide:1}],
          ["questions","Ask once, covers every role — one per line","list",{wide:1}]]},
  conversation: {coll:"conversations", find:function(id){return conversations.find(function(x){return x.id===id;});},
    key:[["date","Date","date"],["kind","Kind","select",CONV_KINDS],["who","Who — name and role","text"],
         ["roleId","About a role","role"],["companyId","About a company","company"],
         ["subject","Or a person or topic","text"],["sectorId","About a sector","sector"],
         ["liked","What I liked","area",{wide:1}],["concerned","What concerned me","area",{wide:1}],
         ["nextQuestions","Questions to ask them — one short question per line","list",{wide:1}],
         ["notes","Notes — anything that is not a question","area",{wide:1}],
         ["meetingId","Meeting it belongs to","select",[["","Not a booked meeting"]]],
         ["nextStep","Next step","text"],["nextStepDate","By when","date"]],
    more:[]},
  sector: {coll:"sectors", find:function(id){return sectors.find(function(x){return x.id===id;});},
    key:[["name","Name","text"],["summary","Summary — two lines, verdict first","area",{wide:1}],["priority","Rating — Want it, Would consider, If it appears","select",PRIOPTS],
         ["scope","What this covers — and what it does not","area",{wide:1}],
         ["transition","How the sector sees my background","area",{wide:1}],
         ["job","What the job is like inside","area",{wide:1}],
         ["rules","Rules that apply — my criteria, one per line","list",{wide:1}],
         ["cvAngle","CV angle — what to lead with, one per line","list",{wide:1}],
         ["gaps","Gaps to close or answer, one per line","list",{wide:1}],
         ["questions","Ask in every interview in this sector, one per line","list",{wide:1}],
         ["help","Help on offer — who, what, and what I owe back, one per line","list",{wide:1}]],
    more:[["caveat","How much weight this deserves","area",{wide:1}]]}
};

/* About me (1 Oct). profile/me is also what the mock interviewer reads; profile/prefs is the criteria
   register the sweep and the gates read. Lists edit one item per line, parts split by " — ". */
EDIT_SPEC.profile = {coll:"profile", docId:"me", find:function(){ return PROFILE; },
  key:[["name","Name","text"],["location","Location","text"],["profession","Profession","text"],
       ["experience","Experience","text"],["lastRole","Last role","text"],["rightToWork","Right to work","text"],
       ["availability","Availability","text",{wide:1}],["status","Right now","text",{wide:1}],
       ["headline","Headline — two lines","area",{wide:1}]],
  more:[]};
var CH_STATUS=[["active","Active"],["trial","Trial"],["paused","Paused"],["dropped","Dropped"]];
EDIT_SPEC.channel = {coll:"channels", find:function(id){ return channels.find(function(x){return x.id===id;}); },
  key:[["name","Name","text"],["kind","Run by","select",[["auto","The sweep"],["manual","Me"]]],
       ["how","What it is — one line","text",{wide:1}],["cadence","How often","text"],
       ["status","Status","select",CH_STATUS],["why","Why this status — a few words","text",{wide:1}]],
  more:[]};
EDIT_SPEC.source = {coll:"sources", find:function(id){ return srcs.find(function(x){return x.id===id;}); },
  key:[["name","Name","text"],["url","Link","text"],["status","Status","select",CH_STATUS],
       ["channelId","Channel","select",[]],["note","Note — a few words","text",{wide:1}],["why","Why this status","text",{wide:1}]],
  more:[],
  dyn:function(){ return {key:EDIT_SPEC.source.key.map(function(f){
    return f[0]==="channelId"? ["channelId","Channel","select",channels.filter(function(c){return !c.derived;}).map(function(c){return [c.id,c.name];})] : f; })}; }};
var PP_HOW=[["","—"],["ex-colleague","Ex-colleague"],["friend","Friend"],["referrer","Referrer"],["hiring manager","Hiring manager"],
  ["talent acquisition","Talent acquisition"],["agency recruiter","Agency recruiter"],["peer / advisor","Peer / advisor"],["other","Other"]];
EDIT_SPEC.person = {coll:"people", find:function(id){ return people.find(function(x){return x.id===id;}); },
  key:[["name","Name","text"],["how","How you know them","select",PP_HOW],["role","Their role","text"],
       ["companyId","Company card","company"],["company","Company name, if no card","text"],
       ["linkedin","LinkedIn","text",{wide:1}],["note","Note","area",{wide:1}]], more:[]};
EDIT_SPEC.offer = {coll:"roles", find:function(id){ return rawRoles.find(function(x){return x.id===id;}); },
  key:[["offer.base","Base salary","text"],["offer.bonus","Bonus and equity","text"],["offer.total","Total package","text"],
       ["offer.pension","Pension","text"],["offer.holiday","Holiday","text"],["offer.office","Office days","text"],
       ["offer.start","Start date","text"],["offer.deadline","Decision deadline","date"],["offer.note","Note","area",{wide:1}]], more:[]};
EDIT_SPEC.prefs = {coll:"profile", docId:"prefs", find:function(){ return PREFS; }, key:[], more:[],
  dyn:function(id){ return {key:(PREF_SECS.filter(function(x){return x.k===id;})[0]||{}).spec||[]}; }};
var PREF_SECS = [
  {k:"targets", title:"My targets — what a healthy search looks like for you", spec:[]},
  {k:"shape", title:"Role shape", spec:[["roleShape","One per line","list"]]},
  {k:"search", title:"Search terms — each runs as its own search", spec:[["searchTerms","One group per line: group — terms, comma separated","pairs",{keys:["group","terms"]}]]},
  {k:"hard", title:"Deal-breakers — fail one and it's a no", spec:[["hardRules","One per line: id — name — when it fires — rule","pairs",{keys:["id","name","fires","rule"]}]]},
  {k:"scored", title:"Preferences — rated Strong, Middle or Weak, never added up", spec:[["scored","One per line: id — name — bands","pairs",{keys:["id","name","bands"]}]]},
  {k:"upside", title:"Pluses — bonus points, never a no", spec:[["upside","One per line: flag — note","pairs",{keys:["name","note"]}]]},
  {k:"red", title:"Concerns — worth knowing, not a no", spec:[["red","One per line: flag — judged on","pairs",{keys:["name","note"]}]]},
];
function getPath(o,p){ return p.split(".").reduce(function(a,k){ return a==null? undefined : a[k]; }, o); }
function fieldVal(doc,f){
  var v=getPath(doc,f[0]);
  if(f[2]==="list") return (Array.isArray(v)? v : []).join("\n");
  if(f[2]==="sectors") return (Array.isArray(v)? v : []).join(",");
  if(f[2]==="pairs") return (Array.isArray(v)? v : []).map(function(o){
    return f[3].keys.map(function(k){return (o&&o[k])||"";}).join(PAIR_SEP).replace(/( \u2014 )+$/,"");
  }).join("\n");
  return v==null? "" : String(v);
}
function editKey(kind,id){ return kind+":"+id; }
document.addEventListener("change",function(ev){
  var cb=ev.target.closest && ev.target.closest("[data-secpick]"); if(!cb) return;
  var lab=cb.closest(".fld"), h=lab && lab.querySelector("input[type=hidden][data-ef]"); if(!h) return;
  h.value=Array.prototype.map.call(lab.querySelectorAll("[data-secpick]:checked"),function(x){return x.dataset.secpick;}).join(",");
  h.dispatchEvent(new Event("input",{bubbles:true}));
});
function editBtn(kind,id,label){
  return '<button type="button" class="btn ghost edbtn" data-act="ed_open" data-k="'+kind+'" data-id="'+esc(id)+'">'+
    esc(label||"Edit")+'</button>';
}
function edOptions(f,cur){
  var opts;
  if(f[2]==="role"){
    opts=[["","Not attached to a role"]].concat(rawRoles.filter(function(r){
        return r.id===cur || (r.stage!=="g1_rejected" && r.stage!=="g2_rejected");
      }).map(function(r){ return [r.id, (r.company||"")+" — "+(r.title||"")+(r.stage==="closed"?" (closed)":"")]; }));
  } else if(f[2]==="company"){
    opts=[["","None — match on the name"]].concat(companies.slice()
      .sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));})
      .map(function(c){ return [c.id, c.name||c.id]; }));
  } else if(f[2]==="srcpick"){
    return srcOptions(cur);
  } else if(f[2]==="sector"){
    opts=[["","No sector"]].concat(sectors.slice()
      .sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));})
      .map(function(x){ return [x.id, x.name||x.id]; }));
  } else {
    opts=(f[3]||[]).map(function(o){ return Array.isArray(o)? o : [o, o||"—"]; });
  }
  /* A stored value the list does not know is kept, not silently swapped for the first option. */
  if(cur && !opts.some(function(o){return o[0]===cur;})) opts.push([cur, cur+" (current)"]);
  return opts.map(function(o){
    return '<option value="'+esc(o[0])+'"'+(o[0]===cur?" selected":"")+'>'+esc(o[1])+'</option>';
  }).join("");
}
function edField(key,doc,f){
  var d=DRAFTS[key]||{}, v = (f[0] in d)? d[f[0]] : fieldVal(doc,f);
  var wide = (f[3] && f[3].wide) || f[2]==="area" || f[2]==="list" || f[2]==="pairs";
  var attrs=' data-ef="'+esc(f[0])+'"';
  var ctl;
  if(f[2]==="area"||f[2]==="list"||f[2]==="pairs"){
    var rows=Math.min(8, Math.max(2, Math.ceil(v.length/110) + (v.match(/\n/g)||[]).length + 1));
    ctl='<textarea'+attrs+' rows="'+rows+'">'+esc(v)+'</textarea>';
  } else if(f[2]==="sectors"){
    var on=String(v||"").split(",").filter(Boolean);
    ctl='<input type="hidden"'+attrs+' value="'+esc(on.join(","))+'"><span class="secpick">'+sectors.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));}).map(function(x){
      return '<label><input type="checkbox" data-secpick="'+esc(x.id)+'"'+(on.indexOf(x.id)>=0?" checked":"")+'> '+esc(x.name||x.id)+'</label>'; }).join("")+'</span>';
  } else if(f[2]==="select"||f[2]==="role"||f[2]==="company"||f[2]==="sector"||f[2]==="srcpick"){
    ctl='<select'+attrs+'>'+edOptions(f,v)+'</select>';
  } else {
    ctl='<input'+attrs+(f[2]==="date"?' type="date"' : f[2]==="num"? ' type="number" min="0" max="7" step="0.5" inputmode="decimal"' : "")+' value="'+esc(v)+'">';
  }
  return '<label class="fld'+(wide?" wide":"")+'">'+esc(f[1])+ctl+'</label>';
}
var ED_DLG=null;
var ED_TITLES={commitment:"Edit meeting", role:"Edit role", company:"Edit company", sector:"Edit sector", conversation:"Edit meeting notes",
  profile:"Edit your details", channel:"Edit channel", source:"Edit source", person:"Edit person", offer:"Offer details",
  prep:"Edit stage", research:"Edit research", facts:"Edit role facts", pack:"Edit CV and cover letter", packcv:"Edit CV", packlet:"Edit cover letter", packgaps:"Edit gaps to check", intel:"Edit interview process",
  general:"Edit prep", oq:"Edit open questions", coq:"Edit company questions", secq:"Edit sector questions"};
function editBox(kind,id,inDialog){
  var key=editKey(kind,id); if(!EDITING[key]) return "";
  if(ED_DLG && ED_DLG.key===key && !inDialog) return "";
  var sp=specOf(kind,id), doc=sp && sp.find(id);
  if(!doc) return "";
  var moreOpen = DRAFTS[key] && sp.more.some(function(f){ return f[0] in DRAFTS[key]; });
  return '<div class="editbox" data-edkey="'+esc(key)+'" data-k="'+kind+'" data-id="'+esc(id)+'">'+
    '<div class="edgrid">'+sp.key.map(function(f){return edField(key,doc,f);}).join("")+'</div>'+
    (sp.more.length? '<details class="enrich"'+(moreOpen?" open":"")+'><summary>More fields</summary>'+
      '<div class="edgrid" style="margin-top:10px">'+sp.more.map(function(f){return edField(key,doc,f);}).join("")+'</div></details>' : "")+
    '<div class="statusacts">'+
      '<button type="button" class="btn primary" data-act="ed_save">Save changes</button>'+
      '<button type="button" class="btn ghost" data-act="ed_cancel">Cancel</button>'+
      '<span class="statushint" data-edhint></span>'+
      (kind==="company"? '<button type="button" class="btn danger" data-act="co_rmfromedit" data-id="'+esc(id)+'" style="margin-left:auto">Remove company</button>' : "")+
      (kind==="channel"? '<button type="button" class="btn danger" data-act="ch_rm" data-id="'+esc(id)+'" style="margin-left:auto">Remove channel</button>' : "")+
      (kind==="sector"? '<button type="button" class="btn danger" data-act="sec_rm" data-id="'+esc(id)+'" style="margin-left:auto">Remove sector</button>' : "")+
      (kind==="person"? '<button type="button" class="btn danger" data-act="pp_rm" data-id="'+esc(id)+'" style="margin-left:auto">Remove person</button>' : "")+
    '</div>'+
  '</div>';
}
function readEditor(box){
  var kind=box.dataset.k, id=box.dataset.id, sp=specOf(kind,id), doc=sp && sp.find(id);
  if(!doc) return null;
  var all=sp.key.concat(sp.more), patch={}, changed=[];
  function lines(raw){ return raw.split("\n").map(function(x){return x.trim();}).filter(Boolean); }
  all.forEach(function(f){
    var inp=box.querySelector('[data-ef="'+f[0]+'"]'); if(!inp) return;
    var raw=inp.value;
    var norm = (f[2]==="list"||f[2]==="pairs")? lines(raw).join("\n") : raw.trim();
    if(fieldVal(doc,f)===norm) return;
    var nv = f[2]==="sectors" ? raw.split(",").map(function(x){return x.trim();}).filter(Boolean)
           : f[2]==="list" ? lines(raw)
           : f[2]==="pairs" ? lines(raw).map(function(l){
               var bits=l.split(/\s+[\u2014|]\s+|\s+-\s+/), o={};
               f[3].keys.forEach(function(k,i){
                 o[k]= i===f[3].keys.length-1 ? bits.slice(i).join(PAIR_SEP).trim() : (bits[i]||"").trim();
               });
               return o;
             })
           : f[2]==="num" ? (raw.trim()===""? null : +raw)
           : raw.trim();
    changed.push(f[0]);
    var parts=f[0].split(".");
    if(parts.length===1){ patch[f[0]]=nv; return; }
    /* A nested object is written whole from a copy, at any depth — the rule and score buttons
       already do the same with enrich. */
    var top=parts[0];
    if(!patch[top]) patch[top]=JSON.parse(JSON.stringify(doc[top]||{}));
    var o=patch[top];
    for(var i=1;i<parts.length-1;i++){ if(o[parts[i]]==null || typeof o[parts[i]]!=="object") o[parts[i]]={}; o=o[parts[i]]; }
    o[parts[parts.length-1]]=nv;
  });
  return {kind:kind, id:id, doc:doc, sp:sp, patch:patch, changed:changed};
}
function closeEditor(key){ delete EDITING[key]; delete DRAFTS[key]; }

document.addEventListener("input",function(ev){
  var ag=ev.target.classList && ev.target.classList.contains("autogrow")? ev.target : null;
  if(ag && !CSS.supports("field-sizing","content")){ ag.style.height="auto"; ag.style.height=ag.scrollHeight+"px"; }
});
document.addEventListener("input",function(ev){
  var f=ev.target.closest && ev.target.closest("[data-ef]"); if(!f) return;
  var box=f.closest(".editbox"); if(!box) return;
  var key=box.dataset.edkey; DRAFTS[key]=DRAFTS[key]||{};
  DRAFTS[key][f.dataset.ef]=f.value;
});
document.addEventListener("change",function(ev){
  var f=ev.target.closest && ev.target.closest("select[data-ef]"); if(!f) return;
  var box=f.closest(".editbox"); if(!box) return;
  var key=box.dataset.edkey; DRAFTS[key]=DRAFTS[key]||{};
  DRAFTS[key][f.dataset.ef]=f.value;
});

/* A re-render replaces the field you are typing in. Put the cursor back in its replacement, but
   only when the old field was removed from the page — a real click elsewhere is left alone. */
var edFocus=null;
document.addEventListener("focusin",function(ev){
  var f=ev.target.closest && ev.target.closest(".editbox [data-ef]");
  edFocus = f? {node:f, key:f.closest(".editbox").dataset.edkey, ef:f.dataset.ef} : null;
});
document.addEventListener("focusout",function(){
  var was=edFocus;
  setTimeout(function(){ if(was && edFocus===was && was.node.isConnected && document.activeElement!==was.node) edFocus=null; },0);
});
if(typeof MutationObserver!=="undefined"){
  new MutationObserver(function(){
    if(!edFocus || edFocus.node.isConnected) return;
    var box=document.querySelector('.editbox[data-edkey="'+edFocus.key.replace(/"/g,'\\"')+'"]');
    var n=box && box.querySelector('[data-ef="'+edFocus.ef+'"]');
    if(n){ edFocus.node=n; n.focus(); if(n.setSelectionRange && n.type!=="date"){ var L=n.value.length; try{n.setSelectionRange(L,L);}catch(e){} } }
  }).observe(document.body,{childList:true,subtree:true});
}

function edClick(t){
  var a=t.dataset.act;
  if(a==="ed_open"){
    /* Every edit opens in a pop-up (1 Oct). */
    var k0=t.dataset.k, sh=t.closest(".sechead"), eb=sh && sh.querySelector(".eyebrow"), lab=eb? eb.textContent.trim() : "";
    var ttl = k0==="prefs"? (lab||"Edit preferences") : (ED_TITLES[k0]||"Edit")+(lab && k0!=="profile"? " — "+lab : "");
    openEdDialog(k0, t.dataset.id, ttl);
    setTimeout(function(){ var f=document.querySelector("#ed-body [data-ef]"); if(f) f.focus(); },60);
    return true;
  }
  var box2=t.closest(".editbox"); if(!box2) return false;
  var k2=box2.dataset.edkey, hint=box2.querySelector("[data-edhint]");
  function say(m){ if(hint) hint.textContent=m; }
  if(a==="ed_cancel"){ closeEditor(k2); render(); return true; }
  if(a==="ed_save"){
    var r=readEditor(box2);
    if(!r){ say("That item no longer exists."); return true; }
    if(!r.changed.length){ closeEditor(k2); render(); return true; }
    var p=r.patch, after=Object.assign({},r.doc,p);
    /* The same refusals the add forms make — a row that saves and then renders nowhere is worse
       than a save that says why it will not. */
    if(r.kind==="commitment"){
      if(!String(after.title||"").trim()){ say("It needs a title."); return true; }
      if(after.state==="booked" && !after.date){ say("Booked needs a date — or set it to Offered or Conditional."); return true; }
      if("state" in p && p.state==="done" && !r.doc.doneAt) p.doneAt=today();
    }
    /* Every editor that writes a role gets the same checks, not just the full role editor (QA 15 Oct: the
       role facts editor saved a blank title and a link without https). */
    if(r.kind==="role" || (r.sp && r.sp.coll==="roles" && ("title" in p || "url" in p))){
      if((r.kind==="role" || "title" in p) && !String(after.title||"").trim()){ say("It needs a title."); return true; }
      if("url" in p && p.url && !/^https?:\/\//i.test(p.url)) p.url="https://"+p.url;
      if("url" in p){ p.linkChecked=""; p.linkMethod=""; }   /* a new link has not been checked (2 Oct) */
    }
    if(r.kind==="company" && !String(after.name||"").trim()){ say("It needs a name."); return true; }
    if((r.kind==="channel"||r.kind==="source"||r.kind==="person") && !String(after.name||"").trim()){ say("It needs a name."); return true; }
    if(r.kind==="person" && "linkedin" in p && p.linkedin && !/^https?:\/\//i.test(p.linkedin)) p.linkedin="https://"+p.linkedin;
    if(r.kind==="role" && "sourceId" in p) p.channelId = chOfSrc(p.sourceId);
    if(r.kind==="sector" && !String(after.name||"").trim()){ say("It needs a name."); return true; }
    /* A conversation moved onto a role belongs to that role's company as well. */
    if(r.kind==="conversation" && "roleId" in p && p.roleId && !("companyId" in p)){
      p.companyId = coIdOfRole(rawRoles.find(function(x){return x.id===p.roleId;}));
    }
    if(!DB){ say("Stored data isn't available in this view, so nothing can be saved."); return true; }
    say("Saving…");
    DB.doc(r.sp.coll+"/"+(r.sp.docId||r.id)).update(p).then(function(){
      closeEditor(k2); render();
    }).catch(function(e){
      console.warn("edit save",e&&e.code);
      say("Not saved — "+((e&&e.code)||"the write failed")+". Your changes are still in the form.");
      if(e&&(e.code==="invalid_argument"||e.code==="not_granted")) el("offline").hidden=false;
    });
    return true;
  }
  return false;
}

/* ---------- render helpers ---------- */
/* Office days (company): officeDays is a number a week, officeNote the detail (written by the sweep and shortlist research). */
function coOfficeTxt(c){
  if(!c) return "";
  var n=c.officeDays, note=String(c.officeNote||"").trim(), t="";
  if(n!=null && n!=="") t= (+n===0? "Remote" : n+(+n===1? " day" : " days")+" a week");
  return note? (t? t+" — "+note : note) : t;
}
function fact(k,v){
  return '<div class="fact"><div class="k">'+esc(k)+'</div><div class="v'+(v?"":" na")+'">'+esc(v||"not stated")+'</div></div>';
}
/* Closing soon (4 Oct): a role not yet applied for whose stated closing date is 3 days away or less
   (or passed) gets a red ! on its row and goes to the top of its list. No words on the row. */
var CLOSE_ST={proposed:1, consideration:1, parked:1, prep:1};
function closeSoon(r){ if(!r||!CLOSE_ST[r.stage]) return null; var d=days(r.closing); return (d!=null && d<=3)? d : null; }
function closeBang(r){
  var d=closeSoon(r); if(d==null) return "";
  var when=niceShort(r.closing), t= d<0? "Closing date passed ("+when+") \u2014 check it\u2019s still open" : d===0? "Closes today ("+when+")" : "Closes in "+d+" day"+(d===1?"":"s")+" ("+when+")";
  return '<span class="closebang" title="'+esc(t)+'" aria-label="'+esc(t)+'">!</span>';
}
function closeFirst(a,b){ var x=closeSoon(a), y=closeSoon(b); if((x==null)!==(y==null)) return x==null? 1 : -1; return (x!=null)? x-y : 0; }
function closingLabel(r){
  var d=days(r.closing);
  if(d==null) return r.postingAge?("posted "+r.postingAge):"";
  if(d<0) return "closed";
  return d+(d===1?" day left":" days left");
}
var BANDWORD={strong:"a strong band",mid:"a middle band",weak:"a weak band"};
function highlightRow(r){
  var out=[];
  /* The sweep couldn't reach the employer's board to confirm the role is live (1 Oct) — you check. */
  if(r.liveCheck==="you") out.push(chip("mid","\u26a0 Check it's live","The sweep found this on an aggregator and couldn't reach the employer's job board. Open the link and confirm it's still open."));
  if(r.warm) out.push(chip("warm","Referred",(r.warmNote? r.warmNote+" \u2014 " : "")+WHY.warm));
  (r.highlights||[]).forEach(function(h){
    out.push('<span class="chip '+(h.band||"")+'" title="'+
      esc(h.code+" \u2014 "+(BANDWORD[h.band]||"scored")+". "+WHY.band)+'">'+
      '<span class="mono" style="opacity:.7">'+esc(h.code)+'</span> '+esc(h.label)+'</span>');
  });
  /* Flags are written "Title — detail" (2 Oct): the chip shows the title, the hover the whole thing. */
  function ft(f){ var i=String(f).indexOf(" \u2014 "); return i>0? String(f).slice(0,i) : String(f); }
  (r.red||[]).forEach(function(f){ out.push(chip("weak","\u2691 "+esc(ft(f)),f+". "+WHY.red)); });
  (r.green||[]).forEach(function(f){ out.push(chip("strong",esc(ft(f)),f+". "+WHY.green)); });
  return out.join(" ");
}
function hostOf(u){
  try{ var h=new URL(u).hostname.replace(/^www\./,""); return h; }catch(e){ return u.slice(0,44); }
}
function quadrant(f,s){
  if(f==null||s==null) return "";
  var hf=f>=4, hs=s>=4;
  if(hf&&hs) return "apply, priority";
  if(hf&&!hs) return "stretch bet — the quadrant that gets under-applied to";
  if(!hf&&hs) return "safe fallback";
  return "do not apply";
}
var ANCHORS={
  fun:["1 — sounds dull","5 — a job I want to do"],
  shot:["1 — a long shot","5 — I'd probably get it"]
};
function pips(id,field,val){
  var base = field.replace(/2$/,"");
  var a = ANCHORS[base]||["1","5"];
  var h='<div class="pips">';
  for(var i=1;i<=5;i++){
    var t = i===1? a[0] : (i===5? a[1] : base+" "+i);
    h+='<button type="button" data-act="score" data-id="'+id+'" data-f="'+field+'" data-v="'+i+
       '" aria-pressed="'+(val===i)+'" title="'+esc(t)+'" aria-label="'+esc(base+" "+i+" — "+t)+'">'+i+'</button>';
  }
  return h+'</div>';
}

/* The "why stop?" box only shows once you choose to stop searching the company (5 Oct): it was being mistaken for
   the role's note. 29's reject-box restore calls costopSync after setting the choice back. */
function costopSync(sel){ if(!sel) return; var b=document.getElementById("costop-"+sel.dataset.id); if(b) b.hidden= sel.value!=="stop"; }
document.addEventListener("change",function(ev){ var t=ev.target; if(t && t.matches && t.matches('select[data-act="co_after"]')){ costopSync(t); if(t.value==="stop"){ var b=document.getElementById("costop-"+t.dataset.id); if(b) b.focus(); } } });
