import { Platform } from 'react-native';

/**
 * תפיסת אירוע ההתקנה של ה-PWA (Chrome/Edge בלבד, web).
 *
 * הדפדפן יורה `beforeinstallprompt` פעם אחת בסשן כשקריטריוני ההתקנה
 * מתקיימים (manifest תקין, service worker, לא מותקן כבר). חובה לתפוס
 * אותו בזמן אמת ולקרוא ל-preventDefault - אחרת אי אפשר להציג אותו ביוזמתנו
 * מאוחר יותר (למשל אחרי התחברות עם Google, לא ברגע הטעינה הראשוני).
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredEvent: BeforeInstallPromptEvent | null = null;
let installed = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredEvent = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredEvent = null;
  });
}

/** true אם האפליקציה כבר רצה כ-PWA מותקן (standalone) - אין טעם להציע התקנה. */
export function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function canInstall(): boolean {
  return Platform.OS === 'web' && !!deferredEvent && !installed && !isStandalone();
}

/** מציג את דיאלוג ההתקנה הנייטיבי של הדפדפן. חד-פעמי - האירוע נצרך ולא יחזור. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredEvent) return 'unavailable';
  const event = deferredEvent;
  deferredEvent = null;
  await event.prompt();
  return (await event.userChoice).outcome;
}
