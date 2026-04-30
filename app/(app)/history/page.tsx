import { BetStatus } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';

export default async function HistoryPage() {
  const session = await requireUser();
  const [bets, txs] = await Promise.all([
    prisma.bet.findMany({
      where: { userId: session.sub },
      include: { match: { include: { playerA: true, playerB: true } } },
      orderBy: { placedAt: 'desc' },
    }),
    prisma.pointTransaction.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Mes paris</h1>
        {bets.length === 0 ? (
          <div className="card text-sm text-white/60">Aucun pari.</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">Pari sur</th>
                  <th className="px-3 py-2">Cote</th>
                  <th className="px-3 py-2">Mise</th>
                  <th className="px-3 py-2">Gain</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((b) => {
                  const picked =
                    b.pickedPlayerId === b.match.playerAId
                      ? b.match.playerA
                      : b.match.playerB;
                  return (
                    <tr key={b.id} className="border-b border-border/50">
                      <td className="px-3 py-2 text-white/60">
                        {fmtDateTime(b.placedAt)}
                      </td>
                      <td className="px-3 py-2">
                        {b.match.playerA.firstName} vs{' '}
                        {b.match.playerB.firstName}
                      </td>
                      <td className="px-3 py-2">
                        {picked.firstName} {picked.lastName}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {fmtOdds(Number(b.oddsAtBet))}
                      </td>
                      <td className="px-3 py-2">{fmtPoints(b.stake)}</td>
                      <td className="px-3 py-2">
                        {b.status === BetStatus.WON ? (
                          <span className="text-success">
                            +{fmtPoints(b.payout ?? 0)}
                          </span>
                        ) : b.status === BetStatus.LOST ? (
                          <span className="text-danger">
                            -{fmtPoints(b.stake)}
                          </span>
                        ) : (
                          <span className="text-white/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={b.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Transactions récentes</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Solde après</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="px-3 py-2 text-white/60">
                    {fmtDateTime(t.createdAt)}
                  </td>
                  <td className="px-3 py-2">{t.type}</td>
                  <td
                    className={`px-3 py-2 font-mono ${
                      t.amount > 0
                        ? 'text-success'
                        : t.amount < 0
                          ? 'text-danger'
                          : 'text-white/50'
                    }`}
                  >
                    {t.amount > 0 ? '+' : ''}
                    {fmtPoints(t.amount)}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {fmtPoints(t.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: BetStatus }) {
  const map: Record<BetStatus, { label: string; className: string }> = {
    PENDING: { label: 'En cours', className: 'bg-white/10 text-white/70' },
    WON: { label: 'Gagné', className: 'bg-success/20 text-success' },
    LOST: { label: 'Perdu', className: 'bg-danger/20 text-danger' },
    CANCELLED: { label: 'Annulé', className: 'bg-yellow-500/20 text-yellow-400' },
  };
  const m = map[status];
  return <span className={`pill ${m.className}`}>{m.label}</span>;
}

export const dynamic = 'force-dynamic';
