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
        from api.config import DATA_FILE, base_dir
        print(f"[INFO] Base dir: {base_dir()}")
        print(f"[INFO] Data file: {DATA_FILE}")
        print(f"[INFO] Data file exists: {os.path.exists(DATA_FILE)}")
    except Exception as e:
        print(f"[WARN] Config check failed: {e}")

    print("\n╔══════════════════════════════════════════╗")
    print("║   Portfolio Manager  →  localhost:5000   ║")
    print("╚══════════════════════════════════════════╝\n")

    def sync_on_startup():
        time.sleep(2)
        try:
            from api.services.drive import get_drive
            drive = get_drive()
            if drive.enabled:
                print("[Drive] Checking cloud data...")
                ok = drive.download()
                print("[Drive] Synced ✓" if ok else f"[Drive] Sync failed: {drive.error}")
        except Exception as e:
            print(f"[Drive] Error: {e}")

    threading.Thread(target=sync_on_startup, daemon=True).start()

    try:
        import webview
        def start_flask():
            app.run(debug=False, port=5000, use_reloader=False, threaded=True)
        t = threading.Thread(target=start_flask, daemon=True)
        t.start()
        time.sleep(1.2)
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
