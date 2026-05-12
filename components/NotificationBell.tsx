'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@/lib/types';

const POLL_INTERVAL_MS = 90_000;

const KIND_PILL: Record<AppNotification['kind'], string> = {
  BET_WON: 'bg-success/20 text-success',
  BET_LOST: 'bg-danger/20 text-danger',
  TOURNAMENT_WON: 'bg-success/20 text-success',
  TOURNAMENT_LOST: 'bg-danger/20 text-danger',
  INFO: 'bg-fg/10 text-fg/70',
};

const KIND_ICON: Record<AppNotification['kind'], string> = {
  BET_WON: '🎉',
  BET_LOST: '💔',
  TOURNAMENT_WON: '🏆',
  TOURNAMENT_LOST: '😞',
  INFO: 'ℹ️',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Poll léger : juste le compteur (1 SCARD côté KV).
  const fetchCount = async () => {
    try {
      const res = await fetch('/api/notifications/count', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { unread?: number };
      setUnread(data.unread ?? 0);
    } catch {
      /* ignore */
    }
  };

  // Fetch complet : seulement quand l'utilisateur ouvre la popover ou que le
  // compteur change.
  const fetchItems = async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: AppNotification[];
        unread: number;
      };
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
      setItemsLoaded(true);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchCount();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fetchCount();
      }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    start();
    const onVis = () => {
      if (document.hidden) {
        stop();
      } else {
        // Onglet redevient visible : rafraîchit immédiatement, puis reprend le poll.
        fetchCount();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Ouvre la popover : si on n'a pas encore les items ou si le compteur a
  // changé depuis la dernière ouverture, on rafraîchit.
  useEffect(() => {
    if (open && !itemsLoaded) fetchItems();
  }, [open, itemsLoaded]);

  // Fermer la popover au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const onClickItem = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
      setUnread((c) => Math.max(0, c - 1));
      fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    setOpen(false);
    if (n.url) router.push(n.url);
  };

  const onMarkAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  };

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            // À chaque ouverture, on rafraîchit les items pour rester à jour.
            if (next) setItemsLoaded(false);
            return next;
          });
        }}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-fg/80 transition hover:bg-white/15 hover:text-fg"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(360px,90vw)] rounded-2xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {items.some((i) => !i.read) && (
              <button
                onClick={onMarkAll}
                className="text-xs text-accent hover:underline"
              >
                Tout marquer lu
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!itemsLoaded ? (
              <div className="px-4 py-6 text-center text-sm text-fg/50">
                Chargement…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-fg/50">
                Aucune notification.
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`border-b border-border/50 last:border-b-0 ${
                      n.read ? '' : 'bg-accent/5'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onClickItem(n)}
                      className="flex w-full gap-3 px-3 py-2 text-left transition hover:bg-fg/5"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${KIND_PILL[n.kind]}`}
                      >
                        <span aria-hidden>{KIND_ICON[n.kind]}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" />
                          )}
                        </div>
                        <div className="line-clamp-2 text-xs text-fg/70">
                          {n.body}
                        </div>
                        <div className="mt-0.5 text-[11px] text-fg/40">
                          {relativeTime(n.createdAt)}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
