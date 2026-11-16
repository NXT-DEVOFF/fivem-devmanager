/**
 * Normalise une colonne JSON (ancien String[] PostgreSQL) en tableau de chaines.
 * Les valeurs absentes, nulles ou invalides sont ignorees.
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
