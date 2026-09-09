/* Portfolio Manager — CurrencyChart Component */


function CurrencyChart({data}){
  var cur = data.cursuri;
  function toEur(v,m){ return v/(cur[m]||1); }
  var totals = {"EUR":0,"USD":0,"RON":0};
  data.pozitii.forEach(function(p){
    var v = toEur(p.cantitate*p.pret, p.moneda);
    totals[p.moneda] = (totals[p.moneda]||0)+v;
  });
  var grand = Object.values(totals).reduce(function(s,v){return s+v},0);
  if(grand<=0) return null;

  var CUR_COLORS = {"EUR":"#f59e0b","USD":"#38bdf8","RON":"#a78bfa"};
  var entries = Object.entries(totals).filter(function(e){return e[1]>0})
    .sort(function(a,b){return b[1]-a[1]});

  /* Mini donut SVG */
  var R=50, r=32, cx=60, cy=60, W=120, H=120;
  var slices=[]; var angle=-Math.PI/2;
  entries.forEach(function(e){
    var frac=e[1]/grand, sweep=frac*2*Math.PI;
    var x1=cx+R*Math.cos(angle), y1=cy+R*Math.sin(angle);
    var x2=cx+R*Math.cos(angle+sweep), y2=cy+R*Math.sin(angle+sweep);
    var xi=cx+r*Math.cos(angle), yi=cy+r*Math.sin(angle);
    var xo=cx+r*Math.cos(angle+sweep), yo=cy+r*Math.sin(angle+sweep);
    var large=sweep>Math.PI?1:0;
    slices.push({currency:e[0],val:e[1],pct:(frac*100).toFixed(1),
      d:"M"+x1.toFixed(1)+","+y1.toFixed(1)+" A"+R+","+R+" 0 "+large+",1 "+x2.toFixed(1)+","+y2.toFixed(1)+
        " L"+xo.toFixed(1)+","+yo.toFixed(1)+" A"+r+","+r+" 0 "+large+",0 "+xi.toFixed(1)+","+yi.toFixed(1)+" Z",
      col:CUR_COLORS[e[0]]||"#64748b"});
    angle+=sweep;
  });

  return h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"16px 20px"}},
    h("div",{style:{fontSize:10,color:"#6b7280",letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}},
      "ALLOCATION BY CURRENCY"),
    h("div",{style:{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}},
      /* Donut */
      h("svg",{viewBox:"0 0 120 120",style:{width:100,height:100,flexShrink:0}},
        slices.map(function(s,i){
          return h("path",{key:s.currency,d:s.d,fill:s.col,opacity:0.9,
            stroke:"#111827",strokeWidth:1.5});
        })
      ),
      /* Legend */
      h("div",{style:{display:"flex",flexDirection:"column",gap:8,flex:1}},
        slices.map(function(s){
          return h("div",{key:s.currency,style:{display:"flex",alignItems:"center",gap:8}},
            h("span",{style:{width:10,height:10,borderRadius:2,background:s.col,flexShrink:0}}),
            h("div",null,
              h("div",{style:{display:"flex",gap:8,alignItems:"baseline"}},
                h("span",{style:{fontWeight:600,fontSize:13,color:"#e6e1d8"}},s.currency),
                h("span",{style:{fontFamily:"Georgia,serif",fontSize:14,color:s.col}},s.pct+"%")
              ),
              
            )
          );
        })
      )
    )
  );
}

/* ════════════ ROOT ════════════ */
function App(props){
  var data=props.data,tab=props.tab;
  if(!data||!data.pozitii||!data.pozitii.length){
    return h("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",
      height:"calc(100vh - 51px)",color:"#4b5563",flexDirection:"column",gap:12}},
      h("div",{style:{fontSize:32,opacity:.3}},"📊"),
      h("span",null,"Add positions in the sidebar to see the chart · Use 🔄 to recordra primul snapshot de evolution"));
  }
  if(tab==="evo") return h(EvolutionChart,null);
  return tab==="pnl"?h(PnlChart,{data:data}):h(AllocChart,{data:data});
}

var _root=ReactDOM.createRoot(document.getElementById("cr"));
function renderChart(data,tab){_root.render(h(App,{data:data,tab:tab||"alloc"}))}
renderChart(null,"alloc");
