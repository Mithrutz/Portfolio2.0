"""
Portfolio mode — "demo" (presentation portfolio, local only) or
"real" (your portfolio, synced with Google Drive).

The mode is chosen in the startup window and kept in memory for the
lifetime of the app process.
"""
import os
import random
import threading
from datetime import date, timedelta

from api.config import base_dir, DEFAULT_DATA

DEMO = "demo"
REAL = "real"

_mode = None
_lock = threading.Lock()
# Safety: when the real portfolio has no local file and the Drive download
# failed, never upload (it would overwrite the real data on Drive with an
# empty portfolio). Cleared after a successful download.
_uploads_blocked = False


def get():
    return _mode


def set_mode(mode):
    global _mode
    if mode not in (DEMO, REAL):
        raise ValueError("mode must be 'demo' or 'real'")
    with _lock:
        _mode = mode


def is_demo():
    return _mode == DEMO


def drive_allowed():
    """Google Drive is used only for the real portfolio."""
    return _mode == REAL


def block_uploads(blocked):
    global _uploads_blocked
    _uploads_blocked = bool(blocked)


def uploads_allowed():
    return drive_allowed() and not _uploads_blocked


EMPTY_DATA = {"cursuri": {"EUR": 1.0, "USD": 1.14, "RON": 5.23},
              "pozitii": [], "next_id": 1, "tranzactii": [], "snapshots": []}


def real_file():
    return os.path.join(base_dir(), "portfolio_data.json")


def demo_file():
    return os.path.join(base_dir(), "demo_data.json")


def data_file():
    return demo_file() if _mode == DEMO else real_file()


def reset_demo():
    if os.path.exists(demo_file()):
        os.remove(demo_file())


# ── Demo data ─────────────────────────────────────────────────────────────────
def build_demo_data():
    """
    DEFAULT_DATA plus a believable history so every tab looks good in a
    presentation: one year of weekly snapshots, a few closed trades and
    some dividends. Deterministic (seeded), so the demo looks the same
    every time it is reset.
    """
    import json
    data = json.loads(json.dumps(DEFAULT_DATA))
    cur = data["cursuri"]

    def eur(p):
        return p["cantitate"] * p["pret"] / (cur.get(p["moneda"]) or 1.0)

    final = {}
    for p in data["pozitii"]:
        final[p["categorie"]] = final.get(p["categorie"], 0.0) + eur(p)

    # Yearly drift per category (start value = final / (1 + growth))
    growth = {"ETFs": 0.17, "Stocks": 0.24, "Bonds": 0.05, "Cash": -0.10, "Crypto": 0.45}
    vol = {"ETFs": 0.012, "Stocks": 0.02, "Bonds": 0.002, "Cash": 0.0, "Crypto": 0.06}
    rng = random.Random(42)
    weeks = 52
    today = date.today()
    level = {c: 1.0 for c in final}
    paths = {c: [] for c in final}
    for _ in range(weeks + 1):
        for c in final:
            level[c] *= 1 + rng.gauss(0, vol.get(c, 0.01))
            paths[c].append(level[c])

    snaps = []
    for i in range(weeks + 1):
        t = i / weeks
        cats = {}
        for c, v_end in final.items():
            g = growth.get(c, 0.1)
            trend = (1 / (1 + g)) * (1 + g * t)
            # Noise fades out so the last point matches today's value exactly
            noise = paths[c][i] / paths[c][-1] if paths[c][-1] else 1.0
            noise = 1 + (noise - 1) * (1 - t)
            cats[c] = round(v_end * trend * noise, 2)
        d = today - timedelta(weeks=weeks - i)
        snaps.append({
            "data": d.isoformat(),
            "total_eur": round(sum(cats.values()), 2),
            "categorii": cats,
            "cursuri": {"USD": cur["USD"], "RON": cur["RON"]},
        })
    data["snapshots"] = snaps

    def ago(days):
        return (today - timedelta(days=days)).isoformat()

    data["tranzactii"] = [
        {"id": 900001, "tip": "vanzare", "data": ago(190), "pozitie_id": 6, "pozitie_nume": "MSFT",
         "cantitate": 2, "pret_vanzare": 445.0, "pret_mediu": 380.5, "moneda": "USD",
         "categorie": "Stocks", "regiune": "World", "profit": 129.0, "pct": 16.95},
        {"id": 900002, "tip": "vanzare", "data": ago(120), "pozitie_id": 8, "pozitie_nume": "SNP",
         "cantitate": 1500, "pret_vanzare": 0.74, "pret_mediu": 0.82, "moneda": "RON",
         "categorie": "Stocks", "regiune": "Romania", "profit": -120.0, "pct": -9.76},
        {"id": 900003, "tip": "vanzare", "data": ago(45), "pozitie_id": 3, "pozitie_nume": "EUNK.DE",
         "cantitate": 5, "pret_vanzare": 101.2, "pret_mediu": 88.3, "moneda": "EUR",
         "categorie": "ETFs", "regiune": "World", "profit": 64.5, "pct": 14.61},
    ]

    divs = {
        5: [(160, 2.50), (70, 2.60)],          # AAPL, USD
        6: [(150, 4.15), (60, 4.15)],          # MSFT, USD
        8: [(100, 207.5)],                      # SNP, RON
        9: [(130, 85.2)],                       # TLV, RON
    }
    for p in data["pozitii"]:
        for days, val in divs.get(p["id"], []):
            p["dividende"].append({"data": ago(days), "valoare": val, "moneda": p["moneda"]})

    data["demo"] = True
    return data
