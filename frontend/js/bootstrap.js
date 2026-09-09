/* Portfolio Manager — Bootstrap
 * Loaded LAST — after all components are defined.
 * Calls init() to start the app.
 */

// Restore last price update label from localStorage
(function() {
  var lu  = localStorage.getItem("pm_last_update");
  var lbl = document.getElementById("last-update-label");
  if (lu && lbl) lbl.textContent = "Last: " + lu;
})();

// Start Drive status polling
checkDriveStatus();
setInterval(checkDriveStatus, 30000);

// Initialize the app — fetches data and renders everything
init();
