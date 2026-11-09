"""
Google Drive routes — status, sync and diagnostics.
"""
import json
from flask import Blueprint, jsonify, request
from api.services.drive import get_drive
from api.services import mode

bp = Blueprint("drive", __name__)

DEMO_STATUS = {"enabled": False, "connected": False, "last_sync": None,
               "error": None, "file_id": None, "demo": True}


@bp.route("/api/drive/status", methods=["GET"])
def drive_status():
    if not mode.drive_allowed():
        return jsonify(DEMO_STATUS)
    return jsonify(get_drive().status())


@bp.route("/api/drive/sync", methods=["POST"])
def drive_sync():
    """Manual sync: download (default) or explicit upload."""
    if not mode.drive_allowed():
        return jsonify({"ok": False, "status": DEMO_STATUS,
                        "mesaj": "Demo portfolio — Google Drive is off"})
    drive  = get_drive()
    if not drive.enabled:
        return jsonify({"ok": False, "mesaj": "Google Drive not configured (credentials.json missing)"})
    body   = request.get_json(silent=True) or {}
    action = body.get("action", "download")
    if action == "upload":
        if not mode.uploads_allowed():
            return jsonify({"ok": False, "status": drive.status(),
                            "mesaj": "Upload blocked: sync from Drive first (no local copy of your portfolio)"})
        ok    = drive.upload()
        mesaj = "Data uploaded to Drive ✓" if ok else (drive.error or "Upload failed")
    else:
        ok    = drive.download()
        if ok:
            mode.block_uploads(False)
        mesaj = "Data synced from Drive ✓" if ok else (drive.error or "Download failed")
    return jsonify({"ok": ok, "status": drive.status(), "mesaj": mesaj})


@bp.route("/api/drive/diagnose", methods=["GET"])
def drive_diagnose():
    """Detailed diagnostics for Google Drive."""
    import sys, platform
    from api.config import DRIVE_CREDS, DRIVE_TOKEN, base_dir
    result = {
        "platform": platform.system(),
        "python":   sys.version,
        "base_dir": base_dir(),
        "credentials_exists": __import__("os").path.exists(DRIVE_CREDS),
        "token_exists":       __import__("os").path.exists(DRIVE_TOKEN),
        "libraries": {},
    }
    for lib in ["google.auth", "google_auth_oauthlib"]:
        try:
            __import__(lib)
            result["libraries"][lib] = "OK"
        except ImportError as e:
            result["libraries"][lib] = f"MISSING: {e}"
    drive = get_drive()
    result["drive_enabled"]   = drive.enabled
    result["drive_error"]     = drive.error
    result["drive_last_sync"] = drive.last_sync
    return jsonify(result)
