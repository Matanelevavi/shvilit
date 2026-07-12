"""שלב 1 + 6: FastAPI - נקודת הכניסה, בדיקת cache, והגשת הווידאו."""
import asyncio
import hashlib
import json
import os
import sqlite3

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import cache, supacache
from .config import AUDIO_DIR, GEMINI_API_KEY, PROMPT_VERSION, PUBLIC_BASE_URL, STORAGE_DIR
from .models import GenerateTourRequest, TourStatus
from .pipeline import run_pipeline
from .quiz_gen import generate_quiz
from .script_gen import generate_highlights, generate_script
from .tts import synthesize

app = FastAPI(title="Shvilit Video Tour API", version="1.0.0")

# CORS פתוח - הלקוח (אתר/אפליקציה) קורא מכל מקור.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

cache.init_db()

# הגשת קבצי הווידאו וקבצי האודיו.
app.mount("/videos", StaticFiles(directory=str(STORAGE_DIR)), name="videos")
app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")


def _to_status(row: sqlite3.Row) -> TourStatus:
    return TourStatus(
        id=row["id"],
        status=row["status"],
        location=row["location"],
        duration_minutes=row["duration_minutes"],
        style=row["style"],
        video_url=row["video_url"],
        error=row["error"],
    )


@app.get("/health")
async def health():
    return {"ok": True, "gemini_configured": bool(GEMINI_API_KEY)}


@app.post("/generate-tour", response_model=TourStatus)
async def generate_tour(req: GenerateTourRequest, background: BackgroundTasks):
    # שלב 1: בדיקת cache.
    existing = cache.find(req.location, req.duration_minutes, req.style)
    if existing is not None:
        if existing["status"] == "completed":
            # מוודא שהקובץ קיים (ב-HF Spaces הקונטיינר מאותחל מחדש מדי פעם).
            video_file = STORAGE_DIR / f"{existing['id']}.mp4"
            if video_file.exists():
                return _to_status(existing)
            cache.delete(existing["id"])  # קובץ נמחק - נייצר מחדש
        elif existing["status"] == "processing":
            return _to_status(existing)
        else:
            # failed -> נמחק ונייצר מחדש.
            cache.delete(existing["id"])

    tour_id = cache.create_processing(req.location, req.duration_minutes, req.style)
    # הרצה ברקע - הרינדור אורך זמן, אז מחזירים 'processing' והלקוח עושה polling.
    background.add_task(run_pipeline, tour_id, req.location, req.duration_minutes, req.style)

    row = cache.get_by_id(tour_id)
    return _to_status(row)


@app.get("/tour/{tour_id}", response_model=TourStatus)
async def get_tour(tour_id: str):
    row = cache.get_by_id(tour_id)
    if row is None:
        raise HTTPException(status_code=404, detail="tour not found")
    return _to_status(row)


# נעילה לכל מקום - בקשות חידון זהות במקביל יחלקו יצירה אחת (במקום לקרוא ל-Gemini פעמים רבות).
_quiz_locks: dict[str, asyncio.Lock] = {}


def _quiz_lock(location: str) -> asyncio.Lock:
    key = location.strip().lower()
    lock = _quiz_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _quiz_locks[key] = lock
    return lock


_audio_locks: dict[str, asyncio.Lock] = {}


def _audio_lock(key: str) -> asyncio.Lock:
    lock = _audio_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _audio_locks[key] = lock
    return lock


@app.post("/generate-audio")
async def generate_audio_endpoint(payload: dict):
    """קול עברי איכותי (edge-tts) כקובץ mp3 - עובד בכל דפדפן/מכשיר, ללא תלות ב-TTS מקומי."""
    text = (payload or {}).get("text", "").strip()
    style = (payload or {}).get("style", "historical")
    if not text:
        raise HTTPException(status_code=400, detail="missing text")

    key = hashlib.sha1(f"{style}|{text}".encode("utf-8")).hexdigest()
    path = AUDIO_DIR / f"{key}.mp3"
    url = f"{PUBLIC_BASE_URL}/audio/{key}.mp3"
    if path.exists():
        return {"audio_url": url}

    async with _audio_lock(key):
        if path.exists():
            return {"audio_url": url}
        try:
            await synthesize(text, style, str(path))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=str(exc))
    return {"audio_url": url}


# נעילה פר שילוב (מקום, אורך, סגנון) - בקשות תסריט זהות במקביל
# יחלקו יצירה אחת של Gemini במקום לשרוף טוקנים פעמיים.
_script_locks: dict[str, asyncio.Lock] = {}


def _script_lock(key: str) -> asyncio.Lock:
    lock = _script_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _script_locks[key] = lock
    return lock


@app.post("/generate-script")
async def generate_script_endpoint(payload: dict):
    """תסריט הדרכה בעברית (Gemini) עם קאש קבוע ב-Supabase.

    תסריט שנוצר פעם אחת מוגש לכל המשתמשים הבאים מיידית - בלי המתנה
    ל-Gemini ובלי טוקנים. cache_hit בתשובה משמש את האנליטיקס בצד הלקוח.
    """
    location = (payload or {}).get("location", "").strip()
    minutes = int((payload or {}).get("minutes", 5))
    style = (payload or {}).get("style", "historical")
    if not location:
        raise HTTPException(status_code=400, detail="missing location")

    cached = await supacache.get_script(location, minutes, style, PROMPT_VERSION)
    if cached:
        return {"script": cached, "cache_hit": True}

    key = f"{supacache.normalize(location)}|{minutes}|{style}"
    async with _script_lock(key):
        # בדיקה חוזרת אחרי קבלת הנעילה - אולי בקשה מקבילה כבר יצרה.
        cached = await supacache.get_script(location, minutes, style, PROMPT_VERSION)
        if cached:
            return {"script": cached, "cache_hit": True}
        try:
            script = await generate_script(location, minutes, style)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=str(exc))
        await supacache.save_script(location, minutes, style, PROMPT_VERSION, script)
    return {"script": script, "cache_hit": False}


_highlights_locks: dict[str, asyncio.Lock] = {}


def _highlights_lock(key: str) -> asyncio.Lock:
    lock = _highlights_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _highlights_locks[key] = lock
    return lock


@app.post("/place-highlights")
async def place_highlights_endpoint(payload: dict):
    """4-5 נקודות מרכזיות על מקום ([{emoji, text}]) להצגה במסך המקום.

    נשמרות בקאש פר מקום - קריאת Gemini אחת לכל מקום, לתמיד.
    כשל מחזיר רשימה ריקה (לא שגיאה) - המסך פשוט לא יציג את הקוביה.
    """
    location = (payload or {}).get("location", "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="missing location")

    cached = await supacache.get_highlights(location, PROMPT_VERSION)
    if cached:
        return {"highlights": cached, "cache_hit": True}

    async with _highlights_lock(supacache.normalize(location)):
        cached = await supacache.get_highlights(location, PROMPT_VERSION)
        if cached:
            return {"highlights": cached, "cache_hit": True}
        highlights = await generate_highlights(location)
        if highlights:
            await supacache.save_highlights(location, PROMPT_VERSION, highlights)
    return {"highlights": highlights, "cache_hit": False}


async def _load_cached_quiz(location: str) -> list | None:
    """Supabase (קבוע) קודם, SQLite מקומי כ-fallback לרשומות ישנות/offline."""
    questions = await supacache.get_quiz(location)
    if questions:
        return questions
    try:
        raw = cache.get_quiz(location)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None  # cache פגום -> נייצר מחדש


@app.post("/generate-quiz")
async def generate_quiz_endpoint(payload: dict):
    location = (payload or {}).get("location", "").strip()
    count = int((payload or {}).get("count", 5))
    if not location:
        raise HTTPException(status_code=400, detail="missing location")

    cached = await _load_cached_quiz(location)
    if cached:
        return {"questions": cached}

    async with _quiz_lock(location):
        # בדיקה חוזרת אחרי קבלת הנעילה - אולי בקשה אחרת כבר יצרה.
        cached = await _load_cached_quiz(location)
        if cached:
            return {"questions": cached}
        try:
            questions = await generate_quiz(location, count)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=str(exc))
        # כתיבה לשני הקאשים - כשל בכתיבה לא קריטי, השאלות כבר בזיכרון.
        await supacache.save_quiz(location, questions)
        try:
            cache.save_quiz(location, json.dumps(questions, ensure_ascii=False))
        except Exception:  # noqa: BLE001
            pass
        return {"questions": questions}
