import { listMatches } from '@/lib/matches';
import { listPlayers } from '@/lib/players';
import { listUsers } from '@/lib/users';
import { fmtPoints } from '@/lib/format';

export default async function AdminHome() {
  const [users, players, matches] = await Promise.all([
    listUsers(),
    listPlayers(),
    listMatches(),
  ]);

  let totalStaked = 0;
  for (const m of matches) totalStaked += m.totalStakeA + m.totalStakeB;

  const cards = [
    { label: 'Utilisateurs', value: users.filter((u) => u.role === 'USER').length },
    { label: 'Joueurs', value: players.length },
    { label: 'Matchs', value: matches.length },
    {
      label: 'Ouverts aux paris',
      value: matches.filter((m) => m.status === 'OPEN_FOR_BETS').length,
    },
    {
      label: 'Réglés',
      value: matches.filter((m) => m.status === 'SETTLED').length,
    },
    { label: 'Total misé (pts)', value: fmtPoints(totalStaked) },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Vue d'ensemble</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="text-xs uppercase text-white/50">{c.label}</div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
