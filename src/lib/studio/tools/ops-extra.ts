import {
  bool,
  file,
  mdTable,
  num,
  safeSlug,
  stat,
  str,
} from "../helpers";
import { list, moduleTool, rows } from "./modules-shared";
import type { StudioTool } from "../types";

export const opsExtraTools: StudioTool[] = [
  moduleTool({
    slug: "server-hardening",
    name: "Durcissement serveur",
    category: "serveur",
    description: "Genere un bloc server.cfg de durcissement pour les connexions et licenses.",
    icon: "ShieldCheck",
    tags: ["securite", "server.cfg", "hardening"],
    fields: [
      { name: "maxClients", label: "Joueurs max", type: "number", default: 64, min: 1, max: 2048 },
      { name: "onesync", label: "OneSync", type: "select", options: [{ value: "on", label: "on" }, { value: "legacy", label: "legacy" }, { value: "off", label: "off" }], default: "on" },
      { name: "steamRequired", label: "Steam requis", type: "switch", default: true },
      { name: "licenseKey", label: "Cle license", type: "text", default: "CHANGEME" },
    ],
    build: (input) => {
      const maxClients = num(input, "maxClients", 64);
      const onesync = str(input, "onesync", "on");
      const cfg = `sv_maxclients ${maxClients}\nonesync ${onesync}\nsv_licenseKey ${str(input, "licenseKey", "CHANGEME")}\n${bool(input, "steamRequired") ? "sv_authMaxVariance 1\nsv_authMinTrust 2\n" : ""}set sv_enforceGameBuild 3095\nsetr sv_scriptHookAllowed 0\n`;
      return {
        data: { maxClients, onesync, steamRequired: bool(input, "steamRequired", true), licenseKey: "***" },
        files: [file("server.cfg", cfg, "cfg")],
        stats: [stat("Joueurs max", String(maxClients)), stat("OneSync", onesync)],
        diagnostics: str(input, "licenseKey", "CHANGEME") === "CHANGEME" ? [{ level: "warning", message: "Remplacer la cle license avant le deploiement." }] : [],
      };
    },
  }),
  moduleTool({
    slug: "onesync-preset",
    name: "Preset OneSync",
    category: "serveur",
    description: "Prepare un preset OneSync avec culling et densite adaptes au serveur.",
    icon: "ServerCog",
    tags: ["onesync", "performance", "server.cfg"],
    fields: [
      { name: "mode", label: "Mode", type: "select", options: [{ value: "on", label: "OneSync" }, { value: "legacy", label: "Legacy" }], default: "on" },
      { name: "maxClients", label: "Joueurs max", type: "number", default: 64, min: 8, max: 2048 },
      { name: "cullingRadius", label: "Culling (m)", type: "number", default: 424, min: 100, max: 1000 },
      { name: "density", label: "Densite", type: "number", default: 1, step: 0.1, min: 0.1, max: 2 },
    ],
    build: (input) => ({
      data: { mode: str(input, "mode", "on"), maxClients: num(input, "maxClients", 64), cullingRadius: num(input, "cullingRadius", 424), density: num(input, "density", 1) },
      files: [file("server.cfg", `onesync ${str(input, "mode", "on")}\nsv_maxclients ${num(input, "maxClients", 64)}\nset onesync_population true\nsetr onesync_cullingRadius ${num(input, "cullingRadius", 424)}\nsetr populationDensity ${num(input, "density", 1)}\n`, "cfg")],
      stats: [stat("Mode", str(input, "mode", "on")), stat("Culling", `${num(input, "cullingRadius", 424)} m`)],
    }),
  }),
  moduleTool({
    slug: "resource-start-order",
    name: "Ordre de demarrage",
    category: "serveur",
    description: "Produit un ordre de demarrage des ressources par couches.",
    icon: "ServerCog",
    tags: ["resources", "server.cfg", "demarrage"],
    fields: [
      { name: "mapsCsv", label: "Maps", type: "text", default: "map_chicago, map_interieurs" },
      { name: "frameworksCsv", label: "Frameworks", type: "text", default: "oxmysql, ox_lib, qb-core" },
      { name: "systemsCsv", label: "Systemes", type: "text", default: "fdm-anticheat, fdm-jobs, fdm-shops" },
    ],
    build: (input) => {
      const maps = list(input, "mapsCsv", "map_chicago");
      const frameworks = list(input, "frameworksCsv", "oxmysql");
      const systems = list(input, "systemsCsv", "fdm-anticheat");
      const lines = ["# Maps", ...maps.map((entry) => `ensure ${safeSlug(entry, "map")}`), "", "# Frameworks", ...frameworks.map((entry) => `ensure ${safeSlug(entry, "framework")}`), "", "# Systemes", ...systems.map((entry) => `ensure ${safeSlug(entry, "system")}`)];
      return {
        data: { maps, frameworks, systems },
        files: [file("server.cfg", `${lines.join("\n")}\n`, "cfg")],
        stats: [stat("Maps", String(maps.length)), stat("Systemes", String(systems.length))],
      };
    },
  }),
  moduleTool({
    slug: "player-capacity",
    name: "Capacite joueurs",
    category: "serveur",
    description: "Estime la charge serveur et recommande une limite de joueurs.",
    icon: "Users",
    tags: ["capacite", "performance", "joueurs"],
    fields: [
      { name: "slots", label: "Slots souhaites", type: "number", default: 64, min: 1, max: 2048 },
      { name: "tickBudget", label: "Budget tick (ms)", type: "number", default: 8, step: 0.5, min: 1, max: 32 },
      { name: "avgEntities", label: "Entites / joueur", type: "number", default: 120, min: 1, max: 1000 },
      { name: "headroom", label: "Marge (%)", type: "number", default: 20, min: 0, max: 50 },
    ],
    build: (input) => {
      const slots = num(input, "slots", 64);
      const budget = num(input, "tickBudget", 8);
      const entities = num(input, "avgEntities", 120);
      const headroom = num(input, "headroom", 20);
      const estimated = Math.max(1, Math.round((budget * 1000) / Math.max(1, entities * 0.4)));
      const recommended = Math.max(1, Math.round(slots * (1 - headroom / 100)));
      const report = mdTable(["Indicateur", "Valeur"], [["Slots souhaites", String(slots)], ["Charge estimee", `${estimated} joueurs`], ["Limite recommandee", `${recommended} joueurs`], ["Entites / joueur", String(entities)], ["Marge", `${headroom}%`]]);
      return {
        data: { slots, tickBudget: budget, avgEntities: entities, headroomPercent: headroom, estimatedCapacity: estimated, recommended },
        files: [file("capacity.md", `# Capacite serveur\n\n${report}\n`, "markdown")],
        stats: [stat("Estimation", `${estimated} joueurs`), stat("Recommande", `${recommended} joueurs`)],
        diagnostics: estimated < slots ? [{ level: "warning", message: "La charge estimee est inferieure aux slots souhaites." }] : [],
      };
    },
  }),
  moduleTool({
    slug: "server-culling",
    name: "Culling serveur",
    category: "serveur",
    description: "Configure le culling des entites et le budget de streaming.",
    icon: "ServerCog",
    tags: ["culling", "streaming", "performance"],
    fields: [
      { name: "radius", label: "Rayon (m)", type: "number", default: 424, min: 100, max: 1500 },
      { name: "density", label: "Densite", type: "number", default: 0.8, step: 0.1, min: 0.1, max: 2 },
      { name: "entityBudget", label: "Budget entites", type: "number", default: 2500, min: 100, max: 20000 },
      { name: "updateInterval", label: "Intervalle (ms)", type: "number", default: 1000, min: 100, max: 10000 },
    ],
    build: (input) => ({
      data: { radius: num(input, "radius", 424), density: num(input, "density", 0.8), entityBudget: num(input, "entityBudget", 2500), updateInterval: num(input, "updateInterval", 1000) },
      lua: `CreateThread(function()\n  while true do\n    Wait(Config.ServerCulling.updateInterval)\n    -- Ajuster le streaming selon le budget et la distance.\n  end\nend)\n`,
      stats: [stat("Rayon", `${num(input, "radius", 424)} m`), stat("Budget", String(num(input, "entityBudget", 2500)))],
    }),
  }),
  moduleTool({
    slug: "database-index-audit",
    name: "Audit index base",
    category: "serveur",
    description: "Genere les index recommandes et un rapport d'audit pour une table.",
    icon: "Database",
    tags: ["sql", "index", "performance"],
    fields: [
      { name: "table", label: "Table", type: "text", default: "player_vehicles" },
      { name: "indexesCsv", label: "Index (name,columns)", type: "textarea", rows: 4, default: "idx_owner,owner\nidx_plate,plate\nidx_updated,updated_at" },
      { name: "slowQueryMs", label: "Requete lente (ms)", type: "number", default: 250, min: 10, max: 10000 },
    ],
    build: (input) => {
      const table = safeSlug(str(input, "table", "player_vehicles"));
      const indexes = rows(input, "indexesCsv", ["name", "columns"]).map((row) => ({ name: safeSlug(row.name, "idx"), columns: list({ columns: row.columns }, "columns", "id").map((column) => safeSlug(column, "id")) }));
      const sql = indexes.map((index) => `CREATE INDEX \`${index.name}\` ON \`${table}\` (${index.columns.map((column) => `\`${column}\``).join(", ")});`).join("\n");
      const report = mdTable(["Index", "Colonnes", "Statut"], indexes.map((index) => [index.name, index.columns.join(", "), "A verifier" ]));
      return {
        data: { table, indexes, slowQueryMs: num(input, "slowQueryMs", 250) },
        files: [file("indexes.sql", `${sql}\n`, "sql"), file("audit.md", `# Audit index\n\n${report}\n`, "markdown")],
        stats: [stat("Index", String(indexes.length)), stat("Table", table)],
      };
    },
  }),
  moduleTool({
    slug: "discord-audit-log",
    name: "Audit Discord",
    category: "serveur",
    description: "Genere un relais d'audit Discord via convar, sans exposer le webhook.",
    icon: "Scroll",
    tags: ["discord", "audit", "logs"],
    fields: [
      { name: "webhookEnv", label: "Convar webhook", type: "text", default: "DISCORD_AUDIT_WEBHOOK" },
      { name: "eventsCsv", label: "Evenements", type: "text", default: "player.join, player.leave, vehicle.spawn, admin.command" },
      { name: "color", label: "Couleur", type: "number", default: 3447003, min: 0, max: 16777215 },
      { name: "mentionRole", label: "Role a mentionner", type: "text", default: "" },
    ],
    build: (input) => {
      const events = list(input, "eventsCsv", "player.join");
      return {
        data: { webhookEnv: str(input, "webhookEnv", "DISCORD_AUDIT_WEBHOOK"), events, color: num(input, "color", 3447003), mentionRole: str(input, "mentionRole", "") },
        lua: `local webhook = GetConvar(Config.DiscordAuditLog.webhookEnv, '')\n\nfunction AuditLog(event, message)\n  if webhook == '' then return end\n  if not table.concat(Config.DiscordAuditLog.events, ','):find(event, 1, true) then return end\n  PerformHttpRequest(webhook, function() end, 'POST', json.encode({\n    content = Config.DiscordAuditLog.mentionRole,\n    embeds = { { title = event, description = message, color = Config.DiscordAuditLog.color } },\n  }), { ['Content-Type'] = 'application/json' })\nend\n`,
        stats: [stat("Evenements", String(events.length)), stat("Convar", str(input, "webhookEnv", "DISCORD_AUDIT_WEBHOOK"))],
        diagnostics: [{ level: "info", message: "Le webhook doit rester dans une convar serveur, jamais dans le code." }],
      };
    },
  }),
  moduleTool({
    slug: "backup-rotation",
    name: "Rotation des sauvegardes",
    category: "serveur",
    description: "Planifie la retention des sauvegardes quotidiennes, hebdomadaires et mensuelles.",
    icon: "Database",
    tags: ["backup", "retention", "ops"],
    fields: [
      { name: "retentionDays", label: "Retention (jours)", type: "number", default: 30, min: 1, max: 365 },
      { name: "daily", label: "Sauvegardes / jour", type: "number", default: 4, min: 1, max: 24 },
      { name: "weekly", label: "Sauvegardes / semaine", type: "number", default: 7, min: 1, max: 7 },
      { name: "monthly", label: "Sauvegardes / mois", type: "number", default: 4, min: 1, max: 12 },
      { name: "target", label: "Destination", type: "text", default: "backups/" },
    ],
    build: (input) => {
      const retentionDays = num(input, "retentionDays", 30);
      const report = mdTable(["Type", "Frequence", "Retention"], [["Quotidienne", `${num(input, "daily", 4)} / jour`, `${retentionDays} jours`], ["Hebdomadaire", `${num(input, "weekly", 7)} / semaine`, "8 semaines"], ["Mensuelle", `${num(input, "monthly", 4)} / mois`, "12 mois"]]);
      return {
        data: { retentionDays, daily: num(input, "daily", 4), weekly: num(input, "weekly", 7), monthly: num(input, "monthly", 4), target: str(input, "target", "backups/") },
        files: [file("rotation.md", `# Rotation des sauvegardes\n\n${report}\n\nDestination : \`${str(input, "target", "backups/")}\`\n`, "markdown")],
        stats: [stat("Retention", `${retentionDays} j`), stat("Destination", str(input, "target", "backups/"))],
      };
    },
  }),
  moduleTool({
    slug: "ddos-checklist",
    name: "Checklist anti-DDoS",
    category: "serveur",
    description: "Prepare une checklist de protection et de reaction aux attaques.",
    icon: "ShieldCheck",
    tags: ["ddos", "securite", "checklist"],
    fields: [
      { name: "provider", label: "Hebergeur", type: "text", default: "Pterodactyl" },
      { name: "proxy", label: "Proxy / filtrage", type: "text", default: "Cloudflare Spectrum" },
      { name: "rateLimit", label: "Limite par IP", type: "number", default: 10, min: 1, max: 1000 },
      { name: "fail2ban", label: "Fail2ban", type: "switch", default: true },
    ],
    build: (input) => {
      const checklist = mdTable(["Controle", "Valeur", "Statut"], [["Hebergeur", str(input, "provider", "Pterodactyl"), "A verifier"], ["Proxy", str(input, "proxy", "Cloudflare Spectrum"), "A verifier"], ["Rate limit", String(num(input, "rateLimit", 10)), "A configurer"], ["Fail2ban", bool(input, "fail2ban", true) ? "actif" : "inactif", bool(input, "fail2ban", true) ? "OK" : "A activer"]]);
      return {
        data: { provider: str(input, "provider", "Pterodactyl"), proxy: str(input, "proxy", "Cloudflare Spectrum"), rateLimit: num(input, "rateLimit", 10), fail2ban: bool(input, "fail2ban", true) },
        files: [file("checklist.md", `# Checklist anti-DDoS\n\n${checklist}\n`, "markdown")],
        stats: [stat("Proxy", str(input, "proxy", "Cloudflare Spectrum")), stat("Rate limit", String(num(input, "rateLimit", 10)))],
      };
    },
  }),
  moduleTool({
    slug: "crash-triage",
    name: "Triage de crash",
    category: "serveur",
    description: "Structure l'analyse d'un crash avec ressource, frequence et pistes.",
    icon: "BadgeAlert",
    tags: ["crash", "debug", "ops"],
    fields: [
      { name: "crashType", label: "Type", type: "select", options: [{ value: "server", label: "Serveur" }, { value: "client", label: "Client" }, { value: "resource", label: "Ressource" }], default: "resource" },
      { name: "resource", label: "Ressource", type: "text", default: "fdm-jobs" },
      { name: "frequency", label: "Frequence", type: "select", options: [{ value: "unique", label: "Unique" }, { value: "recurrent", label: "Recurrent" }, { value: "constant", label: "Constant" }], default: "recurrent" },
      { name: "stackSnippet", label: "Extrait de stack", type: "textarea", rows: 5, default: "attempt to index a nil value (field 'coords')" },
    ],
    build: (input) => {
      const triage = mdTable(["Etape", "Action"], [["Reproduire", "Isoler la ressource et les conditions"], ["Corriger", "Proteger les acces nil et valider les entrees"], ["Surveiller", "Verifier les logs et les metriques apres correction"]]);
      return {
        data: { crashType: str(input, "crashType", "resource"), resource: safeSlug(str(input, "resource", "resource")), frequency: str(input, "frequency", "recurrent"), stackSnippet: str(input, "stackSnippet", "") },
        files: [file("triage.md", `# Triage de crash\n\n${triage}\n\n## Stack\n\n\`\`\`\n${str(input, "stackSnippet", "")}\n\`\`\`\n`, "markdown")],
        stats: [stat("Type", str(input, "crashType", "resource")), stat("Frequence", str(input, "frequency", "recurrent"))],
      };
    },
  }),
];
