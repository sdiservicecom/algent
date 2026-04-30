import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearSessionCookie, getCurrentUser } from '@/lib/auth';
import { fmtPoints } from '@/lib/format';
import {
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { BasketProvider } from '@/components/BasketContext';
import { FloatingBetBasket } from '@/components/FloatingBetBasket';
import { NotificationBell } from '@/components/NotificationBell';
import { HeaderNav, type NavItem } from '@/components/HeaderNav';
import { UpcomingMatchesBanner } from '@/components/UpcomingMatchesBanner';

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

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/matches', label: 'Matchs' },
    { href: '/bracket', label: 'Bracket' },
    { href: '/history', label: 'Historique' },
    { href: '/leaderboard', label: 'Classement' },
    { href: '/tournament', label: 'Tournoi' },
    { href: '/stats', label: 'Stats' },
    ...(user.role === 'ADMIN'
      ? [{ href: '/admin', label: 'Admin', highlighted: true }]
      : []),
  ];

  return (
    <BasketProvider>
      <div className="min-h-screen pb-24">
        <header className="bg-accentDark text-white">
          <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:gap-6 sm:px-4">
            <Link
              href="/dashboard"
              className="font-display text-xl font-semibold tracking-tight text-white"
            >
              Algent
            </Link>

            <HeaderNav items={navItems} />

            <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
                {fmtPoints(user.balance)} pts
              </span>
              <span className="hidden text-white/70 lg:inline">
                {user.username}
              </span>
              <NotificationBell />
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md border border-white/30 px-2 py-1 text-xs text-white hover:bg-white hover:text-accentDark sm:px-3 sm:text-sm"
                  aria-label="Déconnexion"
                  title="Déconnexion"
                >
                  <span className="sm:hidden" aria-hidden>
                    ⎋
                  </span>
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
