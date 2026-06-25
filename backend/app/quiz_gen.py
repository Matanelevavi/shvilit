"""יצירת חידון רב-ברירה על מקום באמצעות Gemini (פלט JSON מובנה)."""
import asyncio
import json
from typing import List

import httpx

from .config import GEMINI_API_KEY
from .script_gen import MODELS

# סכמת JSON שמכריחה את Gemini להחזיר מבנה נקי.
_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "question": {"type": "STRING"},
            "options": {"type": "ARRAY", "items": {"type": "STRING"}},
            "answer": {"type": "INTEGER"},
        },
        "required": ["question", "options", "answer"],
    },
}


def _valid(q: dict) -> bool:
    if not (
        isinstance(q.get("question"), str)
        and isinstance(q.get("options"), list)
        and len(q["options"]) == 4
        and isinstance(q.get("answer"), int)
        and 0 <= q["answer"] <= 3
    ):
        return False
    # פסול שאלות שבהן כל האפשרויות זהות או כמעט זהות
    opts = [o.strip() for o in q["options"]]
    return len(set(opts)) >= 3


async def generate_quiz(location: str, count: int = 5) -> List[dict]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY חסר.")

    prompt = "\n".join([
        f'צור בדיוק {count} שאלות טריוויה בעברית על "{location}".',
        "",
        "כללים מחייבים:",
        "1. כל שאלה: 4 אפשרויות תשובה שונות לחלוטין זו מזו - אסור שיהיו כמעט זהות.",
        "2. אסור שאלות שואלות 'מה שמו של...' - הן טריוויאליות כי התשובה בשם המקום.",
        "3. שאל על: תאריכים היסטוריים, ממדים (גובה/אורך), אירועים ספציפיים, אישים, מספרים, חומרי בנייה, סיבות היסטוריות, שכנים גיאוגרפיים.",
        "4. הסחות הדעת חייבות להיות סבירות ומתחרות (לא אקראיות לגמרי), כדי שתהיה אתגר אמיתי.",
        "5. רמת קושי: בינונית עד גבוהה - שאלות שדורשות ידע, לא רק ניחוש.",
        "6. הסתמך על ידע עובדתי אמין בלבד.",
        "",
        "דוגמה לשאלה טובה על הכותל המערבי:",
        '{"question": "באיזו שנה נהרס בית המקדש השני שאת חומתו שומר הכותל?", "options": ["70 לספירה", "135 לספירה", "586 לפנה\\"ס", "63 לפנה\\"ס"], "answer": 0}',
        "",
        "דוגמה לשאלה רעה (אסורה):",
        '{"question": "מה שמו של הכותל?", "options": ["הכותל המערבי", "הכותל המזרחי", "הכותל הצפוני", "הכותל הדרומי"], "answer": 0}',
    ])
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.9,
            "responseMimeType": "application/json",
            "responseSchema": _SCHEMA,
        },
    }

    _backoff = [2, 5, 12]

    last_err = ""
    async with httpx.AsyncClient(timeout=90) as client:
        for model in MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for attempt in range(3):
                resp = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
                if resp.status_code == 200:
                    try:
                        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                        questions = [q for q in json.loads(text) if _valid(q)]
                    except (KeyError, IndexError, ValueError):
                        last_err = "parse error"
                        break
                    if questions:
                        return questions[:count]
                    last_err = "empty quiz"
                    break
                if resp.status_code in (429, 500, 503):
                    last_err = f"מודל {model} עמוס (נסיון {attempt+1}/3)"
                    await asyncio.sleep(_backoff[attempt])
                    continue
                if resp.status_code == 404:
                    last_err = f"מודל {model} לא זמין"
                    break  # עוברים למודל הבא
                if resp.status_code == 400:
                    raise RuntimeError("מפתח Gemini לא תקין. בדוק את GEMINI_API_KEY.")
                last_err = f"שגיאה ממודל {model} (קוד {resp.status_code})"
                break
    raise RuntimeError(f"Gemini עמוס כרגע - כל המודלים עסוקים. נסה שוב בעוד דקה. (פרטים: {last_err})")
