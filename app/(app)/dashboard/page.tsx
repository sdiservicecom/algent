import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUser } from '@/lib/users';
import {
  cachedGetLeaderboard as getLeaderboard,
  cachedHasReceivedTodayBonus as hasReceivedTodayBonus,
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { computeTournamentOdds, getTournament } from '@/lib/tournament';
import { fmtPoints } from '@/lib/format';
import { MatchCard } from '@/components/MatchCard';
import { FilterPills } from '@/components/home/FilterPills';
import { TournamentContenders } from '@/components/home/TournamentContenders';
import { LeaderboardMini } from '@/components/home/LeaderboardMini';
import { RecentResultCard } from '@/components/home/RecentResultCard';
import { NextMatchCountdown } from '@/components/home/NextMatchCountdown';
import { CoinIcon } from '@/components/CoinIcon';

export default async function DashboardPage() {
  const session = await requireUser();
  const [user, bonus, leaderboard, matches, players, tournament] =
    await Promise.all([
      getUser(session.sub),
      hasReceivedTodayBonus(session.sub),
      getLeaderboard(),
      listMatches(),
      listPlayers(),
      getTournament(),
    ]);
  if (!user) return null;

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));
  const tournamentOdds = computeTournamentOdds(players);

  // Tri par horaire
  const sorted = [...matches].sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const live = sorted.filter(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'LOCKED',
  );
  const upcoming = sorted.filter(
    (m) => m.status === 'OPEN_FOR_BETS' || m.status === 'SCHEDULED',
  );
  const settled = [...matches]
    .filter((m) => m.status === 'SETTLED')
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    )
    .slice(0, 4);

  const featuredLive = live[0] ?? null;
  const featuredUpcoming = upcoming[0] ?? null;
  const extraUpcoming = upcoming.slice(1, 4);
  const topThree = leaderboard.slice(0, 3);

  // Compteur pour la pilule "📍" : matchs ouverts ou en cours
  const pinnedCount = matches.filter(
    (m) =>
      m.status === 'OPEN_FOR_BETS' ||
      m.status === 'IN_PROGRESS' ||
      m.status === 'LOCKED',
  ).length;

  return (
    <div className="space-y-6 pb-2">
      {/* Bienvenue */}
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">
          Hello <span className="text-accentBright">{user.username}</span>{' '}
          <span aria-hidden>👋</span>
        </h1>
        <p className="text-sm text-fg/70">
          Bienvenue sur SDI&nbsp;Bet&nbsp;! Le site de{' '}
          <span className="font-bold text-fg">paris fun</span> pour les
          tournois de SPHÈRE DISTRIBUTION.
        </p>
        <BonusCTA bonus={bonus} />
        <FilterPills pinnedCount={pinnedCount} />
      </section>

      {/* Match en cours */}
      {featuredLive && (
        <section>
          <SectionTitle dotClass="bg-danger live-dot">Match en cours</SectionTitle>
          <ul>
            <MatchCard
              match={featuredLive}
              pa={playerMap[featuredLive.playerAId]!}
              pb={playerMap[featuredLive.playerBId]!}
              winner={null}
              viewerUserId={session.sub}
            />
          </ul>
        </section>
      )}

      {/* Match à venir (le suivant) */}
      {featuredUpcoming && (
        <section>
          <SectionTitle dotClass="bg-fg/40">Match à venir</SectionTitle>
          <ul>
            <MatchCard
              match={featuredUpcoming}
              pa={playerMap[featuredUpcoming.playerAId]!}
              pb={playerMap[featuredUpcoming.playerBId]!}
              winner={null}
              viewerUserId={session.sub}
            />
          </ul>
        </section>
      )}

      {/* Gagnant du tournoi — carrousel horizontal */}
      {players.length > 0 && (
        <section>
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden>🏆</span>
              Gagnant du tournoi
            </h2>
            <Link
              href="/tournament"
              aria-label="Parier sur le tournoi"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-fg/70 transition hover:bg-white/15 hover:text-fg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 3l4 4-4 4" />
                <path d="M3 7h18" />
                <path d="M7 21l-4-4 4-4" />
                <path d="M21 17H3" />
              </svg>
            </Link>
          </header>
          <TournamentContenders
            players={players}
            odds={tournamentOdds}
            winnerId={tournament.winnerId}
          />
        </section>
      )}

      {/* Leaderboard */}
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden>🏆</span>
            Leaderboard
          </h2>
          <Link
            href="/leaderboard"
            aria-label="Voir tout le classement"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-fg/70 transition hover:bg-white/15 hover:text-fg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 7l-4 4 4 4" />
              <path d="M3 11h14" />
              <path d="M17 17l4-4-4-4" />
              <path d="M21 13H7" />
            </svg>
          </Link>
        </header>
        <LeaderboardMini
          rows={topThree.map((r) => ({
            rank: r.rank,
            userId: r.userId,
            username: r.username,
            balance: r.balance,
          }))}
          highlightUserId={session.sub}
        />
      </section>

      {/* Derniers résultats */}
      {settled.length > 0 && (
        <section>
          <SectionTitle iconCheck>Derniers résultats</SectionTitle>
          <ul className="grid gap-3">
            {settled.map((m) => {
              const pa = playerMap[m.playerAId];
              const pb = playerMap[m.playerBId];
              if (!pa || !pb) return null;
              return (
                <li key={m.id}>
                  <RecentResultCard match={m} playerA={pa} playerB={pb} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Matchs à venir — liste compacte (suivants après le featured) */}
      {extraUpcoming.length > 0 && (
        <section>
          <SectionTitle dotClass="bg-fg/40">Matchs à venir</SectionTitle>
          <ul className="grid gap-3">
            {extraUpcoming.map((m) => {
              const pa = playerMap[m.playerAId];
              const pb = playerMap[m.playerBId];
              if (!pa || !pb) return null;
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  pa={pa}
                  pb={pb}
                  winner={null}
                  viewerUserId={session.sub}
                />
              );
            })}
          </ul>
        </section>
      )}

      {/* Countdown flottant vers le prochain match */}
      {featuredUpcoming && (
        <NextMatchCountdown
          startsAt={featuredUpcoming.startsAt}
          href={`/matches/${featuredUpcoming.id}`}
        />
      )}
    </div>
  );
}

function SectionTitle({
  children,
  dotClass,
  iconCheck,
}: {
  children: React.ReactNode;
  dotClass?: string;
  iconCheck?: boolean;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg/70">
      {iconCheck ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      ) : dotClass ? (
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`}
          aria-hidden
        />
      ) : null}
      <span>{children}</span>
    </h2>
  );
}

function BonusCTA({
  bonus,
}: {
  bonus: { received: boolean; amount: number | null };
}) {
  if (bonus.received) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-success/15 px-4 py-3 text-sm font-semibold text-success">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
        Bonus quotidien reçu&nbsp;
        {bonus.amount != null && (
          <span className="inline-flex items-center gap-1">
            (+{fmtPoints(bonus.amount)} <CoinIcon size={12} />)
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coin px-4 py-3 text-sm font-semibold text-black"
    >
      Récupérer le bonus quotidien
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  );
}

export const dynamic = 'force-dynamic';
