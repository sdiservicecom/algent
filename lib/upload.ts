import { put } from '@vercel/blob';
import { newId } from './kv';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export class UploadError extends Error {
  constructor(
    public code: 'TOO_LARGE' | 'BAD_TYPE' | 'BLOB_NOT_CONFIGURED' | 'FAILED',
    /** Message diagnostique récupéré du SDK Vercel Blob — utile pour
     *  l'admin (logué + transmis à l'UI). */
    public detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/**
 * Upload une image dans Vercel Blob et renvoie l'URL publique.
 * Renvoie null si le File est vide / inexistant.
 */
export async function uploadPlayerPhoto(
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_MIME.has(file.type)) throw new UploadError('BAD_TYPE');
  if (file.size > MAX_BYTES) throw new UploadError('TOO_LARGE');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new UploadError('BLOB_NOT_CONFIGURED');
  }

  const ext =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    mimeToExt(file.type);
  const filename = `players/${newId()}.${ext}`;

  try {
    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (e) {
    // Log côté serveur (Vercel) pour que l'admin puisse diagnostiquer
    // (token invalide, store supprimé, quota dépassé, etc.) — le SDK
    // Vercel Blob est très laconique côté client.
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[uploadPlayerPhoto] put() failed:', detail);
    throw new UploadError('FAILED', detail);
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}
