import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/ui/theme';
import { showAlert, showConfirm } from '@/ui/dialogs';
import { useAuth } from '@/auth/AuthProvider';
import {
  getAllUsers,
  deleteUser,
  resetUserPoints,
  formatLastActive,
  isAdminUnlocked,
  type UserEntry,
} from '@/state/userRegistry';
import {
  getAllProfiles,
  resetProfilePoints,
  deleteCloudUser,
  ADMIN_EMAIL,
  type SupabaseProfile,
} from '@/state/supabaseProfile';
import { getRank } from '@/state/gameState';

function StatCard({ value, label, icon, color }: { value: string | number; label: string; icon: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// כמה זמן אחרי הפעילות האחרונה משתמש עדיין נחשב "פעיל"
const ACTIVE_WINDOW_MS = 3_600_000;

// ממיר SupabaseProfile ל-UserEntry לתצוגה אחידה
function profileToEntry(p: SupabaseProfile): UserEntry {
  return {
    id: p.id,
    name: p.name || p.email?.split('@')[0] || 'משתמש',
    points: p.points,
    quizCount: p.quiz_count,
    tourCount: p.tour_count,
    videoCount: p.video_count,
    joinedAt: new Date(p.joined_at).getTime(),
    lastActive: new Date(p.last_active).getTime(),
    isActive: Date.now() - new Date(p.last_active).getTime() < ACTIVE_WINDOW_MS,
    email: p.email ?? undefined,
    isAdmin: p.is_admin,
  };
}

export default function AdminScreen() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [supabaseMode, setSupabaseMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // שמירת המסך: רק אדמין (לפי מייל Google) או מי שפתח מצב מפתח נכנס.
  // בלעדיה, כל מי שמנווט ישירות ל-/admin (למשל ב-URL בדפדפן) רואה את הפאנל.
  useFocusEffect(useCallback(() => {
    // חשוב: לא מחליטים לפני שה-session נטען - אחרת בכניסה ישירה ל-/admin
    // (רענון דף בדפדפן) authUser עדיין null וגם אדמין אמיתי מועף החוצה.
    if (authLoading) return;
    let mounted = true;
    (async () => {
      const ok = authUser?.email === ADMIN_EMAIL || (await isAdminUnlocked());
      if (!mounted) return;
      setAllowed(ok);
      if (!ok) router.replace('/');
    })();
    return () => { mounted = false; };
  }, [authLoading, authUser?.email]));

  const load = useCallback(async () => {
    // הרשת (Supabase) והאחסון המקומי לא תלויים זה בזה - נטענים במקביל
    const [supabaseProfiles, localData] = await Promise.all([
      getAllProfiles(),
      getAllUsers(),
    ]);
    if (supabaseProfiles.length > 0) {
      // מיזוג: פרופילים מהענן + כל המשתמשים המקומיים שלא קיימים בענן
      // (משתמשי אורח מקומיים ו-NPC), בלי כפילויות לפי id.
      setSupabaseMode(true);
      const cloudIds  = new Set(supabaseProfiles.map((p) => p.id));
      const cloudRows = supabaseProfiles.map(profileToEntry);
      const localOnly = localData.filter((u) => !cloudIds.has(u.id));
      setUsers([...cloudRows, ...localOnly].sort((a, b) => b.points - a.points));
    } else {
      // Supabase לא זמין - נתונים מקומיים בלבד
      setSupabaseMode(false);
      setUsers(localData);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // משתמש שמקורו בענן מזוהה לפי שדה email (רק פרופילים מ-Supabase כוללים אותו)
  const isCloudUser = (u: UserEntry) => !!u.email;

  const onReset = (user: UserEntry) => {
    showConfirm(
      'איפוס נקודות',
      `לאפס את הנקודות של ${user.name} ל-0?`,
      'אפס',
      async () => {
        if (isCloudUser(user)) {
          const { error } = await resetProfilePoints(user.id);
          if (error) {
            showAlert('האיפוס נכשל', error);
            return;
          }
        } else {
          await resetUserPoints(user.id);
        }
        load();
      },
      { destructive: true },
    );
  };

  const onDelete = (user: UserEntry) => {
    showConfirm(
      'מחיקת משתמש',
      `למחוק את ${user.name} לצמיתות? ${isCloudUser(user) ? 'חשבון ה-Google שלו יימחק מהמערכת.' : ''}`,
      'מחק',
      async () => {
        if (isCloudUser(user)) {
          // מחיקה אמיתית בשרת דרך Edge Function (רץ עם service_role)
          const { error } = await deleteCloudUser(user.id);
          if (error) {
            showAlert('המחיקה נכשלה', error);
            return;
          }
        }
        await deleteUser(user.id); // ניקוי מהרג'יסטרי המקומי בכל מקרה
        load();
      },
      { destructive: true },
    );
  };

  const totalPoints   = users.reduce((s, u) => s + u.points,    0);
  const totalQuizzes  = users.reduce((s, u) => s + u.quizCount, 0);
  const totalTours    = users.reduce((s, u) => s + u.tourCount,  0);
  const activeNow     = users.filter((u) => u.isActive).length;

  // עד שבדיקת ההרשאה מסתיימת (או כשנכשלה וההפניה בדרך) - לא מציגים כלום
  if (allowed !== true) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      {/* Header */}
      <LinearGradient colors={['#0a2a1e', '#0f3d2e']} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#e8a33d" />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
          <Text style={styles.headerTitle}>פאנל ניהול</Text>
        </View>
        <Text style={styles.headerSub}>
          {users.length} משתמשים רשומים
        </Text>
        <View style={[styles.modeBadge, supabaseMode ? styles.modeBadgeLive : styles.modeBadgeLocal]}>
          <Ionicons name={supabaseMode ? 'cloud-done-outline' : 'phone-portrait-outline'} size={12} color={supabaseMode ? '#6ee7b7' : '#9bb3a6'} />
          <Text style={[styles.modeBadgeText, { color: supabaseMode ? '#6ee7b7' : '#9bb3a6' }]}>
            {supabaseMode ? 'Supabase - נתונים חיים' : 'מקומי - אין חיבור Supabase'}
          </Text>
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard value={users.length}  label="משתמשים"  icon="people-outline"    color="#1c6b4f" />
        <StatCard value={activeNow}     label="פעילים"   icon="radio-button-on"   color="#22a06b" />
        <StatCard value={totalPoints}   label="נקודות"   icon="trophy-outline"    color="#e8a33d" />
        <StatCard value={totalQuizzes}  label="חידונים"  icon="help-circle-outline" color="#6c63ff" />
      </View>

      {/* Activity bar */}
      <View style={styles.activityCard}>
        <Text style={styles.activityTitle}>פעילות לפי סוג</Text>
        <View style={styles.activityRow}>
          <View style={styles.activityItem}>
            <Text style={styles.activityNum}>{totalTours}</Text>
            <Text style={styles.activityLabel}>סיורי שמע</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityItem}>
            <Text style={styles.activityNum}>{users.reduce((s, u) => s + u.videoCount, 0)}</Text>
            <Text style={styles.activityLabel}>סרטוני וידאו</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityItem}>
            <Text style={styles.activityNum}>{totalQuizzes}</Text>
            <Text style={styles.activityLabel}>חידונים</Text>
          </View>
        </View>
      </View>

      {/* Users list */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>כל המשתמשים</Text>
        <TouchableOpacity onPress={onRefresh} hitSlop={8}>
          <Ionicons name="refresh-outline" size={18} color={theme.colors.primaryLight} />
        </TouchableOpacity>
      </View>

      {users.length === 0 && (
        <Text style={styles.emptyList}>עדיין אין משתמשים רשומים</Text>
      )}

      {users.map((user, idx) => {
        const tier = getRank(user.points);
        const isExpanded = expandedId === user.id;
        return (
          <TouchableOpacity
            key={user.id}
            style={[styles.userCard, idx === 0 && styles.userCardFirst]}
            onPress={() => setExpandedId(isExpanded ? null : user.id)}
            activeOpacity={0.8}
          >
            {/* Rank number */}
            <Text style={styles.rankNum}>#{idx + 1}</Text>

            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
            </View>

            {/* Info */}
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{user.name}</Text>
                {user.isAdmin && <View style={styles.adminUserBadge}><Text style={styles.adminUserBadgeText}>ADMIN</Text></View>}
                {user.isActive && <View style={styles.onlineDot} />}
              </View>
              {user.email && (
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              )}
              <Text style={styles.userTier}>{tier.emoji} {tier.name}</Text>
            </View>

            {/* Points */}
            <View style={styles.userPoints}>
              <Text style={styles.userPointsNum}>{user.points}</Text>
              <Text style={styles.userPointsLabel}>נק'</Text>
            </View>

            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.colors.textMuted}
            />

            {/* Expanded details */}
            {isExpanded && (
              <View style={styles.expanded}>
                <View style={styles.expandedStats}>
                  <View style={styles.expandedStat}>
                    <Text style={styles.expandedNum}>{user.quizCount}</Text>
                    <Text style={styles.expandedLabel}>חידונים</Text>
                  </View>
                  <View style={styles.expandedStat}>
                    <Text style={styles.expandedNum}>{user.tourCount}</Text>
                    <Text style={styles.expandedLabel}>סיורים</Text>
                  </View>
                  <View style={styles.expandedStat}>
                    <Text style={styles.expandedNum}>{user.videoCount}</Text>
                    <Text style={styles.expandedLabel}>סרטונים</Text>
                  </View>
                  <View style={styles.expandedStat}>
                    <Text style={styles.expandedNum}>{formatLastActive(user.lastActive)}</Text>
                    <Text style={styles.expandedLabel}>פעילות</Text>
                  </View>
                </View>

                <View style={styles.expandedActions}>
                  <TouchableOpacity
                    style={styles.actionBtnWarn}
                    onPress={() => onReset(user)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh-circle-outline" size={16} color="#b45309" />
                    <Text style={styles.actionBtnWarnText}>איפוס נקודות</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => onDelete(user)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnDangerText}>הסרת משתמש</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <Text style={styles.footer}>
        {supabaseMode ? 'נתונים חיים מ-Supabase' : 'נתונים מאוחסנים מקומית במכשיר'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content:   { paddingBottom: theme.spacing(5) },

  header: { padding: theme.spacing(2.5), paddingTop: theme.spacing(3) },
  headerTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  adminBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,163,61,0.18)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.4)',
  },
  adminBadgeText: { fontSize: 11, fontWeight: '800', color: '#e8a33d', letterSpacing: 1 },
  headerSub: { fontSize: 13, color: '#9bbfaf', textAlign: 'right', marginTop: theme.spacing(0.75) },
  modeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing(1),
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignSelf: 'flex-end',
    borderWidth: 1,
  },
  modeBadgeLive:  { backgroundColor: 'rgba(110,231,183,0.1)', borderColor: 'rgba(110,231,183,0.3)' },
  modeBadgeLocal: { backgroundColor: 'rgba(155,179,166,0.1)', borderColor: 'rgba(155,179,166,0.2)' },
  modeBadgeText:  { fontSize: 10, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row-reverse',
    padding: theme.spacing(1.5),
    gap: theme.spacing(1),
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.5),
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 3,
    ...theme.shadowSoft,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  statLabel: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center' },

  activityCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    ...theme.shadowSoft,
  },
  activityTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, textAlign: 'right', marginBottom: theme.spacing(1.5) },
  activityRow: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  activityItem: { alignItems: 'center', gap: 4 },
  activityNum: { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
  activityLabel: { fontSize: 11, color: theme.colors.textMuted },
  activityDivider: { width: 1, backgroundColor: theme.colors.border, marginVertical: 4 },

  listHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },

  userCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.75),
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    flexWrap: 'wrap',
    ...theme.shadowSoft,
  },
  userCardFirst: { borderWidth: 1.5, borderColor: theme.colors.accent + '66' },
  rankNum: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, width: 22, textAlign: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  emptyList: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 14,
    paddingVertical: theme.spacing(4),
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(0.75) },
  userName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22a06b',
  },
  userEmail: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'right', marginTop: 1 },
  userTier:  { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right', marginTop: 1 },
  adminUserBadge: {
    backgroundColor: 'rgba(232,163,61,0.15)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.35)',
  },
  adminUserBadgeText: { fontSize: 8, fontWeight: '800', color: '#e8a33d', letterSpacing: 0.5 },
  userPoints: { alignItems: 'center' },
  userPointsNum: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  userPointsLabel: { fontSize: 10, color: theme.colors.textMuted },

  expanded: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1.5),
  },
  expandedStats: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginBottom: theme.spacing(1.5),
  },
  expandedStat: { alignItems: 'center', gap: 2 },
  expandedNum: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  expandedLabel: { fontSize: 10, color: theme.colors.textMuted },
  expandedActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing(1),
  },
  actionBtnWarn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing(1.25),
    backgroundColor: '#fef3c7',
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: '#f59e0b44',
  },
  actionBtnWarnText: { fontSize: 13, fontWeight: '700', color: '#b45309' },
  actionBtnDanger: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing(1.25),
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius,
  },
  actionBtnDangerText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  footer: {
    marginTop: theme.spacing(3),
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
