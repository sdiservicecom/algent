import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 text-center">
      <div>
        <div className="mb-2 text-5xl">🔎</div>
        <h1 className="mb-2 text-2xl font-bold">Introuvable</h1>
        <p className="mb-6 text-sm text-fg/60">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Retour au dashboard
        </Link>
      </div>
    </main>
  );
}
