"""
Portfolio Manager — Configuration
Constants, default data, and path helpers.
"""
import os, sys, json

# ── Runtime path ──────────────────────────────────────────────────────────────
def base_dir():
    """
    Return the directory where portfolio_data.json is stored.
    Search order:
      1. Next to the .exe (when frozen / installed)
      2. Current working directory (when launched from project root)
      3. Project root relative to this file (dev mode)
    """
    candidates = []

    if getattr(sys, "frozen", False):
        # Frozen (.exe): primary location is next to the executable
        candidates.append(os.path.dirname(sys.executable))
    else:
        # Dev mode: project root (two levels above api/config.py)
        candidates.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # Always also check the current working directory as fallback
    candidates.append(os.getcwd())

    # Return the first directory that already contains portfolio_data.json
    for d in candidates:
        if os.path.exists(os.path.join(d, "portfolio_data.json")):
            return d

    # Default to the first candidate (will be created there on first save)
    return candidates[0]

DATA_FILE   = os.path.join(base_dir(), "portfolio_data.json")
DRIVE_CREDS = os.path.join(base_dir(), "credentials.json")
DRIVE_TOKEN = os.path.join(base_dir(), "token.json")

DRIVE_SCOPES   = ["https://www.googleapis.com/auth/drive.file"]
DRIVE_FOLDER   = "PortfolioManager"
DRIVE_FILENAME = "portfolio_data.json"

# ── HTTP headers ──────────────────────────────────────────────────────────────
HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0",
    "Accept":     "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Category migration map (old names → new English names) ────────────────────
CAT_MIGRATE = {
    "ETF-uri":     "ETFs",
    "Acțiuni":     "Stocks",
    "Obligațiuni": "Bonds",
    "Obligatiuni": "Bonds",
    "Romania":     "Romania",
}

# ── Default data (used only when portfolio_data.json does not exist) ──────────
DEFAULT_DATA = {
    "cursuri": {"EUR": 1.0, "USD": 1.14, "RON": 5.23},
    "pozitii": [
        # ETFs / World
        {"id":1,  "nume":"VWCE",    "categorie":"ETFs",   "regiune":"World",   "cantitate":25,    "pret":142.80, "pret_mediu":118.40, "moneda":"EUR", "ticker_stooq":"vwce.de",  "dividende":[], "ticker_source":""},
        {"id":2,  "nume":"CSPX",    "categorie":"ETFs",   "regiune":"World",   "cantitate":8,     "pret":534.20, "pret_mediu":420.60, "moneda":"USD", "ticker_stooq":"cspx.uk",  "dividende":[], "ticker_source":""},
        {"id":3,  "nume":"EUNK.DE", "categorie":"ETFs",   "regiune":"World",   "cantitate":15,    "pret":104.60, "pret_mediu":88.30,  "moneda":"EUR", "ticker_stooq":"eunk.de",  "dividende":[], "ticker_source":""},
        {"id":4,  "nume":"IGLN",    "categorie":"ETFs",   "regiune":"World",   "cantitate":20,    "pret":82.50,  "pret_mediu":68.90,  "moneda":"USD", "ticker_stooq":"igln.uk",  "dividende":[], "ticker_source":""},
        # Stocks / World
        {"id":5,  "nume":"AAPL",    "categorie":"Stocks", "regiune":"World",   "cantitate":10,    "pret":213.40, "pret_mediu":162.80, "moneda":"USD", "ticker_stooq":"aapl.us",  "dividende":[], "ticker_source":""},
        {"id":6,  "nume":"MSFT",    "categorie":"Stocks", "regiune":"World",   "cantitate":5,     "pret":478.90, "pret_mediu":380.50, "moneda":"USD", "ticker_stooq":"msft.us",  "dividende":[], "ticker_source":""},
        {"id":7,  "nume":"BRK.B",   "categorie":"Stocks", "regiune":"World",   "cantitate":8,     "pret":496.40, "pret_mediu":338.20, "moneda":"USD", "ticker_stooq":"brkb.us",  "dividende":[], "ticker_source":""},
        # Stocks / Romania
        {"id":8,  "nume":"SNP",     "categorie":"Stocks", "regiune":"Romania", "cantitate":5000,  "pret":1.248,  "pret_mediu":0.820,  "moneda":"RON", "ticker_stooq":"snp.ro",   "dividende":[], "ticker_source":""},
        {"id":9,  "nume":"TLV",     "categorie":"Stocks", "regiune":"Romania", "cantitate":120,   "pret":42.60,  "pret_mediu":22.40,  "moneda":"RON", "ticker_stooq":"tlv.ro",   "dividende":[], "ticker_source":""},
        # Bonds / Romania
        {"id":10, "nume":"R3604AE", "categorie":"Bonds",  "regiune":"Romania", "cantitate":50,    "pret":101.20, "pret_mediu":100.0,  "moneda":"EUR", "ticker_stooq":"",         "dividende":[], "ticker_source":""},
        {"id":11, "nume":"Tezaur",  "categorie":"Bonds",  "regiune":"Romania", "cantitate":1000,  "pret":100.00, "pret_mediu":100.0,  "moneda":"RON", "ticker_stooq":"",         "dividende":[], "ticker_source":""},
        # Crypto
        {"id":12, "nume":"Bitcoin", "categorie":"Crypto", "regiune":"World",   "cantitate":0.1,   "pret":77200,  "pret_mediu":74000,  "moneda":"USD", "ticker_stooq":"BTC-USD",  "dividende":[], "ticker_source":"yahoo"},
        # Cash
        {"id":13, "nume":"Cash EUR","categorie":"Cash",   "regiune":"World",   "cantitate":1,     "pret":3500.0, "pret_mediu":3500.0, "moneda":"EUR", "ticker_stooq":"",         "dividende":[], "ticker_source":""},
        {"id":14, "nume":"Cash USD","categorie":"Cash",   "regiune":"World",   "cantitate":1,     "pret":1200.0, "pret_mediu":1200.0, "moneda":"USD", "ticker_stooq":"",         "dividende":[], "ticker_source":""},
        {"id":15, "nume":"Cash RON","categorie":"Cash",   "regiune":"Romania", "cantitate":1,     "pret":8400.0, "pret_mediu":8400.0, "moneda":"RON", "ticker_stooq":"",         "dividende":[], "ticker_source":""},
    ],
    "next_id": 16,
    "tranzactii": [],
    "snapshots":  [],
}
