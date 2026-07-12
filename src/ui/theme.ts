/** Design system של "שבילית" - צבעים, מרווחים, צללים וטיפוגרפיה. */
export const theme = {
  colors: {
    primary: '#0f3d2e',
    primaryLight: '#1c6b4f',
    accent: '#e8a33d',
    accentDark: '#3a2a06',
    background: '#f6f7f4',
    surface: '#ffffff',
    surfaceAlt: '#e3efe8',
    text: '#1a1a1a',
    textMuted: '#5d6b63',
    border: '#dfe4df',
    danger: '#b3261e',
    onPrimary: '#ffffff',
  },
  spacing: (n: number) => n * 8,
  radius: 14,
  radiusLg: 18,
  radiusXl: 24,
  gradientLogin: ['#0f3d2e', '#1c6b4f'] as const,
  gradientHero: ['#1c6b4f', '#0f3d2e'] as const,
  gradientOverlay: ['transparent', 'rgba(15,61,46,0.85)'] as const,
  shadow: {
    shadowColor: '#0f3d2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  shadowSoft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  font: { h1: 30, h2: 24, h3: 18, body: 16, small: 13, tiny: 11 },
  // הפונט האחיד של האפליקציה (Noto Sans Hebrew). ב-web מוחל גלובלית
  // ב-app/_layout.tsx; המשקלים עצמם נטענים מ-public/fonts.
  fonts: { family: 'Noto Sans Hebrew' },
} as const;
