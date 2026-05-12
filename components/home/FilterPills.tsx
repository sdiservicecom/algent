import Link from 'next/link';

interface Props {
  pinnedCount: number;
}

/**
 * Trio de filtres en pilule (épinglés / favoris / réglés) au-dessus du
 * fil "Match en cours". Chaque pilule lie à /matches avec le filtre
 * correspondant côté URL.
 */
export function FilterPills({ pinnedCount }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/matches?status=IN_PROGRESS"
        aria-label="Matchs épinglés / en cours"
        className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-sm font-semibold text-fg/80 transition hover:bg-white/15 hover:text-fg"
      >
        <span aria-hidden className="text-danger">📍</span>
        {pinnedCount > 0 && (
          <span className="text-xs font-bold text-fg/70">{pinnedCount}</span>
        )}
      </Link>
      <Link
        href="/tournament"
        aria-label="Favoris"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-fg/70 transition hover:bg-white/15 hover:text-fg"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
        </svg>
      </Link>
      <Link
        href="/matches?status=SETTLED"
        aria-label="Matchs réglés"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-fg/70 transition hover:bg-white/15 hover:text-fg"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
      </Link>
    </div>
  );
}
