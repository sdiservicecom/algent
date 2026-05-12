import Link from 'next/link';
import { PlayerAvatar } from '../PlayerAvatar';
import type { Match, Player } from '@/lib/types';

interface Props {
  match: Match;
  playerA: Player;
  playerB: Player;
}

/**
 * Carte compacte "Terminé" pour la section Derniers résultats.
 * Avatar de gauche / droite avec anneau coloré selon le résultat,
 * score au centre, noms colorés.
 */
export function RecentResultCard({ match, playerA, playerB }: Props) {
  const winnerId = match.winnerId;
  const aWin = winnerId === playerA.id;
  const bWin = winnerId === playerB.id;
  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="card flex flex-col gap-2 hover:border-accent/60"
    >
      <header className="flex items-center gap-2 text-xs">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg/70">
          <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
        </svg>
        <span className="font-semibold text-fg/70">Terminé</span>
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`rounded-full p-0.5 ${
              aWin ? 'bg-success/70' : bWin ? 'bg-danger/70' : 'bg-fg/20'
            }`}
          >
            <PlayerAvatar player={playerA} size={56} className="!border-transparent" />
          </div>
          <div
            className={`truncate text-sm font-semibold ${
              aWin ? 'text-success' : bWin ? 'text-danger' : 'text-fg'
            }`}
          >
            {playerA.firstName}
          </div>
        </div>
        <div className="flex flex-col items-center text-xs">
          <span className="font-mono text-base font-bold">
            {scoreA} - {scoreB}
          </span>
          <span className="mt-1 text-fg/40">vs</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`rounded-full p-0.5 ${
              bWin ? 'bg-success/70' : aWin ? 'bg-danger/70' : 'bg-fg/20'
            }`}
          >
            <PlayerAvatar player={playerB} size={56} className="!border-transparent" />
          </div>
          <div
            className={`truncate text-sm font-semibold ${
              bWin ? 'text-success' : aWin ? 'text-danger' : 'text-fg'
            }`}
          >
            {playerB.firstName}
          </div>
        </div>
      </div>
    </Link>
  );
}
