import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { BasketProvider } from '@/components/BasketContext';
import { FloatingBetBasket } from '@/components/FloatingBetBasket';
import { BottomNav } from '@/components/BottomNav';
import { HeaderBar } from '@/components/HeaderBar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
        <BottomNav />
      </div>
    </BasketProvider>
  );
}
