import { requireUser } from '@/lib/auth';
import { cachedGetLeaderboard as getLeaderboard } from '@/lib/cache';
import { fmtPct, fmtPoints } from '@/lib/format';
import { AutoRefresh } from '@/components/AutoRefresh';

export default async function LeaderboardPage() {
  const session = await requireUser();
  const rows = await getLeaderboard();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classement</h1>
        <span className="text-xs text-fg/50">
          Mise à jour automatique toutes les 30 s
        </span>
      </div>
      <AutoRefresh intervalMs={30_000} />
      <div className="card overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
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
                  <td data-label="Rang" className="px-3 py-2 font-bold">
                    #{r.rank}
                  </td>
                  <td data-label="Joueur" className="px-3 py-2">
                    {r.username}
                    {me && (
                      <span className="ml-2 text-xs text-accent">(vous)</span>
                    )}
                  </td>
                  <td
                    data-label="Solde"
                    className="px-3 py-2 text-right font-mono"
                  >
                    {fmtPoints(r.balance)}
                  </td>
                  <td
                    data-label="Total gagné"
                    className="px-3 py-2 text-right font-mono text-success"
                  >
                    {fmtPoints(r.totalWon)}
                  </td>
                  <td
                    data-label="Total misé"
                    className="px-3 py-2 text-right font-mono"
                  >
                    {fmtPoints(r.totalStaked)}
                  </td>
                  <td data-label="Victoires" className="px-3 py-2 text-center">
                    {r.betsWon}
                  </td>
                  <td data-label="Défaites" className="px-3 py-2 text-center">
                    {r.betsLost}
                  </td>
                  <td
                    data-label="Réussite"
                    className="px-3 py-2 text-right"
                  >
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
