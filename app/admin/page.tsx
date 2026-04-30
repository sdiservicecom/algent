import { MatchStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fmtPoints } from '@/lib/format';

export default async function AdminHome() {
  const [users, players, matches, openMatches, settled, totalStaked] =
    await Promise.all([
      prisma.user.count({ where: { role: Role.USER } }),
      prisma.player.count(),
      prisma.match.count(),
      prisma.match.count({ where: { status: MatchStatus.OPEN_FOR_BETS } }),
      prisma.match.count({ where: { status: MatchStatus.SETTLED } }),
      prisma.bet.aggregate({ _sum: { stake: true } }),
    ]);

  const cards = [
    { label: 'Utilisateurs', value: users },
    { label: 'Joueurs', value: players },
    { label: 'Matchs', value: matches },
    { label: 'Ouverts aux paris', value: openMatches },
    { label: 'Réglés', value: settled },
    {
      label: 'Total misé (pts)',
      value: fmtPoints(totalStaked._sum.stake ?? 0),
    },
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
