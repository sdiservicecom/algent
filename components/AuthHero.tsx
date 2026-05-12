import { BrandLogo } from './BrandLogo';

/**
 * Hero des pages d'auth : illustration ping-pong stylisée + marque "SDI Bet".
 * On reste en SVG pur pour éviter d'embarquer un asset photo dans le repo.
 */
export function AuthHero() {
  return (
    <div className="relative h-56 w-full overflow-hidden sm:h-64">
      <svg
        viewBox="0 0 800 320"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b4730" />
            <stop offset="100%" stopColor="#0a2418" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f5a3d" />
            <stop offset="100%" stopColor="#0a2418" />
          </linearGradient>
          <linearGradient id="table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d4d8e" />
            <stop offset="100%" stopColor="#072541" />
          </linearGradient>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04100c" stopOpacity="0" />
            <stop offset="100%" stopColor="#04100c" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Ciel / fond */}
        <rect width="800" height="180" fill="url(#sky)" />
        <rect y="180" width="800" height="140" fill="url(#ground)" />

        {/* Maison / silhouette en arrière-plan */}
        <rect x="40" y="80" width="180" height="120" fill="#1d3a2a" opacity="0.6" />
        <polygon points="40,80 130,40 220,80" fill="#1d3a2a" opacity="0.6" />
        <rect x="600" y="90" width="160" height="110" fill="#1d3a2a" opacity="0.5" />
        <polygon points="600,90 680,55 760,90" fill="#1d3a2a" opacity="0.5" />

        {/* Table de ping-pong */}
        <g transform="translate(180 170)">
          <polygon points="0,40 440,40 380,90 60,90" fill="url(#table)" />
          <polygon points="0,40 440,40 380,90 60,90" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
          <line x1="220" y1="40" x2="220" y2="90" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" />
          {/* Filet */}
          <rect x="195" y="22" width="50" height="22" fill="#ffffff" opacity="0.85" />
          <line x1="195" y1="22" x2="245" y2="22" stroke="#ffffff" strokeWidth="2" />
        </g>

        {/* Joueurs silhouettes */}
        <g fill="#0d1f18" opacity="0.95">
          <circle cx="120" cy="170" r="22" />
          <rect x="98" y="190" width="44" height="70" rx="14" />
          <rect x="80" y="200" width="20" height="40" rx="8" transform="rotate(-20 90 220)" />
          <circle cx="680" cy="170" r="22" />
          <rect x="658" y="190" width="44" height="70" rx="14" />
          <rect x="700" y="200" width="20" height="40" rx="8" transform="rotate(20 710 220)" />
        </g>
        {/* Raquettes */}
        <circle cx="75" cy="195" r="14" fill="#dc2626" stroke="#0d1f18" strokeWidth="3" />
        <circle cx="725" cy="195" r="14" fill="#dc2626" stroke="#0d1f18" strokeWidth="3" />
        {/* Balle */}
        <circle cx="400" cy="120" r="6" fill="#facc15" />

        {/* Fondu vers le bg de l'app */}
        <rect y="220" width="800" height="100" fill="url(#fade)" />
      </svg>

      <div className="relative z-10 flex h-full items-end justify-center pb-6">
        <BrandLogo href="" size="lg" />
      </div>
    </div>
  );
}
