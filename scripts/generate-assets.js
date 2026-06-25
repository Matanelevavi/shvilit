// מייצר את נכסי האפליקציה (icon / adaptive-icon / splash / favicon) מ-SVG.
// הרצה:  node scripts/generate-assets.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const GREEN = '#0f3d2e';
const GOLD = '#e8a33d';
const LIGHT = '#f6f7f4';
const MID = '#1c6b4f';

// מוטיב מרכזי: שביל מתפתל + סיכת מיקום.
const motif = `
  <path d="M300 880 C 380 700, 660 720, 560 520 S 360 360, 540 240"
        fill="none" stroke="${GOLD}" stroke-width="46"
        stroke-linecap="round" stroke-dasharray="4 74"/>
  <g transform="translate(540,210)">
    <path d="M0,-130 C 72,-130 116,-78 116,-22 C 116,58 0,150 0,150
             C 0,150 -116,58 -116,-22 C -116,-78 -72,-130 0,-130 Z" fill="${LIGHT}"/>
    <circle cx="0" cy="-22" r="44" fill="${MID}"/>
  </g>`;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${GREEN}"/>${motif}</svg>`;

// foreground שקוף, מוקטן ל-Android safe zone
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(512,512) scale(0.62) translate(-512,-512)">${motif}</g></svg>`;

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(512,512) scale(0.7) translate(-512,-512)">${motif}</g></svg>`;

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
const out = (name) => path.join(assetsDir, name);

async function main() {
  await sharp(Buffer.from(iconSvg)).resize(1024, 1024).png().toFile(out('icon.png'));
  await sharp(Buffer.from(foregroundSvg)).resize(1024, 1024).png().toFile(out('adaptive-icon.png'));
  await sharp(Buffer.from(splashSvg))
    .resize(1024, 1024)
    .flatten({ background: GREEN })
    .png()
    .toFile(out('splash.png'));
  await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toFile(out('favicon.png'));
  console.log('Assets generated in', assetsDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
