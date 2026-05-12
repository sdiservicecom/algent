import { redirect } from 'next/navigation';
import { clearSessionCookie, requireUser } from '@/lib/auth';
import { getUser } from '@/lib/users';
import { listUserBets } from '@/lib/bets';
import { getMatch } from '@/lib/matches';
import { getPlayer } from '@/lib/players';
import { listNotifications } from '@/lib/notifications';
import {
  cachedGetLeaderboard as getLeaderboard,
  cachedHasReceivedTodayBonus as hasReceivedTodayBonus,
} from '@/lib/cache';
import { DashboardClient } from '@/components/DashboardClient';
import type { ResultPayload } from '@/components/ResultModal';

async function logout() {
  'use server';
  await clearSessionCookie();
  redirect('/login');
}

export default async function ProfilePage() {
  const session = await requireUser();
  const [user, bonus, leaderboard, recent] = await Promise.all([
    getUser(session.sub),
    hasReceivedTodayBonus(session.sub),
    getLeaderboard(),
    listNotifications(session.sub, 6),
  ]);
  if (!user) return null;

  const myRank = leaderboard.find((r) => r.userId === session.sub);
  const topThree = leaderboard.slice(0, 3);
  const aroundMe = myRank
    ? leaderboard.slice(Math.max(0, myRank.rank - 2), myRank.rank + 1)
    : [];

  // Pré-charge la première notif "résultat" non lue → pop-up auto
  const unreadResult = recent.find(
    (n) => !n.read && (n.kind === 'BET_WON' || n.kind === 'BET_LOST'),
  );
  let modalPayload: ResultPayload | null = null;
  if (unreadResult) {
    const matchId = unreadResult.url?.split('/').pop() ?? null;
    if (matchId) {
      const match = await getMatch(matchId);
      if (match) {
        const bets = await listUserBets(user.id);
        const bet =
          bets.find(
            (b) =>
              b.matchId === matchId &&
              (b.status === 'WON' || b.status === 'LOST'),
          ) ?? null;
        if (bet) {
          const [picked, playerA, playerB] = await Promise.all([
            getPlayer(bet.pickedPlayerId),
            getPlayer(match.playerAId),
            getPlayer(match.playerBId),
          ]);
          if (picked && playerA && playerB) {
            modalPayload = {
              kind: unreadResult.kind as 'BET_WON' | 'BET_LOST',
              notificationId: unreadResult.id,
              bet,
              match,
              picked,
              playerA,
              playerB,
              scoreA: match.scoreA,
              scoreB: match.scoreB,
            };
          }
        }
      }
    }
  }

  return (
    <DashboardClient
      logoutAction={logout}
      modalPayload={modalPayload}
      user={{
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        balance: user.balance,
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
