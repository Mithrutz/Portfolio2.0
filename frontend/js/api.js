/* Portfolio Manager — API & Data Helpers */

function getCashPos(moneda) {
  return ST.pozitii.find(function(p) {
    return p.categorie === "Cash" && p.moneda === moneda;
  });
}
function addToCash(moneda, suma) {
  var cp = getCashPos(moneda);
  if (cp) {
    cp.pret = +(cp.pret + suma).toFixed(4);
    cp.pret_mediu = cp.pret;
  } else {
    ST.pozitii.push({
      id: ST.next_id++, nume: "Cash " + moneda, categorie: "Cash",
      regiune: moneda === "RON" ? "Romania" : "World",
      cantitate: 1, pret: +suma.toFixed(4), pret_mediu: +suma.toFixed(4),
      moneda: moneda, ticker_stooq: "", dividende: []
    });
  }
}
function addTranzactie(t) {
  if (!ST.tranzactii) ST.tranzactii = [];
  ST.tranzactii.unshift(t);
}

async function _autoSavePos() {
  try {
    var snaps = [];
    try { var cur = await fetch("/api/data").then(function(r){return r.json()}); snaps = cur.snapshots || []; } catch(e){}
    var payload = Object.assign({}, ST, {snapshots: snaps});
    await fetch("/api/data", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
  } catch(e) {}
}

async function saveData() {
  var snaps = [];
  try { var cur = await fetch("/api/data").then(function(r){return r.json()}); snaps = cur.snapshots || []; } catch(e){}
  var payload = Object.assign({}, ST, {snapshots: snaps});
  await fetch("/api/data", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
  if (_driveStatus && _driveStatus.enabled) {
    showDriveSavePrompt();
  } else {
    showToast("Saved locally ✓");
  }
}
