import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createMatch, listMatches } from '@/lib/matches';
import { listPlayers } from '@/lib/players';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';

async function createMatchAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const playerAId = String(formData.get('playerAId'));
  const playerBId = String(formData.get('playerBId'));
  const startsAtRaw = String(formData.get('startsAt'));
  if (!playerAId || !playerBId || playerAId === playerBId || !startsAtRaw) {
    return redirect('/admin/matches?error=validation');
  }
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return redirect('/admin/matches?error=validation');
  }
  await createMatch({ playerAId, playerBId, startsAt });
  revalidatePath('/admin/matches');
  revalidatePath('/matches');
  redirect('/admin/matches?ok=1');
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [players, matches] = await Promise.all([
    listPlayers(),
    listMatches(),
  ]);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Matchs</h1>

      <form
        action={createMatchAction}
        className="card grid grid-cols-1 gap-3 md:grid-cols-4"
      >
        <div>
          <label className="label">Joueur A</label>
          <select name="playerAId" required className="input">
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.seed} · {fmtPlayerName(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Joueur B</label>
          <select name="playerBId" required className="input">
            <option value="">—</option>
            {players.map((p) => (
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
            required
            className="input"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit">
            Créer
          </button>
        </div>
        {sp.error && (
          <p className="md:col-span-4 text-sm text-danger">Champs invalides.</p>
        )}
        {sp.ok && (
          <p className="md:col-span-4 text-sm text-success">Match créé.</p>
        )}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Cotes</th>
              <th className="px-3 py-2">Mises</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const pa = playerMap[m.playerAId];
              const pb = playerMap[m.playerBId];
              return (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="px-3 py-2 text-white/60">
                    {fmtDateTime(m.startsAt)}
                  </td>
                  <td className="px-3 py-2">
                    {pa ? fmtPlayerName(pa) : '?'} vs{' '}
                    {pb ? fmtPlayerName(pb) : '?'}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {fmtOdds(m.oddsA)} / {fmtOdds(m.oddsB)}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/60">
                    {fmtPoints(m.totalStakeA)} / {fmtPoints(m.totalStakeB)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="pill bg-white/10 text-white/70">
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/matches/${m.id}`}
                      className="btn-secondary"
                    >
                      Gérer
                    </Link>
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
