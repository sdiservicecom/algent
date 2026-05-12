import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import {
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { MatchCard } from '@/components/MatchCard';
import {
  MATCH_ROUNDS,
  MATCH_ROUND_LABEL,
  type MatchRound,
  type MatchStatus,
} from '@/lib/types';

const STATUS_FILTERS: Array<{ value: MatchStatus | 'ALL'; label: string; icon: string }> = [
  { value: 'ALL', label: 'Tous', icon: '📍' },
  { value: 'IN_PROGRESS', label: 'En cours', icon: '🔴' },
  { value: 'OPEN_FOR_BETS', label: 'Ouverts', icon: '⭐' },
  { value: 'SETTLED', label: 'Réglés', icon: '✓' },
];

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; round?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const statusFilter = (sp.status ?? 'ALL') as MatchStatus | 'ALL';
  const roundFilter = (sp.round ?? 'ALL') as MatchRound | 'ALL';

  const [matches, players] = await Promise.all([
    listMatches(),
    listPlayers(),
  ]);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const filtered = matches.filter((m) => {
    if (statusFilter === 'IN_PROGRESS') {
      if (m.status !== 'IN_PROGRESS' && m.status !== 'LOCKED') return false;
    } else if (statusFilter !== 'ALL' && m.status !== statusFilter) {
      return false;
    }
    if (roundFilter !== 'ALL' && m.round !== roundFilter) return false;
    return true;
  });

  // Sépare "live" et "à venir" pour la mise en page mobile
  const live = filtered.filter(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'LOCKED',
  );
  const upcoming = filtered.filter(
    (m) => m.status !== 'IN_PROGRESS' && m.status !== 'LOCKED',
  );

  const buildHref = (next: { status?: string; round?: string }) => {
    const params = new URLSearchParams();
    const status = next.status ?? sp.status ?? 'ALL';
    const round = next.round ?? sp.round ?? 'ALL';
    if (status !== 'ALL') params.set('status', status);
    if (round !== 'ALL') params.set('round', round);
    const q = params.toString();
    return q ? `/matches?${q}` : '/matches';
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matchs</h1>
      </header>

      {/* Filtres status */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {STATUS_FILTERS.map((f) => {
          const active =
            statusFilter === f.value ||
            (f.value === 'IN_PROGRESS' && statusFilter === ('LOCKED' as MatchStatus));
          return (
            <Link
              key={f.value}
              href={buildHref({ status: f.value })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-accent text-black'
                  : 'bg-white/8 text-fg/70 hover:bg-white/15 hover:text-fg'
              }`}
            >
              <span aria-hidden>{f.icon}</span>
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Filtres phase */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-xs">
        <Link
          href={buildHref({ round: 'ALL' })}
          className={`shrink-0 rounded-full px-3 py-1 transition ${
            roundFilter === 'ALL'
              ? 'bg-accent/15 text-accent'
              : 'bg-white/5 text-fg/60 hover:text-fg'
          }`}
        >
          Toutes phases
        </Link>
        {MATCH_ROUNDS.map((r) => {
          const active = roundFilter === r;
          return (
            <Link
              key={r}
              href={buildHref({ round: r })}
              className={`shrink-0 rounded-full px-3 py-1 transition ${
                active
                  ? 'bg-accent/15 text-accent'
                  : 'bg-white/5 text-fg/60 hover:text-fg'
              }`}
            >
              {MATCH_ROUND_LABEL[r]}
            </Link>
          );
        })}
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg/70">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-danger" aria-hidden />
            Événement en cours
          </h2>
          <ul className="grid gap-3">
            {live.map((m) => {
              const pa = playerMap[m.playerAId];
              const pb = playerMap[m.playerBId];
              const winner = m.winnerId ? (playerMap[m.winnerId] ?? null) : null;
              if (!pa || !pb) return null;
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  pa={pa}
                  pb={pb}
                  winner={winner}
                  viewerUserId={session.sub}
                />
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg/70">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 10h18" />
          </svg>
          Match à venir
        </h2>
        {upcoming.length === 0 ? (
          <div className="card text-sm text-fg/60">
            Aucun match ne correspond à ce filtre.
          </div>
        ) : (
          <ul className="grid gap-3">
            {upcoming.map((m) => {
              const pa = playerMap[m.playerAId];
              const pb = playerMap[m.playerBId];
              const winner = m.winnerId ? (playerMap[m.winnerId] ?? null) : null;
              if (!pa || !pb) return null;
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  pa={pa}
                  pb={pb}
                  winner={winner}
                  viewerUserId={session.sub}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
