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
        "width": 460,
        "height": 80,
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
        self._shown: dict[str, bool] = {}
        self._user_enabled: dict[str, bool] = {}  # persistent per-overlay on/off preference
        self._opacity: dict[str, float] = {}
        self._hide_timers: dict[str, threading.Timer] = {}
        self._dev_mode = dev_mode
        self._dist_path = dist_path
        self._enabled = False  # suppressed until webview is running

    def enable(self):
        self._enabled = True

    def _url(self, key: str) -> str:
        if self._dev_mode:
            return f"http://localhost:5173/?overlay={key}"
        base = self._dist_path.as_uri() if self._dist_path else "about:blank"
        return f"{base}#overlay={key}"

    def _apply_opacity(self, name: str):
        win = self._windows.get(name)
        if win is None:
            return
        opacity = self._opacity.get(name, 1.0)
        try:
            win.evaluate_js(f"document.documentElement.style.opacity = '{opacity}'")
        except Exception:
            pass

    def show(self, name: str):
        if not self._enabled:
            return
        if name in self._windows:
            self._windows[name].show()
            self._shown[name] = True
            self._apply_opacity(name)
            return

        cfg = OVERLAYS.get(name)
        if not cfg:
            return

        url = self._url(cfg["key"])

        def _create():
            import time
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
            self._shown[name] = True
            time.sleep(1.5)
            self._apply_opacity(name)

        threading.Thread(target=_create, daemon=True).start()

    def hide(self, name: str):
        if name in self._windows:
            self._windows[name].hide()
            self._shown[name] = False

    def load_user_enabled(self, name: str, value: bool):
        self._user_enabled[name] = value

    def is_user_enabled(self, name: str) -> bool:
        return self._user_enabled.get(name, False)

    def toggle(self, name: str) -> bool:
        new_state = not self._user_enabled.get(name, False)
        self._user_enabled[name] = new_state
        if new_state:
            self.show(name)
        else:
            self.hide(name)
        return new_state

    def set_opacity(self, name: str, value: float):
        self._opacity[name] = max(0.1, min(1.0, value))
        self._apply_opacity(name)

    def get_opacity(self, name: str) -> float:
        return self._opacity.get(name, 1.0)

    def load_opacity(self, name: str, value: float):
        self._opacity[name] = max(0.1, min(1.0, value))

    def is_shown(self, name: str) -> bool:
        return self._shown.get(name, False)

    def hide_all(self):
        for name in list(self._windows):
            self.hide(name)

    def close_all(self):
        for win in list(self._windows.values()):
            try:
                win.destroy()
            except Exception:
                pass
        self._windows.clear()

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
        existing = self._hide_timers.pop(name, None)
        if existing:
            existing.cancel()

        def _hide():
            self.hide(name)
            self._hide_timers.pop(name, None)

        timer = threading.Timer(seconds, _hide)
        self._hide_timers[name] = timer
        timer.start()
