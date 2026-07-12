/**
 * Service worker מינימלי ל-PWA: מאפשר התקנה/עבודה offline בסיסית.
 *
 * אסטרטגיה:
 * - HTML (ניווט): network-first. ה-HTML מצביע על קבצי JS עם hash בשם
 *   (למשל entry-<hash>.js) - אם משתמש נתקע עם HTML ישן מהקאש אחרי deploy,
 *   הוא ינסה לטעון bundle שכבר לא קיים בשרת. network-first פותר את זה:
 *   תמיד מנסים רשת קודם, והקאש הוא רק גיבוי למצב אופליין.
 * - נכסים סטטיים (JS/פונטים/תמונות עם hash בשם): cache-first. הם immutable
 *   מרגע שנוצרו (שינוי בתוכן = hash חדש = URL חדש), אז אין סיכון "יישן".
 * - כל בקשה שאינה GET מאותו origin (Supabase, Gemini, Wikipedia, ה-backend
 *   ב-HF Space) - לא מטופלת כאן בכלל, עוברת ישירות לרשת כרגיל.
 */
const CACHE_NAME = 'shvilit-v1';
const APP_SHELL_URL = '/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(APP_SHELL_URL, copy));
          return res;
        })
        .catch(() => caches.match(APP_SHELL_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
