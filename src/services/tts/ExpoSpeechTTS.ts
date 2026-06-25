import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import type { TTSProvider, TtsCallbacks } from './TTSProvider';

/**
 * סינתוז קול עברי באמצעות מנוע ה-TTS המובנה במכשיר (expo-speech).
 * חינמי, עובד גם ללא רשת. איכות הקול תלויה במנוע ה-TTS של המכשיר.
 *
 * הערה: pause/resume נתמכים ב-iOS; ב-Android לרוב לא, ולכן supportsPause
 * משקף את הפלטפורמה והבקרות ב-UI מתאימות את עצמן.
 */
const HEBREW_LANGUAGE = 'he-IL';
// ל-expo-speech יש מגבלת אורך (~4000 תווים). מחלקים טקסט ארוך למקטעים בטוחים.
const MAX_CHUNK = 3500;

/** מחלק טקסט למקטעים <= MAX_CHUNK, עם שבירה בגבול משפט/רווח. */
function chunkText(text: string): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > MAX_CHUNK) {
    const slice = rest.slice(0, MAX_CHUNK);
    const breakAt = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('\n'),
      slice.lastIndexOf(' '),
    );
    const cut = breakAt > 0 ? breakAt + 1 : MAX_CHUNK;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

export class ExpoSpeechTTS implements TTSProvider {
  readonly supportsPause = Platform.OS === 'ios';

  async speak(text: string, callbacks?: TtsCallbacks, rate = 1.0): Promise<void> {
    await this.stop();
    callbacks?.onStart?.();
    const chunks = chunkText(text);
    // expo-speech מתור את הקריאות, אז מקטע אחרי מקטע מושמע ברצף.
    chunks.forEach((chunk, i) => {
      const isLast = i === chunks.length - 1;
      Speech.speak(chunk, {
        language: HEBREW_LANGUAGE,
        rate,
        pitch: 1.0,
        onDone: isLast ? () => callbacks?.onDone?.() : undefined,
        onStopped: isLast ? () => callbacks?.onStopped?.() : undefined,
        onError: (error) => callbacks?.onError?.(error),
      });
    });
  }

  async stop(): Promise<void> {
    await Speech.stop();
  }

  async pause(): Promise<void> {
    if (this.supportsPause) {
      await Speech.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.supportsPause) {
      await Speech.resume();
    }
  }

  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  }
}
