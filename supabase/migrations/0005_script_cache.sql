-- ===================================================
-- קאש תוכן קבוע (תסריטים, נקודות מרכזיות, חידונים).
-- מחליף את ה-SQLite המקומי שעל HuggingFace עבור תוכן טקסטואלי:
-- Supabase שורד restart/rebuild של ה-Space, כך שתוכן שנוצר פעם
-- אחת מוגש לכל המשתמשים לתמיד ("חבל על הטוקנים").
--
-- prompt_version: כל שיפור עתידי בפרומפט מעלה את הגרסה ב-backend
-- (backend/app/config.py), וכך רשומות ישנות מפסיקות להיות מוגשות
-- בלי צורך למחוק אותן.
--
-- אין policies ציבוריים: הגישה היחידה היא מה-backend עם service
-- role key (שעוקף RLS). האפליקציה עצמה לא ניגשת לטבלאות האלה.
-- ===================================================

-- תסריטי הדרכה: וריאנט לכל שילוב מקום+אורך+סגנון+גרסת פרומפט.
CREATE TABLE IF NOT EXISTS public.script_cache (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key   TEXT        NOT NULL,
  minutes        INT         NOT NULL,
  style          TEXT        NOT NULL,
  prompt_version INT         NOT NULL,
  script         TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_key, minutes, style, prompt_version)
);

-- נקודות מרכזיות על מקום: רשומה אחת פר מקום (לא תלוי אורך/סגנון).
CREATE TABLE IF NOT EXISTS public.place_highlights (
  location_key   TEXT        NOT NULL,
  prompt_version INT         NOT NULL,
  highlights     JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (location_key, prompt_version)
);

-- חידונים: הועברו מה-SQLite המקומי כדי לשרוד restart.
CREATE TABLE IF NOT EXISTS public.quiz_cache (
  location_key TEXT        PRIMARY KEY,
  questions    JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.script_cache     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_cache       ENABLE ROW LEVEL SECURITY;
