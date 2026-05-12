import { fmtPoints } from '@/lib/format';
import { CoinIcon } from '../CoinIcon';

interface Row {
  rank: number;
  userId: string;
  username: string;
  balance: number;
  betsWon: number;
  betsLost: number;
}

interface Props {
  rows: Row[];
  highlightUserId: string;
}

/** Indicateur de tendance : si W > L → up, W < L → down, sinon stable. */
function trend(row: Row): 'up' | 'down' | 'flat' {
  if (row.betsWon > row.betsLost) return 'up';
  if (row.betsWon < row.betsLost) return 'down';
  return 'flat';
}

const TrendIcon = ({ t }: { t: 'up' | 'down' | 'flat' }) => {
  if (t === 'up')
    return (
      <svg
        className="text-success"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <polygon points="12 4 20 16 4 16" />
      </svg>
    );
  if (t === 'down')
    return (
      <svg
        className="text-danger"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <polygon points="12 20 4 8 20 8" />
      </svg>
    );
  return (
    <span className="text-fg/40" aria-hidden>
      —
    </span>
  );
};

export function LeaderboardList({ rows, highlightUserId }: Props) {
  return (
    <ul className="card space-y-1 p-2">
      {rows.map((r) => {
        const me = r.userId === highlightUserId;
        return (
          <li
            key={r.userId}
            className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${
              me ? 'bg-accent/10 ring-1 ring-accent/30' : ''
            }`}
          >
            <span className="flex w-14 items-center gap-1 text-sm font-bold">
              #{r.rank}
              <TrendIcon t={trend(r)} />
            </span>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surfaceRaised text-xs font-bold text-fg/80 ring-1 ring-border"
              aria-hidden
            >
              {r.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {r.username}
                {me && (
                  <span className="ml-1 text-xs font-normal text-accent">
                    (toi)
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-bold">
              <span className="text-success">{r.betsWon}</span>
              <span className="mx-1 text-fg/30">-</span>
              <span className="text-danger">{r.betsLost}</span>
            </span>
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold">
              {fmtPoints(r.balance)}
              <CoinIcon size={10} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
