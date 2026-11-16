import type { Permission } from "@/server/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/sessions", label: "Sessions", icon: "Timer", permission: "sessions.view.own" },
      { href: "/sprints", label: "Sprints", icon: "Target", permission: "sprints.view" },
      { href: "/incidents", label: "Incidents", icon: "Siren", permission: "incidents.view" },
      { href: "/maintenance", label: "Maintenance", icon: "CalendarClock", permission: "maintenance.view" },
      { href: "/tasks", label: "Taches", icon: "ListChecks", permission: "tasks.view" },
      { href: "/bugs", label: "Bugs", icon: "Bug", permission: "bugs.view" },
      { href: "/reports", label: "Rapports", icon: "FileText", permission: "reports.view.own" },
      { href: "/patch-notes", label: "Patch notes", icon: "Sparkles", permission: "patchnotes.view" },
      { href: "/assistant", label: "Assistant IA", icon: "Bot", permission: "reports.view.own" },
      { href: "/analytics", label: "Statistiques", icon: "BarChart3", permission: "analytics.view" },
    ],
  },
  {
    title: "Communaute",
    items: [
      { href: "/players", label: "Joueurs", icon: "Users", permission: "players.view" },
      { href: "/anticheat", label: "Anticheat", icon: "ShieldAlert", permission: "anticheat.view" },
      { href: "/events", label: "Evenements", icon: "CalendarDays", permission: "events.view" },
    ],
  },
  {
    title: "Developpement",
    items: [
      { href: "/editor", label: "Editeur", icon: "Code2", permission: "editor.use" },
      { href: "/snippets", label: "Snippets", icon: "Braces", permission: "snippets.view" },
      { href: "/docs", label: "Documentation", icon: "BookMarked" },
      { href: "/files", label: "Fichiers", icon: "FolderTree", permission: "files.view" },
      { href: "/resources", label: "Ressources", icon: "Boxes", permission: "resources.view" },
      { href: "/sync", label: "Synchronisation", icon: "RefreshCw", permission: "files.view" },
      { href: "/quality", label: "Qualite", icon: "ShieldCheck", permission: "resources.view" },
      { href: "/server-config", label: "Config serveur", icon: "FileCog", permission: "server.view" },
      { href: "/terminal", label: "Terminal", icon: "TerminalSquare", permission: "terminal.use" },
      { href: "/console", label: "Console", icon: "MonitorPlay", permission: "server.console" },
      { href: "/deployments", label: "Deploiements", icon: "Rocket", permission: "deployments.view" },
    ],
  },
  {
    title: "FiveM Studio",
    items: [
      { href: "/studio", label: "Catalogue", icon: "Wrench", permission: "studio.view" },
      { href: "/vehicles", label: "Debug vehicules", icon: "Car", permission: "studio.view" },
      { href: "/mlo", label: "Constructeur MLO", icon: "Building2", permission: "studio.view" },
      { href: "/mlo/builder", label: "Builder MLO 3D", icon: "Boxes", permission: "studio.view" },
      { href: "/mappings", label: "Carte mappings", icon: "Map", permission: "resources.view" },
    ],
  },
  {
    title: "Equipe",
    items: [
      { href: "/knowledge", label: "Connaissances", icon: "BookOpen", permission: "knowledge.view" },
      { href: "/team", label: "Equipe", icon: "UsersRound", permission: "tasks.view" },
      { href: "/users", label: "Utilisateurs", icon: "UserCog", permission: "users.view" },
      { href: "/notifications", label: "Notifications", icon: "Bell", permission: "notifications.view" },
    ],
  },
  {
    title: "Systeme",
    items: [
      { href: "/backups", label: "Sauvegardes", icon: "DatabaseBackup", permission: "backups.view" },
      { href: "/infrastructure", label: "Infrastructure", icon: "ServerCog", permission: "server.view" },
      { href: "/monitoring", label: "Surveillance", icon: "Activity", permission: "monitoring.view" },
      { href: "/diagnostics", label: "Diagnostic", icon: "Stethoscope", permission: "server.view" },
      { href: "/discord", label: "Discord", icon: "MessagesSquare", permission: "discord.manage" },
      { href: "/audit-logs", label: "Journal d'audit", icon: "ScrollText", permission: "audit.view" },
      { href: "/settings", label: "Parametres", icon: "Settings" },
    ],
  },
];
