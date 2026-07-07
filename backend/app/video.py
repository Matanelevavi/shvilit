"""שלב 5: הרכבת וידאו עם FFmpeg - Ken Burns, מעברי fade, כתוביות, ומיזוג אודיו.

ארכיטקטורה: כל תמונה מרונדרת לקליפ קצר עצמאי (zoompan + fade בקצוות),
הקליפים מאוחים ב-concat demuxer (ללא קידוד מחדש), ומעבר אחרון ממזג
אודיו וכתוביות.

למה לא שרשרת xfade אחת גדולה? נמצא אמפירית ששרשור עשרות xfade על
קלטי -loop נשבר בגרסאות ffmpeg ישנות (כמו זו שבשרת): המעברים מפסיקים
לפעול אחרי ~6 מקטעים והתמונה "נתקעת". קליפים עצמאיים + concat הם
המסלול האמין בכל גרסה, וגם צורכים הרבה פחות זיכרון.
"""
import asyncio
import math
import os
from typing import List, Optional

from .config import FFMPEG_BIN, FPS, VIDEO_HEIGHT, VIDEO_WIDTH

W, H = VIDEO_WIDTH, VIDEO_HEIGHT
# סגנון הכתוביות (libass). Alignment=2 = תחתון-מרכז.
_SUB_STYLE = (
    "FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF&,"
    "OutlineColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=0,MarginV=40"
)

# כמה שניות מקסימום תמונה אחת מוצגת לפני שעוברים לבאה.
# כשהאודיו ארוך מכמות התמונות, התמונות חוזרות בלופ (1,2,3,1,2,3...).
_MAX_SEC_PER_IMAGE = 10.0
# תקרה למספר המקטעים - שומר על זמן רינדור סביר בסרטונים ארוכים.
_MAX_SEGMENTS = 60
# רינדור מקטעים במקביל (לשרת יש 2 vCPU).
_SEGMENT_CONCURRENCY = 2


def _loop_images(image_paths: List[str], audio_duration: float) -> List[str]:
    n = len(image_paths)
    if n < 2:
        return image_paths
    if audio_duration / n <= _MAX_SEC_PER_IMAGE:
        return image_paths
    needed = min(_MAX_SEGMENTS, math.ceil(audio_duration / _MAX_SEC_PER_IMAGE))
    if needed <= n:
        return image_paths
    return [image_paths[i % n] for i in range(needed)]


async def _run(args: List[str], cwd: Optional[str] = None) -> None:
    proc = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {stderr.decode(errors='ignore')[-700:]}")


async def _render_segment(image: str, seconds: float, out_path: str) -> None:
    """קליפ Ken Burns עצמאי מתמונה אחת, באורך מדויק, עם fade עדין בקצוות."""
    frames = max(1, round(seconds * FPS))
    up_w, up_h = int(W * 1.5), int(H * 1.5)
    fade_len = max(0.2, min(0.5, seconds / 5))
    fade_out_start = max(0.0, seconds - fade_len)
    vf = (
        f"scale={up_w}:{up_h}:force_original_aspect_ratio=increase,"
        f"crop={up_w}:{up_h},"
        f"zoompan=z='min(zoom+0.0012,1.4)':d={frames}:"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
        f"setsar=1,format=yuv420p,"
        f"fade=t=in:st=0:d={fade_len:.2f},"
        f"fade=t=out:st={fade_out_start:.2f}:d={fade_len:.2f}"
    )
    # קלט של פריים בודד (בלי -loop): zoompan מרחיב אותו בדיוק ל-frames פריימים.
    args = [
        FFMPEG_BIN, "-y", "-i", image,
        "-vf", vf, "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-an", out_path,
    ]
    await _run(args)


async def _solid_color_video(audio_path: str, out_path: str, duration: float, srt: Optional[str]) -> None:
    args = [FFMPEG_BIN, "-y", "-f", "lavfi", "-i", f"color=c=0x0f3d2e:s={W}x{H}:d={duration:.2f}:r={FPS}", "-i", audio_path]
    cwd = None
    if srt:
        args += ["-vf", f"subtitles={os.path.basename(srt)}:force_style='{_SUB_STYLE}'"]
        cwd = os.path.dirname(srt)
    args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", out_path]
    await _run(args, cwd=cwd)


async def assemble(
    image_paths: List[str], audio_path: str, out_path: str, audio_duration: float, srt_path: Optional[str] = None
) -> None:
    image_paths = _loop_images(image_paths, audio_duration)
    n = len(image_paths)
    if n == 0:
        await _solid_color_video(audio_path, out_path, audio_duration, srt_path)
        return

    per_image = audio_duration / n
    # תיקיית העבודה: ליד ה-srt (תיקיית ה-temp של הצינור) או ליד הפלט.
    work_dir = os.path.dirname(srt_path) if srt_path else os.path.dirname(out_path)

    # שלב א: רינדור כל מקטע בנפרד.
    sem = asyncio.Semaphore(_SEGMENT_CONCURRENCY)

    async def _one(idx: int, img: str) -> str:
        seg = os.path.join(work_dir, f"seg_{idx:03d}.mp4")
        async with sem:
            await _render_segment(img, per_image, seg)
        return seg

    segments = await asyncio.gather(*[_one(i, img) for i, img in enumerate(image_paths)])

    # שלב ב: איחוי ללא קידוד מחדש (concat demuxer - אמין בכל גרסת ffmpeg).
    list_path = os.path.join(work_dir, "segments.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"file '{os.path.basename(seg)}'\n")
    joined = os.path.join(work_dir, "joined.mp4")
    await _run(
        [FFMPEG_BIN, "-y", "-f", "concat", "-safe", "0", "-i", "segments.txt", "-c", "copy", "joined.mp4"],
        cwd=work_dir,
    )

    # שלב ג: מיזוג אודיו + צריבת כתוביות.
    srt_name = os.path.basename(srt_path) if srt_path else None
    args = [FFMPEG_BIN, "-y", "-i", "joined.mp4", "-i", os.path.abspath(audio_path)]
    if srt_name:
        args += ["-vf", f"subtitles={srt_name}:force_style='{_SUB_STYLE}'"]
        args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p"]
    else:
        args += ["-c:v", "copy"]
    args += ["-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", os.path.abspath(out_path)]
    await _run(args, cwd=work_dir)
