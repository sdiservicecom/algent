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
  const total = match.totalStakeA + match.totalStakeB;
  const pctA = total > 0 ? Math.round((match.totalStakeA / total) * 100) : null;
  const pctB = total > 0 ? Math.round((match.totalStakeB / total) * 100) : null;

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg/70">
            <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
          </svg>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-danger">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
              <span className="font-semibold">{status.label}</span>
            </span>
          ) : match.round ? (
            <span className="font-semibold text-fg/80">
              {MATCH_ROUND_LABEL[match.round]}
            </span>
          ) : (
            <span className={`pill ${status.color}`}>{status.label}</span>
          )}
        </div>
        <span aria-hidden className="text-danger">📍</span>
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
          stakePct={pctA}
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
          stakePct={pctB}
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
  /** Pourcentage de la mise totale du match sur ce joueur (0-100). */
  stakePct: number | null;
}

function PlayerSlot({
  player,
  odds,
  picked,
  canBet,
  settled,
  isWinner,
  isMe,
  onPick,
  stakePct,
}: SlotProps) {
  // Cote en pilule verte si c'est le favori du marché (>= 60% des mises)
  const isFav = stakePct != null && stakePct >= 60;
  const pillTone = settled
    ? isWinner
      ? '!bg-success !text-black'
      : 'odds-pill-loser'
    : picked
      ? 'odds-pill-active'
      : isFav
        ? '!bg-accent !text-black'
        : '';

  const oddsButton = settled ? (
    <span className={`odds-pill ${pillTone}`}>{fmtOdds(odds)}</span>
  ) : canBet ? (
    <button
      type="button"
      onClick={onPick}
      className={`odds-pill ${pillTone}`}
    >
      {fmtOdds(odds)}
    </button>
  ) : (
    <span className={`odds-pill opacity-70 ${pillTone}`}>{fmtOdds(odds)}</span>
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
      {stakePct != null && (
        <div className="mt-1.5 flex w-full max-w-[80%] flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-fg/60">
            {stakePct}%
          </span>
          <span className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <span
              className={`block h-full ${isFav ? 'bg-accent' : 'bg-fg/40'}`}
              style={{ width: `${stakePct}%` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
