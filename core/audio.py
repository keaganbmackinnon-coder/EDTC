import io
import math
import os
import struct
import threading
import wave

# Synthesized ping WAV, built once. Kept at module level because
# winsound.SND_MEMORY requires the buffer to stay alive while playing.
_ping_wav: bytes | None = None

# pygame fallback (non-Windows only — never installable on the Python 3.14
# used for local Windows builds, which is why winsound is the primary path)
_mixer = None
_ready = False


def _init_pygame():
    global _mixer, _ready
    try:
        import pygame.mixer as mx
        mx.init(frequency=44100, size=-16, channels=1, buffer=512)
        _mixer = mx
        _ready = True
    except Exception:
        pass


if os.name != "nt":
    threading.Thread(target=_init_pygame, daemon=True).start()


def _synth_wav(freq: int = 880, duration: float = 0.25, volume: float = 0.6) -> bytes:
    rate = 44100
    n = int(rate * duration)
    frames = bytearray()
    for i in range(n):
        t = i / rate
        decay = math.exp(-t * 6)
        val = int(32767 * volume * math.sin(2 * math.pi * freq * t) * decay)
        frames += struct.pack("<h", max(-32768, min(32767, val)))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    return buf.getvalue()


def play_ping(sound_path: str | None = None):
    def _play():
        global _ping_wav
        try:
            if os.name == "nt":
                import winsound
                if sound_path:
                    from pathlib import Path
                    p = Path(sound_path)
                    if p.exists() and p.suffix.lower() == ".wav":
                        winsound.PlaySound(str(p), winsound.SND_FILENAME)
                        return
                if _ping_wav is None:
                    _ping_wav = _synth_wav()
                # synchronous is fine — we're on a daemon thread
                winsound.PlaySound(_ping_wav, winsound.SND_MEMORY)
                return
            # non-Windows: pygame if it loaded
            if not _ready or _mixer is None:
                return
            if sound_path:
                from pathlib import Path
                p = Path(sound_path)
                if p.exists():
                    _mixer.Sound(str(p)).play()
                    return
            _mixer.Sound(buffer=_pygame_beep_buffer()).play()
        except Exception:
            pass
    threading.Thread(target=_play, daemon=True).start()


def _pygame_beep_buffer(freq: int = 880, duration: float = 0.25, volume: float = 0.6):
    import array
    rate = 44100
    n = int(rate * duration)
    buf = array.array("h")
    for i in range(n):
        t = i / rate
        decay = math.exp(-t * 6)
        val = int(32767 * volume * math.sin(2 * math.pi * freq * t) * decay)
        buf.append(max(-32768, min(32767, val)))
    return buf
