"""
שלב 4: מקור תמונות - ספציפיות למקום.
סדר עדיפויות (מהמדויק לפחות מדויק):
1. תמונות הערך בוויקיפדיה.
2. קטגוריית Wikimedia Commons של המקום (דרך Wikidata P373) - תמונות שתויגו כשייכות למקום זה.
3. גיבוי: Commons geosearch לפי קואורדינטה (תמונות מהאזור).
כל המקורות מחזירים תמונות שקשורות למקום; אין חיפוש טקסט חופשי.
"""
import asyncio
import os
from typing import List, Optional, Tuple

import httpx

from .config import FFMPEG_BIN, HTTP_HEADERS, TARGET_IMAGES

WIKI_API = "https://he.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
_SKIP_HINTS = ("icon", "logo", "flag", "commons-logo", "oojs", "edit", "symbol", ".svg", "map_of", "locator", "blank", "wikimedia")
_GOOD_EXT = (".jpg", ".jpeg", ".png")


def _usable(title: str) -> bool:
    low = title.lower()
    return low.endswith(_GOOD_EXT) and not any(h in low for h in _SKIP_HINTS)


async def _wiki_page(client: httpx.AsyncClient, location: str):
    """מחזיר (קבצי תמונות בערך, קואורדינטה, Wikidata Q-id)."""
    search = await client.get(
        WIKI_API,
        params={"action": "query", "format": "json", "list": "search", "srsearch": location, "srlimit": 1},
    )
    hits = search.json().get("query", {}).get("search", [])
    if not hits:
        return [], None, None
    title = hits[0]["title"]

    resp = await client.get(
        WIKI_API,
        params={
            "action": "query", "format": "json", "titles": title,
            "prop": "images|coordinates|pageprops", "ppprop": "wikibase_item", "imlimit": 60,
        },
    )
    pages = resp.json().get("query", {}).get("pages", {})
    files: List[str] = []
    coord: Optional[Tuple[float, float]] = None
    qid: Optional[str] = None
    for page in pages.values():
        files += [im["title"] for im in page.get("images", []) if _usable(im["title"])]
        co = page.get("coordinates")
        if co:
            coord = (co[0]["lat"], co[0]["lon"])
        qid = page.get("pageprops", {}).get("wikibase_item")
    return files, coord, qid


async def _commons_category(client: httpx.AsyncClient, qid: Optional[str], location: str) -> Optional[str]:
    """שם קטגוריית Commons של המקום: דרך Wikidata P373, אחרת חיפוש קטגוריה ב-Commons."""
    if qid:
        r = await client.get(
            WIKIDATA_API,
            params={"action": "wbgetentities", "ids": qid, "props": "claims", "format": "json"},
        )
        claims = r.json().get("entities", {}).get(qid, {}).get("claims", {})
        p373 = claims.get("P373")
        if p373:
            try:
                return p373[0]["mainsnak"]["datavalue"]["value"]
            except (KeyError, IndexError):
                pass
    # fallback: חיפוש קטגוריה בשם המקום.
    r = await client.get(
        COMMONS_API,
        params={"action": "query", "format": "json", "list": "search", "srsearch": location, "srnamespace": 14, "srlimit": 1},
    )
    hits = r.json().get("query", {}).get("search", [])
    if hits:
        return hits[0]["title"].replace("Category:", "")
    return None


async def _category_file_titles(client: httpx.AsyncClient, category: str, want: int) -> List[str]:
    """כל קבצי התמונות בקטגוריה, כולל תת-קטגוריה אחת לעומק."""
    async def members(cat: str):
        r = await client.get(
            COMMONS_API,
            params={
                "action": "query", "format": "json", "list": "categorymembers",
                "cmtitle": f"Category:{cat}", "cmtype": "file|subcat", "cmlimit": 100,
            },
        )
        return r.json().get("query", {}).get("categorymembers", [])

    files: List[str] = []
    subcats: List[str] = []
    for m in await members(category):
        if m["ns"] == 6 and _usable(m["title"]):
            files.append(m["title"])
        elif m["ns"] == 14:
            subcats.append(m["title"].replace("Category:", ""))

    for sub in subcats[:6]:
        if len(files) >= want:
            break
        for m in await members(sub):
            if m["ns"] == 6 and _usable(m["title"]):
                files.append(m["title"])
    return files


async def _file_urls(client: httpx.AsyncClient, api: str, file_titles: List[str], want: int) -> List[str]:
    urls: List[str] = []
    for i in range(0, len(file_titles), 20):
        info = await client.get(
            api,
            params={
                "action": "query", "format": "json", "titles": "|".join(file_titles[i : i + 20]),
                "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 1280,
            },
        )
        for page in info.json().get("query", {}).get("pages", {}).values():
            ii = page.get("imageinfo")
            if ii:
                urls.append(ii[0].get("thumburl") or ii[0].get("url"))
        if len(urls) >= want:
            break
    return urls


async def _commons_geosearch(client: httpx.AsyncClient, lat: float, lon: float, want: int) -> List[str]:
    resp = await client.get(
        COMMONS_API,
        params={
            "action": "query", "format": "json", "generator": "geosearch",
            "ggscoord": f"{lat}|{lon}", "ggsradius": 5000, "ggsnamespace": 6, "ggslimit": want * 2,
            "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 1280,
        },
    )
    urls: List[str] = []
    for page in resp.json().get("query", {}).get("pages", {}).values():
        if _usable(page.get("title", "")):
            ii = page.get("imageinfo")
            if ii:
                urls.append(ii[0].get("thumburl") or ii[0].get("url"))
    return urls


async def _download(client: httpx.AsyncClient, url: str, dest: str, attempts: int = 3) -> bool:
    for a in range(attempts):
        try:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code == 200 and resp.content:
                with open(dest, "wb") as f:
                    f.write(resp.content)
                return True
            if resp.status_code in (429, 500, 503) and a < attempts - 1:
                await asyncio.sleep(1.0 * (a + 1))
                continue
            return False
        except httpx.HTTPError:
            if a < attempts - 1:
                await asyncio.sleep(0.5)
                continue
    return False


async def _keyword_image_urls(client: httpx.AsyncClient, keywords: List[str], want_per_kw: int = 2) -> List[str]:
    """חיפוש תמונות ספציפיות לפי מילות מפתח ב-Wikimedia Commons."""
    urls: List[str] = []
    for kw in keywords:
        if len(urls) >= want_per_kw * len(keywords):
            break
        try:
            r = await client.get(
                COMMONS_API,
                params={
                    "action": "query", "format": "json",
                    "list": "search", "srsearch": kw,
                    "srnamespace": 6, "srlimit": want_per_kw * 2,
                },
            )
            hits = r.json().get("query", {}).get("search", [])
            file_titles = [h["title"] for h in hits if _usable(h["title"])]
            if file_titles:
                kw_urls = await _file_urls(client, COMMONS_API, file_titles[:want_per_kw], want_per_kw)
                urls += kw_urls
        except Exception:  # noqa: BLE001
            continue
    return urls


# ─── סינון כפילויות לפי תוכן ─────────────────────────────────────────────────
# dedup לפי URL לא מספיק: קטגוריות Commons מכילות לעיתים סדרות צילומים
# כמעט זהים בשמות קבצים שונים (למשל צילומי פנים של אותו חדר מוזיאון).
# בסרטון זה נראה כאילו "תמונה אחת תקועה" כי ה-crossfade בין זהות בלתי נראה.

_DUP_THRESHOLD = 10.0  # הפרש אפור ממוצע לפיקסל; זהות/כמעט-זהות = 0-5, שוט שונה = 25+


_SIG_BYTES = 16 * 16 * 3  # 16x16 פיקסלים ב-RGB


async def _rgb_signature(path: str) -> Optional[bytes]:
    """חתימת תוכן ויזואלית: התמונה מוקטנת ל-16x16 RGB (768 בייטים).

    RGB ולא גווני אפור - צבעים שונים בעלי בהירות דומה לא מתנגשים.
    """
    proc = await asyncio.create_subprocess_exec(
        FFMPEG_BIN, "-v", "error", "-i", path, "-frames:v", "1",
        "-vf", "scale=16:16", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0 or len(out) < _SIG_BYTES:
        return None  # קובץ פגום - גם סיבה טובה לפסול אותו
    return bytes(out[:_SIG_BYTES])


def _avg_diff(a: bytes, b: bytes) -> float:
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


async def _dedup_by_content(paths: List[str]) -> List[str]:
    """משאיר רק תמונות שנבדלות ויזואלית מכל אלו שכבר נשמרו (וזורק פגומות)."""
    sigs = await asyncio.gather(*[_rgb_signature(p) for p in paths])
    kept: List[str] = []
    kept_sigs: List[bytes] = []
    for path, sig in zip(paths, sigs):
        if sig is None:
            continue
        if any(_avg_diff(sig, k) < _DUP_THRESHOLD for k in kept_sigs):
            continue
        kept.append(path)
        kept_sigs.append(sig)
    return kept


async def fetch_images(location: str, dest_dir: str, keywords: Optional[List[str]] = None, want: int = TARGET_IMAGES) -> List[str]:
    os.makedirs(dest_dir, exist_ok=True)
    async with httpx.AsyncClient(timeout=30, headers=HTTP_HEADERS) as client:
        files, coord, qid = await _wiki_page(client, location)

        urls: List[str] = []
        if files:
            urls += await _file_urls(client, WIKI_API, files, want)

        # תמונות ספציפיות לנושאי התסריט - מחפש לפי מילות מפתח במקביל לשאר.
        kw_task = asyncio.create_task(
            _keyword_image_urls(client, keywords or [], want_per_kw=2)
        )

        # קטגוריית Commons של המקום - תמונות ספציפיות למקום.
        if len(urls) < want:
            category = await _commons_category(client, qid, location)
            if category:
                cat_files = await _category_file_titles(client, category, want * 2)
                urls += await _file_urls(client, COMMONS_API, cat_files, want * 2)

        # גיבוי אחרון: תמונות מהאזור לפי קואורדינטה.
        if len(urls) < want and coord:
            urls += await _commons_geosearch(client, coord[0], coord[1], want - len(urls))

        # ממזג תמונות מילות מפתח: סירוגין בין תמונות מקום לתמונות ספציפיות.
        kw_urls = await kw_task
        if kw_urls:
            merged: List[str] = []
            for i in range(max(len(urls), len(kw_urls))):
                if i < len(urls):
                    merged.append(urls[i])
                if i < len(kw_urls):
                    merged.append(kw_urls[i])
            urls = merged

        seen = set()
        unique = [u for u in urls if u and not (u in seen or seen.add(u))]

        # מורידים כפול מהיעד - חלק ייפסלו בסינון הכפילויות התוכני שאחרי ההורדה.
        chosen = unique[: want * 2]
        dests = [os.path.join(dest_dir, f"img_{i:02d}.jpg") for i in range(len(chosen))]
        sem = asyncio.Semaphore(5)  # מגביל מקביליות כדי לא לעורר rate-limit.

        async def _bounded(url: str, dest: str) -> bool:
            async with sem:
                return await _download(client, url, dest)

        results = await asyncio.gather(
            *[_bounded(u, d) for u, d in zip(chosen, dests)], return_exceptions=True
        )
        downloaded = [
            d for ok, d in zip(results, dests)
            if ok is True and os.path.exists(d) and os.path.getsize(d) > 1000
        ]
        distinct = await _dedup_by_content(downloaded)
        return distinct[:want]
