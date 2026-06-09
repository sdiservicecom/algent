import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import {
  createMatch,
  deleteMatch,
  listMatches as rawListMatches,
  transitionMatchStatus,
  updateMatch,
} from '@/lib/matches';
import {
  bumpCache,
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { logAudit } from '@/lib/audit';
import {
  parseLocalDatetimeInput,
  toLocalDatetimeInput,
} from '@/lib/datetime';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import {
  MATCH_ROUNDS,
  MATCH_ROUND_LABEL,
  type MatchRound,
} from '@/lib/types';
import { ConfirmForm } from '@/components/admin/ConfirmForm';

async function deleteMatchAction(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  await deleteMatch(id);
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_DELETE',
    targetId: id,
  });
  bumpCache('matches', 'leaderboard', 'users');
  revalidatePath('/admin/matches');
  revalidatePath('/matches');
  revalidatePath('/bracket');
}

async function purgeFinishedAction() {
  'use server';
  const session = await requireAdmin();
  const matches = await rawListMatches();
  const targets = matches.filter(
    (m) => m.status === 'SETTLED' || m.status === 'CANCELLED',
  );
  for (const m of targets) {
    await deleteMatch(m.id);
  }
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_PURGE_FINISHED',
    metadata: { count: targets.length },
  });
  bumpCache('matches', 'leaderboard', 'users');
  revalidatePath('/admin/matches');
  revalidatePath('/matches');
  revalidatePath('/bracket');
  revalidatePath('/leaderboard');
  redirect(`/admin/matches?purged=${targets.length}`);
}

async function rescheduleMatchAction(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  const raw = String(formData.get('startsAt') ?? '');
  const startsAt = raw ? parseLocalDatetimeInput(raw) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return redirect('/admin/matches?error=date');
  }
  try {
    await updateMatch(id, { startsAt });
  } catch {
    return redirect('/admin/matches?error=invalid-status');
  }
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_UPDATE',
    targetId: id,
    metadata: { startsAt: raw, source: 'inline-list' },
  });
  bumpCache('matches');
  revalidatePath('/admin/matches');
  revalidatePath('/matches');
  revalidatePath('/bracket');
  revalidatePath('/dashboard');
  redirect(`/admin/matches?rescheduled=${id}`);
}

async function openAllScheduledAction() {
  'use server';
  const session = await requireAdmin();
  const matches = await rawListMatches();
  const targets = matches.filter((m) => m.status === 'SCHEDULED');
  for (const m of targets) {
    try {
      await transitionMatchStatus(m.id, 'OPEN_FOR_BETS');
    } catch {
      /* ignore les transitions invalides — on continue */
    }
  }
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_OPEN',
    metadata: { bulk: true, count: targets.length },
  });
  bumpCache('matches');
  revalidatePath('/admin/matches');
  revalidatePath('/matches');
  redirect(`/admin/matches?opened=${targets.length}`);
}

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
  // <input type="datetime-local"> renvoie une heure locale "naïve" sans
  // fuseau (ex: "2024-12-15T14:00"). On l'interprète comme l'heure
  // affichée à l'utilisateur (APP_TZ = Europe/Paris) et on convertit
  // vers une Date UTC absolue pour le stockage.
  const startsAt = parseLocalDatetimeInput(startsAtRaw);
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
  searchParams: Promise<{
    error?: string;
    ok?: string;
    purged?: string;
    deleted?: string;
    opened?: string;
    rescheduled?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [players, matches] = await Promise.all([
    listPlayers(),
    listMatches(),
  ]);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));
  const finishedCount = matches.filter(
    (m) => m.status === 'SETTLED' || m.status === 'CANCELLED',
  ).length;
  const scheduledCount = matches.filter((m) => m.status === 'SCHEDULED').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Matchs</h1>
        <div className="flex flex-wrap items-center gap-2">
          {scheduledCount > 0 && (
            <form action={openAllScheduledAction}>
              <button type="submit" className="btn-primary text-sm">
                Ouvrir aux paris ({scheduledCount})
              </button>
            </form>
          )}
          {finishedCount > 0 && (
            <ConfirmForm
              action={purgeFinishedAction}
              confirmText={`Supprimer définitivement les ${finishedCount} matchs réglés ou annulés ? Les paris associés sont remboursés et effacés. Irréversible.`}
              buttonClassName="btn-danger text-sm"
              buttonLabel={`Purger les ${finishedCount} matchs terminés`}
            />
          )}
        </div>
      </header>
      {sp.opened && (
        <div className="card border-success/40 text-sm text-success">
          ✓ {sp.opened} match(s) ouverts aux paris.
        </div>
      )}
      {sp.rescheduled && (
        <div className="card border-success/40 text-sm text-success">
          ✓ Match reprogrammé.
        </div>
      )}
      {sp.error === 'date' && (
        <div className="card border-danger/40 text-sm text-danger">
          Date invalide.
        </div>
      )}
      {sp.error === 'invalid-status' && (
        <div className="card border-danger/40 text-sm text-danger">
          Impossible de reprogrammer : le match est déjà réglé, annulé
          ou terminé.
        </div>
      )}
      {sp.purged && (
        <div className="card border-success/40 text-sm text-success">
          ✓ {sp.purged} matchs supprimés.
        </div>
      )}
      {sp.deleted && (
        <div className="card border-success/40 text-sm text-success">
          ✓ Match supprimé.
        </div>
      )}

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
                    {/* Affichage + édition inline. La date stockée
                        en UTC est formatée pour le datetime-local en
                        heure Europe/Paris via toLocalDatetimeInput, et
                        le submit la repasse en UTC via parseLocal-
                        DatetimeInput côté action. */}
                    <form
                      action={rescheduleMatchAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <input
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={toLocalDatetimeInput(m.startsAt)}
                        className="input !px-3 !py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        title="Reprogrammer ce match"
                      >
                        OK
                      </button>
                    </form>
                    <div className="mt-1 text-[11px] text-fg/40">
                      {fmtDateTime(m.startsAt)}
                    </div>
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
                    <div className="inline-flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/matches/${m.id}`}
                        className="btn-secondary text-xs"
                      >
                        Gérer
                      </Link>
                      <ConfirmForm
                        action={deleteMatchAction}
                        confirmText={`Supprimer ce match ? Les paris seront remboursés et effacés. Irréversible.`}
                        buttonClassName="btn-danger text-xs"
                        buttonLabel="Supprimer"
                        hiddenFields={{ id: m.id }}
                      />
                    </div>
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
