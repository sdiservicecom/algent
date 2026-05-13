import { fmtPoints } from '@/lib/format';
import type { ServiceLeaderboardEntry } from '@/lib/leaderboard';
import { CoinIcon } from '../CoinIcon';

interface Props {
  rows: ServiceLeaderboardEntry[];
}

const RANK_TONE: Record<number, string> = {
  1: 'text-coin',
  2: 'text-fg/80',
  3: 'text-[#cd7f32]',
};

export function ServiceLeaderboardList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card text-sm text-fg/60">
        Aucun service n'a encore été renseigné. Va sur ta page Profil pour
        rejoindre une équipe.
      </div>
    );
  }
  return (
    <ul className="card space-y-2 p-2">
      {rows.map((r) => {
        const podium = RANK_TONE[r.rank] ?? 'text-fg/70';
        return (
          <li
            key={r.service + r.rank}
            className="flex items-center gap-3 rounded-2xl px-2 py-2"
          >
            <span className={`w-10 text-base font-bold ${podium}`}>
              #{r.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {r.service}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-fg/55">
                <span>
                  {r.memberCount} membre{r.memberCount > 1 ? 's' : ''}
                </span>
                <span>
                  moy.{' '}
                  <span className="text-fg">{fmtPoints(r.averageBalance)}</span>
                </span>
                <span>
                  <span className="text-success">{r.betsWon}</span>
                  <span className="mx-0.5 text-fg/30">-</span>
                  <span className="text-danger">{r.betsLost}</span>
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-sm font-semibold">
              {fmtPoints(r.totalBalance)}
              <CoinIcon size={11} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
