import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '@/ui/VideoPlayer';
import { getCachedPoi } from '@/state/store';
import { requestVideoTour, getVideoTour } from '@/services/video/videoTourApi';
import { TOUR_STYLE_LABELS, type TourLengthMinutes, type TourStyle } from '@/domain/types';
import {
  addPendingVideo, removePendingVideo,
  saveVideo, isVideoSaved,
} from '@/state/gameState';
import { theme } from '@/ui/theme';

const MAX_POLL_MS = 12 * 60 * 1000;

const PROGRESS_MSGS = [
  'כותבים תסריט...',
  'מקליטים קריינות עברית...',
  'אוספים תמונות...',
  'מרכיבים את הווידאו...',
];


export default function VideoTourScreen() {
  const params = useLocalSearchParams<{ id: string; minutes: string; style: string; savedUrl?: string }>();
  const router = useRouter();
  const poi = params.id ? getCachedPoi(params.id) : undefined;
  const minutes = (Number(params.minutes) || 5) as TourLengthMinutes;
  const style = (params.style as TourStyle) || 'historical';

  // אם הגיע מסרטון שמור
  const [url, setUrl] = useState<string | null>(params.savedUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const activeRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedRef = useRef<number>(0);
  const msgTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const geminiRetryRef = useRef(0);
  const locationRef = useRef('');

  const cleanup = () => {
    activeRef.current = false;
    clearTimeout(timerRef.current);
    clearInterval(msgTimerRef.current);
  };

  // בדיקת שמירה בטעינה
  useEffect(() => {
    if (poi) {
      isVideoSaved(poi.title).then(setSaved);
    }
  }, []);

  // אם יש savedUrl - לא צריך לייצר
  useEffect(() => {
    if (params.savedUrl) return;
    if (!poi) { setError('נקודת העניין לא נמצאה. חזור ובחר מקום.'); return; }
    locationRef.current = poi.title;
    startRequest(poi.title);
    return cleanup;
  }, []);

  const startRequest = (location: string) => {
    activeRef.current = true;
    startedRef.current = Date.now();
    locationRef.current = location;

    msgTimerRef.current = setInterval(() => {
      setMsgIdx((i) => (i + 1) % PROGRESS_MSGS.length);
    }, 18_000);

    const poll = async (id: string) => {
      if (!activeRef.current) return;
      if (Date.now() - startedRef.current > MAX_POLL_MS) {
        await removePendingVideo(location);
        setError('הפקת הווידאו לקחה יותר מדי זמן. נסה שוב.');
        return;
      }
      try {
        const s = await getVideoTour(id);
        if (!activeRef.current) return;
        if (s.status === 'completed' && s.video_url) {
          clearInterval(msgTimerRef.current);
          await removePendingVideo(location);
          return setUrl(s.video_url);
        }
        if (s.status === 'failed') {
          const isGeminiBusy = s.error?.includes('503') || s.error?.includes('all models tried') || s.error?.includes('unavailable');
          if (isGeminiBusy && geminiRetryRef.current < 2) {
            geminiRetryRef.current += 1;
            clearInterval(msgTimerRef.current);
            timerRef.current = setTimeout(() => startRequest(location), 20_000);
            return;
          }
          await removePendingVideo(location);
          return setError(s.error || 'הפקת הווידאו נכשלה.');
        }
        timerRef.current = setTimeout(() => poll(id), 4000);
      } catch (e: unknown) {
        if (!activeRef.current) return;
        const status = (e as { status?: number }).status;
        if (status === 404) {
          timerRef.current = setTimeout(() => startRequest(location), 2000);
        } else {
          await removePendingVideo(location);
          setError(e instanceof Error ? `${e.message}. בדוק שהשרת פועל.` : 'שגיאת רשת.');
        }
      }
    };

    (async () => {
      try {
        // שמירה כ-pending כדי שהמשתמש יוכל לחזור
        await addPendingVideo({ location, tourId: '', style, minutes, startedAt: Date.now() });
        const first = await requestVideoTour(location, minutes, style);
        if (!activeRef.current) return;
        // עדכון ה-tourId ב-pending
        await addPendingVideo({ location, tourId: first.id, style, minutes, startedAt: Date.now() });
        if (first.status === 'completed' && first.video_url) {
          clearInterval(msgTimerRef.current);
          await removePendingVideo(location);
          return setUrl(first.video_url);
        }
        if (first.status === 'failed') {
          const isGeminiBusy = first.error?.includes('503') || first.error?.includes('all models tried') || first.error?.includes('unavailable');
          if (isGeminiBusy && geminiRetryRef.current < 2) {
            geminiRetryRef.current += 1;
            clearInterval(msgTimerRef.current);
            timerRef.current = setTimeout(() => startRequest(location), 20_000);
            return;
          }
          await removePendingVideo(location);
          return setError(first.error || 'הפקת הווידאו נכשלה.');
        }
        timerRef.current = setTimeout(() => poll(first.id), 4000);
      } catch (e) {
        if (activeRef.current) {
          await removePendingVideo(location);
          setError(e instanceof Error ? `${e.message}. ה-Space אולי מתעורר - נסה שוב בעוד דקה.` : 'שגיאת רשת.');
        }
      }
    })();
  };

  const onSave = async () => {
    if (!url || !poi) return;
    await saveVideo({ location: poi.title, videoUrl: url, style, minutes, savedAt: Date.now() });
    setSaved(true);
    Alert.alert('✅ נשמר!', `הסרטון של "${poi.title}" נשמר לאזור האישי שלך.`);
  };

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={40} color={theme.colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => {
          if (!poi) return;
          setError(null); setUrl(null); setMsgIdx(0);
          geminiRetryRef.current = 0;
          startRequest(poi.title);
        }}>
          <Text style={styles.retryText}>נסה שוב</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>חזרה</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Video ready ──────────────────────────────────────────────────────────
  if (url) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{poi?.title ?? 'סיור וידאו'}</Text>
        <Text style={styles.meta}>{minutes} דקות · {TOUR_STYLE_LABELS[style]}</Text>
        <VideoPlayer uri={url} />
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnDone]}
            onPress={saved ? undefined : onSave}
            activeOpacity={saved ? 1 : 0.85}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? theme.colors.primary : theme.colors.primary} />
            <Text style={styles.saveBtnText}>{saved ? 'נשמר' : 'שמור סרטון'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
            <Ionicons name="person-outline" size={18} color={theme.colors.primaryLight} />
            <Text style={styles.profileBtnText}>אזור אישי</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.attr}>וידאו: Gemini + edge-tts + ויקיפדיה</Text>
      </View>
    );
  }

  // ─── Generating ───────────────────────────────────────────────────────────
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.progressTitle}>מכינים את סרטון הסיור שלך...</Text>
      <Text style={styles.progressNote}>{PROGRESS_MSGS[msgIdx]}</Text>
      <Text style={styles.progressHint}>תסריט, קריינות, תמונות ועריכה - כ-1-3 דקות</Text>
      <View style={styles.exitHint}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
        <Text style={styles.exitHintText}>אפשר לצאת מהמסך ולחזור - הסרטון ימשיך להיות מוכן</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  center: {
    flex: 1, backgroundColor: theme.colors.background, alignItems: 'center',
    justifyContent: 'center', padding: theme.spacing(3), gap: theme.spacing(1.5),
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text, textAlign: 'right' },
  meta: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'right', marginBottom: theme.spacing(1.5) },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: theme.radiusLg, overflow: 'hidden' },
  actionsRow: { flexDirection: 'row-reverse', gap: theme.spacing(1), marginTop: theme.spacing(1.5) },
  saveBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing(0.75), paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radiusLg, borderWidth: 1.5, borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface,
  },
  saveBtnDone: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.primaryLight },
  saveBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
  profileBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(0.5),
    paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(2),
    borderRadius: theme.radiusLg, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  profileBtnText: { color: theme.colors.primaryLight, fontWeight: '600', fontSize: 14 },
  attr: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right', marginTop: theme.spacing(1) },
  progressTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.primary, textAlign: 'center' },
  progressNote: { fontSize: 15, color: theme.colors.text, textAlign: 'center', fontWeight: '600' },
  progressHint: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  exitHint: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing(0.75),
    backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius,
    padding: theme.spacing(1.5), marginTop: theme.spacing(1),
  },
  exitHintText: { flex: 1, fontSize: 13, color: theme.colors.textMuted, textAlign: 'right', lineHeight: 18 },
  errorText: { fontSize: 16, color: theme.colors.text, textAlign: 'center', lineHeight: 24 },
  retryBtn: { backgroundColor: theme.colors.accent, paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(4), borderRadius: theme.radiusLg, ...theme.shadow },
  retryText: { color: theme.colors.accentDark, fontWeight: '700', fontSize: 16 },
  backBtn: { padding: theme.spacing(1) },
  backText: { color: theme.colors.primary, fontWeight: '600', fontSize: 15 },
});
