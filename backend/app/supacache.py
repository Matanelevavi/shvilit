"""קאש קבוע ב-Supabase (PostgREST) לתוכן טקסטואלי: תסריטים, נקודות מרכזיות, חידונים.

למה לא ה-SQLite המקומי? הוא יושב על הדיסק של ה-Space - טוב לקבצי מדיה
כבדים (יחד עם הקבצים עצמם), אבל תוכן טקסטואלי שאמור להישמר "לשנים"
צריך לחיות ב-Postgres המנוהל, ששורד כל rebuild ולא תלוי ב-bucket.

כל הפונקציות כאן "רכות": כשל ברשת/הגדרה מחזיר None וממשיכים ל-Gemini
כרגיל. הקאש הוא אופטימיזציה, לעולם לא תלות.

גישה: service role key בלבד (עוקף RLS). אין policies ציבוריים לטבלאות.
"""
import json
from typing import Any, Optional

import httpx

from .config import SUPABASE_SERVICE_KEY, SUPABASE_URL

# הקאש פעיל רק כששני המשתנים מוגדרים (ב-.env או ב-secrets של ה-Space).
ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

_TIMEOUT = 8  # שניות - קאש איטי גרוע מהחטאת קאש


def _rest(path: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{path}"


def _headers(upsert: bool = False) -> dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if upsert:
        # ריצות מקבילות עלולות לכתוב את אותו מפתח - merge במקום שגיאת duplicate.
        headers["Prefer"] = "resolution=merge-duplicates"
    return headers


def normalize(location: str) -> str:
    """מפתח קנוני: רווחים מיותרים ואותיות גדולות לא ייצרו רשומות כפולות."""
    return " ".join(location.strip().lower().split())


async def _select_one(table: str, filters: dict[str, str], column: str) -> Optional[Any]:
    if not ENABLED:
        return None
    params = {"select": column, "limit": "1", **{k: f"eq.{v}" for k, v in filters.items()}}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(_rest(table), params=params, headers=_headers())
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    return rows[0].get(column)
    except Exception:  # noqa: BLE001
        pass
    return None


async def _upsert(table: str, row: dict[str, Any], on_conflict: str) -> None:
    if not ENABLED:
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(
                _rest(table),
                params={"on_conflict": on_conflict},
                headers=_headers(upsert=True),
                content=json.dumps(row, ensure_ascii=False),
            )
    except Exception:  # noqa: BLE001
        pass  # כתיבת קאש שנכשלה אינה קריטית - התוכן כבר בידי המשתמש


# --- תסריטי הדרכה -----------------------------------------------------------

async def get_script(location: str, minutes: int, style: str, prompt_version: int) -> Optional[str]:
    return await _select_one(
        "script_cache",
        {
            "location_key": normalize(location),
            "minutes": str(minutes),
            "style": style,
            "prompt_version": str(prompt_version),
        },
        "script",
    )


async def save_script(location: str, minutes: int, style: str, prompt_version: int, script: str) -> None:
    await _upsert(
        "script_cache",
        {
            "location_key": normalize(location),
            "minutes": minutes,
            "style": style,
            "prompt_version": prompt_version,
            "script": script,
        },
        on_conflict="location_key,minutes,style,prompt_version",
    )


# --- נקודות מרכזיות ----------------------------------------------------------

async def get_highlights(location: str, prompt_version: int) -> Optional[list]:
    value = await _select_one(
        "place_highlights",
        {"location_key": normalize(location), "prompt_version": str(prompt_version)},
        "highlights",
    )
    return value if isinstance(value, list) else None


async def save_highlights(location: str, prompt_version: int, highlights: list) -> None:
    await _upsert(
        "place_highlights",
        {
            "location_key": normalize(location),
            "prompt_version": prompt_version,
            "highlights": highlights,
        },
        on_conflict="location_key,prompt_version",
    )


# --- חידונים -----------------------------------------------------------------

async def get_quiz(location: str) -> Optional[list]:
    value = await _select_one("quiz_cache", {"location_key": normalize(location)}, "questions")
    return value if isinstance(value, list) else None


async def save_quiz(location: str, questions: list) -> None:
    await _upsert(
        "quiz_cache",
        {"location_key": normalize(location), "questions": questions},
        on_conflict="location_key",
    )
