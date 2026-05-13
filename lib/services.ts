/**
 * Liste canonique des services proposés dans le dropdown.
 *
 * Garder l'ordre stable : la valeur stockée en base est exactement la
 * chaîne ci-dessous, donc renommer un service ici "déplace" tous les
 * users qui l'avaient choisi vers la nouvelle étiquette uniquement à
 * la prochaine mise à jour côté UI — leur valeur en base reste
 * l'ancien libellé. Ajouter en fin de liste pour éviter ce souci.
 */
export const SERVICES = [
  'Direction',
  'Commercial',
  'Marketing',
  'Communication',
  'RH',
  'IT',
  'Comptabilité',
  'Achats',
  'Logistique',
  'Production',
  'SAV',
  'Qualité',
] as const;

export type Service = (typeof SERVICES)[number];

export const isKnownService = (s: string | null | undefined): s is Service =>
  s != null && (SERVICES as readonly string[]).includes(s);
