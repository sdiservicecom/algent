import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clearSessionCookie, requireUser } from '@/lib/auth';
import { bumpCache } from '@/lib/cache';
import { getUser, setUserService } from '@/lib/users';
import {
  cachedGetLeaderboard as getLeaderboard,
  cachedHasReceivedTodayBonus as hasReceivedTodayBonus,
  cachedListPlayers as listPlayers,
} from '@/lib/cache';
import { getTournament } from '@/lib/tournament';
import { getQuizState, QUIZ_REWARD } from '@/lib/quiz';
import { DashboardClient } from '@/components/DashboardClient';
import type { QuizPlayerOption } from '@/components/QuizCard';

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
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const [user, bonus, leaderboard, players, tournament, quizState] =
    await Promise.all([
      getUser(session.sub),
      hasReceivedTodayBonus(session.sub),
      getLeaderboard(),
      listPlayers(),
      getTournament(),
      getQuizState(session.sub),
    ]);
  if (!user) return null;

  const myRank = leaderboard.find((r) => r.userId === session.sub);
  const topThree = leaderboard.slice(0, 3);
  const aroundMe = myRank
    ? leaderboard.slice(Math.max(0, myRank.rank - 2), myRank.rank + 1)
    : [];

  // Construit la liste d'options du quiz : gagnant + 3 distracteurs aléatoires,
  // mélangé. Déterministe à partir du userId pour rester stable entre les
  // rechargements (sinon les boutons sautent à chaque refresh).
  const winnerId = tournament.winnerId;
  let quizOptions: QuizPlayerOption[] = [];
  if (winnerId) {
    const winner = players.find((p) => p.id === winnerId);
    const others = players.filter((p) => p.id !== winnerId);
    const seed = hashCode(session.sub);
    const shuffled = seededShuffle(others, seed);
    const distractors = shuffled.slice(0, 3);
    const pool = winner ? [winner, ...distractors] : distractors;
    quizOptions = seededShuffle(pool, seed + 1).map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
    }));
  }

  return (
    <DashboardClient
      logoutAction={logout}
      updateServiceAction={updateService}
      serviceSaved={sp.saved === 'service'}
      quiz={{
        state: quizState,
        tournamentSettled: tournament.status === 'SETTLED',
        options: quizOptions,
        correctPlayerId: winnerId,
        reward: QUIZ_REWARD,
      }}
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

// — Helpers de mélange déterministe (pour un quiz stable entre rechargements) —
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  // PRNG simple (mulberry32) — assez bon pour mélanger 8 items.
  let t = seed >>> 0;
  const rand = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const dynamic = 'force-dynamic';
