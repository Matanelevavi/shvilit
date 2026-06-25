import type { TourRequest, TourScript } from '@/domain/types';

/**
 * ספק מודל שפה ליצירת תסריט הסיור.
 * המימושים: MockLLMProvider (מקומי, ללא רשת) ו-EdgeFunctionLLMProvider (Gemini דרך Supabase).
 */
export interface LLMProvider {
  /**
   * הפקת תסריט סיור בעברית לפי אורך וסגנון.
   * @param request פרטי נקודת העניין, אורך וסגנון
   * @param accessToken JWT של המשתמש המחובר (נדרש למימוש ה-Edge Function)
   */
  generateTourScript(request: TourRequest, accessToken?: string): Promise<TourScript>;
}
