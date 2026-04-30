import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function createPlayer(formData: FormData) {
  'use server';
  await requireAdmin();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const seed = Number(formData.get('seed'));
  if (!firstName || !lastName || !Number.isFinite(seed) || seed < 1) {
    return redirect('/admin/players?error=validation');
  }
  try {
    await prisma.player.create({ data: { firstName, lastName, seed } });
  } catch {
    return redirect('/admin/players?error=seed-taken');
  }
  revalidatePath('/admin/players');
  redirect('/admin/players?ok=1');
}

async function deletePlayer(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  const used = await prisma.match.count({
    where: {
      OR: [{ playerAId: id }, { playerBId: id }],
      NOT: { status: 'CANCELLED' },
    },
  });
  if (used > 0) return redirect('/admin/players?error=in-use');
  await prisma.player.delete({ where: { id } });
  revalidatePath('/admin/players');
  redirect('/admin/players');
}

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const players = await prisma.player.findMany({
    orderBy: { seed: 'asc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Joueurs</h1>

      <form action={createPlayer} className="card grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="label">Prénom</label>
          <input name="firstName" required className="input" />
        </div>
        <div>
          <label className="label">Nom</label>
          <input name="lastName" required className="input" />
        </div>
        <div>
          <label className="label">Seed</label>
          <input
            name="seed"
            type="number"
            min={1}
            required
            className="input"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit">
            Ajouter
          </button>
        </div>
        {sp.error && (
          <p className="md:col-span-4 text-sm text-danger">
            {sp.error === 'seed-taken'
              ? 'Ce seed est déjà attribué.'
              : sp.error === 'in-use'
                ? 'Ce joueur est utilisé dans un match.'
                : 'Champs invalides.'}
          </p>
        )}
        {sp.ok && (
          <p className="md:col-span-4 text-sm text-success">Joueur ajouté.</p>
        )}
      </form>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg/30 text-left text-xs uppercase text-white/50">
              <th className="px-3 py-2">Seed</th>
              <th className="px-3 py-2">Joueur</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="px-3 py-2 font-mono">#{p.seed}</td>
                <td className="px-3 py-2">
                  {p.firstName} {p.lastName}
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={deletePlayer} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-danger" type="submit">
                      Supprimer
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
