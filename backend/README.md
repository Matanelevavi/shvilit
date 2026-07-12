---
title: Shvilit Backend
emoji: 🥾
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# שבילית - backend הפקת וידאו

שירות FastAPI שמקבל מיקום, אורך וסגנון, ומפיק סיור וידאו מוקרא בעברית:
Gemini (תסריט) → edge-tts (קול עברי) → Wikipedia (תמונות) → FFmpeg (וידאו עם Ken Burns + fade).
תוצאות נשמרות ב-cache (אפס עבודה כפולה).

> קאש תוכן טקסטואלי (תסריטים, נקודות מרכזיות, חידונים) נשמר ב-**Supabase** -
> קבוע, שורד rebuild של ה-Space. מטא-דאטה של וידאו וקובצי מדיה נשארים על
> `PERSIST_DIR` (HF Storage Bucket). ראה "הגדרת הקאש הקבוע" למטה.

## דרישות מוקדמות
- Python 3.11+ (מותקן: 3.13)
- FFmpeg ב-PATH (הותקן דרך winget: `Gyan.FFmpeg`)
- מפתח Gemini חינמי: https://aistudio.google.com/apikey

## התקנה והרצה
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt

# הגדרה
copy .env.example .env   # ומלא GEMINI_API_KEY

# הרצה
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- בדיקת בריאות: http://localhost:8000/health
- לגישה מהטלפון (אותו WiFi): הגדר ב-.env את `PUBLIC_BASE_URL=http://<LAN_IP>:8000`.

## API
### `POST /generate-tour`
```json
{ "location": "רבבה", "duration_minutes": 5, "style": "historical" }
```
- אם קיים סיור מוכן זהה → מחזיר מיד `status: completed` + `video_url`.
- אחרת → יוצר רשומה `processing`, מתחיל רינדור ברקע, ומחזיר `{ id, status: "processing" }`.

### `GET /tour/{id}`
מחזיר את הסטטוס הנוכחי. עשה polling עד `status: "completed"` ואז נגן את `video_url`.
(הרינדור אורך כ-30-90 שניות, תלוי באורך ובמספר התמונות.)

## הצינור (6 שלבים)
1. **Cache check** - `app/main.py` + `app/cache.py`
2. **Script** (Gemini) - `app/script_gen.py`
3. **Voice** (edge-tts, קולות `he-IL-AvriNeural` / `he-IL-HilaNeural`) - `app/tts.py`
4. **Images** (Wikipedia, fallback Unsplash אם יש מפתח) - `app/images.py`
5. **Video** (FFmpeg: קליפ Ken Burns עצמאי לכל תמונה + concat + מיזוג אודיו) - `app/video.py`
6. **Store + deliver** (מקומי תחת `/videos`, עדכון cache, ניקוי temp) - `app/pipeline.py`

## הגדרת הקאש הקבוע (Supabase)

תסריט/חידון/נקודות שנוצרו פעם אחת מוגשים לכל המשתמשים מיידית - בלי המתנה
ל-Gemini ובלי טוקנים. ההפעלה (חד-פעמית):

1. להריץ את `supabase/migrations/0005_script_cache.sql` ב-SQL Editor של Supabase.
2. ב-HuggingFace Space: **Settings -> Variables and secrets** ולהוסיף:
   - `SUPABASE_URL` = כתובת הפרויקט (https://xxxx.supabase.co)
   - `SUPABASE_SERVICE_KEY` = ה-service_role key (**Project Settings -> API**). סוד!
3. בלי המשתנים האלה הקאש פשוט כבוי והשירות עובד כרגיל.

שיפור פרומפט? להעלות את `PROMPT_VERSION` ב-`app/config.py` - רשומות ישנות
מפסיקות להיות מוגשות ותוכן חדש ואיכותי נוצר במקומן.

## API נוספים
- `POST /generate-script` - `{location, minutes, style}` -> `{script, cache_hit}`
- `POST /place-highlights` - `{location}` -> `{highlights: [{emoji, text}], cache_hit}`
- `POST /generate-quiz` - `{location, count}` -> `{questions}`
- `POST /generate-audio` - `{text, style}` -> `{audio_url}`

## חיבור לאפליקציית שבילית
האפליקציה (Expo/Web) תקרא ל-`POST /generate-tour` ותעשה polling ל-`GET /tour/{id}`,
ואז תנגן את הווידאו. בפיתוח מקומי: הטלפון והמחשב על אותו WiFi, ו-`PUBLIC_BASE_URL` מצביע ל-LAN IP.
