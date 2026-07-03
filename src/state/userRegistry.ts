import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'shvilit_users_v1';
const ADMIN_KEY = 'shvilit_admin_unlocked';

export interface UserEntry {
  id: string;
  name: string;
  email?: string;
  isAdmin?: boolean;
  points: number;
  quizCount: number;
  tourCount: number;
  videoCount: number;
  joinedAt: number;
  lastActive: number;
  isActive: boolean;
}

/** כל המשתמשים ברג'יסטרי המקומי, ממוינים לפי נקודות. משתמשים אמיתיים בלבד. */
export async function getAllUsers(): Promise<UserEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const users: UserEntry[] = raw ? JSON.parse(raw) : [];
  // ניקוי רשומות npc ישנות שנשמרו בגרסאות קודמות
  return users.filter((u) => !u.id.startsWith('npc_')).sort((a, b) => b.points - a.points);
}

export async function getRealUsers(): Promise<UserEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function upsertUser(entry: UserEntry): Promise<void> {
  const users = await getRealUsers();
  const idx = users.findIndex((u) => u.id === entry.id);
  if (idx >= 0) { users[idx] = entry; } else { users.push(entry); }
  await AsyncStorage.setItem(KEY, JSON.stringify(users));
}

export async function deleteUser(id: string): Promise<void> {
  const users = await getRealUsers();
  await AsyncStorage.setItem(KEY, JSON.stringify(users.filter((u) => u.id !== id)));
}

export async function resetUserPoints(id: string): Promise<void> {
  const users = await getRealUsers();
  const u = users.find((u) => u.id === id);
  if (u) { u.points = 0; await AsyncStorage.setItem(KEY, JSON.stringify(users)); }
}

export async function isAdminUnlocked(): Promise<boolean> {
  return (await AsyncStorage.getItem(ADMIN_KEY)) === 'true';
}

export async function unlockAdmin(): Promise<void> {
  await AsyncStorage.setItem(ADMIN_KEY, 'true');
}

export function formatLastActive(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'עכשיו';
  if (m < 60) return `לפני ${m} דק'`;
  if (h < 24) return `לפני ${h} שע'`;
  return `לפני ${d} ימים`;
}
