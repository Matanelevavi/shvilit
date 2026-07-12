# Implementation Notes - Elhanan/Yehuda feedback round (2026-07-12)

Working log for the approved plan at `.claude/plans/floating-painting-eclipse.md`.

## Deviations

### D1: Video cache stays on PERSIST_DIR (plan 1.6 adjusted)
- **What we hit:** The plan assumed HF Spaces storage is ephemeral and proposed
  moving video files to Supabase Storage. Reading `backend/app/config.py`
  revealed a `PERSIST_DIR` mechanism backed by an HF Storage Bucket is already
  in place - video files, audio files, and the SQLite `cache.db` all live there
  and survive rebuilds (the comment documents this was fixed after videos were
  being lost).
- **What we chose:** Keep video files + tours metadata on PERSIST_DIR (they
  share the same disk, so they live and die together, and `/generate-tour`
  already self-heals when a file is missing). Move only the script cache (new)
  and quiz cache to Supabase, as approved.
- **Why:** Most conservative option - avoids a risky media migration that the
  evidence says is unnecessary. If the bucket ever disappears, the existing
  self-heal logic regenerates videos.

### D2: Production HTML already had dir="rtl" (plan 2.1 confirmed differently)
- **What we hit:** `scripts/inject-splash.js` already injects `dir="rtl"
  lang="he"` into the production HTML. So production was truly RTL all along -
  and that is exactly why the `row-reverse` hacks rendered LTR there (row
  direction follows the document direction, so reversing it flips to LTR).
  Local dev had no `dir`, which made the same hacks look correct to the
  developer. This dev/prod mismatch is how the bugs shipped unnoticed.
- **What we chose:** Set `dir`/`lang` at runtime in `_layout.tsx` (web only) so
  dev matches production, and removed the hacks. No inject-splash change needed
  for direction.

### D3: Font applied via one global CSS rule with Ionicons fallback
- **What we hit:** A blanket `font-family` override would normally break
  @expo/vector-icons glyphs (they are font glyphs). The app uses only Ionicons.
- **What we chose:** `#root, #root * { font-family: 'Noto Sans Hebrew',
  Ionicons, ... }` - text characters resolve to Noto, icon characters (Private
  Use Area, absent from Noto) fall through to Ionicons. Verified in browser:
  glyph renders at full width vs tofu width, `document.fonts.check` positive.
- **Why:** One rule instead of touching hundreds of Text styles; if another
  icon set is ever added, it must be appended to this fallback list.

### D5: Critical bug found during manual QA - scripts/quizzes/videos were ungrounded
- **What we hit:** User reported tours for "רבבה" (a small community settlement)
  came out "weird." Investigation: the frontend fetches the full Wikipedia
  article (`fetchArticleText`) before generating a tour, but
  `BackendLLMProvider` only ever sent `poi.title` to `/generate-script` - never
  the article text. `script_gen._build_prompt` had no source-grounding
  mechanism at all; it just told Gemini "rely on reliable factual knowledge."
  For well-known places (Masada) this is invisible because Gemini's training
  data covers them. For a small settlement, Gemini confidently fabricated a
  founding date, a Bible-verse citation for the name's etymology, a synagogue
  construction date with architectural details, an intifada narrative, and a
  neighborhood name - none of which are in the real (two-sentence) Wikipedia
  stub. Verified: fetched the real Wikipedia article for רבבה and diffed
  against the hallucinated output - zero overlap on the invented specifics.
  The same gap existed in the video pipeline (`/generate-tour`) and quiz
  generation (`/generate-quiz`) - both call Gemini with only a location name.
- **What we chose:** Added an optional `source_text` field end-to-end:
  `BackendLLMProvider`, `requestVideoTour`, `requestQuiz` (frontend) all now
  send the fetched Wikipedia article text; `video/[id].tsx` and `quiz/[id].tsx`
  now call `fetchArticleText` before requesting (previously only `poi/[id].tsx`
  did, and only for the audio-script path). Backend prompts
  (`script_gen._build_prompt`, `generate_highlights`, `quiz_gen.generate_quiz`)
  now hard-require grounding in the source text when present ("do not invent
  dates/quotes/structures not in the text below") and fall back to a stricter
  "only state facts you are highly certain of" instruction when absent (guest
  places with no Wikipedia page, or fetch failures). Bumped `PROMPT_VERSION`
  2 -> 3 to invalidate any already-cached ungrounded content once deployed.
- **Why:** This is a correctness/trust issue, not a style issue - the app was
  presenting fabricated history as fact, and quizzes were "teaching" invented
  answers. Re-verified with a live call: the grounded script for רבבה now
  matches the real article's founding date (16 Apr 1991), both Bible verse
  citations, the Baker-visit narrative, and synagogue details exactly; the
  grounded quiz's questions and answers are all traceable to the source text.

### D4: Custom back button on web only
- **What we hit:** react-navigation's default web back arrow points left and
  ignores RTL. Native headers flip automatically under forceRTL.
- **What we chose:** `headerLeft` override in `app/_layout.tsx` gated to
  `Platform.OS === 'web'` - chevron-forward (points right), lands on the visual
  right because the RTL document mirrors the header row. Verified: navigates
  back from /profile.
