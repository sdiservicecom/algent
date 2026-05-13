import { listUserBets } from './bets';
import { getMatch } from './matches';
import { listNotifications } from './notifications';
import { getPlayer } from './players';
import type { ResultPayload } from '@/components/ResultModal';

/**
 * Cherche le premier notif "résultat de pari" non lu pour cet utilisateur et
 * pré-charge ses données associées (match, picked, joueurs). Renvoie `null`
 * s'il n'y a rien à afficher — auquel cas on n'ouvre pas la pop-up.
 *
 * Utilisé par le layout (app) pour faire pop-up le résultat dès l'arrivée
 * sur l'appli, peu importe la page où l'utilisateur atterrit.
 */
export async function loadPendingResult(
  userId: string,
): Promise<ResultPayload | null> {
  const recent = await listNotifications(userId, 6);
  const unread = recent.find(
    (n) => !n.read && (n.kind === 'BET_WON' || n.kind === 'BET_LOST'),
  );
  if (!unread) return null;

  const matchId = unread.url?.split('/').pop() ?? null;
  if (!matchId) return null;

  const match = await getMatch(matchId);
  if (!match) return null;

  const bets = await listUserBets(userId);
  const bet = bets.find(
    (b) =>
      b.matchId === matchId &&
      (b.status === 'WON' || b.status === 'LOST'),
  );
  if (!bet) return null;

  const [picked, playerA, playerB] = await Promise.all([
    getPlayer(bet.pickedPlayerId),
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
  ]);
  if (!picked || !playerA || !playerB) return null;

  return {
    kind: unread.kind as 'BET_WON' | 'BET_LOST',
    notificationId: unread.id,
    bet,
    match,
    picked,
    playerA,
    playerB,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
  };
}
