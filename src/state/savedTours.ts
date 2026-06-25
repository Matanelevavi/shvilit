import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TourLengthMinutes, TourStyle } from '@/domain/types';

/**
 * שמירת סיורים מקומית ומתמשכת (AsyncStorage - עובד בנייד ובדפדפן).
 * שומרים את התסריט המלא כדי שניתן יהיה להאזין שוב גם ללא רשת.
 */
export interface SavedTour {
  poiId: string;
  title: string;
  thumbnailUrl?: string;
  minutes: TourLengthMinutes;
  style: TourStyle;
  text: string;
  attribution: string;
  savedAt: number;
}

const KEY = 'shvilit_saved_tours';

export async function getSavedTours(): Promise<SavedTour[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedTour[]) : [];
  } catch {
    return [];
  }
}

export async function isTourSaved(poiId: string): Promise<boolean> {
  const list = await getSavedTours();
  return list.some((t) => t.poiId === poiId);
}

export async function saveTour(tour: SavedTour): Promise<void> {
  const list = await getSavedTours();
  const next = [tour, ...list.filter((t) => t.poiId !== tour.poiId)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function removeSavedTour(poiId: string): Promise<void> {
  const list = await getSavedTours();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((t) => t.poiId !== poiId)));
}
