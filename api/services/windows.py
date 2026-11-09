"""
Native window helper.

When the app runs inside pywebview (desktop mode), run.py calls enable()
and new pages open as real native windows. In browser mode this stays
disabled and the frontend falls back to window.open().
"""
_base_url = None


def enable(base_url):
    global _base_url
    _base_url = base_url.rstrip("/")


def open_window(title, path):
    if not _base_url:
        return False
    try:
        import webview
        webview.create_window(title, _base_url + path, width=1150, height=820, resizable=True)
        return True
    except Exception as exc:
        print(f"[Window] Could not open native window: {exc}")
        return False
