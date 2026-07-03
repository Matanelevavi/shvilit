// Edge Function: מחיקת משתמש לצמיתות (auth.users + profiles דרך CASCADE).
// רץ בשרת עם service_role - הדרך היחידה למחוק משתמש auth בלי לחשוף מפתח סודי בלקוח.
// רק האדמין (לפי מייל ה-JWT של הקורא) מורשה.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_EMAIL = 'matanelevavi@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // אימות הקורא לפי ה-JWT שלו
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
    if (callerError || caller?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: 'אין הרשאת אדמין' }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }

    const { userId } = await req.json();
    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'חסר userId' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: 'לא ניתן למחוק את חשבון האדמין עצמו' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
