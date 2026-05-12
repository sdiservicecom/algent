import type { BetStatus } from '@/lib/types';

interface Props {
  status: BetStatus;
  kind: 'Simple' | 'Combiné';
  /** Pour le combiné : nombre de jambes du pari. */
  legCount?: number;
}

const STATUS_LABEL: Record<BetStatus, string> = {
  PENDING: 'En cours',
  WON: 'Gagné',
  LOST: 'Perdu',
  CANCELLED: 'Annulé',
};

const STATUS_COLOR: Record<BetStatus, string> = {
  PENDING: 'bg-white/15 text-fg',
  WON: 'bg-accent text-black',
  LOST: 'bg-danger text-white',
  CANCELLED: 'bg-yellow-500/30 text-yellow-300',
};

/**
 * Bandeau en haut de chaque carte de pari : "En cours" / "Gagné" / "Perdu"
 * (avec sa couleur) + "Simple" ou "Combiné" + le compteur 🏓 N pour les combinés.
 */
export function StatusHeader({ status, kind, legCount }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
      <span className="flex items-center gap-1.5 font-semibold text-fg">
        {kind}
        <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[11px]">
          <span aria-hidden>🏓</span>
          {legCount != null && <span>{legCount}</span>}
        </span>
      </span>
    </div>
  );
}
