import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCachedPoi, cacheTour } from '@/state/store';
import { getLlmProvider, getPoiProvider } from '@/services/factory';
import { useAuth } from '@/auth/AuthProvider';
import {
  TOUR_LENGTHS,
  TOUR_STYLES,
  TOUR_STYLE_LABELS,
  type TourLengthMinutes,
  type TourStyle,
} from '@/domain/types';
import { theme } from '@/ui/theme';
import { wikiImage } from '@/ui/wikiImage';

export default function PoiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const poi = id ? getCachedPoi(id) : undefined;

  const [minutes, setMinutes] = useState<TourLengthMinutes>(5);
  const [style, setStyle] = useState<TourStyle>('historical');
  const [busy, setBusy] = useState(false);

  if (!poi) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>נקודת העניין לא נמצאה. חזור למפה ונסה שוב.</Text>
      </View>
    );
  }

  const onCreate = async () => {
    try {
      setBusy(true);
      // מביאים את הטקסט המלא של הערך כהקשר עשיר (במקום 4 משפטים בלבד).
      const fullText = await getPoiProvider().fetchArticleText(poi.id).catch(() => '');
      const enrichedPoi =
        fullText.length > poi.summary.length ? { ...poi, summary: fullText } : poi;
      const tour = await getLlmProvider(!!session?.access_token).generateTourScript(
        { poi: enrichedPoi, minutes, style },
        session?.access_token,
      );
      cacheTour(tour);
      router.push(`/tour/${poi.id}`);
    } catch (err) {
      Alert.alert('יצירת הסיור נכשלה', err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {poi.thumbnailUrl ? (
          <Image source={{ uri: poi.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={theme.gradientHero} style={StyleSheet.absoluteFill}>
            <View style={styles.heroIcon}>
              <Ionicons name="business" size={56} color="rgba(255,255,255,0.85)" />
            </View>
          </LinearGradient>
        )}
        <LinearGradient colors={theme.gradientOverlay} style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>{poi.title}</Text>
        </LinearGradient>
      </View>

      <View style={styles.body}>
        <Text style={styles.summary}>{poi.summary || 'אין תקציר זמין לאתר זה.'}</Text>
        <View style={styles.attrRow}>
          <Ionicons name="book-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.attribution}>מבוסס על ויקיפדיה</Text>
        </View>

        <Text style={styles.section}>אורך הסיור</Text>
        <View style={styles.chips}>
          {TOUR_LENGTHS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, minutes === m && styles.chipActive]}
              onPress={() => setMinutes(m)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, minutes === m && styles.chipTextActive]}>{m} דקות</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>סגנון</Text>
        <View style={styles.chips}>
          {TOUR_STYLES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, style === s && styles.chipActive]}
              onPress={() => setStyle(s)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, style === s && styles.chipTextActive]}>
                {TOUR_STYLE_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, busy && styles.ctaDisabled]}
          onPress={onCreate}
          disabled={busy}
          activeOpacity={0.9}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.accentDark} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={theme.colors.accentDark} />
              <Text style={styles.ctaText}>צור סיור</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.videoCta}
          onPress={() => router.push(`/video/${poi.id}?minutes=${minutes}&style=${style}`)}
          activeOpacity={0.9}
        >
          <Ionicons name="videocam-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.videoCtaText}>צור סיור וידאו</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quizCta}
          onPress={() => router.push(`/quiz/${poi.id}`)}
          activeOpacity={0.9}
        >
          <Ionicons name="help-circle-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.videoCtaText}>חידון וצבירת נקודות</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { paddingBottom: theme.spacing(5) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3) },
  muted: { color: theme.colors.textMuted, textAlign: 'center' },
  hero: { height: 220, backgroundColor: theme.colors.primary, justifyContent: 'flex-end' },
  heroIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    justifyContent: 'flex-end',
    padding: theme.spacing(2),
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'right' },
  body: { padding: theme.spacing(2) },
  summary: { fontSize: 16, lineHeight: 24, color: theme.colors.text, textAlign: 'right' },
  attrRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  attribution: { fontSize: 12, color: theme.colors.textMuted },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'right',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
  },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing(1) },
  chip: {
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(2),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  chipText: { color: theme.colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  cta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(4),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg,
    ...theme.shadow,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: theme.colors.accentDark, fontWeight: '800', fontSize: 18 },
  videoCta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface,
  },
  videoCtaText: { color: theme.colors.primary, fontWeight: '700', fontSize: 17 },
  quizCta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface,
  },
});
