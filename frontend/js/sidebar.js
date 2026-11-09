/* Portfolio Manager — Sidebar */

/* Open the stock details page in a new window.
 * Desktop (pywebview): the backend opens a native window.
 * Browser mode: falls back to a popup / new tab. */
async function openStockWindow(path, title){
  try{
    var r=await fetch("/api/stock/open-window",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:path,title:(title?title+" · ":"")+"Stock details"})});
    var j=await r.json();
    if(j.opened) return;
  }catch(e){}
  window.open(path,"_blank","width=1150,height=820");
}

function renderSB(){
  var total=ST.pozitii.reduce(function(s,p){return s+pVal(p)},0);
  var el=document.getElementById("pl"); el.innerHTML="";
  CATS.forEach(function(cat){
    // Sort items by EUR value descending
    var items=ST.pozitii.filter(function(p){return p.categorie===cat});
    if(!items.length) return;
    items=items.slice().sort(function(a,b){return pVal(b)-pVal(a)});

    var catTotal=items.reduce(function(s,p){return s+pVal(p)},0);
    var catPct=total>0?(catTotal/total*100).toFixed(1):"0";
    var catColor=(PAL[cat]||{main:"#64748b"}).main;
    var collapsed=_collapsed[cat]||false;
    var safeId=cat.replace(/[^a-z]/gi,"");

    // Category header — clickable to collapse
    var l=document.createElement("div"); l.className="cl";
    l.style.cssText="cursor:pointer;justify-content:space-between;";
    l.innerHTML='<span style="display:flex;align-items:center;gap:6px">'+
      '<span class="cd" style="background:'+catColor+'"></span>'+
      '<span>'+cat+'</span>'+
      '<span style="font-size:10px;color:#6b7280">'+catPct+'%</span>'+
    '</span>'+
    '<span id="tog-'+safeId+'" style="font-size:11px;color:#4b5563">'+
      (collapsed?'▶':'▼')+
    '</span>';
    l.onclick=(function(c,sid){return function(){
      _collapsed[c]=!_collapsed[c];
      var tog=document.getElementById("tog-"+sid);
      var grp=document.getElementById("grp-"+sid);
      if(tog) tog.textContent=_collapsed[c]?"▶":"▼";
      if(grp) grp.style.display=_collapsed[c]?"none":"";
    }})(cat,safeId);
    el.appendChild(l);

    // Group container (collapsible)
    var grp=document.createElement("div");
    grp.id="grp-"+safeId;
    grp.style.display=collapsed?"none":"";

    items.forEach(function(p,i){
      var v=pVal(p),pct=total>0?(v/total*100).toFixed(1):"0.0";
      var sh=(PAL[cat]||{sh:["#64748b"]}).sh[i%(PAL[cat]||{sh:["#64748b"]}).sh.length];
      var row=document.createElement("div"); row.className="pr";
      var isCash=(p.categorie==="Cash");
      var regBadge='<span style="margin-left:5px;font-size:9px;padding:1px 5px;border-radius:4px;background:'+(p.regiune==="Romania"?"#3b1f0f":"#0f2b3b")+';color:'+(p.regiune==="Romania"?"#fb923c":"#38bdf8")+'">'+( p.regiune||"World")+"</span>";
      if(isCash){
        row.innerHTML='<span style="font-size:14px;flex-shrink:0">💵</span>'+
          '<div class="pi"><div class="pn">'+p.nume+regBadge+'</div>'+
          '<div class="ps">Cash Balance</div></div>'+
          '<div class="pv"><div class="pvn">'+fe(v)+'</div><div class="pvp">'+pct+'%</div></div>'+
          '<div class="pact">'+
          '<button class="ib" style="color:#22c55e;font-size:16px;font-weight:bold" onclick="openCashModal('+p.id+',1)" title="Add funds">＋</button>'+
          '<button class="ib" style="color:#ef4444;font-size:16px;font-weight:bold" onclick="openCashModal('+p.id+',-1)" title="Withdraw funds">—</button>'+
          '<button class="ib d" onclick="delPos('+p.id+')" title="Delete position">🗑</button></div>';
      } else {
        row.innerHTML='<span class="pdot" style="background:'+sh+'"></span>'+
          '<div class="pi"><div class="pn">'+p.nume+regBadge+'</div>'+
          '<div class="ps">'+p.cantitate+' × '+p.pret+' '+p.moneda+'</div></div>'+
          '<div class="pv"><div class="pvn">'+fe(v)+'</div><div class="pvp">'+pct+'%</div></div>'+
          '<div class="pact">'+
          '<button class="ib" style="color:#4ade80" onclick="openDivModal('+p.id+')" title="Dividends">💰</button>'+
          '<button class="ib" style="color:#4ade80" onclick="openBuyModal('+p.id+')" title="Buy more">🛒</button>'+
          '<button class="ib" style="color:#fb923c" onclick="openSellModal('+p.id+')" title="Sell">💸</button>'+
          '<button class="ib e" onclick="openModal('+p.id+')" title="Edit position">✏️</button>'+
          '<button class="ib d" onclick="delPos('+p.id+')" title="Delete position">🗑</button></div>';
        // Click on the row (not on its action buttons) → stock details window
        row.classList.add("pr-click");
        row.title="Click for stock details";
        row.onclick=(function(pos){return function(e){
          if(e.target.closest(".pact")) return;
          openStockWindow("/stock.html?pos="+pos.id, pos.nume);
        }})(p);
      }
      grp.appendChild(row);
    });
    el.appendChild(grp);
  });
}
