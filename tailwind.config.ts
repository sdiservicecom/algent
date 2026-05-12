import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fond noir-vert profond (haut du gradient) → vert sapin (bas)
        bg: '#04100c',
        bgTop: '#04100c',
        bgBottom: '#0a2a1c',
        surface: '#0d1f18',
        surfaceAlt: '#0a1a14',
        surfaceRaised: '#102b20',
        border: '#1c3a2c',
        borderSoft: '#15291f',
        // Vert lime/spring — couleur d'action principale (boutons, cotes actives)
        accent: '#22c55e',
        accentDark: '#15803d',
        accentBright: '#4ade80',
        // Jaune pièce — utilisé pour le solde / coin badge
        coin: '#facc15',
        coinDark: '#a16207',
        fg: '#e8efe9',
        success: '#22c55e',
        danger: '#ef4444',
        dangerSoft: '#7f1d1d',
      },
      fontFamily: {
        sans: ['var(--font-open-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 22px rgba(34, 197, 94, 0.35)',
        'glow-soft': '0 0 14px rgba(34, 197, 94, 0.2)',
        'glow-danger': '0 0 24px rgba(239, 68, 68, 0.45)',
        sheet: '0 -10px 30px -10px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'app-gradient':
          'radial-gradient(120% 80% at 50% 0%, #04100c 0%, #061a13 45%, #0a2a1c 100%)',
        'card-glow':
          'linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0) 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
