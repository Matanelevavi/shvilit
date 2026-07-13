import { useEffect, useState } from 'react';
import { I18nManager, LogBox, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { LocalProfileProvider, useLocalProfile } from '@/auth/LocalProfile';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { InstallPromptModal } from '@/ui/InstallPromptModal';
import { theme } from '@/ui/theme';
import { trackEvent } from '@/state/analytics';
import { canInstall, promptInstall } from '@/state/pwaInstall';

// אכיפת כיווניות עברית (RTL) לכל האפליקציה.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// web: כיווניות RTL אמיתית + פונט אחיד (Noto Sans Hebrew).
// ב-production זה קורה גם ב-scripts/inject-splash.js, אבל בפיתוח מקומי
// (expo start --web) אין הזרקה - ההגדרה כאן משווה את שתי הסביבות.
// הערה על הפונט: Ionicons נשאר ברשימת ה-fallback בכוונה - תווי האייקונים
// (Private Use Area) לא קיימים ב-Noto ולכן נופלים אליו, וכך כלל גורף אחד
// לא שובר את האייקונים של @expo/vector-icons.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'he';
  const fontCss = document.createElement('style');
  fontCss.textContent = [
    ['400Regular', 400], ['600SemiBold', 600], ['700Bold', 700],
    ['800ExtraBold', 800], ['900Black', 900],
  ]
    .map(
      ([name, weight]) =>
        `@font-face{font-family:'Noto Sans Hebrew';src:url('/fonts/NotoSansHebrew_${name}.ttf') format('truetype');font-weight:${weight};font-display:swap;}`,
    )
    .join('\n')
    .concat(
      `\n#root, #root * { font-family: 'Noto Sans Hebrew', Ionicons, system-ui, -apple-system, 'Segoe UI', sans-serif; }`,
    );
  document.head.appendChild(fontCss);
}

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
  const [showInstall, setShowInstall] = useState(false);

  // מחובר אם יש session של Supabase או פרופיל מקומי (גיבוי שתמיד עובד).
  const isAuthed = !!user || !!profile;
  const loading = authLoading || profileLoading;

  // הצעת התקנת PWA: פעם אחת, מיד אחרי חזרה מהתחברות Google (web).
  // AuthProvider מסמן sessionStorage לפני ההפניה ל-Google; כאן, אחרי החזרה
  // המחוברת, בודקים אם אירוע ה-beforeinstallprompt כבר נתפס - הוא עלול
  // להגיע בכל רגע אחרי טעינת הדף, ולא בהכרח באופן מיידי.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (loading || !isAuthed) return;
    if (window.sessionStorage.getItem('shvilit_offer_install') !== '1') return;
    window.sessionStorage.removeItem('shvilit_offer_install');

    let cancelled = false;
    let attempts = 0;
    const tryShow = () => {
      if (cancelled) return;
      if (canInstall()) { setShowInstall(true); return; }
      attempts += 1;
      if (attempts < 6) setTimeout(tryShow, 500);
    };
    tryShow();
    return () => { cancelled = true; };
  }, [isAuthed, loading]);

  const onInstall = async () => {
    await promptInstall();
    setShowInstall(false);
  };

  useEffect(() => {
    if (loading) return;
    const onLogin    = segments[0] === 'login';
    const onCallback = segments[0] === 'auth'; // /auth/callback - לא לנתב ממנו
    const onPrivacy  = segments[0] === 'privacy'; // ציבורי - נדרש לאימות Google OAuth
    const onAbout    = segments[0] === 'about'; // ציבורי - דף תיאור האפליקציה ל-Google OAuth branding verification
    if (!isAuthed && !onLogin && !onCallback && !onPrivacy && !onAbout) {
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
    <>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
        // web: חץ "חזור" שמצביע ימינה, כמקובל בעברית (ברירת המחדל מצביעה
        // שמאלה כמו באנגלית). ב-native ה-header הנייטיבי מתהפך לבד עם RTL.
        ...(Platform.OS === 'web' && {
          headerLeft: ({ canGoBack }: { canGoBack?: boolean }) =>
            canGoBack ? (
              <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
                <Ionicons name="chevron-forward" size={26} color="#fff" />
              </TouchableOpacity>
            ) : null,
        }),
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'שבילית' }} />
      <Stack.Screen name="poi/[id]" options={{ title: 'נקודת עניין' }} />
      <Stack.Screen name="tour/[id]" options={{ title: 'ההדרכה שלך' }} />
      <Stack.Screen name="video/[id]" options={{ title: 'הדרכת וידאו' }} />
      <Stack.Screen name="saved" options={{ title: 'ההדרכות שלי' }} />
      <Stack.Screen name="quiz/[id]" options={{ title: 'חידון' }} />
      <Stack.Screen name="profile" options={{ title: 'האזור האישי שלי' }} />
      <Stack.Screen name="about"         options={{ title: 'אודות שבילית' }} />
      <Stack.Screen name="privacy"       options={{ title: 'מדיניות פרטיות' }} />
      <Stack.Screen name="admin"         options={{ title: 'פאנל ניהול', headerStyle: { backgroundColor: '#0a2a1e' } }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
    {showInstall && (
      <InstallPromptModal onInstall={onInstall} onDismiss={() => setShowInstall(false)} />
    )}
    </>
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
