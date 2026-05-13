import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { PlayerError, createPlayer, deletePlayer } from '@/lib/players';
import { bumpCache, cachedListPlayers as listPlayers } from '@/lib/cache';
import { UploadError, uploadPlayerPhoto } from '@/lib/upload';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { fmtPlayerName } from '@/lib/format';

async function createPlayerAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const nickname = String(formData.get('nickname') ?? '').trim() || null;
  const seed = Number(formData.get('seed'));
  const photoFile = formData.get('photoFile') as File | null;
  const pastedUrl = String(formData.get('photoUrl') ?? '').trim() || null;

  if (!firstName || !lastName || !Number.isFinite(seed) || seed < 1) {
    return redirect('/admin/players?error=validation');
  }

  let photoUrl: string | null = pastedUrl;
  try {
    const uploaded = await uploadPlayerPhoto(photoFile);
    if (uploaded) photoUrl = uploaded;
  } catch (e) {
    if (e instanceof UploadError) {
      // Fallback gracieux : si l'admin a aussi collé une URL externe,
      // on l'utilise plutôt que de bloquer la création.
      if (pastedUrl) {
        console.warn(
          '[admin/players] upload failed, falling back to pasted URL:',
          e.detail ?? e.code,
        );
        photoUrl = pastedUrl;
      } else {
        const detail = e.detail
          ? `&detail=${encodeURIComponent(e.detail.slice(0, 200))}`
          : '';
        return redirect(
          `/admin/players?error=upload-${e.code.toLowerCase()}${detail}`,
        );
      }
    } else {
      throw e;
    }
  }

  try {
    await createPlayer({ firstName, lastName, nickname, seed, photoUrl });
  } catch (e) {
    if (e instanceof PlayerError && e.code === 'SEED_TAKEN') {
      return redirect('/admin/players?error=seed-taken');
    }
    return redirect('/admin/players?error=validation');
  }
  bumpCache('players');
  revalidatePath('/admin/players');
  redirect('/admin/players?ok=1');
}

async function deletePlayerAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  try {
    await deletePlayer(id);
  } catch (e) {
    if (e instanceof PlayerError && e.code === 'IN_USE') {
      return redirect('/admin/players?error=in-use');
    }
    throw e;
  }
  bumpCache('players');
  revalidatePath('/admin/players');
  redirect('/admin/players');
}

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; detail?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const players = await listPlayers();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Joueurs</h1>

      <form
        action={createPlayerAction}
        encType="multipart/form-data"
        className="card grid grid-cols-1 gap-3 md:grid-cols-6"
      >
        <div className="md:col-span-2">
          <label className="label">Prénom</label>
          <input name="firstName" required className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Nom</label>
          <input name="lastName" required className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Pseudo (optionnel)</label>
          <input name="nickname" className="input" />
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
        <div className="md:col-span-3">
          <label className="label">Photo (upload, max 5 Mo)</label>
          <input
            name="photoFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="input file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1 file:text-white"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">… ou URL externe</label>
          <input
            name="photoUrl"
            type="url"
            placeholder="https://…"
            className="input"
          />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button className="btn-primary md:w-auto" type="submit">
            Ajouter le joueur
          </button>
        </div>
        {sp.error && (
          <div className="md:col-span-6 text-sm text-danger">
            <p>{errorLabel(sp.error)}</p>
            {sp.detail && (
              <p className="mt-1 break-words font-mono text-xs text-fg/60">
                {sp.detail}
              </p>
            )}
          </div>
        )}
        {sp.ok && (
          <p className="md:col-span-6 text-sm text-success">Joueur ajouté.</p>
        )}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-fg/5 text-left text-xs uppercase text-fg/50">
              <th className="px-3 py-2">Seed</th>
              <th className="px-3 py-2">Joueur</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td data-label="Seed" className="px-3 py-2 font-mono">#{p.seed}</td>
                <td data-label="Joueur" className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={p} size={32} />
                    <span>{fmtPlayerName(p)}</span>
                  </div>
                </td>
                <td data-label="Actions" className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/players/${p.id}`}
                      className="btn-secondary"
                    >
                      Modifier
                    </Link>
                    <form action={deletePlayerAction} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn-danger" type="submit">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function errorLabel(code: string): string {
  switch (code) {
    case 'seed-taken':
      return 'Ce seed est déjà attribué.';
    case 'in-use':
      return 'Ce joueur est utilisé dans un match.';
    case 'upload-too_large':
      return 'Image trop lourde (max 5 Mo).';
    case 'upload-bad_type':
      return 'Format non supporté (JPEG, PNG, WebP ou GIF).';
    case 'upload-blob_not_configured':
      return "Vercel Blob n'est pas branché au projet — connecte-le dans Storage, ou utilise une URL externe.";
    case 'upload-failed':
      return "Échec de l'upload. Réessaie ou utilise une URL externe.";
    default:
      return 'Champs invalides.';
  }
}

export const dynamic = 'force-dynamic';
