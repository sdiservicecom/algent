'use client';

import { useState } from 'react';
import { PasswordInput } from './PasswordInput';

interface Props {
  action: (formData: FormData) => Promise<void>;
  errorCode?: string;
}

export function LoginForm({ action, errorCode }: Props) {
  const [password, setPassword] = useState('');

  return (
    <form action={action} className="space-y-3">
      <input
        name="username"
        required
        autoFocus
        className="input"
        placeholder="Pseudonyme"
        autoComplete="username"
      />
      <PasswordInput
        name="password"
        value={password}
        onChange={setPassword}
        placeholder="Mot de passe"
        autoComplete="current-password"
        required
      />
      {errorCode && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {errorCode === 'invalid'
            ? 'Pseudonyme ou mot de passe incorrect.'
            : errorCode === 'ratelimit'
              ? 'Trop de tentatives — réessaie dans une minute.'
              : 'Champs manquants.'}
        </div>
      )}
      <button className="btn-primary w-full" type="submit">
        Se connecter
      </button>
    </form>
  );
}
