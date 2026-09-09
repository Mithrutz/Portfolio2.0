"""
Data routes — portfolio CRUD and snapshots.
"""
import json
from flask import Blueprint, jsonify, request
from api.models.portfolio import load_data, save_data

bp = Blueprint("data", __name__)


@bp.route("/api/data", methods=["GET"])
def get_data():
    return jsonify(load_data())


@bp.route("/api/data", methods=["POST"])
def set_data():
    new_data = request.get_json()
    # Preserve ticker_source (managed only by backend)
    try:
        existing = load_data()
        src_map  = {p["id"]: p.get("ticker_source", "") for p in existing.get("pozitii", [])}
        for p in new_data.get("pozitii", []):
            if not p.get("ticker_source") and p.get("id") in src_map:
                p["ticker_source"] = src_map[p["id"]]
    except Exception:
        pass
    save_data(new_data)
    return jsonify({"ok": True})


@bp.route("/api/snapshots", methods=["GET"])
def get_snapshots():
    return jsonify(load_data().get("snapshots", []))


@bp.route("/api/snapshots", methods=["POST"])
def add_snapshot():
    snap = request.get_json()
    data = load_data()
    snaps = data.setdefault("snapshots", [])
    snaps = [s for s in snaps if s.get("data") != snap.get("data")]
    snaps.append(snap)
    snaps.sort(key=lambda s: s["data"])
    data["snapshots"] = snaps
    save_data(data)
    return jsonify({"ok": True})


@bp.route("/api/snapshots/<string:data_str>", methods=["DELETE"])
def delete_snapshot(data_str):
    data = load_data()
    data["snapshots"] = [s for s in data.get("snapshots", []) if s.get("data") != data_str]
    save_data(data)
    return jsonify({"ok": True})
