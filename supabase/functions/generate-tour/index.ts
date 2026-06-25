// Supabase Edge Function: generate-tour
// מקבלת פרטי נקודת עניין, מאמתת שהמשתמש מחובר, וקוראת ל-Gemini ליצירת תסריט.
// מפתח Gemini נשמר כסוד בצד השרת (Deno.env) ולעולם לא נחשף לאפליקציה.
//
// פריסה:  supabase functions deploy generate-tour
// סוד:    supabase secrets set GEMINI_API_KEY=...

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const STYLE_INSTRUCTIONS: Record<string, string> = {
  historical:
    'סגנון היסטורי-עובדתי: רצף כרונולוגי ברור, דגש על תאריכים, דמויות ואירועים מרכזיים, טון מכובד ומלמד.',
  mystery:
    'סגנון מתח ומסתורין: פתיחה מסקרנת, מתח נרטיבי, וגילוי הדרגתי - אך ללא המצאת עובדות.',
  kids: 'סגנון לילדים: שפה פשוטה וחמה, משפטים קצרים, הסברים מוחשיים ודימויים מהעולם של ילדים.',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildPrompt(title: string, sourceText: string, minutes: number, targetWords: number, style: string): string {
  const styleLine = STYLE_INSTRUCTIONS[style] ?? STYLE_INSTRUCTIONS.historical;
  return [
    `אתה מדריך טיולים מומחה הכותב תסריט הקראה בעברית עבור האתר "${title}".`,
    '',
    'חוקים מחייבים:',
    `1. אורך: כ-${targetWords} מילים (סיור של ${minutes} דקות בקצב 150 מילים לדקה).`,
    '2. הסתמך אך ורק על טקסט המקור שלהלן. אל תמציא תאריכים, שמות או עובדות.',
    `3. ${styleLine}`,
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // אימות המשתמש מתוך ה-JWT שנשלח ב-Authorization.
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { title, sourceText, minutes, targetWords, style } = body ?? {};
    if (!title || !sourceText) {
      return new Response(JSON.stringify({ error: 'missing title/sourceText' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const prompt = buildPrompt(title, sourceText, minutes ?? 5, targetWords ?? 750, style ?? 'historical');

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return new Response(JSON.stringify({ error: 'gemini error', detail }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();
    const script: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!script) {
      return new Response(JSON.stringify({ error: 'empty script' }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ script }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
