import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import {
  cachedListMatches,
  cachedListPlayers,
  cachedListUserBets,
  cachedListUserCombos,
} from '@/lib/cache';
import type { Bet, ComboBet, BetStatus } from '@/lib/types';
import { SimpleBetCard } from '@/components/bets/SimpleBetCard';
import { ComboBetCard } from '@/components/bets/ComboBetCard';

type Filter = 'ALL' | 'PENDING' | 'WON' | 'LOST';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'PENDING', label: 'En cours' },
  { value: 'WON', label: 'Gagnés' },
  { value: 'LOST', label: 'Perdus' },
];

type Entry =
  | { kind: 'simple'; placedAt: string; bet: Bet }
  | { kind: 'combo'; placedAt: string; combo: ComboBet };

const matchesFilter = (status: BetStatus, f: Filter) => {
  if (f === 'ALL') return true;
  return status === f;
};

export default async function BetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const filter = (sp.filter ?? 'ALL').toUpperCase() as Filter;

  const session = await requireUser();
  const [bets, combos, allMatches, allPlayers] = await Promise.all([
    cachedListUserBets(session.sub),
    cachedListUserCombos(session.sub),
    cachedListMatches(),
    cachedListPlayers(),
  ]);

  const matches = Object.fromEntries(allMatches.map((m) => [m.id, m]));
  const players = Object.fromEntries(allPlayers.map((p) => [p.id, p]));

  // Combine simple + combo dans un même flux trié par date desc
  const entries: Entry[] = [
    ...bets
      .filter((b) => matchesFilter(b.status, filter))
      .map((bet): Entry => ({ kind: 'simple', placedAt: bet.placedAt, bet })),
    ...combos
      .filter((c) => matchesFilter(c.status, filter))
      .map((combo): Entry => ({ kind: 'combo', placedAt: combo.placedAt, combo })),
  ].sort(
    (a, b) =>
      new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
  );

  const buildHref = (next: Filter) =>
    next === 'ALL' ? '/history' : `/history?filter=${next}`;

  return (
    <div className="space-y-5">
      {/* Filtres de statut */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Link
              key={f.value}
              href={buildHref(f.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active
                  ? 'bg-accent text-black shadow-glow-soft'
                  : 'bg-white/8 text-fg/70 hover:bg-white/15 hover:text-fg'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="card text-sm text-fg/60">
          {filter === 'ALL'
            ? 'Tu n\'as pas encore placé de paris.'
            : 'Aucun pari ne correspond à ce filtre.'}{' '}
          <Link href="/matches" className="text-accent hover:underline">
            Voir les matchs →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {entries.map((e) =>
            e.kind === 'simple' ? (
              <SimpleBetCard
                key={`s-${e.bet.id}`}
                bet={e.bet}
                match={matches[e.bet.matchId] ?? null}
                picked={players[e.bet.pickedPlayerId] ?? null}
                playerA={
                  matches[e.bet.matchId]
                    ? players[matches[e.bet.matchId]!.playerAId] ?? null
                    : null
                }
                playerB={
                  matches[e.bet.matchId]
                    ? players[matches[e.bet.matchId]!.playerBId] ?? null
                    : null
                }
              />
            ) : (
              <ComboBetCard
                key={`c-${e.combo.id}`}
                combo={e.combo}
                matches={matches}
                players={players}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
