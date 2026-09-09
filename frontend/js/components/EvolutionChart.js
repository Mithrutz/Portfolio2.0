/* Portfolio Manager — EvolutionChart Component */


function EvolutionChart(){
  var snapsS  = React.useState([]);  var snapshots=snapsS[0];  var setSnapshots=snapsS[1];
  var loadS   = React.useState(true);var loading=loadS[0];     var setLoading=loadS[1];
  var hovS    = React.useState(null);var hovIdx=hovS[0];       var setHovIdx=hovS[1];
  var selCatS = React.useState("Total"); var selectedCat=selCatS[0]; var setSelectedCat=selCatS[1];
  var showAddS= React.useState(false);var showAdd=showAddS[0]; var setShowAdd=showAddS[1];
  var addDateS= React.useState("");   var addDate=addDateS[0]; var setAddDate=addDateS[1];
  var addTotS = React.useState("");   var addTotal=addTotS[0]; var setAddTotal=addTotS[1];
  var showHistS=React.useState(false);var showHistoric=showHistS[0];var setShowHistoric=showHistS[1];
  var confirmDelS=React.useState(null);var confirmDel=confirmDelS[0];var setConfirmDel=confirmDelS[1];

  React.useEffect(function(){
    function loadSnaps(){
      fetch("/api/snapshots")
        .then(function(r){return r.json()})
        .then(function(d){setSnapshots(d);setLoading(false)})
        .catch(function(){setLoading(false)});
    }
    window._evoReloadFn = loadSnaps;  // expune global pt startRefresh
    loadSnaps();
    return function(){ window._evoReloadFn = null; };
  },[]);

  async function addManualSnapshot(){
    if(!addDate||!addTotal) return;
    var val=parseFloat(addTotal.replace(",","."));
    if(isNaN(val)) return;
    var newSnap={data:addDate,total_eur:val,categorii:{},manual:true};
    var updated=snapshots.filter(function(s){return s.data!==addDate}).concat(newSnap);
    updated.sort(function(a,b){return a.data.localeCompare(b.data)});
    setSnapshots(updated);
    setAddDate("");setAddTotal("");setShowAdd(false);
    var dataResp=await fetch("/api/data").then(function(r){return r.json()});
    dataResp.snapshots=updated;
    await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(dataResp)});
  }

  async function deleteSnapshot(dataStr){
    await fetch("/api/snapshots/"+dataStr,{method:"DELETE"});
    setSnapshots(snapshots.filter(function(s){return s.data!==dataStr}));
    setConfirmDel(null);
    setShowHistoric(false);
  }

  if(loading) return h("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",
    height:"calc(100vh - 51px)",color:"#4b5563",gap:10}},
    h("span",{className:"spin"}), "Loading...");

  if(snapshots.length===0) return h("div",{style:{display:"flex",alignItems:"center",
    justifyContent:"center",height:"calc(100vh - 51px)",flexDirection:"column",gap:14,color:"#4b5563"}},
    h("div",{style:{fontSize:32,opacity:.3}},"📉"),
    h("div",null,"No snapshots recorded yet."),
    h("div",{style:{fontSize:12,color:"#374151"}},"Press «🔄 Update prices» for the first snapshot,"),
    h("div",{style:{fontSize:12,color:"#374151"}},"or add historical data manually."),
    h("button",{onClick:function(){setShowAdd(true)},
      style:{marginTop:8,background:"#f59e0b",color:"#000",border:"none",padding:"8px 18px",
        borderRadius:7,cursor:"pointer",fontSize:13,fontWeight:500}}, "＋ Add manual")
  );

  /* ── Constante culori ── */
  var CAT_COLORS = {"ETFs":"#f59e0b","Stocks":"#14d9c4","Bonds":"#a78bfa","Cash":"#64748b","Crypto":"#f97316","Total":"#f59e0b"};
  var n = snapshots.length;

  /* ── Categoriile availablee (au date in snapshots) ── */
  var availCats = ["ETFs","Stocks","Bonds","Cash"].filter(function(c){
    return snapshots.some(function(s){return ((s.categorii||{})[c]||0)>0});
  });

  /* ── Valorile pentru categoria selectata ── */
  var vals = selectedCat==="Total"
    ? snapshots.map(function(s){return s.total_eur||0})
    : snapshots.map(function(s){
        var cats = s.categorii||{};
        // Daca nu are nicio categorie (snapshot manual) → null complet
        if(!cats||Object.keys(cats).length===0) return null;
        var v = cats[selectedCat];
        return (v && v>0) ? v : null;
      });

  // Filtreaza null pentru calcule min/max
  var validValsEvo = vals.filter(function(v){return v!=null&&v>0});

  var selectedColor = CAT_COLORS[selectedCat]||"#f59e0b";
  var firstVal = vals[0]||0;
  var lastVal  = vals[n-1]||0;
  var totalChange = lastVal - firstVal;
  var totalPct    = firstVal>0 ? totalChange/firstVal*100 : 0;

  /* ── SVG dimensiuni ── */
  var W=760,H=320,ML=62,MR=16,MT=16,MB=44,CW=W-ML-MR,CH=H-MT-MB;
  var validVals = validValsEvo||vals.filter(function(v){return v!=null&&v>0});
  var minV = validVals.length ? Math.min.apply(null,validVals)*0.95 : 0;
  var maxV = validVals.length ? Math.max.apply(null,validVals)*1.05 : 1;
  if(maxV<=minV) maxV=minV+1;

  function xPos(i){ return ML + (n<=1?CW/2:i/(n-1)*CW); }
  function yPos(v){ return MT + CH - (v-minV)/(maxV-minV)*CH; }

  /* ── Paths ── */
  var linePath = vals.reduce(function(acc,v,i){
    if(v==null||v<=0) return acc; // sare peste null (snapshot manual fara categorie)
    var cmd=(acc===""||vals.slice(0,i).every(function(x){return x==null||x<=0}))?"M":"L";
    return acc+cmd+xPos(i).toFixed(1)+","+yPos(v).toFixed(1)+" ";
  },"").trim();
  var firstValid = vals.findIndex(function(v){return v!=null&&v>0});
  var lastValid  = vals.reduce(function(li,v,i){return (v!=null&&v>0)?i:li},-1);
  var areaPath = firstValid>=0 ? (linePath+
    " L"+xPos(lastValid).toFixed(1)+","+(MT+CH)+
    " L"+xPos(firstValid).toFixed(1)+","+(MT+CH)+" Z") : "";

  /* ── Grid Y (5 niveluri) ── */
  var yLabels = [];
  for(var yi=0;yi<=5;yi++){
    var v=minV+(maxV-minV)*yi/5;
    yLabels.push({v:v,y:yPos(v)});
  }
  /* ── Grid X ── */
  var xStep=Math.max(1,Math.floor(n/8));
  var xLabels=[];
  for(var xi=0;xi<n;xi+=xStep) xLabels.push(xi);
  if(n>1&&xLabels[xLabels.length-1]!==n-1) xLabels.push(n-1);

  return h("div",{style:{display:"flex",flexDirection:"column",gap:12,padding:16,
    background:"#0d1117",minHeight:"calc(100vh - 51px)"}},

    /* ── HEADER ── */
    h("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}},
      h("div",null,
        h("div",{style:{fontSize:10,color:"#6b7280",letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}},
          selectedCat==="Total"?"PORTFOLIO EVOLUTION":"EVOLUTION — "+selectedCat.toUpperCase()),
        h("div",{style:{display:"flex",alignItems:"baseline",gap:12}},
          h("span",{style:{fontFamily:"Georgia,serif",fontSize:24,color:"#e6e1d8"}},
            new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(lastVal)+" €"),
          h("span",{style:{fontSize:13,fontWeight:600,color:totalChange>=0?"#22c55e":"#ef4444"}},
            (totalChange>=0?"+":"")+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totalChange)+" €"),
          h("span",{style:{fontSize:12,color:totalChange>=0?"#16a34a":"#dc2626"}},
            (totalPct>=0?"+":"")+totalPct.toFixed(1).replace(".",",")+"%"),
          h("span",{style:{fontSize:10,color:"#4b5563"}},"vs first snapshot")
        )
      ),
      h("div",{style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}},
        /* Selector categorie */
        ["Total"].concat(availCats).map(function(cat){
          var active=selectedCat===cat;
          var col=CAT_COLORS[cat]||"#e6e1d8";
          return h("button",{key:cat,onClick:function(){setSelectedCat(cat);setHovIdx(null)},
            style:{padding:"5px 12px",borderRadius:6,border:"1px solid",
              borderColor:active?col:"#2a2f38",
              background:active?col+"22":"transparent",
              color:active?col:"#6b7280",
              fontSize:12,fontWeight:active?600:400,
              cursor:"pointer",fontFamily:"Inter,sans-serif",
              transition:"all .15s"}},
            cat);
        }),
        h("button",{onClick:function(){setShowAdd(!showAdd)},
          style:{padding:"5px 12px",borderRadius:6,border:"1px solid #1e4a7a",
            background:"#1e3a5f",color:"#60a5fa",fontSize:12,cursor:"pointer",
            fontFamily:"Inter,sans-serif"}},
          "＋ Add manual"),
        h("span",{style:{fontSize:10,color:"#374151"}},n+" snapshot-uri"),
        h("button",{onClick:function(){setShowHistoric(true)},
          style:{padding:"5px 10px",borderRadius:6,border:"1px solid #2a2f38",
            background:"transparent",color:"#6b7280",fontSize:11,cursor:"pointer",
            fontFamily:"Inter,sans-serif"}},
          "📋 History")
      )
    ),

    /* ── FORMULAR ADAUGARE MANUALA ── */
    showAdd && h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:10,
      padding:"12px 16px",display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}},
      h("div",null,
        h("label",{style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}},"Date"),
        h("input",{type:"date",value:addDate,onChange:function(e){setAddDate(e.target.value)},
          style:{background:"#1f2937",border:"1px solid #2a2f38",color:"#e6e1d8",
            padding:"6px 10px",borderRadius:6,fontSize:13}})
      ),
      h("div",null,
        h("label",{style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}},"Total value (€)"),
        h("input",{type:"number",step:"any",value:addTotal,
          onChange:function(e){setAddTotal(e.target.value)},
          placeholder:"ex: 58000",
          style:{background:"#1f2937",border:"1px solid #2a2f38",color:"#e6e1d8",
            padding:"6px 10px",borderRadius:6,fontSize:13,width:140}})
      ),
      h("button",{onClick:addManualSnapshot,
        style:{background:"#f59e0b",color:"#000",border:"none",padding:"7px 16px",
          borderRadius:7,cursor:"pointer",fontSize:13,fontWeight:500}}, "Add"),
      h("button",{onClick:function(){setShowAdd(false)},
        style:{background:"#2a2f38",color:"#9ca3af",border:"none",padding:"7px 12px",
          borderRadius:7,cursor:"pointer",fontSize:13}}, "Cancel")
    ),

    /* ── GRAFIC SVG ── */
    h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:14,
      padding:"16px",position:"relative"}},
      h("svg",{
        viewBox:"0 0 "+W+" "+H,
        style:{width:"100%",height:"auto",display:"block",overflow:"visible"},
        onMouseLeave:function(){setHovIdx(null)}
      },
        h("defs",null,
          h("linearGradient",{id:"evoGrad",x1:"0",y1:"0",x2:"0",y2:"1"},
            h("stop",{offset:"0%",stopColor:selectedColor,stopOpacity:"0.25"}),
            h("stop",{offset:"100%",stopColor:selectedColor,stopOpacity:"0.02"})
          ),
          h("filter",{id:"evoGlow",x:"-20%",y:"-100%",width:"140%",height:"300%"},
            h("feGaussianBlur",{stdDeviation:"3",result:"b"}),
            h("feMerge",null,h("feMergeNode",{in:"b"}),h("feMergeNode",{in:"SourceGraphic"}))
          )
        ),
        /* Grid Y */
        yLabels.map(function(yl,i){
          return h("g",{key:"y"+i},
            h("line",{x1:ML,y1:yl.y.toFixed(1),x2:W-MR,y2:yl.y.toFixed(1),
              stroke:"#1f2937",strokeWidth:1,strokeDasharray:"4,4"}),
            h("text",{x:ML-5,y:(yl.y+4).toFixed(1),textAnchor:"end",fill:"#4b5563",fontSize:10},
              new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(yl.v/1000))+"k")
          );
        }),
        /* Grid X */
        xLabels.map(function(xi,i){
          return h("text",{key:"x"+i,x:xPos(xi).toFixed(1),y:H-MB+16,
            textAnchor:"middle",fill:"#4b5563",fontSize:10},
            snapshots[xi]?snapshots[xi].data.slice(5):"");
        }),
        /* Area fill */
        n>1 && h("path",{d:areaPath,fill:"url(#evoGrad)",strokeWidth:0}),
        /* Linie principala */
        n>1 && h("path",{d:linePath,fill:"none",stroke:selectedColor,strokeWidth:2.5,
          strokeLinecap:"round",strokeLinejoin:"round",filter:"url(#evoGlow)"}),
        /* Zona hover */
        h("rect",{x:ML,y:MT,width:CW,height:CH,fill:"transparent",
          onMouseMove:function(e){
            var rect=e.currentTarget.getBoundingClientRect();
            var relX=(e.clientX-rect.left)/rect.width*CW;
            var idx=Math.round(relX/CW*Math.max(n-1,1));
            setHovIdx(Math.max(0,Math.min(n-1,idx)));
          },
          onMouseLeave:function(){setHovIdx(null)}
        }),
        /* Puncte */
        snapshots.map(function(s,i){
          if(vals[i]==null) return null; // nu desena punct pt null
          var isHov=hovIdx===i;
          return h("circle",{key:i,cx:xPos(i).toFixed(1),cy:yPos(vals[i]).toFixed(1),
            r:isHov?6:3.5,fill:isHov?selectedColor:"#0d1117",
            stroke:selectedColor,strokeWidth:isHov?2:1.5,
            style:{cursor:"pointer",transition:"r .1s"},
            onMouseEnter:function(){setHovIdx(i)},
            onClick:function(){setConfirmDel(s.data)}
          });
        }),
        /* Tooltip */
        hovIdx!==null && snapshots[hovIdx] && (function(){
          var s=snapshots[hovIdx];
          var x=xPos(hovIdx), y=yPos(vals[hovIdx]);
          var prev=hovIdx>0?vals[hovIdx-1]:null;
          var delta=prev!==null?vals[hovIdx]-prev:null;
          var tipW=180,tipH=delta!==null?58:42;
          var tipX=x+10+tipW>W-MR?x-tipW-10:x+10;
          var tipY=y-10-tipH<MT?y+10:y-10-tipH;
          return h("g",null,
            h("line",{x1:x.toFixed(1),y1:MT,x2:x.toFixed(1),y2:MT+CH,
              stroke:selectedColor,strokeWidth:1,strokeDasharray:"3,3",opacity:0.5}),
            h("rect",{x:tipX,y:tipY,width:tipW,height:tipH,rx:8,
              fill:"#1b1f26",stroke:"#2a2f38",strokeWidth:1}),
            h("text",{x:tipX+10,y:tipY+15,fill:"#9ca3af",fontSize:10},s.data+(s.manual?" (manual)":"")),
            h("text",{x:tipX+10,y:tipY+32,fill:"#e6e1d8",fontSize:14,fontFamily:"Georgia,serif"},
              new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(vals[hovIdx])+" €"),
            delta!==null&&h("text",{x:tipX+10,y:tipY+48,
              fill:delta>=0?"#22c55e":"#ef4444",fontSize:11},
              (delta>=0?"+":"")+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(delta)+" €")
          );
        })()
      ),
      h("div",{style:{fontSize:9,color:"#374151",marginTop:6,textAlign:"center"}},
        "Click a point to delete it · Hover for details · Snapshots are saved automatically when prices are updated")
    ),

    /* ── MODAL ISTORIC ── */
    showHistoric && h("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:610}},
      h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:14,
        width:560,maxWidth:"95vw",maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}},
        h("div",{style:{padding:"14px 20px",borderBottom:"1px solid #1f2937",
          display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}},
          h("span",{style:{fontSize:14,fontWeight:600}},"📋 History snapshot-uri"),
          h("button",{onClick:function(){setShowHistoric(false)},
            style:{background:"#2a2f38",border:"none",color:"#e6e1d8",
              padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:12}},"✕ Close")
        ),
        h("div",{style:{overflowY:"auto",flex:1}},
          h("div",{style:{padding:"6px 20px 4px",display:"flex",gap:0,
            fontSize:10,color:"#6b7280",borderBottom:"1px solid #161d29"}},
            h("span",{style:{width:100}},"Date"),
            h("span",{style:{flex:1,textAlign:"right"}},"Total amount"),
            h("span",{style:{width:100,textAlign:"right"}},"Change"),
            h("span",{style:{width:32}})
          ),
          snapshots.slice().reverse().map(function(s,i){
            var prev=snapshots[snapshots.length-1-i-1];
            var delta=prev?s.total_eur-prev.total_eur:null;
            return h("div",{key:s.data,
              style:{display:"flex",alignItems:"center",padding:"9px 20px",
                borderBottom:"1px solid #161d29",gap:8,transition:"background .1s"},
              onMouseEnter:function(e){e.currentTarget.style.background="#1f242c"},
              onMouseLeave:function(e){e.currentTarget.style.background="transparent"}
            },
              h("span",{style:{fontSize:12,color:"#9ca3af",width:100}},s.data),
              s.manual&&h("span",{style:{fontSize:9,padding:"1px 5px",borderRadius:4,
                background:"#1e3a5f",color:"#60a5fa"}},"manual"),
              h("span",{style:{flex:1,textAlign:"right",fontFamily:"Georgia,serif",fontSize:13,color:"#e6e1d8"}},
                new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(s.total_eur)+" €"),
              h("span",{style:{width:100,textAlign:"right",fontSize:11,
                color:delta===null?"transparent":delta>=0?"#22c55e":"#ef4444"}},
                delta!==null?(delta>=0?"+":"")+
                  new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(delta)+" €":""),
              h("button",{
                onClick:function(){setShowHistoric(false);setTimeout(function(){setConfirmDel(s.data)},100)},
                style:{width:28,background:"transparent",border:"none",cursor:"pointer",
                  color:"#4b5563",fontSize:13,borderRadius:4,padding:"2px 4px"}},"🗑")
            );
          })
        )
      )
    ),

    /* ── CONFIRMARE STERGERE ── */
    confirmDel && h("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:600}},
      h("div",{style:{background:"#111827",border:"1px solid #1f2937",borderRadius:12,
        padding:24,width:340,textAlign:"center"}},
        h("div",{style:{fontSize:15,fontWeight:600,marginBottom:8}},"Delete snapshot from "+confirmDel+"?"),
        h("div",{style:{fontSize:12,color:"#6b7280",marginBottom:18}},"This action cannot be undone."),
        h("div",{style:{display:"flex",gap:10,justifyContent:"center"}},
          h("button",{onClick:function(){deleteSnapshot(confirmDel)},
            style:{background:"#7f1d1d",color:"#fca5a5",border:"none",padding:"8px 18px",
              borderRadius:7,cursor:"pointer",fontSize:13}},"Delete"),
          h("button",{onClick:function(){setConfirmDel(null)},
            style:{background:"#2a2f38",color:"#e6e1d8",border:"none",padding:"8px 18px",
              borderRadius:7,cursor:"pointer",fontSize:13}},"Cancel")
        )
      )
    )
  );
}



/* ════════ CURRENCY ALLOCATION CHART ════════ */