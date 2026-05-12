'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtPoints } from '@/lib/format';
import { CoinIcon } from './CoinIcon';

interface Props {
  initial: { received: boolean; amount: number | null };
}

/**
 * Bouton "Récupérer le bonus quotidien". POST sur /api/wallet/claim-bonus
 * qui crédite +100 pts une fois par jour. Si déjà reçu, on bascule en
 * variante "Bonus du jour reçu" (vert).
 */
export function BonusCTA({ initial }: Props) {
  const router = useRouter();
  const [received, setReceived] = useState(initial.received);
  const [amount, setAmount] = useState(initial.amount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    if (received || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/claim-bonus', { method: 'POST' });
      if (res.status === 409) {
        // Déjà reçu (peut arriver si distribué par le cron entre temps)
        setReceived(true);
        router.refresh();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'NETWORK');
        return;
      }
      const data = (await res.json()) as { ok: true; amount: number };
      setReceived(true);
      setAmount(data.amount);
      router.refresh();
    } catch {
      setError('NETWORK');
    } finally {
      setSubmitting(false);
    }
  };

  if (received) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-success/15 px-4 py-3 text-sm font-semibold text-success">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
        Bonus quotidien reçu&nbsp;
        {amount != null && (
          <span className="inline-flex items-center gap-1">
            (+{fmtPoints(amount)} <CoinIcon size={12} />)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={claim}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coin px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Récupération…' : 'Récupérer le bonus quotidien'}
        {!submitting && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error === 'NETWORK'
            ? 'Erreur réseau, réessaie.'
            : `Erreur: ${error}`}
        </p>
      )}
    </div>
  );
}
