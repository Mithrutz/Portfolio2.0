/* Portfolio Manager — Stock details window
 * Opened as /stock.html?pos=<id>  (from a portfolio position)
 *        or /stock.html?ticker=<SYMBOL>&name=<Name>  (free search)
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var searchInput = $("search-input"), suggestionsBox = $("suggestions");
  var recentList = $("recent-list"), statusEl = $("status");
  var chartCanvas = $("stock-chart"), tickerTitle = $("ticker-title"), lastPriceEl = $("last-price");
  var maInputs = $("ma-inputs"), maShortInput = $("ma-short-input"), maLongInput = $("ma-long-input");
  var infoPanel = $("info-panel");

  var chart = null, rsiChart = null, volumeChart = null;
  var currentTicker = null, currentName = null, currentPeriod = "3y";
  var recentTickers = [], lastData = null, lastInfo = null;
  var position = null;  // portfolio position, when opened from the sidebar
  var indicators = { price: true, avg: true, ma: false, rsi: false, volume: false };
  var debounceTimer = null;

  var GRID = "#1f2937", TICK = "#6b7280";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v, d) {
    if (v === null || v === undefined || isNaN(v)) return "N/A";
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  }
  function big(v) {
    if (!v) return "N/A";
    if (v >= 1e12) return (v / 1e12).toFixed(2) + " T";
    if (v >= 1e9) return (v / 1e9).toFixed(2) + " B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + " M";
    return num(v, 0);
  }
  function stat(label, value, cls) {
    return '<div class="st"><div class="l">' + esc(label) + '</div><div class="v ' + (cls || "") + '">' + value + "</div></div>";
  }

  // ── Search ────────────────────────────────────────────────────────────────
  searchInput.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    var q = searchInput.value.trim();
    if (q.length < 2) { suggestionsBox.style.display = "none"; return; }
    debounceTimer = setTimeout(function () { runSearch(q); }, 300);
  });
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") suggestionsBox.style.display = "none";
  });
  document.addEventListener("click", function (e) {
    if (!suggestionsBox.contains(e.target) && e.target !== searchInput) suggestionsBox.style.display = "none";
  });

  async function runSearch(q) {
    try {
      var data = await (await fetch("/api/stock/search?q=" + encodeURIComponent(q))).json();
      if (data.error || !data.length) {
        suggestionsBox.innerHTML = '<div class="sug">' + esc(data.error || "No results") + "</div>";
      } else {
        suggestionsBox.innerHTML = data.map(function (it) {
          return '<div class="sug" data-symbol="' + esc(it.symbol) + '" data-name="' + esc(it.name) + '">' +
            '<span class="sym">' + esc(it.symbol) + "</span>" +
            '<span class="nm">' + esc(it.name) + (it.exchange ? " · " + esc(it.exchange) : "") + (it.type ? " · " + esc(it.type) : "") + "</span></div>";
        }).join("");
        suggestionsBox.querySelectorAll(".sug[data-symbol]").forEach(function (el) {
          el.addEventListener("click", function () {
            searchInput.value = "";
            suggestionsBox.style.display = "none";
            loadTicker(el.getAttribute("data-symbol"), el.getAttribute("data-name"));
          });
        });
      }
      suggestionsBox.style.display = "block";
    } catch (err) {
      suggestionsBox.innerHTML = '<div class="sug">Search error</div>';
      suggestionsBox.style.display = "block";
    }
  }

  // ── Recent tickers ────────────────────────────────────────────────────────
  function renderRecent() {
    $("recent-wrap").style.display = recentTickers.length ? "" : "none";
    recentList.innerHTML = recentTickers.map(function (t) {
      return '<button class="chip' + (t.symbol === currentTicker ? " on" : "") + '" data-symbol="' + esc(t.symbol) +
        '" data-name="' + esc(t.name) + '" title="' + esc(t.name) + '">' + esc(t.symbol) + "</button>";
    }).join("");
    recentList.querySelectorAll(".chip").forEach(function (el) {
      el.addEventListener("click", function () { loadTicker(el.getAttribute("data-symbol"), el.getAttribute("data-name")); });
    });
  }
  async function loadRecent() {
    try {
      var data = await (await fetch("/api/stock/recent")).json();
      recentTickers = Array.isArray(data) ? data : [];
    } catch (err) { /* convenience only */ }
    renderRecent();
  }
  async function saveRecent(symbol, name) {
    try {
      await fetch("/api/stock/recent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, name: name || symbol }),
      });
    } catch (err) { /* not critical */ }
    loadRecent();
  }

  // ── Position card ─────────────────────────────────────────────────────────
  function renderPosition() {
    if (!position) return;
    var p = position;
    $("pos-card").hidden = false;
    $("pos-title").textContent = p.nume + " — my position";
    $("pos-tag").textContent = (p.categorie || "") + " · " + (p.regiune || "World");
    var cur = p.moneda || "";
    var value = p.cantitate * p.pret, cost = p.cantitate * p.pret_mediu;
    var pnl = value - cost, pnlPct = cost > 0 ? pnl / cost * 100 : 0;
    var divs = (p.dividende || []).reduce(function (s, d) { return s + (Number(d.valoare) || 0); }, 0);
    var cls = pnl >= 0 ? "pos" : "neg", sign = pnl >= 0 ? "+" : "";
    $("pos-stats").innerHTML =
      stat("Quantity", num(p.cantitate, p.cantitate % 1 ? 4 : 0)) +
      stat("Avg. purchase price", num(p.pret_mediu) + " " + esc(cur)) +
      stat("Last price (portfolio)", num(p.pret) + " " + esc(cur)) +
      stat("Market value", num(value) + " " + esc(cur)) +
      stat("Cost basis", num(cost) + " " + esc(cur)) +
      stat("Unrealized P&L", sign + num(pnl) + " " + esc(cur), cls) +
      stat("Return", sign + num(pnlPct) + "%", cls) +
      (divs ? stat("Dividends received", num(divs) + " " + esc(cur), "pos") : "");
  }

  // ── Load a ticker ─────────────────────────────────────────────────────────
  function destroyCharts() {
    [chart, rsiChart, volumeChart].forEach(function (c) { if (c) c.destroy(); });
    chart = rsiChart = volumeChart = null;
  }
  function setStatus(msg, isErr) {
    statusEl.style.display = msg ? "flex" : "none";
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("err", !!isErr);
    chartCanvas.style.visibility = msg ? "hidden" : "visible";
  }

  function avgLineAvailable() {
    // Only meaningful when the chart is for the position's own ticker and in the same currency
    return !!(position && position.pret_mediu && lastInfo && lastInfo.currency &&
      lastInfo.currency.toUpperCase() === (position.moneda || "").toUpperCase() &&
      currentTicker === position._yahoo);
  }

  async function loadTicker(symbol, name) {
    currentTicker = symbol;
    currentName = name;
    lastInfo = null;
    syncAvgButton();
    document.title = symbol + " · Stock Details";
    tickerTitle.textContent = symbol + (name && name !== symbol ? " — " + name : "");
    lastPriceEl.textContent = "";
    infoPanel.innerHTML = "";
    if (!recentTickers.find(function (t) { return t.symbol === symbol; })) recentTickers.unshift({ symbol: symbol, name: name || symbol });
    renderRecent();
    saveRecent(symbol, name);
    destroyCharts();
    setStatus("Loading data from Yahoo Finance...");
    await Promise.all([fetchAndRender(), loadInfo()]);
  }

  async function fetchAndRender() {
    if (!currentTicker) return;
    var ticker = currentTicker;
    var maShort = parseInt(maShortInput.value, 10) || 20;
    var maLong = parseInt(maLongInput.value, 10) || 100;
    if (!chart) setStatus("Loading...");
    try {
      var data = await (await fetch("/api/stock/history?ticker=" + encodeURIComponent(ticker) +
        "&ma_short=" + maShort + "&ma_long=" + maLong + "&period=" + currentPeriod)).json();
      if (ticker !== currentTicker) return;  // user switched meanwhile
      if (data.error) { destroyCharts(); setStatus(data.error, true); return; }
      lastData = data;
      setStatus("");
      renderAll();
      var c = data.close, lastClose = c[c.length - 1], first = c[0];
      var ch = first ? (lastClose - first) / first * 100 : 0;
      lastPriceEl.innerHTML = "Last close: <b style=\"color:var(--text)\">" + num(lastClose) + "</b> " +
        '<span style="color:' + (ch >= 0 ? "var(--green)" : "var(--red)") + '">(' + (ch >= 0 ? "+" : "") + num(ch) + "% in " + currentPeriod.toUpperCase() + ")</span>";
    } catch (err) {
      setStatus("Error loading data.", true);
    }
  }

  async function loadInfo() {
    var ticker = currentTicker;
    infoPanel.innerHTML = stat("Fundamentals", "Loading...");
    try {
      var info = await (await fetch("/api/stock/info?ticker=" + encodeURIComponent(ticker))).json();
      if (ticker !== currentTicker) return;
      if (info.error) { infoPanel.innerHTML = stat("Fundamentals", "N/A"); return; }
      lastInfo = info;
      if (info.name && (!currentName || currentName === ticker)) {
        currentName = info.name;
        tickerTitle.textContent = ticker + " — " + info.name;
      }
      var cur = info.currency || "";
      var dy = info.dividend_yield;
      // Yahoo returns dividendYield already in percent (e.g. 0.45 = 0.45%)
      var dyTxt = dy == null ? "N/A" : num(dy) + "%";
      infoPanel.innerHTML =
        stat("P/E (trailing)", num(info.trailing_pe)) +
        stat("P/E (forward)", num(info.forward_pe)) +
        stat("EPS", num(info.eps)) +
        stat("Market cap", big(info.market_cap) + " " + esc(cur)) +
        stat("52W low / high", num(info.week52_low) + " / " + num(info.week52_high)) +
        stat("Dividend yield", dyTxt) +
        (info.sector ? stat("Sector", '<span style="font-size:13px">' + esc(info.sector) + "</span>") : "");
      syncAvgButton();
      if (lastData) renderAll();
    } catch (err) {
      infoPanel.innerHTML = stat("Fundamentals", "Error");
    }
  }

  function syncAvgButton() {
    var btn = document.querySelector('.ind-btn[data-ind="avg"]');
    var ok = avgLineAvailable();
    btn.style.display = position ? "" : "none";
    btn.disabled = !ok;
    btn.title = ok ? "" : "Available only for your position's ticker, when the quote currency matches the position currency";
    btn.classList.toggle("on", ok && indicators.avg);
  }

  // ── Charts ────────────────────────────────────────────────────────────────
  function timeUnit() {
    return currentPeriod === "1m" ? "day" : currentPeriod === "6m" ? "week" : "month";
  }
  function xScale(gridOn) {
    return { type: "time", time: { unit: timeUnit() }, ticks: { color: TICK, maxRotation: 0 }, grid: gridOn === false ? { display: false } : { color: GRID } };
  }
  function renderAll() {
    if (!lastData) return;
    renderMain(lastData);
    renderRsi(lastData);
    renderVolume(lastData);
  }

  function line(label, data, color, width, hidden, dash) {
    return { label: label, data: data, borderColor: color, backgroundColor: "transparent", borderWidth: width,
      pointRadius: 0, tension: 0.1, hidden: hidden, borderDash: dash || [] };
  }

  function renderMain(data) {
    var showAvg = avgLineAvailable() && indicators.avg;
    var datasets = [
      line("Close", data.close, "#60a5fa", 1.6, !indicators.price),
      line("Short MA (" + data.ma_short.window + "d)", data.ma_short.values, "#22c55e", 2, !indicators.ma),
      line("Long MA (" + data.ma_long.window + "d)", data.ma_long.values, "#a3e635", 2, !indicators.ma),
      line("My avg. purchase price", data.dates.map(function () { return position ? position.pret_mediu : null; }), "#f59e0b", 1.4, !showAvg, [6, 4]),
    ];
    if (chart) chart.destroy();
    chart = new Chart(chartCanvas.getContext("2d"), {
      type: "line",
      data: { labels: data.dates, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { filter: function (it) { return !it.dataset.hidden; },
            callbacks: { label: function (it) { return it.dataset.label + ": " + it.formattedValue; } } },
        },
        scales: { x: xScale(), y: { ticks: { color: TICK }, grid: { color: GRID } } },
      },
    });
  }

  function renderRsi(data) {
    if (rsiChart) rsiChart.destroy();
    var flat = function (v) { return data.dates.map(function () { return v; }); };
    rsiChart = new Chart($("rsi-chart").getContext("2d"), {
      type: "line",
      data: {
        labels: data.dates,
        datasets: [
          Object.assign(line("RSI (14)", data.rsi, "#a78bfa", 1.6, false), {
            segment: { borderColor: function (c) {
              var a = c.p0.parsed.y, b = c.p1.parsed.y;
              return (a >= 70 || b >= 70 || a <= 30 || b <= 30) ? "#ef4444" : "#a78bfa";
            } },
          }),
          line("70", flat(70), "#ef444466", 1, false, [5, 4]),
          line("30", flat(30), "#ef444466", 1, false, [5, 4]),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false },
          tooltip: { filter: function (it) { return it.datasetIndex === 0; },
            callbacks: { label: function (it) { return "RSI: " + it.formattedValue; } } } },
        scales: { x: xScale(), y: { min: 0, max: 100, ticks: { color: TICK, stepSize: 25 }, grid: { color: GRID } } },
      },
    });
  }

  function renderVolume(data) {
    if (volumeChart) volumeChart.destroy();
    var colors = data.close.map(function (c, i) {
      if (i === 0) return "#38bdf899";
      return c >= data.close[i - 1] ? "#22c55e99" : "#ef444499";
    });
    volumeChart = new Chart($("volume-chart").getContext("2d"), {
      type: "bar",
      data: { labels: data.dates, datasets: [{ label: "Volume", data: data.volume, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (it) { return "Volume: " + Number(it.raw).toLocaleString(); } } } },
        scales: { x: xScale(false),
          y: { ticks: { color: TICK, callback: function (v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v; } }, grid: { color: GRID } } },
      },
    });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  document.querySelectorAll(".ind-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      var ind = btn.getAttribute("data-ind");
      indicators[ind] = !indicators[ind];
      btn.classList.toggle("on", indicators[ind]);
      if (ind === "ma") maInputs.classList.toggle("on", indicators.ma);
      if (ind === "rsi") $("rsi-container").classList.toggle("on", indicators.rsi);
      if (ind === "volume") $("volume-container").classList.toggle("on", indicators.volume);
      if (chart) {
        chart.setDatasetVisibility(0, indicators.price);
        chart.setDatasetVisibility(1, indicators.ma);
        chart.setDatasetVisibility(2, indicators.ma);
        chart.setDatasetVisibility(3, indicators.avg && avgLineAvailable());
        chart.update();
      }
    });
  });

  document.querySelectorAll(".period-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".period-btn").forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      currentPeriod = btn.getAttribute("data-period");
      fetchAndRender();
    });
  });
  $("apply-ma").addEventListener("click", fetchAndRender);

  // ── Start ─────────────────────────────────────────────────────────────────
  async function start() {
    var params = new URLSearchParams(location.search);
    var posId = params.get("pos");
    var ticker = params.get("ticker");
    loadRecent();

    if (posId) {
      try {
        var r = await (await fetch("/api/stock/position/" + encodeURIComponent(posId))).json();
        if (!r.error) {
          position = r.position;
          position._yahoo = r.yahoo_ticker;
          renderPosition();
          syncAvgButton();
          if (r.yahoo_ticker) { loadTicker(r.yahoo_ticker, position.nume); return; }
          setStatus("No market ticker set for " + position.nume + ". Search for it above to see its chart.");
          searchInput.value = position.nume;
          searchInput.focus();
          runSearch(position.nume);
          return;
        }
      } catch (err) { /* fall through to free search */ }
    }
    syncAvgButton();
    if (ticker) loadTicker(ticker.toUpperCase(), params.get("name") || ticker.toUpperCase());
    else searchInput.focus();
  }
  start();
})();
