import Link from 'next/link';
import { MatchStatus } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';

const STATUS_LABEL: Record<MatchStatus, { label: string; color: string }> = {
  SCHEDULED: { label: 'À venir', color: 'bg-white/10 text-white/70' },
  OPEN_FOR_BETS: { label: 'Ouvert', color: 'bg-success/20 text-success' },
  LOCKED: { label: 'Verrouillé', color: 'bg-yellow-500/20 text-yellow-400' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-yellow-500/20 text-yellow-400' },
  FINISHED: { label: 'Terminé', color: 'bg-white/10 text-white/70' },
  SETTLED: { label: 'Réglé', color: 'bg-accent/20 text-accent' },
  CANCELLED: { label: 'Annulé', color: 'bg-danger/20 text-danger' },
};

export default async function MatchesPage() {
  await requireUser();
  const matches = await prisma.match.findMany({
    include: { playerA: true, playerB: true, winner: true },
    orderBy: { startsAt: 'asc' },
  });

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
            const total = m.totalStakeA + m.totalStakeB;
            const ratioA = total > 0 ? m.totalStakeA / total : 0.5;
            const status = STATUS_LABEL[m.status];
            return (
              <li key={m.id} className="card">
                <div className="flex items-center justify-between">
                  <span className={`pill ${status.color}`}>{status.label}</span>
                  <span className="text-xs text-white/50">
                    {fmtDateTime(m.startsAt)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold">
                      {m.playerA.firstName} {m.playerA.lastName}
                    </div>
                    <div className="text-xs text-white/50">
                      Seed #{m.playerA.seed}
                    </div>
                  </div>
                  <div className="px-3 text-xs text-white/50">vs</div>
                  <div className="flex-1 text-right">
                    <div className="font-semibold">
                      {m.playerB.firstName} {m.playerB.lastName}
                    </div>
                    <div className="text-xs text-white/50">
                      Seed #{m.playerB.seed}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="rounded-md border border-border bg-bg/50 p-2">
                    <div className="text-xs text-white/50">Cote A</div>
                    <div className="font-bold text-accent">
                      {fmtOdds(Number(m.oddsA))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-bg/50 p-2">
                    <div className="text-xs text-white/50">Cote B</div>
                    <div className="font-bold text-accent">
                      {fmtOdds(Number(m.oddsB))}
                    </div>
                  </div>
                </div>

                {total > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-white/50">
                      <span>{fmtPoints(m.totalStakeA)} pts</span>
                      <span>{fmtPoints(m.totalStakeB)} pts</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${ratioA * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {m.status === MatchStatus.SETTLED && m.winner && (
                  <div className="mt-3 text-sm">
                    Vainqueur :{' '}
                    <span className="font-semibold text-success">
                      {m.winner.firstName} {m.winner.lastName}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Link
                    href={`/matches/${m.id}`}
                    className={
                      m.status === MatchStatus.OPEN_FOR_BETS
                        ? 'btn-primary'
                        : 'btn-secondary'
                    }
                  >
                    {m.status === MatchStatus.OPEN_FOR_BETS
                      ? 'Parier'
                      : 'Détails'}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
