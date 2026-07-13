"""שלב 3: קול עברי (Gemini TTS) + כתוביות SRT מקורבות + מדידת משך.

עבר מ-edge-tts ל-Gemini TTS: edge-tts מציע רק שני קולים עבריים קבועים
וללא שליטה על טון/סגנון - קול טבעי ומגוון יותר דורש מנוע TTS שמבין הנחיות
בשפה טבעית. gemini-*-tts כן תומך בזה (ראה STYLE_DIRECTION), במחיר איבוד
אירועי WordBoundary שנתנו סנכרון כתוביות מדויק ב-edge-tts - לכן הכתוביות
כאן מקורבות (_approx_cues) והמשך נמדד מהקובץ עצמו (ffprobe), לא מהמנוע.
"""
import asyncio
import base64
import json
import re
from typing import List, Optional, Tuple

import httpx

from .config import FFMPEG_BIN, FFPROBE_BIN, GEMINI_API_KEY

# סדר ניסיון: המודל החדש ביותר, ואז fallback ותיק ויציב יותר ל-503/429.
TTS_MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"]
_BACKOFF = [2, 5, 12]  # שניות המתנה בין ניסיונות

# קול פר סגנון - שמות קוליים מובנים (prebuiltVoiceConfig) של Gemini TTS.
VOICE_BY_STYLE = {
    "historical": "Charon",     # Informative - מכובד ובהיר
    "mystery": "Enceladus",     # Breathy - מסתורי ודרמטי
    "kids": "Puck",             # Upbeat - חם ונלהב
}
DEFAULT_VOICE = "Charon"

# הנחיית טון בשפה טבעית - Gemini TTS מבצע אותה בלי להקריא אותה בקול.
STYLE_DIRECTION = {
    "historical": "בטון מכובד, ברור ומלמד, כמו מדריך טיולים מומחה",
    "mystery": "בטון דרמטי ומסתורי, עם הטעמות ומתח קל",
    "kids": "בטון חם, נלהב ומלא שמחה, מתאים להקראה לילדים",
}

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


def _approx_cues(text: str, total_seconds: float) -> List[Cue]:
    """כתוביות מקורבות: זמן כל משפט יחסי למספר המילים שלו."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    total_words = sum(len(s.split()) for s in sentences)
    if not sentences or total_words == 0 or total_seconds <= 0:
        return []
    cues: List[Cue] = []
    t = 0.0
    for sentence in sentences:
        dur = total_seconds * len(sentence.split()) / total_words
        cues.extend(_split_cue(t, t + dur, sentence))
        t += dur
    return cues


async def _generate_pcm(text: str, voice: str, direction: str) -> bytes:
    """קורא ל-Gemini TTS, מחזיר PCM גולמי (24kHz, מונו, 16-bit LE)."""
    prompt = (
        f"הקריאו את הטקסט הבא בעברית {direction}. הקריאו אך ורק את הטקסט "
        f"עצמו - בלי להקריא את ההנחיה הזו:\n\n{text}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    last_err: Optional[Exception] = None
    async with httpx.AsyncClient(timeout=120) as client:
        for model in TTS_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for wait in [0, *_BACKOFF]:
                if wait:
                    await asyncio.sleep(wait)
                try:
                    resp = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
                except httpx.HTTPError as exc:
                    last_err = exc
                    continue
                if resp.status_code == 200:
                    try:
                        b64 = resp.json()["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
                        return base64.b64decode(b64)
                    except (KeyError, IndexError, ValueError) as exc:
                        last_err = RuntimeError(f"{model}: unexpected response shape ({exc})")
                        break  # מבנה לא צפוי - לא retry, לנסות מודל הבא
                if resp.status_code in (429, 503):
                    last_err = RuntimeError(f"{model} {resp.status_code}: {resp.text[:200]}")
                    continue  # עומס זמני - retry עם backoff
                last_err = RuntimeError(f"{model} {resp.status_code}: {resp.text[:200]}")
                break  # שגיאה אחרת - לנסות מודל הבא, לא retry
    raise RuntimeError(f"Gemini TTS unavailable (all models tried). {last_err}")


async def _pcm_to_mp3(pcm: bytes, out_path: str) -> None:
    """ffmpeg: PCM גולמי (24kHz/מונו/16-bit) בקלט סטנדרטי -> mp3."""
    proc = await asyncio.create_subprocess_exec(
        FFMPEG_BIN, "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
        "-codec:a", "libmp3lame", "-qscale:a", "2", out_path,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate(input=pcm)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg pcm->mp3 failed: {stderr.decode(errors='ignore')[-500:]}")


async def synthesize(text: str, style: str, out_path: str, srt_path: Optional[str] = None) -> float:
    """מייצר אודיו mp3 + כתוביות מקורבות. מחזיר משך האודיו בשניות (נמדד מהקובץ)."""
    voice = VOICE_BY_STYLE.get(style, DEFAULT_VOICE)
    direction = STYLE_DIRECTION.get(style, STYLE_DIRECTION["historical"])

    pcm = await _generate_pcm(text, voice, direction)
    await _pcm_to_mp3(pcm, out_path)
    duration = await audio_duration_seconds(out_path)

    if srt_path:
        cues = _approx_cues(text, duration)
        if cues:
            _write_srt(cues, srt_path)

    return duration


async def audio_duration_seconds(path: str) -> float:
    proc = await asyncio.create_subprocess_exec(
        FFPROBE_BIN, "-v", "quiet", "-print_format", "json", "-show_format", path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {stderr.decode()[:200]}")
    return float(json.loads(stdout.decode())["format"]["duration"])
