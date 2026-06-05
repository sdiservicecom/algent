'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  matchId: string;
  playerAId: string;
  playerBId: string;
  playerALabel: string;
  playerBLabel: string;
  initialScoreA: number | null;
  initialScoreB: number | null;
  initialWinnerId: string | null;
  settleAction: (formData: FormData) => Promise<void>;
}

/**
 * Formulaire de règlement avec auto-sélection du gagnant.
 *
 * Le `<select winnerId>` reste utilisateur-contrôlable (au cas où le score
 * serait nul ou si l'admin veut forcer un choix), mais à chaque mise à jour
 * des champs score, le gagnant est automatiquement positionné sur le joueur
 * qui a le plus de points.
 */
export function SettleForm({
  matchId,
  playerAId,
  playerBId,
  playerALabel,
  playerBLabel,
  initialScoreA,
  initialScoreB,
  initialWinnerId,
  settleAction,
}: Props) {
  const [scoreA, setScoreA] = useState<string>(
    initialScoreA != null ? String(initialScoreA) : '',
  );
  const [scoreB, setScoreB] = useState<string>(
    initialScoreB != null ? String(initialScoreB) : '',
  );
  const [winnerId, setWinnerId] = useState<string>(initialWinnerId ?? '');

  // Marque si l'admin a manuellement choisi un gagnant — auquel cas on ne
  // l'écrase plus automatiquement à chaque clic dans les champs score.
  const manualOverride = useRef(initialWinnerId != null);

  useEffect(() => {
    if (manualOverride.current) return;
    const a = scoreA === '' ? null : Number(scoreA);
    const b = scoreB === '' ? null : Number(scoreB);
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
      return;
    }
    if (a > b) setWinnerId(playerAId);
    else if (b > a) setWinnerId(playerBId);
    else setWinnerId('');
  }, [scoreA, scoreB, playerAId, playerBId]);

  return (
    <form action={settleAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={matchId} />
      <div className="flex-1 min-w-[200px]">
        <label className="label">Vainqueur</label>
        <select
          name="winnerId"
          required
          className="input"
          value={winnerId}
          onChange={(e) => {
            manualOverride.current = true;
            setWinnerId(e.target.value);
          }}
        >
          <option value="">—</option>
          <option value={playerAId}>{playerALabel}</option>
          <option value={playerBId}>{playerBLabel}</option>
        </select>
      </div>
      <div>
        <label className="label">Score {playerALabel.split(' ')[0]}</label>
        <input
          name="scoreA"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          className="input w-24 text-center text-lg font-semibold"
        />
      </div>
      <div>
        <label className="label">Score {playerBLabel.split(' ')[0]}</label>
        <input
          name="scoreB"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          className="input w-24 text-center text-lg font-semibold"
        />
      </div>
      <button className="btn-primary" type="submit">
        Régler le match
      </button>
    </form>
  );
}
