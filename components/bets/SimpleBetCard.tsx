import { fmtOdds, fmtPoints } from '@/lib/format';
import type { Bet, Match, Player } from '@/lib/types';
import { CoinIcon } from '../CoinIcon';
import { StatusHeader } from './StatusHeader';
import { LegStatusIcon } from './LegStatusIcon';

interface Props {
  bet: Bet;
  match: Match | null;
  picked: Player | null;
  playerA: Player | null;
  playerB: Player | null;
}

/**
 * Carte d'un pari simple : badge de statut (En cours / Gagné / Perdu) en
 * haut, ligne "Résultats [Joueur]" + cote, score si réglé, Mise + Gains.
 */
export function SimpleBetCard({ bet, match, picked, playerA, playerB }: Props) {
  if (!match || !picked || !playerA || !playerB) return null;

  // Couleur du nom du joueur choisi : vert si pending/gagné, rouge si perdu.
  const pickedTone =
    bet.status === 'LOST' ? 'text-danger' : 'text-accentBright';

  // Tone des gains
  const gainsTone =
    bet.status === 'WON'
      ? 'text-accentBright'
      : bet.status === 'LOST'
        ? 'text-danger'
        : 'text-fg';

  const gainsAmount =
    bet.status === 'WON'
      ? bet.payout ?? 0
      : bet.status === 'LOST'
        ? 0
        : bet.potentialWin;

  // Pour la ligne score : "Dominique 21 - 19 Alexandre" si réglé
  const showScore = match.scoreA != null && match.scoreB != null;

  return (
    <li className="card !p-3">
      <StatusHeader status={bet.status} kind="Simple" />

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <LegStatusIcon status={bet.status} size={20} />
          <div className="flex-1 truncate text-sm">
            <span className="text-fg/70">Résultats</span>{' '}
            <span className={`font-bold ${pickedTone}`}>{picked.firstName}</span>
          </div>
          <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-0.5 text-xs font-bold text-black">
            {fmtOdds(bet.oddsAtBet)}
          </span>
        </div>

        <div className="text-sm text-fg/70">
          {playerA.firstName}
          {showScore && (
            <span className="font-mono font-semibold text-fg">
              {' '}
              {match.scoreA}
            </span>
          )}{' '}
          <span className="text-fg/40">–</span>{' '}
          {showScore && (
            <span className="font-mono font-semibold text-fg">
              {match.scoreB}{' '}
            </span>
          )}
          {playerB.firstName}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-fg/70">Mise</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-0.5 font-semibold">
            {fmtPoints(bet.stake)}
            <CoinIcon size={11} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold">Gains</span>
          <span
            className={`inline-flex items-center gap-1.5 font-bold ${gainsTone}`}
          >
            {bet.status === 'LOST'
              ? '00,00'
              : bet.status === 'WON'
                ? fmtPoints(gainsAmount)
                : fmtPoints(gainsAmount)}
            <CoinIcon size={11} />
          </span>
        </div>
      </div>
    </li>
  );
}
