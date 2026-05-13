'use client';

import { useState, useTransition } from 'react';

interface Props {
  matchId: string;
  initialScoreA: number;
  initialScoreB: number;
  initialOddsA: number;
  initialOddsB: number;
  labelA: string;
  labelB: string;
  /** Server action POST {matchId, scoreA, scoreB}, recalcule les cotes. */
  setScoreAction: (formData: FormData) => Promise<void>;
}

const fmtOdds = (o: number) => o.toFixed(2);

/**
 * Live Tracker : interface compacte pour ajouter des points en direct
 * pendant un match. Les +/- mettent à jour le score local et postent
 * sur la server action après chaque clic (debounce via transition).
 *
 * Les cotes recalculées par le serveur sont reflétées au prochain
 * rafraichissement de la page (via revalidatePath dans l'action) — on
 * conserve donc l'oddsA/B initial pour l'affichage, en attendant.
 */
export function LiveTracker({
  matchId,
  initialScoreA,
  initialScoreB,
  initialOddsA,
  initialOddsB,
  labelA,
  labelB,
  setScoreAction,
}: Props) {
  const [scoreA, setScoreA] = useState(initialScoreA);
  const [scoreB, setScoreB] = useState(initialScoreB);
  const [pending, startTransition] = useTransition();

  const sync = (nextA: number, nextB: number) => {
    setScoreA(nextA);
    setScoreB(nextB);
    const fd = new FormData();
    fd.set('id', matchId);
    fd.set('scoreA', String(nextA));
    fd.set('scoreB', String(nextB));
    startTransition(() => {
      setScoreAction(fd);
    });
  };

  const bump = (side: 'a' | 'b', delta: number) => {
    const nextA = side === 'a' ? Math.max(0, scoreA + delta) : scoreA;
    const nextB = side === 'b' ? Math.max(0, scoreB + delta) : scoreB;
    sync(nextA, nextB);
  };

  const reset = () => sync(0, 0);

  return (
    <section className="card space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-danger" aria-hidden />
          Live tracker
        </h2>
        <span className="text-xs text-fg/55">
          {pending ? 'Sauvegarde…' : 'Synchro auto'}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Side
          label={labelA}
          score={scoreA}
          odds={initialOddsA}
          onPlus={() => bump('a', +1)}
          onMinus={() => bump('a', -1)}
        />
        <Side
          label={labelB}
          score={scoreB}
          odds={initialOddsB}
          onPlus={() => bump('b', +1)}
          onMinus={() => bump('b', -1)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={reset}
          className="btn-ghost text-xs"
        >
          Remettre à 0-0
        </button>
        <p className="text-xs text-fg/55">
          Les cotes se recalculent à chaque point ajouté.
        </p>
      </div>
    </section>
  );
}

function Side({
  label,
  score,
  odds,
  onPlus,
  onMinus,
}: {
  label: string;
  score: number;
  odds: number;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg/40 p-3">
      <div className="mb-1 truncate text-sm font-semibold">{label}</div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-3xl font-bold">{score}</span>
        <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-0.5 text-xs font-bold text-black">
          {fmtOdds(odds)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMinus}
          aria-label="Retirer un point"
          className="flex-1 rounded-full border border-border bg-white/5 px-3 py-2 text-lg font-bold text-fg/70 hover:bg-white/10"
        >
          −
        </button>
        <button
          type="button"
          onClick={onPlus}
          aria-label="Ajouter un point"
          className="flex-1 rounded-full bg-accent px-3 py-2 text-lg font-bold text-black hover:bg-accentBright"
        >
          +1
        </button>
      </div>
    </div>
  );
}
