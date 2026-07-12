"""תזמור הצינור: תסריט -> קול -> תמונות -> וידאו -> אחסון. עם ניקוי וטיפול בשגיאות."""
import asyncio
import os
import shutil

from . import cache
from .config import PUBLIC_BASE_URL, STORAGE_DIR, TEMP_DIR
from .images import fetch_images
from .script_gen import generate_keywords, generate_script
from .tts import synthesize
from .video import assemble

# מגביל מספר הפקות וידאו במקביל - מונע חנק CPU/זיכרון תחת עומס.
# בקשות נוספות ממתינות בתור (הסטטוס נשאר 'processing' והלקוח עושה polling).
_RENDER_SEM = asyncio.Semaphore(2)


async def run_pipeline(
    tour_id: str, location: str, duration_minutes: int, style: str, source_text: str = ""
) -> None:
    work_dir = TEMP_DIR / tour_id
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        async with _RENDER_SEM:
            # שלב 2: תסריט (Gemini), מעוגן בטקסט המקור אם יש
            script = await generate_script(location, duration_minutes, style, source_text)

            audio_path = str(work_dir / "audio.mp3")
            srt_path = str(work_dir / "subs.srt")
            images_dir = str(work_dir / "images")

            # שלב 3+4: TTS ואיסוף תמונות+מילות מפתח במקביל - חוסך ~15-20 שניות.
            async def _tts():
                # synthesize מחזיר את משך האודיו מ-WordBoundary timestamps - מדויק יותר מ-ffprobe.
                return await synthesize(script, style, audio_path, srt_path)

            async def _images():
                # מילות מפתח מהתסריט (קריאה מהירה ~5s), ואחר כך תמונות בעלות ערך.
                keywords = await generate_keywords(script)
                return await fetch_images(location, images_dir, keywords=keywords)

            audio_dur, images = await asyncio.gather(_tts(), _images())

            srt = srt_path if os.path.exists(srt_path) else None

            # שלב 5: הרכבת וידאו (FFmpeg) עם כתוביות
            out_path = str(STORAGE_DIR / f"{tour_id}.mp4")
            await assemble(images, audio_path, out_path, audio_dur, srt)

        # שלב 6: אחסון (מקומי) + עדכון cache
        video_url = f"{PUBLIC_BASE_URL}/videos/{tour_id}.mp4"
        cache.mark_completed(tour_id, video_url)
    except Exception as exc:  # noqa: BLE001 - רוצים לתפוס כל כשל ולתעד אותו
        cache.mark_failed(tour_id, str(exc))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
