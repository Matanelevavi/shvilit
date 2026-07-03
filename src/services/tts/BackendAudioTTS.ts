import { config } from '@/config/env';
import type { TTSProvider, TtsCallbacks } from './TTSProvider';
import { ExpoSpeechTTS } from './ExpoSpeechTTS';

/**
 * TTS מבוסס שרת ל-web: הטקסט נשלח ל-backend (/generate-audio, edge-tts)
 * וחוזר כקובץ mp3 שמתנגן ב-HTMLAudioElement.
 *
 * למה לא speechSynthesis של הדפדפן? בהרבה טלפונים (בעיקר Android) אין
 * קול עברי מותקן וההקראה פשוט שותקת. mp3 מתנגן בכל דפדפן.
 *
 * שני טריקים חשובים לניידים:
 * 1. "שחרור" ה-Audio בתוך מחוות המשתמש (לפני ה-await) - אחרת iOS/Android
 *    חוסמים play() שמגיע אחרי fetch.
 * 2. token ביטול (session) - אם המשתמש עצר בזמן שההורדה רצה, לא מתנגנים.
 */

// WAV שקט וקצרצר לשחרור ה-autoplay בתוך מחוות ההקשה.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';

export class BackendAudioTTS implements TTSProvider {
  readonly supportsPause = true;

  private audio: HTMLAudioElement | null = null;
  private fallback = new ExpoSpeechTTS();
  private usingFallback = false;
  private session = 0;

  async speak(text: string, callbacks?: TtsCallbacks, rate = 1.0): Promise<void> {
    await this.stop();
    const session = ++this.session;
    this.usingFallback = false;

    // נוצר ומנוגן סינכרונית בתוך מחוות ההקשה - משחרר autoplay בניידים.
    const audio = new Audio(SILENT_WAV);
    audio.play().catch(() => {});
    this.audio = audio;
    callbacks?.onStart?.();

    try {
      const res = await fetch(`${config.videoApiUrl}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, style: 'historical' }),
        signal: AbortSignal.timeout?.(180_000),
      });
      if (!res.ok) throw new Error(`audio api ${res.status}`);
      const { audio_url } = await res.json();
      if (session !== this.session) return; // המשתמש עצר בינתיים

      audio.src = audio_url;
      audio.playbackRate = rate;
      audio.onended = () => {
        if (session === this.session) callbacks?.onDone?.();
      };
      audio.onerror = () => {
        if (session === this.session) callbacks?.onError?.(new Error('audio playback failed'));
      };
      await audio.play();
    } catch {
      if (session !== this.session) return;
      // גיבוי: קול הדפדפן (עדיף משתיקה מוחלטת אם השרת ישן/לא זמין)
      this.usingFallback = true;
      this.audio = null;
      await this.fallback.speak(text, callbacks, rate);
    }
  }

  async stop(): Promise<void> {
    this.session++;
    if (this.usingFallback) {
      this.usingFallback = false;
      await this.fallback.stop();
      return;
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio = null;
    }
  }

  async pause(): Promise<void> {
    if (this.usingFallback) return this.fallback.pause();
    this.audio?.pause();
  }

  async resume(): Promise<void> {
    if (this.usingFallback) return this.fallback.resume();
    await this.audio?.play();
  }

  async isSpeaking(): Promise<boolean> {
    if (this.usingFallback) return this.fallback.isSpeaking();
    return !!this.audio && !this.audio.paused;
  }
}
