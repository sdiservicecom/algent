'use client';

import { useState } from 'react';
import { PasswordInput } from './PasswordInput';

interface Props {
  action: (formData: FormData) => Promise<void>;
  errorCode?: string;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'wrongCurrent':
      return 'Mot de passe actuel incorrect.';
    case 'tooShort':
      return 'Le nouveau mot de passe doit faire 6 caractères minimum.';
    case 'mismatch':
      return 'Les deux nouveaux mots de passe ne correspondent pas.';
    case 'notFound':
      return 'Compte introuvable.';
    default:
      return 'Erreur inconnue.';
  }
}

export function ChangePasswordForm({ action, errorCode }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (next.length < 6) {
      e.preventDefault();
      setClientError('tooShort');
      return;
    }
    if (next !== confirm) {
      e.preventDefault();
      setClientError('mismatch');
      return;
    }
    setClientError(null);
  };

  const shownError = clientError ?? errorCode ?? null;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3">
      <PasswordInput
        name="current"
        value={current}
        onChange={(v) => {
          setCurrent(v);
          setClientError(null);
        }}
        placeholder="Mot de passe actuel"
        autoComplete="current-password"
        required
      />
      <PasswordInput
        name="next"
        value={next}
        onChange={(v) => {
          setNext(v);
          setClientError(null);
        }}
        placeholder="Nouveau mot de passe (6 caractères min.)"
        autoComplete="new-password"
        minLength={6}
        required
      />
      <PasswordInput
        name="confirm"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          setClientError(null);
        }}
        placeholder="Confirmer le nouveau mot de passe"
        autoComplete="new-password"
        minLength={6}
        required
      />
      {shownError && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {errorMessage(shownError)}
        </div>
      )}
      <button type="submit" className="btn-primary w-full">
        Mettre à jour
      </button>
    </form>
  );
}
