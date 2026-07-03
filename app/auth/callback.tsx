import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/auth/supabaseClient';
import { theme } from '@/ui/theme';

/**
 * דף callback ל-OAuth. Supabase מפנה לכאן אחרי הכניסה עם Google.
 *
 * חשוב: ב-web ה-client מוגדר עם detectSessionInUrl=true, כלומר supabase-js
 * מחליף את ה-code ל-session אוטומטית בטעינת הדף. לכן כאן לא מחליפים את
 * ה-code ידנית באופן עיוור (הוא חד-פעמי - החלפה כפולה נכשלת), אלא:
 * 1. מאזינים ל-onAuthStateChange ובודקים getSession - אם יש session, ממשיכים.
 * 2. רק אם אחרי המתנה קצרה אין session ויש code (מקרה native deep-link),
 *    מנסים החלפה ידנית.
 * 3. גם אם ההחלפה הידנית נכשלת, בודקים שוב session לפני שמוותרים -
 *    ייתכן שההחלפה האוטומטית ניצחה במרוץ.
 */
export default function AuthCallbackPage() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!supabase) {
      router.replace('/login');
      return;
    }
    const sb = supabase;

    if (params.error) {
      console.error('OAuth error:', params.error, params.error_description);
      router.replace('/login');
      return;
    }

    let finished = false;
    const done = (path: '/' | '/login') => {
      if (finished) return;
      finished = true;
      router.replace(path);
    };

    // מסלול 1: ההחלפה האוטומטית (detectSessionInUrl) מסתיימת ויורה אירוע
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) done('/');
    });

    // אולי כבר יש session (רענון דף, או שההחלפה כבר קרתה)
    sb.auth.getSession().then(({ data }) => {
      if (data.session) done('/');
    });

    // מסלול 2: אחרי המתנה - אם אין session ויש code, מנסים החלפה ידנית
    const manualTimer = setTimeout(async () => {
      if (finished) return;
      const { data } = await sb.auth.getSession();
      if (data.session) { done('/'); return; }

      const code = params.code ? String(params.code) : null;
      if (!code) { done('/login'); return; }

      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (!error) { done('/'); return; }

      // ההחלפה נכשלה - אולי האוטומטית ניצחה בינתיים; בדיקה אחרונה
      const { data: again } = await sb.auth.getSession();
      done(again.session ? '/' : '/login');
    }, 1500);

    // רשת בטחון: לא נתקעים על המסך הזה לעולם
    const failsafe = setTimeout(() => done('/login'), 12_000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(manualTimer);
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>מתחבר עם Google...</Text>
      <Text style={styles.hint}>רגע אחד</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: 12,
  },
  text: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  hint: { fontSize: 13, color: theme.colors.textMuted },
});
