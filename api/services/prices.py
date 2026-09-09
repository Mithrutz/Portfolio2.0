"""
Price fetching services — Stooq, Yahoo Finance, BVB, exchange rates.
"""
import re, time, json
import urllib.request, urllib.error, urllib.parse
from api.config import HEADERS_BASE


def normalize_stooq(ticker, regiune="World"):
    """
    Normalize ticker for Stooq.
    Detects Yahoo Finance format (BTC-USD, ETH-EUR) and keeps them unchanged
    for processing by Yahoo Finance, not Stooq.
    """
    t  = ticker.strip()
    tl = t.lower()
    if re.match(r'^[A-Za-z0-9]+-(USD|EUR|GBP|BTC|ETH|USDT|USDC)$', t, re.I):
        return t  # unchanged — will be processed by Yahoo Finance
    return tl   # stooq uses lowercase



def stooq_to_yahoo(ticker):
    """
    Convert Stooq ticker format to Yahoo Finance format.
    Examples:
      aapl.us   → AAPL
      cspx.uk   → CSPX.L
      igln.uk   → IGLN.L
      eunk.de   → EUNK.DE
      vwce.de   → VWCE.DE
      snp.ro    → None (use BVB instead)
      BTC-USD   → BTC-USD (already Yahoo format)
    """
    t = ticker.strip()
    # Already Yahoo Finance format (e.g. BTC-USD, ETH-EUR)
    if re.match(r'^[A-Za-z0-9]+-(USD|EUR|GBP|BTC|ETH|USDT|USDC)$', t, re.I):
        return t

    tl = t.lower()
    sym = tl.rsplit(".", 1)
    if len(sym) != 2:
        return t.upper()

    base, market = sym[0].upper(), sym[1]

    # Manual overrides for tickers with special characters
    OVERRIDES = {
        "brkb": "BRK-B",
        "brk.b": "BRK-B",
        "bfh": "BFH",
    }
    if tl in OVERRIDES or tl.split(".")[0] in OVERRIDES:
        key = tl if tl in OVERRIDES else tl.split(".")[0]
        return OVERRIDES[key]

    market_map = {
        "us": base,          # AAPL.us → AAPL
        "uk": f"{base}.L",   # CSPX.uk → CSPX.L
        "de": f"{base}.DE",  # EUNK.de → EUNK.DE
        "fr": f"{base}.PA",  # SYM.fr  → SYM.PA
        "jp": f"{base}.T",   # SYM.jp  → SYM.T
        "hk": f"{base}.HK",  # SYM.hk  → SYM.HK
        "ca": f"{base}.TO",  # SYM.ca  → SYM.TO
        "au": f"{base}.AX",  # SYM.au  → SYM.AX
        "ro": f"{base}.RO",  # SNP.ro → SNP.RO on Yahoo Finance (fallback)
    }

    return market_map.get(market, f"{base}.{market.upper()}")

def get_cursuri():
    """Fetch EUR/USD and EUR/RON from frankfurter.app (free, no auth required)."""
    try:
        url = "https://api.frankfurter.app/latest?from=EUR&to=USD,RON"
        req = urllib.request.Request(url, headers=HEADERS_BASE)
        with urllib.request.urlopen(req, timeout=8) as r:
            raw = json.loads(r.read())
        rates = raw.get("rates", {})
        return {"EUR": 1.0, "USD": round(rates.get("USD", 1.14), 4),
                "RON": round(rates.get("RON", 5.23), 4)}
    except Exception as e:
        return {"error": str(e)[:60]}


def get_stooq(ticker):
    """Fetch price from Stooq CSV download."""
    url = f"https://stooq.com/q/l/?s={urllib.parse.quote(ticker)}&f=sd2t2ohlcv&h&e=csv"
    try:
        req = urllib.request.Request(url, headers=HEADERS_BASE)
        with urllib.request.urlopen(req, timeout=8) as r:
            raw = r.read().decode("utf-8", errors="ignore")
        lines = raw.strip().splitlines()
        if len(lines) >= 2:
            parts = lines[1].split(",")
            if len(parts) >= 5 and parts[4] not in ("N/D", "0", ""):
                return round(float(parts[4]), 4), f"Stooq ({ticker})"
    except Exception:
        pass
    return None, f"Stooq: not found ({ticker})"


def get_yfinance(ticker):
    """Fetch price from Yahoo Finance (with cookie session)."""
    try:
        # Step 1: get session cookie
        cookie_req = urllib.request.Request(
            f"https://finance.yahoo.com/quote/{urllib.parse.quote(ticker)}/",
            headers=HEADERS_BASE
        )
        cookie_jar = {}
        try:
            with urllib.request.urlopen(cookie_req, timeout=6) as resp:
                for header in (resp.headers.get_all("Set-Cookie") or []):
                    if "=" in header:
                        k, v = header.split("=", 1)
                        cookie_jar[k.strip()] = v.split(";")[0].strip()
        except Exception:
            pass
        cookies = "; ".join(f"{k}={v}" for k, v in cookie_jar.items())

        # Step 2: API call with cookie
        api_url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{urllib.parse.quote(ticker)}?interval=1d&range=5d"
        )
        api_req = urllib.request.Request(api_url, headers={
            **HEADERS_BASE,
            "Accept":  "application/json",
            "Cookie":  cookies,
            "Referer": "https://finance.yahoo.com/",
        })
        with urllib.request.urlopen(api_req, timeout=10) as r:
            raw = json.loads(r.read())
        result = raw["chart"]["result"][0]
        closes = result["indicators"]["quote"][0]["close"]
        last   = next((c for c in reversed(closes) if c is not None), None)
        if last:
            return round(float(last), 4), f"Yahoo Finance ({ticker})"
    except Exception:
        pass
    return None, f"Yahoo: not found ({ticker})"


def get_bvb(simbol):
    """
    Fetch price from BVB for Romanian stocks and bonds.
    Tries: 1) Stooq .ro  2) BVB page scraping  3) face value 100 for bonds
    """
    try:
        from bs4 import BeautifulSoup
        import requests
    except ImportError:
        return None, "requests/bs4 missing"

    simbol_up = simbol.upper().strip()

    # 1. Try Stooq with .ro extension
    stooq_t = simbol.lower().strip() + ".ro"
    try:
        url = f"https://stooq.com/q/l/?s={stooq_t}&f=sd2t2ohlcv&h&e=csv"
        r = requests.get(url, headers=HEADERS_BASE, timeout=8)
        if r.status_code == 200:
            lines = r.text.strip().splitlines()
            if len(lines) >= 2:
                parts = lines[1].split(",")
                if len(parts) >= 5 and parts[4] not in ("N/D", "0", ""):
                    return round(float(parts[4]), 4), f"Stooq ({stooq_t})"
    except Exception:
        pass

    # 2. BVB page scraping
    try:
        session = requests.Session()
        session.headers.update(HEADERS_BASE)
        session.get("https://www.bvb.ro", timeout=5)
        time.sleep(0.3)
        url = f"https://www.bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s={simbol_up}"
        r = session.get(url, timeout=8)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "lxml")
            for sel in [
                {"id": re.compile(r"LastPrice|CurrentPrice", re.I)},
                {"class": re.compile(r"last.?price|current.?price", re.I)},
            ]:
                el = soup.find(["span", "td", "div"], sel)
                if el:
                    txt = el.get_text(strip=True).replace(",", ".").replace(" ", "")
                    m = re.search(r"(\d+\.?\d*)", txt)
                    if m:
                        val = round(float(m.group(1)), 4)
                        if val > 0:
                            return val, f"BVB ({simbol_up})"
            # Look for numbers in bond price range (85–115)
            for el in soup.find_all(["span", "td"], limit=400):
                try:
                    val = float(el.get_text(strip=True).replace(",", "."))
                    if 85.0 <= val <= 115.0:
                        return round(val, 4), f"BVB ({simbol_up})"
                except (ValueError, AttributeError):
                    pass
    except Exception:
        pass

    # 3. Fallback for Fidelis / Tezaur bonds — face value 100
    if re.match(r"^R\d{4}[A-Z]{1,2}$", simbol_up) or simbol_up in ("TEZAUR", "TEZAUR7"):
        return 100.0, f"Nominal ({simbol_up}) — price not updated"

    return None, f"Not found on BVB ({simbol_up})"
