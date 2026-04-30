'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBasket } from './BasketContext';
import { fmtPoints } from '@/lib/format';

const ERROR_LABEL: Record<string, string> = {
  STAKE_OUT_OF_BOUNDS: 'Mise hors limites (10 – 50 000).',
  MATCH_NOT_OPEN: 'Match plus ouvert.',
  MATCH_STARTED: 'Match déjà commencé.',
  INVALID_PLAYER: 'Joueur invalide.',
  BET_ALREADY_PLACED: 'Pari déjà existant pour ce match.',
  INSUFFICIENT_BALANCE: 'Solde insuffisant.',
  MATCH_NOT_FOUND: 'Match introuvable.',
};

export function FloatingBetBasket({ balance }: { balance: number }) {
  const { items, remove, setStake, clear } = useBasket();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  if (items.length === 0) return null;

  const total = items.reduce((s, i) => s + (Number(i.stake) || 0), 0);
  const totalGain = items.reduce(
    (s, i) => s + Math.floor((Number(i.stake) || 0) * i.oddsAtAdd),
    0,
  );
  const overflow = total > balance;
  const someInvalid = items.some(
    (i) => !Number.isFinite(i.stake) || i.stake < 10 || i.stake > 50_000,
  );

  const submit = async () => {
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="card flex max-h-[80vh] w-[min(420px,92vw)] flex-col gap-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Mes paris ({items.length})</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-white/60 hover:text-white"
              aria-label="Fermer le panier"
            >
              ✕
            </button>
          </div>

          <ul className="flex-1 space-y-2 overflow-y-auto">
            {items.map((i) => (
              <li
                key={i.matchId}
                className="rounded-md border border-border bg-bg/40 p-2"
              >
                <div className="truncate text-xs text-white/60">
                  {i.matchLabel}
                </div>
                <div className="truncate font-medium">
                  {i.pickLabel}{' '}
                  <span className="text-accent">
                    @ {i.oddsAtAdd.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={Math.min(balance, 50_000)}
                    step={1}
                    value={i.stake}
                    onChange={(e) =>
                      setStake(i.matchId, Math.floor(Number(e.target.value)))
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
                  {fmtPoints(Math.floor((Number(i.stake) || 0) * i.oddsAtAdd))}{' '}
                  pts
                </div>
                {errors[i.matchId] && (
                  <div className="mt-1 text-xs text-danger">
                    {ERROR_LABEL[errors[i.matchId]] ?? errors[i.matchId]}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-border pt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Total misé</span>
              <span className="font-semibold">{fmtPoints(total)} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Gain potentiel total</span>
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

          <div className="flex gap-2">
            <button onClick={clear} className="btn-secondary flex-1">
              Vider
            </button>
            <button
              onClick={submit}
              disabled={submitting || overflow || someInvalid}
              className="btn-primary flex-1"
            >
              {submitting ? '…' : 'Valider tout'}
            </button>
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
