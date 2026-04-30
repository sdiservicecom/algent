'use client';

import { useState } from 'react';
import { fmtOdds, fmtPlayerName, fmtPoints } from '@/lib/format';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface PlayerOption {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  photoUrl: string | null;
  odds: number;
}

interface Props {
  matchId: string;
  playerA: PlayerOption;
  playerB: PlayerOption;
  balance: number;
  action: (formData: FormData) => Promise<void>;
}

export function BetForm({ matchId, playerA, playerB, balance, action }: Props) {
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState<number>(50);

  const odds = pick === playerA.id ? playerA.odds : pick === playerB.id ? playerB.odds : 0;
  const potential = pick && stake > 0 ? Math.floor(stake * odds) : 0;
  const profit = potential - stake;

  const stakeValid = stake >= 10 && stake <= balance && stake <= 50_000;
  const canSubmit = pick && stakeValid;

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="matchId" value={matchId} />

      <div>
        <div className="label">Choisir le vainqueur</div>
        <div className="grid grid-cols-2 gap-2">
          {[playerA, playerB].map((p) => {
            const active = pick === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPick(p.id)}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition ${
                  active
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg/40 hover:border-white/30'
                }`}
              >
                <PlayerAvatar player={p} size={40} />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {fmtPlayerName(p)}
                  </div>
                  <div className="text-sm text-accent">@ {fmtOdds(p.odds)}</div>
                </div>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="pickedPlayerId" value={pick ?? ''} />
      </div>

      <div>
        <label className="label" htmlFor="stake">
          Mise (10 – {fmtPoints(Math.min(balance, 50_000))})
        </label>
        <input
          id="stake"
          name="stake"
          type="number"
          min={10}
          max={Math.min(balance, 50_000)}
          step={1}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="input"
          required
        />
        {!stakeValid && (
          <p className="mt-1 text-xs text-danger">
            Mise invalide (min 10, max{' '}
            {fmtPoints(Math.min(balance, 50_000))}).
          </p>
        )}
      </div>

      <div className="rounded-md border border-border bg-bg/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Cote</span>
          <span className="font-mono">
            {pick ? fmtOdds(odds) : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Gain potentiel</span>
          <span className="font-medium text-success">
            {pick ? `${fmtPoints(potential)} pts` : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Profit net</span>
          <span className="font-medium">
            {pick ? `${profit >= 0 ? '+' : ''}${fmtPoints(profit)} pts` : '—'}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-primary w-full"
      >
        Confirmer le pari
      </button>
    </form>
  );
}
