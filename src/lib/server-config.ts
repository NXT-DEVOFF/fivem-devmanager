/**
 * Analyse pure d'un `server.cfg` FiveM : tokenisation, directives, controle de
 * coherence et comparaison avec les ressources installees.
 *
 * Aucun acces disque ici : la lecture du fichier reste dans `src/server`.
 */
import { isBuiltinResource, normalizeResourceName } from "@/lib/resource-name";

export const DEFAULT_CONFIG_PATH = "/server.cfg";

export interface ConfigDirective {
  line: number;
  command: string;
  args: string[];
}

export interface ParsedConfig {
  directives: ConfigDirective[];
  settings: Record<string, string>;
  ensured: string[];
  duplicates: string[];
  endpoints: { tcp: string[]; udp: string[] };
  aceCount: number;
  lineCount: number;
}

export interface ConfigCheck {
  id: string;
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
}

export interface ConfigReport {
  ok: boolean;
  path: string;
  error?: string;
  generatedAt: string;
  lineCount: number;
  directiveCount: number;
  aceCount: number;
  settings: Array<{ key: string; value: string; masked: boolean }>;
  endpoints: { tcp: string[]; udp: string[] };
  resources: {
    ensured: string[];
    duplicates: string[];
    missing: string[];
    notStarted: string[];
  };
  checks: ConfigCheck[];
}

export function sanitizeConfigPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return DEFAULT_CONFIG_PATH;
  if (trimmed.includes("..") || trimmed.length > 500) return DEFAULT_CONFIG_PATH;
  return trimmed;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#") return line.slice(0, index);
    if (char === "/" && line[index + 1] === "/") return line.slice(0, index);
  }
  return line;
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** Analyse le contenu d'un server.cfg (commentaires, quotes, directives). */
export function parseServerConfig(content: string): ParsedConfig {
  const lines = content.split(/\r?\n/);
  const directives: ConfigDirective[] = [];
  const settings: Record<string, string> = {};
  const ensured: string[] = [];
  const endpoints = { tcp: [] as string[], udp: [] as string[] };
  let aceCount = 0;

  lines.forEach((rawLine, index) => {
    const line = stripComment(rawLine).trim();
    if (!line) return;
    const tokens = tokenize(line);
    const command = tokens[0]?.toLowerCase();
    if (!command) return;
    const args = tokens.slice(1);
    directives.push({ line: index + 1, command, args });

    if (command === "set" || command === "sets") {
      const key = args[0];
      if (key) settings[key.toLowerCase()] = args.slice(1).join(" ");
      return;
    }
    if (command === "endpoint_add_tcp" || command === "endpoint_add_udp") {
      const value = args[0];
      if (!value) return;
      if (command === "endpoint_add_tcp") endpoints.tcp.push(value);
      else endpoints.udp.push(value);
      return;
    }
    if (command === "ensure" || command === "start") {
      const name = args[0];
      if (name) ensured.push(name);
      return;
    }
    if (command.includes("ace") || command.includes("principal")) {
      aceCount += 1;
      return;
    }
    if (command.startsWith("sv_") || command.startsWith("rcon_") || command.startsWith("net_")) {
      if (args.length > 0) settings[command] = args.join(" ");
    }
  });

  const seen = new Map<string, number>();
  for (const name of ensured) {
    const key = normalizeResourceName(name);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);

  return {
    directives,
    settings,
    ensured,
    duplicates,
    endpoints,
    aceCount,
    lineCount: lines.length,
  };
}

const SENSITIVE_KEY = /(license|key|password|token|secret|rcon)/i;

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

/** Construit le rapport d'audit a partir du contenu et des ressources installees. */
export function buildConfigReport(
  path: string,
  content: string,
  installed: Array<{ name: string; folder: string }>,
): ConfigReport {
  const parsed = parseServerConfig(content);
  const checks: ConfigCheck[] = [];

  const license = parsed.settings["sv_licensekey"];
  if (!license) {
    checks.push({
      id: "license-missing",
      level: "error",
      title: "Cle de licence absente",
      detail: "Ajoutez `sv_licenseKey \"...\"` : sans licence le serveur refuse de demarrer.",
    });
  } else if (license.length < 32) {
    checks.push({
      id: "license-short",
      level: "warning",
      title: "Cle de licence suspecte",
      detail: `La cle fait ${license.length} caracteres, une cle Cfx.re en compte 40.`,
    });
  }

  if (parsed.endpoints.tcp.length === 0) {
    checks.push({
      id: "endpoint-tcp",
      level: "error",
      title: "Aucun endpoint TCP",
      detail: "Ajoutez `endpoint_add_tcp \"0.0.0.0:30120\"` pour que les joueurs puissent se connecter.",
    });
  }
  if (parsed.endpoints.udp.length === 0) {
    checks.push({
      id: "endpoint-udp",
      level: "warning",
      title: "Aucun endpoint UDP",
      detail: "`endpoint_add_udp` est necessaire au trafic voix et a la decouverte du serveur.",
    });
  }

  if (!parsed.settings["sv_maxclients"]) {
    checks.push({
      id: "maxclients",
      level: "warning",
      title: "sv_maxclients non defini",
      detail: "Sans limite explicite, le serveur utilise la valeur par defaut de FXServer.",
    });
  }

  const onesync = (parsed.settings["onesync"] ?? parsed.settings["sv_onesync"] ?? "").toLowerCase();
  if (!["on", "legacy", "true"].includes(onesync)) {
    checks.push({
      id: "onesync",
      level: "warning",
      title: "OneSync desactive",
      detail: "Ajoutez `set onesync on` pour les fonctionnalites modernes (entites, population).",
    });
  }

  if (parsed.settings["sv_scriptHookAllowed"] === "1") {
    checks.push({
      id: "scripthook",
      level: "error",
      title: "ScriptHook autorise",
      detail: "`sv_scriptHookAllowed 1` permet l'execution de code client arbitraire : a passer a 0.",
    });
  }

  if (parsed.settings["sv_endpointPrivacy"] === "0") {
    checks.push({
      id: "endpoint-privacy",
      level: "warning",
      title: "Adresse IP des joueurs exposee",
      detail: "`sv_endpointPrivacy 0` divulgue les IP des joueurs aux clients ; preferez 1.",
    });
  }

  const rcon = parsed.settings["rcon_password"];
  if (!rcon) {
    checks.push({
      id: "rcon-absent",
      level: "info",
      title: "RCON desactive",
      detail: "Aucun `rcon_password` : c'est le choix recommande si vous n'utilisez pas RCON.",
    });
  } else if (rcon.length < 12) {
    checks.push({
      id: "rcon-weak",
      level: "warning",
      title: "Mot de passe RCON faible",
      detail: "Utilisez au moins 12 caracteres aleatoires et renouvelez-le apres chaque fuite.",
    });
  }

  if (parsed.duplicates.length > 0) {
    checks.push({
      id: "duplicates",
      level: "warning",
      title: "Ressources demarrees plusieurs fois",
      detail: `Doublons detectes : ${parsed.duplicates.slice(0, 12).join(", ")}.`,
    });
  }

  const installedNames = new Set<string>();
  for (const resource of installed) {
    installedNames.add(normalizeResourceName(resource.name));
    installedNames.add(normalizeResourceName(resource.folder));
  }

  const ensuredUnique = [...new Set(parsed.ensured)];
  const missing = ensuredUnique.filter((name) => {
    const normalized = normalizeResourceName(name);
    return !isBuiltinResource(name) && !installedNames.has(normalized);
  });

  if (missing.length > 0) {
    checks.push({
      id: "missing-resources",
      level: "warning",
      title: `${missing.length} ressource(s) demarree(s) mais introuvable(s)`,
      detail: missing.slice(0, 12).join(", "),
    });
  }

  const ensuredNormalized = new Set(ensuredUnique.map((name) => normalizeResourceName(name)));
  const notStarted = installed
    .filter(
      (resource) =>
        !isBuiltinResource(resource.name) &&
        !ensuredNormalized.has(normalizeResourceName(resource.name)) &&
        !ensuredNormalized.has(normalizeResourceName(resource.folder)),
    )
    .map((resource) => resource.name);

  if (notStarted.length > 0) {
    checks.push({
      id: "not-started",
      level: "info",
      title: `${notStarted.length} ressource(s) installee(s) non demarree(s)`,
      detail: notStarted.slice(0, 12).join(", ") + (notStarted.length > 12 ? "…" : ""),
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: "all-good",
      level: "info",
      title: "Configuration conforme",
      detail: "Aucun probleme detecte sur les controles de base.",
    });
  }

  return {
    ok: true,
    path,
    generatedAt: new Date().toISOString(),
    lineCount: parsed.lineCount,
    directiveCount: parsed.directives.length,
    aceCount: parsed.aceCount,
    settings: Object.entries(parsed.settings)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const masked = SENSITIVE_KEY.test(key);
        return { key, value: masked ? mask(value) : value, masked };
      }),
    endpoints: parsed.endpoints,
    resources: {
      ensured: ensuredUnique,
      duplicates: parsed.duplicates,
      missing,
      notStarted,
    },
    checks,
  };
}
