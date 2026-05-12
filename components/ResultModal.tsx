'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppNotification, Bet, Match, Player } from '@/lib/types';
import { fmtOdds, fmtPoints } from '@/lib/format';
import { CoinIcon } from './CoinIcon';

interface LossPayload {
  kind: 'BET_LOST';
  notificationId: string;
  bet: Bet;
  match: Match;
  picked: Player;
  scoreA: number | null;
  scoreB: number | null;
  playerA: Player;
  playerB: Player;
}
interface WinPayload {
  kind: 'BET_WON';
  notificationId: string;
  bet: Bet;
  match: Match;
  picked: Player;
  scoreA: number | null;
  scoreB: number | null;
  playerA: Player;
  playerB: Player;
}
export type ResultPayload = LossPayload | WinPayload;

/**
 * Pop-up plein-écran déclenchée quand un pari fraichement réglé n'a
 * pas encore été lu : on l'affiche, puis l'utilisateur la ferme.
 * - LOST → carte rouge dramatique "Eh oui, tu as misé sur la mauvaise personne…"
 * - WON  → carte verte "Bien joué !"
 */
export function ResultModal({ payload }: { payload: ResultPayload }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = async () => {
    setOpen(false);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: payload.notificationId }),
      });
    } catch {
      /* ignore */
    }
    router.refresh();
  };

  if (!open) return null;

  const lost = payload.kind === 'BET_LOST';
  const stake = payload.bet.stake;
  const payout = payload.bet.payout ?? 0;
  const odds = payload.bet.oddsAtBet;
  const opponent =
    payload.picked.id === payload.playerA.id ? payload.playerB : payload.playerA;
  const score =
    payload.scoreA != null && payload.scoreB != null
      ? `${payload.playerA.firstName} ${payload.scoreA}  –  ${payload.scoreB} ${payload.playerB.firstName}`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full max-w-sm animate-pop rounded-3xl border p-6 pt-12 text-center shadow-2xl ${
          lost
            ? 'border-danger/40 bg-gradient-to-b from-[#3b0d0d] to-[#5b0f0f]'
            : 'border-accent/40 bg-gradient-to-b from-[#0c3826] to-[#0a2418]'
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className={`absolute -top-6 left-1/2 inline-flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-bg shadow-xl ${
            lost ? 'bg-danger text-white' : 'bg-accent text-black'
          }`}
        >
          {lost ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <h2 className="font-display text-2xl font-bold leading-tight text-white">
          {lost
            ? 'Eh oui, tu as misé sur la mauvaise personne…'
            : 'Bien joué, tu as flairé le bon coup !'}{' '}
          <span aria-hidden>{lost ? '🤝😹' : '🎉'}</span>
        </h2>

        <div
          className={`mx-auto mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-2xl font-bold ${
            lost ? 'bg-danger text-white' : 'bg-accent text-black'
          }`}
        >
          {lost ? `-${fmtPoints(stake)}` : `+${fmtPoints(payout)}`}
          <CoinIcon size={20} />
        </div>

        <div className="mt-5 rounded-2xl bg-black/25 p-4 text-left text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white ${
                  lost ? 'bg-danger' : 'bg-accent text-black'
                }`}
                aria-hidden
              >
                {lost ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                )}
              </span>
              Résultats{' '}
              <span className={lost ? 'text-danger' : 'text-accentBright'}>
                {payload.picked.firstName}
              </span>
            </span>
            <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-black">
              {fmtOdds(odds)}
            </span>
          </div>
          {score && (
            <div className="mt-2 text-fg/80">{score}</div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-fg/60">Mise</span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              {fmtPoints(stake)} <CoinIcon size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-semibold">Gains</span>
            <span
              className={`inline-flex items-center gap-1.5 font-bold ${
                lost ? 'text-danger' : 'text-accentBright'
              }`}
            >
              {lost ? '00,00' : `+${fmtPoints(payout)}`}
              <CoinIcon size={12} />
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          {opponent ? `Allez, revanche contre ${opponent.firstName} !` : 'Fermer'}
        </button>
      </div>
    </div>
  );
}

/** Variante minimale : convertit une notification + données enrichies en payload. */
export function buildResultPayload(
  n: AppNotification,
  ctx: { bet: Bet; match: Match; picked: Player; playerA: Player; playerB: Player },
): ResultPayload | null {
  if (n.kind !== 'BET_WON' && n.kind !== 'BET_LOST') return null;
  return {
    kind: n.kind,
    notificationId: n.id,
    bet: ctx.bet,
    match: ctx.match,
    picked: ctx.picked,
    playerA: ctx.playerA,
    playerB: ctx.playerB,
    scoreA: ctx.match.scoreA,
    scoreB: ctx.match.scoreB,
  };
}
