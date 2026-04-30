import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearSessionCookie, getCurrentUser } from '@/lib/auth';
import { fmtPoints } from '@/lib/format';
import { listMatches } from '@/lib/matches';
import { listPlayers } from '@/lib/players';
import { UpcomingMatchesBanner } from '@/components/UpcomingMatchesBanner';
import { BasketProvider } from '@/components/BasketContext';
import { FloatingBetBasket } from '@/components/FloatingBetBasket';

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
        <header className="border-b border-border bg-surface/60 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-3 sm:gap-6 sm:px-4">
            <Link href="/dashboard" className="text-lg font-bold text-accent">
              Algent
            </Link>
            <div className="order-3 -mx-3 flex w-full items-center gap-3 overflow-x-auto px-3 text-sm sm:order-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
              <Link href="/dashboard" className="shrink-0 hover:text-accent">
                Dashboard
              </Link>
              <Link href="/matches" className="shrink-0 hover:text-accent">
                Matchs
              </Link>
              <Link href="/history" className="shrink-0 hover:text-accent">
                Historique
              </Link>
              <Link href="/leaderboard" className="shrink-0 hover:text-accent">
                Classement
              </Link>
              <Link href="/tournament" className="shrink-0 hover:text-accent">
                Tournoi
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="shrink-0 text-accent hover:underline"
                >
                  Admin
                </Link>
              )}
            </div>
            <div className="order-2 ml-auto flex items-center gap-2 text-sm sm:order-3 sm:gap-3">
              <span className="pill bg-accent/20 text-accent">
                {fmtPoints(user.balance)} pts
              </span>
              <span className="hidden text-white/60 sm:inline">
                {user.username}
              </span>
              <form action={logout}>
                <button className="btn-secondary text-xs sm:text-sm" type="submit">
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
