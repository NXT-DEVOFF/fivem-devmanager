/**
 * Construction des patch notes et de leur section "fichiers modifies".
 *
 * Logique pure : aucun acces base ni reseau, donc testable sans Prisma.
 * Les seules sources sont les donnees reelles de la session ; rien n'est
 * invente ici.
 */

export interface PatchNoteSections {
  heading: string;
  items: string[];
}

export interface PatchNoteDraft {
  version: string;
  title: string;
  subtitle: string;
  publicSections: PatchNoteSections[];
  internalSections: PatchNoteSections[];
  publicBody: string;
  internalBody: string;
}

export interface PatchFileChange {
  path: string;
  type: string;
  additions: number;
  deletions: number;
  taskCode: string | null;
  resource?: string | null;
  at?: string;
}

export interface PatchSourceData {
  number: number;
  developer: { name: string };
  activeSeconds: number;
  durationSeconds: number;
  status: string;
  tasks: Array<{ code: string; title: string; status: string; timeSpentSeconds: number }>;
  tasksCompleted: Array<{ code: string; title: string }>;
  tasksRemaining: Array<{ code: string; title: string; status: string }>;
  bugsFixed: Array<{ code: string; title: string; severity: string }>;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  resources: string[];
  changes: PatchFileChange[];
  tests: Array<{ name: string; result: string }>;
  deployments: Array<{ resource: string; status: string }>;
  pendingChanges: number;
  notes: string[];
  commands: Array<{ command: string; at?: string }>;
  summary: string | null;
}

export const PUBLIC_CATEGORY_MAP: Record<string, { heading: string; emoji: string }> = {
  SCRIPT: { heading: "Nouveautes", emoji: "🆕" },
  UI: { heading: "Nouveautes", emoji: "🆕" },
  GAMEPLAY: { heading: "Nouveautes", emoji: "🆕" },
  VEHICLES: { heading: "Nouveautes", emoji: "🆕" },
  MAPPING: { heading: "Nouveautes", emoji: "🆕" },
  ADMINISTRATION: { heading: "Nouveautes", emoji: "🆕" },
  DATABASE: { heading: "Ameliorations", emoji: "✨" },
  OPTIMIZATION: { heading: "Optimisations", emoji: "⚡" },
  CONFIG: { heading: "Configuration", emoji: "⚙️" },
  SECURITY: { heading: "Securite", emoji: "🔒" },
  BUGFIX: { heading: "Corrections", emoji: "🔧" },
};

const CONTENT_HEADING = "🛠 Contenu mis a jour";
const DEPLOY_HEADING = "🚀 Mises en production";
const FILES_HEADING = "📁 Fichiers modifies";

/**
 * Neutralise les informations sensibles avant publication publique :
 * chemins internes, URLs de panel, cles, IP, identifiants, webhooks.
 */
export function sanitizePublicText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)]+/gi, "[lien interne]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, "[adresse interne]")
    .replace(/\b(?:api[_-]?key|token|secret|password|mot de passe)\s*[:=]\s*\S+/gi, "[masque]")
    .replace(/\/[A-Za-z0-9_\-[\]./]{2,}\.(?:lua|js|ts|json|cfg|sql|yml|yaml)\b/g, "[fichier interne]")
    .replace(/\bresources\/[^\s]+/gi, "[ressource interne]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[email]")
    .trim();
}

export function sanitizeInternalText(text: string): string {
  return text
    .replace(/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "[masque]")
    .replace(/https:\/\/discord(?:app)?\.com\/api\/webhooks\/\S+/gi, "[webhook masque]")
    .trim();
}

export function renderSections(sections: PatchNoteSections[]): string {
  return sections
    .filter((section) => section.items.length > 0)
    .map(
      (section) =>
        `## ${section.heading}\n${section.items.map((item) => `- ${item}`).join("\n")}`,
    )
    .join("\n\n");
}

/** Parse un markdown "## Titre\n- item" en sections structurees. */
export function parseSections(markdown: string): PatchNoteSections[] {
  const sections: PatchNoteSections[] = [];
  let current: PatchNoteSections | null = null;
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), items: [] };
      sections.push(current);
      continue;
    }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!current) {
        current = { heading: "Changements", items: [] };
        sections.push(current);
      }
      const item = line.slice(2).trim();
      if (item) current.items.push(item);
    }
  }
  return sections;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Garde-fou anti-hallucination : ne conserve que les elements partageant
 * au moins un mot significatif avec les donnees sources.
 */
export function filterGroundedSections(
  candidate: PatchNoteSections[],
  source: PatchNoteSections[],
): PatchNoteSections[] {
  const vocabulary = new Set(
    source
      .flatMap((section) => section.items.flatMap((item) => tokenize(item)))
      .filter((token) => token.length > 3),
  );

  return candidate
    .map((section) => ({
      heading: section.heading,
      items: section.items.filter((item) => {
        const tokens = tokenize(item).filter((token) => token.length > 3);
        if (tokens.length === 0) return false;
        return tokens.some((token) => vocabulary.has(token));
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/** Extrait le nom de ressource FiveM d'un chemin, sans exposer le chemin. */
export function resourceFromPath(path: string): string | null {
  const match = /^resources\/(?:\[[^\]]+\]\/)?([^/]+)\//i.exec(path.replace(/\\/g, "/"));
  return match?.[1] ?? null;
}

function changeLetter(type: string): string {
  if (type === "FILE_CREATED" || type === "FOLDER_CREATED") return "A";
  if (type === "FILE_DELETED" || type === "FOLDER_DELETED") return "D";
  if (type === "FILE_RENAMED") return "R";
  return "M";
}

/**
 * Sections publiques : taches terminees, bugs corriges, ressources touchees
 * et mises en production. Toutes les modifications de la session sont prises
 * en compte, sans jamais publier de chemin interne.
 */
export function buildPublicSections(
  data: PatchSourceData,
  taskCategories?: Map<string, string>,
): PatchNoteSections[] {
  const sections = new Map<string, { heading: string; items: Set<string> }>();

  const push = (heading: string, rawItem: string) => {
    const item = sanitizePublicText(rawItem);
    if (!item) return;
    if (!sections.has(heading)) sections.set(heading, { heading, items: new Set() });
    sections.get(heading)!.items.add(item);
  };

  for (const task of data.tasksCompleted) {
    const mapping = PUBLIC_CATEGORY_MAP[taskCategories?.get(task.code) ?? "SCRIPT"] ?? PUBLIC_CATEGORY_MAP.SCRIPT!;
    push(`${mapping.emoji} ${mapping.heading}`, task.title);
  }

  for (const bug of data.bugsFixed) {
    push(`${PUBLIC_CATEGORY_MAP.BUGFIX!.emoji} ${PUBLIC_CATEGORY_MAP.BUGFIX!.heading}`, bug.title);
  }

  if (data.resources.length > 0) {
    const counts = new Map<string, number>();
    for (const change of data.changes) {
      const resource = change.resource ?? resourceFromPath(change.path);
      if (!resource) continue;
      counts.set(resource, (counts.get(resource) ?? 0) + 1);
    }
    for (const resource of data.resources) {
      const files = counts.get(resource) ?? 0;
      push(
        CONTENT_HEADING,
        files > 1 ? `Mise a jour de ${resource} (${files} fichiers)` : `Mise a jour de ${resource}`,
      );
    }
  }

  const deployed = data.deployments.filter((deployment) => deployment.status === "DEPLOYED");
  for (const deployment of deployed) {
    push(DEPLOY_HEADING, `Mise en production : ${deployment.resource}`);
  }

  if (sections.size === 0 && data.changes.length > 0) {
    push(
      "🔧 Corrections",
      `Maintenance interne (${data.changes.length} modification${data.changes.length > 1 ? "s" : ""})`,
    );
  }

  return Array.from(sections.values())
    .map((section) => ({ heading: section.heading, items: Array.from(section.items) }))
    .filter((section) => section.items.length > 0);
}

/**
 * Section "fichiers modifies" facon GitHub : une ligne par fichier avec son
 * statut (A/M/D/R) et le nombre de lignes ajoutees/retirees, puis le total.
 * Destinee aux notes internes (les chemins ne sont jamais publies).
 */
export function buildFileChangeSection(data: PatchSourceData, limit = 200): PatchNoteSections {
  const changes = [...data.changes].sort((a, b) => a.path.localeCompare(b.path));
  const items: string[] = [];

  if (changes.length === 0) {
    const fallback = [
      ...data.filesCreated.map((path) => `A \`${path}\``),
      ...data.filesModified.map((path) => `M \`${path}\``),
      ...data.filesDeleted.map((path) => `D \`${path}\``),
    ];
    for (const path of fallback.slice(0, limit)) items.push(path);
    return { heading: FILES_HEADING, items };
  }

  for (const change of changes.slice(0, limit)) {
    const task = change.taskCode ? ` [${change.taskCode}]` : "";
    items.push(
      `${changeLetter(change.type)} \`${sanitizeInternalText(change.path)}\` (+${change.additions}/-${change.deletions})${task}`,
    );
  }
  if (changes.length > limit) {
    items.push(`... et ${changes.length - limit} autres fichiers`);
  }

  const additions = changes.reduce((sum, change) => sum + change.additions, 0);
  const deletions = changes.reduce((sum, change) => sum + change.deletions, 0);
  items.push(
    `Total : ${changes.length} fichier(s), +${additions} / -${deletions} lignes`,
  );

  return { heading: FILES_HEADING, items };
}

export function buildInternalSections(data: PatchSourceData): PatchNoteSections[] {
  const sections: PatchNoteSections[] = [];

  if (data.summary?.trim()) {
    sections.push({
      heading: "Resume du developpeur",
      items: data.summary
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 30),
    });
  }

  sections.push({
    heading: "Ressources et fichiers",
    items: [
      ...data.resources.map((resource) => `Ressource modifiee : ${resource}`),
      ...data.filesCreated.map((file) => `Fichier cree : ${file}`),
      ...data.filesModified.map((file) => `Fichier modifie : ${file}`),
      ...data.filesDeleted.map((file) => `Fichier supprime : ${file}`),
    ],
  });

  const fileSection = buildFileChangeSection(data);
  if (fileSection.items.length > 0) sections.push(fileSection);

  sections.push({
    heading: "Corrections techniques",
    items: data.bugsFixed.map((bug) => `[${bug.severity}] ${bug.code} - ${bug.title}`),
  });

  sections.push({
    heading: "Tests et deploiement",
    items: [
      ...data.tests.map((test) => `${test.name} : ${test.result}`),
      ...data.deployments.map(
        (deployment) => `Deploiement ${deployment.resource} : ${deployment.status}`,
      ),
    ],
  });

  if (data.commands.length > 0) {
    sections.push({
      heading: "Commandes console",
      items: [
        ...data.commands.slice(0, 30).map((entry) => {
          const time = entry.at ? new Date(entry.at).toLocaleTimeString("fr-FR") : "";
          return `${time ? `${time} ` : ""}${entry.command}`;
        }),
        ...(data.commands.length > 30 ? [`... et ${data.commands.length - 30} autres commandes`] : []),
      ],
    });
  }

  sections.push({
    heading: "Suivi",
    items: [
      `Session #DEV-${String(data.number).padStart(4, "0")} - ${data.developer.name}`,
      `Temps actif : ${Math.round(data.activeSeconds / 60)} min`,
      `Fichiers : ${data.filesCreated.length} crees, ${data.filesModified.length} modifies, ${data.filesDeleted.length} supprimes`,
      `Modifications en attente de validation : ${data.pendingChanges}`,
      `Notes de session : ${data.notes.length}`,
    ],
  });

  return sections;
}

export function buildPublicFallback(): PatchNoteSections[] {
  return [{ heading: "🔧 Corrections", items: ["Maintenance interne et corrections diverses."] }];
}
