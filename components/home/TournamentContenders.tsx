import Link from 'next/link';
import type { Player } from '@/lib/types';
import { fmtOdds } from '@/lib/format';

interface Props {
  players: Player[];
  odds: Record<string, number>;
  /** Si le tournoi est réglé, on met le gagnant en avant. */
  winnerId: string | null;
}

/**
 * Carrousel horizontal "Gagnant du tournoi" — photos de joueurs grand
 * format avec leur cote individuelle pour gagner le tournoi.
 */
export function TournamentContenders({ players, odds, winnerId }: Props) {
  // Trie par cote ascendante (favoris d'abord), garde le gagnant en tête si réglé.
  const sorted = [...players].sort((a, b) => {
    if (winnerId) {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
    }
    return (odds[a.id] ?? 999) - (odds[b.id] ?? 999);
  });

  // État vide explicite — sinon la section disparait silencieusement
  // quand l'admin n'a pas encore créé les joueurs.
  if (sorted.length === 0) {
    return (
      <Link
        href="/tournament"
        className="card flex flex-col items-center gap-2 py-6 text-center text-sm text-fg/60 hover:border-accent/60"
      >
        <span className="text-3xl" aria-hidden>🏆</span>
        <span>Aucun joueur configuré pour l'instant.</span>
        <span className="text-xs text-accent">Voir le tournoi →</span>
      </Link>
    );
  }

  return (
    <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {sorted.map((p) => {
        const c = odds[p.id];
        const isWinner = winnerId === p.id;
        return (
          <li key={p.id} className="snap-start shrink-0">
            <Link
              href={`/tournament`}
              className={`relative block aspect-[3/4] w-40 overflow-hidden rounded-3xl border transition ${
                isWinner
                  ? 'border-coin shadow-glow'
                  : 'border-border hover:border-accent/60'
              }`}
            >
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photoUrl}
                  alt={`${p.firstName} ${p.lastName}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surfaceRaised to-surfaceAlt text-4xl font-bold text-fg/70">
                  {p.firstName[0]}
                  {p.lastName[0]}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3">
                <div className="truncate text-sm font-bold text-white">
                  {p.nickname || `${p.firstName} ${p.lastName}`}
                </div>
                {c != null && (
                  <span className="mt-1 inline-flex rounded-full bg-white px-3 py-0.5 text-xs font-bold text-black">
                    {fmtOdds(c)}
                  </span>
                )}
              </div>
              {isWinner && (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-coin text-black shadow"
                >
                  🏆
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
