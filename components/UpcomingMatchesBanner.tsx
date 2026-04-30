import Link from 'next/link';
import { fmtDateTime, fmtPlayerName } from '@/lib/format';
import type { Match, Player } from '@/lib/types';

interface Props {
  matches: Match[];
  players: Record<string, Player>;
}

const UPCOMING_STATUSES: Match['status'][] = [
  'SCHEDULED',
  'OPEN_FOR_BETS',
  'LOCKED',
];

const STATUS_PILL: Record<string, string> = {
  SCHEDULED: 'bg-white/10 text-white/70',
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
    .slice(0, 8);

  if (upcoming.length === 0) return null;

  return (
    <div className="border-b border-border bg-bg/60">
      <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-2 text-xs">
        <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
          À venir
        </span>
        {upcoming.map((m) => {
          const pa = players[m.playerAId];
          const pb = players[m.playerBId];
          if (!pa || !pb) return null;
          return (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 transition hover:border-accent"
            >
              <span
                className={`pill ${STATUS_PILL[m.status] ?? 'bg-white/10 text-white/70'}`}
              >
                {STATUS_LABEL[m.status] ?? m.status}
              </span>
              <span className="font-medium">
                {fmtPlayerName(pa)} <span className="text-white/40">vs</span>{' '}
                {fmtPlayerName(pb)}
              </span>
              <span className="text-white/50">{fmtDateTime(m.startsAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
