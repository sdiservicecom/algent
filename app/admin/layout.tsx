import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearSessionCookie, requireAdmin } from '@/lib/auth';
import { HeaderNav, type NavItem } from '@/components/HeaderNav';

async function logout() {
  'use server';
  await clearSessionCookie();
  redirect('/login');
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  const navItems: NavItem[] = [
    { href: '/admin', label: "Vue d'ensemble" },
    { href: '/admin/players', label: 'Joueurs' },
    { href: '/admin/matches', label: 'Matchs' },
    { href: '/admin/tournament', label: 'Tournoi' },
    { href: '/admin/users', label: 'Utilisateurs' },
    { href: '/admin/audit', label: 'Journal' },
    { href: '/dashboard', label: '← Retour app' },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-accentDark text-white">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:gap-6 sm:px-4">
          <Link
            href="/admin"
            className="font-display text-xl font-semibold tracking-tight text-white"
          >
            Algent · Admin
          </Link>

          <HeaderNav items={navItems} />

          <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
            <span className="hidden text-white/70 lg:inline">
              {session.username}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-2 py-1 text-xs text-white hover:bg-white hover:text-accentDark sm:px-3 sm:text-sm"
                aria-label="Déconnexion"
                title="Déconnexion"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="sm:hidden"
                  aria-hidden
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
