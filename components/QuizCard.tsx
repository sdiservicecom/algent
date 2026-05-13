'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoinIcon } from './CoinIcon';
import { fmtPoints } from '@/lib/format';

export interface QuizPlayerOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  /** État initial côté serveur ('won' / 'lost' = déjà répondu, 'idle' = pas encore). */
  initialState: 'idle' | 'won' | 'lost';
  /** Tournoi déjà réglé ? Si non, on affiche un état "à venir". */
  tournamentSettled: boolean;
  /** Options proposées (incluant le bon, déjà mélangées côté serveur). */
  options: QuizPlayerOption[];
  /** Id du gagnant — utilisé en mode "déjà répondu" pour révéler la bonne réponse. */
  correctPlayerId: string | null;
  /** Récompense en points si la réponse est correcte. */
  reward: number;
}

const fmtName = (p: QuizPlayerOption) => `${p.firstName} ${p.lastName}`;

export function QuizCard({
  initialState,
  tournamentSettled,
  options,
  correctPlayerId,
  reward,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'won' | 'lost' | 'submitting'>(
    initialState,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(
    initialState === 'idle' ? null : correctPlayerId,
  );
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!picked || state !== 'idle') return;
    setState('submitting');
    setError(null);
    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pickedPlayerId: picked }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: 'won' | 'lost';
        correctPlayerId?: string;
        reason?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.reason ?? 'NETWORK');
        setState('idle');
        return;
      }
      setRevealed(data.correctPlayerId ?? correctPlayerId);
      setState(data.status === 'won' ? 'won' : 'lost');
      // Rafraichit le solde dans le header
      router.refresh();
    } catch {
      setError('NETWORK');
      setState('idle');
    }
  };

  return (
    <section className="rounded-3xl border border-accent/40 bg-surface/80 p-4">
      <div className="mb-2 flex items-center gap-2 text-fg/70">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-sm font-semibold">Question pour du pognon</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-coin/15 px-2 py-0.5 text-xs font-semibold text-coin">
          +{fmtPoints(reward)}
          <CoinIcon size={10} />
        </span>
      </div>
      <p className="mb-4 text-center text-base font-bold">
        Qui a gagné le dernier tournoi&nbsp;?
      </p>

      {!tournamentSettled ? (
        <p className="text-center text-sm text-fg/55">
          Le tournoi n'est pas encore terminé — la question s'activera dès qu'un
          champion sera désigné.
        </p>
      ) : state === 'won' || state === 'lost' ? (
        <div className="space-y-2">
          {options.map((p) => {
            const isCorrect = p.id === revealed;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-full border px-4 py-2 text-sm font-semibold ${
                  isCorrect
                    ? 'border-success bg-success/10 text-success'
                    : 'border-border bg-transparent text-fg/55'
                }`}
              >
                <span>{fmtName(p)}</span>
                {isCorrect && <span aria-hidden>🏆</span>}
              </div>
            );
          })}
          <div
            className={`mt-3 rounded-2xl px-4 py-3 text-center text-sm font-semibold ${
              state === 'won'
                ? 'bg-success/15 text-success'
                : 'bg-danger/15 text-danger'
            }`}
          >
            {state === 'won'
              ? `Bien joué ! +${fmtPoints(reward)} points crédités.`
              : 'Mauvaise réponse — sans regret pour cette fois.'}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {options.map((p) => {
              const active = picked === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPicked(p.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    active
                      ? 'border-accent bg-accent text-black'
                      : 'border-accent/60 text-accent hover:bg-accent/10'
                  }`}
                >
                  {fmtName(p)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!picked || state === 'submitting'}
            className="btn-primary w-full"
          >
            {state === 'submitting' ? 'Envoi…' : 'Confirmer ma réponse'}
            {state !== 'submitting' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          {error && (
            <p className="mt-2 text-xs text-danger" role="alert">
              {error === 'ALREADY_ANSWERED'
                ? 'Tu as déjà répondu — une seule tentative par tournoi.'
                : error === 'TOURNAMENT_NOT_SETTLED'
                  ? 'Le tournoi n\'est pas encore réglé.'
                  : 'Erreur réseau, réessaie.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
