import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import {
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { MATCH_ROUNDS, type Match, type MatchRound } from '@/lib/types';
import { RoundSelect } from '@/components/bracket/RoundSelect';
import { BracketMatchCard } from '@/components/bracket/BracketMatchCard';

// Libellés "longs" pour le dropdown (la maquette dit "Huitième de finale" etc.)
const ROUND_LABEL_LONG: Record<MatchRound, string> = {
  R32: '16e de finale',
  R16: 'Huitième de finale',
  QF: 'Quart de finale',
  SF: 'Demi finale',
  FINAL: 'Finale',
};

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;

  const [matches, players] = await Promise.all([
    listMatches(),
    listPlayers(),
  ]);
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  // Regroupe par phase
  const byRound = new Map<MatchRound, Match[]>();
  for (const m of matches) {
    if (!m.round) continue;
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  for (const [r, list] of byRound) {
    list.sort((a, b) => {
      const sa = a.bracketSlot ?? 9999;
      const sb = b.bracketSlot ?? 9999;
      if (sa !== sb) return sa - sb;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
    byRound.set(r, list);
  }

  // Liste des phases proposées dans le select : on n'inclut que celles qui
  // contiennent au moins un match ; à défaut on garde l'ordre canonique
  // pour donner un état vide explicite.
  const visibleRounds = MATCH_ROUNDS.filter((r) => byRound.has(r));
  const options = visibleRounds.length > 0 ? visibleRounds : MATCH_ROUNDS;

  // Round actif : URL > premier disponible > premier de l'ordre canonique
  const requested = (sp.round ?? '').toUpperCase() as MatchRound;
  const active: MatchRound = (options.includes(requested)
    ? requested
    : options[0]) as MatchRound;
  const list = byRound.get(active) ?? [];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <h1 className="text-xl font-bold">Bracket</h1>
      </header>

      <RoundSelect
        rounds={options.map((r) => ({ value: r, label: ROUND_LABEL_LONG[r] }))}
        active={active}
      />

      {list.length === 0 ? (
        <div className="card text-sm text-fg/60">
          Aucun match pour cette phase pour l'instant.
          {session && (
            <>
              {' '}
              <Link href="/admin/matches" className="text-accent hover:underline">
                Configurer
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-4">
          {list.map((m) => {
            const pa = playersById[m.playerAId];
            const pb = playersById[m.playerBId];
            if (!pa || !pb) return null;
            return (
              <BracketMatchCard
                key={m.id}
                match={m}
                playerA={pa}
                playerB={pb}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
