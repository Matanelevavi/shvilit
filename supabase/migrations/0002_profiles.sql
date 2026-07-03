-- ===================================================
-- profiles table: מידע על כל משתמש שנכנס עם Google
-- ===================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  name        TEXT,
  is_admin    BOOLEAN     NOT NULL DEFAULT FALSE,
  points      INTEGER     NOT NULL DEFAULT 0,
  quiz_count  INTEGER     NOT NULL DEFAULT 0,
  tour_count  INTEGER     NOT NULL DEFAULT 0,
  video_count INTEGER     NOT NULL DEFAULT 0,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===================================================
-- RLS policies
-- הערה: בדיקת האדמין נעשית דרך auth.jwt() (ה-claims של ה-token)
-- ולא דרך שאילתה על auth.users - ל-role authenticated אין הרשאת
-- SELECT על auth.users, ושאילתה כזו מפילה כל query על profiles.
-- ===================================================

-- משתמש מחובר רואה ועורך רק את עצמו
CREATE POLICY "users_own_profile" ON public.profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- אדמין רואה את כל הפרופילים
CREATE POLICY "admin_read_all" ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'matanelevavi@gmail.com');

-- אדמין יכול לעדכן כל פרופיל (למשל איפוס נקודות)
CREATE POLICY "admin_update_all" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'matanelevavi@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'matanelevavi@gmail.com');

-- ===================================================
-- Trigger: מגן על העמודות email ו-is_admin.
-- בלעדיו, כל משתמש מחובר יכול לכתוב is_admin=true לשורה של עצמו
-- (ה-WITH CHECK בודק רק בעלות על השורה, לא ערכי עמודות).
-- הערכים נכפים תמיד מ-auth.users, לא ממה שהלקוח שלח.
-- ===================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT u.email INTO NEW.email FROM auth.users u WHERE u.id = NEW.id;
  NEW.is_admin := (NEW.email = 'matanelevavi@gmail.com');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_identity ON public.profiles;
CREATE TRIGGER enforce_profile_identity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_identity();

-- ===================================================
-- Trigger: יוצר פרופיל אוטומטית בכניסה ראשונה
-- ===================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.email = 'matanelevavi@gmail.com'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
