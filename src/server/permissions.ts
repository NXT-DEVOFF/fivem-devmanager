/**
 * Systeme de permissions granulaires.
 *
 * - Chaque role possede un ensemble de permissions par defaut.
 * - Un utilisateur peut recevoir des permissions supplementaires
 *   (permissionsGranted) ou s'en voir retirer (permissionsDenied).
 * - Le controle est TOUJOURS effectue cote serveur.
 */
import type { Role } from "@prisma/client";
import { toStringArray } from "@/lib/json-array";

export const PERMISSIONS = {
  // Administration
  "users.manage": "Gerer les utilisateurs et leurs permissions",
  "users.view": "Consulter l'equipe et les utilisateurs",
  "settings.manage": "Modifier la configuration generale",
  "integrations.manage": "Gerer les integrations (Pterodactyl, SFTP, IA)",
  "audit.view": "Consulter le journal d'audit",
  "roles.manage": "Modifier les permissions",

  // Infrastructure
  "server.view": "Consulter l'etat du serveur",
  "monitoring.view": "Consulter la surveillance (CPU, RAM, historique)",
  "server.power": "Demarrer / arreter / redemarrer le serveur",
  "server.console": "Consulter la console en direct",
  "server.console.send": "Envoyer des commandes console",
  "backups.view": "Consulter les sauvegardes du serveur",
  "backups.manage": "Creer, restaurer et supprimer les sauvegardes",
  "server.logs": "Consulter les logs",
  "resources.view": "Consulter les ressources FiveM",
  "resources.manage": "Synchroniser et administrer les ressources",

  // Fichiers / editeur
  "files.view": "Parcourir et lire les fichiers autorises",
  "files.write": "Modifier, creer et supprimer des fichiers",
  "files.upload": "Televerser des fichiers",
  "files.download": "Telecharger des fichiers",
  "files.search": "Rechercher dans les fichiers et leur contenu",
  "files.restore": "Restaurer des sauvegardes",
  "sync.manage": "Declencher la synchronisation des fichiers suivis",
  "editor.use": "Utiliser l'editeur de code integre",
  "snippets.view": "Consulter la bibliotheque de snippets",
  "snippets.manage": "Creer, modifier et supprimer des snippets",

  // Sessions / taches
  "sessions.start": "Demarrer une session de developpement",
  "sessions.view.own": "Consulter ses propres sessions",
  "sessions.view.all": "Consulter les sessions de toute l'equipe",
  "sessions.manage": "Suspendre / cloturer les sessions",
  "tasks.view": "Consulter les taches",
  "tasks.create": "Creer des taches",
  "tasks.edit": "Modifier les taches",
  "tasks.assign": "Attribuer des taches",
  "tasks.validate": "Valider des taches",
  "tasks.delete": "Supprimer des taches",

  // Sprints / incidents
  "sprints.view": "Consulter les sprints et objectifs",
  "sprints.manage": "Creer et piloter les sprints",
  "incidents.view": "Consulter les incidents de production",
  "incidents.create": "Signaler un incident",
  "incidents.manage": "Prendre en charge et resoudre les incidents",

  // Connaissances / maintenance
  "knowledge.view": "Consulter la base de connaissances",
  "knowledge.manage": "Creer, modifier et supprimer les articles de connaissance",
  "maintenance.view": "Consulter les fenetres de maintenance",
  "maintenance.manage": "Planifier et piloter les fenetres de maintenance",

  // Joueurs / sanctions
  "players.view": "Consulter les joueurs et leur historique de sanctions",
  "players.manage": "Creer, modifier et supprimer les fiches joueurs",
  "sanctions.create": "Emettre des sanctions (avertissement, mute, kick, ban)",
  "sanctions.manage": "Revoquer des sanctions",

  // Anticheat
  "anticheat.view": "Consulter les alertes anticheat",
  "anticheat.manage": "Prendre en compte et traiter les alertes anticheat",

  // Evenements
  "events.view": "Consulter les evenements du serveur",
  "events.manage": "Creer, modifier, annuler et supprimer les evenements",

  // Bugs
  "bugs.view": "Consulter les bugs",
  "bugs.create": "Signaler des bugs",
  "bugs.edit": "Modifier des bugs",
  "bugs.assign": "Assigner des bugs",
  "bugs.close": "Fermer / valider la correction d'un bug",

  // Rapports / patch notes / Discord
  "reports.view.own": "Consulter ses propres rapports",
  "reports.view.all": "Consulter tous les rapports",
  "reports.create": "Generer des rapports",
  "patchnotes.view": "Consulter les patch notes",
  "patchnotes.create": "Creer des patch notes",
  "patchnotes.approve": "Approuver des patch notes",
  "patchnotes.publish": "Publier sur Discord",
  "discord.manage": "Gerer les webhooks Discord",

  // Deploiements
  "deployments.view": "Consulter les deploiements",
  "deployments.request": "Proposer un deploiement",
  "deployments.approve": "Approuver un deploiement",
  "deployments.execute": "Executer un deploiement",
  "deployments.rollback": "Restaurer un deploiement precedent",

  // Notifications / divers
  "notifications.view": "Consulter ses notifications",
  "analytics.view": "Consulter les statistiques",
  "terminal.use": "Utiliser le terminal / console",

  // FiveM Studio
  "studio.view": "Consulter le catalogue et les generateurs FiveM Studio",
  "studio.use": "Executer les generateurs FiveM Studio",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type PermissionMap = Record<Permission, boolean>;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const DEV_BASE: Permission[] = [
  "sessions.start",
  "sessions.view.own",
  "tasks.view",
  "tasks.edit",
  "sprints.view",
  "incidents.view",
  "incidents.create",
  "bugs.view",
  "bugs.create",
  "bugs.edit",
  "files.view",
  "files.write",
  "files.upload",
  "files.download",
  "files.search",
  "editor.use",
  "snippets.view",
  "snippets.manage",
  "server.view",
  "monitoring.view",
  "server.console",
  "server.logs",
  "backups.view",
  "resources.view",
  "reports.view.own",
  "reports.create",
  "patchnotes.view",
  "patchnotes.create",
  "notifications.view",
  "terminal.use",
  "analytics.view",
  "knowledge.view",
  "maintenance.view",
  "players.view",
  "events.view",
  "anticheat.view",
  "studio.view",
  "studio.use",
];

const LEAD_EXTRA: Permission[] = [
  "sessions.view.all",
  "sessions.manage",
  "tasks.create",
  "tasks.assign",
  "tasks.validate",
  "tasks.delete",
  "sprints.manage",
  "incidents.manage",
  "bugs.assign",
  "bugs.close",
  "deployments.view",
  "deployments.request",
  "deployments.approve",
  "deployments.execute",
  "reports.view.all",
  "patchnotes.approve",
  "sync.manage",
  "knowledge.manage",
  "maintenance.manage",
  "players.manage",
  "sanctions.create",
  "sanctions.manage",
  "anticheat.manage",
  "events.manage",
];

const ADMIN_EXTRA: Permission[] = [
  "users.view",
  "users.manage",
  "settings.manage",
  "integrations.manage",
  "audit.view",
  "roles.manage",
  "server.power",
  "server.console.send",
  "backups.manage",
  "resources.manage",
  "files.restore",
  "discord.manage",
  "patchnotes.publish",
  "deployments.rollback",
];

// `bugs.delete` n'existe pas dans PERMISSIONS : filtre defensif ci-dessous.
function sanitize(list: Permission[]): Permission[] {
  return list.filter((p) => p in PERMISSIONS);
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: sanitize([...DEV_BASE, ...LEAD_EXTRA, ...ADMIN_EXTRA, "terminal.use"]),
  LEAD_DEV: sanitize([...DEV_BASE, ...LEAD_EXTRA]),
  DEVELOPER: sanitize(DEV_BASE),
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN: "Administrateur",
  LEAD_DEV: "Responsable de developpement",
  DEVELOPER: "Developpeur",
};

export interface PermissionSubject {
  role: Role;
  permissionsGranted?: unknown;
  permissionsDenied?: unknown;
}

/** Calcule la carte complete des permissions effectives d'un utilisateur. */
export function resolvePermissions(subject: PermissionSubject): PermissionMap {
  const base = new Set<Permission>(ROLE_PERMISSIONS[subject.role] ?? []);
  for (const granted of toStringArray(subject.permissionsGranted)) {
    if (granted in PERMISSIONS) base.add(granted as Permission);
  }
  for (const denied of toStringArray(subject.permissionsDenied)) {
    base.delete(denied as Permission);
  }
  const map = {} as PermissionMap;
  for (const permission of ALL_PERMISSIONS) {
    map[permission] = base.has(permission);
  }
  return map;
}

export function hasPermission(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false;
  if (subject.role === "SUPER_ADMIN" && !toStringArray(subject.permissionsDenied).includes(permission)) {
    return true;
  }
  return Boolean(resolvePermissions(subject)[permission]);
}

export function hasAny(subject: PermissionSubject | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(subject, p));
}

/** Permissions effectives listees (utile pour l'UI). */
export function effectivePermissionList(subject: PermissionSubject): Permission[] {
  return ALL_PERMISSIONS.filter((p) => hasPermission(subject, p));
}

export class PermissionError extends Error {
  permission: Permission;
  constructor(permission: Permission) {
    super(`Permission manquante : ${permission}`);
    this.permission = permission;
  }
}
