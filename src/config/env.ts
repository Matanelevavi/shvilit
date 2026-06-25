/**
 * קריאת קונפיגורציה ציבורית מתוך משתני סביבה (EXPO_PUBLIC_*).
 * חשוב: רק ערכים ציבוריים כאן. סודות (כמו מפתח Gemini) חיים בצד השרת בלבד.
 */

export type LlmProviderChoice = 'mock' | 'edge' | 'auto';

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** האם הוגדר Supabase תקין. */
  hasSupabase: boolean;
  /** האם להציג התחברות Google (רק לאחר שספק Google הופעל ב-Supabase). */
  googleEnabled: boolean;
  llmProvider: LlmProviderChoice;
  /** כתובת ה-backend של הפקת הווידאו (FastAPI). */
  videoApiUrl: string;
}

function readLlmChoice(raw: string | undefined): LlmProviderChoice {
  if (raw === 'mock' || raw === 'edge' || raw === 'auto') return raw;
  return 'auto';
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const config: AppConfig = {
  supabaseUrl,
  supabaseAnonKey,
  hasSupabase: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
  googleEnabled: process.env.EXPO_PUBLIC_GOOGLE_ENABLED === 'true',
  llmProvider: readLlmChoice(process.env.EXPO_PUBLIC_LLM_PROVIDER),
  videoApiUrl: (process.env.EXPO_PUBLIC_VIDEO_API_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
};

/** מחליט איזה מימוש LLM להפעיל בפועל. */
export function resolveLlmProvider(): 'mock' | 'edge' {
  if (config.llmProvider === 'mock') return 'mock';
  if (config.llmProvider === 'edge') return 'edge';
  // auto: אם יש Supabase מוגדר נשתמש ב-Edge Function, אחרת mock.
  return config.hasSupabase ? 'edge' : 'mock';
}
