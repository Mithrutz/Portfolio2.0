"""
Mode routes — choose between the demo portfolio and the real (Drive-synced) one.
"""
import os
from flask import Blueprint, jsonify, request

from api.services import mode
from api.services.drive import get_drive

bp = Blueprint("mode", __name__)


@bp.route("/api/mode", methods=["GET"])
def get_mode():
    drive = get_drive()
    return jsonify({
        "mode": mode.get(),
        "drive_configured": drive.enabled,
        "real_exists": os.path.exists(mode.real_file()),
        "demo_exists": os.path.exists(mode.demo_file()),
    })


@bp.route("/api/mode", methods=["POST"])
def set_mode():
    body = request.get_json(silent=True) or {}
    try:
        mode.set_mode(body.get("mode"))
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    result = {"ok": True, "mode": mode.get(), "drive": None}
    mode.block_uploads(False)
    if mode.drive_allowed():
        # Real portfolio: pull the latest version from Google Drive first.
        # On first use this opens the Google sign-in page in the browser.
        drive = get_drive()
        if drive.enabled:
            had_local = os.path.exists(mode.real_file())
            ok = drive.download()
            # download() also returns False (with no error) when Drive has no file yet
            # (first use) — uploading is fine then. Block only on a real failure.
            if not ok and drive.error and not had_local and not os.path.exists(mode.real_file()):
                mode.block_uploads(True)
            result["drive"] = {"ok": ok, "error": None if ok else drive.error,
                               "uploads_blocked": not mode.uploads_allowed()}
    return jsonify(result)


@bp.route("/api/mode/reset-demo", methods=["POST"])
def reset_demo():
    mode.reset_demo()
    return jsonify({"ok": True})
