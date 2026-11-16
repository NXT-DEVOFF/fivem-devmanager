/**
 * Integration IA (API compatible OpenAI) pour les bilans et patch notes.
 *
 * Le fournisseur ne recoit que des donnees de session deja collectees.
 * Toute sortie est re-filtree cote serveur avant utilisation : aucune
 * fonctionnalite, aucun fichier et aucun chiffre ne peut etre invente.
 *
 * Configuration (panel -> Startup ou .env) :
 *   AI_API_KEY   cle API (obligatoire pour activer l'IA)
 *   AI_BASE_URL  defaut https://api.openai.com/v1
 *   AI_MODEL     defaut gpt-4o-mini
 */
import "server-only";
import { z } from "zod";
import type { SessionReportData } from "@/server/reports";
import type { PatchNoteDraft, PatchNoteSections } from "@/lib/patch-notes";

const aiResponseSchema = z.object({
  title: z.string().max(200),
  subtitle: z.string().max(500),
  sections: z
    .array(
      z.object({
        heading: z.string().max(120),
        items: z.array(z.string().max(400)).max(12),
      }),
    )
    .max(6),
});

const reportResponseSchema = z.object({
  summary: z.string().max(6000),
});

function aiEnv(): { baseUrl: string; model: string; apiKey: string } | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model };
}

export function isAiConfigured(): boolean {
  return aiEnv() !== null;
}

async function chatJson(system: string, user: string, maxTokens: number): Promise<unknown | null> {
  const env = aiEnv();
  if (!env) return null;

  const response = await fetch(`${env.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`Fournisseur IA : ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function sessionFacts(data: SessionReportData) {
  return {
    session: `#DEV-${String(data.number).padStart(4, "0")}`,
    developpeur: data.developer.name,
    duree_active_minutes: Math.round(data.activeSeconds / 60),
    taches_terminees: data.tasksCompleted.map((task) => `${task.code} - ${task.title}`),
    taches_restantes: data.tasksRemaining.map((task) => `${task.code} - ${task.title}`),
    bugs_corriges: data.bugsFixed.map((bug) => `${bug.code} (${bug.severity}) - ${bug.title}`),
    ressources: data.resources,
    fichiers: {
      crees: data.filesCreated.slice(0, 80),
      modifies: data.filesModified.slice(0, 80),
      supprimes: data.filesDeleted.slice(0, 80),
      total_modifications: data.changes.length,
      lignes_ajoutees: data.changes.reduce((sum, change) => sum + change.additions, 0),
      lignes_supprimees: data.changes.reduce((sum, change) => sum + change.deletions, 0),
    },
    tests: data.tests,
    deploiements: data.deployments,
    commandes_console: data.commands.length,
    modifications_en_attente: data.pendingChanges,
    resume_developpeur: data.summary,
  };
}

export async function refineWithAi(
  draft: PatchNoteDraft,
  data: SessionReportData,
): Promise<{ title: string; subtitle: string; publicSections: PatchNoteSections[] } | null> {
  if (!isAiConfigured()) return null;

  const system = [
    "Tu es un redacteur de patch notes pour un serveur FiveM roleplay.",
    "Tu dois UNIQUEMENT reformuler les faits fournis.",
    "INTERDICTION ABSOLUE d'inventer des fonctionnalites, corrections, chiffres ou dates.",
    "N'expose jamais de chemins de fichiers, d'adresses IP, de cles, de liens ou d'emails.",
    "Reponds en JSON strict: {title, subtitle, sections:[{heading, items[]}]}.",
    "Les titres de sections doivent commencer par un emoji.",
    "Les items doivent rester courts et lisibles par des joueurs.",
  ].join(" ");

  const raw = await chatJson(
    system,
    `Faits verifies (source unique de verite) :\n${JSON.stringify(sessionFacts(data), null, 2)}\n\nBrouillon actuel :\n${JSON.stringify(
      { title: draft.title, subtitle: draft.subtitle, sections: draft.publicSections },
      null,
      2,
    )}`,
    900,
  );
  if (!raw) return null;

  const parsed = aiResponseSchema.safeParse(raw);
  if (!parsed.success) return null;

  return {
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    publicSections: parsed.data.sections,
  };
}

/**
 * Bilan de session redige par l'IA. Le texte est ajoute au rapport interne,
 * au-dessus du rapport deterministe (qui reste la reference).
 */
export async function generateReportSummary(data: SessionReportData): Promise<string | null> {
  if (!isAiConfigured()) return null;

  const system = [
    "Tu rediges un bilan de fin de session pour une equipe de developpement FiveM.",
    "Le bilan est interne : il peut citer les fichiers et ressources fournis.",
    "Tu dois UNIQUEMENT utiliser les faits fournis ; n'invente aucune action, aucun chiffre.",
    "N'expose aucune cle, aucun token, aucune adresse IP, aucun webhook.",
    "Reponds en JSON strict: {\"summary\": \"markdown\"}.",
    "Le markdown doit contenir 3 sections: '## Bilan de la session', '## Points techniques', '## Suivi'.",
    "Chaque section contient des puces '- ...'. Reste concis (400 mots maximum).",
  ].join(" ");

  const raw = await chatJson(
    system,
    `Faits verifies de la session :\n${JSON.stringify(sessionFacts(data), null, 2)}`,
    900,
  );
  if (!raw) return null;

  const parsed = reportResponseSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.summary.trim()) return null;
  return parsed.data.summary.trim();
}
