const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '..', 'assets');
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

// ─── Motif (relative coords, centered at 0,0; fits in ±512) ────────────────
function motif(scale = 1, glowAlpha = 0.18) {
  const s = scale;
  return `
  <defs>
    <radialGradient id="bg${s}" cx="50%" cy="38%" r="68%">
      <stop offset="0%" stop-color="#195c3e"/>
      <stop offset="100%" stop-color="#061710"/>
    </radialGradient>
    <linearGradient id="trail${s}" x1="5%" y1="95%" x2="95%" y2="5%">
      <stop offset="0%" stop-color="#b87a22"/>
      <stop offset="45%" stop-color="#e8a33d"/>
      <stop offset="100%" stop-color="#f5cc70"/>
    </linearGradient>
    <linearGradient id="pin${s}" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dce8e0"/>
    </linearGradient>
    <radialGradient id="inner${s}" cx="38%" cy="32%" r="62%">
      <stop offset="0%" stop-color="#278059"/>
      <stop offset="100%" stop-color="#081c11"/>
    </radialGradient>
    <filter id="glow${s}">
      <feGaussianBlur stdDeviation="${10 * s}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Subtle topo rings -->
  <circle cx="0" cy="0" r="${390 * s}" fill="none" stroke="rgba(255,255,255,0.028)" stroke-width="${55 * s}"/>
  <circle cx="0" cy="0" r="${280 * s}" fill="none" stroke="rgba(255,255,255,0.022)" stroke-width="${38 * s}"/>

  <!-- Trail shadow -->
  <path d="M ${-295 * s} ${420 * s}
           C ${-210 * s} ${230 * s}, ${-40 * s} ${200 * s}, ${20 * s} ${60 * s}
           C ${80 * s} ${-80 * s}, ${-60 * s} ${-120 * s}, ${-10 * s} ${-175 * s}"
        fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="${56 * s}"
        stroke-linecap="round" transform="translate(${8 * s},${12 * s})"/>

  <!-- Main trail -->
  <path d="M ${-295 * s} ${420 * s}
           C ${-210 * s} ${230 * s}, ${-40 * s} ${200 * s}, ${20 * s} ${60 * s}
           C ${80 * s} ${-80 * s}, ${-60 * s} ${-120 * s}, ${-10 * s} ${-175 * s}"
        fill="none" stroke="url(#trail${s})" stroke-width="${50 * s}"
        stroke-linecap="round" filter="url(#glow${s})"/>

  <!-- Trail shimmer -->
  <path d="M ${-295 * s} ${420 * s}
           C ${-210 * s} ${230 * s}, ${-40 * s} ${200 * s}, ${20 * s} ${60 * s}
           C ${80 * s} ${-80 * s}, ${-60 * s} ${-120 * s}, ${-10 * s} ${-175 * s}"
        fill="none" stroke="rgba(255,255,255,${glowAlpha})" stroke-width="${16 * s}"
        stroke-linecap="round" stroke-dasharray="${2 * s} ${70 * s}"/>

  <!-- Pin shadow -->
  <g transform="translate(${(18 + 10) * s},${(-210 + 10) * s})">
    <path d="M0,${-148 * s} C ${86 * s},${-148 * s} ${138 * s},${-90 * s} ${138 * s},${-28 * s}
             C ${138 * s},${74 * s} 0,${200 * s} 0,${200 * s}
             C 0,${200 * s} ${-138 * s},${74 * s} ${-138 * s},${-28 * s}
             C ${-138 * s},${-90 * s} ${-86 * s},${-148 * s} 0,${-148 * s} Z"
          fill="rgba(0,0,0,0.3)"/>
  </g>

  <!-- Pin body -->
  <g transform="translate(${18 * s},${-210 * s})">
    <path d="M0,${-148 * s} C ${86 * s},${-148 * s} ${138 * s},${-90 * s} ${138 * s},${-28 * s}
             C ${138 * s},${74 * s} 0,${200 * s} 0,${200 * s}
             C 0,${200 * s} ${-138 * s},${74 * s} ${-138 * s},${-28 * s}
             C ${-138 * s},${-90 * s} ${-86 * s},${-148 * s} 0,${-148 * s} Z"
          fill="url(#pin${s})"/>
    <!-- Highlight streak on pin -->
    <path d="M ${-50 * s},${-128 * s} C ${-14 * s},${-144 * s} ${38 * s},${-130 * s} ${66 * s},${-92 * s}"
          fill="none" stroke="rgba(255,255,255,0.48)" stroke-width="${12 * s}" stroke-linecap="round"/>
    <!-- Inner circle -->
    <circle cx="0" cy="${-28 * s}" r="${52 * s}" fill="url(#inner${s})"/>
    <!-- Inner highlight -->
    <circle cx="${-14 * s}" cy="${-44 * s}" r="${14 * s}" fill="rgba(255,255,255,0.26)"/>
    <!-- Gold center dot -->
    <circle cx="0" cy="${-28 * s}" r="${16 * s}" fill="#e8a33d"/>
    <!-- Gold dot glow -->
    <circle cx="0" cy="${-28 * s}" r="${24 * s}" fill="rgba(232,163,61,0.22)"/>
  </g>

  <!-- Sparkle A (large, top-right of pin) -->
  <g transform="translate(${185 * s},${-300 * s})">
    <path d="M0,${-26 * s} L${5.5 * s},${-5.5 * s} L${26 * s},0 L${5.5 * s},${5.5 * s}
             L0,${26 * s} L${-5.5 * s},${5.5 * s} L${-26 * s},0 L${-5.5 * s},${-5.5 * s} Z"
          fill="#f5cc70" opacity="0.92"/>
  </g>
  <!-- Sparkle B (small) -->
  <g transform="translate(${140 * s},${-170 * s})">
    <path d="M0,${-14 * s} L${3 * s},${-3 * s} L${14 * s},0 L${3 * s},${3 * s}
             L0,${14 * s} L${-3 * s},${3 * s} L${-14 * s},0 L${-3 * s},${-3 * s} Z"
          fill="#f5cc70" opacity="0.58"/>
  </g>
  <!-- Sparkle C (white, left) -->
  <g transform="translate(${-240 * s},${-260 * s})">
    <path d="M0,${-15 * s} L${3 * s},${-3 * s} L${15 * s},0 L${3 * s},${3 * s}
             L0,${15 * s} L${-3 * s},${3 * s} L${-15 * s},0 L${-3 * s},${-3 * s} Z"
          fill="rgba(255,255,255,0.38)"/>
  </g>`;
}

// ─── Full icon SVG (1024x1024) ──────────────────────────────────────────────
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="url(#bg1)"/>
  <g transform="translate(512,512)">${motif(1)}</g>
</svg>`;

// ─── Adaptive icon foreground (transparent bg, scaled for Android safe zone) ─
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(512,512) scale(0.6) translate(0,0)">${motif(1)}</g>
</svg>`;

// ─── Splash (icon centered, green bg) ──────────────────────────────────────
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(512,512) scale(0.72)">${motif(1)}</g>
</svg>`;

// ─── Maskable icon (PWA/Android): full-bleed bg + אמנות בתוך ה-safe zone.
// בלי זה, Android/Chrome היה בונה maskable משלו מתוך icon.png (full-bleed
// עד הקצוות) - גוזר/מקטין אוטומטית ובעצם זה מה שגרם למראה המטושטש בהתקנה.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#0f3d2e"/>
  <g transform="translate(512,512) scale(0.6) translate(0,0)">${motif(1)}</g>
</svg>`;

// ─── Favicon (simplified, no filter effects for tiny size) ─────────────────
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="#0f3d2e"/>
  <path d="M 9 42 C 13 34, 20 32, 23 25 C 26 18, 20 16, 23 13"
        fill="none" stroke="#e8a33d" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M23,8 C23,8 30,8 30,13 C30,18 23,22 23,22 C23,22 16,18 16,13 C16,8 23,8 23,8 Z"
        fill="#f0ede4"/>
  <circle cx="23" cy="13" r="4" fill="#0f3d2e"/>
  <circle cx="23" cy="13" r="1.5" fill="#e8a33d"/>
</svg>`;

const GREEN = '#0f3d2e';
const out = (name) => path.join(assetsDir, name);

async function main() {
  console.log('Generating assets...');

  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(out('icon.png'));
  console.log('✓ icon.png');

  await sharp(Buffer.from(foregroundSvg))
    .resize(1024, 1024)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(out('adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  await sharp(Buffer.from(splashSvg))
    .resize(1024, 1024)
    .flatten({ background: GREEN })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(out('splash.png'));
  console.log('✓ splash.png');

  await sharp(Buffer.from(faviconSvg))
    .resize(48, 48)
    .png({ quality: 100 })
    .toFile(out('favicon.png'));
  console.log('✓ favicon.png');

  // ─── PWA icons (public/icons) - נגזרים מאותו מקור וקטורי, אף פעם לא
  // מתפספסים/מתיישנים ידנית. ה-maskable מונע מ-Android/Chrome לגזור בעצמו
  // מתוך icon.png ה-full-bleed - זו הייתה סיבת המראה המטושטש בהתקנה.
  const iconOut = (name) => path.join(iconsDir, name);

  await sharp(Buffer.from(iconSvg)).resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 }).toFile(iconOut('icon-192.png'));
  console.log('✓ icons/icon-192.png');

  await sharp(Buffer.from(iconSvg)).resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 }).toFile(iconOut('icon-512.png'));
  console.log('✓ icons/icon-512.png');

  await sharp(Buffer.from(maskableSvg)).resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 }).toFile(iconOut('icon-512-maskable.png'));
  console.log('✓ icons/icon-512-maskable.png');

  await sharp(Buffer.from(iconSvg)).resize(180, 180)
    .flatten({ background: GREEN })
    .png({ quality: 100, compressionLevel: 9 }).toFile(iconOut('apple-touch-icon.png'));
  console.log('✓ icons/apple-touch-icon.png');

  console.log('\nAll assets generated in', assetsDir, 'and', iconsDir);
}

main().catch((e) => { console.error(e); process.exit(1); });
