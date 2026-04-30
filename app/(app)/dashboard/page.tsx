import Link from 'next/link';
import { BetStatus } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasReceivedTodayBonus } from '@/lib/daily-bonus';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';
import { getLeaderboard } from '@/lib/leaderboard';

export default async function DashboardPage() {
  const session = await requireUser();
  const [user, activeBets, lastSettled, bonus, leaderboard] = await Promise.all(
    [
      prisma.user.findUnique({ where: { id: session.sub } }),
      prisma.bet.findMany({
        where: { userId: session.sub, status: BetStatus.PENDING },
        include: { match: { include: { playerA: true, playerB: true } } },
        orderBy: { placedAt: 'desc' },
      }),
      prisma.bet.findMany({
        where: {
          userId: session.sub,
          status: { in: [BetStatus.WON, BetStatus.LOST] },
        },
        include: { match: { include: { playerA: true, playerB: true } } },
        orderBy: { settledAt: 'desc' },
        take: 5,
      }),
      hasReceivedTodayBonus(session.sub),
      getLeaderboard(),
    ],
  );
  if (!user) return null;

  const myRank = leaderboard.find((r) => r.userId === session.sub);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase text-white/50">Solde</div>
          <div className="mt-2 text-3xl font-bold">
            {fmtPoints(user.balance)} pts
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-white/50">Bonus quotidien</div>
          <div className="mt-2 text-lg">
            {bonus.received ? (
              <span className="text-success">
                ✓ Reçu ({fmtPoints(bonus.amount ?? 0)} pts)
              </span>
            ) : (
              <span className="text-white/60">
                Pas encore distribué aujourd'hui
              </span>
            )}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-white/50">Classement</div>
          <div className="mt-2 text-3xl font-bold">
            {myRank ? `#${myRank.rank}` : '—'}
          </div>
          <div className="text-sm text-white/60">
            sur {leaderboard.length} joueurs
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Paris en cours</h2>
        {activeBets.length === 0 ? (
          <div className="card text-sm text-white/60">
            Aucun pari en cours.{' '}
            <Link href="/matches" className="text-accent hover:underline">
              Voir les matchs
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {activeBets.map((b) => {
              const picked =
                b.pickedPlayerId === b.match.playerAId
                  ? b.match.playerA
                  : b.match.playerB;
              return (
                <li key={b.id} className="card">
                  <div className="text-sm text-white/60">
                    {b.match.playerA.firstName} {b.match.playerA.lastName} vs{' '}
                    {b.match.playerB.firstName} {b.match.playerB.lastName}
                  </div>
                  <div className="mt-1 font-medium">
                    Pari sur {picked.firstName} {picked.lastName} @{' '}
                    {fmtOdds(Number(b.oddsAtBet))}
                  </div>
                  <div className="mt-1 text-sm">
                    Mise{' '}
                    <span className="font-medium">{fmtPoints(b.stake)}</span> →
                    gain potentiel{' '}
                    <span className="font-medium text-success">
                      {fmtPoints(b.potentialWin)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    Match : {fmtDateTime(b.match.startsAt)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Derniers résultats</h2>
        {lastSettled.length === 0 ? (
          <div className="card text-sm text-white/60">Pas encore de résultats.</div>
        ) : (
          <ul className="space-y-2">
            {lastSettled.map((b) => (
              <li
                key={b.id}
                className="card flex items-center justify-between text-sm"
              >
                <div>
                  <span className="text-white/60">
                    {b.match.playerA.firstName} vs {b.match.playerB.firstName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/60">
                    Mise {fmtPoints(b.stake)}
                  </span>
                  <span
                    className={
                      b.status === BetStatus.WON
                        ? 'pill bg-success/20 text-success'
                        : 'pill bg-danger/20 text-danger'
                    }
                  >
                    {b.status === BetStatus.WON
                      ? `+${fmtPoints(b.payout ?? 0)}`
                      : `-${fmtPoints(b.stake)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
