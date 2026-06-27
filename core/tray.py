from pathlib import Path
from typing import Callable

import pystray
from PIL import Image, ImageDraw


def _make_icon() -> Image.Image:
    icon_path = Path(__file__).parent.parent / "frontend" / "public" / "icon.png"
    if icon_path.exists():
        return Image.open(icon_path)

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, 60, 60], fill=(255, 140, 0))
    draw.text((18, 20), "ED", fill=(0, 0, 0))
    return img


class TrayIcon:
    def __init__(
        self,
        on_show: Callable,
        on_hide: Callable,
        on_quit: Callable,
    ):
        self._on_show = on_show
        self._on_hide = on_hide
        self._on_quit = on_quit
        self._icon: pystray.Icon | None = None

    def run(self):
        menu = pystray.Menu(
            pystray.MenuItem("Show EDTC", self._show),
            pystray.MenuItem("Hide EDTC", self._hide),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", self._quit),
        )
        self._icon = pystray.Icon(
            name="EDTC",
            icon=_make_icon(),
            title="EDTC — Elite Dangerous Tools & Companion",
            menu=menu,
        )
        self._icon.run()

    def _show(self, icon, item):
        self._on_show()

    def _hide(self, icon, item):
        self._on_hide()

    def _quit(self, icon, item):
        icon.stop()
        self._on_quit()
