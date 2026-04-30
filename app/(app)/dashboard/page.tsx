import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUser } from '@/lib/users';
import { listUserBets } from '@/lib/bets';
import { getMatch } from '@/lib/matches';
import { getPlayer } from '@/lib/players';
import { hasReceivedTodayBonus } from '@/lib/daily-bonus';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import { getLeaderboard } from '@/lib/leaderboard';
import { pushIsConfigured } from '@/lib/push';
import { PushNotificationsToggle } from '@/components/PushNotificationsToggle';

export default async function DashboardPage() {
  const session = await requireUser();
  const [user, allBets, bonus, leaderboard] = await Promise.all([
    getUser(session.sub),
    listUserBets(session.sub),
    hasReceivedTodayBonus(session.sub),
    getLeaderboard(),
  ]);
  if (!user) return null;

  const activeBets = allBets.filter((b) => b.status === 'PENDING');
  const lastSettled = allBets
    .filter((b) => b.status === 'WON' || b.status === 'LOST')
    .slice(0, 5);

  // Hydrate matchs + joueurs
  const matchIds = Array.from(
    new Set([...activeBets, ...lastSettled].map((b) => b.matchId)),
  );
  const matches = Object.fromEntries(
    (await Promise.all(matchIds.map(getMatch)))
      .filter((m) => !!m)
      .map((m) => [m!.id, m!]),
  );
  const playerIds = Array.from(
    new Set(Object.values(matches).flatMap((m) => [m.playerAId, m.playerBId])),
  );
  const players = Object.fromEntries(
    (await Promise.all(playerIds.map(getPlayer)))
      .filter((p) => !!p)
      .map((p) => [p!.id, p!]),
  );

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

      {pushIsConfigured() && <PushNotificationsToggle />}

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
              const m = matches[b.matchId];
              if (!m) return null;
              const pa = players[m.playerAId];
              const pb = players[m.playerBId];
              const picked = players[b.pickedPlayerId];
              if (!pa || !pb || !picked) return null;
              return (
                <li key={b.id} className="card">
                  <div className="text-sm text-white/60">
                    {fmtPlayerName(pa)} vs {fmtPlayerName(pb)}
                  </div>
                  <div className="mt-1 font-medium">
                    Pari sur {fmtPlayerName(picked)} @ {fmtOdds(b.oddsAtBet)}
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
                    Match : {fmtDateTime(m.startsAt)}
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
          <div className="card text-sm text-white/60">
            Pas encore de résultats.
          </div>
        ) : (
          <ul className="space-y-2">
            {lastSettled.map((b) => {
              const m = matches[b.matchId];
              if (!m) return null;
              const pa = players[m.playerAId];
              const pb = players[m.playerBId];
              return (
                <li
                  key={b.id}
                  className="card flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="text-white/60">
                      {pa?.firstName} vs {pb?.firstName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/60">
                      Mise {fmtPoints(b.stake)}
                    </span>
                    <span
                      className={
                        b.status === 'WON'
                          ? 'pill bg-success/20 text-success'
                          : 'pill bg-danger/20 text-danger'
                      }
                    >
                      {b.status === 'WON'
                        ? `+${fmtPoints(b.payout ?? 0)}`
                        : `-${fmtPoints(b.stake)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
