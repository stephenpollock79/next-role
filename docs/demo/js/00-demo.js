"use strict";
/* ===== Next Role demo: the only demo-only file =====
   Loaded first, and only by the demo page (tools/build-demo.sh puts it there). It turns the board into a public
   demo that needs no Claude account:
   - a frozen date: "today" is always FIXTURE today; the time of day runs from page load;
   - a data store in this browser: the board's db calls are answered from demo-fixture.json, copied into
     localStorage on first visit; every change stays in this browser and Reset puts the fixture back;
   - no Claude: every other capability (sample, assets, downloads) is unavailable, so the board shows its own
     "not available" states, and Copy for Claude explains what it would do on a real board;
   - a small banner saying all this, with Reset.
   Nothing here is sent anywhere. Never load this file on a real board. */
(function(){
  var KEY="nextrole-demo", DAY="2026-11-03", VERSION=1;

  /* ---------- frozen date ---------- */
  var RealDate=Date, start=RealDate.now(), real=new RealDate();
  var p=DAY.split("-"), target=new RealDate(+p[0], +p[1]-1, +p[2], real.getHours(), real.getMinutes(), real.getSeconds()).getTime();
  var OFF=target-start;
  function FakeDate(){
    if(!(this instanceof FakeDate)) return new RealDate(RealDate.now()+OFF).toString();
    var a=arguments; if(!a.length) return new RealDate(RealDate.now()+OFF);
    return new (Function.prototype.bind.apply(RealDate,[null].concat([].slice.call(a))))();
  }
  FakeDate.prototype=RealDate.prototype;
  FakeDate.now=function(){ return RealDate.now()+OFF; };
  FakeDate.parse=RealDate.parse; FakeDate.UTC=RealDate.UTC;
  try{ window.Date=FakeDate; }catch(e){}

  /* ---------- the data store ---------- */
  var store=null, ready=null, subsC={}, subsD={}, saveT=null;
  function clone(x){ return x==null? x : JSON.parse(JSON.stringify(x)); }
  function load(){
    try{ var s=JSON.parse(localStorage.getItem(KEY)||"null"); if(s && s.version===VERSION && s.data) return Promise.resolve(s.data); }catch(e){}
    return fetch("demo-fixture.json",{cache:"no-store"}).then(function(r){ return r.json(); }).then(function(f){ delete f.__meta; return f; });
  }
  function save(){ clearTimeout(saveT); saveT=setTimeout(function(){ try{ localStorage.setItem(KEY, JSON.stringify({version:VERSION, data:store})); }catch(e){} },300); }
  function split(path){ var a=path.split("/"); return [a.slice(0,a.length-1).join("/"), a[a.length-1]]; }
  function cSnap(c){ var o=store[c]||{}, ids=Object.keys(o).sort();
    return {docs:ids.map(function(id){ return {id:id, exists:true, data:function(){ return clone(o[id]); }}; }), size:ids.length, empty:!ids.length}; }
  function dSnap(path){ var s=split(path), o=(store[s[0]]||{})[s[1]]; return {id:s[1], exists:o!==undefined, data:function(){ return clone(o); }}; }
  function notify(c,id){ save(); setTimeout(function(){
    (subsC[c]||[]).forEach(function(cb){ try{ cb(cSnap(c)); }catch(e){ console.error(e); } });
    (subsD[c+"/"+id]||[]).forEach(function(cb){ try{ cb(dSnap(c+"/"+id)); }catch(e){ console.error(e); } }); },0); }
  function delKeys(o){ Object.keys(o).forEach(function(k){ var v=o[k]; if(v && typeof v==="object" && !Array.isArray(v)){ if(v.__delete__===true) delete o[k]; else delKeys(v); } }); return o; }
  function merge(a,b){ Object.keys(b).forEach(function(k){ var v=b[k]; if(v && typeof v==="object" && v.__delete__===true){ delete a[k]; return; } a[k]=clone(v); }); return a; }
  function off(list,cb){ return function(){ var i=list.indexOf(cb); if(i>=0) list.splice(i,1); }; }
  var db={
    collection:function(c){ return {
      onSnapshot:function(cb){ var l=(subsC[c]=subsC[c]||[]); l.push(cb); setTimeout(function(){ cb(cSnap(c)); },0); return off(l,cb); },
      get:function(){ return Promise.resolve(cSnap(c)); } }; },
    doc:function(path){ var s=split(path), c=s[0], id=s[1]; return {
      onSnapshot:function(cb){ var l=(subsD[path]=subsD[path]||[]); l.push(cb); setTimeout(function(){ cb(dSnap(path)); },0); return off(l,cb); },
      get:function(){ return Promise.resolve(dSnap(path)); },
      set:function(d){ store[c]=store[c]||{}; store[c][id]=delKeys(clone(d)); notify(c,id); return Promise.resolve(); },
      update:function(d){ store[c]=store[c]||{}; if(!store[c][id]) return Promise.reject({code:"not_found", message:"No such document"}); merge(store[c][id],d); notify(c,id); return Promise.resolve(); },
      delete:function(){ if(store[c]) delete store[c][id]; notify(c,id); return Promise.resolve(); } }; }
  };
  ready=load().then(function(d){ store=d; return db; }, function(e){ console.warn("demo data",e); store={}; return db; });
  var api={use:function(n){ return n==="db"? ready : Promise.resolve(null); }};
  try{ Object.defineProperty(window,"claude",{value:api, configurable:true, writable:true}); }catch(e){ try{ window.claude=api; }catch(e2){} }

  /* ---------- banner, Reset, and Copy for Claude ---------- */
  function reset(){ try{ localStorage.removeItem(KEY); }catch(e){} location.reload(); }
  window.addEventListener("load",function(){
    var nice=new RealDate(+p[0], +p[1]-1, +p[2]).toLocaleDateString("en-GB",{weekday:"short", day:"numeric", month:"short", year:"numeric"});
    var b=document.createElement("div"); b.id="demo-banner";
    b.setAttribute("style","position:fixed;left:16px;bottom:16px;z-index:9999;max-width:360px;background:#1f2a2e;color:#fff;border-radius:10px;padding:10px 14px;font:13px/1.45 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)");
    b.innerHTML='<b>Next Role demo</b> · made-up data for a made-up designer. The date is fixed to '+nice+'. Your changes stay in this browser only. '+
      '<button type="button" id="demo-reset" style="margin-left:6px;background:#fff;color:#1f2a2e;border:0;border-radius:6px;padding:3px 9px;font:inherit;cursor:pointer">Reset</button> '+
      '<button type="button" id="demo-hide" style="background:transparent;color:#cfe3e0;border:0;font:inherit;cursor:pointer;text-decoration:underline">Hide</button>';
    document.body.appendChild(b);
    b.querySelector("#demo-reset").onclick=reset; b.querySelector("#demo-hide").onclick=function(){ b.remove(); };
    /* Copy for Claude has no Claude to hand to here. */
    window.fxClip=function(txt,ok){ try{ toast("On your own board this copies a request for Claude to do the work. The demo has no Claude connected."); }catch(e){} };
  });
})();
