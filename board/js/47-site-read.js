"use strict";
/* ===== Job sites we can't read yet =====
   Some careers sites (Oracle, Workday, SuccessFactors, iCIMS, SmartRecruiters) build the ad in the browser, so the
   morning run's plain fetch gets an empty page. The skills read those ads from the site's own feed, using a pattern
   per site kept in `refs/ats-endpoints`. A role on a site with no pattern yet is written `readState: "needs"`,
   `readReason: "nofeed"`, `readHost: <the link's host>`. This file lists those roles in Data health as their own
   check (Copy for Claude, fix kind `site-pattern`): next-role-fix works out the site's pattern once, then sets the
   roles back to waiting so the next morning run reads them. They leave "Postings the morning run couldn't read",
   which stays for login walls, gone pages and the like. The role card's read box says the same in plain words. */

var SR_TITLE="Job sites we can't read yet";
READWHY.nofeed="Site not readable yet";

function srSystem(host){
  var h=String(host||"").toLowerCase();
  if(/oraclecloud\.com$/.test(h)) return "Oracle";
  if(/myworkdayjobs\.com$|workday\.com$/.test(h)) return "Workday";
  if(/successfactors\.|sapsf\./.test(h)) return "SuccessFactors";
  if(/icims\.com$/.test(h)) return "iCIMS";
  if(/smartrecruiters\.com$/.test(h)) return "SmartRecruiters";
  return h || "Unknown site";
}
function srHostOf(r){
  if(r.readHost) return String(r.readHost);
  try{ return new URL(r.url).host; }catch(e){ return ""; }
}
function srNoFeed(r){ return r && r.readState==="needs" && r.readReason==="nofeed"; }

HY_PLAIN[SR_TITLE]=[SR_TITLE,"These ads load with JavaScript, so the morning run can't read them yet. Claude works out how to read each site once; after that every role on it reads by itself.","copy"];
FX_KIND[SR_TITLE]="site-pattern";

hygiene=(function(orig){ return function(){
  var out=orig();
  var pc=out.find(function(x){ return x.title==="Postings the morning run couldn't read"; });
  if(pc) pc.items=pc.items.filter(function(it){ return !srNoFeed(hyRole(it.id)); });
  var rs=roles.filter(function(r){ return (GATES[r.stage]||r.stage==="prep") && srNoFeed(r); })
    .sort(function(a,b){ var x=srHostOf(a), y=srHostOf(b); return x<y? -1 : x>y? 1 : 0; });
  out.push({sec:"Links", title:SR_TITLE, why:"", sev:"fix",
    items:rs.map(function(r){ var h=srHostOf(r);
      return {k:"role", id:r.id, label:(r.ref? "#"+r.ref+" " : "")+(r.title||"Untitled")+" · "+(r.company||""),
        note:srSystem(h)+" site", srHost:h, srUrl:r.url||""}; })});
  return out;
}; })(hygiene);

/* The copied request carries each role's site and link, so next-role-fix can open one. */
fxItemLine=(function(orig){ return function(it){
  var line=orig(it);
  if(it && it.srHost) line+=" · site "+it.srHost+(it.srUrl? " · "+String(it.srUrl) : "");
  return line;
}; })(fxItemLine);

/* The role card: say what's happening, point to Data health, keep Paste as the way round it. */
readBox=(function(orig){ return function(r){
  if(!srNoFeed(r)) return orig(r);
  var sys=srSystem(srHostOf(r));
  return '<div class="readbox needs"><span class="eyebrow" style="color:var(--warn)">Ad not read yet · '+esc(sys)+' site</span>'+
    '<span style="font-size:13px">This site loads its ads with JavaScript, so the morning run couldn\'t read it. Claude needs to work out how to read this site once: copy the request from Data health. Until then Role Fit stays rough. Or paste the ad\'s text to research from that.</span>'+
    '<div class="statusacts"><a href="#" class="btn primary" data-gotab="health">Go to Data health</a>'+
    '<button class="btn ghost" data-act="rd_open" data-id="'+esc(r.id)+'">Paste the ad text</button></div></div>';
}; })(readBox);

try{ renderHygiene(); }catch(e){}
