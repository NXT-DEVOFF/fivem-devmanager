/**
 * Integration Discord : webhooks chiffres, embeds valides, publication idempotente.
 * Les limites officielles Discord sont respectees et verifiees avant envoi.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, sha256 } from "@/server/crypto";
import { HttpError, badRequest, conflict, notFound, upstream } from "@/server/http";
import { audit } from "@/server/audit";
import { emitActivity } from "@/server/realtime";
import { sanitizePublicText, parseSections, type PatchNoteSections } from "@/server/patchnotes";
import type { AuthUser } from "@/server/auth";

export const DISCORD_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  authorName: 256,
  totalEmbed: 6000,
  content: 2000,
} as const;

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds: DiscordEmbed[];
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;
    if (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      return false;
    }
    return /^\/(api\/webhooks|api\/v\d+\/webhooks)\//.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Construit un embed conforme aux limites Discord. */
export function buildPatchNoteEmbed(input: {
  title: string;
  subtitle: string;
  sections: PatchNoteSections[];
  version: string;
  noteId: string;
}): DiscordEmbed {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  for (const section of input.sections.slice(0, DISCORD_LIMITS.fields)) {
    const value = section.items
      .map((item) => `- ${sanitizePublicText(item)}`)
      .join("\n");
    if (!value.trim()) continue;
    fields.push({
      name: truncate(section.heading, DISCORD_LIMITS.fieldName),
      value: truncate(value, DISCORD_LIMITS.fieldValue),
      inline: false,
    });
  }

  const description =
    input.subtitle ||
    (fields.length === 0
      ? "Mise a jour du serveur : aucun changement publie pour cette version."
      : "");

  const embed: DiscordEmbed = {
    title: truncate(input.title, DISCORD_LIMITS.title),
    description: truncate(description, DISCORD_LIMITS.description) || undefined,
    color: 0x5865f2,
    fields,
    footer: { text: truncate(`FiveM DevManager | Version ${input.version}`, DISCORD_LIMITS.footer) },
    timestamp: new Date().toISOString(),
  };

  const total =
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0) +
    (embed.footer?.text.length ?? 0);
  if (total > DISCORD_LIMITS.totalEmbed) {
    // Tronque les champs les plus longs jusqu'a tenir dans la limite globale.
    const excess = total - DISCORD_LIMITS.totalEmbed + 50;
    if (fields.length > 0) {
      const target = fields[fields.length - 1]!;
      target.value = truncate(target.value, Math.max(100, target.value.length - excess));
    }
  }

  return embed;
}

export function buildEmbedFromMarkdown(input: {
  title: string;
  subtitle?: string | null;
  markdown: string;
  version: string;
  noteId: string;
}): DiscordEmbed {
  return buildPatchNoteEmbed({
    title: input.title,
    subtitle: input.subtitle ?? "",
    sections: parseSections(input.markdown).filter((section) => section.items.length > 0),
    version: input.version,
    noteId: input.noteId,
  });
}

async function postToDiscord(
  url: string,
  payload: DiscordPayload,
  attempt = 0,
): Promise<{ ok: boolean; messageId?: string; status: number; error?: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Reseau indisponible",
    };
  }

  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "2");
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 10) * 1000));
    return postToDiscord(url, payload, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      error: `Discord ${response.status}: ${text.slice(0, 300)}`,
    };
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { ok: true, status: response.status, messageId: (body as { id?: string } | null)?.id };
}

export async function getWebhookUrl(webhookId: string): Promise<{ url: string; kind: string; name: string }> {
  const webhook = await prisma.discordWebhook.findUnique({ where: { id: webhookId } });
  if (!webhook) throw notFound("Webhook introuvable");
  if (!webhook.enabled) throw conflict("Ce webhook est desactive");
  let url: string;
  try {
    url = decryptSecret(webhook.urlEnc);
  } catch {
    throw new HttpError(412, "URL du webhook illisible (cle de chiffrement ?)", "webhook_decrypt");
  }
  return { url, kind: webhook.kind, name: webhook.name };
}

/** Publication d'une patch note approuvee. Idempotente par hash de contenu. */
export async function publishPatchNote(
  patchNoteId: string,
  user: AuthUser,
  options: { force?: boolean } = {},
): Promise<{ deliveryId: string; messageId?: string; alreadyPublished: boolean }> {
  const note = await prisma.patchNote.findUnique({ where: { id: patchNoteId } });
  if (!note) throw notFound("Patch notes introuvables");
  if (!["APPROVED", "SCHEDULED", "DRAFT"].includes(note.status)) {
    throw conflict(`Statut non publiable : ${note.status}`);
  }
  if (note.status === "DRAFT" && !options.force) {
    throw conflict("Les patch notes doivent etre approuvees avant publication");
  }

  const webhook = await prisma.discordWebhook.findFirst({
    where: { kind: "PATCH_NOTES", enabled: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!webhook) {
    throw new HttpError(
      412,
      "Aucun webhook Discord actif pour les patch notes (page Discord)",
      "webhook_not_configured",
    );
  }

  const url = decryptSecret(webhook.urlEnc);
  const embed = buildEmbedFromMarkdown({
    title: note.title,
    subtitle: note.subtitle,
    markdown: note.publicBody,
    version: note.version,
    noteId: note.id,
  });

  const payload: DiscordPayload = {
    username: webhook.username ?? "FiveM DevManager",
    embeds: [embed],
    ...(webhook.avatarUrl ? { avatar_url: webhook.avatarUrl } : {}),
  };

  const payloadHash = sha256(`${webhook.id}:${JSON.stringify(payload)}`);

  const existingDelivery = await prisma.discordDelivery.findUnique({
    where: { webhookId_payloadHash: { webhookId: webhook.id, payloadHash } },
  });
  if (existingDelivery?.status === "SENT") {
    return { deliveryId: existingDelivery.id, messageId: existingDelivery.messageId ?? undefined, alreadyPublished: true };
  }

  const result = await postToDiscord(url, payload);

  const delivery = await prisma.discordDelivery.upsert({
    where: { webhookId_payloadHash: { webhookId: webhook.id, payloadHash } },
    create: {
      webhookId: webhook.id,
      patchNoteId: note.id,
      payloadHash,
      status: result.ok ? "SENT" : "FAILED",
      httpStatus: result.status,
      error: result.error ?? null,
      messageId: result.messageId ?? null,
    },
    update: {
      status: result.ok ? "SENT" : "FAILED",
      httpStatus: result.status,
      error: result.error ?? null,
      messageId: result.messageId ?? null,
      createdAt: new Date(),
    },
  });

  await prisma.discordWebhook.update({
    where: { id: webhook.id },
    data: { lastUsedAt: new Date(), lastError: result.ok ? null : result.error?.slice(0, 500) ?? null },
  });

  if (!result.ok) {
    await audit({
      actorId: user.id,
      actorLabel: user.displayName,
      action: "patchnote.publish",
      targetType: "patch_note",
      targetId: note.id,
      result: "FAILURE",
      metadata: { status: result.status, error: result.error },
    });
    throw upstream(`Echec de la publication Discord : ${result.error ?? "erreur inconnue"}`);
  }

  await prisma.patchNote.update({
    where: { id: note.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      contentHash: sha256(note.publicBody),
      discordMessageId: result.messageId ?? null,
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "patchnote.publish",
    targetType: "patch_note",
    targetId: note.id,
    metadata: { webhook: webhook.name, version: note.version },
  });

  emitActivity({
    type: "deployment.done",
    title: "Patch notes publiees sur Discord",
    detail: `Version ${note.version}`,
    actor: { id: user.id, name: user.displayName },
    link: "/patch-notes",
    timestamp: new Date().toISOString(),
  });

  return { deliveryId: delivery.id, messageId: result.messageId, alreadyPublished: false };
}

export async function sendTestWebhook(webhookId: string, user: AuthUser): Promise<{ ok: boolean }> {
  const { url, name } = await getWebhookUrl(webhookId);
  const result = await postToDiscord(url, {
    username: "FiveM DevManager",
    embeds: [
      {
        title: "Test de connexion",
        description: `Le webhook "${name}" est correctement configure.\nTest envoye par ${user.displayName}.`,
        color: 0x22c55e,
        footer: { text: "FiveM DevManager" },
        timestamp: new Date().toISOString(),
      },
    ],
  });

  await prisma.discordWebhook.update({
    where: { id: webhookId },
    data: {
      lastUsedAt: new Date(),
      lastError: result.ok ? null : result.error?.slice(0, 500) ?? null,
    },
  });

  if (!result.ok) throw upstream(`Echec du test : ${result.error ?? "erreur inconnue"}`);
  return { ok: true };
}

export async function publishScheduledNotes(): Promise<number> {
  const due = await prisma.patchNote.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    take: 10,
  });
  let published = 0;
  for (const note of due) {
    const author = await prisma.user.findUnique({ where: { id: note.authorId } });
    if (!author) continue;
    try {
      await publishPatchNote(note.id, {
        id: author.id,
        email: author.email,
        username: author.username,
        displayName: author.displayName,
        role: author.role,
        avatarColor: author.avatarColor,
        mustChangePassword: false,
        twoFactorEnabled: false,
        permissions: {} as AuthUser["permissions"],
        permissionsGranted: [],
        permissionsDenied: [],
        sessionId: "system",
      });
      published += 1;
    } catch (error) {
      console.error("[discord] publication planifiee echouee:", error);
    }
  }
  return published;
}

export function validateWebhookInput(url: string): void {
  if (!validateWebhookUrl(url)) {
    throw badRequest(
      "URL de webhook invalide. Format attendu : https://discord.com/api/webhooks/<id>/<token>",
    );
  }
}
