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

const ICON_SIZE = 22;

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  matches: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  calendar: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  bracket: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h4l2 7-2 7H3" />
      <path d="M21 5h-4l-2 7 2 7h4" />
      <path d="M9 12h6" />
    </svg>
  ),
  trophy: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 21h8" />
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
    href: '/matches',
    label: 'Matchs',
    icon: ICONS.matches,
    match: (p) => p.startsWith('/matches'),
  },
  {
    href: '/history',
    label: 'Historique',
    icon: ICONS.calendar,
    match: (p) => p.startsWith('/history'),
  },
  {
    href: '/bracket',
    label: 'Bracket',
    icon: ICONS.bracket,
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center"
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface/90 px-2 py-2 shadow-2xl backdrop-blur-md">
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
                    ? 'bg-accent text-black shadow-glow'
                    : 'text-fg/55 hover:text-fg'
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
