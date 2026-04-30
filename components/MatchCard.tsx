'use client';

import Link from 'next/link';
import { useBasket } from './BasketContext';
import { PlayerAvatar } from './PlayerAvatar';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';
import {
  MATCH_ROUND_LABEL,
  type Match,
  type MatchStatus,
  type Player,
} from '@/lib/types';

const STATUS_LABEL: Record<MatchStatus, { label: string; color: string }> = {
  SCHEDULED: { label: 'À venir', color: 'bg-fg/10 text-fg/70' },
  OPEN_FOR_BETS: { label: 'Ouvert', color: 'bg-success/20 text-success' },
  LOCKED: { label: 'Verrouillé', color: 'bg-yellow-500/20 text-yellow-400' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-yellow-500/20 text-yellow-400' },
  FINISHED: { label: 'Terminé', color: 'bg-fg/10 text-fg/70' },
  SETTLED: { label: 'Réglé', color: 'bg-accent/20 text-accent' },
  CANCELLED: { label: 'Annulé', color: 'bg-danger/20 text-danger' },
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
  const total = match.totalStakeA + match.totalStakeB;
  const ratioA = total > 0 ? match.totalStakeA / total : 0.5;
  const status = STATUS_LABEL[match.status];

  const canBet =
    match.status === 'OPEN_FOR_BETS' &&
    new Date(match.startsAt).getTime() - Date.now() > 2 * 60 * 1000;

  const matchLabel = `${pa.firstName} ${pa.lastName} vs ${pb.firstName} ${pb.lastName}`;
  const settled = match.status === 'SETTLED' && winner;
  const inBasket = hasMatch(match.id) && canBet;

  const renderOdds = (player: Player, odds: number, label: string) => {
    const picked = isPicked(match.id, player.id);

    if (settled) {
      const isWinner = winner!.id === player.id;
      return (
        <div
          className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${
            isWinner
              ? 'border-success bg-success/5 shadow-glow'
              : 'border-border opacity-60'
          }`}
        >
          <div
            className={`text-xs font-medium uppercase tracking-wide ${
              isWinner ? 'text-success' : 'text-fg/50'
            }`}
          >
            {isWinner ? '✓ Vainqueur' : label}
          </div>
          <div
            className={`odds-pill ${
              isWinner ? 'border-success text-success' : 'odds-pill-loser'
            }`}
          >
            {fmtOdds(odds)}
          </div>
        </div>
      );
    }

    if (!canBet) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3">
          <div className="text-xs uppercase text-fg/50">{label}</div>
          <div className="odds-pill">{fmtOdds(odds)}</div>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() =>
          toggle({
            matchId: match.id,
            matchLabel,
            pickedPlayerId: player.id,
            pickLabel: `${player.firstName} ${player.lastName}`,
            pickPhotoUrl: player.photoUrl,
            oddsAtAdd: odds,
            playerALabel: pa.firstName,
            playerBLabel: pb.firstName,
          })
        }
        className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
          picked
            ? 'border-accent bg-accent/5 shadow-glow'
            : 'border-border hover:border-accent/60'
        }`}
      >
        <div className="text-xs uppercase text-fg/50">{label}</div>
        <div className={`odds-pill ${picked ? 'odds-pill-active' : ''}`}>
          {fmtOdds(odds)}
        </div>
      </button>
    );
  };

  return (
    <li className={inBasket ? 'card-active' : 'card'}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pill ${status.color}`}>{status.label}</span>
          {match.round && (
            <span className="pill bg-fg/10 text-fg/70">
              {MATCH_ROUND_LABEL[match.round]}
            </span>
          )}
        </div>
        <span className="text-xs text-fg/50">
          {fmtDateTime(match.startsAt)}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PlayerAvatar player={pa} size={40} />
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {pa.firstName} {pa.lastName}
              {viewerUserId && pa.linkedUserId === viewerUserId && (
                <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  Vous
                </span>
              )}
            </div>
            {pa.nickname && (
              <div className="truncate text-xs text-fg/60">
                « {pa.nickname} »
              </div>
            )}
            <div className="text-xs text-fg/50">Seed #{pa.seed}</div>
          </div>
        </div>
        <div className="pt-2 text-xs text-fg/50">vs</div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right">
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {pb.firstName} {pb.lastName}
              {viewerUserId && pb.linkedUserId === viewerUserId && (
                <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  Vous
                </span>
              )}
            </div>
            {pb.nickname && (
              <div className="truncate text-xs text-fg/60">
                « {pb.nickname} »
              </div>
            )}
            <div className="text-xs text-fg/50">Seed #{pb.seed}</div>
          </div>
          <PlayerAvatar player={pb} size={40} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
        {renderOdds(pa, match.oddsA, 'Cote A')}
        {renderOdds(pb, match.oddsB, 'Cote B')}
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-fg/50">
            <span>{fmtPoints(match.totalStakeA)} pts</span>
            <span>{fmtPoints(match.totalStakeB)} pts</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full bg-accent"
              style={{ width: `${ratioA * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-between text-xs">
        {canBet ? (
          <span className="text-fg/50">
            Clique sur une cote pour ajouter au panier
          </span>
        ) : (
          <span />
        )}
        <Link
          href={`/matches/${match.id}`}
          className="text-accent hover:underline"
        >
          Détails →
        </Link>
      </div>
    </li>
  );
}
