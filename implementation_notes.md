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
