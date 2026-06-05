import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loadPendingResult } from '@/lib/pending-result';
import { BasketProvider } from '@/components/BasketContext';
import { FloatingBetBasket } from '@/components/FloatingBetBasket';
import { BottomNav } from '@/components/BottomNav';
import { HeaderBar } from '@/components/HeaderBar';
import { SideNav } from '@/components/SideNav';
import { ResultModal } from '@/components/ResultModal';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Pop-up de résultat WON / LOST sur n'importe quelle page (premier
  // notif non lu). Une fois fermée, la notif est marquée comme lue et
  // ne re-déclenche plus.
  const pendingResult = await loadPendingResult(user.id);

  return (
    <BasketProvider>
      <div className="min-h-[100dvh] pb-[7.5rem] md:pb-0">
        <HeaderBar
          balance={user.balance}
          username={user.username}
          isAdmin={user.role === 'ADMIN'}
        />
        {/* En desktop, on garde la sidebar à gauche mais on RE-CENTRE
            visuellement le contenu : main reste plafonné à max-w-2xl
            (largeur de la version mobile, lisible) et est centré dans
            la zone restante avec `mx-auto`. Du coup le bloc est
            grossièrement aligné avec le milieu du viewport, sans être
            étiré sur toute la largeur. */}
        <div className="mx-auto md:flex md:max-w-7xl md:items-start md:gap-6 md:px-6">
          <SideNav
            username={user.username}
            balance={user.balance}
            isAdmin={user.role === 'ADMIN'}
          />
          <main className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4 md:flex-1 md:px-0 md:py-6">
            <div className="mx-auto w-full max-w-2xl">{children}</div>
          </main>
        </div>
        <FloatingBetBasket balance={user.balance} />
        <BottomNav />
        {pendingResult && <ResultModal payload={pendingResult} />}
      </div>
    </BasketProvider>
  );
}
