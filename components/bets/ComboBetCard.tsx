'use client';

import { useState } from 'react';
import { fmtOdds, fmtPoints } from '@/lib/format';
import type { BetStatus, ComboBet, Match, Player } from '@/lib/types';
import { CoinIcon } from '../CoinIcon';
import { StatusHeader } from './StatusHeader';
import { LegStatusIcon } from './LegStatusIcon';

interface Props {
  combo: ComboBet;
  matches: Record<string, Match>;
  players: Record<string, Player>;
}

export function ComboBetCard({ combo, matches, players }: Props) {
  // Par défaut, on déplie quand le combiné est réglé ET perdant (l'utilisateur
  // voudra voir quelle jambe a fait sauter le combo). Sinon replié.
  const [open, setOpen] = useState(combo.status === 'LOST');

  // Compte les jambes par statut pour les badges en haut
  const counts = combo.legs.reduce(
    (acc, leg) => {
      acc[leg.status] = (acc[leg.status] ?? 0) + 1;
      return acc;
    },
    { PENDING: 0, WON: 0, LOST: 0, CANCELLED: 0 } as Record<BetStatus, number>,
  );

  const gainsTone =
    combo.status === 'WON'
      ? 'text-accentBright'
      : combo.status === 'LOST'
        ? 'text-danger'
        : 'text-fg';
  const gainsAmount =
    combo.status === 'WON'
      ? combo.payout ?? 0
      : combo.status === 'LOST'
        ? 0
        : combo.potentialWin;

  return (
    <li className="card !p-3">
      <StatusHeader status={combo.status} kind="Combiné" legCount={combo.legs.length} />

      {/* Ligne d'aperçu (chevron + badges de statut par leg) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center gap-2 text-left"
        aria-expanded={open}
        aria-label={open ? 'Replier les paris' : 'Déplier les paris'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-fg/70 transition-transform ${
            open ? '-rotate-180' : ''
          }`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {counts.WON > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accentBright">
              <LegStatusIcon status="WON" size={14} />
              {counts.WON}
            </span>
          )}
          {counts.PENDING > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 font-semibold text-fg/80">
              <LegStatusIcon status="PENDING" size={14} />
              {counts.PENDING}
            </span>
          )}
          {counts.LOST > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 font-semibold text-danger">
              <LegStatusIcon status="LOST" size={14} />
              {counts.LOST}
            </span>
          )}
          {counts.CANCELLED > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 font-semibold text-yellow-300">
              <LegStatusIcon status="CANCELLED" size={14} />
              {counts.CANCELLED}
            </span>
          )}
        </div>
      </button>

      {/* Liste des jambes (déployée) */}
      {open && (
        <ul className="mt-3 space-y-2">
          {combo.legs.map((leg, i) => {
            const match = matches[leg.matchId];
            const picked = players[leg.pickedPlayerId];
            const playerA = match ? players[match.playerAId] : null;
            const playerB = match ? players[match.playerBId] : null;
            if (!match || !picked || !playerA || !playerB) return null;
            const tone =
              leg.status === 'LOST'
                ? 'text-danger'
                : 'text-accentBright';
            const showScore = match.scoreA != null && match.scoreB != null;
            return (
              <li key={`${leg.matchId}-${i}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <LegStatusIcon status={leg.status} size={20} />
                  <div className="flex-1 truncate text-sm">
                    <span className="text-fg/70">Résultats</span>{' '}
                    <span className={`font-bold ${tone}`}>
                      {picked.firstName}
                    </span>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-0.5 text-xs font-bold text-black">
                    {fmtOdds(leg.oddsAtBet)}
                  </span>
                </div>
                <div className="pl-7 text-xs text-fg/70">
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
              </li>
            );
          })}
        </ul>
      )}

      {/* Totaux */}
      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-fg/70">Cote totale</span>
          <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-0.5 text-xs font-bold text-black">
            {fmtOdds(combo.combinedOdds)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fg/70">Mise</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-0.5 font-semibold">
            {fmtPoints(combo.stake)}
            <CoinIcon size={11} />
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <span className="font-bold">Gains</span>
          <span
            className={`inline-flex items-center gap-1.5 font-bold ${gainsTone}`}
          >
            {combo.status === 'LOST' ? '00,00' : fmtPoints(gainsAmount)}
            <CoinIcon size={11} />
          </span>
        </div>
      </div>
    </li>
  );
}
