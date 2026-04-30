import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, requireUser } from '@/lib/auth';
import { listPlayers, getPlayer } from '@/lib/players';
import {
  TournamentError,
  computeTournamentOdds,
  getTournament,
  getUserTournamentBet,
  placeTournamentBet,
} from '@/lib/tournament';
import { WalletError } from '@/lib/wallet';
import { fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import { PlayerAvatar } from '@/components/PlayerAvatar';

async function placeAction(formData: FormData) {
  'use server';
  const session = await requireUser();
  const pickedPlayerId = String(formData.get('pickedPlayerId') ?? '');
  const stake = Number(formData.get('stake'));
  if (!pickedPlayerId || !Number.isFinite(stake)) {
    return redirect('/tournament?error=validation');
  }
  try {
    await placeTournamentBet({
      userId: session.sub,
      pickedPlayerId,
      stake: Math.floor(stake),
    });
  } catch (e) {
    if (e instanceof TournamentError || e instanceof WalletError) {
      return redirect(`/tournament?error=${e.code}`);
    }
    throw e;
  }
  revalidatePath('/tournament');
  revalidatePath('/dashboard');
  redirect('/tournament?ok=1');
}

export default async function TournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [tournament, players, myBet] = await Promise.all([
    getTournament(),
    listPlayers(),
    getUserTournamentBet(user.id),
  ]);
  const odds = computeTournamentOdds(players);
  const winner = tournament.winnerId
    ? await getPlayer(tournament.winnerId)
    : null;

  return (
    <div className="space-y-6">
      <header className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Pari sur le vainqueur du tournoi</h1>
          <span className={statusPillClass(tournament.status)}>
            {statusLabel(tournament.status)}
          </span>
        </div>
        {winner && (
          <p className="mt-2 text-sm">
            Vainqueur :{' '}
            <span className="font-semibold text-success">
              {fmtPlayerName(winner)}
            </span>
          </p>
        )}
      </header>

      {sp.ok && (
        <div className="card border-success/40 text-success">
          ✓ Pari sur le tournoi enregistré.
        </div>
      )}
      {sp.error && (
        <div className="card border-danger/40 text-danger">
          {errorLabel(sp.error)}
        </div>
      )}

      {myBet && (
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Votre pari</h2>
          {(() => {
            const picked = players.find((p) => p.id === myBet.pickedPlayerId);
            return (
              <p className="text-sm">
                {picked ? fmtPlayerName(picked) : '?'} @{' '}
                {fmtOdds(myBet.oddsAtBet)} — mise{' '}
                <span className="font-medium">
                  {fmtPoints(myBet.stake)} pts
                </span>{' '}
                → gain potentiel{' '}
                <span className="font-medium text-success">
                  {fmtPoints(myBet.potentialWin)} pts
                </span>{' '}
                · statut : <span className="font-medium">{myBet.status}</span>
              </p>
            );
          })()}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Cotes par joueur</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <div
              key={p.id}
              className="card flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlayerAvatar player={p} size={40} />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {p.firstName} {p.lastName}
                  </div>
                  {p.nickname && (
                    <div className="truncate text-xs text-fg/60">
                      « {p.nickname} »
                    </div>
                  )}
                  <div className="text-xs text-fg/50">Seed #{p.seed}</div>
                </div>
              </div>
              <div className="text-xl font-bold text-accent">
                {fmtOdds(odds[p.id] ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {tournament.status === 'OPEN' && !myBet && players.length > 0 && (
        <form action={placeAction} className="card space-y-3">
          <h2 className="text-lg font-semibold">Placer mon pari tournoi</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Joueur</label>
              <select name="pickedPlayerId" required className="input">
                <option value="">—</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmtPlayerName(p)} — cote {fmtOdds(odds[p.id] ?? 0)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                Mise (10 – {fmtPoints(Math.min(user.balance, 50_000))})
              </label>
              <input
                name="stake"
                type="number"
                min={10}
                max={Math.min(user.balance, 50_000)}
                step={1}
                defaultValue={50}
                required
                className="input"
              />
            </div>
          </div>
          <button className="btn-primary w-full md:w-auto" type="submit">
            Confirmer le pari tournoi
          </button>
        </form>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case 'OPEN':
      return 'Paris ouverts';
    case 'LOCKED':
      return 'Verrouillé';
    case 'SETTLED':
      return 'Réglé';
    case 'CANCELLED':
      return 'Annulé';
    default:
      return s;
  }
}
function statusPillClass(s: string) {
  switch (s) {
    case 'OPEN':
      return 'pill bg-success/20 text-success';
    case 'LOCKED':
      return 'pill bg-yellow-500/20 text-yellow-400';
    case 'SETTLED':
      return 'pill bg-accent/20 text-accent';
    case 'CANCELLED':
      return 'pill bg-danger/20 text-danger';
    default:
      return 'pill bg-fg/10 text-fg/70';
  }
}
function errorLabel(code: string) {
  switch (code) {
    case 'NOT_OPEN':
      return 'Les paris sur le tournoi sont fermés.';
    case 'STAKE_OUT_OF_BOUNDS':
      return 'Mise hors limites (10 – 50 000).';
    case 'INVALID_PLAYER':
      return 'Joueur invalide.';
    case 'BET_ALREADY_PLACED':
      return 'Tu as déjà un pari sur le tournoi.';
    case 'INSUFFICIENT_BALANCE':
      return 'Solde insuffisant.';
    default:
      return `Erreur : ${code}`;
  }
}

export const dynamic = 'force-dynamic';
