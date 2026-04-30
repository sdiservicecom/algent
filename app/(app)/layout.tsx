import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearSessionCookie, getCurrentUser } from '@/lib/auth';
import { fmtPoints } from '@/lib/format';
import { listMatches } from '@/lib/matches';
import { listPlayers } from '@/lib/players';
import { UpcomingMatchesBanner } from '@/components/UpcomingMatchesBanner';
import { BasketProvider } from '@/components/BasketContext';
import { FloatingBetBasket } from '@/components/FloatingBetBasket';
import { NotificationBell } from '@/components/NotificationBell';

async function logout() {
  'use server';
  await clearSessionCookie();
  redirect('/login');
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [matches, players] = await Promise.all([listMatches(), listPlayers()]);
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  return (
    <BasketProvider>
      <div className="min-h-screen pb-24">
        <header className="bg-accentDark text-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-3 sm:gap-6 sm:px-4">
            <Link
              href="/dashboard"
              className="font-display text-xl font-semibold tracking-tight text-white"
            >
              Algent
            </Link>
            <div className="order-3 -mx-3 flex w-full items-center gap-3 overflow-x-auto px-3 text-sm sm:order-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
              <Link href="/dashboard" className="shrink-0 text-white/80 hover:text-white">
                Dashboard
              </Link>
              <Link href="/matches" className="shrink-0 text-white/80 hover:text-white">
                Matchs
              </Link>
              <Link href="/bracket" className="shrink-0 text-white/80 hover:text-white">
                Bracket
              </Link>
              <Link href="/history" className="shrink-0 text-white/80 hover:text-white">
                Historique
              </Link>
              <Link href="/leaderboard" className="shrink-0 text-white/80 hover:text-white">
                Classement
              </Link>
              <Link href="/tournament" className="shrink-0 text-white/80 hover:text-white">
                Tournoi
              </Link>
              <Link href="/stats" className="shrink-0 text-white/80 hover:text-white">
                Stats
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="shrink-0 rounded bg-accent px-2 py-0.5 text-white hover:bg-white hover:text-accentDark"
                >
                  Admin
                </Link>
              )}
            </div>
            <div className="order-2 ml-auto flex items-center gap-2 text-sm sm:order-3 sm:gap-3">
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
                {fmtPoints(user.balance)} pts
              </span>
              <span className="hidden text-white/70 sm:inline">
                {user.username}
              </span>
              <NotificationBell />
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md border border-white/30 px-2 py-1 text-xs text-white hover:bg-white hover:text-accentDark sm:px-3 sm:text-sm"
                >
                  <span className="sm:hidden">Sortir</span>
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </form>
            </div>
          </nav>
        </header>
        <UpcomingMatchesBanner matches={matches} players={playersById} />
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </main>
        <FloatingBetBasket balance={user.balance} />
      </div>
    </BasketProvider>
  );
}
