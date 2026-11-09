"""
Stock research routes — search, history, fundamentals, recent tickers,
position → Yahoo ticker resolution and opening the details window.
"""
from flask import Blueprint, jsonify, request

from api.models.portfolio import load_data
from api.services import stock_data, windows
from api.services.prices import stooq_to_yahoo

bp = Blueprint("stock", __name__)


@bp.route("/api/stock/search")
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    try:
        return jsonify(stock_data.search(q))
    except Exception as exc:
        return jsonify({"error": f"Cautarea a esuat: {exc}"}), 502


@bp.route("/api/stock/history")
def history():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Lipseste parametrul 'ticker'"}), 400
    try:
        ma_short = max(1, int(request.args.get("ma_short", 20)))
        ma_long = max(1, int(request.args.get("ma_long", 100)))
    except ValueError:
        return jsonify({"error": "Ferestrele mediilor mobile trebuie sa fie numere intregi"}), 400
    period = request.args.get("period", "3y")
    try:
        return jsonify(stock_data.get_history(ticker, ma_short, ma_long, period))
    except LookupError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Nu am putut descarca datele pentru {ticker}: {exc}"}), 502


@bp.route("/api/stock/info")
def info():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Lipseste parametrul 'ticker'"}), 400
    try:
        return jsonify(stock_data.get_info(ticker))
    except Exception as exc:
        return jsonify({"error": f"Nu am putut obtine datele fundamentale: {exc}"}), 502


@bp.route("/api/stock/recent", methods=["GET"])
def recent():
    return jsonify(stock_data.get_recent())


@bp.route("/api/stock/recent", methods=["POST"])
def add_recent():
    payload = request.get_json(silent=True) or {}
    ticker = (payload.get("ticker") or "").strip().upper()
    name = (payload.get("name") or ticker).strip()
    if not ticker:
        return jsonify({"error": "Lipseste parametrul 'ticker'"}), 400
    stock_data.add_recent(ticker, name)
    return jsonify({"ok": True})


def yahoo_ticker_for(position):
    """Best-effort Yahoo Finance symbol for a portfolio position."""
    stooq = (position.get("ticker_stooq") or "").strip()
    if stooq:
        return stooq_to_yahoo(stooq)
    if position.get("categorie") in ("Cash", "Bonds"):
        return None
    name = (position.get("nume") or "").strip()
    return name.upper().replace(".", "-") if name and " " not in name else None


@bp.route("/api/stock/position/<int:pos_id>")
def position(pos_id):
    data = load_data()
    pos = next((p for p in data.get("pozitii", []) if p.get("id") == pos_id), None)
    if pos is None:
        return jsonify({"error": "Pozitia nu exista"}), 404
    return jsonify({
        "position": pos,
        "yahoo_ticker": yahoo_ticker_for(pos),
        "cursuri": data.get("cursuri", {}),
    })


@bp.route("/api/stock/open-window", methods=["POST"])
def open_window():
    """Open the details page in a new native window (desktop mode only)."""
    payload = request.get_json(silent=True) or {}
    path = payload.get("path") or "/stock.html"
    if not path.startswith("/stock.html"):
        return jsonify({"opened": False, "error": "Cale invalida"}), 400
    title = (payload.get("title") or "Detalii actiune")[:80]
    return jsonify({"opened": windows.open_window(title, path)})
