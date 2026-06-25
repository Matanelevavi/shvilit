/**
 * מצב המשחק המרכזי - נקודות, היסטוריה, סרטונים, jobs ממתינים.
 * כל הנתונים נשמרים מקומית ב-AsyncStorage ומתמידים בין sessions.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Keys ────────────────────────────────────────────────────────────────────
const K_POINTS = 'shvilit_points_v2';
const K_QUIZ_HISTORY = 'shvilit_quiz_history_v2';
const K_SAVED_VIDEOS = 'shvilit_saved_videos_v2';
const K_PENDING_VIDEOS = 'shvilit_pending_videos_v2';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface QuizResult {
  location: string;
  score: number;
  total: number;
  earnedPoints: number;
  date: number;
}

export interface SavedVideo {
  location: string;
  videoUrl: string;
  style: string;
  minutes: number;
  savedAt: number;
}

export interface PendingVideo {
  location: string;
  tourId: string;
  style: string;
  minutes: number;
  startedAt: number;
}

// ─── Tiers ───────────────────────────────────────────────────────────────────
export const TIERS = [
  { min: 0,    name: 'מתחיל',         emoji: '🌱' },
  { min: 100,  name: 'מטייל',         emoji: '🥾' },
  { min: 300,  name: 'מדריך מתלמד',   emoji: '🗺️' },
  { min: 600,  name: 'מדריך מומחה',   emoji: '⭐' },
  { min: 1000, name: 'אלוף שבילית',   emoji: '🏆' },
];

export const POINTS_PER_CORRECT = 10;

export interface Rank {
  name: string;
  emoji: string;
  points: number;
  nextName: string | null;
  pointsToNext: number;
  progress: number;
}

export function getRank(points: number): Rank {
  let current = TIERS[0];
  let next: typeof TIERS[0] | null = null;
  for (const tier of TIERS) {
    if (points >= tier.min) current = tier;
    else if (!next) next = tier;
  }
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  return {
    name: current.name,
    emoji: current.emoji,
    points,
    nextName: next?.name ?? null,
    pointsToNext: next ? next.min - points : 0,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

// ─── Points ──────────────────────────────────────────────────────────────────
export async function getPoints(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(K_POINTS);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch { return 0; }
}

export async function addPoints(amount: number): Promise<number> {
  const total = (await getPoints()) + amount;
  await AsyncStorage.setItem(K_POINTS, String(total));
  return total;
}

// ─── Quiz history ─────────────────────────────────────────────────────────────
export async function getQuizHistory(): Promise<QuizResult[]> {
  try {
    const raw = await AsyncStorage.getItem(K_QUIZ_HISTORY);
    return raw ? (JSON.parse(raw) as QuizResult[]) : [];
  } catch { return []; }
}

export async function isQuizDone(location: string): Promise<boolean> {
  const history = await getQuizHistory();
  return history.some((r) => r.location === location);
}

export async function saveQuizResult(result: QuizResult): Promise<void> {
  const history = await getQuizHistory();
  // אם כבר קיים - מחליף ברשומה החדשה (לראות את התוצאה האחרונה)
  const next = [result, ...history.filter((r) => r.location !== result.location)];
  await AsyncStorage.setItem(K_QUIZ_HISTORY, JSON.stringify(next));
}

// ─── Saved videos ─────────────────────────────────────────────────────────────
export async function getSavedVideos(): Promise<SavedVideo[]> {
  try {
    const raw = await AsyncStorage.getItem(K_SAVED_VIDEOS);
    return raw ? (JSON.parse(raw) as SavedVideo[]) : [];
  } catch { return []; }
}

export async function isVideoSaved(location: string): Promise<boolean> {
  const list = await getSavedVideos();
  return list.some((v) => v.location === location);
}

export async function saveVideo(video: SavedVideo): Promise<void> {
  const list = await getSavedVideos();
  const next = [video, ...list.filter((v) => v.location !== video.location)];
  await AsyncStorage.setItem(K_SAVED_VIDEOS, JSON.stringify(next));
}

export async function removeSavedVideo(location: string): Promise<void> {
  const list = await getSavedVideos();
  await AsyncStorage.setItem(K_SAVED_VIDEOS, JSON.stringify(list.filter((v) => v.location !== location)));
}

// ─── Pending videos (background generation jobs) ─────────────────────────────
export async function getPendingVideos(): Promise<PendingVideo[]> {
  try {
    const raw = await AsyncStorage.getItem(K_PENDING_VIDEOS);
    return raw ? (JSON.parse(raw) as PendingVideo[]) : [];
  } catch { return []; }
}

export async function addPendingVideo(pending: PendingVideo): Promise<void> {
  const list = await getPendingVideos();
  const next = [pending, ...list.filter((v) => v.location !== pending.location)];
  await AsyncStorage.setItem(K_PENDING_VIDEOS, JSON.stringify(next));
}

export async function removePendingVideo(location: string): Promise<void> {
  const list = await getPendingVideos();
  await AsyncStorage.setItem(K_PENDING_VIDEOS, JSON.stringify(list.filter((v) => v.location !== location)));
}
