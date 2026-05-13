import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getSession, setSessionCookie, signSession } from '@/lib/auth';
import { UserError, createUser } from '@/lib/users';
import { checkLimit, limits } from '@/lib/ratelimit';
import { AuthHero } from '@/components/AuthHero';
import { RegisterForm } from '@/components/RegisterForm';

async function register(formData: FormData) {
  'use server';
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const service = String(formData.get('service') ?? '').trim();

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
      service: service.length > 0 ? service : null,
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
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col">
      <AuthHero />
      <div className="flex-1 px-6 pb-8 pt-2">
        <h1 className="mb-6 text-center text-3xl font-bold">
          Devenez un parieur&nbsp;!
        </h1>
        <RegisterForm
          action={register}
          errorCode={sp.error}
          errorDetail={sp.detail}
        />
        <div className="my-6 flex items-center gap-3 text-xs text-fg/40">
          <span className="h-px flex-1 bg-border" />
          <span className="uppercase">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Link href="/login" className="btn-outline-accent w-full">
          Se connecter
        </Link>
        <p className="mt-6 text-center text-xs text-fg/50">
          SDI Bet est un site de paris fictif créé pour parier sur les matchs du
          tournoi de ping-pong. Le site n'est pas lié au CSE de l'entreprise, ni
          même à l'entreprise.
        </p>
      </div>
    </main>
  );
}
