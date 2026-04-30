import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import {
  cancelMatch,
  getMatch,
  settleMatch,
  transitionMatchStatus,
  updateMatch,
} from '@/lib/matches';
import { listMatchBets } from '@/lib/bets';
import { getPlayer, listPlayers } from '@/lib/players';
import { getUser } from '@/lib/users';
import { logAudit } from '@/lib/audit';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';

async function open(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  await transitionMatchStatus(id, 'OPEN_FOR_BETS');
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_OPEN',
    targetId: id,
  });
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
}

async function lock(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  await transitionMatchStatus(id, 'LOCKED');
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_LOCK',
    targetId: id,
  });
  revalidatePath(`/admin/matches/${id}`);
}

async function settle(formData: FormData) {
  'use server';
  const session = await requireAdmin();
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
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_SETTLE',
    targetId: id,
    metadata: { winnerId },
  });
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
  revalidatePath('/leaderboard');
}

async function cancel(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  await cancelMatch(id);
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_CANCEL',
    targetId: id,
  });
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
}

async function updateBasic(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  const startsAtRaw = String(formData.get('startsAt') ?? '');
  const playerAId = String(formData.get('playerAId') ?? '') || undefined;
  const playerBId = String(formData.get('playerBId') ?? '') || undefined;
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : undefined;
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return redirect(`/admin/matches/${id}?error=date`);
  }
  await updateMatch(id, { startsAt, playerAId, playerBId });
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_UPDATE',
    targetId: id,
    metadata: { startsAt: startsAtRaw, playerAId, playerBId },
  });
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
  revalidatePath('/bracket');
  redirect(`/admin/matches/${id}?ok=1`);
}

export default async function AdminMatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const match = await getMatch(id);
  if (!match) notFound();

  const [bets, pa, pb, winner, allPlayers] = await Promise.all([
    listMatchBets(id),
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
    match.winnerId ? getPlayer(match.winnerId) : Promise.resolve(null),
    listPlayers(),
  ]);
  if (!pa || !pb) notFound();
  const isEditable = match.status === 'SCHEDULED';
  const startsLocal = new Date(match.startsAt).toISOString().slice(0, 16);

  const userIds = Array.from(new Set(bets.map((b) => b.userId)));
  const users = Object.fromEntries(
    (await Promise.all(userIds.map(getUser)))
      .filter((u) => !!u)
      .map((u) => [u!.id, u!]),
  );

  return (
    <div className="space-y-6">
      <header className="card">
        <div className="text-xs uppercase text-fg/50">
          {fmtDateTime(match.startsAt)} · {match.status}
        </div>
        <h1 className="mt-2 text-xl font-bold">
          {fmtPlayerName(pa)} vs {fmtPlayerName(pb)}
        </h1>
        <div className="mt-2 text-sm text-fg/60">
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

      {sp.ok && (
        <div className="card border-success/40 text-success">
          ✓ Match mis à jour.
        </div>
      )}
      {sp.error === 'date' && (
        <div className="card border-danger/40 text-danger">
          Date invalide.
        </div>
      )}

      {isEditable && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Modifier le match</h2>
          <p className="mb-3 text-xs text-fg/60">
            Possible uniquement tant que le match est SCHEDULED (avant
            l'ouverture des paris).
          </p>
          <form action={updateBasic} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input type="hidden" name="id" value={match.id} />
            <div>
              <label className="label">Joueur A</label>
              <select name="playerAId" defaultValue={match.playerAId} className="input">
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.seed} · {fmtPlayerName(p)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Joueur B</label>
              <select name="playerBId" defaultValue={match.playerBId} className="input">
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.seed} · {fmtPlayerName(p)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date & heure</label>
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={startsLocal}
                className="input"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button className="btn-primary md:w-auto" type="submit">
                Enregistrer
              </button>
            </div>
          </form>
        </section>
      )}

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
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
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
