// Learn more https://docs.expo.dev/router/reference/static-rendering/#root-html
import { ScrollViewStyleReset } from 'expo-router/html';

const SITE_URL = 'https://shvilit.shvilit-tours.workers.dev';
const TITLE = 'שבילית - סיורי הדרכה חכמים';
const DESCRIPTION = 'סיורי הדרכה חכמים בכל מקום שתעצרו בו - טקסט, שמע ווידאו מבוססי AI על נקודות עניין בכל הארץ.';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * מסמך ה-HTML השורשי לרינדור סטטי בוובQ. חייב מטא-תגי og/twitter מוחלטים
 * (לא יחסיים) כדי שתצוגה מקדימה בוואטסאפ/פייסבוק/טוויטר תעבוד כשמשתפים קישור.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />

        {/* Open Graph - וואטסאפ, פייסבוק */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:locale" content="he_IL" />

        {/* Twitter/X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        <ScrollViewStyleReset />

        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}
