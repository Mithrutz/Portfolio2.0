"""
Flask application factory.
"""
import os, sys
from flask import Flask, send_from_directory


def get_frontend_dir():
    """
    Locate the frontend/ directory reliably in both dev and frozen (.exe) mode.
    In PyInstaller --onefile, sys._MEIPASS is the temp extraction directory.
    """
    if getattr(sys, "frozen", False):
        # Frozen: all bundled files are extracted to sys._MEIPASS
        return os.path.join(sys._MEIPASS, "frontend")
    # Dev mode: frontend/ is at project root (two levels above api/app.py)
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")


def create_app():
    """Create and configure the Flask application."""
    frontend_dir = get_frontend_dir()

    app = Flask(__name__, static_folder=frontend_dir, static_url_path="")

    # Register API blueprints
    from api.routes.data   import bp as data_bp
    from api.routes.prices import bp as prices_bp
    from api.routes.drive  import bp as drive_bp
    app.register_blueprint(data_bp)
    app.register_blueprint(prices_bp)
    app.register_blueprint(drive_bp)

    @app.route("/")
    def index():
        return send_from_directory(frontend_dir, "index.html")

    return app
