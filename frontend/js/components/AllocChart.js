/* Portfolio Manager — AllocChart Component */

function AllocChart(props){
  var data=props.data;
  var hovS=React.useState(null);var hov=hovS[0];var setHov=hovS[1];
  var animS=React.useState(0); var anim=animS[0];var setAnim=animS[1];
  var collS=React.useState({});var collCats=collS[0];var setCollCats=collS[1];
  function toggleCat(cat){setCollCats(function(prev){var n=Object.assign({},prev);n[cat]=!n[cat];return n;});}
  React.useEffect(function(){
    var start=null;setAnim(0);
    function step(ts){if(!start)start=ts;var p=Math.min((ts-start)/800,1);setAnim(p<1?1-Math.pow(1-p,3):1);if(p<1)requestAnimationFrame(step)}
    requestAnimationFrame(step);
  },[data]);

  var cur=data.cursuri;
  var poz=data.pozitii.map(function(p){return Object.assign({},p,{ve:toEr(p.cantitate*p.pret,p.moneda,cur)})});
  var tot=poz.reduce(function(s,p){return s+p.ve},0);
  poz.forEach(function(p){p.pct=p.ve/tot*100});
  var cm={};
  CATS_R.forEach(function(c){
    var it=poz.filter(function(p){return p.categorie===c});
    cm[c]={it:it,ve:it.reduce(function(s,p){return s+p.ve},0)};
    cm[c].pct=cm[c].ve/tot*100;
  });

  var CX=148,CY=148,RO=130,RI=88;
  var od=CATS_R.reduce(function(a,c){
    return a.concat(cm[c].it.map(function(p,i){
      return {key:"o"+p.id,v:p.ve,color:PAL_R[c].sh[i%PAL_R[c].sh.length],cat:c,p:p}}))
  },[]);
  var id2=CATS_R.map(function(c){return {key:c,v:cm[c].ve,color:PAL_R[c].main,cat:c}});
  var oa=sectors(od,CX,CY,RO,1.2);
  var ia=sectors(id2,CX,CY,RI,2.0);
  var hcat=typeof hov==="number"?(poz.find(function(p){return p.id===hov})||{}).categorie:typeof hov==="string"&&hov!=="World"&&hov!=="Romania"?hov:null;
  var hreg=hov==="World"||hov==="Romania"?hov:(typeof hov==="number"?(poz.find(function(p){return p.id===hov})||{}).regiune:null);
  function dimO(a){return hov!==null&&a.extra.p.id!==hov&&a.extra.cat!==hcat}
  function litO(a){return hov===a.extra.p.id}
  function dimI(a){return hov!==null&&a.extra.cat!==hcat}
  function litI(a){return a.extra.cat===hcat}

  var ct;
  if(hov===null){
    ct=[h("text",{key:"a",x:CX,y:CY-8,textAnchor:"middle",fill:"#6b7280",fontSize:10,letterSpacing:".07em"},"TOTAL"),
        h("text",{key:"b",x:CX,y:CY+14,textAnchor:"middle",fill:"#e6e1d8",fontSize:19,fontFamily:"Georgia,serif"},fe(tot))];
  } else if(typeof hov==="number"){
    var hp=poz.find(function(p){return p.id===hov})||{};
    ct=[h("text",{key:"a",x:CX,y:CY-20,textAnchor:"middle",fill:"#9ca3af",fontSize:9},(hp.categorie||"").toUpperCase()),
        h("text",{key:"b",x:CX,y:CY-4, textAnchor:"middle",fill:"#e6e1d8",fontSize:13,fontWeight:"600"},hp.nume||""),
        h("text",{key:"c",x:CX,y:CY+15,textAnchor:"middle",fill:PAL_R[hp.categorie||"Cash"].main,fontSize:17,fontFamily:"Georgia,serif"},fe(hp.ve||0)),
        h("text",{key:"d",x:CX,y:CY+31,textAnchor:"middle",fill:"#6b7280",fontSize:11},fp(hp.pct||0))];
  } else if(hov==="World"||hov==="Romania"){
    var rv=poz.filter(function(p){return hov==="Romania"?p.regiune==="Romania":p.regiune!=="Romania"}).reduce(function(s,p){return s+p.ve},0);
    ct=[h("text",{key:"a",x:CX,y:CY-16,textAnchor:"middle",fill:"#9ca3af",fontSize:9},"REGIUNE"),
        h("text",{key:"b",x:CX,y:CY+2, textAnchor:"middle",fill:"#e6e1d8",fontSize:13,fontWeight:"600"},hov),
        h("text",{key:"c",x:CX,y:CY+22,textAnchor:"middle",fill:REG_COL[hov],fontSize:17,fontFamily:"Georgia,serif"},fe(rv)),
        h("text",{key:"d",x:CX,y:CY+38,textAnchor:"middle",fill:"#6b7280",fontSize:11},fp(rv/tot*100))];
  } else {
    var hc=cm[hov]||{ve:0,pct:0};
    ct=[h("text",{key:"a",x:CX,y:CY-16,textAnchor:"middle",fill:"#9ca3af",fontSize:9},"CATEGORIE"),
        h("text",{key:"b",x:CX,y:CY+2, textAnchor:"middle",fill:"#e6e1d8",fontSize:13,fontWeight:"600"},hov),
        h("text",{key:"c",x:CX,y:CY+22,textAnchor:"middle",fill:PAL_R[hov]?PAL_R[hov].main:"#64748b",fontSize:17,fontFamily:"Georgia,serif"},fe(hc.ve)),
        h("text",{key:"d",x:CX,y:CY+38,textAnchor:"middle",fill:"#6b7280",fontSize:11},fp(hc.pct))];
  }

  return h("div",{style:{display:"flex",gap:16,padding:16,flexWrap:"wrap",alignItems:"flex-start"}},
    /* Donut */
    h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"16px 14px",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center"}},
      h("div",{style:{fontSize:10,color:"#6b7280",letterSpacing:".09em",textTransform:"uppercase",marginBottom:10}},"Visual allocation"),
      h("svg",{width:310,height:310,style:{overflow:"visible"}},
        h("defs",null,CATS_R.map(function(c){
          return h("filter",{key:c,id:"gf"+c.replace(/\W/g,""),x:"-60%",y:"-60%",width:"220%",height:"220%"},
            h("feGaussianBlur",{stdDeviation:"4",result:"b"}),
            h("feMerge",null,h("feMergeNode",{in:"b"}),h("feMergeNode",{in:"SourceGraphic"})))
        })),
        oa.map(function(a){
          var lit=litO(a),dim=dimO(a);
          return h("path",{key:a.key,d:a.path,fill:"none",stroke:a.color,strokeWidth:lit?32:26,strokeLinecap:"round",
            opacity:dim?0.1:1,filter:lit?"url(#gf"+a.extra.cat.replace(/\W/g,"")+")" :undefined,
            style:{cursor:"pointer",transition:"opacity .18s"},
            onMouseEnter:function(){setHov(a.extra.p.id)},onMouseLeave:function(){setHov(null)}})
        }),
        ia.map(function(a){
          var lit=litI(a),dim=dimI(a);
          return h("path",{key:a.key,d:a.path,fill:"none",stroke:a.color,strokeWidth:lit?30:24,strokeLinecap:"round",
            opacity:dim?0.1:0.88,filter:lit?"url(#gf"+a.extra.cat.replace(/\W/g,"")+")" :undefined,
            style:{cursor:"pointer",transition:"opacity .18s"},
            onMouseEnter:function(){setHov(a.extra.cat)},onMouseLeave:function(){setHov(null)}})
        }),
        /* ── Ring 3: World / Romania ── */
        (function(){
          var regDate=[
            {key:"World",   v:poz.filter(function(p){return p.regiune!=="Romania"}).reduce(function(s,p){return s+p.ve},0), color:REG_COL["World"]},
            {key:"Romania", v:poz.filter(function(p){return p.regiune==="Romania"}).reduce(function(s,p){return s+p.ve},0), color:REG_COL["Romania"]},
          ].filter(function(d){return d.v>0});
          return sectors(regDate,CX,CY,52,3.0).map(function(a){
            var lit=hov===a.key, dim=hov!==null&&!lit;
            return h("path",{key:"reg-"+a.key,d:a.path,fill:"none",stroke:a.color,
              strokeWidth:lit?24:18,strokeLinecap:"round",
              opacity:dim?0.15:0.95,
              filter:lit?"url(#gfWorld)":undefined,
              style:{cursor:"pointer",transition:"opacity .18s"},
              onMouseEnter:function(){setHov(a.key)},
              onMouseLeave:function(){setHov(null)}});
          });
        })(),
        ct
      ),
      h("div",{style:{display:"flex",gap:10,marginTop:8,flexWrap:"wrap",justifyContent:"center"}},
        CATS_R.filter(function(c){return cm[c].it.length>0}).map(function(c){
          var dim=hov!==null&&hov!==c&&hcat!==c;
          return h("div",{key:c,style:{display:"flex",alignItems:"center",gap:4,cursor:"pointer",opacity:dim?0.4:1,transition:"opacity .15s"},
            onMouseEnter:function(){setHov(c)},onMouseLeave:function(){setHov(null)}},
            h("span",{style:{width:7,height:7,borderRadius:2,background:PAL_R[c].main,display:"inline-block"}}),
            h("span",{style:{fontSize:10.5,color:"#9ca3af"}},c+" "),
            h("span",{style:{fontSize:10.5,color:PAL_R[c].main,fontWeight:600}},fp(cm[c].pct)))
        })
      ),
      /* ── Summary World / Romania ── */
      h("div",{style:{marginTop:12,paddingTop:10,borderTop:"1px solid #1f2937",width:"100%",display:"flex",gap:8,justifyContent:"center"}},
        ["World","Romania"].map(function(reg){
          var rv=poz.filter(function(p){return reg==="Romania"?p.regiune==="Romania":p.regiune!=="Romania"}).reduce(function(s,p){return s+p.ve},0);
          var rpct=rv/tot*100;
          var dim=hov!==null&&hov!==reg&&hov!=="World"&&hov!=="Romania"?false:hov!==null&&hov!==reg;
          return h("div",{key:reg,
            style:{flex:1,background:"#0d1117",border:"1px solid",borderColor:hov===reg?REG_COL[reg]+"88":"#1f2937",
              borderRadius:8,padding:"7px 10px",cursor:"pointer",
              opacity:dim?0.4:1,transition:"all .18s",
              boxShadow:hov===reg?"0 0 12px "+REG_COL[reg]+"33":"none"},
            onMouseEnter:function(){setHov(reg)},onMouseLeave:function(){setHov(null)}},
            h("div",{style:{display:"flex",alignItems:"center",gap:5,marginBottom:3}},
              h("span",{style:{width:8,height:8,borderRadius:"50%",background:REG_COL[reg],display:"inline-block"}}),
              h("span",{style:{fontSize:10,color:"#9ca3af",fontWeight:600}},reg)
            ),
            h("div",{style:{fontFamily:"Georgia,serif",fontSize:14,color:REG_COL[reg]}},fe(rv)),
            h("div",{style:{fontSize:10,color:"#6b7280",marginTop:1}},fp(rpct))
          )
        })
      )
    ),
    /* Bare */
    h("div",{style:{flex:1,minWidth:260,display:"flex",flexDirection:"column",gap:6}},
      h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:12,padding:"12px 16px",marginBottom:2,display:"flex",alignItems:"baseline",justifyContent:"space-between"}},
        h("div",null,
          h("div",{style:{fontSize:10,color:"#6b7280",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}},"Total amount"),
          h("span",{style:{fontFamily:"Georgia,serif",fontSize:24,color:"#e6e1d8"}},fe(tot))
        ),
        h("span",{style:{fontSize:11,color:"#4b5563"}},poz.length+" positions")
      ),
      CATS_R.map(function(cat){
        var cd=cm[cat]; if(!cd.it.length)return null;
        var pal=PAL_R[cat],clit=hov===cat||hcat===cat,cdim=hov!==null&&!clit;
        return h("div",{key:cat,style:{background:"#111827",border:"1px solid",borderColor:clit?pal.main+"55":"#1f2937",borderRadius:12,overflow:"hidden",opacity:cdim?0.35:1,transition:"all .2s",boxShadow:clit?"0 0 16px "+pal.main+"1a":"none"}},
          h("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 8px",borderBottom:"1px solid #161d29",cursor:"pointer"},
            onClick:function(){toggleCat(cat)},
            onMouseEnter:function(){setHov(cat)},onMouseLeave:function(){setHov(null)}},
            h("div",{style:{display:"flex",alignItems:"center",gap:6}},
              h("span",{style:{width:9,height:9,borderRadius:3,background:pal.main,display:"inline-block"}}),
              h("span",{style:{fontWeight:700,fontSize:12.5}},cat),
              h("span",{style:{fontSize:10,color:"#6b7280"}},cd.it.length+" positions"),
              h("span",{style:{fontSize:11,fontWeight:600,color:pal.main,marginLeft:4}},fp(cd.pct))
            ),
            h("div",{style:{display:"flex",alignItems:"center",gap:8}},
              h("span",{style:{fontFamily:"Georgia,serif",fontSize:13.5,color:pal.main}},fe(cd.ve)),
              h("span",{style:{fontSize:12,color:"#4b5563",transition:"transform .2s",
                transform:collCats[cat]?"rotate(-90deg)":"rotate(0deg)"}},"▼")
            )
          ),
          h("div",{style:{padding:"0 16px",marginTop:6}},
            h("div",{style:{height:3,background:"#1f2937",borderRadius:2}},
              h("div",{style:{height:"100%",borderRadius:2,background:pal.main+"44",width:(cd.pct*anim)+"%",transition:"width .8s cubic-bezier(.22,1,.36,1)"}}))
          ),
          !collCats[cat] && h("div",{style:{padding:"7px 16px 12px",display:"flex",flexDirection:"column",gap:7}},
            cd.it.map(function(p,i){
              var sh=pal.sh[i%pal.sh.length],plit=hov===p.id,pdim=hov!==null&&!plit&&!clit,pcc=p.ve/cd.ve*100;
              return h("div",{key:p.id,style:{opacity:pdim?0.3:1,transition:"opacity .15s",cursor:"pointer"},
                onMouseEnter:function(){setHov(p.id)},onMouseLeave:function(){setHov(null)}},
                h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}},
                  h("div",{style:{display:"flex",alignItems:"center",gap:5}},
                    h("span",{style:{width:5,height:5,borderRadius:"50%",background:sh,display:"inline-block",boxShadow:plit?"0 0 5px "+sh:undefined}}),
                    h("span",{style:{fontSize:12,fontWeight:plit?700:500,color:plit?"#e6e1d8":"#9ca3af",transition:"color .15s"}},p.nume),
                    h("span",{style:{fontSize:9.5,color:"#6b7280",fontWeight:600}},fp(p.ve/tot*100)+" portfolio · "),h("span",{style:{fontSize:9.5,color:"#4b5563"}},Number(p.cantitate).toLocaleString("en-US")+" × "+p.pret+" "+p.moneda)
                  ),
                  h("div",{style:{display:"flex",gap:7,alignItems:"baseline"}},
                    h("span",{style:{fontFamily:"Georgia,serif",fontSize:12.5,color:plit?sh:"#d1d5db",transition:"color .15s"}},fe(p.ve)),
                    h("span",{style:{fontSize:10.5,color:plit?pal.main+"cc":"#6b7280",minWidth:32,textAlign:"right"}},fp(p.pct))
                  )
                ),
                h("div",{style:{position:"relative",height:5,background:"#161d29",borderRadius:3}},
                  h("div",{style:{position:"absolute",top:0,left:0,height:"100%",borderRadius:3,background:sh+"28",width:(pcc*anim)+"%",transition:"width .8s cubic-bezier(.22,1,.36,1)"}}),
                  h("div",{style:{position:"absolute",top:1,left:0,height:3,borderRadius:2,background:plit?sh:sh+"aa",boxShadow:plit?"0 0 6px "+sh:undefined,width:(p.pct*anim)+"%",transition:"width .8s cubic-bezier(.22,1,.36,1), box-shadow .2s"}})
                ),
                plit&&h("div",{style:{display:"flex",justifyContent:"space-between",marginTop:3}},
                  h("span",{style:{fontSize:9,color:"#374151"}},fp(p.pct)+" din total"),
                  h("span",{style:{fontSize:9,color:"#374151"}},fp(pcc)+" din "+cat)
                )
              )
            })
          )
        )
      }),
      
    /* ── Realized section (tranzactii inchise) ── */
    (function(){
      var tranz = (data.tranzactii||[]);
      if(tranz.length===0) return null;
      var cur = data.cursuri;
      function toEurT(v,m){return v/(cur[m]||1)}
      var totRealEur = tranz.reduce(function(s,t){return s+toEurT(t.profit||0,t.moneda||"EUR")},0);
      return h("div",{style:{background:"#111827",border:"1px solid",
        borderColor:totRealEur>=0?"#16a34a44":"#dc262644",
        borderRadius:12,overflow:"hidden"}},
        h("div",{style:{padding:"10px 16px 8px",borderBottom:"1px solid #161d29",
          display:"flex",justifyContent:"space-between",alignItems:"center"}},
          h("div",{style:{display:"flex",alignItems:"center",gap:8}},
            h("span",{style:{fontSize:12,fontWeight:700}},"💸 Realized Gains / Losses"),
            h("span",{style:{fontSize:10,color:"#6b7280"}},tranz.length+" transactions")
          ),
          h("div",{style:{display:"flex",alignItems:"baseline",gap:8}},
            h("span",{style:{fontFamily:"Georgia,serif",fontSize:15,
              color:totRealEur>=0?"#22c55e":"#ef4444"}},
              (totRealEur>=0?"+":"")+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totRealEur)+" €"),
            h("span",{style:{fontSize:10,color:"#6b7280"}},"echiv. EUR")
          )
        ),
        h("div",{style:{padding:"8px 16px 12px",display:"flex",flexDirection:"column",gap:8}},
          tranz.map(function(t){
            var isPos = (t.profit||0)>=0;
            var profEur = toEurT(t.profit||0, t.moneda||"EUR");
            var catColor = {"ETFs":"#f59e0b","Stocks":"#14d9c4","Bonds":"#a78bfa","Cash":"#64748b"}[t.categorie]||"#64748b";
            return h("div",{key:t.id,style:{
              background:"#0d1117",borderRadius:8,padding:"10px 12px",
              borderLeft:"3px solid "+(isPos?"#22c55e":"#ef4444")}},
              h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:4}},
                h("div",{style:{display:"flex",alignItems:"center",gap:6}},
                  h("span",{style:{fontWeight:700,fontSize:13,color:"#e6e1d8"}},t.pozitie_nume),
                  h("span",{style:{fontSize:9,padding:"1px 6px",borderRadius:4,
                    background:"#1f2937",color:catColor}},t.categorie),
                  t.data&&h("span",{style:{fontSize:10,color:"#6b7280"}},t.data)
                ),
                h("div",{style:{display:"flex",gap:10,alignItems:"baseline"}},
                  h("span",{style:{fontSize:13,fontFamily:"Georgia,serif",
                    color:isPos?"#22c55e":"#ef4444",fontWeight:600}},
                    (isPos?"+":"")+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(t.profit||0)+" "+(t.moneda||"EUR")),
                  profEur!==t.profit&&h("span",{style:{fontSize:10,color:"#4b5563"}},
                    "("+( profEur>=0?"+":"")+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(profEur)+" €)"),
                  h("span",{style:{fontSize:11,color:isPos?"#16a34a":"#dc2626",minWidth:44,textAlign:"right"}},
                    (isPos?"+":"")+( t.pct||0).toFixed(1).replace(".",",")+"%")
                )
              ),
              h("div",{style:{fontSize:10,color:"#4b5563",marginTop:4}},
                new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(t.cantitate||0)+" units",
                " × "+(t.pret_vanzare||0)+" "+(t.moneda||"")+" (sale price)",
                " · avg. cost: "+(t.pret_mediu||0)+" "+(t.moneda||"")
              )
            )
          })
        )
      );
    })(),
    h("div",{style:{fontSize:10,color:"#374151",paddingTop:2,display:"flex",justifyContent:"space-between",flexWrap:"wrap"}},
    h(CurrencyChart,{data:data}),
        h("span",null,"EUR/USD "+data.cursuri.USD+" · EUR/RON "+data.cursuri.RON),
        h("span",null,"Date orientative"))
    ),
    /* ── Donuts World / Romania ── */
    h("div",{style:{display:"flex",gap:12,flexWrap:"wrap",padding:"0 16px 16px"}},
      h("div",{style:{fontSize:11,fontWeight:600,color:"#6b7280",width:"100%",
        textTransform:"uppercase",letterSpacing:".07em",paddingBottom:4,
        borderBottom:"1px solid #1f2937",marginBottom:4}},
        "Alocare per regiune"),
      h(MiniDonut,{
        label:"World",
        pozitii:poz.filter(function(p){return p.regiune!=="Romania"}),
        tot_global:tot,
        color:REG_COL["World"]
      }),
      h(MiniDonut,{
        label:"Romania",
        pozitii:poz.filter(function(p){return p.regiune==="Romania"}),
        tot_global:tot,
        color:REG_COL["Romania"]
      })
    )
  )
}

/* ════════════ TAB 2 — PROFIT / PIERDERE ════════════ */