import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * התראות מערכת "ההדרכה מוכנה" - קופצות בטלפון/במחשב גם כשלא מסתכלים
 * באפליקציה. שני מימושים: Web Notification API (דפדפן/PWA) ו-expo-notifications
 * (נייטיב, מקומי בלבד - אין שרת push, לכן זה עובד רק כשהאפליקציה עדיין
 * רצה ברקע, לא אחרי שנסגרה לגמרי).
 */

let nativeConfigured = false;

function configureNativeHandler() {
  if (nativeConfigured || Platform.OS === 'web') return;
  nativeConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  configureNativeHandler();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/** לקרוא ברגע שמתחילים ליצור סרטון (בתוך user gesture) - מבקש הרשאה מראש כדי שלא תתבקש רק כשהתוצאה כבר מוכנה. */
export function requestNotificationPermission(): void {
  ensurePermission().catch(() => {});
}

/** מציג התראת מערכת. כשל בשקט - המשתמש עדיין יראה את הכרטיס בתוך האפליקציה. */
export async function notifyTourReady(location: string): Promise<void> {
  try {
    const granted = await ensurePermission();
    if (!granted) return;

    const title = 'שבילית 🥾';
    const body = `סרטון ההדרכה של "${location}" מוכן לצפייה!`;

    if (Platform.OS === 'web') {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    // לא קריטי
  }
}
