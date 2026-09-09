/* Portfolio Manager — Core functions */


function setTab(t){
  curTab=t;
  document.getElementById("tab-alloc").classList.toggle("on",t==="alloc");
  document.getElementById("tab-pnl").classList.toggle("on",t==="pnl");
  document.getElementById("tab-evo").classList.toggle("on",t==="evo");
  genChart();
}
function genChart(){
  if(typeof renderChart==="function") renderChart(JSON.parse(JSON.stringify(ST)),curTab);
  else showToast("Initializing chart…");
}
function onRate(){
  ST.cursuri.USD=parseFloat(document.getElementById("r-usd").value)||1.16;
  ST.cursuri.RON=parseFloat(document.getElementById("r-ron").value)||5.23;
  renderSB(); genChart();
}
function openModal(id){
  editId=id||null;
  document.getElementById("mt").textContent=id?"Edit position":"Add new position";
  if(id){
    var p=ST.pozitii.find(function(x){return x.id===id});
    document.getElementById("fn").value=p.nume;
    document.getElementById("fc").value=p.categorie;
    document.getElementById("fq").value=p.cantitate;
    document.getElementById("fp").value=p.pret;
    document.getElementById("fpm").value=p.pret_mediu||p.pret;
    document.getElementById("fty").value=p.ticker_stooq||"";
    document.getElementById("frg").value=p.regiune||"World";
    document.getElementById("frg").value=p.regiune||"World";
    document.getElementById("fm").value=p.moneda;
  } else {
    ["fn","fq","fp","fpm","fty"].forEach(function(i){document.getElementById(i).value=""});
    document.getElementById("frg").value="World";
    document.getElementById("fc").value="ETFs";
    document.getElementById("fm").value="EUR";
  }
  document.getElementById("ov").classList.add("open");
  /* Arata/ascunde checkbox cash in functie de add vs edit */
  var cashDiv=document.getElementById("add-cash-div");
  if(cashDiv) cashDiv.style.display = id ? "none" : "flex";
  var acf=document.getElementById("add-from-cash");
  if(acf){ acf.checked=false; }
  setTimeout(function(){document.getElementById("fn").focus()},150);
}
function closeModal(){document.getElementById("ov").classList.remove("open");editId=null}
function ovCk(e){/* click outside dezactivat pentru Add/Edit */}
function delPos(id){
  if(!confirm("Delete this position?"))return;
  ST.pozitii=ST.pozitii.filter(function(p){return p.id!==id});
  renderSB();genChart();showToast("Position deleted");
}
function savePos(){
  var n=document.getElementById("fn").value.trim();
  var c=document.getElementById("fc").value;
  var m=document.getElementById("fm").value;
  var rg=document.getElementById("frg").value;
  var isCash=(c==="Cash");

  // Cash: validare duplicat
  if(isCash && !editId){
    var dup = validateCashDuplicate(m, rg, null);
    if(dup){
      var info=document.getElementById("cash-form-info");
      if(info){
        info.style.display="block";
        info.style.background="#2d1515";
        info.style.borderColor="#dc2626";
        info.innerHTML='⚠️ <strong>Cash '+m+' / '+rg+' already exists</strong><br>'+
          '<span style="font-size:12px;color:#fca5a5">Use the <strong>＋</strong> / <strong>—</strong> buttons in the sidebar to modify the balance of <em>'+dup.nume+'</em>.</span>';
      } else {
        alert("Cash "+m+" / "+rg+" already exists.\nUse ＋ / — buttons in the sidebar.");
      }
      return;
    }
  }

  var q=isCash?1:parseFloat(document.getElementById("fq").value);
  var p=isCash?parseFloat(document.getElementById("fp").value||"0"):parseFloat(document.getElementById("fp").value);
  var pm=isCash?p:parseFloat(document.getElementById("fpm").value);
  if(!n){alert("Please fill in at least Numele!");return}
  if(!isCash&&(isNaN(q)||isNaN(p))){alert("Please fill in at least: Nume, Cantitate, Current price!");return}
  if(isCash&&isNaN(p)){p=0;}
  var ty=document.getElementById("fty").value.trim();
  var rg=document.getElementById("frg").value;
  if(isNaN(pm))pm=p;
  if(editId){
    Object.assign(ST.pozitii.find(function(x){return x.id===editId}),{nume:n,categorie:c,cantitate:q,pret:p,pret_mediu:pm,moneda:m,ticker_stooq:ty,regiune:rg});
    showToast(n+" updated");
  } else {
    ST.pozitii.push({id:ST.next_id++,nume:n,categorie:c,cantitate:q,pret:p,pret_mediu:pm,moneda:m,ticker_stooq:ty,regiune:rg});
    showToast(n+" added");
  }
  // Deduce din cash daca e bifat (doar la pozitii noi, nu la editare)
  if(!editId){
    var addCashChk = document.getElementById("add-from-cash");
    if(addCashChk && addCashChk.checked){
      var costAchiz = q*(isNaN(pm)?p:pm);
      var cpCheck = getCashPos(m);
      if(cpCheck && cpCheck.pret < costAchiz){
        alert("❌ Insufficient cash pentru deducere!\n\nCost: "+
          new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(costAchiz)+" "+m+"\n"+
          "Cash: "+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(cpCheck.pret)+" "+m+
          "\n\nPosition added without Cash deduction.");
      } else {
      addToCash(m, -costAchiz);
      showToast(n+" added · -"+new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(costAchiz)+" "+m+" from Cash");
      }
    }
  }
  closeModal();renderSB();genChart();
  // Auto-salvare in JSON dupa orice editare/adaugare pozitie
  // Fara asta, "Actualizeaza preturi" citeste tickerul vechi din fisier
  _autoSavePos();
}
async function _autoSavePos(){
  try{
    var snaps=[];
    try{var cur=await fetch("/api/data").then(function(r){return r.json()});snaps=cur.snapshots||[];}catch(e){}
    var payload=Object.assign({},ST,{snapshots:snaps});
    await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  }catch(e){}
}
async function saveDate(){
  // Preia snapshot-urile existente de pe server
  var snaps = [];
  try {
    var cur = await fetch("/api/data").then(function(r){return r.json()});
    snaps = cur.snapshots || [];
  } catch(e){}
  var payload = Object.assign({}, ST, {snapshots: snaps});

  // Salvare locala
  await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});

  // Daca Drive e configurat, intreaba daca salveaza si acolo
  if(_driveStatus && _driveStatus.enabled){
    showDriveSavePrompt();
  } else {
    showToast("Saved locally ✓");
  }
}

function showDriveSavePrompt(){
  document.getElementById("drive-save-modal").classList.add("open");
}

function closeDriveSavePrompt(){
  document.getElementById("drive-save-modal").classList.remove("open");
}

async function confirmDriveSave(){
  closeDriveSavePrompt();
  var b = document.getElementById("drive-badge");
  var orig = b ? b.textContent : "";
  if(b) b.textContent = "☁ ...";
  try{
    var r = await fetch("/api/drive/sync",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"upload"})});
    var d = await r.json();
    if(d.status) _driveStatus = d.status;
    updateDriveBadge();
    showToast(d.ok ? "Saved locally + ☁ Drive ✓" : ("Saved locally · Drive: "+(d.mesaj||"eroare")));
  }catch(e){
    if(b) b.textContent = orig;
    showToast("Saved locally ✓ · Drive inavailable");
  }
}
var _tt;
function showToast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");clearTimeout(_tt);_tt=setTimeout(function(){t.classList.remove("show")},2800)}
document.addEventListener("keydown",function(e){
  if(e.key==="Escape")closeModal();
  if(e.key==="Enter"&&document.getElementById("ov").classList.contains("open"))savePos();
});
