'use client';

interface Props {
  action: (formData: FormData) => Promise<void>;
  confirmText: string;
  buttonLabel: string;
  buttonClassName?: string;
  /** Champs cachés à inclure dans le FormData posté. */
  hiddenFields?: Record<string, string | number>;
}

/**
 * Petit wrapper client pour les actions admin destructives (suppression,
 * purge, etc.). Affiche un confirm() natif avant de soumettre le formulaire.
 * Vit dans /components/admin/ pour rester séparé du reste de l'UI.
 */
export function ConfirmForm({
  action,
  confirmText,
  buttonLabel,
  buttonClassName = 'btn-danger',
  hiddenFields = {},
}: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <button type="submit" className={buttonClassName}>
        {buttonLabel}
      </button>
    </form>
  );
}
