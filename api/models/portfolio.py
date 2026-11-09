"""
Portfolio model — data loading, saving, migration and snapshots.
"""
import os, json
from api.config import DEFAULT_DATA, CAT_MIGRATE
from api.services import mode


def load_data():
    """Load portfolio data for the current mode (demo / real), migrating if needed."""
    path = mode.data_file()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data, changed = migrate(data)
        if changed:
            save_data(data)
        return data
    if mode.is_demo():
        data = mode.build_demo_data()
        save_data(data)
        return data
    if mode.get() == mode.REAL:
        return json.loads(json.dumps(mode.EMPTY_DATA))  # real portfolio starts empty
    return json.loads(json.dumps(DEFAULT_DATA))


def save_data(data):
    """Persist data for the current mode; the real portfolio is also uploaded to Drive."""
    data.setdefault("snapshots",  [])
    data.setdefault("tranzactii", [])
    with open(mode.data_file(), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    if not mode.uploads_allowed():
        return  # demo portfolio never leaves this computer (or Drive upload is blocked)
    # Upload to Drive in background (non-blocking)
    try:
        from api.services.drive import get_drive
        import threading
        drive = get_drive()
        if drive.enabled:
            threading.Thread(target=drive.upload, daemon=True).start()
    except Exception:
        pass


def migrate(data):
    """Migrate old data formats to current schema."""
    changed = False
    for p in data.get("pozitii", []):
        # Migrate old Romanian category names to English
        if p.get("categorie") in CAT_MIGRATE:
            p["categorie"] = CAT_MIGRATE[p["categorie"]]
            changed = True
        # Add missing fields with defaults
        for field, default in [
            ("pret_mediu",    p.get("pret", 0)),
            ("regiune",       "World"),
            ("ticker_stooq",  p.get("ticker_yf", "")),
            ("dividende",     []),
            ("ticker_source", ""),
        ]:
            if field not in p:
                p[field] = default
                changed = True
        # Remove deprecated ticker_yf field
        if "ticker_yf" in p:
            if not p.get("ticker_stooq"):
                p["ticker_stooq"] = p["ticker_yf"]
            del p["ticker_yf"]
            changed = True
    # Ensure top-level arrays exist
    for key in ("tranzactii", "snapshots"):
        if key not in data:
            data[key] = []
            changed = True
    return data, changed


def save_snapshot(data, cursuri):
    """Save a daily snapshot of portfolio value in EUR."""
    from datetime import date as dt_date
    today    = str(dt_date.today())
    snapshots = data.setdefault("snapshots", [])

    def to_eur(v, m):
        return v / (cursuri.get(m) or 1.0)

    total    = 0.0
    categorii = {}
    for p in data.get("pozitii", []):
        val = to_eur(p["cantitate"] * p["pret"], p["moneda"])
        total += val
        cat = p.get("categorie", "Other")
        categorii[cat] = categorii.get(cat, 0.0) + val

    snapshot = {
        "data":      today,
        "total_eur": round(total, 2),
        "categorii": {k: round(v, 2) for k, v in categorii.items()},
        "cursuri":   {"USD": cursuri.get("USD", 1.14), "RON": cursuri.get("RON", 5.23)},
    }

    # Replace today's snapshot if it already exists
    existing = [s for s in snapshots if s["data"] != today]
    existing.append(snapshot)
    existing.sort(key=lambda s: s["data"])
    data["snapshots"] = existing
    save_data(data)
