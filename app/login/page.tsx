import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getSession, setSessionCookie, signSession } from '@/lib/auth';
import { getUserByUsername } from '@/lib/users';
import { checkLimit, limits } from '@/lib/ratelimit';
import { AuthHero } from '@/components/AuthHero';
import { LoginForm } from '@/components/LoginForm';

async function login(formData: FormData) {
  'use server';
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!username || !password) {
    return redirect('/login?error=missing');
  }
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const rl = await checkLimit(limits.login, `${ip}:${username.toLowerCase()}`);
  if (!rl.ok) return redirect('/login?error=ratelimit');
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
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col">
      <AuthHero />
      <div className="flex-1 px-6 pb-8 pt-6">
        <h1 className="mb-8 text-center text-3xl font-bold">
          Rejoignez les parieurs&nbsp;!
        </h1>
        <LoginForm action={login} errorCode={sp.error} />
        <div className="my-6 flex items-center gap-3 text-xs text-fg/40">
          <span className="h-px flex-1 bg-border" />
          <span className="uppercase">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Link href="/register" className="btn-outline-accent w-full">
          Créer un compte
        </Link>
        <p className="mt-8 text-center text-xs text-fg/55">
          SDI Bet est un site de paris fictif créé pour parier sur les matchs du
          tournoi de ping-pong. Le site n'est pas lié au CSE de l'entreprise, ni
          même à l'entreprise.
        </p>
      </div>
    </main>
  );
}
