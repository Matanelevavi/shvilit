import { Platform } from 'react-native';

/**
 * מקור תמונה לוויקיפדיה.
 * שרת התמונות של ויקיפדיה (upload.wikimedia.org) מחזיר 403 ל-User-Agent של אנדרואיד,
 * וכותרות מותאמות ב-Image לא תמיד מכובדות ב-Expo Go. לכן בנייד מנתבים דרך proxy
 * תמונות (images.weserv.nl) שמושך בצד-שרת ומגיש בלי חסימה. בדפדפן הכתובת הישירה עובדת.
 */
export function wikiImage(uri: string): { uri: string } {
  if (Platform.OS === 'web') return { uri };
  const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(uri)}&w=800&output=jpg`;
  return { uri: proxied };
}
