import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clearSessionCookie, requireUser } from '@/lib/auth';
import { bumpCache } from '@/lib/cache';
import { getUser, setUserService } from '@/lib/users';
import {
  cachedGetLeaderboard as getLeaderboard,
  cachedHasReceivedTodayBonus as hasReceivedTodayBonus,
} from '@/lib/cache';
import { DashboardClient } from '@/components/DashboardClient';

async function logout() {
  'use server';
  await clearSessionCookie();
  redirect('/login');
}

async function updateService(formData: FormData) {
  'use server';
  const session = await requireUser();
  const raw = String(formData.get('service') ?? '');
  await setUserService(session.sub, raw.length > 0 ? raw : null);
  bumpCache('users', 'leaderboard');
  revalidatePath('/profile');
  revalidatePath('/leaderboard');
  // Redirection explicite : force une nouvelle navigation pour que le
  // <select> (uncontrolled, défini par defaultValue) se remonte sur la
  // valeur fraichement enregistrée et que l'utilisateur ait un feedback
  // visuel immédiat ("Service enregistré").
  redirect('/profile?saved=service');
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; passwordChanged?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const [user, bonus, leaderboard] = await Promise.all([
    getUser(session.sub),
    hasReceivedTodayBonus(session.sub),
    getLeaderboard(),
  ]);
  if (!user) return null;

  const myRank = leaderboard.find((r) => r.userId === session.sub);
  const topThree = leaderboard.slice(0, 3);
  const aroundMe = myRank
    ? leaderboard.slice(Math.max(0, myRank.rank - 2), myRank.rank + 1)
    : [];

  return (
    <DashboardClient
      logoutAction={logout}
      updateServiceAction={updateService}
      serviceSaved={sp.saved === 'service'}
      passwordChanged={sp.passwordChanged === '1'}
      modalPayload={null}
      user={{
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        balance: user.balance,
        service: user.service,
      }}
      bonus={bonus}
      myRank={myRank ?? null}
      topThree={topThree.map((r) => ({
        rank: r.rank,
        userId: r.userId,
        username: r.username,
        balance: r.balance,
        betsWon: r.betsWon,
        betsLost: r.betsLost,
      }))}
      aroundMe={aroundMe.map((r) => ({
        rank: r.rank,
        userId: r.userId,
        username: r.username,
        balance: r.balance,
        betsWon: r.betsWon,
        betsLost: r.betsLost,
      }))}
      totalPlayers={leaderboard.length}
    />
  );
}

export const dynamic = 'force-dynamic';
