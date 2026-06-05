import Link from 'next/link';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { requireUser } from '@/lib/auth';
import { getUser, setUserPasswordHash } from '@/lib/users';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

async function changePassword(formData: FormData) {
  'use server';
  const session = await requireUser();
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (next.length < 6) {
    return redirect('/profile/password?error=tooShort');
  }
  if (next !== confirm) {
    return redirect('/profile/password?error=mismatch');
  }

  const user = await getUser(session.sub);
  if (!user) return redirect('/profile/password?error=notFound');

  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) {
    return redirect('/profile/password?error=wrongCurrent');
  }

  const hash = await bcrypt.hash(next, 10);
  await setUserPasswordHash(session.sub, hash);
  redirect('/profile?passwordChanged=1');
}

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  return (
    <div className="space-y-5">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-fg/70 hover:text-fg"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Retour au profil
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Changer mon mot de passe</h1>
        <p className="mt-1 text-sm text-fg/65">
          Renseigne ton mot de passe actuel pour pouvoir en définir un
          nouveau (6 caractères minimum).
        </p>
      </header>

      <ChangePasswordForm action={changePassword} errorCode={sp.error} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
