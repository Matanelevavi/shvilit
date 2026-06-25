import { useEffect } from 'react';
import { I18nManager, LogBox } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { LocalProfileProvider, useLocalProfile } from '@/auth/LocalProfile';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { theme } from '@/ui/theme';

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
    const onLogin = segments[0] === 'login';
    if (!isAuthed && !onLogin) {
      router.replace('/login');
    } else if (isAuthed && onLogin) {
      router.replace('/');
    }
  }, [isAuthed, loading, segments]);

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
    </Stack>
  );
}

export default function RootLayout() {
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
