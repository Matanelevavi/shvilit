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
import { getPoints, getRank } from '@/state/points';
import { useAuth } from '@/auth/AuthProvider';
import { useLocalProfile } from '@/auth/LocalProfile';
import { config } from '@/config/env';
import type { Coordinate, Poi } from '@/domain/types';
import { theme } from '@/ui/theme';

const DEFAULT_CENTER: Coordinate = { latitude: 31.7767, longitude: 35.2345 };
const SUGGESTIONS = ['הכותל המערבי', 'מצדה', 'עיר דוד', 'קיסריה', 'ים המלח', 'הר הרצל'];

export default function MapScreenWeb() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, clearProfile } = useLocalProfile();
  const onLogout = () => (config.hasSupabase ? signOut() : clearProfile());
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [points, setPoints] = useState(0);

  useFocusEffect(useCallback(() => void getPoints().then(setPoints), []));

  const runSearch = async (term: string) => {
    if (!term.trim()) return;
    try {
      setLoading(true);
      setNotice('');
      setSearched(true);
      const results = await getPoiProvider().searchByName(term.trim());
      cachePois(results);
      setPois(results);
      if (results.length === 0) setNotice('לא נמצאו תוצאות. נסה שם אחר.');
    } catch (err) {
      setNotice(`שגיאה בחיפוש: ${err instanceof Error ? err.message : 'שגיאה'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadNearby = async (center: Coordinate) => {
    try {
      setLoading(true);
      setNotice('');
      setSearched(true);
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

  const searchHere = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadNearby({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => loadNearby(DEFAULT_CENTER),
      );
    } else {
      loadNearby(DEFAULT_CENTER);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={theme.gradientLogin} style={styles.header}>
        <View style={styles.headerTop}>
          <Image source={require('../assets/adaptive-icon.png')} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.appName}>שבילית</Text>
            <Text style={styles.appTagline}>
              {profile ? `שלום, ${profile.name}` : 'סיורי הדרכה חכמים בכל מקום'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/saved')} hitSlop={8}>
            <Ionicons name="bookmark-outline" size={22} color="#d7e6dd" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color="#d7e6dd" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="לאן תרצה לטייל? (מצדה, הכותל...)"
            placeholderTextColor="#9bb3a6"
            textAlign="right"
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
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.pointsChip}>
          <Ionicons name="trophy" size={16} color={theme.colors.accent} />
          <Text style={styles.pointsChipText}>
            {points} נק' · {getRank(points).name}
          </Text>
        </View>

        <View style={styles.chipsRow}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.chip}
              onPress={() => {
                setQuery(s);
                runSearch(s);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.nearbyBtn} onPress={searchHere} activeOpacity={0.9}>
          <Ionicons name="navigate" size={18} color={theme.colors.primary} />
          <Text style={styles.nearbyText}>מה יש סביבי?</Text>
        </TouchableOpacity>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {!searched && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="compass-outline" size={56} color={theme.colors.primaryLight} />
            <Text style={styles.emptyText}>חפש מקום או בחר הצעה, וצור סיור מודרך בעברית</Text>
          </View>
        ) : null}

        {pois.length > 0 && <Text style={styles.resultsTitle}>תוצאות</Text>}

        {pois.map((poi) => (
          <TouchableOpacity
            key={poi.id}
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => router.push(`/poi/${poi.id}`)}
          >
            {poi.thumbnailUrl ? (
              <Image source={{ uri: poi.thumbnailUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="image-outline" size={26} color={theme.colors.primaryLight} />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {poi.title}
              </Text>
              <Text style={styles.cardSummary} numberOfLines={2}>
                {poi.summary || 'הקש ליצירת סיור'}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing(4), maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(3),
    paddingHorizontal: theme.spacing(2.5),
    borderBottomLeftRadius: theme.radiusXl,
    borderBottomRightRadius: theme.radiusXl,
  },
  headerTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(1.5) },
  logo: { width: 48, height: 48 },
  appName: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'right' },
  appTagline: { color: '#d7e6dd', fontSize: 14, textAlign: 'right', marginTop: 2 },
  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(1), marginTop: theme.spacing(2.5) },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(2),
    fontSize: 16,
    color: theme.colors.text,
  },
  searchBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radiusLg,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  pointsChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: theme.spacing(0.75),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(1.5),
  },
  pointsChipText: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing(1) },
  chip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(1.75),
  },
  chipText: { color: theme.colors.primary, fontSize: 14, fontWeight: '600' },
  nearbyBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radiusLg,
  },
  nearbyText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
  notice: { color: theme.colors.danger, fontSize: 14, textAlign: 'center', paddingVertical: theme.spacing(1) },
  empty: { alignItems: 'center', gap: theme.spacing(1.5), paddingVertical: theme.spacing(5) },
  emptyText: { color: theme.colors.textMuted, fontSize: 15, textAlign: 'center', maxWidth: 280 },
  resultsTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, textAlign: 'right', marginTop: theme.spacing(1) },
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.25),
    ...theme.shadowSoft,
  },
  thumb: { width: 64, height: 64, borderRadius: theme.radius },
  thumbPlaceholder: { backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, textAlign: 'right' },
  cardSummary: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },
});
