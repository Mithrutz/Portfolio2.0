"""
Stock research service — search, 3-year daily history, indicators and
fundamentals from Yahoo Finance (ported from the "Bursa Cautare" app).

Daily prices are cached in a local SQLite database (stocks.db, next to
portfolio_data.json) so they are not re-downloaded every time.
"""
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta

import requests

from api.config import base_dir

DB_PATH = os.path.join(base_dir(), "stocks.db")
MAX_RECENT_TICKERS = 15

PERIOD_TO_DAYS = {
    "1m": 31,
    "6m": 183,
    "1y": 365,
    "3y": 3 * 365,
}

_init_lock = threading.Lock()
_initialized = False


# ── Database ──────────────────────────────────────────────────────────────────
def _init_db(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_prices (
            ticker TEXT NOT NULL,
            date   TEXT NOT NULL,
            close  REAL NOT NULL,
            volume REAL,
            PRIMARY KEY (ticker, date)
        )
        """
    )
    cols = [r[1] for r in conn.execute("PRAGMA table_info(daily_prices)").fetchall()]
    if "volume" not in cols:
        conn.execute("ALTER TABLE daily_prices ADD COLUMN volume REAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS last_update (
            ticker TEXT PRIMARY KEY,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS recent_tickers (
            ticker TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            last_used TEXT NOT NULL
        )
        """
    )
    conn.commit()


@contextmanager
def db():
    global _initialized
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        if not _initialized:
            with _init_lock:
                if not _initialized:
                    _init_db(conn)
                    _initialized = True
        yield conn
    finally:
        conn.close()


# ── Search (Yahoo Finance autocomplete) ───────────────────────────────────────
def search(query):
    url = "https://query2.finance.yahoo.com/v1/finance/search"
    headers = {"User-Agent": "Mozilla/5.0"}
    params = {"q": query, "quotesCount": 8, "newsCount": 0}
    resp = requests.get(url, headers=headers, params=params, timeout=8)
    resp.raise_for_status()
    results = []
    for quote in resp.json().get("quotes", []):
        symbol = quote.get("symbol")
        if not symbol:
            continue
        results.append({
            "symbol": symbol,
            "name": quote.get("shortname") or quote.get("longname") or symbol,
            "exchange": quote.get("exchange", ""),
            "type": quote.get("quoteType", ""),
        })
    return results


# ── History download / incremental update ─────────────────────────────────────
def refresh_ticker_data(conn, ticker):
    import yfinance as yf

    today = datetime.utcnow().date()
    row = conn.execute(
        "SELECT updated_at FROM last_update WHERE ticker = ?", (ticker,)
    ).fetchone()
    if row is not None and datetime.fromisoformat(row["updated_at"]).date() >= today:
        return  # already updated today

    existing = conn.execute(
        "SELECT MAX(date) AS max_date FROM daily_prices WHERE ticker = ?", (ticker,)
    ).fetchone()

    if existing and existing["max_date"]:
        # Re-fetch from the last saved day (fixes an intraday price saved mid-session)
        start_date = datetime.fromisoformat(existing["max_date"]).date()
        hist = None if start_date > today else yf.download(
            ticker,
            start=start_date.isoformat(),
            end=(today + timedelta(days=1)).isoformat(),
            progress=False,
            auto_adjust=True,
        )
    else:
        hist = yf.download(ticker, period="3y", progress=False, auto_adjust=True)

    if hist is not None and not hist.empty:
        if getattr(hist.columns, "nlevels", 1) > 1:
            close_series = hist["Close"][ticker]
            volume_series = hist["Volume"][ticker]
        else:
            close_series = hist["Close"]
            volume_series = hist["Volume"]

        rows = []
        for idx in close_series.index:
            c = close_series[idx]
            if c != c:  # NaN
                continue
            v = volume_series[idx]
            rows.append((ticker, idx.strftime("%Y-%m-%d"), float(c), float(v) if v == v else None))
        conn.executemany(
            "INSERT OR REPLACE INTO daily_prices (ticker, date, close, volume) VALUES (?, ?, ?, ?)",
            rows,
        )

    conn.execute(
        "INSERT OR REPLACE INTO last_update (ticker, updated_at) VALUES (?, ?)",
        (ticker, today.isoformat()),
    )
    conn.commit()


# ── Indicators ────────────────────────────────────────────────────────────────
def moving_average(values, window):
    result = [None] * len(values)
    running_sum = 0.0
    for i, v in enumerate(values):
        running_sum += v
        if i >= window:
            running_sum -= values[i - window]
        if i >= window - 1:
            result[i] = round(running_sum / window, 4)
    return result


def compute_rsi(values, period=14):
    """Classic Wilder RSI on closing prices."""
    n = len(values)
    result = [None] * n
    if n < period + 1:
        return result

    gains = [0.0] * n
    losses = [0.0] * n
    for i in range(1, n):
        change = values[i] - values[i - 1]
        gains[i] = max(change, 0.0)
        losses[i] = max(-change, 0.0)

    avg_gain = sum(gains[1: period + 1]) / period
    avg_loss = sum(losses[1: period + 1]) / period

    def rsi(ag, al):
        if al == 0:
            return 100.0
        return round(100 - (100 / (1 + ag / al)), 2)

    result[period] = rsi(avg_gain, avg_loss)
    for i in range(period + 1, n):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        result[i] = rsi(avg_gain, avg_loss)
    return result


def get_history(ticker, ma_short=20, ma_long=100, period="3y"):
    """Return price history + indicators, or raise LookupError if no data."""
    days_back = PERIOD_TO_DAYS.get(period, PERIOD_TO_DAYS["3y"])
    with db() as conn:
        refresh_ticker_data(conn, ticker)
        all_rows = conn.execute(
            "SELECT date, close, volume FROM daily_prices WHERE ticker = ? ORDER BY date ASC",
            (ticker,),
        ).fetchall()

    if not all_rows:
        raise LookupError(f"Nu exista date pentru '{ticker}'. Verifica simbolul.")

    all_dates = [r["date"] for r in all_rows]
    all_closes = [r["close"] for r in all_rows]
    all_volumes = [r["volume"] for r in all_rows]

    # Indicators are computed on the full history so they have values from day one
    all_ma_short = moving_average(all_closes, ma_short)
    all_ma_long = moving_average(all_closes, ma_long)
    all_rsi = compute_rsi(all_closes, period=14)

    cutoff = (datetime.utcnow().date() - timedelta(days=days_back)).isoformat()
    start = next((i for i, d in enumerate(all_dates) if d >= cutoff), len(all_dates))
    if start >= len(all_dates):
        raise LookupError(f"Nu exista date pentru '{ticker}' in perioada selectata.")

    return {
        "ticker": ticker,
        "dates": all_dates[start:],
        "close": all_closes[start:],
        "volume": all_volumes[start:],
        "rsi": all_rsi[start:],
        "ma_short": {"window": ma_short, "values": all_ma_short[start:]},
        "ma_long": {"window": ma_long, "values": all_ma_long[start:]},
    }


# ── Fundamentals ──────────────────────────────────────────────────────────────
def get_info(ticker):
    import yfinance as yf

    info = yf.Ticker(ticker).get_info() or {}
    return {
        "ticker": ticker,
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "trailing_pe": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "eps": info.get("trailingEps"),
        "market_cap": info.get("marketCap"),
        "dividend_yield": info.get("dividendYield"),
        "week52_high": info.get("fiftyTwoWeekHigh"),
        "week52_low": info.get("fiftyTwoWeekLow"),
        "currency": info.get("currency"),
    }


# ── Recently searched tickers ─────────────────────────────────────────────────
def get_recent():
    with db() as conn:
        rows = conn.execute(
            "SELECT ticker, name FROM recent_tickers ORDER BY last_used DESC LIMIT ?",
            (MAX_RECENT_TICKERS,),
        ).fetchall()
    return [{"symbol": r["ticker"], "name": r["name"]} for r in rows]


def add_recent(ticker, name):
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO recent_tickers (ticker, name, last_used) VALUES (?, ?, ?)",
            (ticker, name, datetime.utcnow().isoformat()),
        )
        conn.execute(
            """
            DELETE FROM recent_tickers WHERE ticker NOT IN (
                SELECT ticker FROM recent_tickers ORDER BY last_used DESC LIMIT ?
            )
            """,
            (MAX_RECENT_TICKERS,),
        )
        conn.commit()
