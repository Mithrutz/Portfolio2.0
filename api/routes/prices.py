"""
Price routes — live price updates via SSE and ticker testing.
"""
import re, json, time
from flask import Blueprint, jsonify, request, Response, stream_with_context
from api.models.portfolio import load_data, save_data, save_snapshot
from api.services.prices  import normalize_stooq, stooq_to_yahoo, get_stooq, get_yfinance, get_bvb, get_cursuri

bp = Blueprint("prices", __name__)


@bp.route("/api/refresh-prices", methods=["POST"])
def refresh_prices():
    """Legacy synchronous endpoint (kept for compatibility)."""
    data_local   = load_data()
    cursuri_live = get_cursuri()
    results      = []
    for p in data_local.get("pozitii", []):
        ticker  = (p.get("ticker_stooq") or "").strip()
        if ticker:
            ticker = normalize_stooq(ticker, p.get("regiune", "World"))
        pret, sursa = None, ""
        if ticker:
            pret, sursa = get_stooq(ticker)
            if not pret:
                pret, sursa = get_yfinance(ticker)
        results.append({"id": p["id"], "pret_nou": pret, "sursa": sursa})
    if not cursuri_live.get("error"):
        data_local["cursuri"].update(cursuri_live)
    save_snapshot(data_local, cursuri_live)
    return jsonify({"rezultate": results, "cursuri_live": cursuri_live})


@bp.route("/api/refresh-prices/stream")
def refresh_prices_stream():
    """SSE endpoint: stream live price update progress per position."""
    def generate():
        data_local   = load_data()
        pozitii_list = data_local.get("pozitii", [])
        total        = len(pozitii_list)
        cursuri_live = {}
        try:
            cursuri_live = get_cursuri()
        except Exception:
            pass

        yield "data: " + json.dumps({"type": "start", "total": total}) + "\n\n"

        rezultate = []
        for i, p in enumerate(pozitii_list):
            ticker  = (p.get("ticker_stooq") or "").strip()
            regiune = p.get("regiune", "World")
            if ticker:
                ticker = normalize_stooq(ticker, regiune)

            entry = {
                "type": "progress", "index": i, "total": total,
                "id": p["id"], "nume": p["nume"],
                "moneda": p.get("moneda", "EUR"),
                "pret_vechi": p.get("pret", 0),
                "ticker_stooq": ticker, "regiune": regiune,
            }

            if not ticker:
                entry.update(status="manual", pret_nou=None, mesaj="—")
            else:
                cached_source = (p.get("ticker_source") or "").strip()
                pret, sursa, new_source = None, "", cached_source

                is_yahoo_fmt = bool(re.match(
                    r"^[A-Za-z0-9]+-(USD|EUR|GBP|BTC|ETH|USDT|USDC)$", ticker, re.I))

                def try_stooq():
                    pr, sr = get_stooq(ticker); return pr, sr, "stooq" if pr else ""
                def try_yahoo():
                    # Convert Stooq format to Yahoo format before trying
                    yf_ticker = stooq_to_yahoo(ticker)
                    if yf_ticker is None:
                        return None, "Yahoo: skipped for Romanian ticker", ""
                    pr, sr = get_yfinance(yf_ticker)
                    return pr, sr, "yahoo" if pr else ""
                def try_bvb():
                    simbol = ticker.replace(".ro","").replace(".RO","").upper()
                    pr, sr = get_bvb(simbol)
                    if pr: return pr, sr, "bvb"
                    # Fallback: try Yahoo Finance with .RO extension
                    yf_ro = stooq_to_yahoo(ticker)
                    if yf_ro:
                        pr2, sr2 = get_yfinance(yf_ro)
                        if pr2: return pr2, sr2, "yahoo"
                    return None, f"Not found: {simbol}", ""

                if is_yahoo_fmt:
                    pret, sursa, new_source = try_yahoo()
                elif cached_source == "stooq":
                    pret, sursa, new_source = try_stooq()
                    if not pret: pret, sursa, new_source = try_yahoo()
                    if not pret and regiune != "World": pret, sursa, new_source = try_bvb()
                elif cached_source == "yahoo":
                    pret, sursa, new_source = try_yahoo()
                    if not pret: pret, sursa, new_source = try_stooq()
                    if not pret and regiune != "World": pret, sursa, new_source = try_bvb()
                elif cached_source == "bvb":
                    pret, sursa, new_source = try_bvb()
                    if not pret: pret, sursa, new_source = try_stooq()
                    if not pret: pret, sursa, new_source = try_yahoo()
                else:
                    pret, sursa, new_source = try_stooq()
                    if not pret and regiune == "World":
                        pret, sursa, new_source = try_yahoo()
                    elif not pret:
                        p2, s2, src2 = try_yahoo()
                        if p2: pret, sursa, new_source = p2, s2, src2
                        else:  pret, sursa, new_source = try_bvb()

                if pret is not None:
                    entry.update(status="ok", pret_nou=pret, mesaj=str(sursa),
                                 source_used=new_source,
                                 source_cached=(cached_source == new_source))
                    d2 = load_data()
                    for poz in d2.get("pozitii", []):
                        if poz["id"] == p["id"]:
                            poz["pret"] = pret
                            if new_source: poz["ticker_source"] = new_source
                            break
                    save_data(d2)
                else:
                    entry.update(status="eroare", pret_nou=None, mesaj=str(sursa or "")[:80])

            rezultate.append(entry)
            yield "data: " + json.dumps(entry) + "\n\n"
            time.sleep(0.15)

        # Auto-save snapshot
        try:
            d3 = load_data()
            save_snapshot(d3, cursuri_live if not cursuri_live.get("error") else d3.get("cursuri", {}))
        except Exception:
            pass

        n_ok = sum(1 for r in rezultate if r.get("status") == "ok")
        yield "data: " + json.dumps({
            "type": "done", "cursuri_live": cursuri_live,
            "n_ok": n_ok, "n_total": total
        }) + "\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@bp.route("/api/test-ticker", methods=["POST"])
def test_ticker():
    """Test a ticker: tries Stooq → Yahoo Finance → BVB."""
    body    = request.get_json() or {}
    ticker  = (body.get("ticker") or "").strip()
    regiune = body.get("regiune", "World")

    if not ticker:
        return jsonify({"ok": False, "pret": None, "eroare": "Empty ticker"})

    moneda = "EUR"
    pret, sursa = None, ""

    is_yahoo_fmt = bool(re.match(
        r"^[A-Za-z0-9]+-(USD|EUR|GBP|BTC|ETH|USDT|USDC)$", ticker, re.I))

    if is_yahoo_fmt:
        pret, sursa = get_yfinance(ticker)
        moneda = "USD" if ticker.upper().endswith("-USD") else                  "EUR" if ticker.upper().endswith("-EUR") else "USD"
        src_key = "yahoo" if pret else ""
    else:
        ticker_norm = normalize_stooq(ticker, regiune)
        moneda = "EUR" if any(x in ticker_norm for x in (".de", ".fr")) else                  "RON" if ".ro" in ticker_norm else "USD"
        pret, sursa = get_stooq(ticker_norm)
        src_key = "stooq" if pret else ""
        if not pret and regiune == "World":
            # Convert Stooq format to Yahoo Finance format
            yf_ticker = stooq_to_yahoo(ticker_norm)
            if yf_ticker:
                pret, sursa = get_yfinance(yf_ticker)
                src_key = "yahoo" if pret else ""
            if pret:
                sursa = f"Yahoo Finance ({yf_ticker})"
        if not pret and regiune != "World":
            simbol = ticker_norm.replace(".ro", "").upper()
            pret, sursa = get_bvb(simbol)
            src_key = "bvb" if pret else ""
            moneda  = "RON"
            # Extra fallback: Yahoo .RO
            if not pret:
                yf_ro = stooq_to_yahoo(ticker_norm)
                if yf_ro:
                    pret, sursa = get_yfinance(yf_ro)
                    src_key = "yahoo" if pret else ""

    if pret is not None:
        return jsonify({"ok": True, "pret": pret, "sursa": sursa,
                        "moneda": moneda, "source_key": src_key})
    return jsonify({"ok": False, "pret": None,
                    "eroare": "Ticker not found — check format (e.g. brkb.us · snp.ro · BTC-USD)"})
