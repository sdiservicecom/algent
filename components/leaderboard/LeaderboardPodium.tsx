import { fmtPoints } from '@/lib/format';
import { CoinIcon } from '../CoinIcon';

interface Row {
  userId: string;
  username: string;
  balance: number;
  betsWon: number;
  betsLost: number;
}

interface Props {
  podium: { first: Row | null; second: Row | null; third: Row | null };
  highlightUserId: string;
}

const RING: Record<'first' | 'second' | 'third', string> = {
  first: 'ring-4 ring-coin shadow-glow',
  second: 'ring-4 ring-fg/30',
  third: 'ring-4 ring-[#cd7f32]/70',
};

const SIZE: Record<'first' | 'second' | 'third', string> = {
  first: 'h-24 w-24',
  second: 'h-20 w-20',
  third: 'h-20 w-20',
};

/**
 * Podium top-3 : 1er au centre (avatar plus grand, anneau or), 2e à
 * gauche (argent), 3e à droite (bronze). Chaque place affiche le nom,
 * la pillule solde et le bilan victoires-défaites.
 */
export function LeaderboardPodium({ podium, highlightUserId }: Props) {
  return (
    <div className="grid grid-cols-3 items-end gap-3">
      <Step row={podium.second} place="second" me={highlightUserId} />
      <Step row={podium.first} place="first" me={highlightUserId} crown />
      <Step row={podium.third} place="third" me={highlightUserId} />
    </div>
  );
}

function Step({
  row,
  place,
  me,
  crown,
}: {
  row: Row | null;
  place: 'first' | 'second' | 'third';
  me: string;
  crown?: boolean;
}) {
  if (!row) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className={`${SIZE[place]} rounded-full bg-surfaceRaised ring-1 ring-border`}
          aria-hidden
        />
        <div className="text-xs text-fg/40">—</div>
      </div>
    );
  }
  const isMe = row.userId === me;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative">
        {crown && (
          <span
            aria-hidden
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl"
          >
            👑
          </span>
        )}
        <div
          className={`${SIZE[place]} flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-surfaceRaised to-surfaceAlt text-2xl font-bold text-fg/80 ${RING[place]}`}
        >
          {row.username.slice(0, 2).toUpperCase()}
        </div>
      </div>
      <div
        className={`truncate text-sm font-semibold ${
          isMe ? 'text-accent' : ''
        }`}
      >
        {row.username}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
        {fmtPoints(row.balance)}
        <CoinIcon size={11} />
      </span>
      <span className="text-xs font-bold">
        <span className="text-success">{row.betsWon}</span>
        <span className="mx-1 text-fg/30">-</span>
        <span className="text-danger">{row.betsLost}</span>
      </span>
    </div>
  );
}
