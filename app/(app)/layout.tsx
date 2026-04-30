import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fmtPoints } from '@/lib/format';

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
  const session = await getSession();
  if (!session) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-accent">
            Algent
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:text-accent">
              Dashboard
            </Link>
            <Link href="/matches" className="hover:text-accent">
              Matchs
            </Link>
            <Link href="/history" className="hover:text-accent">
              Historique
            </Link>
            <Link href="/leaderboard" className="hover:text-accent">
              Classement
            </Link>
            {user.role === 'ADMIN' && (
              <Link href="/admin" className="text-accent hover:underline">
                Admin
              </Link>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="pill bg-accent/20 text-accent">
              {fmtPoints(user.balance)} pts
            </span>
            <span className="text-white/60">{user.username}</span>
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
