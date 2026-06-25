"""קונפיגורציה מרכזית ל-backend הפקת הווידאו."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage" / "videos"
AUDIO_DIR = BASE_DIR / "storage" / "audio"
TEMP_DIR = BASE_DIR / "storage" / "tmp"
DB_PATH = BASE_DIR / "storage" / "cache.db"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_raw_base_url = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
# מנקה מקרה שהמשתמש הקליד "KEY = VALUE" בשדה הערך (במקום רק ה-URL).
if "=" in _raw_base_url and not _raw_base_url.lstrip().startswith("http"):
    _raw_base_url = _raw_base_url.split("=", 1)[1].strip()
PUBLIC_BASE_URL = _raw_base_url.rstrip("/")

FFMPEG_BIN = os.getenv("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.getenv("FFPROBE_BIN", "ffprobe")

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")

# קצב דיבור להערכת מספר מילים לפי משך.
WORDS_PER_MINUTE = 130

# פרמטרים ויזואליים.
VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 720
FPS = 30
CROSSFADE_SEC = 1.5
MIN_IMAGES = 5
TARGET_IMAGES = 12

# User-Agent תיאורי - Wikimedia חוסמת בקשות עם UA ברירת מחדל.
HTTP_HEADERS = {
    "User-Agent": "Shvilit/1.0 (educational travel app; matanelevavi@gmail.com)"
}
