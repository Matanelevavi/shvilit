-- סכמת Supabase לטבלת ה-cache של סיורי הווידאו.
-- בשלב המקומי הנוכחי משתמשים ב-SQLite (app/cache.py) עם אותו מבנה.
-- כשיהיה service_role key, מריצים את זה ב-Supabase ומחליפים את שכבת ה-cache.

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  location text not null,
  duration_minutes int not null,
  style text not null,
  status text not null default 'processing',   -- processing | completed | failed
  video_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location, duration_minutes, style)
);

create index if not exists tours_lookup_idx
  on public.tours (location, duration_minutes, style);

-- RLS: קריאה ציבורית (לצפייה בסיורים מוכנים); כתיבה רק דרך ה-backend עם
-- service_role key (שעוקף RLS), כך שלקוחות לא יכולים לזייף רשומות.
alter table public.tours enable row level security;

create policy "tours_public_read"
  on public.tours for select
  using (true);

-- Storage: צור bucket ציבורי בשם 'tour-videos' (Dashboard -> Storage -> New bucket, Public).
-- ה-backend יעלה אליו את קובצי ה-mp4 ויקבל public URL.
