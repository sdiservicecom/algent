import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getSession, setSessionCookie, signSession } from '@/lib/auth';
import { UserError, createUser } from '@/lib/users';
import { checkLimit, limits } from '@/lib/ratelimit';

async function register(formData: FormData) {
  'use server';
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (firstName.length < 1) return redirect('/register?error=firstName');
  if (lastName.length < 1) return redirect('/register?error=lastName');
  if (username.length < 3) return redirect('/register?error=username');
  if (password.length < 6) return redirect('/register?error=password');

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const rl = await checkLimit(limits.register, ip);
  if (!rl.ok) return redirect('/register?error=ratelimit');

  let user;
  try {
    user = await createUser({
      firstName,
      lastName,
      username,
      passwordHash: await bcrypt.hash(password, 10),
    });
  } catch (e) {
    if (e instanceof UserError && e.code === 'USERNAME_TAKEN') {
      return redirect('/register?error=taken');
    }
    console.error('[register] createUser failed:', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return redirect(
      `/register?error=server&detail=${encodeURIComponent(msg)}`,
    );
  }

  try {
    const token = await signSession({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    await setSessionCookie(token);
  } catch (e) {
    console.error('[register] signSession failed:', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return redirect(
      `/register?error=session&detail=${encodeURIComponent(msg)}`,
    );
  }

  redirect('/dashboard');
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full">
        <h1 className="mb-6 text-2xl font-bold">Créer un compte</h1>
        <form action={register} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">
                Prénom
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="lastName">
                Nom
              </label>
              <input id="lastName" name="lastName" required className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="username">
              Pseudonyme (3 caractères min.)
            </label>
            <input
              id="username"
              name="username"
              required
              minLength={3}
              className="input"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe (6 caractères min.)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="input"
              autoComplete="new-password"
            />
          </div>
          {sp.error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
              <p className="text-danger">{errorMessage(sp.error)}</p>
              {sp.detail && (
                <p className="mt-1 break-words font-mono text-xs text-fg/60">
                  {sp.detail}
                </p>
              )}
            </div>
          )}
          <button className="btn-primary w-full" type="submit">
            Créer mon compte
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-fg/60">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case 'firstName':
      return 'Prénom requis.';
    case 'lastName':
      return 'Nom requis.';
    case 'username':
      return 'Le pseudonyme doit faire 3 caractères minimum.';
    case 'password':
      return 'Le mot de passe doit faire 6 caractères minimum.';
    case 'taken':
      return 'Ce pseudonyme est déjà pris.';
    case 'ratelimit':
      return 'Trop de créations de compte — réessaie dans 10 minutes.';
    case 'server':
      return 'Erreur serveur — vérifie que Vercel KV est bien connecté au projet (variables KV_*).';
    case 'session':
      return 'Erreur de session — vérifie que la variable AUTH_SECRET est définie sur Vercel.';
    default:
      return 'Erreur inconnue.';
  }
}
