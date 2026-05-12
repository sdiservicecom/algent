'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from './BrandLogo';
import { CoinIcon } from './CoinIcon';
import { fmtPoints } from '@/lib/format';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (p: string) => boolean;
  highlighted?: boolean;
}

const ICON = (path: React.ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

interface Props {
  username: string;
  balance: number;
  isAdmin?: boolean;
}

/**
 * Sidebar gauche affichée à partir du breakpoint md. La version mobile (≤md)
 * continue d'utiliser `BottomNav`, donc cette sidebar reste cachée sous md.
 */
export function SideNav({ username, balance, isAdmin = false }: Props) {
  const pathname = usePathname() ?? '/';
  const items: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Accueil',
      icon: ICON(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>),
      match: (p) => p === '/' || p.startsWith('/dashboard'),
    },
    {
      href: '/history',
      label: 'Mes paris',
      icon: ICON(<><path d="M7 4h7l3 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M14 4v3h3" /><path d="M9 13l2 2 4-4" /></>),
      match: (p) => p.startsWith('/history'),
    },
    {
      href: '/matches',
      label: 'Matchs',
      icon: ICON(<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M16 3v4M8 3v4M3 10h18" /></>),
      match: (p) => p.startsWith('/matches'),
    },
    {
      href: '/bracket',
      label: 'Bracket',
      icon: ICON(<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8 11l8-4" /><path d="M8 13l8 4" /></>),
      match: (p) => p.startsWith('/bracket') || p.startsWith('/tournament'),
    },
    {
      href: '/leaderboard',
      label: 'Classement',
      icon: ICON(<><path d="M9 21h6" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 6h3v2a3 3 0 0 1-3 3" /><path d="M7 6H4v2a3 3 0 0 0 3 3" /></>),
      match: (p) => p.startsWith('/leaderboard') || p.startsWith('/stats'),
    },
    {
      href: '/profile',
      label: 'Profil',
      icon: ICON(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
      match: (p) => p.startsWith('/profile'),
    },
  ];
  if (isAdmin) {
    items.push({
      href: '/admin',
      label: 'Admin',
      icon: ICON(<><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></>),
      match: (p) => p.startsWith('/admin'),
      highlighted: true,
    });
  }

  return (
    <aside
      className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-6 md:py-6"
      aria-label="Navigation principale"
    >
      <div className="sticky top-20 flex flex-col gap-6 rounded-3xl border border-border bg-surface/70 p-4 backdrop-blur-md">
        <BrandLogo href="/dashboard" size="md" />
        <nav>
          <ul className="space-y-1">
            {items.map((it) => {
              const active = it.match
                ? it.match(pathname)
                : pathname === it.href;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                      it.highlighted && !active
                        ? 'bg-accent/15 text-accent hover:bg-accent/25'
                        : active
                          ? 'bg-white text-bg shadow'
                          : 'text-fg/75 hover:bg-white/8 hover:text-fg'
                    }`}
                  >
                    <span aria-hidden>{it.icon}</span>
                    <span>{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="rounded-2xl border border-border bg-bg/40 p-3">
          <div className="text-xs text-fg/60">Connecté en tant que</div>
          <div className="mt-1 truncate font-semibold">{username}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-sm font-semibold">
            {fmtPoints(balance)}
            <CoinIcon size={12} />
          </div>
        </div>
      </div>
    </aside>
  );
}
