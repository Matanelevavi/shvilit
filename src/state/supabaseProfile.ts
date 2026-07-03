import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/auth/supabaseClient';

export const ADMIN_EMAIL = 'matanelevavi@gmail.com';

// כמה נקודות כבר סונכרנו לענן - הבסיס לחישוב הדלתא בסנכרון הבא.
const SYNCED_POINTS_KEY = 'shvilit_synced_points_v1';

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

export interface LeaderboardRow {
  id: string;
  name: string | null;
  points: number;
}

/**
 * מסנכרן את נתוני המשתמש הנוכחי לטבלת profiles.
 *
 * הנקודות מסונכרנות בשיטת דלתא והענן הוא מקור האמת:
 *   newCloud = cloudPoints + (localPoints - lastSyncedPoints)
 * כך גם מכשיר חדש לא דורס את הענן (דלתא 0 - הוא מאמץ את ערך הענן),
 * וגם איפוס נקודות של אדמין מחזיק - המכשיר של המשתמש מאמץ את ה-0
 * במקום להעלות חזרה את הערך הישן.
 *
 * מחזיר את ערך הנקודות העדכני מהענן (אם שונה מהמקומי - על הקורא לאמץ אותו).
 */
export async function syncProfileToSupabase(data: {
  name?: string;
  points: number;
  quizCount: number;
  tourCount: number;
  videoCount: number;
}): Promise<{ points: number } | null> {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: existing }, lastSyncedRaw] = await Promise.all([
      supabase
        .from('profiles')
        .select('points, quiz_count, tour_count, video_count')
        .eq('id', user.id)
        .maybeSingle(),
      AsyncStorage.getItem(SYNCED_POINTS_KEY),
    ]);

    const lastSynced = Number(lastSyncedRaw) || 0;
    const delta = Math.max(0, data.points - lastSynced);
    const newPoints = (existing?.points ?? 0) + delta;

    const { error } = await supabase.from('profiles').upsert(
      {
        id:          user.id,
        name:        data.name
                     || user.user_metadata?.full_name
                     || user.email?.split('@')[0]
                     || null,
        points:      newPoints,
        quiz_count:  Math.max(data.quizCount,  existing?.quiz_count  ?? 0),
        tour_count:  Math.max(data.tourCount,  existing?.tour_count  ?? 0),
        video_count: Math.max(data.videoCount, existing?.video_count ?? 0),
        last_active: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) return null;

    await AsyncStorage.setItem(SYNCED_POINTS_KEY, String(newPoints));
    return { points: newPoints };
  } catch {
    // שגיאת רשת - לא קריטי, יסונכרן בפוקוס הבא
    return null;
  }
}

/** מחזיר את כל הפרופילים (נגיש רק לאדמין לפי RLS; לאחרים תוחזר רק השורה שלהם). */
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

/** לוח תוצאות ציבורי (view ללא מיילים) - נגיש לכל המשתמשים כולל אורחים. */
export async function getCloudLeaderboard(): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('points', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as LeaderboardRow[];
  } catch {
    return [];
  }
}

/** מאפס נקודות של משתמש. מחזיר שגיאה אם RLS חסם או שהעדכון לא תפס שורה. */
export async function resetProfilePoints(userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase לא מחובר' };
  const { data, error } = await supabase
    .from('profiles')
    .update({ points: 0 })
    .eq('id', userId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'אין הרשאה לעדכן משתמש זה' };
  return { error: null };
}

/**
 * מוחק משתמש ענן לצמיתות דרך Edge Function (admin-delete-user).
 * המחיקה רצה בשרת עם service_role - הפונקציה מאמתת שהקורא הוא האדמין.
 */
export async function deleteCloudUser(userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase לא מחובר' };
  try {
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: String(data.error) };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שגיאת רשת' };
  }
}
