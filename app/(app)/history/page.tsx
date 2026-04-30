import { requireUser } from '@/lib/auth';
import {
  cachedListMatches,
  cachedListPlayers,
  cachedListUserBets,
  cachedListUserCombos,
  cachedListUserTransactions,
} from '@/lib/cache';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';
import type { BetStatus } from '@/lib/types';

export default async function HistoryPage() {
  const session = await requireUser();
  const [bets, combos, txs, allMatches, allPlayers] = await Promise.all([
    cachedListUserBets(session.sub),
    cachedListUserCombos(session.sub),
    cachedListUserTransactions(session.sub, 50),
    cachedListMatches(),
    cachedListPlayers(),
  ]);

  const matches = Object.fromEntries(allMatches.map((m) => [m.id, m]));
  const players = Object.fromEntries(allPlayers.map((p) => [p.id, p]));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Mes paris</h1>
        {bets.length === 0 ? (
          <div className="card text-sm text-fg/60">Aucun pari.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
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
                  const m = matches[b.matchId];
                  const pa = m && players[m.playerAId];
                  const pb = m && players[m.playerBId];
                  const picked = players[b.pickedPlayerId];
                  return (
                    <tr key={b.id} className="border-b border-border/50">
                      <td data-label="Date" className="px-3 py-2 text-fg/60">
                        {fmtDateTime(b.placedAt)}
                      </td>
                      <td data-label="Match" className="px-3 py-2">
                        {pa?.firstName} vs {pb?.firstName}
                      </td>
                      <td data-label="Pari sur" className="px-3 py-2">
                        {picked
                          ? `${picked.firstName} ${picked.lastName}`
                          : '—'}
                      </td>
                      <td data-label="Cote" className="px-3 py-2 font-mono">
                        {fmtOdds(b.oddsAtBet)}
                      </td>
                      <td data-label="Mise" className="px-3 py-2">
                        {fmtPoints(b.stake)}
                      </td>
                      <td data-label="Gain" className="px-3 py-2">
                        {b.status === 'WON' ? (
                          <span className="text-success">
                            +{fmtPoints(b.payout ?? 0)}
                          </span>
                        ) : b.status === 'LOST' ? (
                          <span className="text-danger">
                            -{fmtPoints(b.stake)}
                          </span>
                        ) : (
                          <span className="text-fg/50">—</span>
                        )}
                      </td>
                      <td data-label="Statut" className="px-3 py-2">
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

      {combos.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Mes paris combinés</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {combos.map((c) => {
              const winningLegs = c.legs.filter((l) => l.status === 'WON').length;
              return (
                <li key={c.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="pill bg-accent/20 text-accent">
                        {c.legs.length} paris
                      </span>
                      <span className="font-mono text-accent">
                        × {c.combinedOdds.toFixed(2)}
                      </span>
                    </div>
                    <ComboStatusPill status={c.status} />
                  </div>
                  <div className="mt-2 text-xs text-fg/50">
                    {fmtDateTime(c.placedAt)}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {c.legs.map((leg, i) => {
                      const m = matches[leg.matchId];
                      const pa = m && players[m.playerAId];
                      const pb = m && players[m.playerBId];
                      const picked = players[leg.pickedPlayerId];
                      const tone =
                        leg.status === 'WON'
                          ? 'text-success'
                          : leg.status === 'LOST'
                            ? 'text-danger line-through'
                            : leg.status === 'CANCELLED'
                              ? 'text-yellow-400'
                              : 'text-fg/80';
                      return (
                        <li
                          key={i}
                          className={`flex items-center gap-2 ${tone}`}
                        >
                          <span className="text-xs text-fg/40">
                            {legStatusIcon(leg.status)}
                          </span>
                          <span className="truncate">
                            {picked
                              ? `${picked.firstName} ${picked.lastName}`
                              : '—'}
                          </span>
                          <span className="text-xs text-fg/50">
                            ({pa?.firstName} vs {pb?.firstName})
                          </span>
                          <span className="ml-auto font-mono text-xs">
                            {fmtOdds(leg.oddsAtBet)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm">
                    <span className="text-fg/60">
                      Mise{' '}
                      <span className="font-medium">
                        {fmtPoints(c.stake)}
                      </span>{' '}
                      → potentiel{' '}
                      <span className="font-medium text-success">
                        {fmtPoints(c.potentialWin)}
                      </span>
                    </span>
                    {c.status === 'PENDING' ? (
                      <span className="text-xs text-fg/50">
                        {winningLegs}/{c.legs.length} OK
                      </span>
                    ) : c.status === 'WON' ? (
                      <span className="font-semibold text-success">
                        +{fmtPoints(c.payout ?? 0)} pts
                      </span>
                    ) : c.status === 'LOST' ? (
                      <span className="font-semibold text-danger">
                        -{fmtPoints(c.stake)} pts
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-400">
                        Annulé
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-2xl font-bold">Transactions récentes</h2>
        <div className="card overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Solde après</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td data-label="Date" className="px-3 py-2 text-fg/60">
                    {fmtDateTime(t.createdAt)}
                  </td>
                  <td data-label="Type" className="px-3 py-2">{t.type}</td>
                  <td
                    data-label="Montant"
                    className={`px-3 py-2 font-mono ${
                      t.amount > 0
                        ? 'text-success'
                        : t.amount < 0
                          ? 'text-danger'
                          : 'text-fg/50'
                    }`}
                  >
                    {t.amount > 0 ? '+' : ''}
                    {fmtPoints(t.amount)}
                  </td>
                  <td data-label="Solde après" className="px-3 py-2 font-mono">
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

function ComboStatusPill({ status }: { status: BetStatus }) {
  const map: Record<BetStatus, { label: string; className: string }> = {
    PENDING: { label: 'En cours', className: 'bg-fg/10 text-fg/70' },
    WON: { label: 'Gagné', className: 'bg-success/20 text-success' },
    LOST: { label: 'Perdu', className: 'bg-danger/20 text-danger' },
    CANCELLED: {
      label: 'Annulé',
      className: 'bg-yellow-500/20 text-yellow-400',
    },
  };
  const m = map[status];
  return <span className={`pill ${m.className}`}>{m.label}</span>;
}

function legStatusIcon(s: BetStatus) {
  switch (s) {
    case 'WON':
      return '✓';
    case 'LOST':
      return '✕';
    case 'CANCELLED':
      return '⊘';
    default:
      return '·';
  }
}

function StatusPill({ status }: { status: BetStatus }) {
  const map: Record<BetStatus, { label: string; className: string }> = {
    PENDING: { label: 'En cours', className: 'bg-fg/10 text-fg/70' },
    WON: { label: 'Gagné', className: 'bg-success/20 text-success' },
    LOST: { label: 'Perdu', className: 'bg-danger/20 text-danger' },
    CANCELLED: {
      label: 'Annulé',
      className: 'bg-yellow-500/20 text-yellow-400',
    },
  };
  const m = map[status];
  return <span className={`pill ${m.className}`}>{m.label}</span>;
}

export const dynamic = 'force-dynamic';
