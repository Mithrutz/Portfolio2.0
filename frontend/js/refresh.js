/* Portfolio Manager — Price Refresh & Modals */


/* ════════════════════════════════════════
   PRICE REFRESH
════════════════════════════════════════ */
var _refreshDate=null;

function ovRefreshCk(e){if(e.target===document.getElementById("ov-refresh"))closeRefresh()}
function closeRefresh(){document.getElementById("ov-refresh").classList.remove("open")}

async function startRefresh(){
  // Show custom confirmation modal
  showUpdateConfirm();
}

function showUpdateConfirm(){
  var n = ST.pozitii.filter(function(p){return p.ticker_stooq && p.ticker_stooq.trim()}).length;
  var lastUp = localStorage.getItem("pm_last_update");
  document.getElementById("upd-ticker-count").textContent =
    n + " position" + (n!==1?"s":"") + " with tickers will be updated.";
  var lastDiv = document.getElementById("upd-last-update");
  var lastTime = document.getElementById("upd-last-time");
  if(lastUp && lastDiv && lastTime){
    lastDiv.style.display = "block";
    lastTime.textContent = lastUp;
  } else if(lastDiv){
    lastDiv.style.display = "none";
  }
  document.getElementById("ov-update-confirm").classList.add("open");
}

function closeUpdateConfirm(){
  document.getElementById("ov-update-confirm").classList.remove("open");
}

async function confirmAndStartRefresh(){
  closeUpdateConfirm();
  var btn=document.getElementById("btn-refresh");
  btn.disabled=true; btn.innerHTML='<span class="spin"></span>';
  document.getElementById("rmodal-title").textContent="🔄 " + "🔄 Update prices".replace("🔄 ","").trim();
  document.getElementById("btn-apply").disabled=true;
  document.getElementById("ov-refresh").classList.add("open");

  // Construieste tabelul initial cu toate pozitiile
  var html='<div style="font-size:11px;color:var(--dim);margin-bottom:8px" id="refresh-summary">'+"Updating"+'...</div><div id="refresh-rows">';
  ST.pozitii.forEach(function(p){
    html+='<div id="rrow-'+p.id+'" class="rrow" style="opacity:0.4">'+
      '<span class="rrow-name">'+p.nume+'</span>'+
      '<span class="rrow-ticker" style="color:#4b5563">'+(p.ticker_stooq||"—")+'</span>'+
      '<span class="rrow-old">'+p.pret+' '+p.moneda+'</span>'+
      '<span class="rrow-arrow">→</span>'+
      '<span class="rrow-new" id="rnew-'+p.id+'"><span class="spin" style="width:10px;height:10px;border-width:1.5px"></span></span>'+
      '<span class="rrow-status" id="rst-'+p.id+'"></span></div>';
  });
  html+='</div>';
  document.getElementById("rmodal-body").innerHTML=html;
  _refreshDate={rezultate:[],cursuri_live:{}};

  var source=new EventSource("/api/refresh-prices/stream");
  var nOk=0;

  source.onmessage=function(e){
    var d=JSON.parse(e.data);
    if(d.type==="progress"){
      var rowEl=document.getElementById("rrow-"+d.id);
      var newEl=document.getElementById("rnew-"+d.id);
      var stEl =document.getElementById("rst-"+d.id);
      if(rowEl) rowEl.style.opacity="1";
      if(d.status==="ok"){
        nOk++;
        var diff=d.pret_nou-d.pret_vechi, pct=d.pret_vechi>0?diff/d.pret_vechi*100:0;
        var col=diff>=0?"#22c55e":"#ef4444";
        var srcBadge = d.source_cached?"⚡":"🔍"; // ⚡ = din cache, 🔍 = redescoperit
        if(newEl) newEl.innerHTML='<span style="color:'+col+'">'+d.pret_nou+'</span><span style="font-size:9px;margin-left:4px;color:#4b5563" title="'+(d.source_used||"")+'">'+srcBadge+'</span>';
        if(stEl)  stEl.innerHTML ='<span style="color:'+col+'">'+(diff>=0?"+":"")+pct.toFixed(1)+'%</span>';
        var poz=ST.pozitii.find(function(p){return p.id===d.id});
        if(poz) poz.pret=d.pret_nou;
      } else if(d.status==="manual"){
        if(newEl) newEl.innerHTML='<span style="color:var(--dim)">—</span>';
        if(stEl)  stEl.innerHTML ='<span style="color:var(--dim)">'+"manual"+'</span>';
      } else {
        if(newEl) newEl.innerHTML='<span style="color:#ef4444">✗</span>';
        if(stEl)  stEl.innerHTML ='<span style="color:#ef4444;font-size:9px">'+(d.mesaj||"").substring(0,40)+'</span>';
      }
      _refreshDate.rezultate.push(d);
      var sm=document.getElementById("refresh-summary");
      if(sm) sm.textContent="Updating"+" "+(d.index+1)+"/"+d.total+" — "+d.nume+"...";
    }
    if(d.type==="done"){
      source.close();
      _refreshDate.cursuri_live=d.cursuri_live||{};
      var fx=d.cursuri_live||{};
      var sm=document.getElementById("refresh-summary");
      if(sm){sm.textContent="✓ "+nOk+" "+"prices updated"+(!fx.error?" · EUR/USD "+fx.USD+" · EUR/RON "+fx.RON:"");sm.style.color="#22c55e";}
      if(fx&&!fx.error&&fx.USD&&fx.RON){
        ST.cursuri.USD=fx.USD;ST.cursuri.RON=fx.RON;
        document.getElementById("r-usd").value=fx.USD;
        document.getElementById("r-ron").value=fx.RON;
      }
      document.getElementById("btn-apply").disabled=false;
      btn.disabled=false;btn.innerHTML="🔄 Update prices";
      // Save last update timestamp
      var now = new Date();
      var ts = now.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+
               now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
      localStorage.setItem("pm_last_update", ts);
      var lbl = document.getElementById("last-update-label");
      if(lbl) lbl.textContent = "Last: "+ts;
      renderSB();genChart();
      // Reload snapshots in Evolution tab
      setTimeout(function(){
        if(typeof window._evoReloadFn === "function") window._evoReloadFn();
      }, 500);
    }
  };
  source.onerror=function(){
    source.close();
    btn.disabled=false;btn.innerHTML="🔄 Update prices";
    document.getElementById("btn-apply").disabled=false;
  };
}

function applyRefresh(){ closeRefresh(); renderSB(); genChart(); showToast("✓ "+"prices updated"); }


async function manualDriveSync(){
  var b=document.getElementById("drive-badge");var orig=b.textContent;
  b.textContent="☁ ...";
  try{
    var r=await fetch("/api/drive/sync",{method:"POST"});
    var d=await r.json();
    if(d.status) _driveStatus=d.status;
    updateDriveBadge();
    if(d.ok){
      showToast("☁ "+d.mesaj);
      var fresh=await fetch("/api/data").then(function(r){return r.json()});
      ST=fresh;
      if(!ST.tranzactii) ST.tranzactii=[];
      if(!ST.snapshots)  ST.snapshots=[];
      document.getElementById("r-usd").value=ST.cursuri.USD;
      document.getElementById("r-ron").value=ST.cursuri.RON;
      renderSB();genChart();
    } else {
      showToast("☁ "+(d.mesaj||"Sync failed"));
      // Arata diagnosticul daca e eroare de autentificare
      if(d.mesaj && (d.mesaj.indexOf("missing")!==-1||d.mesaj.indexOf("Error")!==-1||d.mesaj.indexOf("invalid")!==-1)){
        setTimeout(function(){
          if(confirm("A Drive error occurred.\nWould you like to see the full diagnostic?")){
            showDriveDiagnose();
          }
        },500);
      }
    }
  }catch(e){b.textContent=orig;showToast("☁ Drive connection error: "+e.message);}
}

checkDriveStatus();
setInterval(checkDriveStatus,30000);


/* ════════════════════════════════════════════════
   SELL POSITION
════════════════════════════════════════════════ */
var _sellPozId = null;

function ovSellCk(e){if(e.target===document.getElementById("ov-sell"))closeSellModal()}
function closeSellModal(){document.getElementById("ov-sell").classList.remove("open")}

function openSellModal(id){
  _sellPozId = id;
  var p = ST.pozitii.find(function(x){return x.id===id});
  if(!p) return;
  document.getElementById("sell-title").textContent = "💸 Sell — " + p.nume;
  document.getElementById("sell-qty").value = "";
  document.getElementById("sell-qty").placeholder = "max: " + p.cantitate;
  document.getElementById("sell-price").value = p.pret;
  document.getElementById("sell-currency").textContent = p.moneda;
  document.getElementById("sell-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("sell-preview").style.display = "none";
  document.getElementById("sell-cash-note").textContent = "";
  document.getElementById("ov-sell").classList.add("open");
  setTimeout(function(){document.getElementById("sell-qty").focus()}, 150);
  updateSellPreview();
}

function updateSellPreview(){
  var p = ST.pozitii.find(function(x){return x.id===_sellPozId});
  if(!p) return;
  var qty   = parseFloat(document.getElementById("sell-qty").value);
  var price = parseFloat(document.getElementById("sell-price").value);
  if(isNaN(qty)||isNaN(price)||qty<=0||price<=0){
    document.getElementById("sell-preview").style.display="none";
    return;
  }
  var proceeds = qty * price;
  var cost     = qty * (p.pret_mediu||p.pret);
  var pnl      = proceeds - cost;
  var pct      = cost>0 ? pnl/cost*100 : 0;
  var fmt = function(n){ return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n)+" "+p.moneda; };
  document.getElementById("sell-prev-proceeds").textContent = fmt(proceeds);
  document.getElementById("sell-prev-cost").textContent     = fmt(cost);
  document.getElementById("sell-prev-pnl").textContent      = (pnl>=0?"+":"")+fmt(pnl);
  document.getElementById("sell-prev-pnl").style.color      = pnl>=0?"#22c55e":"#ef4444";
  document.getElementById("sell-prev-pct").textContent      = (pct>=0?"+":"")+pct.toFixed(1).replace(".",",")+"%";
  document.getElementById("sell-prev-pct").style.color      = pct>=0?"#22c55e":"#ef4444";
  document.getElementById("sell-preview").style.display     = "flex";
  document.getElementById("sell-cash-note").textContent     =
    "✓ " + new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(proceeds) +
    " " + p.moneda + " will be added to Cash " + p.moneda;
}

function confirmSell(){
  var p = ST.pozitii.find(function(x){return x.id===_sellPozId});
  if(!p) return;
  var qty   = parseFloat(document.getElementById("sell-qty").value);
  var price = parseFloat(document.getElementById("sell-price").value);
  var data  = document.getElementById("sell-date").value;
  if(isNaN(qty)||qty<=0)   {alert("Enter the quantity to sell!");return}
  if(isNaN(price)||price<=0){alert("Enter the sale price!");return}
  if(qty > p.cantitate)    {alert("You can't sell more than you own ("+p.cantitate+")!");return}

  var proceeds = qty * price;
  var cost     = qty * (p.pret_mediu||p.pret);
  var pnl      = proceeds - cost;
  var pct      = cost>0 ? pnl/cost*100 : 0;

  // 1. Adauga in Cash
  addToCash(p.moneda, proceeds);

  // 2. Inregistreaza tranzactia
  addTranzactie({
    id:           Date.now(),
    tip:          "vanzare",
    data:         data || new Date().toISOString().split("T")[0],
    pozitie_id:   p.id,
    pozitie_nume: p.nume,
    cantitate:    qty,
    pret_vanzare: price,
    pret_mediu:   p.pret_mediu || p.pret,
    moneda:       p.moneda,
    categorie:    p.categorie,
    regiune:      p.regiune,
    profit:       +pnl.toFixed(4),
    pct:          +pct.toFixed(2)
  });

  // 3. Reduce/elimina pozitia
  var ramas = +(p.cantitate - qty).toFixed(6);
  if(ramas <= 0.000001){
    ST.pozitii = ST.pozitii.filter(function(x){return x.id!==p.id});
    showToast("💸 "+p.nume+" fully sold → +"+ new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(proceeds)+" "+p.moneda+" to Cash");
  } else {
    p.cantitate = ramas;
    showToast("💸 "+qty+" "+p.nume+" sold → +"+ new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(proceeds)+" "+p.moneda+" to Cash");
  }

  closeSellModal();
  renderSB();
  genChart();
}


/* ════════════════════════════════════════════════
   HELPERS: CASH & TRANZACTII
════════════════════════════════════════════════ */
function getCashPos(moneda){
  return ST.pozitii.find(function(p){
    return p.categorie==="Cash" && p.moneda===moneda;
  });
}
function addToCash(moneda, suma){
  var cp = getCashPos(moneda);
  if(cp){
    cp.pret = +(cp.pret + suma).toFixed(4);
    cp.pret_mediu = cp.pret;
  } else {
    ST.pozitii.push({id:ST.next_id++,nume:"Cash "+moneda,categorie:"Cash",
      regiune:moneda==="RON"?"Romania":"World",cantitate:1,
      pret:+suma.toFixed(4),pret_mediu:+suma.toFixed(4),
      moneda:moneda,ticker_stooq:"",dividende:[]});
  }
}
function addTranzactie(t){
  if(!ST.tranzactii) ST.tranzactii=[];
  ST.tranzactii.unshift(t);
}


/* ════════════════════════════════════════════════
   BUY SHARES
════════════════════════════════════════════════ */
var _buyPozId = null;

function ovBuyCk(e){if(e.target===document.getElementById("ov-buy"))closeBuyModal()}
function closeBuyModal(){document.getElementById("ov-buy").classList.remove("open")}

function openBuyModal(id){
  _buyPozId = id;
  var p = ST.pozitii.find(function(x){return x.id===id});
  if(!p) return;
  document.getElementById("buy-title").textContent = "🛒 Buy — " + p.nume;
  document.getElementById("buy-qty").value = "";
  document.getElementById("buy-price").value = p.pret;
  document.getElementById("buy-currency").textContent = p.moneda;
  document.getElementById("buy-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("buy-preview").style.display = "none";
  document.getElementById("buy-cash-warn").style.display = "none";
  // Afiseaza cash available
  var cp = getCashPos(p.moneda);
  var avail = cp ? cp.pret : 0;
  document.getElementById("buy-cash-avail").textContent =
    cp ? "(available: "+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(avail)+" "+p.moneda+")" : "(no Cash Cash "+p.moneda+")";
  document.getElementById("ov-buy").classList.add("open");
  setTimeout(function(){document.getElementById("buy-qty").focus()},150);
  updateBuyPreview();
}

function updateBuyPreview(){
  var p = ST.pozitii.find(function(x){return x.id===_buyPozId});
  if(!p) return;
  var qty   = parseFloat(document.getElementById("buy-qty").value);
  var price = parseFloat(document.getElementById("buy-price").value);
  if(isNaN(qty)||isNaN(price)||qty<=0||price<=0){
    document.getElementById("buy-preview").style.display="none";
    return;
  }
  var cost   = qty * price;
  var newQty = p.cantitate + qty;
  var newAvg = (p.cantitate * (p.pret_mediu||p.pret) + qty * price) / newQty;
  var fmt = function(n){return new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(n)+" "+p.moneda};
  document.getElementById("buy-prev-cost").textContent = fmt(cost);
  document.getElementById("buy-prev-avg").textContent  = fmt(newAvg);
  document.getElementById("buy-prev-qty").textContent  = new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(newQty);
  document.getElementById("buy-preview").style.display = "flex";
  // Verifica cash suficient
  var cp = getCashPos(p.moneda);
  var avail = cp ? cp.pret : 0;
  var fromCash = document.getElementById("buy-from-cash").checked;
  document.getElementById("buy-cash-warn").style.display = (fromCash && cost > avail) ? "block" : "none";
}

function confirmBuy(){
  var p = ST.pozitii.find(function(x){return x.id===_buyPozId});
  if(!p) return;
  var qty   = parseFloat(document.getElementById("buy-qty").value);
  var price = parseFloat(document.getElementById("buy-price").value);
  if(isNaN(qty)||qty<=0)    {alert("Enter the quantity to buy!");return}
  if(isNaN(price)||price<=0){alert("Enter the purchase price!");return}
  var fromCash = document.getElementById("buy-from-cash").checked;
  var cost     = qty * price;
  var cp       = getCashPos(p.moneda);
  if(fromCash){
    var available = cp ? cp.pret : 0;
    if(available < cost){
      // BLOCARE — nu permite achizitia daca cash insuficient
      var fmt = function(n){return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n)};
      alert("❌ Insufficient cash!\n\n" +
            "Purchase cost:  " + fmt(cost) + " " + p.moneda + "\n" +
            "Cash available: " + fmt(available) + " " + p.moneda + "\n\n" +
            "Add funds to Cash " + p.moneda + " or uncheck the option \"Deduct from Cash\".");
      return;
    }
  }
  // Actualizeaza pretul mediu (medie ponderata)
  var newQty = +(p.cantitate + qty).toFixed(6);
  var newAvg = +((p.cantitate*(p.pret_mediu||p.pret) + qty*price) / newQty).toFixed(4);
  p.cantitate  = newQty;
  p.pret_mediu = newAvg;
  p.pret       = price;  // actualizeaza si pretul curent
  // Deduce din cash
  if(fromCash) addToCash(p.moneda, -cost);
  closeBuyModal();
  renderSB();
  genChart();
  showToast("🛒 "+qty+" "+p.nume+" purchased"+(fromCash?" · -"+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(cost)+" "+p.moneda+" from Cash":"")+" · New avg. price: "+newAvg+" "+p.moneda);
}


/* ════════════════════════════════════════════════════
   SISTEM TRADUCERI RO / EN
════════════════════════════════════════════════════ */
var _lang = localStorage.getItem("pm_lang") || "ro";

var T = {
  ro: {
    save:"Save", updatePrices:"🔄 Update prices",
    add:"＋ Add", edit:"Edit", delete:"Delete",
    cancel:"Cancel", close:"Close", confirm:"Confirm",
    positions:"Positions", allocation:"📊 Alocare",
    pnl:"📈 Profit / Pierdere", evolution:"📉 Evolution",
    totalValue:"TOTAL VALUE", positions_count:"positions",
    exchangeRates:"Exchange rates",
    addPosition:"Add new position", editPosition:"Edit position",
    ticker:"Ticker / Name", category:"Category", quantity:"Cantitate",
    currentPrice:"Current price", avgPrice:"Avg. purchase price",
    currency:"Currency", region:"Region", stooqTicker:"Stooq Ticker",
    deductCash:"Deduct acquisition cost from Cash",
    dividends:"Dividends", sell:"💸 Sell", buy:"🛒 Buy",
    buyMore:"🛒 Buy more", sellPos:"💸 Sale",
    priceUpdated:"prices updatede",
    updating:"Updating", done:"Gata",
    manual:"manual", noTicker:"No ticker",
    cashBalance:"Cash Balance", addFunds:"＋ Add fonduri",
    removeFunds:"— Withdraw funds", currentBalance:"Current balance",
    newBalance:"New balance",
    world:"World", romania:"Romania",
    totalPnl:"P&L TOTAL (excl. cash)",
    realizedPnl:"💸 Realized Gains / Losses",
    transactions:"transactions",
    totalAlloc:"VISUAL ALLOCATION", visualAlloc:"Visual allocation",
    perRegion:"ALLOCATION BY REGION",
    saveInDrive:"Save to Google Drive?",
    savedLocal:"Date salvate local.",
    driveYes:"☁ Yes, save to Drive",
    driveNo:"No, local only",
    evolPortfolio:"PORTFOLIO EVOLUTION",
    firstSnapshot:"vs first snapshot",
    addManual:"＋ Add manual",
    history:"📋 History",
    deleteSnapshot:"Delete snapshot from",
    cantUndo:"This action cannot be undone.",
    dateField:"Date", totalField:"Total value (€)",
    addBtn:"Add",
  },
  en: {
    save:"Save", updatePrices:"🔄 Update prices",
    add:"＋ Add", edit:"Edit", delete:"Delete",
    cancel:"Cancel", close:"Close", confirm:"Confirm",
    positions:"Positions", allocation:"📊 Allocation",
    pnl:"📈 Profit / Loss", evolution:"📉 Evolution",
    totalValue:"TOTAL VALUE", positions_count:"positions",
    exchangeRates:"Exchange rates",
    addPosition:"Add new position", editPosition:"Edit position",
    ticker:"Ticker / Name", category:"Category", quantity:"Quantity",
    currentPrice:"Current price", avgPrice:"Avg. purchase price",
    currency:"Currency", region:"Region", stooqTicker:"Stooq Ticker",
    deductCash:"Deduct acquisition cost from Cash",
    dividends:"Dividends", sell:"💸 Sell", buy:"🛒 Buy",
    buyMore:"🛒 Buy more", sellPos:"💸 Sale",
    priceUpdated:"prices updated",
    updating:"Updating", done:"Done",
    manual:"manual", noTicker:"No ticker",
    cashBalance:"Cash Balance", addFunds:"＋ Add funds",
    removeFunds:"— Withdraw funds", currentBalance:"Current balance",
    newBalance:"New balance",
    world:"World", romania:"Romania",
    totalPnl:"TOTAL P&L (excl. cash)",
    realizedPnl:"💸 Realized Gains / Losses",
    transactions:"transactions",
    totalAlloc:"VISUAL ALLOCATION", visualAlloc:"Visual allocation",
    perRegion:"ALLOCATION BY REGION",
    saveInDrive:"Save to Google Drive?",
    savedLocal:"Date saved locally.",
    driveYes:"☁ Yes, save to Drive",
    driveNo:"No, local only",
    evolPortfolio:"PORTFOLIO EVOLUTION",
    firstSnapshot:"vs first snapshot",
    addManual:"＋ Add manually",
    history:"📋 History",
    deleteSnapshot:"Delete snapshot from",
    cantUndo:"This action cannot be undone.",
    dateField:"Date", totalField:"Total value (€)",
    addBtn:"Add",
  }
};

function t(key){ return (T[_lang]||T.ro)[key] || key; }

function toggleLang(){
  _lang = _lang==="ro" ? "en" : "ro";
  localStorage.setItem("pm_lang", _lang);
  renderSB();
  genChart();
}

function applyLang(){
  var btn = document.getElementById("lang-btn");
  if(btn) btn.textContent = _lang==="ro" ? "🇬🇧 EN" : "🇷🇴 RO";
  // Update static DOM elements
  var map = {
    "btn-save":     "Save",
    "btn-refresh":  "🔄 Update prices",
    "tab-alloc":    "📊 Allocation",
    "tab-pnl":      "📈 Profit / Loss",
    "tab-evo":      "📉 Evolution",
    "sb-add-btn":   "＋ Add",
    "sb-title":     "Positions",
    "rates-title":  "Exchange rates",
  };
  for(var id in map){
    var el = document.getElementById(id);
    if(el) el.textContent = map[id];
  }
}


/* ════════ CASH MODAL ════════ */
var _cashPozId = null, _cashDir = 1;

function closeCashModal(){ document.getElementById("ov-cash").classList.remove("open"); }

function openCashModal(id, dir){
  _cashPozId=id; _cashDir=dir;
  var p=ST.pozitii.find(function(x){return x.id===id}); if(!p) return;
  document.getElementById("cash-title").textContent = "💵 "+p.nume;
  document.getElementById("cash-balance-label").textContent = "Current balance";
  document.getElementById("cash-balance-val").textContent =
    new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(p.pret)+" "+p.moneda;
  document.getElementById("cash-amount-label").textContent = dir>0?"Add funds":"Withdraw funds";
  document.getElementById("cash-amount").value="";
  document.getElementById("cash-preview").style.display="none";
  document.getElementById("cash-date").value=new Date().toISOString().split("T")[0];
  document.getElementById("cash-confirm-btn").style.background=dir>0?"#22c55e":"#ef4444";
  document.getElementById("cash-confirm-btn").style.color="#000";
  document.getElementById("ov-cash").classList.add("open");
  setTimeout(function(){document.getElementById("cash-amount").focus()},150);
}

function updateCashPreview(){
  var p=ST.pozitii.find(function(x){return x.id===_cashPozId}); if(!p) return;
  var amt=parseFloat(document.getElementById("cash-amount").value);
  if(isNaN(amt)||amt<=0){document.getElementById("cash-preview").style.display="none";return;}
  var newBal=p.pret+(_cashDir*amt);
  var fmt=function(n){return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n)+" "+p.moneda};
  document.getElementById("cash-new-val").textContent=fmt(newBal);
  document.getElementById("cash-preview").style.display="block";
}

function confirmCash(){
  var p=ST.pozitii.find(function(x){return x.id===_cashPozId}); if(!p) return;
  var amt=parseFloat(document.getElementById("cash-amount").value);
  if(isNaN(amt)||amt<=0){alert("Enter the amount!");return;}
  var newBal=p.pret+(_cashDir*amt);
  if(newBal<0){if(!confirm("Balance will go negative. Continue?"))return;}
  p.pret=+newBal.toFixed(4); p.pret_mediu=p.pret;
  closeCashModal(); renderSB(); genChart();
  showToast("💵 "+p.nume+": "+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(newBal)+" "+p.moneda);
}


/* ════════════ DIVIDENDE ════════════ */
var _divPozId = null;

function ovDivCk(e){if(e.target===document.getElementById("ov-div"))closeDivModal()}
function closeDivModal(){document.getElementById("ov-div").classList.remove("open")}

function openDivModal(id){
  _divPozId=id;
  var p=ST.pozitii.find(function(x){return x.id===id}); if(!p) return;
  document.getElementById("dmodal-title").textContent="💰 "+"Dividends"+" — "+p.nume;
  renderDivBody(p);
  document.getElementById("ov-div").classList.add("open");
}

function renderDivBody(p){
  var divs=p.dividende||[];
  var cur=ST.cursuri;
  function toEurD(v,m){return v/(cur[m]||1)}
  var totalEur=divs.reduce(function(s,d){return s+toEurD(d.valoare||0,d.moneda||"EUR")},0);
  var html='<div class="div-sum">';
  html+='<div class="div-sum-item"><div class="div-sum-label">Total EUR</div><div class="div-sum-val">'+
    new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(totalEur)+" €</div></div>";
  html+='<div class="div-sum-item"><div class="div-sum-label">No. payments</div>'+
    '<div class="div-sum-val" style="font-size:13px">'+divs.length+'</div></div>';
  html+='</div>';
  if(divs.length===0){
    html+='<div style="color:var(--dim);font-size:12px;padding:8px 0">No dividends recorded.</div>';
  } else {
    html+='<div style="font-size:10px;color:var(--dim);margin-bottom:6px;display:flex">'+
      '<span style="flex:1">Date</span><span style="width:100px;text-align:right">Amount</span>'+
      '<span style="width:50px;text-align:center">Currency</span><span style="width:30px"></span></div>';
    divs.forEach(function(d,i){
      html+='<div class="div-row">'+
        '<span style="flex:1;font-size:12px;color:#9ca3af">'+(d.data||"—")+'</span>'+
        '<span style="width:100px;text-align:right;font-family:Georgia,serif;font-size:13px;color:#4ade80">'+
          new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(d.valoare||0)+'</span>'+
        '<span style="width:50px;text-align:center;font-size:11px;color:var(--dim)">'+d.moneda+'</span>'+
        '<button class="btn-del-div" onclick="delDiv('+i+')">🗑</button></div>';
    });
  }
  html+='<div class="div-add-row" style="margin-top:12px">'+
    '<div><label style="font-size:10px;color:var(--dim);display:block;margin-bottom:3px">Payment date</label>'+
    '<input class="fi" id="d-data" type="date" style="font-size:13px;padding:6px 8px"/></div>'+
    '<div><label style="font-size:10px;color:var(--dim);display:block;margin-bottom:3px">Amount</label>'+
    '<input class="fi" id="d-val" type="number" step="any" placeholder="ex: 45.20" style="font-size:13px;padding:6px 8px"/></div>'+
    '<div><label style="font-size:10px;color:var(--dim);display:block;margin-bottom:3px">Currency</label>'+
    '<select class="fs" id="d-mon" style="font-size:13px;padding:6px 8px">'+
      '<option value="EUR">EUR</option><option value="USD">USD</option><option value="RON">RON</option>'+
    '</select></div>'+
    '<div style="display:flex;align-items:flex-end"><button class="btn-div" onclick="addDiv()">＋ Add</button></div>'+
    '</div>'+
    '<div style="margin-top:6px;display:flex;align-items:center;gap:6px">'+
    '<input type="checkbox" id="d-addcash" checked style="accent-color:#22c55e"/>'+
    '<label for="d-addcash" style="font-size:11px;color:#9ca3af;cursor:pointer">'+
    'Auto-add to Cash '+(p.moneda||'')+'</label></div>';
  document.getElementById("dmodal-body").innerHTML=html;
  var p2=ST.pozitii.find(function(x){return x.id===_divPozId});
  if(p2&&document.getElementById("d-mon")) document.getElementById("d-mon").value=p2.moneda||"EUR";
  if(document.getElementById("d-data")) document.getElementById("d-data").value=new Date().toISOString().split("T")[0];
}

function addDiv(){
  var p=ST.pozitii.find(function(x){return x.id===_divPozId}); if(!p) return;
  var data=document.getElementById("d-data").value;
  var val=parseFloat(document.getElementById("d-val").value);
  var mon=document.getElementById("d-mon").value;
  var addCash=document.getElementById("d-addcash")&&document.getElementById("d-addcash").checked;
  if(!data||isNaN(val)||val<=0){alert("Fill in the date and amount!");return}
  if(!p.dividende) p.dividende=[];
  p.dividende.push({data:data,valoare:val,moneda:mon});
  p.dividende.sort(function(a,b){return a.data.localeCompare(b.data)});
  if(addCash){addToCash(mon,val);showToast("Dividend added ✓ + "+val+" "+mon+" → Cash");}
  else showToast("Dividend added ✓");
  renderDivBody(p); renderSB(); genChart();
}

function delDiv(idx){
  var p=ST.pozitii.find(function(x){return x.id===_divPozId}); if(!p||!p.dividende) return;
  if(!confirm("Delete dividend from "+p.dividende[idx].data+"?")) return;
  p.dividende.splice(idx,1); renderDivBody(p); showToast("Dividend deleted"); genChart();
}

/* ════════════ DRIVE STATUS ════════════ */
var _driveStatus={enabled:false,connected:false,last_sync:null,error:null};

async function checkDriveStatus(){
  try{var r=await fetch("/api/drive/status");_driveStatus=await r.json();updateDriveBadge();}catch(e){}
}

function updateDriveBadge(){
  var b=document.getElementById("drive-badge"); if(!b) return;
  var s=_driveStatus;
  if(!s.enabled){b.className="drive-badge drive-off";b.textContent="☁ Drive";
    b.title="Google Drive neconfigurat — add credentials.json next to .exe";}
  else if(s.error){b.className="drive-badge drive-err";b.textContent="☁ Eroare";
    b.title="Error: "+s.error;}
  else if(s.last_sync){b.className="drive-badge drive-on";
    b.textContent="☁ "+s.last_sync;b.title="Synced at "+s.last_sync;}
  else{b.className="drive-badge drive-off";b.textContent="☁ ...";b.title="Connecting...";}
}


/* ════════ TEST TICKER ════════ */
async function testTicker(){
  var ticker  = (document.getElementById("fty")||{}).value;
  var regiune = (document.getElementById("frg")||{}).value || "World";
  if(!ticker||!ticker.trim()){alert("Please enter a Stooq ticker first!");return}
  var btn = document.querySelector(".btn-test");
  var res = document.getElementById("ticker-result");
  if(btn){ btn.disabled=true; btn.textContent="⏳"; }
  if(res){
    res.className = "ticker-result";
    res.style.display = "block";
    res.style.color = "#6b7280";
    res.style.background = "transparent";
    res.style.border = "none";
    res.textContent = "Testing " + ticker.trim() + "...";
  }
  try{
    var r = await fetch("/api/test-ticker", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ticker: ticker.trim(), regiune: regiune})
    });
    var d = await r.json();
    if(res){
      res.style.display = "block";
      if(d.pret !== null && d.pret !== undefined){
        res.className = "ticker-result ok";
        res.style.color = ""; res.style.background = ""; res.style.border = "";
        var src_icon = d.source_key==="stooq"?"📊":d.source_key==="yahoo"?"🌐":d.source_key==="bvb"?"🏦":"✓";
        res.textContent = src_icon + " " + d.pret + " " + (d.moneda||"") + " — " + (d.sursa||"");
      } else {
        res.className = "ticker-result err";
        res.style.color = ""; res.style.background = ""; res.style.border = "";
        res.textContent = "✗ " + (d.eroare || "Ticker not found — ex: brkb.us · snp.ro");
      }
    }
  } catch(e){
    if(res){
      res.style.display = "block";
      res.className = "ticker-result err";
      res.style.color = ""; res.style.background = ""; res.style.border = "";
      res.textContent = "✗ Error: " + e.message;
    }
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "▶ Test"; }
  }
}


/* ════════ CASH SPECIAL FORM ════════ */
function onCategoryChange(){
  var cat = document.getElementById("fc").value;
  var isCash = (cat === "Cash");
  // Ascunde/afiseaza grupuri de campuri
  var qtyRow   = document.getElementById("row-qty-money");
  var pretRow  = document.getElementById("row-pret-pmed");
  var tickerRow= document.getElementById("row-ticker");
  var cashDiv  = document.getElementById("add-cash-div");
  var cashInfo = document.getElementById("cash-form-info");
  // row-qty = doar cantitatea (moneda ramane vizibila mereu)
  var qtyEl = document.getElementById("row-qty");
  if(qtyEl)     qtyEl.style.display    = isCash ? "none" : "";
  if(tickerRow) tickerRow.style.display = isCash ? "none" : "";
  if(cashDiv)   cashDiv.style.display  = isCash ? "none" : (editId?"none":"flex");
  if(cashInfo){ cashInfo.style.display = isCash ? "block" : "none";
    if(isCash){ cashInfo.style.background="#0d2818"; cashInfo.style.borderColor="#166534";
      cashInfo.innerHTML='💵 <strong>Cash Position</strong><br><span style="font-size:12px;color:#9ca3af">Enter the amount in the <em>Initial balance</em> field and choose currency.<br>Quantity is automatically set to 1.</span>';
    }
  }
  var lpret  = document.getElementById("label-pret");
  var pmedRow= document.getElementById("row-pmed");
  if(lpret)   lpret.textContent = isCash ? "Initial balance" : "Current price";
  if(pmedRow) pmedRow.style.display = isCash ? "none" : "";
}

function validateCashDuplicate(moneda, regiune, editId){
  // Verifica daca exista deja o pozitie Cash cu aceeasi moneda+regiune
  var exists = ST.pozitii.find(function(p){
    return p.categorie === "Cash" &&
           p.moneda === moneda &&
           p.regiune === regiune &&
           p.id !== editId;
  });
  return exists || null;
}
