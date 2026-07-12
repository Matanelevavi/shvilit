import { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSavedTours, removeSavedTour, type SavedTour } from '@/state/savedTours';
import { cachePois, cacheTour } from '@/state/store';
import { countWords } from '@/domain/tourLength';
import { TOUR_STYLE_LABELS } from '@/domain/types';
import { theme } from '@/ui/theme';
import { wikiImage } from '@/ui/wikiImage';

export default function SavedScreen() {
  const router = useRouter();
  const [tours, setTours] = useState<SavedTour[]>([]);

  const load = useCallback(() => {
    getSavedTours().then(setTours);
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const open = (t: SavedTour) => {
    cachePois([
      {
        id: t.poiId,
        title: t.title,
        summary: '',
        thumbnailUrl: t.thumbnailUrl,
        coordinate: { latitude: 0, longitude: 0 },
        sourceUrl: '',
      },
    ]);
    cacheTour({
      poiId: t.poiId,
      title: t.title,
      style: t.style,
      minutes: t.minutes,
      text: t.text,
      wordCount: countWords(t.text),
      source: 'mock',
      attribution: t.attribution,
    });
    router.push(`/tour/${t.poiId}`);
  };

  const del = async (poiId: string) => {
    await removeSavedTour(poiId);
    load();
  };

  if (tours.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="bookmark-outline" size={56} color={theme.colors.primaryLight} />
        <Text style={styles.emptyText}>אין סיורים שמורים עדיין.</Text>
        <Text style={styles.emptyHint}>צור סיור והקש על סימן הסימנייה כדי לשמור אותו לכאן.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {tours.map((t) => (
        <View key={t.poiId} style={styles.card}>
          <TouchableOpacity style={styles.cardMain} activeOpacity={0.9} onPress={() => open(t)}>
            {t.thumbnailUrl ? (
              <Image source={wikiImage(t.thumbnailUrl)} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="image-outline" size={24} color={theme.colors.primaryLight} />
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.meta}>
                {t.minutes} דקות · {TOUR_STYLE_LABELS[t.style]}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={() => del(t.poiId)} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), maxWidth: 760, width: '100%', alignSelf: 'center' },
  empty: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
    gap: theme.spacing(1.5),
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  emptyHint: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', maxWidth: 280 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.25),
    gap: theme.spacing(1),
    ...theme.shadowSoft,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.25) },
  thumb: { width: 60, height: 60, borderRadius: theme.radius },
  thumbPlaceholder: { backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  meta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  delBtn: { padding: theme.spacing(1) },
});
