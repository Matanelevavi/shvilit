import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPoiProvider } from '@/services/factory';
import { cachePois } from '@/state/store';
import { getPoints, getRank, getPendingVideos, removePendingVideo } from '@/state/gameState';
import { getVideoTour } from '@/services/video/videoTourApi';
import { useAuth } from '@/auth/AuthProvider';
import { useLocalProfile } from '@/auth/LocalProfile';
import type { Coordinate, Poi } from '@/domain/types';
import { theme } from '@/ui/theme';
import { wikiImage } from '@/ui/wikiImage';
import { trackEvent, regionFromCoordinate } from '@/state/analytics';
import { notifyTourReady } from '@/state/notify';
import { TourReadyModal } from '@/ui/TourReadyModal';

const DEFAULT_CENTER: Coordinate = { latitude: 31.7767, longitude: 35.2345 };
const SUGGESTIONS = [
  { label: 'הכותל המערבי', icon: 'business-outline' },
  { label: 'מצדה',         icon: 'trail-sign-outline' },
  { label: 'עיר דוד',      icon: 'map-outline'      },
  { label: 'קיסריה',       icon: 'boat-outline'     },
  { label: 'ים המלח',      icon: 'water-outline'    },
  { label: 'הר הרצל',      icon: 'flag-outline'     },
];

export default function MapScreenWeb() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, clearProfile } = useLocalProfile();
  // תמיד מנקים את שני מקורות ההתחברות האפשריים - לא רק לפי config.hasSupabase
  // (שתמיד true כאן), אחרת אורח עם פרופיל מקומי לא היה יכול לצאת בכלל:
  // signOut() לא עושה כלום כשאין session, אז clearProfile() חייב לרוץ תמיד.
  const onLogout = async () => {
    await clearProfile();
    await signOut();
  };

  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [resultsSource, setResultsSource] = useState<'search' | 'nearby'>('search');
  const [points, setPoints] = useState(0);
  const [readyVideo, setReadyVideo] = useState<{ location: string; url: string; minutes: number; style: string } | null>(null);

  useFocusEffect(useCallback(() => {
    getPoints().then(setPoints);

    (async () => {
      const pending = await getPendingVideos();
      for (const p of pending) {
        if (!p.tourId) continue;
        try {
          const s = await getVideoTour(p.tourId);
          if (s.status === 'completed' && s.video_url) {
            await removePendingVideo(p.location);
            setPoints(await getPoints());
            notifyTourReady(p.location);
            setReadyVideo({ location: p.location, url: s.video_url, minutes: p.minutes, style: p.style });
          } else if (s.status === 'failed') {
            await removePendingVideo(p.location);
          }
        } catch { /* נבדוק בפוקוס הבא */ }
      }
    })();
  }, []));

  const runSearch = async (term: string) => {
    if (!term.trim()) return;
    try {
      setLoading(true);
      setNotice('');
      setSearched(true);
      setResultsSource('search');
      const results = await getPoiProvider().searchByName(term.trim());
      cachePois(results);
      setPois(results);
      // נשלח אחרי קבלת התוצאות - results_count הוא בדיוק מה שמזהה חיפושים
      // "יבשים" (0 תוצאות), זהב מוצרי למה אנשים מחפשים ולא מוצאים.
      trackEvent('search', { query: term.trim(), results_count: results.length });
      if (results.length === 0) setNotice('לא נמצאו תוצאות. אפשר לנסות שם אחר.');
    } catch (err) {
      setNotice(`שגיאה: ${err instanceof Error ? err.message : 'שגיאה'}`);
    } finally {
      setLoading(false);
    }
  };

  const searchNearby = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // fallback ידני: בדפדפנים מסוימים getCurrentPosition נתקע בלי לקרוא
      // לאף callback כשמיקום חסום ברמת המערכת - בלי timeout המסך נשאר תקוע.
      let done = false;
      const fallback = setTimeout(() => {
        if (!done) { done = true; loadNearby(DEFAULT_CENTER); }
      }, 6000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          done = true; clearTimeout(fallback);
          loadNearby({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          if (done) return;
          done = true; clearTimeout(fallback);
          loadNearby(DEFAULT_CENTER);
        },
        { timeout: 5500 },
      );
    } else {
      loadNearby(DEFAULT_CENTER);
    }
  };

  const loadNearby = async (center: Coordinate) => {
    try {
      setLoading(true);
      setNotice('');
      setSearched(true);
      setResultsSource('nearby');
      trackEvent('nearby_search', { region: regionFromCoordinate(center.latitude, center.longitude) });
      const results = await getPoiProvider().search(center, 10000, 20);
      cachePois(results);
      setPois(results);
      if (results.length === 0) setNotice('לא נמצאו נקודות עניין באזור זה.');
    } catch (err) {
      setNotice(`שגיאה: ${err instanceof Error ? err.message : 'שגיאה'}`);
    } finally {
      setLoading(false);
    }
  };

  const rank = getRank(points);

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ─── Header ───────────────────────────────────────── */}
      <LinearGradient colors={['#0a2d20', '#0f3d2e']} style={styles.header}>
        <View style={styles.headerTop}>
          {/* Logo + name */}
          <Image source={require('../assets/adaptive-icon.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.headerCenter}>
            <Text style={styles.appName}>שבילית</Text>
            <Text style={styles.appTagline}>
              {profile ? `שלום, ${profile.name}` : 'הדרכות חכמות בכל מקום'}
            </Text>
          </View>

          {/* Right actions */}
          <View style={styles.headerActions}>
            {/* Points chip → leaderboard */}
            <TouchableOpacity
              style={styles.pointsChip}
              onPress={() => router.push({ pathname: '/profile', params: { tab: 'board' } })}
              activeOpacity={0.85}
            >
              <Ionicons name="trophy" size={14} color={theme.colors.accent} />
              <Text style={styles.pointsChipText}>{points}</Text>
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push('/profile')}
              hitSlop={8}
              activeOpacity={0.85}
            >
              <Ionicons name="person-circle-outline" size={26} color="#d7e6dd" />
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity style={styles.headerBtn} onPress={onLogout} hitSlop={8} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={22} color="#d7e6dd" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="לאן תרצה לטייל? (מצדה, הכותל...)"
            placeholderTextColor="#9bb3a6"
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => runSearch(query)} activeOpacity={0.9}>
            {loading ? (
              <ActivityIndicator color={theme.colors.accentDark} />
            ) : (
              <Ionicons name="search" size={20} color={theme.colors.accentDark} />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick suggestions - שייכות לטופס החיפוש, לכן בתוך הרקע הכהה */}
        <View style={styles.suggestionsRow}>
          {SUGGESTIONS.map(({ label, icon }) => (
            <TouchableOpacity
              key={label}
              style={styles.suggChip}
              onPress={() => { setQuery(label); runSearch(label); }}
              activeOpacity={0.85}
            >
              <Ionicons name={icon as any} size={13} color={theme.colors.primaryLight} />
              <Text style={styles.suggChipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* Nearby button */}
        <TouchableOpacity style={styles.nearbyBtn} onPress={searchNearby} activeOpacity={0.9}>
          {/* היפוך אופקי: החץ האלכסוני מצביע שמאלה-למעלה כמקובל ב-RTL */}
          <Ionicons name="navigate" size={18} color={theme.colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
          <Text style={styles.nearbyText}>מה יש סביבי?</Text>
        </TouchableOpacity>

        {/* Error/notice */}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {/* Empty state */}
        {!searched && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="compass-outline" size={64} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>רוצה לצאת לדרך?</Text>
            <Text style={styles.emptyText}>רק צריך לבחור מקום או אחת מההצעות שלמעלה, ואנחנו ניצור לך הדרכה בעברית תוך שניות.</Text>
          </View>
        )}

        {/* Results */}
        {pois.length > 0 && (
          <>
            <Text style={styles.resultsTitle}>{pois.length} מקומות נמצאו</Text>
            {pois.map((poi) => (
              <TouchableOpacity
                key={poi.id}
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => router.push(`/poi/${poi.id}?source=${resultsSource}`)}
              >
                {poi.thumbnailUrl ? (
                  <Image source={wikiImage(poi.thumbnailUrl)} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={26} color={theme.colors.primaryLight} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{poi.title}</Text>
                  <Text style={styles.cardSummary} numberOfLines={2}>
                    {poi.summary || 'לחיצה יוצרת הדרכה'}
                  </Text>
                </View>
                <View style={styles.cardArrow}>
                  {/* בעברית "קדימה" מצביע שמאלה - לכן arrow-back */}
                  <Ionicons name="arrow-back" size={16} color={theme.colors.primaryLight} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Rank teaser */}
        {points > 0 && (
          <TouchableOpacity
            style={styles.rankTeaser}
            onPress={() => router.push({ pathname: '/profile', params: { tab: 'board' } })}
            activeOpacity={0.85}
          >
            <Text style={styles.rankTeaserEmoji}>{rank.emoji}</Text>
            <View style={styles.rankTeaserBody}>
              <Text style={styles.rankTeaserName}>{rank.name} · {points} נקודות</Text>
              {rank.nextName && <Text style={styles.rankTeaserNext}>עוד {rank.pointsToNext} נק' לתואר "{rank.nextName}"</Text>}
            </View>
            <Ionicons name="chevron-back" size={16} color={theme.colors.primaryLight} />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    {readyVideo && (
      <TourReadyModal
        location={readyVideo.location}
        onView={() => {
          const { location, url, minutes, style } = readyVideo;
          setReadyVideo(null);
          router.push(`/video/${encodeURIComponent(location)}?savedUrl=${encodeURIComponent(url)}&minutes=${minutes}&style=${style}`);
        }}
        onDismiss={() => setReadyVideo(null)}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content:   { paddingBottom: theme.spacing(5), maxWidth: 780, width: '100%', alignSelf: 'center' },

  header: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(3),
    paddingHorizontal: theme.spacing(2.5),
    borderBottomLeftRadius: theme.radiusXl,
    borderBottomRightRadius: theme.radiusXl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  logo: { width: 44, height: 44, borderRadius: 10 },
  headerCenter: { flex: 1 },
  appName:    { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  appTagline: { color: '#c8ddd5', fontSize: 13 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.5) },
  headerBtn: { padding: theme.spacing(0.5) },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232,163,61,0.18)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(232,163,61,0.35)',
  },
  pointsChipText: { color: theme.colors.accent, fontWeight: '800', fontSize: 13 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1), marginTop: theme.spacing(2.5) },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(2),
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'right',
  },
  searchBtn: {
    width: 52, height: 52,
    borderRadius: theme.radiusLg,
    backgroundColor: theme.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { padding: theme.spacing(2), gap: theme.spacing(1.5) },

  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(0.875), marginTop: theme.spacing(1.5) },
  suggChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(1.5),
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadowSoft,
  },
  suggChipText: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },

  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing(1.75),
    borderRadius: theme.radiusLg,
    ...theme.shadowSoft,
  },
  nearbyText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },

  notice: {
    color: theme.colors.danger, fontSize: 14, textAlign: 'center',
    backgroundColor: '#fee2e2', padding: theme.spacing(1.5), borderRadius: theme.radius,
  },

  emptyState: { alignItems: 'center', gap: theme.spacing(1.5), paddingVertical: theme.spacing(5) },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, textAlign: 'center' },
  emptyText:  { color: theme.colors.textMuted, fontSize: 15, textAlign: 'center', maxWidth: 320, lineHeight: 24 },

  resultsTitle: {
    fontSize: 14, fontWeight: '700', color: theme.colors.textMuted,
    marginTop: theme.spacing(0.5),
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    gap: theme.spacing(1.25),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.25),
    ...theme.shadowSoft,
  },
  thumb: { width: 68, height: 68, borderRadius: theme.radius },
  thumbPlaceholder: { backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle:   { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  cardSummary: { fontSize: 13, color: theme.colors.textMuted, marginTop: 3, lineHeight: 19 },
  cardArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  rankTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
    borderWidth: 1,
    borderColor: theme.colors.surfaceAlt,
    ...theme.shadowSoft,
  },
  rankTeaserEmoji:  { fontSize: 28 },
  rankTeaserBody:   { flex: 1 },
  rankTeaserName:   { fontSize: 15, fontWeight: '700', color: theme.colors.primary },
  rankTeaserNext:   { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
