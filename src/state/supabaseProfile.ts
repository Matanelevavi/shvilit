import { supabase } from '@/auth/supabaseClient';

export const ADMIN_EMAIL = 'matanelevavi@gmail.com';

export interface SupabaseProfile {
  id: string;
  email: string | null;
  name: string | null;
  is_admin: boolean;
  points: number;
  quiz_count: number;
  tour_count: number;
  video_count: number;
  joined_at: string;
  last_active: string;
}

/**
 * מסנכרן את נתוני הפעילות של המשתמש הנוכחי לטבלת profiles.
 * מיזוג "כלפי מעלה" בלבד: לוקח את המקסימום בין הערך המקומי לערך בענן,
 * כדי שמכשיר חדש (נתונים מקומיים 0) לא ידרוס את הנקודות שנצברו בענן.
 * העמודות email/is_admin נכפות בצד השרת (trigger) ולכן לא נשלחות.
 */
export async function syncProfileToSupabase(data: {
  name?: string;
  points: number;
  quizCount: number;
  tourCount: number;
  videoCount: number;
}): Promise<void> {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from('profiles')
      .select('points, quiz_count, tour_count, video_count')
      .eq('id', user.id)
      .maybeSingle();

    await supabase.from('profiles').upsert(
      {
        id:          user.id,
        name:        data.name
                     || user.user_metadata?.full_name
                     || user.email?.split('@')[0]
                     || null,
        points:      Math.max(data.points,     existing?.points      ?? 0),
        quiz_count:  Math.max(data.quizCount,  existing?.quiz_count  ?? 0),
        tour_count:  Math.max(data.tourCount,  existing?.tour_count  ?? 0),
        video_count: Math.max(data.videoCount, existing?.video_count ?? 0),
        last_active: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  } catch {
    // שגיאת רשת - לא קריטי, יסונכרן בפוקוס הבא
  }
}

/** מחזיר את כל הפרופילים (נגיש רק לאדמין לפי RLS; לאחרים יוחזרו רק הם עצמם). */
export async function getAllProfiles(): Promise<SupabaseProfile[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('points', { ascending: false });
    if (error || !data) return [];
    return data as SupabaseProfile[];
  } catch {
    return [];
  }
}

/** מאפס נקודות של משתמש. מחזיר שגיאה אם RLS חסם או שהעדכון לא תפס שורה. */
export async function resetProfilePoints(userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase לא מחובר' };
  const { data, error } = await supabase
    .from('profiles')
    .update({ points: 0, quiz_count: 0 })
    .eq('id', userId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'אין הרשאה לעדכן משתמש זה' };
  return { error: null };
}
