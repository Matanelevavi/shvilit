import type { Coordinate, Poi } from '@/domain/types';
import type { PoiProvider } from './PoiProvider';

/**
 * שליפת נקודות עניין מוויקיפדיה העברית.
 *
 * שני שלבים כדי להבטיח מיקום מדויק לכל מקום:
 *  1. list=geosearch -> מחזיר lat/lon מדויקים + pageid לכל תוצאה ברדיוס.
 *  2. prop=extracts|pageimages לפי pageids -> תקציר ותמונה.
 * (גישה זו פותרת בעיה שבה ל-generator=geosearch חלק מהדפים חוזרים בלי קואורדינטה.)
 *
 * חינמי, ללא מפתח. נדרש User-Agent תיאורי אחרת Wikimedia מחזירה 403.
 */
const WIKI_ENDPOINT = 'https://he.wikipedia.org/w/api.php';
const WIKI_PAGE_BASE = 'https://he.wikipedia.org/?curid=';
const WIKI_HEADERS = {
  'User-Agent': 'Shvilit/1.0 (educational hiking app; matanelevavi@gmail.com)',
  Accept: 'application/json',
};

interface GeoHit {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
}

interface WikiDetailPage {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: { source: string; width: number; height: number };
  coordinates?: { lat: number; lon: number }[];
  index?: number;
}

interface GeoResponse {
  query?: { geosearch?: GeoHit[] };
  error?: { info?: string };
}

interface DetailResponse {
  query?: { pages?: Record<string, WikiDetailPage> };
}

// סעיפי "זנב" בערכי ויקיפדיה שאינם רלוונטיים לסיור - חותכים מהם והלאה.
const STOP_SECTIONS = [
  'ראו גם',
  'קישורים חיצוניים',
  'לקריאה נוספת',
  'הערות שוליים',
  'מקורות',
  'ביבליוגרפיה',
  'גלריית תמונות',
];

function stripTrailingSections(text: string): string {
  let cut = text.length;
  for (const section of STOP_SECTIONS) {
    const idx = text.indexOf(`\n${section}`);
    if (idx !== -1 && idx < cut) cut = idx;
  }
  return text.slice(0, cut).trim();
}

// תיבה גיאוגרפית רחבה של ישראל - סינון תוצאות חיפוש שאינן מקומות בפועל
// (סדרות טלוויזיה, אלבומים, שבטי צופים וכו' שחולקים שם עם אתר אמיתי).
const ISRAEL_BOUNDS = { minLat: 29.3, maxLat: 33.5, minLon: 34.0, maxLon: 36.0 };

function isInIsrael(lat: number, lon: number): boolean {
  return (
    lat >= ISRAEL_BOUNDS.minLat && lat <= ISRAEL_BOUNDS.maxLat &&
    lon >= ISRAEL_BOUNDS.minLon && lon <= ISRAEL_BOUNDS.maxLon
  );
}

export class WikipediaPoiProvider implements PoiProvider {
  async search(center: Coordinate, radiusMeters = 10000, limit = 20): Promise<Poi[]> {
    // שלב 1: geosearch - קואורדינטה מדויקת לכל תוצאה.
    const geoParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      list: 'geosearch',
      gscoord: `${center.latitude}|${center.longitude}`,
      gsradius: String(radiusMeters),
      gslimit: String(limit),
    });
    const geoRes = await fetch(`${WIKI_ENDPOINT}?${geoParams.toString()}`, { headers: WIKI_HEADERS });
    if (!geoRes.ok) throw new Error(`Wikipedia API error: ${geoRes.status}`);
    const geoData = (await geoRes.json()) as GeoResponse;
    if (geoData.error) throw new Error(`Wikipedia API error: ${geoData.error.info ?? 'unknown'}`);
    const hits = geoData.query?.geosearch ?? [];
    if (hits.length === 0) return [];

    // שלב 2: תקציר + תמונה לפי pageids.
    const ids = hits.map((h) => h.pageid).join('|');
    const detailParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      pageids: ids,
      prop: 'extracts|pageimages',
      exintro: '1',
      explaintext: '1',
      exsentences: '4',
      piprop: 'thumbnail',
      pithumbsize: '800',
    });
    const detRes = await fetch(`${WIKI_ENDPOINT}?${detailParams.toString()}`, { headers: WIKI_HEADERS });
    const pages =
      detRes.ok ? ((await detRes.json()) as DetailResponse).query?.pages ?? {} : {};

    return hits.map((hit) => {
      const page = pages[String(hit.pageid)];
      return {
        id: String(hit.pageid),
        title: hit.title,
        summary: page?.extract?.trim() ?? '',
        thumbnailUrl: page?.thumbnail?.source,
        coordinate: { latitude: hit.lat, longitude: hit.lon },
        sourceUrl: `${WIKI_PAGE_BASE}${hit.pageid}`,
      };
    });
  }

  async fetchArticleText(id: string): Promise<string> {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      pageids: id,
      prop: 'extracts',
      explaintext: '1',
      exsectionformat: 'plain',
    });
    const res = await fetch(`${WIKI_ENDPOINT}?${params.toString()}`, { headers: WIKI_HEADERS });
    if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);
    const data = (await res.json()) as DetailResponse;
    const page = data.query?.pages?.[id];
    return stripTrailingSections(page?.extract?.trim() ?? '');
  }

  async fetchExtendedSummary(id: string): Promise<string> {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      pageids: id,
      prop: 'extracts',
      explaintext: '1',
      exchars: '1700', // ~200-300 מילה בעברית
    });
    const res = await fetch(`${WIKI_ENDPOINT}?${params.toString()}`, { headers: WIKI_HEADERS });
    if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);
    const data = (await res.json()) as DetailResponse;
    const page = data.query?.pages?.[id];
    return stripTrailingSections(page?.extract?.trim() ?? '');
  }

  async searchByName(query: string, limit = 8): Promise<Poi[]> {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: query,
      gsrlimit: String(limit),
      prop: 'extracts|pageimages|coordinates',
      exintro: '1',
      explaintext: '1',
      exsentences: '4',
      piprop: 'thumbnail',
      pithumbsize: '800',
    });
    const res = await fetch(`${WIKI_ENDPOINT}?${params.toString()}`, { headers: WIKI_HEADERS });
    if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);
    const data = (await res.json()) as DetailResponse;
    const pages = data.query?.pages;
    if (!pages) return [];

    const results = Object.values(pages)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((page) => {
        const coord = page.coordinates?.[0];
        return {
          id: String(page.pageid),
          title: page.title,
          summary: page.extract?.trim() ?? '',
          thumbnailUrl: page.thumbnail?.source,
          coordinate: coord
            ? { latitude: coord.lat, longitude: coord.lon }
            : { latitude: 0, longitude: 0 },
          sourceUrl: `${WIKI_PAGE_BASE}${page.pageid}`,
        };
      });

    // סינון לתוצאות עם קואורדינטה בתוך ישראל - מפיל תוצאות "שם דומה" כמו
    // מיני-סדרות, אלבומים או שבטי צופים שאינם מקומות. fallback עדין: אם
    // הסינון הפיל הכל (למשל תקלת רשת בקבלת קואורדינטות), עדיף להציג את
    // התוצאות המקוריות מאשר מסך ריק.
    const geoFiltered = results.filter((r) => isInIsrael(r.coordinate.latitude, r.coordinate.longitude));
    return geoFiltered.length > 0 ? geoFiltered : results;
  }
}
