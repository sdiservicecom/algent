import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import {
  cachedListMatches as listMatches,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { fmtOdds } from '@/lib/format';
import {
  MATCH_ROUNDS,
  MATCH_ROUND_LABEL,
  type Match,
  type MatchRound,
  type Player,
} from '@/lib/types';
import { PlayerAvatar } from '@/components/PlayerAvatar';

const ROUND_ORDER: MatchRound[] = MATCH_ROUNDS;

export default async function BracketPage() {
  await requireUser();
  const [matches, players] = await Promise.all([
    listMatches(),
    listPlayers(),
  ]);
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  // Filtre les matchs ayant une phase et regroupe par round
  const byRound = new Map<MatchRound, Match[]>();
  for (const m of matches) {
    if (!m.round) continue;
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  for (const [r, list] of byRound) {
    list.sort((a, b) => {
      const sa = a.bracketSlot ?? 9999;
      const sb = b.bracketSlot ?? 9999;
      if (sa !== sb) return sa - sb;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
    byRound.set(r, list);
  }

  // Garde uniquement les rounds qui ont des matchs (et trie de la phase la plus
  // précoce vers la finale)
  const visibleRounds = ROUND_ORDER.filter((r) => byRound.has(r));

  if (visibleRounds.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Bracket</h1>
        <div className="card text-sm text-fg/60">
          Aucun match n'est encore associé à une phase. L'admin doit créer des
          matchs avec une phase (huitième, quart, demi, finale) depuis{' '}
          <Link href="/admin/matches" className="text-accent hover:underline">
            /admin/matches
          </Link>
          .
        </div>
      </div>
    );
  }

  // Fix la hauteur sur le plus grand round (généralement le premier)
  const maxCount = Math.max(
    ...visibleRounds.map((r) => byRound.get(r)!.length),
  );
  const totalHeight = Math.max(maxCount * 110, 480);

  const finalMatch =
    byRound.get('FINAL')?.[0] ??
    byRound.get('SF')?.[0] ??
    null;
  const champion =
    finalMatch?.status === 'SETTLED' && finalMatch.winnerId
      ? playersById[finalMatch.winnerId] ?? null
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bracket</h1>
        {champion && (
          <div className="rounded-md border border-success bg-success/15 px-3 py-1 text-sm">
            🏆 Champion :{' '}
            <span className="font-semibold text-success">
              {champion.firstName} {champion.lastName}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <div
          className="flex min-w-max gap-6"
          style={{ height: `${totalHeight}px` }}
        >
          {visibleRounds.map((r) => (
            <RoundColumn
              key={r}
              round={r}
              matches={byRound.get(r) ?? []}
              playersById={playersById}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundColumn({
  round,
  matches,
  playersById,
}: {
  round: MatchRound;
  matches: Match[];
  playersById: Record<string, Player>;
}) {
  return (
    <div className="flex w-[240px] flex-col">
      <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-fg/60">
        {MATCH_ROUND_LABEL[round]}
      </div>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => (
          <BracketMatch
            key={m.id}
            match={m}
            playersById={playersById}
          />
        ))}
      </div>
    </div>
  );
}

function BracketMatch({
  match,
  playersById,
}: {
  match: Match;
  playersById: Record<string, Player>;
}) {
  const pa = playersById[match.playerAId] ?? null;
  const pb = playersById[match.playerBId] ?? null;
  const aIsWinner =
    match.status === 'SETTLED' && match.winnerId === match.playerAId;
  const bIsWinner =
    match.status === 'SETTLED' && match.winnerId === match.playerBId;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block overflow-hidden rounded-md border border-border bg-surface text-xs transition hover:border-fg/40"
    >
      <BracketRow
        player={pa}
        odds={match.oddsA}
        isWinner={aIsWinner}
        isLoser={match.status === 'SETTLED' && !aIsWinner}
      />
      <div className="h-px bg-border" />
      <BracketRow
        player={pb}
        odds={match.oddsB}
        isWinner={bIsWinner}
        isLoser={match.status === 'SETTLED' && !bIsWinner}
      />
    </Link>
  );
}

function BracketRow({
  player,
  odds,
  isWinner,
  isLoser,
}: {
  player: Player | null;
  odds: number;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-2 ${
        isWinner
          ? 'bg-success/15'
          : isLoser
            ? 'opacity-50'
            : 'bg-fg/5'
      }`}
    >
      {player ? (
        <PlayerAvatar player={player} size={24} />
      ) : (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-fg/5 text-[10px] text-fg/40">
          ?
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div
          className={`truncate ${
            isWinner ? 'font-semibold text-success' : 'text-fg/80'
          } ${isLoser ? 'line-through' : ''}`}
        >
          {player ? `${player.firstName} ${player.lastName}` : '???'}
        </div>
      </div>
      <span
        className={`shrink-0 font-mono text-[11px] ${
          isWinner ? 'text-success' : 'text-accent'
        } ${isLoser ? 'line-through' : ''}`}
      >
        {fmtOdds(odds)}
      </span>
    </div>
  );
}

export const dynamic = 'force-dynamic';
