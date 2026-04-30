'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBasket } from './BasketContext';
import { fmtPoints } from '@/lib/format';

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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            matchId: i.matchId,
            pickedPlayerId: i.pickedPlayerId,
            stake: Math.floor(i.stake),
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
        headers: { 'content-type': 'application/json' },
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="card flex max-h-[80vh] w-[min(420px,92vw)] flex-col gap-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Mes paris ({items.length})</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-fg/60 hover:text-accent"
              aria-label="Fermer le panier"
            >
              ✕
            </button>
          </div>

          <div className="flex rounded-md border border-border bg-fg/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={`flex-1 rounded px-2 py-1 transition ${
                mode === 'individual'
                  ? 'bg-accent text-white'
                  : 'text-fg/60 hover:text-accent'
              }`}
            >
              Individuels
            </button>
            <button
              type="button"
              onClick={() => setMode('combo')}
              className={`flex-1 rounded px-2 py-1 transition ${
                mode === 'combo'
                  ? 'bg-accent text-white'
                  : 'text-fg/60 hover:text-accent'
              }`}
            >
              Combiné × {combinedOdds.toFixed(2)}
            </button>
          </div>

          <ul className="flex-1 space-y-2 overflow-y-auto">
            {items.map((i) => (
              <li
                key={i.matchId}
                className="rounded-md border border-border bg-fg/5 p-2"
              >
                <div className="truncate text-xs text-fg/60">
                  {i.matchLabel}
                </div>
                <div className="truncate font-medium">
                  {i.pickLabel}{' '}
                  <span className="text-accent">
                    @ {i.oddsAtAdd.toFixed(2)}
                  </span>
                </div>
                {mode === 'individual' && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
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
                        className="input"
                      />
                      <button
                        onClick={() => remove(i.matchId)}
                        className="btn-danger px-2"
                        aria-label="Retirer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-success">
                      Gain potentiel :{' '}
                      {fmtPoints(
                        Math.floor(
                          (Number(i.stake) || 0) * i.oddsAtAdd,
                        ),
                      )}{' '}
                      pts
                    </div>
                    {errors[i.matchId] && (
                      <div className="mt-1 text-xs text-danger">
                        {ERROR_LABEL[errors[i.matchId]] ?? errors[i.matchId]}
                      </div>
                    )}
                  </>
                )}
                {mode === 'combo' && (
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      onClick={() => remove(i.matchId)}
                      className="btn-secondary px-2 text-xs"
                      aria-label="Retirer du combiné"
                    >
                      Retirer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {mode === 'individual' ? (
            <div className="space-y-1 border-t border-border pt-2 text-sm">
              <div className="flex justify-between">
                <span className="text-fg/60">Total misé</span>
                <span className="font-semibold">{fmtPoints(total)} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg/60">Gain potentiel total</span>
                <span className="font-semibold text-success">
                  {fmtPoints(totalGain)} pts
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
              {errors._ && (
                <p className="text-xs text-danger">{errors._}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 border-t border-border pt-2 text-sm">
              <div className="flex justify-between">
                <span className="text-fg/60">Cote combinée</span>
                <span className="font-mono text-lg font-bold text-accent">
                  × {combinedOdds.toFixed(2)}
                </span>
              </div>
              <div>
                <label className="label" htmlFor="combo-stake">
                  Mise unique (10 – {fmtPoints(Math.min(balance, 50_000))})
                </label>
                <input
                  id="combo-stake"
                  type="number"
                  min={10}
                  max={Math.min(balance, 50_000)}
                  step={1}
                  value={comboStake}
                  onChange={(e) =>
                    setComboStake(Math.floor(Number(e.target.value)))
                  }
                  className="input"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-fg/60">Gain potentiel</span>
                <span className="font-semibold text-success">
                  {fmtPoints(comboPotential)} pts
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
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={clear} className="btn-secondary flex-1">
              Vider
            </button>
            {mode === 'individual' ? (
              <button
                onClick={submitIndividual}
                disabled={submitting || overflow || someInvalid}
                className="btn-primary flex-1"
              >
                {submitting ? '…' : 'Valider tout'}
              </button>
            ) : (
              <button
                onClick={submitCombo}
                disabled={submitting || !comboStakeValid || !comboLegsOk}
                className="btn-primary flex-1"
              >
                {submitting ? '…' : 'Valider le combiné'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="btn-primary shadow-2xl"
        >
          🎯 Mes paris ({items.length})
        </button>
      )}
    </div>
  );
}
