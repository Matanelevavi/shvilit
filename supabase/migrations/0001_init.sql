-- טבלת סיורים שמורים. כל סיור שייך למשתמש שיצר אותו.
-- Row Level Security מבטיח שמשתמש ניגש אך ורק לשורות שלו.

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  poi_id text not null,
  title text not null,
  style text not null,
  minutes int not null,
  text text not null,
  word_count int not null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists tours_user_id_idx on public.tours (user_id);
create index if not exists tours_poi_id_idx on public.tours (poi_id);

-- הפעלת RLS
alter table public.tours enable row level security;

-- מדיניות: משתמש קורא רק את הסיורים שלו
create policy "tours_select_own"
  on public.tours for select
  using (auth.uid() = user_id);

-- מדיניות: משתמש יוצר סיור רק בשמו שלו
create policy "tours_insert_own"
  on public.tours for insert
  with check (auth.uid() = user_id);

-- מדיניות: משתמש מוחק רק את הסיורים שלו
create policy "tours_delete_own"
  on public.tours for delete
  using (auth.uid() = user_id);
