import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
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
import { getCachedTour, getCachedPoi } from '@/state/store';
import { getTtsProvider } from '@/services/factory';
import { isTourSaved, saveTour, removeSavedTour } from '@/state/savedTours';
import { TOUR_STYLE_LABELS } from '@/domain/types';
import { theme } from '@/ui/theme';
import { wikiImage } from '@/ui/wikiImage';

type PlayState = 'idle' | 'loading' | 'playing' | 'paused';
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_LABELS: Record<number, string> = { 0.5: '0.5×', 0.75: '0.75×', 1: 'רגיל', 1.25: '1.25×', 1.5: '1.5×', 2: '2×' };

export default function TourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tour = id ? getCachedTour(id) : undefined;
  const poi = id ? getCachedPoi(id) : undefined;
  const tts = getTtsProvider();
  const [state, setState] = useState<PlayState>('idle');
  const [rate, setRate] = useState(1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tour) isTourSaved(tour.poiId).then(setSaved);
  }, [tour?.poiId]);

  const toggleSave = async () => {
    if (!tour) return;
    if (saved) {
      await removeSavedTour(tour.poiId);
      setSaved(false);
    } else {
      await saveTour({
        poiId: tour.poiId,
        title: tour.title,
        thumbnailUrl: poi?.thumbnailUrl,
        minutes: tour.minutes,
        style: tour.style,
        text: tour.text,
        attribution: tour.attribution,
        savedAt: Date.now(),
      });
      setSaved(true);
    }
  };

  const progress = useRef(new Animated.Value(0)).current;
  const pausedAt = useRef(0);
  const durationMs = ((tour?.minutes ?? 5) * 60 * 1000) / rate;

  useEffect(() => () => void tts.stop(), []);

  if (!tour) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>הסיור לא נמצא. חזור ובחר נקודת עניין.</Text>
      </View>
    );
  }

  const animateFrom = (from: number) => {
    Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(200, durationMs * (1 - from)),
      useNativeDriver: false,
    }).start();
  };

  const finish = () => {
    progress.stopAnimation();
    progress.setValue(0);
    setState('idle');
  };

  const startSpeak = (speed: number) => {
    progress.setValue(0);
    setState('loading');
    tts
      .speak(
        tour.text,
        {
          onLoading: () => setState('loading'),
          onStart: () => { setState('playing'); animateFrom(0); },
          onDone: finish,
          onStopped: () => setState('idle'),
          onError: finish,
        },
        speed,
      )
      .catch(finish);
  };

  const pause = async () => {
    progress.stopAnimation((v) => (pausedAt.current = v));
    await tts.pause();
    setState('paused');
  };

  const resume = async () => {
    animateFrom(pausedAt.current);
    await tts.resume();
    setState('playing');
  };

  const stop = async () => {
    await tts.stop();
    finish();
  };

  const onMainPress = () => {
    if (state === 'idle') return startSpeak(rate);
    if (state === 'loading') return stop();
    if (state === 'playing') return tts.supportsPause ? pause() : stop();
    if (state === 'paused') return resume();
  };

  const onSpeed = (speed: number) => {
    setRate(speed);
    if (state !== 'idle') { void tts.stop(); startSpeak(speed); }
  };

  // main button: play → loading (spinner, ניתן לבטל) → pause (אם נתמך) / stop. paused → resume.
  const mainIcon =
    state === 'idle' || state === 'paused' ? 'play'
    : state === 'loading' ? 'hourglass-outline'
    : tts.supportsPause ? 'pause' : 'stop';
  // side stop button כשהמשתמש יכול לבטל/לעצור: בזמן טעינה, השהיה, או השמעה עם pause נתמך
  const showStop = state !== 'idle' && (state === 'loading' || state === 'paused' || tts.supportsPause);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {poi?.thumbnailUrl ? (
          <Image source={wikiImage(poi.thumbnailUrl)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={theme.gradientHero} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={theme.gradientOverlay} style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>{tour.title}</Text>
          <Text style={styles.heroMeta}>
            {tour.minutes} דקות · {TOUR_STYLE_LABELS[tour.style]}
          </Text>
        </LinearGradient>
        <TouchableOpacity style={styles.saveBtn} onPress={toggleSave} activeOpacity={0.85}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.playerCard}>
        <View style={styles.playerRow}>
          {showStop ? (
            <TouchableOpacity style={styles.sideBtn} onPress={stop} activeOpacity={0.85}>
              <Ionicons name="stop" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.sideSpacer} />
          )}
          <TouchableOpacity style={styles.playBtn} onPress={onMainPress} activeOpacity={0.9}>
            <Ionicons name={mainIcon} size={36} color={theme.colors.accentDark} />
          </TouchableOpacity>
          <View style={styles.sideSpacer} />
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>

        <Text style={styles.speedLabel}>מהירות השמעה</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.speedRow}>
          {SPEEDS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.speedChip, rate === s && styles.speedChipActive]}
              onPress={() => onSpeed(s)}
              activeOpacity={0.85}
            >
              <Text style={[styles.speedText, rate === s && styles.speedTextActive]}>
                {SPEED_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.profileLink} onPress={() => router.push('/profile')} activeOpacity={0.85}>
        <Ionicons name="trophy-outline" size={16} color={theme.colors.primaryLight} />
        <Text style={styles.profileLinkText}>האזור האישי שלי</Text>
        <Ionicons name="chevron-back" size={14} color={theme.colors.primaryLight} />
      </TouchableOpacity>

      <View style={styles.scriptCard}>
        {tour.text
          .split(/\n{2,}/)
          .map((para) => para.trim())
          .filter((para) => para.length > 0)
          .map((para, i) => (
            <Text key={i} style={[styles.script, i > 0 && styles.scriptSpacing]}>
              {para}
            </Text>
          ))}
      </View>

      <View style={styles.attrPill}>
        <Ionicons name="book-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.attrText}>{tour.attribution}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing(5) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3) },
  muted: { color: theme.colors.textMuted, textAlign: 'center' },
  hero: { height: 210, backgroundColor: theme.colors.primary, justifyContent: 'flex-end' },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
    justifyContent: 'flex-end',
    padding: theme.spacing(2),
  },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'right' },
  heroMeta: { color: '#e6efe9', fontSize: 14, textAlign: 'right', marginTop: 2 },
  saveBtn: {
    position: 'absolute',
    top: theme.spacing(1.5),
    left: theme.spacing(1.5),
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15,61,46,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing(2),
    borderRadius: theme.radiusXl,
    padding: theme.spacing(2.5),
    ...theme.shadow,
  },
  playerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
  },
  playBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow,
  },
  sideBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSpacer: { width: 50 },
  track: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  fill: { height: '100%', backgroundColor: theme.colors.primaryLight },
  speedLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginBottom: theme.spacing(1),
  },
  speedRow: { flexDirection: 'row-reverse', gap: theme.spacing(0.75), paddingVertical: theme.spacing(0.5) },
  speedChip: {
    paddingVertical: theme.spacing(0.875),
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  speedChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  speedText: { color: theme.colors.text, fontWeight: '600', fontSize: 14 },
  speedTextActive: { color: '#fff' },
  scriptCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing(2),
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    ...theme.shadowSoft,
  },
  script: { fontSize: 18, lineHeight: 30, color: theme.colors.text, textAlign: 'right' },
  scriptSpacing: { marginTop: theme.spacing(2) },
  profileLink: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing(0.75), marginHorizontal: theme.spacing(2), marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.surface, borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.5), ...theme.shadowSoft,
  },
  profileLinkText: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 14 },
  attrPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'center',
    gap: theme.spacing(0.5),
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: 999,
    marginTop: theme.spacing(2),
  },
  attrText: { fontSize: 12, color: theme.colors.textMuted },
});
