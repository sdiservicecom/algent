import { SERVICES } from '@/lib/services';

interface Props {
  /** Valeur courante (peut être une chaîne hors liste pour rétrocompat). */
  value: string | null | undefined;
  /** Nom du champ dans le FormData posté côté serveur. */
  name: string;
  required?: boolean;
  id?: string;
  /** Label "vide" affiché en première option. */
  placeholder?: string;
}

/**
 * Dropdown stylé pour choisir un service dans la liste canonique. Si la
 * valeur courante n'est pas dans la liste (ancien libellé personnalisé),
 * on l'ajoute en tête pour ne pas l'écraser sans demande explicite.
 */
export function ServiceSelect({
  value,
  name,
  required = false,
  id,
  placeholder = 'Sélectionner un service…',
}: Props) {
  const current = value && value.length > 0 ? value : '';
  const isExtra =
    current.length > 0 && !(SERVICES as readonly string[]).includes(current);

  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        defaultValue={current}
        required={required}
        className="input appearance-none pr-12"
      >
        <option value="" className="bg-surface text-fg/60">
          {placeholder}
        </option>
        {isExtra && (
          <option value={current} className="bg-surface text-fg">
            {current} (actuel)
          </option>
        )}
        {SERVICES.map((s) => (
          <option key={s} value={s} className="bg-surface text-fg">
            {s}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-fg/60"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
