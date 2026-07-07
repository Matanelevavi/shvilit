"""שלב 2: יצירת תסריט הסיור באמצעות Gemini API (עם retry ו-fallback בין מודלים)."""
import asyncio
import re

import httpx

from .config import GEMINI_API_KEY, GEMINI_MODEL, WORDS_PER_MINUTE

# סדר ניסיון: המודל מה-.env, ואז מודלים פחות עמוסים כ-fallback ל-503.
MODELS = list(
    dict.fromkeys([
        GEMINI_MODEL,
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-flash-latest",
    ])
)

_BACKOFF = [2, 5, 12]  # שניות המתנה בין ניסיונות (503/429)

STYLE_INSTRUCTIONS = {
    "historical": "סגנון היסטורי-עובדתי: רצף כרונולוגי ברור, דגש על תאריכים, דמויות ואירועים מרכזיים, טון מכובד ומלמד.",
    "mystery": "סגנון מתח ומסתורין: פתיחה מסקרנת, טון דרמטי, מתח נרטיבי וגילוי הדרגתי - אך ללא המצאת עובדות.",
    "kids": "סגנון לילדים: שפה פשוטה, חמה ונלהבת, משפטים קצרים, דימויים מהעולם של ילדים.",
}


def _build_prompt(location: str, duration_minutes: int, style: str) -> str:
    target_words = duration_minutes * WORDS_PER_MINUTE
    style_line = STYLE_INSTRUCTIONS.get(style, STYLE_INSTRUCTIONS["historical"])
    return "\n".join(
        [
            f'אתה מדריך טיולים מומחה. כתוב תסריט הקראה בעברית לסיור מודרך על "{location}".',
            "",
            "חוקים מחייבים:",
            f"1. אורך: לפחות {target_words} מילים - זהו סיור של {duration_minutes} דקות",
            f"   בקצב {WORDS_PER_MINUTE} מילים לדקה. אל תקצר! תסריט קצר מדי פוסל את התוצאה.",
            "   העמק בהיסטוריה, בסיפורים, בפרטים אדריכליים ובאנקדוטות כדי להגיע לאורך המלא.",
            "2. הסתמך על ידע עובדתי אמין על המקום. אל תמציא פרטים שאינך בטוח בהם.",
            f"3. {style_line}",
            "4. חלק לפסקאות קצרות (2-4 משפטים) מופרדות בשורה ריקה. ללא כותרות, ללא נקודות תבליט, ללא הערות במאמר מוסגר.",
            "5. עברית תקנית וזורמת, מתאימה להקראה קולית רציפה.",
            "6. אסור לכלול הוראות בימוי, קריינות או אווירה - לא בסוגריים ולא בכל צורה",
            "   אחרת (למשל: '(קול שקט ודרמטי)'). רק הטקסט המוקרא עצמו.",
            "",
            "כתוב כעת רק את תסריט הסיור עצמו:",
        ]
    )


def _generation_config(model: str) -> dict:
    # תקרת טוקנים גבוהה: 1,500 מילים בעברית = ~5,000 טוקנים, ובמודלי 2.5
    # גם ה"חשיבה" נספרת בתקרה. 4096 הישן חתך תסריטים ארוכים באמצע.
    cfg: dict = {"temperature": 0.85, "maxOutputTokens": 16384}
    if model.startswith("gemini-2.5"):
        # מכבים את מצב החשיבה - חוסך טוקנים וזמן, לא נחוץ לכתיבת תסריט.
        cfg["thinkingConfig"] = {"thinkingBudget": 0}
    return cfg


def _extract(data: dict) -> str:
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        return ""


# שורה שכולה הוראת בימוי בסוגריים, למשל: "(קול שקט, מעט דרמטי, עם הפסקות קלות)"
_STAGE_LINE_RE = re.compile(r"^\s*[\(\[][^\)\]]{0,150}[\)\]]\s*[:.\-]?\s*$")

# מילות מפתח שמזהות הוראת בימוי (לא עובדה תוכנית). רשימה סגורה בכוונה:
# בלעדיה, סוגריים לגיטימיים כמו "(בשנת 1948)" היו נמחקים יחד עם התוכן שלהם.
_STAGE_KEYWORDS = (
    "קול", "בקול", "קריינות", "קריין", "נרטיב", "הפסק", "השהי", "אווירה",
    "דרמטי", "מוזיקה", "רקע", "טון", "לחישה", "לחש", "מתח דרמטי", "צליל",
)
# הוראת בימוי צמודה לתחילת פסקה, למשל: "(בקול דרמטי) פעם, לפני שנים..."
# - נמחקת רק כשהתוכן בסוגריים מכיל אחת ממילות המפתח לעיל.
_STAGE_PREFIX_RE = re.compile(r"^\s*\(([^)\n]{0,150})\)\s*", re.MULTILINE)


def _clean_script(text: str) -> str:
    """מסיר הוראות בימוי/קריינות שמודלים מוסיפים לפעמים למרות ההנחיה.

    הן גם מוצגות למשתמש וגם מוקראות ע"י ה-TTS - חייבות לרדת. חשוב לא
    למחוק סוגריים לגיטימיים (תאריך, שם חלופי וכו') שהמשתמש כן צריך לשמוע.
    """
    lines = [ln for ln in text.splitlines() if not _STAGE_LINE_RE.match(ln)]
    cleaned = "\n".join(lines)

    def _strip_if_stage_direction(m: "re.Match[str]") -> str:
        inner = m.group(1)
        return "" if any(kw in inner for kw in _STAGE_KEYWORDS) else m.group(0)

    cleaned = _STAGE_PREFIX_RE.sub(_strip_if_stage_direction, cleaned)
    cleaned = cleaned.replace("**", "").replace("##", "")
    # צמצום שורות ריקות עודפות שנשארו אחרי המחיקה
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


async def generate_script(location: str, duration_minutes: int, style: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY חסר. הוסף אותו ל-backend/.env")

    prompt = _build_prompt(location, duration_minutes, style)

    last_err = ""
    async with httpx.AsyncClient(timeout=120) as client:
        for model in MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": _generation_config(model),
            }
            for attempt in range(3):
                resp = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
                if resp.status_code == 200:
                    text = _clean_script(_extract(resp.json()))
                    if text:
                        return text
                    last_err = f"{model}: empty response"
                    break  # מודל הצליח אך ריק -> ננסה מודל אחר
                if resp.status_code in (429, 500, 503):
                    last_err = f"מודל {model} עמוס (נסיון {attempt+1}/3)"
                    await asyncio.sleep(_BACKOFF[attempt])
                    continue  # עומס זמני -> retry על אותו מודל
                if resp.status_code == 404:
                    last_err = f"מודל {model} לא זמין"
                    break  # מודל לא קיים -> עוברים למודל הבא
                if resp.status_code == 400:
                    raise RuntimeError("מפתח Gemini לא תקין. בדוק את GEMINI_API_KEY.")
                if resp.status_code == 403:
                    raise RuntimeError("אין הרשאה ל-Gemini API. בדוק את המפתח.")
                last_err = f"שגיאה בלתי צפויה ממודל {model} (קוד {resp.status_code})"
                break  # שגיאה אחרת -> ננסה מודל הבא
            # מיצינו את הניסיונות למודל הזה -> עוברים למודל הבא.
    raise RuntimeError(f"Gemini עמוס כרגע - כל המודלים עסוקים. נסה שוב בעוד דקה. (פרטים: {last_err})")


async def generate_keywords(script: str) -> list[str]:
    """מפיק 8 מילות מפתח אנגליות לחיפוש תמונות ב-Commons. כשל לא קריטי - מחזיר רשימה ריקה."""
    if not GEMINI_API_KEY or not script:
        return []
    prompt = (
        "Extract 8 specific English search terms for Wikimedia Commons image search "
        "from this Hebrew tour script. Focus on: specific historical events, "
        "architectural features, artifacts, periods, famous figures - NOT the place name itself.\n"
        f"Script (first 1200 chars): {script[:1200]}\n"
        "Return only: term1, term2, term3, term4, term5, term6, term7, term8"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 60},
    }
    # קריאה מהירה - מנסה רק שני מודלים עם timeout קצר.
    fast_models = ["gemini-2.0-flash", "gemini-flash-latest"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for model in fast_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                resp = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
                if resp.status_code == 200:
                    text = _extract(resp.json())
                    return [k.strip() for k in text.split(",") if k.strip()][:8]
    except Exception:  # noqa: BLE001
        pass
    return []
