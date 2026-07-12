import { config } from '@/config/env';

export interface PlaceHighlight {
  emoji: string;
  text: string;
}

/**
 * 4-5 נקודות מרכזיות על מקום, להצגה במבט-על לפני התוכן המלא.
 * כשל (רשת/שרת) לא קריטי - מחזיר רשימה ריקה והמסך פשוט לא מציג את הקוביה.
 */
export async function requestHighlights(location: string, sourceText?: string): Promise<PlaceHighlight[]> {
  try {
    const res = await fetch(`${config.videoApiUrl}/place-highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, source_text: sourceText ?? '' }),
      signal: AbortSignal.timeout?.(20_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { highlights?: PlaceHighlight[] };
    return data.highlights ?? [];
  } catch {
    return [];
  }
}
