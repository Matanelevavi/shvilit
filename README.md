# שבילית 🥾

אפליקציית הדרכת טיולים מבוססת AI. מאתרים נקודת עניין על המפה, האפליקציה שולפת מידע
מוויקיפדיה, מודל שפה (Gemini) כותב תסריט סיור בעברית לפי האורך והסגנון שבחרתם,
והאפליקציה מקריאה אותו בקול.

בנוי ב-Expo React Native, בעברית (RTL), עם התחברות Google ואבטחה דרך Supabase.

---

## מה עובד כבר עכשיו (ללא הגדרות, ללא עלות)

- מפה אינטראקטיבית + מיקום (react-native-maps, expo-location)
- שליפת נקודות עניין אמיתיות מוויקיפדיה (חינמי, ללא מפתח)
- יצירת תסריט במצב **Mock** (ללא רשת, ללא חשבונות)
- הקראה קולית בעברית (expo-speech, מנוע המכשיר)

## מה דורש הגדרה חד-פעמית (חינמי)

- **התחברות Google** + מסד נתונים מאובטח -> Supabase
- **תסריטים איכותיים** מ-Gemini -> מפתח Gemini (סוד בצד שרת ב-Supabase)

---

## הרצה מהירה (מצב Mock)

```bash
npm install
npx expo start
```

סרקו את ה-QR ב-Expo Go (Android) או הריצו במכשיר. בלי קובץ `.env` האפליקציה רצה
במצב Mock: מפה, ויקיפדיה, תסריט מקומי והקראה - הכל עובד. (התחברות Google תחייב Supabase.)

> הערה: אם זרימת ההתחברות לא נסגרת ב-Expo Go, עברו ל-dev build:
> `npx expo run:android` (חינמי, build מקומי).

---

## הגדרת Supabase (התחברות + מסד נתונים)

1. צרו פרויקט חינמי ב-[supabase.com](https://supabase.com) (ללא כרטיס אשראי).
2. **Project Settings -> API**: העתיקו את `Project URL` ואת `anon public key`.
3. צרו קובץ `.env` (לפי `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```
4. הריצו את ה-migration ב-**SQL Editor** של Supabase (תוכן הקובץ
   `supabase/migrations/0001_init.sql`).

### התחברות Google ב-Supabase

1. ב-[Google Cloud Console](https://console.cloud.google.com): צרו OAuth Client
   (Web application). הוסיפו ב-Authorized redirect URIs את:
   `https://xxxx.supabase.co/auth/v1/callback`
2. ב-Supabase: **Authentication -> Providers -> Google** -> הדביקו Client ID ו-Secret.
3. ב-**Authentication -> URL Configuration -> Redirect URLs** הוסיפו את ה-scheme של
   האפליקציה: `shvilit://` ו-`shvilit://auth/callback`.

---

## הגדרת Gemini (תסריטים אמיתיים)

מפתח Gemini חינמי, נשמר כסוד בצד שרת ולעולם לא באפליקציה.

1. צרו מפתח חינמי ב-[Google AI Studio](https://aistudio.google.com/apikey) (ללא כרטיס אשראי).
2. התקינו את ה-Supabase CLI והתחברו (`supabase login`), קשרו את הפרויקט
   (`supabase link`), ואז:
   ```bash
   supabase secrets set GEMINI_API_KEY=your_key_here
   supabase functions deploy generate-tour
   ```
3. ברגע ש-Supabase מוגדר, האפליקציה עוברת אוטומטית מ-Mock ל-Gemini
   (ראו `src/config/env.ts`, `resolveLlmProvider`).

---

## פרסום (build לחנויות)

> שימו לב: פרסום בחנויות **עולה כסף ודורש חשבון על שמכם**:
> Google Play Console (25$ חד-פעמי), Apple Developer (99$ לשנה). אלו צעדים שרק
> אתם יכולים לבצע. הקוד וקונפיג ה-build כבר מוכנים.

```bash
npm install -g eas-cli
eas login
eas build:configure
# Android (APK לבדיקה):
eas build -p android --profile preview
# פרסום לחנות:
eas build -p android --profile production
eas submit -p android
```

---

## ארכיטקטורה

תבנית Adapter - כל שירות חיצוני מאחורי interface, נבחר ב-`src/services/factory.ts`:

| שכבה | interface | מימוש נוכחי | עתיד |
|------|-----------|-------------|------|
| נקודות עניין | `PoiProvider` | `WikipediaPoiProvider` | מקורות נוספים |
| מודל שפה | `LLMProvider` | `MockLLMProvider` / `EdgeFunctionLLMProvider` (Gemini) | - |
| קול | `TTSProvider` | `ExpoSpeechTTS` | ElevenLabs / Cartesia |
| מפה | רכיב | `react-native-maps` | Mapbox / MapLibre |
| auth + DB | - | Supabase (Google OAuth, Postgres, RLS) | - |

### אבטחה
- מפתח Gemini = סוד בצד שרת (Edge Function), לא באפליקציה.
- session נשמר מוצפן ב-`expo-secure-store`.
- Row Level Security: כל משתמש ניגש רק לנתונים שלו.
- OAuth בזרימת PKCE.

### מבנה
```
app/          מסכים (expo-router): login, מפה, נקודת עניין, סיור
src/
  auth/       Supabase client + AuthProvider
  services/   poi / llm / tts + factory
  domain/     types + חישוב אורך
  config/     env
  state/      מאגר זיכרון בין מסכים
  ui/         theme
supabase/     Edge Function + migration
```

---

## מחוץ לסקופ ה-MVP (שלבים עתידיים)

הפקת וידאו (Shotstack), אימות עובדות רב-סוכני (WKGFC), TTS פרימיום, חידונים/כרטיסיות,
פיד קהילתי ו-analytics. כולם מתחברים דרך ה-adapters הקיימים.
