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

### D4: Custom back button on web only
- **What we hit:** react-navigation's default web back arrow points left and
  ignores RTL. Native headers flip automatically under forceRTL.
- **What we chose:** `headerLeft` override in `app/_layout.tsx` gated to
  `Platform.OS === 'web'` - chevron-forward (points right), lands on the visual
  right because the RTL document mirrors the header row. Verified: navigates
  back from /profile.
