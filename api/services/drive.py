import sys
"""
Google Drive sync service — REST API direct (no google-api-python-client).
"""
import os, json, time
from api.config import DRIVE_SCOPES, DRIVE_FOLDER, DRIVE_FILENAME


class DriveSync:
    """
    Sincronizare cu Google Drive folosind REST API direct (requests).
    Nu foloseste google-api-python-client pentru a evita timeout-urile
    la descarcarea discovery document-ului.
    Necesita: google-auth-oauthlib (doar pentru OAuth flow).
    """

    DRIVE_API = "https://www.googleapis.com/drive/v3"
    UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"

    def __init__(self, base_dir):
        self.base_dir   = base_dir
        self.creds_file = os.path.join(base_dir, "credentials.json")
        self.token_file = os.path.join(base_dir, "token.json")
        self.data_file  = os.path.join(base_dir, "portfolio_data.json")
        self.creds      = None
        self.file_id    = None
        self.folder_id  = None
        self.enabled    = os.path.exists(self.creds_file)
        self.last_sync  = None
        self.error      = None

    def _get_creds(self):
        """Obtine/reimprospateza credentialele OAuth. Deschide browserul doar la prima rulare."""
        try:
            from google.auth.transport.requests import Request
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
        except ImportError as e:
            self.error = f"Instalează: pip install google-auth-oauthlib"
            return None

        def do_auth():
            """Incearca autentificarea. Returneaza credentials sau ridica exceptie."""
            creds = None
            if os.path.exists(self.token_file):
                creds = Credentials.from_authorized_user_file(self.token_file, DRIVE_SCOPES)

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.creds_file, DRIVE_SCOPES
                    )
                    creds = flow.run_local_server(port=0, open_browser=True)
                with open(self.token_file, "w") as f:
                    f.write(creds.to_json())
            return creds

        try:
            creds = do_auth()
            self.creds = creds
            self.error = None
            return creds

        except Exception as e:
            err = str(e)
            # Token expirat/revocat → sterge token.json si reautentifica
            if "invalid_grant" in err or "Token has been expired" in err:
                if os.path.exists(self.token_file):
                    os.remove(self.token_file)
                try:
                    creds = do_auth()
                    self.creds = creds
                    self.error = None
                    return creds
                except Exception as e2:
                    self.error = f"Re-authentication failed: {str(e2)[:80]}"
                    return None

            if "access_denied" in err or "access_blocked" in err.lower():
                self.error = "Acces blocat — adaugă Gmail-ul în Test Users (OAuth consent screen → Audience)"
            elif "invalid_client" in err:
                self.error = "credentials.json invalid — descarcă unul nou din Google Cloud"
            elif "10060" in err or "timed out" in err.lower() or "WinError" in err:
                self.error = "Timeout — verifică Windows Firewall (permite Python/exe)"
            elif "FileNotFoundError" in err or "No such file" in err:
                self.error = "credentials.json not found lângă .exe"
            else:
                self.error = f"OAuth: {err[:100]}"
            return None

    def _headers(self):
        """Headers HTTP cu token Bearer."""
        if not self.creds:
            return None
        return {
            "Authorization": f"Bearer {self.creds.token}",
            "Content-Type":  "application/json",
        }

    def _api_get(self, url, params=None):
        """GET catre Drive REST API."""
        import requests as req
        creds = self._get_creds()
        if not creds:
            return None
        try:
            r = req.get(url, headers=self._headers(), params=params, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            self.error = f"API GET error: {str(e)[:80]}"
            return None

    def _get_or_create_folder(self):
        """Gaseste sau creeaza folderul PortfolioManager."""
        import requests as req
        q = f"name='{DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        data = self._api_get(f"{self.DRIVE_API}/files",
                             {"q": q, "fields": "files(id,name)"})
        if data is None:
            return None
        files = data.get("files", [])
        if files:
            return files[0]["id"]
        # Creeaza folderul
        try:
            r = req.post(
                f"{self.DRIVE_API}/files",
                headers=self._headers(),
                json={"name": DRIVE_FOLDER,
                      "mimeType": "application/vnd.google-apps.folder"},
                timeout=15
            )
            r.raise_for_status()
            return r.json()["id"]
        except Exception as e:
            self.error = f"Creare folder: {str(e)[:80]}"
            return None

    def _find_file(self):
        """Cauta portfolio_data.json in Drive."""
        if not self.folder_id:
            return None
        q = f"name='{DRIVE_FILENAME}' and '{self.folder_id}' in parents and trashed=false"
        data = self._api_get(f"{self.DRIVE_API}/files",
                             {"q": q, "fields": "files(id,name,modifiedTime)"})
        if data is None:
            return None
        files = data.get("files", [])
        return files[0] if files else None

    def download(self):
        """Descarca portfolio_data.json din Drive."""
        if not self.enabled:
            return False
        import requests as req
        creds = self._get_creds()
        if not creds:
            return False
        try:
            self.folder_id = self._get_or_create_folder()
            if not self.folder_id:
                return False
            remote = self._find_file()
            if not remote:
                return False      # prima rulare, fisierul nu exista inca
            self.file_id = remote["id"]

            # Compara timpii de modificare
            from datetime import datetime, timezone
            remote_time = datetime.fromisoformat(
                remote["modifiedTime"].replace("Z", "+00:00")
            )
            if os.path.exists(self.data_file):
                local_time = datetime.fromtimestamp(
                    os.path.getmtime(self.data_file), tz=timezone.utc
                )
                if remote_time <= local_time:
                    self.last_sync = datetime.now().strftime("%H:%M:%S")
                    return True    # local e la zi

            # Download the file
            r = req.get(
                f"{self.DRIVE_API}/files/{self.file_id}",
                headers=self._headers(),
                params={"alt": "media"},
                timeout=30
            )
            r.raise_for_status()
            with open(self.data_file, "wb") as f:
                f.write(r.content)
            self.last_sync = datetime.now().strftime("%H:%M:%S")
            self.error = None
            return True

        except Exception as e:
            err = str(e)
            if "10060" in err or "timed out" in err.lower():
                self.error = "Timeout — verifică Windows Firewall (permite Python/exe)"
            else:
                self.error = f"Download: {err[:80]}"
            return False

    def upload(self, local_file=None):
        """Uploadeaza portfolio_data.json pe Drive."""
        if not self.enabled:
            return False
        import requests as req
        local_file = local_file or self.data_file
        creds = self._get_creds()
        if not creds:
            return False
        try:
            if not self.folder_id:
                self.folder_id = self._get_or_create_folder()
            if not self.folder_id:
                return False
            if not self.file_id:
                remote = self._find_file()
                self.file_id = remote["id"] if remote else None

            with open(local_file, "rb") as f:
                content = f.read()

            headers_upload = {
                "Authorization": f"Bearer {creds.token}",
                "Content-Type":  "application/json",
            }

            if self.file_id:
                # Update existing file
                r = req.patch(
                    f"{self.UPLOAD_API}/files/{self.file_id}",
                    headers={**headers_upload, "Content-Type": "application/octet-stream"},
                    params={"uploadType": "media"},
                    data=content,
                    timeout=30
                )
            else:
                # Create new file (multipart)
                import email.mime.multipart, email.mime.base, email.mime.application
                meta = json.dumps({
                    "name": DRIVE_FILENAME,
                    "parents": [self.folder_id]
                }).encode()
                boundary = b"--portfolio_boundary"
                body = (
                    boundary + b"\r\n" +
                    b"Content-Type: application/json; charset=UTF-8\r\n\r\n" +
                    meta + b"\r\n" +
                    boundary + b"\r\n" +
                    b"Content-Type: application/json\r\n\r\n" +
                    content + b"\r\n" +
                    boundary + b"--\r\n"
                )
                r = req.post(
                    f"{self.UPLOAD_API}/files",
                    headers={**headers_upload,
                             "Content-Type": "multipart/related; boundary=portfolio_boundary"},
                    params={"uploadType": "multipart", "fields": "id"},
                    data=body,
                    timeout=30
                )
                if r.ok:
                    self.file_id = r.json().get("id")

            r.raise_for_status()
            from datetime import datetime
            self.last_sync = datetime.now().strftime("%H:%M:%S")
            self.error = None
            return True

        except Exception as e:
            err = str(e)
            if "10060" in err or "timed out" in err.lower():
                self.error = "Timeout upload — verifică Windows Firewall (permite Python/exe)"
            else:
                self.error = f"Upload: {err[:80]}"
            return False

    def status(self):
        return {
            "enabled":   self.enabled,
            "connected": self.creds is not None and self.error is None,
            "last_sync": self.last_sync,
            "error":     self.error,
            "file_id":   self.file_id,
        }


# Global instance
_drive = None

def get_drive():
    global _drive
    if _drive is None:
        from api.config import base_dir
        _drive = DriveSync(base_dir())
    return _drive
