"""שלב 3: קול עברי (edge-tts) + כתוביות SRT מסונכרנות + מדידת משך."""
import asyncio
import json
from typing import List, Optional, Tuple

import edge_tts

from .config import FFPROBE_BIN

VOICE_BY_STYLE = {
    "historical": "he-IL-AvriNeural",
    "mystery": "he-IL-AvriNeural",
    "kids": "he-IL-HilaNeural",
}
DEFAULT_VOICE = "he-IL-AvriNeural"
RATE_BY_STYLE = {"historical": "+0%", "mystery": "-5%", "kids": "+8%"}

_MAX_WORDS_PER_CUE = 8

Cue = Tuple[float, float, str]


def _fmt(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _split_cue(start: float, end: float, text: str) -> List[Cue]:
    """מחלק משפט ארוך לכתוביות קצרות וקריאות, מחלק את הזמן באופן יחסי."""
    words = text.split()
    if len(words) <= _MAX_WORDS_PER_CUE:
        return [(start, end, text)]
    groups = [words[i : i + _MAX_WORDS_PER_CUE] for i in range(0, len(words), _MAX_WORDS_PER_CUE)]
    span = (end - start) / len(groups)
    return [(start + i * span, start + (i + 1) * span, " ".join(g)) for i, g in enumerate(groups)]


def _write_srt(cues: List[Cue], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for i, (start, end, text) in enumerate(cues, 1):
            f.write(f"{i}\n{_fmt(start)} --> {_fmt(end)}\n{text}\n\n")


async def synthesize(text: str, style: str, out_path: str, srt_path: Optional[str] = None) -> float:
    """מייצר אודיו mp3 + כתוביות. מחזיר את משך האודיו בשניות לפי WordBoundary timestamps של edge-tts."""
    voice = VOICE_BY_STYLE.get(style, DEFAULT_VOICE)
    rate = RATE_BY_STYLE.get(style, "+0%")
    communicate = edge_tts.Communicate(text, voice, rate=rate)

    cues: List[Cue] = []
    words: List[str] = []
    word_start: Optional[float] = None
    word_end = 0.0

    with open(out_path, "wb") as audio:
        async for chunk in communicate.stream():
            ctype = chunk.get("type")
            if ctype == "audio":
                audio.write(chunk["data"])
            elif ctype == "WordBoundary":
                start = chunk["offset"] / 1e7
                end = (chunk["offset"] + chunk["duration"]) / 1e7
                if word_start is None:
                    word_start = start
                words.append(chunk["text"])
                word_end = end
                if len(words) >= _MAX_WORDS_PER_CUE:
                    cues.append((word_start, word_end, " ".join(words)))
                    words, word_start = [], None
            elif ctype == "SentenceBoundary":
                start = chunk["offset"] / 1e7
                end = (chunk["offset"] + chunk["duration"]) / 1e7
                cues.extend(_split_cue(start, end, chunk["text"]))

    if words and word_start is not None:
        cues.append((word_start, word_end, " ".join(words)))

    cues.sort(key=lambda c: c[0])
    if srt_path and cues:
        _write_srt(cues, srt_path)

    # word_end הוא ה-timestamp המדויק של סוף המילה האחרונה.
    # מוסיפים 0.5 שניות padding לסיום טבעי.
    return word_end + 0.5 if word_end > 0 else 60.0


async def audio_duration_seconds(path: str) -> float:
    proc = await asyncio.create_subprocess_exec(
        FFPROBE_BIN, "-v", "quiet", "-print_format", "json", "-show_format", path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {stderr.decode()[:200]}")
    return float(json.loads(stdout.decode())["format"]["duration"])
