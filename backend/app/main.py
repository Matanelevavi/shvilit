"""שלב 1 + 6: FastAPI - נקודת הכניסה, בדיקת cache, והגשת הווידאו."""
import asyncio
import hashlib
import json
import os
import sqlite3

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import cache
from .config import AUDIO_DIR, GEMINI_API_KEY, PUBLIC_BASE_URL, STORAGE_DIR
from .models import GenerateTourRequest, TourStatus
from .pipeline import run_pipeline
from .quiz_gen import generate_quiz
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


@app.post("/generate-quiz")
async def generate_quiz_endpoint(payload: dict):
    location = (payload or {}).get("location", "").strip()
    count = int((payload or {}).get("count", 5))
    if not location:
        raise HTTPException(status_code=400, detail="missing location")

    try:
        cached = cache.get_quiz(location)
    except Exception:  # noqa: BLE001
        cached = None
    if cached:
        try:
            return {"questions": json.loads(cached)}
        except Exception:  # noqa: BLE001
            cached = None  # cache פגום -> נייצר מחדש

    async with _quiz_lock(location):
        # בדיקה חוזרת אחרי קבלת הנעילה - אולי בקשה אחרת כבר יצרה.
        try:
            cached = cache.get_quiz(location)
        except Exception:  # noqa: BLE001
            cached = None
        if cached:
            try:
                return {"questions": json.loads(cached)}
            except Exception:  # noqa: BLE001
                cached = None
        try:
            questions = await generate_quiz(location, count)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=str(exc))
        try:
            cache.save_quiz(location, json.dumps(questions, ensure_ascii=False))
        except Exception:  # noqa: BLE001
            pass  # cache write fail -> לא קריטי, השאלות כבר בזיכרון
        return {"questions": questions}
