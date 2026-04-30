import { requireUser, getCurrentUser } from '@/lib/auth';
import { listUserBets } from '@/lib/bets';
import { listUserCombos } from '@/lib/combos';
import { listUserTransactions } from '@/lib/wallet';
import { listMatches } from '@/lib/matches';
import { fmtPct, fmtPoints } from '@/lib/format';
import { MATCH_ROUND_LABEL, type MatchRound } from '@/lib/types';
import { Sparkline } from '@/components/Sparkline';

export default async function StatsPage() {
  await requireUser();
  const user = await getCurrentUser();
  if (!user) return null;

  const [bets, combos, txs, matches] = await Promise.all([
    listUserBets(user.id),
    listUserCombos(user.id),
    listUserTransactions(user.id, 500),
    listMatches(),
  ]);
  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));

  const settled = bets.filter(
    (b) => b.status === 'WON' || b.status === 'LOST',
  );
  const won = settled.filter((b) => b.status === 'WON');
  const lost = settled.filter((b) => b.status === 'LOST');
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalWon = won.reduce((s, b) => s + (b.payout ?? 0), 0);
  const profit = totalWon - totalStaked;
  const roi = totalStaked > 0 ? profit / totalStaked : 0;
  const successRate =
    settled.length > 0 ? won.length / settled.length : 0;

  // Stats par phase
  const byRound = new Map<MatchRound | 'NONE', { won: number; lost: number }>();
  for (const b of settled) {
    const m = matchById[b.matchId];
    const r = (m?.round ?? 'NONE') as MatchRound | 'NONE';
    const slot = byRound.get(r) ?? { won: 0, lost: 0 };
    if (b.status === 'WON') slot.won++;
    else slot.lost++;
    byRound.set(r, slot);
  }

  // Joueur préféré (le plus pari sur lui)
  const pickCount = new Map<string, number>();
  for (const b of bets) {
    pickCount.set(b.pickedPlayerId, (pickCount.get(b.pickedPlayerId) ?? 0) + 1);
  }
  const fav = [...pickCount.entries()].sort((a, b) => b[1] - a[1])[0];

  // Courbe de solde dans le temps : on prend balanceAfter de chaque tx en
  // ordre chronologique
  const balanceSeries = txs
    .slice()
    .reverse()
    .map((t) => t.balanceAfter);
  if (balanceSeries.length === 0) balanceSeries.push(user.balance);

  const comboSettled = combos.filter(
    (c) => c.status === 'WON' || c.status === 'LOST',
  );
  const comboWon = comboSettled.filter((c) => c.status === 'WON').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mes statistiques</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card">
          <div className="text-xs uppercase text-fg/50">Solde</div>
          <div className="mt-1 text-2xl font-bold">
            {fmtPoints(user.balance)} pts
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-fg/50">ROI</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              roi >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {totalStaked > 0
              ? `${roi >= 0 ? '+' : ''}${(roi * 100).toFixed(1)}%`
              : '—'}
          </div>
          <div className="text-xs text-fg/50">
            sur {fmtPoints(totalStaked)} pts misés
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-fg/50">Profit net</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              profit >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {profit >= 0 ? '+' : ''}
            {fmtPoints(profit)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-fg/50">Réussite</div>
          <div className="mt-1 text-2xl font-bold">
            {settled.length > 0 ? fmtPct(successRate) : '—'}
          </div>
          <div className="text-xs text-fg/50">
            {won.length}V / {lost.length}D
          </div>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Solde dans le temps</h2>
        {balanceSeries.length < 2 ? (
          <p className="text-sm text-fg/60">
            Pas encore assez de transactions pour tracer une courbe.
          </p>
        ) : (
          <Sparkline values={balanceSeries} width={720} height={120} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Réussite par phase</h2>
          {byRound.size === 0 ? (
            <p className="text-sm text-fg/60">
              Aucun pari réglé pour l'instant.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...byRound.entries()].map(([round, stats]) => {
                const total = stats.won + stats.lost;
                const rate = total > 0 ? stats.won / total : 0;
                return (
                  <li
                    key={round}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {round === 'NONE'
                        ? 'Hors bracket'
                        : MATCH_ROUND_LABEL[round as MatchRound]}
                    </span>
                    <span className="text-fg/60">
                      {stats.won}V / {stats.lost}D ·{' '}
                      <span
                        className={
                          rate >= 0.5 ? 'text-success' : 'text-danger'
                        }
                      >
                        {fmtPct(rate)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Combinés</h2>
          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-fg/60">Total combinés</span>
              <span className="font-medium">{combos.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg/60">Réglés</span>
              <span className="font-medium">{comboSettled.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg/60">Gagnés</span>
              <span className="font-medium text-success">{comboWon}</span>
            </div>
          </div>
        </section>
      </div>

      {fav && (
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">Joueur fétiche</h2>
          <p className="text-sm text-fg/70">
            Tu as parié <span className="font-semibold">{fav[1]} fois</span> sur
            le joueur <code className="font-mono text-xs">{fav[0]}</code>.
          </p>
        </section>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
