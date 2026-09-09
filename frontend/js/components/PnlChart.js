/* Portfolio Manager — PnlChart Component */


function PnlChart(props){
  var data=props.data;
  var animS=React.useState(0);var anim=animS[0];var setAnim=animS[1];
  var hovS=React.useState(null);var hov=hovS[0];var setHov=hovS[1];
  React.useEffect(function(){
    var start=null;setAnim(0);
    function step(ts){if(!start)start=ts;var p=Math.min((ts-start)/900,1);setAnim(p<1?1-Math.pow(1-p,3):1);if(p<1)requestAnimationFrame(step)}
    requestAnimationFrame(step);
  },[data]);

  var cur=data.cursuri;
  var poz=data.pozitii.map(function(p){
    var ve=toEr(p.cantitate*p.pret,p.moneda,cur);
    var cost=toEr(p.cantitate*(p.pret_mediu||p.pret),p.moneda,cur);
    var pnlPret=ve-cost;
    /* dividende convertite in EUR */
    var divEur=(p.dividende||[]).reduce(function(s,d){
      return s+toEr(d.valoare||0,d.moneda||p.moneda,cur);
    },0);
    var pnl=pnlPret+divEur;
    var pnlPct=cost!==0?pnl/cost*100:0;
    return Object.assign({},p,{ve:ve,cost:cost,pnlPret:pnlPret,divEur:divEur,pnl:pnl,pnlPct:pnlPct});
  }).filter(function(p){return p.categorie!=="Cash"});

  var totCost=poz.reduce(function(s,p){return s+p.cost},0);
  var totVal=poz.reduce(function(s,p){return s+p.ve},0);
  var totDiv=poz.reduce(function(s,p){return s+(p.divEur||0)},0);
  var totPnlFaraDivid=totVal-totCost;
  var totPnl=totPnlFaraDivid+totDiv;  // include dividende = consistent cu per-pozitie
  var totPct=totCost>0?totPnl/totCost*100:0;

  var maxAbs=poz.reduce(function(m,p){return Math.max(m,Math.abs(p.pnl))},1);

  /* P&L per categorie */
  var catPnl={};
  CATS_R.filter(function(c){return c!=="Cash"}).forEach(function(c){
    var it=poz.filter(function(p){return p.categorie===c});
    var pnl=it.reduce(function(s,p){return s+p.pnl},0);
    var cost=it.reduce(function(s,p){return s+p.cost},0);
    catPnl[c]={pnl:pnl,pct:cost>0?pnl/cost*100:0,it:it};
  });

  /* sortate descrescator dupa P&L */
  var sorted=poz.slice().sort(function(a,b){return b.pnl-a.pnl});

  return h("div",{style:{padding:16,display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}},

    /* ── Rezumat + bars ── */
    h("div",{style:{flex:1,minWidth:280,display:"flex",flexDirection:"column",gap:6}},

      /* banner total */
      h("div",{style:{background:"#111827",border:"1px solid",borderColor:totPnl>=0?"#16a34a55":"#dc262655",borderRadius:12,padding:"14px 18px",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}},
        h("div",null,
          h("div",{style:{fontSize:10,color:"#6b7280",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}},"P&L total (excl. cash)"),
          h("div",{style:{display:"flex",alignItems:"baseline",gap:10}},
            h("span",{style:{fontFamily:"Georgia,serif",fontSize:26,color:totPnl>=0?"#22c55e":"#ef4444"}},fsgn(totPnl)),
            h("span",{style:{fontSize:14,color:totPnl>=0?"#16a34a":"#dc2626",fontWeight:600}},fpct(totPct)),
            (function(){var td=poz.reduce(function(s,p){return s+(p.divEur||0)},0);return td>0?h("span",{style:{fontSize:11,color:"#4ade80",marginLeft:6}},"💰 "+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(td)+" € dividende"):null;})()
          )
        ),
        h("div",{style:{textAlign:"right"}},
          h("div",{style:{fontSize:10,color:"#6b7280",marginBottom:3}},"Total cost investit"),
          h("span",{style:{fontFamily:"Georgia,serif",fontSize:15,color:"#9ca3af"}},fe(totCost))
        )
      ),

      /* P&L per categorie */
      h("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}},
        CATS_R.filter(function(c){return c!=="Cash"&&catPnl[c].it.length>0}).map(function(c){
          var cp=catPnl[c],pal=PAL_R[c];
          return h("div",{key:c,style:{flex:"1 1 140px",background:"#111827",border:"1px solid #1f2937",borderRadius:10,padding:"10px 14px"}},
            h("div",{style:{display:"flex",alignItems:"center",gap:5,marginBottom:6}},
              h("span",{style:{width:8,height:8,borderRadius:2,background:pal.main,display:"inline-block"}}),
              h("span",{style:{fontSize:11,color:"#9ca3af"}},c)
            ),
            h("div",{style:{fontFamily:"Georgia,serif",fontSize:16,color:cp.pnl>=0?"#22c55e":"#ef4444"}},fsgn(cp.pnl)),
            h("div",{style:{fontSize:11,color:cp.pnl>=0?"#16a34a":"#dc2626",marginTop:1}},fpct(cp.pct))
          )
        })
      ),

      /* Bare P&L per position */
      h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:12,overflow:"hidden"}},
        h("div",{style:{padding:"12px 16px 8px",borderBottom:"1px solid #161d29",display:"flex",justifyContent:"space-between",alignItems:"center"}},
          h("span",{style:{fontSize:12,fontWeight:600}},sorted.length+" positions (excl. cash)"),
          h("span",{style:{fontSize:10,color:"#6b7280"}},"sorted by P&L")
        ),
        h("div",{style:{padding:"8px 16px 12px",display:"flex",flexDirection:"column",gap:8}},
          sorted.map(function(p){
            var pal=PAL_R[p.categorie]||{main:"#64748b"};
            var isPos=p.pnl>=0;
            var barW=Math.abs(p.pnl)/maxAbs*100;
            var lit=hov===p.id,dim=hov!==null&&!lit;
            return h("div",{key:p.id,style:{opacity:dim?0.35:1,transition:"opacity .15s",cursor:"default"},
              onMouseEnter:function(){setHov(p.id)},onMouseLeave:function(){setHov(null)}},
              /* row info */
              h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}},
                h("div",{style:{display:"flex",alignItems:"center",gap:6}},
                  h("span",{style:{width:6,height:6,borderRadius:2,background:pal.main,display:"inline-block"}}),
                  h("span",{style:{fontSize:12,fontWeight:500,color:lit?"#e6e1d8":"#9ca3af"}},p.nume),
                  h("span",{style:{fontSize:9.5,color:"#4b5563"}},p.categorie)
                ),
                h("div",{style:{display:"flex",gap:10,alignItems:"baseline"}},
                  h("span",{style:{fontSize:11,color:"#6b7280"}},"cost: "+fe(p.cost)),
                  h("span",{style:{fontFamily:"Georgia,serif",fontSize:13,color:isPos?"#22c55e":"#ef4444",fontWeight:600}},fsgn(p.pnl)),
                  h("span",{style:{fontSize:11,color:isPos?"#16a34a":"#dc2626",minWidth:46,textAlign:"right"}},fpct(p.pnlPct))
                )
              ),
              /* bara bicolora centrata */
              h("div",{style:{position:"relative",height:6,background:"#161d29",borderRadius:3}},
                h("div",{style:{
                  position:"absolute",
                  top:1,height:4,borderRadius:2,
                  background:isPos?"#22c55e":("#ef4444"),
                  boxShadow:lit?(isPos?"0 0 8px #22c55e":"0 0 8px #ef4444"):undefined,
                  left:isPos?"50%":undefined,
                  right:isPos?undefined:"50%",
                  width:(barW/2*anim)+"%",
                  transition:"width .9s cubic-bezier(.22,1,.36,1), box-shadow .2s"
                }}),
                /* linie centrala */
                h("div",{style:{position:"absolute",top:0,left:"50%",width:1,height:"100%",background:"#2a2f38"}})
              ),
              lit&&h("div",{style:{display:"flex",justifyContent:"space-between",marginTop:3}},
                h("span",{style:{fontSize:9,color:"#374151"}},"Avg. price: "+p.pret_mediu+" · current: "+p.pret+" "+p.moneda),
                p.divEur>0&&h("span",{style:{fontSize:9,color:"#4ade80"}},
                  "💰 Dividends: +"+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(p.divEur)+" €")
              )
            )
          })
        )
      )
    ),

    /* ── Waterfall vertical ── */
    h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"16px",flexShrink:0,width:260}},
      h("div",{style:{fontSize:10,color:"#6b7280",letterSpacing:".09em",textTransform:"uppercase",marginBottom:12}},"P&L Contribution"),
      h("div",{style:{display:"flex",flexDirection:"column",gap:5}},
        sorted.map(function(p){
          var pal=PAL_R[p.categorie]||{main:"#64748b"};
          var isPos=p.pnl>=0;
          var barW=Math.abs(p.pnl)/maxAbs*80;
          var lit=hov===p.id,dim=hov!==null&&!lit;
          return h("div",{key:p.id,style:{display:"flex",alignItems:"center",gap:6,opacity:dim?0.3:1,transition:"opacity .15s",cursor:"default"},
            onMouseEnter:function(){setHov(p.id)},onMouseLeave:function(){setHov(null)}},
            h("div",{style:{width:52,textAlign:"right",fontSize:10.5,color:lit?"#e6e1d8":"#9ca3af",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},p.nume),
            h("div",{style:{flex:1,height:14,background:"#161d29",borderRadius:3,position:"relative",overflow:"hidden"}},
              h("div",{style:{
                position:"absolute",top:1,height:12,borderRadius:2,
                background:isPos?"#22c55e":"#ef4444",opacity:.85,
                left:isPos?"50%":undefined,right:isPos?undefined:"50%",
                width:(barW*anim)+"%",
                transition:"width .9s cubic-bezier(.22,1,.36,1)"
              }}),
              h("div",{style:{position:"absolute",top:0,left:"50%",width:1,height:"100%",background:"#2a2f38"}})
            ),
            h("div",{style:{width:42,textAlign:"right",fontSize:9.5,color:isPos?"#22c55e":"#ef4444",flexShrink:0,fontWeight:600}},
              (isPos?"+":"")+Math.round(p.pnl)+"€")
          )
        })
      ),
      h("div",{style:{marginTop:14,paddingTop:10,borderTop:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center"}},
        h("span",{style:{fontSize:10,color:"#6b7280"}},"Total P&L"),
        h("span",{style:{fontFamily:"Georgia,serif",fontSize:15,color:totPnl>=0?"#22c55e":"#ef4444",fontWeight:600}},fsgn(totPnl))
      )
    )
  )
}


/* ════════════ MINI DONUT — World / Romania ════════════ */
function MiniDonut(props){
  var label=props.label, pozitii=props.pozitii, tot_global=props.tot_global, color=props.color;
  var hovS=React.useState(null); var hov=hovS[0]; var setHov=hovS[1];
  var animS=React.useState(0);   var an=animS[0];  var setAn=animS[1];
  React.useEffect(function(){
    var st=null;setAn(0);
    function step(ts){if(!st)st=ts;var p=Math.min((ts-st)/700,1);setAn(p<1?1-Math.pow(1-p,3):1);if(p<1)requestAnimationFrame(step)}
    requestAnimationFrame(step);
  },[pozitii]);

  var cm2={};
  CATS_R.forEach(function(c){
    var it=pozitii.filter(function(p){return p.categorie===c});
    cm2[c]={it:it,ve:it.reduce(function(s,p){return s+p.ve},0)};
  });
  var tot=pozitii.reduce(function(s,p){return s+p.ve},0);
  if(tot===0) return h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:12,
    padding:"14px",display:"flex",alignItems:"center",justifyContent:"center",flex:1,minWidth:200,color:"#4b5563",fontSize:12}},
    "Nicio position "+label);

  var CX=90,CY=90,R=75,SW=22;
  var sd=CATS_R.map(function(c){return {key:c,v:cm2[c].ve,color:PAL_R[c].main}}).filter(function(d){return d.v>0});
  var sa=sectors(sd,CX,CY,R,1.6);

  var ctxt;
  if(hov===null){
    ctxt=[
      h("text",{key:"l",x:CX,y:CY-7,textAnchor:"middle",fill:"#6b7280",fontSize:9,letterSpacing:".05em"},label.toUpperCase()),
      h("text",{key:"v",x:CX,y:CY+10,textAnchor:"middle",fill:"#e6e1d8",fontSize:13,fontFamily:"Georgia,serif"},fe(tot)),
      h("text",{key:"p",x:CX,y:CY+24,textAnchor:"middle",fill:color,fontSize:10},fp(tot/tot_global*100)+" din total"),
    ];
  } else {
    var hve=cm2[hov]?cm2[hov].ve:0, hpct=tot>0?hve/tot*100:0;
    ctxt=[
      h("text",{key:"l",x:CX,y:CY-12,textAnchor:"middle",fill:"#9ca3af",fontSize:8},hov.toUpperCase()),
      h("text",{key:"v",x:CX,y:CY+6, textAnchor:"middle",fill:PAL_R[hov]?PAL_R[hov].main:"#e6e1d8",fontSize:13,fontFamily:"Georgia,serif"},fe(hve)),
      h("text",{key:"p",x:CX,y:CY+21,textAnchor:"middle",fill:"#6b7280",fontSize:10},fp(hpct)+" din "+label),
    ];
  }

  return h("div",{style:{background:"#111827",border:"1px solid",borderColor:color+"33",
    borderRadius:12,padding:"14px 12px",flex:1,minWidth:200,display:"flex",flexDirection:"column",alignItems:"center"}},
    /* titlu */
    h("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:10}},
      h("span",{style:{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",boxShadow:"0 0 6px "+color}}),
      h("span",{style:{fontSize:11,fontWeight:600,color:"#e6e1d8"}},label),
      h("span",{style:{fontSize:10,color:"#4b5563"}},"· "+pozitii.length+" positions")
    ),
    /* SVG */
    h("svg",{width:180,height:180,style:{overflow:"visible"}},
      h("defs",null,
        h("filter",{id:"gfmini"+label.replace(/\W/g,""),x:"-60%",y:"-60%",width:"220%",height:"220%"},
          h("feGaussianBlur",{stdDeviation:"3",result:"b"}),
          h("feMerge",null,h("feMergeNode",{in:"b"}),h("feMergeNode",{in:"SourceGraphic"}))
        )
      ),
      sa.map(function(a){
        var lit=hov===a.key, dim=hov!==null&&!lit;
        return h("path",{key:a.key,d:a.path,fill:"none",stroke:a.color,
          strokeWidth:lit?SW+5:SW,strokeLinecap:"round",
          opacity:dim?0.12:an,
          filter:lit?("url(#gfmini"+label.replace(/\W/g,"")+")" ):undefined,
          style:{cursor:"pointer",transition:"opacity .15s,stroke-width .15s"},
          onMouseEnter:function(){setHov(a.key)},
          onMouseLeave:function(){setHov(null)}});
      }),
      ctxt
    ),
    /* legenda */
    h("div",{style:{display:"flex",flexDirection:"column",gap:4,width:"100%",marginTop:4}},
      CATS_R.filter(function(c){return cm2[c].ve>0}).map(function(c){
        var ve=cm2[c].ve, pct=ve/tot*100;
        var lit=hov===c, dim=hov!==null&&!lit;
        return h("div",{key:c,
          style:{display:"flex",alignItems:"center",gap:6,cursor:"pointer",
            opacity:dim?0.35:1,transition:"opacity .15s",
            background:lit?"#161d29":"transparent",borderRadius:5,padding:"2px 4px"},
          onMouseEnter:function(){setHov(c)},onMouseLeave:function(){setHov(null)}},
          h("span",{style:{width:6,height:6,borderRadius:2,background:PAL_R[c].main,display:"inline-block",flexShrink:0}}),
          h("span",{style:{fontSize:10.5,color:"#9ca3af",flex:1}},c),
          /* mini bara */
          h("div",{style:{width:60,height:4,background:"#1f2937",borderRadius:2,overflow:"hidden"}},
            h("div",{style:{height:"100%",borderRadius:2,background:PAL_R[c].main+"99",
              width:(pct*an)+"%",transition:"width .7s cubic-bezier(.22,1,.36,1)"}})
          ),
          h("span",{style:{fontSize:10,color:lit?PAL_R[c].main:"#6b7280",minWidth:32,textAlign:"right",fontWeight:lit?600:400}},fp(pct))
        )
      })
    )
  )
}



/* ════════════════════════════════════════════════════════
   TAB 3 — PORTFOLIO EVOLUTION
════════════════════════════════════════════════════════ */