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
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
