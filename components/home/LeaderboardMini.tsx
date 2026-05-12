import Link from 'next/link';
import { fmtPoints } from '@/lib/format';
import { CoinIcon } from '../CoinIcon';

interface Row {
  rank: number;
  userId: string;
  username: string;
  balance: number;
}

interface Props {
  rows: Row[];
  highlightUserId?: string;
}

const PODIUM_COLOR: Record<number, string> = {
  1: 'text-coin',
  2: 'text-fg/70',
  3: 'text-[#cd7f32]',
};

export function LeaderboardMini({ rows, highlightUserId }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-fg/60">
        Le classement apparaîtra dès les premiers résultats.
      </p>
    );
  }
  return (
    <ul className="card divide-y divide-border/60 p-0">
      {rows.map((r) => {
        const me = r.userId === highlightUserId;
        const podiumClass = PODIUM_COLOR[r.rank] ?? 'text-fg/70';
        return (
          <li
            key={r.userId}
            className={`flex items-center gap-3 px-3 py-2.5 ${
              me ? 'bg-accent/8' : ''
            }`}
          >
            <span className={`w-8 text-sm font-bold ${podiumClass}`}>
              #{r.rank}
            </span>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surfaceRaised text-xs font-bold text-fg/80 ring-1 ring-border"
              aria-hidden
            >
              {r.username.slice(0, 2).toUpperCase()}
            </div>
            <Link
              href="/leaderboard"
              className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-accent"
            >
              {r.username}
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-sm font-semibold">
              {fmtPoints(r.balance)}
              <CoinIcon size={12} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
