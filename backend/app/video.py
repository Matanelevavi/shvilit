"""שלב 5: הרכבת וידאו עם FFmpeg - Ken Burns, crossfade, כתוביות, ומיזוג אודיו."""
import asyncio
import math
import os
from typing import List, Optional, Tuple

from .config import CROSSFADE_SEC, FFMPEG_BIN, FPS, VIDEO_HEIGHT, VIDEO_WIDTH

W, H = VIDEO_WIDTH, VIDEO_HEIGHT
# סגנון הכתוביות (libass). Alignment=2 = תחתון-מרכז.
_SUB_STYLE = (
    "FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF&,"
    "OutlineColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=0,MarginV=40"
)


def _kenburns_filter(idx: int, frames: int) -> str:
    # scale-up מתון (1.5x) לאיזון בין איכות תנועה למהירות רינדור.
    up_w, up_h = int(W * 1.5), int(H * 1.5)
    return (
        f"[{idx}:v]scale={up_w}:{up_h}:force_original_aspect_ratio=increase,"
        f"crop={up_w}:{up_h},"
        f"zoompan=z='min(zoom+0.0012,1.4)':d={frames}:"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
        f"setsar=1,format=yuv420p[v{idx}]"
    )


def _build_filter_complex(n: int, per_image: float, crossfade: float, srt_name: Optional[str]) -> Tuple[str, str]:
    frames = max(1, round(per_image * FPS))
    parts = [_kenburns_filter(i, frames) for i in range(n)]

    if n == 1:
        last = "[v0]"
    else:
        prev = "[v0]"
        for i in range(1, n):
            offset = i * (per_image - crossfade)
            out = f"[vx{i}]"
            parts.append(
                f"{prev}[v{i}]xfade=transition=fade:duration={crossfade:.3f}:offset={offset:.3f}{out}"
            )
            prev = out
        last = prev

    if srt_name:
        parts.append(f"{last}subtitles={srt_name}:force_style='{_SUB_STYLE}'[vout]")
        last = "[vout]"

    return ";".join(parts), last


async def _run(args: List[str], cwd: Optional[str] = None) -> None:
    proc = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {stderr.decode(errors='ignore')[-700:]}")


async def _solid_color_video(audio_path: str, out_path: str, duration: float, srt: Optional[str]) -> None:
    args = [FFMPEG_BIN, "-y", "-f", "lavfi", "-i", f"color=c=0x0f3d2e:s={W}x{H}:d={duration:.2f}:r={FPS}", "-i", audio_path]
    cwd = None
    if srt:
        args += ["-vf", f"subtitles={os.path.basename(srt)}:force_style='{_SUB_STYLE}'"]
        cwd = os.path.dirname(srt)
    args += ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", out_path]
    await _run(args, cwd=cwd)


# כמה שניות מקסימום תמונה אחת מוצגת לפני שעוברים לבאה.
# כשהאודיו ארוך מכמות התמונות, התמונות חוזרות בלופ (1,2,3,1,2,3...)
# במקום שכל תמונה "תיתקע" על המסך דקות ארוכות.
_MAX_SEC_PER_IMAGE = 10.0
# תקרה למספר מקטעי הווידאו - שומר על גרף ffmpeg סביר בסרטונים ארוכים.
_MAX_SEGMENTS = 60


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


async def assemble(
    image_paths: List[str], audio_path: str, out_path: str, audio_duration: float, srt_path: Optional[str] = None
) -> None:
    image_paths = _loop_images(image_paths, audio_duration)
    n = len(image_paths)
    if n == 0:
        await _solid_color_video(audio_path, out_path, audio_duration, srt_path)
        return

    crossfade = CROSSFADE_SEC
    if n == 1:
        per_image = audio_duration
    else:
        per_image = (audio_duration + (n - 1) * crossfade) / n
        if per_image <= crossfade + 0.5:
            crossfade = max(0.3, per_image * 0.4)
            per_image = (audio_duration + (n - 1) * crossfade) / n

    # כתוביות: מריצים מתוך תיקיית ה-srt ומפנים בשם יחסי (נמנע מבריחת נתיבים ב-Windows).
    srt_name = os.path.basename(srt_path) if srt_path else None
    cwd = os.path.dirname(srt_path) if srt_path else None

    filter_complex, last_label = _build_filter_complex(n, per_image, crossfade, srt_name)

    args = [FFMPEG_BIN, "-y"]
    for path in image_paths:
        args += ["-loop", "1", "-t", f"{per_image:.3f}", "-i", path]
    args += ["-i", audio_path]
    args += [
        "-filter_complex", filter_complex,
        "-map", last_label, "-map", f"{n}:a",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart", out_path,
    ]
    await _run(args, cwd=cwd)
