'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Sert à matcher les sous-routes (ex: /matches/123 → /matches). */
  match?: (path: string) => boolean;
}

const ICON_SIZE = 24;

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  bets: (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4h7l3 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v3h3" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  ),
  calendar: (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  network: (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 11l8-4" />
      <path d="M8 13l8 4" />
    </svg>
  ),
  trophy: (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21h6" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3" />
    </svg>
  ),
};

const ITEMS: Item[] = [
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: ICONS.home,
    match: (p) => p === '/' || p.startsWith('/dashboard'),
  },
  {
    href: '/history',
    label: 'Mes paris',
    icon: ICONS.bets,
    match: (p) => p.startsWith('/history'),
  },
  {
    href: '/matches',
    label: 'Matchs',
    icon: ICONS.calendar,
    match: (p) => p.startsWith('/matches'),
  },
  {
    href: '/bracket',
    label: 'Bracket',
    icon: ICONS.network,
    match: (p) => p.startsWith('/bracket') || p.startsWith('/tournament'),
  },
  {
    href: '/leaderboard',
    label: 'Classement',
    icon: ICONS.trophy,
    match: (p) => p.startsWith('/leaderboard') || p.startsWith('/stats'),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  return (
    <nav
      aria-label="Navigation principale"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 md:hidden"
      style={{ paddingBottom: 'calc(0.6rem + var(--safe-bottom))' }}
    >
      <ul
        className="pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-full border border-white/15 bg-bg/85 px-4 py-2 shadow-2xl backdrop-blur-lg"
      >
        {ITEMS.map((it) => {
          const active = it.match ? it.match(pathname) : pathname === it.href;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-label={it.label}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
                  active
                    ? 'bg-white text-bg shadow-md'
                    : 'text-fg/75 hover:text-fg'
                }`}
              >
                {it.icon}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
