import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import {
  PlayerError,
  getPlayer,
  updatePlayer,
} from '@/lib/players';
import { UploadError, uploadPlayerPhoto } from '@/lib/upload';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { fmtPlayerName } from '@/lib/format';
import { bumpCache, cachedListUsers } from '@/lib/cache';

async function updatePlayerAction(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id'));
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const nickname = String(formData.get('nickname') ?? '').trim();
  const seed = Number(formData.get('seed'));
  const photoFile = formData.get('photoFile') as File | null;
  const pastedUrl = String(formData.get('photoUrl') ?? '').trim();
  const removePhoto = formData.get('removePhoto') === 'on';
  const linkedUserIdRaw = String(formData.get('linkedUserId') ?? '');
  const linkedUserId = linkedUserIdRaw === '' ? null : linkedUserIdRaw;

  if (!id || !firstName || !lastName || !Number.isFinite(seed) || seed < 1) {
    return redirect(`/admin/players/${id}?error=validation`);
  }

  // photoUrl: undefined = pas de changement, null = retirer, string = nouveau
  let photoUrl: string | null | undefined;
  if (removePhoto) {
    photoUrl = null;
  } else {
    try {
      const uploaded = await uploadPlayerPhoto(photoFile);
      if (uploaded) {
        photoUrl = uploaded;
      } else if (pastedUrl) {
        photoUrl = pastedUrl;
      }
    } catch (e) {
      if (e instanceof UploadError) {
        return redirect(
          `/admin/players/${id}?error=upload-${e.code.toLowerCase()}`,
        );
      }
      throw e;
    }
  }

  try {
    await updatePlayer(id, {
      firstName,
      lastName,
      nickname,
      seed,
      linkedUserId,
      ...(photoUrl !== undefined ? { photoUrl } : {}),
    });
  } catch (e) {
    if (e instanceof PlayerError) {
      if (e.code === 'SEED_TAKEN')
        return redirect(`/admin/players/${id}?error=seed-taken`);
      if (e.code === 'NOT_FOUND') return redirect('/admin/players');
    }
    throw e;
  }

  bumpCache('players', 'matches');
  revalidatePath('/admin/players');
  revalidatePath(`/admin/players/${id}`);
  revalidatePath('/matches');
  redirect(`/admin/players/${id}?ok=1`);
}

export default async function AdminPlayerEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const [player, users] = await Promise.all([
    getPlayer(id),
    cachedListUsers(),
  ]);
  if (!player) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier le joueur</h1>
        <Link href="/admin/players" className="btn-secondary">
          ← Retour
        </Link>
      </div>

      <div className="card flex items-center gap-4">
        <PlayerAvatar player={player} size={72} />
        <div>
          <div className="text-lg font-semibold">{fmtPlayerName(player)}</div>
          <div className="text-sm text-fg/60">
            Seed actuel : #{player.seed}
          </div>
        </div>
      </div>

      <form
        action={updatePlayerAction}
        encType="multipart/form-data"
        className="card grid grid-cols-1 gap-3 md:grid-cols-6"
      >
        <input type="hidden" name="id" value={player.id} />

        <div className="md:col-span-2">
          <label className="label">Prénom</label>
          <input
            name="firstName"
            required
            defaultValue={player.firstName}
            className="input"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Nom</label>
          <input
            name="lastName"
            required
            defaultValue={player.lastName}
            className="input"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Pseudo (optionnel)</label>
          <input
            name="nickname"
            defaultValue={player.nickname ?? ''}
            className="input"
          />
        </div>
        <div>
          <label className="label">Seed</label>
          <input
            name="seed"
            type="number"
            min={1}
            required
            defaultValue={player.seed}
            className="input"
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">
            Nouvelle photo (upload, max 5 Mo)
          </label>
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
        <div className="md:col-span-3">
          <label className="label">Compte utilisateur lié (optionnel)</label>
          <select
            name="linkedUserId"
            defaultValue={player.linkedUserId ?? ''}
            className="input"
          >
            <option value="">— Aucun —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.firstName} {u.lastName})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-fg/50">
            Permet de reconnaître le joueur sur l'app et d'afficher un badge
            « C'est vous » sur ses matchs.
          </p>
        </div>
        {player.photoUrl && (
          <label className="md:col-span-6 inline-flex items-center gap-2 text-sm text-fg/70">
            <input
              type="checkbox"
              name="removePhoto"
              className="h-4 w-4 accent-danger"
            />
            Supprimer la photo actuelle (sera ignoré si tu uploades une
            nouvelle photo)
          </label>
        )}
        <div className="md:col-span-6 flex justify-end">
          <button className="btn-primary md:w-auto" type="submit">
            Enregistrer
          </button>
        </div>
        {sp.error && (
          <p className="md:col-span-6 text-sm text-danger">
            {errorLabel(sp.error)}
          </p>
        )}
        {sp.ok && (
          <p className="md:col-span-6 text-sm text-success">
            Modifications enregistrées.
          </p>
        )}
      </form>
    </div>
  );
}

function errorLabel(code: string): string {
  switch (code) {
    case 'seed-taken':
      return 'Ce seed est déjà attribué à un autre joueur.';
    case 'upload-too_large':
      return 'Image trop lourde (max 5 Mo).';
    case 'upload-bad_type':
      return 'Format non supporté (JPEG, PNG, WebP ou GIF).';
    case 'upload-blob_not_configured':
      return "Vercel Blob n'est pas branché au projet — utilise une URL externe.";
    case 'upload-failed':
      return "Échec de l'upload.";
    default:
      return 'Champs invalides.';
  }
}

export const dynamic = 'force-dynamic';
