/**
 * Generation des patch notes (internes + publiques).
 *
 * Regle absolue : aucun contenu non present dans les donnees de session.
 * L'IA ne peut que reformuler ; les elements non ancredés sont supprimes.
 * La liste des fichiers modifies est toujours ajoutee aux notes internes,
 * facon GitHub, sans passer par l'IA.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { nextPatchVersion } from "@/server/settings";
import { refineWithAi, isAiConfigured } from "@/server/ai";
import type { SessionReportData } from "@/server/reports";
import {
  buildInternalSections,
  buildPublicFallback,
  buildPublicSections,
  filterGroundedSections,
  parseSections,
  renderSections,
  sanitizeInternalText,
  sanitizePublicText,
  type PatchNoteDraft,
  type PatchNoteSections,
} from "@/lib/patch-notes";

export { renderSections, parseSections, sanitizePublicText, sanitizeInternalText, filterGroundedSections };
export type { PatchNoteDraft, PatchNoteSections };

async function uniqueVersion(base: string): Promise<string> {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(base);
  if (!match) return `${base}.1`;
  let patch = Number(match[3]);
  let version = base;
  // Deux sessions terminees en meme temps peuvent calculer la meme version :
  // on avance jusqu'a trouver une version libre.
  while (await prisma.patchNote.findFirst({ where: { version }, select: { id: true } })) {
    patch += 1;
    version = `${match[1]}.${match[2]}.${patch}`;
  }
  return version;
}

export async function buildDraftFromSession(
  data: SessionReportData,
  taskCategories?: Map<string, string>,
): Promise<PatchNoteDraft> {
  const version = await uniqueVersion(await nextPatchVersion());

  const publicSections = buildPublicSections(data, taskCategories);
  const internalSections = buildInternalSections(data);

  const draft: PatchNoteDraft = {
    version,
    title: `Mise a jour serveur - Version ${version}`,
    subtitle: "Voici les dernieres ameliorations apportees au serveur.",
    publicSections: publicSections.length > 0 ? publicSections : buildPublicFallback(),
    internalSections,
    publicBody: renderSections(publicSections),
    internalBody: renderSections(internalSections),
  };

  if (isAiConfigured()) {
    const refined = await refineWithAi(draft, data).catch((error) => {
      console.error("[patchnotes] raffinement IA impossible:", error);
      return null;
    });
    if (refined) {
      const grounded = filterGroundedSections(refined.publicSections, draft.publicSections);
      return {
        ...draft,
        title: refined.title || draft.title,
        subtitle: refined.subtitle || draft.subtitle,
        publicSections: grounded.length > 0 ? grounded : draft.publicSections,
        publicBody: renderSections(grounded.length > 0 ? grounded : draft.publicSections),
      };
    }
  }

  return draft;
}

export async function createDraftFromSession(data: SessionReportData) {
  const hasMaterial =
    data.tasksCompleted.length > 0 ||
    data.bugsFixed.length > 0 ||
    data.resources.length > 0 ||
    data.changes.length > 0;

  if (!hasMaterial) {
    // Rien de publiable : on n'invente pas de patch notes.
    return null;
  }

  const taskCodes = data.tasksCompleted.map((task) => task.code);
  const tasks = await prisma.task.findMany({
    where: { code: { in: taskCodes } },
    select: { code: true, category: true },
  });
  const categories = new Map(tasks.map((task) => [task.code, task.category]));

  const draft = await buildDraftFromSession(data, categories);

  return prisma.patchNote.create({
    data: {
      version: draft.version,
      title: draft.title.slice(0, 200),
      subtitle: draft.subtitle.slice(0, 500),
      internalBody: draft.internalBody,
      publicBody: draft.publicBody || renderSections(buildPublicFallback()),
      status: "DRAFT",
      sessionId: data.sessionId,
      authorId: data.developer.id,
      aiGenerated: isAiConfigured(),
    },
  });
}
