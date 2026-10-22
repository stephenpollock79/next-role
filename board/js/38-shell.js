"use strict";
/* ===== Shell polish (6 Oct) =====
   The sidebar and top bar read as one dark frame around the page: a hairline across the sidebar at the top bar's
   height (--top-h, measured here) and a rounded inner corner where they meet (both CSS, end of shell.css).
   Desktop only (≥1100px). A status block and a faint sidebar logo were tried the same day and removed. */
function shTopH(){
  var h=document.querySelector("header.top"); if(!h) return;
  document.documentElement.style.setProperty("--top-h", h.offsetHeight+"px");
}
window.addEventListener("resize",shTopH);
try{ if(window.ResizeObserver){ var shH=document.querySelector("header.top"); if(shH) new ResizeObserver(shTopH).observe(shH); } }catch(e){}
shTopH();
