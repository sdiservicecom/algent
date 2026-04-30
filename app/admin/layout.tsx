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
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/admin" className="text-lg font-bold text-accent">
            Algent · Admin
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:text-accent">
              Vue d'ensemble
            </Link>
            <Link href="/admin/players" className="hover:text-accent">
              Joueurs
            </Link>
            <Link href="/admin/matches" className="hover:text-accent">
              Matchs
            </Link>
            <Link href="/dashboard" className="hover:text-accent">
              ← Retour app
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-white/60">{session.username}</span>
            <form action={logout}>
              <button className="btn-secondary" type="submit">
                Déconnexion
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
