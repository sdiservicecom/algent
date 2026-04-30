'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 text-center">
      <div>
        <div className="mb-2 text-5xl">⚠️</div>
        <h1 className="mb-2 text-2xl font-bold">Une erreur est survenue</h1>
        <p className="mb-4 text-sm text-fg/60">
          On a logué l'incident côté serveur. Tu peux réessayer.
        </p>
        {error.digest && (
          <p className="mb-4 break-all font-mono text-xs text-fg/40">
            digest : {error.digest}
          </p>
        )}
        <button onClick={reset} className="btn-primary">
          Réessayer
        </button>
      </div>
    </main>
  );
}
