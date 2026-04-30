import { requireUser } from '@/lib/auth';
import { getLeaderboard } from '@/lib/leaderboard';
import { fmtPct, fmtPoints } from '@/lib/format';
import { AutoRefresh } from '@/components/AutoRefresh';

export default async function LeaderboardPage() {
  const session = await requireUser();
  const rows = await getLeaderboard();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classement</h1>
        <span className="text-xs text-white/50">
          Mise à jour automatique toutes les 10 s
        </span>
      </div>
      <AutoRefresh intervalMs={10_000} />
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Joueur</th>
              <th className="px-3 py-2 text-right">Solde</th>
              <th className="px-3 py-2 text-right">Total gagné</th>
              <th className="px-3 py-2 text-right">Total misé</th>
              <th className="px-3 py-2 text-center">V</th>
              <th className="px-3 py-2 text-center">D</th>
              <th className="px-3 py-2 text-right">Réussite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const me = r.userId === session.sub;
              return (
                <tr
                  key={r.userId}
                  className={`border-b border-border/50 ${
                    me ? 'bg-accent/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-bold">{r.rank}</td>
                  <td className="px-3 py-2">
                    {r.username}
                    {me && (
                      <span className="ml-2 text-xs text-accent">(vous)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmtPoints(r.balance)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-success">
                    {fmtPoints(r.totalWon)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmtPoints(r.totalStaked)}
                  </td>
                  <td className="px-3 py-2 text-center">{r.betsWon}</td>
                  <td className="px-3 py-2 text-center">{r.betsLost}</td>
                  <td className="px-3 py-2 text-right">
                    {fmtPct(r.successRate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
