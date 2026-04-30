import { requireUser } from '@/lib/auth';
import { listMatches } from '@/lib/matches';
import { listPlayers } from '@/lib/players';
import { MatchCard } from '@/components/MatchCard';

export default async function MatchesPage() {
  await requireUser();
  const [matches, players] = await Promise.all([
    listMatches(),
    listPlayers(),
  ]);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Matchs</h1>
      {matches.length === 0 ? (
        <div className="card text-sm text-white/60">
          Aucun match programmé pour l'instant.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {matches.map((m) => {
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
