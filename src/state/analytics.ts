import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@/auth/supabaseClient';

/**
 * אנליטיקס: כותב אירועים עשירים ל-analytics_events ב-Supabase כדי
 * שהאדמין יראה לא רק כמה מבקרים יש, אלא גם מה הם עושים - גם מבקרים
 * שמעולם לא נרשמו (session_id מזוהה במכשיר, לא דורש חשבון).
 *
 * "fire and forget" בכוונה: כשל בכתיבת אנליטיקס לעולם לא אמור לשבש
 * את חוויית המשתמש, ולכן כל שגיאה נבלעת בשקט.
 */

const SESSION_ID_KEY = 'shvilit_analytics_session_v1';
let cachedSessionId: string | null = null;

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getSessionId(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  try {
    let id = await AsyncStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = randomId();
      await AsyncStorage.setItem(SESSION_ID_KEY, id);
    }
    cachedSessionId = id;
    return id;
  } catch {
    // אחסון לא זמין - session_id זמני לתהליך הנוכחי בלבד
    cachedSessionId = randomId();
    return cachedSessionId;
  }
}

/**
 * נגזרת אזור גסה מקואורדינטה - לצורך "אזורים שונים בחודש למשתמש" ומקומות
 * פופולריים לפי אזור. חלוקה מקורבת בכוונה (גבולות ישראל אינם מלבניים);
 * מספיקה לתובנת מוצר, לא למיפוי מדויק.
 */
export type Region = 'צפון' | 'חיפה והקריות' | 'מרכז' | 'ירושלים והסביבה' | 'דרום' | 'אילת';

export function regionFromCoordinate(lat: number, lon: number): Region {
  if (lat < 29.9) return 'אילת';
  if (lat < 31.4) return 'דרום';
  if (lat >= 31.6 && lat <= 31.95 && lon >= 34.95) return 'ירושלים והסביבה';
  if (lat >= 32.6 && lat <= 33.05 && lon <= 35.15) return 'חיפה והקריות';
  if (lat > 32.6) return 'צפון';
  return 'מרכז';
}

interface RawEvent {
  session_id: string;
  event_type: string;
  created_at: string;
  meta: Record<string, unknown> | null;
}

export interface Distribution {
  label: string;
  count: number;
}

export interface AnalyticsSummary {
  uniqueVisitors: number;
  pageViews: number;
  totalEvents: number;
  activeVisitors24h: number;
  eventCounts: { type: string; count: number }[];

  toursPerUser: { average: number; median: number; distribution: Distribution[] };
  regionsPerUserMonth: { average: number; median: number };
  popularPlaces: { location: string; generated: number; viewed: number }[];
  styleDistribution: Distribution[];
  lengthDistribution: Distribution[];
  funnel: { search: number; poiView: number; tourGenerated: number; engaged: number };
  zeroResultSearches: { query: string; count: number }[];
  retention: { totalSessions: number; returnedAnotherDay: number; activeLast7Days: number };
  cacheHitRate: number | null;
  platformSplit: { web: number; native: number };
  dailyActivity: { date: string; count: number }[];
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  uniqueVisitors: 0,
  pageViews: 0,
  totalEvents: 0,
  activeVisitors24h: 0,
  eventCounts: [],
  toursPerUser: { average: 0, median: 0, distribution: [] },
  regionsPerUserMonth: { average: 0, median: 0 },
  popularPlaces: [],
  styleDistribution: [],
  lengthDistribution: [],
  funnel: { search: 0, poiView: 0, tourGenerated: 0, engaged: 0 },
  zeroResultSearches: [],
  retention: { totalSessions: 0, returnedAnotherDay: 0, activeLast7Days: 0 },
  cacheHitRate: null,
  platformSplit: { web: 0, native: 0 },
  dailyActivity: [],
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function metaStr(meta: Record<string, unknown> | null, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * מסכם אנליטיקס ל-30 הימים האחרונים (נגיש רק לאדמין לפי RLS).
 * הצטברות נעשית בצד הלקוח על עד 10,000 האירועים האחרונים - מספיק
 * בהחלט להיקף התנועה הנוכחי, בלי לכתוב view/RPC נפרד ב-SQL.
 * session_id הוא יחידת "משתמש" לצורך המדדים (גם אורחים לא רשומים נספרים).
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (!supabase) return EMPTY_SUMMARY;
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('analytics_events')
      .select('session_id, event_type, created_at, meta')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10_000);
    if (error || !data) return EMPTY_SUMMARY;

    const events = data as RawEvent[];
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now).toISOString().slice(0, 7); // YYYY-MM

    const visitors = new Set<string>();
    const activeVisitors = new Set<string>();
    const counts = new Map<string, number>();
    let pageViews = 0;

    // per-session tracking
    const toursBySession = new Map<string, number>();
    const regionsThisMonthBySession = new Map<string, Set<Region>>();
    const daysActiveBySession = new Map<string, Set<string>>();
    const platformBySession = new Map<string, 'web' | 'native'>();
    const sessionsWithSearch = new Set<string>();
    const sessionsWithPoiView = new Set<string>();
    const sessionsWithTourGenerated = new Set<string>();
    const sessionsEngaged = new Set<string>(); // audio_play / video_requested / quiz_started

    const placeGenerated = new Map<string, number>();
    const placeViewed = new Map<string, number>();
    const styleCounts = new Map<string, number>();
    const lengthCounts = new Map<number, number>();
    const zeroResultQueries = new Map<string, number>();
    const dailyCounts = new Map<string, number>();
    let cacheHits = 0;
    let cacheTotal = 0;

    for (const row of events) {
      visitors.add(row.session_id);
      const ts = new Date(row.created_at).getTime();
      if (ts >= dayAgo) activeVisitors.add(row.session_id);
      counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
      if (row.event_type === 'page_view') pageViews++;

      const day = dayKey(row.created_at);
      dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
      if (!daysActiveBySession.has(row.session_id)) daysActiveBySession.set(row.session_id, new Set());
      daysActiveBySession.get(row.session_id)!.add(day);

      const platform = metaStr(row.meta, 'platform');
      if (platform === 'native' || platform === 'web') platformBySession.set(row.session_id, platform);

      const location = metaStr(row.meta, 'location');

      if (row.event_type === 'search') {
        sessionsWithSearch.add(row.session_id);
        const query = metaStr(row.meta, 'query');
        const resultsCount = row.meta?.results_count;
        if (query && typeof resultsCount === 'number' && resultsCount === 0) {
          zeroResultQueries.set(query, (zeroResultQueries.get(query) ?? 0) + 1);
        }
      }

      if (row.event_type === 'poi_view') {
        sessionsWithPoiView.add(row.session_id);
        if (location) placeViewed.set(location, (placeViewed.get(location) ?? 0) + 1);
      }

      if (row.event_type === 'tour_generated') {
        sessionsWithTourGenerated.add(row.session_id);
        toursBySession.set(row.session_id, (toursBySession.get(row.session_id) ?? 0) + 1);
        if (location) placeGenerated.set(location, (placeGenerated.get(location) ?? 0) + 1);

        const style = metaStr(row.meta, 'style');
        if (style) styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
        const minutes = row.meta?.minutes;
        if (typeof minutes === 'number') lengthCounts.set(minutes, (lengthCounts.get(minutes) ?? 0) + 1);

        const region = metaStr(row.meta, 'region') as Region | undefined;
        if (region && day.slice(0, 7) === monthStart) {
          if (!regionsThisMonthBySession.has(row.session_id)) regionsThisMonthBySession.set(row.session_id, new Set());
          regionsThisMonthBySession.get(row.session_id)!.add(region);
        }

        const cacheHit = row.meta?.cache_hit;
        if (typeof cacheHit === 'boolean') {
          cacheTotal++;
          if (cacheHit) cacheHits++;
        }
      }

      if (row.event_type === 'audio_play' || row.event_type === 'video_requested' || row.event_type === 'quiz_started') {
        sessionsEngaged.add(row.session_id);
      }
    }

    const tourCounts = [...toursBySession.values()];
    const distribution: Distribution[] = [
      { label: '1 הדרכה', count: tourCounts.filter((n) => n === 1).length },
      { label: '2-5 הדרכות', count: tourCounts.filter((n) => n >= 2 && n <= 5).length },
      { label: '6+ הדרכות', count: tourCounts.filter((n) => n >= 6).length },
    ];

    const regionCounts = [...regionsThisMonthBySession.values()].map((s) => s.size);

    const popularPlaces = [...new Set([...placeGenerated.keys(), ...placeViewed.keys()])]
      .map((location) => ({
        location,
        generated: placeGenerated.get(location) ?? 0,
        viewed: placeViewed.get(location) ?? 0,
      }))
      .sort((a, b) => b.generated + b.viewed - (a.generated + a.viewed))
      .slice(0, 10);

    const styleDistribution: Distribution[] = [...styleCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const lengthDistribution: Distribution[] = [...lengthCounts.entries()]
      .map(([minutes, count]) => ({ label: `${minutes} דקות`, count }))
      .sort((a, b) => Number(a.label) - Number(b.label));

    const zeroResultSearches = [...zeroResultQueries.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    let returnedAnotherDay = 0;
    let activeLast7Days = 0;
    for (const [sessionId, days] of daysActiveBySession.entries()) {
      if (days.size >= 2) returnedAnotherDay++;
      const sessionEvents = events.filter((e) => e.session_id === sessionId);
      if (sessionEvents.some((e) => new Date(e.created_at).getTime() >= weekAgo)) activeLast7Days++;
    }

    const platformSplit = { web: 0, native: 0 };
    for (const p of platformBySession.values()) platformSplit[p]++;
    // הצטרפות ברירת מחדל ל-web עבור sessions ללא platform (אירועים מלפני
    // ההוספה, או כשל שקט בשליחת המטא) - web הוא היעד העיקרי כרגע.
    platformSplit.web += visitors.size - platformBySession.size;

    const dailyActivity = [...dailyCounts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      uniqueVisitors: visitors.size,
      pageViews,
      totalEvents: events.length,
      activeVisitors24h: activeVisitors.size,
      eventCounts: [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      toursPerUser: {
        average: average(tourCounts),
        median: median(tourCounts),
        distribution,
      },
      regionsPerUserMonth: {
        average: average(regionCounts),
        median: median(regionCounts),
      },
      popularPlaces,
      styleDistribution,
      lengthDistribution,
      funnel: {
        search: sessionsWithSearch.size,
        poiView: sessionsWithPoiView.size,
        tourGenerated: sessionsWithTourGenerated.size,
        engaged: sessionsEngaged.size,
      },
      zeroResultSearches,
      retention: {
        totalSessions: daysActiveBySession.size,
        returnedAnotherDay,
        activeLast7Days,
      },
      cacheHitRate: cacheTotal > 0 ? Math.round((cacheHits / cacheTotal) * 100) : null,
      platformSplit,
      dailyActivity,
    };
  } catch {
    return EMPTY_SUMMARY;
  }
}

export type AnalyticsEvent =
  | 'page_view'
  | 'login_google'
  | 'login_guest'
  | 'search'
  | 'nearby_search'
  | 'poi_view'
  | 'tour_generated'
  | 'tour_saved'
  | 'audio_play'
  | 'video_requested'
  | 'video_ready'
  | 'quiz_started'
  | 'quiz_completed';

/**
 * רושם אירוע אנליטיקס. לא זורק ולא מחכה - קריאה "יורה ושוכחת".
 * platform מתווסף אוטומטית לכל אירוע - קריאות מקום לא צריכות לספק אותו.
 */
export function trackEvent(eventType: AnalyticsEvent, meta?: Record<string, unknown>, path?: string): void {
  if (!supabase) return;
  (async () => {
    try {
      const [sessionId, userRes] = await Promise.all([
        getSessionId(),
        supabase.auth.getUser().catch(() => null),
      ]);
      const platform = Platform.OS === 'web' ? 'web' : 'native';
      await supabase.from('analytics_events').insert({
        session_id: sessionId,
        user_id: userRes?.data?.user?.id ?? null,
        event_type: eventType,
        path: path ?? null,
        meta: { ...meta, platform },
      });
    } catch {
      // לא קריטי - אנליטיקס לעולם לא אמור לשבש את חוויית המשתמש
    }
  })();
}
