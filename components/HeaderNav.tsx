'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  highlighted?: boolean;
}

interface Props {
  items: NavItem[];
}

export function HeaderNav({ items }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Ferme le menu sur changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Empêche le scroll du body quand le drawer est ouvert.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Nav inline visible sur tablette+ */}
      <div className="hidden items-center gap-4 text-sm md:flex">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                it.highlighted
                  ? 'shrink-0 rounded bg-accent px-2 py-0.5 text-white hover:bg-white hover:text-accentDark'
                  : `shrink-0 transition ${
                      active ? 'text-white' : 'text-white/80 hover:text-white'
                    }`
              }
            >
              {it.label}
            </Link>
          );
        })}
      </div>

      {/* Burger mobile */}
      <button
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/30 text-white transition hover:bg-white hover:text-accentDark md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M6 18L18 6" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {/* Drawer mobile */}
      {open && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav
            id="mobile-menu"
            className="fixed inset-x-0 top-[64px] z-50 border-b border-white/10 bg-accentDark p-3 shadow-2xl"
          >
            <ul className="flex flex-col gap-1">
              {items.map((it) => {
                const active = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded px-3 py-2 text-base transition ${
                        it.highlighted
                          ? 'bg-accent text-white hover:bg-white hover:text-accentDark'
                          : active
                            ? 'bg-white/10 text-white'
                            : 'text-white/85 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
