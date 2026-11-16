/**
 * Journal d'audit immuable.
 * Aucune route de mise a jour ou de suppression n'est exposee.
 */
import "server-only";
import type { AuditResult, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AuditInput {
  actorId?: string | null;
  actorLabel: string;
  action: string;
  targetType?: string;
  targetId?: string;
  result?: AuditResult;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Nettoie les metadonnees : jamais de secrets dans les logs. */
const SENSITIVE_KEYS = /(password|secret|token|apikey|api_key|authorization|privatekey|webhook)/i;

export function sanitizeMetadata(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (depth > 4) return undefined;
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.slice(0, 2000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeMetadata(item, depth + 1))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key)) {
        result[key] = "[redacted]";
        continue;
      }
      const sanitized = sanitizeMetadata(item, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return undefined;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel.slice(0, 160),
        action: input.action.slice(0, 120),
        targetType: input.targetType?.slice(0, 60) ?? null,
        targetId: input.targetId?.slice(0, 120) ?? null,
        result: input.result ?? "SUCCESS",
        ip: input.ip?.slice(0, 60) ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        metadata: sanitizeMetadata(input.metadata ?? {}),
      },
    });
  } catch (error) {
    // L'audit ne doit jamais faire echouer l'action metier, mais doit etre visible.
    console.error("[audit] echec d'ecriture:", error);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.login.failed": "Echec de connexion",
  "auth.logout": "Deconnexion",
  "auth.session.revoke": "Session revoquee",
  "auth.password.change": "Mot de passe modifie",
  "auth.password.reset": "Mot de passe reinitialise",
  "auth.2fa.enable": "Double authentification activee",
  "auth.2fa.disable": "Double authentification desactivee",
  "user.create": "Utilisateur cree",
  "user.update": "Utilisateur modifie",
  "user.permissions": "Permissions modifiees",
  "user.deactivate": "Utilisateur desactive",
  "integration.pterodactyl.save": "Configuration Pterodactyl enregistree",
  "integration.sftp.save": "Configuration SFTP enregistree",
  "server.power": "Action d'alimentation serveur",
  "server.command": "Commande console envoyee",
  "file.write": "Fichier modifie",
  "file.create": "Fichier cree",
  "file.delete": "Fichier supprime",
  "file.rename": "Fichier renomme",
  "file.upload": "Fichier televerse",
  "file.restore": "Version de fichier restauree",
  "session.start": "Session demarree",
  "session.pause": "Session mise en pause",
  "session.resume": "Session reprise",
  "session.end": "Session terminee",
  "session.manage": "Session geree par un responsable",
  "task.create": "Tache creee",
  "task.update": "Tache modifiee",
  "task.validate": "Tache validee",
  "task.delete": "Tache supprimee",
  "task.attachment.add": "Piece jointe ajoutee",
  "sprint.create": "Sprint cree",
  "sprint.update": "Sprint mis a jour",
  "sprint.task.add": "Tache ajoutee au sprint",
  "sprint.task.remove": "Tache retiree du sprint",
  "incident.create": "Incident signale",
  "incident.update": "Incident mis a jour",
  "incident.resolve": "Incident resolu",
  "knowledge.create": "Article de connaissance cree",
  "knowledge.update": "Article de connaissance mis a jour",
  "knowledge.delete": "Article de connaissance supprime",
  "maintenance.create": "Fenetre de maintenance planifiee",
  "maintenance.update": "Fenetre de maintenance mise a jour",
  "player.create": "Fiche joueur creee",
  "player.update": "Fiche joueur mise a jour",
  "player.delete": "Fiche joueur supprimee",
  "sanction.create": "Sanction emise",
  "sanction.revoke": "Sanction revoquee",
  "anticheat.acknowledge": "Alerte anticheat prise en compte",
  "anticheat.resolve": "Alerte anticheat traitee",
  "anticheat.reopen": "Alerte anticheat reouverte",
  "event.create": "Evenement cree",
  "event.update": "Evenement mis a jour",
  "event.delete": "Evenement supprime",
  "task.attachment.remove": "Piece jointe supprimee",
  "bug.create": "Bug signale",
  "bug.update": "Bug modifie",
  "bug.close": "Bug ferme",
  "deployment.request": "Deploiement propose",
  "deployment.approve": "Deploiement approuve",
  "deployment.execute": "Deploiement execute",
  "deployment.rollback": "Rollback effectue",
  "patchnote.create": "Patch notes creees",
  "patchnote.approve": "Patch notes approuvees",
  "patchnote.publish": "Patch notes publiees",
  "discord.webhook.save": "Webhook Discord enregistre",
  "discord.webhook.delete": "Webhook Discord supprime",
  "settings.update": "Configuration mise a jour",
  "studio.run": "Outil FiveM Studio execute",
};
