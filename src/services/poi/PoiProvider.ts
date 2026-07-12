import type { Coordinate, Poi } from '@/domain/types';

/**
 * ספק נקודות עניין. ה-UI מדבר רק עם ה-interface הזה,
 * כך שניתן להחליף מקור נתונים (ויקיפדיה / מסחרי) בלי לגעת במסכים.
 */
export interface PoiProvider {
  /**
   * שליפת נקודות עניין סביב קואורדינטה.
   * @param center מרכז החיפוש
   * @param radiusMeters רדיוס בחיפוש במטרים (ברירת מחדל 10 ק"מ)
   * @param limit מספר תוצאות מרבי
   */
  search(center: Coordinate, radiusMeters?: number, limit?: number): Promise<Poi[]>;

  /**
   * שליפת טקסט הערך המלא (לא רק התקציר) עבור נקודה אחת,
   * לשימוש כהקשר עשיר ליצירת תסריט הסיור.
   */
  fetchArticleText(id: string): Promise<string>;

  /**
   * תקציר מורחב (כ-200-300 מילה) להצגה בלחיצה על התיאור הקצר -
   * ביניים בין התקציר הראשוני (2-4 משפטים) לערך המלא.
   */
  fetchExtendedSummary(id: string): Promise<string>;

  /**
   * חיפוש מקומות לפי שם חופשי (גם מקומות רחוקים), לא לפי מיקום.
   */
  searchByName(query: string, limit?: number): Promise<Poi[]>;
}
