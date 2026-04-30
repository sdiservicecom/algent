'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export interface BasketItem {
  matchId: string;
  matchLabel: string;
  pickedPlayerId: string;
  pickLabel: string;
  pickPhotoUrl: string | null;
  oddsAtAdd: number;
  stake: number;
}

interface Ctx {
  items: BasketItem[];
  isPicked: (matchId: string, pickedPlayerId: string) => boolean;
  hasMatch: (matchId: string) => boolean;
  toggle: (item: Omit<BasketItem, 'stake'>) => void;
  remove: (matchId: string) => void;
  setStake: (matchId: string, stake: number) => void;
  clear: () => void;
}

const BasketCtx = createContext<Ctx | null>(null);

export const useBasket = () => {
  const ctx = useContext(BasketCtx);
  if (!ctx)
    throw new Error('useBasket must be used inside <BasketProvider>');
  return ctx;
};

const STORAGE_KEY = 'algent_basket';

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as BasketItem[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const isPicked = useCallback(
    (matchId: string, pickedPlayerId: string) =>
      items.some(
        (i) => i.matchId === matchId && i.pickedPlayerId === pickedPlayerId,
      ),
    [items],
  );

  const hasMatch = useCallback(
    (matchId: string) => items.some((i) => i.matchId === matchId),
    [items],
  );

  const toggle = useCallback((item: Omit<BasketItem, 'stake'>) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.matchId === item.matchId);
      if (idx === -1) {
        return [...prev, { ...item, stake: 50 }];
      }
      if (prev[idx].pickedPlayerId === item.pickedPlayerId) {
        return prev.filter((_, i) => i !== idx);
      }
      // Un seul pari par match → on remplace le pick
      const next = prev.slice();
      next[idx] = { ...next[idx], ...item };
      return next;
    });
  }, []);

  const remove = useCallback((matchId: string) => {
    setItems((prev) => prev.filter((i) => i.matchId !== matchId));
  }, []);

  const setStake = useCallback((matchId: string, stake: number) => {
    setItems((prev) =>
      prev.map((i) => (i.matchId === matchId ? { ...i, stake } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return (
    <BasketCtx.Provider
      value={{ items, isPicked, hasMatch, toggle, remove, setStake, clear }}
    >
      {children}
    </BasketCtx.Provider>
  );
}
