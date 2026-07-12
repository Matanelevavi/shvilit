import { useEffect } from 'react';
import { I18nManager, LogBox, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { LocalProfileProvider, useLocalProfile } from '@/auth/LocalProfile';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { theme } from '@/ui/theme';
import { trackEvent } from '@/state/analytics';

// אכיפת כיווניות עברית (RTL) לכל האפליקציה.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// הסתרת אזהרות פיתוח לא-מזיקות שמקפיצות תיבות צהובות.
LogBox.ignoreLogs([
  'WebCrypto API is not supported',
  'expected version',
]);

/** מנתב את המשתמש בין מסך ההתחברות לאפליקציה לפי מצב ה-session. */
function AuthGate() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useLocalProfile();
  const segments = useSegments();
  const router = useRouter();

  // מחובר אם יש session של Supabase או פרופיל מקומי (גיבוי שתמיד עובד).
  const isAuthed = !!user || !!profile;
  const loading = authLoading || profileLoading;

  useEffect(() => {
    if (loading) return;
    const onLogin    = segments[0] === 'login';
    const onCallback = segments[0] === 'auth'; // /auth/callback - לא לנתב ממנו
    const onPrivacy  = segments[0] === 'privacy'; // ציבורי - נדרש לאימות Google OAuth
    if (!isAuthed && !onLogin && !onCallback && !onPrivacy) {
      router.replace('/login');
    } else if (isAuthed && onLogin) {
      router.replace('/');
    }
  }, [isAuthed, loading, segments]);

  // מבקר בכל מסך (כולל אורחים לפני התחברות) - זה מה שנותן ספירת "מבקרים"
  // אמיתית באדמין, לא רק ספירת משתמשים רשומים.
  useEffect(() => {
    if (loading) return;
    trackEvent('page_view', undefined, '/' + segments.join('/'));
  }, [loading, segments.join('/')]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'שבילית' }} />
      <Stack.Screen name="poi/[id]" options={{ title: 'נקודת עניין' }} />
      <Stack.Screen name="tour/[id]" options={{ title: 'הסיור שלך' }} />
      <Stack.Screen name="video/[id]" options={{ title: 'סיור וידאו' }} />
      <Stack.Screen name="saved" options={{ title: 'הסיורים שלי' }} />
      <Stack.Screen name="quiz/[id]" options={{ title: 'חידון' }} />
      <Stack.Screen name="profile" options={{ title: 'האזור האישי שלי' }} />
      <Stack.Screen name="about"         options={{ title: 'אודות שבילית' }} />
      <Stack.Screen name="privacy"       options={{ title: 'מדיניות פרטיות' }} />
      <Stack.Screen name="admin"         options={{ title: 'פאנל ניהול', headerStyle: { backgroundColor: '#0a2a1e' } }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  // הסרת מסך הטעינה של ה-web (boot splash שהוזרק ב-scripts/inject-splash.js) ברגע שהאפליקציה עולה.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.getElementById('boot-splash');
    if (!el) return;
    el.classList.add('hide');
    const t = setTimeout(() => el.remove(), 450);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <AuthProvider>
          <LocalProfileProvider>
            <AuthGate />
          </LocalProfileProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
