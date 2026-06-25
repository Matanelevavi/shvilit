import type { TourRequest, TourScript, TourStyle } from '@/domain/types';
import { countWords, minutesToTargetWords } from '@/domain/tourLength';
import type { LLMProvider } from './LLMProvider';

/**
 * מימוש מקומי ללא רשת. מפיק תסריט עברי מתוך טקסט ויקיפדיה (המלא, אם סופק),
 * עם מסגור לפי סגנון. אינו חוזר על עצמו: לוקח את הטקסט האמיתי עד אורך היעד.
 *
 * מטרתו: לאפשר לאפליקציה לרוץ מקצה לקצה לפני הגדרת Gemini/Supabase.
 * האיכות נמוכה מ-Gemini (אין ניסוח מחדש), אך הזרימה זהה והתוכן אמיתי.
 */

const STYLE_OPENERS: Record<TourStyle, string> = {
  historical: 'לפניכם סיפורו של מקום עם היסטוריה עשירה.',
  mystery: 'עצרו רגע, הביטו סביבכם, ותנו לסיפור הזה לחשוף את סודותיו.',
  kids: 'בואו נצא להרפתקה ונגלה יחד מקום מיוחד!',
};

const STYLE_CLOSERS: Record<TourStyle, string> = {
  historical: 'כך נשזרו כאן אירועים ודמויות לכדי הסיפור שלפניכם.',
  mystery: 'ואולי, אם תתבוננו היטב, תגלו כאן עוד סוד משלכם.',
  kids: 'איזה מקום מגניב, נכון? עכשיו אתם יודעים עליו משהו חדש!',
};

/** מחלק טקסט לפסקאות של כ-3 משפטים כל אחת, להצגה נוחה לקריאה. */
function toParagraphs(text: string, sentencesPerParagraph = 3): string {
  const sentences = text.match(/[^.!?]+[.!?]*/g);
  if (!sentences) return text.trim();
  const cleaned = sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  const paragraphs: string[] = [];
  for (let i = 0; i < cleaned.length; i += sentencesPerParagraph) {
    paragraphs.push(cleaned.slice(i, i + sentencesPerParagraph).join(' '));
  }
  return paragraphs.join('\n\n');
}

export class MockLLMProvider implements LLMProvider {
  async generateTourScript(request: TourRequest): Promise<TourScript> {
    const { poi, minutes, style } = request;
    const target = minutesToTargetWords(minutes);

    const source =
      poi.summary && poi.summary.trim().length > 0
        ? poi.summary.trim()
        : `${poi.title} הוא אתר בעל עניין באזור זה.`;

    // ללא חזרות: לוקחים עד יעד המילים מתוך הטקסט האמיתי, ומחלקים לפסקאות.
    const words = source.split(/\s+/);
    const limited = words.length > target ? words.slice(0, target).join(' ') : source;
    const body = toParagraphs(limited);

    const text = `${STYLE_OPENERS[style]}\n\n${body}\n\n${STYLE_CLOSERS[style]}`;

    return {
      poiId: poi.id,
      title: poi.title,
      style,
      minutes,
      text,
      wordCount: countWords(text),
      source: 'mock',
      attribution: 'מבוסס על ויקיפדיה',
    };
  }
}
