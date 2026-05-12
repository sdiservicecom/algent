import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import { CoinIcon } from './CoinIcon';
import { NotificationBell } from './NotificationBell';
import { fmtPoints } from '@/lib/format';

interface Props {
  balance: number;
  username: string;
  /** Lien vers la page Profil (= dashboard pour l'utilisateur). */
  profileHref?: string;
  isAdmin?: boolean;
}

/**
 * Barre du haut : marque "SDI Bet" à gauche, solde + actions à droite.
 */
export function HeaderBar({
  balance,
  username,
  profileHref = '/profile',
  isAdmin = false,
}: Props) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-md">
      <div className="bg-bg/80 border-b border-border/40">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4 md:h-16 md:max-w-7xl md:px-6">
          <span className="md:hidden">
            <BrandLogo size="md" />
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/matches"
              aria-label="Placer un pari"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-coin text-black transition hover:brightness-110"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Link>
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-sm font-semibold text-fg"
              title={`${username} — solde`}
            >
              {fmtPoints(balance)}
              <CoinIcon size={12} />
            </span>
            <NotificationBell />
            <Link
              href={profileHref}
              aria-label="Profil"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-fg/80 transition hover:bg-white/15 hover:text-fg"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
              </svg>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                aria-label="Admin"
                className="inline-flex h-9 items-center rounded-full bg-accent px-3 text-xs font-semibold text-black hover:bg-accentBright"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
