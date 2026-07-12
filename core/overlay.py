import json
import logging
import os
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
        # wide strip, not a card — single row + progress bar (user request)
        "width": 680,
        "height": 92,
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
        "width": 400,
        "height": 280,
    },
    "mining": {
        "title": "EDTC — Mining",
        "key": "mining",
        "width": 340,
        "height": 220,
    },
}


class OverlayManager:
    def __init__(self, dev_mode: bool = False, dist_path: Path | None = None):
        self._windows: dict[str, webview.Window] = {}
        self._shown: dict[str, bool] = {}
        self._user_enabled: dict[str, bool] = {}  # persistent per-overlay on/off preference
        self._opacity: dict[str, float] = {}
        self._hide_timers: dict[str, threading.Timer] = {}
        self._last_size: dict[str, int] = {}  # last content-fitted height per overlay
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
        """Whole-window alpha via the Win32 layered-window API — unlike CSS
        opacity (which fades the page but leaves the window slab opaque), this
        makes the overlay genuinely see-through to the game underneath.
        Per-pixel transparency stays off the table (unreliable in WebView2)."""
        win = self._windows.get(name)
        if win is None:
            return
        opacity = self._opacity.get(name, 1.0)
        cfg = OVERLAYS.get(name)
        applied = False
        if os.name == "nt" and cfg:
            try:
                import ctypes
                user32 = ctypes.windll.user32
                # Exact unique title match — safer than enumerating (Session 29)
                hwnd = user32.FindWindowW(None, cfg["title"])
                if hwnd:
                    GWL_EXSTYLE = -20
                    WS_EX_LAYERED = 0x00080000
                    LWA_ALPHA = 0x2
                    style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
                    user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED)
                    alpha = max(25, min(255, int(opacity * 255)))
                    user32.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
                    applied = True
                    logging.info(f"overlay: '{name}' window alpha set to {alpha}/255")
                else:
                    logging.warning(f"overlay: hwnd not found for '{cfg['title']}'")
            except Exception as e:
                logging.warning(f"overlay: layered alpha failed for '{name}': {e}")
        if not applied:
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
            # size may be stale — pushes while hidden skip the auto-fit
            if name in ("construction", "route", "mining", "exo_tracker"):
                self.resize_to_content(name)
            return

        cfg = OVERLAYS.get(name)
        if not cfg:
            return

        url = self._url(cfg["key"])
        # mark shown BEFORE the creation thread runs so a hide() arriving
        # mid-creation flips it back and _create can honour it below
        self._shown[name] = True

        def _create():
            import time
            logging.info(f"overlay: creating window '{name}' url={url}")
            try:
                # transparent=True depends on an undocumented, unreliable pywebview/
                # WebView2 mechanism that can render a flat white window instead of
                # see-through (open upstream issue, no fix). Use a solid dark HUD
                # background instead (set in App.jsx) — reliable every time.
                win = webview.create_window(
                    title=cfg["title"],
                    url=url,
                    width=cfg["width"],
                    height=cfg["height"],
                    background_color="#0a0c0f",
                    on_top=True,
                    frameless=True,
                    easy_drag=True,
                )
                self._windows[name] = win
                logging.info(f"overlay: window '{name}' created")
                time.sleep(1.5)
                if not self._shown.get(name, False):
                    # user disabled the overlay while the window was still
                    # being created — the earlier hide() had nothing to hide
                    win.hide()
                    logging.info(f"overlay: '{name}' hidden post-create (disabled during creation)")
                else:
                    self._apply_opacity(name)
            except Exception as e:
                logging.error(f"overlay: failed to create window '{name}': {e}")

        threading.Thread(target=_create, daemon=True).start()

    def hide(self, name: str):
        # flip the flag even when the window doesn't exist yet — show()'s
        # creation thread checks it after the window comes up
        self._shown[name] = False
        timer = self._hide_timers.pop(name, None)
        if timer:
            timer.cancel()
        win = self._windows.get(name)
        if win is not None:
            try:
                win.hide()
                logging.info(f"overlay: hid '{name}'")
            except Exception as e:
                logging.warning(f"overlay: hide '{name}' failed: {e}")

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
        # Content-sized overlays grow/shrink with their data. Their own JS
        # can't drive the resize — overlay windows are created without js_api,
        # so window.pywebview.api is an empty object there. Measure and resize
        # from this side instead; evaluate_js provably works (it's how the
        # data gets in). Both overlays carry id="overlay-panel" for measuring.
        if name in ("construction", "route", "mining", "exo_tracker"):
            self.resize_to_content(name)

    def resize_to_content(self, name: str, pad: int = 24, delay: float = 0.4):
        """Fit an overlay window to its rendered panel height. Delayed so the
        just-pushed payload has rendered before we measure.

        NEVER runs on a hidden overlay: pywebview's resize() re-shows a hidden
        window (verified empirically) — this was why disabled overlays kept
        popping back up on every route/cargo push."""
        win = self._windows.get(name)
        if win is None or not self._shown.get(name, False):
            return
        width = OVERLAYS.get(name, {}).get("width", 400)

        def _measure():
            if not self._shown.get(name, False):
                return  # hidden while the delay timer was pending
            try:
                h = win.evaluate_js(
                    "(document.getElementById('overlay-panel') || document.body).offsetHeight"
                )
                if isinstance(h, (int, float)) and h >= 20:
                    if not self._shown.get(name, False):
                        return  # hidden while we were measuring
                    target = int(h) + pad
                    # exo_tracker measures every second while sampling — skip
                    # the resize (and the log line) when nothing changed
                    if self._last_size.get(name) == target:
                        return
                    self._last_size[name] = target
                    win.resize(width, target)
                    logging.info(f"overlay: resized '{name}' to {width}x{target}")
            except Exception as e:
                logging.warning(f"overlay: resize_to_content '{name}': {e}")

        timer = threading.Timer(delay, _measure)
        timer.daemon = True
        timer.start()

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
