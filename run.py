"""
Portfolio Manager — Entry point
Run with: python run.py
"""
import os, sys, threading, time

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    try:
        from api.app import create_app, get_frontend_dir
    except Exception as e:
        print(f"[ERROR] Failed to import api.app: {e}")
        import traceback; traceback.print_exc()
        input("Press Enter to exit...")
        return

    app = create_app()

    # Verify frontend directory
    frontend = get_frontend_dir()
    print(f"[INFO] Frontend dir: {frontend}")
    print(f"[INFO] Frontend exists: {os.path.exists(frontend)}")
    if os.path.exists(frontend):
        files = os.listdir(frontend)
        print(f"[INFO] Frontend contents: {files}")

    # Verify data file
    try:
        from api.config import base_dir
        from api.services import mode
        print(f"[INFO] Base dir: {base_dir()}")
        print(f"[INFO] Real data file: {mode.real_file()} (exists: {os.path.exists(mode.real_file())})")
        print(f"[INFO] Demo data file: {mode.demo_file()} (exists: {os.path.exists(mode.demo_file())})")
    except Exception as e:
        print(f"[WARN] Config check failed: {e}")

    print("\n╔══════════════════════════════════════════╗")
    print("║   Portfolio Manager  →  localhost:5000   ║")
    print("╚══════════════════════════════════════════╝\n")

    # Google Drive sync now happens when the user picks "My portfolio"
    # in the startup window (see /api/mode), not automatically here.

    try:
        import webview
        def start_flask():
            app.run(debug=False, port=5000, use_reloader=False, threaded=True)
        t = threading.Thread(target=start_flask, daemon=True)
        t.start()
        time.sleep(1.2)
        from api.services import windows
        windows.enable("http://localhost:5000")
        webview.create_window("Portfolio Manager", "http://localhost:5000",
                              width=1280, height=800, resizable=True)
        webview.start()
    except ImportError:
        print("pywebview not found → browser mode at http://localhost:5000")
        import webbrowser
        threading.Timer(1.2, lambda: webbrowser.open("http://localhost:5000")).start()
        app.run(debug=False, port=5000, use_reloader=False, threaded=True)
    except Exception as e:
        print(f"[ERROR] Failed to start: {e}")
        import traceback; traceback.print_exc()
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()
