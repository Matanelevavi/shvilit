"""קונפיגורציה מרכזית ל-backend הפקת הווידאו."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# אחסון בר-קיימא: אם מותקן HF Storage Bucket (ב-Space, ראה Settings -> Storage
# Buckets) הוא נכנס לנתיב הזה ומוגדר ע"י PERSIST_DIR. בלעדיו (למשל בפיתוח
# מקומי) נופלים חזרה לתיקיית ה-repo הרגילה - זמנית, אבל עובד בלי הגדרה נוספת.
#
# לפני שהיה bucket, כל push ל-git גרם ל-rebuild מלא של ה-container ב-HF
# Spaces שמחק את כל הסרטונים וה-cache שנוצרו קודם ("סרטון מאתמול נוצר
# מחדש") - כי האחסון הישן היה בתוך ה-container הזמני עצמו.
PERSIST_DIR = Path(os.getenv("PERSIST_DIR", str(BASE_DIR / "storage")))

STORAGE_DIR = PERSIST_DIR / "videos"
AUDIO_DIR = PERSIST_DIR / "audio"
TEMP_DIR = PERSIST_DIR / "tmp"
DB_PATH = PERSIST_DIR / "cache.db"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# קאש תוכן קבוע ב-Supabase (תסריטים/נקודות מרכזיות/חידונים) - ראה supacache.py.
# service role key, לא ה-anon key: הטבלאות סגורות לציבור ב-RLS.
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# גרסת הפרומפט של תוכן שנשמר בקאש. כל שיפור מהותי בפרומפטים של
# script_gen.py חייב להעלות את המספר - אחרת משתמשים ימשיכו לקבל
# מהקאש תוכן שנוצר מהפרומפט הישן לנצח.
PROMPT_VERSION = 2

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
MIN_IMAGES = 5
TARGET_IMAGES = 12

# User-Agent תיאורי - Wikimedia חוסמת בקשות עם UA ברירת מחדל.
HTTP_HEADERS = {
    "User-Agent": "Shvilit/1.0 (educational travel app; matanelevavi@gmail.com)"
}
