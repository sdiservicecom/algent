import { BrandLogo } from './BrandLogo';

/**
 * Hero des pages d'auth : illustration ping-pong stylisée + marque "SDI Bet"
 * centrée en haut, comme la maquette. SVG pur pour éviter d'embarquer un
 * asset photo dans le repo.
 */
export function AuthHero() {
  return (
    <div className="relative h-64 w-full overflow-hidden sm:h-72">
      <svg
        viewBox="0 0 800 360"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d6a4d" />
            <stop offset="100%" stopColor="#16321f" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a5a3a" />
            <stop offset="100%" stopColor="#0a2418" />
          </linearGradient>
          <linearGradient id="table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1463b3" />
            <stop offset="100%" stopColor="#0d3b6b" />
          </linearGradient>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04100c" stopOpacity="0" />
            <stop offset="100%" stopColor="#04100c" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="top-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04100c" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#04100c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ciel / fond */}
        <rect width="800" height="220" fill="url(#sky)" />
        <rect y="220" width="800" height="140" fill="url(#ground)" />

        {/* Bâtiment SDI en arrière-plan */}
        <g fill="#1d3a2a" opacity="0.85">
          <rect x="220" y="100" width="360" height="160" />
          <polygon points="220,100 400,55 580,100" />
        </g>
        <g fill="#0d1f18" opacity="0.7">
          {/* Fenêtres */}
          <rect x="260" y="135" width="40" height="40" />
          <rect x="320" y="135" width="40" height="40" />
          <rect x="440" y="135" width="40" height="40" />
          <rect x="500" y="135" width="40" height="40" />
          <rect x="260" y="195" width="40" height="40" />
          <rect x="320" y="195" width="40" height="40" />
        </g>

        {/* Table de ping-pong */}
        <g transform="translate(160 220)">
          <polygon points="0,40 480,40 410,100 70,100" fill="url(#table)" />
          <polygon
            points="0,40 480,40 410,100 70,100"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="3"
          />
          <line
            x1="240"
            y1="40"
            x2="240"
            y2="100"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="2"
          />
          {/* Filet */}
          <rect x="210" y="18" width="60" height="24" fill="#ffffff" opacity="0.92" />
          <line x1="210" y1="18" x2="270" y2="18" stroke="#ffffff" strokeWidth="2" />
          {/* Marque "sport france" sur le bord */}
          <rect x="180" y="42" width="120" height="14" fill="#ffffff" opacity="0.9" rx="2" />
          <text
            x="240"
            y="53"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="11"
            fill="#dc2626"
            fontWeight="700"
          >
            sport france
          </text>
        </g>

        {/* Joueur de gauche (sombre, en mouvement) */}
        <g fill="#0d1f18" opacity="0.97">
          <circle cx="100" cy="180" r="26" />
          <path d="M 76 210 q 24 -10 48 0 v 90 q -24 6 -48 0 z" />
          {/* Bras qui frappe */}
          <rect x="38" y="200" width="22" height="48" rx="10" transform="rotate(-30 49 224)" />
        </g>
        {/* Raquette gauche */}
        <circle cx="38" cy="208" r="18" fill="#dc2626" stroke="#0d1f18" strokeWidth="4" />

        {/* Joueur de droite (clair) */}
        <g opacity="0.97">
          <circle cx="700" cy="180" r="26" fill="#1f3a2a" />
          <path d="M 676 210 q 24 -10 48 0 v 90 q -24 6 -48 0 z" fill="#e8efe9" />
          {/* Bras tenant la raquette */}
          <rect x="730" y="200" width="22" height="48" rx="10" fill="#e8efe9" transform="rotate(20 741 224)" />
        </g>
        {/* Raquette droite */}
        <circle cx="760" cy="208" r="18" fill="#dc2626" stroke="#0d1f18" strokeWidth="4" />

        {/* Balle */}
        <circle cx="400" cy="150" r="7" fill="#facc15" />

        {/* Ombre du haut pour aider la marque à ressortir */}
        <rect width="800" height="120" fill="url(#top-shade)" />

        {/* Fondu vers le bg de l'app */}
        <rect y="240" width="800" height="120" fill="url(#fade)" />
      </svg>

      <div className="relative z-10 flex h-full items-start justify-center pt-5">
        <BrandLogo href="" size="lg" />
      </div>
    </div>
  );
}
