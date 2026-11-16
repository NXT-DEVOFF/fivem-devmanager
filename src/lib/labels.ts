/** Libelles et variantes visuelles des enums metier. */

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export const TASK_STATUS: Record<string, { label: string; variant: BadgeVariant; column: string }> = {
  BACKLOG: { label: "Backlog", variant: "neutral", column: "Backlog" },
  TODO: { label: "A faire", variant: "info", column: "A faire" },
  IN_PROGRESS: { label: "En cours", variant: "primary", column: "En cours" },
  TESTING: { label: "En test", variant: "warning", column: "En test" },
  REVIEW: { label: "En validation", variant: "warning", column: "En attente de validation" },
  DONE: { label: "Termine", variant: "success", column: "Termine" },
  BLOCKED: { label: "Bloque", variant: "danger", column: "Bloque" },
};

export const TASK_COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "REVIEW", "DONE", "BLOCKED"] as const;

export const PRIORITY: Record<string, { label: string; variant: BadgeVariant }> = {
  LOW: { label: "Basse", variant: "neutral" },
  MEDIUM: { label: "Moyenne", variant: "info" },
  HIGH: { label: "Haute", variant: "warning" },
  URGENT: { label: "Urgente", variant: "danger" },
};

export const CATEGORY: Record<string, string> = {
  SCRIPT: "Script",
  UI: "Interface",
  MAPPING: "Mapping",
  VEHICLES: "Vehicules",
  OPTIMIZATION: "Optimisation",
  DATABASE: "Base de donnees",
  CONFIG: "Configuration",
  SECURITY: "Securite",
  BUGFIX: "Bugfix",
  GAMEPLAY: "Gameplay",
  ADMINISTRATION: "Administration",
};

export const BUG_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  NEW: { label: "Nouveau", variant: "danger" },
  TRIAGE: { label: "A analyser", variant: "warning" },
  FIXING: { label: "En correction", variant: "primary" },
  TESTING: { label: "En test", variant: "warning" },
  FIXED: { label: "Corrige", variant: "success" },
  CLOSED: { label: "Ferme", variant: "neutral" },
};

export const SEVERITY: Record<string, { label: string; variant: BadgeVariant }> = {
  CRITICAL: { label: "Critique", variant: "danger" },
  HIGH: { label: "Eleve", variant: "warning" },
  MEDIUM: { label: "Moyen", variant: "info" },
  LOW: { label: "Faible", variant: "neutral" },
};

export const SESSION_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: "En cours", variant: "success" },
  PAUSED: { label: "En pause", variant: "warning" },
  COMPLETED: { label: "Terminee", variant: "neutral" },
  CANCELLED: { label: "Annulee", variant: "danger" },
};

export const DEPLOYMENT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "En attente", variant: "warning" },
  APPROVED: { label: "Approuve", variant: "info" },
  REJECTED: { label: "Refuse", variant: "danger" },
  DEPLOYED: { label: "Deploye", variant: "success" },
  FAILED: { label: "Echec", variant: "danger" },
  ROLLED_BACK: { label: "Rollback", variant: "warning" },
};

export const PATCH_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Brouillon", variant: "neutral" },
  REVIEW: { label: "En relecture", variant: "warning" },
  APPROVED: { label: "Approuve", variant: "info" },
  SCHEDULED: { label: "Planifie", variant: "primary" },
  PUBLISHED: { label: "Publie", variant: "success" },
};

export const SPRINT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PLANNED: { label: "Planifie", variant: "info" },
  ACTIVE: { label: "En cours", variant: "success" },
  COMPLETED: { label: "Termine", variant: "neutral" },
  ARCHIVED: { label: "Archive", variant: "neutral" },
};

export const INCIDENT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: "Ouvert", variant: "danger" },
  INVESTIGATING: { label: "En investigation", variant: "warning" },
  MITIGATED: { label: "Maitrise", variant: "info" },
  RESOLVED: { label: "Resolu", variant: "success" },
};

export const CHANGE_TYPE: Record<string, string> = {
  FILE_CREATED: "Cree",
  FILE_MODIFIED: "Modifie",
  FILE_DELETED: "Supprime",
  FILE_RENAMED: "Renomme",
  FOLDER_CREATED: "Dossier cree",
  FOLDER_DELETED: "Dossier supprime",
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN: "Administrateur",
  LEAD_DEV: "Responsable dev",
  DEVELOPER: "Developpeur",
};

export const WEBHOOK_KIND: Record<string, string> = {
  PATCH_NOTES: "Patch notes",
  REPORTS: "Rapports",
  ERRORS: "Erreurs",
  SESSIONS: "Sessions",
  NOTIFICATIONS: "Notifications",
  DEPLOYMENTS: "Deploiements",
};

export const SOURCE_LABELS: Record<string, string> = {
  EDITOR: "Editeur",
  UPLOAD: "Upload",
  API: "API",
  SYNC: "Synchronisation",
  DEPLOYMENT: "Deploiement",
  ROLLBACK: "Rollback",
};
