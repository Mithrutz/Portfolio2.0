# 📊 Portfolio Manager

## Architecture

```
portfolio2.0/
├── api/                          # Backend (Flask)
│   ├── app.py                    # Flask factory & blueprint registration
│   ├── config.py                 # Constants, DEFAULT_DATA, paths
│   ├── models/
│   │   └── portfolio.py          # load_data, save_data, migrate, save_snapshot
│   ├── services/
│   │   ├── prices.py             # Stooq, Yahoo Finance, BVB scrapers
│   │   ├── drive.py              # Google Drive sync (DriveSync class)
│   │   ├── stock_data.py         # Stock research: Yahoo search, 3y history, MA/RSI, fundamentals (SQLite cache)
│   │   ├── windows.py            # Opens native pywebview windows (desktop mode)
│   │   └── mode.py               # Demo vs real portfolio (data file, Drive on/off, demo data)
│   └── routes/
│       ├── data.py               # /api/data, /api/snapshots
│       ├── prices.py             # /api/refresh-prices/stream, /api/test-ticker
│       ├── drive.py              # /api/drive/status, /api/drive/sync
│       ├── mode.py               # /api/mode — startup portfolio choice, reset demo
│       └── stock.py              # /api/stock/* — search, history, info, recent, position, open-window
│
├── frontend/                     # Frontend (HTML + JS + CSS)
│   ├── index.html                # HTML shell, loads all JS files
│   ├── stock.html                # Stock details window (click a position or 🔍 Research)
│   ├── css/
│   │   └── styles.css            # All styles
│   └── js/
│       ├── config.js             # CATS, PAL, color constants
│       ├── state.js              # Global state (ST, _collapsed, etc.)
│       ├── utils.js              # toEr, fe, fp, showToast, sectors
│       ├── api.js                # saveData, getCashPos, addToCash, etc.
│       ├── sidebar.js            # renderSB() — sidebar rendering
│       ├── main_vanilla.js       # Tab navigation, modals, init()
│       ├── refresh.js            # Price refresh (SSE), drive sync
│       └── components/
│           ├── AllocChart.js     # Allocation donut chart (React)
│           ├── PnlChart.js       # P&L bars chart (React)
│           ├── EvolutionChart.js # Portfolio evolution line chart (React)
│           └── CurrencyChart.js  # Currency allocation donut (React)
│
├── portfolio_data.json           # Your data (git-ignored)
├── demo_data.json                # Demo portfolio for presentations (git-ignored, never synced)
├── stocks.db                     # Cached daily prices for stock research (git-ignored)
├── run.py                        # ← Entry point: python run.py
├── requirements.txt
├── build_windows.bat
└── .gitignore
```

## Run

```bash
pip install -r requirements.txt
python run.py
```

Open http://localhost:5000

## Demo vs. real portfolio

On startup the app asks which portfolio to open:

- **Demo portfolio** — sample positions with a year of history, trades and dividends, for presenting
  the app. Stored in `demo_data.json`, never synced with Google Drive. "↺ Reset demo data" restores it.
- **My portfolio** — your real data in `portfolio_data.json`, synced with Google Drive
  (needs `credentials.json`). The Drive download happens when you pick it.

Switch at any time with the **Demo / My portfolio** pill next to the title.

