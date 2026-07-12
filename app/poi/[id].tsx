import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { trackEvent } from '@/state/analytics';
import { getLlmProvider, getPoiProvider } from '@/services/factory';
import { requestHighlights, type PlaceHighlight } from '@/services/highlights/highlightsApi';
import { useAuth } from '@/auth/AuthProvider';
import {
  TOUR_LENGTHS,
  TOUR_STYLES,
  TOUR_STYLE_LABELS,
  type TourLengthMinutes,
  type TourStyle,
} from '@/domain/types';
import { theme } from '@/ui/theme';
import { showAlert } from '@/ui/dialogs';
import { wikiImage } from '@/ui/wikiImage';

const STYLE_META: Record<TourStyle, { emoji: string; desc: string; color: string }> = {
  historical: { emoji: '🏛',  desc: 'עובדות היסטוריות ורקע תרבותי', color: '#7c5c2e' },
  mystery:    { emoji: '🔍',  desc: 'מסתורין, אגדות וסיפורים נסתרים', color: '#4a3060' },
  kids:       { emoji: '🎈',  desc: 'הסבר כיפי ומתאים לכל גיל', color: '#1a6b40' },
};

const LENGTH_META: Record<number, { label: string; words: string; icon: string }> = {
  3:  { label: '3 דקות', words: '~450 מילים',  icon: 'flash-outline'   },
  5:  { label: '5 דקות', words: '~750 מילים',  icon: 'walk-outline'    },
  10: { label: '10 דקות', words: '~1,500 מילים', icon: 'map-outline'    },
};

export default function PoiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const poi = id ? getCachedPoi(id) : undefined;

  const [minutes, setMinutes] = useState<TourLengthMinutes>(5);
  const [style, setStyle] = useState<TourStyle>('historical');
  const [busy, setBusy] = useState(false);
  const [busyVideo, setBusyVideo] = useState(false);

  // תיאור מורחב: נטען רק בלחיצה על התקציר הקצר.
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [extendedSummary, setExtendedSummary] = useState<string | null>(null);
  const [extendedLoading, setExtendedLoading] = useState(false);

  // נקודות מרכזיות: נטענות ברקע עם כניסה למסך, מוצגות רק אם הצליחו.
  const [highlights, setHighlights] = useState<PlaceHighlight[]>([]);

  useEffect(() => {
    if (poi) trackEvent('poi_view', { poiId: poi.id, title: poi.title });
  }, [poi?.id]);

  useEffect(() => {
    if (!poi) return;
    let active = true;
    requestHighlights(poi.title, poi.summary).then((h) => { if (active) setHighlights(h); });
    return () => { active = false; };
  }, [poi?.id]);

  const toggleSummary = async () => {
    if (summaryExpanded) { setSummaryExpanded(false); return; }
    setSummaryExpanded(true);
    if (extendedSummary || extendedLoading || !poi) return;
    setExtendedLoading(true);
    try {
      setExtendedSummary(await getPoiProvider().fetchExtendedSummary(poi.id));
    } catch {
      // נשארים עם התקציר הקצר - לא קריטי
    } finally {
      setExtendedLoading(false);
    }
  };

  if (!poi) {
    return (
      <View style={styles.center}>
        <Ionicons name="map-outline" size={48} color={theme.colors.border} />
        <Text style={styles.muted}>נקודת העניין לא נמצאה.</Text>
        <Text style={styles.mutedSub}>חזור למפה ובחר מקום.</Text>
      </View>
    );
  }

  const onCreate = async () => {
    try {
      setBusy(true);
      const fullText = await getPoiProvider().fetchArticleText(poi.id).catch(() => '');
      const enrichedPoi = fullText.length > poi.summary.length ? { ...poi, summary: fullText } : poi;
      const tour = await getLlmProvider(!!session?.access_token).generateTourScript(
        { poi: enrichedPoi, minutes, style },
        session?.access_token,
      );
      cacheTour(tour);
      trackEvent('tour_generated', { poiId: poi.id, minutes, style });
      router.push(`/tour/${poi.id}`);
    } catch (err) {
      showAlert('יצירת הסיור נכשלה', err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setBusy(false);
    }
  };

  const onVideo = () => {
    trackEvent('video_requested', { poiId: poi.id, minutes, style });
    router.push(`/video/${poi.id}?minutes=${minutes}&style=${style}`);
  };

  const onQuiz = () => {
    trackEvent('quiz_started', { poiId: poi.id });
    router.push(`/quiz/${poi.id}`);
  };

  const selectedStyleMeta = STYLE_META[style];
  const selectedLengthMeta = LENGTH_META[minutes];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Hero */}
      <View style={styles.hero}>
        {poi.thumbnailUrl ? (
          <Image source={wikiImage(poi.thumbnailUrl)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={theme.gradientHero} style={[StyleSheet.absoluteFill, styles.heroFallback]}>
            <Ionicons name="business" size={64} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(10,30,20,0.92)']} style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>{poi.title}</Text>
          <View style={styles.heroAttrib}>
            <Ionicons name="book-outline" size={12} color="rgba(255,255,255,0.65)" />
            <Text style={styles.heroAttribText}>Wikipedia</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Summary - לחיצה מרחיבה לתיאור מלא יותר מוויקיפדיה */}
      {poi.summary ? (
        <TouchableOpacity style={styles.summaryCard} onPress={toggleSummary} activeOpacity={0.85}>
          <Text style={styles.summaryText} numberOfLines={summaryExpanded ? undefined : 4}>
            {summaryExpanded && extendedSummary ? extendedSummary : poi.summary}
          </Text>
          <View style={styles.summaryToggle}>
            {extendedLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primaryLight} />
            ) : (
              <>
                <Text style={styles.summaryToggleText}>{summaryExpanded ? 'הצג פחות' : 'קרא עוד'}</Text>
                <Ionicons name={summaryExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.primaryLight} />
              </>
            )}
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Highlights - 4-5 נקודות מרכזיות למבט-על, לפני ההעמקה בתוכן המלא */}
      {highlights.length > 0 && (
        <View style={styles.highlightsCard}>
          {highlights.map((h, i) => (
            <View key={i} style={styles.highlightRow}>
              <Text style={styles.highlightEmoji}>{h.emoji}</Text>
              <Text style={styles.highlightText}>{h.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tour builder */}
      <View style={styles.builderCard}>
        <Text style={styles.builderTitle}>בנה את הסיור שלך</Text>

        {/* Duration */}
        <Text style={styles.builderLabel}>משך הסיור</Text>
        <View style={styles.lengthRow}>
          {(TOUR_LENGTHS as TourLengthMinutes[]).map((m) => {
            const meta = LENGTH_META[m];
            const active = minutes === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.lengthCard, active && styles.lengthCardActive]}
                onPress={() => setMinutes(m)}
                activeOpacity={0.85}
              >
                <Ionicons name={meta.icon as any} size={20} color={active ? '#fff' : theme.colors.primaryLight} />
                <Text style={[styles.lengthLabel, active && styles.lengthLabelActive]}>{meta.label}</Text>
                <Text style={[styles.lengthWords, active && styles.lengthWordsActive]}>{meta.words}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Style */}
        <Text style={styles.builderLabel}>סגנון הסיור</Text>
        <View style={styles.styleGrid}>
          {(TOUR_STYLES as TourStyle[]).map((s) => {
            const meta = STYLE_META[s];
            const active = style === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.styleCard, active && { borderColor: meta.color, borderWidth: 2 }]}
                onPress={() => setStyle(s)}
                activeOpacity={0.85}
              >
                {active && (
                  <View style={[styles.styleCheck, { backgroundColor: meta.color }]}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
                <Text style={styles.styleEmoji}>{meta.emoji}</Text>
                <Text style={[styles.styleLabel, active && { color: meta.color }]}>
                  {TOUR_STYLE_LABELS[s]}
                </Text>
                <Text style={styles.styleDesc}>{meta.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview pill */}
        <View style={styles.previewPill}>
          <Ionicons name="information-circle-outline" size={15} color={theme.colors.primaryLight} />
          <Text style={styles.previewText}>
            סיור {selectedStyleMeta.emoji} {TOUR_STYLE_LABELS[style]} · {selectedLengthMeta.label} · {selectedLengthMeta.words}
          </Text>
        </View>
      </View>

      {/* CTAs */}
      <View style={styles.ctaSection}>
        {/* Primary: Audio tour */}
        <TouchableOpacity
          style={[styles.ctaPrimary, busy && styles.ctaDisabled]}
          onPress={onCreate}
          disabled={busy}
          activeOpacity={0.9}
        >
          <LinearGradient colors={busy ? ['#b8891f', '#b8891f'] : [theme.colors.accent, '#d4922a']} style={styles.ctaGrad}>
            {busy ? (
              <>
                <ActivityIndicator color={theme.colors.accentDark} />
                <Text style={styles.ctaPrimaryText}>יוצר סיור...</Text>
              </>
            ) : (
              <>
                <Ionicons name="headset" size={22} color={theme.colors.accentDark} />
                <Text style={styles.ctaPrimaryText}>סיור שמע</Text>
                <View style={styles.ctaSubLabel}>
                  <Text style={styles.ctaSubLabelText}>AI · עברית</Text>
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Secondary: Video + Quiz */}
        <View style={styles.ctaSecondaryRow}>
          <TouchableOpacity
            style={[styles.ctaSecondary, { flex: 1 }]}
            onPress={onVideo}
            disabled={busyVideo}
            activeOpacity={0.88}
          >
            <Ionicons name="videocam-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.ctaSecondaryText}>סיור וידאו</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctaSecondary, { flex: 1 }]}
            onPress={onQuiz}
            activeOpacity={0.88}
          >
            <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.ctaSecondaryText}>חידון</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content:   { paddingBottom: theme.spacing(5) },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing(1), padding: theme.spacing(3) },
  muted:     { fontSize: 17, fontWeight: '700', color: theme.colors.text,    textAlign: 'center' },
  mutedSub:  { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },

  hero: { height: 240, backgroundColor: theme.colors.primary, justifyContent: 'flex-end' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 140,
    justifyContent: 'flex-end', padding: theme.spacing(2), gap: 4,
  },
  heroTitle:      { color: '#fff', fontSize: 26, fontWeight: '800' },
  heroAttrib:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroAttribText: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },

  summaryCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing(2),
    marginTop: theme.spacing(2),
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    ...theme.shadowSoft,
  },
  summaryText: { fontSize: 15, lineHeight: 24, color: theme.colors.text },
  summaryToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: theme.spacing(1), alignSelf: 'flex-start',
  },
  summaryToggleText: { fontSize: 13, fontWeight: '700', color: theme.colors.primaryLight },

  highlightsCard: {
    backgroundColor: theme.colors.surfaceAlt,
    marginHorizontal: theme.spacing(2),
    marginTop: theme.spacing(1.5),
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(1) },
  highlightEmoji: { fontSize: 18, lineHeight: 22 },
  highlightText: { flex: 1, fontSize: 14, lineHeight: 21, color: theme.colors.text },

  builderCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing(2),
    borderRadius: theme.radiusXl,
    padding: theme.spacing(2.5),
    ...theme.shadow,
  },
  builderTitle: {
    fontSize: 18, fontWeight: '800', color: theme.colors.primary,
    marginBottom: theme.spacing(2),
  },
  builderLabel: {
    fontSize: 12, fontWeight: '700', color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: theme.spacing(1), marginTop: theme.spacing(1.5),
  },

  lengthRow: { flexDirection: 'row', gap: theme.spacing(1) },
  lengthCard: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(0.5),
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  lengthCardActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryLight,
  },
  lengthLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  lengthLabelActive: { color: '#fff' },
  lengthWords: { fontSize: 10, color: theme.colors.textMuted },
  lengthWordsActive: { color: 'rgba(255,255,255,0.75)' },

  styleGrid: { flexDirection: 'row', gap: theme.spacing(1) },
  styleCard: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.5),
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  styleCheck: {
    position: 'absolute', top: 6, left: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  styleEmoji: { fontSize: 24 },
  styleLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  styleDesc:  { fontSize: 9,  color: theme.colors.textMuted, textAlign: 'center', lineHeight: 13 },

  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(2),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(2),
  },
  previewText: { fontSize: 12, color: theme.colors.primaryLight, fontWeight: '600', flex: 1 },

  ctaSection: { paddingHorizontal: theme.spacing(2), gap: theme.spacing(1.25) },
  ctaPrimary: { borderRadius: theme.radiusLg, overflow: 'hidden', ...theme.shadow },
  ctaDisabled: { opacity: 0.65 },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    paddingVertical: theme.spacing(2.25),
    paddingHorizontal: theme.spacing(2),
  },
  ctaPrimaryText: { fontSize: 18, fontWeight: '800', color: theme.colors.accentDark },
  ctaSubLabel: {
    backgroundColor: 'rgba(58,42,6,0.15)',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  ctaSubLabelText: { fontSize: 10, fontWeight: '700', color: theme.colors.accentDark },

  ctaSecondaryRow: { flexDirection: 'row', gap: theme.spacing(1) },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadowSoft,
  },
  ctaSecondaryText: { fontSize: 15, fontWeight: '700', color: theme.colors.primary },
});
