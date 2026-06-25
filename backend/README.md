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
Gemini (תסריט) → edge-tts (קול עברי) → Wikipedia (תמונות) → FFmpeg (וידאו עם Ken Burns + crossfade).
תוצאות נשמרות ב-cache (אפס עבודה כפולה).

> שלב מקומי: cache ב-SQLite ואחסון וידאו מקומי. סכמת Supabase מצורפת ב-`supabase_schema.sql`
> להחלפה עתידית כשיהיה service_role key.

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
5. **Video** (FFmpeg: Ken Burns zoompan + xfade crossfade + מיזוג אודיו) - `app/video.py`
6. **Store + deliver** (מקומי תחת `/videos`, עדכון cache, ניקוי temp) - `app/pipeline.py`

## חיבור לאפליקציית שבילית
האפליקציה (Expo/Web) תקרא ל-`POST /generate-tour` ותעשה polling ל-`GET /tour/{id}`,
ואז תנגן את הווידאו. בפיתוח מקומי: הטלפון והמחשב על אותו WiFi, ו-`PUBLIC_BASE_URL` מצביע ל-LAN IP.
