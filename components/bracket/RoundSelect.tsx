'use client';

import { useRouter } from 'next/navigation';

interface Props {
  rounds: Array<{ value: string; label: string }>;
  active: string;
}

/**
 * Dropdown des phases du bracket. Update l'URL `?round=…` pour rester
 * partageable et fonctionner sans JS (SSR).
 */
export function RoundSelect({ rounds, active }: Props) {
  const router = useRouter();
  return (
    <div className="relative">
      <select
        value={active}
        onChange={(e) => {
          const next = e.target.value;
          router.push(`/bracket?round=${encodeURIComponent(next)}`);
        }}
        className="w-full appearance-none rounded-full border border-border bg-surface px-5 py-3 pr-12 text-sm font-semibold text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        aria-label="Choisir la phase"
      >
        {rounds.map((r) => (
          <option key={r.value} value={r.value} className="bg-surface text-fg">
            {r.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-fg/60"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
