import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalProfile } from '@/auth/LocalProfile';
import { useAuth } from '@/auth/AuthProvider';
import { config } from '@/config/env';
import {
  getPoints, setPoints as persistPoints, getRank, getQuizHistory, getSavedVideos,
  removeSavedVideo, POINTS_PER_CORRECT, TIERS,
  type QuizResult, type SavedVideo,
} from '@/state/gameState';
import { getSavedTours, removeSavedTour, type SavedTour } from '@/state/savedTours';
import { cachePois, cacheTour } from '@/state/store';
import { countWords } from '@/domain/tourLength';
import { TOUR_STYLE_LABELS } from '@/domain/types';
import { wikiImage } from '@/ui/wikiImage';
import { theme } from '@/ui/theme';
import { upsertUser, deleteUser, isAdminUnlocked } from '@/state/userRegistry';
import {
  syncProfileToSupabase, getCloudLeaderboard, ADMIN_EMAIL,
  type LeaderboardRow,
} from '@/state/supabaseProfile';

interface BoardEntry { name: string; points: number; isMe: boolean }

/**
 * לוח תוצאות: משתמשים אמיתיים מהענן (view ציבורי בלי מיילים).
 * אם המשתמש הנוכחי לא מופיע שם (אורח מקומי) - מוסיפים אותו מקומית.
 */
function buildLeaderboard(
  cloud: LeaderboardRow[],
  myId: string | null,
  myName: string,
  myPoints: number,
): BoardEntry[] {
  const rows: BoardEntry[] = cloud.map((r) => ({
    name: r.name ?? 'מטייל',
    points: r.points,
    isMe: myId !== null && r.id === myId,
  }));
  if (!rows.some((r) => r.isMe)) {
    rows.push({ name: myName, points: myPoints, isMe: true });
  }
  return rows.sort((a, b) => b.points - a.points);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

type Tab = 'quiz' | 'tours' | 'videos' | 'board';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'quiz',   icon: 'help-circle-outline', label: 'חידונים' },
  { key: 'tours',  icon: 'headset-outline',      label: 'סיורים' },
  { key: 'videos', icon: 'videocam-outline',     label: 'סרטונים' },
  { key: 'board',  icon: 'trophy-outline',        label: 'לוח' },
];

function RankBar({ progress, nextName, pointsToNext }: { progress: number; nextName: string | null; pointsToNext: number }) {
  return (
    <View style={styles.rankBarWrap}>
      <View style={styles.rankBarTrack}>
        <View style={[styles.rankBarFill, { width: `${Math.round(progress * 100)}%` as any }]} />
      </View>
      {nextName ? (
        <Text style={styles.rankBarLabel}>עוד {pointsToNext} נקודות לתואר "{nextName}"</Text>
      ) : (
        <Text style={styles.rankBarLabel}>הגעת לדרגה הגבוהה ביותר!</Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, clearProfile } = useLocalProfile();
  const { user, signOut } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [points, setPoints] = useState(0);
  const [cloudBoard, setCloudBoard] = useState<LeaderboardRow[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [savedTours, setSavedTours] = useState<SavedTour[]>([]);
  const validTabs: Tab[] = ['quiz', 'tours', 'videos', 'board'];
  const initialTab: Tab = validTabs.includes(params.tab as Tab) ? (params.tab as Tab) : 'quiz';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [adminEnabled, setAdminEnabled] = useState(false);

  const load = useCallback(async () => {
    const [pts, quizzes, videos, tours] = await Promise.all([
      getPoints(), getQuizHistory(), getSavedVideos(), getSavedTours(),
    ]);
    setPoints(pts);
    setQuizHistory(quizzes);
    setSavedVideos(videos);
    setSavedTours(tours);

    // admin: לפי מייל Google (המסמך המחייב הוא ה-RLS בשרת; זה רק לתצוגת התפריט)
    // או לפי פתיחת מצב מפתח מקומית (7 הקשות במסך אודות)
    const adminByUnlock = await isAdminUnlocked();
    setAdminEnabled(user?.email === ADMIN_EMAIL || adminByUnlock);

    // שם להצגה: Google name > local profile > 'שחקן'
    const displayName = user?.user_metadata?.full_name || profile?.name || 'שחקן';
    const legacyLocalId = profile
      ? profile.name.replace(/\s+/g, '_').toLowerCase() + '_local'
      : null;

    // סנכרון לרג'יסטרי המקומי
    if (profile || user) {
      await upsertUser({
        id: user?.id ?? legacyLocalId!,
        name: displayName,
        email: user?.email,
        points: pts,
        quizCount: quizzes.length,
        tourCount: tours.length,
        videoCount: videos.length,
        joinedAt: Date.now() - 86400000,
        lastActive: Date.now(),
        isActive: true,
      });
      // מי שהתחבר עם Google אחרי ששיחק כאורח - מוחקים את הרשומה הישנה
      // כדי שלא יופיע פעמיים בפאנל הניהול
      if (user && legacyLocalId) {
        await deleteUser(legacyLocalId);
      }
    }

    // סנכרון לסופאבייס (אם המשתמש מחובר עם Google).
    // הענן הוא מקור האמת לנקודות - אם הערך שחזר שונה (למשל אחרי
    // איפוס אדמין או כניסה ממכשיר חדש), מאמצים אותו מקומית.
    if (user) {
      const synced = await syncProfileToSupabase({
        name: displayName,
        points: pts,
        quizCount: quizzes.length,
        tourCount: tours.length,
        videoCount: videos.length,
      });
      if (synced && synced.points !== pts) {
        await persistPoints(synced.points);
        setPoints(synced.points);
      }
    }

    // לוח תוצאות: משתמשים אמיתיים מהענן (נטען אחרי הסנכרון כדי שנופיע בו)
    setCloudBoard(await getCloudLeaderboard());
  }, [profile, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rank = getRank(points);
  const myName = user?.user_metadata?.full_name || profile?.name || 'אני';
  const leaderboard = buildLeaderboard(cloudBoard, user?.id ?? null, myName, points);

  const openTour = (t: SavedTour) => {
    cachePois([{
      id: t.poiId, title: t.title, summary: '',
      thumbnailUrl: t.thumbnailUrl, coordinate: { latitude: 0, longitude: 0 }, sourceUrl: '',
    }]);
    cacheTour({
      poiId: t.poiId, title: t.title, style: t.style, minutes: t.minutes,
      text: t.text, wordCount: countWords(t.text), source: 'mock', attribution: t.attribution,
    });
    router.push(`/tour/${t.poiId}`);
  };

  const deleteTour = (poiId: string, title: string) => {
    Alert.alert('מחיקת סיור', `למחוק את הסיור של "${title}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: async () => { await removeSavedTour(poiId); load(); } },
    ]);
  };

  const deleteVideo = (location: string) => {
    Alert.alert('מחיקת סרטון', `למחוק את הסרטון של "${location}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: async () => { await removeSavedVideo(location); load(); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ─── Hero ─────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <Text style={styles.rankEmoji}>{rank.emoji}</Text>
          <View style={styles.heroCenter}>
            <Text style={styles.heroName}>
              {user?.user_metadata?.full_name || profile?.name || 'שחקן'}
            </Text>
            {user?.email && (
              <Text style={styles.heroEmail}>{user.email}</Text>
            )}
            <Text style={styles.heroRank}>{rank.name}</Text>
          </View>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsNum}>{points}</Text>
            <Text style={styles.pointsLabel}>נקודות</Text>
          </View>
        </View>
        <RankBar progress={rank.progress} nextName={rank.nextName} pointsToNext={rank.pointsToNext} />

        {/* Tier legend */}
        <View style={styles.tierRow}>
          {TIERS.map((t, i) => (
            <View key={i} style={[styles.tierItem, points >= t.min && styles.tierItemActive]}>
              <Text style={styles.tierEmoji}>{t.emoji}</Text>
              <Text style={styles.tierName} numberOfLines={1}>{t.name}</Text>
              <Text style={styles.tierMin}>{t.min}+</Text>
            </View>
          ))}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{quizHistory.length}</Text>
            <Text style={styles.statLabel}>חידונים</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{savedTours.length}</Text>
            <Text style={styles.statLabel}>סיורים</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{savedVideos.length}</Text>
            <Text style={styles.statLabel}>סרטונים</Text>
          </View>
        </View>
      </View>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <View style={styles.tabs}>
        {TABS.map(({ key, icon, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Ionicons name={icon as any} size={16} color={activeTab === key ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Quiz history ──────────────────────────────────── */}
      {activeTab === 'quiz' && (
        <View style={styles.section}>
          {quizHistory.length === 0 ? (
            <EmptyState icon="help-circle-outline" text="עדיין לא השלמת חידון." hint="גלה מקום, פתח נקודת עניין ולחץ על חידון." />
          ) : quizHistory.map((r, i) => (
            <View key={i} style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyLoc} numberOfLines={1}>{r.location}</Text>
                <Text style={styles.historyDate}>{formatDate(r.date)}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyScore}>{r.score}/{r.total}</Text>
                {r.earnedPoints > 0 && <Text style={styles.historyPts}>+{r.earnedPoints} נק'</Text>}
              </View>
              <View style={styles.scoreBarWrap}>
                <View style={[styles.scoreBarFill, { width: `${Math.round((r.score / r.total) * 100)}%` as any }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ─── Saved text tours ──────────────────────────────── */}
      {activeTab === 'tours' && (
        <View style={styles.section}>
          {savedTours.length === 0 ? (
            <EmptyState icon="headset-outline" text="אין סיורי שמע שמורים." hint="צור סיור על מקום כלשהו ולחץ על סימן הסימנייה." />
          ) : savedTours.map((t, i) => (
            <View key={i} style={styles.itemCard}>
              <TouchableOpacity style={styles.itemCardMain} onPress={() => openTour(t)} activeOpacity={0.85}>
                {t.thumbnailUrl ? (
                  <Image source={wikiImage(t.thumbnailUrl)} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="headset-outline" size={26} color={theme.colors.primaryLight} />
                  </View>
                )}
                <View style={styles.itemCardBody}>
                  <Text style={styles.itemCardTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={styles.itemCardMeta}>{t.minutes} דקות · {TOUR_STYLE_LABELS[t.style]} · {formatDate(t.savedAt)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTour(t.poiId, t.title)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ─── Saved videos ──────────────────────────────────── */}
      {activeTab === 'videos' && (
        <View style={styles.section}>
          {savedVideos.length === 0 ? (
            <EmptyState icon="videocam-outline" text="אין סרטונים שמורים." hint='לאחר יצירת סרטון, לחץ על "שמור סרטון".' />
          ) : savedVideos.map((v, i) => (
            <View key={i} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemCardMain}
                activeOpacity={0.85}
                onPress={() => router.push(
                  `/video/${encodeURIComponent(v.location)}?savedUrl=${encodeURIComponent(v.videoUrl)}&minutes=${v.minutes}&style=${v.style}`
                )}
              >
                <View style={[styles.thumb, styles.thumbVideo]}>
                  <Ionicons name="play-circle" size={30} color={theme.colors.primary} />
                </View>
                <View style={styles.itemCardBody}>
                  <Text style={styles.itemCardTitle} numberOfLines={1}>{v.location}</Text>
                  <Text style={styles.itemCardMeta}>{v.minutes} דקות · {(TOUR_STYLE_LABELS as Record<string, string>)[v.style] ?? v.style} · {formatDate(v.savedAt)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteVideo(v.location)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ─── Leaderboard ───────────────────────────────────── */}
      {activeTab === 'board' && (
        <View style={styles.section}>
          <Text style={styles.boardNote}>
            {cloudBoard.length > 0
              ? 'לוח התוצאות של כל המטיילים בשבילית'
              : 'התחבר עם Google כדי להתחרות מול מטיילים אחרים'}
          </Text>
          {leaderboard.map((player, i) => (
            <View key={i} style={[styles.boardRow, player.isMe && styles.boardRowMe]}>
              <Text style={[styles.boardRank, i < 3 && styles.boardRankTop]}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </Text>
              <Text style={[styles.boardName, player.isMe && styles.boardNameMe]} numberOfLines={1}>
                {player.name}{player.isMe ? ' (אתה)' : ''}
              </Text>
              <Text style={[styles.boardPoints, player.isMe && styles.boardPointsMe]}>
                {player.points} נק'
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ─── Settings / more ───────────────────────────────── */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/about')} activeOpacity={0.8}>
          <View style={[styles.menuIcon, { backgroundColor: '#e8f5ee' }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primaryLight} />
          </View>
          <Text style={styles.menuLabel}>אודות שבילית</Text>
          <Ionicons name="chevron-back" size={16} color={theme.colors.border} />
        </TouchableOpacity>

        {adminEnabled && (
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/admin')} activeOpacity={0.8}>
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#b45309" />
            </View>
            <Text style={[styles.menuLabel, { color: '#b45309' }]}>פאנל ניהול</Text>
            <View style={styles.adminPill}><Text style={styles.adminPillText}>ADMIN</Text></View>
            <Ionicons name="chevron-back" size={16} color={theme.colors.border} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.menuRow, styles.menuRowLast]}
          onPress={() => config.hasSupabase ? signOut() : clearProfile()}
          activeOpacity={0.8}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          </View>
          <Text style={[styles.menuLabel, { color: theme.colors.danger }]}>יציאה</Text>
          <Ionicons name="chevron-back" size={16} color={theme.colors.border} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function EmptyState({ icon, text, hint }: { icon: string; text: string; hint: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon as any} size={44} color={theme.colors.primaryLight} />
      <Text style={styles.emptyText}>{text}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },

  // ─── Hero
  hero: { backgroundColor: theme.colors.primary, padding: theme.spacing(2.5), paddingBottom: theme.spacing(2) },
  heroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(1.5) },
  rankEmoji: { fontSize: 42 },
  heroCenter: { flex: 1 },
  heroName:  { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'right' },
  heroEmail: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'right', marginTop: 1 },
  heroRank:  { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'right' },
  pointsBadge: { alignItems: 'center', backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14 },
  pointsNum: { fontSize: 24, fontWeight: '900', color: theme.colors.accentDark },
  pointsLabel: { fontSize: 10, color: theme.colors.accentDark, fontWeight: '600' },

  rankBarWrap: { marginTop: theme.spacing(1.5) },
  rankBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  rankBarFill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: 3 },
  rankBarLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, textAlign: 'right' },

  tierRow: { flexDirection: 'row-reverse', marginTop: theme.spacing(1.5), gap: 4 },
  tierItem: { flex: 1, alignItems: 'center', opacity: 0.45 },
  tierItemActive: { opacity: 1 },
  tierEmoji: { fontSize: 14 },
  tierName: { fontSize: 9, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 1 },
  tierMin: { fontSize: 9, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

  statsRow: { flexDirection: 'row-reverse', marginTop: theme.spacing(2), backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: theme.radius, padding: theme.spacing(1.5) },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  // ─── Tabs
  tabs: { flexDirection: 'row-reverse', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: theme.spacing(1.25) },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: theme.colors.primary },

  // ─── Sections
  section: { padding: theme.spacing(2), gap: theme.spacing(1) },

  empty: { alignItems: 'center', paddingVertical: theme.spacing(4), gap: theme.spacing(1) },
  emptyText: { fontSize: 16, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', maxWidth: 260 },

  // ─── History card (quiz)
  historyCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius,
    padding: theme.spacing(1.5), gap: theme.spacing(1), ...theme.shadowSoft,
    flexDirection: 'row-reverse', alignItems: 'center',
  },
  historyLeft: { flex: 1 },
  historyLoc: { fontSize: 15, fontWeight: '700', color: theme.colors.text, textAlign: 'right' },
  historyDate: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right' },
  historyRight: { alignItems: 'center', minWidth: 52 },
  historyScore: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  historyPts: { fontSize: 11, color: theme.colors.primaryLight, fontWeight: '700' },
  scoreBarWrap: { position: 'absolute', bottom: 0, left: theme.spacing(1.5), right: theme.spacing(1.5), height: 3, backgroundColor: theme.colors.surfaceAlt, borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: theme.colors.primaryLight, borderRadius: 2 },

  // ─── Item card (tours + videos)
  itemCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(1),
    backgroundColor: theme.colors.surface, borderRadius: theme.radiusLg,
    padding: theme.spacing(1.25), ...theme.shadowSoft,
  },
  itemCardMain: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(1.25) },
  thumb: { width: 60, height: 60, borderRadius: theme.radius },
  thumbPlaceholder: { backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  thumbVideo: { backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  itemCardBody: { flex: 1 },
  itemCardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, textAlign: 'right' },
  itemCardMeta: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },

  // ─── Leaderboard
  boardNote: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'right', marginBottom: theme.spacing(0.5) },
  boardRow: {
    flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: theme.spacing(1.25),
    paddingHorizontal: theme.spacing(1.5), borderRadius: theme.radius,
    backgroundColor: theme.colors.surface, gap: theme.spacing(1), ...theme.shadowSoft,
  },
  boardRowMe: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1.5, borderColor: theme.colors.primaryLight },
  boardRank: { fontSize: 18, width: 36, textAlign: 'center' },
  boardRankTop: { fontSize: 22 },
  boardName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text, textAlign: 'right' },
  boardNameMe: { fontWeight: '800', color: theme.colors.primary },
  boardPoints: { fontSize: 15, fontWeight: '700', color: theme.colors.textMuted },
  boardPointsMe: { color: theme.colors.primary, fontWeight: '900' },

  // ─── Menu section
  menuSection: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
    borderRadius: theme.radiusXl,
    overflow: 'hidden',
    ...theme.shadowSoft,
  },
  menuRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(2),
    gap: theme.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text, textAlign: 'right' },
  adminPill: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#f59e0b55',
  },
  adminPillText: { fontSize: 9, fontWeight: '800', color: '#b45309', letterSpacing: 0.5 },
});
