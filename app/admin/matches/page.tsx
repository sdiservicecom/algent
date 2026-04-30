import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createMatch } from '@/lib/matches';
import {
  bumpCache,
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import {
  MATCH_ROUNDS,
  MATCH_ROUND_LABEL,
  type MatchRound,
} from '@/lib/types';

async function createMatchAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const playerAId = String(formData.get('playerAId'));
  const playerBId = String(formData.get('playerBId'));
  const startsAtRaw = String(formData.get('startsAt'));
  const roundRaw = String(formData.get('round') ?? '');
  const slotRaw = String(formData.get('bracketSlot') ?? '');
  if (!playerAId || !playerBId || playerAId === playerBId || !startsAtRaw) {
    return redirect('/admin/matches?error=validation');
  }
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return redirect('/admin/matches?error=validation');
  }
  const round = (MATCH_ROUNDS as readonly string[]).includes(roundRaw)
    ? (roundRaw as MatchRound)
    : null;
  const bracketSlot =
    slotRaw && Number.isFinite(Number(slotRaw)) && Number(slotRaw) >= 1
      ? Math.floor(Number(slotRaw))
      : null;
  await createMatch({ playerAId, playerBId, startsAt, round, bracketSlot });
  bumpCache('matches');
  revalidatePath('/admin/matches');
  revalidatePath('/matches');
  revalidatePath('/bracket');
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
        className="card grid grid-cols-1 gap-3 md:grid-cols-6"
      >
        <div className="md:col-span-2">
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
        <div className="md:col-span-2">
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
        <div className="md:col-span-2">
          <label className="label">Date & heure</label>
          <input
            name="startsAt"
            type="datetime-local"
            required
            className="input"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Phase (bracket)</label>
          <select name="round" className="input">
            <option value="">— hors bracket</option>
            {MATCH_ROUNDS.map((r) => (
              <option key={r} value={r}>
                {MATCH_ROUND_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Slot dans la phase (1, 2, 3…)</label>
          <input
            name="bracketSlot"
            type="number"
            min={1}
            placeholder="ordre dans le bracket"
            className="input"
          />
        </div>
        <div className="flex items-end md:col-span-2">
          <button className="btn-primary w-full" type="submit">
            Créer
          </button>
        </div>
        {sp.error && (
          <p className="md:col-span-6 text-sm text-danger">Champs invalides.</p>
        )}
        {sp.ok && (
          <p className="md:col-span-6 text-sm text-success">Match créé.</p>
        )}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
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
                  <td data-label="Date" className="px-3 py-2 text-fg/60">
                    {fmtDateTime(m.startsAt)}
                  </td>
                  <td data-label="Match" className="px-3 py-2">
                    {pa ? fmtPlayerName(pa) : '?'} vs{' '}
                    {pb ? fmtPlayerName(pb) : '?'}
                  </td>
                  <td data-label="Cotes" className="px-3 py-2 font-mono">
                    {fmtOdds(m.oddsA)} / {fmtOdds(m.oddsB)}
                  </td>
                  <td data-label="Mises" className="px-3 py-2 text-xs text-fg/60">
                    {fmtPoints(m.totalStakeA)} / {fmtPoints(m.totalStakeB)}
                  </td>
                  <td data-label="Statut" className="px-3 py-2">
                    <span className="pill bg-fg/10 text-fg/70">
                      {m.status}
                    </span>
                  </td>
                  <td data-label="Action" className="px-3 py-2 text-right">
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
