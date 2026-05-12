'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBasket } from './BasketContext';
import { fmtPoints } from '@/lib/format';
import { CoinIcon } from './CoinIcon';

const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Mode = 'individual' | 'combo';

const ERROR_LABEL: Record<string, string> = {
  STAKE_OUT_OF_BOUNDS: 'Mise hors limites (10 – 50 000).',
  MATCH_NOT_OPEN: 'Match plus ouvert.',
  MATCH_STARTED: 'Match déjà commencé.',
  INVALID_PLAYER: 'Joueur invalide.',
  BET_ALREADY_PLACED: 'Pari déjà existant pour ce match.',
  INSUFFICIENT_BALANCE: 'Solde insuffisant.',
  MATCH_NOT_FOUND: 'Match introuvable.',
  TOO_FEW_LEGS: 'Au moins 2 paris pour un combiné.',
  TOO_MANY_LEGS: 'Trop de paris (max 10).',
  DUPLICATE_LEG: 'Un même match ne peut pas apparaître deux fois.',
};

const round2 = (x: number) => Math.round(x * 100) / 100;

export function FloatingBetBasket({ balance }: { balance: number }) {
  const { items, remove, setStake, clear } = useBasket();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('individual');
  const [comboStake, setComboStake] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [comboError, setComboError] = useState<string | null>(null);
  const router = useRouter();

  // Verrouille le scroll body quand la feuille est ouverte
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (items.length === 0) return null;

  const total = items.reduce((s, i) => s + (Number(i.stake) || 0), 0);
  const totalGain = items.reduce(
    (s, i) => s + Math.floor((Number(i.stake) || 0) * i.oddsAtAdd),
    0,
  );
  const overflow = mode === 'individual' && total > balance;
  const someInvalid =
    mode === 'individual' &&
    items.some(
      (i) => !Number.isFinite(i.stake) || i.stake < 10 || i.stake > 50_000,
    );

  const combinedOdds = round2(items.reduce((p, i) => p * i.oddsAtAdd, 1));
  const comboPotential = Math.floor(comboStake * combinedOdds);
  const comboStakeValid =
    Number.isFinite(comboStake) &&
    comboStake >= 10 &&
    comboStake <= balance &&
    comboStake <= 50_000;
  const comboLegsOk = items.length >= 2 && items.length <= 10;

  const submitIndividual = async () => {
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch('/api/bets/batch', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': newIdempotencyKey(),
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            matchId: i.matchId,
            pickedPlayerId: i.pickedPlayerId,
            stake: Math.floor(i.stake),
            scoreGuessA: i.scoreGuessA ?? null,
            scoreGuessB: i.scoreGuessB ?? null,
          })),
        }),
      });
      const data = (await res.json()) as {
        placed?: string[];
        errors?: Record<string, string>;
      };
      const placed = new Set(data.placed ?? []);
      for (const m of placed) remove(m);
      const next = data.errors ?? {};
      setErrors(next);
      router.refresh();
      if (Object.keys(next).length === 0) {
        clear();
        setOpen(false);
      }
    } catch {
      setErrors({ _: 'Erreur réseau, réessaie.' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCombo = async () => {
    setSubmitting(true);
    setComboError(null);
    try {
      const res = await fetch('/api/bets/combo', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': newIdempotencyKey(),
        },
        body: JSON.stringify({
          stake: Math.floor(comboStake),
          items: items.map((i) => ({
            matchId: i.matchId,
            pickedPlayerId: i.pickedPlayerId,
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setComboError(data.error ?? 'UNKNOWN');
        return;
      }
      router.refresh();
      clear();
      setOpen(false);
    } catch {
      setComboError('NETWORK');
    } finally {
      setSubmitting(false);
    }
  };

  // — Bouton flottant : style "Mes paris (N)" — visible quand la feuille est fermée
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir mes paris"
        className="fixed left-1/2 z-30 -translate-x-1/2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-black shadow-glow"
        style={{ bottom: 'calc(5.5rem + var(--safe-bottom))' }}
      >
        🎯 Mes paris <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-xs">{items.length}</span>
      </button>
    );
  }

  return (
    <>
      {/* Overlay sombre */}
      <div
        className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl animate-sheet-up"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="card-sheet flex max-h-[88dvh] flex-col gap-3"
          style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}
        >
          {/* Handle + tabs + close */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('individual')}
                className={`tab-pill ${
                  mode === 'individual' ? 'tab-pill-active' : 'tab-pill-idle'
                }`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setMode('combo')}
                className={`tab-pill ${
                  mode === 'combo' ? 'tab-pill-active' : 'tab-pill-idle'
                }`}
              >
                Combiné
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-fg/70 hover:bg-white/15 hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          <h3 className="font-display text-xl font-bold">Mes paris</h3>

          {/* Liste paris */}
          <ul className="flex-1 space-y-3 overflow-y-auto pr-1">
            {items.map((i) => {
              const potential = Math.floor((Number(i.stake) || 0) * i.oddsAtAdd);
              return (
                <li key={i.matchId} className="space-y-2 pb-3 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span aria-hidden>🏓</span>
                        <span className="truncate font-semibold">
                          {i.matchLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm">
                        <span className="text-fg/70">
                          Résultats{' '}
                          <span className="font-bold text-fg">{i.pickLabel}</span>
                        </span>
                        <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-black">
                          {i.oddsAtAdd.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(i.matchId)}
                      aria-label="Retirer"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-fg/60 transition hover:bg-danger/15 hover:text-danger"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>

                  {mode === 'individual' && (
                    <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
                      <label className="flex items-center justify-between text-sm">
                        <span className="text-fg/70">Mise</span>
                        <span className="relative inline-flex items-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={10}
                            max={Math.min(balance, 50_000)}
                            step={1}
                            value={i.stake}
                            onChange={(e) =>
                              setStake(
                                i.matchId,
                                Math.floor(Number(e.target.value)),
                              )
                            }
                            className="w-32 rounded-full border border-border bg-surface px-3 py-1.5 pr-8 text-right text-sm font-semibold text-fg outline-none focus:border-accent"
                            aria-label="Mise"
                          />
                          <span className="pointer-events-none absolute right-3">
                            <CoinIcon size={12} />
                          </span>
                        </span>
                      </label>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">Gains potentiels</span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-accentBright">
                          {fmtPoints(potential)}
                          <CoinIcon size={12} />
                        </span>
                      </div>
                      {errors[i.matchId] && (
                        <div className="text-xs text-danger">
                          {ERROR_LABEL[errors[i.matchId]] ?? errors[i.matchId]}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Footer */}
          {mode === 'individual' ? (
            <div className="space-y-3 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-fg/70">Mise totale</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 font-semibold">
                  {fmtPoints(total)}
                  <CoinIcon size={12} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold">Gains potentiels</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-accentBright">
                  {fmtPoints(totalGain)}
                  <CoinIcon size={12} />
                </span>
              </div>
              {overflow && (
                <p className="text-xs text-danger">
                  Total {fmtPoints(total)} dépasse votre solde{' '}
                  {fmtPoints(balance)}.
                </p>
              )}
              {someInvalid && (
                <p className="text-xs text-danger">
                  Au moins une mise est invalide (10 – 50 000).
                </p>
              )}
              {errors._ && <p className="text-xs text-danger">{errors._}</p>}
              <button
                onClick={submitIndividual}
                disabled={submitting || overflow || someInvalid}
                className="btn-primary w-full"
              >
                {submitting ? '…' : (
                  <>
                    Confirmer le pari
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
              <button
                onClick={clear}
                className="block w-full text-center text-xs text-fg/50 hover:text-fg/80"
              >
                Vider le panier
              </button>
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-fg/70">Mise</span>
                <span className="relative inline-flex items-center">
                  <input
                    type="number"
                    min={10}
                    max={Math.min(balance, 50_000)}
                    step={1}
                    value={comboStake}
                    onChange={(e) =>
                      setComboStake(Math.floor(Number(e.target.value)))
                    }
                    className="w-32 rounded-full border border-border bg-surface px-3 py-1.5 pr-8 text-right text-sm font-semibold text-fg outline-none focus:border-accent"
                    aria-label="Mise du combiné"
                  />
                  <span className="pointer-events-none absolute right-3">
                    <CoinIcon size={12} />
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg/70">Cote totale</span>
                <span className="rounded-full bg-white px-3 py-0.5 text-xs font-bold text-black">
                  {combinedOdds.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold">Gains potentiels</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-accentBright">
                  {fmtPoints(comboPotential)}
                  <CoinIcon size={12} />
                </span>
              </div>
              {!comboLegsOk && (
                <p className="text-xs text-danger">
                  Il faut au minimum 2 paris (max 10) pour un combiné.
                </p>
              )}
              {comboError && (
                <p className="text-xs text-danger">
                  {ERROR_LABEL[comboError] ?? `Erreur : ${comboError}`}
                </p>
              )}
              <button
                onClick={submitCombo}
                disabled={submitting || !comboStakeValid || !comboLegsOk}
                className="btn-primary w-full"
              >
                {submitting ? '…' : (
                  <>
                    Confirmer le pari
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
              <button
                onClick={clear}
                className="block w-full text-center text-xs text-fg/50 hover:text-fg/80"
              >
                Vider le panier
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
