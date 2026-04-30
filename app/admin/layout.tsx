import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearSessionCookie, requireAdmin } from '@/lib/auth';

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
  return (
    <div className="min-h-screen">
      <header className="bg-accentDark text-white">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-3 sm:gap-6 sm:px-4">
          <Link
            href="/admin"
            className="font-display text-xl font-semibold tracking-tight text-white"
          >
            Algent · Admin
          </Link>
          <div className="order-3 -mx-3 flex w-full items-center gap-3 overflow-x-auto px-3 text-sm sm:order-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            <Link href="/admin" className="shrink-0 text-white/80 hover:text-white">
              Vue d'ensemble
            </Link>
            <Link href="/admin/players" className="shrink-0 text-white/80 hover:text-white">
              Joueurs
            </Link>
            <Link href="/admin/matches" className="shrink-0 text-white/80 hover:text-white">
              Matchs
            </Link>
            <Link
              href="/admin/tournament"
              className="shrink-0 text-white/80 hover:text-white"
            >
              Tournoi
            </Link>
            <Link href="/admin/users" className="shrink-0 text-white/80 hover:text-white">
              Utilisateurs
            </Link>
            <Link href="/admin/audit" className="shrink-0 text-white/80 hover:text-white">
              Journal
            </Link>
            <Link href="/dashboard" className="shrink-0 text-white/80 hover:text-white">
              ← Retour app
            </Link>
          </div>
          <div className="order-2 ml-auto flex items-center gap-2 text-sm sm:order-3 sm:gap-3">
            <span className="hidden text-white/70 sm:inline">
              {session.username}
            </span>
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
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
