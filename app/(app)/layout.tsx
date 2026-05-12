import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { BasketProvider } from '@/components/BasketContext';
import { FloatingBetBasket } from '@/components/FloatingBetBasket';
import { BottomNav } from '@/components/BottomNav';
import { HeaderBar } from '@/components/HeaderBar';
import { NextMatchCountdown } from '@/components/home/NextMatchCountdown';
import { cachedListMatches } from '@/lib/cache';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Cherche le prochain match (status à venir / ouvert) pour afficher le
  // compte à rebours flottant — visible sur toutes les pages in-app.
  const matches = await cachedListMatches();
  const now = Date.now();
  const next = matches
    .filter(
      (m) =>
        (m.status === 'OPEN_FOR_BETS' || m.status === 'SCHEDULED') &&
        new Date(m.startsAt).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];

  return (
    <BasketProvider>
      <div className="min-h-[100dvh]" style={{ paddingBottom: 'calc(7.5rem + var(--safe-bottom))' }}>
        <HeaderBar
          balance={user.balance}
          username={user.username}
          isAdmin={user.role === 'ADMIN'}
        />
        <main className="mx-auto max-w-2xl px-4 pb-6 pt-4">{children}</main>
        <FloatingBetBasket balance={user.balance} />
        {next && (
          <NextMatchCountdown
            startsAt={next.startsAt}
            href={`/matches/${next.id}`}
          />
        )}
        <BottomNav />
      </div>
    </BasketProvider>
  );
}
