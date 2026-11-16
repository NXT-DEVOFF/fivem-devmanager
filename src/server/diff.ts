/** Calcul de differences de texte (lignes) et statistiques. */
import { createTwoFilesPatch, diffLines } from "diff";

export interface DiffStats {
  additions: number;
  deletions: number;
  hunks: number;
}

export function buildUnifiedDiff(
  path: string,
  before: string,
  after: string,
  context = 3,
): string {
  if (before === after) return "";
  const patch = createTwoFilesPatch(
    `a/${path}`,
    `b/${path}`,
    before,
    after,
    "avant",
    "apres",
    { context },
  );
  return patch.length > 400_000 ? `${patch.slice(0, 400_000)}\n… diff tronque …` : patch;
}

export function diffStats(before: string, after: string): DiffStats {
  const changes = diffLines(before, after);
  let additions = 0;
  let deletions = 0;
  let hunks = 0;
  for (const change of changes) {
    if (change.added) {
      additions += change.count ?? 0;
      hunks += 1;
    } else if (change.removed) {
      deletions += change.count ?? 0;
      hunks += 1;
    }
  }
  return { additions, deletions, hunks: Math.ceil(hunks / 2) };
}

/** Extrait un extrait lisible autour des premieres differences. */
export function diffPreview(before: string, after: string, maxLines = 40): string[] {
  const lines = buildUnifiedDiff("fichier", before, after).split("\n");
  return lines.filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line)).slice(0, maxLines);
}
