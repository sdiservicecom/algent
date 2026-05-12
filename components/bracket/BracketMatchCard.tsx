import Link from 'next/link';
import { PlayerAvatar } from '../PlayerAvatar';
import type { Match, Player } from '@/lib/types';

interface Props {
  match: Match;
  playerA: Player;
  playerB: Player;
}

/**
 * Carte d'un match dans la vue Bracket : avatar + nom + score à droite,
 * séparateur "vs" centré, deuxième joueur en miroir.
 */
export function BracketMatchCard({ match, playerA, playerB }: Props) {
  const settled = match.status === 'SETTLED';
  const winner = match.winnerId;
  const aWins = settled && winner === playerA.id;
  const bWins = settled && winner === playerB.id;

  return (
    <li className="card !p-3">
      <Link
        href={`/matches/${match.id}`}
        className="block space-y-2"
        aria-label={`Détails du match ${playerA.firstName} vs ${playerB.firstName}`}
      >
        <PlayerRow player={playerA} score={match.scoreA} isWinner={aWins} isLoser={bWins} />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-fg/45">vs</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <PlayerRow player={playerB} score={match.scoreB} isWinner={bWins} isLoser={aWins} />
      </Link>
    </li>
  );
}

function PlayerRow({
  player,
  score,
  isWinner,
  isLoser,
}: {
  player: Player;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <PlayerAvatar player={player} size={40} className="ring-1 ring-border" />
      <div
        className={`min-w-0 flex-1 truncate text-base font-semibold ${
          isWinner ? 'text-fg' : isLoser ? 'text-fg/50' : 'text-fg'
        }`}
      >
        {player.firstName}
        {player.lastName && (
          <span className="font-normal text-fg/60"> {player.lastName}</span>
        )}
      </div>
      <span
        className={`inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-sm font-bold ${
          isWinner
            ? 'bg-accent text-black'
            : isLoser
              ? 'bg-white/5 text-fg/40'
              : 'bg-white/8 text-fg'
        }`}
      >
        {score ?? '—'}
      </span>
    </div>
  );
}
