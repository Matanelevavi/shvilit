import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPoiProvider } from '@/services/factory';
import { cachePois } from '@/state/store';
import { useAuth } from '@/auth/AuthProvider';
import { useLocalProfile } from '@/auth/LocalProfile';
import { config } from '@/config/env';
import type { Coordinate, Poi } from '@/domain/types';
import { theme } from '@/ui/theme';
import { wikiImage } from '@/ui/wikiImage';
import { getPoints, getPendingVideos, removePendingVideo } from '@/state/gameState';
import { getVideoTour } from '@/services/video/videoTourApi';

const DEFAULT_REGION: Region = {
  latitude: 31.7767,
  longitude: 35.2345,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, clearProfile } = useLocalProfile();
  const onLogout = () => (config.hasSupabase ? signOut() : clearProfile());
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [tapped, setTapped] = useState<Coordinate | null>(null);
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState(0);

  // טוען נקודות + בודק pending videos בכל פעם שהמסך מקבל פוקוס
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
            setPoints(await getPoints()); // רענון
            Alert.alert(
              '✅ הסרטון מוכן!',
              `סרטון הסיור של "${p.location}" מוכן לצפייה.`,
              [
                { text: 'לצפייה', onPress: () => router.push(`/video/${encodeURIComponent(p.location)}?savedUrl=${encodeURIComponent(s.video_url!)}&minutes=${p.minutes}&style=${p.style}`) },
                { text: 'אחר כך', style: 'cancel' },
              ],
            );
          } else if (s.status === 'failed') {
            await removePendingVideo(p.location);
          }
        } catch { /* שגיאת רשת - נבדוק בפוקוס הבא */ }
      }
    })();
  }, []));

  const onSearch = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      const results = await getPoiProvider().searchByName(query.trim());
      cachePois(results);
      setPois(results);
      const withCoord = results.find((p) => p.coordinate.latitude !== 0);
      if (withCoord) {
        const next: Region = { ...withCoord.coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setTapped(withCoord.coordinate);
        mapRef.current?.animateToRegion(next, 800);
      }
      if (results.length === 0) {
        Alert.alert('לא נמצאו תוצאות', 'נסה שם מקום אחר.');
      }
    } catch (err) {
      Alert.alert('שגיאה בחיפוש', err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        // קודם מיקום אחרון ידוע (מהיר ולא נכשל), ואז מיקום עדכני.
        let loc = await Location.getLastKnownPositionAsync();
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }
        if (!loc) return;
        const next: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 800);
      } catch {
        // המיקום לא זמין (שירותי מיקום כבויים/אין קליטה) - נשארים על אזור ברירת המחדל.
      }
    })();
  }, []);

  const loadPois = async (center: Coordinate) => {
    try {
      setLoading(true);
      const results = await getPoiProvider().search(center, 10000, 20);
      cachePois(results);
      setPois(results);
      if (results.length === 0) {
        Alert.alert('לא נמצאו נקודות עניין', 'נסה אזור אחר או הגדל את טווח החיפוש.');
      }
    } catch (err) {
      Alert.alert('שגיאה בטעינת נקודות', err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  };

  const onMapPress = (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    setTapped(coord);
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.06, longitudeDelta: 0.06 },
      500,
    );
    loadPois(coord);
  };
  const searchHere = () => {
    const center = { latitude: region.latitude, longitude: region.longitude };
    setTapped(center);
    loadPois(center);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: profile ? `שלום, ${profile.name}` : 'שבילית',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/profile')} style={{ marginLeft: 12, marginRight: 4 }} hitSlop={8}>
              <View style={{ position: 'relative' }}>
                <Ionicons name="person-circle-outline" size={28} color="#fff" />
                {points > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{points > 999 ? '1k+' : points}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        onRegionChangeComplete={setRegion}
        onPress={onMapPress}
      >
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={poi.coordinate}
            title={poi.title}
            description="הקש לצפייה וליצירת סיור"
            pinColor={theme.colors.accent}
            onCalloutPress={() => router.push(`/poi/${poi.id}`)}
          />
        ))}
        {tapped && (
          <Marker coordinate={tapped} pinColor={theme.colors.primary} title="המיקום שבחרת" />
        )}
      </MapView>

      {/* Search bar */}
      <View style={styles.searchPill}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="חפש מקום, או הקש על המפה"
          placeholderTextColor={theme.colors.textMuted}
          textAlign="right"
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <TouchableOpacity onPress={onSearch} hitSlop={8}>
            <Ionicons name="search" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Points badge - always visible, tap → leaderboard */}
      <TouchableOpacity
        style={styles.pointsPill}
        onPress={() => router.push('/profile?tab=board')}
        activeOpacity={0.85}
      >
        <Ionicons name="trophy" size={14} color={theme.colors.accent} />
        <Text style={styles.pointsPillText}>{points} נקודות</Text>
        <Ionicons name="person-outline" size={14} color={theme.colors.primaryLight} />
      </TouchableOpacity>

      {pois.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cardRow}
          contentContainerStyle={styles.cardRowContent}
        >
          {pois.map((poi) => (
            <TouchableOpacity
              key={poi.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => router.push(`/poi/${poi.id}`)}
            >
              {poi.thumbnailUrl ? (
                <Image source={wikiImage(poi.thumbnailUrl)} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="business" size={22} color={theme.colors.primaryLight} />
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
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.fab} onPress={searchHere} disabled={loading} activeOpacity={0.9}>
          {loading ? (
            <ActivityIndicator color={theme.colors.accentDark} />
          ) : (
            <>
              <Ionicons name="navigate" size={18} color={theme.colors.accentDark} />
              <Text style={styles.fabText}>מה יש סביבי?</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onLogout} activeOpacity={0.9}>
          <Ionicons name="log-out-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchPill: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
    left: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(2),
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1),
    ...theme.shadowSoft,
  },
  searchText: { color: theme.colors.textMuted, fontSize: 14, flex: 1, textAlign: 'right' },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15, textAlign: 'right', padding: 0 },
  cardRow: { position: 'absolute', bottom: 92, left: 0, right: 0, maxHeight: 96 },
  cardRowContent: { paddingHorizontal: theme.spacing(2), gap: theme.spacing(1.5), flexDirection: 'row-reverse' },
  card: {
    width: 240,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1),
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1),
    ...theme.shadowSoft,
  },
  thumb: { width: 56, height: 56, borderRadius: theme.radius },
  thumbPlaceholder: {
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, textAlign: 'right' },
  cardSummary: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },
  actions: {
    position: 'absolute',
    bottom: theme.spacing(3),
    right: theme.spacing(2),
    left: theme.spacing(2),
    flexDirection: 'row-reverse',
    gap: theme.spacing(1.5),
  },
  fab: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg,
    ...theme.shadow,
  },
  fabText: { color: theme.colors.accentDark, fontWeight: '700', fontSize: 16 },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radiusLg,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadowSoft,
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  headerBadgeText: { fontSize: 9, fontWeight: '900', color: theme.colors.accentDark },
  pointsPill: {
    position: 'absolute',
    top: theme.spacing(8),
    alignSelf: 'center',
    left: theme.spacing(2),
    right: theme.spacing(2),
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(2),
    ...theme.shadow,
  },
  pointsPillText: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
});
