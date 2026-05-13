import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import {
  cachedGetLeaderboard as getLeaderboard,
  cachedGetServiceLeaderboard as getServiceLeaderboard,
} from '@/lib/cache';
import { AutoRefresh } from '@/components/AutoRefresh';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { LeaderboardList } from '@/components/leaderboard/LeaderboardList';
import { ServiceLeaderboardList } from '@/components/leaderboard/ServiceLeaderboardList';

type Tab = 'players' | 'services';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'services' ? 'services' : 'players';

  const [rows, services] = await Promise.all([
    getLeaderboard(),
    getServiceLeaderboard(),
  ]);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30_000} />

      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden>🏆</span>
          Leaderboard
        </h1>
      </header>

      {/* Tabs Joueurs / Services */}
      <div className="flex items-center gap-2">
        <Link
          href="/leaderboard"
          className={`tab-pill ${
            tab === 'players' ? 'tab-pill-active' : 'tab-pill-idle'
          }`}
        >
          Joueurs
        </Link>
        <Link
          href="/leaderboard?tab=services"
          className={`tab-pill ${
            tab === 'services' ? 'tab-pill-active' : 'tab-pill-idle'
          }`}
        >
          Services
        </Link>
      </div>

      {tab === 'players' ? (
        <>
          <LeaderboardPodium
            podium={{
              first: rows[0] ?? null,
              second: rows[1] ?? null,
              third: rows[2] ?? null,
            }}
            highlightUserId={session.sub}
          />
          {rows.slice(3).length > 0 && (
            <LeaderboardList
              rows={rows.slice(3)}
              highlightUserId={session.sub}
            />
          )}
        </>
      ) : (
        <ServiceLeaderboardList rows={services} />
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
