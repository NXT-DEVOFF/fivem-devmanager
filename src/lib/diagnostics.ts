/** Logique pure du module Diagnostic : score, severite et regroupement. */

export type DiagnosticStatus = "ok" | "warn" | "fail" | "skip";
export type DiagnosticGroup = "coeur" | "integrations" | "activite";

export interface DiagnosticCheck {
  id: string;
  label: string;
  group: DiagnosticGroup;
  status: DiagnosticStatus;
  detail: string;
  hint?: string;
  fixHref?: string;
  latencyMs?: number;
}

export const DIAGNOSTIC_GROUPS: Array<{ id: DiagnosticGroup; label: string }> = [
  { id: "coeur", label: "Coeur applicatif" },
  { id: "integrations", label: "Integrations" },
  { id: "activite", label: "Activite et qualite" },
];

const WEIGHTS: Record<DiagnosticStatus, number | null> = {
  ok: 1,
  warn: 0.5,
  fail: 0,
  skip: null,
};

/** Score sur 100 ; les controles non applicables (skip) sont ignores. */
export function diagnosticScore(checks: DiagnosticCheck[]): number {
  const scored = checks.filter((check) => WEIGHTS[check.status] !== null);
  if (scored.length === 0) return 100;
  const total = scored.reduce((sum, check) => sum + (WEIGHTS[check.status] ?? 0), 0);
  return Math.round((total / scored.length) * 100);
}

export function worstDiagnosticStatus(checks: DiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  if (checks.some((check) => check.status === "ok")) return "ok";
  return "skip";
}

export function diagnosticCounts(checks: DiagnosticCheck[]): Record<DiagnosticStatus, number> {
  const counts: Record<DiagnosticStatus, number> = { ok: 0, warn: 0, fail: 0, skip: 0 };
  for (const check of checks) counts[check.status] += 1;
  return counts;
}

export function groupDiagnostics(
  checks: DiagnosticCheck[],
): Array<{ id: DiagnosticGroup; label: string; checks: DiagnosticCheck[] }> {
  return DIAGNOSTIC_GROUPS.map((group) => ({
    ...group,
    checks: checks.filter((check) => check.group === group.id),
  })).filter((group) => group.checks.length > 0);
}
