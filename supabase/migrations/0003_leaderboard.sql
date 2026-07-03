-- ===================================================
-- לוח תוצאות ציבורי: view שחושף רק שם ונקודות (בלי מיילים),
-- נגיש לכל המשתמשים כולל אורחים. ה-view רץ בהרשאות הבעלים
-- ולכן עוקף את ה-RLS של profiles - בכוונה, רק לעמודות האלו.
-- ===================================================

CREATE OR REPLACE VIEW public.leaderboard AS
  SELECT id, name, points
  FROM public.profiles
  ORDER BY points DESC;

GRANT SELECT ON public.leaderboard TO authenticated, anon;
