import Link from 'next/link';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getSession, setSessionCookie, signSession } from '@/lib/auth';
import { getUserByUsername } from '@/lib/users';

async function login(formData: FormData) {
  'use server';
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!username || !password) {
    return redirect('/login?error=missing');
  }
  const user = await getUserByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return redirect('/login?error=invalid');
  }
  const token = await signSession({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  await setSessionCookie(token);
  redirect('/dashboard');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <div className="w-full">
        <h1 className="mb-6 text-2xl font-bold">Connexion</h1>
        <form action={login} className="space-y-4">
          <div>
            <label className="label" htmlFor="username">
              Pseudonyme
            </label>
            <input
              id="username"
              name="username"
              required
              autoFocus
              className="input"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input"
              autoComplete="current-password"
            />
          </div>
          {sp.error && (
            <p className="text-sm text-danger">
              {sp.error === 'invalid'
                ? 'Pseudonyme ou mot de passe incorrect.'
                : 'Champs manquants.'}
            </p>
          )}
          <button className="btn-primary w-full" type="submit">
            Se connecter
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/60">
          Pas de compte ?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
