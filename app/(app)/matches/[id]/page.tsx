import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getUser } from '@/lib/users';
import { BetError, findActivePendingBet, placeBet } from '@/lib/bets';
import { WalletError } from '@/lib/wallet';
import { getMatch, listOddsSnapshots } from '@/lib/matches';
import { getPlayer } from '@/lib/players';
import { LOCK_BEFORE_START_MS } from '@/lib/odds';
import { fmtDateTime, fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import { BetForm } from '@/components/BetForm';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Sparkline } from '@/components/Sparkline';
import { AutoRefresh } from '@/components/AutoRefresh';

async function placeBetAction(formData: FormData) {
  'use server';
  const session = await requireUser();
  const matchId = String(formData.get('matchId'));
  const pickedPlayerId = String(formData.get('pickedPlayerId'));
  const stake = Number(formData.get('stake'));
  const scoreGuessA = formData.get('scoreGuessA');
  const scoreGuessB = formData.get('scoreGuessB');
  const parseScore = (raw: FormDataEntryValue | null): number | null => {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  if (!matchId || !pickedPlayerId || !Number.isFinite(stake)) {
    return redirect(`/matches/${matchId}?error=validation`);
  }
  try {
    await placeBet({
      userId: session.sub,
      matchId,
      pickedPlayerId,
      stake: Math.floor(stake),
      scoreGuessA: parseScore(scoreGuessA),
      scoreGuessB: parseScore(scoreGuessB),
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
  const isLive = match.status === 'IN_PROGRESS';
  // Pari accepté soit en pré-match (hors fenêtre de verrouillage), soit en
  // direct (IN_PROGRESS — la cote courante est pilotée par le LiveTracker).
  const canBet =
    !myBet && ((match.status === 'OPEN_FOR_BETS' && !tooLate) || isLive);
  const settled = match.status === 'SETTLED' && winner;
  const aIsWinner = settled && winner!.id === pa.id;
  const bIsWinner = settled && winner!.id === pb.id;
  const hasFinalScore =
    settled && match.scoreA !== null && match.scoreB !== null;
  const myScoreCorrect =
    !!myBet &&
    hasFinalScore &&
    myBet.scoreGuessA != null &&
    myBet.scoreGuessB != null &&
    myBet.scoreGuessA === match.scoreA &&
    myBet.scoreGuessB === match.scoreB;

  const liveOrLocked =
    match.status === 'IN_PROGRESS' || match.status === 'LOCKED';

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={liveOrLocked ? 5_000 : 30_000} />
      <header className="card">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase text-fg/50">
            {fmtDateTime(match.startsAt)}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-danger">
              <span
                className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-danger"
                aria-hidden
              />
              Live
            </span>
          )}
        </div>
        {/* Score live (ou final) : centré en grand au-dessus de la
            confrontation pour qu'on voit le compteur grimper en direct. */}
        {(isLive || hasFinalScore) && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="font-mono text-4xl font-extrabold leading-none sm:text-5xl">
              {match.scoreA ?? 0}
            </span>
            <span className="text-2xl text-fg/35">–</span>
            <span className="font-mono text-4xl font-extrabold leading-none sm:text-5xl">
              {match.scoreB ?? 0}
            </span>
          </div>
        )}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div
            className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              aIsWinner
                ? 'border-success shadow-glow'
                : settled
                  ? 'border-border opacity-60'
                  : 'border-border'
            }`}
          >
            <PlayerAvatar player={pa} size={72} />
            <div className="min-w-0 text-center">
              <div className="truncate text-base font-bold sm:text-lg">
                {pa.firstName} {pa.lastName}
              </div>
              {pa.nickname && (
                <div className="truncate text-xs text-fg/60">
                  « {pa.nickname} »
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wide text-fg/50">
                Seed #{pa.seed}
              </div>
            </div>
            <div
              className={`odds-pill ${
                aIsWinner
                  ? 'border-success text-success'
                  : settled
                    ? 'odds-pill-loser'
                    : ''
              }`}
            >
              {fmtOdds(match.oddsA)}
            </div>
            {aIsWinner && (
              <div className="text-[10px] font-semibold uppercase tracking-wide text-success">
                ✓ Vainqueur
              </div>
            )}
          </div>
          <div className="self-center text-sm font-semibold text-fg/40">
            vs
          </div>
          <div
            className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
              bIsWinner
                ? 'border-success shadow-glow'
                : settled
                  ? 'border-border opacity-60'
                  : 'border-border'
            }`}
          >
            <PlayerAvatar player={pb} size={72} />
            <div className="min-w-0 text-center">
              <div className="truncate text-base font-bold sm:text-lg">
                {pb.firstName} {pb.lastName}
              </div>
              {pb.nickname && (
                <div className="truncate text-xs text-fg/60">
                  « {pb.nickname} »
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wide text-fg/50">
                Seed #{pb.seed}
              </div>
            </div>
            <div
              className={`odds-pill ${
                bIsWinner
                  ? 'border-success text-success'
                  : settled
                    ? 'odds-pill-loser'
                    : ''
              }`}
            >
              {fmtOdds(match.oddsB)}
            </div>
            {bIsWinner && (
              <div className="text-[10px] font-semibold uppercase tracking-wide text-success">
                ✓ Vainqueur
              </div>
            )}
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-fg/60">
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
            {fmtPlayerName(
              myBet.pickedPlayerId === match.playerAId ? pa : pb,
            )}{' '}
            @ {fmtOdds(myBet.oddsAtBet)} — mise{' '}
            <span className="font-medium">{fmtPoints(myBet.stake)} pts</span> →
            gain potentiel{' '}
            <span className="font-medium text-success">
              {fmtPoints(myBet.potentialWin)} pts
            </span>
          </p>
          {myBet.scoreGuessA != null && myBet.scoreGuessB != null && (
            <p className="mt-2 text-sm text-fg/70">
              Pronostic du score :{' '}
              <span className="font-mono text-base font-semibold text-fg">
                {myBet.scoreGuessA} – {myBet.scoreGuessB}
              </span>
              {myScoreCorrect && (
                <span className="ml-2 text-success">🎯 score exact !</span>
              )}
            </p>
          )}
        </div>
      ) : canBet ? (
        <BetForm
          matchId={match.id}
          playerA={{
            id: pa.id,
            firstName: pa.firstName,
            lastName: pa.lastName,
            nickname: pa.nickname,
            photoUrl: pa.photoUrl,
            odds: match.oddsA,
          }}
          playerB={{
            id: pb.id,
            firstName: pb.firstName,
            lastName: pb.lastName,
            nickname: pb.nickname,
            photoUrl: pb.photoUrl,
            odds: match.oddsB,
          }}
          balance={user.balance}
          action={placeBetAction}
        />
      ) : settled ? null : (
        <div className="card text-sm text-fg/60">
          {tooLate
            ? 'Les paris sont fermés (moins de 2 minutes avant le début).'
            : 'Les paris ne sont pas ouverts pour ce match.'}
        </div>
      )}

      {snapshots.length > 1 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Évolution des cotes</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-fg/60">{pa.firstName} {pa.lastName}</span>
                <span className="font-mono text-accent">
                  {fmtOdds(snapshots[snapshots.length - 1].oddsA)}
                </span>
              </div>
              <Sparkline
                values={snapshots.map((s) => s.oddsA)}
                width={400}
                height={80}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-fg/60">{pb.firstName} {pb.lastName}</span>
                <span className="font-mono text-accent">
                  {fmtOdds(snapshots[snapshots.length - 1].oddsB)}
                </span>
              </div>
              <Sparkline
                values={snapshots.map((s) => s.oddsB)}
                width={400}
                height={80}
              />
            </div>
          </div>
        </section>
      )}

      {snapshots.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Historique des cotes</h2>
          <div className="card overflow-x-auto p-0">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
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
                    <td data-label="Date" className="px-3 py-2 text-fg/60">
                      {fmtDateTime(s.createdAt)}
                    </td>
                    <td data-label="Cote A" className="px-3 py-2 font-mono">
                      {fmtOdds(s.oddsA)}
                    </td>
                    <td data-label="Cote B" className="px-3 py-2 font-mono">
                      {fmtOdds(s.oddsB)}
                    </td>
                    <td data-label="Mises A" className="px-3 py-2">
                      {fmtPoints(s.totalStakeA)}
                    </td>
                    <td data-label="Mises B" className="px-3 py-2">
                      {fmtPoints(s.totalStakeB)}
                    </td>
                    <td data-label="Cause" className="px-3 py-2 text-xs text-fg/50">
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
