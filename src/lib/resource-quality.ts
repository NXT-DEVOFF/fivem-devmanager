/** Analyse pure de la qualite des ressources synchronisees. */

export type FindingSeverity = "error" | "warning" | "info";

export interface ResourceQualityInput {
  name: string;
  folder: string;
  state: string;
  fileCount: number;
  manifest: unknown;
  dependencies: string[];
  missingDependencies: string[];
}

export interface ResourceFinding {
  code: string;
  severity: FindingSeverity;
  message: string;
  /** Noms exacts des elements concernes (ex. dependances manquantes). */
  details?: string[];
}

export interface ResourceQualityReport {
  name: string;
  folder: string;
  state: string;
  fileCount: number;
  score: number;
  missingDependencies: string[];
  findings: ResourceFinding[];
}

export interface QualitySummary {
  resources: number;
  averageScore: number;
  errors: number;
  warnings: number;
  clean: number;
}

const MODERN_FX_VERSIONS = new Set(["cerulean", "bodacious", "adamant"]);

function asManifest(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Analyse une ressource et renvoie un score sur 100 + des constats actionnables. */
export function analyzeResource(input: ResourceQualityInput): ResourceQualityReport {
  const findings: ResourceFinding[] = [];
  const missingDependencies = Array.from(
    new Set(input.missingDependencies.map((dependency) => dependency.trim()).filter(Boolean)),
  ).sort();

  if (input.state === "manifest_absent") {
    findings.push({
      code: "manifest_missing",
      severity: "error",
      message: "fxmanifest.lua (ou __resource.lua) est absent du dossier.",
    });
  }

  const manifest = asManifest(input.manifest);
  if (!manifest) {
    if (input.state !== "manifest_absent") {
      findings.push({
        code: "manifest_unreadable",
        severity: "error",
        message: "Le manifeste enregistre est illisible : relancez la synchronisation.",
      });
    }
  } else {
    const fxVersion = typeof manifest.fxVersion === "string" ? manifest.fxVersion : "";
    if (!fxVersion) {
      findings.push({
        code: "fx_version_missing",
        severity: "error",
        message: "fx_version n'est pas declare (valeur attendue : cerulean).",
      });
    } else if (!MODERN_FX_VERSIONS.has(fxVersion)) {
      findings.push({
        code: "fx_version_old",
        severity: "warning",
        message: `fx_version "${fxVersion}" est ancienne ; preferez cerulean.`,
      });
    }

    if (typeof manifest.game !== "string" || !manifest.game) {
      findings.push({
        code: "game_missing",
        severity: "warning",
        message: "game n'est pas declare (fxserver attendu).",
      });
    }

    const scripts = [
      ...strings(manifest.clientScripts),
      ...strings(manifest.serverScripts),
      ...strings(manifest.sharedScripts),
    ];
    if (scripts.length === 0) {
      findings.push({
        code: "no_scripts",
        severity: "warning",
        message: "Aucun script client, serveur ou partage n'est declare.",
      });
    }

    const suspicious = scripts.filter(
      (script) => script.includes("..") || script.startsWith("/") || script.includes("\\"),
    );
    if (suspicious.length > 0) {
      findings.push({
        code: "suspicious_script_path",
        severity: "error",
        message: `Chemin de script hors ressource : ${suspicious.slice(0, 3).join(", ")}`,
      });
    }

    if (typeof manifest.version !== "string" || !manifest.version) {
      findings.push({
        code: "version_missing",
        severity: "info",
        message: "Aucune version n'est renseignee dans le manifeste.",
      });
    }
  }

  if (input.fileCount === 0) {
    findings.push({
      code: "empty_folder",
      severity: "warning",
      message: "Le dossier de la ressource ne contient aucun fichier.",
    });
  }

  if (missingDependencies.length > 0) {
    findings.push({
      code: "missing_dependencies",
      severity: "warning",
      message:
        missingDependencies.length === 1
          ? `Dependance introuvable : ${missingDependencies[0]}`
          : `${missingDependencies.length} dependances introuvables dans /resources.`,
      details: missingDependencies,
    });
  }

  const penalty = findings.reduce(
    (sum, finding) =>
      sum + (finding.severity === "error" ? 35 : finding.severity === "warning" ? 12 : 3),
    0,
  );

  return {
    name: input.name,
    folder: input.folder,
    state: input.state,
    fileCount: input.fileCount,
    score: Math.max(0, 100 - penalty),
    missingDependencies,
    findings,
  };
}

export function summarizeQuality(reports: ResourceQualityReport[]): QualitySummary {
  const total = reports.length;
  const errors = reports.filter((report) =>
    report.findings.some((finding) => finding.severity === "error"),
  ).length;
  const warnings = reports.filter((report) =>
    report.findings.some((finding) => finding.severity === "warning"),
  ).length;
  const clean = reports.filter(
    (report) =>
      !report.findings.some(
        (finding) => finding.severity === "error" || finding.severity === "warning",
      ),
  ).length;

  return {
    resources: total,
    averageScore: total
      ? Math.round(reports.reduce((sum, report) => sum + report.score, 0) / total)
      : 100,
    errors,
    warnings,
    clean,
  };
}
