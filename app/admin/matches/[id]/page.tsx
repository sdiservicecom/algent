import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import {
  cancelMatch,
  deleteMatch,
  getMatch,
  resetMatch,
  setMatchScore,
  settleMatch,
  transitionMatchStatus,
  updateMatch,
} from '@/lib/matches';
import { listMatchBets } from '@/lib/bets';
import { ConfirmForm } from '@/components/admin/ConfirmForm';
import { LiveTracker } from '@/components/admin/LiveTracker';
import { SettleForm } from '@/components/admin/SettleForm';
import { getPlayer, listPlayers } from '@/lib/players';
import { getUser } from '@/lib/users';
import { logAudit } from '@/lib/audit';
import { bumpCache } from '@/lib/cache';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import {
  parseLocalDatetimeInput,
  toLocalDatetimeInput,
} from '@/lib/datetime';

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
  bumpCache('matches', 'leaderboard');
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
  const scoreARaw = formData.get('scoreA');
  const scoreBRaw = formData.get('scoreB');
  const parseScore = (raw: FormDataEntryValue | null): number | null => {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const scoreA = parseScore(scoreARaw);
  const scoreB = parseScore(scoreBRaw);
  const finalScore =
    scoreA != null && scoreB != null
      ? { scoreA, scoreB }
      : undefined;

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
  await settleMatch(id, winnerId, finalScore);
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_SETTLE',
    targetId: id,
    metadata: { winnerId, scoreA, scoreB },
  });
  bumpCache('matches', 'leaderboard', 'users');
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
  bumpCache('matches', 'leaderboard');
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
}

async function reset(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  await resetMatch(id);
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'MATCH_RESET',
    targetId: id,
  });
  bumpCache('matches', 'leaderboard', 'users');
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
  revalidatePath('/leaderboard');
}

async function destroy(formData: FormData) {
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
  revalidatePath('/leaderboard');
  redirect('/admin/matches?deleted=1');
}

async function liveScore(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  const scoreA = Number(formData.get('scoreA'));
  const scoreB = Number(formData.get('scoreB'));
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
  await setMatchScore(id, scoreA, scoreB);
  bumpCache('matches');
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath('/matches');
  revalidatePath(`/matches/${id}`);
}

async function updateBasic(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  const startsAtRaw = String(formData.get('startsAt') ?? '');
  const playerAId = String(formData.get('playerAId') ?? '') || undefined;
  const playerBId = String(formData.get('playerBId') ?? '') || undefined;
  // datetime-local en heure locale APP_TZ → Date UTC absolue (cf. createMatchAction).
  const startsAt = startsAtRaw ? parseLocalDatetimeInput(startsAtRaw) : undefined;
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
  // Prefill du <input type="datetime-local"> : on doit lui donner l'heure
  // affichée dans APP_TZ (et NON la chaîne ISO UTC), sinon l'admin voit
  // une heure décalée à chaque édition.
  const startsLocal = toLocalDatetimeInput(match.startsAt);

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
        <form action={reset}>
          <input type="hidden" name="id" value={match.id} />
          <button
            className="btn-ghost w-full"
            type="submit"
            title="Remet le match à SCHEDULED, rembourse les paris en attente, vide score/winner."
          >
            Réinitialiser
          </button>
        </form>
        <ConfirmForm
          action={destroy}
          confirmText={`Supprimer ce match ? Tous les paris associés seront supprimés (les paris en attente seront remboursés). Action irréversible.`}
          buttonClassName="btn-danger w-full"
          buttonLabel="Supprimer le match"
          hiddenFields={{ id: match.id }}
        />
      </section>

      {(match.status === 'LOCKED' ||
        match.status === 'IN_PROGRESS' ||
        match.status === 'OPEN_FOR_BETS') && (
        <>
          <LiveTracker
            matchId={match.id}
            initialScoreA={match.scoreA ?? 0}
            initialScoreB={match.scoreB ?? 0}
            initialOddsA={match.oddsA}
            initialOddsB={match.oddsB}
            labelA={fmtPlayerName(pa)}
            labelB={fmtPlayerName(pb)}
            setScoreAction={liveScore}
          />
          <a
            href={`/live/${match.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn-outline-accent inline-flex w-full"
          >
            Ouvrir la vue grand écran
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 3h7v7" />
              <path d="M5 12 21 3" />
              <path d="M21 14v7H3V3h7" />
            </svg>
          </a>
        </>
      )}

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
          <p className="mb-3 text-xs text-fg/60">
            Les scores sont optionnels. S'ils sont renseignés, les paris avec un
            pronostic exact reçoivent un bonus égal à leur mise.
          </p>
          <SettleForm
            matchId={match.id}
            playerAId={match.playerAId}
            playerBId={match.playerBId}
            playerALabel={fmtPlayerName(pa)}
            playerBLabel={fmtPlayerName(pb)}
            initialScoreA={match.scoreA}
            initialScoreB={match.scoreB}
            initialWinnerId={match.winnerId}
            settleAction={settle}
          />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Paris ({bets.length})</h2>
        <div className="card overflow-x-auto p-0">
          <table className="table-stack w-full text-sm">
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
                    <td data-label="Joueur" className="px-3 py-2">
                      {u?.username ?? '—'}
                    </td>
                    <td data-label="Pari sur" className="px-3 py-2">
                      {fmtPlayerName(picked)}
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
