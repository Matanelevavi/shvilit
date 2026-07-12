# Shvilit

**AI-powered travel guide app that turns any point of interest into a narrated tour — as text, audio, or video — in Hebrew, generated on demand.**

Pick a location (search, browse, or "what's nearby"), choose a length (3/5/10 minutes) and a style (historical, mystery, or kids), and Shvilit builds a script grounded in real Wikipedia content, narrates it with TTS, and — for video — assembles it with sourced imagery into a finished MP4. Includes Google sign-in, a guest mode, saved tours, a points/leaderboard system, auto-generated quizzes, a place-highlights summary, an admin analytics dashboard, and PWA install support.

**Live:** [shvilit.shvilit-tours.workers.dev](https://shvilit.shvilit-tours.workers.dev)

---

## Why this project

Most "AI wrapper" demos stop at a single LLM call. Shvilit is a full content pipeline: real-world geodata → source-grounded script generation → multi-format output (text / audio / video) → gamification → moderation — shipped as a cross-platform (iOS / Android / Web) app with production auth, a real deployed backend, persistent caching, and product analytics, built and iterated as a solo project.

## What it does

- **Discover points of interest** — search by name or "what's nearby" (geolocation), backed by live Wikipedia geosearch (no API key required), filtered to results actually located in Israel.
- **Generate a tour on demand** — pick duration and tone; Gemini writes a script grounded in the source Wikipedia extract, not a generic hallucination.
- **Place highlights** — 4-5 emoji-tagged key facts per location, generated once and cached forever, shown before the full script for a quick overview.
- **Three output formats:**
  - **Text** — read the script directly, with source attribution and an expandable Wikipedia summary.
  - **Audio** — server-side TTS narration (Microsoft Edge TTS) with a browser-speech-synthesis fallback, playback speed control, and pause/resume.
  - **Video** — a fully assembled narrated video: relevant images are sourced automatically, synced to the narration, and rendered server-side with FFmpeg.
- **Quizzes** — auto-generated multiple-choice quizzes per location to test what you learned.
- **Accounts** — Google OAuth via Supabase, or a zero-friction guest mode with local profile persistence.
- **Gamification** — points, ranks, and a leaderboard for completed tours and quizzes.
- **Saved tours & pending-video tracking** — come back later and a video that was still rendering will be ready and waiting, no need to regenerate.
- **Admin analytics dashboard** — visitor/session stats, tours-per-user distribution, popular places, a search-to-tour conversion funnel, zero-result searches, retention, cache hit rate, and platform split.
- **Installable PWA** — a web app manifest and service worker (network-first for the HTML shell) let the site be installed like a native app.
- **Hebrew-first, RTL** throughout the entire UI, with a unified typeface (Noto Sans Hebrew).

---

## Architecture

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│   Expo / React      │      │   Supabase           │      │  Python backend      │
│   Native app         │◄────►│   Auth + Postgres     │      │  (FastAPI)           │
│   (iOS/Android/Web)  │      │   Row-Level Security  │      │  on Hugging Face     │
└──────────┬───────────┘      │   Analytics events    │      │  Spaces              │
           │                  │   Script/quiz cache    │      │                       │
           │  script / audio / video generation requests      │  • Gemini (script)    │
           └────────────────────────────────────────────────►│  • edge-tts (audio)   │
                                                               │  • FFmpeg (video)     │
                                                               │  • Wikipedia/Unsplash │
                                                               │    (imagery)          │
                                                               │  • SQLite (video      │
                                                               │    render dedup)      │
                                                               └──────────────────────┘
```

The frontend is built around an **adapter pattern** — every external service sits behind an interface, selected in `src/services/factory.ts`. Swapping a provider (e.g. a different TTS engine) means implementing one interface, not touching the UI:

| Layer | Interface | Current implementation |
|---|---|---|
| Points of interest | `PoiProvider` | `WikipediaPoiProvider` (free, keyless geosearch + extracts) |
| Script generation | `LLMProvider` | `BackendLLMProvider` (Gemini via FastAPI, server-side) / `MockLLMProvider` for offline dev |
| Audio narration | `TTSProvider` | `BackendAudioTTS` (edge-tts) with `ExpoSpeechTTS` (on-device) fallback |
| Video generation | — | FastAPI backend: script → images → TTS → FFmpeg render |
| Quizzes | — | Backend-generated from the tour's source text, cached per location |
| Map | component | `react-native-maps` |
| Auth + database | — | Supabase (Google OAuth, Postgres, Row-Level Security) |

### Caching

Two independent layers, each matched to what it stores:

- **Text content** (scripts, quizzes, place highlights) lives in **Supabase Postgres**, keyed by a normalized location plus a `prompt_version`. Content generated once is served to every future request instantly, with zero extra Gemini calls — and bumping `prompt_version` after a prompt improvement invalidates stale cached content automatically, without a manual purge.
- **Rendered video/audio files** live on the FastAPI backend's persistent disk (an Hugging Face Spaces storage bucket) with a local SQLite index for lookup, since large binary media doesn't belong in a database row.

### Security

- Third-party API keys (Gemini, image sources) live only on the backend — never shipped to the client.
- Sessions persisted via `expo-secure-store` (encrypted Keychain/Keystore).
- Row-Level Security on every table: a user can only read/write their own data.
- OAuth via the PKCE flow.
- Generated media (video/audio) persisted to durable object storage so content survives redeploys and is never silently regenerated.

### Deployment

- **Frontend:** static Expo web export, served from **Cloudflare Workers** (global edge, git-connected CI/CD — every push to `main` auto-deploys).
- **Backend:** FastAPI on **Hugging Face Spaces**, with a persistent storage bucket for generated audio/video.
- **Native:** iOS/Android builds via **EAS** (Expo Application Services).

### Project structure

```
app/                 Screens (expo-router): login, map, POI detail, tour, video,
                      quiz, profile, admin, saved tours, about
src/
  auth/              Supabase client + AuthProvider
  services/          poi / llm / tts / video / quiz / highlights + provider factory
  domain/            Shared types, tour-length calculation
  config/            Environment resolution
  state/             In-memory cache between screens, game state, analytics
  ui/                Theme, shared components
backend/
  app/               FastAPI app: script_gen, tts, images, video (FFmpeg),
                      quiz_gen, cache (video/SQLite), supacache (Supabase
                      text-content cache), config
supabase/
  migrations/        Postgres schema, RLS policies, analytics + content-cache tables
public/
  manifest.webmanifest, sw.js, icons/    PWA assets
```

---

## Tech stack

**Frontend:** Expo (React Native + Web) · TypeScript · Expo Router · Supabase JS
**Backend:** Python · FastAPI · edge-tts · FFmpeg · SQLite (video index)
**Infra:** Cloudflare Workers (web hosting + CI/CD) · Hugging Face Spaces (backend + media storage) · Supabase (auth + Postgres + analytics + content cache)
**AI:** Google Gemini (script/quiz/highlights generation, grounded in retrieved Wikipedia content)

---

## Running locally

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or run in a simulator. Without a `.env` file the app runs in **mock mode** — map, Wikipedia lookups, a local script generator, and on-device speech all work out of the box, no accounts or API keys required. Google sign-in and video/audio generation require the backend + Supabase setup below.

> If the OAuth redirect doesn't close properly in Expo Go, switch to a dev build: `npx expo run:android` (free, local build).

### Environment setup (Supabase — auth, database, caching, analytics)

1. Create a free project at [supabase.com](https://supabase.com) (no credit card required).
2. **Project Settings → API**: copy the `Project URL` and `anon public key`.
3. Create a `.env` file (see `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```
4. Run the migrations in the Supabase **SQL Editor**, in order (`supabase/migrations/0001_init.sql` through the latest).

**Google sign-in:** create an OAuth Client in Google Cloud Console, add `https://xxxx.supabase.co/auth/v1/callback` as an authorized redirect URI, then paste the Client ID/Secret into Supabase under **Authentication → Providers → Google**.

### Backend (Gemini scripts, audio/video generation, content cache)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set `EXPO_PUBLIC_VIDEO_API_URL` to point the app at your running backend, and `GEMINI_API_KEY` in `backend/.env` to enable real (non-mock) scripts. For the persistent Supabase-backed content cache, also set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env` — see `backend/README.md` for details.

---

## Native builds

> Publishing to app stores requires your own developer accounts (Google Play: $25 one-time, Apple: $99/year) — the code and build config are ready, this step is just account ownership.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview     # test APK
eas build -p android --profile production  # store build
eas submit -p android
```

---

## Roadmap / out of scope for now

Multi-agent fact-verification pipeline, premium TTS voices (ElevenLabs/Cartesia), a community feed, and a friction-free guest-first onboarding flow (browse before signing in) — all designed to slot in through the existing adapter interfaces without touching the UI layer.
