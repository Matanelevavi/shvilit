import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/auth/supabaseClient';

/**
 * אנליטיקס מינימלי: כותב אירועים ל-analytics_events ב-Supabase כדי
 * שהאדמין יראה כמה מבקרים יש ומה הם עושים - גם מבקרים שמעולם לא
 * נרשמו (session_id מזוהה במכשיר, לא דורש חשבון).
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

export interface AnalyticsSummary {
  uniqueVisitors: number;
  pageViews: number;
  totalEvents: number;
  activeVisitors24h: number;
  eventCounts: { type: string; count: number }[];
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  uniqueVisitors: 0,
  pageViews: 0,
  totalEvents: 0,
  activeVisitors24h: 0,
  eventCounts: [],
};

/**
 * מסכם אנליטיקס ל-30 הימים האחרונים (נגיש רק לאדמין לפי RLS).
 * הצטברות נעשית בצד הלקוח על עד 10,000 האירועים האחרונים - מספיק
 * בהחלט להיקף התנועה הנוכחי, בלי לכתוב view/RPC נפרד ב-SQL.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (!supabase) return EMPTY_SUMMARY;
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('analytics_events')
      .select('session_id, event_type, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10_000);
    if (error || !data) return EMPTY_SUMMARY;

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const visitors = new Set<string>();
    const activeVisitors = new Set<string>();
    const counts = new Map<string, number>();
    let pageViews = 0;

    for (const row of data as { session_id: string; event_type: string; created_at: string }[]) {
      visitors.add(row.session_id);
      if (new Date(row.created_at).getTime() >= dayAgo) activeVisitors.add(row.session_id);
      counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
      if (row.event_type === 'page_view') pageViews++;
    }

    return {
      uniqueVisitors: visitors.size,
      pageViews,
      totalEvents: data.length,
      activeVisitors24h: activeVisitors.size,
      eventCounts: [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
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
  | 'audio_play'
  | 'video_requested'
  | 'video_ready'
  | 'quiz_started'
  | 'quiz_completed';

/** רושם אירוע אנליטיקס. לא זורק ולא מחכה - קריאה "יורה ושוכחת". */
export function trackEvent(eventType: AnalyticsEvent, meta?: Record<string, unknown>, path?: string): void {
  if (!supabase) return;
  (async () => {
    try {
      const [sessionId, userRes] = await Promise.all([
        getSessionId(),
        supabase.auth.getUser().catch(() => null),
      ]);
      await supabase.from('analytics_events').insert({
        session_id: sessionId,
        user_id: userRes?.data?.user?.id ?? null,
        event_type: eventType,
        path: path ?? null,
        meta: meta ?? null,
      });
    } catch {
      // לא קריטי - אנליטיקס לעולם לא אמור לשבש את חוויית המשתמש
    }
  })();
}
