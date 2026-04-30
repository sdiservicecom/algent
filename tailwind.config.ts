import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d12',
        surface: '#141821',
        border: '#222836',
        accent: '#7c5cff',
        success: '#22c55e',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};

export default config;
