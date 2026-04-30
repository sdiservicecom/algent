import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listMatches } from '@/lib/matches';
import { listPlayers } from '@/lib/players';
import { MatchCard } from '@/components/MatchCard';
import {
  MATCH_ROUNDS,
  MATCH_ROUND_LABEL,
  type MatchRound,
  type MatchStatus,
} from '@/lib/types';

const STATUS_FILTERS: Array<{ value: MatchStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'OPEN_FOR_BETS', label: 'Ouverts' },
  { value: 'SCHEDULED', label: 'À venir' },
  { value: 'LOCKED', label: 'Verrouillés' },
  { value: 'SETTLED', label: 'Réglés' },
  { value: 'CANCELLED', label: 'Annulés' },
];

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; round?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const statusFilter = (sp.status ?? 'ALL') as MatchStatus | 'ALL';
  const roundFilter = (sp.round ?? 'ALL') as MatchRound | 'ALL';

  const [matches, players] = await Promise.all([
    listMatches(),
    listPlayers(),
  ]);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const filtered = matches.filter((m) => {
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (roundFilter !== 'ALL' && m.round !== roundFilter) return false;
    return true;
  });

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Matchs</h1>

      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <Link
              key={f.value}
              href={buildHref({ status: f.value })}
              className={`rounded-full border px-3 py-1 transition ${
                active
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-white text-fg/70 hover:border-accent'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={buildHref({ round: 'ALL' })}
          className={`rounded-full border px-3 py-1 transition ${
            roundFilter === 'ALL'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-white text-fg/70 hover:border-accent'
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
              className={`rounded-full border px-3 py-1 transition ${
                active
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-white text-fg/70 hover:border-accent'
              }`}
            >
              {MATCH_ROUND_LABEL[r]}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-sm text-fg/60">
          Aucun match ne correspond à ce filtre.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((m) => {
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
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
