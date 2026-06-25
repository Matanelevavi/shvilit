import type { TourRequest, TourScript } from '@/domain/types';
import { countWords, minutesToTargetWords } from '@/domain/tourLength';
import { config } from '@/config/env';
import type { LLMProvider } from './LLMProvider';

/**
 * קורא ל-Edge Function המאובטחת ב-Supabase (generate-tour) שמפעילה את Gemini.
 * מפתח Gemini *לעולם* לא נמצא כאן - הוא סוד בצד השרת.
 * הקריאה דורשת JWT של משתמש מחובר (אכיפת הרשאה במכסה).
 */
export class EdgeFunctionLLMProvider implements LLMProvider {
  async generateTourScript(
    request: TourRequest,
    accessToken?: string,
  ): Promise<TourScript> {
    if (!config.hasSupabase) {
      throw new Error('Supabase לא הוגדר. בדוק את EXPO_PUBLIC_SUPABASE_URL ו-ANON_KEY.');
    }
    if (!accessToken) {
      throw new Error('נדרשת התחברות לפני יצירת סיור.');
    }

    const { poi, minutes, style } = request;
    const url = `${config.supabaseUrl}/functions/v1/generate-tour`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: poi.title,
        sourceText: poi.summary,
        minutes,
        targetWords: minutesToTargetWords(minutes),
        style,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`יצירת הסיור נכשלה (${res.status}). ${detail}`);
    }

    const data = (await res.json()) as { script?: string };
    const text = data.script?.trim();
    if (!text) {
      throw new Error('השרת החזיר תסריט ריק.');
    }

    return {
      poiId: poi.id,
      title: poi.title,
      style,
      minutes,
      text,
      wordCount: countWords(text),
      source: 'gemini',
      attribution: 'מבוסס על ויקיפדיה, נכתב על ידי Gemini',
    };
  }
}
