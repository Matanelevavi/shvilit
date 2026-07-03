/**
 * Factory מרכזי לבחירת מימושי השירותים.
 * זו הנקודה היחידה שבה מחליטים mock מול אמיתי - שאר הקוד לא יודע ולא אכפת לו.
 */
import { Platform } from 'react-native';
import type { PoiProvider } from './poi/PoiProvider';
import { WikipediaPoiProvider } from './poi/WikipediaPoiProvider';
import type { LLMProvider } from './llm/LLMProvider';
import { BackendLLMProvider } from './llm/BackendLLMProvider';
import type { TTSProvider } from './tts/TTSProvider';
import { ExpoSpeechTTS } from './tts/ExpoSpeechTTS';
import { BackendAudioTTS } from './tts/BackendAudioTTS';

let poiProvider: PoiProvider | null = null;
let llmProvider: LLMProvider | null = null;
let ttsProvider: TTSProvider | null = null;

export function getPoiProvider(): PoiProvider {
  if (!poiProvider) poiProvider = new WikipediaPoiProvider();
  return poiProvider;
}

/**
 * ספק תסריטים: Gemini דרך ה-backend (עובד גם לאורחים - המפתח בשרת),
 * עם נפילה אוטומטית ל-Mock מקומי אם השרת לא זמין.
 */
export function getLlmProvider(_hasAuthToken = false): LLMProvider {
  if (!llmProvider) llmProvider = new BackendLLMProvider();
  return llmProvider;
}

export function getTtsProvider(): TTSProvider {
  // web: mp3 מהשרת (edge-tts) - עובד בכל דפדפן, גם בטלפונים בלי קול עברי מותקן.
  // native: קול המכשיר (עובד offline, ללא המתנה לשרת).
  if (!ttsProvider) {
    ttsProvider = Platform.OS === 'web' ? new BackendAudioTTS() : new ExpoSpeechTTS();
  }
  return ttsProvider;
}
