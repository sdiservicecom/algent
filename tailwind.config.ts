import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette sombre — sapin / vert profond, accents lumineux
        bg: '#0a1612',
        surface: '#0f1f1a',
        surfaceAlt: '#0d1a16',
        border: '#1f3a32',
        accent: '#3ea663',
        accentDark: '#275250',
        accentBright: '#4ade80',
        fg: '#e8efe9',
        success: '#4ade80',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-open-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 18px rgba(74, 222, 128, 0.25)',
        'glow-soft': '0 0 12px rgba(62, 166, 99, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
