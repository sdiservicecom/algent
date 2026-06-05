import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';
import {
  adjustUserBalance,
  getUser,
  setUserPasswordHash,
  setUserRole,
} from '@/lib/users';
import { bumpCache, cachedListUsers as listUsers } from '@/lib/cache';
import { logAudit } from '@/lib/audit';
import { fmtPoints } from '@/lib/format';
import { ConfirmForm } from '@/components/admin/ConfirmForm';

/** Mot de passe temporaire alphanumérique (12 chars, sans 0/O/I/l ambigus). */
function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function promote(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  const target = await getUser(id);
  if (!target) return;
  await setUserRole(id, 'ADMIN');
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'USER_PROMOTE',
    targetId: id,
    targetLabel: target.username,
  });
  bumpCache('users', 'leaderboard');
  revalidatePath('/admin/users');
}

async function demote(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  if (id === session.sub) {
    return redirect('/admin/users?error=self-demote');
  }
  const target = await getUser(id);
  if (!target) return;
  // Garde-fou : il faut au moins 1 admin restant
  const users = await listUsers();
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  if (adminCount <= 1) {
    return redirect('/admin/users?error=last-admin');
  }
  await setUserRole(id, 'USER');
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'USER_DEMOTE',
    targetId: id,
    targetLabel: target.username,
  });
  bumpCache('users', 'leaderboard');
  revalidatePath('/admin/users');
}

async function resetPassword(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  const target = await getUser(id);
  if (!target) return;
  const temp = generateTempPassword();
  const hash = await bcrypt.hash(temp, 10);
  await setUserPasswordHash(id, hash);
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'USER_PASSWORD_RESET',
    targetId: id,
    targetLabel: target.username,
  });
  bumpCache('users');
  revalidatePath('/admin/users');
  redirect(
    `/admin/users?resetUser=${encodeURIComponent(target.username)}&resetTemp=${encodeURIComponent(temp)}`,
  );
}

async function adjust(formData: FormData) {
  'use server';
  const session = await requireAdmin();
  const id = String(formData.get('id'));
  const amount = Number(formData.get('amount'));
  const reason = String(formData.get('reason') ?? '').slice(0, 200);
  if (!Number.isFinite(amount) || amount === 0) {
    return redirect('/admin/users?error=amount');
  }
  const target = await getUser(id);
  if (!target) return;
  try {
    await adjustUserBalance(id, Math.floor(amount), reason || 'admin');
  } catch {
    return redirect('/admin/users?error=insufficient');
  }
  await logAudit({
    adminId: session.sub,
    adminUsername: session.username,
    action: 'USER_ADJUST_BALANCE',
    targetId: id,
    targetLabel: target.username,
    metadata: { amount, reason },
  });
  bumpCache('users', 'leaderboard');
  revalidatePath('/admin/users');
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    resetUser?: string;
    resetTemp?: string;
  }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const users = (await listUsers()).sort((a, b) => b.balance - a.balance);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>
      {sp.error && (
        <div className="card border-danger/40 text-danger">
          {sp.error === 'last-admin'
            ? 'Impossible de rétrograder : il faut au moins un administrateur.'
            : sp.error === 'self-demote'
              ? "Tu ne peux pas te rétrograder toi-même."
              : sp.error === 'insufficient'
                ? "Solde de l'utilisateur insuffisant pour ce retrait."
                : 'Erreur — montant invalide.'}
        </div>
      )}
      {sp.resetUser && sp.resetTemp && (
        <div className="card border-accent/40 bg-accent/5">
          <div className="text-sm font-semibold text-accent">
            Nouveau mot de passe temporaire pour{' '}
            <span className="font-mono">{sp.resetUser}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-md bg-bg/60 px-3 py-2 font-mono text-base text-fg">
              {sp.resetTemp}
            </code>
          </div>
          <p className="mt-2 text-xs text-fg/65">
            Partage-le et invite l'utilisateur à le changer depuis son
            profil. Ce mot de passe ne sera plus jamais affiché ici.
          </p>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table-stack w-full text-sm md:min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
              <th className="px-3 py-2">Utilisateur</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2 text-right">Solde</th>
              <th className="px-3 py-2 text-right">Ajuster</th>
              <th className="px-3 py-2 text-right">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === session.sub;
              return (
                <tr key={u.id} className="border-b border-border/50">
                  <td data-label="Utilisateur" className="px-3 py-2">
                    <div className="font-medium">{u.username}</div>
                    <div className="text-xs text-fg/50">
                      {u.firstName} {u.lastName}
                    </div>
                  </td>
                  <td data-label="Rôle" className="px-3 py-2">
                    <span
                      className={`pill ${
                        u.role === 'ADMIN'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-fg/10 text-fg/70'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td
                    data-label="Solde"
                    className="px-3 py-2 text-right font-mono"
                  >
                    {fmtPoints(u.balance)}
                  </td>
                  <td data-label="Ajuster" className="px-3 py-2 text-right">
                    <form
                      action={adjust}
                      className="flex items-center justify-end gap-1"
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        name="amount"
                        type="number"
                        step={1}
                        placeholder="±pts"
                        className="input w-24 text-right"
                      />
                      <input
                        name="reason"
                        placeholder="motif"
                        className="input w-32"
                      />
                      <button className="btn-secondary" type="submit">
                        OK
                      </button>
                    </form>
                  </td>
                  <td data-label="Action" className="px-3 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      {u.role === 'USER' ? (
                        <form action={promote}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="btn-secondary" type="submit">
                            Promouvoir admin
                          </button>
                        </form>
                      ) : (
                        <form action={demote}>
                          <input type="hidden" name="id" value={u.id} />
                          <button
                            className="btn-secondary"
                            type="submit"
                            disabled={isMe}
                          >
                            Rétrograder
                          </button>
                        </form>
                      )}
                      <ConfirmForm
                        action={resetPassword}
                        confirmText={`Générer un nouveau mot de passe temporaire pour ${u.username} ? Le mot de passe actuel sera invalidé.`}
                        buttonLabel="Reset mdp"
                        buttonClassName="btn-secondary text-xs"
                        hiddenFields={{ id: u.id }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
