'use client';

import Link from 'next/link';
import { useBasket } from './BasketContext';
import { PlayerAvatar } from './PlayerAvatar';
import { fmtDateTime, fmtOdds } from '@/lib/format';
import {
  MATCH_ROUND_LABEL,
  type Match,
  type MatchStatus,
  type Player,
} from '@/lib/types';

const STATUS_LABEL: Record<MatchStatus, { label: string; color: string }> = {
  SCHEDULED: { label: 'À venir', color: 'bg-white/10 text-fg/70' },
  OPEN_FOR_BETS: { label: 'Ouvert', color: 'bg-success/15 text-success' },
  LOCKED: { label: 'Verrouillé', color: 'bg-yellow-500/20 text-yellow-400' },
  IN_PROGRESS: {
    label: 'En cours',
    color: 'bg-danger/15 text-danger',
  },
  FINISHED: { label: 'Terminé', color: 'bg-white/10 text-fg/70' },
  SETTLED: { label: 'Réglé', color: 'bg-accent/15 text-accent' },
  CANCELLED: { label: 'Annulé', color: 'bg-danger/15 text-danger' },
};

interface Props {
  match: Match;
  pa: Player;
  pb: Player;
  winner: Player | null;
  viewerUserId?: string | null;
}

export function MatchCard({ match, pa, pb, winner, viewerUserId }: Props) {
  const { isPicked, hasMatch, toggle } = useBasket();
  const status = STATUS_LABEL[match.status];

  const canBet =
    match.status === 'OPEN_FOR_BETS' &&
    new Date(match.startsAt).getTime() - Date.now() > 2 * 60 * 1000;

  const matchLabel = `${pa.firstName} ${pa.lastName} vs ${pb.firstName} ${pb.lastName}`;
  const settled = match.status === 'SETTLED' && winner;
  const inBasket = hasMatch(match.id) && canBet;
  const live = match.status === 'IN_PROGRESS' || match.status === 'LOCKED';

  const handlePick = (player: Player, odds: number) => {
    if (!canBet) return;
    toggle({
      matchId: match.id,
      matchLabel,
      pickedPlayerId: player.id,
      pickLabel: `${player.firstName} ${player.lastName}`,
      pickPhotoUrl: player.photoUrl,
      oddsAtAdd: odds,
      playerALabel: pa.firstName,
      playerBLabel: pb.firstName,
    });
  };

  return (
    <li
      className={`relative overflow-hidden rounded-3xl border bg-surface/80 p-4 transition ${
        inBasket
          ? 'border-accent shadow-glow'
          : live
            ? 'border-accent/40'
            : 'border-border'
      }`}
    >
      {/* Halo vert pour les matchs en cours */}
      {live && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-accent/12 to-transparent"
        />
      )}

      <header className="relative z-10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {match.round && (
            <span className="inline-flex items-center gap-1 text-fg/60">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 21h8M12 17v4" />
                <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
              </svg>
              {MATCH_ROUND_LABEL[match.round]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {live && (
            <span className="inline-flex items-center gap-1 text-danger">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
              <span className="font-semibold uppercase">{status.label}</span>
            </span>
          )}
          {!live && (
            <span className={`pill ${status.color}`}>{status.label}</span>
          )}
          <span aria-hidden className="text-danger">📍</span>
        </div>
      </header>

      <div className="relative z-10 mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <PlayerSlot
          player={pa}
          odds={match.oddsA}
          picked={isPicked(match.id, pa.id)}
          canBet={canBet}
          settled={!!settled}
          isWinner={settled ? winner?.id === pa.id : false}
          isMe={viewerUserId === pa.linkedUserId}
          onPick={() => handlePick(pa, match.oddsA)}
        />
        <div className="flex flex-col items-center text-xs">
          {match.scoreA != null && match.scoreB != null ? (
            <span className="font-mono text-base font-bold">
              {match.scoreA} – {match.scoreB}
            </span>
          ) : (
            <span className="text-fg/30">vs</span>
          )}
          <span className="mt-1 text-[10px] uppercase tracking-wide text-fg/50">
            {fmtDateTime(match.startsAt)}
          </span>
        </div>
        <PlayerSlot
          player={pb}
          odds={match.oddsB}
          picked={isPicked(match.id, pb.id)}
          canBet={canBet}
          settled={!!settled}
          isWinner={settled ? winner?.id === pb.id : false}
          isMe={viewerUserId === pb.linkedUserId}
          onPick={() => handlePick(pb, match.oddsB)}
          align="right"
        />
      </div>

      <footer className="relative z-10 mt-3 flex items-center justify-between text-xs">
        {canBet ? (
          <span className="text-fg/50">Touche une cote pour parier</span>
        ) : (
          <span />
        )}
        <Link
          href={`/matches/${match.id}`}
          className="font-semibold text-accent hover:underline"
        >
          Détails →
        </Link>
      </footer>
    </li>
  );
}

interface SlotProps {
  player: Player;
  odds: number;
  picked: boolean;
  canBet: boolean;
  settled: boolean;
  isWinner: boolean;
  isMe?: boolean;
  align?: 'left' | 'right';
  onPick: () => void;
}

function PlayerSlot({
  player,
  odds,
  picked,
  canBet,
  settled,
  isWinner,
  isMe,
  align = 'left',
  onPick,
}: SlotProps) {
  const oddsButton = settled ? (
    <span
      className={`odds-pill ${
        isWinner ? '!bg-success !text-black' : 'odds-pill-loser'
      }`}
    >
      {fmtOdds(odds)}
    </span>
  ) : canBet ? (
    <button
      type="button"
      onClick={onPick}
      className={`odds-pill ${picked ? 'odds-pill-active' : ''}`}
    >
      {fmtOdds(odds)}
    </button>
  ) : (
    <span className="odds-pill opacity-70">{fmtOdds(odds)}</span>
  );

  return (
    <div className={`flex flex-col items-center text-center`}>
      <PlayerAvatar player={player} size={56} />
      <div className="mt-2 truncate text-sm font-semibold">
        {player.firstName}
        {isMe && (
          <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
            Vous
          </span>
        )}
      </div>
      <div className="mt-1">{oddsButton}</div>
    </div>
  );
}
