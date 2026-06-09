import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  requireUser,
  setSessionCookie,
  signSession,
} from '@/lib/auth';
import { bumpCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';
import { UserError, getUser, setUserUsername } from '@/lib/users';

async function updateUsername(formData: FormData) {
  'use server';
  const session = await requireUser();
  const next = String(formData.get('username') ?? '').trim();
  try {
    await setUserUsername(session.sub, next);
  } catch (e) {
    if (e instanceof UserError) {
      const code = e.code === 'USERNAME_TAKEN' ? 'taken' : 'invalid';
      return redirect(`/profile/username?error=${code}`);
    }
    throw e;
  }

  // Le pseudo est porté par le JWT de session — on le re-signe pour
  // que les pages qui le lisent (header, audit log, etc.) voient la
  // nouvelle valeur sans demander une re-connexion.
  const user = await getUser(session.sub);
  if (user) {
    const token = await signSession({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    await setSessionCookie(token);
  }

  bumpCache('users', 'leaderboard');
  revalidatePath('/profile');
  revalidatePath('/leaderboard');
  redirect('/profile?usernameChanged=1');
}

export default async function ChangeUsernamePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const user = await getUser(session.sub);

  return (
    <div className="space-y-5">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-fg/70 hover:text-fg"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Retour au profil
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Changer mon pseudo</h1>
        <p className="mt-1 text-sm text-fg/65">
          Choisis un nouveau pseudo (3 caractères minimum). Il doit être
          disponible — si quelqu'un d'autre l'a déjà pris, tu seras
          prévenu.
        </p>
      </header>

      <form action={updateUsername} className="space-y-3">
        <input
          name="username"
          required
          minLength={3}
          defaultValue={user?.username ?? ''}
          placeholder="Nouveau pseudo"
          className="input"
          autoComplete="username"
        />
        {sp.error && (
          <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {sp.error === 'taken'
              ? 'Ce pseudo est déjà pris, choisis-en un autre.'
              : 'Pseudo invalide (3 caractères minimum).'}
          </div>
        )}
        <button type="submit" className="btn-primary w-full">
          Mettre à jour
        </button>
      </form>
    </div>
  );
}

export const dynamic = 'force-dynamic';
