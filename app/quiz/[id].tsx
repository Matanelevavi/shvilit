import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCachedPoi } from '@/state/store';
import { requestQuiz, type QuizQuestion } from '@/services/quiz/quizApi';
import {
  addPoints, getRank, isQuizDone, saveQuizResult,
  POINTS_PER_CORRECT, type Rank,
} from '@/state/gameState';
import { theme } from '@/ui/theme';
import { trackEvent } from '@/state/analytics';

function shuffleQuestion(q: QuizQuestion): QuizQuestion {
  const correct = q.options[q.answer];
  const shuffled = [...q.options].sort(() => Math.random() - 0.5);
  return { ...q, options: shuffled, answer: shuffled.indexOf(correct) };
}

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const poi = id ? getCachedPoi(id) : undefined;
  const location = poi?.title ?? id ?? '';

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [rank, setRank] = useState<Rank | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);

  useEffect(() => {
    if (!location) { setError('לא ניתן לזהות את המקום.'); setLoading(false); return; }
    let active = true;

    Promise.all([requestQuiz(location), isQuizDone(location)])
      .then(([qs, done]) => {
        if (!active) return;
        if (qs.length === 0) { setError('לא נוצרו שאלות. נסה מקום אחר.'); return; }
        setQuestions(qs.map(shuffleQuestion));
        setAlreadyDone(done);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'שגיאה'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const onSelect = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[index].answer) setScore((s) => s + 1);
  };

  const onNext = async () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      // חידון הסתיים
      let pts = 0;
      if (!alreadyDone) {
        // פעם ראשונה - נותנים נקודות ושומרים
        pts = score * POINTS_PER_CORRECT;
        const total = await addPoints(pts);
        setRank(getRank(total));
      } else {
        // כבר נעשה - מציגים תוצאה בלי נקודות
        const total = await import('@/state/gameState').then((m) => m.getPoints());
        setRank(getRank(total));
      }
      setEarnedPoints(pts);
      await saveQuizResult({ location, score, total: questions.length, earnedPoints: pts, date: Date.now() });
      trackEvent('quiz_completed', { location, score, total: questions.length, earnedPoints: pts });
      setFinished(true);
    }
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setRank(null);
    setEarnedPoints(0);
    // חידון נוסף לא יתן נקודות
    setAlreadyDone(true);
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    requestQuiz(location)
      .then((qs) => qs.length === 0 ? setError('לא נוצרו שאלות.') : setQuestions(qs.map(shuffleQuestion)))
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'))
      .finally(() => setLoading(false));
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingTitle}>מכין חידון על {location || 'המקום'}...</Text>
        <Text style={styles.muted}>אפשר לצאת ולחזור - החידון יהיה מוכן כשתחזור</Text>
      </View>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="help-circle-outline" size={44} color={theme.colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={retry}>
          <Text style={styles.primaryBtnText}>נסה שוב</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>חזרה</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Finished ──────────────────────────────────────────────────────────────
  if (finished && rank) {
    return (
      <ScrollView contentContainerStyle={styles.resultWrap}>
        <Ionicons name="trophy" size={64} color={theme.colors.accent} />
        <Text style={styles.resultTitle}>כל הכבוד!</Text>
        <Text style={styles.resultScore}>{score} / {questions.length} תשובות נכונות</Text>

        {earnedPoints > 0 ? (
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsEarned}>+{earnedPoints} נקודות</Text>
          </View>
        ) : (
          <View style={[styles.pointsBadge, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[styles.pointsEarned, { color: theme.colors.textMuted }]}>
              כבר צברת נקודות על חידון זה
            </Text>
          </View>
        )}

        <Text style={styles.rankLine}>
          סה"כ {rank.points} נק' · תואר: <Text style={styles.rankName}>{rank.emoji} {rank.name}</Text>
        </Text>
        {rank.nextName ? (
          <Text style={styles.nextRank}>עוד {rank.pointsToNext} נק' לתואר "{rank.nextName}"</Text>
        ) : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
          <Text style={styles.primaryBtnText}>שחק שוב (ללא נקודות)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.primaryBtnText}>האזור האישי שלי</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>סיום</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Quiz ──────────────────────────────────────────────────────────────────
  const q = questions[index];
  const optionStyle = (i: number) => {
    if (selected === null) return styles.option;
    if (i === q.answer) return [styles.option, styles.optionCorrect];
    if (i === selected) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDim];
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {alreadyDone && (
        <View style={styles.repeatBanner}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.primaryLight} />
          <Text style={styles.repeatText}>כבר השלמת חידון זה - לא יתווספו נקודות בסיבוב הזה</Text>
        </View>
      )}

      <Text style={styles.progress}>שאלה {index + 1} מתוך {questions.length}</Text>
      <Text style={styles.question}>{q.question}</Text>

      {q.options.map((opt, i) => (
        <TouchableOpacity key={i} style={optionStyle(i)} onPress={() => onSelect(i)} activeOpacity={0.85}>
          <Text style={styles.optionText}>{opt}</Text>
          {selected !== null && i === q.answer ? (
            <Ionicons name="checkmark-circle" size={20} color="#1c6b4f" />
          ) : selected === i ? (
            <Ionicons name="close-circle" size={20} color={theme.colors.danger} />
          ) : null}
        </TouchableOpacity>
      ))}

      {selected !== null ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={onNext} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>
            {index + 1 < questions.length ? 'לשאלה הבאה' : 'סיום וצבירת נקודות'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5), maxWidth: 640, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3), gap: theme.spacing(1.5), backgroundColor: theme.colors.background },
  loadingTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.primary, textAlign: 'center' },
  muted: { color: theme.colors.textMuted, textAlign: 'center', fontSize: 13 },
  errorText: { fontSize: 16, color: theme.colors.text, textAlign: 'center', lineHeight: 24 },

  repeatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(0.5),
  },
  repeatText: { flex: 1, fontSize: 13, color: theme.colors.primaryLight },

  progress: { fontSize: 13, color: theme.colors.textMuted },
  question: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing(1) },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.surface, borderRadius: theme.radiusLg,
    borderWidth: 1.5, borderColor: theme.colors.border, padding: theme.spacing(2), ...theme.shadowSoft,
  },
  optionCorrect: { borderColor: theme.colors.primaryLight, backgroundColor: '#e3efe8' },
  optionWrong: { borderColor: theme.colors.danger, backgroundColor: '#fbeceb' },
  optionDim: { opacity: 0.6 },
  optionText: { flex: 1, fontSize: 16, color: theme.colors.text },

  primaryBtn: {
    backgroundColor: theme.colors.accent, paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg, alignItems: 'center', marginTop: theme.spacing(1), ...theme.shadow,
  },
  primaryBtnText: { color: theme.colors.accentDark, fontWeight: '800', fontSize: 17 },

  resultWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3), gap: theme.spacing(1.5), backgroundColor: theme.colors.background },
  resultTitle: { fontSize: 28, fontWeight: '800', color: theme.colors.primary },
  resultScore: { fontSize: 18, color: theme.colors.text },
  pointsBadge: { backgroundColor: theme.colors.accent, borderRadius: 999, paddingVertical: theme.spacing(1), paddingHorizontal: theme.spacing(3) },
  pointsEarned: { color: theme.colors.accentDark, fontWeight: '800', fontSize: 18 },
  rankLine: { fontSize: 16, color: theme.colors.text, marginTop: theme.spacing(1) },
  rankName: { fontWeight: '800', color: theme.colors.primary },
  nextRank: { fontSize: 14, color: theme.colors.textMuted },
  linkBtn: { padding: theme.spacing(1.5) },
  linkText: { color: theme.colors.primary, fontWeight: '600', fontSize: 16 },
});
