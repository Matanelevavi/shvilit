-- ===================================================
-- analytics_events: מעקב מבקרים ופעולות, כתיבה פתוחה (כולל אורחים
-- לא מחוברים), קריאה רק לאדמין. session_id מזהה מכשיר/דפדפן, לא
-- דורש התחברות - כך גם מבקרים שלא נרשמו נספרים.
-- ===================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         BIGSERIAL   PRIMARY KEY,
  session_id TEXT        NOT NULL,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT        NOT NULL,
  path       TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx ON public.analytics_events (session_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- כל אחד (כולל אורח לא מחובר) יכול לרשום אירוע - אין נתונים רגישים,
-- רק session_id אקראי, סוג אירוע, ונתיב. אין SELECT/UPDATE/DELETE
-- ציבורי, כך שאף אחד לא יכול לקרוא אירועים של מישהו אחר.
CREATE POLICY "anyone_can_insert_events" ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- רק האדמין קורא את הנתונים המצטברים (ראה supabase/migrations/0002_profiles.sql
-- להסבר למה זה בודק auth.jwt() ולא שאילתה על auth.users).
CREATE POLICY "admin_read_all_events" ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'matanelevavi@gmail.com');
