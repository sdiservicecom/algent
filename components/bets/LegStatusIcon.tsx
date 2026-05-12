import type { BetStatus } from '@/lib/types';

interface Props {
  status: BetStatus;
  size?: number;
}

/**
 * Icône de statut pour une "jambe" (un pari simple ou un leg d'un combiné) :
 *  - PENDING   → rond vide gris
 *  - WON       → check vert
 *  - LOST      → croix rouge
 *  - CANCELLED → horloge ambre
 */
export function LegStatusIcon({ status, size = 18 }: Props) {
  const cls = `inline-flex shrink-0 items-center justify-center rounded-full`;
  const dim = { width: size, height: size };

  if (status === 'WON') {
    return (
      <span
        style={dim}
        className={`${cls} bg-accent text-black`}
        aria-label="Gagné"
      >
        <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === 'LOST') {
    return (
      <span
        style={dim}
        className={`${cls} bg-danger text-white`}
        aria-label="Perdu"
      >
        <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <span
        style={dim}
        className={`${cls} bg-yellow-500/30 text-yellow-300`}
        aria-label="Annulé"
      >
        <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      </span>
    );
  }
  // PENDING
  return (
    <span
      style={dim}
      className={`${cls} bg-white/10 text-fg/60`}
      aria-label="En cours"
    >
      <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
      </svg>
    </span>
  );
}
