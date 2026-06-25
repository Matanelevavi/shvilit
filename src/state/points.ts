import AsyncStorage from '@react-native-async-storage/async-storage';

/** צבירת נקודות ודירוג אישי (תארים) - נשמר מקומית ומתמשך. */
const KEY = 'shvilit_points';
export const POINTS_PER_CORRECT = 10;

interface Tier {
  min: number;
  name: string;
}

const TIERS: Tier[] = [
  { min: 0, name: 'מתחיל' },
  { min: 100, name: 'מטייל' },
  { min: 300, name: 'מדריך מתלמד' },
  { min: 600, name: 'מדריך מומחה' },
  { min: 1000, name: 'אלוף שבילית' },
];

export interface Rank {
  name: string;
  points: number;
  nextName: string | null;
  pointsToNext: number;
  progress: number;
}

export async function getPoints(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function addPoints(amount: number): Promise<number> {
  const total = (await getPoints()) + amount;
  await AsyncStorage.setItem(KEY, String(total));
  return total;
}

export function getRank(points: number): Rank {
  let current = TIERS[0];
  let next: Tier | null = null;
  for (let i = 0; i < TIERS.length; i += 1) {
    if (points >= TIERS[i].min) {
      current = TIERS[i];
    } else {
      next = TIERS[i];
      break;
    }
  }
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  return {
    name: current.name,
    points,
    nextName: next ? next.name : null,
    pointsToNext: next ? next.min - points : 0,
    progress: Math.max(0, Math.min(1, progress)),
  };
}
