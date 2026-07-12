/**
 * מזריק מסך טעינה ממותג (boot splash) ל-dist/index.html אחרי expo export.
 *
 * למה סקריפט? עם web.output="single" (SPA), expo לא משתמש ב-app/+html.tsx -
 * הוא נתמך רק ב-output="static". בלי זה, המשתמש רואה מסך לבן ריק בזמן
 * שה-bundle (כ-2MB) נטען. הסקריפט רץ כחלק מפקודת ה-build (ראה netlify.toml).
 *
 * המסך מוסר ע"י app/_layout.tsx ברגע שהאפליקציה עולה.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('inject-splash: dist/index.html לא נמצא. הרץ קודם: npx expo export --platform web');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

if (html.includes('boot-splash')) {
  console.log('inject-splash: כבר הוזרק, מדלג.');
  process.exit(0);
}

// עברית + RTL על תגית השורש
html = html.replace('<html lang="en">', '<html lang="he" dir="rtl">');

const SITE_URL = 'https://shvilit.shvilit-tours.workers.dev';
const TITLE = 'שבילית - סיורי הדרכה חכמים';
const DESCRIPTION = 'סיורי הדרכה חכמים בעברית, בכל מקום שתעצרו בו. מבוסס AI.';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const headExtra = `
    <title>${TITLE}</title>
    <meta name="description" content="${DESCRIPTION}" />
    <meta name="theme-color" content="#0f3d2e" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:locale" content="he_IL" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <!-- PWA: מאפשר התקנה כאפליקציה. אין הזרקה מקבילה בפיתוח מקומי (expo
         start --web) - הסקריפט הזה רץ רק על dist/index.html אחרי export,
         כך שרישום ה-service worker לעולם לא מתערב ב-HMR של הפיתוח. -->
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <style>
      html, body { background: #0f3d2e; }
      #boot-splash {
        position: fixed; inset: 0; z-index: 9999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 18px;
        background: radial-gradient(circle at 50% 42%, #1a5c44 0%, #0f3d2e 65%);
        transition: opacity .4s ease;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      #boot-splash.hide { opacity: 0; pointer-events: none; }
      #boot-splash .pin {
        width: 96px; height: 96px;
        animation: boot-bounce 1.6s ease-in-out infinite;
        filter: drop-shadow(0 12px 24px rgba(0,0,0,.35));
      }
      #boot-splash .name { color: #fff; font-size: 34px; font-weight: 800; letter-spacing: -0.5px; }
      #boot-splash .tag  { color: #c8ddd5; font-size: 15px; }
      #boot-splash .dots { display: flex; gap: 7px; margin-top: 6px; }
      #boot-splash .dots span {
        width: 8px; height: 8px; border-radius: 50%; background: #e8a33d;
        animation: boot-dot 1.2s ease-in-out infinite;
      }
      #boot-splash .dots span:nth-child(2) { animation-delay: .2s; }
      #boot-splash .dots span:nth-child(3) { animation-delay: .4s; }
      @keyframes boot-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes boot-dot    { 0%, 100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }
    </style>
  </head>`;

const bodySplash = `<body>
    <div id="boot-splash">
      <svg class="pin" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 8C33 8 20 21 20 38c0 22 30 54 30 54s30-32 30-54C80 21 67 8 50 8z" fill="#ffffff"/>
        <circle cx="50" cy="38" r="13" fill="#0f3d2e"/>
        <circle cx="50" cy="38" r="5" fill="#e8a33d"/>
      </svg>
      <div class="name">שבילית</div>
      <div class="tag">הדרכת טיולים חכמה, בכל מקום</div>
      <div class="dots"><span></span><span></span><span></span></div>
    </div>`;

// רישום ה-service worker: network-first על ה-HTML עצמו מבטיח שאחרי כל
// deploy המשתמש מקבל את המעטפת העדכנית (ולא נתקע על גרסה ישנה שמצביעה
// על bundle עם hash שכבר לא קיים) - ראה public/sw.js.
const swRegister = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
      }
    </script>
  </body>`;

html = html.replace('</head>', headExtra);
html = html.replace('<body>', bodySplash);
html = html.replace('</body>', swRegister);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('inject-splash: מסך הטעינה הוזרק ל-dist/index.html בהצלחה.');
