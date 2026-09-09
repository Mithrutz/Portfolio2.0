/* Portfolio Manager — Global Configuration & State
 * Defines ALL global variables needed by every other script.
 * Must be the FIRST script loaded.
 */

/* ── State ── */
var ST={cursuri:{EUR:1,USD:1.16,RON:5.23},pozitii:[],next_id:1,tranzactii:[],snapshots:[]};
var _collapsed={};  // tracks which categories are collapsed in sidebar
var editId=null, curTab="alloc";
var CATS=["ETFs","Stocks","Bonds","Cash","Crypto"];
var PAL={
  "ETFs":    {main:"#f59e0b",sh:["#b45309","#d97706","#f59e0b","#fbbf24","#fde68a"]},
  "Stocks":    {main:"#14d9c4",sh:["#0f766e","#0d9488","#14b8a6","#2dd4bf","#5eead4","#99f6e4"]},
  "Bonds":{main:"#a78bfa",sh:["#6d28d9","#8b5cf6","#a78bfa","#c4b5fd"]},
  "Cash":       {main:"#64748b",sh:["#1e293b","#334155","#475569","#64748b"]},
  "Crypto":     {main:"#f97316",sh:["#7c2d12","#c2410c","#ea580c","#f97316","#fb923c"]}
};
function toE(v,m){return v/(ST.cursuri[m]||1)}
function pVal(p){return toE(p.cantitate*p.pret,p.moneda)}
function fe(n){return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n)+" €"}

async function init(){
  var r=await fetch("/api/data"); ST=await r.json();
  if(!ST.tranzactii) ST.tranzactii=[];
  if(!ST.snapshots)  ST.snapshots=[];
  document.getElementById("r-usd").value=ST.cursuri.USD;
  document.getElementById("r-ron").value=ST.cursuri.RON;
  renderSB(); genChart();
}

/* ── React shorthand & component constants ── */
var h=React.createElement;
var CATS_R=["ETFs","Stocks","Bonds","Cash","Crypto"];
var REG_COL={"World":"#38bdf8","Romania":"#fb923c"};
var PAL_R={
  "ETFs":    {main:"#f59e0b",sh:["#b45309","#d97706","#f59e0b","#fbbf24","#fde68a"]},
  "Stocks":    {main:"#14d9c4",sh:["#0f766e","#0d9488","#14b8a6","#2dd4bf","#5eead4","#99f6e4"]},
  "Bonds":{main:"#a78bfa",sh:["#6d28d9","#8b5cf6","#a78bfa","#c4b5fd"]},
  "Cash":       {main:"#64748b",sh:["#1e293b","#334155","#475569","#64748b"]},
  "Crypto":     {main:"#f97316",sh:["#7c2d12","#c2410c","#ea580c","#f97316","#fb923c"]}
};
function toEr(v,m,cur){return v/(cur[m]||1)}
function fe(n){return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n)+" €"}
function fp(n){return n.toFixed(1).replace(".",",")+"%"}
function fsgn(n){return (n>=0?"+":"")+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n)+" €"}
function fpct(n){return (n>=0?"+":"")+n.toFixed(1).replace(".",",")+"%"}

/* ── Arc helpers ── */
function arc(cx,cy,r,a1,a2){
  var rad=function(d){return (d-90)*Math.PI/180};
  var r1=rad(a1),r2=rad(a2),lg=a2-a1>180?1:0;
  return "M"+(cx+r*Math.cos(r1))+","+(cy+r*Math.sin(r1))+
         " A"+r+","+r+",0,"+lg+",1,"+(cx+r*Math.cos(r2))+","+(cy+r*Math.sin(r2));
}
function sectors(data,cx,cy,r,gap){
  var tot=data.reduce(function(s,d){return s+Math.max(d.v,0)},0);
  if(tot===0) return [];
  var res=[],ang=0;
  data.forEach(function(d){
    if(d.v<=0) return;
    var sp=d.v/tot*360,gd=(gap||1.4)*360/(2*Math.PI*r);
    if(sp-gd>0.5) res.push({key:d.key,color:d.color,extra:d,path:arc(cx,cy,r,ang+gd/2,ang+sp-gd/2),sp:sp});
    ang+=sp;
  });
  return res;
}

/* ════════════ TAB 1 — ALOCARE ════════════ */
