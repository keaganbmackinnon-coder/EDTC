import json
import threading
from pathlib import Path
from typing import Callable

import webview

# Overlay configs: sizes only — URLs are built at runtime based on dev/prod mode
OVERLAYS = {
    "cmdr_ping": {
        "title": "EDTC — CMDR Ping",
        "key": "cmdr-ping",
        "width": 340,
        "height": 130,
    },
    "route": {
        "title": "EDTC — Route",
        "key": "route",
        "width": 360,
        "height": 170,
    },
    "construction": {
        "title": "EDTC — Construction",
        "key": "construction",
        "width": 380,
        "height": 260,
    },
    "fss": {
        "title": "EDTC — FSS Values",
        "key": "fss",
        "width": 320,
        "height": 220,
    },
    "system_preview": {
        "title": "EDTC — System Preview",
        "key": "system-preview",
        "width": 420,
        "height": 210,
    },
    "exo_tracker": {
        "title": "EDTC — Exobiology",
        "key": "exo-tracker",
        "width": 360,
        "height": 200,
    },
}


class OverlayManager:
    def __init__(self, dev_mode: bool = False, dist_path: Path | None = None):
        self._windows: dict[str, webview.Window] = {}
        self._dev_mode = dev_mode
        self._dist_path = dist_path

    def _url(self, key: str) -> str:
        if self._dev_mode:
            return f"http://localhost:5173/?overlay={key}"
        base = self._dist_path.as_uri() if self._dist_path else "about:blank"
        return f"{base}?overlay={key}"

    def show(self, name: str):
        if name in self._windows:
            self._windows[name].show()
            return

        cfg = OVERLAYS.get(name)
        if not cfg:
            return

        url = self._url(cfg["key"])

        def _create():
            win = webview.create_window(
                title=cfg["title"],
                url=url,
                width=cfg["width"],
                height=cfg["height"],
                transparent=True,
                on_top=True,
                frameless=True,
                easy_drag=True,
            )
            self._windows[name] = win

        threading.Thread(target=_create, daemon=True).start()

    def hide(self, name: str):
        if name in self._windows:
            self._windows[name].hide()

    def toggle(self, name: str):
        if name in self._windows and self._windows[name].shown:
            self.hide(name)
        else:
            self.show(name)

    def hide_all(self):
        for name in list(self._windows):
            self.hide(name)

    def emit_to_overlay(self, name: str, event_type: str, payload: dict):
        win = self._windows.get(name)
        if win is None:
            return
        js = f"window.__edtc?.onEvent({json.dumps({'type': event_type, 'payload': payload})})"
        try:
            win.evaluate_js(js)
        except Exception:
            pass

    def hide_after(self, name: str, seconds: float):
        def _hide():
            import time
            time.sleep(seconds)
            self.hide(name)
        threading.Thread(target=_hide, daemon=True).start()
