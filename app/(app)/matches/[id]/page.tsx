import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getUser } from '@/lib/users';
import { BetError, findActivePendingBet, placeBet } from '@/lib/bets';
import { WalletError } from '@/lib/wallet';
import { getMatch, listOddsSnapshots } from '@/lib/matches';
import { getPlayer } from '@/lib/players';
import { LOCK_BEFORE_START_MS } from '@/lib/odds';
import { fmtDateTime, fmtOdds, fmtPoints } from '@/lib/format';
import { BetForm } from '@/components/BetForm';
import { PlayerAvatar } from '@/components/PlayerAvatar';

async function placeBetAction(formData: FormData) {
  'use server';
  const session = await requireUser();
  const matchId = String(formData.get('matchId'));
  const pickedPlayerId = String(formData.get('pickedPlayerId'));
  const stake = Number(formData.get('stake'));
  if (!matchId || !pickedPlayerId || !Number.isFinite(stake)) {
    return redirect(`/matches/${matchId}?error=validation`);
  }
  try {
    await placeBet({
      userId: session.sub,
      matchId,
      pickedPlayerId,
      stake: Math.floor(stake),
    });
  } catch (e) {
    if (e instanceof BetError || e instanceof WalletError) {
      return redirect(`/matches/${matchId}?error=${e.code}`);
    }
    throw e;
  }
  revalidatePath('/matches');
  revalidatePath('/dashboard');
  redirect(`/matches/${matchId}?ok=1`);
}

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const match = await getMatch(id);
  if (!match) notFound();

  const [user, myBet, snapshots, pa, pb, winner] = await Promise.all([
    getUser(session.sub),
    findActivePendingBet(session.sub, id),
    listOddsSnapshots(id),
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
    match.winnerId ? getPlayer(match.winnerId) : Promise.resolve(null),
  ]);

  if (!user || !pa || !pb) notFound();

  const total = match.totalStakeA + match.totalStakeB;
  const ratioA = total > 0 ? match.totalStakeA / total : 0.5;

  const tooLate =
    new Date(match.startsAt).getTime() - Date.now() < LOCK_BEFORE_START_MS;
  const canBet = !myBet && match.status === 'OPEN_FOR_BETS' && !tooLate;

  return (
    <div className="space-y-6">
      <header className="card">
        <div className="text-xs uppercase text-white/50">
          {fmtDateTime(match.startsAt)}
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <PlayerAvatar player={pa} size={56} />
            <div className="min-w-0">
              <div className="truncate text-xl font-bold">
                {pa.firstName} {pa.lastName}
              </div>
              <div className="text-xs text-white/50">Seed #{pa.seed}</div>
              <div className="mt-1 text-2xl font-bold text-accent">
                {fmtOdds(match.oddsA)}
              </div>
            </div>
          </div>
          <div className="text-white/40">vs</div>
          <div className="flex flex-1 items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <div className="truncate text-xl font-bold">
                {pb.firstName} {pb.lastName}
              </div>
              <div className="text-xs text-white/50">Seed #{pb.seed}</div>
              <div className="mt-1 text-2xl font-bold text-accent">
                {fmtOdds(match.oddsB)}
              </div>
            </div>
            <PlayerAvatar player={pb} size={56} />
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-white/60">
              <span>{fmtPoints(match.totalStakeA)} pts misés</span>
              <span>{fmtPoints(match.totalStakeB)} pts misés</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full bg-accent"
                style={{ width: `${ratioA * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {sp.ok && (
        <div className="card border-success/40 text-success">
          ✓ Pari enregistré.
        </div>
      )}
      {sp.error && (
        <div className="card border-danger/40 text-danger">
          {errorLabel(sp.error)}
        </div>
      )}

      {myBet ? (
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Votre pari</h2>
          <p className="text-sm">
            {(myBet.pickedPlayerId === match.playerAId ? pa : pb).firstName} @{' '}
            {fmtOdds(myBet.oddsAtBet)} — mise{' '}
            <span className="font-medium">{fmtPoints(myBet.stake)} pts</span> →
            gain potentiel{' '}
            <span className="font-medium text-success">
              {fmtPoints(myBet.potentialWin)} pts
            </span>
          </p>
        </div>
      ) : canBet ? (
        <BetForm
          matchId={match.id}
          playerA={{
            id: pa.id,
            firstName: pa.firstName,
            lastName: pa.lastName,
            photoUrl: pa.photoUrl,
            odds: match.oddsA,
          }}
          playerB={{
            id: pb.id,
            firstName: pb.firstName,
            lastName: pb.lastName,
            photoUrl: pb.photoUrl,
            odds: match.oddsB,
          }}
          balance={user.balance}
          action={placeBetAction}
        />
      ) : (
        <div className="card text-sm text-white/60">
          {match.status === 'SETTLED' && winner ? (
            <>
              Match réglé. Vainqueur :{' '}
              <span className="font-semibold text-success">
                {winner.firstName} {winner.lastName}
              </span>
            </>
          ) : tooLate ? (
            'Les paris sont fermés (moins de 2 minutes avant le début).'
          ) : (
            'Les paris ne sont pas ouverts pour ce match.'
          )}
        </div>
      )}

      {snapshots.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Historique des cotes</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Cote A</th>
                  <th className="px-3 py-2">Cote B</th>
                  <th className="px-3 py-2">Mises A</th>
                  <th className="px-3 py-2">Mises B</th>
                  <th className="px-3 py-2">Cause</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-2 text-white/60">
                      {fmtDateTime(s.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono">{fmtOdds(s.oddsA)}</td>
                    <td className="px-3 py-2 font-mono">{fmtOdds(s.oddsB)}</td>
                    <td className="px-3 py-2">{fmtPoints(s.totalStakeA)}</td>
                    <td className="px-3 py-2">{fmtPoints(s.totalStakeB)}</td>
                    <td className="px-3 py-2 text-xs text-white/50">
                      {s.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function errorLabel(code: string) {
  const map: Record<string, string> = {
    STAKE_OUT_OF_BOUNDS: 'Mise hors limites (min 10, max 50 000).',
    MATCH_NOT_OPEN: 'Les paris ne sont pas ouverts pour ce match.',
    MATCH_STARTED: 'Le match commence dans moins de 2 minutes.',
    INVALID_PLAYER: 'Joueur invalide.',
    BET_ALREADY_PLACED: 'Vous avez déjà un pari sur ce match.',
    INSUFFICIENT_BALANCE: 'Solde insuffisant.',
    validation: 'Champs invalides.',
  };
  return map[code] ?? `Erreur : ${code}`;
}

export const dynamic = 'force-dynamic';
