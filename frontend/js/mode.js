/* Portfolio Manager — Startup portfolio chooser (demo / real) */

var _appMode = null;          // "demo" | "real" once chosen
var DRIVE_WAIT_MS = 60000;    // give up waiting for Google after this and open local data

function _lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function _lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

async function showModeChooser(canCancel){
  var ov = document.getElementById("ov-mode");
  ov.classList.add("open");
  document.getElementById("mode-cancel").hidden = !canCancel || !_appMode;
  setModeBusy(null);

  var last = _appMode || _lsGet("pm_mode");
  ["demo","real"].forEach(function(m){
    document.getElementById("mode-card-"+m).classList.toggle("last", m===last);
  });

  var sDemo = document.getElementById("mode-s-demo"), sReal = document.getElementById("mode-s-real");
  sDemo.textContent = ""; sReal.textContent = ""; sReal.className = "mode-s";
  try{
    var info = await (await fetch("/api/mode")).json();
    sDemo.textContent = info.demo_exists ? "Your saved demo · changes are kept locally" : "Fresh sample data";
    if(info.drive_configured){
      sReal.textContent = "☁ Google Drive configured" + (info.real_exists ? "" : " · no local copy yet");
      sReal.className = "mode-s ok";
    } else {
      sReal.textContent = "⚠ Google Drive not configured (credentials.json missing) — local file only";
      sReal.className = "mode-s warn";
    }
  }catch(e){}
}

function closeModeChooser(){
  if(!_appMode) return;   // the first choice is mandatory
  document.getElementById("ov-mode").classList.remove("open");
}

function setModeBusy(text){
  var busy = document.getElementById("mode-busy");
  busy.hidden = !text;
  document.getElementById("mode-busy-txt").textContent = text || "";
  ["demo","real"].forEach(function(m){ document.getElementById("mode-card-"+m).disabled = !!text; });
}

async function chooseMode(m){
  setModeBusy(m==="real" ? "Connecting to Google Drive… (first time: sign in to Google in the browser window)" : "Opening demo portfolio…");

  var ctrl = ("AbortController" in window) ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, DRIVE_WAIT_MS) : null;
  var res = null, timedOut = false;
  try{
    var r = await fetch("/api/mode",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({mode:m}), signal: ctrl ? ctrl.signal : undefined});
    res = await r.json();
  }catch(e){
    timedOut = true;
  }
  if(timer) clearTimeout(timer);

  if(res && !res.ok){
    setModeBusy(null);
    showToast("Could not switch portfolio: "+(res.error||"error"));
    return;
  }

  _appMode = m;
  _lsSet("pm_mode", m);
  updateModePill();
  document.getElementById("ov-mode").classList.remove("open");
  setModeBusy(null);

  await init();
  if(typeof window._evoReloadFn === "function") window._evoReloadFn();
  checkDriveStatus();

  if(m==="demo") showToast("🎓 Demo portfolio — Google Drive is off");
  else if(timedOut) showToast("☁ Google Drive did not answer in time — showing local data");
  else if(res && res.drive && res.drive.uploads_blocked) showToast("⚠ Could not load your portfolio from Drive ("+(res.drive.error||"error")+"). Uploads are paused so nothing on Drive gets overwritten — use ☁ to retry.");
  else if(res && res.drive && !res.drive.ok) showToast("☁ Drive sync failed: "+(res.drive.error||"error")+" — showing local data");
  else if(res && res.drive && res.drive.ok) showToast("☁ My portfolio · synced with Google Drive");
  else showToast("My portfolio · local data");
}

function updateModePill(){
  var p = document.getElementById("mode-pill");
  if(!p) return;
  p.hidden = !_appMode;
  p.className = "mode-pill " + (_appMode || "");
  p.textContent = _appMode==="demo" ? "Demo" : "My portfolio";
}

async function resetDemo(){
  if(!confirm("Reset the demo portfolio to the original sample data?\nYour real portfolio is not affected.")) return;
  try{ await fetch("/api/mode/reset-demo",{method:"POST"}); }catch(e){}
  if(_appMode==="demo"){
    await init();
    if(typeof window._evoReloadFn === "function") window._evoReloadFn();
    document.getElementById("ov-mode").classList.remove("open");
  } else {
    showModeChooser(!!_appMode);
  }
  showToast("↺ Demo data reset");
}
