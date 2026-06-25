/**
 * המרת אורך סיור (דקות) ליעד מספר מילים, ולהפך.
 * מבוסס על קצב דיבור אופייני בעברית.
 */
import type { TourLengthMinutes } from './types';

/** קצב דיבור ממוצע (מילים לדקה). */
export const WORDS_PER_MINUTE = 150;

/** סטייה מותרת מהיעד (אחוז), לבדיקות איכות. */
export const WORD_COUNT_TOLERANCE = 0.2;

/** דקות -> מספר מילים יעד. */
export function minutesToTargetWords(minutes: TourLengthMinutes): number {
  return minutes * WORDS_PER_MINUTE;
}

/** ספירת מילים בטקסט עברי/לטיני (מפריד על רווחים). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** האם ספירת המילים נמצאת בטווח הסביר סביב היעד. */
export function isWithinTargetTolerance(
  wordCount: number,
  minutes: TourLengthMinutes,
): boolean {
  const target = minutesToTargetWords(minutes);
  const delta = Math.abs(wordCount - target) / target;
  return delta <= WORD_COUNT_TOLERANCE;
}
