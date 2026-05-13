import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cachedListMatches as listMatches } from '@/lib/cache';
import { cachedListPlayers as listPlayers } from '@/lib/cache';
import { fmtPlayerName } from '@/lib/format';
import { BrandLogo } from '@/components/BrandLogo';

/**
 * Page d'aiguillage pour la vue grand écran :
 *  - 1 seul match LIVE / LOCKED → redirige direct sur /live/<id>
 *  - plusieurs → liste-picker (utile pour la régie depuis une TV)
 *  - aucun → écran "Aucun match en direct"
 */
export default async function LiveIndexPage() {
  const [matches, players] = await Promise.all([listMatches(), listPlayers()]);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));
  const live = matches
    .filter((m) => m.status === 'IN_PROGRESS' || m.status === 'LOCKED')
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  if (live.length === 1) {
    redirect(`/live/${live[0].id}`);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <BrandLogo href="" size="lg" />
      {live.length === 0 ? (
        <>
          <h1 className="text-3xl font-bold">Aucun match en direct</h1>
          <p className="text-fg/65">
            Cette vue grand écran s'activera dès qu'un match passera en
            statut « En cours ».
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Choisis le match à afficher</h1>
          <ul className="grid w-full gap-3">
            {live.map((m) => {
              const pa = playerMap[m.playerAId];
              const pb = playerMap[m.playerBId];
              return (
                <li key={m.id}>
                  <Link
                    href={`/live/${m.id}`}
                    className="card flex items-center justify-between gap-3 hover:border-accent"
                  >
                    <span className="text-lg font-semibold">
                      {pa ? fmtPlayerName(pa) : '?'} vs{' '}
                      {pb ? fmtPlayerName(pb) : '?'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-danger/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-danger">
                      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-danger" />
                      Live
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

export const dynamic = 'force-dynamic';
