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

export const DEMO_USERS: UserEntry[] = [
  { id: 'npc_ronit',  name: 'רונית כ.',  points: 920, quizCount: 18, tourCount: 12, videoCount: 3,  joinedAt: Date.now() - 86400000 * 30, lastActive: Date.now() - 3600000,      isActive: true  },
  { id: 'npc_amir',   name: 'אמיר ג.',   points: 750, quizCount: 14, tourCount: 9,  videoCount: 2,  joinedAt: Date.now() - 86400000 * 25, lastActive: Date.now() - 7200000,      isActive: true  },
  { id: 'npc_yael',   name: 'יעל ש.',    points: 640, quizCount: 11, tourCount: 7,  videoCount: 5,  joinedAt: Date.now() - 86400000 * 20, lastActive: Date.now() - 86400000,     isActive: false },
  { id: 'npc_david',  name: 'דוד מ.',    points: 430, quizCount: 8,  tourCount: 5,  videoCount: 1,  joinedAt: Date.now() - 86400000 * 14, lastActive: Date.now() - 86400000 * 2, isActive: false },
  { id: 'npc_michal', name: 'מיכל א.',   points: 280, quizCount: 5,  tourCount: 4,  videoCount: 0,  joinedAt: Date.now() - 86400000 * 10, lastActive: Date.now() - 86400000 * 3, isActive: false },
  { id: 'npc_shai',   name: 'שי פ.',     points: 150, quizCount: 3,  tourCount: 2,  videoCount: 0,  joinedAt: Date.now() - 86400000 * 7,  lastActive: Date.now() - 86400000 * 5, isActive: false },
  { id: 'npc_noa',    name: 'נועה ר.',   points: 90,  quizCount: 2,  tourCount: 1,  videoCount: 0,  joinedAt: Date.now() - 86400000 * 4,  lastActive: Date.now() - 86400000 * 4, isActive: false },
];

export async function getAllUsers(): Promise<UserEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const realUsers: UserEntry[] = raw ? JSON.parse(raw) : [];
  const demoIds = new Set(DEMO_USERS.map((u) => u.id));
  const filteredReal = realUsers.filter((u) => !demoIds.has(u.id));
  return [...filteredReal, ...DEMO_USERS].sort((a, b) => b.points - a.points);
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
  if (id.startsWith('npc_')) return;
  const users = await getRealUsers();
  await AsyncStorage.setItem(KEY, JSON.stringify(users.filter((u) => u.id !== id)));
}

export async function resetUserPoints(id: string): Promise<void> {
  if (id.startsWith('npc_')) return;
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
