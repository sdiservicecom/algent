import Link from 'next/link';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { TxType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyWalletDelta } from '@/lib/wallet';
import { getSession, setSessionCookie, signSession } from '@/lib/auth';

const INITIAL_CREDIT = 1000;

async function register(formData: FormData) {
  'use server';
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (
    firstName.length < 1 ||
    lastName.length < 1 ||
    username.length < 3 ||
    password.length < 6
  ) {
    return redirect('/register?error=validation');
  }

  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });
  if (existing) return redirect('/register?error=taken');

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { firstName, lastName, username, passwordHash, balance: 0 },
    });
    await applyWalletDelta(tx, u.id, INITIAL_CREDIT, TxType.INITIAL_CREDIT);
    return u;
  });

  const token = await signSession({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  await setSessionCookie(token);
  redirect('/dashboard');
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
              Pseudonyme
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
            <p className="text-sm text-danger">
              {sp.error === 'taken'
                ? 'Ce pseudonyme est déjà pris.'
                : 'Veuillez vérifier les champs.'}
            </p>
          )}
          <button className="btn-primary w-full" type="submit">
            Créer mon compte
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/60">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
