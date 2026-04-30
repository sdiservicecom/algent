import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import {
  cancelMatch,
  getMatch,
  settleMatch,
  transitionMatchStatus,
} from '@/lib/matches';
import { listMatchBets } from '@/lib/bets';
import { getPlayer } from '@/lib/players';
import { getUser } from '@/lib/users';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';

async function open(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  await transitionMatchStatus(id, 'OPEN_FOR_BETS');
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
}

async function lock(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  await transitionMatchStatus(id, 'LOCKED');
  revalidatePath(`/admin/matches/${id}`);
}

async function settle(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  const winnerId = String(formData.get('winnerId'));
  const match = await getMatch(id);
  if (!match) return;

  // S'assurer qu'on est dans l'état FINISHED avant de régler
  if (match.status === 'OPEN_FOR_BETS') {
    await transitionMatchStatus(id, 'LOCKED');
    await transitionMatchStatus(id, 'IN_PROGRESS');
    await transitionMatchStatus(id, 'FINISHED');
  } else if (match.status === 'LOCKED') {
    await transitionMatchStatus(id, 'IN_PROGRESS');
    await transitionMatchStatus(id, 'FINISHED');
  } else if (match.status === 'IN_PROGRESS') {
    await transitionMatchStatus(id, 'FINISHED');
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
  const match = await getMatch(id);
  if (!match) notFound();

  const [bets, pa, pb, winner] = await Promise.all([
    listMatchBets(id),
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
    match.winnerId ? getPlayer(match.winnerId) : Promise.resolve(null),
  ]);
  if (!pa || !pb) notFound();

  const userIds = Array.from(new Set(bets.map((b) => b.userId)));
  const users = Object.fromEntries(
    (await Promise.all(userIds.map(getUser)))
      .filter((u) => !!u)
      .map((u) => [u!.id, u!]),
  );

  return (
    <div className="space-y-6">
      <header className="card">
        <div className="text-xs uppercase text-white/50">
          {fmtDateTime(match.startsAt)} · {match.status}
        </div>
        <h1 className="mt-2 text-xl font-bold">
          {fmtPlayerName(pa)} vs {fmtPlayerName(pb)}
        </h1>
        <div className="mt-2 text-sm text-white/60">
          Cotes : {fmtOdds(match.oddsA)} / {fmtOdds(match.oddsB)} · Mises :{' '}
          {fmtPoints(match.totalStakeA)} / {fmtPoints(match.totalStakeB)}
        </div>
        {winner && (
          <div className="mt-2 text-sm">
            Vainqueur :{' '}
            <span className="font-semibold text-success">
              {fmtPlayerName(winner)}
            </span>
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {match.status === 'SCHEDULED' && (
          <form action={open}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-primary w-full" type="submit">
              Ouvrir aux paris
            </button>
          </form>
        )}
        {match.status === 'OPEN_FOR_BETS' && (
          <form action={lock}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-secondary w-full" type="submit">
              Verrouiller
            </button>
          </form>
        )}
        {match.status !== 'SETTLED' && match.status !== 'CANCELLED' && (
          <form action={cancel}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-danger w-full" type="submit">
              Annuler le match
            </button>
          </form>
        )}
      </section>

      {match.status !== 'SETTLED' && match.status !== 'CANCELLED' && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Saisir le vainqueur</h2>
          <form action={settle} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={match.id} />
            <div className="flex-1 min-w-[200px]">
              <label className="label">Vainqueur</label>
              <select name="winnerId" required className="input">
                <option value="">—</option>
                <option value={match.playerAId}>{fmtPlayerName(pa)}</option>
                <option value={match.playerBId}>{fmtPlayerName(pb)}</option>
              </select>
            </div>
            <button className="btn-primary" type="submit">
              Valider et calculer les gains
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Paris ({bets.length})</h2>
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
                  b.pickedPlayerId === match.playerAId ? pa : pb;
                const u = users[b.userId];
                return (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="px-3 py-2">{u?.username ?? '—'}</td>
                    <td className="px-3 py-2">{fmtPlayerName(picked)}</td>
                    <td className="px-3 py-2 font-mono">
                      {fmtOdds(b.oddsAtBet)}
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
