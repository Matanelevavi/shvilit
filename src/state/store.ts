import type { Poi, TourScript } from '@/domain/types';

/**
 * מאגר זיכרון פשוט (in-memory) להעברת אובייקטים בין מסכים.
 * expo-router מעביר רק פרמטרים פשוטים ב-URL, לכן את ה-Poi וה-TourScript
 * המלאים שומרים כאן ושולפים לפי id. נמחק בעת סגירת האפליקציה (זה בכוונה - MVP).
 */

const poiById = new Map<string, Poi>();
const tourByPoiId = new Map<string, TourScript>();

export function cachePois(pois: Poi[]): void {
  for (const poi of pois) poiById.set(poi.id, poi);
}

export function getCachedPoi(id: string): Poi | undefined {
  return poiById.get(id);
}

export function cacheTour(tour: TourScript): void {
  tourByPoiId.set(tour.poiId, tour);
}

export function getCachedTour(poiId: string): TourScript | undefined {
  return tourByPoiId.get(poiId);
}
