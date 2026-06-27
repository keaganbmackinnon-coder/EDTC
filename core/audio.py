import array
import math
import threading

_mixer = None
_ready = False


def _init():
    global _mixer, _ready
    try:
        import pygame.mixer as mx
        mx.init(frequency=44100, size=-16, channels=1, buffer=512)
        _mixer = mx
        _ready = True
    except Exception:
        pass


threading.Thread(target=_init, daemon=True).start()


def _synth_beep(freq: int = 880, duration: float = 0.25, volume: float = 0.6):
    sample_rate = 44100
    n = int(sample_rate * duration)
    buf = array.array('h')
    for i in range(n):
        t = i / sample_rate
        decay = math.exp(-t * 6)
        val = int(32767 * volume * math.sin(2 * math.pi * freq * t) * decay)
        buf.append(max(-32768, min(32767, val)))
    return _mixer.Sound(buffer=buf)


def play_ping(sound_path: str | None = None):
    def _play():
        if not _ready or _mixer is None:
            return
        try:
            if sound_path:
                from pathlib import Path
                p = Path(sound_path)
                if p.exists():
                    _mixer.Sound(str(p)).play()
                    return
            _synth_beep().play()
        except Exception:
            pass
    threading.Thread(target=_play, daemon=True).start()
