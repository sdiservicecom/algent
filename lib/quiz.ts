import { K, kv } from './kv';
import { getTournament } from './tournament';
import { applyWalletDelta } from './wallet';

export const QUIZ_REWARD = 150;

export type QuizState = 'idle' | 'won' | 'lost';

export async function getQuizState(userId: string): Promise<QuizState> {
  const stored = await kv.get<string>(K.quizAnswer(userId));
  if (stored === 'won') return 'won';
  if (stored === 'lost') return 'lost';
  return 'idle';
}

export type AnswerResult =
  | { ok: true; status: 'won' | 'lost'; correctPlayerId: string; reward: number }
  | { ok: false; reason: 'ALREADY_ANSWERED' | 'TOURNAMENT_NOT_SETTLED' };

/**
 * Tentative unique de réponse à la question "Qui a gagné le dernier tournoi ?".
 * - Si le tournoi n'est pas réglé → on refuse (TOURNAMENT_NOT_SETTLED).
 * - Si l'user a déjà répondu → on refuse (ALREADY_ANSWERED).
 * - Sinon : on pose le marqueur (NX, anti double-clic), on crédite
 *   `QUIZ_REWARD` points si la réponse est correcte, et on retourne le
 *   résultat ainsi que la bonne réponse (utile pour afficher "raté,
 *   c'était X").
 */
export async function answerQuiz(
  userId: string,
  pickedPlayerId: string,
): Promise<AnswerResult> {
  const tournament = await getTournament();
  if (tournament.status !== 'SETTLED' || !tournament.winnerId) {
    return { ok: false, reason: 'TOURNAMENT_NOT_SETTLED' };
  }

  const correct = tournament.winnerId === pickedPlayerId;
  const value = correct ? 'won' : 'lost';

  // Marqueur atomique : seul le premier appel passe.
  const reserved = await kv.set(K.quizAnswer(userId), value, { nx: true });
  if (reserved !== 'OK') {
    return { ok: false, reason: 'ALREADY_ANSWERED' };
  }

  if (correct) {
    await applyWalletDelta(userId, QUIZ_REWARD, 'QUIZ_WIN', {
      metadata: { source: 'quiz', tournament: 'last_winner' },
    });
  }

  return {
    ok: true,
    status: value,
    correctPlayerId: tournament.winnerId,
    reward: correct ? QUIZ_REWARD : 0,
  };
}
