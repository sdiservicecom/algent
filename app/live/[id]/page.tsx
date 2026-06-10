import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMatch } from '@/lib/matches';
import { getPlayer } from '@/lib/players';
import { fmtPlayerName } from '@/lib/format';
import { AutoRefresh } from '@/components/AutoRefresh';
import { BrandLogo } from '@/components/BrandLogo';
import { PlayerAvatar } from '@/components/PlayerAvatar';

/**
 * Vue grand écran centrée sur un match. Pensée pour une TV / un
 * projecteur posé dans une salle commune : pas de header ni de
 * bottom-nav (cette route est volontairement hors du groupe (app)),
 * pas d'auth (cf. middleware PUBLIC_PREFIXES), tout est en
 * gigantesque pour qu'on lise à 5 mètres.
 *
 * Volontairement minimaliste : seulement les joueurs et le score —
 * pas de cote, pas de répartition de paris (l'écran sert avant tout
 * de tableau d'affichage du match en lui-même).
 */
export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const [pa, pb, winner] = await Promise.all([
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
    match.winnerId ? getPlayer(match.winnerId) : Promise.resolve(null),
  ]);
  if (!pa || !pb) notFound();

  const isLive = match.status === 'IN_PROGRESS';
  const isLocked = match.status === 'LOCKED';
  const isSettled = match.status === 'SETTLED';

  const aIsWinner = isSettled && winner?.id === pa.id;
  const bIsWinner = isSettled && winner?.id === pb.id;

  return (
    <main className="relative flex min-h-[100dvh] flex-col px-6 py-8 sm:px-10 sm:py-10">
      {/* Auto-refresh agressif pour suivre la moindre variation. */}
      <AutoRefresh intervalMs={isLive || isLocked ? 3_000 : 30_000} />

      {/* Bandeau du haut : marque + statut + lien retour discret */}
      <header className="flex items-center justify-between">
        <BrandLogo href="" size="lg" />
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="inline-flex items-center gap-2 rounded-full bg-danger/15 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-danger">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-danger" />
              En direct
            </span>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-500/15 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-yellow-300">
              Coup d'envoi imminent
            </span>
          )}
          {isSettled && winner && (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-accent">
              🏆 Terminé
            </span>
          )}
          <Link
            href="/live"
            className="text-xs font-semibold text-fg/55 underline-offset-4 hover:text-fg hover:underline"
          >
            ← Autres matchs
          </Link>
        </div>
      </header>

      {/* Bloc principal : joueurs + score géant */}
      <section className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-8">
          <PlayerColumn
            player={pa}
            isWinner={aIsWinner}
            isLoser={bIsWinner}
          />
          <div className="flex flex-col items-center gap-4 text-center">
            <span
              className="font-mono text-7xl font-extrabold leading-none tracking-tight sm:text-8xl md:text-[9rem]"
              aria-label={`Score : ${match.scoreA ?? 0} à ${match.scoreB ?? 0}`}
            >
              <span className={aIsWinner ? 'text-accent' : ''}>
                {match.scoreA ?? 0}
              </span>
              <span className="mx-3 text-fg/30 sm:mx-5">–</span>
              <span className={bIsWinner ? 'text-accent' : ''}>
                {match.scoreB ?? 0}
              </span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-fg/45">
              {match.round
                ? roundLongLabel(match.round)
                : isSettled
                  ? 'Match terminé'
                  : 'Match en cours'}
            </span>
          </div>
          <PlayerColumn
            player={pb}
            isWinner={bIsWinner}
            isLoser={aIsWinner}
          />
        </div>
      </section>

      <footer className="text-center text-xs text-fg/40">
        SDI <span className="text-accentBright">Bet</span> · Score en temps réel
      </footer>
    </main>
  );
}

const ROUND_LONG: Record<string, string> = {
  R32: '16e de finale',
  R16: 'Huitième de finale',
  QF: 'Quart de finale',
  SF: 'Demi finale',
  FINAL: 'Finale',
};
const roundLongLabel = (r: string) => ROUND_LONG[r] ?? '';

interface ColProps {
  player: {
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    nickname: string | null;
  };
  isWinner: boolean;
  isLoser: boolean;
}

function PlayerColumn({ player, isWinner, isLoser }: ColProps) {
  return (
    <div
      className={`flex flex-col items-center gap-4 text-center ${
        isLoser ? 'opacity-50' : ''
      }`}
    >
      <div
        className={`rounded-full p-1 ${
          isWinner
            ? 'bg-gradient-to-br from-coin to-accent'
            : isLoser
              ? 'bg-fg/20'
              : 'bg-border'
        }`}
      >
        <PlayerAvatar
          player={player}
          size={56}
          className="!h-32 !w-32 !text-3xl sm:!h-40 sm:!w-40"
        />
      </div>
      <div>
        <div className="text-3xl font-extrabold sm:text-4xl">
          {fmtPlayerName(player)}
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
