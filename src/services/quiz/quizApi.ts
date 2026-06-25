import { config } from '@/config/env';

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

// 90s timeout - backend עצמו עשוי לנסות כמה מודלים לפני שמסיים
const REQUEST_TIMEOUT_MS = 90_000;
// delay בין retries כשהשרת עמוס (502/503/429)
const BUSY_RETRY_DELAYS = [12_000, 20_000, 30_000];

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function requestQuiz(location: string): Promise<QuizQuestion[]> {
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location }),
  };

  let lastStatus = 0;
  for (let attempt = 0; attempt <= BUSY_RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetchWithTimeout(`${config.videoApiUrl}/generate-quiz`, options);
      if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503) {
        lastStatus = res.status;
        if (attempt < BUSY_RETRY_DELAYS.length) {
          await new Promise((r) => setTimeout(r, BUSY_RETRY_DELAYS[attempt]));
          continue;
        }
        throw new Error('מחולל החידונים עמוס כרגע או מתאתחל. נסה שוב בעוד דקה.');
      }
      if (!res.ok) throw new Error(`שרת החידונים החזיר ${res.status}`);
      const data = (await res.json()) as { questions: QuizQuestion[] };
      return data.questions ?? [];
    } catch (e) {
      // retry רק על בעיות רשת, לא על שגיאות HTTP שכבר טיפלנו בהן
      if (e instanceof Error && e.message.includes('שרת')) throw e;
      if (attempt < BUSY_RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      throw e instanceof Error ? e : new Error('שגיאת רשת');
    }
  }
  throw new Error(`מחולל החידונים עמוס (${lastStatus}). נסה שוב בעוד דקה.`);
}
