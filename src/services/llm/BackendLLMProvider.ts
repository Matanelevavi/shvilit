import type { TourRequest, TourScript } from '@/domain/types';
import { countWords } from '@/domain/tourLength';
import { config } from '@/config/env';
import type { LLMProvider } from './LLMProvider';
import { MockLLMProvider } from './MockLLMProvider';

/**
 * תסריטי סיור מ-Gemini דרך ה-backend (אותו שרת שמפיק את הווידאו).
 * המפתח של Gemini נשאר בשרת. אין צורך בהתחברות - עובד גם לאורחים.
 *
 * אם השרת לא זמין (ישן/תקלה) - נופלים חזרה ל-Mock המקומי, כך שהמשתמש
 * תמיד מקבל סיור ולא נתקע מול כפתור שנראה כאילו עובד ולא קורה כלום.
 */
export class BackendLLMProvider implements LLMProvider {
  private mock = new MockLLMProvider();

  async generateTourScript(request: TourRequest, _accessToken?: string): Promise<TourScript> {
    const { poi, minutes, style } = request;
    try {
      const res = await fetch(`${config.videoApiUrl}/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: poi.title, minutes, style }),
        signal: AbortSignal.timeout?.(150_000),
      });
      if (!res.ok) throw new Error(`script api ${res.status}`);
      const data = (await res.json()) as { script?: string };
      const text = data.script?.trim();
      if (!text) throw new Error('empty script');

      return {
        poiId: poi.id,
        title: poi.title,
        style,
        minutes,
        text,
        wordCount: countWords(text),
        source: 'gemini',
        attribution: 'נכתב על ידי Gemini',
      };
    } catch {
      return this.mock.generateTourScript(request);
    }
  }
}
