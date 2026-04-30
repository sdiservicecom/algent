import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { MatchStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelMatch, settleMatch, transitionMatchStatus } from '@/lib/matches';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';

async function open(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  await transitionMatchStatus(id, MatchStatus.OPEN_FOR_BETS);
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
}

async function lock(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  await transitionMatchStatus(id, MatchStatus.LOCKED);
  revalidatePath(`/admin/matches/${id}`);
}

async function settle(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  const winnerId = String(formData.get('winnerId'));
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) return;
  if (match.status !== MatchStatus.FINISHED) {
    if (match.status === MatchStatus.LOCKED) {
      await transitionMatchStatus(id, MatchStatus.IN_PROGRESS);
      await transitionMatchStatus(id, MatchStatus.FINISHED);
    } else if (match.status === MatchStatus.IN_PROGRESS) {
      await transitionMatchStatus(id, MatchStatus.FINISHED);
    } else if (match.status === MatchStatus.OPEN_FOR_BETS) {
      await transitionMatchStatus(id, MatchStatus.LOCKED);
      await transitionMatchStatus(id, MatchStatus.IN_PROGRESS);
      await transitionMatchStatus(id, MatchStatus.FINISHED);
    }
  }
  await settleMatch(id, winnerId);
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
  revalidatePath('/leaderboard');
}

async function cancel(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  await cancelMatch(id);
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
}

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [match, bets] = await Promise.all([
    prisma.match.findUnique({
      where: { id },
      include: { playerA: true, playerB: true, winner: true },
    }),
    prisma.bet.findMany({
      where: { matchId: id },
      include: { user: true },
      orderBy: { placedAt: 'asc' },
    }),
  ]);
  if (!match) notFound();

  return (
    <div className="space-y-6">
      <header className="card">
        <div className="text-xs uppercase text-white/50">
          {fmtDateTime(match.startsAt)} · {match.status}
        </div>
        <h1 className="mt-2 text-xl font-bold">
          {match.playerA.firstName} {match.playerA.lastName} vs{' '}
          {match.playerB.firstName} {match.playerB.lastName}
        </h1>
        <div className="mt-2 text-sm text-white/60">
          Cotes : {fmtOdds(Number(match.oddsA))} /{' '}
          {fmtOdds(Number(match.oddsB))} · Mises :{' '}
          {fmtPoints(match.totalStakeA)} / {fmtPoints(match.totalStakeB)}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {match.status === MatchStatus.SCHEDULED && (
          <form action={open}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-primary w-full" type="submit">
              Ouvrir aux paris
            </button>
          </form>
        )}
        {match.status === MatchStatus.OPEN_FOR_BETS && (
          <form action={lock}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-secondary w-full" type="submit">
              Verrouiller
            </button>
          </form>
        )}
        {!['SETTLED', 'CANCELLED'].includes(match.status) && (
          <form action={cancel}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-danger w-full" type="submit">
              Annuler le match
            </button>
          </form>
        )}
      </section>

      {match.status !== MatchStatus.SETTLED &&
        match.status !== MatchStatus.CANCELLED && (
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Saisir le vainqueur</h2>
            <form action={settle} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={match.id} />
              <div className="flex-1 min-w-[200px]">
                <label className="label">Vainqueur</label>
                <select name="winnerId" required className="input">
                  <option value="">—</option>
                  <option value={match.playerAId}>
                    {match.playerA.firstName} {match.playerA.lastName}
                  </option>
                  <option value={match.playerBId}>
                    {match.playerB.firstName} {match.playerB.lastName}
                  </option>
                </select>
              </div>
              <button className="btn-primary" type="submit">
                Valider et calculer les gains
              </button>
            </form>
          </section>
        )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Paris ({bets.length})
        </h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
                <th className="px-3 py-2">Joueur</th>
                <th className="px-3 py-2">Pari sur</th>
                <th className="px-3 py-2">Cote</th>
                <th className="px-3 py-2 text-right">Mise</th>
                <th className="px-3 py-2 text-right">Gain potentiel</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => {
                const picked =
                  b.pickedPlayerId === match.playerAId
                    ? match.playerA
                    : match.playerB;
                return (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="px-3 py-2">{b.user.username}</td>
                    <td className="px-3 py-2">
                      {picked.firstName} {picked.lastName}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {fmtOdds(Number(b.oddsAtBet))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtPoints(b.stake)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtPoints(b.potentialWin)}
                    </td>
                    <td className="px-3 py-2">{b.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
