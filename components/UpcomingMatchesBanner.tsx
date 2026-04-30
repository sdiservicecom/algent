import Link from 'next/link';
import type { CSSProperties } from 'react';
import { fmtDateTime, fmtPlayerName } from '@/lib/format';
import type { Match, MatchStatus, Player } from '@/lib/types';

interface Props {
  matches: Match[];
  players: Record<string, Player>;
}

const UPCOMING_STATUSES: MatchStatus[] = [
  'SCHEDULED',
  'OPEN_FOR_BETS',
  'LOCKED',
];

const STATUS_PILL: Record<string, string> = {
  SCHEDULED: 'bg-fg/10 text-fg/70',
  OPEN_FOR_BETS: 'bg-success/20 text-success',
  LOCKED: 'bg-yellow-500/20 text-yellow-400',
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'À venir',
  OPEN_FOR_BETS: 'Ouvert',
  LOCKED: 'Verrouillé',
};

export function UpcomingMatchesBanner({ matches, players }: Props) {
  const now = Date.now();
  const upcoming = matches
    .filter(
      (m) =>
        UPCOMING_STATUSES.includes(m.status) &&
        new Date(m.startsAt).getTime() > now - 30 * 60 * 1000,
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, 12);

  if (upcoming.length === 0) return null;

  // On garde uniquement les items pour lesquels les deux joueurs sont
  // connus (les autres seraient affichés "?" et casseraient la lecture).
  const items = upcoming
    .map((m) => {
      const pa = players[m.playerAId];
      const pb = players[m.playerBId];
      if (!pa || !pb) return null;
      return {
        id: m.id,
        status: m.status,
        label: `${fmtPlayerName(pa)} vs ${fmtPlayerName(pb)}`,
        time: fmtDateTime(m.startsAt),
      };
    })
    .filter(<T,>(v: T | null): v is T => v != null);

  if (items.length === 0) return null;

  // Vitesse: ~6s visibles par item, plancher à 25s pour rester lisible
  // même avec un seul match.
  const duration = Math.max(25, items.length * 6);
  const styleVar = {
    ['--ticker-duration' as string]: `${duration}s`,
  } as CSSProperties;

  return (
    <div className="ticker border-b border-border bg-fg/5">
      <div className="mx-auto max-w-6xl overflow-hidden px-3 py-2 text-xs sm:px-4">
        <div
          className="ticker-track whitespace-nowrap"
          style={styleVar}
          role="marquee"
          aria-label="Prochains matchs"
        >
          {/* Contenu dupliqué pour boucler proprement */}
          {[...items, ...items].map((it, idx) => (
            <Link
              key={`${it.id}-${idx}`}
              href={`/matches/${it.id}`}
              className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 transition hover:border-accent"
            >
              <span
                className={`pill ${STATUS_PILL[it.status] ?? 'bg-fg/10 text-fg/70'}`}
              >
                {STATUS_LABEL[it.status] ?? it.status}
              </span>
              <span className="font-medium">{it.label}</span>
              <span className="text-fg/50">{it.time}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
