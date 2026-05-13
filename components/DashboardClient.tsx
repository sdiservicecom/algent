'use client';

import Link from 'next/link';
import { ResultModal, type ResultPayload } from './ResultModal';
import { CoinIcon } from './CoinIcon';
import { BonusCTA } from './BonusCTA';
import { fmtPoints } from '@/lib/format';

interface RankRow {
  rank: number;
  userId: string;
  username: string;
  balance: number;
  betsWon: number;
  betsLost: number;
}

interface Props {
  logoutAction: () => Promise<void>;
  modalPayload: ResultPayload | null;
  user: {
    username: string;
    firstName: string;
    lastName: string;
    balance: number;
    service: string | null;
  };
  bonus: { received: boolean; amount: number | null };
  myRank: { rank: number; betsWon: number; betsLost: number } | null;
  topThree: RankRow[];
  aroundMe: RankRow[];
  totalPlayers: number;
  updateServiceAction?: (formData: FormData) => Promise<void>;
}

const initials = (firstName: string, lastName: string) =>
  `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';

const trendIcon = (delta: number, className = '') => {
  if (delta > 0)
    return (
      <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 15l7-7 7 7" />
      </svg>
    );
  if (delta < 0)
    return (
      <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 9l7 7 7-7" />
      </svg>
    );
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
};

export function DashboardClient({
  logoutAction,
  modalPayload,
  user,
  bonus,
  myRank,
  topThree,
  aroundMe,
  totalPlayers,
  updateServiceAction,
}: Props) {
  // Dédup le classement affiché : top 3 + voisins (en évitant doublons)
  const seen = new Set<string>();
  const rankRows: RankRow[] = [];
  for (const r of [...topThree, ...aroundMe]) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    rankRows.push(r);
  }
  rankRows.sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-6">
      {/* Section "Profil" */}
      <div className="flex items-center gap-2 text-sm text-fg/70">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
        <span className="font-semibold">Profil</span>
      </div>

      {/* Hero profil */}
      <section className="flex items-center gap-4">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surfaceRaised to-surface text-3xl font-bold text-fg/80 ring-2 ring-border"
          aria-hidden
        >
          {initials(user.firstName, user.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            Hello <span className="text-accentBright">{user.username}</span>{' '}
            <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-fg/70">Ton solde actuel est de :</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-sm font-semibold">
            {fmtPoints(user.balance)}
            <CoinIcon size={12} />
          </span>
        </div>
      </section>

      {/* Bouton bonus */}
      <BonusCTA initial={bonus} />

      {/* Service / équipe — édition inline */}
      {updateServiceAction && (
        <ServiceEditor
          current={user.service}
          action={updateServiceAction}
        />
      )}

      {/* Question pour du pognon (placeholder) */}
      <QuestionCard />

      {/* Classement */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg/70">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
          <h2 className="text-lg font-semibold">Ton classement</h2>
          {myRank && (
            <span className="ml-auto text-xs text-fg/50">
              #{myRank.rank} sur {totalPlayers}
            </span>
          )}
        </div>
        {rankRows.length === 0 ? (
          <div className="card text-sm text-fg/60">
            Le classement apparaîtra dès que les premiers résultats tombent.
          </div>
        ) : (
          <ul className="card space-y-2 p-3">
            {rankRows.map((r, idx) => {
              const isMe = myRank && r.rank === myRank.rank;
              const trend = idx - r.rank; // approximation visuelle
              const tone =
                trend > 0
                  ? 'text-success'
                  : trend < 0
                    ? 'text-danger'
                    : 'text-fg/40';
              return (
                <li
                  key={r.userId}
                  className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${
                    isMe ? 'bg-accent/8 ring-1 ring-accent/30' : ''
                  }`}
                >
                  <span className="flex w-12 items-center gap-1 text-sm font-bold">
                    #{r.rank}
                    <span className={tone}>{trendIcon(trend)}</span>
                  </span>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surfaceRaised text-xs font-bold text-fg/80 ring-1 ring-border"
                    aria-hidden
                  >
                    {r.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {r.username}
                      {isMe && (
                        <span className="ml-1 text-xs font-normal text-accent">
                          (toi)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-success">{r.betsWon}</span>
                    <span className="text-fg/30">-</span>
                    <span className="text-danger">{r.betsLost}</span>
                  </div>
                  <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold">
                    {fmtPoints(r.balance)}
                    <CoinIcon size={10} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 text-center">
          <Link href="/leaderboard" className="text-sm text-accent hover:underline">
            Voir tout le classement →
          </Link>
        </div>
      </section>

      {/* Déconnexion */}
      <form action={logoutAction}>
        <button type="submit" className="btn-danger w-full">
          Se déconnecter
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </form>

      {/* Pop-up résultat (perte / gain) */}
      {modalPayload && <ResultModal payload={modalPayload} />}
    </div>
  );
}

function ServiceEditor({
  current,
  action,
}: {
  current: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg/80">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M9 21V12h6v9" />
        </svg>
        Mon service
      </div>
      <form action={action} className="flex items-center gap-2">
        <input
          name="service"
          defaultValue={current ?? ''}
          maxLength={60}
          placeholder="ex. RH, IT, Compta…"
          className="input flex-1"
          autoComplete="organization"
        />
        <button type="submit" className="btn-primary !px-4 !py-2 text-sm">
          Enregistrer
        </button>
      </form>
      <p className="mt-2 text-xs text-fg/55">
        Ton service est utilisé pour le classement par équipe.
      </p>
    </section>
  );
}

function QuestionCard() {
  // Placeholder visuel — la mécanique réelle est gérée par le bonus quotidien.
  return (
    <section className="rounded-3xl border border-accent/40 bg-surface/80 p-4">
      <div className="mb-2 flex items-center gap-2 text-fg/70">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-sm font-semibold">Question pour du pognon</span>
      </div>
      <p className="mb-4 text-center text-base font-bold">
        Qui va remporter le tournoi de ping-pong ?
      </p>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <Link
          href="/tournament"
          className="rounded-full border border-accent/60 px-4 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10"
        >
          Faire mon pronostic
        </Link>
      </div>
      <Link
        href="/tournament"
        className="btn-primary w-full"
      >
        Confirmer ma réponse
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
      </Link>
    </section>
  );
}
