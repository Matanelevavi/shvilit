/**
 * Factory מרכזי לבחירת מימושי השירותים.
 * זו הנקודה היחידה שבה מחליטים mock מול אמיתי - שאר הקוד לא יודע ולא אכפת לו.
 */
import { resolveLlmProvider } from '@/config/env';
import type { PoiProvider } from './poi/PoiProvider';
import { WikipediaPoiProvider } from './poi/WikipediaPoiProvider';
import type { LLMProvider } from './llm/LLMProvider';
import { MockLLMProvider } from './llm/MockLLMProvider';
import { EdgeFunctionLLMProvider } from './llm/EdgeFunctionLLMProvider';
import type { TTSProvider } from './tts/TTSProvider';
import { ExpoSpeechTTS } from './tts/ExpoSpeechTTS';

let poiProvider: PoiProvider | null = null;
let mockLlmProvider: LLMProvider | null = null;
let edgeLlmProvider: LLMProvider | null = null;
let ttsProvider: TTSProvider | null = null;

export function getPoiProvider(): PoiProvider {
  if (!poiProvider) poiProvider = new WikipediaPoiProvider();
  return poiProvider;
}

/**
 * בוחר ספק LLM: Gemini (Edge Function) רק כשיש התחברות אמיתית (accessToken);
 * אחרת תמיד Mock מקומי - כך שאורח יכול ליצור סיור בלי התחברות.
 */
export function getLlmProvider(hasAuthToken = false): LLMProvider {
  if (resolveLlmProvider() === 'edge' && hasAuthToken) {
    if (!edgeLlmProvider) edgeLlmProvider = new EdgeFunctionLLMProvider();
    return edgeLlmProvider;
  }
  if (!mockLlmProvider) mockLlmProvider = new MockLLMProvider();
  return mockLlmProvider;
}

export function getTtsProvider(): TTSProvider {
  if (!ttsProvider) ttsProvider = new ExpoSpeechTTS();
  return ttsProvider;
}
