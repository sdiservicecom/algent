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
      <header className="border-b border-border bg-surface/60">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-3 sm:gap-6 sm:px-4">
          <Link href="/admin" className="text-lg font-bold text-accent">
            Algent · Admin
          </Link>
          <div className="order-3 -mx-3 flex w-full items-center gap-3 overflow-x-auto px-3 text-sm sm:order-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            <Link href="/admin" className="shrink-0 hover:text-accent">
              Vue d'ensemble
            </Link>
            <Link href="/admin/players" className="shrink-0 hover:text-accent">
              Joueurs
            </Link>
            <Link href="/admin/matches" className="shrink-0 hover:text-accent">
              Matchs
            </Link>
            <Link
              href="/admin/tournament"
              className="shrink-0 hover:text-accent"
            >
              Tournoi
            </Link>
            <Link href="/dashboard" className="shrink-0 hover:text-accent">
              ← Retour app
            </Link>
          </div>
          <div className="order-2 ml-auto flex items-center gap-2 text-sm sm:order-3 sm:gap-3">
            <span className="hidden text-white/60 sm:inline">
              {session.username}
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
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
