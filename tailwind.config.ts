import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette claire — Sphère
        bg: '#ffffff',
        surface: '#f7f8fa',
        border: '#e3e6eb',
        accent: '#3ea663',
        accentDark: '#275250',
        fg: '#0f172a',
        success: '#3ea663',
        danger: '#dc2626',
      },
      fontFamily: {
        sans: ['var(--font-open-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
