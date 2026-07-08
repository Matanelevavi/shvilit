/**
 * ספק סינתוז קול (Text-to-Speech).
 * מימוש ברירת המחדל הוא ExpoSpeechTTS (קול המכשיר, חינמי, offline).
 * בעתיד ניתן להחליף ל-ElevenLabs/Cartesia מאחורי אותו interface.
 */
export interface TtsCallbacks {
  /** נקרא ברגע שהבקשה יצאה לדרך, לפני שיש שמע בפועל (למשל תוך כדי הפקת השמע בשרת). */
  onLoading?: () => void;
  /** נקרא כשההשמעה בפועל התחילה (יש כבר שמע נשמע). */
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: unknown) => void;
}

export interface TTSProvider {
  /** האם הספק תומך ב-pause/resume (תלוי פלטפורמה). */
  readonly supportsPause: boolean;
  /** @param rate מהירות דיבור (1 = רגיל). */
  speak(text: string, callbacks?: TtsCallbacks, rate?: number): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isSpeaking(): Promise<boolean>;
}
