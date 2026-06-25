import type { TourStyle } from '@/domain/types';

/**
 * בניית ה-prompt לסיור. משותף בין הלקוח (לתיעוד) לבין ה-Edge Function.
 * גישת "LLM Wiki": מזריקים את טקסט המקור המלא להקשר ומבקשים תסריט מותאם אורך.
 */

export const STYLE_INSTRUCTIONS: Record<TourStyle, string> = {
  historical:
    'סגנון היסטורי-עובדתי: רצף כרונולוגי ברור, דגש על תאריכים, דמויות ואירועים מרכזיים, טון מכובד ומלמד.',
  mystery:
    'סגנון מתח ומסתורין: פתיחה מסקרנת, מתח נרטיבי, שאלות פתוחות וגילוי הדרגתי - אך ללא המצאת עובדות.',
  kids: 'סגנון לילדים: שפה פשוטה וחמה, משפטים קצרים, הסברים מוחשיים ודימויים מהעולם של ילדים.',
};

export interface BuildPromptArgs {
  title: string;
  sourceText: string;
  minutes: number;
  targetWords: number;
  style: TourStyle;
}

export function buildTourPrompt(args: BuildPromptArgs): string {
  const { title, sourceText, minutes, targetWords, style } = args;
  return [
    `אתה מדריך טיולים מומחה הכותב תסריט הקראה בעברית עבור האתר "${title}".`,
    '',
    'חוקים מחייבים:',
    `1. אורך: כ-${targetWords} מילים (סיור של ${minutes} דקות בקצב 150 מילים לדקה).`,
    '2. הסתמך אך ורק על טקסט המקור שלהלן. אל תמציא תאריכים, שמות או עובדות.',
    '   אם פרט חסר במקור - אל תשלים אותו מהדמיון.',
    `3. ${STYLE_INSTRUCTIONS[style]}`,
    '4. חלק את התסריט לפסקאות קצרות (2-4 משפטים) מופרדות בשורה ריקה. ללא כותרות וללא נקודות תבליט.',
    '5. עברית תקנית וזורמת, מתאימה להקראה קולית.',
    '',
    '--- טקסט המקור (ויקיפדיה) ---',
    sourceText,
    '--- סוף טקסט המקור ---',
    '',
    'כתוב כעת את תסריט הסיור:',
  ].join('\n');
}
