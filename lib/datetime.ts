/**
 * Helpers de date/heure conscients du fuseau horaire de l'app.
 *
 * Tous les `Intl.DateTimeFormat` exécutés côté serveur (Vercel = UTC par
 * défaut) ou côté client (variable selon le device) doivent passer par
 * ces helpers pour garantir l'affichage en heure locale de
 * l'organisation (Europe/Paris par défaut, surchargeable via
 * `process.env.APP_TZ`).
 *
 * On gère aussi la conversion `<input type="datetime-local">` ⇄ Date :
 * le navigateur sérialise la valeur en "heure locale brute" (sans
 * fuseau), donc on ne peut pas se contenter d'un `new Date(s)` côté
 * serveur — sinon Node l'interprète comme UTC.
 */
export const APP_TZ = process.env.APP_TZ || 'Europe/Paris';

const TWO_DIGIT_PARTS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
} as const;

/** Calcule l'offset (en ms) entre l'UTC et la timezone donnée pour un instant donné. */
function getTimezoneOffsetMs(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      ...TWO_DIGIT_PARTS,
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value] as const),
  );
  const asTzUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asTzUtcMs - date.getTime();
}

/**
 * Convertit la valeur d'un `<input type="datetime-local">` (format
 * "YYYY-MM-DDTHH:mm", interprétée comme heure locale par le navigateur)
 * en un objet `Date` UTC absolu, en supposant que la chaîne représente
 * l'heure locale dans `APP_TZ` (Paris par défaut).
 */
export function parseLocalDatetimeInput(s: string, tz: string = APP_TZ): Date {
  // s peut être "2024-12-15T14:00" ou "2024-12-15T14:00:00"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return new Date(NaN);
  const [, y, mo, d, hh, mm, ss] = m;
  const naiveUtcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss ?? 0),
  );
  // Calcule l'offset à cet instant approx (DST-aware via Intl).
  const offset = getTimezoneOffsetMs(new Date(naiveUtcMs), tz);
  return new Date(naiveUtcMs - offset);
}

/**
 * Formate une Date en chaîne "YYYY-MM-DDTHH:mm" exprimée dans `APP_TZ`,
 * compatible avec la valeur initiale d'un `<input type="datetime-local">`.
 */
export function toLocalDatetimeInput(
  d: Date | string,
  tz: string = APP_TZ,
): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value] as const),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
