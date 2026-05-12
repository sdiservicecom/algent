import { requireUser } from '@/lib/auth';
import { cachedGetLeaderboard as getLeaderboard } from '@/lib/cache';
import { AutoRefresh } from '@/components/AutoRefresh';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { LeaderboardList } from '@/components/leaderboard/LeaderboardList';

export default async function LeaderboardPage() {
  const session = await requireUser();
  const rows = await getLeaderboard();

  // 1er / 2e / 3e — on les place en podium (1 au centre)
  const podium = {
    first: rows[0] ?? null,
    second: rows[1] ?? null,
    third: rows[2] ?? null,
  };
  // Tout le reste va dans la liste en dessous
  const rest = rows.slice(3);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30_000} />

      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden>🏆</span>
          Leaderboard
        </h1>
        <button
          type="button"
          aria-label="Trier"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-fg/70 transition hover:bg-white/15 hover:text-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 4v16" />
            <path d="M3 8l4-4 4 4" />
            <path d="M17 20V4" />
            <path d="M13 16l4 4 4-4" />
          </svg>
        </button>
      </header>

      <LeaderboardPodium podium={podium} highlightUserId={session.sub} />

      {rest.length > 0 && (
        <LeaderboardList rows={rest} highlightUserId={session.sub} />
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
