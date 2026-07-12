import { config } from '@/config/env';
import type { TourLengthMinutes, TourStyle } from '@/domain/types';

export interface VideoTour {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  video_url?: string | null;
  error?: string | null;
}

/**
 * fetch עם retry אוטומטי לשגיאות רשת (cold start של HF Space).
 * מחכה 4 שניות בין ניסיונות.
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('שגיאת רשת - ודא שהשרת פועל');
}

export async function requestVideoTour(
  location: string,
  minutes: TourLengthMinutes,
  style: TourStyle,
  sourceText?: string,
): Promise<VideoTour> {
  const res = await fetchWithRetry(`${config.videoApiUrl}/generate-tour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // sourceText מעגן את התסריט בעובדות אמיתיות מוויקיפדיה - בלעדיו
    // Gemini "משלים" בביטחון פרטים שלא היו, במיוחד במקומות פחות מוכרים.
    body: JSON.stringify({ location, duration_minutes: minutes, style, source_text: sourceText ?? '' }),
  });
  if (!res.ok) {
    throw new Error(`שרת הווידאו החזיר ${res.status}`);
  }
  return res.json();
}

export async function getVideoTour(id: string): Promise<VideoTour> {
  const res = await fetch(`${config.videoApiUrl}/tour/${id}`, { signal: AbortSignal.timeout?.(15_000) });
  if (!res.ok) {
    const err = new Error(`שרת הווידאו החזיר ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}
