'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Props {
  /** Heure de début du prochain match, format ISO. */
  startsAt: string;
  /** Lien vers le match. */
  href: string;
}

const fmt = (totalSec: number) => {
  if (totalSec <= 0) return '0,00';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  // Format "M,SS" (français)
  return `${m},${String(s).padStart(2, '0')}`;
};

/**
 * Pilule flottante en bas à droite : compte à rebours en MM,SS jusqu'au
 * prochain match. Disparait automatiquement quand le match a commencé.
 */
export function NextMatchCountdown({ startsAt, href }: Props) {
  const target = Date.parse(startsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.floor((target - now) / 1000));
  // Affiche seulement si le prochain match débute dans moins de 60 min
  if (remaining <= 0 || remaining > 60 * 60) return null;

  return (
    <Link
      href={href}
      aria-label="Prochain match — voir les détails"
      className="fixed right-4 z-30 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black shadow-glow"
      style={{ bottom: 'calc(5.5rem + var(--safe-bottom))' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 2h12M6 22h12" />
        <path d="M6 2c0 5 6 5 6 10s-6 5-6 10" />
        <path d="M18 2c0 5-6 5-6 10s6 5 6 10" />
      </svg>
      <span>{fmt(remaining)}</span>
    </Link>
  );
}
