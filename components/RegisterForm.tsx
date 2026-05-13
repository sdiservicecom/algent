'use client';

import { useState } from 'react';
import { PasswordInput } from './PasswordInput';

interface Props {
  action: (formData: FormData) => Promise<void>;
  errorCode?: string;
  errorDetail?: string;
}

export function RegisterForm({ action, errorCode, errorDetail }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (password !== confirm) {
      e.preventDefault();
      setMismatch(true);
    }
  };

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3">
      <input
        name="lastName"
        required
        className="input"
        placeholder="Nom"
        autoComplete="family-name"
      />
      <input
        name="firstName"
        required
        className="input"
        placeholder="Prénom"
        autoComplete="given-name"
      />
      <input
        name="username"
        required
        minLength={3}
        className="input"
        placeholder="Pseudonyme"
        autoComplete="username"
      />
      <input
        name="service"
        className="input"
        placeholder="Service / équipe (ex. RH, IT, Compta…)"
        maxLength={60}
        autoComplete="organization"
      />
      <PasswordInput
        name="password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setMismatch(false);
        }}
        placeholder="Mot de passe"
        autoComplete="new-password"
        minLength={6}
        required
      />
      <PasswordInput
        name="passwordConfirm"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          setMismatch(false);
        }}
        placeholder="Confirmer le mot de passe"
        autoComplete="new-password"
        minLength={6}
        required
      />

      {(mismatch || errorCode) && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="text-danger">
            {mismatch
              ? 'Les mots de passe ne correspondent pas.'
              : errorMessage(errorCode ?? '')}
          </p>
          {errorDetail && (
            <p className="mt-1 break-words font-mono text-xs text-fg/60">
              {errorDetail}
            </p>
          )}
        </div>
      )}

      <button className="btn-primary w-full" type="submit">
        Créer mon compte
      </button>
    </form>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case 'firstName':
      return 'Prénom requis.';
    case 'lastName':
      return 'Nom requis.';
    case 'username':
      return 'Le pseudonyme doit faire 3 caractères minimum.';
    case 'password':
      return 'Le mot de passe doit faire 6 caractères minimum.';
    case 'taken':
      return 'Ce pseudonyme est déjà pris.';
    case 'ratelimit':
      return 'Trop de créations de compte — réessaie dans 10 minutes.';
    case 'server':
      return 'Erreur serveur — vérifie la configuration Vercel KV.';
    case 'session':
      return 'Erreur de session — variable AUTH_SECRET manquante.';
    default:
      return 'Erreur inconnue.';
  }
}
