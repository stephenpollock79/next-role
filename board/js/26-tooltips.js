"use strict";
/* Quick tooltips (3 Oct). The browser's own `title` tooltip waits about a second and can't be sped up,
   so on a mouse-driven screen the board shows its own after TT_DELAY ms, with the same text. While hovered the
   element's `title` moves to `data-tt` so the native one doesn't also appear; it is put back on leave, so
   nothing else that reads `title` sees a change. Touch screens keep the default behaviour. */
var TT_DELAY=250, TT={el:null, box:null, timer:0};
function ttBox(){
  if(TT.box) return TT.box;
  var b=document.createElement("div"); b.className="qtip"; b.setAttribute("role","tooltip"); b.hidden=true;
  document.body.appendChild(b); TT.box=b; return b;
}
function ttHide(){
  clearTimeout(TT.timer); TT.timer=0;
  if(TT.el && TT.el.hasAttribute("data-tt")){ TT.el.setAttribute("title", TT.el.getAttribute("data-tt")); TT.el.removeAttribute("data-tt"); }
  TT.el=null; if(TT.box) TT.box.hidden=true;
}
function ttShow(){
  var t=TT.el; if(!t || !t.isConnected) return ttHide();
  var txt=t.getAttribute("data-tt"); if(!txt) return;
  var b=ttBox(); b.textContent=txt; b.hidden=false;
  var r=t.getBoundingClientRect(), bw=b.offsetWidth, bh=b.offsetHeight, vw=document.documentElement.clientWidth, gap=8;
  var x=Math.min(Math.max(8, r.left+r.width/2-bw/2), vw-bw-8);
  var y=r.bottom+gap; if(y+bh>window.innerHeight-8) y=Math.max(8, r.top-bh-gap);
  b.style.left=Math.round(x)+"px"; b.style.top=Math.round(y)+"px";
}
if(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches){
  document.addEventListener("mouseover",function(ev){
    var t=ev.target.closest && ev.target.closest("[title],[data-tt]");
    if(t===TT.el) return;
    ttHide();
    if(!t || t instanceof SVGElement) return;
    var txt=t.getAttribute("title"); if(!txt || !txt.trim()) return;
    t.setAttribute("data-tt", txt); t.removeAttribute("title");
    TT.el=t; TT.timer=setTimeout(ttShow, TT_DELAY);
  },true);
  document.addEventListener("mouseout",function(ev){
    if(!TT.el) return; var to=ev.relatedTarget;
    if(to && TT.el.contains(to)) return;
    ttHide();
  },true);
  ["mousedown","keydown","wheel"].forEach(function(n){ document.addEventListener(n, ttHide, {capture:true, passive:true}); });
  window.addEventListener("scroll", ttHide, {capture:true, passive:true});
  window.addEventListener("blur", ttHide);
}
