import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { listPlayers, getPlayer } from '@/lib/players';
import {
  TournamentError,
  cancelTournamentBet,
  getTournament,
  listAllTournamentBets,
  setTournamentStatus,
  settleTournament,
  updateTournamentBet,
} from '@/lib/tournament';
import { listUsers } from '@/lib/users';
import { fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import { ConfirmForm } from '@/components/admin/ConfirmForm';

async function setStatus(formData: FormData) {
  'use server';
  await requireAdmin();
  const next = String(formData.get('next')) as
    | 'OPEN'
    | 'LOCKED'
    | 'CANCELLED';
  try {
    await setTournamentStatus(next);
  } catch {
    /* noop */
  }
  revalidatePath('/admin/tournament');
  revalidatePath('/tournament');
}

async function cancelBetAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const betId = String(formData.get('betId'));
  try {
    await cancelTournamentBet(betId);
  } catch (e) {
    if (e instanceof TournamentError) {
      return redirect(`/admin/tournament?error=${e.code}`);
    }
    throw e;
  }
  revalidatePath('/admin/tournament');
  revalidatePath('/leaderboard');
  redirect('/admin/tournament?ok=bet-cancelled');
}

async function updateBetAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const betId = String(formData.get('betId'));
  const pickedPlayerId =
    String(formData.get('pickedPlayerId') ?? '') || undefined;
  const stakeRaw = String(formData.get('stake') ?? '');
  const stake = stakeRaw === '' ? undefined : Number(stakeRaw);
  try {
    await updateTournamentBet(betId, {
      pickedPlayerId,
      stake: Number.isFinite(stake) ? (stake as number) : undefined,
    });
  } catch (e) {
    if (e instanceof TournamentError) {
      return redirect(`/admin/tournament?error=${e.code}`);
    }
    throw e;
  }
  revalidatePath('/admin/tournament');
  revalidatePath('/leaderboard');
  redirect('/admin/tournament?ok=bet-updated');
}

async function settle(formData: FormData) {
  'use server';
  await requireAdmin();
  const winnerId = String(formData.get('winnerId'));
  if (!winnerId) return redirect('/admin/tournament?error=validation');
  try {
    await settleTournament(winnerId);
  } catch (e) {
    if (e instanceof TournamentError) {
      return redirect(`/admin/tournament?error=${e.code}`);
    }
    throw e;
  }
  revalidatePath('/admin/tournament');
  revalidatePath('/tournament');
  revalidatePath('/leaderboard');
  redirect('/admin/tournament?ok=1');
}

export default async function AdminTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [tournament, players, bets, users] = await Promise.all([
    getTournament(),
    listPlayers(),
    listAllTournamentBets(),
    listUsers(),
  ]);
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const winner = tournament.winnerId
    ? await getPlayer(tournament.winnerId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tournoi (pari sur vainqueur)</h1>
        <span className="pill bg-fg/10 text-fg/70">
          {tournament.status}
        </span>
      </div>

      {sp.ok && (
        <div className="card border-success/40 text-success">
          {sp.ok === 'bet-cancelled'
            ? '✓ Pari annulé et remboursé.'
            : sp.ok === 'bet-updated'
              ? '✓ Pari mis à jour.'
              : '✓ Tournoi réglé.'}
        </div>
      )}
      {sp.error && (
        <div className="card border-danger/40 text-danger">
          Erreur : {sp.error}
        </div>
      )}

      {winner && (
        <div className="card">
          Vainqueur :{' '}
          <span className="font-semibold text-success">
            {fmtPlayerName(winner)}
          </span>
        </div>
      )}

      <section className="card flex flex-wrap gap-2">
        {tournament.status !== 'OPEN' &&
          tournament.status !== 'SETTLED' &&
          tournament.status !== 'CANCELLED' && (
            <form action={setStatus}>
              <input type="hidden" name="next" value="OPEN" />
              <button className="btn-primary" type="submit">
                Ouvrir aux paris
              </button>
            </form>
          )}
        {tournament.status === 'OPEN' && (
          <>
            <form action={setStatus}>
              <input type="hidden" name="next" value="LOCKED" />
              <button className="btn-secondary" type="submit">
                Verrouiller
              </button>
            </form>
            <form action={setStatus}>
              <input type="hidden" name="next" value="CANCELLED" />
              <button className="btn-danger" type="submit">
                Annuler le tournoi
              </button>
            </form>
          </>
        )}
        {tournament.status === 'LOCKED' && (
          <form action={setStatus}>
            <input type="hidden" name="next" value="OPEN" />
            <button className="btn-secondary" type="submit">
              Rouvrir aux paris
            </button>
          </form>
        )}
      </section>

      {tournament.status !== 'SETTLED' &&
        tournament.status !== 'CANCELLED' && (
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">
              Saisir le vainqueur du tournoi
            </h2>
            <form
              action={settle}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="min-w-[220px] flex-1">
                <label className="label">Vainqueur</label>
                <select name="winnerId" required className="input">
                  <option value="">—</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {fmtPlayerName(p)}
                    </option>
                  ))}
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
        <p className="mb-3 text-xs text-fg/60">
          Pour les paris en cours (PENDING), tu peux changer le joueur
          choisi, ajuster la mise (la différence est créditée ou débitée
          du wallet) ou annuler + rembourser intégralement.
        </p>
        <div className="card overflow-x-auto p-0">
          <table className="table-stack w-full text-sm md:min-w-[760px]">
            <thead>
              <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
                <th className="px-3 py-2">Joueur (user)</th>
                <th className="px-3 py-2">Pari sur</th>
                <th className="px-3 py-2">Cote</th>
                <th className="px-3 py-2 text-right">Mise</th>
                <th className="px-3 py-2 text-right">Gain potentiel</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Modifier</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => {
                const u = usersById[b.userId];
                const picked = playersById[b.pickedPlayerId];
                const isPending = b.status === 'PENDING';
                return (
                  <tr key={b.id} className="border-b border-border/50">
                    <td data-label="Joueur" className="px-3 py-2">
                      {u?.username ?? '—'}
                    </td>
                    <td data-label="Pari sur" className="px-3 py-2">
                      {picked ? fmtPlayerName(picked) : '—'}
                    </td>
                    <td data-label="Cote" className="px-3 py-2 font-mono">
                      {fmtOdds(b.oddsAtBet)}
                    </td>
                    <td data-label="Mise" className="px-3 py-2 text-right">
                      {fmtPoints(b.stake)}
                    </td>
                    <td
                      data-label="Gain potentiel"
                      className="px-3 py-2 text-right"
                    >
                      {fmtPoints(b.potentialWin)}
                    </td>
                    <td data-label="Statut" className="px-3 py-2">
                      <span
                        className={`pill ${
                          b.status === 'PENDING'
                            ? 'bg-fg/10 text-fg/80'
                            : b.status === 'WON'
                              ? 'bg-success/15 text-success'
                              : b.status === 'LOST'
                                ? 'bg-danger/15 text-danger'
                                : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td data-label="Modifier" className="px-3 py-2">
                      {isPending ? (
                        <div className="flex flex-wrap items-end justify-end gap-2">
                          <form
                            action={updateBetAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input type="hidden" name="betId" value={b.id} />
                            <div>
                              <label className="label">Pari sur</label>
                              <select
                                name="pickedPlayerId"
                                defaultValue={b.pickedPlayerId}
                                className="input w-40"
                              >
                                {players.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    #{p.seed} · {fmtPlayerName(p)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Mise</label>
                              <input
                                name="stake"
                                type="number"
                                min={10}
                                max={50000}
                                step={1}
                                defaultValue={b.stake}
                                className="input w-24 text-right"
                              />
                            </div>
                            <button className="btn-secondary" type="submit">
                              OK
                            </button>
                          </form>
                          <ConfirmForm
                            action={cancelBetAction}
                            confirmText={`Annuler et rembourser le pari de ${u?.username ?? 'cet utilisateur'} (${fmtPoints(b.stake)} pts) ?`}
                            buttonLabel="Annuler"
                            buttonClassName="btn-danger"
                            hiddenFields={{ betId: b.id }}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-fg/40">—</span>
                      )}
                    </td>
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
