# 📊 Portfolio Manager

## Architecture

```
portfolio-manager/
├── api/                          # Backend (Flask)
│   ├── app.py                    # Flask factory & blueprint registration
│   ├── config.py                 # Constants, DEFAULT_DATA, paths
│   ├── models/
│   │   └── portfolio.py          # load_data, save_data, migrate, save_snapshot
│   ├── services/
│   │   ├── prices.py             # Stooq, Yahoo Finance, BVB scrapers
│   │   └── drive.py              # Google Drive sync (DriveSync class)
│   └── routes/
│       ├── data.py               # /api/data, /api/snapshots
│       ├── prices.py             # /api/refresh-prices/stream, /api/test-ticker
│       └── drive.py              # /api/drive/status, /api/drive/sync
│
├── frontend/                     # Frontend (HTML + JS + CSS)
│   ├── index.html                # HTML shell, loads all JS files
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
