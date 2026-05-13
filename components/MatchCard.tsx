'use client';

import Link from 'next/link';
import { useBasket } from './BasketContext';
import { PlayerAvatar } from './PlayerAvatar';
import { fmtOdds } from '@/lib/format';

const fmtShortDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
    .format(new Date(d))
    .replace('.', '');

const fmtTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
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

  // Pourcentage de chance de gagner, dérivé de la cote (probabilité
  // implicite normalisée) : p = (1/cote) / (1/coteA + 1/coteB) * 100.
  // Plus la cote est faible, plus le % est élevé.
  const invA = match.oddsA > 0 ? 1 / match.oddsA : 0;
  const invB = match.oddsB > 0 ? 1 / match.oddsB : 0;
  const sumInv = invA + invB;
  const pctA = sumInv > 0 ? Math.round((invA / sumInv) * 100) : null;
  const pctB = pctA != null ? 100 - pctA : null;

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
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-fg/85"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
            </svg>
          </span>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-danger">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
              <span className="text-sm font-semibold">{status.label}</span>
            </span>
          ) : match.round ? (
            <span className="text-sm font-semibold text-fg">
              {MATCH_ROUND_LABEL[match.round]}
            </span>
          ) : (
            <span className={`pill ${status.color}`}>{status.label}</span>
          )}
        </div>
        <span aria-hidden className="text-base leading-none">🏓</span>
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
        <div className="flex flex-col items-center text-center">
          {match.scoreA != null && match.scoreB != null ? (
            <span className="font-mono text-lg font-bold">
              {match.scoreA} – {match.scoreB}
            </span>
          ) : (
            <>
              <span className="text-sm font-semibold text-fg/70">
                {fmtShortDate(match.startsAt)}
              </span>
              <span className="font-mono text-lg font-bold leading-tight">
                {fmtTime(match.startsAt)}
              </span>
            </>
          )}
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
  // Le côté qui draine le plus de mises (ou la plus petite cote en %
  // implicite) : sert uniquement à colorer la barre de pourcentage en
  // dessous — pas la pilule de cote, sinon le favori a l'air pré-coché.
  const isFav = stakePct != null && stakePct >= 50;

  // Style de la pilule de cote :
  //  - settled gagnant → vert plein
  //  - settled perdant → grisé barré
  //  - picked          → vert plein "glow" (= état actif de sélection)
  //  - par défaut      → bordure verte + texte vert, fond transparent
  // → un match neuf est donc affiché SANS aucun côté pré-sélectionné.
  const pillBase =
    'inline-flex items-center justify-center rounded-full px-5 py-1 text-sm font-semibold transition';
  const pillTone = settled
    ? isWinner
      ? 'bg-accent text-black'
      : 'border border-fg/15 text-fg/30 line-through'
    : picked
      ? 'bg-accent text-black shadow-glow-soft'
      : 'border border-accent/60 bg-transparent text-accent hover:bg-accent/10';

  const oddsButton = settled ? (
    <span className={`${pillBase} ${pillTone}`}>{fmtOdds(odds)}</span>
  ) : canBet ? (
    <button
      type="button"
      onClick={onPick}
      className={`${pillBase} ${pillTone}`}
    >
      {fmtOdds(odds)}
    </button>
  ) : (
    <span className={`${pillBase} ${pillTone} opacity-80`}>
      {fmtOdds(odds)}
    </span>
  );

  return (
    <div className="flex flex-col items-center text-center">
      <PlayerAvatar player={player} size={72} className="ring-1 ring-border" />
      <div className="mt-2 truncate text-sm font-semibold">
        {player.firstName}
        {isMe && (
          <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
            Vous
          </span>
        )}
      </div>
      <div className="mt-2">{oddsButton}</div>
      {stakePct != null && (
        <div className="mt-2 flex w-full items-center gap-2 text-[11px] font-semibold">
          <span className={isFav ? 'text-success' : 'text-danger'}>
            {stakePct}%
          </span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
            <span
              className={`block h-full ${isFav ? 'bg-success' : 'bg-danger'}`}
              style={{ width: `${Math.max(stakePct, 5)}%` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
