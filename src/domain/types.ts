/**
 * טיפוסי הליבה של "שבילית".
 * כל השכבות (UI, services, backend) מדברות דרך הטיפוסים האלה.
 */

/** קואורדינטה גיאוגרפית. */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** נקודת עניין (Point of Interest) שנשלפה מוויקיפדיה. */
export interface Poi {
  /** מזהה יציב (pageid של ויקיפדיה כמחרוזת). */
  id: string;
  title: string;
  /** תקציר טקסטואלי (extract) מוויקיפדיה. */
  summary: string;
  /** תמונת תצוגה מקדימה, אם קיימת. */
  thumbnailUrl?: string;
  coordinate: Coordinate;
  /** קישור לערך המקור בוויקיפדיה. */
  sourceUrl: string;
}

/** סגנון נרטיבי לסיור. */
export type TourStyle = 'historical' | 'mystery' | 'kids';

/** אורכי סיור נתמכים (בדקות). */
export type TourLengthMinutes = 3 | 5 | 10;

/** בקשה ליצירת סיור. */
export interface TourRequest {
  poi: Poi;
  minutes: TourLengthMinutes;
  style: TourStyle;
}

/** מקור התסריט שנוצר. */
export type TourSource = 'mock' | 'gemini';

/** תסריט סיור מוכן להשמעה. */
export interface TourScript {
  poiId: string;
  title: string;
  style: TourStyle;
  minutes: TourLengthMinutes;
  /** גוף התסריט בעברית. */
  text: string;
  wordCount: number;
  source: TourSource;
  /** ייחוס מקור להצגה למשתמש (שקיפות, לא להציג דיוק שלא קיים). */
  attribution: string;
  /** האם הוגש מהקאש הקבוע ב-Supabase (לשימוש באנליטיקס: חיסכון בטוקנים). */
  cacheHit?: boolean;
}

/** תווית עברית לכל סגנון, לשימוש ב-UI. */
export const TOUR_STYLE_LABELS: Record<TourStyle, string> = {
  historical: 'היסטורי',
  mystery: 'מתח ומסתורין',
  kids: 'לילדים',
};

export const TOUR_STYLES: TourStyle[] = ['historical', 'mystery', 'kids'];
export const TOUR_LENGTHS: TourLengthMinutes[] = [3, 5, 10];
