import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { listPlayers, getPlayer } from '@/lib/players';
import {
  TournamentError,
  getTournament,
  listAllTournamentBets,
  setTournamentStatus,
  settleTournament,
} from '@/lib/tournament';
import { listUsers } from '@/lib/users';
import { fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';

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
          ✓ Tournoi réglé.
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
        <div className="card overflow-x-auto p-0">
          <table className="table-stack w-full text-sm md:min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
                <th className="px-3 py-2">Joueur (user)</th>
                <th className="px-3 py-2">Pari sur</th>
                <th className="px-3 py-2">Cote</th>
                <th className="px-3 py-2 text-right">Mise</th>
                <th className="px-3 py-2 text-right">Gain potentiel</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => {
                const u = usersById[b.userId];
                const picked = playersById[b.pickedPlayerId];
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
                    <td data-label="Statut" className="px-3 py-2">{b.status}</td>
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
